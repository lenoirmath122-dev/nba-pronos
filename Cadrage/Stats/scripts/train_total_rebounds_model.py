"""
Rebonds COMBINES du match (les 2 equipes additionnees) -- piece (a) du
chantier paris equipe, suite (GAPS_OUVERTS.md, 23/08/2026), 2e forme du pari
rebonds (a cote de train_team_rebounds_model.py, perspective "own/opp") --
demandee explicitement par l'utilisateur ("les deux ! ca dependra de
l'enonce"). Meme patron EXACT que train_total_points_model.py (regression +
residu normal, domicile/exterieur), mais avec les 4 features rebonds
ajoutees a build_features.py (reb_pour/reb_contre moy5/10) en plus des 21
BASE_FEATURE_COLS -- contrairement a total_points, qui n'en avait pas
besoin, la propre tendance au rebond de chaque equipe predit directement
son total combine.

Usage:
    python train_total_rebounds_model.py
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

# BASE_FEATURE_COLS + les 4 nouvelles features rebonds (build_features.py) --
# meme liste que OWN_BASE_FEATURE_COLS (train_team_rebounds_model.py), mais
# dupliquee home_*/away_* ici (pas own_*/opp_*) : ce modele-ci est symetrique
# match entier, comme total_points, pas une perspective par equipe.
TOTAL_REB_BASE_COLS = BASE_FEATURE_COLS + ["reb_pour_moy5", "reb_pour_moy10", "reb_contre_moy5", "reb_contre_moy10"]
FEATURE_COLS = [f"home_{c}" for c in TOTAL_REB_BASE_COLS] + [f"away_{c}" for c in TOTAL_REB_BASE_COLS]

TEST_FRACTION = 0.2
THRESHOLDS = (80, 85, 90, 95, 100, 105, 110)


def load_dataset(conn: sqlite3.Connection) -> pd.DataFrame:
    cols = ", ".join(FEATURE_COLS)
    df = pd.read_sql(
        f"SELECT game_id, game_date, {cols}, total_reb AS y_reel FROM entrainement_matchs",
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

    print(f"\n{'=' * 60}\nREBONDS COMBINES DU MATCH (total_reb)\n{'=' * 60}")
    print(f"Dataset : {len(df)} lignes | moyenne reelle : {df['y_reel'].mean():.1f}")

    train, test, cutoff = temporal_split(df, TEST_FRACTION)
    print(f"Split temporel : {len(train)} train (< {cutoff.date()}) / {len(test)} test (>= {cutoff.date()})")

    X_train, y_train = train[FEATURE_COLS], train["y_reel"]
    X_test, y_test = test[FEATURE_COLS], test["y_reel"]

    model = RandomForestRegressor(n_estimators=300, max_depth=8, min_samples_leaf=10, random_state=0, n_jobs=-1)
    model.fit(X_train, y_train)

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
    model_path = MODELS_DIR / "total_reb.joblib"
    joblib.dump(
        {
            "model": model,
            "feature_cols": FEATURE_COLS,
            "total_reb_base_cols": TOTAL_REB_BASE_COLS,
            "resid_std": resid_std,
            "target": "total_reb",
            "distribution": "normal",
        },
        model_path,
    )
    print(f"\nModele sauvegarde : {model_path}")

    return model


if __name__ == "__main__":
    main()
