-- Etend stats_box_scores avec team_id + les 4 stats avancees equipe
-- (off_rating/def_rating/net_rating/pace) -- prerequis pour utiliser le
-- modele home_win (Cadrage/Stats/scripts/train_home_win_model.py) en
-- production, cf. GAPS_OUVERTS.md (bloquant note le 23/08/2026).
--
-- Ces colonnes existent deja EN LOCAL (box_scores.team_id,
-- box_scores_advanced.off_rating/def_rating/net_rating/pace dans nba.db) --
-- rien a extraire de nouveau depuis nba_api, juste a propager vers Supabase
-- (backfill_supabase.py / refresh_daily.py, prochaine etape).
--
-- team_id est l'equipe DU JOUEUR pour cette ligne (a distinguer de
-- opponent_team_id, deja present). off_rating/def_rating/net_rating/pace
-- sont ici au grain JOUEUR (comme dans box_scores_advanced local) --
-- l'agregation au grain EQUIPE (moyenne par game_id/team_id, meme patron
-- que build_team_games() dans build_features.py) se fait a la lecture,
-- pas stockee ici.

alter table stats_box_scores
  add column team_id integer references stats_equipes (team_id),
  add column off_rating numeric,
  add column def_rating numeric,
  add column net_rating numeric,
  add column pace numeric;

-- Contexte equipe roulant (pieces b) : agregation par (game_id, team_id)
-- triee par date, meme usage que l'index existant cote joueur.
create index stats_box_scores_team_date_idx
  on stats_box_scores (team_id, game_date desc);
