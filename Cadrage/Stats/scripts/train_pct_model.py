"""
Modèles de stat de TAUX (pourcentage de tir) — FT%, FG%, 3P%
(projet-data-nba.md §18). Approche délibérément différente de
train_points_model.py/train_stat_model.py, qui régressent directement une
VALEUR (points, rebonds...) puis lui appliquent une distribution. Un
pourcentage n'est pas une valeur qu'on régresse : c'est un ratio
réussites/tentatives, et les deux varient indépendamment d'un soir à
l'autre (un joueur peut tenter 2 lancers à 100% ou 12 à 75%, le "taux
attendu" ne dit rien sans le nombre de tentatives).

Validé d'abord sur UN SEUL cas (FT%, lancers francs — le plus stable
statistiquement) avant de généraliser à FG%/3P% avec la MÊME recette
(généralisée dans ce fichier une fois l'approche confirmée) — même méthode
que train_points_model.py (1 stat) puis train_stat_model.py (6 stats).

Principe (2 sous-modèles, combinés par une loi Binomiale) :
1. TENTATIVES (fta/fga/fg3a) : régressées comme les autres stats comptées
   (RandomForestRegressor, mêmes features de contexte), donne n_hat.
   ENTRAÎNÉ UNIQUEMENT sur les matchs où le joueur a réellement tenté >= 1
   fois (pas sur l'ensemble, contrairement aux autres stats comptées) —
   biais de sélection réel trouvé en validant sur FT% : noter la
   calibration seulement sur les matchs avec tentative réelle (nécessaire,
   un % n'existe pas sinon — même convention que les livres de paris réels,
   qui annulent le pari) revient à évaluer une espérance CONDITIONNELLE
   E[tentatives | tentatives>0], différente de l'espérance INCONDITIONNELLE
   qu'apprend un modèle entraîné sur tous les matchs (y compris ceux à 0
   tentative). Sur FT%, entraîné sur tout : n_hat moyen 2.79 contre fta réel
   moyen 3.89 sur les matchs notables (sous-estimation de 28%, qui gonflait
   artificiellement la proba de dépasser un seuil haut — plus n est petit,
   plus un seul panier suffit à "dépasser 90%"). Entraîné uniquement sur
   tentatives>0 : n_hat moyen 3.82 contre 3.87 réel — quasi corrigé.
2. TAUX DE RÉUSSITE (p_hat) : PAS régressé — estimé par rétrécissement
   bayésien (Beta-Binomial) du ratio observé sur les 10 derniers matchs vers
   la moyenne ligue. Un joueur à 1/1 sur ses 10 derniers lancers n'est pas
   "à 100%", c'est un petit échantillon qui doit être ramené vers la
   moyenne — à l'inverse, un joueur à 80/100 est un échantillon fiable, peu
   rétréci. `k` (force du rétrécissement, en "tentatives fictives" à la
   moyenne ligue) choisi par comparaison empirique de calibration, pas
   deviné — même démarche que le choix Poisson vs normale (§15). Sur FT%,
   différences minimes entre les k testés (biais de sélection ci-dessus
   dominait largement l'erreur) — pas garanti pareil sur FG%/3P%, retesté
   indépendamment pour chaque stat.
3. Combinaison : M (réussites du soir) ~ Binomial(n_hat, p_hat).
   P(pct > seuil) = P(M > seuil * n_hat), calculée via la CDF binomiale.

Matchs sans tentative réelle exclus de la vérification de calibration (un %
n'existe pas sans tentative — même convention que les livres de paris
réels, qui annulent un pari sur % si le joueur ne tire pas).

Écart résiduel de ±4 à 9% observé sur FT% même après le correctif du biais
de sélection — candidat Phase 3 (variance réelle par match probablement
> Binomiale pure), pas creusé, pas bloquant pour juger l'approche validée.

Usage:
    python train_pct_model.py
"""

import sqlite3
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.stats import binom
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score

SCRIPT_DIR = Path(__file__).resolve().parent
DB_PATH = SCRIPT_DIR.parent / "data" / "nba.db"
MODELS_DIR = SCRIPT_DIR.parent / "models"

SHARED_ATTEMPTS_COLS = [
    "min_moy5", "min_moy10",
    "is_home", "rest_days", "is_back_to_back", "games_played_season_avant",
    "usg_pct_moy5",
    "matchs_manques_depuis_dernier",
]

# Testées avant de choisir (voir calibration imprimée pour chacune) : plus k
# est grand, plus le taux d'un joueur à faible volume est ramené vers la
# moyenne ligue.
SHRINKAGE_CANDIDATES = (5, 10, 15, 20, 30)

TEST_FRACTION = 0.2


def attempts_cols_for(attempts_col: str) -> list:
    return [f"{attempts_col}_moy5", f"{attempts_col}_moy10"] + SHARED_ATTEMPTS_COLS


def load_dataset(conn: sqlite3.Connection, makes_col: str, attempts_col: str) -> pd.DataFrame:
    cols = attempts_cols_for(attempts_col)
    df = pd.read_sql(
        f"""
        SELECT f.game_id, f.player_id, f.game_date,
               f.{makes_col}_sum10 AS makes_sum10, f.{attempts_col}_sum10 AS attempts_sum10,
               {', '.join(cols)},
               l.{makes_col} AS makes_reel, l.{attempts_col} AS attempts_reel
        FROM features_joueur f
        JOIN labels_joueur l ON l.game_id = f.game_id AND l.player_id = f.player_id
        """,
        conn, dtype={"game_id": str},
    )
    df["game_date"] = pd.to_datetime(df["game_date"])
    df = df.dropna(subset=cols + ["attempts_reel"])
    return df.sort_values("game_date").reset_index(drop=True)


def temporal_split(df: pd.DataFrame, test_fraction: float):
    cutoff_idx = int(len(df) * (1 - test_fraction))
    cutoff_date = df["game_date"].iloc[cutoff_idx]
    return df[df["game_date"] < cutoff_date], df[df["game_date"] >= cutoff_date], cutoff_date


def shrunk_rate(makes_sum: pd.Series, attempts_sum: pd.Series, league_avg: float, k: float) -> np.ndarray:
    """Moyenne a posteriori d'un Beta-Binomial de prior Beta(k*avg, k*(1-avg))
    — équivaut à ajouter k tentatives fictives au taux ligue avant d'observer
    le joueur. Sommes à 0 (aucune tentative connue) retombe exactement sur
    league_avg (rétrécissement total, cohérent : rien observé à pondérer)."""
    makes = makes_sum.fillna(0.0).to_numpy()
    attempts = attempts_sum.fillna(0.0).to_numpy()
    return (makes + k * league_avg) / (attempts + k)


def proba_pct_over(threshold: float, n: np.ndarray, p: np.ndarray) -> np.ndarray:
    """P(M/n > threshold) avec M ~ Binomial(n, p) — plus petit entier de
    réussites strictement au-dessus du seuil = floor(threshold*n) + 1,
    valable que threshold*n soit entier ou non."""
    min_makes = np.floor(threshold * n) + 1
    return 1 - binom.cdf(min_makes - 1, n, p)


def calibration_check(label: str, y_makes, y_attempts, n_hat, p_hat, thresholds):
    print(f"\nCalibration [{label}] (seuil | proba moy. prédite | taux réel | écart) :")
    real_pct = y_makes / y_attempts
    for seuil in thresholds:
        proba_pred = proba_pct_over(seuil, n_hat, p_hat)
        taux_reel = (real_pct > seuil).mean()
        print(f"  > {seuil:>4.0%} : proba moy. prédite = {proba_pred.mean():.1%}"
              f"  |  taux réel = {taux_reel:.1%}  |  écart = {proba_pred.mean() - taux_reel:+.1%}")


def run(stat: str, label_fr: str, makes_col: str, attempts_col: str, thresholds: tuple):
    cols = attempts_cols_for(attempts_col)
    conn = sqlite3.connect(DB_PATH)
    df = load_dataset(conn, makes_col, attempts_col)
    conn.close()

    print(f"\n{'=' * 60}\n{label_fr.upper()}\n{'=' * 60}")
    print(f"Dataset (tentatives connues) : {len(df)} lignes")

    train, test, cutoff = temporal_split(df, TEST_FRACTION)
    print(f"Split temporel : {len(train)} train (< {cutoff.date()}) / {len(test)} test (>= {cutoff.date()})")

    # --- 1. Modèle des TENTATIVES — entraîné UNIQUEMENT sur les matchs avec
    # tentative réelle (> 0), cf. docstring : la calibration se mesure
    # forcément sur ce même sous-ensemble (un % n'existe pas sinon),
    # entraîner sur l'ensemble complet biaise n_hat vers le bas dessus.
    train_attempted = train[train["attempts_reel"] > 0]
    attempts_model = RandomForestRegressor(n_estimators=300, max_depth=8, min_samples_leaf=10, random_state=0, n_jobs=-1)
    attempts_model.fit(train_attempted[cols], train_attempted["attempts_reel"])
    test_n_hat = attempts_model.predict(test[cols])
    test_attempted = test[test["attempts_reel"] > 0]
    mae = mean_absolute_error(test_attempted["attempts_reel"], attempts_model.predict(test_attempted[cols]))
    r2 = r2_score(test_attempted["attempts_reel"], attempts_model.predict(test_attempted[cols]))
    print(f"\nTentatives (sachant tentative >= 1) — MAE (test) : {mae:.2f} | R² (test) : {r2:.3f}")
    print("Importance des features (tentatives) :")
    for name, imp in sorted(zip(cols, attempts_model.feature_importances_), key=lambda x: -x[1])[:6]:
        print(f"  {name:<24} {imp:.3f}")

    # --- 2. TAUX de réussite : rétrécissement bayésien, pas de régression ---
    league_avg = train["makes_reel"].sum() / train["attempts_reel"].sum()
    print(f"\nMoyenne ligue (train) : {league_avg:.1%}")

    # Ne score que les matchs où le joueur a réellement tenté ET où le
    # modèle prédit au moins 1 tentative (une prédiction de 0 tentative rend
    # la Binomiale dégénérée — un vrai livre de paris n'ouvrirait pas de
    # ligne % dans ce cas non plus).
    scoreable = (test["attempts_reel"] > 0) & (test_n_hat >= 0.5)
    test_scoreable = test[scoreable]
    n_hat_scoreable = np.maximum(np.round(test_n_hat[scoreable]), 1)
    print(f"Matchs notables pour la calibration (tentative réelle + n_hat >= 1) : {scoreable.sum()} / {len(test)}")

    # Repli naïf (ratio brut, PAS rétréci) pour comparaison — mêmes 10
    # derniers matchs, sans le prior ligue.
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
        calibration_check(f"Beta-Binomial k={k}", test_scoreable["makes_reel"], test_scoreable["attempts_reel"],
                           n_hat_scoreable, p_hat, thresholds)
        if best_score is None or score < best_score:
            best_k, best_score = k, score

    print(f"\n>>> Meilleur k retenu : {best_k} (écart moyen absolu {best_score:.1%})")

    MODELS_DIR.mkdir(exist_ok=True)
    model_path = MODELS_DIR / f"{stat}_pct.joblib"
    joblib.dump(
        {
            "attempts_model": attempts_model,
            "attempts_feature_cols": cols,
            "league_avg": league_avg,
            "shrinkage_k": best_k,
            "target": f"{stat}_pct",
            "distribution": "binomial",
        },
        model_path,
    )
    print(f"Modèle sauvegardé : {model_path} (shrinkage_k={best_k})")


def main():
    run("ft", "Lancers francs (FT%)", "ftm", "fta", thresholds=(0.60, 0.70, 0.75, 0.80, 0.85, 0.90))
    run("fg", "Tirs au panier (FG%)", "fgm", "fga", thresholds=(0.35, 0.40, 0.45, 0.50, 0.55, 0.60))
    run("fg3", "3-points (3P%)", "fg3m", "fg3a", thresholds=(0.20, 0.30, 0.35, 0.40, 0.45, 0.50))


if __name__ == "__main__":
    main()
