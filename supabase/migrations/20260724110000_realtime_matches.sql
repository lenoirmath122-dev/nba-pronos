-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #8 — PUBLICATION REALTIME SUR `matches`
-- ============================================================================
-- Fichier   : supabase/migrations/20260724110000_realtime_matches.sql
-- Motif     : SPEC_ECRAN_MES_PRONOS_V0_1.md §1/§5 — l'écran "Mes pronos" porte
--             le badge EN DIRECT + le score courant (T4 §9, T6c §2/§14.2) via
--             une souscription Realtime unique sur `matches` (LiveSubscriber,
--             composant client 1/1 de l'écran).
-- Portée    : `matches` UNIQUEMENT. `series` (prévue par T4 §9, resserrée par
--             T6c §14.2 pour le drill-down/résumé bracket live) N'EST PAS
--             publiée ici : aucun écran ne la consomme encore. Elle le sera au
--             lot "Bracket personnel", quand un écran en aura réellement besoin
--             — chaque table publiée quand un écran en a besoin, pas avant
--             (cf. GAPS_OUVERTS.md, point ajouté à ce lot).
-- Effet     : la RLS s'applique nativement au canal Realtime (A9/T4 §9) —
--             `matches` est déjà lisible par tous (policy `matches_select`,
--             migration #3, `using (true)`), donc tout abonné reçoit déjà les
--             mêmes changements de score/statut qu'un SELECT direct. Aucune
--             policy modifiée par cette migration.
-- ============================================================================

alter publication supabase_realtime add table matches;

-- ============================================================================
-- FIN — migration #8.
-- Vérif post-push : ouvrir deux sessions sur un même match verrouillé, écrire
-- une mise à jour de matches.status/home_score/away_score (via service_role,
-- à la main faute de synchro T4 codée) et confirmer la réception du payload
-- côté client SANS revalidatePath (T6a §2.2).
-- ============================================================================
