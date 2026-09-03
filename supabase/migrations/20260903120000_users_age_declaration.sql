-- ============================================================================
-- NBA PRONOS — DÉCLARATION D'ÂGE AU SIGNUP
-- ============================================================================
-- Fichier   : supabase/migrations/20260903120000_users_age_declaration.sql
-- Nature    : implémente la décision du cadrage juridique §2.10 point 4
--             (Cadrage/Juridique/conseils_juridiques_deploiement_
--             application.md) : une déclaration d'âge simple au signup,
--             sous forme de case à cocher ("j'ai 15 ans ou plus"), plutôt
--             qu'une date de naissance complète (minimisation, point 8 du
--             même §2.10).
-- Décision  : la case est BLOQUANTE (Server Action lib/auth/actions.ts) —
--             sans mécanisme de consentement parental existant pour les
--             moins de 15 ans, l'inscription est refusée si la case n'est
--             pas cochée. Conséquence : toute ligne insérée dans public.users
--             correspond forcément à une déclaration confirmée -> le trigger
--             horodate systématiquement, aucune valeur "non confirmée"
--             possible dans le flux normal.
-- ============================================================================

alter table users
  add column age_confirmed_at timestamptz;

comment on column users.age_confirmed_at is
  'Horodatage de la déclaration "15 ans ou plus" au signup (§2.10 point 4). NULL pour les comptes créés avant le 03/09/2026, forcément non-NULL au-delà (case bloquante côté Server Action).';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, pseudo, age_confirmed_at)
  values (new.id, new.raw_user_meta_data ->> 'pseudo', now());
  -- role (PLAYER), status (ACTIVE), theme_preference (DARK) : défauts de T1.
  return new;
end;
$$;

-- ============================================================================
-- FIN.
-- ============================================================================
