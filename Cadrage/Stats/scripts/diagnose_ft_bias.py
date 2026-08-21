"""
Diagnostic du biais résiduel ~4% laissé ouvert sur FT% après l'adoption du
Beta-Binomial (projet-data-nba.md §20) : le signe de l'écart s'inverse entre
le seuil 60% (+7%, surestimation) et 70-90% (-4 à -6%, sous-estimation) --
piste distincte de l'overdispersion (déjà traitée), jamais regardée.

Hypothèses testées, dans l'ordre :
1. Biais NON conditionnel sur p_hat (moyenne prédite du taux vs. taux réel
   moyen sur l'ensemble notable) -- un p_hat systématiquement trop haut/bas
   décalerait la proba dans le même sens à tous les seuils, ce qui ne colle
   PAS au signe qui s'inverse observé -- sert surtout à écarter cette piste
   simple avant d'en chercher une plus fine.
2. Biais sur n_hat (tentatives prédites vs. réelles) -- un n_hat trop petit
   ferait un seul panier suffire à dépasser les seuils hauts (comme le bug
   de sélection déjà trouvé et corrigé en §18), donnant le même genre de
   signature (sous-dispersion aux extrêmes).
3. Artefact de granularité : avec n petit (2-4 tentatives/match), les seuils
   proches d'une fraction atteignable (2/3, 3/4...) sont mécaniquement plus
   bruités qu'un seuil "entre deux" fractions -- vérifié en regroupant les
   matchs notables par n_hat arrondi et en comparant la calibration par
   tranche de n.

Usage:
    python diagnose_ft_bias.py
"""

import sqlite3

import numpy as np
from scipy.stats import betabinom

from train_pct_model import (
    DB_PATH,
    RandomForestRegressor,
    TEST_FRACTION,
    attempts_cols_for,
    load_dataset,
    posterior_alpha_beta,
    proba_pct_over_betabinom,
    temporal_split,
)

K = 5  # retenu pour FT% en prod (train_pct_model.py)
THRESHOLDS = (0.60, 0.70, 0.75, 0.80, 0.85, 0.90)


def main():
    cols = attempts_cols_for("fta")
    conn = sqlite3.connect(DB_PATH)
    df = load_dataset(conn, "ftm", "fta")
    conn.close()

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
    alpha_post, beta_post = posterior_alpha_beta(test_scoreable["makes_sum10"], test_scoreable["attempts_sum10"], league_avg, K)
    p_hat_mean = alpha_post / (alpha_post + beta_post)

    print("=" * 70)
    print("1. Biais non conditionnel")
    print("=" * 70)
    print(f"p_hat moyen (prédit)   : {p_hat_mean.mean():.3%}")
    print(f"real_pct moyen (réel)  : {real_pct.mean():.3%}")
    print(f"écart                  : {p_hat_mean.mean() - real_pct.mean():+.3%}")

    print(f"\n{'=' * 70}\n2. Biais sur n_hat (tentatives)\n{'=' * 70}")
    print(f"n_hat moyen (prédit)        : {n_hat.mean():.2f}")
    print(f"attempts_reel moyen (réel)  : {test_scoreable['attempts_reel'].mean():.2f}")
    print(f"écart                       : {n_hat.mean() - test_scoreable['attempts_reel'].mean():+.2f}")

    print(f"\n{'=' * 70}\n3. Calibration par tranche de n_hat (granularité)\n{'=' * 70}")
    for n_lo, n_hi in [(1, 2), (3, 3), (4, 4), (5, 6), (7, 100)]:
        mask = (n_hat >= n_lo) & (n_hat <= n_hi)
        if mask.sum() < 30:
            continue
        n_sub = n_hat[mask]
        alpha_sub, beta_sub = alpha_post[mask], beta_post[mask]
        real_sub = real_pct[mask]
        print(f"\nn_hat in [{n_lo},{n_hi}] -- {mask.sum()} matchs notables")
        for seuil in THRESHOLDS:
            p_bb = proba_pct_over_betabinom(seuil, n_sub, alpha_sub, beta_sub)
            taux_reel = (real_sub > seuil).mean()
            print(f"  > {seuil:>4.0%} : proba prédite = {p_bb.mean():.1%}  |  taux réel = {taux_reel:.1%}"
                  f"  |  écart = {p_bb.mean() - taux_reel:+.1%}")


if __name__ == "__main__":
    main()
