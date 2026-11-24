-- Classements des deux lots NBA Cup 2026 (règlement v2 du 24/11/2026, articles 6 et 7).
-- À lancer après la finale, en lecture seule (ne modifie aucune donnée) :
--   npx supabase db query --remote --read-only -f scripts/classements-nba-cup-lots.sql
-- Le fichier contient deux requêtes : lancer l'une puis l'autre (copier la requête voulue
-- dans un fichier séparé si l'outil n'en exécute qu'une).
-- Compétition visée : la dernière NBA_CUP non archivée (vérifier son nom dans le résultat).
-- Comptes exclus : statut autre que ACTIVE, rôle ADMIN, comptes de test listés ci-dessous.
-- À vérifier à la main avant l'envoi : e-mail confirmé, 15 ans ou plus, résidence (article 3).


-- Lot 1 — meilleur bracket : points de bracket des choix enregistrés avant la date limite,
-- départage par bons vainqueurs, puis bon champion, puis bracket créé le plus tôt.
with params as (
  select id as competition_id, name as competition_name, bracket_deadline
  from competitions
  where type = 'NBA_CUP' and status <> 'ARCHIVED'
  order by created_at desc
  limit 1
),
excluded_test_accounts(pseudo) as (
  values ('Demo_Amis')
),
eligible_users as (
  select u.id, u.pseudo
  from users u
  where u.status = 'ACTIVE'
    and u.role <> 'ADMIN'
    and u.pseudo not in (select pseudo from excluded_test_accounts)
),
bracket_scores as (
  select
    b.user_id,
    b.created_at as bracket_created_at,
    sum(coalesce(bp.points_awarded, 0)) as bracket_points,
    count(*) filter (where bp.is_winner_correct) as correct_winners,
    coalesce(bool_or(s.round = 'CUP_FINAL' and bp.is_winner_correct), false) as correct_champion
  from brackets b
  join params p on p.competition_id = b.competition_id
  join bracket_picks bp on bp.bracket_id = b.id
  join series s on s.id = bp.series_id
  where s.round in ('CUP_QUARTERS', 'CUP_SEMIS', 'CUP_FINAL')
    and bp.predicted_winner_team_id is not null
    and bp.created_at <= p.bracket_deadline
  group by b.user_id, b.created_at
)
select
  rank() over (
    order by bs.bracket_points desc, bs.correct_winners desc, bs.correct_champion desc, bs.bracket_created_at asc
  ) as rang,
  eu.pseudo,
  bs.bracket_points as points_bracket,
  bs.correct_winners as bons_vainqueurs,
  bs.correct_champion as bon_champion,
  bs.bracket_created_at as bracket_cree_le,
  p.competition_name,
  eu.id as user_id
from bracket_scores bs
join eligible_users eu on eu.id = bs.user_id
cross join params p
order by rang, eu.pseudo
limit 20;


-- Lot 2 — meilleur pronostiqueur des matchs de la Cup (quarts à finale, ni bracket ni pronos
-- personnalisés) : points, puis bons vainqueurs, puis écarts exacts, puis premier prono le plus tôt.
-- La colonne gagnant_lot_1 signale le gagnant du lot 1 : pas de cumul, le lot 2 va au suivant.
with params as (
  select id as competition_id, name as competition_name, bracket_deadline
  from competitions
  where type = 'NBA_CUP' and status <> 'ARCHIVED'
  order by created_at desc
  limit 1
),
excluded_test_accounts(pseudo) as (
  values ('Demo_Amis')
),
eligible_users as (
  select u.id, u.pseudo
  from users u
  where u.status = 'ACTIVE'
    and u.role <> 'ADMIN'
    and u.pseudo not in (select pseudo from excluded_test_accounts)
),
lot1_winner as (
  select b.user_id
  from brackets b
  join params p on p.competition_id = b.competition_id
  join eligible_users eu on eu.id = b.user_id
  join bracket_picks bp on bp.bracket_id = b.id
  join series s on s.id = bp.series_id
  where s.round in ('CUP_QUARTERS', 'CUP_SEMIS', 'CUP_FINAL')
    and bp.predicted_winner_team_id is not null
    and bp.created_at <= p.bracket_deadline
  group by b.user_id, b.created_at
  order by
    sum(coalesce(bp.points_awarded, 0)) desc,
    count(*) filter (where bp.is_winner_correct) desc,
    coalesce(bool_or(s.round = 'CUP_FINAL' and bp.is_winner_correct), false) desc,
    b.created_at asc
  limit 1
),
match_scores as (
  select
    mp.user_id,
    sum(coalesce(mp.points_awarded, 0)) as match_points,
    count(*) filter (where mp.is_winner_correct) as correct_winners,
    count(*) filter (where mp.is_winner_correct and mp.margin_diff = 0) as exact_margins,
    min(mp.created_at) as first_prediction_at
  from match_predictions mp
  join params p on p.competition_id = mp.competition_id
  join matches m on m.id = mp.match_id
  join series s on s.id = m.series_id
  where s.round in ('CUP_QUARTERS', 'CUP_SEMIS', 'CUP_FINAL')
    and mp.predicted_winner_team_id is not null
  group by mp.user_id
)
select
  rank() over (
    order by ms.match_points desc, ms.correct_winners desc, ms.exact_margins desc, ms.first_prediction_at asc
  ) as rang,
  eu.pseudo,
  ms.match_points as points_matchs,
  ms.correct_winners as bons_vainqueurs,
  ms.exact_margins as ecarts_exacts,
  ms.first_prediction_at as premier_prono_le,
  exists (select 1 from lot1_winner w where w.user_id = ms.user_id) as gagnant_lot_1,
  p.competition_name,
  eu.id as user_id
from match_scores ms
join eligible_users eu on eu.id = ms.user_id
cross join params p
order by rang, eu.pseudo
limit 20;
