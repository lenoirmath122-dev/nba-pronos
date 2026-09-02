"""
Modèles "pari période" équipe (7e-jusqu'ici-6e chantier de la liste des 429
paris, cadré le 24/08/2026, GAPS_OUVERTS.md) -- 6 modèles, un par famille
d'outcome_kind (même principe "un classifieur/régresseur dédié par famille"
que overtime/team_pct, décidé avec l'utilisateur avant de coder) :

  - period_margin.joblib          : régression, écart CUMULATIF (depuis le
                                     début du match) à la fin d'une période.
  - period_total_points.joblib    : régression, points combinés PENDANT une
                                     période (segment, pas cumulatif).
  - period_quarter_winner.joblib  : classification binaire, l'équipe visée
                                     remporte-t-elle CETTE période (segment).
  - period_point_share.joblib     : régression, fraction des points TOTAUX
                                     du match marqués par l'équipe visée sur
                                     cette période.
  - period_quarters_won_count.joblib : classification MULTI-CLASSE (0-4),
                                     nombre de quarts-temps remportés sur le
                                     match entier -- pas de notion de
                                     période unique.
  - period_leads_half_result.joblib  : classification 3 CLASSES
                                     (NOT_LEADING/WINS/LOSES) -- cible JOINTE
                                     entraînée DIRECTEMENT (pas composée via
                                     indépendance comme COMBO) : mener à la
                                     mi-temps et gagner le match sont
                                     fortement corrélés, une composition
                                     indépendante donnerait une proba fausse.

4 des 6 modèles (margin/total_points/quarter_winner/point_share) sont
GÉNÉRALISÉS par période via un one-hot `period_Q1..period_H2` ajouté aux
features -- UN SEUL modèle pooled sur les 6 périodes plutôt que 6 modèles
dédiés, même philosophie que /predict-team-stat (paramètre `stat`).

Cibles construites dans build_targets.py (entrainement_periode_match,
entrainement_periode_equipe, colonnes own_quarters_won_count/
own_half_outcome de entrainement_equipe) -- reconstruites depuis
play_by_play.score_home/score_away local, jamais synchronisées vers
Supabase (même principe que went_to_ot : signal de PRODUCTION vient de
matches.quarter_scores côté TS, pas de play_by_play).

Usage:
    python train_period_model.py
"""

import sqlite3
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.stats import norm
from sklearn.metrics import brier_score_loss, log_loss, mean_absolute_error, r2_score

from train_home_win_model import BASE_FEATURE_COLS, FEATURE_COLS  # noqa: E402
from tuning import tune_random_forest

SCRIPT_DIR = Path(__file__).resolve().parent
DB_PATH = SCRIPT_DIR.parent / "data" / "nba.db"
MODELS_DIR = SCRIPT_DIR.parent / "models"

TEST_FRACTION = 0.2
PERIOD_CODES = ["Q1", "Q2", "Q3", "Q4", "H1", "H2"]
PERIOD_ONE_HOT_COLS = [f"period_{p}" for p in PERIOD_CODES]


def _add_period_one_hot(df: pd.DataFrame) -> pd.DataFrame:
    for p in PERIOD_CODES:
        df[f"period_{p}"] = (df["period"] == p).astype(int)
    return df


def temporal_split(df: pd.DataFrame, test_fraction: float, date_col: str = "game_date"):
    df = df.sort_values(date_col).reset_index(drop=True)
    cutoff_idx = int(len(df) * (1 - test_fraction))
    cutoff_date = df[date_col].iloc[cutoff_idx]
    return df[df[date_col] < cutoff_date], df[df[date_col] >= cutoff_date], cutoff_date


def train_regressor(name: str, df: pd.DataFrame, feature_cols: list[str], target_col: str, thresholds: list[float]):
    print(f"\n{'=' * 60}\n{name}\n{'=' * 60}")
    df = df.dropna(subset=feature_cols + [target_col])
    print(f"Dataset : {len(df)} lignes | moyenne réelle : {df[target_col].mean():.2f}")

    train, test, cutoff = temporal_split(df, TEST_FRACTION)
    print(f"Split temporel : {len(train)} train (< {cutoff}) / {len(test)} test (>= {cutoff})")

    X_train, y_train = train[feature_cols], train[target_col]
    X_test, y_test = test[feature_cols], test[target_col]

    model, best_params, _ = tune_random_forest(X_train, y_train, task="regressor")

    resid_std = float(np.std(y_train - model.predict(X_train)))
    test_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, test_pred)
    r2 = r2_score(y_test, test_pred)
    print(f"MAE (test) : {mae:.2f} | R² (test) : {r2:.3f} | écart-type global du résidu : {resid_std:.3f}")

    print("Calibration (seuil | proba moy. prédite | taux réel | écart) :")
    scale = max(resid_std, 0.05)
    for seuil in thresholds:
        proba_pred = 1 - norm.cdf(seuil, loc=test_pred, scale=scale)
        taux_reel = (y_test.to_numpy() > seuil).astype(float)
        print(f"  > {seuil:>6.2f} : proba moy. prédite = {proba_pred.mean():.1%}  |  taux réel = {taux_reel.mean():.1%}"
              f"  |  écart = {proba_pred.mean() - taux_reel.mean():+.1%}")

    MODELS_DIR.mkdir(exist_ok=True)
    model_path = MODELS_DIR / f"{name}.joblib"
    joblib.dump(
        {"model": model, "feature_cols": feature_cols, "resid_std": resid_std, "target": target_col, "distribution": "normal", "tuned_params": best_params},
        model_path,
    )
    print(f"Modèle sauvegardé : {model_path}")


def train_binary_classifier(name: str, df: pd.DataFrame, feature_cols: list[str], target_col: str, positive_label=True):
    print(f"\n{'=' * 60}\n{name}\n{'=' * 60}")
    df = df.dropna(subset=feature_cols + [target_col])
    y = (df[target_col] == positive_label).astype(int) if df[target_col].dtype == object else df[target_col].astype(int)
    df = df.assign(_y=y)
    print(f"Dataset : {len(df)} lignes | taux de base : {df['_y'].mean():.2%}")

    train, test, cutoff = temporal_split(df, TEST_FRACTION)
    print(f"Split temporel : {len(train)} train (< {cutoff}) / {len(test)} test (>= {cutoff})")

    X_train, y_train = train[feature_cols], train["_y"]
    X_test, y_test = test[feature_cols], test["_y"]

    model, best_params, _ = tune_random_forest(X_train, y_train, task="classifier")

    proba_test = model.predict_proba(X_test)[:, 1]
    print(f"Log loss (test) : {log_loss(y_test, proba_test):.3f}  (référence taux constant : {log_loss(y_test, np.full(len(y_test), y_train.mean())):.3f})")
    print(f"Brier score (test) : {brier_score_loss(y_test, proba_test):.3f}  (référence taux constant : {brier_score_loss(y_test, np.full(len(y_test), y_train.mean())):.3f})")

    MODELS_DIR.mkdir(exist_ok=True)
    model_path = MODELS_DIR / f"{name}.joblib"
    joblib.dump({"model": model, "feature_cols": feature_cols, "target": target_col, "tuned_params": best_params}, model_path)
    print(f"Modèle sauvegardé : {model_path}")


def train_multiclass_classifier(name: str, df: pd.DataFrame, feature_cols: list[str], target_col: str, classes: list):
    print(f"\n{'=' * 60}\n{name}\n{'=' * 60}")
    df = df.dropna(subset=feature_cols + [target_col])
    print(f"Dataset : {len(df)} lignes | répartition classes :\n{df[target_col].value_counts(normalize=True)}")

    train, test, cutoff = temporal_split(df, TEST_FRACTION)
    print(f"Split temporel : {len(train)} train (< {cutoff}) / {len(test)} test (>= {cutoff})")

    X_train, y_train = train[feature_cols], train[target_col]
    X_test, y_test = test[feature_cols], test[target_col]

    model, best_params, _ = tune_random_forest(X_train, y_train, task="classifier")

    proba_test = model.predict_proba(X_test)
    print(f"Log loss multi-classe (test) : {log_loss(y_test, proba_test, labels=model.classes_):.3f}")
    print(f"Classes du modèle : {list(model.classes_)}")

    MODELS_DIR.mkdir(exist_ok=True)
    model_path = MODELS_DIR / f"{name}.joblib"
    joblib.dump({"model": model, "feature_cols": feature_cols, "target": target_col, "classes": classes, "tuned_params": best_params}, model_path)
    print(f"Modèle sauvegardé : {model_path}")


def main():
    conn = sqlite3.connect(DB_PATH)

    game_dates = pd.read_sql("SELECT game_id, game_date FROM entrainement_matchs", conn, dtype={"game_id": str})

    # ---- 1/2. margin (régression, cumulatif) + total_points (régression, segment) ----
    periode_match = pd.read_sql(
        f"SELECT game_id, period, margin, total_points, {', '.join(FEATURE_COLS)} FROM entrainement_periode_match",
        conn, dtype={"game_id": str},
    )
    periode_match = periode_match.merge(game_dates, on="game_id", how="left")
    periode_match = _add_period_one_hot(periode_match)
    feature_cols_match = FEATURE_COLS + PERIOD_ONE_HOT_COLS

    train_regressor("period_margin", periode_match, feature_cols_match, "margin", [3, 5, 10, 15, 20])
    train_regressor("period_total_points", periode_match, feature_cols_match, "total_points", [40, 45, 50, 55, 60])

    # ---- 3/4. quarter_winner (classif binaire) + point_share (régression) ----
    own_feature_cols = [f"own_{c}" for c in BASE_FEATURE_COLS] + [f"opp_{c}" for c in BASE_FEATURE_COLS]
    periode_equipe = pd.read_sql(
        f"SELECT game_id, team_id, period, own_wins_period, own_pts_share, {', '.join(f'own_{c}' for c in BASE_FEATURE_COLS)}, "
        f"{', '.join(f'opp_{c}' for c in BASE_FEATURE_COLS)} FROM entrainement_periode_equipe",
        conn, dtype={"game_id": str},
    )
    periode_equipe = periode_equipe.merge(game_dates, on="game_id", how="left")
    periode_equipe = _add_period_one_hot(periode_equipe)
    feature_cols_equipe = own_feature_cols + PERIOD_ONE_HOT_COLS

    train_binary_classifier("period_quarter_winner", periode_equipe, feature_cols_equipe, "own_wins_period")
    train_regressor("period_point_share", periode_equipe, feature_cols_equipe, "own_pts_share", [0.3, 0.4, 0.5, 0.6, 0.7])

    # ---- 5/6. quarters_won_count (multi-classe) + leads_half_result (3 classes) ----
    equipe = pd.read_sql(
        f"SELECT game_id, own_quarters_won_count, own_half_outcome, "
        f"{', '.join(f'own_{c}' for c in BASE_FEATURE_COLS)}, {', '.join(f'opp_{c}' for c in BASE_FEATURE_COLS)} "
        "FROM entrainement_equipe",
        conn, dtype={"game_id": str},
    )
    equipe = equipe.merge(game_dates, on="game_id", how="left")

    train_multiclass_classifier("period_quarters_won_count", equipe, own_feature_cols, "own_quarters_won_count", [0, 1, 2, 3, 4])
    train_multiclass_classifier("period_leads_half_result", equipe, own_feature_cols, "own_half_outcome", ["NOT_LEADING", "WINS", "LOSES"])

    conn.close()


if __name__ == "__main__":
    main()
