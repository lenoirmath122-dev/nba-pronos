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
        "joueur_id": player_id,
        "adversaire": opponent_name,
        "stat": req.stat,
        "seuil": req.seuil,
        **result,
    }


class PredictTotalPointsRequest(BaseModel):
    """Piece (a) du chantier paris equipe (GAPS_OUVERTS.md, cadre le
    23/08/2026) -- 1er pari SANS JOUEUR : points combines du match
    (home_score+away_score). MATCH uniquement pour l'instant (pas SERIES,
    decide avec l'utilisateur -- viendra dans un 2e temps)."""
    equipe_domicile: str
    equipe_exterieur: str
    seuil: float
    comparison: str  # "OVER" | "UNDER"
    as_of_date: str
    season: str | None = None


@app.post("/predict-total-points")
def predict_total_points(req: PredictTotalPointsRequest):
    sb = _client()

    try:
        home_id, home_name = supabase_context.find_team(sb, req.equipe_domicile)
        away_id, away_name = supabase_context.find_team(sb, req.equipe_exterieur)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    try:
        result = supabase_context.compute_total_points_proba(
            sb, home_id, away_id, req.seuil, req.comparison, req.as_of_date, season=req.season,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    return {
        "equipe_domicile": home_name,
        "equipe_exterieur": away_name,
        "seuil": req.seuil,
        "comparison": req.comparison,
        **result,
    }


class PredictOvertimeRequest(BaseModel):
    """Chantier "prolongation" (GAPS_OUVERTS.md, cadre le 24/08/2026) --
    stat MATCH binaire directe, sans seuil ni comparison (meme absence que
    dd/td cote joueur) : proba que CE match aille en prolongation. MEME
    contrat que PredictTotalPointsRequest, moins seuil/comparison."""
    equipe_domicile: str
    equipe_exterieur: str
    as_of_date: str
    season: str | None = None


@app.post("/predict-overtime")
def predict_overtime(req: PredictOvertimeRequest):
    sb = _client()

    try:
        home_id, home_name = supabase_context.find_team(sb, req.equipe_domicile)
        away_id, away_name = supabase_context.find_team(sb, req.equipe_exterieur)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    try:
        result = supabase_context.compute_overtime_proba(sb, home_id, away_id, req.as_of_date, season=req.season)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    return {
        "equipe_domicile": home_name,
        "equipe_exterieur": away_name,
        **result,
    }


class PredictTotalReboundsRequest(BaseModel):
    """Piece (a) suite (GAPS_OUVERTS.md, 23/08/2026) -- 2e forme du pari
    rebonds : rebonds COMBINES du match (a cote de /predict-team-rebounds,
    perspective par equipe). MEME contrat que PredictTotalPointsRequest."""
    equipe_domicile: str
    equipe_exterieur: str
    seuil: float
    comparison: str  # "OVER" | "UNDER"
    as_of_date: str
    season: str | None = None


@app.post("/predict-total-rebounds")
def predict_total_rebounds(req: PredictTotalReboundsRequest):
    sb = _client()

    try:
        home_id, home_name = supabase_context.find_team(sb, req.equipe_domicile)
        away_id, away_name = supabase_context.find_team(sb, req.equipe_exterieur)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    try:
        result = supabase_context.compute_total_team_stat_proba(
            sb, "reb", home_id, away_id, req.seuil, req.comparison, req.as_of_date, season=req.season,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    return {
        "equipe_domicile": home_name,
        "equipe_exterieur": away_name,
        "seuil": req.seuil,
        "comparison": req.comparison,
        **result,
    }


class PredictTeamReboundsRequest(BaseModel):
    """Piece (a) suite (GAPS_OUVERTS.md, 23/08/2026) -- 1ere forme du pari
    rebonds : rebonds d'UNE equipe precise sur CE match (perspective "own"/
    "opp", pas domicile/exterieur -- reutilisable que l'equipe visee recoive
    ou se deplace)."""
    equipe: str  # equipe visee par le pari
    adversaire: str
    equipe_domicile: bool  # True si `equipe` recoit sur CE match precis
    seuil: float
    comparison: str  # "OVER" | "UNDER"
    as_of_date: str
    season: str | None = None


@app.post("/predict-team-rebounds")
def predict_team_rebounds(req: PredictTeamReboundsRequest):
    sb = _client()

    try:
        team_id, team_name = supabase_context.find_team(sb, req.equipe)
        opponent_id, opponent_name = supabase_context.find_team(sb, req.adversaire)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    try:
        result = supabase_context.compute_team_stat_proba(
            sb, "reb", team_id, opponent_id, req.equipe_domicile, req.seuil, req.comparison, req.as_of_date,
            season=req.season,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    return {
        "equipe": team_name,
        "adversaire": opponent_name,
        "seuil": req.seuil,
        "comparison": req.comparison,
        **result,
    }


# Codes stat generalisables aux formes "combinee"/"equipe precise"
# ci-dessous (23/08/2026, piece (a) suite -- reb deja servi par les
# endpoints dedies au-dessus, gardes tels quels pour ne pas casser un
# contrat HTTP deja deploye ; ast/fg3m/stl/blk passent par ces 2 nouveaux
# endpoints generiques plutot que 8 endpoints dedies supplementaires).
# "pts" (23/08/2026, extension "faciles") : UNIQUEMENT la forme "equipe
# precise" (team_pts.joblib entraine) -- PAS la forme combinee, deja
# couverte par total_points (endpoint dedie existant) -- total_pts.joblib
# n'existe pas, 2 listes separees plutot qu'une commune pour ne pas planter
# sur un stat valide cote "equipe precise" mais absent cote "combine".
# "oreb" (23/08/2026, extension "faciles") : les 2 formes, contrairement a
# "pts" -- total_oreb.joblib ET team_oreb.joblib existent tous les 2.
TOTAL_TEAM_STAT_CODES = ["reb", "ast", "fg3m", "stl", "blk", "oreb"]
TEAM_STAT_CODES = ["pts", "reb", "ast", "fg3m", "stl", "blk", "oreb"]


class PredictTotalTeamStatRequest(BaseModel):
    """Forme "combinee" (23/08/2026, piece (a) suite) generalisee a
    n'importe quelle stat de TEAM_STAT_CODES -- MEME contrat que
    PredictTotalReboundsRequest, + le champ `stat`."""
    stat: str
    equipe_domicile: str
    equipe_exterieur: str
    seuil: float
    comparison: str  # "OVER" | "UNDER"
    as_of_date: str
    season: str | None = None


@app.post("/predict-total-team-stat")
def predict_total_team_stat(req: PredictTotalTeamStatRequest):
    if req.stat not in TOTAL_TEAM_STAT_CODES:
        raise HTTPException(400, f"stat inconnue : {req.stat} (attendu parmi {TOTAL_TEAM_STAT_CODES})")

    sb = _client()

    try:
        home_id, home_name = supabase_context.find_team(sb, req.equipe_domicile)
        away_id, away_name = supabase_context.find_team(sb, req.equipe_exterieur)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    try:
        result = supabase_context.compute_total_team_stat_proba(
            sb, req.stat, home_id, away_id, req.seuil, req.comparison, req.as_of_date, season=req.season,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    return {
        "equipe_domicile": home_name,
        "equipe_exterieur": away_name,
        "seuil": req.seuil,
        "comparison": req.comparison,
        **result,
    }


class PredictTeamStatRequest(BaseModel):
    """Forme "equipe precise" (23/08/2026, piece (a) suite) generalisee a
    n'importe quelle stat de TEAM_STAT_CODES -- MEME contrat que
    PredictTeamReboundsRequest, + le champ `stat`."""
    stat: str
    equipe: str
    adversaire: str
    equipe_domicile: bool
    seuil: float
    comparison: str  # "OVER" | "UNDER"
    as_of_date: str
    season: str | None = None


@app.post("/predict-team-stat")
def predict_team_stat(req: PredictTeamStatRequest):
    if req.stat not in TEAM_STAT_CODES:
        raise HTTPException(400, f"stat inconnue : {req.stat} (attendu parmi {TEAM_STAT_CODES})")

    sb = _client()

    try:
        team_id, team_name = supabase_context.find_team(sb, req.equipe)
        opponent_id, opponent_name = supabase_context.find_team(sb, req.adversaire)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    try:
        result = supabase_context.compute_team_stat_proba(
            sb, req.stat, team_id, opponent_id, req.equipe_domicile, req.seuil, req.comparison, req.as_of_date,
            season=req.season,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    return {
        "equipe": team_name,
        "adversaire": opponent_name,
        "seuil": req.seuil,
        "comparison": req.comparison,
        **result,
    }


class ComparisonOperand(BaseModel):
    """Un cote d'un duel (24/08/2026, GAPS_OUVERTS.md, chantier
    comparaison/duel) -- kind=TEAM (equipe "domicile"/"exterieur" du match
    vise + stat) ou kind=PLAYER (1+ joueurs de MEME stat, sommes si
    plusieurs -- 1 nom = joueur seul, 2+ = cumul, meme formule)."""
    kind: str  # "PLAYER" | "TEAM"
    joueurs: list[str] | None = None  # kind=PLAYER uniquement
    equipe: str | None = None  # kind=TEAM uniquement, "domicile" | "exterieur"
    stat: str

    @model_validator(mode="after")
    def _champs_coherents_avec_kind(self):
        if self.kind == "PLAYER" and not self.joueurs:
            raise ValueError("joueurs (1+) requis pour kind=PLAYER")
        if self.kind == "TEAM" and self.equipe not in ("domicile", "exterieur"):
            raise ValueError("equipe doit valoir \"domicile\" ou \"exterieur\" pour kind=TEAM")
        if self.kind not in ("PLAYER", "TEAM"):
            raise ValueError(f"kind inconnu : {self.kind}")
        return self


class PredictComparisonRequest(BaseModel):
    """Pari DUEL/COMPARAISON (24/08/2026, GAPS_OUVERTS.md) -- P(gauche >
    multiplier*droite) [relation=GT] ou P(|gauche-droite| < threshold)
    [relation=DIFF_LT]. equipe_domicile/equipe_exterieur : les 2 VRAIES
    equipes du match vise (meme contrat que PredictTeamReboundsRequest),
    necessaires pour resoudre le contexte domicile/exterieur de chaque
    operande (equipe ou joueur)."""
    left: ComparisonOperand
    right: ComparisonOperand
    relation: str  # "GT" | "DIFF_LT"
    multiplier: float = 1.0
    threshold: float | None = None  # relation=DIFF_LT uniquement
    equipe_domicile: str
    equipe_exterieur: str
    as_of_date: str
    season: str | None = None

    @model_validator(mode="after")
    def _relation_coherente(self):
        if self.relation not in ("GT", "DIFF_LT"):
            raise ValueError(f"relation inconnue : {self.relation}")
        if self.relation == "DIFF_LT" and self.threshold is None:
            raise ValueError("threshold obligatoire pour relation=DIFF_LT")
        return self


@app.post("/predict-comparison")
def predict_comparison(req: PredictComparisonRequest):
    sb = _client()

    try:
        home_id, home_name = supabase_context.find_team(sb, req.equipe_domicile)
        away_id, away_name = supabase_context.find_team(sb, req.equipe_exterieur)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    try:
        result = supabase_context.compute_comparison_proba(
            sb, req.left.model_dump(), req.right.model_dump(), req.relation, req.multiplier, req.threshold,
            home_id, away_id, req.as_of_date, season=req.season,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    return {
        "equipe_domicile": home_name,
        "equipe_exterieur": away_name,
        "relation": req.relation,
        **result,
    }


class ComboCondition(BaseModel):
    """Une condition d'un pari COMBO (24/08/2026, GAPS_OUVERTS.md, chantier
    combo -- ET de N conditions) -- kind=TEAM (equipe "domicile"/
    "exterieur" du match vise) ou kind=PLAYER (1+ joueurs). `stats` : 1+
    codes de stat sommes -- 1 seul = cas normal, 2+ = style PRA
    ("25pts+12reb+8pas cumules" pour UN joueur). seuil : None uniquement
    pour dd/td (kind=PLAYER, stats=["dd"] ou ["td"])."""
    kind: str  # "PLAYER" | "TEAM"
    joueurs: list[str] | None = None  # kind=PLAYER uniquement
    equipe: str | None = None  # kind=TEAM uniquement, "domicile" | "exterieur"
    stats: list[str]
    seuil: float | None = None
    comparison: str  # "OVER" | "UNDER"

    @model_validator(mode="after")
    def _champs_coherents_avec_kind(self):
        if self.kind == "PLAYER" and not self.joueurs:
            raise ValueError("joueurs (1+) requis pour kind=PLAYER")
        if self.kind == "TEAM" and self.equipe not in ("domicile", "exterieur"):
            raise ValueError("equipe doit valoir \"domicile\" ou \"exterieur\" pour kind=TEAM")
        if self.kind not in ("PLAYER", "TEAM"):
            raise ValueError(f"kind inconnu : {self.kind}")
        if not self.stats:
            raise ValueError("stats (1+) requis")
        return self


class PredictComboRequest(BaseModel):
    """Pari COMBO (24/08/2026, GAPS_OUVERTS.md) -- ET de N conditions
    INDEPENDANTES (P(combo) = produit des P(condition_i)). Meme contrat
    equipe_domicile/equipe_exterieur que PredictComparisonRequest."""
    conditions: list[ComboCondition]
    equipe_domicile: str
    equipe_exterieur: str
    as_of_date: str
    season: str | None = None

    @model_validator(mode="after")
    def _au_moins_une_condition(self):
        if not self.conditions:
            raise ValueError("conditions (1+) requis")
        return self


@app.post("/predict-combo")
def predict_combo(req: PredictComboRequest):
    sb = _client()

    try:
        home_id, home_name = supabase_context.find_team(sb, req.equipe_domicile)
        away_id, away_name = supabase_context.find_team(sb, req.equipe_exterieur)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    try:
        result = supabase_context.compute_combo_proba(
            sb, [c.model_dump() for c in req.conditions], home_id, away_id, req.as_of_date, season=req.season,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    return {
        "equipe_domicile": home_name,
        "equipe_exterieur": away_name,
        **result,
    }


class PredictSeriesRequest(BaseModel):
    joueur: str | None = None
    joueur_id: int | None = None
    stat: str
    seuil: float | None = None
    comparison: str | None = None  # "OVER" | "UNDER" | None (dd/td, sans seuil)
    equipe_domicile_serie: str  # equipe avec l'avantage du terrain (recoit aux matchs 1/2/5/7)
    equipe_exterieur_serie: str
    equipe_joueur: str  # doit correspondre a equipe_domicile_serie ou equipe_exterieur_serie
    as_of_date: str
    season: str | None = None  # deduite de as_of_date si omise
    best_of: int = 7

    @model_validator(mode="after")
    def _un_seul_identifiant_joueur(self):
        if (self.joueur is None) == (self.joueur_id is None):
            raise ValueError("fournir exactement un de joueur / joueur_id")
        return self


@app.post("/predict-series")
def predict_series(req: PredictSeriesRequest):
    """Pari SERIE (brique (c), GAPS_OUVERTS.md) -- proba qu'un evenement se
    produise AU MOINS UNE FOIS sur la serie, fidele domicile/exterieur.
    Reutilise les 12 memes modeles joueur que /predict (rien de specifique
    a une stat ici)."""
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

    try:
        team_a_id, team_a_name = supabase_context.find_team(sb, req.equipe_domicile_serie)
        team_b_id, team_b_name = supabase_context.find_team(sb, req.equipe_exterieur_serie)
        player_team_id, _ = supabase_context.find_team(sb, req.equipe_joueur)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    if player_team_id not in (team_a_id, team_b_id):
        raise HTTPException(400, f"\"{req.equipe_joueur}\" ne correspond a aucune des 2 equipes de la serie.")

    try:
        result = supabase_context.compute_series_stat_proba(
            sb, player_id, req.stat, req.seuil,
            team_a_id=team_a_id, team_b_id=team_b_id, player_team_id=player_team_id,
            as_of_date=req.as_of_date, season=req.season, comparison=req.comparison, best_of=req.best_of,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    return {
        "joueur": player_name,
        "joueur_id": player_id,
        "equipe_domicile_serie": team_a_name,
        "equipe_exterieur_serie": team_b_name,
        "stat": req.stat,
        "seuil": req.seuil,
        "comparison": req.comparison,
        **result,
    }


@app.post("/refresh")
def refresh():
    """Stub -- le fetch incrémental nba_api (nouveaux matchs depuis le
    dernier connu -> upsert Supabase) n'est pas encore construit. Prévu pour
    être appelé par un cron quotidien (même patron que
    .github/workflows/sync-results.yml côté appli), une fois écrit."""
    raise HTTPException(501, "pas encore implémenté -- voir projet-data-nba.md, bandeau REPRISE")
