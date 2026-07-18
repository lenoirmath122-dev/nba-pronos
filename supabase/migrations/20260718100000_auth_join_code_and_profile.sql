-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #2 — AUTH (join code + pont auth->users)
-- ============================================================================
-- Fichier   : supabase/migrations/20260718100000_auth_join_code_and_profile.sql
-- Nature    : transcription fidèle de SPEC_TECHNIQUE_AUTH_V0.1.md (T2, validé
--             le 18/07/2026). Pont auth.users -> public.users = École A (trigger).
-- Périmètre : code compétition (C4) + matérialisation du profil au signup.
--             Ne contient PAS : les policies RLS (-> migration #3, T3), ni le
--             seed du 1er admin (-> migration séparée au déploiement, A4/§6).
-- Base neuve : competitions est vide, donc l'ajout NOT NULL sans default ne
--             viole aucune ligne (pas de backfill).
-- ============================================================================

-- ── 1. Code compétition (C4) : addition au modèle (remontée de T2 vers T1) ──
-- competitions n'avait pas de colonne de code (le proto l'avait supprimée,
-- inutile sans vraie inscription). C4 la réintroduit.
alter table competitions
  add column join_code text not null;

-- ── 2. Vérification du code SANS l'exposer (D5 : la RLS filtre des lignes) ──
-- SECURITY DEFINER : lit competitions.join_code même quand l'appelant (anon,
-- au signup) n'aura pas le droit de lire cette colonne une fois la RLS posée
-- (T3). Ne renvoie que l'id de la compétition active si le code correspond,
-- jamais le code lui-même.
create function public.verify_join_code(p_code text)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id
  from competitions
  where status = 'ACTIVE'
    and lower(trim(join_code)) = lower(trim(p_code))   -- insensible casse + trim
  limit 1;
$$;

-- ── 3. Pont auth.users -> public.users (École A, T2 §3) ─────────────────────
-- À l'inscription, la server action vérifie le code (verify_join_code) PUIS
-- appelle supabase.auth.signUp({ email, password, options:{ data:{ pseudo } } }).
-- Ce trigger matérialise alors le profil. Il tourne dans la MÊME transaction
-- que l'insert auth.users : toute erreur (ex. collision de pseudo sur la
-- contrainte unique de users.pseudo) annule aussi la création du compte
-- -> aucun orphelin possible.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, pseudo)
  values (new.id, new.raw_user_meta_data ->> 'pseudo');
  -- role (PLAYER), status (ACTIVE), theme_preference (DARK) : défauts de T1.
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================================
-- FIN — migration #2.
-- Rappels hors-SQL (à faire au déploiement) :
--   - Dashboard Supabase : désactiver « Confirm email » (accès immédiat, C4).
--   - Après la 1re inscription : écrire la migration de seed admin (A4) ciblant
--     le pseudo du 1er compte (update users set role='ADMIN' where pseudo=...).
-- ============================================================================
