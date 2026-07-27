-- Ajoute la transition SUBMITTED -> DRAFT au trigger enforce_bet_transitions
-- (geste joueur "retirer" un pari soumis, SPEC_ECRAN_NOUVEAU_PARI_V0_1 §9/§15.1).
-- Un pari SUBMITTED peut revenir en DRAFT tant qu'il n'a pas ete revu par un
-- admin ; jamais de suppression (retention D2), seulement ce retour arriere.
create or replace function public.enforce_bet_transitions()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status <> new.status and not (
       (old.status = 'DRAFT'     and new.status in ('SUBMITTED','CANCELLED'))
    or (old.status = 'SUBMITTED' and new.status in ('DRAFT','VALIDATED','REJECTED','CANCELLED'))
    or (old.status = 'VALIDATED' and new.status in ('WON','LOST','CANCELLED'))
    or (new.status = 'CANCELLED')  -- neutralisation possible depuis la plupart des etats
  ) then
    raise exception 'Transition pari % -> % interdite', old.status, new.status;
  end if;
  return new;
end;
$$;
