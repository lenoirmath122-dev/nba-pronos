-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #28 — FUSION PILIER → FIDÈLE (BADGES)
-- ============================================================================
-- Fichier : supabase/migrations/20260810090000_badges_merge_pilier_into_fidele.sql
-- Motif   : révision des noms/descriptions de badges par l'utilisateur
--           (10/08/2026, tableau PDF) — la nouvelle description proposée pour
--           Pilier ("Record de participation d'affilée (prono ou pari)")
--           s'est révélée être EXACTEMENT la définition déjà codée de Fidèle
--           (migration #27, règle d'union pronostic OU pari MATCH). Signalé
--           à l'utilisateur avant de coder quoi que ce soit — décision : les
--           deux badges FUSIONNENT en un seul, gardant le nom et le visuel
--           de **Fidèle** (« un chien en laisse »), Pilier disparaît du
--           catalogue.
--
-- Portée  : redéfinition COMPLÈTE de `user_competition_streaks` — retire la
--           colonne `pilier_streak` et tout le bloc de CTE qui la calculait
--           (`committed`/`pilier_ordered`/`pilier_islands`/`pilier_streaks`).
--           Métronome et Fidèle INCHANGÉS (même définitions, même calendrier
--           `user_match_grid`). CONTRAIREMENT à #26/#27 (qui ne faisaient
--           qu'AJOUTER des colonnes), celle-ci en RETIRE une — Postgres
--           refuse `CREATE OR REPLACE VIEW` dans ce cas (SQLSTATE 42P16,
--           trouvé au push sur la base réelle) : DROP + CREATE ci-dessous à
--           la place. Aucune autre vue/fonction ne dépend de celle-ci (grep
--           des migrations), donc sans risque.
-- ============================================================================

drop view if exists user_competition_streaks;

create view user_competition_streaks
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

-- ── Calendrier partagé pour Fidèle ───────────────────────────────────────
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

-- ── Fidèle — union pronostic OU pari MATCH rattaché à ce match précis
--    (inchangé, absorbe désormais le rôle de l'ex-Pilier) ─────────────────
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
  coalesce(fs.fidele_streak, 0)    as fidele_streak
from participant_competitions pc
left join metronome_streaks ms on ms.user_id = pc.user_id and ms.competition_id = pc.competition_id
left join fidele_streaks fs    on fs.user_id = pc.user_id and fs.competition_id = pc.competition_id;

-- ============================================================================
-- FIN — migration #28. Ne touche AUCUNE policy RLS existante. Catalogue des
-- badges permanents désormais à 35 badges (36 − Pilier fusionné dans
-- Fidèle), plus Grimpeur toujours hors périmètre.
-- ============================================================================
