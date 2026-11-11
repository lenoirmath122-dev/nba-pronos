-- Visiteurs uniques par semaine (événement 'visit' de funnel_events) : un visiteur =
-- un navigateur (cookie pb_vid, 1 an). Admins exclus à la source (cookie pb_internal).
-- Lecture seule. À lancer sur la base de production, éditeur SQL Supabase.
--
-- nouveaux  = première visite mesurée de ce navigateur pendant la semaine ;
-- revenants = déjà venu une semaine précédente ;
-- jours_moyens = nombre moyen de jours de visite dans la semaine, par visiteur.
-- Semaine = lundi, heure de Paris. Le décompte « Aujourd'hui / 7 j / 30 j » est dans
-- l'admin, rubrique Joueurs (fonction funnel_visitor_counts).

with visits as (
  select
    visitor_id,
    (created_at at time zone 'Europe/Paris')::date as day,
    date_trunc('week', created_at at time zone 'Europe/Paris')::date as week,
    utm_source
  from public.funnel_events
  where event = 'visit'
),
first_week as (
  select visitor_id, min(week) as week from visits group by visitor_id
)
select
  v.week as semaine,
  count(distinct v.visitor_id) as visiteurs_uniques,
  count(distinct v.visitor_id) filter (where f.week = v.week) as nouveaux,
  count(distinct v.visitor_id) filter (where f.week < v.week) as revenants,
  round(count(distinct (v.visitor_id, v.day))::numeric / nullif(count(distinct v.visitor_id), 0), 1) as jours_moyens,
  count(distinct v.visitor_id) filter (where v.utm_source = 'instagram') as via_lien_instagram
from visits v
join first_week f using (visitor_id)
group by v.week
order by v.week desc;
