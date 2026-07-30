-- ============================================================================
-- NBA PRONOS — TUTORIEL JOUEUR — flag "déjà proposé/vu"
-- ============================================================================
-- Fichier   : supabase/migrations/20260730130000_tutorial_seen_at.sql
-- Nature    : SPEC_TUTORIEL_JOUEUR_V0_1.md §4. NULL = jamais proposé (la
--             bannière Accueil s'affiche) ; non-NULL = déjà proposé une fois
--             (Découvrir, Plus tard, ou fermeture anticipée du wizard —
--             posé au premier de ces événements, pas seulement à la
--             complétion des 7 étapes), la bannière ne réapparaît plus.
-- RLS       : aucune migration nécessaire — la policy users_update_self
--             (migration #3) et le trigger enforce_users_invariants (qui ne
--             garde que role/status) couvrent déjà toute nouvelle colonne.
-- ============================================================================

alter table users
  add column tutorial_seen_at timestamptz null default null;

-- ============================================================================
-- FIN.
-- ============================================================================
