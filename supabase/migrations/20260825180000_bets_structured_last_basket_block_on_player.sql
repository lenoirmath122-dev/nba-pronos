-- Chantier "événements granulaires" (étape 6 du plan de reprise post-audit,
-- GAPS_OUVERTS.md, 25/08/2026) -- LAST_BASKET ("X inscrit le dernier panier
-- du match") et BLOCK_ON_PLAYER ("X réalise au moins 1 contre SUR Y").
--
-- structured_last_basket : simple MARQUEUR booléen (pas de jsonb, aucune
-- donnée supplémentaire à porter -- le joueur visé est déjà porté par
-- structured_player_id/structured_player_name, champs EXISTANTS, exactement
-- comme SUPERLATIVE). Sert à distinguer ce bet_subject côté résolveur dédié
-- (resolveCalculableLastBasketBets()) SANS jamais laisser le résolveur
-- PLAYER de base (resolveCalculableBets(), qui filtre seulement sur
-- structured_player_id non-null) trancher ce pari à tort : p_stat/
-- p_threshold/p_comparison restent null pour ce bet_subject, computeOutcome()
-- renvoie donc null dès que ce résolveur générique le croise (même garde
-- que SUPERLATIVE, migration 20260825140000).
alter table bets add column structured_last_basket boolean;

-- structured_block_on_player : { blocker_player_id, victim_player_id } --
-- les 2 VRAIS ids NBA résolus côté service (jamais re-matchés par nom plus
-- tard, même leçon que structured_duel/structured_combo). Aucun champ
-- app-side (uuid) n'existe pour "un joueur précis" en dehors de
-- structured_player_id (1 seul par pari) -- ce chantier en a besoin de 2,
-- d'où le jsonb dédié plutôt qu'une réutilisation de colonnes existantes.
alter table bets add column structured_block_on_player jsonb;

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
      structured_technical_fouls_count = null, structured_last_basket = null, structured_block_on_player = null
    where id = p_bet_id;
  end if;
end;
$$;

-- ============================================================================
-- FIN.
-- Verif post-push : soumettre un pari "dernier panier du match"/"contre sur
-- un joueur précis" doit remplir structured_last_basket/
-- structured_block_on_player en base -- necessite le déploiement Vercel
-- (structureAndScoreBet.ts transmet les 2 nouveaux parametres a tous ses
-- appels RPC, y compris les branches existantes avec
-- p_structured_last_basket=null/p_structured_block_on_player=null).
-- ============================================================================
