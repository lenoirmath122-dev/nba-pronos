-- Bug réel trouvé en testant l'étape 6 en conditions réelles (25/08/2026,
-- GAPS_OUVERTS.md) : le pari réel du corpus "Aucun panier marqué au buzzer
-- durant le match" (types_de_paris_playoffs_2026.md) est une NÉGATION de
-- l'événement had_buzzer_beater -- or les 3 stats MATCH_TOTAL sans seuil
-- (went_to_ot/had_backcourt_turnover/had_buzzer_beater, NO_THRESHOLD_MATCH_STATS)
-- n'avaient AUCUN moyen d'exprimer cette négation : la proba calculée et la
-- résolution automatique supposaient TOUJOURS la forme positive de
-- l'événement ("il y a eu un buzzer beater"), jamais son absence. Repro
-- confirmée en soumettant ce pari réel : Claude comprenait bien la négation
-- (reasoning="...stat directe had_buzzer_beater (négation)."), mais le
-- schéma n'avait nulle part où la stocker -- proba affichée fausse (21.8%
-- au lieu de ~78%), résolution automatique fausse (LOST au lieu de WON sur
-- un vrai match sans buzzer beater).
--
-- Pour les stats À SEUIL, la négation est déjà exprimable nativement en
-- choisissant OVER/UNDER -- ce nouveau champ ne concerne QUE les 3 stats
-- sans seuil, où comparison reste toujours null par ailleurs (jamais
-- réutilisé/surchargé, même principe que le refactor en objets imbriqués
-- de structureBet.ts -- "les champs surchargés retrouvent chacun leur
-- propre champ clairement nommé").
alter table bets add column structured_negation boolean;

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
  p_structured_last_basket boolean,
  p_structured_block_on_player jsonb,
  p_structured_negation boolean,
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
      structured_last_basket = p_structured_last_basket,
      structured_block_on_player = p_structured_block_on_player,
      structured_negation = p_structured_negation,
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
      structured_technical_fouls_count = null, structured_last_basket = null, structured_block_on_player = null,
      structured_negation = null
    where id = p_bet_id;
  end if;
end;
$$;

-- ============================================================================
-- FIN.
-- Corrige aussi rétroactivement le pari réel déjà résolu à tort pendant les
-- tests (25/08/2026, "Aucun panier marqué au buzzer durant le match") --
-- fait à la main après ce déploiement, pas dans cette migration (donnée,
-- pas schéma).
-- ============================================================================
