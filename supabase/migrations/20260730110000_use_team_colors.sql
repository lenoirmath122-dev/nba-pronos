-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #19 — COULEURS D'ÉQUIPE SUR PROFIL
-- ============================================================================
-- Fichier   : supabase/migrations/20260730110000_use_team_colors.sql
-- Motif     : BACKLOG_V1.md « Personnalisation du profil » — couleurs de
--             l'interface Profil adaptées à l'équipe favorite choisie, avec
--             un bouton pour revenir au thème de base. Bascule persistée
--             (pas juste un état client qui reviendrait à chaque rechargement).
--
-- Une seule colonne, aucune policy RLS nouvelle : déjà couverte par
-- `users_update_self` (migration #3, `using (id = auth.uid())`) et déjà
-- lisible par tous via `users_select using (true)` (D5, pas une donnée
-- sensible). Sans effet tant que `favorite_team_id` est NULL (comportement
-- par défaut inchangé, décidé dès le 28/07/2026).
--
-- Les couleurs elles-mêmes ne sont PAS en base (constante de code,
-- lib/labels/teamColors.ts, même convention que les logos de franchise
-- déduits par abréviation) — aucune colonne teams.* ajoutée.
-- ============================================================================

alter table users
  add column use_team_colors boolean not null default true;

-- ============================================================================
-- FIN — migration #19.
-- ============================================================================
