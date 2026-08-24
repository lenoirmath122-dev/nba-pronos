-- ============================================================================
-- NBA PRONOS — validated_category derivee du bet_subject REEL (24/08/2026)
-- ============================================================================
-- Bug reel trouve par l'utilisateur en testant le pari "prolongation" : un
-- pari MATCH_TOTAL (aucun joueur) auto-valide s'affichait "Pari joueur",
-- parce que validated_category recopiait TOUJOURS v_proposed_category (le
-- defaut du formulaire de soumission, DEFAULT_BET_CATEGORY="PLAYER_PROP",
-- lib/labels/bets.ts) -- jamais corrige a l'auto-validation malgre le
-- bet_subject deja connu avec certitude a ce moment-la (c'est lui qui a
-- servi a calculer la proba).
--
-- Nouveau parametre p_category (defaut NULL, retro-compatible) : quand
-- fourni, remplace v_proposed_category dans la branche calculable=true
-- (auto-validation) UNIQUEMENT -- la branche calculable=false (repli
-- manuel) ne touche jamais a la categorie, l'admin garde la main comme
-- avant. structureAndScoreBet.ts (cote TS) derive p_category depuis
-- bet_subject/stat a chaque appel :
--   PLAYER -> PLAYER_PROP, TEAM_STAT -> TEAM_PROP,
--   MATCH_TOTAL(went_to_ot) -> GAME_EVENT, MATCH_TOTAL(autre) -> SCORE_TOTAL,
--   COMPARISON -> HEAD_TO_HEAD, COMBO -> MULTI_PLAYER_COMBO.
-- ============================================================================

create or replace function update_bet_structuration(
  p_bet_id uuid,
  p_structured_player_name text,
  p_structured_player_id integer,
  p_structured_team_id uuid,
  p_structured_duel jsonb,
  p_structured_combo jsonb,
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
      structured_duel = null, structured_combo = null
    where id = p_bet_id;
  end if;
end;
$$;

-- ============================================================================
-- FIN.
-- Verif post-push : un pari deja calculable AVANT ce redeploiement garde sa
-- categorie existante (rien de retroactif ici, comportement attendu -- meme
-- principe P10 deja applique ailleurs dans ce projet : figee a la
-- soumission/validation, jamais recalculee apres coup).
-- ============================================================================
