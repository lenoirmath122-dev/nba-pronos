-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #3 — RLS COMPLÈTE
-- ============================================================================
-- Fichier   : supabase/migrations/20260718110000_rls.sql
-- Nature    : transcription fidèle de SPEC_TECHNIQUE_RLS_V0.1.md (T3, validé le
--             18/07/2026). Correctif join_code + fonctions SECURITY DEFINER +
--             activation RLS + policies + triggers d'invariants.
-- Périmètre : sécurité d'accès. Ne contient PAS le moteur de scoring (T5) ni les
--             server actions / écrans (T6).
-- Base neuve : aucune donnée à casser par l'activation RLS.
-- Rappel P2 : synchro / heartbeat / seeds utilisent service_role, qui CONTOURNE
--             la RLS → pas de policy pour eux. Tout le reste (joueurs, admins)
--             passe en session utilisateur, donc sous ces policies.
-- ============================================================================

-- ── 1. Correctif join_code : sortir le secret de competitions (T3 §3) ───────
create table competition_secrets (
  competition_id uuid primary key references competitions(id) on delete cascade,
  join_code text not null
);

-- Reprise du contenu (aucune ligne en base neuve, geste correct conservé).
insert into competition_secrets (competition_id, join_code)
  select id, join_code from competitions;

alter table competitions drop column join_code;

-- verify_join_code lit désormais competition_secrets (toujours definer, jamais exposé).
create or replace function public.verify_join_code(p_code text)
returns uuid
language sql security definer stable set search_path = public
as $$
  select cs.competition_id
  from competition_secrets cs
  join competitions c on c.id = cs.competition_id
  where c.status = 'ACTIVE'
    and lower(trim(cs.join_code)) = lower(trim(p_code))
  limit 1;
$$;

-- ── 2. Fonctions SECURITY DEFINER (T3 §2) ───────────────────────────────────
-- Definer = contourne la RLS DANS la fonction → pas de récursion de policy.

create function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from users where id = auth.uid() and role = 'ADMIN');
$$;

create function public.is_active() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from users where id = auth.uid() and status = 'ACTIVE');
$$;

create function public.match_is_locked(p_match uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from matches m
    where m.id = p_match and m.scheduled_at is not null and m.scheduled_at <= now()
  );
$$;

create function public.has_committed_prediction(p_match uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from match_predictions mp
    where mp.match_id = p_match and mp.user_id = auth.uid() and mp.status <> 'DRAFT'
  );
$$;

create function public.bracket_deadline_passed(p_competition uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from competitions c
    where c.id = p_competition and c.bracket_deadline is not null and c.bracket_deadline <= now()
  );
$$;

-- Un pari est-il PUBLIC ? statut public (VALIDATED/WON/LOST) ET deadline passée
-- (0.2.4 §3/§9). Deadline : tip-off du match (MATCH) ou 1er match (SERIES).
create function public.bet_is_public(p_bet uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from bets b
    where b.id = p_bet
      and b.status in ('VALIDATED','WON','LOST')
      and (
        (b.scope = 'MATCH' and exists (
           select 1 from matches m
           where m.id = b.match_id and m.scheduled_at is not null and m.scheduled_at <= now()))
        or
        (b.scope = 'SERIES' and
           (select min(m.scheduled_at) from matches m where m.series_id = b.series_id) <= now())
      )
  );
$$;

-- La deadline d'un pari est-elle ENCORE OUVERTE ? (garde d'écriture « avant
-- deadline », T3 §5). Helper d'implémentation : prend les valeurs de la ligne
-- en cours d'insertion/màj (donc utilisable en with check, sans self-référence).
create function public.bet_deadline_open(p_scope bet_scope, p_series uuid, p_match uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select case
    when p_scope = 'MATCH' then exists (
      select 1 from matches m
      where m.id = p_match and (m.scheduled_at is null or m.scheduled_at > now()))
    when p_scope = 'SERIES' then
      coalesce((select min(m.scheduled_at) from matches m where m.series_id = p_series),
               'infinity'::timestamptz) > now()
    else false
  end;
$$;

-- ── 3. Activation de la RLS sur toutes les tables publiques (T3 §9.3) ────────
alter table users                 enable row level security;
alter table teams                 enable row level security;
alter table competitions          enable row level security;
alter table competition_secrets   enable row level security;
alter table series                enable row level security;
alter table matches               enable row level security;
alter table entity_mappings       enable row level security;
alter table brackets              enable row level security;
alter table bracket_picks         enable row level security;
alter table match_predictions     enable row level security;
alter table bets                  enable row level security;
alter table correction_requests   enable row level security;
alter table audit_logs            enable row level security;
alter table sync_logs             enable row level security;
alter table competition_archives  enable row level security;

-- ── 4. Policies SELECT (T3 §4) ──────────────────────────────────────────────

-- Public : aucune colonne secrète (email retiré en D5).
create policy users_select        on users                for select using (true);
create policy teams_select        on teams                for select using (true);
create policy competitions_select on competitions         for select using (true);
create policy series_select       on series               for select using (true);
create policy matches_select      on matches              for select using (true);
create policy archives_select     on competition_archives for select using (true);

-- Admin uniquement (données privées).
create policy secrets_select   on competition_secrets for select using (public.is_admin());
create policy mappings_select  on entity_mappings     for select using (public.is_admin());
create policy audit_select     on audit_logs          for select using (public.is_admin());
create policy synclogs_select  on sync_logs           for select using (public.is_admin());

-- Brackets : propriétaire, admin, ou après la deadline du bracket.
-- (Pas de « valider = voir » ici : vérifié contre 0.2.2 §9/§3.)
create policy brackets_select on brackets for select using (
  user_id = auth.uid()
  or public.is_admin()
  or public.bracket_deadline_passed(competition_id)
);
create policy bracket_picks_select on bracket_picks for select using (
  exists (select 1 from brackets b where b.id = bracket_id and b.user_id = auth.uid())
  or public.is_admin()
  or public.bracket_deadline_passed(competition_id)
);

-- Pronos match : la règle « valider = voir » (0.2.3 §9).
create policy match_predictions_select on match_predictions for select using (
  user_id = auth.uid()
  or public.is_admin()
  or (
    status <> 'DRAFT'
    and (
      public.match_is_locked(match_id)
      or public.has_committed_prediction(match_id)
    )
  )
);

-- Paris : propriétaire, admin, ou pari public à sa deadline.
create policy bets_select on bets for select using (
  user_id = auth.uid()
  or public.is_admin()
  or public.bet_is_public(id)
);

-- Requêtes de correction : auteur ou admin.
create policy correction_requests_select on correction_requests for select using (
  requester_user_id = auth.uid()
  or public.is_admin()
);

-- ── 5. Policies d'écriture (T3 §5) ──────────────────────────────────────────

-- users : profil par soi-même ; role/status par un admin. Champs sensibles et
-- invariants (dernier admin, auto-rétrogradation) gardés par le trigger §6.
-- Pas d'INSERT (créé par le trigger handle_new_user, definer). Pas de DELETE.
create policy users_update_self on users for update
  using (id = auth.uid())          with check (id = auth.uid());
create policy users_update_admin on users for update
  using (public.is_admin())        with check (public.is_admin());

-- competition_secrets : admin plein (création / rotation du code).
create policy secrets_all on competition_secrets for all
  using (public.is_admin())        with check (public.is_admin());

-- competitions : admin (création / édition). Pas de DELETE.
create policy competitions_insert on competitions for insert with check (public.is_admin());
create policy competitions_update on competitions for update
  using (public.is_admin())        with check (public.is_admin());

-- series / matches : admin édite les données OFFICIELLES (0.2.7 §4).
-- (INSERT via synchro service_role = bypass.)
create policy series_update  on series  for update using (public.is_admin()) with check (public.is_admin());
create policy matches_update on matches for update using (public.is_admin()) with check (public.is_admin());

-- entity_mappings : admin confirme (INSERT via synchro service_role = bypass).
create policy mappings_update on entity_mappings for update using (public.is_admin()) with check (public.is_admin());

-- brackets : propriétaire actif, avant la deadline (modifiable même après
-- validation tant que la deadline n'est pas passée — 0.2.2 §3). Pas de DELETE.
create policy brackets_insert on brackets for insert with check (
  user_id = auth.uid() and public.is_active() and not public.bracket_deadline_passed(competition_id)
);
create policy brackets_update on brackets for update using (
  user_id = auth.uid() and public.is_active() and not public.bracket_deadline_passed(competition_id)
) with check (user_id = auth.uid());

create policy bracket_picks_insert on bracket_picks for insert with check (
  public.is_active()
  and not public.bracket_deadline_passed(competition_id)
  and exists (select 1 from brackets b where b.id = bracket_id and b.user_id = auth.uid())
);
create policy bracket_picks_update on bracket_picks for update using (
  public.is_active()
  and not public.bracket_deadline_passed(competition_id)
  and exists (select 1 from brackets b where b.id = bracket_id and b.user_id = auth.uid())
) with check (
  exists (select 1 from brackets b where b.id = bracket_id and b.user_id = auth.uid())
);

-- match_predictions : saisie/édition d'un brouillon (joueur actif, match non
-- verrouillé) ; irréversibilité via status='DRAFT'. Correction admin séparée.
-- Pas de DELETE (le brouillon est modifiable à volonté, jamais supprimé).
create policy mp_insert on match_predictions for insert with check (
  user_id = auth.uid() and public.is_active() and not public.match_is_locked(match_id)
);
create policy mp_update_self on match_predictions for update using (
  user_id = auth.uid() and public.is_active()
  and status = 'DRAFT' and not public.match_is_locked(match_id)
) with check (user_id = auth.uid());
create policy mp_update_admin on match_predictions for update
  using (public.is_admin()) with check (public.is_admin());  -- règles de correction : trigger §6

-- bets : création/édition par le joueur avant validation et avant deadline ;
-- validation/résolution par l'admin. Quota assuré par les index (T1). Pas de DELETE.
create policy bets_insert on bets for insert with check (
  user_id = auth.uid() and public.is_active()
  and public.bet_deadline_open(scope, series_id, match_id)
);
create policy bets_update_self on bets for update using (
  user_id = auth.uid() and public.is_active()
  and status in ('DRAFT','SUBMITTED')
  and public.bet_deadline_open(scope, series_id, match_id)
) with check (user_id = auth.uid());
create policy bets_update_admin on bets for update
  using (public.is_admin()) with check (public.is_admin());  -- transitions : trigger §6

-- correction_requests : émission par le joueur ; traitement par un admin qui
-- n'en est pas l'auteur (≥ 2 admins, 0.2.7 §2/§6). Pas de DELETE.
create policy cr_insert on correction_requests for insert with check (
  requester_user_id = auth.uid() and public.is_active()
);
create policy cr_update_admin on correction_requests for update using (
  public.is_admin() and requester_user_id <> auth.uid()
) with check (
  public.is_admin() and requester_user_id <> auth.uid()
);

-- audit_logs : append-only par un admin (acteur = lui-même, ou système NULL).
create policy audit_insert on audit_logs for insert with check (
  public.is_admin() and (actor_user_id = auth.uid() or actor_user_id is null)
);

-- competition_archives : écrit à la clôture (admin ; ou service_role = bypass).
create policy archives_insert on competition_archives for insert with check (public.is_admin());

-- (teams : aucune policy d'écriture → écritures réservées à la synchro service_role.)
-- (sync_logs : idem, inserts via service_role.)

-- ── 6. Triggers d'invariants (T3 §6) ────────────────────────────────────────

-- T-a : garde-fous sur users (anti-escalade, dernier admin, auto-rétrogradation).
create function public.enforce_users_invariants()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Seul un admin peut modifier role ou status.
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and not public.is_admin() then
    raise exception 'Modification de role/status reservee aux admins';
  end if;
  -- Un admin ne peut pas se retrograder lui-meme.
  if auth.uid() = old.id and old.role = 'ADMIN' and new.role <> 'ADMIN' then
    raise exception 'Un admin ne peut pas se retrograder lui-meme';
  end if;
  -- Le dernier admin actif ne peut etre ni retrograde ni desactive.
  if old.role = 'ADMIN' and old.status = 'ACTIVE'
     and (new.role <> 'ADMIN' or new.status <> 'ACTIVE') then
    if (select count(*) from users
        where role = 'ADMIN' and status = 'ACTIVE' and id <> old.id) = 0 then
      raise exception 'Impossible de retirer le dernier admin actif';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_users_invariants before update on users
  for each row execute function public.enforce_users_invariants();

-- T-b : machine a etats des pronos et paris (transitions autorisees seulement).
create function public.enforce_match_prediction_transitions()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Pas de retour arriere vers DRAFT une fois valide/verrouille.
  if old.status <> 'DRAFT' and new.status = 'DRAFT' then
    raise exception 'Transition prono % -> DRAFT interdite', old.status;
  end if;
  return new;
end;
$$;
create trigger trg_mp_transitions before update on match_predictions
  for each row execute function public.enforce_match_prediction_transitions();

create function public.enforce_bet_transitions()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status <> new.status and not (
       (old.status = 'DRAFT'     and new.status in ('SUBMITTED','CANCELLED'))
    or (old.status = 'SUBMITTED' and new.status in ('VALIDATED','REJECTED','CANCELLED'))
    or (old.status = 'VALIDATED' and new.status in ('WON','LOST','CANCELLED'))
    or (new.status = 'CANCELLED')  -- neutralisation possible depuis la plupart des etats
  ) then
    raise exception 'Transition pari % -> % interdite', old.status, new.status;
  end if;
  return new;
end;
$$;
create trigger trg_bet_transitions before update on bets
  for each row execute function public.enforce_bet_transitions();

-- T-c : correction admin d'un prono = requete liee + admin != auteur (0.2.3 §7).
create function public.enforce_prediction_correction()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.corrected_by_admin_id is not null
     and new.corrected_by_admin_id is distinct from old.corrected_by_admin_id then
    if new.corrected_by_admin_id = new.user_id then
      raise exception 'Un admin ne peut pas corriger son propre prono';
    end if;
    if new.correction_request_id is null then
      raise exception 'Correction admin sans requete liee interdite';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_prediction_correction before update on match_predictions
  for each row execute function public.enforce_prediction_correction();

-- ============================================================================
-- FIN — migration #3.
-- Vérif post-push : jouer le plan de test de T3 §7 (anon / joueur A / joueur B /
-- admin). Si un SELECT anon sur une table publique renvoie vide de façon
-- inattendue, vérifier les GRANT anon/authenticated (normalement posés par
-- défaut par Supabase sur les tables du schéma public).
-- ============================================================================
