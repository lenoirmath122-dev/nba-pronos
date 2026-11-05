"""Stats de periode dans un combo (Lot 1 S4, fin) : probas sans base ni modeles."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

pytest.importorskip("scipy")
pytest.importorskip("sklearn")

import supabase_context as sc  # noqa: E402

HOME, AWAY = 1, 2


@pytest.fixture(autouse=True)
def _stub(monkeypatch):
    calls = []

    def fake_period(client, kind, period, team_id, opp, home, away, exact, seuil, comparison, d, season=None):
        calls.append((kind, period, team_id, seuil, comparison))
        return {"proba": {"QUARTERS_WON_COUNT": 0.07, "QUARTER_WINNER": 0.55, "HALF_WINNER": 0.6}[kind]}

    monkeypatch.setattr(sc, "_compute_period_proba_once", fake_period)
    monkeypatch.setattr(sc, "_compute_team_stat_proba_once", lambda *a, **k: {"proba": 0.4})
    return calls


def _cond(side, stat, seuil=None, comparison="OVER"):
    return {"kind": "TEAM", "equipe": side, "stats": [stat], "seuil": seuil, "comparison": comparison}


def test_quarts_remportes(_stub):
    p, meta = sc._condition_proba(None, _cond("exterieur", "qwon", 3), HOME, AWAY, "2026-12-04")
    assert p == pytest.approx(0.07)
    assert meta == {"kind": "TEAM", "team_id": AWAY, "stats": ["qwon"]}
    assert _stub[-1] == ("QUARTERS_WON_COUNT", None, AWAY, 3, "OVER")


def test_remporte_une_periode_et_son_contraire(_stub):
    assert sc._condition_proba(None, _cond("domicile", "win_q3"), HOME, AWAY, "d")[0] == pytest.approx(0.55)
    assert sc._condition_proba(None, _cond("domicile", "win_q3", comparison="UNDER"), HOME, AWAY, "d")[0] == pytest.approx(0.45)
    assert sc._condition_proba(None, _cond("domicile", "win_h1"), HOME, AWAY, "d")[0] == pytest.approx(0.6)
    assert _stub[-1][:2] == ("HALF_WINNER", "H1")


def test_combo_stat_match_entier_et_quarts():
    out = sc._compute_combo_proba_once(
        None, [[_cond("domicile", "fg3", 0.32)], [_cond("domicile", "qwon", 3)]], HOME, AWAY, "d"
    )
    assert out["proba"] == pytest.approx(0.4 * 0.07)


def test_combo_enchainement_de_quarts_sans_condition_match_entier():
    # « gagne Q1 et Q2, perd Q3, gagne Q4 » : que des periodes, aucun leg match entier.
    legs = [[_cond("domicile", s, comparison=c)] for s, c in
            [("win_q1", "OVER"), ("win_q2", "OVER"), ("win_q3", "UNDER"), ("win_q4", "OVER")]]
    out = sc._compute_combo_proba_once(None, legs, HOME, AWAY, "d")
    assert out["proba"] == pytest.approx(0.55 ** 3 * 0.45)
