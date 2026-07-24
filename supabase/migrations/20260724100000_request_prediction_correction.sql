-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #7 — REQUÊTE DE CORRECTION SUR UN PRONO (VOIE A)
-- ============================================================================
-- Fichier   : supabase/migrations/20260724100000_request_prediction_correction.sql
-- Motif     : SPEC_ECRAN_MES_PRONOS_V0_1.md §10 — 0.2.3 §7 autorise un joueur à
--             demander à un admin de SAISIR (pas seulement corriger) son prono,
--             y compris sur un match jamais ouvert. Or `correction_requests.
--             target_match_prediction_id` référence match_predictions(id) : une
--             requête vise une LIGNE de prono, pas un match. Dans l'état MISSING
--             (§8 de la spec), aucune ligne n'existe, et la policy `mp_insert`
--             (`not match_is_locked(match_id)`, migration #3) interdit au joueur
--             d'en créer une puisque le match est justement VERROUILLÉ.
--
-- Justification du contournement SECURITY DEFINER (§10.2 de la spec, reprise ici
-- à dessein) : cette fonction contourne `not match_is_locked()` pour la SEULE
-- création d'une ligne match_predictions, mais N'ÉCRIT AUCUN CONTENU DE
-- PRONOSTIC — predicted_winner_team_id et predicted_margin restent NULL, le
-- statut reste DRAFT. Le joueur n'acquiert donc PAS la capacité d'exprimer un
-- prono après le coup d'envoi : il ouvre un dossier vide qu'un admin devra
-- remplir, publiquement et tracé (trigger enforce_prediction_correction,
-- migration #3, T-c). L'irréversibilité du verrouillage (0.2.3 §4) reste
-- entière. Côté admin, rien de neuf : il modifie une ligne existante, exactement
-- comme pour corriger un prono déjà rempli — un seul chemin de code, celui déjà
-- prévu par T3 et exercé par le seed du 23/07/2026 (workflow Yanis44).
--
-- Vérifications de dépôt levées avant cette migration (§18 de la spec, ÉTAPE 0
-- du 24/07/2026, lecture seule) :
--   1. La policy SELECT sur correction_requests EXISTE DÉJÀ (migration #3,
--      `correction_requests_select` : requester_user_id = auth.uid() or
--      is_admin()) — rien à ajouter ici, contrairement à ce que le §18.2
--      envisageait comme possible.
--   2. Le trigger T-b (enforce_match_prediction_transitions) ne teste que
--      l'interdiction de transition non-DRAFT → DRAFT ; il n'exige AUCUNE
--      complétude des champs — un UPDATE admin DRAFT → VALIDATED sur une ligne
--      aux deux champs NULL passe sans blocage.
--   3. Le trigger T-c (enforce_prediction_correction) ne vérifie que « admin
--      différent de l'auteur » et « requête liée renseignée » — même chose,
--      aucun contrôle de complétude, un UPDATE sur une ligne vide passe.
--   4. `count_committed_predictions` (migration #6) filtre bien sur
--      `status <> 'DRAFT'` — les lignes vides de la voie A sont donc déjà
--      invisibles de ce compteur, sans changement nécessaire ici.
--
-- Portée   : UNE seule fonction. Aucune policy RLS modifiée (les policies
--            existantes suffisent, cf. ci-dessus). Aucune colonne ajoutée.
-- ============================================================================

create or replace function public.request_prediction_correction(
  p_match uuid,
  p_justification text,
  p_proposed_winner_team_id uuid default null,
  p_proposed_margin int default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_competition_id uuid;
  v_prediction_id uuid;
  v_existing_pending uuid;
  v_new_request_id uuid;
begin
  -- Garde-fou : uniquement pour auth.uid() — jamais pour le compte d'un autre
  -- joueur. La fonction ne prend d'ailleurs aucun paramètre user_id.
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  -- Garde-fou : uniquement si le joueur est ACTIVE (un DISABLED n'écrit plus).
  if not public.is_active() then
    raise exception 'Compte desactive : ecriture impossible';
  end if;

  -- Garde-fou : uniquement si le match est effectivement VERROUILLÉ. Sinon la
  -- saisie normale s'applique déjà (mp_insert/mp_update_self, migration #3) —
  -- on ne double pas un chemin qui existe.
  if not public.match_is_locked(p_match) then
    raise exception 'Match non verrouille : utiliser la saisie normale';
  end if;

  -- Garde-fou : justification obligatoire (0.2.7 §6).
  if p_justification is null or length(trim(p_justification)) = 0 then
    raise exception 'Justification obligatoire';
  end if;

  select competition_id into v_competition_id from matches where id = p_match;
  if v_competition_id is null then
    raise exception 'Match introuvable';
  end if;

  -- Garde-fou : au plus une ligne (user_id, match_id) — contrainte unique déjà
  -- posée par le schéma (migration #1). Si elle existe déjà (prono FROZEN,
  -- INCOMPLETE, ou ligne vide laissée par une requête précédente), on la
  -- RÉUTILISE, jamais on n'en crée une seconde (idempotent).
  select id into v_prediction_id
  from match_predictions
  where user_id = v_user_id and match_id = p_match;

  if v_prediction_id is null then
    -- La ligne créée ne porte QUE des NULL, en DRAFT. Aucune autre valeur.
    insert into match_predictions (
      competition_id, user_id, match_id, predicted_winner_team_id, predicted_margin, status
    )
    values (
      v_competition_id, v_user_id, p_match, null, null, 'DRAFT'
    )
    returning id into v_prediction_id;
  end if;

  -- Garde-fou : une seule requête PENDING à la fois pour ce prono. L'index
  -- unique partiel `uniq_pending_correction_per_match_prediction` (migration
  -- #1) l'impose déjà en base ; ce contrôle donne un message clair au joueur
  -- plutôt qu'une violation de contrainte brute remontée telle quelle.
  select id into v_existing_pending
  from correction_requests
  where target_match_prediction_id = v_prediction_id and status = 'PENDING';

  if v_existing_pending is not null then
    raise exception 'Une requete est deja en attente pour ce prono';
  end if;

  insert into correction_requests (
    requester_user_id, target_type, target_match_prediction_id,
    justification, proposed_winner_team_id, proposed_margin
  )
  values (
    v_user_id, 'MATCH_PREDICTION', v_prediction_id,
    p_justification, p_proposed_winner_team_id, p_proposed_margin
  )
  returning id into v_new_request_id;

  return v_new_request_id;
end;
$$;

-- ============================================================================
-- FIN — migration #7.
-- Vérif post-push : appeler la fonction en session joueur réelle sur un match
-- verrouillé sans prono (voie A pure), puis sur un match verrouillé avec un
-- prono déjà existant (réutilisation, pas de doublon), puis vérifier qu'un 2e
-- appel avant traitement de la 1re requête échoue proprement (garde PENDING).
-- ============================================================================
