-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #25 — VUE user_badges_lifetime (BADGES, PHASE 1)
-- ============================================================================
-- Fichier : supabase/migrations/20260809090000_badges_lifetime_view.sql
-- Motif   : Cadrage/V1/Spec visuelle/SPEC_BADGES_PERMANENTS_V0_1.md — badges
--           permanents, phase 1 (25 des ~30 badges du catalogue, tout SAUF
--           les 3 badges "streak" — Métronome/Pilier/Fidèle — reportés à une
--           phase suivante, cf. §6/§7 de la spec).
--
-- Portée  : contrairement à `user_scores` (scopée PAR COMPÉTITION), cette vue
--           agrège À VIE, toutes compétitions confondues (spec §1/§2), un
--           seul grain `user_id`. Même patron de CTE que `user_scores`
--           (`20260718090000_initial_schema.sql` §17), même convention de
--           sécurité que `user_scores`/`user_recent_form`
--           (`20260723130000_leaderboard_universal_visibility.sql`) :
--           `security_invoker = false`, safe car la vue n'expose QUE des
--           agrégats (compteurs/sommes) — jamais une ligne brute de
--           match_predictions/bets/bracket_picks, donc aucune donnée
--           individuelle (qui a pronostiqué/parié quoi) ne fuite. Aucune des
--           tables sous-jacentes n'a FORCE ROW LEVEL SECURITY, donc le
--           propriétaire de la vue (rôle migrateur) contourne déjà leur RLS
--           — une vue non-invoker hérite de ce contournement pour tout
--           appelant, exactement comme `user_scores` depuis la migration #5.
--
-- Écart assumé par rapport au CTE `participants` de `user_scores` : ici,
--           filtré `status <> 'DRAFT'` sur match_predictions et
--           `status not in ('DRAFT','CANCELLED')` sur bets — un brouillon
--           jamais soumis (ou un pari retiré par le joueur) ne doit pas
--           compter comme une "compétition jouée" pour le badge Vétéran, ni
--           comme une tentative pour les badges de volume (Accro du pari,
--           Maïno, échelle Prudent→Fou furieux) — décidé avec l'utilisateur
--           le 09/08/2026. Un prono/pari auto-validé à la deadline a par
--           construction un statut final ≠ DRAFT, donc déjà correctement
--           compté par ce filtre sans logique supplémentaire.
--
-- Sans-faute (bracket) : décidé avec l'utilisateur le 09/08/2026 — un tour
--           est parfait si tous les VAINQUEURS de série du tour sont
--           corrects (`bool_and` sur `is_winner_correct`, NULL traité comme
--           faux via `coalesce(..., false)` pour exclure un tour encore en
--           partie non tranché) ; score exact et affiche restent des badges
--           séparés (Scoreur, Visionnaire), pas une condition ici.
--
-- Housekeeping mineur au passage : ajout d'un index manquant sur
--           `leaderboard_snapshots.user_id` (seul `idx_leaderboard_snapshots
--           _competition` existait), utile au badge Podiumista qui filtre
--           systématiquement par utilisateur.
-- ============================================================================

create index idx_leaderboard_snapshots_user on leaderboard_snapshots (user_id);

create or replace view user_badges_lifetime
with (security_invoker = false) as
with participants as (
  select competition_id, user_id from match_predictions where status <> 'DRAFT'
  union
  select competition_id, user_id from bets where status not in ('DRAFT', 'CANCELLED')
  union
  select bp.competition_id, br.user_id
    from bracket_picks bp join brackets br on br.id = bp.bracket_id
),
all_users as (
  select distinct user_id from participants
),
competitions_played as (
  select user_id, count(distinct competition_id) as competitions_played
  from participants
  group by user_id
),
match_stats as (
  select
    user_id,
    count(*) filter (where is_winner_correct)           as match_correct_winners,
    count(*) filter (where margin_diff = 0)             as match_exact_margins,
    count(*) filter (where margin_diff between 1 and 2) as match_close_margins,
    count(*) filter (where status <> 'DRAFT')           as match_predictions_committed,
    sum(points_awarded)                                 as matches_points_lifetime
  from match_predictions
  group by user_id
),
bracket_pick_stats as (
  select
    br.user_id,
    count(*) filter (where bp.is_winner_correct)  as bracket_correct_winners,
    count(*) filter (where bp.is_score_exact)     as bracket_exact_scores,
    count(*) filter (where bp.is_matchup_correct) as bracket_correct_matchups,
    sum(bp.points_awarded)                        as bracket_points_lifetime
  from bracket_picks bp
  join brackets br on br.id = bp.bracket_id
  group by br.user_id
),
bracket_perfect_rounds as (
  select br.user_id, count(*) as perfect_rounds
  from (
    select bp.bracket_id, s.round
    from bracket_picks bp
    join series s on s.id = bp.series_id
    group by bp.bracket_id, s.round
    having bool_and(coalesce(bp.is_winner_correct, false))
  ) rounds
  join brackets br on br.id = rounds.bracket_id
  group by br.user_id
),
bracket_validated as (
  select user_id, bool_or(is_validated) as has_validated_bracket
  from brackets
  group by user_id
),
bets_by_category as (
  select user_id, jsonb_object_agg(category, won_count) as bets_won_by_category
  from (
    select
      user_id,
      coalesce(validated_category, proposed_category) as category,
      count(*) filter (where status = 'WON')           as won_count
    from bets
    group by user_id, coalesce(validated_category, proposed_category)
  ) c
  group by user_id
),
bets_by_difficulty as (
  select user_id, jsonb_object_agg(difficulty, attempted_count) as bets_attempted_by_difficulty
  from (
    select
      user_id,
      coalesce(validated_difficulty, proposed_difficulty)          as difficulty,
      count(*) filter (where status not in ('DRAFT', 'CANCELLED')) as attempted_count
    from bets
    group by user_id, coalesce(validated_difficulty, proposed_difficulty)
  ) d
  group by user_id
),
bets_volume as (
  select
    user_id,
    count(*) filter (where status not in ('DRAFT', 'CANCELLED')) as bets_posted_total,
    count(*) filter (
      where status not in ('DRAFT', 'CANCELLED')
        and coalesce(validated_category, proposed_category) = 'FUN_OFF_COURT'
    ) as bets_posted_fun_off_court,
    sum(points_awarded) as bets_points_lifetime
  from bets
  group by user_id
),
podium_days as (
  select user_id, count(*) filter (where rank <= 3) as podium_days
  from leaderboard_snapshots
  group by user_id
),
league_membership as (
  select distinct user_id from league_memberships
)
select
  u.user_id,
  coalesce(cp.competitions_played, 0)                     as competitions_played,
  coalesce(ms.match_correct_winners, 0)                   as match_correct_winners,
  coalesce(ms.match_exact_margins, 0)                     as match_exact_margins,
  coalesce(ms.match_close_margins, 0)                     as match_close_margins,
  coalesce(ms.match_predictions_committed, 0)             as match_predictions_committed,
  coalesce(bps.bracket_correct_winners, 0)                as bracket_correct_winners,
  coalesce(bps.bracket_exact_scores, 0)                   as bracket_exact_scores,
  coalesce(bps.bracket_correct_matchups, 0)               as bracket_correct_matchups,
  coalesce(bpr.perfect_rounds, 0)                         as bracket_perfect_rounds,
  coalesce(bv.has_validated_bracket, false)               as has_validated_bracket,
  coalesce(bc.bets_won_by_category, '{}'::jsonb)          as bets_won_by_category,
  coalesce(bd.bets_attempted_by_difficulty, '{}'::jsonb)  as bets_attempted_by_difficulty,
  coalesce(bvol.bets_posted_total, 0)                     as bets_posted_total,
  coalesce(bvol.bets_posted_fun_off_court, 0)             as bets_posted_fun_off_court,
  coalesce(ms.matches_points_lifetime, 0)                 as matches_points_lifetime,
  coalesce(bps.bracket_points_lifetime, 0)                as bracket_points_lifetime,
  coalesce(bvol.bets_points_lifetime, 0)                  as bets_points_lifetime,
  coalesce(ms.matches_points_lifetime, 0)
    + coalesce(bps.bracket_points_lifetime, 0)
    + coalesce(bvol.bets_points_lifetime, 0)              as total_points_lifetime,
  coalesce(pd.podium_days, 0)                             as podium_days,
  (lm.user_id is not null)                                as has_league_membership
from all_users u
left join competitions_played cp   on cp.user_id = u.user_id
left join match_stats ms           on ms.user_id = u.user_id
left join bracket_pick_stats bps   on bps.user_id = u.user_id
left join bracket_perfect_rounds bpr on bpr.user_id = u.user_id
left join bracket_validated bv     on bv.user_id = u.user_id
left join bets_by_category bc      on bc.user_id = u.user_id
left join bets_by_difficulty bd    on bd.user_id = u.user_id
left join bets_volume bvol         on bvol.user_id = u.user_id
left join podium_days pd           on pd.user_id = u.user_id
left join league_membership lm     on lm.user_id = u.user_id;

-- ============================================================================
-- FIN — migration #25. Ne touche AUCUNE policy RLS existante — seule la
-- lecture AGRÉGÉE via cette vue devient possible, même patron que
-- `user_scores` (migration #5).
-- Vérif post-push : `select * from user_badges_lifetime where user_id = ...`
-- sur un compte réel, comparer manuellement 1-2 compteurs (ex.
-- match_correct_winners) à un décompte à la main avant de considérer la vue
-- fiable (voir script jetable de vérification).
-- ============================================================================
