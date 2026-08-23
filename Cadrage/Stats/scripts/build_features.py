"""
Construit les variables prédictives (feature engineering) à partir de
Cadrage/Stats/data/nba.db, et les écrit dans deux nouvelles tables :

    features_equipe  -> une ligne par (match, équipe)
    features_joueur  -> une ligne par (match, joueur)

Règle absolue anti-fuite de données : chaque variable pour un match donné
n'utilise QUE l'historique strictement antérieur à ce match (shift(1) avant
tout calcul de moyenne glissante). Aucune variable ne doit dépendre du
résultat du match qu'elle sert à prédire.

Reconstruit entièrement les deux tables à chaque exécution, comme
load_to_sqlite.py — sûr à relancer à tout moment (y compris pendant que
l'extraction continue : les matchs pas encore complets sont simplement
absents des tables de features tant qu'ils manquent de données).

Usage:
    python build_features.py
"""

import sqlite3
from pathlib import Path

import numpy as np
import pandas as pd

SCRIPT_DIR = Path(__file__).resolve().parent
DB_PATH = SCRIPT_DIR.parent / "data" / "nba.db"

ROLLING_WINDOWS = [5, 10]

# Part of la saison N-1 des minutes d'une équipe (par joueur, cumulé par ordre
# décroissant) qui définit son "coeur d'effectif" — seuil de rotation usuel,
# pas une valeur mesurée. Décidé le 19/08/2026 avec l'utilisateur : voir
# projet-data-nba.md §7.
CORE_MINUTES_SHARE = 0.70


def minutes_to_float(m):
    if pd.isna(m) or m in ("", "0"):
        return 0.0
    m = str(m)
    if ":" in m:
        mins, secs = m.split(":")
        return float(mins) + float(secs) / 60
    try:
        return float(m)
    except ValueError:
        return np.nan

TEAM_SCHEMA = """
CREATE TABLE features_equipe (
    game_id TEXT,
    team_id INTEGER,
    opponent_team_id INTEGER,
    game_date TEXT,
    season TEXT,
    is_home INTEGER,
    win INTEGER,
    rest_days INTEGER,
    is_back_to_back INTEGER,
    games_played_season_avant INTEGER,
    pts_pour_moy5 REAL, pts_pour_moy10 REAL,
    pts_contre_moy5 REAL, pts_contre_moy10 REAL,
    reb_pour_moy5 REAL, reb_pour_moy10 REAL,
    reb_contre_moy5 REAL, reb_contre_moy10 REAL,
    ast_pour_moy5 REAL, ast_pour_moy10 REAL,
    ast_contre_moy5 REAL, ast_contre_moy10 REAL,
    fg3m_pour_moy5 REAL, fg3m_pour_moy10 REAL,
    fg3m_contre_moy5 REAL, fg3m_contre_moy10 REAL,
    stl_pour_moy5 REAL, stl_pour_moy10 REAL,
    stl_contre_moy5 REAL, stl_contre_moy10 REAL,
    blk_pour_moy5 REAL, blk_pour_moy10 REAL,
    blk_contre_moy5 REAL, blk_contre_moy10 REAL,
    oreb_pour_moy5 REAL, oreb_pour_moy10 REAL,
    oreb_contre_moy5 REAL, oreb_contre_moy10 REAL,
    victoires_pct_moy5 REAL, victoires_pct_moy10 REAL,
    off_rating_moy5 REAL, off_rating_moy10 REAL,
    def_rating_moy5 REAL, def_rating_moy10 REAL,
    net_rating_moy5 REAL, net_rating_moy10 REAL,
    pace_moy5 REAL, pace_moy10 REAL,
    victoires_pct_domicile_saison REAL,
    victoires_pct_exterieur_saison REAL,
    confrontations_directes_nb INTEGER,
    confrontations_directes_victoires_pct REAL,
    confrontations_directes_ecart_moy REAL,
    continuite_effectif_saison REAL,
    PRIMARY KEY (game_id, team_id)
);
"""

PLAYER_SCHEMA = """
CREATE TABLE features_joueur (
    game_id TEXT,
    player_id INTEGER,
    team_id INTEGER,
    opponent_team_id INTEGER,
    game_date TEXT,
    season TEXT,
    is_home INTEGER,
    rest_days INTEGER,
    is_back_to_back INTEGER,
    games_played_season_avant INTEGER,
    min_moy5 REAL, min_moy10 REAL, min_ecarttype10 REAL,
    pts_moy5 REAL, pts_moy10 REAL, pts_ecarttype10 REAL,
    reb_moy5 REAL, reb_moy10 REAL, reb_ecarttype10 REAL,
    ast_moy5 REAL, ast_moy10 REAL, ast_ecarttype10 REAL,
    fg3m_moy5 REAL, fg3m_moy10 REAL, fg3m_ecarttype10 REAL,
    stl_moy5 REAL, stl_moy10 REAL, stl_ecarttype10 REAL,
    blk_moy5 REAL, blk_moy10 REAL, blk_ecarttype10 REAL,
    oreb_moy5 REAL, oreb_moy10 REAL, oreb_ecarttype10 REAL,
    ts_pct_moy5 REAL, ts_pct_moy10 REAL,
    usg_pct_moy5 REAL, usg_pct_moy10 REAL,
    plus_minus_moy5 REAL, plus_minus_moy10 REAL,
    vs_adversaire_pts_moy REAL,
    vs_adversaire_nb_matchs INTEGER,
    matchs_manques_depuis_dernier INTEGER,
    fta_moy5 REAL, fta_moy10 REAL,
    ftm_sum10 REAL, fta_sum10 REAL,
    fga_moy5 REAL, fga_moy10 REAL, fga_ecarttype10 REAL,
    fgm_sum10 REAL, fga_sum10 REAL,
    fg3a_moy5 REAL, fg3a_moy10 REAL, fg3a_ecarttype10 REAL,
    fg3m_sum10 REAL, fg3a_sum10 REAL,
    PRIMARY KEY (game_id, player_id)
);
"""


def shifted_rolling_mean(series: pd.Series, window: int) -> pd.Series:
    return series.shift(1).rolling(window, min_periods=1).mean()


def shifted_rolling_std(series: pd.Series, window: int) -> pd.Series:
    return series.shift(1).rolling(window, min_periods=2).std()


def shifted_rolling_sum(series: pd.Series, window: int) -> pd.Series:
    return series.shift(1).rolling(window, min_periods=1).sum()


def compute_roster_continuity(conn: sqlite3.Connection) -> pd.DataFrame:
    """
    1 ligne par (game_id, team_id) : continuite_effectif_saison = part des
    minutes jouées CETTE saison, avant ce match (shift(1) + cumsum, même
    principe anti-fuite que le reste), par des joueurs qui faisaient déjà
    partie du "coeur d'effectif" (CORE_MINUTES_SHARE des minutes totales,
    par ordre décroissant) de la MÊME équipe la saison précédente.

    NaN pour la toute 1ère saison connue (pas de saison antérieure dans les
    données récupérées) et pour le 1er match d'une équipe cette saison
    (aucune minute encore jouée pour mesurer la continuité).
    """
    box = pd.read_sql(
        "SELECT b.game_id, b.player_id, b.team_id, b.minutes, m.season, m.game_date "
        "FROM box_scores b JOIN matchs m ON b.game_id = m.game_id",
        conn, dtype={"game_id": str},
    )
    box["minutes_f"] = box["minutes"].apply(minutes_to_float)

    season_player = box.groupby(["season", "team_id", "player_id"], as_index=False)["minutes_f"].sum()
    core_sets: dict = {}
    for (season, team_id), grp in season_player.groupby(["season", "team_id"]):
        grp = grp.sort_values("minutes_f", ascending=False)
        total = grp["minutes_f"].sum()
        if total <= 0:
            core_sets[(season, team_id)] = set()
            continue
        cum_share = grp["minutes_f"].cumsum() / total
        cutoff = int((cum_share < CORE_MINUTES_SHARE).sum()) + 1  # inclut le joueur qui franchit le seuil
        core_sets[(season, team_id)] = set(grp["player_id"].iloc[:cutoff])

    seasons_sorted = sorted(season_player["season"].unique())
    prior_season = {s: seasons_sorted[i - 1] for i, s in enumerate(seasons_sorted) if i > 0}

    box["is_core"] = [
        pid in core_sets.get((prior_season.get(season), team_id), set())
        for pid, season, team_id in zip(box["player_id"], box["season"], box["team_id"])
    ]
    box["core_minutes_f"] = np.where(box["is_core"], box["minutes_f"], 0.0)

    per_game = box.groupby(["season", "team_id", "game_id", "game_date"], as_index=False).agg(
        total_minutes=("minutes_f", "sum"), core_minutes=("core_minutes_f", "sum")
    )
    per_game["game_date"] = pd.to_datetime(per_game["game_date"])
    per_game = per_game.sort_values(["team_id", "season", "game_date"]).reset_index(drop=True)

    g = per_game.groupby(["team_id", "season"], group_keys=False)
    cum_total = g["total_minutes"].transform(lambda s: s.shift(1).cumsum())
    cum_core = g["core_minutes"].transform(lambda s: s.shift(1).cumsum())
    per_game["continuite_effectif_saison"] = cum_core / cum_total
    per_game.loc[~per_game["season"].isin(prior_season.keys()), "continuite_effectif_saison"] = np.nan

    return per_game[["game_id", "team_id", "continuite_effectif_saison"]]


# Stats d'equipe "comptees" agregees ici (23/08/2026, chantier paris equipe
# piece (a) suite) -- TOUTES selon le MEME patron que "pts" (deja en place
# avant ce chantier) : somme par equipe/match, PUIS le meme swap
# team_id<->opponent_team_id pour obtenir la version "encaissee" (feature
# predictive au meme titre que opp_pts). "reb" ajoute en 1er (piece (a)
# suite, rebonds), ast/fg3m/stl/blk ajoutes dans la foulee, meme geste --
# toutes deja presentes dans box_scores, rien de nouveau a extraire.
# "oreb" ajoutee le 23/08/2026 (extension "faciles",
# types_de_paris_playoffs_2026.md, categorie "Rebonds offensifs equipe" --
# forme combinee, ex. "total des rebonds offensifs cumules des Pistons et
# des Cavaliers superieur a 25").
TEAM_COUNTING_STATS = ["pts", "reb", "ast", "fg3m", "stl", "blk", "oreb"]


def build_team_games(conn: sqlite3.Connection) -> pd.DataFrame:
    cols = ", ".join(TEAM_COUNTING_STATS)
    box_scores = pd.read_sql(f"SELECT game_id, team_id, {cols} FROM box_scores", conn, dtype={"game_id": str})
    own_rename = {"pts": "team_pts", **{s: f"team_{s}" for s in TEAM_COUNTING_STATS if s != "pts"}}
    team_totals = box_scores.groupby(["game_id", "team_id"], as_index=False)[TEAM_COUNTING_STATS].sum().rename(
        columns=own_rename
    )

    opp_rename = {"team_id": "opponent_team_id", **{f"team_{s}": f"opp_{s}" for s in TEAM_COUNTING_STATS}}
    opp_totals = team_totals.rename(columns=opp_rename)
    team_games = team_totals.merge(opp_totals, on="game_id")
    team_games = team_games[team_games["team_id"] != team_games["opponent_team_id"]].copy()

    matchs = pd.read_sql(
        "SELECT game_id, game_date, season, home_team_id FROM matchs", conn, dtype={"game_id": str}
    )
    team_games = team_games.merge(matchs, on="game_id", how="left")
    team_games["is_home"] = np.where(
        team_games["home_team_id"].isna(), np.nan, (team_games["team_id"] == team_games["home_team_id"]).astype(float)
    )
    team_games["win"] = (team_games["team_pts"] > team_games["opp_pts"]).astype(int)
    team_games["game_date"] = pd.to_datetime(team_games["game_date"])

    box_adv = pd.read_sql(
        "SELECT game_id, team_id, off_rating, def_rating, net_rating, pace FROM box_scores_advanced", conn,
        dtype={"game_id": str},
    )
    team_adv = box_adv.groupby(["game_id", "team_id"], as_index=False)[
        ["off_rating", "def_rating", "net_rating", "pace"]
    ].mean()
    team_games = team_games.merge(team_adv, on=["game_id", "team_id"], how="left")

    continuity = compute_roster_continuity(conn)
    team_games = team_games.merge(continuity, on=["game_id", "team_id"], how="left")

    team_games = team_games.sort_values(["team_id", "game_date"]).reset_index(drop=True)
    return team_games


def add_team_rolling_features(team_games: pd.DataFrame) -> pd.DataFrame:
    df = team_games.copy()
    g = df.groupby("team_id", group_keys=False)

    df["rest_days"] = g["game_date"].transform(lambda s: s.diff().dt.days)
    df["is_back_to_back"] = (df["rest_days"] == 1).astype("Int64")
    df["games_played_season_avant"] = df.groupby(["team_id", "season"]).cumcount()

    for window in ROLLING_WINDOWS:
        # {stat}_pour/{stat}_contre pour TOUTES les stats comptees d'equipe
        # (23/08/2026, paris equipe piece (a) suite -- pts deja la avant ce
        # chantier, reb/ast/fg3m/stl/blk generalisees dans la foulee, meme
        # patron).
        for stat in TEAM_COUNTING_STATS:
            df[f"{stat}_pour_moy{window}"] = g[f"team_{stat}"].transform(lambda s, w=window: shifted_rolling_mean(s, w))
            df[f"{stat}_contre_moy{window}"] = g[f"opp_{stat}"].transform(lambda s, w=window: shifted_rolling_mean(s, w))
        df[f"victoires_pct_moy{window}"] = g["win"].transform(lambda s, w=window: shifted_rolling_mean(s, w))
        df[f"off_rating_moy{window}"] = g["off_rating"].transform(lambda s, w=window: shifted_rolling_mean(s, w))
        df[f"def_rating_moy{window}"] = g["def_rating"].transform(lambda s, w=window: shifted_rolling_mean(s, w))
        df[f"net_rating_moy{window}"] = g["net_rating"].transform(lambda s, w=window: shifted_rolling_mean(s, w))
        df[f"pace_moy{window}"] = g["pace"].transform(lambda s, w=window: shifted_rolling_mean(s, w))

    df["victoires_pct_domicile_saison"] = df.groupby(["team_id", "season", "is_home"])["win"].transform(
        lambda s: s.shift(1).expanding().mean()
    )
    df.loc[df["is_home"] != 1, "victoires_pct_domicile_saison"] = np.nan
    home_col = df["victoires_pct_domicile_saison"].copy()

    away_expand = df.groupby(["team_id", "season", "is_home"])["win"].transform(lambda s: s.shift(1).expanding().mean())
    df["victoires_pct_exterieur_saison"] = np.where(df["is_home"] == 0, away_expand, np.nan)
    df["victoires_pct_domicile_saison"] = np.where(df["is_home"] == 1, home_col, np.nan)

    h2h = df.groupby(["team_id", "opponent_team_id"], group_keys=False)
    df["confrontations_directes_nb"] = h2h.cumcount()
    df["confrontations_directes_victoires_pct"] = h2h["win"].transform(lambda s: s.shift(1).expanding().mean())
    df["margin"] = df["team_pts"] - df["opp_pts"]
    df["confrontations_directes_ecart_moy"] = h2h["margin"].transform(lambda s: s.shift(1).expanding().mean())

    return df


def compute_missed_games(conn: sqlite3.Connection) -> pd.DataFrame:
    """
    1 ligne par (game_id, player_id) : matchs_manques_depuis_dernier = nombre
    de matchs de SON ÉQUIPE joués strictement ENTRE l'apparition précédente
    du joueur (dernier match où il a une ligne dans box_scores, peu importe
    la raison de son absence les autres fois : blessure, suspension, DNP...)
    et le match courant. 0 si apparitions consécutives (aucun match manqué),
    NaN pour la toute 1ère apparition connue du joueur (pas d'apparition
    précédente à comparer).

    Limite connue : utilise le calendrier de l'équipe du match COURANT ; en
    cas de trade pendant l'absence, le calendrier de la nouvelle équipe n'est
    pas exactement celui vécu par le joueur pendant son absence — cas limite
    non traité spécifiquement (rare, pas de correction dédiée).
    """
    player_games = pd.read_sql(
        "SELECT b.game_id, b.player_id, b.team_id, m.game_date FROM box_scores b "
        "JOIN matchs m ON m.game_id = b.game_id",
        conn, dtype={"game_id": str},
    )
    player_games["game_date"] = pd.to_datetime(player_games["game_date"])
    player_games = player_games.sort_values(["player_id", "game_date"]).reset_index(drop=True)
    player_games["prev_game_date"] = player_games.groupby("player_id")["game_date"].shift(1)

    team_games = pd.read_sql(
        "SELECT DISTINCT game_id, team_id FROM box_scores", conn, dtype={"game_id": str}
    ).merge(
        pd.read_sql("SELECT game_id, game_date FROM matchs", conn, dtype={"game_id": str}),
        on="game_id",
    )
    team_games["game_date"] = pd.to_datetime(team_games["game_date"])
    team_dates = {team_id: np.sort(grp["game_date"].to_numpy()) for team_id, grp in team_games.groupby("team_id")}

    def count_missed(row):
        if pd.isna(row["prev_game_date"]):
            return np.nan
        dates = team_dates.get(row["team_id"])
        if dates is None or len(dates) == 0:
            return np.nan
        lo = np.searchsorted(dates, np.datetime64(row["prev_game_date"]), side="right")
        hi = np.searchsorted(dates, np.datetime64(row["game_date"]), side="left")
        return max(int(hi - lo), 0)

    player_games["matchs_manques_depuis_dernier"] = player_games.apply(count_missed, axis=1)
    return player_games[["game_id", "player_id", "matchs_manques_depuis_dernier"]]


def build_player_games(conn: sqlite3.Connection, team_context: pd.DataFrame) -> pd.DataFrame:
    box_scores = pd.read_sql(
        "SELECT game_id, player_id, team_id, minutes, pts, reb, ast, fg3m, stl, blk, plus_minus, "
        "ftm, fta, fgm, fga, fg3a, oreb FROM box_scores",
        conn, dtype={"game_id": str},
    )
    box_adv = pd.read_sql(
        "SELECT game_id, player_id, ts_pct, usg_pct FROM box_scores_advanced", conn, dtype={"game_id": str}
    )

    box_scores["minutes_f"] = box_scores["minutes"].apply(minutes_to_float)

    players = box_scores.merge(box_adv, on=["game_id", "player_id"], how="left")

    ctx = team_context[["game_id", "team_id", "opponent_team_id", "game_date", "season", "is_home", "rest_days"]]
    players = players.merge(ctx, on=["game_id", "team_id"], how="left")

    missed = compute_missed_games(conn)
    players = players.merge(missed, on=["game_id", "player_id"], how="left")

    players = players.sort_values(["player_id", "game_date"]).reset_index(drop=True)
    return players


def add_player_rolling_features(players: pd.DataFrame) -> pd.DataFrame:
    df = players.copy()
    g = df.groupby("player_id", group_keys=False)

    df["is_back_to_back"] = (df["rest_days"] == 1).astype("Int64")
    df["games_played_season_avant"] = df.groupby(["player_id", "season"]).cumcount()

    for window in ROLLING_WINDOWS:
        df[f"min_moy{window}"] = g["minutes_f"].transform(lambda s, w=window: shifted_rolling_mean(s, w))
        df[f"pts_moy{window}"] = g["pts"].transform(lambda s, w=window: shifted_rolling_mean(s, w))
        df[f"reb_moy{window}"] = g["reb"].transform(lambda s, w=window: shifted_rolling_mean(s, w))
        df[f"ast_moy{window}"] = g["ast"].transform(lambda s, w=window: shifted_rolling_mean(s, w))
        df[f"fg3m_moy{window}"] = g["fg3m"].transform(lambda s, w=window: shifted_rolling_mean(s, w))
        df[f"stl_moy{window}"] = g["stl"].transform(lambda s, w=window: shifted_rolling_mean(s, w))
        df[f"blk_moy{window}"] = g["blk"].transform(lambda s, w=window: shifted_rolling_mean(s, w))
        df[f"oreb_moy{window}"] = g["oreb"].transform(lambda s, w=window: shifted_rolling_mean(s, w))
        df[f"ts_pct_moy{window}"] = g["ts_pct"].transform(lambda s, w=window: shifted_rolling_mean(s, w))
        df[f"usg_pct_moy{window}"] = g["usg_pct"].transform(lambda s, w=window: shifted_rolling_mean(s, w))
        df[f"plus_minus_moy{window}"] = g["plus_minus"].transform(lambda s, w=window: shifted_rolling_mean(s, w))
        df[f"fta_moy{window}"] = g["fta"].transform(lambda s, w=window: shifted_rolling_mean(s, w))
        df[f"fga_moy{window}"] = g["fga"].transform(lambda s, w=window: shifted_rolling_mean(s, w))
        df[f"fg3a_moy{window}"] = g["fg3a"].transform(lambda s, w=window: shifted_rolling_mean(s, w))

    # "fga"/"fg3a" ajoutees le 23/08/2026 (extension "faciles",
    # types_de_paris_playoffs_2026.md, categorie "Tentatives joueur") --
    # moy5/moy10 deja calculees ci-dessus (pour les modeles de %), seul
    # l'ecart-type manquait pour en faire des stats a seuil pariables
    # directement ("tente plus de 7 tirs a 3 points").
    ecarttype_cols = {
        "pts": "pts", "reb": "reb", "ast": "ast", "fg3m": "fg3m", "stl": "stl", "blk": "blk", "min": "minutes_f",
        "fga": "fga", "fg3a": "fg3a", "oreb": "oreb",
    }
    for prefix, col in ecarttype_cols.items():
        df[f"{prefix}_ecarttype10"] = g[col].transform(lambda s: shifted_rolling_std(s, 10))

    # Sommes BRUTES (pas un ratio déjà calculé) des réussites/tentatives sur
    # les 10 derniers matchs, pour les 3 stats de taux (FT% validé §18, FG%/
    # 3P% généralisés dans la foulée) — laissées à train_pct_model.py, qui en
    # dérive un taux pondéré par rétrécissement bayésien (Beta-Binomial) :
    # impossible à partir d'un ratio déjà calculé (perd l'info du nombre de
    # tentatives sous-jacent, nécessaire pour savoir de combien rétrécir vers
    # la moyenne ligue). shift(1) déjà appliqué par shifted_rolling_sum, même
    # anti-fuite que le reste. Une seule fenêtre (10, pas 5) par stat :
    # contrairement aux stats comptées, la fiabilité d'un TAUX vient du
    # nombre de tentatives cumulées, pas de deux horizons à comparer.
    for makes_col, attempts_col in (("ftm", "fta"), ("fgm", "fga"), ("fg3m", "fg3a")):
        df[f"{makes_col}_sum10"] = g[makes_col].transform(lambda s: shifted_rolling_sum(s, 10))
        df[f"{attempts_col}_sum10"] = g[attempts_col].transform(lambda s: shifted_rolling_sum(s, 10))

    vs_opp = df.groupby(["player_id", "opponent_team_id"], group_keys=False)
    df["vs_adversaire_pts_moy"] = vs_opp["pts"].transform(lambda s: s.shift(1).expanding().mean())
    df["vs_adversaire_nb_matchs"] = vs_opp.cumcount()

    return df


TEAM_TABLE_COLUMNS = [
    "game_id", "team_id", "opponent_team_id", "game_date", "season", "is_home", "win",
    "rest_days", "is_back_to_back", "games_played_season_avant",
    "pts_pour_moy5", "pts_pour_moy10", "pts_contre_moy5", "pts_contre_moy10",
    "reb_pour_moy5", "reb_pour_moy10", "reb_contre_moy5", "reb_contre_moy10",
    "ast_pour_moy5", "ast_pour_moy10", "ast_contre_moy5", "ast_contre_moy10",
    "fg3m_pour_moy5", "fg3m_pour_moy10", "fg3m_contre_moy5", "fg3m_contre_moy10",
    "stl_pour_moy5", "stl_pour_moy10", "stl_contre_moy5", "stl_contre_moy10",
    "blk_pour_moy5", "blk_pour_moy10", "blk_contre_moy5", "blk_contre_moy10",
    "oreb_pour_moy5", "oreb_pour_moy10", "oreb_contre_moy5", "oreb_contre_moy10",
    "victoires_pct_moy5", "victoires_pct_moy10",
    "off_rating_moy5", "off_rating_moy10", "def_rating_moy5", "def_rating_moy10",
    "net_rating_moy5", "net_rating_moy10", "pace_moy5", "pace_moy10",
    "victoires_pct_domicile_saison", "victoires_pct_exterieur_saison",
    "confrontations_directes_nb", "confrontations_directes_victoires_pct", "confrontations_directes_ecart_moy",
    "continuite_effectif_saison",
]

PLAYER_TABLE_COLUMNS = [
    "game_id", "player_id", "team_id", "opponent_team_id", "game_date", "season", "is_home",
    "rest_days", "is_back_to_back", "games_played_season_avant",
    "min_moy5", "min_moy10", "min_ecarttype10",
    "pts_moy5", "pts_moy10", "pts_ecarttype10",
    "reb_moy5", "reb_moy10", "reb_ecarttype10",
    "ast_moy5", "ast_moy10", "ast_ecarttype10",
    "fg3m_moy5", "fg3m_moy10", "fg3m_ecarttype10",
    "stl_moy5", "stl_moy10", "stl_ecarttype10",
    "blk_moy5", "blk_moy10", "blk_ecarttype10",
    "oreb_moy5", "oreb_moy10", "oreb_ecarttype10",
    "ts_pct_moy5", "ts_pct_moy10", "usg_pct_moy5", "usg_pct_moy10",
    "plus_minus_moy5", "plus_minus_moy10",
    "vs_adversaire_pts_moy", "vs_adversaire_nb_matchs",
    "matchs_manques_depuis_dernier",
    "fta_moy5", "fta_moy10",
    "ftm_sum10", "fta_sum10",
    "fga_moy5", "fga_moy10", "fga_ecarttype10",
    "fgm_sum10", "fga_sum10",
    "fg3a_moy5", "fg3a_moy10", "fg3a_ecarttype10",
    "fg3m_sum10", "fg3a_sum10",
]


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.executescript("DROP TABLE IF EXISTS features_equipe; DROP TABLE IF EXISTS features_joueur;")
    cur.executescript(TEAM_SCHEMA)
    cur.executescript(PLAYER_SCHEMA)
    conn.commit()

    team_games = build_team_games(conn)
    team_features = add_team_rolling_features(team_games)

    player_games = build_player_games(conn, team_features)
    player_features = add_player_rolling_features(player_games)

    team_features["game_date"] = team_features["game_date"].dt.strftime("%Y-%m-%d")
    team_features[TEAM_TABLE_COLUMNS].to_sql("features_equipe", conn, if_exists="append", index=False)

    player_features["game_date"] = player_features["game_date"].dt.strftime("%Y-%m-%d")
    player_features[PLAYER_TABLE_COLUMNS].to_sql("features_joueur", conn, if_exists="append", index=False)

    conn.commit()

    n_team = cur.execute("SELECT COUNT(*) FROM features_equipe").fetchone()[0]
    n_player = cur.execute("SELECT COUNT(*) FROM features_joueur").fetchone()[0]
    conn.close()

    print(f"features_equipe: {n_team} lignes")
    print(f"features_joueur: {n_player} lignes")


if __name__ == "__main__":
    main()
