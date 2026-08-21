"""
Testeur générique : applique N'IMPORTE LEQUEL des 12 modèles sauvegardés
(models/*.joblib) à un joueur réel, en ligne de commande, sans rien éditer
dans le code. Généralise demo_pari_reel.py (qui restait câblé en dur sur
Tatum/points) — même principe (contexte reconstruit à partir des derniers
matchs RÉELLEMENT connus du joueur, cf. projet-data-nba.md §12), étendu aux
3 familles de modèles (régression+distribution, classification directe,
Binomial à 2 étages) plutôt qu'à la seule 1ère.

Usage:
    python tester_modele.py --joueur "Nikola Jokic" --stat pts --seuil 25
    python tester_modele.py --joueur "Jokic" --stat dd
    python tester_modele.py --joueur "Tatum" --stat ft --seuil 0.85
    python tester_modele.py --joueur "Curry" --stat fg3m --seuil 4 --adversaire LAL --exterieur --repos 1

Codes --stat disponibles :
    pts, reb, ast, fg3m, stl, blk, min   -> régression + distribution (normale ou Poisson)
    dd, td                               -> double-double / triple-double (probabilité directe, pas de --seuil)
    ft, fg, fg3                          -> % de tir (lancers francs / tirs au panier / 3-points),
                                             --seuil en fraction (0.80 = 80%)

--adversaire (optionnel, code équipe/ville/nom) : n'affecte QUE le modèle
des points (seul à utiliser l'historique face à cet adversaire précis).
--domicile/--exterieur, --repos : contexte du PROCHAIN match, illustratif
si tu ne les précises pas (mêmes valeurs par défaut que demo_pari_reel.py).
"""

import argparse
import math
import sqlite3
import unicodedata
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.stats import betabinom, binom, norm, poisson

SCRIPT_DIR = Path(__file__).resolve().parent
DB_PATH = SCRIPT_DIR.parent / "data" / "nba.db"
MODELS_DIR = SCRIPT_DIR.parent / "models"

# code --stat -> (fichier .joblib, colonne brute box_scores pour la
# dispersion "normale", libellé humain)
REGRESSION_STATS = {
    "pts": ("points", "pts", "Points"),
    "reb": ("reb", "reb", "Rebonds"),
    "ast": ("ast", "ast", "Passes décisives"),
    "fg3m": ("fg3m", "fg3m", "3-points réussis"),
    "stl": ("stl", "stl", "Interceptions"),
    "blk": ("blk", "blk", "Contres"),
    "min": ("min", "minutes_f", "Minutes jouées"),
}
CLASSIFIER_STATS = {
    "dd": ("double_double", "Double-double"),
    "td": ("triple_double", "Triple-double"),
}
PCT_STATS = {
    "ft": ("ft_pct", "ftm", "fta", "Lancers francs (FT%)"),
    "fg": ("fg_pct", "fgm", "fga", "Tirs au panier (FG%)"),
    "fg3": ("fg3_pct", "fg3m", "fg3a", "3-points (3P%)"),
}

MIN_SCALE = 0.5  # plancher de dispersion, même valeur que train_stat_model.py


def minutes_to_float(m):
    if pd.isna(m) or m in ("", "0"):
        return 0.0
    m = str(m)
    if ":" in m:
        mins, secs = m.split(":")
        return float(mins) + float(secs) / 60
    return float(m)


def strip_accents(s: str) -> str:
    """"Jokic" doit trouver "Jokić" -- SQLite LIKE ne gere pas les accents,
    comparaison normalisee cote Python a la place (petite table, pas besoin
    de faire ca en SQL)."""
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c)).lower()


def find_player(conn, query: str) -> tuple:
    df = pd.read_sql("SELECT player_id, first_name, family_name FROM joueurs", conn)
    df["full_name"] = df["first_name"] + " " + df["family_name"]
    needle = strip_accents(query)
    rows = df[df["full_name"].apply(lambda n: needle in strip_accents(n))]
    if rows.empty:
        raise SystemExit(f"Aucun joueur trouvé pour \"{query}\" -- verifie l'orthographe.")
    if len(rows) > 1:
        options = "\n".join(f"  {r.player_id}  {r.full_name}" for r in rows.itertuples())
        raise SystemExit(
            f"Plusieurs joueurs correspondent a \"{query}\" -- relance avec --joueur-id :\n{options}"
        )
    r = rows.iloc[0]
    return int(r.player_id), r.full_name


def find_team(conn, query: str) -> tuple:
    df = pd.read_sql("SELECT team_id, tricode, city, name FROM equipes", conn)
    df["full_name"] = df["city"] + " " + df["name"]
    needle = strip_accents(query)
    rows = df[
        df["tricode"].apply(lambda t: needle in strip_accents(t))
        | df["full_name"].apply(lambda n: needle in strip_accents(n))
    ]
    if rows.empty:
        raise SystemExit(f"Aucune equipe trouvee pour \"{query}\".")
    if len(rows) > 1:
        options = "\n".join(f"  {r.tricode}  {r.full_name}" for r in rows.itertuples())
        raise SystemExit(f"Plusieurs equipes correspondent a \"{query}\" :\n{options}")
    r = rows.iloc[0]
    return int(r.team_id), r.full_name


def build_context(conn, player_id: int, opponent_id, is_home: int, rest_days: int) -> dict:
    """Contexte du PROCHAIN match d'un joueur, a partir de ses 10 derniers
    matchs REELEMENT connus (meme principe que demo_pari_reel.py, generalise
    a toutes les stats -- superset de colonnes, chaque modele ne pioche que
    celles qu'il connait via son propre feature_cols)."""
    recent = pd.read_sql(
        """
        SELECT m.game_date, b.minutes, b.pts, b.reb, b.ast, b.fg3m, b.stl, b.blk,
               b.plus_minus, b.ftm, b.fta, b.fgm, b.fga, b.fg3a,
               a.ts_pct, a.usg_pct,
               f.games_played_season_avant
        FROM box_scores b
        JOIN matchs m ON m.game_id = b.game_id
        JOIN box_scores_advanced a ON a.game_id = b.game_id AND a.player_id = b.player_id
        JOIN features_joueur f ON f.game_id = b.game_id AND f.player_id = b.player_id
        WHERE b.player_id = ?
        ORDER BY m.game_date DESC LIMIT 10
        """,
        conn, params=(player_id,),
    )
    if recent.empty:
        raise SystemExit(f"Aucun match trouve en base pour ce joueur (player_id={player_id}).")
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
        "matchs_manques_depuis_dernier": 0,  # on simule le match juste apres le dernier connu
    }
    for stat, col in (
        ("pts", "pts"), ("reb", "reb"), ("ast", "ast"), ("fg3m", "fg3m"),
        ("stl", "stl"), ("blk", "blk"), ("min", "minutes_f"),
        ("fta", "fta"), ("fga", "fga"), ("fg3a", "fg3a"),
    ):
        context[f"{stat}_moy5"] = last5[col].mean()
        context[f"{stat}_moy10"] = recent[col].mean()

    # sommes brutes 10 matchs, pour les modeles de pourcentage (Binomial)
    context["ftm_sum10"], context["fta_sum10"] = recent["ftm"].sum(), recent["fta"].sum()
    context["fgm_sum10"], context["fga_sum10"] = recent["fgm"].sum(), recent["fga"].sum()
    context["fg3m_sum10"], context["fg3a_sum10"] = recent["fg3m"].sum(), recent["fg3a"].sum()

    if opponent_id is not None:
        vs_adv = pd.read_sql(
            """
            SELECT b.pts FROM box_scores b
            JOIN features_joueur f ON f.game_id = b.game_id AND f.player_id = b.player_id
            WHERE b.player_id = ? AND f.opponent_team_id = ?
            """,
            conn, params=(player_id, opponent_id),
        )
        context["vs_adversaire_pts_moy"] = vs_adv["pts"].mean() if not vs_adv.empty else np.nan
        context["vs_adversaire_nb_matchs"] = len(vs_adv)
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


def run_regression(bundle, context, ecarttypes, raw_col_key, seuil) -> tuple:
    cols = bundle["feature_cols"]
    X = pd.DataFrame([context])[cols]
    pred_mean = float(bundle["model"].predict(X)[0])
    distribution = bundle["distribution"]
    if distribution == "poisson":
        proba = 1 - poisson.cdf(seuil, mu=max(pred_mean, 0.01))
        detail = f"prediction moyenne = {pred_mean:.2f} (Poisson)"
    else:
        ect = ecarttypes.get(raw_col_key)
        scale = max(ect if pd.notna(ect) else bundle["resid_std"], MIN_SCALE)
        proba = 1 - norm.cdf(seuil, loc=pred_mean, scale=scale)
        detail = f"prediction moyenne = {pred_mean:.2f} (+/- {scale:.2f}, normale)"
    return float(proba), detail


def run_classifier(bundle, context) -> tuple:
    cols = bundle["feature_cols"]
    X = pd.DataFrame([context])[cols]
    proba = float(bundle["model"].predict_proba(X)[0, 1])
    return proba, "classification directe (predict_proba)"


def run_pct(bundle, context, seuil) -> tuple:
    cols = bundle["attempts_feature_cols"]
    X = pd.DataFrame([context])[cols]
    n_hat = max(round(float(bundle["attempts_model"].predict(X)[0])), 1)
    k = bundle["shrinkage_k"]
    league_avg = bundle["league_avg"]
    stat = bundle["target"].replace("_pct", "")
    makes_key = {"ft": "ftm_sum10", "fg": "fgm_sum10", "fg3": "fg3m_sum10"}[stat]
    attempts_key = {"ft": "fta_sum10", "fg": "fga_sum10", "fg3": "fg3a_sum10"}[stat]
    makes_sum, attempts_sum = context[makes_key], context[attempts_key]
    min_makes = math.floor(seuil * n_hat) + 1

    if bundle.get("distribution") == "beta_binomial":
        # Postérieur Beta complet gardé (pas écrasé à sa moyenne) — réduit le
        # résiduel de calibration sur cette stat, testé empiriquement
        # (projet-data-nba.md §19, train_pct_model.py BETABINOM_STATS).
        alpha_post = k * league_avg + makes_sum
        beta_post = k * (1 - league_avg) + (attempts_sum - makes_sum)
        proba = 1 - betabinom.cdf(min_makes - 1, n_hat, alpha_post, beta_post)
        p_hat = alpha_post / (alpha_post + beta_post)
        detail = (f"tentatives predites = {n_hat} | taux estime = {p_hat:.1%} (ligue: {league_avg:.1%}) "
                  f"[Beta-Binomial, incertitude sur le taux gardee]")
    else:
        p_hat = (makes_sum + k * league_avg) / (attempts_sum + k)
        proba = 1 - binom.cdf(min_makes - 1, n_hat, p_hat)
        detail = f"tentatives predites = {n_hat} | taux estime = {p_hat:.1%} (ligue: {league_avg:.1%})"
    return float(proba), detail


def resolve_stat(stat: str) -> tuple:
    """(famille, model_file, label, raw_col_key_ou_None) pour un code --stat."""
    if stat in REGRESSION_STATS:
        model_file, raw_col_key, label = REGRESSION_STATS[stat]
        return "regression", model_file, label, raw_col_key
    if stat in CLASSIFIER_STATS:
        model_file, label = CLASSIFIER_STATS[stat]
        return "classifier", model_file, label, None
    model_file, makes_col, attempts_col, label = PCT_STATS[stat]
    return "pct", model_file, label, None


def compute_proba(conn, player_id: int, stat: str, seuil, opponent_id=None, is_home: int = 1, rest_days: int = 2) -> dict:
    """Point d'entree partage CLI/API (raccordement appli, Phase 4 -- projet-
    data-nba.md §16) : construit le contexte a jour d'un joueur (10 derniers
    matchs REELS connus en base, meme fonction que le CLI) et calcule la
    proba pour n'importe lequel des 12 modeles. Leve ValueError si --seuil
    manque pour une stat qui en a besoin (les familles regression/pct)."""
    if stat not in REGRESSION_STATS and stat not in CLASSIFIER_STATS and stat not in PCT_STATS:
        raise ValueError(f"stat inconnue : {stat}")
    famille, model_file, label, raw_col_key = resolve_stat(stat)
    if famille != "classifier" and seuil is None:
        raise ValueError(f"seuil obligatoire pour la stat {stat}")

    context, ecarttypes, recent = build_context(conn, player_id, opponent_id, is_home=is_home, rest_days=rest_days)
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
        "contexte_periode": [str(recent["game_date"].min()), str(recent["game_date"].max())],
        "vs_adversaire_nb_matchs": context["vs_adversaire_nb_matchs"] if opponent_id is not None else None,
        "vs_adversaire_pts_moy": (
            None if opponent_id is None or pd.isna(context["vs_adversaire_pts_moy"])
            else float(context["vs_adversaire_pts_moy"])
        ),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    joueur_group = parser.add_mutually_exclusive_group(required=True)
    joueur_group.add_argument("--joueur", help="nom (partiel) du joueur, ex: \"Nikola Jokic\"")
    joueur_group.add_argument("--joueur-id", type=int, help="player_id exact (si le nom est ambigu)")
    parser.add_argument("--stat", required=True, choices=list(REGRESSION_STATS) + list(CLASSIFIER_STATS) + list(PCT_STATS))
    parser.add_argument("--seuil", type=float, help="seuil a tester (obligatoire sauf pour dd/td)")
    parser.add_argument("--adversaire", help="code/ville/nom d'equipe (n'affecte que --stat pts)")
    parser.add_argument("--exterieur", action="store_true", help="prochain match a l'exterieur (defaut: domicile)")
    parser.add_argument("--repos", type=int, default=2, help="jours de repos avant le prochain match (defaut: 2)")
    args = parser.parse_args()

    if args.stat not in CLASSIFIER_STATS and args.seuil is None:
        raise SystemExit(f"--seuil est obligatoire pour --stat {args.stat}")

    conn = sqlite3.connect(DB_PATH)

    if args.joueur_id is not None:
        player_id, player_name = args.joueur_id, f"player_id={args.joueur_id}"
    else:
        player_id, player_name = find_player(conn, args.joueur)

    opponent_id, opponent_name = None, None
    if args.adversaire:
        opponent_id, opponent_name = find_team(conn, args.adversaire)

    result = compute_proba(
        conn, player_id, args.stat, args.seuil,
        opponent_id=opponent_id, is_home=0 if args.exterieur else 1, rest_days=args.repos,
    )
    conn.close()

    print(f"=== {player_name} -- stat={args.stat} ===")
    periode_debut, periode_fin = result["contexte_periode"]
    print(f"Contexte : {result['contexte_matchs']} derniers matchs connus ({periode_debut} -> {periode_fin})"
          f" | domicile={'non' if args.exterieur else 'oui'} | repos={args.repos}j")
    if opponent_name:
        if result["vs_adversaire_nb_matchs"]:
            print(f"Historique vs {opponent_name} : {result['vs_adversaire_nb_matchs']} match(s), "
                  f"moyenne {result['vs_adversaire_pts_moy']:.1f} pts")
        else:
            print(f"Historique vs {opponent_name} : aucun match connu")

    print(f"\n{result['label']} -- {result['detail']}")
    if args.stat in PCT_STATS:
        print(f"P({result['label']} > {args.seuil:.0%}) = {result['proba']:.1%}")
    elif args.stat in CLASSIFIER_STATS:
        print(f"P({result['label']}) = {result['proba']:.1%}")
    else:
        print(f"P({result['label']} > {args.seuil}) = {result['proba']:.1%}")


if __name__ == "__main__":
    main()
