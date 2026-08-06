-- ============================================================================
-- NBA PRONOS — FOND D'ÉCRAN PERSONNALISABLE (DA)
-- ============================================================================
-- Fichier   : supabase/migrations/20260806090000_background_theme.sql
-- Nature    : image de fond plein écran choisie par le joueur parmi les
--             photos disponibles (Cadrage/DA/*.zip), appliquée à tous les
--             écrans .photo-page (app/globals.css) via l'attribut data-bg
--             posé sur <html> par app/layout.tsx — même patron que
--             theme_preference (05/08→06/08/2026). 'MURAL' = défaut (photo
--             déjà en place avant ce lot, aucun changement visuel pour un
--             joueur qui ne touche jamais ce réglage).
-- RLS       : aucune migration nécessaire — la policy users_update_self
--             (migration #3, 20260718110000_rls.sql) et le trigger
--             enforce_users_invariants (qui ne garde que role/status)
--             couvrent déjà toute nouvelle colonne sur users.
-- ============================================================================

create type background_theme as enum ('MURAL', 'HOOP', 'HK');

alter table users
  add column background_theme background_theme not null default 'MURAL';

-- ============================================================================
-- FIN.
-- ============================================================================
