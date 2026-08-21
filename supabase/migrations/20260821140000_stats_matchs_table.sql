-- Table legere "quels matchs sont deja connus" pour le rafraichissement
-- quotidien du micro-service de proba (Cadrage/Stats/service/refresh_daily.py,
-- Phase 4, projet-data-nba.md §25). Sans elle, savoir si un match est deja en
-- base demanderait de scanner stats_box_scores (140k lignes, une par
-- joueur/match) au lieu d'une table a une ligne par match (~6-7k lignes,
-- meme volume que la table matchs locale de nba.db).

create table stats_matchs (
  game_id text primary key,
  game_date date not null,
  season text not null,
  season_type text,
  home_team_id integer references stats_equipes (team_id),
  away_team_id integer references stats_equipes (team_id)
);

create index stats_matchs_season_idx on stats_matchs (season);

alter table stats_matchs enable row level security;
