-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #11 — REQUÊTE DE CORRECTION SUR UN PARI OUBLIÉ
-- ============================================================================
-- Fichier   : supabase/migrations/20260727100000_request_bet_correction.sql
-- Motif     : SPEC_ECRAN_MES_PARIS_V0_1.md §7/§8 — un pari VALIDATED dont la
--             cible (match ou série) est déjà FINISHED mais jamais résolu
--             (WON/LOST) par un admin. Contrairement à
--             request_prediction_correction (migration #7), AUCUNE "voie A"
--             n'est nécessaire ici : un pari existe TOUJOURS complet dès sa
--             création (description/proposed_difficulty NOT NULL en base) —
--             cette fonction ne fait QUE créer une correction_requests sur une
--             ligne bets DÉJÀ existante, jamais une ligne vide.
--
-- Portée volontairement restreinte (§7/§12 de la spec) : seul le cas "jamais
-- résolu" est couvert. Contester un REJECTED ou une résolution WON/LOST déjà
-- posée nécessiterait d'étendre enforce_bet_transitions (les deux sont des
-- états TERMINAUX aujourd'hui, migration #9) — hors périmètre de ce lot.
--
-- Justification du contournement SECURITY DEFINER : aucune policy RLS
-- n'autorise un joueur à écrire directement sur correction_requests au nom
-- d'un autre (déjà le cas), mais la garde métier (statut VALIDATED, cible
-- FINISHED, pas de doublon PENDING) doit être vérifiée EN BASE, pas seulement
-- côté client — même raisonnement que migration #7.
--
-- Vérifications de dépôt levées avant cette migration (§13 de la spec,
-- lecture seule, pas supposées) :
--   1. bets_select (migration #3) : la branche `user_id = auth.uid()` suffit
--      pour ce lot (révélation publique reportée, §2 de la spec).
--   2. enforce_bet_transitions (migration #9) : VALIDATED → WON/LOST déjà
--      autorisé SANS modification — cette migration n'y touche pas.
--   3. correction_requests porte déjà target_type='BET', target_bet_id,
--      proposed_description/proposed_difficulty/proposed_category (migration
--      #1) — aucune colonne à ajouter, seule proposed_* est laissée NULL ici
--      (rien n'est proposé, juste un signalement).
--   4. uniq_pending_correction_per_bet (migration #1, `on correction_requests
--      (target_bet_id) where status='PENDING' and target_bet_id is not
--      null`) EXISTE DÉJÀ — le schéma anticipait cette fonctionnalité avant
--      même qu'elle ne soit spécifiée. Contrôle applicatif ci-dessous pour un
--      message clair, la contrainte réelle reste ce backstop.
--
-- Portée   : UNE seule fonction. Aucune policy RLS modifiée, aucune colonne
--            ajoutée, aucun trigger touché.
-- ============================================================================

create or replace function public.request_bet_correction(
  p_bet uuid,
  p_justification text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_bet_status bet_status;
  v_scope bet_scope;
  v_match_id uuid;
  v_series_id uuid;
  v_target_finished boolean;
  v_existing_pending uuid;
  v_new_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if not public.is_active() then
    raise exception 'Compte desactive : ecriture impossible';
  end if;

  select status, scope, match_id, series_id
    into v_bet_status, v_scope, v_match_id, v_series_id
  from bets
  where id = p_bet and user_id = v_user_id;

  if v_bet_status is null then
    raise exception 'Pari introuvable';
  end if;

  if v_bet_status <> 'VALIDATED' then
    raise exception 'Seul un pari valide et non resolu peut etre signale';
  end if;

  if v_scope = 'MATCH' then
    select (status = 'FINISHED') into v_target_finished from matches where id = v_match_id;
  else
    select (status = 'FINISHED') into v_target_finished from series where id = v_series_id;
  end if;

  if not coalesce(v_target_finished, false) then
    raise exception 'La cible de ce pari n''est pas encore terminee';
  end if;

  if p_justification is null or length(trim(p_justification)) = 0 then
    raise exception 'Justification obligatoire';
  end if;

  -- Contrôle applicatif pour un message clair (le backstop réel est
  -- uniq_pending_correction_per_bet, migration #1).
  select id into v_existing_pending
  from correction_requests
  where target_bet_id = p_bet and status = 'PENDING';

  if v_existing_pending is not null then
    raise exception 'Une requete est deja en attente pour ce pari';
  end if;

  insert into correction_requests (
    requester_user_id, target_type, target_bet_id, justification
  )
  values (
    v_user_id, 'BET', p_bet, p_justification
  )
  returning id into v_new_request_id;

  return v_new_request_id;
end;
$$;

-- ============================================================================
-- FIN — migration #11.
-- Vérif post-push : appeler en session joueur réelle sur un pari VALIDATED
-- dont la cible est FINISHED (doit réussir) ; sur un pari VALIDATED dont la
-- cible n'est PAS finished (doit échouer) ; sur un pari DRAFT/SUBMITTED/WON
-- (doit échouer) ; 2e appel sur le même pari avant traitement (doit échouer,
-- garde PENDING).
-- ============================================================================
