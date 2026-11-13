"""
Feuilles de match statiques (box score seul) des matchs NBA terminés : un petit JSON
par match, déposé dans le bucket Supabase Storage public `box-scores` et lu tel quel
par l'appli depuis le CDN de Supabase (components/play/BoxScoreDialog.tsx) -- ni
requête en base ni CPU Vercel à la lecture.

Trois appelants :
  - poll_results.py (toutes les 2 min la nuit) : dès qu'un match passe à « terminé »
    dans le scoreboard, un appel BoxScoreTraditionalV3, puis l'envoi. Le fichier est
    publié 2 à 5 minutes après le buzzer, sans attendre l'import de 12h/16h.
  - refresh_job.py (12h et 16h Paris) : réécrit une fois les matchs des jours NY
    précédents (corrections de stats de la NBA le lendemain) et rattrape ceux que le
    poller aurait manqués.
  - à la main, `python box_scores.py --backfill --since AAAA-MM-JJ` : matchs déjà
    importés dans stats_matchs (rattrapage initial).

Chemin d'un fichier : `{jour NY}/{TRICODE}-{TRICODE}.json`, tricodes triés par ordre
alphabétique (l'ordre domicile/extérieur peut différer entre les sources, même règle
que resolveNbaGameId). L'appli recalcule ce chemin à partir de `matches.scheduled_at`
et des abréviations d'équipes (lib/boxScores/path.ts) : à garder aligné.

Interrupteur BOX_SCORES_PUBLISH (dans /etc/nba-refresh/env) :
  absent / 0 / autre : rien (aucun appel NBA de plus) ;
  dry                : box score récupéré et vérifié, journalisé, pas d'envoi ;
  1                  : envoi réel.

Garde-fous : rien ici ne lève vers l'appelant (les résultats et la résolution des paris
passent avant), budget de temps et nombre d'appels plafonnés par passage, un fichier
n'est publié que si les points d'équipe du box score égalent le score du scoreboard
(sinon la NBA n'a pas fini de publier : nouvel essai au passage suivant, au plus
MAX_ATTEMPTS fois, ensuite c'est le passage de 12h qui s'en charge).

Import volontairement léger (requests + couche HTTP de nba_api), comme poll_results.py.
"""

import argparse
import base64
import datetime as dt
import json
import os
import re
import sys
import time
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from nba_api.stats.library.http import NBAStatsHTTP

BUCKET = "box-scores"
SCHEMA_VERSION = 1
SUPABASE_SECRET_NAME = "nba-pronos-supabase-key"
METADATA_URL = "http://metadata.google.internal/computeMetadata/v1"
NY = ZoneInfo("America/New_York")

FETCH_TIMEOUT_SECONDS = 10
UPLOAD_TIMEOUT_SECONDS = 10
# Poller : TimeoutStartSec=150 sur l'unité, dont ~85 s déjà possibles pour les
# résultats (voir FALLBACK_TIMEOUT_SECONDS dans poll_results.py). On s'arrête donc de
# lancer des appels après 45 s, et jamais plus de 4 matchs par passage.
POLL_BUDGET_SECONDS = 45
POLL_MAX_GAMES = 4
MAX_ATTEMPTS = 15  # ~30 min de nouveaux essais au rythme de 2 min
STATE_KEEP_DAYS = 10
CACHE_CONTROL_SECONDS = 600  # le CDN Supabase garde 10 min : une réécriture apparaît vite
BACKFILL_PAUSE_SECONDS = 0.6  # politesse envers stats.nba.com en rattrapage

DEFAULT_STATE = "/var/lib/nba-refresh/box-scores-state.json"

OFF, DRY, ON = "off", "dry", "on"

_GAME_ID = re.compile(r"^\d{10}$")
_TRICODE = re.compile(r"^[A-Z]{3}$")
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_MIN_MMSS = re.compile(r"^(\d{1,3}):(\d{1,2})(?:\.\d+)?$")
_MIN_ISO = re.compile(r"^PT(\d{1,3})M(\d{1,2})(?:\.\d+)?S$")
_MIN_PLAIN = re.compile(r"^(\d{1,3})$")

# Statistiques gardées (clé courte du JSON -> champ BoxScoreTraditionalV3).
STAT_FIELDS = {
    "pts": "points",
    "reb": "reboundsTotal",
    "oreb": "reboundsOffensive",
    "dreb": "reboundsDefensive",
    "ast": "assists",
    "stl": "steals",
    "blk": "blocks",
    "tov": "turnovers",
    "pf": "foulsPersonal",
    "fgm": "fieldGoalsMade",
    "fga": "fieldGoalsAttempted",
    "tpm": "threePointersMade",
    "tpa": "threePointersAttempted",
    "ftm": "freeThrowsMade",
    "fta": "freeThrowsAttempted",
}


# ---------------------------------------------------------------------- réglages


def publish_mode(env_value: str | None) -> str:
    value = (env_value or "").strip().lower()
    if value == "1":
        return ON
    if value == "dry":
        return DRY
    return OFF


def object_path(ny_date: str, tricode_a: str, tricode_b: str) -> str:
    """Même règle que boxScorePath (lib/boxScores/path.ts)."""
    first, second = sorted((tricode_a, tricode_b))
    return f"{ny_date}/{first}-{second}.json"


# --------------------------------------------------------------------- réduction


def _int(value) -> int:
    if isinstance(value, bool):
        raise ValueError("booléen")
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    if not isinstance(value, int):
        raise ValueError(f"entier attendu : {value!r}")
    return value


def normalize_minutes(raw) -> str | None:
    """« 36:12 », « 36:12.00 », « PT36M12.00S » ou « 36 » -> « 36:12 ». None si le
    joueur n'a pas joué (champ vide ou 0:00)."""
    if not isinstance(raw, str):
        return None
    text = raw.strip()
    match = _MIN_MMSS.fullmatch(text) or _MIN_ISO.fullmatch(text)
    if match:
        minutes, seconds = int(match.group(1)), int(match.group(2))
    else:
        match = _MIN_PLAIN.fullmatch(text)
        if not match:
            return None
        minutes, seconds = int(match.group(1)), 0
    if minutes == 0 and seconds == 0:
        return None
    return f"{minutes}:{seconds:02d}"


def _stats(statistics: dict) -> dict:
    return {key: _int(statistics.get(field)) for key, field in STAT_FIELDS.items()}


def _clean_text(value, limit: int = 80) -> str:
    return value.strip()[:limit] if isinstance(value, str) else ""


def _reduce_team(team: dict, side: str) -> dict:
    tricode = team.get("teamTricode")
    if not (isinstance(tricode, str) and _TRICODE.fullmatch(tricode)):
        raise ValueError(f"tricode invalide : {tricode!r}")
    players, dnp = [], []
    for raw in team.get("players") or []:
        if not isinstance(raw, dict):
            continue
        first, family = _clean_text(raw.get("firstName")), _clean_text(raw.get("familyName"))
        name = f"{first} {family}".strip()
        if not name:
            continue
        statistics = raw.get("statistics") or {}
        minutes = normalize_minutes(statistics.get("minutes"))
        if minutes is None:
            dnp.append({"name": name, "reason": _clean_text(raw.get("comment"))})
            continue
        position = _clean_text(raw.get("position"), 4)
        player = {
            "id": _int(raw.get("personId")),
            "name": name,
            "short": _clean_text(raw.get("nameI"), 40) or name,
            "jersey": _clean_text(raw.get("jerseyNum"), 4),
            "pos": position,
            # Même convention que refresh_daily (colonne `position`) : seuls les
            # titulaires ont un poste renseigné dans BoxScoreTraditionalV3.
            "starter": bool(position),
            "min": minutes,
            "pm": _int(statistics.get("plusMinusPoints")),
        }
        player.update(_stats(statistics))
        players.append(player)
    if not players:
        raise ValueError(f"{tricode} : aucun joueur avec des minutes")
    totals = _stats(team.get("statistics") or {})
    if totals["pts"] != sum(p["pts"] for p in players):
        raise ValueError(f"{tricode} : total des points incohérent")
    # Titulaires d'abord (ordre NBA conservé), puis le banc.
    players.sort(key=lambda p: not p["starter"])
    return {
        "side": side,
        "tricode": tricode,
        "city": _clean_text(team.get("teamCity")),
        "name": _clean_text(team.get("teamName")),
        "score": totals["pts"],
        "players": players,
        "dnp": dnp,
        "totals": totals,
    }


def reduce_box_score(raw: dict, ny_date: str, source: str, expected_scores: dict | None = None, now: dt.datetime | None = None) -> dict:
    """Réponse brute BoxScoreTraditionalV3 -> JSON publié. Lève ValueError si le box
    score est incomplet ou incohérent. `expected_scores` ({tricode: score}, tiré du
    scoreboard) : les points d'équipe doivent l'égaler, sinon la NBA n'a pas fini."""
    box = raw.get("boxScoreTraditional") if isinstance(raw, dict) else None
    if not isinstance(box, dict):
        raise ValueError("boxScoreTraditional absent")
    game_id = box.get("gameId")
    if not (isinstance(game_id, str) and _GAME_ID.fullmatch(game_id)):
        raise ValueError(f"gameId invalide : {game_id!r}")
    if not _DATE.fullmatch(ny_date):
        raise ValueError(f"date invalide : {ny_date!r}")
    away = _reduce_team(box.get("awayTeam") or {}, "away")
    home = _reduce_team(box.get("homeTeam") or {}, "home")
    if expected_scores:
        for team in (away, home):
            expected = expected_scores.get(team["tricode"])
            if expected is not None and expected != team["score"]:
                raise ValueError(f"{team['tricode']} : {team['score']} pts au box score, {expected} au scoreboard")
    now = now or dt.datetime.now(dt.timezone.utc)
    return {
        "v": SCHEMA_VERSION,
        "gameId": game_id,
        "date": ny_date,
        "source": source,
        "updatedAt": now.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "teams": [away, home],
    }


# --------------------------------------------------------------------------- I/O


def fetch_box_score(game_id: str, timeout: int = FETCH_TIMEOUT_SECONDS) -> dict:
    response = NBAStatsHTTP().send_api_request(
        endpoint="boxscoretraditionalv3",
        parameters={"GameID": game_id, "StartPeriod": 0, "EndPeriod": 0, "StartRange": 0, "EndRange": 0, "RangeType": 0},
        timeout=timeout,
        raise_exception_on_error=True,
    )
    return response.get_dict()


def load_supabase_key() -> str:
    """SUPABASE_SERVICE_ROLE_KEY de l'environnement (refresh_job : run.sh l'exporte),
    sinon Secret Manager via le serveur de métadonnées (poller), en mémoire seulement.
    Même secret que run.sh, même compte de service de la VM."""
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if key:
        return key
    headers = {"Metadata-Flavor": "Google"}
    token = requests.get(f"{METADATA_URL}/instance/service-accounts/default/token", headers=headers, timeout=5).json()["access_token"]
    project = requests.get(f"{METADATA_URL}/project/project-id", headers=headers, timeout=5).text.strip()
    response = requests.get(
        f"https://secretmanager.googleapis.com/v1/projects/{project}/secrets/{SUPABASE_SECRET_NAME}/versions/latest:access",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
        allow_redirects=False,
    )
    response.raise_for_status()
    return base64.b64decode(response.json()["payload"]["data"]).decode("utf-8").strip()


def upload(path: str, sheet: dict, key: str) -> None:
    """Dépôt (écrasement) dans le bucket via l'API Storage. Lève si pas 2xx."""
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not base.startswith("https://") and not base.startswith("http://127.0.0.1"):
        raise RuntimeError("SUPABASE_URL absente ou invalide")
    response = requests.post(
        f"{base}/storage/v1/object/{BUCKET}/{path}",
        headers={
            "Authorization": f"Bearer {key}",
            "apikey": key,
            "Content-Type": "application/json",
            "x-upsert": "true",
            "Cache-Control": f"max-age={CACHE_CONTROL_SECONDS}",
        },
        data=json.dumps(sheet, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
        timeout=UPLOAD_TIMEOUT_SECONDS,
        allow_redirects=False,
    )
    if not 200 <= response.status_code < 300:
        raise RuntimeError(f"Storage HTTP {response.status_code}")


# ------------------------------------------------------------------------- état


def _state_path() -> Path:
    return Path(os.environ.get("BOX_SCORES_STATE", DEFAULT_STATE))


def load_state() -> dict:
    try:
        data = json.loads(_state_path().read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def save_state(state: dict, today: dt.date) -> None:
    """Purge les matchs de plus de STATE_KEEP_DAYS jours, puis écrit (atomique)."""
    limit = (today - dt.timedelta(days=STATE_KEEP_DAYS)).isoformat()
    kept = {gid: entry for gid, entry in state.items() if isinstance(entry, dict) and entry.get("date", "") >= limit}
    path = _state_path()
    try:
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(kept, sort_keys=True), encoding="utf-8")
        tmp.replace(path)
    except OSError as exc:
        print(f"[box-scores] état non enregistré ({type(exc).__name__})")


# -------------------------------------------------------------------- publication


def finished_candidates(ny_date: str, raw_games: list) -> list[dict]:
    """Matchs terminés (gameStatus 3) d'un scoreboard brut, réduits à ce qu'il faut."""
    out = []
    for raw in raw_games or []:
        if not isinstance(raw, dict) or raw.get("gameStatus") != 3:
            continue
        game_id = raw.get("gameId")
        home, away = raw.get("homeTeam") or {}, raw.get("awayTeam") or {}
        tricodes = (home.get("teamTricode"), away.get("teamTricode"))
        if not (isinstance(game_id, str) and _GAME_ID.fullmatch(game_id)):
            continue
        if not all(isinstance(t, str) and _TRICODE.fullmatch(t) for t in tricodes):
            continue
        scores = {}
        for team in (home, away):
            if isinstance(team.get("score"), int) and not isinstance(team.get("score"), bool):
                scores[team["teamTricode"]] = team["score"]
        out.append({"gameId": game_id, "date": ny_date, "tricodes": tricodes, "scores": scores})
    return out


def publish(candidates: list[dict], mode: str, *, rewrite: bool = False, source: str = "poll",
            budget_seconds: float | None = POLL_BUDGET_SECONDS, max_games: int | None = POLL_MAX_GAMES,
            today: dt.date | None = None) -> dict:
    """Publie les matchs terminés pas encore publiés. `rewrite` (refresh_job) : republie
    aussi, une seule fois, un match déjà publié par le poller d'un jour NY passé.
    Renvoie un compteur ; ne lève jamais."""
    counts = {"published": 0, "failed": 0, "skipped": 0}
    if mode == OFF or not candidates:
        return counts
    today = today or dt.datetime.now(NY).date()
    started = time.monotonic()
    try:
        state = load_state()
        key = None
        done = 0
        # En dry, un drapeau à part : passer ensuite à 1 publie bien ce qui a été vérifié.
        flag = "published" if mode == ON else "checked"
        for game in candidates:
            gid = game["gameId"]
            entry = state.setdefault(gid, {"date": game["date"], "attempts": 0, "published": False, "final": False})
            past_day = game["date"] < today.isoformat()
            wanted = (not entry.get(flag)) or (mode == ON and rewrite and past_day and not entry.get("final"))
            if not wanted:
                continue
            if not rewrite and entry.get("attempts", 0) >= MAX_ATTEMPTS:
                counts["skipped"] += 1
                continue
            if max_games is not None and done >= max_games:
                break
            if budget_seconds is not None and time.monotonic() - started > budget_seconds:
                print("[box-scores] budget de temps atteint, suite au passage suivant")
                break
            done += 1
            entry["attempts"] = entry.get("attempts", 0) + 1
            path = object_path(game["date"], *game["tricodes"])
            try:
                sheet = reduce_box_score(fetch_box_score(gid), game["date"], source, game.get("scores"))
                if mode == ON:
                    if key is None:
                        key = load_supabase_key()
                    upload(path, sheet, key)
            except Exception as exc:  # noqa: BLE001 -- réseau, box score pas encore final, Storage
                counts["failed"] += 1
                detail = str(exc)[:120] if isinstance(exc, ValueError) else type(exc).__name__
                print(f"[box-scores] {gid} {path} essai {entry['attempts']} échoué ({detail})")
                continue
            counts["published"] += 1
            entry[flag] = True
            if mode == ON and past_day and rewrite:
                entry["final"] = True
            verb = "publié" if mode == ON else "vérifié (dry)"
            print(f"[box-scores] {gid} {path} {verb} source={source}")
        save_state(state, today)
    except Exception as exc:  # noqa: BLE001 -- jamais d'exception vers les résultats
        print(f"[box-scores] échec ignoré ({type(exc).__name__})")
    return counts


# ---------------------------------------------------------------------- rattrapage


def backfill_candidates(since: str, until: str | None = None) -> list[dict]:
    """Matchs de stats_matchs entre deux jours NY (import lourd, à la main seulement)."""
    import refresh_daily as rd  # noqa: PLC0415 -- pandas/supabase : jamais dans le poller

    client = rd.get_supabase_client()
    query = client.table("stats_matchs").select("game_id, game_date, home_team_id, away_team_id").gte("game_date", since)
    if until:
        query = query.lte("game_date", until)
    games = query.order("game_date").execute().data or []
    teams = client.table("stats_equipes").select("team_id, tricode").execute().data or []
    tricode_by_id = {t["team_id"]: t["tricode"] for t in teams}
    out = []
    for g in games:
        tricodes = (tricode_by_id.get(g["home_team_id"]), tricode_by_id.get(g["away_team_id"]))
        if not all(tricodes):
            print(f"[box-scores] {g['game_id']} équipes inconnues, ignoré")
            continue
        out.append({"gameId": g["game_id"], "date": str(g["game_date"])[:10], "tricodes": tricodes, "scores": {}})
    return out


def backfill(since: str, until: str | None, mode: str) -> int:
    candidates = backfill_candidates(since, until)
    print(f"[box-scores] rattrapage : {len(candidates)} match(s) depuis {since}")
    published = failed = 0
    for game in candidates:
        # Un match à la fois : le rattrapage force la réécriture et n'a pas de budget.
        result = publish([game], mode, rewrite=True, source="backfill", budget_seconds=None, max_games=None)
        published += result["published"]
        failed += result["failed"]
        time.sleep(BACKFILL_PAUSE_SECONDS)
    print(f"[box-scores] rattrapage terminé : {published} publié(s), {failed} échec(s)")
    return 0 if failed == 0 else 1


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--backfill", action="store_true", help="publie les matchs de stats_matchs")
    parser.add_argument("--since", help="premier jour NY AAAA-MM-JJ (avec --backfill)")
    parser.add_argument("--until", default=None, help="dernier jour NY AAAA-MM-JJ (avec --backfill)")
    parser.add_argument("--dry", action="store_true", help="vérifie sans rien envoyer")
    args = parser.parse_args(argv)
    if not args.backfill or not args.since or not _DATE.fullmatch(args.since):
        parser.error("usage : --backfill --since AAAA-MM-JJ [--until AAAA-MM-JJ] [--dry]")
    # À la main : l'interrupteur du poller ne s'applique pas, seul --dry compte.
    return backfill(args.since, args.until, DRY if args.dry else ON)


if __name__ == "__main__":
    sys.exit(main())
