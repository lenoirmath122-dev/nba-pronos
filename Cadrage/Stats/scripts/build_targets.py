"""
Construit les tables "cibles" (labels réels + assemblage niveau match) par-
dessus features_equipe/features_joueur, pour les 3 catégories d'événements
prioritaires identifiées dans la taxonomie réelle des paris persos
(projet-data-nba.md §8) :

    labels_joueur      -> pts/reb/ast/fg3m/stl/blk/minutes réels +
                           double-double/triple-double, 1 ligne par
                           (match, joueur). Couvre toutes les stats seuil
                           joueur identifiées dans le classeur (§8/§14 de
                           projet-data-nba.md, audit du 20/08/2026 : minutes
                           jouées et contres/interceptions ajoutés à cette
                           occasion, précédemment oubliés). Valeurs BRUTES
                           (pas de seuil figé dedans) : le choix du seuil
                           (ex: pts > 20.5) se fait au moment d'entraîner/
                           interroger le modèle, pas ici.
                           ftm/fta (20/08/2026, §18) puis fgm/fga/fg3a
                           (§18, généralisé) : tentatives ET réussites de
                           lancers francs/tirs au panier/3-points, BRUTES
                           elles aussi — pas de FT%/FG%/3P% stocké ici,
                           c'est {m}/{a} qui portent l'info, le taux se
                           calcule à la volée (division par zéro si a=0, un
                           soir sans tentative n'a pas de %). fg3m déjà
                           présent depuis le 1er passage (§15, cible seule
                           du nombre de 3-points réussis) — fg3a s'y ajoute
                           pour permettre 3P%.
    entrainement_matchs -> 1 ligne par match, features_equipe dupliquées
                           home_*/away_*, + labels home_win/ecart/total_points.
                           Couvre "issue du match" et "score/total match".
    entrainement_equipe -> 1 ligne par (match, équipe) -- perspective "own"/
                           "opp" (PAS domicile/extérieur comme entrainement_
                           matchs) : chaque match génère 2 lignes, une par
                           équipe. Ajouté le 23/08/2026 (paris équipe pièce
                           (a) suite, rebonds -- généralisable à ast/fg3m/
                           stl/blk) pour un pari du type "CETTE équipe aura
                           45+ rebonds", peu importe si elle reçoit ou se
                           déplace ce soir-là (own_is_home reste une feature
                           explicite, pas un axe figé comme pour home_win/
                           total_points -- ces 2-là ont besoin de savoir QUI
                           reçoit, pas ceux-ci).

Ne contient QUE les matchs où home_team_id/score sont connus (nécessite
play-by-play récupéré, cf. matchs.md). Reconstruit entièrement à chaque
exécution, comme les scripts précédents — sûr à relancer pendant que
l'extraction continue.

Usage:
    python build_targets.py
"""

import sqlite3
from pathlib import Path

import pandas as pd

SCRIPT_DIR = Path(__file__).resolve().parent
DB_PATH = SCRIPT_DIR.parent / "data" / "nba.db"

PLAYER_LABEL_SCHEMA = """
CREATE TABLE labels_joueur (
    game_id TEXT,
    player_id INTEGER,
    pts REAL, reb REAL, ast REAL, fg3m REAL, stl REAL, blk REAL, minutes REAL,
    ftm REAL, fta REAL,
    fgm REAL, fga REAL, fg3a REAL,
    double_double INTEGER,
    triple_double INTEGER,
    PRIMARY KEY (game_id, player_id)
);
"""


def minutes_to_float(m):
    if pd.isna(m) or m in ("", "0"):
        return 0.0
    m = str(m)
    if ":" in m:
        mins, secs = m.split(":")
        return float(mins) + float(secs) / 60
    return float(m)

# Colonnes de features_equipe dupliquées home_*/away_* dans entrainement_matchs.
# Exclut les identifiants (game_id/team_id/game_date/season, déjà côté matchs)
# et "win"/"is_home", redondants avec home_score/away_score une fois assemblés.
MATCH_FEATURE_COLS = [
    "rest_days", "is_back_to_back", "games_played_season_avant",
    "pts_pour_moy5", "pts_pour_moy10", "pts_contre_moy5", "pts_contre_moy10",
    "reb_pour_moy5", "reb_pour_moy10", "reb_contre_moy5", "reb_contre_moy10",
    "ast_pour_moy5", "ast_pour_moy10", "ast_contre_moy5", "ast_contre_moy10",
    "fg3m_pour_moy5", "fg3m_pour_moy10", "fg3m_contre_moy5", "fg3m_contre_moy10",
    "stl_pour_moy5", "stl_pour_moy10", "stl_contre_moy5", "stl_contre_moy10",
    "blk_pour_moy5", "blk_pour_moy10", "blk_contre_moy5", "blk_contre_moy10",
    "victoires_pct_moy5", "victoires_pct_moy10",
    "off_rating_moy5", "off_rating_moy10", "def_rating_moy5", "def_rating_moy10",
    "net_rating_moy5", "net_rating_moy10", "pace_moy5", "pace_moy10",
    "victoires_pct_domicile_saison", "victoires_pct_exterieur_saison",
    "confrontations_directes_nb", "confrontations_directes_victoires_pct",
    "confrontations_directes_ecart_moy", "continuite_effectif_saison",
]

# Stats d'equipe cibles (23/08/2026, paris equipe piece (a) suite) -- reb
# ajoutee en 1er (pieces total_reb/team_reb), ast/fg3m/stl/blk generalisees
# dans la foulee, meme geste a chaque fois (home_{stat}/away_{stat}/
# total_{stat} dans entrainement_matchs, {stat}_reel dans entrainement_equipe).
TEAM_TARGET_STATS = ["reb", "ast", "fg3m", "stl", "blk"]


def build_labels_joueur(conn: sqlite3.Connection) -> pd.DataFrame:
    box = pd.read_sql(
        "SELECT game_id, player_id, pts, reb, ast, fg3m, stl, blk, minutes, ftm, fta, fgm, fga, fg3a "
        "FROM box_scores",
        conn, dtype={"game_id": str},
    )
    box["minutes"] = box["minutes"].apply(minutes_to_float)
    seuils_10 = box[["pts", "reb", "ast", "stl", "blk"]].fillna(0) >= 10
    nb_categories = seuils_10.sum(axis=1)
    box["double_double"] = (nb_categories >= 2).astype(int)
    box["triple_double"] = (nb_categories >= 3).astype(int)
    return box


def build_matchs_training(conn: sqlite3.Connection) -> pd.DataFrame:
    matchs = pd.read_sql(
        "SELECT game_id, game_date, season, home_team_id, away_team_id, home_score, away_score "
        "FROM matchs WHERE home_team_id IS NOT NULL AND home_score IS NOT NULL",
        conn, dtype={"game_id": str},
    )

    cols = ", ".join(MATCH_FEATURE_COLS)
    fe = pd.read_sql(f"SELECT game_id, team_id, {cols} FROM features_equipe", conn, dtype={"game_id": str})

    home = fe.rename(columns={**{c: f"home_{c}" for c in MATCH_FEATURE_COLS}, "team_id": "home_team_id"})
    away = fe.rename(columns={**{c: f"away_{c}" for c in MATCH_FEATURE_COLS}, "team_id": "away_team_id"})

    df = matchs.merge(home, on=["game_id", "home_team_id"], how="left")
    df = df.merge(away, on=["game_id", "away_team_id"], how="left")

    df["home_win"] = (df["home_score"] > df["away_score"]).astype(int)
    df["ecart"] = df["home_score"] - df["away_score"]
    df["total_points"] = df["home_score"] + df["away_score"]

    # Stats d'equipe REELLES (23/08/2026, paris equipe piece (a) suite) --
    # cibles pour team_{stat} (perspective equipe) ET total_{stat} (combine,
    # meme patron que total_points). Somme par (match, equipe) depuis
    # box_scores, PAS depuis features_equipe (qui ne porte que des moyennes
    # glissantes shift(1), jamais le vrai resultat du match lui-meme).
    box_stats = pd.read_sql(
        f"SELECT game_id, team_id, {', '.join(TEAM_TARGET_STATS)} FROM box_scores", conn, dtype={"game_id": str}
    )
    team_stats = box_stats.groupby(["game_id", "team_id"], as_index=False)[TEAM_TARGET_STATS].sum()
    for stat in TEAM_TARGET_STATS:
        home_stat = team_stats[["game_id", "team_id", stat]].rename(
            columns={"team_id": "home_team_id", stat: f"home_{stat}"}
        )
        away_stat = team_stats[["game_id", "team_id", stat]].rename(
            columns={"team_id": "away_team_id", stat: f"away_{stat}"}
        )
        df = df.merge(home_stat, on=["game_id", "home_team_id"], how="left")
        df = df.merge(away_stat, on=["game_id", "away_team_id"], how="left")
        df[f"total_{stat}"] = df[f"home_{stat}"] + df[f"away_{stat}"]

    return df


def build_team_perspective_dataset(conn: sqlite3.Connection) -> pd.DataFrame:
    """1 ligne par (match, équipe) -- perspective "own"/"opp", PAS domicile/
    extérieur. Base directement sur features_equipe (déjà 1 ligne par
    (match, équipe), déjà les moyennes glissantes) -- pas besoin de repasser
    par entrainement_matchs. own_is_home reste une feature explicite (pas un
    axe figé) : le modèle qui s'entraîne dessus doit apprendre "la stat de
    CETTE équipe" quelle que soit sa place réelle ce soir-là, réutilisable
    pour prédire n'importe quelle équipe visée par un pari, domicile ou
    extérieur, sans avoir à choisir un "sens" a priori (contrairement à
    home_win/total_points, symétriques par construction match entier)."""
    cols = ", ".join(MATCH_FEATURE_COLS)
    fe = pd.read_sql(
        f"SELECT game_id, team_id, opponent_team_id, is_home, game_date, season, {cols} FROM features_equipe",
        conn, dtype={"game_id": str},
    )

    own = fe.rename(columns={"is_home": "own_is_home", **{c: f"own_{c}" for c in MATCH_FEATURE_COLS}})
    opp = fe[["game_id", "team_id", *MATCH_FEATURE_COLS]].rename(
        columns={"team_id": "opponent_team_id", **{c: f"opp_{c}" for c in MATCH_FEATURE_COLS}}
    )
    df = own.merge(opp, on=["game_id", "opponent_team_id"])

    box = pd.read_sql(
        f"SELECT game_id, team_id, {', '.join(TEAM_TARGET_STATS)} FROM box_scores", conn, dtype={"game_id": str}
    )
    team_stats = box.groupby(["game_id", "team_id"], as_index=False)[TEAM_TARGET_STATS].sum().rename(
        columns={stat: f"{stat}_reel" for stat in TEAM_TARGET_STATS}
    )
    df = df.merge(team_stats, on=["game_id", "team_id"], how="left")

    return df


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.executescript("DROP TABLE IF EXISTS labels_joueur; DROP TABLE IF EXISTS entrainement_matchs;")
    cur.executescript(PLAYER_LABEL_SCHEMA)
    conn.commit()

    labels_joueur = build_labels_joueur(conn)
    labels_joueur.to_sql("labels_joueur", conn, if_exists="append", index=False)

    matchs_training = build_matchs_training(conn)
    matchs_training.to_sql("entrainement_matchs", conn, if_exists="replace", index=False)

    equipe_perspective = build_team_perspective_dataset(conn)
    equipe_perspective.to_sql("entrainement_equipe", conn, if_exists="replace", index=False)

    conn.commit()

    n1 = cur.execute("SELECT COUNT(*) FROM labels_joueur").fetchone()[0]
    n2 = cur.execute("SELECT COUNT(*) FROM entrainement_matchs").fetchone()[0]
    n3 = cur.execute("SELECT COUNT(*) FROM entrainement_equipe").fetchone()[0]
    conn.close()

    print(f"labels_joueur: {n1} lignes")
    print(f"entrainement_matchs: {n2} lignes")
    print(f"entrainement_equipe: {n3} lignes")


if __name__ == "__main__":
    main()
