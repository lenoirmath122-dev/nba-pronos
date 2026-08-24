"""
Généralise train_points_model.py à 6 autres stats des paris persos
(projet-data-nba.md §8/§14) : rebonds, passes, 3-points réussis, contres,
interceptions, minutes jouées. MÊME recette exactement (RandomForestRegressor
+ dispersion propre au joueur via `{stat}_ecarttype10`, ajoutée dans
build_features.py en même temps que ce script) — pas dupliquée dans
train_points_model.py, qui reste le script de référence pour les points
(avec sa démo Jokić).

Contres/interceptions/minutes ajoutés le 20/08/2026 suite à un audit complet
du classeur : "Minutes jouées" (28 mentions) et "Contres"/"Interceptions"
(~11 mentions combinées) avaient été oubliés du 1er passage (seuls points/
rebonds/passes/3-points avaient été identifiés comme prioritaires).

Différence assumée avec les points : pas d'équivalent de
`vs_adversaire_pts_moy` (jamais calculé pour les autres stats) — les
prédicteurs sont la propre historique du joueur sur CETTE stat + le
contexte partagé (minutes, repos, etc.), sans historique face à
l'adversaire précis. Pour "minutes" elle-même, `min_moy5`/`min_moy10` sont
à la fois le prédicteur principal ET absents de SHARED_COLS (pas de sens de
prédire les minutes à partir d'elles-mêmes en doublon).

Distribution de proba PAR STAT (ajouté le 20/08/2026, vérifié empiriquement
avant d'être généralisé) : 3-points/interceptions/contres sont des stats
à faible valeur, très souvent exactement 0 — la distribution NORMALE
(symétrique) surestimait fortement P(stat > seuil bas) (+14 à +22 points de
%). Remplacée par une distribution de POISSON pour ces 3 stats (adaptée
aux compteurs d'événements rares) : écart ramené à ±1.4 points de %,
vérifié sur les mêmes prédictions du modèle (rien changé côté
RandomForest, juste la lecture de sa sortie). Pour rebonds/passes/minutes,
la normale (+ dispersion personnalisée par joueur) reste MEILLEURE que
Poisson — vérifié aussi avant de généraliser, pas de changement pour ces 3.

Usage:
    python train_stat_model.py
"""

import sqlite3
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.stats import norm, poisson
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score

SCRIPT_DIR = Path(__file__).resolve().parent
DB_PATH = SCRIPT_DIR.parent / "data" / "nba.db"
MODELS_DIR = SCRIPT_DIR.parent / "models"

# Stats à faible valeur/souvent nulles -> Poisson au lieu de la normale
# (vérifié empiriquement, cf. docstring). Toute stat absente de ce set garde
# la normale + dispersion personnalisée par joueur (déjà bonne pour elles).
# "oreb" ajoutee le 23/08/2026 (extension "faciles") : meme profil que fg3m/
# stl/blk (moyenne ~1, mediane 1, 25e percentile 0) -- Poisson essaye
# directement plutot que normale, a reverifier empiriquement comme les 3
# autres (calibration_check ci-dessous).
POISSON_STATS = {"fg3m", "stl", "blk", "oreb"}

SHARED_COLS = [
    "min_moy5", "min_moy10",
    "is_home", "rest_days", "is_back_to_back", "games_played_season_avant",
    "ts_pct_moy5", "usg_pct_moy5",
    "plus_minus_moy5",
    "matchs_manques_depuis_dernier",
]

TEST_FRACTION = 0.2
MIN_SCALE = 0.5  # plancher, plus bas que pour les points (les autres stats ont des valeurs plus petites)


def feature_cols_for(stat: str) -> list:
    own = [f"{stat}_moy5", f"{stat}_moy10"]
    shared = [c for c in SHARED_COLS if not c.startswith(f"{stat}_")]
    return own + shared


def load_dataset(conn: sqlite3.Connection, stat: str, label_col: str) -> pd.DataFrame:
    cols = feature_cols_for(stat)
    df = pd.read_sql(
        f"""
        SELECT f.game_id, f.player_id, f.game_date, f.{stat}_ecarttype10 AS ecarttype10,
               {', '.join(cols)}, l.{label_col} AS y_reel
        FROM features_joueur f
        JOIN labels_joueur l ON l.game_id = f.game_id AND l.player_id = f.player_id
        """,
        conn, dtype={"game_id": str},
    )
    df["game_date"] = pd.to_datetime(df["game_date"])
    df = df.dropna(subset=cols + ["y_reel"])
    return df.sort_values("game_date").reset_index(drop=True)


def player_scale(ecarttype10: pd.Series, global_std: float) -> np.ndarray:
    return ecarttype10.fillna(global_std).clip(lower=MIN_SCALE).to_numpy()


def temporal_split(df: pd.DataFrame, test_fraction: float):
    cutoff_idx = int(len(df) * (1 - test_fraction))
    cutoff_date = df["game_date"].iloc[cutoff_idx]
    return df[df["game_date"] < cutoff_date], df[df["game_date"] >= cutoff_date], cutoff_date


def proba_over(seuil, y_pred_mean, scale, distribution: str):
    if distribution == "poisson":
        return 1 - poisson.cdf(seuil, mu=np.clip(y_pred_mean, 0.01, None))
    return 1 - norm.cdf(seuil, loc=y_pred_mean, scale=scale)


def calibration_check(y_true, y_pred_mean, scale, thresholds, distribution: str):
    print(f"\nCalibration [{distribution}] (seuil | proba moy. prédite | taux réel | écart) :")
    for seuil in thresholds:
        proba_pred = proba_over(seuil, y_pred_mean, scale, distribution)
        taux_reel = (y_true > seuil).mean()
        print(f"  > {seuil:>2} : proba moy. prédite = {proba_pred.mean():.1%}"
              f"  |  taux réel = {taux_reel:.1%}  |  écart = {proba_pred.mean() - taux_reel:+.1%}")


def run(stat: str, label_fr: str, thresholds: tuple, label_col: str = None):
    label_col = label_col or stat
    cols = feature_cols_for(stat)
    conn = sqlite3.connect(DB_PATH)
    df = load_dataset(conn, stat, label_col)
    conn.close()

    print(f"\n{'=' * 60}\n{label_fr.upper()}\n{'=' * 60}")
    print(f"Dataset : {len(df)} lignes | moyenne réelle : {df['y_reel'].mean():.2f}")

    train, test, cutoff = temporal_split(df, TEST_FRACTION)
    print(f"Split temporel : {len(train)} train (< {cutoff.date()}) / {len(test)} test (>= {cutoff.date()})")

    model = RandomForestRegressor(n_estimators=300, max_depth=8, min_samples_leaf=10, random_state=0, n_jobs=-1)
    model.fit(train[cols], train["y_reel"])

    resid_std = float(np.std(train["y_reel"] - model.predict(train[cols])))
    test_pred = model.predict(test[cols])

    mae = mean_absolute_error(test["y_reel"], test_pred)
    r2 = r2_score(test["y_reel"], test_pred)
    print(f"MAE (test) : {mae:.2f} | R² (test) : {r2:.3f} | écart-type global de repli : {resid_std:.2f}")

    print("\nImportance des features :")
    for name, imp in sorted(zip(cols, model.feature_importances_), key=lambda x: -x[1])[:6]:
        print(f"  {name:<28} {imp:.3f}")

    distribution = "poisson" if stat in POISSON_STATS else "normal"
    test_scale = player_scale(test["ecarttype10"], resid_std)
    calibration_check(test["y_reel"].to_numpy(), test_pred, test_scale, thresholds, distribution)

    MODELS_DIR.mkdir(exist_ok=True)
    model_path = MODELS_DIR / f"{stat}.joblib"
    joblib.dump(
        {"model": model, "feature_cols": cols, "resid_std": resid_std, "target": stat, "distribution": distribution},
        model_path,
    )
    print(f"Modèle sauvegardé : {model_path} (distribution: {distribution})")


def main():
    run("reb", "Rebonds", thresholds=(5, 8, 10, 12, 15))
    run("ast", "Passes décisives", thresholds=(3, 5, 8, 10, 12))
    run("fg3m", "3-points réussis", thresholds=(1, 2, 3, 4, 5))
    run("stl", "Interceptions", thresholds=(1, 2, 3, 4))
    run("blk", "Contres", thresholds=(1, 2, 3))
    run("min", "Minutes jouées", thresholds=(15, 20, 25, 30, 35), label_col="minutes")
    # ajoutees le 23/08/2026 (extension "faciles",
    # types_de_paris_playoffs_2026.md, categorie "Tentatives joueur")
    run("fga", "Tirs tentés", thresholds=(8, 12, 15, 18, 21))
    run("fg3a", "Tirs à 3-points tentés", thresholds=(3, 5, 7, 9, 11))
    run("oreb", "Rebonds offensifs", thresholds=(1, 2, 3, 4, 5))
    # ajoutee le 24/08/2026 (chantier "petits gains groupes", GAPS_OUVERTS.md,
    # categorie "+/- comme stat pariable") -- plus_minus_moy5/10 deja
    # calculees (feature partagee par d'autres modeles), seul l'ecart-type
    # (plus_minus_ecarttype10, build_features.py) et la cible manquaient.
    run("plus_minus", "+/-", thresholds=(-10, -5, 0, 5, 10))


if __name__ == "__main__":
    main()
