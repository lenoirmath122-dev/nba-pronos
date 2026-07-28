-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #13 — CONTESTER UN PARI REFUSÉ/DÉJÀ RÉSOLU
-- ============================================================================
-- Fichier : supabase/migrations/20260728120000_contest_resolved_bet.sql
-- Motif   : GAPS_OUVERTS.md — "Contester un pari REJETÉ ou déjà résolu" (le
--           mécanisme de correction, migration #11, ne couvrait QUE le cas
--           "pari VALIDATED jamais résolu" ; REJECTED/WON/LOST étaient
--           traités comme des états TERMINAUX, décision explicitement
--           technique à la rédaction de #11, jamais une décision produit —
--           0.2.7 §6 dit "correction possible même après le match" et "1
--           requête = 1 prono/pari sur 1 match ou 1 série" sans exclure
--           aucun statut. Confirmé avec l'utilisateur le 28/07/2026 : l'admin
--           tranche directement dans /admin/requests (pas de détour par
--           /admin/resolution pour ce cas précis).
--
-- 2 changements, aucune nouvelle table/colonne :
--   1. enforce_bet_transitions (migration #9) : nouvelle branche autorisant
--      REJECTED/WON/LOST -> VALIDATED/WON/LOST/REJECTED, UNIQUEMENT quand
--      liée à une correction admin (correction_request_id + admin != auteur)
--      — même garde que enforce_prediction_correction (T-c, migration #3)
--      pour les pronos, transposée ici dans le trigger de transition plutôt
--      qu'un trigger séparé (bets n'a qu'un seul trigger de cohérence).
--   2. request_bet_correction (migration #11/#12) : accepte désormais
--      REJECTED/WON/LOST en plus de VALIDATED. Le contrôle "cible terminée"
--      ne s'applique qu'au cas VALIDATED (déjà là) — un REJECTED peut être
--      contesté à tout moment, la cible étant potentiellement même pas
--      encore jouée (le grief porte sur le refus, pas sur une résolution).
-- ============================================================================

create or replace function public.enforce_bet_transitions()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status <> new.status and not (
       (old.status = 'DRAFT'     and new.status in ('SUBMITTED','CANCELLED'))
    or (old.status = 'SUBMITTED' and new.status in ('DRAFT','VALIDATED','REJECTED','CANCELLED'))
    or (old.status = 'VALIDATED' and new.status in ('WON','LOST','CANCELLED'))
    or (new.status = 'CANCELLED')  -- neutralisation possible depuis la plupart des etats
    -- Réouverture encadrée (migration #13) : un pari REJECTED/WON/LOST peut
    -- être corrigé vers n'importe quel autre statut de cette liste, mais
    -- SEULEMENT si la ligne porte déjà une correction admin liée — jamais
    -- un simple UPDATE applicatif sans requête traitée derrière.
    or (old.status in ('REJECTED','WON','LOST') and new.status in ('VALIDATED','WON','LOST','REJECTED')
        and new.correction_request_id is not null
        and new.corrected_by_admin_id is not null
        and new.corrected_by_admin_id is distinct from new.user_id)
  ) then
    raise exception 'Transition pari % -> % interdite', old.status, new.status;
  end if;
  return new;
end;
$$;

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

  -- Élargi (migration #13) : VALIDATED (jamais résolu, cas d'origine) OU
  -- REJECTED/WON/LOST (contestation d'un refus ou d'une résolution).
  if v_bet_status not in ('VALIDATED','REJECTED','WON','LOST') then
    raise exception 'Seul un pari valide, refuse ou deja resolu peut etre conteste';
  end if;

  -- La cible doit être terminée UNIQUEMENT pour contester un pari VALIDATED
  -- jamais résolu (cas d'origine, #11) : le grief porte alors sur "l'admin a
  -- oublié de le résoudre après la fin du match/série". Pour REJECTED, le
  -- grief porte sur le refus lui-même, indépendant de l'état du match/série
  -- (un pari peut être refusé avant même le coup d'envoi) — donc pas de
  -- contrôle de fin de cible dans ce cas. WON/LOST sont déjà nécessairement
  -- postérieurs à une cible terminée (résolution admin après coup), inutile
  -- de re-vérifier.
  if v_bet_status = 'VALIDATED' then
    if v_scope = 'MATCH' then
      select (status = 'FINISHED') into v_target_finished from matches where id = v_match_id;
    else
      select (official_status = 'FINISHED') into v_target_finished from series where id = v_series_id;
    end if;

    if not coalesce(v_target_finished, false) then
      raise exception 'La cible de ce pari n''est pas encore terminee';
    end if;
  end if;

  if p_justification is null or length(trim(p_justification)) = 0 then
    raise exception 'Justification obligatoire';
  end if;

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
-- FIN — migration #13.
-- Vérif post-push : (a) UPDATE direct sur un pari WON avec correction_request_id
-- + corrected_by_admin_id (!= user_id) renseignés -> statut VALIDATED/LOST/
-- REJECTED doit réussir ; (b) le même UPDATE SANS correction_request_id doit
-- échouer ("Transition pari WON -> ... interdite") ; (c) request_bet_correction
-- sur un pari REJECTED doit réussir même si la cible n'est pas terminée ;
-- (d) sur un pari DRAFT/SUBMITTED/CANCELLED doit toujours échouer.
-- ============================================================================
