"""
Charge les CSV extraits par fetch_nba_data.py (Cadrage/Stats/data/raw/) dans
une base SQLite unique (Cadrage/Stats/data/nba.db).

Reconstruit entièrement la base à chaque exécution — les CSV sont la source
de vérité, ça évite tout risque de désynchronisation. Durée : de quelques
secondes (2 saisons) à plusieurs minutes (5 saisons et plus, ~19 000
fichiers CSV) — dépend du volume dans data/raw/, pas une constante. Peut
être relancé à tout moment, y compris pendant que fetch_nba_data.py tourne
encore : les matchs pas encore récupérés seront simplement absents ou
incomplets, et réapparaîtront complets au prochain chargement.

Affiche l'avancement en continu (20/08/2026, ajouté après un cas réel où
le silence total pendant plusieurs minutes faisait croire à un blocage) :
lecture décomptée saison par saison, écriture décomptée table par table.
ATTENTION si interrompu (Ctrl+C) en cours de lecture : les tables sont
vidées en tout début d'exécution, l'écriture ne se fait qu'en un seul bloc
à la fin — une interruption avant "Écriture dans la base..." laisse la
base VIDE jusqu'à la prochaine exécution COMPLÈTE (pas de reprise
partielle possible ici, contrairement à fetch_nba_data.py).

Usage:
    python load_to_sqlite.py
"""

import sqlite3
import sys
from pathlib import Path

import pandas as pd

SCRIPT_DIR = Path(__file__).resolve().parent
RAW_DIR = SCRIPT_DIR.parent / "data" / "raw"
DB_PATH = SCRIPT_DIR.parent / "data" / "nba.db"

SCHEMA = """
CREATE TABLE equipes (
    team_id INTEGER PRIMARY KEY,
    tricode TEXT,
    city TEXT,
    name TEXT
);
CREATE TABLE joueurs (
    player_id INTEGER PRIMARY KEY,
    first_name TEXT,
    family_name TEXT,
    name_i TEXT
);
CREATE TABLE matchs (
    game_id TEXT PRIMARY KEY,
    game_date TEXT,
    season TEXT,
    season_type TEXT,
    home_team_id INTEGER,
    away_team_id INTEGER,
    home_score INTEGER,
    away_score INTEGER
);
CREATE TABLE box_scores (
    game_id TEXT,
    player_id INTEGER,
    team_id INTEGER,
    minutes TEXT,
    fgm REAL, fga REAL, fg_pct REAL,
    fg3m REAL, fg3a REAL, fg3_pct REAL,
    ftm REAL, fta REAL, ft_pct REAL,
    oreb REAL, dreb REAL, reb REAL,
    ast REAL, stl REAL, blk REAL, tov REAL, pf REAL,
    pts REAL, plus_minus REAL,
    PRIMARY KEY (game_id, player_id)
);
CREATE TABLE box_scores_advanced (
    game_id TEXT,
    player_id INTEGER,
    team_id INTEGER,
    off_rating REAL, def_rating REAL, net_rating REAL,
    ast_pct REAL, ast_to REAL, ast_ratio REAL,
    oreb_pct REAL, dreb_pct REAL, reb_pct REAL,
    tov_ratio REAL, efg_pct REAL, ts_pct REAL,
    usg_pct REAL, pace REAL, possessions REAL, pie REAL,
    PRIMARY KEY (game_id, player_id)
);
CREATE TABLE play_by_play (
    game_id TEXT,
    action_number INTEGER,
    period INTEGER,
    clock TEXT,
    team_id INTEGER,
    player_id INTEGER,
    location TEXT,
    action_type TEXT,
    sub_type TEXT,
    shot_result TEXT,
    shot_distance REAL,
    shot_value REAL,
    score_home INTEGER,
    score_away INTEGER,
    description TEXT,
    PRIMARY KEY (game_id, action_number)
);
CREATE INDEX idx_box_scores_player ON box_scores(player_id);
CREATE INDEX idx_box_scores_adv_player ON box_scores_advanced(player_id);
CREATE INDEX idx_pbp_game ON play_by_play(game_id);
"""

TRADITIONAL_COLUMNS = {
    "gameId": "game_id",
    "teamId": "team_id",
    "personId": "player_id",
    "firstName": "first_name",
    "familyName": "family_name",
    "nameI": "name_i",
    "minutes": "minutes",
    "fieldGoalsMade": "fgm",
    "fieldGoalsAttempted": "fga",
    "fieldGoalsPercentage": "fg_pct",
    "threePointersMade": "fg3m",
    "threePointersAttempted": "fg3a",
    "threePointersPercentage": "fg3_pct",
    "freeThrowsMade": "ftm",
    "freeThrowsAttempted": "fta",
    "freeThrowsPercentage": "ft_pct",
    "reboundsOffensive": "oreb",
    "reboundsDefensive": "dreb",
    "reboundsTotal": "reb",
    "assists": "ast",
    "steals": "stl",
    "blocks": "blk",
    "turnovers": "tov",
    "foulsPersonal": "pf",
    "points": "pts",
    "plusMinusPoints": "plus_minus",
}

ADVANCED_COLUMNS = {
    "gameId": "game_id",
    "teamId": "team_id",
    "personId": "player_id",
    "offensiveRating": "off_rating",
    "defensiveRating": "def_rating",
    "netRating": "net_rating",
    "assistPercentage": "ast_pct",
    "assistToTurnover": "ast_to",
    "assistRatio": "ast_ratio",
    "offensiveReboundPercentage": "oreb_pct",
    "defensiveReboundPercentage": "dreb_pct",
    "reboundPercentage": "reb_pct",
    "turnoverRatio": "tov_ratio",
    "effectiveFieldGoalPercentage": "efg_pct",
    "trueShootingPercentage": "ts_pct",
    "usagePercentage": "usg_pct",
    "pace": "pace",
    "possessions": "possessions",
    "PIE": "pie",
}

BOX_SCORE_TABLE_COLUMNS = [
    "game_id", "player_id", "team_id", "minutes",
    "fgm", "fga", "fg_pct", "fg3m", "fg3a", "fg3_pct", "ftm", "fta", "ft_pct",
    "oreb", "dreb", "reb", "ast", "stl", "blk", "tov", "pf", "pts", "plus_minus",
]

BOX_SCORE_ADVANCED_TABLE_COLUMNS = [
    "game_id", "player_id", "team_id",
    "off_rating", "def_rating", "net_rating", "ast_pct", "ast_to", "ast_ratio",
    "oreb_pct", "dreb_pct", "reb_pct", "tov_ratio", "efg_pct", "ts_pct",
    "usg_pct", "pace", "possessions", "pie",
]

PBP_COLUMNS = {
    "gameId": "game_id",
    "actionNumber": "action_number",
    "period": "period",
    "clock": "clock",
    "teamId": "team_id",
    "personId": "player_id",
    "location": "location",
    "actionType": "action_type",
    "subType": "sub_type",
    "shotResult": "shot_result",
    "shotDistance": "shot_distance",
    "shotValue": "shot_value",
    "scoreHome": "score_home",
    "scoreAway": "score_away",
    "description": "description",
}


def season_dirs():
    return sorted(d for d in RAW_DIR.iterdir() if d.is_dir())


def load_equipes_joueurs(df: pd.DataFrame, equipes: dict, joueurs: dict) -> None:
    for _, row in df.drop_duplicates("teamId").iterrows():
        equipes[row["teamId"]] = {
            "team_id": row["teamId"],
            "tricode": row["teamTricode"],
            "city": row["teamCity"],
            "name": row["teamName"],
        }
    for _, row in df.drop_duplicates("personId").iterrows():
        if not row["personId"]:
            continue
        joueurs[row["personId"]] = {
            "player_id": row["personId"],
            "first_name": row["firstName"],
            "family_name": row["familyName"],
            "name_i": row["nameI"],
        }


def build_matchs_row(game_id: str, game_meta: dict, pbp_df: pd.DataFrame | None) -> dict:
    row = {
        "game_id": game_id,
        "game_date": game_meta.get("GAME_DATE"),
        "season": game_meta.get("SEASON"),
        "season_type": game_meta.get("SEASON_TYPE"),
        "home_team_id": None,
        "away_team_id": None,
        "home_score": None,
        "away_score": None,
    }
    if pbp_df is None or pbp_df.empty:
        return row

    team_events = pbp_df[pbp_df["teamId"].fillna(0) != 0]
    home_ids = team_events.loc[team_events["location"] == "h", "teamId"].unique()
    away_ids = team_events.loc[team_events["location"] == "v", "teamId"].unique()
    if len(home_ids) == 1 and len(away_ids) == 1:
        row["home_team_id"] = int(home_ids[0])
        row["away_team_id"] = int(away_ids[0])

    scored = pbp_df.dropna(subset=["scoreHome", "scoreAway"])
    if not scored.empty:
        last = scored.iloc[-1]
        row["home_score"] = int(last["scoreHome"])
        row["away_score"] = int(last["scoreAway"])

    return row


PROGRESS_EVERY = 200  # affichage d'avancement toutes les N parties lues


def main():
    # print() est mis en mémoire tampon PAR BLOC (pas ligne par ligne) dès que
    # la sortie standard n'est pas un vrai terminal (redirection, capture par
    # un outil...) — l'avancement ci-dessous n'apparaîtrait sinon qu'à la
    # toute fin, exactement le problème qu'il est censé résoudre. encoding
    # forcé en UTF-8 en même temps : le codepage par défaut de PowerShell/
    # cmd.exe rendait "É"/"é" en "�" (accents capitaux surtout), constaté au
    # 1er essai réel du 20/08/2026.
    sys.stdout.reconfigure(line_buffering=True, encoding="utf-8")

    if not RAW_DIR.exists():
        raise SystemExit(f"Dossier introuvable: {RAW_DIR} (as-tu lancé fetch_nba_data.py ?)")

    print(f"Lecture de {RAW_DIR}...")

    # timeout=120 (au lieu des 5s par défaut de sqlite3) : si une AUTRE
    # exécution de ce script tient déjà le verrou d'écriture (2 lancements
    # accidentels en même temps — cas réel du 20/08/2026), la connexion
    # ATTEND que l'autre finisse au lieu d'échouer immédiatement avec
    # "database is locked". N'empêche pas de lancer 2 fois par erreur, rend
    # juste l'échec impossible dans ce cas précis (l'un des deux attend,
    # l'autre écrit) plutôt qu'un plantage confus pour l'utilisateur.
    conn = sqlite3.connect(DB_PATH, timeout=120)
    cur = conn.cursor()
    cur.executescript("DROP TABLE IF EXISTS equipes; DROP TABLE IF EXISTS joueurs; "
                       "DROP TABLE IF EXISTS matchs; DROP TABLE IF EXISTS box_scores; "
                       "DROP TABLE IF EXISTS box_scores_advanced; DROP TABLE IF EXISTS play_by_play;")
    cur.executescript(SCHEMA)
    conn.commit()

    equipes: dict = {}
    joueurs: dict = {}
    matchs_rows: list = []
    box_frames: list = []
    box_adv_frames: list = []
    pbp_frames: list = []

    # Tables vidées au-dessus, avant d'avoir rien lu : si le script est
    # interrompu (Ctrl+C) pendant cette boucle, la base reste VIDE jusqu'à
    # la prochaine exécution complète — écriture (plus bas) faite en un seul
    # bloc à la fin, pas incrémentale. Relancer jusqu'au bout après une
    # interruption, ne pas s'arrêter à mi-chemin.
    for season_dir in season_dirs():
        index_path = season_dir / "games_index.csv"
        if not index_path.exists():
            continue
        index_df = pd.read_csv(index_path, dtype={"GAME_ID": str})
        index_by_id = {row["GAME_ID"]: row for _, row in index_df.iterrows()}
        print(f"  {season_dir.name} : {len(index_by_id)} matchs")

        box_dir = season_dir / "boxscores"
        box_adv_dir = season_dir / "boxscores_advanced"
        pbp_dir = season_dir / "playbyplay"

        for i, (game_id, meta) in enumerate(index_by_id.items(), start=1):
            box_path = box_dir / f"{game_id}.csv"
            box_adv_path = box_adv_dir / f"{game_id}.csv"
            pbp_path = pbp_dir / f"{game_id}.csv"

            pbp_df = None
            if pbp_path.exists():
                pbp_df = pd.read_csv(pbp_path, dtype={"gameId": str}).drop_duplicates(subset=["actionNumber"])
                pbp_frames.append(pbp_df.rename(columns=PBP_COLUMNS)[list(PBP_COLUMNS.values())])

            matchs_rows.append(build_matchs_row(game_id, meta, pbp_df))

            if box_path.exists():
                df = pd.read_csv(box_path, dtype={"gameId": str}).drop_duplicates(subset=["personId"])
                load_equipes_joueurs(df, equipes, joueurs)
                # `minutes` NULL = joueur non entré en jeu (DNP/DND/NWT, colonne
                # `comment` de l'API) — l'API renvoie une ligne pour tout le
                # roster, y compris ceux qui n'ont pas joué (points/stats à 0,
                # pas une vraie apparition) ; on les exclut, sinon ils polluent
                # les moyennes glissantes ET les labels d'entraînement avec de
                # faux "0 points" (trouvé le 20/08/2026, ~19% des lignes).
                df = df[df["minutes"].notna()]
                box_frames.append(df.rename(columns=TRADITIONAL_COLUMNS)[BOX_SCORE_TABLE_COLUMNS])

            if box_adv_path.exists():
                df = pd.read_csv(box_adv_path, dtype={"gameId": str}).drop_duplicates(subset=["personId"])
                load_equipes_joueurs(df, equipes, joueurs)
                df = df[df["minutes"].notna()]  # même filtre DNP/DND que le traditionnel ci-dessus
                box_adv_frames.append(df.rename(columns=ADVANCED_COLUMNS)[BOX_SCORE_ADVANCED_TABLE_COLUMNS])

            if i % PROGRESS_EVERY == 0 or i == len(index_by_id):
                print(f"    ... {i}/{len(index_by_id)} matchs lus")

    print("Écriture dans la base...")
    if equipes:
        print(f"  equipes ({len(equipes)} lignes)")
        pd.DataFrame(equipes.values()).to_sql("equipes", conn, if_exists="append", index=False)
    if joueurs:
        print(f"  joueurs ({len(joueurs)} lignes)")
        pd.DataFrame(joueurs.values()).to_sql("joueurs", conn, if_exists="append", index=False)
    if matchs_rows:
        print(f"  matchs ({len(matchs_rows)} lignes)")
        pd.DataFrame(matchs_rows).to_sql("matchs", conn, if_exists="append", index=False)
    if box_frames:
        box_df = pd.concat(box_frames, ignore_index=True)
        print(f"  box_scores ({len(box_df)} lignes)")
        box_df.to_sql("box_scores", conn, if_exists="append", index=False)
    if box_adv_frames:
        box_adv_df = pd.concat(box_adv_frames, ignore_index=True)
        print(f"  box_scores_advanced ({len(box_adv_df)} lignes)")
        box_adv_df.to_sql("box_scores_advanced", conn, if_exists="append", index=False)
    if pbp_frames:
        pbp_df_all = pd.concat(pbp_frames, ignore_index=True)
        print(f"  play_by_play ({len(pbp_df_all)} lignes) -- la plus longue, patience")
        pbp_df_all.to_sql("play_by_play", conn, if_exists="append", index=False)

    conn.commit()

    counts = {}
    for table in ["equipes", "joueurs", "matchs", "box_scores", "box_scores_advanced", "play_by_play"]:
        counts[table] = cur.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    conn.close()

    print(f"Base créée: {DB_PATH}")
    for table, n in counts.items():
        print(f"  {table}: {n} lignes")


if __name__ == "__main__":
    main()
