"""
Modele "pari joueur+periode" (cadre le 24/08/2026, entraine le 26/08/2026,
GAPS_OUVERTS.md) -- ex. "3 contres en 1ere mi-temps pour Wembanyama".
Remplace l'approximation v1 de supabase_context.py::_compute_player_period_proba_once()
(_PLAYER_PERIOD_SHARE, part fixe 25%/50% de la moyenne pleine partie) par un
vrai modele appris sur les vraies stats par periode (stats_box_scores_by_period,
backfill termine le 24/08/2026, 6602/6602 matchs).

Particularite par rapport a TOUS les autres train_*.py de ce dossier : la
CIBLE ne vit QUE dans Supabase (stats_box_scores_by_period, alimentee par
BoxScoreTraditionalV3 restreint a une periode -- le play_by_play LOCAL ne
suffit pas, contres/interceptions/passes n'y sont pas des colonnes
structurees, cf. backfill_period_box_scores.py) -- ce script est donc le
SEUL a interroger Supabase directement plutot que nba.db local. Les
FEATURES (contexte pre-match du joueur) restent EXACTEMENT les memes que
train_stat_model.py (features_joueur, LOCAL, deja calculees) -- jointes sur
(game_id, player_id). Reutilise POISSON_STATS/SHARED_COLS/feature_cols_for()
tels quels, aucune duplication de cette logique.

10 stats couvertes (REGRESSION_STATS moins plus_minus -- jamais recupere par
periode par backfill_period_box_scores.py/refresh_daily.py::
STATS_BOX_SCORE_PERIOD_COLUMNS -- exclu explicitement, meme raisonnement que
dd/td/ft/fg/fg3 deja hors perimetre du chantier duel). MEME philosophie de
pooling que train_period_model.py (equipe) : UN SEUL
modele par stat, generalise sur les 6 "periodes" (Q1-Q4 + H1/H2 = somme de 2
quarts-temps, jamais interrogees separement) via un one-hot period_Q1..
period_H2 ajoute aux features, plutot que 6 modeles dedies.

Usage:
    python train_player_period_model.py
"""

import re
import sqlite3
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.stats import norm, poisson
from sklearn.metrics import mean_absolute_error, r2_score
from supabase import create_client

from train_stat_model import POISSON_STATS, feature_cols_for  # noqa: E402
from tuning import tune_on_sample_then_refit

SCRIPT_DIR = Path(__file__).resolve().parent
DB_PATH = SCRIPT_DIR.parent / "data" / "nba.db"
MODELS_DIR = SCRIPT_DIR.parent / "models"
REPO_ROOT = SCRIPT_DIR.parents[2]
ENV_PATH = REPO_ROOT / ".env.local"

TEST_FRACTION = 0.2
MIN_SCALE = 0.5  # meme plancher que train_stat_model.py
PAGE_SIZE = 1000  # limite PostgREST par defaut, meme constante que refresh_daily.py

# Recherche d'hyperparametres sur un SOUS-ECHANTILLON temporel plutot que sur
# la totalite (decision utilisateur, 01/09/2026, cf. GAPS_OUVERTS.md) : ce
# dataset (730k lignes) rend une recherche complete hors de portee (dizaines
# d'heures PAR STAT, mesure sur train_points_model.py avant de generaliser).
# Les 20% de lignes les PLUS RECENTES DE TRAIN (jamais du test, qui reste
# intact pour l'evaluation) servent a la recherche -- le REENTRAINEMENT final
# voit toujours 100% de train (voir tune_on_sample_then_refit, tuning.py).
SEARCH_SAMPLE_FRACTION = 0.2

PERIOD_CODES = ["Q1", "Q2", "Q3", "Q4", "H1", "H2"]
PERIOD_ONE_HOT_COLS = [f"period_{p}" for p in PERIOD_CODES]

# stat -> seuils de calibration realistes A L'ECHELLE D'UNE PERIODE (bien
# plus bas qu'un match entier -- train_stat_model.py sert de reference pour
# les seuils pleine partie, ceux-ci sont recalibres pour un quart-temps/une
# mi-temps, pas juste divises mecaniquement par 4). Diagnostic pooled sur
# Q1-Q4 ET H1/H2 en meme temps (memes seuils pour les 2 echelles) -- meme
# limite de lecture DEJA acceptee par train_period_model.py (equipe) pour
# period_total_points/period_margin, pas une degradation introduite ici.
PLAYER_PERIOD_STATS: dict[str, tuple] = {
    "pts": (3, 5, 8, 10, 12),
    "reb": (2, 4, 6, 8),
    "ast": (1, 2, 3, 4),
    "fg3m": (1, 2, 3),
    "stl": (1, 2),
    "blk": (1, 2),
    "fga": (3, 5, 8, 10),
    "fg3a": (1, 2, 3),
    "oreb": (1, 2, 3),
    "min": (3, 5, 8, 10),
}

# La cible "min" vit dans la colonne Supabase "minutes" (pas "min") -- meme
# ecart de nommage que labels_joueur en local (train_stat_model.py::run()
# appelle deja label_col="minutes" pour ce cas). feature_cols_for("min") lui
# reste inchange (min_moy5/min_moy10 + contexte partage).
TARGET_COL_OVERRIDES = {"min": "minutes"}


def load_env(path: Path) -> dict:
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z_][A-Z0-9_]*)=(.*)$", line.strip())
        if m:
            values[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return values


def get_supabase_client():
    env = load_env(ENV_PATH)
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit(f"NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY introuvables dans {ENV_PATH}.")
    return create_client(url, key)


def fetch_all_period_box_scores(client) -> pd.DataFrame:
    rows: list[dict] = []
    start = 0
    while True:
        chunk = client.table("stats_box_scores_by_period").select("*").range(start, start + PAGE_SIZE - 1).execute().data
        if not chunk:
            break
        rows.extend(chunk)
        if len(chunk) < PAGE_SIZE:
            break
        start += PAGE_SIZE
    return pd.DataFrame(rows)


def build_period_labels(raw: pd.DataFrame) -> pd.DataFrame:
    """1 ligne par (game_id, player_id, period) -- Q1-Q4 telles quelles +
    H1/H2 recalculees en sommant 2 quarts-temps (jamais interrogees
    separement cote API, meme principe que la resolution cote TS)."""
    stat_cols = ["pts", "reb", "ast", "fg3m", "stl", "blk", "fga", "fg3a", "oreb", "minutes"]
    raw = raw.copy()
    raw["period"] = raw["period"].map({1: "Q1", 2: "Q2", 3: "Q3", 4: "Q4"})

    def sum_halves(p1: str, p2: str, label: str) -> pd.DataFrame:
        a = raw[raw["period"] == p1].set_index(["game_id", "player_id"])[stat_cols]
        b = raw[raw["period"] == p2].set_index(["game_id", "player_id"])[stat_cols]
        combined = a.add(b, fill_value=0).reset_index()
        combined["period"] = label
        return combined

    h1 = sum_halves("Q1", "Q2", "H1")
    h2 = sum_halves("Q3", "Q4", "H2")
    return pd.concat([raw[["game_id", "player_id", "period"] + stat_cols], h1, h2], ignore_index=True)


def temporal_split(df: pd.DataFrame, test_fraction: float):
    df = df.sort_values("game_date").reset_index(drop=True)
    cutoff_idx = int(len(df) * (1 - test_fraction))
    cutoff_date = df["game_date"].iloc[cutoff_idx]
    return df[df["game_date"] < cutoff_date], df[df["game_date"] >= cutoff_date], cutoff_date


def calibration_check(y_true, y_pred_mean, scale, thresholds, distribution: str):
    print(f"\nCalibration [{distribution}] (seuil | proba moy. prédite | taux réel | écart) :")
    for seuil in thresholds:
        if distribution == "poisson":
            proba_pred = 1 - poisson.cdf(seuil, mu=np.clip(y_pred_mean, 0.01, None))
        else:
            proba_pred = 1 - norm.cdf(seuil, loc=y_pred_mean, scale=scale)
        taux_reel = (y_true > seuil).mean()
        print(f"  > {seuil:>2} : proba moy. prédite = {proba_pred.mean():.1%}"
              f"  |  taux réel = {taux_reel:.1%}  |  écart = {proba_pred.mean() - taux_reel:+.1%}")


def run(stat: str, thresholds: tuple, merged: pd.DataFrame):
    target_col = TARGET_COL_OVERRIDES.get(stat, stat)
    cols = feature_cols_for(stat) + PERIOD_ONE_HOT_COLS
    df = merged.dropna(subset=cols + [target_col]).reset_index(drop=True)

    print(f"\n{'=' * 60}\nPERIODE -- {stat.upper()}\n{'=' * 60}")
    print(f"Dataset : {len(df)} lignes | moyenne réelle (par période, toutes périodes confondues) : {df[target_col].mean():.2f}")

    train, test, cutoff = temporal_split(df, TEST_FRACTION)
    print(f"Split temporel : {len(train)} train (< {cutoff.date()}) / {len(test)} test (>= {cutoff.date()})")

    sample_start = int(len(train) * (1 - SEARCH_SAMPLE_FRACTION))
    train_sample = train.iloc[sample_start:]
    print(f"Recherche d'hyperparametres sur un echantillon de {len(train_sample)} lignes "
          f"({SEARCH_SAMPLE_FRACTION:.0%} des plus recentes de train, sur {len(train)}).")
    model, best_params, _ = tune_on_sample_then_refit(
        train_sample[cols], train_sample[target_col], train[cols], train[target_col], task="regressor"
    )

    resid_std = float(np.std(train[target_col] - model.predict(train[cols])))
    test_pred = model.predict(test[cols])

    mae = mean_absolute_error(test[target_col], test_pred)
    r2 = r2_score(test[target_col], test_pred)
    print(f"MAE (test) : {mae:.2f} | R² (test) : {r2:.3f} | écart-type global de repli : {resid_std:.2f}")

    print("Importance des features :")
    for name, imp in sorted(zip(cols, model.feature_importances_), key=lambda x: -x[1])[:6]:
        print(f"  {name:<28} {imp:.3f}")

    distribution = "poisson" if stat in POISSON_STATS else "normal"
    test_scale = np.full(len(test), max(resid_std, MIN_SCALE))
    calibration_check(test[target_col].to_numpy(), test_pred, test_scale, thresholds, distribution)

    MODELS_DIR.mkdir(exist_ok=True)
    model_path = MODELS_DIR / f"period_{stat}.joblib"
    joblib.dump(
        {"model": model, "feature_cols": cols, "resid_std": resid_std, "target": target_col, "distribution": distribution, "tuned_params": best_params},
        model_path,
    )
    print(f"Modèle sauvegardé : {model_path} (distribution: {distribution})")


def main():
    print("Récupération de stats_box_scores_by_period depuis Supabase...")
    client = get_supabase_client()
    raw = fetch_all_period_box_scores(client)
    print(f"{len(raw)} lignes brutes (Q1-Q4) récupérées.")

    labels = build_period_labels(raw)
    print(f"{len(labels)} lignes après ajout H1/H2 (Q1-Q4 inchangées + mi-temps recalculées).")

    conn = sqlite3.connect(DB_PATH)
    features = pd.read_sql("SELECT * FROM features_joueur", conn, dtype={"game_id": str})
    conn.close()
    labels["game_id"] = labels["game_id"].astype(str)

    merged = features.merge(labels, on=["game_id", "player_id"], how="inner")
    merged["game_date"] = pd.to_datetime(merged["game_date"])
    for p in PERIOD_CODES:
        merged[f"period_{p}"] = (merged["period"] == p).astype(int)
    print(f"{len(merged)} lignes après jointure avec les features pré-match (features_joueur).")

    for stat, thresholds in PLAYER_PERIOD_STATS.items():
        run(stat, thresholds, merged)


if __name__ == "__main__":
    main()
