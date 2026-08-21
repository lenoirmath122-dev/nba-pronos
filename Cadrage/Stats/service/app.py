"""
Micro-service Python (FastAPI) exposant l'inférence des 12 modèles de
probabilité (Cadrage/Stats/models/*.joblib) à l'appli Next.js — Phase 4 du
plan en 5 phases (projet-data-nba.md §16), décidée avec l'utilisateur le
21/08/2026 (micro-service HTTP plutôt que réimplémenter l'inférence en
TypeScript, ou un job batch qui écrirait dans Supabase).

Réutilise tel quel le code de scripts/tester_modele.py (compute_proba(),
find_player(), find_team()) -- aucune logique dupliquée, ce service est une
fine couche HTTP par-dessus le CLI déjà vérifié en conditions réelles.

Nature : proposition/brique technique, PAS ENCORE DÉPLOYÉE. L'hébergement
(Vercel ne fait pas tourner un service Python à disque persistant) reste à
choisir (Render/Railway/Fly.io/VPS) -- voir le bandeau REPRISE de
projet-data-nba.md. /refresh est un stub : le vrai fetch incrémental
(nba_api) n'est pas encore construit, laissé pour la suite de la Phase 4.

Usage local :
    pip install -r requirements.txt
    uvicorn app:app --reload --port 8000
    curl -X POST localhost:8000/predict -H "Content-Type: application/json" \
        -d '{"joueur": "Tatum", "stat": "ft", "seuil": 0.85}'
"""

import sqlite3
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, model_validator

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

from tester_modele import (  # noqa: E402
    CLASSIFIER_STATS,
    DB_PATH,
    MODELS_DIR,
    PCT_STATS,
    REGRESSION_STATS,
    compute_proba,
    find_player,
    find_team,
)

STATS_DISPONIBLES = sorted(set(REGRESSION_STATS) | set(CLASSIFIER_STATS) | set(PCT_STATS))

app = FastAPI(
    title="NBA Pronos — service de proba",
    description="Enveloppe HTTP des modèles Cadrage/Stats (voir projet-data-nba.md)",
)


class PredictRequest(BaseModel):
    joueur: str | None = None
    joueur_id: int | None = None
    stat: str
    seuil: float | None = None
    adversaire: str | None = None
    exterieur: bool = False
    repos: int = 2

    @model_validator(mode="after")
    def _un_seul_identifiant_joueur(self):
        if (self.joueur is None) == (self.joueur_id is None):
            raise ValueError("fournir exactement un de joueur / joueur_id")
        return self


@app.get("/health")
def health():
    modeles = sorted(p.stem for p in MODELS_DIR.glob("*.joblib")) if MODELS_DIR.exists() else []
    return {
        "status": "ok",
        "base_presente": DB_PATH.exists(),
        "modeles_charges": modeles,
        "stats_disponibles": STATS_DISPONIBLES,
    }


@app.post("/predict")
def predict(req: PredictRequest):
    if req.stat not in STATS_DISPONIBLES:
        raise HTTPException(400, f"stat inconnue \"{req.stat}\" -- disponibles : {STATS_DISPONIBLES}")

    conn = sqlite3.connect(DB_PATH)
    try:
        if req.joueur_id is not None:
            player_id, player_name = req.joueur_id, f"player_id={req.joueur_id}"
        else:
            try:
                player_id, player_name = find_player(conn, req.joueur)
            except SystemExit as e:
                raise HTTPException(400, str(e)) from e

        opponent_id, opponent_name = None, None
        if req.adversaire:
            try:
                opponent_id, opponent_name = find_team(conn, req.adversaire)
            except SystemExit as e:
                raise HTTPException(400, str(e)) from e

        try:
            result = compute_proba(
                conn, player_id, req.stat, req.seuil,
                opponent_id=opponent_id, is_home=0 if req.exterieur else 1, rest_days=req.repos,
            )
        except ValueError as e:
            raise HTTPException(400, str(e)) from e
    finally:
        conn.close()

    return {
        "joueur": player_name,
        "adversaire": opponent_name,
        "stat": req.stat,
        "seuil": req.seuil,
        **result,
    }


@app.post("/refresh")
def refresh():
    """Stub -- le fetch incrémental nba_api (nouveaux matchs depuis le
    dernier connu, sans tout retélécharger) n'est pas encore construit.
    Prévu pour être appelé par un cron quotidien (même patron que
    .github/workflows/sync-results.yml côté appli), une fois écrit."""
    raise HTTPException(501, "pas encore implémenté -- voir projet-data-nba.md, bandeau REPRISE")
