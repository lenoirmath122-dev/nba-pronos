"""
Rafraîchissement quotidien des tables Supabase (stats_equipes/stats_joueurs/
stats_matchs/stats_box_scores) -- Phase 4, architecture "sans état"
(projet-data-nba.md §23-25). Remplace le stub `/refresh` du service : écrit
DIRECTEMENT dans Supabase, sans jamais appeler le service déployé.

Conçu pour tourner sans état local entre 2 exécutions (VM d'import, voir
Cadrage/Stats/vm/ ; stats.nba.com bloque les IP de GitHub Actions et de
Cloud Run) : à chaque lancement, il redemande à Supabase quels
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

def minutes_to_float(m) -> float:
    """"MM:SS" (ou "MM") -> minutes décimales. Copie de tester_modele.minutes_to_float
    (8 lignes) : importer tester_modele chargerait joblib/scipy au démarrage, inutile
    ici et lourd sur la petite VM d'import (1 Go de RAM)."""
    if pd.isna(m) or m in ("", "0"):
        return 0.0
    m = str(m)
    if ":" in m:
        mins, secs = m.split(":")
        return float(mins) + float(secs) / 60
    return float(m)


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
# par 20260823090000 pour team_id/off_rating/def_rating/net_rating/pace, par
# 20260823210000 pour oreb, puis par la migration tov du 06/09/2026) -- PAS
# BOX_SCORE_TABLE_COLUMNS de load_to_sqlite.py, plus large (dreb/pf/fg_pct/
# fg3_pct/ft_pct encore absents ici -- table Supabase volontairement
# allégée aux seules colonnes lues par build_context()/build_team_context()).
STATS_BOX_SCORE_TRAD_COLUMNS = [
    "game_id", "player_id", "team_id", "minutes", "pts", "reb", "ast", "fg3m", "stl", "blk",
    "plus_minus", "ftm", "fta", "fgm", "fga", "fg3a", "oreb", "tov",
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


def fetch_season_games(season: str, season_types: list, strict: bool = False) -> tuple:
    """(games, failed_types) -- games : game_id -> {game_date, season,
    season_type, teams: {team_id: matchup}}, une entrée dans `teams` par
    équipe présente dans ce match (2 normalement). Construit à partir de
    leaguegamefinder SEUL, sans play-by-play (le champ MATCHUP suffit à
    déduire domicile/extérieur). failed_types : season_types dont l'appel a
    ÉCHOUÉ (fetch_with_retries renvoie None) -- à distinguer d'un
    DataFrame vide (aucun match, pas une erreur).

    strict (lancement manuel) : timeout/tentatives complets au lieu du
    mode "hors-saison" réduit (SEASON_INDEX_*), pour ne pas abandonner sur
    un simple timeout passager de stats.nba.com."""
    games: dict = {}
    failed_types: list = []
    timeout = REQUEST_TIMEOUT if strict else SEASON_INDEX_TIMEOUT
    retries = MAX_RETRIES if strict else SEASON_INDEX_RETRIES
    for season_type in season_types:
        def call(_season_type=season_type):
            return leaguegamefinder.LeagueGameFinder(
                season_nullable=season, season_type_nullable=_season_type,
                league_id_nullable="00", timeout=timeout,
            ).get_data_frames()[0]

        df = fetch_with_retries(call, f"leaguegamefinder {season} {season_type}", retries)
        sleep_between_requests(DELAY_MIN, DELAY_MAX)
        if df is None:
            failed_types.append(season_type)
            continue
        if df.empty:
            continue
        for _, row in df.iterrows():
            gid = row["GAME_ID"]
            g = games.setdefault(gid, {
                "game_date": row["GAME_DATE"], "season": season,
                "season_type": season_type, "teams": {},
            })
            g["teams"][int(row["TEAM_ID"])] = row["MATCHUP"]
    return games, failed_types


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


def write_sync_log(client, success: bool, summary: str):
    """Trace chaque exécution dans sync_logs (sync_type='STATS_IMPORT',
    migration 20261008090000) -- succès OU échec, pour savoir quand les box
    scores ont réellement été importés (07/10/2026 : timeout stats.nba.com,
    job vert, aucune trace). Best-effort, même principe que
    lib/sync/logging.ts::writeSyncLog : un échec d'écriture ne doit jamais
    faire échouer le rafraîchissement lui-même (et tant que la migration
    n'est pas déployée, l'insert échoue sur l'enum -- sans conséquence)."""
    try:
        client.table("sync_logs").insert({
            "sync_type": "STATS_IMPORT", "endpoint": "nba_api", "success": success, "summary": summary,
        }).execute()
    except Exception as exc:  # noqa: BLE001 -- best-effort volontaire
        print(f"write_sync_log a échoué : {exc}")


BLOCK_DELETE_BATCH = 50  # game_id par requête delete().in_() -- reste sous la limite d'URL de PostgREST


def collect_game(game_id: str, meta: dict, season: str, home_id: int, away_id: int, opponent_of: dict, player_game_count) -> tuple:
    """(rows, manquant) -- construit EN LOCAL toutes les lignes d'un match,
    sans rien écrire en base. rows=None (et `manquant` nomme la pièce) si une
    pièce indispensable manque : box score traditionnel/avancé, play-by-play,
    ou l'un des 4 quarts-temps. Le match n'est alors PAS enregistré, donc
    réessayé au prochain lancement (known_game_ids() ne le voit pas).

    Avant le 07/10/2026, un quart-temps ou un play-by-play en échec laissait
    quand même le match s'enregistrer : il n'était alors jamais réessayé, un
    pari joueur+période se résolvait avec le quart manquant compté à 0, et les
    paris temps morts/buzzer/dernier panier restaient bloqués pour toujours
    ("pas encore synchronisés")."""
    trad_df, adv_df = fetch_box_scores(game_id)
    if trad_df is None or adv_df is None:
        return None, "box score"
    # dédoublonnage par joueur -- même précaution que load_to_sqlite.py
    # sur ces mêmes réponses API.
    trad_df = trad_df.drop_duplicates(subset=["personId"])
    adv_df = adv_df.drop_duplicates(subset=["personId"])

    # Chantier "evenements de match" (etape 5, GAPS_OUVERTS.md) -- 1 appel
    # supplementaire par match (play-by-play complet).
    pbp_df = fetch_play_by_play(game_id)
    if pbp_df is None or pbp_df.empty:
        return None, "play-by-play"

    # Chantier "paris joueur+periode" (24/08/2026, GAPS_OUVERTS.md) -- 4
    # appels supplementaires par match (voir fetch_period_box_scores).
    period_dfs = fetch_period_box_scores(game_id)
    for period in (1, 2, 3, 4):
        pdf = period_dfs.get(period)
        if pdf is None or pdf.empty:
            return None, f"quart-temps {period}"

    rows: dict = {"equipes": [], "joueurs": [], "box": [], "adv": [], "period": [], "blocks": [], "played_pids": []}

    team_name_by_id = {}
    for _, row in trad_df.drop_duplicates("teamId").iterrows():
        rows["equipes"].append({
            "team_id": int(row["teamId"]), "tricode": row["teamTricode"],
            "city": row["teamCity"], "name": row["teamName"],
        })
        team_name_by_id[int(row["teamId"])] = row["teamName"]
    for _, row in trad_df.drop_duplicates("personId").iterrows():
        if not row["personId"]:
            continue
        rows["joueurs"].append({
            "player_id": int(row["personId"]), "first_name": row["firstName"], "family_name": row["familyName"],
        })

    player_events = technical_fouls_and_backcourt_by_player(pbp_df)
    if home_id in team_name_by_id and away_id in team_name_by_id:
        home_timeouts, away_timeouts = timeouts_by_team(pbp_df, team_name_by_id[home_id], team_name_by_id[away_id])
    else:
        home_timeouts, away_timeouts = None, None
    # Chantier "evenements granulaires" (etape 6, GAPS_OUVERTS.md) -- meme
    # pbp_df deja recupere ci-dessus, aucun appel supplementaire.
    had_buzzer_beater, last_basket_player_id = buzzer_beater_and_last_basket(pbp_df)
    for event in block_events(pbp_df):
        rows["blocks"].append({"game_id": game_id, **event})

    rows["match"] = {
        "game_id": game_id, "game_date": meta["game_date"], "season": season,
        "season_type": meta["season_type"], "home_team_id": home_id, "away_team_id": away_id,
        "home_timeouts": home_timeouts, "away_timeouts": away_timeouts,
        "had_buzzer_beater": had_buzzer_beater, "last_basket_player_id": last_basket_player_id,
    }

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
        rows["box"].append({
            **{col: row[col] for col in STATS_BOX_SCORE_TRAD_COLUMNS},
            "opponent_team_id": opponent_of.get(int(row["team_id"])),
            "game_date": meta["game_date"], "season": season,
            "games_played_season_avant": player_game_count[pid],
            "technical_fouls": events["technical_fouls"],
            "backcourt_turnovers": events["backcourt_turnovers"],
        })
    for _, row in adv_played.iterrows():
        rows["adv"].append({
            col: row[col]
            for col in ("game_id", "player_id", "ts_pct", "usg_pct", "off_rating", "def_rating", "net_rating", "pace")
        })
    rows["played_pids"] = [int(pid) for pid in trad_played["player_id"]]

    for period in (1, 2, 3, 4):
        pdf = period_dfs[period].drop_duplicates(subset=["personId"])
        pdf_played = pdf[pdf["minutes"].notna() & (pdf["minutes"] != "")].rename(columns=TRADITIONAL_COLUMNS)
        for _, row in pdf_played.iterrows():
            rows["period"].append({
                **{col: row[col] for col in STATS_BOX_SCORE_PERIOD_COLUMNS},
                "period": period,
                "minutes": minutes_to_float(row["minutes"]),
            })
    return rows, None


def run(season: str, season_types: list, strict: bool = False, trigger: str = "cron"):
    """strict (lancement manuel du workflow) : timeout/tentatives complets pour
    leaguegamefinder, et sortie en code 1 (job rouge, donc /api/resolve-bets
    non lancé) si l'import est incomplet -- au lieu d'un job vert silencieux
    qui résoudrait les paris sans box scores. Le cron (non strict) garde le
    comportement hors-saison rapide et ne fait que tracer l'échec."""
    client = get_supabase_client()
    try:
        ok, summary = _run(client, season, season_types, strict)
    except Exception as exc:
        write_sync_log(client, False, f"[{trigger}] {season} ({', '.join(season_types)}) : exception {exc!r}")
        raise
    write_sync_log(client, ok, f"[{trigger}] {summary}")
    if strict and not ok:
        raise SystemExit(1)


def _run(client, season: str, season_types: list, strict: bool) -> tuple:
    """(ok, résumé) -- ok=False si un appel leaguegamefinder a échoué ou si
    au moins un match a été sauté (box score non récupéré, équipes ambiguës)."""
    head = f"{season} ({', '.join(season_types)})"
    print(f"Saison ciblée : {head}")
    known = known_game_ids(client, season)
    print(f"Matchs déjà connus en base pour cette saison : {len(known)}")

    season_games, failed_types = fetch_season_games(season, season_types, strict)
    new_game_ids = sorted(
        (gid for gid in season_games if gid not in known),
        key=lambda gid: season_games[gid]["game_date"],
    )
    print(f"Matchs trouvés côté NBA pour cette saison : {len(season_games)} -- nouveaux : {len(new_game_ids)}")

    if failed_types:
        print(f"ÉCHEC leaguegamefinder pour : {', '.join(failed_types)}")
    if failed_types and strict:
        # Index partiel/absent : on s'arrête avant tout traitement plutôt que
        # d'importer (puis de résoudre des paris) sur des données incomplètes.
        return False, f"{head} : leaguegamefinder en échec ({', '.join(failed_types)}), import abandonné."

    failed_note = f" Index en échec : {', '.join(failed_types)}." if failed_types else ""

    if not new_game_ids:
        print("Rien de nouveau -- terminé.")
        return not failed_types, f"{head} : {len(season_games)} match(s) NBA trouvé(s), rien de nouveau.{failed_note}"

    skipped_games: list = []
    complete_game_ids: list = []

    player_game_count = season_player_game_counts(client, season)

    equipes_rows, joueurs_rows, matchs_rows = [], [], []
    box_rows, box_adv_rows, box_period_rows = [], [], []
    block_rows = []  # chantier "evenements granulaires", etape 6 (GAPS_OUVERTS.md)

    for i, game_id in enumerate(new_game_ids, start=1):
        meta = season_games[game_id]
        home_id, away_id, opponent_of = home_away_opponent(meta["teams"])
        if home_id is None:
            print(f"  [{i}/{len(new_game_ids)}] {game_id} : équipes ambiguës (!= 2), match ignoré cette fois.")
            skipped_games.append(game_id)
            continue

        rows, missing = collect_game(game_id, meta, season, home_id, away_id, opponent_of, player_game_count)
        if rows is None:
            print(f"  [{i}/{len(new_game_ids)}] {game_id} : {missing} indisponible, match non enregistré, réessayé au prochain lancement.")
            skipped_games.append(game_id)
            continue

        equipes_rows.extend(rows["equipes"])
        joueurs_rows.extend(rows["joueurs"])
        matchs_rows.append(rows["match"])
        box_rows.extend(rows["box"])
        box_adv_rows.extend(rows["adv"])
        box_period_rows.extend(rows["period"])
        block_rows.extend(rows["blocks"])
        # Compteur avancé SEULEMENT pour un match complet (sinon un match
        # sauté puis réimporté plus tard compterait deux fois).
        for pid in rows["played_pids"]:
            player_game_count[pid] += 1
        complete_game_ids.append(game_id)

        if i % 10 == 0 or i == len(new_game_ids):
            print(f"  [{i}/{len(new_game_ids)}] traité jusqu'à {game_id}")

    # Ordre important pour la robustesse : stats_matchs EN DERNIER.
    # known_game_ids() ne regarde QUE stats_matchs -- si le script est
    # interrompu (panne réseau, quota API) avant, le match reste détecté
    # comme "pas encore connu" et sera réessayé en entier, au lieu d'être
    # considéré traité avec des tables filles incomplètes pour toujours
    # (bug réel trouvé en testant le 21/08/2026 ; étendu à stats_block_events
    # le 07/10/2026). Les tables filles sont rejouables sans doublon : upsert
    # pour les 3 premières, delete puis insert pour stats_block_events (table
    # d'événements sans clé unique).
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

    for k in range(0, len(complete_game_ids), BLOCK_DELETE_BATCH):
        client.table("stats_block_events").delete().in_("game_id", complete_game_ids[k:k + BLOCK_DELETE_BATCH]).execute()
    if block_rows:
        block_df = pd.DataFrame(block_rows)
        records = [{col: to_json_safe(val) for col, val in row.items()} for row in block_df.to_dict(orient="records")]
        for k in range(0, len(records), PAGE_SIZE):
            client.table("stats_block_events").insert(records[k:k + PAGE_SIZE]).execute()

    if matchs_rows:
        upsert_records(client, "stats_matchs", pd.DataFrame(matchs_rows), "game_id")

    done = (
        f"{len(matchs_rows)} matchs, {nb_box_rows} lignes box_scores, {len(box_period_rows)} lignes "
        f"box_scores_by_period, {len(block_rows)} lignes block_events ajoutés."
    )
    print(f"\nTerminé : {done}")
    skipped_note = f" {len(skipped_games)} match(s) sauté(s) : {', '.join(skipped_games)}." if skipped_games else ""
    summary = f"{head} : {done}{skipped_note}{failed_note}"
    return not skipped_games and not failed_types, summary


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--season", default=None, help='ex: 2026-27 (défaut : saison déduite de la date du jour)')
    parser.add_argument("--season-types", nargs="+", default=DEFAULT_SEASON_TYPES)
    parser.add_argument(
        "--strict", action="store_true",
        help="lancement manuel : timeout/tentatives complets pour leaguegamefinder et code de sortie 1 si l'import est incomplet",
    )
    parser.add_argument("--trigger", default="cron", help="origine du lancement, juste tracée dans sync_logs (cron|manuel)")
    args = parser.parse_args()
    season = args.season or current_season_label(dt.date.today())
    run(season, args.season_types, strict=args.strict, trigger=args.trigger)


if __name__ == "__main__":
    main()
