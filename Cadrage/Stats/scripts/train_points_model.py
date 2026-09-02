"""
1er modèle JETABLE (baseline) : prédit les points d'un joueur pour un match,
sous forme d'une distribution (moyenne + écart-type), pas juste un chiffre.
Sert à vérifier que l'approche marche avant d'aller plus loin — pas destiné
à tourner en prod tel quel.

Principe (voir Cadrage/Stats/projet-data-nba.md §11) :
- X = features_joueur (contexte AVANT le match)
- y = labels_joueur.pts (points RÉELS ce soir-là)
- Découpage TEMPOREL (pas aléatoire) : entraîne sur les matchs les plus
  anciens, teste sur les plus récents.
- Forêt aléatoire (RandomForestRegressor) → une moyenne prédite. Remplace la
  régression linéaire de la 1ère version : gère les effets NON LINÉAIRES
  (ex : `matchs_manques_depuis_dernier`, où un peu de repos aide mais une
  longue coupure nuit — pas une relation à pente constante) et réduit
  l'artefact de colinéarité observé sur `ts_pct_moy5` avec une régression
  linéaire simple (coefficient négatif contre-intuitif).
- Dispersion PROPRE À CHAQUE JOUEUR (ajouté le 20/08/2026) : `pts_ecarttype10`
  (déjà calculé dans `features_joueur` depuis le début, jamais branché avant)
  — l'écart-type des points du joueur sur SES 10 derniers matchs (même
  principe anti-fuite shift(1) que le reste). Utilisé comme dispersion de la
  distribution à la place d'un écart-type global unique pour tout le monde
  — un scoreur irrégulier a une distribution plus large qu'un joueur très
  régulier. Repli sur l'écart-type global des résidus (train) si
  `pts_ecarttype10` est NaN (trop peu de matchs connus pour ce joueur).
- P(pts > seuil) se calcule ensuite pour N'IMPORTE QUEL seuil via la CDF
  normale, sans réentraîner.

Usage:
    python train_points_model.py
"""

import sqlite3
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.stats import norm
from sklearn.metrics import mean_absolute_error, r2_score

from tuning import tune_random_forest

SCRIPT_DIR = Path(__file__).resolve().parent
DB_PATH = SCRIPT_DIR.parent / "data" / "nba.db"
MODELS_DIR = SCRIPT_DIR.parent / "models"

FEATURE_COLS = [
    "pts_moy5", "pts_moy10",
    "min_moy5", "min_moy10",
    "is_home", "rest_days", "is_back_to_back", "games_played_season_avant",
    "ts_pct_moy5", "usg_pct_moy5",
    "plus_minus_moy5",
    "vs_adversaire_pts_moy",
    "matchs_manques_depuis_dernier",
]

TEST_FRACTION = 0.2  # les 20% de matchs les PLUS RÉCENTS servent de test


def load_dataset(conn: sqlite3.Connection) -> pd.DataFrame:
    df = pd.read_sql(
        f"""
        SELECT f.game_id, f.player_id, f.game_date, f.pts_ecarttype10, {', '.join(FEATURE_COLS)},
               l.pts AS pts_reel
        FROM features_joueur f
        JOIN labels_joueur l ON l.game_id = f.game_id AND l.player_id = f.player_id
        """,
        conn, dtype={"game_id": str},
    )
    df["game_date"] = pd.to_datetime(df["game_date"])
    # Baseline volontairement simple : on écarte les lignes avec features manquantes
    # (1er match d'un joueur/saison, etc.) plutôt que d'imputer.
    # `pts_ecarttype10` gardé HORS de ce filtre (colonne à part, pas dans
    # FEATURE_COLS) : NaN autorisé, géré par repli sur l'écart-type global
    # (cf. player_scale ci-dessous), pas une raison d'écarter la ligne.
    df = df.dropna(subset=FEATURE_COLS + ["pts_reel"])
    return df.sort_values("game_date").reset_index(drop=True)


MIN_SCALE = 1.0  # plancher : évite une dispersion nulle (joueur à points identiques sur ses 10 derniers matchs)


def player_scale(ecarttype10: pd.Series, global_std: float) -> np.ndarray:
    """Dispersion à utiliser pour chaque ligne : l'écart-type PROPRE au joueur
    (`pts_ecarttype10`) s'il est connu, sinon repli sur l'écart-type global.
    Plancher à MIN_SCALE (une dispersion de 0 ferait planter la CDF normale)."""
    return ecarttype10.fillna(global_std).clip(lower=MIN_SCALE).to_numpy()


def temporal_split(df: pd.DataFrame, test_fraction: float):
    cutoff_idx = int(len(df) * (1 - test_fraction))
    cutoff_date = df["game_date"].iloc[cutoff_idx]
    train = df[df["game_date"] < cutoff_date]
    test = df[df["game_date"] >= cutoff_date]
    return train, test, cutoff_date


def calibration_check(y_true: np.ndarray, y_pred_mean: np.ndarray, scale: np.ndarray, thresholds=(10, 15, 20, 25, 30)):
    """Pour chaque seuil, compare le taux RÉEL de dépassement au taux MOYEN prédit
    par le modèle, sur le même échantillon (test) — vérifie la calibration.
    `scale` = dispersion PAR LIGNE (propre à chaque joueur, cf. player_scale)."""
    print("\nCalibration (seuil | proba moyenne prédite | taux réel observé | écart) :")
    for seuil in thresholds:
        proba_pred = 1 - norm.cdf(seuil, loc=y_pred_mean, scale=scale)
        taux_reel = (y_true > seuil).mean()
        print(f"  > {seuil:>2} pts : proba moy. prédite = {proba_pred.mean():.1%}  |  taux réel = {taux_reel:.1%}  |  écart = {proba_pred.mean() - taux_reel:+.1%}")


def main():
    conn = sqlite3.connect(DB_PATH)
    df = load_dataset(conn)
    conn.close()

    print(f"Dataset : {len(df)} lignes (joueur, match) après filtrage des NaN.")
    print(f"Période : {df['game_date'].min().date()} -> {df['game_date'].max().date()}")

    train, test, cutoff = temporal_split(df, TEST_FRACTION)
    print(f"Split temporel : {len(train)} train (< {cutoff.date()}) / {len(test)} test (>= {cutoff.date()})")

    X_train, y_train = train[FEATURE_COLS], train["pts_reel"]
    X_test, y_test = test[FEATURE_COLS], test["pts_reel"]

    model, best_params, _ = tune_random_forest(X_train, y_train, task="regressor")

    train_pred = model.predict(X_train)
    resid_std = float(np.std(y_train - train_pred))

    test_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, test_pred)
    r2 = r2_score(y_test, test_pred)

    print(f"\nMAE (test) : {mae:.2f} points")
    print(f"R²  (test) : {r2:.3f}")
    print(f"Écart-type des résidus (train, utilisé pour la distribution) : {resid_std:.2f}")

    print("\nImportance des features (RandomForest) :")
    for name, imp in sorted(zip(FEATURE_COLS, model.feature_importances_), key=lambda x: -x[1]):
        print(f"  {name:<28} {imp:.3f}")

    test_scale = player_scale(test["pts_ecarttype10"], resid_std)
    calibration_check(y_test.to_numpy(), test_pred, test_scale)

    MODELS_DIR.mkdir(exist_ok=True)
    model_path = MODELS_DIR / "points.joblib"
    joblib.dump(
        {"model": model, "feature_cols": FEATURE_COLS, "resid_std": resid_std, "target": "pts", "distribution": "normal", "tuned_params": best_params},
        model_path,
    )
    print(f"\nModèle sauvegardé : {model_path}")

    # --- Démo sur un cas connu : Jokic ---
    conn = sqlite3.connect(DB_PATH)
    jokic_id = conn.execute("SELECT player_id FROM joueurs WHERE family_name LIKE 'Jok%'").fetchone()
    conn.close()
    if jokic_id:
        jokic_id = jokic_id[0]
        jokic_test = test[test["player_id"] == jokic_id].tail(5)
        if not jokic_test.empty:
            preds = model.predict(jokic_test[FEATURE_COLS])
            scales = player_scale(jokic_test["pts_ecarttype10"], resid_std)
            print(f"\n--- Démo Jokic (5 derniers matchs du test set) ---")
            print(f"(écart-type global de repli : {resid_std:.2f} | écart-type propre à Jokic utilisé ci-dessous)")
            for (_, row), pred, scale in zip(jokic_test.iterrows(), preds, scales):
                p_over_25 = 1 - norm.cdf(25, loc=pred, scale=scale)
                print(f"  {row['game_date'].date()} : prédit {pred:.1f} pts (+/- {scale:.1f})"
                      f" | réel {row['pts_reel']:.0f} pts | P(>25) = {p_over_25:.0%}")
        else:
            print("\n(Aucun match de Jokic dans le test set actuel)")


if __name__ == "__main__":
    main()
