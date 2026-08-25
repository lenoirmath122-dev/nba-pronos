-- Chantier "événements de match" (étape 5 du plan de reprise post-audit,
-- GAPS_OUVERTS.md, 25/08/2026) -- fautes techniques ÉQUIPE/MATCH, comptage
-- EXACT ("Orlando reçoit exactement 2 fautes techniques", "il y aura
-- exactement 2 fautes techniques dans le match"). Même patron que
-- structured_roster_count/structured_superlative : nouvelle colonne jsonb
-- dédiée + nouveau paramètre sur update_bet_structuration().
--
-- structured_team_id (colonne EXISTANTE) porte l'équipe visée pour
-- scope=team1/team2 (null pour scope=MATCH) -- pas besoin de la dupliquer
-- dans le jsonb. structured_threshold (EXISTANTE aussi) porte
-- count_threshold. structured_technical_fouls_count ne porte donc QUE
-- { scope, count_relation } -- count_relation à 4 valeurs
-- (AT_LEAST/MORE_THAN/FEWER_THAN/EXACTLY), pas OVER/UNDER (distribution
-- discrète EXACTE, pas une approximation continue -- même raison que
-- structured_roster_count, étape 3).
alter table bets add column structured_technical_fouls_count jsonb;

create or replace function update_bet_structuration(
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
  p_stat text,
  p_threshold numeric,
  p_comparison text,
  p_is_calculable boolean,
  p_calculated_proba numeric,
  p_suggested_difficulty smallint,
  p_category bet_category default null
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
      structured_stat = p_stat,
      structured_threshold = p_threshold,
      structured_comparison = p_comparison,
      is_calculable = true,
      calculated_proba = p_calculated_proba,
      suggested_difficulty = p_suggested_difficulty,
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
      structured_technical_fouls_count = null
    where id = p_bet_id;
  end if;
end;
$$;

-- ============================================================================
-- FIN.
-- Verif post-push : soumettre un pari "fautes techniques équipe/match" doit
-- remplir structured_technical_fouls_count en base -- necessite le
-- deploiement Vercel (structureAndScoreBet.ts transmet le nouveau parametre
-- a tous ses appels RPC, y compris les branches existantes avec
-- p_structured_technical_fouls_count=null).
-- ============================================================================
