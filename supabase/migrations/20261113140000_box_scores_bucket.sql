-- Feuilles de match statiques (box score seul) des matchs NBA terminés : un JSON par
-- match, écrit par la VM (Cadrage/Stats/service/box_scores.py, clé service_role) et lu
-- par l'appli directement depuis le CDN de Supabase (components/play/BoxScoreDialog.tsx).
-- Bucket public en lecture (stats NBA publiques) ; aucune policy d'écriture sur
-- storage.objects : seule la clé service_role, qui contourne RLS, peut y écrire.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('box-scores', 'box-scores', true, 65536, array['application/json'])
on conflict (id) do nothing;
