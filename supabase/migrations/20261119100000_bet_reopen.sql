-- ============================================================================
-- Modifier un pari perso validé : une seule fois par cible, jusqu'au coup d'envoi.
--
-- Le compteur vit dans une table à part (bet_reopenings), sans policy d'écriture :
-- un joueur ne peut ni la vider ni la contourner en supprimant puis recréant
-- un pari sur la même cible (unique (user_id, target_id)).
-- La transition VALIDATED -> DRAFT n'est permise que si reopen_bet a posé
-- app.bet_reopen = 'on' (set_config local à la transaction).
-- ============================================================================

create table public.bet_reopenings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  bet_id uuid not null references public.bets(id) on delete cascade,
  target_id uuid not null, -- match_id si MATCH, series_id si SERIES
  created_at timestamptz not null default now(),
  unique (user_id, target_id)
);

alter table public.bet_reopenings enable row level security;

create policy bet_reopenings_select_self on public.bet_reopenings
  for select using (user_id = auth.uid());

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
    -- Modification unique d'un pari validé : uniquement via reopen_bet.
    or (old.status = 'VALIDATED' and new.status = 'DRAFT'
        and current_setting('app.bet_reopen', true) = 'on')
  ) then
    raise exception 'Transition pari % -> % interdite', old.status, new.status;
  end if;
  return new;
end;
$$;

create or replace function public.reopen_bet(p_bet_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_bet bets%rowtype;
  v_target uuid;
  v_updated_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;
  if not public.is_active() then
    raise exception 'Compte desactive : ecriture impossible';
  end if;

  select * into v_bet from bets where id = p_bet_id for update;
  if v_bet.id is null then
    raise exception 'Pari introuvable';
  end if;
  if v_bet.user_id <> v_user_id then
    raise exception 'Ce pari ne t''appartient pas';
  end if;
  if v_bet.status <> 'VALIDATED' then
    raise exception 'Seul un pari valide peut etre modifie.';
  end if;
  if not public.bet_deadline_open(v_bet.scope, v_bet.series_id, v_bet.match_id) then
    raise exception 'Le coup d''envoi est passe : ce pari n''est plus modifiable.';
  end if;

  v_target := case when v_bet.scope = 'MATCH' then v_bet.match_id else v_bet.series_id end;

  if exists (select 1 from bet_reopenings where user_id = v_user_id and target_id = v_target) then
    raise exception 'Tu as deja modifie ton pari sur ce match.';
  end if;

  insert into bet_reopenings (user_id, bet_id, target_id)
  values (v_user_id, p_bet_id, v_target);

  perform set_config('app.bet_reopen', 'on', true);

  update bets set
    status = 'DRAFT',
    validated_category = null,
    validated_difficulty = null,
    validated_at = null,
    validated_by_admin_id = null,
    calculated_proba = null,
    suggested_difficulty = null,
    calculability_diagnosis = null,
    is_calculable = null,
    structured_player_name = null,
    structured_stat = null,
    structured_threshold = null,
    structured_comparison = null,
    structured_player_id = null,
    structured_team_id = null,
    structured_duel = null,
    structured_combo = null,
    structured_period = null,
    structured_roster_split = null,
    structured_roster_count = null,
    structured_superlative = null,
    structured_technical_fouls_count = null,
    structured_last_basket = null,
    structured_block_on_player = null,
    structured_negation = null
  where id = p_bet_id and user_id = v_user_id and status = 'VALIDATED'
  returning id into v_updated_id;

  perform set_config('app.bet_reopen', 'off', true);

  if v_updated_id is null then
    raise exception 'Ecriture refusee : aucune ligne affectee (conflit concurrent)';
  end if;
end;
$$;

revoke all on function public.reopen_bet(uuid) from public;
grant execute on function public.reopen_bet(uuid) to authenticated;
