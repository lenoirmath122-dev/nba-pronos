-- Diagnostic de non-calcul (GAPS_OUVERTS.md, « Couverture des types de paris »,
-- étape 1-A). Colonne dédiée : refusal_reason reste réservé au refus admin.
-- Codes fermés côté TS (lib/ai/notCalculableReason.ts) ; la contrainte ne
-- vérifie que la forme, pour ne pas lier la liste des codes à l'ordre
-- de déploiement (DATA-001, panne migrations 07-09/09/2026).
alter table bets add column calculability_diagnosis jsonb;

alter table bets add constraint bets_calculability_diagnosis_shape check (
  calculability_diagnosis is null
  or (jsonb_typeof(calculability_diagnosis) = 'object'
      and jsonb_typeof(calculability_diagnosis -> 'reason') = 'string')
);

comment on column bets.calculability_diagnosis is
  'Diagnostic écrit quand is_calculable=false (motif fermé, texte brut, empreinte de type). Null si calculable ou avant instrumentation.';

-- OBLIGATOIRE : supprimer la signature à 21 paramètres, sinon un appel sans
-- p_calculability_diagnosis correspond à 2 versions (PGRST203) et casse
-- toutes les écritures de structuration.
drop function if exists update_bet_structuration(
  uuid, text, integer, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb,
  boolean, jsonb, boolean, text, numeric, text, boolean, numeric, smallint, bet_category
);

create function update_bet_structuration(
  p_bet_id uuid,
  p_structured_player_name text,
  p_structured_player_id integer,
  p_structured_team_id uuid,
  p_structured_duel jsonb,
  p_structured_combo jsonb,
  p_structured_period jsonb,
  p_structured_roster_split jsonb,
  p_structured_roster_count jsonb,
  p_structured_superlative jsonb,
  p_structured_technical_fouls_count jsonb,
  p_structured_last_basket boolean,
  p_structured_block_on_player jsonb,
  p_structured_negation boolean,
  p_stat text,
  p_threshold numeric,
  p_comparison text,
  p_is_calculable boolean,
  p_calculated_proba numeric,
  p_suggested_difficulty smallint,
  p_category bet_category default null,
  p_calculability_diagnosis jsonb default null
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
      structured_player_id = p_structured_player_id,
      structured_team_id = p_structured_team_id,
      structured_duel = p_structured_duel,
      structured_combo = p_structured_combo,
      structured_period = p_structured_period,
      structured_roster_split = p_structured_roster_split,
      structured_roster_count = p_structured_roster_count,
      structured_superlative = p_structured_superlative,
      structured_technical_fouls_count = p_structured_technical_fouls_count,
      structured_last_basket = p_structured_last_basket,
      structured_block_on_player = p_structured_block_on_player,
      structured_negation = p_structured_negation,
      structured_stat = p_stat,
      structured_threshold = p_threshold,
      structured_comparison = p_comparison,
      is_calculable = true,
      calculated_proba = p_calculated_proba,
      suggested_difficulty = p_suggested_difficulty,
      calculability_diagnosis = null,  -- resoumission devenue calculable : pas de diagnostic périmé
      status = 'VALIDATED',
      validated_category = coalesce(p_category, v_proposed_category),
      validated_difficulty = p_suggested_difficulty,
      validated_at = now(),
      validated_by_admin_id = null
    where id = p_bet_id;
  else
    update bets set
      is_calculable = false, structured_player_id = null, structured_team_id = null,
      structured_duel = null, structured_combo = null, structured_period = null,
      structured_roster_split = null, structured_roster_count = null, structured_superlative = null,
      structured_technical_fouls_count = null, structured_last_basket = null, structured_block_on_player = null,
      structured_negation = null,
      calculated_proba = p_calculated_proba,
      suggested_difficulty = p_suggested_difficulty,
      calculability_diagnosis = case
        when p_calculability_diagnosis is null then null
        else p_calculability_diagnosis || jsonb_build_object('at', now())
      end
    where id = p_bet_id;
  end if;
end;
$$;
