-- ============================================================================
-- NBA PRONOS — BASCULE DES JOUEURS DÉJÀ SUR UNE PHOTO NON-DÉFAUT
-- ============================================================================
-- Fichier   : supabase/migrations/20260806110000_migrate_photo_theme.sql
-- Nature    : suite de 20260806100000_theme_photo_enum.sql — un joueur qui
--             avait déjà choisi HOOP ou HK via l'ancien sélecteur « Fond
--             d'écran » (background_theme, migration 20260806090000, en
--             place depuis quelques heures seulement) a fait un choix
--             explicite : son thème_preference bascule directement sur
--             'PHOTO' pour qu'il continue à voir sa photo sans action de sa
--             part. Décidé AVEC l'utilisateur le 06/08/2026 (plutôt que de
--             remettre tout le monde sur Sombre par défaut).
--             background_theme n'a plus d'effet visuel que si
--             theme_preference = 'PHOTO' (app/globals.css) — colonne
--             conservée telle quelle, aucun changement de schéma ici.
-- ============================================================================

update users set theme_preference = 'PHOTO' where background_theme <> 'MURAL';

-- ============================================================================
-- FIN.
-- ============================================================================
