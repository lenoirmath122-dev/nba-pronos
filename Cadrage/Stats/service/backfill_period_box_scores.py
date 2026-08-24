"""
Backfill historique de stats_box_scores_by_period (chantier "paris
joueur+période", GAPS_OUVERTS.md, 24/08/2026) -- contrairement à
backfill_supabase.py (migration ponctuelle depuis nba.db local, AUCUN
nouvel appel API), celui-ci refait un VRAI appel API par match/quart-temps :
l'API NBA n'a pas d'équivalent "box-score par période" côté données locales
déjà téléchargées (play_by_play local ne stocke pas contres/interceptions/
passes décisives en lignes structurées -- embarqués en texte libre dans
`description`, jamais fiable à parser, découvert en essayant de construire
les cibles d'entraînement locales). Vérifié empiriquement le 24/08/2026 :
`BoxScoreTraditionalV3(game_id=..., range_type="1", start_period=end_period=N)`
renvoie les vraies stats officielles restreintes à cette période.

4 appels par match (1 par quart-temps, les mi-temps se calculent en sommant
2 quarts-temps à la résolution) -- pour ~2500 matchs déjà connus côté
Supabase (stats_matchs), ça fait ~10 000 requêtes. Avec le même rythme que
refresh_daily.py/fetch_nba_data.py (délai 0.6-1.2s entre requêtes + retries),
compter de l'ordre de 2-3h -- prévu pour tourner en tâche de fond, resumable
(saute les game_id déjà présents dans stats_box_scores_by_period, donc
rejouable sans tout refaire si interrompu).

Lit SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY depuis le .env.local du dépôt
(même convention que backfill_supabase.py -- jamais collé dans le chat/code).

Usage:
    python backfill_period_box_scores.py
    python backfill_period_box_scores.py --limit 50   # test sur un sous-ensemble
"""

import argparse
import re
import sys
from pathlib import Path

import pandas as pd
from supabase import create_client

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

from load_to_sqlite import TRADITIONAL_COLUMNS  # noqa: E402
from refresh_daily import (  # noqa: E402
    STATS_BOX_SCORE_PERIOD_COLUMNS,
    fetch_all_rows,
    fetch_period_box_scores,
    upsert_records,
)
from tester_modele import minutes_to_float  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[3]
ENV_PATH = REPO_ROOT / ".env.local"


def load_env(path: Path) -> dict:
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z_][A-Z0-9_]*)=(.*)$", line.strip())
        if m:
            values[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return values


def get_client():
    env = load_env(ENV_PATH)
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit(f"NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY introuvables dans {ENV_PATH}.")
    return create_client(url, key)


def known_period_game_ids(client) -> set:
    """game_id déjà présents dans stats_box_scores_by_period -- backfill
    resumable, on ne refait jamais un match déjà traité."""
    rows = fetch_all_rows(lambda start, end: client.table("stats_box_scores_by_period").select("game_id").range(start, end))
    return {r["game_id"] for r in rows}


def all_game_ids(client) -> list:
    rows = fetch_all_rows(lambda start, end: client.table("stats_matchs").select("game_id").range(start, end))
    return sorted({r["game_id"] for r in rows})


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--limit", type=int, default=None, help="limite le nombre de matchs traités cette exécution (test)")
    args = parser.parse_args()

    client = get_client()

    print("Récupération de la liste des matchs déjà connus (stats_matchs)...")
    game_ids = all_game_ids(client)
    print(f"{len(game_ids)} matchs au total.")

    print("Récupération des matchs déjà backfillés (stats_box_scores_by_period)...")
    already_done = known_period_game_ids(client)
    print(f"{len(already_done)} déjà présents -- ignorés.")

    todo = [g for g in game_ids if g not in already_done]
    if args.limit:
        todo = todo[: args.limit]
    print(f"{len(todo)} matchs à traiter cette exécution.\n")

    if not todo:
        print("Rien à faire -- terminé.")
        return

    total_rows = 0
    for i, game_id in enumerate(todo, start=1):
        period_dfs = fetch_period_box_scores(game_id)
        rows = []
        for period, pdf in period_dfs.items():
            if pdf is None:
                continue
            pdf = pdf.drop_duplicates(subset=["personId"])
            pdf_played = pdf[pdf["minutes"].notna() & (pdf["minutes"] != "")].rename(columns=TRADITIONAL_COLUMNS)
            for _, row in pdf_played.iterrows():
                rows.append({
                    **{col: row[col] for col in STATS_BOX_SCORE_PERIOD_COLUMNS},
                    "period": period,
                    "minutes": minutes_to_float(row["minutes"]),
                })

        if rows:
            upsert_records(client, "stats_box_scores_by_period", pd.DataFrame(rows), "game_id,player_id,period")
            total_rows += len(rows)

        if i % 25 == 0 or i == len(todo):
            print(f"  [{i}/{len(todo)}] traité jusqu'à {game_id} -- {total_rows} lignes au total")

    print(f"\nTerminé : {len(todo)} matchs traités, {total_rows} lignes stats_box_scores_by_period ajoutées.")


if __name__ == "__main__":
    main()
