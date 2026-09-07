-- Rate limiting applicatif sur les routes AVANT authentification (p1-12,
-- feuille de route Phase 1) -- login/signup/reset-password n'ont, avant ce
-- correctif, aucun frein applicatif au-delà de Turnstile (qui bloque les
-- bots, pas un attaquant humain qui enchaîne les tentatives à la main).
-- check_rate_limit() (migration 20260903150000) est inutilisable ici : il
-- clé sur auth.uid(), toujours NULL avant authentification. Table/fonction
-- séparées, clées sur un IDENTIFIANT fourni par l'appelant (IP dérivée
-- côté serveur, jamais un champ de formulaire) plutôt que auth.uid().
--
-- Sécurité : check_anon_rate_limit() N'EST PAS accordée à anon/authenticated
-- (contrairement à check_rate_limit()) -- un accès direct permettrait à
-- n'importe qui d'écrire des évènements sous un IDENTIFIANT ARBITRAIRE
-- (spoofing) pour épuiser la limite d'une victime avant même sa 1ère
-- tentative. Appelée UNIQUEMENT depuis lib/auth/anonRateLimit.ts via le
-- client service_role -- le serveur Next.js dérive lui-même l'IP depuis les
-- en-têtes de la requête, jamais depuis une entrée utilisateur.
create table anon_rate_limit_events (
  id bigint generated always as identity primary key,
  identifier text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create index anon_rate_limit_events_id_action_idx on anon_rate_limit_events (identifier, action, created_at);

-- RLS activée sans policy : deny-all pour anon/authenticated (y compris en
-- lecture) -- seul service_role (qui contourne la RLS) y accède.
alter table anon_rate_limit_events enable row level security;

create or replace function check_anon_rate_limit(p_identifier text, p_action text, p_max_count int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtext(p_identifier || ':' || p_action));

  delete from anon_rate_limit_events
    where identifier = p_identifier
      and action = p_action
      and created_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into v_count from anon_rate_limit_events where identifier = p_identifier and action = p_action;

  if v_count >= p_max_count then
    return false;
  end if;

  insert into anon_rate_limit_events (identifier, action) values (p_identifier, p_action);
  return true;
end;
$$;

-- PAS de grant à anon/authenticated (voir commentaire de tête). Accordé
-- explicitement à service_role pour rendre l'intention lisible (il
-- contourne de toute façon la RLS/les grants par défaut).
grant execute on function check_anon_rate_limit(text, text, int, int) to service_role;
revoke all on function check_anon_rate_limit(text, text, int, int) from anon, authenticated;
