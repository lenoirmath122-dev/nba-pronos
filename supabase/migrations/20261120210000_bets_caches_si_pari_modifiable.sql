-- Paris des autres cachés tant que MON pari sur le même match est encore
-- modifiable. Avant (20261022090000) : visibles dès mon pari soumis, puis la
-- modification unique (20261119100000, reopen_bet) permettait de les lire et
-- de réécrire le sien. Désormais, avant le coup d'envoi, mon pari ne débloque
-- la vue que s'il est figé : WON/LOST, ou SUBMITTED/VALIDATED avec la
-- modification déjà consommée (bet_reopenings). Un SUBMITTED compte comme
-- modifiable : il peut passer VALIDATED puis être rouvert.
-- Paris SÉRIE et coup d'envoi passé : inchangés.
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
               and (
                 mine.status in ('WON','LOST')
                 or (mine.status in ('SUBMITTED','VALIDATED')
                     and exists (
                       select 1 from bet_reopenings r
                       where r.user_id = auth.uid() and r.target_id = b.match_id))))))
        or
        (b.scope = 'SERIES' and
           (select min(m.scheduled_at) from matches m where m.series_id = b.series_id) <= now())
      )
  );
$$;
