-- Chantier "5 majeur / banc" (GAPS_OUVERTS.md, 24/08/2026) -- la position
-- de départ (F/C/G = titulaire, vide = remplaçant) est déjà renvoyée par
-- BoxScoreTraditionalV3 mais jamais capturée jusqu'ici (colonne "position"
-- absente de TRADITIONAL_COLUMNS/STATS_BOX_SCORE_TRAD_COLUMNS). Backfill
-- historique fait séparément (script Python, données déjà présentes en
-- local, aucun nouvel appel API).
alter table stats_box_scores add column position text;
