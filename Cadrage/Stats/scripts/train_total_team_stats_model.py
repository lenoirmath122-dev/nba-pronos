"""
Generalise train_total_rebounds_model.py a ast/fg3m/stl/blk (23/08/2026,
chantier paris equipe piece (a) suite -- rebonds fait 1er comme pilote,
MEME recette exactement generalisee ici, pas dupliquee) : stat COMBINEE du
match (les 2 equipes additionnees), regression + residu normal, domicile/
exterieur.

Usage:
    python train_total_team_stats_model.py
"""

import sqlite3
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.stats import norm
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score

from train_home_win_model import BASE_FEATURE_COLS  # noqa: E402

SCRIPT_DIR = Path(__file__).resolve().parent
DB_PATH = SCRIPT_DIR.parent / "data" / "nba.db"
MODELS_DIR = SCRIPT_DIR.parent / "models"

TEST_FRACTION = 0.2

# (stat, libellé FR, seuils de calibration) -- reb deja fait a part
# (train_total_rebounds_model.py), pas repris ici.
STATS_TO_TRAIN = [
    ("ast", "Passes décisives", (35, 40, 45, 50, 55, 60)),
    ("fg3m", "3-points réussis", (18, 22, 26, 30, 34)),
    ("stl", "Interceptions", (10, 13, 16, 19, 22)),
    ("blk", "Contres", (6, 9, 12, 15, 18)),
]


def feature_cols_for(stat: str) -> tuple[list, list]:
    base_cols = BASE_FEATURE_COLS + [f"{stat}_pour_moy5", f"{stat}_pour_moy10", f"{stat}_contre_moy5", f"{stat}_contre_moy10"]
    return base_cols, [f"home_{c}" for c in base_cols] + [f"away_{c}" for c in base_cols]


def load_dataset(conn: sqlite3.Connection, stat: str, feature_cols: list) -> pd.DataFrame:
    cols = ", ".join(feature_cols)
    df = pd.read_sql(
        f"SELECT game_id, game_date, {cols}, total_{stat} AS y_reel FROM entrainement_matchs",
        conn, dtype={"game_id": str},
    )
    df["game_date"] = pd.to_datetime(df["game_date"])
    df = df.dropna(subset=feature_cols + ["y_reel"])
    return df.sort_values("game_date").reset_index(drop=True)


def temporal_split(df: pd.DataFrame, test_fraction: float):
    cutoff_idx = int(len(df) * (1 - test_fraction))
    cutoff_date = df["game_date"].iloc[cutoff_idx]
    return df[df["game_date"] < cutoff_date], df[df["game_date"] >= cutoff_date], cutoff_date


def proba_over(seuil, y_pred_mean, scale):
    return 1 - norm.cdf(seuil, loc=y_pred_mean, scale=scale)


def calibration_check(y_true, y_pred_mean, scale, thresholds):
    print("Calibration (seuil | proba moy. predite | taux reel | ecart) :")
    for seuil in thresholds:
        proba_pred = proba_over(seuil, y_pred_mean, scale)
        taux_reel = (y_true > seuil).mean()
        print(f"  > {seuil:>3} : proba moy. predite = {proba_pred.mean():.1%}"
              f"  |  taux reel = {taux_reel.mean():.1%}  |  ecart = {proba_pred.mean() - taux_reel.mean():+.1%}")


def run(stat: str, label_fr: str, thresholds: tuple):
    base_cols, feature_cols = feature_cols_for(stat)
    conn = sqlite3.connect(DB_PATH)
    df = load_dataset(conn, stat, feature_cols)
    conn.close()

    print(f"\n{'=' * 60}\n{label_fr.upper()} COMBINES DU MATCH (total_{stat})\n{'=' * 60}")
    print(f"Dataset : {len(df)} lignes | moyenne reelle : {df['y_reel'].mean():.1f}")

    train, test, cutoff = temporal_split(df, TEST_FRACTION)
    print(f"Split temporel : {len(train)} train (< {cutoff.date()}) / {len(test)} test (>= {cutoff.date()})")

    X_train, y_train = train[feature_cols], train["y_reel"]
    X_test, y_test = test[feature_cols], test["y_reel"]

    model = RandomForestRegressor(n_estimators=300, max_depth=8, min_samples_leaf=10, random_state=0, n_jobs=-1)
    model.fit(X_train, y_train)

    resid_std = float(np.std(y_train - model.predict(X_train)))
    test_pred = model.predict(X_test)

    mae = mean_absolute_error(y_test, test_pred)
    r2 = r2_score(y_test, test_pred)
    print(f"MAE (test) : {mae:.2f} | R² (test) : {r2:.3f} | ecart-type global du residu : {resid_std:.2f}")

    calibration_check(y_test.to_numpy(), test_pred, resid_std, thresholds)

    MODELS_DIR.mkdir(exist_ok=True)
    model_path = MODELS_DIR / f"total_{stat}.joblib"
    joblib.dump(
        {
            "model": model,
            "feature_cols": feature_cols,
            "total_base_cols": base_cols,
            "resid_std": resid_std,
            "target": f"total_{stat}",
            "distribution": "normal",
        },
        model_path,
    )
    print(f"Modele sauvegarde : {model_path}")


def main():
    for stat, label_fr, thresholds in STATS_TO_TRAIN:
        run(stat, label_fr, thresholds)


if __name__ == "__main__":
    main()
