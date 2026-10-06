-- ============================================================================
-- NBA PRONOS — COMPÉTITION « MATCH DU JOUR » (DAILY_MATCH) — GARDE-FOUS
-- ============================================================================
-- Fichier   : supabase/migrations/20261007100000_daily_match_guards.sql
-- Prérequis : 20261007090000_daily_match_enums.sql (valeurs d'enum).
-- Contenu   : 1. save_bet : pari SERIE réservé aux PLAYOFFS (redéfinition
--                INTÉGRALE de la fonction de 20260726130000, même signature —
--                seul le bloc « pari SERIE » change).
--             2. bracket_deadline_passed : bracket toujours fermé en DAILY_MATCH.
--             3. bets_insert : un pari SERIE ne s'insère en direct (REST) que
--                dans une compétition PLAYOFFS (fermait déjà mal la NBA Cup).
--             4. Unicité d'une série technique par jour NY (slot_index =
--                YYYYMMDD), cohérence round DAILY <=> compétition DAILY_MATCH,
--                et un seul match (game_number = 1) par série technique.
-- ============================================================================

-- 1. save_bet (copie intégrale de 20260726130000, bloc SERIE modifié).
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

  if p_scope = 'SERIES' and v_competition_type <> 'PLAYOFFS' then
    raise exception 'Le pari SERIE n''est disponible qu''en Playoffs.';
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

-- 2. Bracket fermé pour DAILY_MATCH (bracket_deadline reste NULL).
create or replace function public.bracket_deadline_passed(p_competition uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from competitions c
    where c.id = p_competition
      and (c.type = 'DAILY_MATCH' or (c.bracket_deadline is not null and c.bracket_deadline <= now()))
  );
$$;

-- 3. Pas de pari SERIE en insertion directe hors PLAYOFFS.
drop policy bets_insert on bets;
create policy bets_insert on bets for insert with check (
  user_id = auth.uid() and public.is_active()
  and public.bet_deadline_open(scope, series_id, match_id)
  and (
    scope = 'MATCH'
    or exists (select 1 from competitions c where c.id = competition_id and c.type = 'PLAYOFFS')
  )
);

-- 4. Séries techniques du Match du jour.
create unique index uniq_daily_series_day
  on series (competition_id, slot_index) where round = 'DAILY';

create function public.enforce_daily_series_round() returns trigger
language plpgsql set search_path = public as $$
declare v_type competition_type;
begin
  select type into v_type from competitions where id = new.competition_id;
  if (v_type = 'DAILY_MATCH') <> (new.round = 'DAILY') then
    raise exception 'Serie : round DAILY <=> competition DAILY_MATCH';
  end if;
  return new;
end;
$$;

create trigger trg_daily_series_round
  before insert or update of round, competition_id on series
  for each row execute function public.enforce_daily_series_round();

create function public.enforce_daily_match_single_game() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.game_number <> 1
     and exists (select 1 from series s where s.id = new.series_id and s.round = 'DAILY') then
    raise exception 'Match du jour : game_number doit valoir 1';
  end if;
  return new;
end;
$$;

create trigger trg_daily_match_single_game
  before insert or update of game_number, series_id on matches
  for each row execute function public.enforce_daily_match_single_game();

-- ============================================================================
-- FIN.
-- ============================================================================
