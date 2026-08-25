"""
Backfill de stats_box_scores.technical_fouls/backcourt_turnovers et
stats_matchs.home_timeouts/away_timeouts (chantier "événements de match",
étape 5 du plan de reprise post-audit, GAPS_OUVERTS.md, 25/08/2026) --
AUCUN appel API : la donnée existe déjà en LOCAL
(Cadrage/Stats/data/raw/<saison>/playbyplay/*.csv, un fichier par match,
actionType/subType structurés), jamais agrégée jusqu'ici. Même précédent
que backfill_starter_position.py (position, 24/08/2026) : correspondance
déjà vérifiée entre les CSV locaux et les 6602 matchs stats_matchs.

3 familles d'events, 2 granularités :
- technical_fouls (actionType=Foul, "Technical" dans subType) et
  backcourt_turnovers (actionType=Turnover, subType="Backcourt Turnover") :
  PAR JOUEUR (personId attribué directement) -- écrites sur stats_box_scores.
  Piège réel trouvé en explorant les données : une faute technique
  D'ENTRAÎNEUR a teamId="0" et un personId qui n'est PAS un joueur (ex.
  Gregg Popovich) -- filtrées ici (team_id == "0"), sans quoi
  bulk_update_box_score_game_events() échouerait silencieusement à les
  rattacher (aucune ligne stats_box_scores pour un coach de toute façon).
- timeouts (actionType=Timeout, subType="Regular") : PAR ÉQUIPE seulement
  (teamId="0" dans le play-by-play aussi -- seule l'équipe qui l'a appelé
  est identifiable via son NOM en texte libre dans `description`, ex.
  "Nets Timeout: Regular"). Résolue en comparant ce préfixe (normalisé en
  MAJUSCULES) aux noms des 2 VRAIES équipes de ce match (stats_equipes.name,
  déjà en MAJUSCULES ou Title Case selon les matchs -- vérifié sur un
  échantillon, jamais autre chose) -- fermé à 2 candidats par match, pas un
  matching flou sur les 30 équipes de la ligue. Écrites sur stats_matchs.

Usage:
    python backfill_game_events.py
"""

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from refresh_daily import get_supabase_client  # noqa: E402

RAW_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"
CHUNK = 2000

TECHNICAL_SUBTYPES = {
    "Technical", "Double Technical", "Delay Technical", "Hanging Technical", "Too Many Players Technical",
}


def fetch_all(client, table: str, columns: str) -> list[dict]:
    """Pagine avec .range() -- meme piege PAGE_SIZE=1000 que fetch_all_rows()
    (supabase_context.py), duplique ici plutot qu'importe (script autonome,
    pas embarque dans l'image Cloud Run)."""
    rows: list[dict] = []
    start = 0
    while True:
        page = client.table(table).select(columns).range(start, start + 999).execute().data
        rows.extend(page)
        if len(page) < 1000:
            return rows
        start += 1000


def main():
    client = get_supabase_client()

    print("Chargement stats_equipes/stats_matchs (pour resoudre l'equipe des temps morts)...")
    equipes = fetch_all(client, "stats_equipes", "team_id, name")
    team_name_by_id = {e["team_id"]: (e["name"] or "").upper() for e in equipes}
    matchs = fetch_all(client, "stats_matchs", "game_id, home_team_id, away_team_id")
    home_away_by_game = {m["game_id"]: (m["home_team_id"], m["away_team_id"]) for m in matchs}
    print(f"  {len(team_name_by_id)} equipes, {len(home_away_by_game)} matchs connus.\n")

    # (game_id, player_id) -> {"technical_fouls": int, "backcourt_turnovers": int}
    player_events: dict[tuple[str, int], dict[str, int]] = {}
    # game_id -> {"home": int, "away": int}
    timeouts_by_game: dict[str, dict[str, int]] = {}
    unresolved_timeouts = 0

    seasons = sorted(d for d in RAW_DIR.iterdir() if d.is_dir())
    for season_dir in seasons:
        pbp_dir = season_dir / "playbyplay"
        if not pbp_dir.exists():
            continue
        files = sorted(pbp_dir.glob("*.csv"))
        print(f"{season_dir.name} : {len(files)} matchs")
        for pbp_path in files:
            df = pd.read_csv(pbp_path, dtype={"gameId": str, "teamId": str, "personId": "Int64"})
            game_id = pbp_path.stem

            fouls = df[(df["actionType"] == "Foul") & df["subType"].isin(TECHNICAL_SUBTYPES) & (df["teamId"] != "0")]
            for pid in fouls["personId"].dropna():
                key = (game_id, int(pid))
                player_events.setdefault(key, {"technical_fouls": 0, "backcourt_turnovers": 0})
                player_events[key]["technical_fouls"] += 1

            backcourt = df[(df["actionType"] == "Turnover") & (df["subType"] == "Backcourt Turnover")]
            for pid in backcourt["personId"].dropna():
                key = (game_id, int(pid))
                player_events.setdefault(key, {"technical_fouls": 0, "backcourt_turnovers": 0})
                player_events[key]["backcourt_turnovers"] += 1

            teams = home_away_by_game.get(game_id)
            if teams is None:
                continue
            home_id, away_id = teams
            home_name, away_name = team_name_by_id.get(home_id, ""), team_name_by_id.get(away_id, "")
            regular_timeouts = df[(df["actionType"] == "Timeout") & (df["subType"] == "Regular")]
            for desc in regular_timeouts["description"].fillna(""):
                prefix = desc.split(" Timeout:")[0].strip().upper()
                timeouts_by_game.setdefault(game_id, {"home": 0, "away": 0})
                if home_name and prefix == home_name.upper():
                    timeouts_by_game[game_id]["home"] += 1
                elif away_name and prefix == away_name.upper():
                    timeouts_by_game[game_id]["away"] += 1
                else:
                    unresolved_timeouts += 1

    print(f"\n{len(player_events)} lignes joueur (technical_fouls/backcourt_turnovers) a mettre a jour.")
    print(f"{len(timeouts_by_game)} matchs (home_timeouts/away_timeouts) a mettre a jour.")
    if unresolved_timeouts:
        print(f"ATTENTION : {unresolved_timeouts} temps morts non rattaches a une equipe (nom non reconnu) -- ignores.")

    player_rows = [
        {"game_id": gid, "player_id": pid, "technical_fouls": v["technical_fouls"], "backcourt_turnovers": v["backcourt_turnovers"]}
        for (gid, pid), v in player_events.items()
    ]
    for i in range(0, len(player_rows), CHUNK):
        client.rpc("bulk_update_box_score_game_events", {"rows": player_rows[i:i + CHUNK]}).execute()
        print(f"  joueurs [{min(i + CHUNK, len(player_rows))}/{len(player_rows)}]")

    match_rows = [{"game_id": gid, "home_timeouts": v["home"], "away_timeouts": v["away"]} for gid, v in timeouts_by_game.items()]
    for i in range(0, len(match_rows), CHUNK):
        client.rpc("bulk_update_match_timeouts", {"rows": match_rows[i:i + CHUNK]}).execute()
        print(f"  matchs [{min(i + CHUNK, len(match_rows))}/{len(match_rows)}]")

    print("\nTermine.")


if __name__ == "__main__":
    main()
