-- Audit RLS anon (18/11/2026) : `users_select` laisse tout visiteur lire
-- toutes les lignes ET toutes les colonnes (préférences de notification,
-- age_confirmed_at, rôle...). Le mode invité ouvre des pages publiques : on
-- restreint `anon` aux seules colonnes d'identité publique. `authenticated`
-- garde l'accès complet (les lignes restent filtrées par la RLS).
revoke select on public.users from anon;
-- `role`, `status`, `created_at` : lus par les pages publiques (classement,
-- annuaire, profil joueur, badges) avec le rôle anon.
grant select (id, pseudo, avatar_url, favorite_team_id, bio, pinned_badge_ids, role, status, created_at)
  on public.users to anon;
