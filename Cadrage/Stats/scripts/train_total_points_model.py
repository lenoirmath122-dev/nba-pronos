"""
Modele de points COMBINES d'un match (home_score + away_score) -- piece (a)
du chantier paris serie/equipe, cadree le 23/08/2026 avec l'utilisateur
(GAPS_OUVERTS.md) : 1er modele EQUIPE (pas JOUEUR), motive par l'exemple
d'origine de l'utilisateur ("un match depassera 200 points au total").

Reutilise BASE_FEATURE_COLS/FEATURE_COLS de train_home_win_model.py TELS
QUELS (meme jeu de 21 features home_*/away_*, meme raison d'exclure
victoires_pct_domicile_saison/exterieur_saison -- toujours NULL cote
"venue non jouee ce jour-la", deja identifie/corrige pour home_win) plutot
que de repartir de MATCH_FEATURE_COLS (build_targets.py, 23 colonnes brutes,
inclut les 2 colonnes problematiques) -- une seule liste "quelles features
comptent pour un match", pas de divergence entre les 2 modeles equipe.

Meme recette que train_stat_model.py (regression + residu normal) pour la
proba P(total_points > seuil) -- PAS de dispersion par equipe (pas
d'equivalent de {stat}_ecarttype10 calcule pour les equipes a ce jour),
repli direct sur l'ecart-type global du residu (meme principe que le
plancher MIN_SCALE quand aucune dispersion plus fine n'est disponible).

Usage:
    python train_total_points_model.py
"""

import sqlite3
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.stats import norm
from sklearn.metrics import mean_absolute_error, r2_score

from train_home_win_model import BASE_FEATURE_COLS, FEATURE_COLS  # noqa: E402
from tuning import tune_random_forest

SCRIPT_DIR = Path(__file__).resolve().parent
DB_PATH = SCRIPT_DIR.parent / "data" / "nba.db"
MODELS_DIR = SCRIPT_DIR.parent / "models"

TEST_FRACTION = 0.2
THRESHOLDS = (190, 200, 210, 220, 230, 240, 250)


def load_dataset(conn: sqlite3.Connection) -> pd.DataFrame:
    cols = ", ".join(FEATURE_COLS)
    df = pd.read_sql(
        f"SELECT game_id, game_date, {cols}, total_points AS y_reel FROM entrainement_matchs",
        conn, dtype={"game_id": str},
    )
    df["game_date"] = pd.to_datetime(df["game_date"])
    df = df.dropna(subset=FEATURE_COLS + ["y_reel"])
    return df.sort_values("game_date").reset_index(drop=True)


def temporal_split(df: pd.DataFrame, test_fraction: float):
    cutoff_idx = int(len(df) * (1 - test_fraction))
    cutoff_date = df["game_date"].iloc[cutoff_idx]
    return df[df["game_date"] < cutoff_date], df[df["game_date"] >= cutoff_date], cutoff_date


def proba_over(seuil, y_pred_mean, scale):
    return 1 - norm.cdf(seuil, loc=y_pred_mean, scale=scale)


def calibration_check(y_true, y_pred_mean, scale, thresholds):
    print("\nCalibration (seuil | proba moy. predite | taux reel | ecart) :")
    for seuil in thresholds:
        proba_pred = proba_over(seuil, y_pred_mean, scale)
        taux_reel = (y_true > seuil).mean()
        print(f"  > {seuil:>3} : proba moy. predite = {proba_pred.mean():.1%}"
              f"  |  taux reel = {taux_reel.mean():.1%}  |  ecart = {proba_pred.mean() - taux_reel.mean():+.1%}")


def main():
    conn = sqlite3.connect(DB_PATH)
    df = load_dataset(conn)
    conn.close()

    print(f"\n{'=' * 60}\nPOINTS COMBINES DU MATCH (total_points)\n{'=' * 60}")
    print(f"Dataset : {len(df)} lignes | moyenne reelle : {df['y_reel'].mean():.1f}")

    train, test, cutoff = temporal_split(df, TEST_FRACTION)
    print(f"Split temporel : {len(train)} train (< {cutoff.date()}) / {len(test)} test (>= {cutoff.date()})")

    X_train, y_train = train[FEATURE_COLS], train["y_reel"]
    X_test, y_test = test[FEATURE_COLS], test["y_reel"]

    model, best_params, _ = tune_random_forest(X_train, y_train, task="regressor")

    resid_std = float(np.std(y_train - model.predict(X_train)))
    test_pred = model.predict(X_test)

    mae = mean_absolute_error(y_test, test_pred)
    r2 = r2_score(y_test, test_pred)
    print(f"MAE (test) : {mae:.2f} | R² (test) : {r2:.3f} | ecart-type global du residu : {resid_std:.2f}")

    print("\nImportance des features (top 10) :")
    for name, imp in sorted(zip(FEATURE_COLS, model.feature_importances_), key=lambda x: -x[1])[:10]:
        print(f"  {name:<38} {imp:.3f}")

    calibration_check(y_test.to_numpy(), test_pred, resid_std, THRESHOLDS)

    MODELS_DIR.mkdir(exist_ok=True)
    model_path = MODELS_DIR / "total_points.joblib"
    joblib.dump(
        {
            "model": model,
            "feature_cols": FEATURE_COLS,
            "base_feature_cols": BASE_FEATURE_COLS,
            "resid_std": resid_std,
            "target": "total_points",
            "distribution": "normal",
            "tuned_params": best_params,
        },
        model_path,
    )
    print(f"\nModele sauvegarde : {model_path}")

    return model


if __name__ == "__main__":
    main()
