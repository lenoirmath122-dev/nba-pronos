"""
Generalise train_team_rebounds_model.py a ast/fg3m/stl/blk (23/08/2026,
chantier paris equipe piece (a) suite -- rebonds fait 1er comme pilote,
MEME recette exactement generalisee ici, pas dupliquee) : stat d'une
equipe PRECISE sur UN match, perspective "own"/"opp" (pas domicile/
exterieur) -- entraine sur entrainement_equipe.

Usage:
    python train_team_stats_model.py
"""

import sqlite3
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.stats import norm
from sklearn.metrics import mean_absolute_error, r2_score

from train_home_win_model import BASE_FEATURE_COLS  # noqa: E402
from tuning import tune_random_forest

SCRIPT_DIR = Path(__file__).resolve().parent
DB_PATH = SCRIPT_DIR.parent / "data" / "nba.db"
MODELS_DIR = SCRIPT_DIR.parent / "models"

TEST_FRACTION = 0.2

# (stat, libellé FR, seuils de calibration) -- reb deja fait a part
# (train_team_rebounds_model.py), pas repris ici. "pts" ajoutee le
# 23/08/2026 (extension "faciles", types_de_paris_playoffs_2026.md,
# categorie "Points equipe") -- manquait la perspective own/opp d'UNE
# equipe precise (total_points ne couvre que le combine domicile/exterieur).
STATS_TO_TRAIN = [
    ("pts", "Points", (95, 100, 105, 110, 115, 120)),
    ("ast", "Passes décisives", (18, 21, 24, 27, 30)),
    ("fg3m", "3-points réussis", (9, 11, 13, 15, 17)),
    ("stl", "Interceptions", (5, 6, 7, 8, 9)),
    ("blk", "Contres", (3, 4, 5, 6, 7)),
    ("oreb", "Rebonds offensifs", (8, 10, 12, 14, 16)),
    # "fga" ajoutee le 24/08/2026 (chantier "petits gains groupes",
    # GAPS_OUVERTS.md, categorie "Comparaison volume tirs") -- fga_pour/
    # contre_moy5/10 (features) ET fga_reel (label, entrainement_equipe)
    # deja presents depuis le chantier "% tir equipe" (24/08/2026), jamais
    # entraine comme cible directe jusqu'ici.
    ("fga", "Tirs tentés", (75, 80, 85, 90, 95)),
    # "tov" ajoutee le 06/09/2026 (GAPS_OUVERTS.md, "pertes de balle" --
    # demandee explicitement par l'utilisateur en testant "Les Warriors
    # font au moins 5 pertes de balle").
    ("tov", "Pertes de balle", (10, 12, 14, 16, 18)),
]


def feature_cols_for(stat: str) -> tuple[list, list]:
    # dedup (23/08/2026, cas "pts") : pts_pour/contre_moy5/10 sont DEJA dans
    # BASE_FEATURE_COLS (utilisees par home_win/total_points depuis le
    # debut) -- contrairement a reb/ast/fg3m/stl/blk, les rajouter dupliquerait
    # les colonnes (X[feature_cols] casserait avec des noms en double).
    extra = [f"{stat}_pour_moy5", f"{stat}_pour_moy10", f"{stat}_contre_moy5", f"{stat}_contre_moy10"]
    own_base_cols = BASE_FEATURE_COLS + [c for c in extra if c not in BASE_FEATURE_COLS]
    feature_cols = ["own_is_home"] + [f"own_{c}" for c in own_base_cols] + [f"opp_{c}" for c in own_base_cols]
    return own_base_cols, feature_cols


def load_dataset(conn: sqlite3.Connection, stat: str, feature_cols: list) -> pd.DataFrame:
    cols = ", ".join(feature_cols)
    df = pd.read_sql(
        f"SELECT game_id, team_id, game_date, {cols}, {stat}_reel AS y_reel FROM entrainement_equipe",
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
    own_base_cols, feature_cols = feature_cols_for(stat)
    conn = sqlite3.connect(DB_PATH)
    df = load_dataset(conn, stat, feature_cols)
    conn.close()

    print(f"\n{'=' * 60}\n{label_fr.upper()} D'EQUIPE (perspective own/opp, {stat})\n{'=' * 60}")
    print(f"Dataset : {len(df)} lignes | moyenne reelle : {df['y_reel'].mean():.1f}")

    train, test, cutoff = temporal_split(df, TEST_FRACTION)
    print(f"Split temporel : {len(train)} train (< {cutoff.date()}) / {len(test)} test (>= {cutoff.date()})")

    X_train, y_train = train[feature_cols], train["y_reel"]
    X_test, y_test = test[feature_cols], test["y_reel"]

    model, best_params, _ = tune_random_forest(X_train, y_train, task="regressor")

    resid_std = float(np.std(y_train - model.predict(X_train)))
    test_pred = model.predict(X_test)

    mae = mean_absolute_error(y_test, test_pred)
    r2 = r2_score(y_test, test_pred)
    print(f"MAE (test) : {mae:.2f} | R² (test) : {r2:.3f} | ecart-type global du residu : {resid_std:.2f}")

    calibration_check(y_test.to_numpy(), test_pred, resid_std, thresholds)

    MODELS_DIR.mkdir(exist_ok=True)
    model_path = MODELS_DIR / f"team_{stat}.joblib"
    joblib.dump(
        {
            "model": model,
            "feature_cols": feature_cols,
            "own_base_feature_cols": own_base_cols,
            "resid_std": resid_std,
            "target": f"team_{stat}",
            "distribution": "normal",
            "tuned_params": best_params,
        },
        model_path,
    )
    print(f"Modele sauvegarde : {model_path}")


def main():
    for stat, label_fr, thresholds in STATS_TO_TRAIN:
        run(stat, label_fr, thresholds)


if __name__ == "__main__":
    main()
