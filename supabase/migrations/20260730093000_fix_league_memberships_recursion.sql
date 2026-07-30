-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #17 — CORRECTIF : récursion RLS sur league_memberships
-- ============================================================================
-- Fichier   : supabase/migrations/20260730093000_fix_league_memberships_recursion.sql
-- Motif     : trouvé en testant la migration #16 en conditions réelles
--             (2 comptes jetables, script de vérification), PAS en relisant
--             le code — `league_memberships_select` contenait une sous-requête
--             sur SA PROPRE table (« league_id in (select league_id from
--             league_memberships where user_id = auth.uid()) ») : Postgres
--             ré-applique la RLS à cette sous-requête, qui ré-applique la
--             même policy, etc. → "infinite recursion detected in policy for
--             relation league_memberships". Puisque `leagues_select` et
--             `league_secrets_select` (migration #16) interrogent elles-mêmes
--             league_memberships via EXISTS, TOUTE lecture touchant les 3
--             tables était cassée, pas seulement league_memberships direct.
--
-- Correctif : même patron que is_admin()/is_active() (migration #3) — une
-- fonction SECURITY DEFINER contourne la RLS pour SA PROPRE lecture interne,
-- ce qui casse la boucle. `my_league_ids()` ne renvoie que les league_id de
-- l'appelant courant (auth.uid()), rien d'autre.
-- ============================================================================

create function public.my_league_ids() returns setof uuid
language sql security definer stable set search_path = public as $$
  select league_id from league_memberships where user_id = auth.uid();
$$;

drop policy league_memberships_select on league_memberships;

create policy league_memberships_select on league_memberships for select using (
  user_id = auth.uid()
  or league_id in (select public.my_league_ids())
);

-- ============================================================================
-- FIN — migration #17.
-- Vérif post-push : rejouer scripts/_verify-leagues-tmp.mjs (jetable, non
-- committé) — les 10 assertions doivent passer, notamment la lecture du code
-- par un membre et le DELETE (quitter) qui échouaient avant ce correctif.
-- ============================================================================
