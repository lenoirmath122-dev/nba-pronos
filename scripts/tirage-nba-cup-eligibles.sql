-- Tirage au sort NBA Cup 2026 : liste des comptes éligibles. À lancer le 04/12/2026 après la date limite,
-- en lecture seule (ne modifie aucune donnée) :
--   npx supabase db query --remote --read-only -f scripts/tirage-nba-cup-eligibles.sql
--
-- Comptes éligibles au tirage NBA Cup 2026 (lot 1) : bracket complet (7 vainqueurs) enregistré
-- avant la date limite, compte actif, hors comptes admin et de test. Lecture seule.
with params as (
  -- Vérifier dans le résultat que c'est bien la compétition NBA Cup 2026.
  select id as competition_id, name as competition_name, bracket_deadline
  from competitions
  where type = 'NBA_CUP' and status <> 'ARCHIVED'
  order by created_at desc
  limit 1
),
excluded_test_accounts(pseudo) as (
  values ('Demo_Amis')
),
complete_brackets as (
  select b.user_id
  from brackets b
  join params p on p.competition_id = b.competition_id
  join bracket_picks bp on bp.bracket_id = b.id
  join series s on s.id = bp.series_id
  where s.round in ('CUP_QUARTERS', 'CUP_SEMIS', 'CUP_FINAL')
    and bp.predicted_winner_team_id is not null
    and bp.updated_at <= p.bracket_deadline
  group by b.user_id
  having count(distinct bp.series_id) = 7
)
select p.competition_name, p.bracket_deadline, u.pseudo, u.id as user_id
from complete_brackets c
join users u on u.id = c.user_id
cross join params p
where u.status = 'ACTIVE'
  and u.role <> 'ADMIN'
  and u.pseudo not in (select pseudo from excluded_test_accounts)
order by u.pseudo;
