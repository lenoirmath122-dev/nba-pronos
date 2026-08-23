-- ============================================================================
-- NBA PRONOS — Paris comparaison/duel (chantier 429 paris, GAPS_OUVERTS.md,
-- 24/08/2026)
-- ============================================================================
-- Motif : un pari COMPARISON a 2 côtés (chacun 1 joueur, une somme de
-- joueurs, ou une équipe), + une relation (GT/DIFF_LT) + un multiplicateur
-- optionnel -- ça ne rentre PAS dans les colonnes existantes
-- (structured_player_id/structured_team_id sont conçues pour UNE seule
-- entité). Nouvelle colonne JSONB plutôt que plusieurs colonnes séparées
-- par côté (kind/players/team/stat x2) : forme structurellement plus riche
-- que le reste des bet_subject, JSONB reste lisible/interrogeable sans
-- multiplier les colonnes NULL pour tous les paris non-COMPARISON.
--
-- Nommée structured_duel (PAS structured_comparison, déjà pris -- colonne
-- texte existante pour "OVER"/"UNDER", sans rapport).
--
-- Forme stockée : {"left": {"kind": "PLAYER"|"TEAM", "player_ids": [...] |
-- null, "team_id": uuid | null, "stat": "pts"}, "right": {même forme},
-- "relation": "GT"|"DIFF_LT", "multiplier": number}. player_ids résolus
-- UNE FOIS à la structuration (comme structured_player_id) -- jamais
-- re-matchés par nom plus tard, même leçon que la migration
-- 20260822130000.
-- ============================================================================

alter table bets
  add column structured_duel jsonb;

create or replace function update_bet_structuration(
  p_bet_id uuid,
  p_structured_player_name text,
  p_structured_player_id integer,
  p_structured_team_id uuid,
  p_structured_duel jsonb,
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
      structured_player_id = p_structured_player_id,
      structured_team_id = p_structured_team_id,
      structured_duel = p_structured_duel,
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
    update bets set
      is_calculable = false, structured_player_id = null, structured_team_id = null, structured_duel = null
    where id = p_bet_id;
  end if;
end;
$$;

-- ============================================================================
-- FIN.
-- Verif post-push : soumettre un pari COMPARISON doit remplir
-- structured_duel en base -- nécessite le déploiement Vercel
-- (structureAndScoreBet.ts transmet le nouveau paramètre à tous ses appels
-- RPC, y compris PLAYER/TEAM_STAT/MATCH_TOTAL avec p_structured_duel=null).
-- ============================================================================
