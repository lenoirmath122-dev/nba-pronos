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
import re
import sys
from collections import Counter
from pathlib import Path

import pandas as pd
from nba_api.stats.endpoints import boxscoreadvancedv3, boxscoretraditionalv3, leaguegamefinder, playbyplayv3
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
from tester_modele import minutes_to_float  # noqa: E402

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
# par 20260823090000 pour team_id/off_rating/def_rating/net_rating/pace, puis
# par 20260823210000 pour oreb) -- PAS BOX_SCORE_TABLE_COLUMNS de
# load_to_sqlite.py, plus large (dreb/tov/pf/fg_pct/fg3_pct/ft_pct inclus,
# absents ici -- table Supabase volontairement allégée aux seules colonnes
# lues par build_context()/build_team_context()).
STATS_BOX_SCORE_TRAD_COLUMNS = [
    "game_id", "player_id", "team_id", "minutes", "pts", "reb", "ast", "fg3m", "stl", "blk",
    "plus_minus", "ftm", "fta", "fgm", "fga", "fg3a", "oreb",
    # "position" (24/08/2026, chantier "5 majeur/banc") -- déjà renvoyée
    # telle quelle par BoxScoreTraditionalV3 sous ce nom exact ("F"/"C"/"G"
    # = titulaire, "" = remplaçant), pas de renommage nécessaire.
    "position",
]

# Chantier "paris joueur+periode" (GAPS_OUVERTS.md, 24/08/2026) -- colonnes
# de stats_box_scores_by_period (migration 20260824150000), sous-ensemble de
# STATS_BOX_SCORE_TRAD_COLUMNS (pas de team_id/plus_minus, pas necessaires a
# la resolution/prediction par periode).
STATS_BOX_SCORE_PERIOD_COLUMNS = ["game_id", "player_id", "pts", "reb", "ast", "fg3m", "stl", "blk", "ftm", "fta", "fgm", "fga", "fg3a", "oreb"]

# Chantier "evenements de match" (etape 5 du plan de reprise post-audit,
# 25/08/2026, GAPS_OUVERTS.md) -- toutes les variantes de faute technique
# rencontrees dans le play-by-play (Foul.subType), MEME liste EXACTE que
# backfill_game_events.py/build_targets.py (dupliquee ici, aucun module
# partage entre les scripts locaux et le service deploye).
TECHNICAL_SUBTYPES = (
    "Technical", "Double Technical", "Delay Technical", "Hanging Technical", "Too Many Players Technical",
)

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


def fetch_period_box_scores(game_id: str) -> dict:
    """{1: df, 2: df, 3: df, 4: df} -- box-score TRADITIONNEL restreint a
    CHAQUE quart-temps (range_type="1" + start_period=end_period=N), verifie
    empiriquement le 24/08/2026 (chiffres differents et coherents par quart-
    temps sur un match reel) avant de coder ce chantier -- l'API NBA donne
    directement les stats officielles par periode, pas besoin de parser
    play_by_play (jamais fiable pour blk/stl/ast, embarques en texte libre
    dans description, pas en lignes structurees -- decouvert en essayant de
    construire les cibles d'ENTRAINEMENT locales, cf. GAPS_OUVERTS.md). 4
    appels supplementaires par match (1 par quart-temps) -- les mi-temps se
    calculent en sommant 2 quarts-temps a la resolution, pas besoin de 2
    appels de plus."""
    out = {}
    for period in (1, 2, 3, 4):
        def call(_period=period):
            return boxscoretraditionalv3.BoxScoreTraditionalV3(
                game_id=game_id, range_type="1", start_period=str(_period), end_period=str(_period), timeout=REQUEST_TIMEOUT
            ).get_data_frames()[0]

        df = fetch_with_retries(call, f"boxscore period {period} {game_id}", MAX_RETRIES)
        sleep_between_requests(DELAY_MIN, DELAY_MAX)
        out[period] = df
    return out


def fetch_play_by_play(game_id: str) -> pd.DataFrame | None:
    """Chantier "evenements de match" (etape 5 du plan de reprise post-audit,
    25/08/2026, GAPS_OUVERTS.md) -- fautes techniques/temps morts/retours en
    zone, jamais recuperes jusqu'ici. Verifie empiriquement le 25/08/2026 :
    un vrai appel PlayByPlayV3 renvoie EXACTEMENT le meme schema
    (actionType/subType/personId/teamId/description) que le play-by-play CSV
    deja utilise pour le backfill historique (data/raw/*/playbyplay/*.csv,
    backfill_game_events.py) -- meme logique d'agregation reutilisable des 2
    cotes."""
    def call():
        return playbyplayv3.PlayByPlayV3(game_id=game_id, timeout=REQUEST_TIMEOUT).get_data_frames()[0]

    df = fetch_with_retries(call, f"play-by-play {game_id}", MAX_RETRIES)
    sleep_between_requests(DELAY_MIN, DELAY_MAX)
    return df


def technical_fouls_and_backcourt_by_player(pbp_df: pd.DataFrame) -> dict:
    """{player_id: {"technical_fouls": n, "backcourt_turnovers": n}} -- teamId
    != "0" exclut les fautes techniques D'ENTRAINEUR (personId n'est alors
    pas un joueur, ex. Gregg Popovich -- decouvert en explorant les donnees
    avant de coder ce chantier, meme filtre que backfill_game_events.py)."""
    events: dict[int, dict[str, int]] = {}
    fouls = pbp_df[
        (pbp_df["actionType"] == "Foul") & pbp_df["subType"].isin(TECHNICAL_SUBTYPES) & (pbp_df["teamId"].astype(str) != "0")
    ]
    for pid in fouls["personId"].dropna().astype(int):
        events.setdefault(pid, {"technical_fouls": 0, "backcourt_turnovers": 0})
        events[pid]["technical_fouls"] += 1
    backcourt = pbp_df[(pbp_df["actionType"] == "Turnover") & (pbp_df["subType"] == "Backcourt Turnover")]
    for pid in backcourt["personId"].dropna().astype(int):
        events.setdefault(pid, {"technical_fouls": 0, "backcourt_turnovers": 0})
        events[pid]["backcourt_turnovers"] += 1
    return events


def timeouts_by_team(pbp_df: pd.DataFrame, home_name: str, away_name: str) -> tuple[int, int]:
    """(home_timeouts, away_timeouts) -- un temps mort n'a PAS d'attribution
    joueur/equipe structuree dans le play-by-play (teamId="0" aussi), seule
    l'equipe qui l'a appele est identifiable via son NOM en texte libre dans
    description (ex. "Nets Timeout: Regular") -- meme mecanisme EXACT que
    backfill_game_events.py, verifie 0 texte non resolu sur un echantillon
    de 200 matchs avant de coder ceci."""
    home, away = 0, 0
    home_name, away_name = home_name.upper(), away_name.upper()
    regular = pbp_df[(pbp_df["actionType"] == "Timeout") & (pbp_df["subType"] == "Regular")]
    for desc in regular["description"].fillna(""):
        prefix = desc.split(" Timeout:")[0].strip().upper()
        if prefix == home_name:
            home += 1
        elif prefix == away_name:
            away += 1
    return home, away


# Chantier "evenements granulaires" (etape 6 du plan de reprise post-audit,
# 25/08/2026, GAPS_OUVERTS.md) -- meme play-by-play deja recupere ci-dessus
# (fetch_play_by_play, 1 seul appel PlayByPlayV3 par match, aucun appel
# supplementaire), juste une agregation de plus. Seuil buzzer beater (0.3s)
# calibre empiriquement sur les CSV locaux, MEME valeur EXACTE que
# build_targets.py::_BUZZER_BEATER_THRESHOLD_SECONDS (entrainement).
_BUZZER_BEATER_THRESHOLD_SECONDS = 0.3
_CLOCK_RE = re.compile(r"PT(\d+)M([\d.]+)S")


def _clock_to_seconds(clock) -> float | None:
    m = _CLOCK_RE.match(str(clock))
    if not m:
        return None
    return int(m.group(1)) * 60 + float(m.group(2))


def buzzer_beater_and_last_basket(pbp_df: pd.DataFrame) -> tuple[bool, int | None]:
    """(had_buzzer_beater, last_basket_player_id) -- meme mecanisme EXACT que
    backfill_game_events.py/build_targets.py (etape 6). had_buzzer_beater :
    au moins 1 panier a <=0.3s du buzzer, n'importe quelle periode.
    last_basket_player_id : personId du DERNIER "Made Shot" du match (le
    plus grand actionNumber) -- None si aucun panier trouve (jamais vu en
    pratique mais garde de prudence, meme esprit que le reste du fichier)."""
    made = pbp_df[pbp_df["actionType"] == "Made Shot"]
    if made.empty:
        return False, None
    secs = made["clock"].apply(_clock_to_seconds)
    had_buzzer_beater = bool((secs <= _BUZZER_BEATER_THRESHOLD_SECONDS).any())
    last_row = made.sort_values("actionNumber").iloc[-1]
    last_basket_player_id = int(last_row["personId"]) if pd.notna(last_row["personId"]) else None
    return had_buzzer_beater, last_basket_player_id


def block_events(pbp_df: pd.DataFrame) -> list[dict]:
    """[{"blocker_player_id": ..., "victim_player_id": ...}] -- une ligne de
    Block porte le MEME actionNumber que la ligne "Missed Shot" juste avant
    elle (personId du Block = bloqueur, personId du Missed Shot = tireur
    bloque) -- decouvert en explorant les CSV locaux avant de coder (etape
    6, GAPS_OUVERTS.md). Un Block n'a PAS d'actionType structure (NaN dans
    le play-by-play brut) -- identifie via le texte de description ("X
    BLOCK (N BLK)"), meme piege deja documente pour ce champ."""
    blocks = pbp_df[pbp_df["description"].fillna("").str.contains(r"BLOCK \(\d+ BLK\)", regex=True)]
    missed = pbp_df[pbp_df["actionType"] == "Missed Shot"][["actionNumber", "personId"]].rename(
        columns={"personId": "victim_player_id"}
    )
    merged = blocks[["actionNumber", "personId"]].rename(columns={"personId": "blocker_player_id"}).merge(
        missed, on="actionNumber", how="inner"
    )
    merged = merged.dropna(subset=["blocker_player_id", "victim_player_id"])
    return [
        {"blocker_player_id": int(r["blocker_player_id"]), "victim_player_id": int(r["victim_player_id"])}
        for _, r in merged.iterrows()
    ]


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
    box_rows, box_adv_rows, box_period_rows = [], [], []
    block_rows = []  # chantier "evenements granulaires", etape 6 (GAPS_OUVERTS.md)

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

        team_name_by_id = {}
        for _, row in trad_df.drop_duplicates("teamId").iterrows():
            equipes_rows.append({
                "team_id": int(row["teamId"]), "tricode": row["teamTricode"],
                "city": row["teamCity"], "name": row["teamName"],
            })
            team_name_by_id[int(row["teamId"])] = row["teamName"]
        for _, row in trad_df.drop_duplicates("personId").iterrows():
            if not row["personId"]:
                continue
            joueurs_rows.append({
                "player_id": int(row["personId"]), "first_name": row["firstName"], "family_name": row["familyName"],
            })

        # Chantier "evenements de match" (etape 5, GAPS_OUVERTS.md) -- 1
        # appel supplementaire par match (play-by-play complet). Panne
        # tolerante : home_timeouts/away_timeouts/technical_fouls/
        # backcourt_turnovers restent absents (NULL) pour ce match si
        # l'appel echoue, jamais bloquant pour le reste de la synchro
        # (meme philosophie que fetch_box_scores plus haut -- match
        # reessaye au prochain lancement uniquement si LUI echoue, pas
        # celui-ci).
        pbp_df = fetch_play_by_play(game_id)
        player_events = technical_fouls_and_backcourt_by_player(pbp_df) if pbp_df is not None else {}
        if pbp_df is not None and home_id in team_name_by_id and away_id in team_name_by_id:
            home_timeouts, away_timeouts = timeouts_by_team(pbp_df, team_name_by_id[home_id], team_name_by_id[away_id])
        else:
            home_timeouts, away_timeouts = None, None
        # Chantier "evenements granulaires" (etape 6, GAPS_OUVERTS.md) --
        # meme pbp_df deja recupere ci-dessus, aucun appel supplementaire.
        if pbp_df is not None:
            had_buzzer_beater, last_basket_player_id = buzzer_beater_and_last_basket(pbp_df)
            for event in block_events(pbp_df):
                block_rows.append({"game_id": game_id, **event})
        else:
            had_buzzer_beater, last_basket_player_id = None, None

        matchs_rows.append({
            "game_id": game_id, "game_date": meta["game_date"], "season": season,
            "season_type": meta["season_type"], "home_team_id": home_id, "away_team_id": away_id,
            "home_timeouts": home_timeouts, "away_timeouts": away_timeouts,
            "had_buzzer_beater": had_buzzer_beater, "last_basket_player_id": last_basket_player_id,
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
            events = player_events.get(pid, {"technical_fouls": 0, "backcourt_turnovers": 0})
            box_rows.append({
                **{col: row[col] for col in STATS_BOX_SCORE_TRAD_COLUMNS},
                "opponent_team_id": opponent_of.get(int(row["team_id"])),
                "game_date": meta["game_date"], "season": season,
                "games_played_season_avant": player_game_count[pid],
                "technical_fouls": events["technical_fouls"],
                "backcourt_turnovers": events["backcourt_turnovers"],
            })
        for _, row in adv_played.iterrows():
            box_adv_rows.append({
                col: row[col]
                for col in ("game_id", "player_id", "ts_pct", "usg_pct", "off_rating", "def_rating", "net_rating", "pace")
            })

        for pid in trad_played["player_id"].astype(int):
            player_game_count[pid] += 1

        # Chantier "paris joueur+periode" (24/08/2026, GAPS_OUVERTS.md) -- 4
        # appels supplementaires par match (voir fetch_period_box_scores).
        period_dfs = fetch_period_box_scores(game_id)
        for period, pdf in period_dfs.items():
            if pdf is None:
                continue
            pdf = pdf.drop_duplicates(subset=["personId"])
            pdf_played = pdf[pdf["minutes"].notna() & (pdf["minutes"] != "")].rename(columns=TRADITIONAL_COLUMNS)
            for _, row in pdf_played.iterrows():
                box_period_rows.append({
                    **{col: row[col] for col in STATS_BOX_SCORE_PERIOD_COLUMNS},
                    "period": period,
                    "minutes": minutes_to_float(row["minutes"]),
                })

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

    if box_period_rows:
        upsert_records(client, "stats_box_scores_by_period", pd.DataFrame(box_period_rows), "game_id,player_id,period")

    if matchs_rows:
        upsert_records(client, "stats_matchs", pd.DataFrame(matchs_rows), "game_id")

    # stats_block_events : table d'evenements (pas "1 ligne courante par
    # cle" comme les autres) -- insert simple, jamais d'upsert (un match
    # neuf ne peut jamais entrer en conflit avec une ligne existante).
    if block_rows:
        block_df = pd.DataFrame(block_rows)
        records = [{col: to_json_safe(val) for col, val in row.items()} for row in block_df.to_dict(orient="records")]
        for i in range(0, len(records), PAGE_SIZE):
            client.table("stats_block_events").insert(records[i:i + PAGE_SIZE]).execute()

    print(
        f"\nTerminé : {len(matchs_rows)} matchs, {nb_box_rows} lignes box_scores, {len(box_period_rows)} lignes "
        f"box_scores_by_period, {len(block_rows)} lignes block_events ajoutés."
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--season", default=None, help='ex: 2026-27 (défaut : saison déduite de la date du jour)')
    parser.add_argument("--season-types", nargs="+", default=DEFAULT_SEASON_TYPES)
    args = parser.parse_args()
    season = args.season or current_season_label(dt.date.today())
    run(season, args.season_types)


if __name__ == "__main__":
    main()
