"""
Calibration des seuils proba -> palier de difficulte (SPEC_TECHNIQUE_PROBA_
PARIS_PERSOS_V0_1.md §7 point 2, lib/ai/difficultyTiers.ts). Les seuils en
prod (80/60/40/20%) etaient provisoires, poses "a vue de nez" faute d'assez
de vrais paris joueurs en base (3 seulement au 21/08/2026 -- bien trop peu
pour observer une vraie distribution).

Principe : au lieu d'attendre du volume reel, on simule un grand echantillon
de paris plausibles avec le moteur de proba lui-meme (meme compute_proba()
que l'app), sur une large base de joueurs reels et un eventail de seuils
relatifs a la moyenne recente de chaque joueur (ce qu'un joueur du jeu
parierait vraiment : pres de la moyenne, ou en "stretch"). On calcule ensuite
les quintiles (20/40/60/80%) de la distribution de probas obtenue -> ce sont
les nouveaux seuils de palier, bases sur la vraie forme de la distribution
plutot que sur une intuition.

Usage:
    python calibrate_difficulty_thresholds.py
    python calibrate_difficulty_thresholds.py --echantillon 200
"""

import argparse
import random
import sqlite3
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tester_modele import (
    CLASSIFIER_STATS,
    DB_PATH,
    MODELS_DIR,
    PCT_STATS,
    REGRESSION_STATS,
    build_context,
    run_classifier,
    run_pct,
    run_regression,
)

# offsets relatifs a la moyenne 5 matchs du joueur -- simule des paris
# "pres de la moyenne" (offsets proches de 0) et des paris "stretch"
# (offsets loin de 0), dans les deux sens (over facile / over difficile)
REGRESSION_OFFSETS = [-0.35, -0.20, -0.08, 0.0, 0.08, 0.20, 0.35, 0.55]

# seuils REALISTES par stat de pourcentage -- un seul jeu de seuils (0.5-0.9)
# pour ft/fg/fg3 fausse la calibration (bug trouve en verifiant Curry a 3pts,
# 21/08/2026) : la ligue tourne a ~78% aux lancers francs mais ~47% au tir et
# ~36% a 3-points (league_avg des modeles), donc tester "fg > 90%" ou
# "fg3 > 90%" simule un pari quasi IMPOSSIBLE pour n'importe quel joueur,
# tirant toute la distribution simulee vers le bas pour ces 2 stats. Chaque
# liste est calee sur la moyenne ligue reelle de la stat (voir league_avg
# dans models/{stat}_pct.joblib), avec le meme etalement bas/pres/haut que
# REGRESSION_OFFSETS.
PCT_THRESHOLDS = {
    "ft": [0.55, 0.65, 0.75, 0.80, 0.85, 0.90, 0.95],
    "fg": [0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65],
    "fg3": [0.20, 0.28, 0.33, 0.36, 0.40, 0.45, 0.50],
}

RAW_COL_BY_STAT = {stat: raw_col for stat, (_, raw_col, _) in REGRESSION_STATS.items()}


def eligible_players(conn, min_matchs=10):
    df = pd.read_sql(
        """
        SELECT b.player_id, COUNT(*) as n
        FROM box_scores b
        GROUP BY b.player_id
        HAVING n >= ?
        """,
        conn, params=(min_matchs,),
    )
    return df["player_id"].tolist()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--echantillon", type=int, default=None, help="nombre de joueurs a echantillonner (defaut: tous)")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PATH)
    players = eligible_players(conn)
    random.seed(args.seed)
    if args.echantillon and args.echantillon < len(players):
        players = random.sample(players, args.echantillon)
    print(f"Joueurs echantillonnes : {len(players)}")

    bundles = {}
    for stat_map in (REGRESSION_STATS, CLASSIFIER_STATS, PCT_STATS):
        for stat, entry in stat_map.items():
            model_file = entry[0]
            if model_file not in bundles:
                bundles[model_file] = joblib.load(MODELS_DIR / f"{model_file}.joblib")

    probas = []
    probas_par_stat = {stat: [] for stat in list(REGRESSION_STATS) + list(CLASSIFIER_STATS) + list(PCT_STATS)}

    for i, player_id in enumerate(players):
        try:
            context, ecarttypes, recent = build_context(conn, player_id, opponent_id=None, is_home=1, rest_days=2)
        except SystemExit:
            continue

        for stat, (model_file, raw_col, _label) in REGRESSION_STATS.items():
            bundle = bundles[model_file]
            mean5 = context.get(f"{stat}_moy5")
            if mean5 is None or pd.isna(mean5) or mean5 <= 0:
                continue
            for offset in REGRESSION_OFFSETS:
                seuil = max(mean5 * (1 + offset), 0)
                proba, _ = run_regression(bundle, context, ecarttypes, raw_col, seuil)
                probas.append(proba)
                probas_par_stat[stat].append(proba)

        for stat, (model_file, _label) in CLASSIFIER_STATS.items():
            bundle = bundles[model_file]
            proba, _ = run_classifier(bundle, context)
            probas.append(proba)
            probas_par_stat[stat].append(proba)

        for stat, (model_file, _makes, _attempts, _label) in PCT_STATS.items():
            bundle = bundles[model_file]
            for seuil in PCT_THRESHOLDS[stat]:
                proba, _ = run_pct(bundle, context, seuil)
                probas.append(proba)
                probas_par_stat[stat].append(proba)

        if (i + 1) % 100 == 0:
            print(f"  ... {i + 1}/{len(players)} joueurs traites")

    conn.close()

    arr = np.array(probas)
    print(f"\nEchantillon total de probas simulees : {len(arr)}")
    print(f"min={arr.min():.1%}  max={arr.max():.1%}  moyenne={arr.mean():.1%}  mediane={np.median(arr):.1%}")

    quintiles = np.quantile(arr, [0.2, 0.4, 0.6, 0.8])
    print("\nQuintiles observes (20/40/60/80e percentile) :")
    for q, v in zip([20, 40, 60, 80], quintiles):
        print(f"  {q}e percentile -> proba = {v:.1%}")

    print("\nNouveaux seuils proposes (palier 1 = facile/peu de points -> palier 5 = improbable/beaucoup de points) :")
    print("  Rappel : palier BAS = proba HAUTE (pari facile a gagner) -- ordre decroissant de proba.")
    p80, p60, p40, p20 = np.quantile(arr, [0.8, 0.6, 0.4, 0.2])
    print(f"  palier 1 (facile)      : proba >= {p80:.1%}")
    print(f"  palier 2               : proba >= {p60:.1%}")
    print(f"  palier 3               : proba >= {p40:.1%}")
    print(f"  palier 4               : proba >= {p20:.1%}")
    print(f"  palier 5 (improbable)  : proba <  {p20:.1%}")

    print("\nPar stat (moyenne des probas simulees, pour verifier qu'aucune stat ne domine anormalement) :")
    for stat, vals in probas_par_stat.items():
        if vals:
            print(f"  {stat:6s} n={len(vals):5d}  moyenne={np.mean(vals):.1%}")


if __name__ == "__main__":
    main()
