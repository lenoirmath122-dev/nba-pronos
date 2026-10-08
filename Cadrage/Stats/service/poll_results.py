"""
Poller des résultats NBA (VM, Cadrage/Stats/vm/nba-results-poll.timer) : lit le
scoreboard NBA (stats.nba.com ScoreboardV3) et le pousse vers
POST /api/sync/results-nba, qui passe les matchs en IN_PROGRESS / FINISHED et
déclenche la résolution des paris dès qu'un match est terminé.

Pourquoi ScoreboardV3 et pas le scoreboard live de cdn.nba.com : le CDN refuse
les IP GCP (403 Akamai, mesuré le 08/10/2026), stats.nba.com répond via nba_api.

Import volontairement LÉGER (requests + la couche HTTP de nba_api, jamais
nba_api.stats.endpoints ni refresh_daily, qui chargent pandas) : ce script
démarre toutes les 2 minutes sur une e2-micro.

Mode dryRun par défaut : la route calcule les écarts sans rien écrire. On ne passe
en réel qu'en posant RESULTS_POLL_DRYRUN=0 (ou false) dans /etc/nba-refresh/env ;
toute autre valeur, ou l'absence de la variable, reste en dryRun. --dry-run / --live
l'emportent sur la variable (essais à la main).

Variables d'environnement : APP_URL (défaut https://nba-pronos.vercel.app),
RESULTS_POLL_DRYRUN, SYNC_SECRET (sinon lu dans Secret Manager via le serveur de
métadonnées de la VM : pas de gcloud toutes les 2 minutes).

    python poll_results.py --trigger vm-poll
    python poll_results.py --dry-run --dates 2026-10-07 2026-10-08

Journalisation : stdout (journald) seulement, une ligne par date. La route écrit
déjà dans sync_logs (changements, ignorés, échecs) ; rien n'est écrit ici, et
surtout pas en STATS_IMPORT, que le watchdog lit.

Code de sortie : 0 si tout a répondu (y compris sans match) ; 75 pour une panne
passagère (fetch NBA, réseau, HTTP 5xx/408/429) ; 1 pour une panne qui demande une
intervention (secret illisible, HTTP 3xx/400/401/403/413). Le timer continue dans tous
les cas.

Repli : en écriture réelle, un fetch NBA en échec déclenche /api/sync/results
(Highlightly), au plus une fois par heure (voir highlightly_fallback).
"""

import argparse
import base64
import datetime as dt
import os
import re
import sys
import time
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from nba_api.stats.library.http import NBAStatsHTTP

DEFAULT_APP_URL = "https://nba-pronos.vercel.app"
SOURCE = "NBA_STATS_SCOREBOARDV3"
SECRET_NAME = "nba-pronos-sync-secret"
NY = ZoneInfo("America/New_York")
# Même règle que nyResultDates (lib/dates/newyork.ts) : avant 6h NY, la veille NY
# compte encore (un match fini après minuit ET n'est plus sous le jour courant).
NY_YESTERDAY_WINDOW_HOURS = 6
MAX_GAMES_PER_POST = 30  # plafond du schéma de la route
FETCH_TIMEOUT_SECONDS = 10
POST_TIMEOUT_SECONDS = 30
METADATA_URL = "http://metadata.google.internal/computeMetadata/v1"
HL_FALLBACK_INTERVAL_SECONDS = 3600
FALLBACK_TIMEOUT_SECONDS = 45  # pire passage : 2 fetch de 10 s + secret 10 s + repli 45 s < TimeoutStartSec=150
DEFAULT_FALLBACK_STAMP = "/var/lib/nba-refresh/hl-fallback.stamp"  # StateDirectory de l'unité, inscriptible

# Statut d'un passage -> code de sortie. 75 (EX_TEMPFAIL) = panne passagère (réseau, 5xx,
# timeout NBA) : l'unité déclare SuccessExitStatus=75, donc pas de `failed` toutes les 2
# minutes ; le watchdog (sync_logs) voit le silence. 1 = secret, domaine, schéma : `failed`.
OK, TRANSIENT, FATAL = "ok", "transient", "fatal"
EXIT_CODES = {OK: 0, TRANSIENT: 75, FATAL: 1}

_GAME_ID = re.compile(r"^\d{10}$")
_TRICODE = re.compile(r"^[A-Z]{3}$")
_DATETIME = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$")


# --------------------------------------------------------------------------- dates


def ny_dates(now_utc: dt.datetime) -> list[str]:
    """[aujourd'hui NY], ou [veille NY, aujourd'hui NY] avant 6h NY."""
    now_ny = now_utc.astimezone(NY)
    today = now_ny.date()
    if now_ny.hour >= NY_YESTERDAY_WINDOW_HOURS:
        return [today.isoformat()]
    return [(today - dt.timedelta(days=1)).isoformat(), today.isoformat()]


def backup_dates(now_utc: dt.datetime) -> list[str]:
    """Pour le secours de refresh_job (passages de 12h et 16h Paris) : les deux
    jours NY précédents et le jour courant, pour rattraper une panne du poller."""
    today = now_utc.astimezone(NY).date()
    return [(today - dt.timedelta(days=n)).isoformat() for n in (2, 1, 0)]


# ----------------------------------------------------------------------- réduction


def _is_int(value, low: int, high: int | None = None) -> bool:
    """Entier dans [low, high]. Un float entier (123.0) passe : JSON.parse côté route le lit comme 123."""
    if isinstance(value, bool):
        return False
    if isinstance(value, float):
        value = int(value) if value.is_integer() else None
    return isinstance(value, int) and value >= low and (high is None or value <= high)


def _reduce_team(team) -> dict | None:
    if not isinstance(team, dict):
        return None
    tricode, score, periods = team.get("teamTricode"), team.get("score"), team.get("periods")
    if not (isinstance(tricode, str) and _TRICODE.fullmatch(tricode) and _is_int(score, 0) and isinstance(periods, list) and len(periods) <= 20):
        return None
    reduced_periods = []
    for p in periods:
        if not (isinstance(p, dict) and _is_int(p.get("period"), 1, 20) and _is_int(p.get("score"), 0)):
            return None
        item = {"period": p["period"], "score": p["score"]}
        period_type = p.get("periodType")
        if isinstance(period_type, str) and len(period_type) <= 32:
            item["periodType"] = period_type
        reduced_periods.append(item)
    return {"teamTricode": tricode, "score": score, "periods": reduced_periods}


def reduce_game(raw) -> dict | None:
    """Liste blanche stricte des champs de nbaLiveGameSchema (lib/nba/nbaLive.ts),
    pré-validée comme le schéma zod : la route rejette TOUT le corps (400) dès qu'un
    seul match est invalide (ex. équipe « TBD » à tricode vide). Renvoie None pour un
    match invalide, qui est alors écarté seul. À garder aligné sur ce schéma."""
    if not isinstance(raw, dict):
        return None
    game_id, status, status_text = raw.get("gameId"), raw.get("gameStatus"), raw.get("gameStatusText")
    game_time = raw.get("gameTimeUTC")
    if not (isinstance(game_id, str) and _GAME_ID.fullmatch(game_id)):
        return None
    if not (_is_int(status, 1, 3) and isinstance(status_text, str) and len(status_text) <= 64):
        return None
    if not (_is_int(raw.get("period"), 0, 20) and isinstance(game_time, str) and _DATETIME.fullmatch(game_time)):
        return None
    home, away = _reduce_team(raw.get("homeTeam")), _reduce_team(raw.get("awayTeam"))
    if home is None or away is None:
        return None
    game = {
        "gameId": game_id,
        "gameStatus": status,
        "gameStatusText": status_text,
        "period": raw["period"],
        "gameTimeUTC": game_time,
        "homeTeam": home,
        "awayTeam": away,
    }
    game_code = raw.get("gameCode")
    if isinstance(game_code, str) and len(game_code) <= 64:
        game["gameCode"] = game_code
    return game


# ---------------------------------------------------------------------------- I/O


def fetch_scoreboard(date: str, timeout: int = FETCH_TIMEOUT_SECONDS) -> list:
    response = NBAStatsHTTP().send_api_request(
        endpoint="scoreboardv3",
        parameters={"GameDate": date, "LeagueID": "00"},
        timeout=timeout,
        raise_exception_on_error=True,
    )
    return response.get_dict()["scoreboard"]["games"]


def load_sync_secret() -> str | None:
    """SYNC_SECRET de l'environnement (tests, appel depuis refresh_job : run.sh l'exporte),
    sinon Secret Manager via le serveur de métadonnées de la VM, en mémoire seulement."""
    secret = os.environ.get("SYNC_SECRET")
    if secret:
        return secret
    headers = {"Metadata-Flavor": "Google"}
    token = requests.get(f"{METADATA_URL}/instance/service-accounts/default/token", headers=headers, timeout=5).json()["access_token"]
    project = requests.get(f"{METADATA_URL}/project/project-id", headers=headers, timeout=5).text.strip()
    response = requests.get(
        f"https://secretmanager.googleapis.com/v1/projects/{project}/secrets/{SECRET_NAME}/versions/latest:access",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
        allow_redirects=False,
    )
    response.raise_for_status()
    return base64.b64decode(response.json()["payload"]["data"]).decode("utf-8").strip()  # comme $(gcloud ...) dans run.sh


def post_games(app_url: str, secret: str, games: list[dict], dry_run: bool) -> list[requests.Response]:
    """POST /api/sync/results-nba, par paquets de 30. Pas de redirection suivie : un
    changement de domaine ferait perdre l'en-tête Authorization, autant échouer."""
    responses = []
    for start in range(0, len(games), MAX_GAMES_PER_POST):
        responses.append(
            requests.post(
                f"{app_url}/api/sync/results-nba",
                headers={"Authorization": f"Bearer {secret}"},
                json={"source": SOURCE, "dryRun": dry_run, "games": games[start : start + MAX_GAMES_PER_POST]},
                timeout=POST_TIMEOUT_SECONDS,
                allow_redirects=False,
            )
        )
    return responses


def resolve_dry_run(env_value: str | None, cli_dry_run: bool = False, cli_live: bool = False) -> bool:
    """Défaut sûr : seul 0 / false (insensible à la casse) passe en réel."""
    if cli_dry_run:
        return True
    if cli_live:
        return False
    return (env_value or "").strip().lower() not in ("0", "false")


def _summary(response: requests.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        return response.text[:200]
    parts = [f"{key}={data[key]}" for key in ("changed", "unchanged", "unmapped") if key in data]
    if data.get("skipped"):
        parts.append(f"skipped={len(data['skipped'])}")
    if data.get("finishedNow"):
        parts.append(f"finishedNow={len(data['finishedNow'])}")
    if data.get("dryRunDiffs"):
        parts.append("diffs=" + ";".join(f"{d.get('gameId')} {d.get('from')}>{d.get('to')} {d.get('fields')}" for d in data["dryRunDiffs"]))
    return " ".join(parts) or response.text[:200]


def _http_failure_status(status_code: int) -> str:
    """5xx, 408 et 429 passent d'eux-mêmes ; 3xx, 400, 401, 403, 413... demandent une
    intervention (secret, domaine, schéma) : l'unité doit rester `failed`."""
    return TRANSIENT if status_code in (408, 429) or status_code >= 500 else FATAL


def _worst(current: str, new: str) -> str:
    order = (OK, TRANSIENT, FATAL)
    return new if order.index(new) > order.index(current) else current


def run_status(dates: list[str], dry_run: bool) -> tuple[str, bool]:
    """Un fetch + un POST par date (aucun POST sans match valide).
    Renvoie (OK | TRANSIENT | FATAL, dates dont le fetch NBA a échoué). Le pire statut l'emporte.
    Jamais d'exception vers l'appelant (le secours de refresh_job ne doit pas échouer)."""
    mode = "dryRun" if dry_run else "réel"
    app_url = os.environ.get("APP_URL", DEFAULT_APP_URL).rstrip("/")
    status, failed_dates = OK, []
    secret: str | None = None
    for date in dates:
        try:
            raw_games = fetch_scoreboard(date)
        except Exception as exc:  # noqa: BLE001 -- réseau, JSON, structure inattendue
            print(f"[poll] {date} mode={mode} fetch NBA échoué ({type(exc).__name__})")
            status = _worst(status, TRANSIENT)
            failed_dates.append(date)
            continue
        games = [g for g in (reduce_game(r) for r in raw_games) if g is not None]
        invalid = len(raw_games) - len(games)
        if not games:
            print(f"[poll] {date} mode={mode} 0 match valide ({invalid} invalide(s))")
            continue
        try:
            if secret is None:
                secret = load_sync_secret()
            if not secret:
                raise RuntimeError("SYNC_SECRET introuvable")
        except Exception as exc:  # noqa: BLE001 -- jamais le secret dans le journal
            print(f"[poll] {date} mode={mode} secret illisible ({type(exc).__name__})")
            status = _worst(status, FATAL)
            continue
        try:
            responses = post_games(app_url, secret, games, dry_run)
        except requests.RequestException as exc:
            print(f"[poll] {date} mode={mode} {len(games)} match(s) POST échoué ({type(exc).__name__})")
            status = _worst(status, TRANSIENT)
            continue
        except Exception as exc:  # noqa: BLE001
            print(f"[poll] {date} mode={mode} {len(games)} match(s) POST échoué ({type(exc).__name__})")
            status = _worst(status, FATAL)
            continue
        for response in responses:
            print(f"[poll] {date} mode={mode} {len(games)} match(s) ({invalid} invalide(s)) -> HTTP {response.status_code} {_summary(response)}")
            # allow_redirects=False : un 307/308 (changement de domaine) n'est PAS un succès.
            if not 200 <= response.status_code < 300:
                status = _worst(status, _http_failure_status(response.status_code))
    return status, failed_dates


def run(dates: list[str], dry_run: bool) -> bool:
    """True si tout a répondu (voir run_status)."""
    return run_status(dates, dry_run)[0] == OK


def highlightly_fallback(now: float | None = None) -> bool:
    """Repli quand le fetch NBA échoue (IP bloquée...) : déclenche la synchro Highlightly
    (/api/sync/results) au lieu d'attendre le cron GitHub, espacé de 3 à 6 h. Au plus une
    fois par HL_FALLBACK_INTERVAL_SECONDS (quota Highlightly de 100 requêtes/jour) ; la
    date du dernier essai est posée AVANT l'appel, un échec ne relance donc pas en boucle.
    Jamais d'exception."""
    now = time.time() if now is None else now
    stamp = Path(os.environ.get("RESULTS_FALLBACK_STAMP", DEFAULT_FALLBACK_STAMP))
    try:
        if now - stamp.stat().st_mtime < HL_FALLBACK_INTERVAL_SECONDS:
            print("[poll] repli Highlightly : déjà tenté il y a moins d'une heure")
            return False
    except FileNotFoundError:
        pass
    except OSError as exc:
        print(f"[poll] repli Highlightly : horodatage illisible ({type(exc).__name__})")
        return False
    try:
        stamp.touch()
        secret = load_sync_secret()
        if not secret:
            raise RuntimeError("SYNC_SECRET introuvable")
        app_url = os.environ.get("APP_URL", DEFAULT_APP_URL).rstrip("/")
        response = requests.post(
            f"{app_url}/api/sync/results",
            headers={"Authorization": f"Bearer {secret}"},
            timeout=FALLBACK_TIMEOUT_SECONDS,
            allow_redirects=False,
        )
    except Exception as exc:  # noqa: BLE001 -- jamais le secret dans le journal
        print(f"[poll] repli Highlightly échoué ({type(exc).__name__})")
        return False
    print(f"[poll] repli Highlightly -> HTTP {response.status_code}")
    return 200 <= response.status_code < 300


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="force le dryRun (prioritaire sur RESULTS_POLL_DRYRUN)")
    mode.add_argument("--live", action="store_true", help="force l'écriture réelle (prioritaire sur RESULTS_POLL_DRYRUN)")
    parser.add_argument("--dates", nargs="+", default=None, help="jours NY AAAA-MM-JJ (défaut : règle de la veille NY)")
    parser.add_argument("--trigger", default="vm-poll", help="origine du lancement (journal)")
    args = parser.parse_args(argv)
    dry_run = resolve_dry_run(os.environ.get("RESULTS_POLL_DRYRUN"), args.dry_run, args.live)
    dates = args.dates or ny_dates(dt.datetime.now(dt.timezone.utc))
    status, failed_dates = run_status(dates, dry_run)
    # Repli seulement si le fetch du jour NY (dernière date) a échoué : un timeout isolé sur
    # la veille ne brûle ni quota ni créneau. Écriture réelle uniquement et hors essai à la
    # main : en dryRun le poller n'écrit rien, Highlightly reste la seule source.
    if dates[-1] in failed_dates and not dry_run and args.dates is None:
        highlightly_fallback()
    return EXIT_CODES[status]


if __name__ == "__main__":
    sys.exit(main())
