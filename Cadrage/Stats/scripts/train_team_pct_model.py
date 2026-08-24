"""
Modèles de stat de TAUX d'ÉQUIPE (FT%, FG%, 3P%) -- chantier "% tir équipe"
(GAPS_OUVERTS.md, 24/08/2026), dernière pièce du tier "nouveau mécanisme
réutilisable" (après comparaison/duel, combo, prolongation). Généralise
train_pct_model.py (joueur) au niveau ÉQUIPE, perspective "own"/"opp" comme
train_team_stats_model.py -- PAS de forme combinée MATCH_TOTAL (un
pourcentage combiné des 2 équipes n'a pas de sens propre, contrairement à
total_points).

MÊME principe à 2 étages que côté joueur (train_pct_model.py, voir sa
docstring pour le détail) :
1. TENTATIVES (fga/fta/fg3a) : RandomForestRegressor, features = même
   patron que train_team_stats_model.py (own_is_home + BASE_FEATURE_COLS
   own/opp) + own_{attempts}_pour_moy5/10 -- entraîné uniquement sur les
   matchs avec tentative réelle > 0 (même raison que le joueur : un % n'a
   de sens que conditionnel à une tentative).
2. TAUX (p_hat) : rétrécissement bayésien de own_{makes}_pour_sum10/
   own_{attempts}_pour_sum10 vers la moyenne ligue -- PAS régressé. `k`
   réestimé empiriquement pour l'équipe (PAS copié du joueur : base de
   tentatives très différente, ~88 FGA/match d'équipe contre ~12 pour un
   joueur).
3. Combinaison Binomiale (Beta-Binomiale si le gain de calibration se
   confirme empiriquement pour la stat, comme côté joueur -- testé
   indépendamment ici, PAS supposé identique à BETABINOM_STATS={"ft"} du
   joueur).

Usage:
    python train_team_pct_model.py
"""

import sqlite3
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.stats import betabinom, binom
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score

from train_home_win_model import BASE_FEATURE_COLS  # noqa: E402

SCRIPT_DIR = Path(__file__).resolve().parent
DB_PATH = SCRIPT_DIR.parent / "data" / "nba.db"
MODELS_DIR = SCRIPT_DIR.parent / "models"

TEST_FRACTION = 0.2
SHRINKAGE_CANDIDATES = (5, 10, 15, 20, 30)

STATS_TO_TRAIN = [
    ("ft", "Lancers francs (FT%)", "ftm", "fta", (0.65, 0.70, 0.75, 0.80, 0.85)),
    ("fg", "Tirs au panier (FG%)", "fgm", "fga", (0.40, 0.43, 0.45, 0.48, 0.50)),
    ("fg3", "3-points (3P%)", "fg3m", "fg3a", (0.30, 0.33, 0.35, 0.38, 0.40)),
]


def attempts_cols_for(attempts_col: str) -> tuple[list, list]:
    # BASE_FEATURE_COLS prefixees own_/opp_ (meme patron que
    # train_team_stats_model.py) + les 2 colonnes tentatives dediees, DEJA
    # cote "own" uniquement -- build_targets.py::build_team_perspective_dataset()
    # les selectionne SANS passer par la boucle own_/opp_ de MATCH_FEATURE_COLS
    # (pas de version "opp" construite, inutile ici), donc pas de prefixe a
    # ajouter, contrairement a BASE_FEATURE_COLS.
    base_cols = ["own_is_home"] + [f"own_{c}" for c in BASE_FEATURE_COLS] + [f"opp_{c}" for c in BASE_FEATURE_COLS]
    extra_cols = [f"{attempts_col}_pour_moy5", f"{attempts_col}_pour_moy10"]
    feature_cols = base_cols + extra_cols
    return BASE_FEATURE_COLS, feature_cols


def load_dataset(conn: sqlite3.Connection, makes_col: str, attempts_col: str, feature_cols: list) -> pd.DataFrame:
    cols = ", ".join(feature_cols)
    df = pd.read_sql(
        f"""
        SELECT game_id, team_id, game_date,
               {makes_col}_pour_sum10 AS makes_sum10, {attempts_col}_pour_sum10 AS attempts_sum10,
               {cols}, {attempts_col}_reel AS attempts_reel, {makes_col}_reel AS makes_reel
        FROM entrainement_equipe
        """,
        conn, dtype={"game_id": str},
    )
    df["game_date"] = pd.to_datetime(df["game_date"])
    df = df.dropna(subset=feature_cols + ["attempts_reel", "makes_sum10", "attempts_sum10"])
    return df.sort_values("game_date").reset_index(drop=True)


def temporal_split(df: pd.DataFrame, test_fraction: float):
    cutoff_idx = int(len(df) * (1 - test_fraction))
    cutoff_date = df["game_date"].iloc[cutoff_idx]
    return df[df["game_date"] < cutoff_date], df[df["game_date"] >= cutoff_date], cutoff_date


def shrunk_rate(makes_sum: pd.Series, attempts_sum: pd.Series, league_avg: float, k: float) -> np.ndarray:
    makes = makes_sum.fillna(0.0).to_numpy()
    attempts = attempts_sum.fillna(0.0).to_numpy()
    return (makes + k * league_avg) / (attempts + k)


def proba_pct_over(threshold: float, n: np.ndarray, p: np.ndarray) -> np.ndarray:
    min_makes = np.floor(threshold * n) + 1
    return 1 - binom.cdf(min_makes - 1, n, p)


def proba_pct_over_betabinom(threshold: float, n: np.ndarray, alpha: np.ndarray, beta: np.ndarray) -> np.ndarray:
    min_makes = np.floor(threshold * n) + 1
    return 1 - betabinom.cdf(min_makes - 1, n, alpha, beta)


def posterior_alpha_beta(makes_sum, attempts_sum, league_avg: float, k: float):
    makes = makes_sum.fillna(0.0).to_numpy() if hasattr(makes_sum, "fillna") else np.asarray(makes_sum)
    attempts = attempts_sum.fillna(0.0).to_numpy() if hasattr(attempts_sum, "fillna") else np.asarray(attempts_sum)
    alpha = k * league_avg + makes
    beta = k * (1 - league_avg) + (attempts - makes)
    return alpha, beta


def calibration_check(label: str, y_makes, y_attempts, n_hat, p_hat, thresholds):
    print(f"\nCalibration [{label}] (seuil | proba moy. prédite | taux réel | écart) :")
    real_pct = y_makes / y_attempts
    for seuil in thresholds:
        proba_pred = proba_pct_over(seuil, n_hat, p_hat)
        taux_reel = (real_pct > seuil).mean()
        print(f"  > {seuil:>4.0%} : proba moy. prédite = {proba_pred.mean():.1%}"
              f"  |  taux réel = {taux_reel:.1%}  |  écart = {proba_pred.mean() - taux_reel:+.1%}")


def run(stat: str, label_fr: str, makes_col: str, attempts_col: str, thresholds: tuple):
    own_base_cols, feature_cols = attempts_cols_for(attempts_col)
    conn = sqlite3.connect(DB_PATH)
    df = load_dataset(conn, makes_col, attempts_col, feature_cols)
    conn.close()

    print(f"\n{'=' * 60}\n{label_fr.upper()} D'ÉQUIPE (perspective own/opp)\n{'=' * 60}")
    print(f"Dataset (tentatives connues) : {len(df)} lignes")

    train, test, cutoff = temporal_split(df, TEST_FRACTION)
    print(f"Split temporel : {len(train)} train (< {cutoff.date()}) / {len(test)} test (>= {cutoff.date()})")

    # --- 1. TENTATIVES -- entraîné uniquement sur matchs avec tentative > 0
    # (une équipe a quasi toujours fga/fg3a > 0, mais fta peut être 0 dans de
    # rares matchs sans faute sifflée -- même garde que le joueur, jamais
    # supposée inutile).
    train_attempted = train[train["attempts_reel"] > 0]
    attempts_model = RandomForestRegressor(n_estimators=300, max_depth=8, min_samples_leaf=10, random_state=0, n_jobs=-1)
    attempts_model.fit(train_attempted[feature_cols], train_attempted["attempts_reel"])
    test_n_hat = attempts_model.predict(test[feature_cols])
    test_attempted = test[test["attempts_reel"] > 0]
    mae = mean_absolute_error(test_attempted["attempts_reel"], attempts_model.predict(test_attempted[feature_cols]))
    r2 = r2_score(test_attempted["attempts_reel"], attempts_model.predict(test_attempted[feature_cols]))
    print(f"\nTentatives (sachant tentative >= 1) — MAE (test) : {mae:.2f} | R² (test) : {r2:.3f}")
    print("Importance des features (tentatives, top 6) :")
    for name, imp in sorted(zip(feature_cols, attempts_model.feature_importances_), key=lambda x: -x[1])[:6]:
        print(f"  {name:<28} {imp:.3f}")

    # --- 2. TAUX -- rétrécissement bayésien, pas de régression ---
    league_avg = train["makes_reel"].sum() / train["attempts_reel"].sum()
    print(f"\nMoyenne ligue équipe (train) : {league_avg:.1%}")

    scoreable = (test["attempts_reel"] > 0) & (test_n_hat >= 0.5)
    test_scoreable = test[scoreable]
    n_hat_scoreable = np.maximum(np.round(test_n_hat[scoreable]), 1)
    print(f"Matchs notables pour la calibration : {scoreable.sum()} / {len(test)}")

    naive_p = np.where(
        test_scoreable["attempts_sum10"] > 0,
        test_scoreable["makes_sum10"] / test_scoreable["attempts_sum10"],
        league_avg,
    )
    calibration_check("ratio brut (non rétréci)", test_scoreable["makes_reel"], test_scoreable["attempts_reel"],
                       n_hat_scoreable, naive_p, thresholds)

    best_k, best_score = None, None
    for k in SHRINKAGE_CANDIDATES:
        p_hat = shrunk_rate(test_scoreable["makes_sum10"], test_scoreable["attempts_sum10"], league_avg, k)
        real_pct = test_scoreable["makes_reel"] / test_scoreable["attempts_reel"]
        score = float(np.mean([
            abs(proba_pct_over(s, n_hat_scoreable, p_hat).mean() - (real_pct > s).mean())
            for s in thresholds
        ]))
        print(f"\n[k={k}] écart moyen absolu (tous seuils) : {score:.1%}")
        calibration_check(f"Binomial (p rétréci) k={k}", test_scoreable["makes_reel"], test_scoreable["attempts_reel"],
                           n_hat_scoreable, p_hat, thresholds)
        if best_score is None or score < best_score:
            best_k, best_score = k, score

    print(f"\n>>> Meilleur k retenu : {best_k} (écart moyen absolu {best_score:.1%})")

    # Overdispersion (Beta-Binomiale) -- testée empiriquement pour CHAQUE
    # stat équipe, PAS copiée de BETABINOM_STATS={"ft"} côté joueur (base de
    # tentatives différente, le gain peut varier).
    alpha_post, beta_post = posterior_alpha_beta(
        test_scoreable["makes_sum10"], test_scoreable["attempts_sum10"], league_avg, best_k
    )
    real_pct = test_scoreable["makes_reel"] / test_scoreable["attempts_reel"]
    bb_score = float(np.mean([
        abs(proba_pct_over_betabinom(s, n_hat_scoreable, alpha_post, beta_post).mean() - (real_pct > s).mean())
        for s in thresholds
    ]))
    print(f"\n[Beta-Binomial prédictif, k={best_k}] écart moyen absolu : {bb_score:.1%} (contre {best_score:.1%} en Binomial plug-in)")
    distribution = "beta_binomial" if bb_score < best_score else "binomial"
    print(f">>> Distribution retenue pour {stat} : {distribution}")

    MODELS_DIR.mkdir(exist_ok=True)
    model_path = MODELS_DIR / f"team_{stat}_pct.joblib"
    joblib.dump(
        {
            "attempts_model": attempts_model,
            "attempts_feature_cols": feature_cols,
            "own_base_feature_cols": own_base_cols,
            "league_avg": league_avg,
            "shrinkage_k": best_k,
            "target": f"team_{stat}_pct",
            "distribution": distribution,
        },
        model_path,
    )
    print(f"Modèle sauvegardé : {model_path} (shrinkage_k={best_k}, distribution={distribution})")


def main():
    for stat, label_fr, makes_col, attempts_col, thresholds in STATS_TO_TRAIN:
        run(stat, label_fr, makes_col, attempts_col, thresholds)


if __name__ == "__main__":
    main()
