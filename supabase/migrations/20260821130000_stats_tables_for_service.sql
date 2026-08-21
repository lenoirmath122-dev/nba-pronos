-- Tables de stats NBA pour le micro-service de proba (Cadrage/Stats/service),
-- Phase 4 du projet Data NBA (projet-data-nba.md §22-23) — chantier SEPARE
-- de l'app V1, ne touche a aucune table existante.
--
-- Prefixees stats_ dans le schema public (au lieu d'un nouveau schema
-- Postgres) pour eviter le reglage manuel "Exposed schemas" du dashboard
-- Supabase (Settings > API) — expose directement via PostgREST comme le
-- reste de l'app, sans etape supplementaire cote utilisateur.
--
-- Contenu : equivalent de nba.db SANS play_by_play (jamais lu par
-- l'inference), denormalise en 1 seule table de faits (stats_box_scores)
-- pour eviter les jointures via PostgREST — mêmes colonnes que celles
-- reellement consommees par build_context()/find_player()/find_team()
-- (scripts/tester_modele.py), rien de plus.
--
-- RLS activee sans policy : deny-all pour anon/authenticated (des stats NBA
-- publiques, pas sensibles, mais coherent avec le reste du schema T3) — le
-- service utilise SUPABASE_SERVICE_ROLE_KEY, qui contourne RLS.

create table stats_equipes (
  team_id integer primary key,
  tricode text not null,
  city text not null,
  name text not null
);

create table stats_joueurs (
  player_id integer primary key,
  first_name text not null,
  family_name text not null
);

create table stats_box_scores (
  game_id text not null,
  player_id integer not null references stats_joueurs (player_id),
  opponent_team_id integer references stats_equipes (team_id),
  game_date date not null,
  season text not null,
  minutes text,
  pts integer,
  reb integer,
  ast integer,
  fg3m integer,
  stl integer,
  blk integer,
  plus_minus integer,
  ftm integer,
  fta integer,
  fgm integer,
  fga integer,
  fg3a integer,
  ts_pct numeric,
  usg_pct numeric,
  games_played_season_avant integer,
  primary key (game_id, player_id)
);

-- "10 derniers matchs connus d'un joueur" (build_context) : tri par date
-- descendante filtre sur player_id.
create index stats_box_scores_player_date_idx
  on stats_box_scores (player_id, game_date desc);

-- Historique face a un adversaire precis (vs_adversaire dans build_context).
create index stats_box_scores_player_opponent_idx
  on stats_box_scores (player_id, opponent_team_id);

alter table stats_equipes enable row level security;
alter table stats_joueurs enable row level security;
alter table stats_box_scores enable row level security;
