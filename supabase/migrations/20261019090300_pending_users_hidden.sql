-- Accueil jouable / pronos invités (plan d'attractivité, tâche 9).
-- Un compte PENDING (e-mail pas encore validé) ne doit apparaître nulle part :
-- ni classement, ni annuaire, ni profil, ni chat. Deux verrous en base plutôt
-- qu'un filtre par requête.

-- 1. Lecture de users : un PENDING n'est visible que de lui-même et des admins.
--    Couvre l'annuaire, le profil, le chat, les snapshots et tout jointure
--    lue avec le client du visiteur. (Le client privilégié contourne la RLS.)
drop policy if exists users_select on public.users;
create policy users_select on public.users for select
  using (status <> 'PENDING' or id = auth.uid() or public.is_admin());

-- 2. Les vues de classement (security_invoker = false, donc hors RLS) excluent
--    les PENDING à la source. Définitions reprises de ...20260723130000.
create or replace view user_scores
with (security_invoker = false) as
with participants as (
  select competition_id, user_id from match_predictions
  union
  select competition_id, user_id from bets
  union
  select bp.competition_id, br.user_id
    from bracket_picks bp join brackets br on br.id = bp.bracket_id
)
select
  s.competition_id,
  s.user_id,
  coalesce(m.matches_points, 0)        as matches_points,
  coalesce(m.margin_bonus_points, 0)   as margin_bonus_points,
  coalesce(b.bracket_points, 0)        as bracket_points,
  coalesce(p.bets_points, 0)           as bets_points,
  coalesce(m.matches_points, 0) + coalesce(b.bracket_points, 0) + coalesce(p.bets_points, 0)
                                       as total_points,
  coalesce(m.correct_match_winners, 0) as correct_match_winners,
  coalesce(m.exact_margins, 0)         as exact_margins,
  coalesce(c.admin_corrections_count, 0) as admin_corrections_count
from participants s
join users u on u.id = s.user_id and u.status <> 'PENDING'
left join (
  select competition_id, user_id,
    sum(points_awarded)      as matches_points,
    sum(margin_bonus_points) as margin_bonus_points,
    count(*) filter (where is_winner_correct) as correct_match_winners,
    count(*) filter (where margin_diff = 0)   as exact_margins
  from match_predictions
  group by competition_id, user_id
) m on m.competition_id = s.competition_id and m.user_id = s.user_id
left join (
  select bp.competition_id, br.user_id, sum(bp.points_awarded) as bracket_points
  from brackets br join bracket_picks bp on bp.bracket_id = br.id
  group by bp.competition_id, br.user_id
) b on b.competition_id = s.competition_id and b.user_id = s.user_id
left join (
  select competition_id, user_id, sum(points_awarded) as bets_points
  from bets
  group by competition_id, user_id
) p on p.competition_id = s.competition_id and p.user_id = s.user_id
left join (
  select competition_id, user_id, count(*) as admin_corrections_count
  from (
    select competition_id, user_id from match_predictions where is_admin_corrected
    union all
    select competition_id, user_id from bets where is_admin_corrected
  ) corrections
  group by competition_id, user_id
) c on c.competition_id = s.competition_id and c.user_id = s.user_id;

create or replace view user_recent_form
with (security_invoker = false) as
select a.competition_id, a.user_id, sum(a.points_awarded) as recent_form_points
from (
  select competition_id, user_id, points_awarded, scored_at from match_predictions
  union all
  select bp.competition_id, br.user_id, bp.points_awarded, bp.scored_at
    from bracket_picks bp join brackets br on br.id = bp.bracket_id
  union all
  select competition_id, user_id, points_awarded, scored_at from bets
) a
join users u on u.id = a.user_id and u.status <> 'PENDING'
where a.scored_at >= now() - interval '7 days'
group by a.competition_id, a.user_id;

-- 3. Nettoyage : un compte PENDING de plus de 7 jours est supprimé (auth.users
--    en cascade sur public.users et sur ses pronos). Appelée par /api/cron/purge-pending.
create or replace function public.purge_pending_users(p_older_than interval default interval '7 days')
returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  -- match_predictions.user_id n'est pas en cascade : un PENDING n'a que ces lignes.
  delete from match_predictions mp
  using public.users u
  where u.id = mp.user_id and u.status = 'PENDING' and u.created_at < now() - p_older_than;

  with gone as (
    delete from auth.users a
    using public.users u
    where u.id = a.id and u.status = 'PENDING' and u.created_at < now() - p_older_than
    returning a.id
  )
  select count(*) into n from gone;
  return n;
end;
$$;

revoke all on function public.purge_pending_users(interval) from public, anon, authenticated;
grant execute on function public.purge_pending_users(interval) to service_role;
