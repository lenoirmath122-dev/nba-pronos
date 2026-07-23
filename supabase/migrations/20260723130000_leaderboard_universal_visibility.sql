-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #5 — VISIBILITÉ UNIVERSELLE DU CLASSEMENT
-- ============================================================================
-- Fichier : supabase/migrations/20260723130000_leaderboard_universal_visibility.sql
-- Motif   : décision post-validation T3 (23/07/2026) — le classement (rang,
--           points, badge "corrigé") doit être visible de TOUT LE MONDE en
--           permanence, indépendamment de la visibilité au cas par cas des
--           pronos/paris/picks individuels (qui reste régie par la RLS
--           existante, INCHANGÉE par cette migration).
-- Mécanisme : user_scores / user_recent_form passent de security_invoker=true
--           à security_invoker=false. Ni l'une ni l'autre table sous-jacente
--           n'a FORCE ROW LEVEL SECURITY -> leur propriétaire (le rôle qui a
--           créé les vues) contourne déjà leur RLS ; une vue non-invoker
--           hérite de ce contournement, quel que soit l'appelant. Les deux
--           vues ne renvoient QUE des agrégats (points, compteurs) — jamais
--           une ligne brute de match_predictions/bets/bracket_picks — donc
--           aucune donnée individuelle (qui a pronostiqué quoi) ne fuite.
-- Portée  : user_scores gagne aussi un compteur admin_corrections_count
--           agrégé (jusqu'ici calculé côté application par 2 requêtes
--           directes sur match_predictions/bets, donc encore RLS-gaté même
--           après le changement de sécurité des vues — corrigé ici en même
--           temps, sur demande explicite du 23/07/2026).
-- ============================================================================

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

-- user_recent_form : même traitement, colonnes inchangées (pas d'ajout ici).
create or replace view user_recent_form
with (security_invoker = false) as
select competition_id, user_id, sum(points_awarded) as recent_form_points
from (
  select competition_id, user_id, points_awarded, scored_at from match_predictions
  union all
  select bp.competition_id, br.user_id, bp.points_awarded, bp.scored_at
    from bracket_picks bp join brackets br on br.id = bp.bracket_id
  union all
  select competition_id, user_id, points_awarded, scored_at from bets
) all_scores
where scored_at >= now() - interval '7 days'
group by competition_id, user_id;

-- ============================================================================
-- FIN — migration #5. Ne touche AUCUNE policy RLS existante (match_predictions,
-- bets, bracket_picks, brackets restent exactement aussi confidentielles
-- qu'avant) — seule la lecture AGRÉGÉE via ces 2 vues devient publique.
-- ============================================================================
