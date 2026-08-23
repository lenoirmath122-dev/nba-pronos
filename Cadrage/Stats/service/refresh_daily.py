"""
Rafraîchissement quotidien des tables Supabase (stats_equipes/stats_joueurs/
stats_matchs/stats_box_scores) -- Phase 4, architecture "sans état"
(projet-data-nba.md §23-25). Remplace le stub `/refresh` du service : écrit
DIRECTEMENT dans Supabase, sans jamais appeler le service déployé.

Conçu pour tourner sur un runner GitHub Actions éphémère (aucun état local
entre 2 exécutions) : à chaque lancement, il redemande à Supabase quels
matchs de la saison en cours sont déjà connus (table stats_matchs, légère),
compare à la liste réelle des matchs de la saison (nba_api leaguegamefinder),
et ne va chercher via l'API que les matchs manquants -- fetch incrémental,
pas un rebuild complet comme fetch_nba_data.py/load_to_sqlite.py (ceux-là
restent le pipeline d'ENTRAÎNEMENT, en local, inchangés).

Simplification par rapport au pipeline local : l'équipe domicile/extérieure
et l'adversaire de chaque joueur sont déduits directement des 2 lignes
`leaguegamefinder` d'un match (champ MATCHUP, "@" = extérieur) -- pas besoin
du play-by-play (jamais stocké dans Supabase, cf. §23) juste pour ça.

Usage (variables d'environnement SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY déjà
définies, comme pour le service lui-même) :
    python refresh_daily.py
    python refresh_daily.py --season 2026-27 --season-types "Regular Season" Playoffs PlayIn
"""

import argparse
import datetime as dt
import os
import sys
from collections import Counter
from pathlib import Path

import pandas as pd
from nba_api.stats.endpoints import boxscoreadvancedv3, boxscoretraditionalv3, leaguegamefinder
from supabase import create_client

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

from backfill_supabase import to_json_safe  # noqa: E402
from fetch_nba_data import (  # noqa: E402
    MAX_RETRIES,
    REQUEST_TIMEOUT,
    fetch_with_retries,
    sleep_between_requests,
)
from load_to_sqlite import ADVANCED_COLUMNS, TRADITIONAL_COLUMNS  # noqa: E402

DEFAULT_SEASON_TYPES = ["Regular Season", "Playoffs", "PlayIn"]
DELAY_MIN, DELAY_MAX = 0.6, 1.2

# Timeout/tentatives réduits SPÉCIFIQUEMENT pour leaguegamefinder (juste "y
# a-t-il des matchs cette saison ?"), pas pour fetch_box_scores (un vrai
# match existant, où on veut rester robuste avec REQUEST_TIMEOUT/MAX_RETRIES
# complets). Trouvé en conditions réelles le 21/08/2026 : hors-saison,
# stats.nba.com n'expire même pas vite sur une saison sans aucun match --
# 3 season_types x 3 tentatives x 60s = ~9-10 min perdues chaque jour pour
# rien tant que la saison n'a pas commencé (mi-octobre). Sans risque de
# manquer un vrai match une fois la saison lancée : un jour normal a des
# matchs à trouver, la requête répond alors en quelques secondes.
SEASON_INDEX_TIMEOUT = 15
SEASON_INDEX_RETRIES = 1

# Colonnes réellement présentes dans stats_box_scores (migration #31, étendue
# par 20260823090000 pour team_id/off_rating/def_rating/net_rating/pace) --
# PAS BOX_SCORE_TABLE_COLUMNS de load_to_sqlite.py, plus large (oreb/dreb/tov/
# pf/fg_pct/fg3_pct/ft_pct inclus, absents ici -- table Supabase
# volontairement allégée aux seules colonnes lues par build_context()).
STATS_BOX_SCORE_TRAD_COLUMNS = [
    "game_id", "player_id", "team_id", "minutes", "pts", "reb", "ast", "fg3m", "stl", "blk",
    "plus_minus", "ftm", "fta", "fgm", "fga", "fg3a",
]

PAGE_SIZE = 1000  # limite par defaut de PostgREST -- toute lecture "table
# entiere" doit paginer avec .range(), sinon une reponse tronquee a 1000
# lignes fait passer des lignes deja connues pour "nouvelles" (bug reel
# trouve en testant le 21/08/2026, cf. JOURNAL_SESSIONS.md).


def fetch_all_rows(query_builder) -> list:
    """Récupère TOUTES les lignes d'une requête Supabase en paginant avec
    .range() -- query_builder est une fonction (start, end) -> réponse
    PostgREST, pour pouvoir composer .select()/.eq() avant de paginer."""
    rows: list = []
    start = 0
    while True:
        page = query_builder(start, start + PAGE_SIZE - 1).execute().data
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            return rows
        start += PAGE_SIZE


def current_season_label(today: dt.date) -> str:
    """"2021-22" style -- une saison NBA commence en octobre. À partir d'août
    (intersaison/presaison), on considère que la saison "en cours" est celle
    qui démarre l'octobre suivant."""
    if today.month >= 8:
        return f"{today.year}-{str(today.year + 1)[2:]}"
    return f"{today.year - 1}-{str(today.year)[2:]}"


def get_supabase_client():
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies.")
    return create_client(url, key)


def known_game_ids(client, season: str) -> set:
    rows = fetch_all_rows(
        lambda start, end: client.table("stats_matchs").select("game_id").eq("season", season).range(start, end)
    )
    return {r["game_id"] for r in rows}


def season_player_game_counts(client, season: str) -> Counter:
    """Nombre de matchs déjà joués cette saison, par joueur -- sert de point
    de départ à games_played_season_avant pour les nouveaux matchs traités
    (incrémenté au fur et à mesure ci-dessous, dans l'ordre chronologique)."""
    rows = fetch_all_rows(
        lambda start, end: client.table("stats_box_scores").select("player_id").eq("season", season).range(start, end)
    )
    return Counter(r["player_id"] for r in rows)


def fetch_season_games(season: str, season_types: list) -> dict:
    """game_id -> {game_date, season, season_type, teams: {team_id: matchup}}
    -- une entrée dans `teams` par équipe présente dans ce match (2
    normalement). Construit à partir de leaguegamefinder SEUL, sans
    play-by-play (le champ MATCHUP suffit à déduire domicile/extérieur)."""
    games: dict = {}
    for season_type in season_types:
        def call(_season_type=season_type):
            return leaguegamefinder.LeagueGameFinder(
                season_nullable=season, season_type_nullable=_season_type,
                league_id_nullable="00", timeout=SEASON_INDEX_TIMEOUT,
            ).get_data_frames()[0]

        df = fetch_with_retries(call, f"leaguegamefinder {season} {season_type}", SEASON_INDEX_RETRIES)
        sleep_between_requests(DELAY_MIN, DELAY_MAX)
        if df is None or df.empty:
            continue
        for _, row in df.iterrows():
            gid = row["GAME_ID"]
            g = games.setdefault(gid, {
                "game_date": row["GAME_DATE"], "season": season,
                "season_type": season_type, "teams": {},
            })
            g["teams"][int(row["TEAM_ID"])] = row["MATCHUP"]
    return games


def home_away_opponent(teams: dict) -> tuple:
    """(home_team_id, away_team_id, {team_id: opponent_team_id}) à partir du
    dict {team_id: matchup_str} d'un match -- "@" dans MATCHUP = extérieur."""
    team_ids = list(teams.keys())
    if len(team_ids) != 2:
        return None, None, {}
    a, b = team_ids
    if "@" in teams[a]:
        away_id, home_id = a, b
    else:
        home_id, away_id = a, b
    return home_id, away_id, {a: b, b: a}


def fetch_box_scores(game_id: str) -> tuple:
    """(df_traditionnel_brut, df_avance_brut) -- colonnes API d'origine, pas
    encore renommées/filtrées (même convention que load_to_sqlite.py)."""
    def call_trad():
        return boxscoretraditionalv3.BoxScoreTraditionalV3(game_id=game_id, timeout=REQUEST_TIMEOUT).get_data_frames()[0]

    def call_adv():
        return boxscoreadvancedv3.BoxScoreAdvancedV3(game_id=game_id, timeout=REQUEST_TIMEOUT).get_data_frames()[0]

    trad = fetch_with_retries(call_trad, f"boxscore traditional {game_id}", MAX_RETRIES)
    sleep_between_requests(DELAY_MIN, DELAY_MAX)
    adv = fetch_with_retries(call_adv, f"boxscore advanced {game_id}", MAX_RETRIES)
    sleep_between_requests(DELAY_MIN, DELAY_MAX)
    return trad, adv


def upsert_records(client, table: str, df: pd.DataFrame, on_conflict: str):
    """Par lots de PAGE_SIZE, même précaution que backfill_supabase.py -- un
    jour de rattrapage après une panne pourrait accumuler bien plus qu'un
    jour normal de nouveaux matchs."""
    if df.empty:
        return
    records = [{col: to_json_safe(val) for col, val in row.items()} for row in df.to_dict(orient="records")]
    for i in range(0, len(records), PAGE_SIZE):
        client.table(table).upsert(records[i:i + PAGE_SIZE], on_conflict=on_conflict).execute()


def run(season: str, season_types: list):
    client = get_supabase_client()

    print(f"Saison ciblée : {season} ({', '.join(season_types)})")
    known = known_game_ids(client, season)
    print(f"Matchs déjà connus en base pour cette saison : {len(known)}")

    season_games = fetch_season_games(season, season_types)
    new_game_ids = sorted(
        (gid for gid in season_games if gid not in known),
        key=lambda gid: season_games[gid]["game_date"],
    )
    print(f"Matchs trouvés côté NBA pour cette saison : {len(season_games)} -- nouveaux : {len(new_game_ids)}")

    if not new_game_ids:
        print("Rien de nouveau -- terminé.")
        return

    player_game_count = season_player_game_counts(client, season)

    equipes_rows, joueurs_rows, matchs_rows = [], [], []
    box_rows, box_adv_rows = [], []

    for i, game_id in enumerate(new_game_ids, start=1):
        meta = season_games[game_id]
        home_id, away_id, opponent_of = home_away_opponent(meta["teams"])
        if home_id is None:
            print(f"  [{i}/{len(new_game_ids)}] {game_id} : équipes ambiguës (!= 2), match ignoré cette fois.")
            continue

        trad_df, adv_df = fetch_box_scores(game_id)
        if trad_df is None or adv_df is None:
            print(f"  [{i}/{len(new_game_ids)}] {game_id} : échec de récupération, réessayé au prochain lancement.")
            continue
        # dédoublonnage par joueur -- même précaution que load_to_sqlite.py
        # sur ces mêmes réponses API.
        trad_df = trad_df.drop_duplicates(subset=["personId"])
        adv_df = adv_df.drop_duplicates(subset=["personId"])

        for _, row in trad_df.drop_duplicates("teamId").iterrows():
            equipes_rows.append({
                "team_id": int(row["teamId"]), "tricode": row["teamTricode"],
                "city": row["teamCity"], "name": row["teamName"],
            })
        for _, row in trad_df.drop_duplicates("personId").iterrows():
            if not row["personId"]:
                continue
            joueurs_rows.append({
                "player_id": int(row["personId"]), "first_name": row["firstName"], "family_name": row["familyName"],
            })

        matchs_rows.append({
            "game_id": game_id, "game_date": meta["game_date"], "season": season,
            "season_type": meta["season_type"], "home_team_id": home_id, "away_team_id": away_id,
        })

        # même filtre DNP/DND que load_to_sqlite.py -- une ligne sans minutes
        # jouées n'est pas une vraie apparition. Attention : contrairement à
        # load_to_sqlite.py (qui relit un CSV -- une case vide y redevient un
        # vrai NaN), la réponse nba_api EN DIRECT garde "" (chaîne vide) pour
        # un DNP -- notna() seul ne l'attrape pas (bug réel trouvé en
        # testant le 21/08/2026, 18 lignes DNP passées avec pts=0).
        trad_played = trad_df[trad_df["minutes"].notna() & (trad_df["minutes"] != "")].rename(columns=TRADITIONAL_COLUMNS)
        adv_played = adv_df[adv_df["minutes"].notna() & (adv_df["minutes"] != "")].rename(columns=ADVANCED_COLUMNS)

        for _, row in trad_played.iterrows():
            pid = int(row["player_id"])
            box_rows.append({
                **{col: row[col] for col in STATS_BOX_SCORE_TRAD_COLUMNS},
                "opponent_team_id": opponent_of.get(int(row["team_id"])),
                "game_date": meta["game_date"], "season": season,
                "games_played_season_avant": player_game_count[pid],
            })
        for _, row in adv_played.iterrows():
            box_adv_rows.append({
                col: row[col]
                for col in ("game_id", "player_id", "ts_pct", "usg_pct", "off_rating", "def_rating", "net_rating", "pace")
            })

        for pid in trad_played["player_id"].astype(int):
            player_game_count[pid] += 1

        if i % 10 == 0 or i == len(new_game_ids):
            print(f"  [{i}/{len(new_game_ids)}] traité jusqu'à {game_id}")

    # Ordre important pour la robustesse (bug réel trouvé en testant le
    # 21/08/2026) : stats_box_scores AVANT stats_matchs. known_game_ids()
    # ne regarde QUE stats_matchs -- si le script est interrompu (panne
    # réseau, quota API) entre les deux, on veut qu'un match reste détecté
    # comme "pas encore connu" tant que ses stats ne sont pas confirmées
    # écrites, pas l'inverse (sinon il resterait incomplet pour toujours,
    # silencieusement, le prochain lancement le croyant déjà traité).
    if equipes_rows:
        upsert_records(client, "stats_equipes", pd.DataFrame(equipes_rows).drop_duplicates("team_id"), "team_id")
    if joueurs_rows:
        upsert_records(client, "stats_joueurs", pd.DataFrame(joueurs_rows).drop_duplicates("player_id"), "player_id")

    if box_rows:
        box_df = pd.DataFrame(box_rows)
        adv_df = pd.DataFrame(box_adv_rows)
        merged = box_df.merge(adv_df, on=["game_id", "player_id"], how="left")
        upsert_records(client, "stats_box_scores", merged, "game_id,player_id")
        nb_box_rows = len(merged)
    else:
        nb_box_rows = 0

    if matchs_rows:
        upsert_records(client, "stats_matchs", pd.DataFrame(matchs_rows), "game_id")

    print(f"\nTerminé : {len(matchs_rows)} matchs, {nb_box_rows} lignes box_scores ajoutés.")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--season", default=None, help='ex: 2026-27 (défaut : saison déduite de la date du jour)')
    parser.add_argument("--season-types", nargs="+", default=DEFAULT_SEASON_TYPES)
    args = parser.parse_args()
    season = args.season or current_season_label(dt.date.today())
    run(season, args.season_types)


if __name__ == "__main__":
    main()
