-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #20 — RETRAIT use_team_colors
-- ============================================================================
-- Fichier   : supabase/migrations/20260730120000_drop_use_team_colors.sql
-- Motif     : « couleurs d'équipe sur Profil » (migration #19,
--             20260730110000_use_team_colors.sql) essayée puis abandonnée
--             par l'utilisateur le jour même ("je ne pense pas que ça ait
--             d'importance") — code revenu en arrière (git revert, commits
--             `bea23e0`/`b694bbc`). Colonne retirée symétriquement pour ne
--             pas laisser une colonne orpheline, jamais lue par aucun code
--             après ce revert.
-- ============================================================================

alter table users
  drop column use_team_colors;

-- ============================================================================
-- FIN — migration #20.
-- ============================================================================
