-- Paris des autres visibles avant le coup d'envoi dès que MON pari sur le même
-- match est soumis (SUBMITTED/VALIDATED/WON/LOST ; ni brouillon, ni refusé,
-- ni neutralisé). Avant : un pari MATCH n'était public qu'à partir du coup
-- d'envoi. Les paris SÉRIE et les statuts publics (VALIDATED/WON/LOST) ne
-- changent pas.
create or replace function public.bet_is_public(p_bet uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from bets b
    where b.id = p_bet
      and b.status in ('VALIDATED','WON','LOST')
      and (
        (b.scope = 'MATCH' and (
           exists (
             select 1 from matches m
             where m.id = b.match_id and m.scheduled_at is not null and m.scheduled_at <= now())
           or exists (
             select 1 from bets mine
             where mine.user_id = auth.uid()
               and mine.scope = 'MATCH'
               and mine.match_id = b.match_id
               and mine.status in ('SUBMITTED','VALIDATED','WON','LOST'))))
        or
        (b.scope = 'SERIES' and
           (select min(m.scheduled_at) from matches m where m.series_id = b.series_id) <= now())
      )
  );
$$;
