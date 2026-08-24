-- Chantier "paris joueur+periode" (GAPS_OUVERTS.md, 24/08/2026) -- box-score
-- JOUEUR restreint a UN quart-temps (ex. "3 contres en Q1 pour Untel"),
-- distinct de stats_box_scores (PK game_id,player_id, plein match
-- uniquement, aucune dimension periode). Verifie empiriquement avant de
-- coder : nba_api.stats.endpoints.boxscoretraditionalv3.BoxScoreTraditionalV3
-- accepte range_type="1" + start_period=end_period=N et renvoie un vrai
-- box-score officiel restreint a cette periode (teste sur un match reel,
-- chiffres differents et coherents par quart-temps) -- pas besoin de
-- reconstruire depuis play_by_play cote synchro de prod.
--
-- period stocke uniquement 1-4 (quarts-temps) : les mi-temps se calculent en
-- sommant Q1+Q2 / Q3+Q4 au moment de la resolution (stats de comptage
-- additives), pas de lignes H1/H2 stockees. minutes en NUMERIC (secondes ou
-- fraction), pas TEXT "MM:SS" comme stats_box_scores.minutes -- doit rester
-- sommable entre 2 quarts-temps.
create table stats_box_scores_by_period (
  game_id text not null,
  player_id integer not null references stats_joueurs (player_id),
  period smallint not null check (period between 1 and 4),
  pts integer,
  reb integer,
  ast integer,
  fg3m integer,
  stl integer,
  blk integer,
  ftm integer,
  fta integer,
  fgm integer,
  fga integer,
  fg3a integer,
  oreb integer,
  minutes numeric,
  primary key (game_id, player_id, period)
);

create index stats_box_scores_by_period_player_idx on stats_box_scores_by_period (player_id, game_id);

alter table stats_box_scores_by_period enable row level security;
