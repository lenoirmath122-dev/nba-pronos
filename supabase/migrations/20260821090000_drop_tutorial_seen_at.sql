-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #30 — RETRAIT tutorial_seen_at
-- ============================================================================
-- Fichier : supabase/migrations/20260821090000_drop_tutorial_seen_at.sql
-- Motif   : tutoriel joueur ("Comment jouer ?", TutorialBanner/TutorialModal/
--           TutorialLink, migration #21 20260730130000_tutorial_seen_at.sql)
--           entierement retire (21/08/2026) — la page /regles couvre
--           desormais ce besoin, demande explicite de l'utilisateur. Colonne
--           retiree symetriquement pour ne pas laisser une colonne orpheline,
--           plus lue par aucun code apres ce retrait (meme logique que la
--           migration #20, drop_use_team_colors.sql).
-- ============================================================================

alter table users
  drop column tutorial_seen_at;

-- ============================================================================
-- FIN — migration #30.
-- ============================================================================
