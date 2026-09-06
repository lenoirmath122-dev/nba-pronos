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

import re
import sqlite3
from pathlib import Path

import numpy as np
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
    oreb REAL,
    tov REAL,
    plus_minus REAL,
    double_double INTEGER,
    triple_double INTEGER,
    technical_fouls INTEGER,
    backcourt_turnovers INTEGER,
    tech INTEGER,
    PRIMARY KEY (game_id, player_id)
);
"""

# Chantier "evenements de match" (etape 5 du plan de reprise post-audit,
# GAPS_OUVERTS.md, 25/08/2026) -- toutes les variantes de faute technique
# rencontrees dans le play-by-play (Foul.subType) qui comptent comme "une
# faute technique" pour un joueur, MEME liste EXACTE que
# backfill_game_events.py (service Supabase) -- dupliquee ici (script local,
# aucun module partage entre les 2 cotes, meme situation que
# minutes_to_float()).
TECHNICAL_SUBTYPES = (
    "Technical", "Double Technical", "Delay Technical", "Hanging Technical", "Too Many Players Technical",
)


def _player_game_events_from_pbp(conn: sqlite3.Connection) -> pd.DataFrame:
    """technical_fouls/backcourt_turnovers PAR JOUEUR depuis play_by_play --
    chantier "evenements de match" (etape 5, GAPS_OUVERTS.md). team_id != 0
    exclut les fautes techniques D'ENTRAINEUR (personId n'est alors pas un
    joueur, ex. Gregg Popovich -- decouvert en explorant les donnees avant
    de coder, meme filtre cote backfill_game_events.py)."""
    placeholders = ", ".join("?" for _ in TECHNICAL_SUBTYPES)
    fouls = pd.read_sql(
        f"SELECT game_id, player_id, COUNT(*) AS technical_fouls FROM play_by_play "
        f"WHERE action_type = 'Foul' AND sub_type IN ({placeholders}) AND team_id != 0 "
        f"GROUP BY game_id, player_id",
        conn, params=list(TECHNICAL_SUBTYPES), dtype={"game_id": str},
    )
    backcourt = pd.read_sql(
        "SELECT game_id, player_id, COUNT(*) AS backcourt_turnovers FROM play_by_play "
        "WHERE action_type = 'Turnover' AND sub_type = 'Backcourt Turnover' "
        "GROUP BY game_id, player_id",
        conn, dtype={"game_id": str},
    )
    return fouls.merge(backcourt, on=["game_id", "player_id"], how="outer")


def _team_technical_fouls_from_pbp(conn: sqlite3.Connection) -> pd.DataFrame:
    """technical_fouls PAR EQUIPE (somme des fautes de ses joueurs, meme
    filtre team_id != 0 que ci-dessus) -- 1 ligne par (game_id, team_id)."""
    placeholders = ", ".join("?" for _ in TECHNICAL_SUBTYPES)
    return pd.read_sql(
        f"SELECT game_id, team_id, COUNT(*) AS technical_fouls FROM play_by_play "
        f"WHERE action_type = 'Foul' AND sub_type IN ({placeholders}) AND team_id != 0 "
        f"GROUP BY game_id, team_id",
        conn, params=list(TECHNICAL_SUBTYPES), dtype={"game_id": str},
    )


def _match_events_from_pbp(conn: sqlite3.Connection) -> pd.DataFrame:
    """home_timeouts/away_timeouts/total_timeouts + had_backcourt_turnover
    (bool, au moins 1 sur le match, les 2 equipes confondues) -- 1 ligne par
    match. Les temps morts n'ont PAS d'attribution joueur/equipe structuree
    dans le play-by-play (team_id=0 aussi) -- seule l'equipe qui a appele le
    temps mort est identifiable via son NOM en texte libre dans description
    (ex. "Nets Timeout: Regular"), resolue en comparant ce prefixe (normalise
    en MAJUSCULES) aux 2 VRAIES equipes de ce match -- MEME mecanisme EXACT
    que backfill_game_events.py (service Supabase), verifie 0 texte non
    resolu sur un echantillon de 200 matchs avant de coder ceci."""
    matchs = pd.read_sql(
        "SELECT game_id, home_team_id, away_team_id FROM matchs WHERE home_team_id IS NOT NULL",
        conn, dtype={"game_id": str},
    )
    equipes = pd.read_sql("SELECT team_id, name FROM equipes", conn)
    name_by_id = dict(zip(equipes["team_id"], equipes["name"].fillna("").str.upper()))
    home_name = matchs["home_team_id"].map(name_by_id).fillna("")
    away_name = matchs["away_team_id"].map(name_by_id).fillna("")
    matchs = matchs.assign(home_name=home_name, away_name=away_name)

    timeouts = pd.read_sql(
        "SELECT game_id, description FROM play_by_play WHERE action_type = 'Timeout' AND sub_type = 'Regular'",
        conn, dtype={"game_id": str},
    )
    timeouts["prefix"] = timeouts["description"].fillna("").str.split(" Timeout:").str[0].str.strip().str.upper()
    timeouts = timeouts.merge(matchs[["game_id", "home_name", "away_name"]], on="game_id", how="left")
    timeouts["side"] = np.select(
        [timeouts["prefix"] == timeouts["home_name"], timeouts["prefix"] == timeouts["away_name"]],
        ["home", "away"],
        default=None,
    )
    counts = (
        timeouts.dropna(subset=["side"])
        .groupby(["game_id", "side"])
        .size()
        .unstack(fill_value=0)
        .reindex(columns=["home", "away"], fill_value=0)
        .rename(columns={"home": "home_timeouts", "away": "away_timeouts"})
        .reset_index()
    )

    backcourt = pd.read_sql(
        "SELECT DISTINCT game_id FROM play_by_play WHERE action_type = 'Turnover' AND sub_type = 'Backcourt Turnover'",
        conn, dtype={"game_id": str},
    )
    backcourt["had_backcourt_turnover"] = 1

    out = matchs[["game_id"]].merge(counts, on="game_id", how="left").merge(backcourt, on="game_id", how="left")
    out["home_timeouts"] = out["home_timeouts"].fillna(0)
    out["away_timeouts"] = out["away_timeouts"].fillna(0)
    out["had_backcourt_turnover"] = out["had_backcourt_turnover"].fillna(0).astype(int)
    out["total_timeouts"] = out["home_timeouts"] + out["away_timeouts"]
    return out


# Chantier "evenements granulaires" (etape 6 du plan de reprise post-audit,
# GAPS_OUVERTS.md, 25/08/2026) -- "aucun panier marque au buzzer durant le
# match". Seuil calibre EMPIRIQUEMENT sur les CSV locaux avant de coder (pas
# devine) : <=0.3s donne un taux de "au moins 1 par match" d'environ 26%
# (echantillon de 300 matchs, 2022-23) -- ni trop rare ni trop frequent pour
# un classifieur utile, et coherent avec la vraie notion de "AU buzzer"
# (teste a des seuils plus larges type <=2s, ~52% des matchs -- ca capture
# surtout des paniers normaux en fin de possession, pas vraiment "au
# buzzer"). N'IMPORTE QUELLE periode (Q1-Q4/OT), pas seulement la fin du
# match -- le pari reel dit "durant le match", jamais restreint au dernier
# quart-temps.
_BUZZER_BEATER_THRESHOLD_SECONDS = 0.3
_CLOCK_RE = re.compile(r"PT(\d+)M([\d.]+)S")


def _clock_to_seconds(clock) -> float | None:
    m = _CLOCK_RE.match(str(clock))
    if not m:
        return None
    return int(m.group(1)) * 60 + float(m.group(2))


def _match_buzzer_beater_from_pbp(conn: sqlite3.Connection) -> pd.DataFrame:
    """DISTINCT game_id des matchs avec au moins 1 panier marque a <=0.3s du
    buzzer (n'importe quelle periode, les 2 equipes confondues) -- fusionne
    ensuite (how="left" + fillna(0)) dans build_matchs_training(), meme
    geste que backcourt/had_backcourt_turnover ci-dessus (0 explicite pour
    un match SANS l'evenement, pas une donnee manquante). Le clock est
    stocke en TEXTE (format "PTxxMxx.xxS", pas convertible en SQL direct)
    -- parse en pandas, meme geste que minutes_to_float() ci-dessous pour un
    autre champ texte."""
    pbp = pd.read_sql(
        "SELECT game_id, clock FROM play_by_play WHERE action_type = 'Made Shot'",
        conn, dtype={"game_id": str},
    )
    pbp["secs"] = pbp["clock"].apply(_clock_to_seconds)
    game_ids = pbp.loc[pbp["secs"] <= _BUZZER_BEATER_THRESHOLD_SECONDS, "game_id"].unique()
    return pd.DataFrame({"game_id": game_ids, "had_buzzer_beater": 1})


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
    "oreb_pour_moy5", "oreb_pour_moy10", "oreb_contre_moy5", "oreb_contre_moy10",
    "tov_pour_moy5", "tov_pour_moy10", "tov_contre_moy5", "tov_contre_moy10",
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
# "pts" ajoutee le meme jour (extension "faciles" -- types_de_paris_playoffs_2026.md,
# categorie "Points equipe") : home_pts/away_pts/total_pts dans
# entrainement_matchs sont redondants avec home_score/away_score/total_points
# (deja presents, calcules directement depuis matchs) -- generes quand meme
# via la boucle commune plutot que d'exclure "pts" au prix d'un cas
# particulier ; ce qui manquait reellement est pts_reel dans
# entrainement_equipe (perspective own/opp, absente jusqu'ici -- total_points
# ne couvrait que le combine domicile/exterieur, pas "CETTE equipe precise").
# "oreb" ajoutee le meme jour (extension "faciles", categorie "Rebonds
# offensifs equipe" -- forme combinee, cf. TEAM_COUNTING_STATS dans
# build_features.py).
# fga/fgm/fta/ftm/fg3a ajoutees le 24/08/2026 (chantier "% tir equipe") :
# {stat}_reel dans entrainement_equipe sert de cible REELLE a l'etage
# "tentatives" de train_team_pct_model.py (RandomForestRegressor qui predit
# le NOMBRE de tirs tentes) -- home_{stat}/away_{stat}/total_{stat} generes
# aussi dans entrainement_matchs via la boucle commune, redondants mais pas
# geants (meme raisonnement que "pts" ci-dessus, pas de cas particulier).
# "tov" ajoutee le 06/09/2026 (GAPS_OUVERTS.md, "pertes de balle") -- meme
# patron mecanique que oreb.
TEAM_TARGET_STATS = ["pts", "reb", "ast", "fg3m", "stl", "blk", "oreb", "tov", "fga", "fgm", "fta", "ftm", "fg3a"]


# Chantier "pari periode" equipe (GAPS_OUVERTS.md, 24/08/2026) -- 6 periodes
# valides cote pari (Q1-Q4 = quart-temps seul, H1/H2 = mi-temps = 2 quarts-
# temps). Meme liste que lib/ai/periodStatCodes.ts (PERIOD_CODES), cote
# Python.
PERIOD_CODES = ["Q1", "Q2", "Q3", "Q4", "H1", "H2"]

# Segment (quarts-temps COUVERTS par cette periode seule) vs cumulatif
# (depuis le debut du match JUSQU'A la fin de cette periode) -- meme
# distinction que periodQuarterIndices()/cumulativeQuarterIndices()
# (resolveCalculableBets.ts) : TOTAL_POINTS/QUARTER_WINNER/HALF_WINNER sont
# des segments ("le total du 4e quart-temps"), MARGIN est cumulatif
# ("l'ecart A LA FIN du 3e quart-temps" = Q1+Q2+Q3, pas Q3 seul).
_PERIOD_SEGMENT_QUARTERS = {"Q1": [1], "Q2": [2], "Q3": [3], "Q4": [4], "H1": [1, 2], "H2": [3, 4]}
_PERIOD_CUMULATIVE_QUARTERS = {"Q1": [1], "Q2": [1, 2], "Q3": [1, 2, 3], "Q4": [1, 2, 3, 4], "H1": [1, 2], "H2": [1, 2, 3, 4]}


def _quarter_scores_from_pbp(conn: sqlite3.Connection) -> pd.DataFrame:
    """Reconstruit le score de FIN de chaque quart-temps (1-4, quart-temps
    seul, pas cumule) depuis play_by_play.score_home/score_away (score
    CUMULE depuis le debut du match a chaque action) -- meme source que
    went_to_ot (MAX(period)) ci-dessus, jamais synchronisee vers Supabase,
    utilisee UNIQUEMENT pour les cibles d'entrainement LOCALES (chantier
    "pari periode" equipe, GAPS_OUVERTS.md, 24/08/2026). Le signal de
    PRODUCTION vient de state.score.homeTeam/awayTeam (Highlightly,
    lib/nba/client.ts) -- deja par quart-temps directement, pas besoin de le
    reconstruire cote TS.

    Retourne game_id + home_q1..q4/away_q1..q4 (quart-temps SEUL). NaN
    preservee (pas de play_by_play pour ce game_id, ou match ecourte a moins
    de 4 quarts-temps -- jamais vu en pratique mais garde de prudence) plutot
    que forcee a 0, meme principe que went_to_ot ci-dessus."""
    pbp = pd.read_sql(
        "SELECT game_id, period, action_number, score_home, score_away FROM play_by_play WHERE period BETWEEN 1 AND 4",
        conn, dtype={"game_id": str},
    )
    cols = ["game_id"] + [f"{side}_q{p}" for side in ("home", "away") for p in range(1, 5)]
    if pbp.empty:
        return pd.DataFrame(columns=cols)

    end_of_period = pbp.sort_values("action_number").groupby(["game_id", "period"], as_index=False).last()
    cum_home = end_of_period.pivot(index="game_id", columns="period", values="score_home")
    cum_away = end_of_period.pivot(index="game_id", columns="period", values="score_away")

    q_home = cum_home.diff(axis=1)
    q_home[1] = cum_home[1] if 1 in cum_home.columns else pd.NA
    q_away = cum_away.diff(axis=1)
    q_away[1] = cum_away[1] if 1 in cum_away.columns else pd.NA

    q_home.columns = [f"home_q{p}" for p in q_home.columns]
    q_away.columns = [f"away_q{p}" for p in q_away.columns]
    out = q_home.join(q_away, how="outer").reset_index()
    for c in cols:
        if c not in out.columns:
            out[c] = pd.NA
    return out[cols]


def build_labels_joueur(conn: sqlite3.Connection) -> pd.DataFrame:
    box = pd.read_sql(
        "SELECT game_id, player_id, pts, reb, ast, fg3m, stl, blk, minutes, ftm, fta, fgm, fga, fg3a, oreb, tov, "
        "plus_minus "
        "FROM box_scores",
        conn, dtype={"game_id": str},
    )
    box["minutes"] = box["minutes"].apply(minutes_to_float)
    seuils_10 = box[["pts", "reb", "ast", "stl", "blk"]].fillna(0) >= 10
    nb_categories = seuils_10.sum(axis=1)
    box["double_double"] = (nb_categories >= 2).astype(int)
    box["triple_double"] = (nb_categories >= 3).astype(int)

    # Chantier "evenements de match" (etape 5, GAPS_OUVERTS.md) -- 0 explicite
    # (pas NaN) pour un joueur SANS ligne dans _player_game_events_from_pbp :
    # ce joueur a bien joue (ligne box_scores) mais n'a commis aucun des 2
    # events, un vrai zero d'entrainement, pas une donnee manquante.
    events = _player_game_events_from_pbp(conn)
    box = box.merge(events, on=["game_id", "player_id"], how="left")
    box["technical_fouls"] = box["technical_fouls"].fillna(0).astype(int)
    box["backcourt_turnovers"] = box["backcourt_turnovers"].fillna(0).astype(int)
    box["tech"] = (box["technical_fouls"] >= 1).astype(int)
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

    # went_to_ot (24/08/2026, chantier paris "prolongation", GAPS_OUVERTS.md)
    # -- derive de play_by_play.period (MAX > 4 = au moins 1 quart-temps de
    # prolongation joue), jamais synchronise vers Supabase et pas necessaire
    # de l'y synchroniser : uniquement utilise ICI pour la cible
    # d'entrainement locale, le signal de PRODUCTION vient d'ailleurs
    # (state.score.homeTeam/awayTeam, lib/nba/client.ts, cf. plan).
    max_period = pd.read_sql(
        "SELECT game_id, MAX(period) AS max_period FROM play_by_play GROUP BY game_id", conn, dtype={"game_id": str}
    )
    df = df.merge(max_period, on="game_id", how="left")
    # NaN preservee (pas de play_by_play pour ce game_id) plutot que forcee a
    # 0 -- sinon un match sans donnee introduirait un faux "pas de prolongation"
    # dans une classe deja rare, biais silencieux. load_dataset() (train_overtime_
    # model.py) filtre les NaN comme pour toutes les autres cibles.
    df["went_to_ot"] = df["max_period"].apply(lambda p: p > 4 if pd.notna(p) else pd.NA)
    df = df.drop(columns=["max_period"])

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

    # Chantier "evenements de match" (etape 5, GAPS_OUVERTS.md) --
    # home_timeouts/away_timeouts/total_timeouts (cible total_timeouts,
    # MATCH_TOTAL) + had_backcourt_turnover (cible directe, MATCH_TOTAL sans
    # seuil, meme principe que went_to_ot).
    events = _match_events_from_pbp(conn)
    df = df.merge(events, on="game_id", how="left")

    # home_technical_fouls/away_technical_fouls/total_technical_fouls (meme
    # patron EXACT que la boucle TEAM_TARGET_STATS ci-dessus, mais depuis le
    # play-by-play -- technical_fouls n'existe pas dans box_scores).
    team_tech = _team_technical_fouls_from_pbp(conn)
    home_tech = team_tech.rename(columns={"team_id": "home_team_id", "technical_fouls": "home_technical_fouls"})
    away_tech = team_tech.rename(columns={"team_id": "away_team_id", "technical_fouls": "away_technical_fouls"})
    df = df.merge(home_tech, on=["game_id", "home_team_id"], how="left")
    df = df.merge(away_tech, on=["game_id", "away_team_id"], how="left")
    df["home_technical_fouls"] = df["home_technical_fouls"].fillna(0)
    df["away_technical_fouls"] = df["away_technical_fouls"].fillna(0)
    df["total_technical_fouls"] = df["home_technical_fouls"] + df["away_technical_fouls"]

    # Chantier "evenements granulaires" (etape 6, GAPS_OUVERTS.md) --
    # had_buzzer_beater (cible directe MATCH_TOTAL sans seuil, meme principe
    # que had_backcourt_turnover/went_to_ot).
    buzzer = _match_buzzer_beater_from_pbp(conn)
    df = df.merge(buzzer, on="game_id", how="left")
    df["had_buzzer_beater"] = df["had_buzzer_beater"].fillna(0).astype(int)

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
    # Colonnes tentatives/sum10 (24/08/2026, chantier "% tir equipe") --
    # cote "own" UNIQUEMENT (pas de version "opp" necessaire : le taux de
    # tir propre d'une equipe ne depend pas du volume de tir adverse), donc
    # ajoutees a part plutot que via la boucle own/opp de MATCH_FEATURE_COLS
    # ci-dessous. Prerequis de train_team_pct_model.py (etage tentatives +
    # retrecissement bayesien, meme patron que le joueur).
    PCT_EXTRA_COLS = [
        "fga_pour_moy5", "fga_pour_moy10", "fta_pour_moy5", "fta_pour_moy10",
        "fg3a_pour_moy5", "fg3a_pour_moy10",
        "ftm_pour_sum10", "fta_pour_sum10", "fgm_pour_sum10", "fga_pour_sum10",
        "fg3m_pour_sum10", "fg3a_pour_sum10",
        # "fga_contre_moy5/10" ajoutees le 24/08/2026 (chantier "petits gains
        # groupes", categorie "Comparaison volume tirs equipe") -- cote
        # "contre" du volume de tirs, jamais recupere jusqu'ici (le
        # retrecissement bayesien de train_team_pct_model.py n'a besoin que
        # du cote "pour"). Necessaire pour donner a train_team_stats_model.py
        # le meme patron own_/opp_ que reb/ast/etc, derive a part plus bas
        # (PAS ajoute a MATCH_FEATURE_COLS : aurait duplique fga_pour_moy5/10
        # dans la meme requete SQL, deja presentes ci-dessus).
        "fga_contre_moy5", "fga_contre_moy10",
    ]
    extra_cols = ", ".join(PCT_EXTRA_COLS)
    fe = pd.read_sql(
        f"SELECT game_id, team_id, opponent_team_id, is_home, game_date, season, {cols}, {extra_cols} FROM features_equipe",
        conn, dtype={"game_id": str},
    )

    own = fe.rename(columns={"is_home": "own_is_home", **{c: f"own_{c}" for c in MATCH_FEATURE_COLS}})
    opp = fe[["game_id", "team_id", *MATCH_FEATURE_COLS]].rename(
        columns={"team_id": "opponent_team_id", **{c: f"opp_{c}" for c in MATCH_FEATURE_COLS}}
    )
    df = own.merge(opp, on=["game_id", "opponent_team_id"])

    # fga own_/opp_ x pour_/contre_ (24/08/2026, train_team_stats_model.py,
    # chantier "petits gains groupes") -- own_fga_pour_moy5/10 et
    # own_fga_contre_moy5/10 viennent directement de "own" (fga_pour_moy5/10/
    # fga_contre_moy5/10 non touchees par le rename ci-dessus, toujours sous
    # leur nom brut) ; le cote opp_ demande un merge séparé (fe filtré sur
    # ces 4 colonnes uniquement, cote opponent_team_id).
    df["own_fga_pour_moy5"] = df["fga_pour_moy5"]
    df["own_fga_pour_moy10"] = df["fga_pour_moy10"]
    df["own_fga_contre_moy5"] = df["fga_contre_moy5"]
    df["own_fga_contre_moy10"] = df["fga_contre_moy10"]
    opp_fga = fe[["game_id", "team_id", "fga_pour_moy5", "fga_pour_moy10", "fga_contre_moy5", "fga_contre_moy10"]].rename(
        columns={
            "team_id": "opponent_team_id",
            "fga_pour_moy5": "opp_fga_pour_moy5", "fga_pour_moy10": "opp_fga_pour_moy10",
            "fga_contre_moy5": "opp_fga_contre_moy5", "fga_contre_moy10": "opp_fga_contre_moy10",
        }
    )
    df = df.merge(opp_fga, on=["game_id", "opponent_team_id"], how="left")

    box = pd.read_sql(
        f"SELECT game_id, team_id, {', '.join(TEAM_TARGET_STATS)} FROM box_scores", conn, dtype={"game_id": str}
    )
    team_stats = box.groupby(["game_id", "team_id"], as_index=False)[TEAM_TARGET_STATS].sum().rename(
        columns={stat: f"{stat}_reel" for stat in TEAM_TARGET_STATS}
    )
    df = df.merge(team_stats, on=["game_id", "team_id"], how="left")

    # Chantier "evenements de match" (etape 5, GAPS_OUVERTS.md) --
    # own_technical_fouls/opp_technical_fouls (cible multi-classe, meme
    # patron que own_quarters_won_count juste en dessous) -- technical_fouls
    # n'existe pas dans box_scores, vient de _team_technical_fouls_from_pbp().
    team_tech = _team_technical_fouls_from_pbp(conn)
    own_tech = team_tech.rename(columns={"technical_fouls": "own_technical_fouls"})
    opp_tech = team_tech.rename(columns={"team_id": "opponent_team_id", "technical_fouls": "opp_technical_fouls"})
    df = df.merge(own_tech, on=["game_id", "team_id"], how="left")
    df = df.merge(opp_tech, on=["game_id", "opponent_team_id"], how="left")
    df["own_technical_fouls"] = df["own_technical_fouls"].fillna(0)
    df["opp_technical_fouls"] = df["opp_technical_fouls"].fillna(0)

    # Chantier "pari periode" equipe (24/08/2026, GAPS_OUVERTS.md) --
    # own_quarters_won_count (QUARTERS_WON_COUNT, multi-classe 0-4) et
    # own_half_outcome (LEADS_HALF_RESULT, cible JOINTE 3 classes -- PAS
    # composee via independance : NOT_LEADING/WINS/LOSES mutuellement
    # exclusives, cf. resolveCalculableBets.ts::computePeriodTeamOutcome
    # pour le meme raisonnement cote resolution).
    matchs_ctx = pd.read_sql(
        "SELECT game_id, home_team_id, home_score, away_score FROM matchs "
        "WHERE home_team_id IS NOT NULL AND home_score IS NOT NULL",
        conn, dtype={"game_id": str},
    )
    qs = _quarter_scores_from_pbp(conn)
    ctx = df[["game_id", "team_id"]].merge(matchs_ctx, on="game_id", how="left").merge(qs, on="game_id", how="left")
    is_home = ctx["team_id"] == ctx["home_team_id"]
    own_q = [np.where(is_home, ctx[f"home_q{p}"], ctx[f"away_q{p}"]) for p in range(1, 5)]
    opp_q = [np.where(is_home, ctx[f"away_q{p}"], ctx[f"home_q{p}"]) for p in range(1, 5)]
    df["own_quarters_won_count"] = sum((oq > pq).astype(float) for oq, pq in zip(own_q, opp_q))

    own_half = own_q[0] + own_q[1]
    opp_half = opp_q[0] + opp_q[1]
    own_total = np.where(is_home, ctx["home_score"], ctx["away_score"])
    opp_total = np.where(is_home, ctx["away_score"], ctx["home_score"])
    leads_half = own_half > opp_half
    wins_match = own_total > opp_total
    df["own_half_outcome"] = np.select(
        [leads_half & wins_match, leads_half & (~wins_match)],
        ["WINS", "LOSES"],
        default="NOT_LEADING",
    )
    # NaN sur own_quarters_won_count/own_half_outcome pour un game_id sans
    # play_by_play (qs) -- NOT_LEADING serait FAUX dans ce cas (donnee
    # manquante, pas "ne mene pas"), donc invalide explicitement les 2
    # colonnes plutot que de laisser un faux NOT_LEADING silencieux.
    missing = ctx["home_q1"].isna().to_numpy()
    df.loc[missing, "own_quarters_won_count"] = pd.NA
    df.loc[missing, "own_half_outcome"] = pd.NA

    return df


def build_period_match_dataset(matchs_training: pd.DataFrame, quarter_scores: pd.DataFrame) -> pd.DataFrame:
    """Format LONG, 1 ligne par (match, periode) -- 6 periodes -- pour les
    cibles SYMETRIQUES (MARGIN cumulatif, TOTAL_POINTS segment, team=null
    cote pari). Reutilise matchs_training deja construit (home_*/away_*
    MATCH_FEATURE_COLS) fusionne avec les scores par quart-temps reconstruits
    depuis play_by_play local. `period` categoriel (one-hot a l'entrainement)
    -- UN SEUL modele generalise par cible plutot que 6 modeles dedies, meme
    philosophie que /predict-team-stat (parametre `stat`)."""
    df = matchs_training.merge(quarter_scores, on="game_id", how="left")
    home_cols = [f"home_{c}" for c in MATCH_FEATURE_COLS]
    away_cols = [f"away_{c}" for c in MATCH_FEATURE_COLS]
    rows = []
    for period in PERIOD_CODES:
        seg = _PERIOD_SEGMENT_QUARTERS[period]
        cum = _PERIOD_CUMULATIVE_QUARTERS[period]
        home_seg = sum(df[f"home_q{p}"] for p in seg)
        away_seg = sum(df[f"away_q{p}"] for p in seg)
        home_cum = sum(df[f"home_q{p}"] for p in cum)
        away_cum = sum(df[f"away_q{p}"] for p in cum)
        part = df[["game_id"] + home_cols + away_cols].copy()
        part["period"] = period
        part["margin"] = (home_cum - away_cum).abs()
        part["total_points"] = home_seg + away_seg
        rows.append(part)
    return pd.concat(rows, ignore_index=True)


def build_period_team_dataset(equipe_perspective: pd.DataFrame, conn: sqlite3.Connection, quarter_scores: pd.DataFrame) -> pd.DataFrame:
    """Format LONG, 1 ligne par (match, equipe, periode) -- perspective
    own/opp (comme build_team_perspective_dataset), pour QUARTER_WINNER/
    HALF_WINNER (own_wins_period, booleen) et POINT_SHARE_PCT (own_pts_share,
    fraction 0-1) -- pooled par periode, meme philosophie que
    build_period_match_dataset ci-dessus."""
    matchs_ctx = pd.read_sql(
        "SELECT game_id, home_team_id, home_score, away_score FROM matchs "
        "WHERE home_team_id IS NOT NULL AND home_score IS NOT NULL",
        conn, dtype={"game_id": str},
    )
    base = equipe_perspective.merge(matchs_ctx, on="game_id", how="left").merge(quarter_scores, on="game_id", how="left")
    is_home = base["team_id"] == base["home_team_id"]
    own_cols = [f"own_{c}" for c in MATCH_FEATURE_COLS]
    opp_cols = [f"opp_{c}" for c in MATCH_FEATURE_COLS]
    rows = []
    for period in PERIOD_CODES:
        seg = _PERIOD_SEGMENT_QUARTERS[period]
        home_seg = sum(base[f"home_q{p}"] for p in seg)
        away_seg = sum(base[f"away_q{p}"] for p in seg)
        own_seg = np.where(is_home, home_seg, away_seg)
        opp_seg = np.where(is_home, away_seg, home_seg)
        own_total = np.where(is_home, base["home_score"], base["away_score"])
        part = base[["game_id", "team_id"] + own_cols + opp_cols].copy()
        part["period"] = period
        part["own_wins_period"] = own_seg > opp_seg
        part["own_pts_share"] = own_seg / own_total
        rows.append(part)
    return pd.concat(rows, ignore_index=True)


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

    # Chantier "pari periode" equipe (24/08/2026) -- 2 tables LONG (pooled
    # par periode) en plus des 3 existantes, cf. build_period_match_dataset/
    # build_period_team_dataset ci-dessus.
    quarter_scores = _quarter_scores_from_pbp(conn)
    periode_match = build_period_match_dataset(matchs_training, quarter_scores)
    periode_match.to_sql("entrainement_periode_match", conn, if_exists="replace", index=False)

    periode_equipe = build_period_team_dataset(equipe_perspective, conn, quarter_scores)
    periode_equipe.to_sql("entrainement_periode_equipe", conn, if_exists="replace", index=False)

    conn.commit()

    n1 = cur.execute("SELECT COUNT(*) FROM labels_joueur").fetchone()[0]
    n2 = cur.execute("SELECT COUNT(*) FROM entrainement_matchs").fetchone()[0]
    n3 = cur.execute("SELECT COUNT(*) FROM entrainement_equipe").fetchone()[0]
    n4 = cur.execute("SELECT COUNT(*) FROM entrainement_periode_match").fetchone()[0]
    n5 = cur.execute("SELECT COUNT(*) FROM entrainement_periode_equipe").fetchone()[0]
    conn.close()

    print(f"labels_joueur: {n1} lignes")
    print(f"entrainement_matchs: {n2} lignes")
    print(f"entrainement_equipe: {n3} lignes")
    print(f"entrainement_periode_match: {n4} lignes")
    print(f"entrainement_periode_equipe: {n5} lignes")


if __name__ == "__main__":
    main()
