-- NBA PRONOS — Classement hebdomadaire, lot 1 : calcul, figement, palmarès.
--
-- Fichier : 20261012090000_weekly_ranking.sql
-- Motif   : un champion par semaine (lundi 10h Paris -> lundi 10h Paris) à
--           partir des snapshots figés du lot 0 (points de la semaine = snapshot
--           du lundi n - snapshot du lundi n-1).
--
-- - competitions.weekly_ranking : interrupteur par compétition (défaut false,
--   aucune donnée existante modifiée : l'activation est un geste admin).
-- - weekly_rankings : en-tête d'une semaine figée (même sans champion). Porte
--   les dates de snapshot réellement utilisées : la semaine n+1 repart du
--   snapshot de FIN de la semaine n, même si celui-ci a été pris en retard.
-- - weekly_champions : le palmarès (co-champions possibles).
-- - freeze_weekly_ranking() : figement atomique et idempotent.
-- - delete_account_data() : purge weekly_champions (FK sans cascade).

alter table competitions
  add column if not exists weekly_ranking boolean not null default false;

create table if not exists weekly_rankings (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id),
  week_end_date date not null,
  start_snapshot_date date not null,
  end_snapshot_date date not null,
  tiebreak_available boolean not null,
  frozen_by text not null check (frozen_by in ('CRON', 'ADMIN')),
  frozen_at timestamptz not null default now(),
  unique (competition_id, week_end_date),
  check (start_snapshot_date < end_snapshot_date),
  check (end_snapshot_date >= week_end_date)
);

create table if not exists weekly_champions (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null,
  week_end_date date not null,
  user_id uuid not null references users(id),
  points int not null check (points > 0),
  correct_match_winners int,
  exact_margins int,
  created_at timestamptz not null default now(),
  unique (competition_id, week_end_date, user_id),
  foreign key (competition_id, week_end_date)
    references weekly_rankings (competition_id, week_end_date)
);

create index if not exists idx_weekly_champions_user on weekly_champions (user_id);

alter table weekly_rankings enable row level security;
alter table weekly_champions enable row level security;

drop policy if exists weekly_rankings_select on weekly_rankings;
create policy weekly_rankings_select on weekly_rankings for select using (true);
drop policy if exists weekly_champions_select on weekly_champions;
create policy weekly_champions_select on weekly_champions for select using (true);
-- Aucune policy d'écriture : service_role uniquement.

-- « Figé » garanti en base. DELETE reste permis (RGPD, correction exceptionnelle).
create or replace function weekly_forbid_update()
returns trigger
language plpgsql
as $$
begin
  raise exception '% est figé : UPDATE interdit (DELETE puis réinsertion en cas de correction exceptionnelle)', tg_table_name;
end;
$$;

drop trigger if exists trg_weekly_rankings_forbid_update on weekly_rankings;
create trigger trg_weekly_rankings_forbid_update
  before update on weekly_rankings
  for each row execute function weekly_forbid_update();

drop trigger if exists trg_weekly_champions_forbid_update on weekly_champions;
create trigger trg_weekly_champions_forbid_update
  before update on weekly_champions
  for each row execute function weekly_forbid_update();

-- Retourne false si la semaine était déjà figée (appel concurrent ou rejoué).
create or replace function freeze_weekly_ranking(
  p_competition_id uuid,
  p_week_end_date date,
  p_start_snapshot_date date,
  p_end_snapshot_date date,
  p_tiebreak_available boolean,
  p_frozen_by text,
  p_champions jsonb
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_count int;
begin
  insert into weekly_rankings (
    competition_id, week_end_date, start_snapshot_date, end_snapshot_date,
    tiebreak_available, frozen_by
  )
  values (
    p_competition_id, p_week_end_date, p_start_snapshot_date, p_end_snapshot_date,
    p_tiebreak_available, p_frozen_by
  )
  on conflict (competition_id, week_end_date) do nothing;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    return false;
  end if;

  insert into weekly_champions (
    competition_id, week_end_date, user_id, points, correct_match_winners, exact_margins
  )
  select
    p_competition_id,
    p_week_end_date,
    (c->>'user_id')::uuid,
    (c->>'points')::int,
    (c->>'correct_match_winners')::int,
    (c->>'exact_margins')::int
  from jsonb_array_elements(coalesce(p_champions, '[]'::jsonb)) c;

  return true;
end;
$$;

revoke all on function freeze_weekly_ranking(uuid, date, date, date, boolean, text, jsonb) from public;
revoke all on function freeze_weekly_ranking(uuid, date, date, date, boolean, text, jsonb) from anon;
revoke all on function freeze_weekly_ranking(uuid, date, date, date, boolean, text, jsonb) from authenticated;
grant execute on function freeze_weekly_ranking(uuid, date, date, date, boolean, text, jsonb) to service_role;

-- delete_account_data : version de 20260908090000 + purge de weekly_champions.
create or replace function delete_account_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Références admin : nullifiées (lignes appartenant à D'AUTRES joueurs,
  -- où la cible a seulement agi en tant qu'admin) -- jamais supprimées.
  update bets set validated_by_admin_id = null where validated_by_admin_id = p_user_id;
  update bets set resolved_by_admin_id = null where resolved_by_admin_id = p_user_id;
  update bets set corrected_by_admin_id = null where corrected_by_admin_id = p_user_id;
  update match_predictions set corrected_by_admin_id = null where corrected_by_admin_id = p_user_id;
  update bug_reports set resolved_by_admin_id = null where resolved_by_admin_id = p_user_id;
  update correction_requests set handled_by_admin_id = null where handled_by_admin_id = p_user_id;
  update entity_mappings set confirmed_by_admin_id = null where confirmed_by_admin_id = p_user_id;
  update chat_message_reports set message_author_id = null where message_author_id = p_user_id;
  update chat_message_reports set resolved_by_admin_id = null where resolved_by_admin_id = p_user_id;

  -- bracket_picks n'a pas de user_id direct -- purgé via les brackets de la cible.
  delete from bracket_picks where bracket_id in (select id from brackets where user_id = p_user_id);

  -- Casse la FK circulaire bets/match_predictions <-> correction_requests
  -- avant de purger cette dernière.
  update match_predictions set correction_request_id = null where user_id = p_user_id;
  update bets set correction_request_id = null where user_id = p_user_id;

  -- Tables possédées, feuilles vers racines.
  delete from correction_requests where requester_user_id = p_user_id;
  delete from bets where user_id = p_user_id;
  delete from match_predictions where user_id = p_user_id;
  delete from brackets where user_id = p_user_id;
  delete from chat_messages where user_id = p_user_id;
  delete from bug_reports where user_id = p_user_id;
  delete from chat_message_reports where reporter_user_id = p_user_id;
  delete from league_memberships where user_id = p_user_id;

  -- Ligues créées par la cible, purgées SEULEMENT si elle en était l'unique
  -- membre (voir commentaire de migration ci-dessus) -- une ligue encore
  -- multi-membres reste intacte, laissant created_by_user_id pointer vers un
  -- compte qui n'existera plus (déjà le cas aujourd'hui si le créateur
  -- quitte sa propre ligue sans la supprimer, comportement pré-existant).
  delete from leagues
    where created_by_user_id = p_user_id
      and not exists (
        select 1 from league_memberships
        where league_memberships.league_id = leagues.id
          and league_memberships.user_id <> p_user_id
      );

  -- Palmarès hebdo : weekly_champions.user_id n'a pas de ON DELETE, purge
  -- explicite (sinon la FK bloquerait auth.admin.deleteUser()). weekly_rankings
  -- (en-tête de semaine, sans user_id) reste.
  delete from weekly_champions where user_id = p_user_id;
  delete from leaderboard_snapshots where user_id = p_user_id;
  delete from competition_superlatives where user_id = p_user_id;
  delete from competition_archives where user_id = p_user_id;
  delete from audit_logs where actor_user_id = p_user_id;
end;
$$;

-- CREATE OR REPLACE conserve les droits ; répétés par prudence (sans effet).
revoke all on function delete_account_data(uuid) from public;
revoke all on function delete_account_data(uuid) from anon;
revoke all on function delete_account_data(uuid) from authenticated;
