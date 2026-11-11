-- Avatar du joueur (users.avatar_url existe déjà) et logo de ligue.
-- Deux buckets publics en lecture ; l'écriture passe UNIQUEMENT par les server
-- actions (client service, image revalidée et recompressée par sharp), donc
-- aucune policy d'écriture sur storage.objects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 524288, array['image/webp']),
  ('league-logos', 'league-logos', true, 524288, array['image/webp'])
on conflict (id) do nothing;

alter table leagues add column if not exists logo_url text;
