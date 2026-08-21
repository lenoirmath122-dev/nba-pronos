"""
Micro-service Python (FastAPI) exposant l'inférence des 12 modèles de
probabilité (Cadrage/Stats/models/*.joblib) à l'appli Next.js — Phase 4 du
plan en 5 phases (projet-data-nba.md §16/§22-23), décidée avec l'utilisateur
le 21/08/2026.

Architecture B (sans état, choisie le 21/08/2026 après comparaison avec un
service auto-suffisant à disque local) : le service ne garde AUCUN état --
les modèles sont embarqués dans l'image au build (git), le contexte "à jour"
d'un joueur (stats_equipes/stats_joueurs/stats_box_scores, backfill_supabase.py)
vient de Supabase via supabase_context.py. Permet un hébergement serverless
sans disque persistant (Google Cloud Run, choisi le 21/08/2026).

Nature : PAS ENCORE DÉPLOYÉ. Reste à faire : peupler Supabase
(backfill_supabase.py, une fois), écrire le Dockerfile + déployer sur Cloud
Run, et le rafraîchissement quotidien (nba_api incrémental -> upsert
Supabase, remplace le stub /refresh) -- voir GAPS_OUVERTS.md.

Usage local (nécessite Supabase déjà peuplé, cf. backfill_supabase.py) :
    pip install -r requirements.txt
    export SUPABASE_URL=...          # ou NEXT_PUBLIC_SUPABASE_URL
    export SUPABASE_SERVICE_ROLE_KEY=...
    uvicorn app:app --reload --port 8000
    curl -X POST localhost:8000/predict -H "Content-Type: application/json" \
        -d '{"joueur": "Tatum", "stat": "ft", "seuil": 0.85}'
"""

import os
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, model_validator
from supabase import create_client

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

from tester_modele import CLASSIFIER_STATS, MODELS_DIR, PCT_STATS, REGRESSION_STATS  # noqa: E402

import supabase_context  # noqa: E402

STATS_DISPONIBLES = sorted(set(REGRESSION_STATS) | set(CLASSIFIER_STATS) | set(PCT_STATS))


def get_supabase_client():
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY "
            "doivent être définies comme variables d'environnement du service."
        )
    return create_client(url, key)


app = FastAPI(
    title="NBA Pronos — service de proba",
    description="Enveloppe HTTP des modèles Cadrage/Stats (voir projet-data-nba.md)",
)
client = None  # créé paresseusement (1er appel), pas au chargement du module -- healthcheck simple sans Supabase joignable


def _client():
    global client
    if client is None:
        client = get_supabase_client()
    return client


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
        "modeles_charges": modeles,
        "stats_disponibles": STATS_DISPONIBLES,
    }


@app.post("/predict")
def predict(req: PredictRequest):
    if req.stat not in STATS_DISPONIBLES:
        raise HTTPException(400, f"stat inconnue \"{req.stat}\" -- disponibles : {STATS_DISPONIBLES}")

    sb = _client()

    if req.joueur_id is not None:
        player_id, player_name = req.joueur_id, f"player_id={req.joueur_id}"
    else:
        try:
            player_id, player_name = supabase_context.find_player(sb, req.joueur)
        except ValueError as e:
            raise HTTPException(400, str(e)) from e

    opponent_id, opponent_name = None, None
    if req.adversaire:
        try:
            opponent_id, opponent_name = supabase_context.find_team(sb, req.adversaire)
        except ValueError as e:
            raise HTTPException(400, str(e)) from e

    try:
        result = supabase_context.compute_proba(
            sb, player_id, req.stat, req.seuil,
            opponent_id=opponent_id, is_home=0 if req.exterieur else 1, rest_days=req.repos,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

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
    dernier connu -> upsert Supabase) n'est pas encore construit. Prévu pour
    être appelé par un cron quotidien (même patron que
    .github/workflows/sync-results.yml côté appli), une fois écrit."""
    raise HTTPException(501, "pas encore implémenté -- voir projet-data-nba.md, bandeau REPRISE")
