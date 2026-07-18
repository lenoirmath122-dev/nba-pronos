-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #4 — CORRECTIF TRIGGER users (contexte système)
-- ============================================================================
-- Fichier : supabase/migrations/20260718120000_fix_users_trigger_system_context.sql
-- Motif   : le trigger enforce_users_invariants (migration #3) bloque TOUTE
--           modification de role/status quand l'appelant n'est pas un admin. Or
--           un contexte SYSTÈME (super-utilisateur SQL Editor, service_role, seed
--           de migration) n'a pas de session utilisateur : auth.uid() est NULL,
--           donc is_admin() = false, donc le trigger refusait — ce qui aurait
--           BLOQUÉ le seed du 1er admin (A4). Trouvé au test RLS (plan T3 §7).
-- Sûreté  : laisser passer auth.uid() IS NULL n'ouvre aucun trou — la RLS empêche
--           déjà toute écriture anon/non-authentifiée sur users. On ne bride que
--           les vraies sessions utilisateur (auth.uid() non nul).
-- ============================================================================

create or replace function public.enforce_users_invariants()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Contexte système/privilégié (service_role, seed, super-utilisateur) :
  -- auth.uid() NULL → on fait confiance, aucune garde utilisateur appliquée.
  -- (Les écritures anon/non-auth sur users sont déjà refusées par la RLS.)
  if auth.uid() is null then
    return new;
  end if;

  -- Seul un admin peut modifier role ou status.
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and not public.is_admin() then
    raise exception 'Modification de role/status reservee aux admins';
  end if;

  -- Un admin ne peut pas se retrograder lui-meme.
  if auth.uid() = old.id and old.role = 'ADMIN' and new.role <> 'ADMIN' then
    raise exception 'Un admin ne peut pas se retrograder lui-meme';
  end if;

  -- Le dernier admin actif ne peut etre ni retrograde ni desactive.
  if old.role = 'ADMIN' and old.status = 'ACTIVE'
     and (new.role <> 'ADMIN' or new.status <> 'ACTIVE') then
    if (select count(*) from users
        where role = 'ADMIN' and status = 'ACTIVE' and id <> old.id) = 0 then
      raise exception 'Impossible de retirer le dernier admin actif';
    end if;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- FIN — migration #4. Le trigger reste en place (create or replace), seule la
-- logique change. Après push : reprendre le Test 7 (préparation de l'admin A
-- désormais possible), puis nettoyer le décor de test.
-- ============================================================================
