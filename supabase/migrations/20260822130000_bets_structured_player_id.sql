-- ============================================================================
-- NBA PRONOS — Phase 6 (résolution automatique des paris IA) — étape 1
-- ============================================================================
-- Motif : structured_player_name (texte libre, re-matché par nom à chaque
-- lecture) est la source de plusieurs bugs réels cette session (orthographe,
-- pagination Supabase côté service Cloud Run). Pour la résolution
-- automatique d'un pari (comparer la VRAIE stat du joueur au seuil une fois
-- le match FINISHED, projet-data-nba.md/GAPS_OUVERTS.md), il faut identifier
-- le joueur une fois pour toutes, à la structuration -- jamais re-matcher un
-- nom plus tard. Le micro-service Cloud Run résout déjà ce player_id en
-- interne (supabase_context.find_player) mais ne le renvoyait pas encore
-- (service/app.py, changement à part).
--
-- structured_player_name reste (affichage/debug), simplement plus l'unique
-- identifiant du joueur pour la résolution.
-- ============================================================================

alter table bets
  add column structured_player_id integer;

create or replace function update_bet_structuration(
  p_bet_id uuid,
  p_structured_player_name text,
  p_structured_player_id integer,
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
    update bets set is_calculable = false, structured_player_id = null where id = p_bet_id;
  end if;
end;
$$;

-- ============================================================================
-- FIN.
-- Verif post-push : soumettre un nouveau pari calculable ("X marque +10
-- points") doit remplir structured_player_id (vérifier en base) en plus des
-- colonnes déjà existantes -- nécessite d'abord le redéploiement Cloud Run
-- (service/app.py renvoie désormais player_id) ET le déploiement Vercel
-- (structureAndScoreBet.ts transmet le nouveau paramètre).
-- ============================================================================
