-- Chantier "prolongation" (GAPS_OUVERTS.md, 24/08/2026) -- signal necessaire
-- a la RESOLUTION des paris "went_to_ot" (bet_subject=MATCH_TOTAL). Peuplee
-- directement par la synchro (lib/sync/results.ts, wentToOvertime() sur
-- state.score.homeTeam/awayTeam) au moment ou le match passe FINISHED --
-- colonne simple sur matches, pas de RPC update_bet_structuration a etendre
-- (contrairement aux colonnes bets.structured_*).
alter table matches add column went_to_ot boolean;
