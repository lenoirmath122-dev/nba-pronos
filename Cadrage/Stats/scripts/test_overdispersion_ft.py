"""
Test empirique Phase 3 (projet-data-nba.md §16/§18) : le résiduel de
calibration ±4-9% sur FT% (après correctif du biais de sélection) vient-il
d'une sous-dispersion du modèle actuel (Binomial plug-in, n_hat/p_hat figés)
par rapport à la variance RÉELLE du taux de réussite match par match ?

Hypothèse à vérifier (pas encore testée) : une Binomiale pure suppose p fixe
et connu -> sous-estime la variance réelle (fatigue, défense adverse, etc.).
Le rétrécissement bayésien de p_hat (Beta-Binomial, déjà en place dans
train_pct_model.py) donne un postérieur Beta(alpha, beta) -- mais la proba
finale P(pct > seuil) est aujourd'hui calculée en écrasant ce postérieur à sa
moyenne (p_hat) et en appliquant une Binomiale simple. Ce script compare,
sur le MÊME split test que train_pct_model.py, cette approche actuelle à une
loi Beta-Binomiale prédictive (n_hat, alpha_post, beta_post) qui garde
l'incertitude sur p -- même démarche que le choix Poisson vs normale (§15) :
vérifier empiriquement avant de généraliser, ne rien décider a priori.

Usage:
    python test_overdispersion_ft.py
"""

import sqlite3

import numpy as np
from scipy.stats import betabinom, binom

from train_pct_model import (
    DB_PATH,
    SHRINKAGE_CANDIDATES,
    attempts_cols_for,
    load_dataset,
    proba_pct_over,
    shrunk_rate,
    temporal_split,
)
from train_pct_model import RandomForestRegressor, TEST_FRACTION


def proba_pct_over_betabinom(threshold: float, n: np.ndarray, alpha: np.ndarray, beta: np.ndarray) -> np.ndarray:
    """P(M/n > threshold) avec M ~ Beta-Binomial(n, alpha, beta) -- garde
    l'incertitude sur p au lieu de l'écraser à sa moyenne alpha/(alpha+beta)."""
    min_makes = np.floor(threshold * n) + 1
    return 1 - betabinom.cdf(min_makes - 1, n, alpha, beta)


def run(stat: str, label_fr: str, makes_col: str, attempts_col: str, thresholds: tuple, k: int):
    cols = attempts_cols_for(attempts_col)
    conn = sqlite3.connect(DB_PATH)
    df = load_dataset(conn, makes_col, attempts_col)
    conn.close()

    print(f"\n{'=' * 70}\n{label_fr.upper()} -- Binomial plug-in vs Beta-Binomial (k={k})\n{'=' * 70}")

    train, test, cutoff = temporal_split(df, TEST_FRACTION)

    train_attempted = train[train["attempts_reel"] > 0]
    attempts_model = RandomForestRegressor(n_estimators=300, max_depth=8, min_samples_leaf=10, random_state=0, n_jobs=-1)
    attempts_model.fit(train_attempted[cols], train_attempted["attempts_reel"])
    test_n_hat = attempts_model.predict(test[cols])

    league_avg = train["makes_reel"].sum() / train["attempts_reel"].sum()

    scoreable = (test["attempts_reel"] > 0) & (test_n_hat >= 0.5)
    test_scoreable = test[scoreable]
    n_hat = np.maximum(np.round(test_n_hat[scoreable]), 1)
    real_pct = test_scoreable["makes_reel"] / test_scoreable["attempts_reel"]

    makes_sum10 = test_scoreable["makes_sum10"].fillna(0.0).to_numpy()
    attempts_sum10 = test_scoreable["attempts_sum10"].fillna(0.0).to_numpy()

    # Point estimate (approche actuelle, train_pct_model.py) : p_hat = moyenne
    # a posteriori, écrasée à un seul nombre avant la Binomiale.
    p_hat = shrunk_rate(test_scoreable["makes_sum10"], test_scoreable["attempts_sum10"], league_avg, k)

    # Postérieur complet (nouvelle approche testée ici) : Beta(alpha, beta),
    # même prior Beta(k*avg, k*(1-avg)) que shrunk_rate -- mais on garde
    # alpha/beta séparés au lieu de les réduire à leur moyenne.
    alpha_post = k * league_avg + makes_sum10
    beta_post = k * (1 - league_avg) + (attempts_sum10 - makes_sum10)

    print(f"Matchs notables : {scoreable.sum()} / {len(test)}\n")
    print(f"{'seuil':>6} | {'proba Binomial':>14} | {'proba BetaBinom':>16} | {'taux réel':>10} "
          f"| {'écart Bin':>10} | {'écart BB':>9}")

    ecarts_bin, ecarts_bb = [], []
    for seuil in thresholds:
        p_bin = proba_pct_over(seuil, n_hat, p_hat)
        p_bb = proba_pct_over_betabinom(seuil, n_hat, alpha_post, beta_post)
        taux_reel = (real_pct > seuil).mean()
        ecart_bin = p_bin.mean() - taux_reel
        ecart_bb = p_bb.mean() - taux_reel
        ecarts_bin.append(abs(ecart_bin))
        ecarts_bb.append(abs(ecart_bb))
        print(f"{seuil:>5.0%} | {p_bin.mean():>13.1%} | {p_bb.mean():>15.1%} | {taux_reel:>9.1%} "
              f"| {ecart_bin:>+9.1%} | {ecart_bb:>+8.1%}")

    print(f"\nÉcart moyen absolu -- Binomial : {np.mean(ecarts_bin):.1%}  |  Beta-Binomial : {np.mean(ecarts_bb):.1%}")


def main():
    # Validé d'abord sur FT% seul (résiduel le plus visible, §18) ; généralisé
    # ici à FG%/3P% avec les mêmes k retenus dans train_pct_model.py (§18,
    # tableau des k par stat).
    run("ft", "Lancers francs (FT%)", "ftm", "fta", thresholds=(0.60, 0.70, 0.75, 0.80, 0.85, 0.90), k=5)
    run("fg", "Tirs au panier (FG%)", "fgm", "fga", thresholds=(0.35, 0.40, 0.45, 0.50, 0.55, 0.60), k=30)
    run("fg3", "3-points (3P%)", "fg3m", "fg3a", thresholds=(0.20, 0.30, 0.35, 0.40, 0.45, 0.50), k=5)


if __name__ == "__main__":
    main()
