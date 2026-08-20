"""
Récupération des box scores + play-by-play NBA via nba_api.

Cf. Cadrage/Stats/projet-data-nba.md pour le contexte.

Usage:
    python fetch_nba_data.py
    python fetch_nba_data.py --seasons 2024-25 2025-26 --season-types "Regular Season" Playoffs PlayIn
    python fetch_nba_data.py --retry-failed

Le script est résumable : il saute tout game_id déjà présent sur disque, donc
on peut l'interrompre (Ctrl+C, ou éteindre le PC) et le relancer sans perdre
la progression — aucun fichier n'est écrit avant la fin de sa récupération.
"""

import argparse
import csv
import logging
import random
import sys
import time
from datetime import datetime
from pathlib import Path

from nba_api.stats.endpoints import boxscoreadvancedv3, boxscoretraditionalv3, leaguegamefinder, playbyplayv3

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "data" / "raw"
LOG_DIR = SCRIPT_DIR.parent / "data" / "logs"

DEFAULT_SEASONS = ["2024-25", "2025-26"]
DEFAULT_SEASON_TYPES = ["Regular Season", "Playoffs", "PlayIn"]

REQUEST_TIMEOUT = 60
MAX_RETRIES = 3


def setup_logging() -> Path:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_path = LOG_DIR / f"fetch_{datetime.now():%Y%m%d_%H%M%S}.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[logging.FileHandler(log_path, encoding="utf-8"), logging.StreamHandler(sys.stdout)],
    )
    return log_path


def sleep_between_requests(delay_min: float, delay_max: float) -> None:
    time.sleep(random.uniform(delay_min, delay_max))


def fetch_with_retries(fetch_fn, description: str, max_retries: int = MAX_RETRIES):
    for attempt in range(1, max_retries + 1):
        try:
            return fetch_fn()
        except Exception as exc:
            logging.warning("Échec (%s/%s) sur %s: %s", attempt, max_retries, description, exc)
            if attempt < max_retries:
                time.sleep(5 * attempt)
    logging.error("Abandon après %s tentatives: %s", max_retries, description)
    return None


def build_season_index(season: str, season_type: str, delay_min: float, delay_max: float) -> "list[dict]":
    def call():
        return leaguegamefinder.LeagueGameFinder(
            season_nullable=season,
            season_type_nullable=season_type,
            league_id_nullable="00",
            timeout=REQUEST_TIMEOUT,
        ).get_data_frames()[0]

    df = fetch_with_retries(call, f"leaguegamefinder {season} {season_type}")
    sleep_between_requests(delay_min, delay_max)
    if df is None or df.empty:
        return []

    games = {}
    for _, row in df.iterrows():
        gid = row["GAME_ID"]
        games.setdefault(
            gid,
            {"GAME_ID": gid, "GAME_DATE": row["GAME_DATE"], "SEASON": season, "SEASON_TYPE": season_type, "TEAMS": []},
        )
        games[gid]["TEAMS"].append(f"{row['TEAM_ABBREVIATION']} ({row['MATCHUP']})")

    return [
        {
            "GAME_ID": g["GAME_ID"],
            "GAME_DATE": g["GAME_DATE"],
            "SEASON": g["SEASON"],
            "SEASON_TYPE": g["SEASON_TYPE"],
            "MATCHUP": " vs ".join(g["TEAMS"]),
        }
        for g in games.values()
    ]


def write_index(season_dir: Path, rows: "list[dict]") -> None:
    index_path = season_dir / "games_index.csv"
    existing = {}
    if index_path.exists():
        with open(index_path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                existing[row["GAME_ID"]] = row
    for row in rows:
        existing[row["GAME_ID"]] = row

    season_dir.mkdir(parents=True, exist_ok=True)
    with open(index_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["GAME_ID", "GAME_DATE", "SEASON", "SEASON_TYPE", "MATCHUP"])
        writer.writeheader()
        for row in sorted(existing.values(), key=lambda r: (r["GAME_DATE"], r["GAME_ID"])):
            writer.writerow(row)


def fetch_boxscore(game_id: str, out_path: Path) -> bool:
    def call():
        return boxscoretraditionalv3.BoxScoreTraditionalV3(game_id=game_id, timeout=REQUEST_TIMEOUT).get_data_frames()[0]

    df = fetch_with_retries(call, f"boxscore traditional {game_id}")
    if df is None:
        return False
    df.to_csv(out_path, index=False)
    return True


def fetch_boxscore_advanced(game_id: str, out_path: Path) -> bool:
    def call():
        return boxscoreadvancedv3.BoxScoreAdvancedV3(game_id=game_id, timeout=REQUEST_TIMEOUT).get_data_frames()[0]

    df = fetch_with_retries(call, f"boxscore advanced {game_id}")
    if df is None:
        return False
    df.to_csv(out_path, index=False)
    return True


def fetch_playbyplay(game_id: str, out_path: Path) -> bool:
    def call():
        return playbyplayv3.PlayByPlayV3(game_id=game_id, timeout=REQUEST_TIMEOUT).get_data_frames()[0]

    df = fetch_with_retries(call, f"play-by-play {game_id}")
    if df is None:
        return False
    df.to_csv(out_path, index=False)
    return True


def run(seasons, season_types, delay_min, delay_max, retry_failed_only, limit=None):
    log_path = setup_logging()
    logging.info("Log: %s", log_path)

    failed_path = DATA_DIR / "failed_games.csv"
    failed_games = set()
    if failed_path.exists():
        with open(failed_path, newline="", encoding="utf-8") as f:
            failed_games = {row["GAME_ID"] for row in csv.DictReader(f)}

    all_games: list[dict] = []
    for season in seasons:
        season_dir = DATA_DIR / season
        for season_type in season_types:
            logging.info("Index: %s / %s", season, season_type)
            rows = build_season_index(season, season_type, delay_min, delay_max)
            write_index(season_dir, rows)
            all_games.extend([{**r, "SEASON_DIR": season_dir} for r in rows])
            logging.info("  -> %s matchs trouvés", len(rows))

    if retry_failed_only:
        all_games = [g for g in all_games if g["GAME_ID"] in failed_games]
        logging.info("Mode --retry-failed: %s matchs à retenter", len(all_games))

    if limit is not None:
        all_games = all_games[:limit]
        logging.info("Mode --limit: %s matchs seulement", len(all_games))

    total = len(all_games)
    logging.info("Total matchs à traiter: %s", total)

    still_failed = []
    done = 0
    for i, game in enumerate(all_games, start=1):
        game_id = game["GAME_ID"]
        season_dir = game["SEASON_DIR"]
        box_dir = season_dir / "boxscores"
        box_adv_dir = season_dir / "boxscores_advanced"
        pbp_dir = season_dir / "playbyplay"
        box_dir.mkdir(parents=True, exist_ok=True)
        box_adv_dir.mkdir(parents=True, exist_ok=True)
        pbp_dir.mkdir(parents=True, exist_ok=True)

        box_path = box_dir / f"{game_id}.csv"
        box_adv_path = box_adv_dir / f"{game_id}.csv"
        pbp_path = pbp_dir / f"{game_id}.csv"

        if not box_path.exists():
            fetch_boxscore(game_id, box_path)
            sleep_between_requests(delay_min, delay_max)
        if not box_adv_path.exists():
            fetch_boxscore_advanced(game_id, box_adv_path)
            sleep_between_requests(delay_min, delay_max)
        if not pbp_path.exists():
            fetch_playbyplay(game_id, pbp_path)
            sleep_between_requests(delay_min, delay_max)

        if box_path.exists() and box_adv_path.exists() and pbp_path.exists():
            done += 1
            failed_games.discard(game_id)
        else:
            still_failed.append(game_id)
            failed_games.add(game_id)

        if i % 25 == 0 or i == total:
            logging.info("Progression: %s/%s (ok=%s, échecs=%s)", i, total, done, len(still_failed))

    with open(failed_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["GAME_ID"])
        writer.writeheader()
        for gid in sorted(failed_games):
            writer.writerow({"GAME_ID": gid})

    logging.info("Terminé. %s matchs OK, %s en échec (voir %s).", done, len(failed_games), failed_path)


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--seasons", nargs="+", default=DEFAULT_SEASONS, help="ex: 2023-24 2024-25")
    parser.add_argument(
        "--season-types", nargs="+", default=DEFAULT_SEASON_TYPES, help='ex: "Regular Season" Playoffs'
    )
    parser.add_argument("--delay-min", type=float, default=0.6, help="pause min entre requêtes (s)")
    parser.add_argument("--delay-max", type=float, default=1.2, help="pause max entre requêtes (s)")
    parser.add_argument(
        "--retry-failed", action="store_true", help="ne retraiter que les game_id listés dans failed_games.csv"
    )
    parser.add_argument("--limit", type=int, default=None, help="limiter à N matchs (test/pilote)")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run(args.seasons, args.season_types, args.delay_min, args.delay_max, args.retry_failed, args.limit)
