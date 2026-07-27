-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #12 — CORRECTIF request_bet_correction (colonne série)
-- ============================================================================
-- Fichier : supabase/migrations/20260727110000_fix_request_bet_correction_series_column.sql
-- Motif   : migration #11 lisait `series.status`, qui N'EXISTE PAS — la
--           colonne réelle est `official_status` (vérifié dans le schéma réel
--           après coup, trouvé en testant la fonction en conditions réelles
--           sur un pari scope=SERIES). Aurait fait échouer TOUTE requête de
--           correction sur un pari SÉRIE avec "column series.status does not
--           exist". Même patron que la migration #4 (correctif trouvé juste
--           après coup, appliqué via CREATE OR REPLACE dans un nouveau
--           fichier plutôt que de réécrire #11 après coup).
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
    -- CORRIGÉ (migration #12) : official_status, pas status.
    select (official_status = 'FINISHED') into v_target_finished from series where id = v_series_id;
  end if;

  if not coalesce(v_target_finished, false) then
    raise exception 'La cible de ce pari n''est pas encore terminee';
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
-- FIN — migration #12.
-- ============================================================================
