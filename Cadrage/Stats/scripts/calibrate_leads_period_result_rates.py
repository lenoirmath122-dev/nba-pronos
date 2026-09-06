"""
Calibration des taux de base historiques pour "mène a la fin de cette
periode" -> resultat final (GAPS_OUVERTS.md, "formulation periode sans le
mot 'temps'", 06/09/2026), pour Q1 et Q3 -- les 2 seuls seuils utiles sans
modele dedie (H1/Q2 ont deja period_leads_half_result.joblib, entraine
DIRECTEMENT sur cette cible jointe ; Q4/H2 sont degeneres, menent a la
toute fin du match = deja le resultat final).

Principe : PAS un nouveau modele entraine par match (echantillon deja trop
mince pour ca a l'echelle mi-temps -- 12.8% de la classe LOSES sur 13204
lignes, encore plus rare a Q1/Q3, ecart trop rare pour du signal fiable
d'un modele) -- juste un COMPTAGE simple sur l'historique complet, meme
esprit que calibrate_difficulty_thresholds.py (simuler/mesurer plutot que
deviner "a vue de nez"). Resultat a copier a la main dans
lib/ai/periodStatCodes.ts::GENERIC_LEADS_PERIOD_RESULT_RATES -- usage
INFORMATIF seulement (suggested_difficulty pour l'admin en file de
validation manuelle), jamais une proba pour auto-validation/
auto-resolution.

Usage:
    python calibrate_leads_period_result_rates.py
"""

import sqlite3
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_targets import DB_PATH, _quarter_scores_from_pbp  # noqa: E402

_CUMULATIVE_QUARTERS = {"Q1": [1], "Q3": [1, 2, 3]}


def compute_rates(conn: sqlite3.Connection, period: str) -> dict:
    matchs = pd.read_sql(
        "SELECT game_id, home_team_id, home_score, away_score FROM matchs "
        "WHERE home_team_id IS NOT NULL AND home_score IS NOT NULL",
        conn, dtype={"game_id": str},
    )
    qs = _quarter_scores_from_pbp(conn)
    ctx = matchs.merge(qs, on="game_id", how="left")

    quarters = _CUMULATIVE_QUARTERS[period]
    home_cum = sum(ctx[f"home_q{p}"] for p in quarters)
    away_cum = sum(ctx[f"away_q{p}"] for p in quarters)

    # Meme logique EXACTE que own_half_outcome (build_targets.py) mais pour
    # les 2 perspectives (home/away) d'un coup plutot qu'une ligne par
    # (game, team) -- inutile ici, on ne veut qu'un taux global agrege.
    home_leads = home_cum > away_cum
    away_leads = away_cum > home_cum
    home_wins = ctx["home_score"] > ctx["away_score"]
    away_wins = ctx["away_score"] > ctx["home_score"]

    valid = ctx["home_q1"].notna()
    leads_and_wins = int((home_leads & home_wins & valid).sum() + (away_leads & away_wins & valid).sum())
    leads_and_loses = int((home_leads & away_wins & valid).sum() + (away_leads & home_wins & valid).sum())
    ties_at_cutoff = int((~home_leads & ~away_leads & valid).sum())
    missing = int((~valid).sum())

    total_leading = leads_and_wins + leads_and_loses
    return {
        "period": period,
        "leads_and_wins": leads_and_wins,
        "leads_and_loses": leads_and_loses,
        "ties_at_cutoff": ties_at_cutoff,
        "missing": missing,
        "total_leading": total_leading,
        "wins_rate": leads_and_wins / total_leading if total_leading else float("nan"),
        "loses_rate": leads_and_loses / total_leading if total_leading else float("nan"),
    }


def main():
    conn = sqlite3.connect(DB_PATH)
    for period in ("Q1", "Q3"):
        r = compute_rates(conn, period)
        print(f"\n{'=' * 60}\nMÈNE APRÈS {period} -> RÉSULTAT FINAL\n{'=' * 60}")
        print(f"Échantillon (mène après {period}, tous matchs/équipes confondus) : {r['total_leading']}")
        print(f"  dont gagne : {r['leads_and_wins']} ({r['wins_rate']:.1%})")
        print(f"  dont perd  : {r['leads_and_loses']} ({r['loses_rate']:.1%})")
        print(f"Égalité après {period} (aucune équipe ne mène) : {r['ties_at_cutoff']} matchs")
        if r["missing"]:
            print(f"Ignorés (pas de play-by-play) : {r['missing']}")
    conn.close()


if __name__ == "__main__":
    main()
