-- Accueil : totaux de pronos par match, sans exposer de prono individuel.
-- Ne compte que les comptes ACTIVE ; SECURITY DEFINER car match_predictions
-- n'est pas lisible par un visiteur non connecté.

create or replace function public.home_match_vote_counts(p_match_ids uuid[])
returns table (match_id uuid, total int, home_votes int)
language sql
stable
security definer
set search_path = public
as $$
  select p.match_id,
         count(*)::int,
         count(*) filter (where p.predicted_winner_team_id = m.home_team_id)::int
  from match_predictions p
  join matches m on m.id = p.match_id
  join users u on u.id = p.user_id and u.status = 'ACTIVE'
  where p.match_id = any (p_match_ids)
    and p.status in ('VALIDATED', 'LOCKED')
  group by p.match_id;
$$;

revoke all on function public.home_match_vote_counts(uuid[]) from public;
grant execute on function public.home_match_vote_counts(uuid[]) to anon, authenticated;
