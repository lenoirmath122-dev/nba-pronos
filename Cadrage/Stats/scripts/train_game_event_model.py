"""
Modèles "événements de match" (étape 5 du plan de reprise post-audit,
25/08/2026, GAPS_OUVERTS.md) -- fautes techniques, temps morts, retour en
zone (violation de backcourt). Cibles construites dans build_targets.py
depuis le play-by-play local (jamais synchronisées vers Supabase, même
principe que went_to_ot/quarters_won_count : signal de PRODUCTION vient du
backfill/refresh_daily.py Supabase, ce script ne sert qu'à l'entraînement).

5 modèles, réutilisant TEL QUEL les fonctions génériques déjà écrites pour
le chantier période (train_period_model.py) et le chantier dd/td
(train_doubledouble_model.py) -- aucune nouvelle fonction d'entraînement,
juste de nouveaux appels :

  - tech.joblib                    : classification binaire JOUEUR (au moins
                                      1 faute technique sur le match) --
                                      train_doubledouble_model.py::run(),
                                      mêmes features que dd/td.
  - had_backcourt_turnover.joblib  : classification binaire MATCH (au moins
                                      1 retour en zone, les 2 équipes
                                      confondues) -- même patron que
                                      overtime.joblib.
  - total_timeouts.joblib          : régression MATCH (temps morts combinés)
                                      -- même patron que total_points.joblib.
  - team_technical_fouls.joblib    : classification MULTI-CLASSE (0/1/2/3+),
                                      fautes techniques de CETTE équipe --
                                      même patron que period_quarters_won_count
                                      (own/opp, pas domicile/extérieur).
  - match_technical_fouls.joblib   : classification MULTI-CLASSE (0/1/2/3/4+),
                                      fautes techniques combinées du match.

Buckets (3+ / 4+) : la queue de distribution est rare (cf. GAPS_OUVERTS.md,
own_technical_fouls a very few exemples au-delà de 3) -- lumped plutôt que
des classes quasi vides, même risque de sur-ajustement déjà évité ailleurs
dans ce projet en gardant les classes raisonnablement peuplées.

Usage:
    python train_game_event_model.py
"""

import sqlite3
from pathlib import Path

import pandas as pd

from train_home_win_model import BASE_FEATURE_COLS, FEATURE_COLS
from train_period_model import train_regressor, train_binary_classifier, train_multiclass_classifier
from train_doubledouble_model import run as run_player_classifier

SCRIPT_DIR = Path(__file__).resolve().parent
DB_PATH = SCRIPT_DIR.parent / "data" / "nba.db"

TEAM_TECH_CLASSES = [0, 1, 2, 3]
MATCH_TECH_CLASSES = [0, 1, 2, 3, 4]


def _bucket(series: pd.Series, cap: int) -> pd.Series:
    return series.clip(upper=cap).astype(int)


def main():
    conn = sqlite3.connect(DB_PATH)
    game_dates = pd.read_sql("SELECT game_id, game_date FROM entrainement_matchs", conn, dtype={"game_id": str})

    # ---- 1. tech (classification binaire JOUEUR) -- reutilise TEL QUEL le
    # squelette dd/td (memes features, meme script). ----
    run_player_classifier("tech", "Faute technique joueur")

    # ---- 2/3/5. had_backcourt_turnover (classif binaire MATCH) +
    # total_timeouts (regression MATCH) + match_technical_fouls (multi-classe
    # MATCH) -- meme feature set home_/away_ que overtime/total_points. ----
    matchs = pd.read_sql(
        f"SELECT game_id, had_backcourt_turnover, total_timeouts, total_technical_fouls, {', '.join(FEATURE_COLS)} "
        "FROM entrainement_matchs",
        conn, dtype={"game_id": str},
    )
    matchs = matchs.merge(game_dates, on="game_id", how="left")

    train_binary_classifier("had_backcourt_turnover", matchs, FEATURE_COLS, "had_backcourt_turnover")
    train_regressor("total_timeouts", matchs, FEATURE_COLS, "total_timeouts", [3, 5, 7, 9, 11])

    matchs["match_technical_fouls_bucket"] = _bucket(matchs["total_technical_fouls"], cap=MATCH_TECH_CLASSES[-1])
    train_multiclass_classifier(
        "match_technical_fouls", matchs, FEATURE_COLS, "match_technical_fouls_bucket", MATCH_TECH_CLASSES,
    )

    # ---- 4. team_technical_fouls (multi-classe EQUIPE, own/opp) -- meme
    # feature set own_/opp_ que period_quarters_won_count. ----
    own_feature_cols = [f"own_{c}" for c in BASE_FEATURE_COLS] + [f"opp_{c}" for c in BASE_FEATURE_COLS]
    equipe = pd.read_sql(
        f"SELECT game_id, own_technical_fouls, {', '.join(f'own_{c}' for c in BASE_FEATURE_COLS)}, "
        f"{', '.join(f'opp_{c}' for c in BASE_FEATURE_COLS)} FROM entrainement_equipe",
        conn, dtype={"game_id": str},
    )
    equipe = equipe.merge(game_dates, on="game_id", how="left")
    equipe["team_technical_fouls_bucket"] = _bucket(equipe["own_technical_fouls"], cap=TEAM_TECH_CLASSES[-1])
    train_multiclass_classifier(
        "team_technical_fouls", equipe, own_feature_cols, "team_technical_fouls_bucket", TEAM_TECH_CLASSES,
    )

    conn.close()


if __name__ == "__main__":
    main()
