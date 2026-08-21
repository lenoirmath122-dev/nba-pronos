"""
Equivalent Supabase (sans etat) de find_player()/find_team()/build_context()
dans scripts/tester_modele.py -- utilise par le service deploye (app.py),
qui ne touche plus nba.db du tout (architecture B, §22-23 projet-data-nba.md).
Reutilise minutes_to_float()/strip_accents() telles quelles (aucune
duplication de cette logique).

Les 3 tables (stats_equipes/stats_joueurs/stats_box_scores) sont peuplees
par backfill_supabase.py (une fois) puis tenues a jour par le rafraichissement
quotidien (pas encore ecrit, voir GAPS_OUVERTS.md).
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

import joblib  # noqa: E402

from tester_modele import (  # noqa: E402
    CLASSIFIER_STATS,
    MODELS_DIR,
    PCT_STATS,
    REGRESSION_STATS,
    minutes_to_float,
    normalize_suffix,
    resolve_stat,
    run_classifier,
    run_pct,
    run_regression,
    strip_accents,
)


def find_player(client, query: str) -> tuple:
    rows = client.table("stats_joueurs").select("player_id, first_name, family_name").execute().data
    df = pd.DataFrame(rows)
    df["full_name"] = df["first_name"] + " " + df["family_name"]
    needle = normalize_suffix(strip_accents(query))
    matches = df[df["full_name"].apply(lambda n: needle in normalize_suffix(strip_accents(n)))]
    if matches.empty:
        raise ValueError(f"Aucun joueur trouvé pour \"{query}\" -- verifie l'orthographe.")
    if len(matches) > 1:
        options = "\n".join(f"  {r.player_id}  {r.full_name}" for r in matches.itertuples())
        raise ValueError(f"Plusieurs joueurs correspondent a \"{query}\" -- relance avec joueur_id :\n{options}")
    r = matches.iloc[0]
    return int(r.player_id), r.full_name


def find_team(client, query: str) -> tuple:
    rows = client.table("stats_equipes").select("team_id, tricode, city, name").execute().data
    df = pd.DataFrame(rows)
    df["full_name"] = df["city"] + " " + df["name"]
    needle = strip_accents(query)
    matches = df[
        df["tricode"].apply(lambda t: needle in strip_accents(t))
        | df["full_name"].apply(lambda n: needle in strip_accents(n))
    ]
    if matches.empty:
        raise ValueError(f"Aucune equipe trouvee pour \"{query}\".")
    if len(matches) > 1:
        options = "\n".join(f"  {r.tricode}  {r.full_name}" for r in matches.itertuples())
        raise ValueError(f"Plusieurs equipes correspondent a \"{query}\" :\n{options}")
    r = matches.iloc[0]
    return int(r.team_id), r.full_name


def build_context(client, player_id: int, opponent_id, is_home: int, rest_days: int) -> tuple:
    """Meme contrat que build_context() dans tester_modele.py (memes cles de
    contexte, meme fenetre de 10 derniers matchs REELEMENT connus) -- source
    Supabase (stats_box_scores) au lieu de nba.db local."""
    rows = (
        client.table("stats_box_scores")
        .select("game_date, minutes, pts, reb, ast, fg3m, stl, blk, plus_minus, "
                 "ftm, fta, fgm, fga, fg3a, ts_pct, usg_pct, games_played_season_avant")
        .eq("player_id", player_id)
        .order("game_date", desc=True)
        .limit(10)
        .execute()
        .data
    )
    if not rows:
        raise ValueError(f"Aucun match trouve en base pour ce joueur (player_id={player_id}).")
    recent = pd.DataFrame(rows)
    recent["game_date"] = pd.to_datetime(recent["game_date"])
    recent["minutes_f"] = recent["minutes"].apply(minutes_to_float)
    last5 = recent.head(5)

    context = {
        "is_home": is_home,
        "rest_days": rest_days,
        "is_back_to_back": int(rest_days == 1),
        "games_played_season_avant": int(recent["games_played_season_avant"].iloc[0]) + 1,
        "ts_pct_moy5": last5["ts_pct"].mean(),
        "usg_pct_moy5": last5["usg_pct"].mean(),
        "plus_minus_moy5": last5["plus_minus"].mean(),
        "matchs_manques_depuis_dernier": 0,
    }
    for stat, col in (
        ("pts", "pts"), ("reb", "reb"), ("ast", "ast"), ("fg3m", "fg3m"),
        ("stl", "stl"), ("blk", "blk"), ("min", "minutes_f"),
        ("fta", "fta"), ("fga", "fga"), ("fg3a", "fg3a"),
    ):
        context[f"{stat}_moy5"] = last5[col].mean()
        context[f"{stat}_moy10"] = recent[col].mean()

    context["ftm_sum10"], context["fta_sum10"] = recent["ftm"].sum(), recent["fta"].sum()
    context["fgm_sum10"], context["fga_sum10"] = recent["fgm"].sum(), recent["fga"].sum()
    context["fg3m_sum10"], context["fg3a_sum10"] = recent["fg3m"].sum(), recent["fg3a"].sum()

    if opponent_id is not None:
        vs_adv = (
            client.table("stats_box_scores")
            .select("pts")
            .eq("player_id", player_id)
            .eq("opponent_team_id", opponent_id)
            .execute()
            .data
        )
        pts_list = [r["pts"] for r in vs_adv if r["pts"] is not None]
        context["vs_adversaire_pts_moy"] = float(np.mean(pts_list)) if pts_list else np.nan
        context["vs_adversaire_nb_matchs"] = len(pts_list)
    else:
        context["vs_adversaire_pts_moy"] = np.nan
        context["vs_adversaire_nb_matchs"] = 0

    ecarttypes = {}
    for stat, col in (
        ("pts", "pts"), ("reb", "reb"), ("ast", "ast"), ("fg3m", "fg3m"),
        ("stl", "stl"), ("blk", "blk"), ("min", "minutes_f"),
    ):
        ecarttypes[stat] = recent[col].std()

    return context, ecarttypes, recent


def compute_proba(client, player_id: int, stat: str, seuil, opponent_id=None, is_home: int = 1, rest_days: int = 2) -> dict:
    """Equivalent Supabase de compute_proba() (tester_modele.py) -- meme
    contrat/sortie, seule la source du contexte change (build_context()
    ci-dessus au lieu de la version SQLite)."""
    if stat not in REGRESSION_STATS and stat not in CLASSIFIER_STATS and stat not in PCT_STATS:
        raise ValueError(f"stat inconnue : {stat}")
    famille, model_file, label, raw_col_key = resolve_stat(stat)
    if famille != "classifier" and seuil is None:
        raise ValueError(f"seuil obligatoire pour la stat {stat}")

    context, ecarttypes, recent = build_context(client, player_id, opponent_id, is_home=is_home, rest_days=rest_days)
    bundle = joblib.load(MODELS_DIR / f"{model_file}.joblib")

    if famille == "regression":
        proba, detail = run_regression(bundle, context, ecarttypes, raw_col_key, seuil)
    elif famille == "classifier":
        proba, detail = run_classifier(bundle, context)
    else:
        proba, detail = run_pct(bundle, context, seuil)

    return {
        "label": label,
        "proba": proba,
        "detail": detail,
        "contexte_matchs": len(recent),
        "contexte_periode": [recent["game_date"].min().date().isoformat(), recent["game_date"].max().date().isoformat()],
        "vs_adversaire_nb_matchs": context["vs_adversaire_nb_matchs"] if opponent_id is not None else None,
        "vs_adversaire_pts_moy": (
            None if opponent_id is None or pd.isna(context["vs_adversaire_pts_moy"])
            else float(context["vs_adversaire_pts_moy"])
        ),
    }
