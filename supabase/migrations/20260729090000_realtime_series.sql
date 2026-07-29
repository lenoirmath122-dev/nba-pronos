-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #14 — PUBLICATION REALTIME SUR `series`
-- ============================================================================
-- Fichier   : supabase/migrations/20260729090000_realtime_series.sql
-- Motif     : T6c §2.2/§14.2 (SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_c.md) —
--             « series EST utile » au Realtime (drill-down série + résumé
--             bracket live). Migration #8 (24/07/2026) avait publié `matches`
--             mais délibérément PAS `series`, faute d'écran qui la consomme
--             encore (voir son commentaire + GAPS_OUVERTS.md). L'écran
--             Bracket (vue globale, /bracket) la consomme désormais :
--             NodeCard doit refléter un official_winner_team_id qui change
--             SANS reload (§2.44 ETAT_ACTUEL.md).
-- Effet     : la RLS s'applique nativement au canal Realtime (A9/T4 §9) —
--             `series` est déjà lisible par tous (policy `series_select`,
--             migration #2/RLS initiale, `using (true)`), donc tout abonné
--             reçoit déjà les mêmes changements qu'un SELECT direct. Aucune
--             policy modifiée par cette migration.
-- ============================================================================

alter publication supabase_realtime add table series;

-- ============================================================================
-- FIN — migration #14.
-- Vérif post-push : ouvrir /bracket dans deux onglets (dont un visiteur sans
-- session), écrire une mise à jour de series.official_winner_team_id (via
-- service_role, à la main faute de synchro T4 branchée sur une vraie série en
-- cours) et confirmer la réception du payload côté client SANS revalidatePath
-- (T6a §2.2) dans les deux onglets.
-- ============================================================================
