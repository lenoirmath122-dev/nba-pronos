-- Etend stats_box_scores avec pf (fautes personnelles) -- prerequis du pari
-- joueur "X commet plus de N fautes" (Lot 1 S1, chantier enrichissement des
-- modeles). Colonne deja presente EN LOCAL (box_scores.pf dans nba.db,
-- mappee depuis "foulsPersonal"), a propager vers Supabase via
-- backfill_supabase.py puis refresh_daily.py. Pas de colonne pf dans
-- stats_box_scores_by_period : aucune preuve d'usage a l'echelle periode.

alter table stats_box_scores
  add column pf integer;
