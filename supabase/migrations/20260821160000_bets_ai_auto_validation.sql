-- Auto-validation des paris calculables par l'IA (Phase 5 Data NBA,
-- 21/08/2026, décidé avec l'utilisateur en cours de vérification réelle --
-- le design initial de la migration #33 laissait les paris calculables
-- dans la file d'attente admin comme les autres, l'utilisateur voulait en
-- fait qu'ils sautent cette file, avec un droit de correction admin après
-- coup). Remplace update_bet_structuration : un pari calculable passe
-- directement SUBMITTED -> VALIDATED, sans geste admin. validated_by_admin_id
-- reste NULL -- c'est le signal distinctif "validé par l'IA, pas un humain",
-- utilisé par la nouvelle requête admin (getAutoValidatedBets) pour lister
-- ces paris et permettre une correction.

create or replace function update_bet_structuration(
  p_bet_id uuid,
  p_structured_player_name text,
  p_stat text,
  p_threshold numeric,
  p_comparison text,
  p_is_calculable boolean,
  p_calculated_proba numeric,
  p_suggested_difficulty smallint
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_status bet_status;
  v_proposed_category bet_category;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  select user_id, status, proposed_category into v_user_id, v_status, v_proposed_category
  from bets where id = p_bet_id;
  if v_user_id is null then
    raise exception 'Pari introuvable';
  end if;
  if v_user_id != auth.uid() then
    raise exception 'Ce pari ne t''appartient pas';
  end if;
  if v_status != 'SUBMITTED' then
    raise exception 'Ce pari n''est plus au statut attendu pour cette mise a jour';
  end if;

  if p_is_calculable then
    update bets set
      structured_player_name = p_structured_player_name,
      structured_stat = p_stat,
      structured_threshold = p_threshold,
      structured_comparison = p_comparison,
      is_calculable = true,
      calculated_proba = p_calculated_proba,
      suggested_difficulty = p_suggested_difficulty,
      status = 'VALIDATED',
      validated_category = v_proposed_category,
      validated_difficulty = p_suggested_difficulty,
      validated_at = now(),
      validated_by_admin_id = null
    where id = p_bet_id;
  else
    update bets set is_calculable = false where id = p_bet_id;
  end if;
end;
$$;
