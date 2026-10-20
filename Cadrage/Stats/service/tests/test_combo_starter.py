"""Titulaire ou remplacant dans un combo (Lot 1 S8) : probas sans base."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Memes dependances lourdes que supabase_context : ignore sans scipy/sklearn.
pytest.importorskip("scipy")
pytest.importorskip("sklearn")

import supabase_context as sc  # noqa: E402

HOME, AWAY, PLAYER = 1, 2, 77


class _Query:
    def __init__(self, rows):
        self._rows = rows

    def __getattr__(self, name):
        return lambda *a, **k: self

    def execute(self):
        class _R:
            data = self._rows

        return _R()


class _Client:
    def __init__(self, rows):
        self._rows = rows

    def table(self, name):
        return _Query(self._rows)


@pytest.fixture(autouse=True)
def _stubs(monkeypatch):
    monkeypatch.setattr(sc, "find_player", lambda client, name: (PLAYER, name))
    monkeypatch.setattr(sc, "_player_current_team_id", lambda client, pid: HOME)


def _cond(comparison="OVER"):
    return {"kind": "PLAYER", "joueurs": ["Tatum"], "stats": ["starter"], "seuil": None, "comparison": comparison}


def _rows(starts, bench):
    return [{"position": "F", "game_date": "2026-10-01"}] * starts + [{"position": "", "game_date": "2026-09-01"}] * bench


def _proba(rows, comparison="OVER"):
    return sc._condition_proba(_Client(rows), _cond(comparison), HOME, AWAY, "2026-12-04")


def test_titulaire_regulier_proche_de_un():
    p, meta = _proba(_rows(15, 0))
    assert 0.9 < p <= 0.98
    assert meta == {"kind": "PLAYER", "player_ids": [PLAYER], "stats": ["starter"]}


def test_remplacant_regulier_et_complement():
    over, _ = _proba(_rows(0, 15))
    under, _ = _proba(_rows(0, 15), "UNDER")
    assert over < 0.1
    assert over + under == pytest.approx(1.0)


def test_mi_temps_partage():
    p, _ = _proba(_rows(8, 7))
    assert p == pytest.approx(0.5, abs=0.05)


def test_trop_peu_d_historique():
    with pytest.raises(ValueError):
        _proba(_rows(1, 1))


def test_joueur_hors_du_match_donne_zero(monkeypatch):
    monkeypatch.setattr(sc, "_player_current_team_id", lambda client, pid: 999)
    p, _ = _proba(_rows(15, 0))
    assert p == 0.0
