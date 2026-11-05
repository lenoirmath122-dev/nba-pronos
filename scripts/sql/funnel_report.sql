-- Entonnoir de l'accueil : visiteurs distincts à chaque étape, par semaine et par source.
-- Lecture seule (un seul SELECT). À lancer sur la base de production, éditeur SQL Supabase.
--
-- Semaine = celle du premier événement du visiteur (lundi, heure de Paris).
-- Source du visiteur = utm_source, sinon in_app_browser, sinon référent, sinon « inconnue »
-- (première valeur non nulle sur tous ses événements, du plus ancien au plus récent).
-- Chaque colonne compte les visiteurs distincts qui ont déclenché l'étape au moins une fois ;
-- ce n'est pas un entonnoir strictement emboîté (un visiteur peut valider sans avoir « créé » côté mesure).

with visitor as (
  select
    visitor_id,
    date_trunc('week', min(created_at) at time zone 'Europe/Paris')::date as week,
    coalesce(
      (array_agg(utm_source order by created_at) filter (where utm_source is not null))[1],
      (array_agg(in_app_browser order by created_at) filter (where in_app_browser is not null))[1],
      (array_agg(referrer order by created_at) filter (where referrer is not null))[1],
      'inconnue'
    ) as source
  from public.funnel_events
  group by visitor_id
)
select
  v.week,
  v.source,
  count(distinct e.visitor_id) as visiteurs,
  count(distinct e.visitor_id) filter (where e.event = 'home_view') as home_view,
  count(distinct e.visitor_id) filter (where e.event = 'team_picked') as team_picked,
  count(distinct e.visitor_id) filter (where e.event = 'prono_added') as prono_added,
  count(distinct e.visitor_id) filter (where e.event = 'save_opened') as save_opened,
  count(distinct e.visitor_id) filter (where e.event in ('save_email_submitted', 'save_google_started')) as save_submitted,
  count(distinct e.visitor_id) filter (where e.event = 'account_created') as account_created,
  count(distinct e.visitor_id) filter (where e.event = 'account_validated') as account_validated,
  count(distinct e.visitor_id) filter (where e.event = 'password_created') as password_created
from public.funnel_events e
join visitor v using (visitor_id)
group by v.week, v.source
order by v.week desc, visiteurs desc;
