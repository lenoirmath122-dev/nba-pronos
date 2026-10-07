-- ============================================================================
-- NBA PRONOS — TRAÇABILITÉ DE L'IMPORT DES STATS NBA (sync_logs.sync_type)
-- ============================================================================
-- Fichier   : supabase/migrations/20261008090000_sync_type_stats_import.sql
-- Nature    : ajoute sync_type = 'STATS_IMPORT', écrit par
--             Cadrage/Stats/service/refresh_daily.py à chaque exécution (succès
--             ou échec), pour savoir quand les box scores ont réellement été
--             importés -- le 07/10/2026, un timeout stats.nba.com avait laissé
--             un job vert sans aucune trace.
-- Isolation : valeur d'enum ajoutée SEULE dans ce fichier (PostgreSQL interdit
--             de l'utiliser dans la même transaction), même patron que
--             20261007090000_daily_match_enums.sql.
-- ============================================================================

alter type sync_type add value if not exists 'STATS_IMPORT';
