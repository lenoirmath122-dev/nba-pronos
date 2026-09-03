-- Rate limiting applicatif de base (SEC-001 de l'audit du 03/09/2026, item
-- A2 du plan d'action) -- aucun frein technique n'existait jusqu'ici sur
-- les Server Actions à contenu répétable (chat, paris, signalements de
-- bug), au-delà des quotas métier déjà en place (ex. 3 paris MATCH/série).
--
-- Table à fenêtre glissante minimaliste plutôt qu'un compteur en mémoire
-- applicative : Vercel exécute les Server Actions sur des instances
-- serverless sans état partagé fiable entre invocations, un compteur en
-- mémoire ne survivrait pas d'un appel à l'autre. Volumes attendus très
-- faibles (cercle fermé d'amis) -- pas besoin d'un service dédié (Redis
-- etc.), Postgres suffit largement à ce stade.
create table rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references users (id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

-- Colonnes dans cet ordre (user_id, action, created_at) : couvre à la fois
-- le filtre exact (user_id, action) et le tri par date pour la purge des
-- lignes expirées, en un seul index.
create index rate_limit_events_user_action_idx on rate_limit_events (user_id, action, created_at);

-- RLS activée sans policy : deny-all pour anon/authenticated, même
-- convention que les tables stats_* (T3) -- seule la fonction
-- SECURITY DEFINER ci-dessous y écrit/lit, jamais une requête directe.
alter table rate_limit_events enable row level security;

-- Fenêtre glissante : au plus p_max_count évènements de type p_action pour
-- l'utilisateur COURANT (auth.uid(), jamais un paramètre -- appelée via le
-- client de session, pas service_role, donc auth.uid() résout bien le
-- joueur qui appelle) sur les p_window_seconds dernières secondes. Purge
-- les lignes expirées DE CE joueur/cette action au passage (pas de cron
-- de nettoyage séparé nécessaire vu les volumes attendus) plutôt qu'un
-- comptage brut qui ferait grossir la table indéfiniment.
-- pg_advisory_xact_lock (même patron que save_bet, migration #9) ferme la
-- fenêtre de course entre 2 requêtes concurrentes du même joueur sur la
-- même action.
create or replace function check_rate_limit(p_action text, p_max_count int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count int;
begin
  if v_user_id is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user_id::text || ':' || p_action));

  delete from rate_limit_events
    where user_id = v_user_id
      and action = p_action
      and created_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into v_count from rate_limit_events where user_id = v_user_id and action = p_action;

  if v_count >= p_max_count then
    return false;
  end if;

  insert into rate_limit_events (user_id, action) values (v_user_id, p_action);
  return true;
end;
$$;

-- Appelable par tout joueur authentifié (limite SA PROPRE fenêtre -- un
-- appel direct avec des paramètres différents de ceux codés côté
-- TypeScript ne desserre que la limite du joueur qui appelle, jamais celle
-- d'un autre : impact nul sur les autres, cohérent avec la gravité Faible
-- retenue pour ce point dans l'audit).
grant execute on function check_rate_limit(text, int, int) to authenticated;
revoke all on function check_rate_limit(text, int, int) from anon;
