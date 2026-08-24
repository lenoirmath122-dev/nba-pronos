"""
Backfill de stats_box_scores.position (chantier "5 majeur / banc",
GAPS_OUVERTS.md, 24/08/2026) -- contrairement aux backfills période
(backfill_period_box_scores.py), AUCUN appel API ici : la donnée existe
déjà en LOCAL (Cadrage/Stats/data/raw/<saison>/boxscores/*.csv, une ligne
brute BoxScoreTraditionalV3 par joueur/match), jamais capturée jusqu'ici
(colonne "position" absente de STATS_BOX_SCORE_TRAD_COLUMNS avant ce
chantier -- "F"/"C"/"G" = titulaire, "" = remplaçant).

Vérifié le 24/08/2026 : correspondance EXACTE entre les fichiers locaux
(6602 CSV toutes saisons confondues) et les 6602 matchs déjà synchronisés
côté Supabase (stats_matchs) -- y compris les matchs les plus récents
(2025-26). Backfill donc quasi instantané (lecture locale + upsert),
contrairement au ~9-13h du backfill période.

Utilise bulk_update_box_score_position() (migration 20260824190000), PAS
upsert_records() -- testé en réel : un upsert à payload partiel (juste
game_id/player_id/position) échoue sur cette table, Postgres valide les
contraintes NOT NULL (game_date...) de la clause INSERT AVANT de tenter le
conflit, même quand la ligne existe déjà et qu'on veut juste UPDATE une
seule colonne.

Usage:
    python backfill_starter_position.py
"""

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from refresh_daily import get_supabase_client  # noqa: E402

RAW_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"
CHUNK = 2000


def main():
    client = get_supabase_client()

    rows = []
    seasons = sorted(d for d in RAW_DIR.iterdir() if d.is_dir())
    for season_dir in seasons:
        box_dir = season_dir / "boxscores"
        if not box_dir.exists():
            continue
        files = sorted(box_dir.glob("*.csv"))
        print(f"{season_dir.name} : {len(files)} matchs")
        for box_path in files:
            df = pd.read_csv(box_path, dtype={"gameId": str})
            # même filtre DNP que load_to_sqlite.py/refresh_daily.py -- une
            # ligne sans minutes jouées n'est pas une vraie apparition.
            df = df[df["minutes"].notna() & (df["minutes"] != "")]
            for _, row in df.iterrows():
                rows.append({
                    "game_id": row["gameId"],
                    "player_id": int(row["personId"]),
                    "position": row["position"] if pd.notna(row["position"]) else "",
                })

    total = len(rows)
    print(f"\n{total} lignes (game_id, player_id, position) à mettre à jour.\n")

    for i in range(0, total, CHUNK):
        client.rpc("bulk_update_box_score_position", {"rows": rows[i:i + CHUNK]}).execute()
        print(f"  [{min(i + CHUNK, total)}/{total}]")

    print("\nTerminé.")


if __name__ == "__main__":
    main()
