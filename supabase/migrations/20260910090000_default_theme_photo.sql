-- ============================================================================
-- NBA PRONOS — THÈME PAR DÉFAUT : PHOTO
-- ============================================================================
-- Fichier   : supabase/migrations/20260910090000_default_theme_photo.sql
-- Nature    : change le thème par défaut d'un nouveau compte de Sombre à
--             Photo (fond plein écran, cf. migration 20260806100000_
--             theme_photo_enum.sql). Ne touche pas background_theme (déjà
--             'MURAL' par défaut depuis la migration 20260806090000 — la
--             photo standard). N'affecte que les comptes créés à partir de
--             cette migration, pas de bascule rétroactive des joueurs
--             existants (contrairement à 20260806110000_migrate_photo_theme
--             .sql, qui migrait un choix déjà fait explicitement).
-- ============================================================================

alter table users
  alter column theme_preference set default 'PHOTO';

-- handle_new_user() ne fixe pas theme_preference explicitement (repose sur
-- le défaut de colonne ci-dessus) — recréée seulement pour corriger son
-- commentaire, qui citait l'ancien défaut.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, pseudo, age_confirmed_at)
  values (new.id, new.raw_user_meta_data ->> 'pseudo', now());
  -- role (PLAYER), status (ACTIVE), theme_preference (PHOTO) : défauts de T1.
  return new;
end;
$$;

-- ============================================================================
-- FIN.
-- ============================================================================
