-- Visiteurs uniques (suite de 20261027090000_funnel_utm) : nouvel événement
-- 'visit', une ligne par navigateur et par jour (heure de Paris), sur toutes
-- les pages. Toujours aucun identifiant de compte.
--
-- funnel_visitor_counts() : visiteurs distincts aujourd'hui / 7 j / 30 j, pour
-- la rubrique Joueurs de l'admin. security invoker : la RLS de funnel_events
-- (lecture réservée à is_admin()) s'applique, un non-admin lit 0 partout.

alter table public.funnel_events drop constraint funnel_events_event_check;
alter table public.funnel_events add constraint funnel_events_event_check check (event in (
  'visit', 'home_view', 'team_picked', 'prono_added', 'save_opened',
  'save_email_submitted', 'save_google_started', 'account_created',
  'account_validated', 'password_created'
));

create or replace function public.funnel_visitor_counts()
returns table (today integer, last_7_days integer, last_30_days integer, first_visit_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (count(distinct visitor_id) filter (
      where created_at >= (date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris')
    ))::integer,
    (count(distinct visitor_id) filter (where created_at >= now() - interval '7 days'))::integer,
    (count(distinct visitor_id) filter (where created_at >= now() - interval '30 days'))::integer,
    (select min(created_at) from public.funnel_events where event = 'visit')
  from public.funnel_events
  where event = 'visit' and created_at >= now() - interval '30 days';
$$;

revoke all on function public.funnel_visitor_counts() from public, anon;
grant execute on function public.funnel_visitor_counts() to authenticated;
