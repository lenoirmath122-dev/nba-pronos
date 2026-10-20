"""S2 : variance de la somme de stats d'un meme joueur, avec correlation observee."""

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

pytest.importorskip("scipy")
pytest.importorskip("sklearn")

import supabase_context as sc  # noqa: E402


class _Query:
    def __init__(self, rows):
        self.rows = rows

    def select(self, *a, **k): return self
    def eq(self, *a, **k): return self
    def lt(self, *a, **k): return self
    def order(self, *a, **k): return self
    def limit(self, n): self.rows = self.rows[:n]; return self
    def execute(self): return type("R", (), {"data": self.rows})()


class _Client:
    def __init__(self, rows): self.rows = rows
    def table(self, name): return _Query(list(self.rows))


def _rows(n, rho_sign=1):
    rng = np.random.default_rng(0)
    base = rng.normal(0, 1, n)
    return [
        {"pts": 20 + 5 * b, "reb": 8 + rho_sign * 2 * b, "ast": 5 + float(rng.normal(0, 1))}
        for b in base
    ]


def test_stats_correlees_positivement_augmentent_la_variance():
    var = sc._player_sum_variance(_Client(_rows(20)), 1, ["pts", "reb"], [5.0, 2.0])
    assert var > 5.0 ** 2 + 2.0 ** 2


def test_stats_correlees_negativement_reduisent_la_variance():
    var = sc._player_sum_variance(_Client(_rows(20, rho_sign=-1)), 1, ["pts", "reb"], [5.0, 2.0])
    assert var < 5.0 ** 2 + 2.0 ** 2


def test_peu_de_matchs_ou_une_seule_stat_ou_stat_inconnue_reste_independant():
    assert sc._player_sum_variance(_Client(_rows(5)), 1, ["pts", "reb"], [5.0, 2.0]) == pytest.approx(29.0)
    assert sc._player_sum_variance(_Client(_rows(20)), 1, ["pts"], [5.0]) == pytest.approx(25.0)
    assert sc._player_sum_variance(_Client(_rows(20)), 1, ["pts", "dreb"], [5.0, 2.0]) == pytest.approx(29.0)


def test_variance_jamais_negative():
    assert sc._player_sum_variance(_Client(_rows(20, rho_sign=-1)), 1, ["pts", "reb"], [5.0, 40.0]) >= 0.0
