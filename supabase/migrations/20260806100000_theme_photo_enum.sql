-- ============================================================================
-- NBA PRONOS — THÈME PHOTO (3e VALEUR D'ENUM)
-- ============================================================================
-- Fichier   : supabase/migrations/20260806100000_theme_photo_enum.sql
-- Nature    : fusionne le fond photo plein écran (background_theme, migration
--             20260806090000) dans le réglage de thème existant : Sombre /
--             Clair / Photo deviennent 3 choix MUTUELLEMENT EXCLUSIFS au lieu
--             de 2 axes indépendants (thème × fond) — décidé avec
--             l'utilisateur le 06/08/2026 suite au constat que le thème clair
--             est illisible sur les 9 écrans .photo-page/.glass-card (aucun
--             override [data-theme="light"] pour ces 2 classes).
-- Isolation : cette valeur d'enum est ajoutée SEULE dans ce fichier —
--             PostgreSQL interdit d'utiliser une valeur d'enum dans la même
--             transaction que celle qui l'ajoute. La bascule de données qui
--             UTILISE 'PHOTO' vit dans la migration suivante
--             (20260806110000_migrate_photo_theme.sql).
-- ============================================================================

alter type theme_preference add value 'PHOTO';

-- ============================================================================
-- FIN.
-- ============================================================================
