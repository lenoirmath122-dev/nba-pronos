-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #9 — ÉCRITURE DES PARIS (SAVE / SUBMIT / WITHDRAW)
-- ============================================================================
-- Fichier   : supabase/migrations/20260726130000_bet_write_functions.sql
-- Motif     : SPEC_ECRAN_NOUVEAU_PARI_V0_1.md §11 — la garde de quota « 3 paris
--             MATCH par serie, sur 3 matchs differents » n'est exprimable ni en
--             index ni en RLS (§6.2, T1) : COUNT obligatoire en ecriture.
--             Choix de session (26/07/2026) : encapsulation SECURITY DEFINER
--             (meme patron que public.request_prediction_correction, migration
--             #7) plutot qu'un SELECT puis INSERT cote TypeScript, pour eviter
--             une fenetre de course sur ce comptage entre deux soumissions
--             quasi simultanees du meme joueur.
--
-- Verrou de concurrence : le cap "3 paris MATCH/serie" n'a AUCUN index unique
-- en backstop (contrairement a uniq_active_series_bet / uniq_active_match_bet,
-- qui restent la garde ultime pour les deux quotas "1 actif"). Un
-- pg_advisory_xact_lock (cle = user x serie, duree = la transaction) serialise
-- donc les CREATIONS concurrentes sur la meme serie avant le COUNT, sinon deux
-- appels simultanes pourraient chacun lire "2 existants", passer la garde, et
-- produire 4 paris actifs.
--
-- Libelles : les messages de refus lies au §12 (deadline, quota, enonce vide)
-- reprennent MOT POUR MOT les libelles actes le 26/07/2026 — ce sont eux qui
-- remontent tels quels au joueur (meme patron que
-- public.request_prediction_correction). Les autres (auth, propriete, statut,
-- conflit concurrent) sont defensifs, sans libelle produit prevu : ils ne
-- devraient jamais s'afficher a un client normal.
--
-- Portee    : DEUX fonctions. AUCUNE policy RLS modifiee, AUCUNE colonne
--             ajoutee. Ces fonctions SECURITY DEFINER contournent la RLS (rôle
--             proprietaire), donc reproduisent ELLES-MEMES tous les
--             garde-fous (auth.uid(), is_active(), proprietaire, statut,
--             deadline, cible identifiee, quota, scope/Cup) — rien n'est
--             delegue a la RLS ici, exactement comme migration #7.
-- ============================================================================

create or replace function public.save_bet(
  p_bet_id uuid,              -- NULL = nouveau pari
  p_scope bet_scope,          -- ignore si p_bet_id fourni (cible figee en edition, §9.2)
  p_series_id uuid,
  p_match_id uuid,
  p_description text,
  p_category bet_category,
  p_difficulty smallint,
  p_submit boolean            -- true = viser SUBMITTED, false = DRAFT
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_existing bets%rowtype;
  v_scope bet_scope;
  v_series_id uuid;
  v_match_id uuid;
  v_competition_id uuid;
  v_competition_type competition_type;
  v_scheduled_at timestamptz;
  v_new_status bet_status;
  v_submitted_at timestamptz;
  v_bet_id uuid;
  v_active_count int;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;
  if not public.is_active() then
    raise exception 'Compte desactive : ecriture impossible';
  end if;
  if p_difficulty < 1 or p_difficulty > 5 then
    raise exception 'Difficulte invalide';
  end if;
  if p_submit and length(trim(coalesce(p_description, ''))) = 0 then
    raise exception 'Decris ton pari avant de le soumettre.';
  end if;

  if p_bet_id is not null then
    -- ─── ÉDITION d'un pari existant : cible FIGÉE (§9.2). Seuls énoncé /
    -- catégorie / difficulté et le statut (DRAFT<->SUBMITTED, jamais le
    -- retrait SUBMITTED->DRAFT ici, réservé à withdraw_bet) changent.
    select * into v_existing from bets where id = p_bet_id;
    if v_existing.id is null then
      raise exception 'Pari introuvable';
    end if;
    if v_existing.user_id <> v_user_id then
      raise exception 'Ce pari ne t''appartient pas';
    end if;
    if v_existing.status not in ('DRAFT', 'SUBMITTED') then
      raise exception 'Ce pari n''est plus modifiable';
    end if;
    if v_existing.status = 'SUBMITTED' and not p_submit then
      raise exception 'Utilise "Revenir en brouillon" pour retirer ce pari de la file.';
    end if;

    v_scope := v_existing.scope;
    v_series_id := v_existing.series_id;
    v_match_id := v_existing.match_id;

    if not public.bet_deadline_open(v_scope, v_series_id, v_match_id) then
      if v_scope = 'MATCH' then
        raise exception 'Ce match a deja commence, le pari est ferme.';
      else
        raise exception 'La serie a deja commence.';
      end if;
    end if;

    if p_submit and v_scope = 'MATCH' then
      select scheduled_at into v_scheduled_at from matches where id = v_match_id;
      if v_scheduled_at is null then
        raise exception 'Ce match n''est plus identifie : impossible de soumettre.';
      end if;
    end if;

    v_new_status := case when p_submit then 'SUBMITTED' else 'DRAFT' end;
    v_submitted_at := case
      when v_existing.status = 'DRAFT' and p_submit then now()  -- 1re transition uniquement (§8)
      else v_existing.submitted_at
    end;

    update bets set
      description = coalesce(p_description, ''),
      proposed_category = p_category,
      proposed_difficulty = p_difficulty,
      status = v_new_status,
      submitted_at = v_submitted_at
    where id = p_bet_id and user_id = v_user_id
    returning id into v_bet_id;

    if v_bet_id is null then
      raise exception 'Ecriture refusee : aucune ligne affectee (conflit concurrent)';
    end if;

    return v_bet_id;
  end if;

  -- ─── CRÉATION d'un nouveau pari : cible choisie par le joueur, gardes
  -- complètes (§4 / §6 / §7).
  if p_scope = 'MATCH' and p_match_id is null then
    raise exception 'Un match cible est requis pour un pari MATCH';
  end if;
  if p_scope = 'SERIES' and p_match_id is not null then
    raise exception 'Un pari SERIE ne cible pas de match';
  end if;

  select competition_id into v_competition_id from series where id = p_series_id;
  if v_competition_id is null then
    raise exception 'Serie introuvable';
  end if;
  select type into v_competition_type from competitions where id = v_competition_id;

  if p_scope = 'SERIES' and v_competition_type = 'NBA_CUP' then
    raise exception 'Le pari SERIE n''est pas disponible en NBA Cup';
  end if;

  if p_scope = 'MATCH' then
    select scheduled_at into v_scheduled_at
    from matches where id = p_match_id and series_id = p_series_id;
    if v_scheduled_at is null then
      raise exception 'Ce match n''est pas encore identifie';
    end if;
  end if;

  if not public.bet_deadline_open(p_scope, p_series_id, p_match_id) then
    if p_scope = 'MATCH' then
      raise exception 'Ce match a deja commence, le pari est ferme.';
    else
      raise exception 'La serie a deja commence.';
    end if;
  end if;

  -- Verrou transactionnel (user x serie) : ferme la course sur le cap "3
  -- MATCH/serie", qui n'a pas de backstop d'index (voir en-tete).
  perform pg_advisory_xact_lock(hashtext('bet_quota:' || v_user_id::text || ':' || p_series_id::text));

  if p_scope = 'SERIES' then
    select count(*) into v_active_count
    from bets
    where user_id = v_user_id and series_id = p_series_id and scope = 'SERIES'
      and status not in ('REJECTED', 'CANCELLED');
    if v_active_count > 0 then
      raise exception 'Tu as deja ton pari serie sur cette serie.';
    end if;
  else
    select count(*) into v_active_count
    from bets
    where user_id = v_user_id and match_id = p_match_id and scope = 'MATCH'
      and status not in ('REJECTED', 'CANCELLED');
    if v_active_count > 0 then
      raise exception 'Tu as deja un pari sur ce match.';
    end if;

    if v_competition_type = 'PLAYOFFS' then
      select count(*) into v_active_count
      from bets
      where user_id = v_user_id and series_id = p_series_id and scope = 'MATCH'
        and status not in ('REJECTED', 'CANCELLED');
      if v_active_count >= 3 then
        raise exception 'Tu as deja 3 paris match sur cette serie.';
      end if;
    end if;
  end if;

  v_new_status := case when p_submit then 'SUBMITTED' else 'DRAFT' end;
  v_submitted_at := case when p_submit then now() else null end;

  insert into bets (
    competition_id, user_id, scope, series_id, match_id,
    description, proposed_category, proposed_difficulty,
    status, submitted_at
  ) values (
    v_competition_id, v_user_id, p_scope, p_series_id, p_match_id,
    coalesce(p_description, ''), p_category, p_difficulty,
    v_new_status, v_submitted_at
  )
  returning id into v_bet_id;

  return v_bet_id;
end;
$$;

create or replace function public.withdraw_bet(p_bet_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_existing bets%rowtype;
  v_updated_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select * into v_existing from bets where id = p_bet_id;
  if v_existing.id is null then
    raise exception 'Pari introuvable';
  end if;
  if v_existing.user_id <> v_user_id then
    raise exception 'Ce pari ne t''appartient pas';
  end if;
  if v_existing.status <> 'SUBMITTED' then
    raise exception 'Seul un pari SOUMIS peut etre retire.';
  end if;

  update bets set status = 'DRAFT'
  where id = p_bet_id and user_id = v_user_id and status = 'SUBMITTED'
  returning id into v_updated_id;

  if v_updated_id is null then
    raise exception 'Ecriture refusee : aucune ligne affectee (conflit concurrent)';
  end if;
end;
$$;

-- ============================================================================
-- FIN — migration #9.
-- Verif post-push : créer un DRAFT, le soumettre (submitted_at posé une seule
-- fois), le retirer (withdraw_bet), re-soumettre (submitted_at inchangé) ;
-- vérifier le refus sur un 4e pari MATCH d'une série Playoffs déjà à 3 ; vérifier
-- le refus d'un pari SERIES en NBA Cup ; vérifier qu'un pari d'un AUTRE joueur
-- (bet_id valide mais user_id différent) est bien rejeté par les deux fonctions.
-- ============================================================================
