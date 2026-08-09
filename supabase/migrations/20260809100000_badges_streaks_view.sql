-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #26 — VUE user_competition_streaks (BADGES, PHASE 2)
-- ============================================================================
-- Fichier : supabase/migrations/20260809100000_badges_streaks_view.sql
-- Motif   : Cadrage/V1/Spec visuelle/SPEC_BADGES_PERMANENTS_V0_1.md — badges
--           permanents, phase 2 (Métronome, Pilier — les 2 seuls badges
--           "streak" calculables sans ambiguïté de définition ; Fidèle reste
--           en phase 3, sa définition du "sans absence combiné" pronos+paris
--           n'étant pas encore tranchée).
--
-- Grain   : (user_id, competition_id) — CONTRAIREMENT à
--           `user_badges_lifetime` (migration #25, grain user_id seul). La
--           streak elle-même se calcule À L'INTÉRIEUR d'une seule compétition
--           (décidé avec l'utilisateur le 08/08/2026 : repart à zéro à la
--           compétition suivante, cohérent avec le scope des superlatifs
--           existants) — le RECORD affiché par le badge (max de toutes les
--           streaks jamais obtenues, toutes compétitions confondues) est
--           réduit côté TypeScript (lib/queries/badges.ts) après lecture de
--           toutes les lignes de l'utilisateur, PAS en SQL — plus simple sur
--           ce 1er usage de gaps-and-islands dans ce dépôt (grep de toutes
--           les migrations précédentes : aucun row_number()/partition by
--           avant celle-ci).
--
-- Même convention de sécurité que `user_badges_lifetime`/`user_scores` :
--           `security_invoker = false`, la vue n'expose que des compteurs
--           agrégés (longueur de streak), jamais une ligne brute.
--
-- ── Métronome — bons vainqueurs de match d'affilée ──────────────────────────
-- Technique gaps-and-islands classique : pour chaque (user, competition),
-- les pronostics figés (`status <> 'DRAFT'`) et scorés
-- (`is_winner_correct` non NULL) sont ordonnés par `matches.scheduled_at` ;
-- deux row_number() (global, et au sein du groupe is_winner_correct)
-- dont la différence est constante sur un « îlot » contigu de même valeur —
-- on garde la longueur du plus grand îlot où is_winner_correct = true.
--
-- ── Pilier — participation sans absence sur les pronostics de match ────────
-- Plus dur que Métronome : une ABSENCE est un match du calendrier de la
-- compétition pour lequel AUCUN pronostic figé n'existe — il faut donc
-- partir de TOUS les matchs « exigibles » de la compétition (pas seulement
-- des lignes match_predictions déjà existantes), croisés avec chaque joueur
-- ayant participé à cette compétition (`participants`, même CTE que
-- `user_badges_lifetime`).
--
-- **Hypothèse assumée sur les matchs « exigibles » (à confirmer à l'usage,
-- pas encore posée explicitement à l'utilisateur)** : un match compte
-- seulement si son coup d'envoi est déjà passé (`scheduled_at <= now()` —
-- même frontière « verrouillé » que l'écran Matchs, T6c §10.3) ET qu'il
-- n'est ni CANCELLED ni POSTPONED (même neutralisation que le moteur de
-- scoring, `lib/scoring/engine.ts` §5 : un match annulé ne pénalise
-- personne). Un match futur n'est PAS encore une absence — le joueur a
-- encore le temps de le pronostiquer.
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

-- ── Pilier ───────────────────────────────────────────────────────────────
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
)

select
  pc.user_id,
  pc.competition_id,
  coalesce(ms.metronome_streak, 0) as metronome_streak,
  coalesce(ps.pilier_streak, 0)    as pilier_streak
from participant_competitions pc
left join metronome_streaks ms on ms.user_id = pc.user_id and ms.competition_id = pc.competition_id
left join pilier_streaks ps    on ps.user_id = pc.user_id and ps.competition_id = pc.competition_id;

-- ============================================================================
-- FIN — migration #26. Ne touche AUCUNE policy RLS existante.
-- Vérif post-push : `select * from user_competition_streaks where user_id =
-- ...` sur un compte réel, comparer manuellement la plus longue série de
-- `is_winner_correct` consécutifs (Métronome) à la main sur 1-2 compétitions
-- avant de considérer la vue fiable (voir script jetable de vérification).
-- ============================================================================
