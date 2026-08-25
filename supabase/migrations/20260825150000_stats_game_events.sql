-- Chantier "événements de match" (étape 5 du plan de reprise post-audit,
-- GAPS_OUVERTS.md, 25/08/2026) -- fautes techniques, temps morts, retour en
-- zone (violation de contre-attaque/backcourt). Données déjà présentes dans
-- le play-by-play téléchargé localement (data/raw/*/playbyplay/*.csv,
-- actionType/subType structurés), jamais agrégées en stat pariable jusqu'ici.
--
-- technical_fouls/backcourt_turnovers : PAR JOUEUR (personId attribué
-- directement dans le play-by-play) -- même granularité que le reste de
-- stats_box_scores. Piège réel trouvé en explorant les données : une faute
-- technique d'ENTRAÎNEUR a teamId=0 et un personId qui n'est PAS un joueur
-- (ex. Gregg Popovich) -- ces lignes n'ont ainsi jamais de ligne
-- stats_box_scores correspondante (FK player_id -> stats_joueurs), donc
-- sont naturellement exclues du comptage joueur sans filtre dédié.
--
-- home_timeouts/away_timeouts : PAR ÉQUIPE sur stats_matchs -- un temps
-- mort n'a PAS d'attribution joueur (teamId=0 dans le play-by-play aussi,
-- seule l'équipe qui l'a appelé est identifiable, via le nom d'équipe en
-- texte libre dans description -- "Nets Timeout: Regular"). Pas de colonne
-- combinée (total_timeouts) : calculée à la volée (home+away) là où besoin,
-- même principe que total_points = home_score+away_score.
alter table stats_box_scores add column technical_fouls smallint;
alter table stats_box_scores add column backcourt_turnovers smallint;
alter table stats_matchs add column home_timeouts smallint;
alter table stats_matchs add column away_timeouts smallint;

-- Même patron que bulk_update_box_score_position() (migration 20260824190000)
-- -- un upsert à payload partiel échoue sur ces tables (Postgres valide les
-- contraintes NOT NULL de l'INSERT avant de tenter le conflit). Réutilisable
-- pour technical_fouls ET backcourt_turnovers en un seul appel (mêmes lignes
-- concernées : joueurs impliqués dans au moins un des 2 events).
create or replace function bulk_update_box_score_game_events(rows jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update stats_box_scores t
  set technical_fouls = r.technical_fouls, backcourt_turnovers = r.backcourt_turnovers
  from jsonb_to_recordset(rows) as r(game_id text, player_id integer, technical_fouls smallint, backcourt_turnovers smallint)
  where t.game_id = r.game_id and t.player_id = r.player_id;
end;
$$;

create or replace function bulk_update_match_timeouts(rows jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update stats_matchs t
  set home_timeouts = r.home_timeouts, away_timeouts = r.away_timeouts
  from jsonb_to_recordset(rows) as r(game_id text, home_timeouts smallint, away_timeouts smallint)
  where t.game_id = r.game_id;
end;
$$;
