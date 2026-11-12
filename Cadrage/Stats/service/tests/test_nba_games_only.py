"""Bilan des probas du 12/11/2026 : presaison/All-Star exclus des lectures stats_box_scores."""

import sys
from fnmatch import fnmatch
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

pytest.importorskip("scipy")
pytest.importorskip("sklearn")

import supabase_context as sc  # noqa: E402


class _Query:
    """Faux constructeur PostgREST qui applique vraiment les filtres not.like."""

    def __init__(self, rows):
        self.rows = rows
        self.filters = []

    def select(self, *a, **k): return self
    def eq(self, column, value):
        self.rows = [r for r in self.rows if r.get(column) == value]
        return self
    def lt(self, *a, **k): return self
    def order(self, *a, **k): return self
    def limit(self, n): self.rows = self.rows[:n]; return self

    def filter(self, column, operator, criteria):
        self.filters.append((column, operator, criteria))
        assert operator == "not.like"
        self.rows = [r for r in self.rows if not fnmatch(r[column], criteria)]
        return self

    def execute(self): return type("R", (), {"data": self.rows})()


class _Client:
    def __init__(self, rows): self.rows = rows
    def table(self, name): return _Query(list(self.rows))


def test_filtre_presaison_et_all_star():
    q = sc._nba_games_only(_Query([
        {"game_id": "0012600038"}, {"game_id": "0022600223"}, {"game_id": "0032600001"}, {"game_id": "0042600101"},
    ]))
    assert [r["game_id"] for r in q.rows] == ["0022600223", "0042600101"]
    assert q.filters == [("game_id", "not.like", "001*"), ("game_id", "not.like", "003*")]


def test_team_rotation_ignore_les_joueurs_de_presaison():
    rows = [{"player_id": 1, "team_id": 10, "game_id": f"00226{i:05d}", "game_date": "2026-11-01"} for i in range(3)]
    # Joueur de camp : beaucoup de matchs de presaison, aucun en saison reguliere.
    rows += [{"player_id": 99, "team_id": 10, "game_id": f"00126{i:05d}", "game_date": "2026-10-08"} for i in range(6)]
    assert sc._team_rotation(_Client(rows), 10, "2026-11-12") == [1]
