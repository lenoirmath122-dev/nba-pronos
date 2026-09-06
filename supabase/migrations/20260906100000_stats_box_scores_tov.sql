-- Etend stats_box_scores avec tov (pertes de balle) -- prerequis pour les
-- paris "pertes de balle" (GAPS_OUVERTS.md, "Chantier paris personnalises
-- IA" -- 1 occurrence dans les 429 paris reels, dans un combo : "Harden...
-- + de 3 pertes de balle" ; et demande explicitement par l'utilisateur en
-- testant "Les Warriors font au moins 5 pertes de balle"), meme patron
-- mecanique que la migration oreb du 23/08/2026.
--
-- Colonne deja presente EN LOCAL (box_scores.tov dans nba.db, cf.
-- load_to_sqlite.py, mappee depuis "turnovers" de nba_api) -- rien a
-- extraire de nouveau depuis nba_api, juste a propager vers Supabase
-- (backfill_supabase.py / refresh_daily.py, prochaine etape). Pas de
-- colonne period ajoutee (stats_box_scores_by_period) : aucune preuve
-- d'usage reel a l'echelle periode, pas de raison d'etendre au-dela du
-- besoin reel.

alter table stats_box_scores
  add column tov integer;
