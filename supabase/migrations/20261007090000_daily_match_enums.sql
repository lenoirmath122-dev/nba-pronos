-- ============================================================================
-- NBA PRONOS — COMPÉTITION « MATCH DU JOUR » (DAILY_MATCH) — VALEURS D'ENUM
-- ============================================================================
-- Fichier   : supabase/migrations/20261007090000_daily_match_enums.sql
-- Nature    : ajoute competition_type = 'DAILY_MATCH' et playoff_round =
--             'DAILY' (tour des séries techniques, invisibles côté joueur).
--             Cadrage : Cadrage/Fonctionnel/nba_pronos_cadrage_competition_match_du_jour.md
-- Isolation : valeurs d'enum ajoutées SEULES dans ce fichier — PostgreSQL
--             interdit de les utiliser dans la même transaction. Les gardes
--             qui les utilisent vivent dans 20261007100000_daily_match_guards.sql.
-- ============================================================================

alter type competition_type add value if not exists 'DAILY_MATCH';
alter type playoff_round add value if not exists 'DAILY';
