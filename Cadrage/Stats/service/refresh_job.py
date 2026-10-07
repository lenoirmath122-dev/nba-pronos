"""
Point d'entrée de l'import quotidien sur la VM (Cadrage/Stats/vm/) : importe les
box scores manquants (refresh_daily.run, mode strict) PUIS déclenche la
résolution des paris (POST /api/resolve-bets), comme le faisait le workflow
GitHub refresh-stats-supabase.yml avant que stats.nba.com ne bloque ses IP.

La résolution est lancée MÊME si l'import est incomplet : un pari ne se résout
que si son match est dans stats_matchs (resolveNbaGameId), et collect_game()
n'y écrit un match que s'il est complet -- un match sauté laisse donc ses paris
en attente, il ne les perd pas. Sans cela, un seul match en échec (équipes
ambiguës, play-by-play pas encore publié) bloquerait toute la résolution.

Variables d'environnement : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SYNC_SECRET,
APP_URL (défaut https://nba-pronos.vercel.app).

    python refresh_job.py --trigger vm-timer
    python refresh_job.py --season-types "Pre Season" "Regular Season" --trigger vm-manuel

Code de sortie 1 si l'import est incomplet, s'il plante, ou si resolve-bets ne
répond pas 2xx (la VM/le workflow de déclenchement passe alors en rouge).
"""

import argparse
import datetime as dt
import os
import sys

import requests

import refresh_daily as rd

DEFAULT_APP_URL = "https://nba-pronos.vercel.app"
RESOLVE_TIMEOUT_SECONDS = 120


def resolve_bets(trigger: str) -> bool:
    """POST /api/resolve-bets. True si 2xx. Pas de redirection suivie : un
    changement de domaine ferait perdre l'en-tête Authorization, autant échouer
    franchement. Un échec est aussi tracé dans sync_logs (STATS_IMPORT) pour que
    le watchdog le voie."""
    app_url = os.environ.get("APP_URL", DEFAULT_APP_URL).rstrip("/")
    secret = os.environ.get("SYNC_SECRET")
    if not secret:
        print("SYNC_SECRET manquante : résolution des paris non lancée.")
        _log_failure(f"[{trigger}] resolve-bets non lancé : SYNC_SECRET manquante")
        return False
    try:
        response = requests.post(
            f"{app_url}/api/resolve-bets",
            headers={"Authorization": f"Bearer {secret}"},
            timeout=RESOLVE_TIMEOUT_SECONDS,
            allow_redirects=False,
        )
    except requests.RequestException as exc:
        print(f"resolve-bets : appel échoué ({exc!r})")
        _log_failure(f"[{trigger}] resolve-bets : appel échoué ({type(exc).__name__})")
        return False
    print(f"resolve-bets : HTTP {response.status_code} -- {response.text[:500]}")
    if not response.ok:
        _log_failure(f"[{trigger}] resolve-bets : HTTP {response.status_code}")
        return False
    return True


def _log_failure(summary: str):
    try:
        rd.write_sync_log(rd.get_supabase_client(), False, summary)
    except BaseException as exc:  # noqa: BLE001 -- best-effort, y compris le SystemExit de get_supabase_client
        print(f"Trace sync_logs impossible : {exc!r}")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--season", default=None, help="ex: 2026-27 (défaut : saison déduite de la date du jour)")
    parser.add_argument("--season-types", nargs="+", default=rd.DEFAULT_SEASON_TYPES)
    parser.add_argument("--trigger", default="vm-timer", help="origine du lancement, tracée dans sync_logs")
    args = parser.parse_args(argv)
    season = args.season or rd.current_season_label(dt.date.today())

    import_ok = True
    try:
        rd.run(season, args.season_types, strict=True, trigger=args.trigger)
    except SystemExit as exc:
        if exc.code not in (None, 0):
            import_ok = False  # import incomplet, déjà tracé par rd.run
    except Exception as exc:  # noqa: BLE001
        # État inconnu (déjà tracé par rd.run) : on ne résout pas à l'aveugle.
        print(f"Import en exception : {exc!r}")
        return 1

    resolve_ok = resolve_bets(args.trigger)
    return 0 if (import_ok and resolve_ok) else 1


if __name__ == "__main__":
    sys.exit(main())
