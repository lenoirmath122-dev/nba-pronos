-- Accueil jouable / pronos invités (plan d'attractivité, tâches 5 et 7).
-- handle_new_user distingue trois cas :
--   1. inscription classique (pseudo fourni)            -> ACTIVE
--   2. invité qui laisse pseudo + e-mail (pending_validation = 'true')
--                                                       -> PENDING jusqu'au clic dans le mail
--   3. connexion Google (aucun pseudo fourni)           -> PENDING avec pseudo provisoire
--      et age_confirmed_at NULL : la page « Choisis ton pseudo » le complète puis active.
-- Un compte PENDING sans age_confirmed_at ne peut donc jamais être activé par le seul
-- lien du mail : /auth/callback l'envoie d'abord choisir son pseudo.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pseudo text := nullif(trim(new.raw_user_meta_data ->> 'pseudo'), '');
  v_pending boolean := coalesce(new.raw_user_meta_data ->> 'pending_validation', '') = 'true';
begin
  if v_pseudo is null then
    insert into public.users (id, pseudo, status)
    values (new.id, 'joueur_' || substr(replace(new.id::text, '-', ''), 1, 8), 'PENDING');
  else
    insert into public.users (id, pseudo, age_confirmed_at, status)
    values (new.id, v_pseudo, now(), case when v_pending then 'PENDING'::user_status else 'ACTIVE'::user_status end);
  end if;
  return new;
end;
$$;
