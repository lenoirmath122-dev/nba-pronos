-- ============================================================================
-- NBA PRONOS — Paris periode, equipe + joueur (chantier 429 paris, GAPS_OUVERTS.md, 24/08/2026)
-- ============================================================================
-- Motif : un pari PERIOD porte sur une periode precise (Q1-Q4/H1-H2) et un
-- type de resultat (vainqueur de periode, ecart, total combine, part de
-- points...), optionnellement cible sur UNE equipe ou UN joueur precis --
-- ne rentre pas dans structured_stat/structured_threshold/structured_comparison
-- seuls (period/outcome_kind n'ont pas de colonne dediee). Meme patron que
-- structured_duel/structured_combo (migrations 20260824090000/20260824100000) :
-- JSONB plutot que N colonnes.
--
-- Forme stockee : {"period": "Q1"|"Q2"|"Q3"|"Q4"|"H1"|"H2"|null, "outcome_kind":
-- "QUARTER_WINNER"|"HALF_WINNER"|"QUARTERS_WON_COUNT"|"LEADS_HALF_RESULT"|
-- "MARGIN"|"TOTAL_POINTS"|"POINT_SHARE_PCT"|null, "team_id": uuid | null,
-- "player_id": integer | null, "exact_count": boolean | null}. team_id/
-- player_id resolus UNE FOIS a la structuration (comme
-- structured_player_id/structured_team_id) -- jamais re-matches par nom
-- plus tard. outcome_kind=null + player_id renseigne = forme JOUEUR (stat
-- normale limitee a `period`, portee par structured_stat/structured_threshold/
-- structured_comparison comme un pari PLAYER classique).
-- ============================================================================

alter table bets
  add column structured_period jsonb;

create or replace function update_bet_structuration(
  p_bet_id uuid,
  p_structured_player_name text,
  p_structured_player_id integer,
  p_structured_team_id uuid,
  p_structured_duel jsonb,
  p_structured_combo jsonb,
  p_structured_period jsonb,
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
      structured_duel = null, structured_combo = null, structured_period = null
    where id = p_bet_id;
  end if;
end;
$$;

-- ============================================================================
-- FIN.
-- Verif post-push : soumettre un pari PERIOD doit remplir structured_period
-- en base -- necessite le deploiement Vercel (structureAndScoreBet.ts
-- transmet le nouveau parametre a tous ses appels RPC, y compris les
-- branches existantes avec p_structured_period=null).
-- ============================================================================
