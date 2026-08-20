"""
2e modèle JETABLE : probabilité qu'un joueur fasse un double-double (et,
plus rare, un triple-double) sur un match. 2e catégorie la plus fréquente
des paris persos du classeur (projet-data-nba.md §8), et plus simple que le
modèle de points : le label est déjà 0/1 (labels_joueur.double_double/
triple_double), donc CLASSIFICATION directe — pas besoin de construire une
distribution ni un écart-type, `predict_proba` sort déjà une probabilité.

Principe (même squelette que train_points_model.py) :
- X = features_joueur (contexte AVANT le match)
- y = labels_joueur.double_double (ou .triple_double)
- Découpage TEMPOREL (pas aléatoire)
- RandomForestClassifier
- Calibration vérifiée par bucket de probabilité prédite (pas par seuil de
  stat comme pour les points, puisque la sortie EST déjà une proba).

Usage:
    python train_doubledouble_model.py
"""

import sqlite3
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import brier_score_loss, log_loss

SCRIPT_DIR = Path(__file__).resolve().parent
DB_PATH = SCRIPT_DIR.parent / "data" / "nba.db"
MODELS_DIR = SCRIPT_DIR.parent / "models"

FEATURE_COLS = [
    "pts_moy5", "pts_moy10",
    "reb_moy5", "reb_moy10",
    "ast_moy5", "ast_moy10",
    "min_moy5", "min_moy10",
    "is_home", "rest_days", "is_back_to_back", "games_played_season_avant",
    "ts_pct_moy5", "usg_pct_moy5",
    "plus_minus_moy5",
    "matchs_manques_depuis_dernier",
]

TEST_FRACTION = 0.2


def load_dataset(conn: sqlite3.Connection, target: str) -> pd.DataFrame:
    df = pd.read_sql(
        f"""
        SELECT f.game_id, f.player_id, f.game_date, {', '.join(FEATURE_COLS)},
               l.{target} AS y
        FROM features_joueur f
        JOIN labels_joueur l ON l.game_id = f.game_id AND l.player_id = f.player_id
        """,
        conn, dtype={"game_id": str},
    )
    df["game_date"] = pd.to_datetime(df["game_date"])
    df = df.dropna(subset=FEATURE_COLS + ["y"])
    return df.sort_values("game_date").reset_index(drop=True)


def temporal_split(df: pd.DataFrame, test_fraction: float):
    cutoff_idx = int(len(df) * (1 - test_fraction))
    cutoff_date = df["game_date"].iloc[cutoff_idx]
    train = df[df["game_date"] < cutoff_date]
    test = df[df["game_date"] >= cutoff_date]
    return train, test, cutoff_date


def calibration_by_bucket(y_true: np.ndarray, proba: np.ndarray, edges=(0, 0.05, 0.1, 0.2, 0.35, 0.5, 1.0)):
    """Regroupe les prédictions par tranche de probabilité prédite, compare
    au taux réel observé dans chaque tranche (calibration, pas un seuil fixe
    comme pour les points — ici la sortie EST déjà une proba)."""
    print("\nCalibration (tranche de proba prédite | n | proba moy. prédite | taux réel | écart) :")
    for lo, hi in zip(edges[:-1], edges[1:]):
        mask = (proba >= lo) & (proba < hi)
        n = mask.sum()
        if n == 0:
            continue
        print(f"  [{lo:.0%}-{hi:.0%}) : n={n:<5} proba moy. prédite = {proba[mask].mean():.1%}"
              f"  |  taux réel = {y_true[mask].mean():.1%}  |  écart = {proba[mask].mean() - y_true[mask].mean():+.1%}")


def run(target: str, label_fr: str):
    conn = sqlite3.connect(DB_PATH)
    df = load_dataset(conn, target)
    conn.close()

    print(f"\n{'=' * 60}\n{label_fr.upper()}\n{'=' * 60}")
    print(f"Dataset : {len(df)} lignes | taux de base : {df['y'].mean():.2%}")

    train, test, cutoff = temporal_split(df, TEST_FRACTION)
    print(f"Split temporel : {len(train)} train (< {cutoff.date()}) / {len(test)} test (>= {cutoff.date()})")

    X_train, y_train = train[FEATURE_COLS], train["y"]
    X_test, y_test = test[FEATURE_COLS], test["y"]

    # PAS de class_weight="balanced" ici : ça fausse la CALIBRATION de predict_proba
    # (le modèle apprendrait sur une distribution artificiellement 50/50 alors
    # que double-double/triple-double sont rares en réalité — trouvé le 20/08/2026
    # en repérant des probas prédites massivement surestimées, ~+40 à +60 points
    # de % d'écart avec le taux réel sur les tranches hautes).
    model = RandomForestClassifier(
        n_estimators=300, max_depth=8, min_samples_leaf=10,
        random_state=0, n_jobs=-1,
    )
    model.fit(X_train, y_train)

    proba_test = model.predict_proba(X_test)[:, 1]
    print(f"Log loss (test) : {log_loss(y_test, proba_test):.3f}  (référence taux constant : {log_loss(y_test, np.full(len(y_test), y_train.mean())):.3f})")
    print(f"Brier score (test) : {brier_score_loss(y_test, proba_test):.3f}  (référence taux constant : {brier_score_loss(y_test, np.full(len(y_test), y_train.mean())):.3f})")

    print("\nImportance des features :")
    for name, imp in sorted(zip(FEATURE_COLS, model.feature_importances_), key=lambda x: -x[1])[:8]:
        print(f"  {name:<28} {imp:.3f}")

    calibration_by_bucket(y_test.to_numpy(), proba_test)

    MODELS_DIR.mkdir(exist_ok=True)
    model_path = MODELS_DIR / f"{target}.joblib"
    joblib.dump({"model": model, "feature_cols": FEATURE_COLS, "target": target}, model_path)
    print(f"\nModèle sauvegardé : {model_path}")

    return model


def main():
    run("double_double", "Double-double")
    run("triple_double", "Triple-double")


if __name__ == "__main__":
    main()
