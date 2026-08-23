-- ============================================================================
-- NBA PRONOS — Paris équipe (pièce (a) suite, GAPS_OUVERTS.md, 23/08/2026)
-- ============================================================================
-- Motif : un pari TEAM_STAT (ex. "Boston aura 45+ rebonds") vise UNE équipe
-- précise -- contrairement à un pari joueur (structured_player_id, migration
-- 20260822130000) ou à un pari MATCH_TOTAL (symétrique, aucune équipe visée),
-- rien ne mémorisait jusqu'ici QUELLE équipe est ciblée. Nécessaire pour la
-- résolution automatique (piece (e) étendue) : sans lui, impossible de
-- savoir quelle moitié du score réel comparer au seuil.
--
-- Même patron que structured_player_id : NULL pour tout pari qui n'est pas
-- TEAM_STAT (PLAYER, MATCH_TOTAL), écrit une fois pour toutes à la
-- structuration, jamais re-résolu par nom plus tard.
-- ============================================================================

alter table bets
  add column structured_team_id uuid references teams(id);

create or replace function update_bet_structuration(
  p_bet_id uuid,
  p_structured_player_name text,
  p_structured_player_id integer,
  p_structured_team_id uuid,
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
    update bets set is_calculable = false, structured_player_id = null, structured_team_id = null where id = p_bet_id;
  end if;
end;
$$;

-- ============================================================================
-- FIN.
-- Verif post-push : soumettre un pari TEAM_STAT ("Boston 45+ rebonds") doit
-- remplir structured_team_id en base -- nécessite le déploiement Vercel
-- (structureAndScoreBet.ts transmet le nouveau paramètre à tous ses appels
-- RPC, y compris PLAYER/MATCH_TOTAL avec p_structured_team_id=null).
-- ============================================================================
