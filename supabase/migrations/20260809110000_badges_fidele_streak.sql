-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #27 — user_competition_streaks + FIDÈLE (BADGES, PHASE 3)
-- ============================================================================
-- Fichier : supabase/migrations/20260809110000_badges_fidele_streak.sql
-- Motif   : Cadrage/V1/Spec visuelle/SPEC_BADGES_PERMANENTS_V0_1.md — badges
--           permanents, phase 3 (Fidèle, dernier des 3 badges "streak").
--           `create or replace view` : redéfinition COMPLÈTE de
--           `user_competition_streaks` (migration #26) avec une colonne
--           `fidele_streak` en plus — même geste que la migration #5 sur
--           `user_scores` (colonne `admin_corrections_count` ajoutée par un
--           `create or replace` non destructif).
--
-- Définition de Fidèle, tranchée AVEC l'utilisateur le 09/08/2026 (la seule
-- question restée ouverte depuis le cadrage du 08/08) : "participation sans
-- absence, tous engagements confondus" = un match compte comme "présent" si
-- AU MOINS UN des deux existe (règle d'UNION, option retenue parmi 2
-- proposées) :
--   (a) un pronostic figé pour CE match précis (`match_predictions`,
--       identique à Pilier), OU
--   (b) un pari perso non brouillon/non retiré RATTACHÉ À CE MATCH PRÉCIS
--       (`bets.scope = 'MATCH'` et `bets.match_id` = ce match).
-- **Explicitement écarté par l'utilisateur** : un pari SÉRIE (scope=SERIES,
-- jamais rattaché à un match précis) ne compte PAS pour les matchs de sa
-- série — jugé "trop facile" (un seul pari série créditerait toute la
-- série). Fidèle réutilise donc le même calendrier `user_match_grid`
-- (matchs éligibles × joueurs participants) que Pilier, avec un critère de
-- présence plus large (union pronostic OU pari MATCH) mais toujours
-- rattaché au match exact, jamais à la série entière.
-- ============================================================================

create or replace view user_competition_streaks
with (security_invoker = false) as
with participants as (
  select competition_id, user_id from match_predictions where status <> 'DRAFT'
  union
  select competition_id, user_id from bets where status not in ('DRAFT', 'CANCELLED')
  union
  select bp.competition_id, br.user_id
    from bracket_picks bp join brackets br on br.id = bp.bracket_id
),
participant_competitions as (
  select distinct user_id, competition_id from participants
),

-- ── Métronome ────────────────────────────────────────────────────────────
metronome_source as (
  select mp.user_id, mp.competition_id, mp.is_winner_correct, m.scheduled_at
  from match_predictions mp
  join matches m on m.id = mp.match_id
  where mp.status <> 'DRAFT' and mp.is_winner_correct is not null and m.scheduled_at is not null
),
metronome_ordered as (
  select
    user_id, competition_id, is_winner_correct,
    row_number() over (partition by user_id, competition_id order by scheduled_at) as rn_all,
    row_number() over (partition by user_id, competition_id, is_winner_correct order by scheduled_at) as rn_in_group
  from metronome_source
),
metronome_islands as (
  select user_id, competition_id, is_winner_correct, (rn_all - rn_in_group) as island_id, count(*) as run_length
  from metronome_ordered
  group by user_id, competition_id, is_winner_correct, island_id
),
metronome_streaks as (
  select user_id, competition_id, max(run_length) as metronome_streak
  from metronome_islands
  where is_winner_correct = true
  group by user_id, competition_id
),

-- ── Calendrier partagé Pilier + Fidèle ──────────────────────────────────
eligible_matches as (
  select id as match_id, competition_id, scheduled_at
  from matches
  where scheduled_at is not null
    and scheduled_at <= now()
    and status not in ('CANCELLED', 'POSTPONED')
),
user_match_grid as (
  select pc.user_id, em.match_id, em.competition_id, em.scheduled_at
  from participant_competitions pc
  join eligible_matches em on em.competition_id = pc.competition_id
),

-- ── Pilier — pronostic figé uniquement ──────────────────────────────────
committed as (
  select
    g.user_id, g.competition_id, g.match_id, g.scheduled_at,
    exists (
      select 1 from match_predictions mp
      where mp.user_id = g.user_id and mp.match_id = g.match_id and mp.status <> 'DRAFT'
    ) as is_committed
  from user_match_grid g
),
pilier_ordered as (
  select
    user_id, competition_id, is_committed,
    row_number() over (partition by user_id, competition_id order by scheduled_at) as rn_all,
    row_number() over (partition by user_id, competition_id, is_committed order by scheduled_at) as rn_in_group
  from committed
),
pilier_islands as (
  select user_id, competition_id, is_committed, (rn_all - rn_in_group) as island_id, count(*) as run_length
  from pilier_ordered
  group by user_id, competition_id, is_committed, island_id
),
pilier_streaks as (
  select user_id, competition_id, max(run_length) as pilier_streak
  from pilier_islands
  where is_committed = true
  group by user_id, competition_id
),

-- ── Fidèle — union pronostic OU pari MATCH rattaché à ce match précis ──
fidele_committed as (
  select
    g.user_id, g.competition_id, g.match_id, g.scheduled_at,
    (
      exists (
        select 1 from match_predictions mp
        where mp.user_id = g.user_id and mp.match_id = g.match_id and mp.status <> 'DRAFT'
      )
      or exists (
        select 1 from bets b
        where b.user_id = g.user_id and b.scope = 'MATCH' and b.match_id = g.match_id
          and b.status not in ('DRAFT', 'CANCELLED')
      )
    ) as is_present
  from user_match_grid g
),
fidele_ordered as (
  select
    user_id, competition_id, is_present,
    row_number() over (partition by user_id, competition_id order by scheduled_at) as rn_all,
    row_number() over (partition by user_id, competition_id, is_present order by scheduled_at) as rn_in_group
  from fidele_committed
),
fidele_islands as (
  select user_id, competition_id, is_present, (rn_all - rn_in_group) as island_id, count(*) as run_length
  from fidele_ordered
  group by user_id, competition_id, is_present, island_id
),
fidele_streaks as (
  select user_id, competition_id, max(run_length) as fidele_streak
  from fidele_islands
  where is_present = true
  group by user_id, competition_id
)

select
  pc.user_id,
  pc.competition_id,
  coalesce(ms.metronome_streak, 0) as metronome_streak,
  coalesce(ps.pilier_streak, 0)    as pilier_streak,
  coalesce(fs.fidele_streak, 0)    as fidele_streak
from participant_competitions pc
left join metronome_streaks ms on ms.user_id = pc.user_id and ms.competition_id = pc.competition_id
left join pilier_streaks ps    on ps.user_id = pc.user_id and ps.competition_id = pc.competition_id
left join fidele_streaks fs    on fs.user_id = pc.user_id and fs.competition_id = pc.competition_id;

-- ============================================================================
-- FIN — migration #27. Ne touche AUCUNE policy RLS existante. Le catalogue
-- des badges permanents est désormais ENTIÈREMENT couvert (30/30, plus
-- Grimpeur reporté hors catalogue de base — spec §4.IV).
-- Vérif post-push : `select * from user_competition_streaks where user_id =
-- ...`, comparer fidele_streak >= pilier_streak sur chaque ligne (Fidèle ne
-- peut être QUE plus généreux que Pilier, jamais plus strict — même
-- calendrier, critère de présence plus large) avant de considérer la vue
-- fiable.
-- ============================================================================
