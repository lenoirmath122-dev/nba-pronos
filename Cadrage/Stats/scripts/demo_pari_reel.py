"""
DÉMO jetable : applique le modèle SAUVEGARDÉ (Cadrage/Stats/models/points.joblib,
produit par train_points_model.py) à un vrai texte de pari perso tiré du
classeur historique (Cadrage/DA/*.xlsx). Charge le modèle depuis le disque —
ne réentraîne PLUS rien (avant le 20/08/2026, ce script réentraînait à
chaque exécution ; le modèle est maintenant persistant, voir
projet-data-nba.md §13). Si le fichier n'existe pas encore, lancer
`python train_points_model.py` une fois avant.

Étape de structuration (texte libre -> événement calculable) faite ICI À LA
MAIN, en attendant la vraie brique IA (spec dédiée,
Cadrage/V1/SPEC_TECHNIQUE_PROBA_PARIS_PERSOS_V0_1.md §3, pas encore construite).

LIMITE ASSUMÉE : les vrais matchs du classeur (playoffs 2025-26, avril-juin
2026) ne sont pas encore en base (fetch encore en cours au moment d'écrire
ceci) -> le contexte "à jour" utilisé ici est calculé à partir des 10
derniers matchs RÉELLEMENT connus du joueur, pas de la vraie date du pari.
La mécanique est fidèle, la date ne l'est pas encore.

Usage:
    python demo_pari_reel.py
"""

import sqlite3
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.stats import norm

SCRIPT_DIR = Path(__file__).resolve().parent
DB_PATH = SCRIPT_DIR.parent / "data" / "nba.db"
MODEL_PATH = SCRIPT_DIR.parent / "models" / "points.joblib"

# --- Le pari à tester (texte réel du classeur, structuré à la main) ---
PARI_TEXTE = "Tatum plante +40 points"
PARI_AUTEUR_DATE = "Mathieu, 24/04/2026"
PARI_MATCH = "Philadelphia 76ers @ Boston Celtics"
JOUEUR_ID = 1628369        # Jayson Tatum
JOUEUR_NOM = "Jayson Tatum"
ADVERSAIRE_ID = 1610612755  # Philadelphia 76ers
ADVERSAIRE_NOM = "Philadelphia 76ers"
SEUIL_PARI = 40


def minutes_to_float(m):
    if pd.isna(m) or m in ("", "0"):
        return 0.0
    m = str(m)
    if ":" in m:
        mins, secs = m.split(":")
        return float(mins) + float(secs) / 60
    return float(m)


def load_model():
    if not MODEL_PATH.exists():
        raise SystemExit(f"{MODEL_PATH} introuvable — lance d'abord `python train_points_model.py`.")
    bundle = joblib.load(MODEL_PATH)
    return bundle["model"], bundle["feature_cols"], bundle["resid_std"]


def build_player_context(conn, player_id: int, opponent_id: int):
    """Reconstruit le contexte 'à jour' du joueur à partir de ses 10 derniers
    matchs réellement connus (même définitions que build_features.py, mais
    incluant le tout dernier match, puisqu'on veut prédire le match SUIVANT)."""
    recent = pd.read_sql(
        """
        SELECT m.game_date, b.minutes, b.pts, b.plus_minus, a.ts_pct, a.usg_pct,
               f.opponent_team_id, f.games_played_season_avant
        FROM box_scores b
        JOIN matchs m ON m.game_id = b.game_id
        JOIN box_scores_advanced a ON a.game_id = b.game_id AND a.player_id = b.player_id
        JOIN features_joueur f ON f.game_id = b.game_id AND f.player_id = b.player_id
        WHERE b.player_id = ?
        ORDER BY m.game_date DESC LIMIT 10
        """,
        conn, params=(player_id,),
    )
    recent["minutes_f"] = recent["minutes"].apply(minutes_to_float)

    vs_adv = pd.read_sql(
        """
        SELECT b.pts FROM box_scores b
        JOIN features_joueur f ON f.game_id = b.game_id AND f.player_id = b.player_id
        WHERE b.player_id = ? AND f.opponent_team_id = ?
        """,
        conn, params=(player_id, opponent_id),
    )

    last5 = recent.head(5)
    ecarttype10 = recent["pts"].std()  # dispersion PROPRE au joueur (10 derniers matchs, ddof=1 comme build_features.py)
    context = {
        "pts_moy5": last5["pts"].mean(),
        "pts_moy10": recent["pts"].mean(),
        "min_moy5": last5["minutes_f"].mean(),
        "min_moy10": recent["minutes_f"].mean(),
        "is_home": 1,  # illustratif : date/salle réelles pas encore en base
        "rest_days": 2,  # illustratif, idem
        "is_back_to_back": 0,  # illustratif, idem
        "games_played_season_avant": int(recent["games_played_season_avant"].iloc[0]) + 1,
        "ts_pct_moy5": last5["ts_pct"].mean(),
        "usg_pct_moy5": last5["usg_pct"].mean(),
        "plus_minus_moy5": last5["plus_minus"].mean(),
        "vs_adversaire_pts_moy": vs_adv["pts"].mean() if not vs_adv.empty else np.nan,
        "matchs_manques_depuis_dernier": 0,  # illustratif : on simule le match juste après le dernier connu
    }
    return context, recent, vs_adv, ecarttype10


def main():
    model, feature_cols, resid_std = load_model()

    conn = sqlite3.connect(DB_PATH)
    context, recent, vs_adv, ecarttype10 = build_player_context(conn, JOUEUR_ID, ADVERSAIRE_ID)
    conn.close()

    # Dispersion propre au joueur si connue (>= 2 matchs), sinon repli sur l'écart-type global
    # (plancher à 1.0 : évite une dispersion nulle si points identiques sur les 10 derniers matchs)
    scale = max(ecarttype10 if pd.notna(ecarttype10) else resid_std, 1.0)

    print(f"=== Pari perso réel (classeur, {PARI_AUTEUR_DATE}) ===")
    print(f'"{PARI_TEXTE}" -- {PARI_MATCH}\n')

    print("Structuration (faite à la main, la brique IA n'existe pas encore) :")
    print(f"  joueur = {JOUEUR_NOM} | stat = points | seuil = {SEUIL_PARI} | structure = seuil supérieur\n")

    print(f"Contexte utilisé (10 derniers matchs RÉELLEMENT connus, {recent['game_date'].min()} -> {recent['game_date'].max()}) :")
    for k, v in context.items():
        print(f"  {k:<28} {v:.2f}" if isinstance(v, float) else f"  {k:<28} {v}")
    print(f"  (Historique vs {ADVERSAIRE_NOM} : {vs_adv['pts'].tolist()} pts sur {len(vs_adv)} match(s))\n")

    X = pd.DataFrame([context])[feature_cols]
    pred_mean = model.predict(X)[0]
    proba = 1 - norm.cdf(SEUIL_PARI, loc=pred_mean, scale=scale)

    print(f"Écart-type propre à {JOUEUR_NOM} (10 derniers matchs) : {ecarttype10:.2f}"
          f" | écart-type global de repli : {resid_std:.2f} | utilisé : {scale:.2f}")
    print(f"Prédiction du modèle : {pred_mean:.1f} pts (+/- {scale:.1f})")
    print(f"P({JOUEUR_NOM} > {SEUIL_PARI} pts) = {proba:.1%}")


if __name__ == "__main__":
    main()
