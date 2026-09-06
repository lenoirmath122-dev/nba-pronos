-- ============================================================================
-- NBA PRONOS — V1 — ADMIN : VISIBILITÉ DE TOUTES LES LIGUES
-- ============================================================================
-- Fichier   : supabase/migrations/20260906090000_admin_leagues_visibility.sql
-- Motif     : nouveau bloc "vue d'ensemble" du tableau de bord admin (total
--             inscrits + nombre de membres par ligue) — `leagues_select` et
--             `league_memberships_select` (migration #16/#17) ne renvoient
--             que les ligues dont l'appelant est LUI-MÊME membre, un admin
--             n'a donc aujourd'hui aucune visibilité sur les ligues des
--             autres joueurs. `users_select` couvre déjà le total d'inscrits
--             (using (true), migration #3) — aucun changement nécessaire là.
--
-- Deux policies SELECT permissives supplémentaires (Postgres les combine en
-- OR avec les policies existantes, ne les remplace pas) — même patron que
-- `secrets_select`/`audit_select` (migration #3) : public.is_admin() en
-- garde-fou, aucun code de ligue exposé (league_secrets non touchée ici).
-- ============================================================================

create policy leagues_select_admin on leagues for select using (
  public.is_admin()
);

create policy league_memberships_select_admin on league_memberships for select using (
  public.is_admin()
);

-- ============================================================================
-- FIN — migration.
-- Vérif post-push : SELECT sur `leagues`/`league_memberships` en session
-- ADMIN doit renvoyer TOUTES les lignes (pas seulement les ligues dont
-- l'admin est membre) ; en session joueur non-admin, comportement inchangé
-- (toujours restreint à ses propres ligues, migration #16/#17).
-- ============================================================================
