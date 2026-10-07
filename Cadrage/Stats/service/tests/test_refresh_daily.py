"""Tests de l'import quotidien (refresh_daily._run) : un match n'est enregistré
que s'il est complet (box score, play-by-play, 4 quarts-temps), et
stats_matchs est écrit EN DERNIER (sinon un match incomplet ne serait jamais
réessayé, voir collect_game). Aucun appel réseau : les fetch_* sont remplacés,
le client Supabase est un faux qui enregistre les écritures dans l'ordre.

    pip install -r Cadrage/Stats/service/requirements-refresh.txt pytest
    pytest Cadrage/Stats/service/tests
"""

import sys
from collections import Counter
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import refresh_daily as rd  # noqa: E402

SEASON = "2026-27"
HOME, AWAY = 100, 200


class FakeQuery:
    def __init__(self, client, table, op, payload):
        self.client, self.table, self.op, self.payload = client, table, op, payload

    def in_(self, column, values):
        self.payload = {"in": (column, list(values))}
        return self

    def execute(self):
        self.client.calls.append((self.table, self.op, self.payload))
        return self


class FakeTable:
    def __init__(self, client, name):
        self.client, self.name = client, name

    def upsert(self, records, on_conflict=None):
        return FakeQuery(self.client, self.name, "upsert", records)

    def insert(self, records):
        return FakeQuery(self.client, self.name, "insert", records)

    def delete(self):
        return FakeQuery(self.client, self.name, "delete", None)


class FakeClient:
    def __init__(self):
        self.calls = []

    def table(self, name):
        return FakeTable(self, name)

    def writes(self, table=None, op=None):
        return [c for c in self.calls if c[0] != "sync_logs" and (table is None or c[0] == table) and (op is None or c[1] == op)]

    def tables_written(self):
        return [c[0] for c in self.calls if c[0] != "sync_logs"]


def box_df(game_id, players):
    """players : [(person_id, team_id, minutes)] -- colonnes BoxScoreTraditionalV3."""
    rows = []
    for pid, team_id, minutes in players:
        rows.append({
            "gameId": game_id, "teamId": team_id, "teamTricode": "AAA" if team_id == HOME else "BBB",
            "teamCity": "Ville", "teamName": "Home" if team_id == HOME else "Away",
            "personId": pid, "firstName": "P", "familyName": str(pid), "nameI": f"P. {pid}",
            "minutes": minutes, "position": "G" if minutes else "",
            "fieldGoalsMade": 3, "fieldGoalsAttempted": 6, "fieldGoalsPercentage": 0.5,
            "threePointersMade": 1, "threePointersAttempted": 2, "threePointersPercentage": 0.5,
            "freeThrowsMade": 1, "freeThrowsAttempted": 2, "freeThrowsPercentage": 0.5,
            "reboundsOffensive": 1, "reboundsDefensive": 2, "reboundsTotal": 3, "assists": 4,
            "steals": 1, "blocks": 0, "turnovers": 1, "foulsPersonal": 2, "points": 8, "plusMinusPoints": 3,
        })
    return pd.DataFrame(rows)


def adv_df(game_id, players):
    rows = []
    for pid, team_id, minutes in players:
        rows.append({
            "gameId": game_id, "teamId": team_id, "personId": pid, "minutes": minutes,
            "offensiveRating": 110.0, "defensiveRating": 105.0, "netRating": 5.0,
            "trueShootingPercentage": 0.55, "usagePercentage": 0.2, "pace": 98.0,
        })
    return pd.DataFrame(rows)


def pbp_with_block():
    return pd.DataFrame([
        {"actionNumber": 1, "actionType": "Missed Shot", "subType": "", "personId": 11, "teamId": HOME,
         "description": "MISS", "clock": "PT10M00.00S"},
        {"actionNumber": 1, "actionType": None, "subType": "", "personId": 21, "teamId": AWAY,
         "description": "Away BLOCK (1 BLK)", "clock": "PT10M00.00S"},
        {"actionNumber": 2, "actionType": "Made Shot", "subType": "", "personId": 11, "teamId": HOME,
         "description": "Shot", "clock": "PT00M00.10S"},
    ])


PLAYERS = [(11, HOME, "30:00"), (21, AWAY, "28:00"), (12, HOME, "")]  # 12 = DNP


@pytest.fixture
def env(monkeypatch):
    """Monte un faux monde NBA ; chaque test ajuste ce qui manque via `state`."""
    state = {
        "games": {"G1": {"game_date": "2026-10-10", "season": SEASON, "season_type": "Pre Season",
                         "teams": {HOME: "AAA vs. BBB", AWAY: "BBB @ AAA"}}},
        "box_fail": set(), "pbp_fail": set(), "pbp_empty": set(), "period_fail": {},  # game_id -> {period}
        "counts": Counter(),
    }

    def fake_box(game_id):
        if game_id in state["box_fail"]:
            return None, None
        return box_df(game_id, PLAYERS), adv_df(game_id, PLAYERS)

    def fake_pbp(game_id):
        if game_id in state["pbp_fail"]:
            return None
        if game_id in state["pbp_empty"]:
            return pbp_with_block().iloc[0:0]
        return pbp_with_block()

    def fake_periods(game_id):
        failing = state["period_fail"].get(game_id, {})
        out = {}
        for period in (1, 2, 3, 4):
            if failing.get(period) == "none":
                out[period] = None
            elif failing.get(period) == "empty":
                out[period] = box_df(game_id, []).reindex(columns=box_df(game_id, PLAYERS).columns)
            else:
                out[period] = box_df(game_id, PLAYERS)
        return out

    monkeypatch.setattr(rd, "known_game_ids", lambda client, season: set())
    monkeypatch.setattr(rd, "season_player_game_counts", lambda client, season: state["counts"])
    monkeypatch.setattr(rd, "fetch_season_games", lambda season, types, strict=False: (state["games"], []))
    monkeypatch.setattr(rd, "fetch_box_scores", fake_box)
    monkeypatch.setattr(rd, "fetch_play_by_play", fake_pbp)
    monkeypatch.setattr(rd, "fetch_period_box_scores", fake_periods)
    return state


def run(env_state):
    client = FakeClient()
    ok, summary = rd._run(client, SEASON, ["Pre Season"], strict=True)
    return client, ok, summary


def test_match_complet_ecrit_et_stats_matchs_en_dernier(env):
    client, ok, _ = run(env)
    assert ok is True
    tables = client.tables_written()
    assert "stats_box_scores" in tables and "stats_box_scores_by_period" in tables
    assert tables[-1] == "stats_matchs"
    # contres : delete AVANT insert, tous deux avant stats_matchs
    ops = [(t, o) for t, o, _ in client.calls if t == "stats_block_events"]
    assert ops == [("stats_block_events", "delete"), ("stats_block_events", "insert")]
    assert client.writes("stats_block_events", "insert")[0][2] == [{"game_id": "G1", "blocker_player_id": 21, "victim_player_id": 11}]
    # 2 joueurs ont joué (le DNP est filtré), 4 quarts-temps
    assert len(client.writes("stats_box_scores")[0][2]) == 2
    assert len(client.writes("stats_box_scores_by_period")[0][2]) == 2 * 4


@pytest.mark.parametrize("kind", ["none", "empty"])
def test_quart_temps_manquant_le_match_nest_pas_enregistre(env, kind):
    env["period_fail"] = {"G1": {2: kind}}
    client, ok, summary = run(env)
    assert ok is False
    assert client.writes() == []  # ni match, ni box scores, ni contres, ni équipes
    assert "G1" in summary


def test_play_by_play_en_echec_le_match_nest_pas_enregistre(env):
    env["pbp_fail"] = {"G1"}
    client, ok, _ = run(env)
    assert ok is False and client.writes() == []


def test_play_by_play_vide_le_match_nest_pas_enregistre(env):
    env["pbp_empty"] = {"G1"}
    client, ok, _ = run(env)
    assert ok is False and client.writes() == []


def test_box_score_en_echec_le_match_nest_pas_enregistre(env):
    env["box_fail"] = {"G1"}
    client, ok, _ = run(env)
    assert ok is False and client.writes() == []


def test_equipes_ambigues_le_match_est_saute(env):
    env["games"]["G1"]["teams"] = {HOME: "AAA vs. BBB"}
    client, ok, _ = run(env)
    assert ok is False and client.writes() == []


def test_deux_matchs_le_premier_incomplet_seul_le_second_est_ecrit(env):
    env["games"]["G2"] = {"game_date": "2026-10-11", "season": SEASON, "season_type": "Pre Season",
                          "teams": {HOME: "AAA vs. BBB", AWAY: "BBB @ AAA"}}
    env["period_fail"] = {"G1": {3: "none"}}
    client, ok, _ = run(env)
    assert ok is False
    matchs = client.writes("stats_matchs")[0][2]
    assert [m["game_id"] for m in matchs] == ["G2"]
    box = client.writes("stats_box_scores")[0][2]
    assert {r["game_id"] for r in box} == {"G2"}
    # le match sauté n'a pas fait avancer le compteur de matchs joués
    assert {r["games_played_season_avant"] for r in box} == {0}
    assert client.writes("stats_block_events", "delete")[0][2] == {"in": ("game_id", ["G2"])}


def test_matchs_joues_avant_compte_pour_les_matchs_complets(env):
    env["games"]["G2"] = {"game_date": "2026-10-11", "season": SEASON, "season_type": "Pre Season",
                          "teams": {HOME: "AAA vs. BBB", AWAY: "BBB @ AAA"}}
    client, ok, _ = run(env)
    assert ok is True
    by_game = {}
    for r in client.writes("stats_box_scores")[0][2]:
        by_game.setdefault(r["game_id"], set()).add(r["games_played_season_avant"])
    assert by_game == {"G1": {0}, "G2": {1}}


def test_minutes_to_float():
    assert rd.minutes_to_float("30:30") == 30.5
    assert rd.minutes_to_float("") == 0.0
    assert rd.minutes_to_float("12") == 12.0
