-- NBA PRONOS — Classement hebdomadaire, lot 0 : snapshots figés.
--
-- Le snapshot quotidien du classement (leaderboard_snapshots) est désormais
-- figé : une fois la ligne du jour écrite, elle n'est plus jamais modifiée.
-- Le lot 1 calcule les points de la semaine par différence entre deux
-- snapshots de lundi. On persiste aussi les valeurs de départage (bons
-- vainqueurs, écarts exacts), qui n'étaient pas stockées.
--
-- Colonnes nullables : les snapshots historiques ne sont pas reconstituables
-- (pas de backfill). Le lot 1 traite NULL comme « départage inconnu ».
-- Les suppressions par user_id / competition_id (delete_account_data,
-- scripts/delete-player-account.mjs, fixtures d'intégration) ne sont pas
-- touchées : seul UPDATE est interdit, pas DELETE.

alter table leaderboard_snapshots
  add column if not exists correct_match_winners int,
  add column if not exists exact_margins int;

-- Les lecteurs (tendance de rang, récaps, lot 1) filtrent par
-- (competition_id, snapshot_date) ; l'index unique existant commence par
-- (competition_id, user_id).
create index if not exists idx_leaderboard_snapshots_competition_date
  on leaderboard_snapshots (competition_id, snapshot_date);

-- « Figé » garanti en base (service_role contourne la RLS, pas un trigger).
create or replace function leaderboard_snapshots_forbid_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'leaderboard_snapshots est figé : UPDATE interdit (DELETE puis réinsertion en cas de correction exceptionnelle)';
end;
$$;

drop trigger if exists trg_leaderboard_snapshots_forbid_update on leaderboard_snapshots;
create trigger trg_leaderboard_snapshots_forbid_update
  before update on leaderboard_snapshots
  for each row execute function leaderboard_snapshots_forbid_update();
