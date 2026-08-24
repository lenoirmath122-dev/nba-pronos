"""
Probabilité qu'UN match donné aille en prolongation -- chantier "prolongation"
(7 paris de types_de_paris_playoffs_2026.md, classé "nouveau mécanisme
réutilisable" même tier que comparaison/combo, GAPS_OUVERTS.md, 24/08/2026).
MATCH uniquement (pas SÉRIE), même limite que total_points/home_win.

Même squelette EXACT que train_home_win_model.py (classification directe au
niveau MATCH, mêmes BASE_FEATURE_COLS/FEATURE_COLS home_*/away_*, split
temporel, RandomForestClassifier) -- SEULE différence : la cible
(`went_to_ot` au lieu de `home_win`) et les tranches de calibration, resserrées
vers le bas comme train_doubledouble_model.py (événement rare, PAS
class_weight="balanced" -- précédent trouvé le 20/08/2026 sur dd/td :
"balanced" fausse la calibration de predict_proba, probas massivement
surestimées, +40 à +60pp d'écart sur les tranches hautes).

Cible construite dans build_targets.py::build_matchs_training() depuis
play_by_play.period (MAX > 4 = prolongation jouée) -- jamais synchronisé vers
Supabase, pas nécessaire pour l'entraînement LOCAL (le signal de PRODUCTION,
lui, vient de state.score.homeTeam/awayTeam côté TS, pas de play_by_play).

Usage:
    python train_overtime_model.py
"""

import sqlite3
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import brier_score_loss, log_loss

from train_home_win_model import BASE_FEATURE_COLS

SCRIPT_DIR = Path(__file__).resolve().parent
DB_PATH = SCRIPT_DIR.parent / "data" / "nba.db"
MODELS_DIR = SCRIPT_DIR.parent / "models"

FEATURE_COLS = [f"home_{c}" for c in BASE_FEATURE_COLS] + [f"away_{c}" for c in BASE_FEATURE_COLS]

TEST_FRACTION = 0.2


def load_dataset(conn: sqlite3.Connection) -> pd.DataFrame:
    cols = ", ".join(FEATURE_COLS)
    df = pd.read_sql(
        f"SELECT game_id, game_date, {cols}, went_to_ot AS y FROM entrainement_matchs",
        conn, dtype={"game_id": str},
    )
    df["game_date"] = pd.to_datetime(df["game_date"])
    df = df.dropna(subset=FEATURE_COLS + ["y"])
    df["y"] = df["y"].astype(int)
    return df.sort_values("game_date").reset_index(drop=True)


def temporal_split(df: pd.DataFrame, test_fraction: float):
    cutoff_idx = int(len(df) * (1 - test_fraction))
    cutoff_date = df["game_date"].iloc[cutoff_idx]
    train = df[df["game_date"] < cutoff_date]
    test = df[df["game_date"] >= cutoff_date]
    return train, test, cutoff_date


def calibration_by_bucket(y_true: np.ndarray, proba: np.ndarray, edges=(0, 0.03, 0.05, 0.08, 0.12, 0.2, 1.0)):
    """Tranches resserrées vers le bas -- même principe que
    train_doubledouble_model.py -- taux de base attendu nettement plus bas
    qu'un double-double (prolongation rare en NBA), à confirmer par les
    vrais chiffres avant toute conclusion."""
    print("\nCalibration (tranche de proba prédite | n | proba moy. prédite | taux réel | écart) :")
    for lo, hi in zip(edges[:-1], edges[1:]):
        mask = (proba >= lo) & (proba < hi)
        n = mask.sum()
        if n == 0:
            continue
        print(f"  [{lo:.0%}-{hi:.0%}) : n={n:<5} proba moy. prédite = {proba[mask].mean():.1%}"
              f"  |  taux réel = {y_true[mask].mean():.1%}  |  écart = {proba[mask].mean() - y_true[mask].mean():+.1%}")


def main():
    conn = sqlite3.connect(DB_PATH)
    df = load_dataset(conn)
    conn.close()

    print(f"\n{'=' * 60}\nPROBA DE PROLONGATION (par match)\n{'=' * 60}")
    print(f"Dataset : {len(df)} lignes | taux de base (prolongation) : {df['y'].mean():.2%}")

    train, test, cutoff = temporal_split(df, TEST_FRACTION)
    print(f"Split temporel : {len(train)} train (< {cutoff.date()}) / {len(test)} test (>= {cutoff.date()})")

    X_train, y_train = train[FEATURE_COLS], train["y"]
    X_test, y_test = test[FEATURE_COLS], test["y"]

    # PAS de class_weight="balanced" (même raison que train_doubledouble_
    # model.py, événement rare -- voir docstring du module).
    model = RandomForestClassifier(
        n_estimators=300, max_depth=8, min_samples_leaf=10,
        random_state=0, n_jobs=-1,
    )
    model.fit(X_train, y_train)

    proba_test = model.predict_proba(X_test)[:, 1]
    print(f"Log loss (test) : {log_loss(y_test, proba_test):.3f}  (référence taux constant : {log_loss(y_test, np.full(len(y_test), y_train.mean())):.3f})")
    print(f"Brier score (test) : {brier_score_loss(y_test, proba_test):.3f}  (référence taux constant : {brier_score_loss(y_test, np.full(len(y_test), y_train.mean())):.3f})")

    print("\nImportance des features (top 10) :")
    for name, imp in sorted(zip(FEATURE_COLS, model.feature_importances_), key=lambda x: -x[1])[:10]:
        print(f"  {name:<38} {imp:.3f}")

    calibration_by_bucket(y_test.to_numpy(), proba_test)

    MODELS_DIR.mkdir(exist_ok=True)
    model_path = MODELS_DIR / "overtime.joblib"
    joblib.dump({"model": model, "feature_cols": FEATURE_COLS, "target": "went_to_ot"}, model_path)
    print(f"\nModèle sauvegardé : {model_path}")

    return model


if __name__ == "__main__":
    main()
