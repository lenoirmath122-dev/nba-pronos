-- Etend stats_box_scores avec oreb (rebonds offensifs) -- prerequis pour
-- les paris "rebonds offensifs" (types_de_paris_playoffs_2026.md,
-- categorie "Rebonds offensifs equipe" : forme JOUEUR ex. "Rudy Gobert
-- realise au moins 5 rebonds offensifs" ET forme EQUIPE combinee ex. "Le
-- total des rebonds offensifs cumules des Pistons et des Cavaliers est
-- superieur a 25"), extension "faciles" du 23/08/2026.
--
-- Colonne deja presente EN LOCAL (box_scores.oreb dans nba.db, cf.
-- load_to_sqlite.py) -- rien a extraire de nouveau depuis nba_api, juste a
-- propager vers Supabase (backfill_supabase.py / refresh_daily.py,
-- prochaine etape). dreb NON ajoutee : aucun pari "rebonds defensifs" dans
-- la liste fournie -- pas de raison d'etendre au-dela du besoin reel.

alter table stats_box_scores
  add column oreb integer;
