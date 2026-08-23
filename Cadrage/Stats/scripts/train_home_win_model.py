"""
Modèle de probabilité de victoire À DOMICILE pour UN match donné — brique 1
du chantier "paris SÉRIE" (cadré le 23/08/2026 avec l'utilisateur,
GAPS_OUVERTS.md/JOURNAL_SESSIONS.md). Répond à "qui a le plus de chances de
gagner CE match", pas "qui gagne la série" -- un calcul récursif séparé
(pas encore écrit, prochaine étape) combine ce P(victoire) match par match
(en respectant le format domicile/extérieur 2-2-1-1-1 d'une série) pour en
déduire la longueur probable de la série ET son vainqueur.

Entraîné sur `entrainement_matchs` (build_targets.py), jamais utilisée par
aucun script d'entraînement jusqu'ici alors que la table existe depuis
longtemps -- cible `home_win` (0/1) déjà calculée, features déjà dupliquées
home_*/away_* (MATCH_FEATURE_COLS, incluant explicitement
`victoires_pct_domicile_saison`/`victoires_pct_exterieur_saison` -- le
domicile/extérieur est donc DÉJÀ une dimension du modèle, signalé comme
important par l'utilisateur).

Même squelette que train_doubledouble_model.py (classification directe,
predict_proba, calibration par tranche, split temporel) -- généralisé au
niveau MATCH plutôt que JOUEUR.

Usage:
    python train_home_win_model.py
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

# Mêmes colonnes brutes que MATCH_FEATURE_COLS (build_targets.py), déjà
# dupliquées home_*/away_* dans entrainement_matchs -- pas de raison de
# diverger, une seule définition de "quelles features compte un match" pour
# tout ce projet.
BASE_FEATURE_COLS = [
    "rest_days", "is_back_to_back", "games_played_season_avant",
    "pts_pour_moy5", "pts_pour_moy10", "pts_contre_moy5", "pts_contre_moy10",
    "victoires_pct_moy5", "victoires_pct_moy10",
    "off_rating_moy5", "off_rating_moy10", "def_rating_moy5", "def_rating_moy10",
    "net_rating_moy5", "net_rating_moy10", "pace_moy5", "pace_moy10",
    "confrontations_directes_nb", "confrontations_directes_victoires_pct",
    "confrontations_directes_ecart_moy", "continuite_effectif_saison",
]
FEATURE_COLS = [f"home_{c}" for c in BASE_FEATURE_COLS] + [f"away_{c}" for c in BASE_FEATURE_COLS]

# Exclues de BASE_FEATURE_COLS (23/08/2026, bug réel trouvé en 1er
# entraînement) : victoires_pct_domicile_saison/victoires_pct_exterieur_saison
# sont TOUJOURS NULL côté "venue non jouée aujourd'hui" (away_*_domicile_*
# et home_*_exterieur_* -- 6602/6602 lignes, 100%) -- ces 2 colonnes ne sont
# calculées côté features_equipe QUE pour le lieu RÉELLEMENT joué ce
# jour-là. Le signal utile équivalent (l'équipe à domicile aujourd'hui vue
# sous son angle domicile, l'équipe à l'extérieur vue sous son angle
# extérieur) reste capté par home_victoires_pct_moy5/10 et
# away_victoires_pct_moy5/10 (forme récente, tous matchs confondus) --
# perte d'information mineure, pas un vrai manque.

TEST_FRACTION = 0.2


def load_dataset(conn: sqlite3.Connection) -> pd.DataFrame:
    cols = ", ".join(FEATURE_COLS)
    df = pd.read_sql(
        f"SELECT game_id, game_date, {cols}, home_win AS y FROM entrainement_matchs",
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


def calibration_by_bucket(y_true: np.ndarray, proba: np.ndarray, edges=(0, 0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.7, 1.0)):
    """Même principe que train_doubledouble_model.py -- ici la base rate
    tourne autour de 55-60% (avantage du terrain réel en NBA), tranches
    resserrées autour de 50% plutôt qu'étalées vers 0 comme pour un
    événement rare (double-double)."""
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

    print(f"\n{'=' * 60}\nPROBA DE VICTOIRE A DOMICILE (par match)\n{'=' * 60}")
    print(f"Dataset : {len(df)} lignes | taux de base (victoires domicile) : {df['y'].mean():.2%}")

    train, test, cutoff = temporal_split(df, TEST_FRACTION)
    print(f"Split temporel : {len(train)} train (< {cutoff.date()}) / {len(test)} test (>= {cutoff.date()})")

    X_train, y_train = train[FEATURE_COLS], train["y"]
    X_test, y_test = test[FEATURE_COLS], test["y"]

    # PAS de class_weight="balanced" (même raison que train_doubledouble_
    # model.py) : fausserait la calibration -- la base rate ~55-60% est le
    # vrai avantage du terrain NBA, pas un déséquilibre à corriger.
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
    model_path = MODELS_DIR / "home_win.joblib"
    joblib.dump({"model": model, "feature_cols": FEATURE_COLS, "target": "home_win"}, model_path)
    print(f"\nModèle sauvegardé : {model_path}")

    return model


if __name__ == "__main__":
    main()
