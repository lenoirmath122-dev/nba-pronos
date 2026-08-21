"""
Migration ponctuelle nba.db (local, SQLite) -> Supabase (stats_equipes/
stats_joueurs/stats_box_scores) -- Phase 4, architecture "sans etat" (§22-23
projet-data-nba.md). A lancer UNE FOIS pour peupler Supabase avant le
premier deploiement du service, puis reutilise seulement pour un
re-seed complet si besoin (le rafraichissement quotidien, une fois ecrit,
fait des upserts incrementaux, pas un truncate+reload).

Ne lit JAMAIS play_by_play (jamais utilise par l'inference, §21) -- c'est
tout l'interet du design : ~110 Mo utiles au lieu des 575 Mo de nba.db.

Lit SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY depuis le .env.local du depot
(jamais colle dans le chat/code, meme conventions que le reste du projet)
-- adapte les NOMS de variables EXACTS deja presents dans .env.local
(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).

Usage:
    python backfill_supabase.py
"""

import re
import sqlite3
from pathlib import Path

import numpy as np
import pandas as pd
from supabase import create_client

REPO_ROOT = Path(__file__).resolve().parents[3]
ENV_PATH = REPO_ROOT / ".env.local"
DB_PATH = Path(__file__).resolve().parent.parent / "data" / "nba.db"

BATCH_SIZE = 1000


def load_env(path: Path) -> dict:
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z_][A-Z0-9_]*)=(.*)$", line.strip())
        if m:
            values[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return values


def to_json_safe(value):
    """pandas/numpy -> types nativement serialisables en JSON. Necessaire car
    des colonnes entieres avec des NULL (sqlite) remontent en float64 via
    pandas (numpy n'a pas de NaN entier) -- envoyer 3.0 a une colonne
    Postgres `integer` echoue (22P02), il faut re-caster en int Python.
    pandas 3.0 renvoie des `float`/`int` Python natifs via to_dict() (pas
    des scalaires numpy) -- isinstance(..., np.floating) seul ne suffit
    pas, verifie aussi les types Python natifs."""
    if pd.isna(value):
        return None
    if isinstance(value, (int, float, np.integer, np.floating)) and not isinstance(value, bool):
        return int(value) if float(value).is_integer() else float(value)
    return value


def upsert_batched(client, table: str, df: pd.DataFrame, on_conflict: str):
    records = [
        {col: to_json_safe(val) for col, val in row.items()}
        for row in df.to_dict(orient="records")
    ]
    total = len(records)
    for i in range(0, total, BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        client.table(table).upsert(batch, on_conflict=on_conflict).execute()
        print(f"  {table} : {min(i + BATCH_SIZE, total)}/{total}")


def main():
    env = load_env(ENV_PATH)
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit(
            "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY introuvables dans "
            f"{ENV_PATH} -- verifie que ce fichier existe et contient ces 2 cles."
        )
    client = create_client(url, key)
    conn = sqlite3.connect(DB_PATH)

    print("1/3 -- stats_equipes")
    equipes = pd.read_sql("SELECT team_id, tricode, city, name FROM equipes", conn)
    upsert_batched(client, "stats_equipes", equipes, on_conflict="team_id")

    print("2/3 -- stats_joueurs")
    joueurs = pd.read_sql("SELECT player_id, first_name, family_name FROM joueurs", conn)
    upsert_batched(client, "stats_joueurs", joueurs, on_conflict="player_id")

    print("3/3 -- stats_box_scores (peut prendre quelques minutes, ~140k lignes)")
    box_scores = pd.read_sql(
        """
        SELECT
            b.game_id, b.player_id,
            f.opponent_team_id, m.game_date, m.season,
            b.minutes, b.pts, b.reb, b.ast, b.fg3m, b.stl, b.blk, b.plus_minus,
            b.ftm, b.fta, b.fgm, b.fga, b.fg3a,
            a.ts_pct, a.usg_pct,
            f.games_played_season_avant
        FROM box_scores b
        JOIN matchs m ON m.game_id = b.game_id
        JOIN box_scores_advanced a ON a.game_id = b.game_id AND a.player_id = b.player_id
        JOIN features_joueur f ON f.game_id = b.game_id AND f.player_id = b.player_id
        """,
        conn,
    )
    conn.close()
    upsert_batched(client, "stats_box_scores", box_scores, on_conflict="game_id,player_id")

    print(f"\nTermine : {len(equipes)} equipes, {len(joueurs)} joueurs, {len(box_scores)} lignes box_scores.")


if __name__ == "__main__":
    main()
