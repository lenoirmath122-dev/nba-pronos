"""Combo : plusieurs bornes sur la MEME variable = intersection (tranche, "exactement N")."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

pytest.importorskip("scipy")
pytest.importorskip("sklearn")

import supabase_context as sc  # noqa: E402
from scipy.stats import norm  # noqa: E402

MEAN, SCALE = 20.0, 6.0


@pytest.fixture(autouse=True)
def _stub(monkeypatch):
    def fake_group(client, group, home, away, d, season=None):
        c = group[0]
        p_over = 1 - norm.cdf(c["seuil"], MEAN, SCALE)
        return (p_over if c["comparison"] == "OVER" else 1 - p_over), []

    monkeypatch.setattr(sc, "_condition_group_proba", fake_group)


def _cond(seuil, comparison, player="Tatum", stat="pts"):
    return {"kind": "PLAYER", "joueurs": [player], "stats": [stat], "seuil": seuil, "comparison": comparison, "equipe": None}


def _proba(conditions):
    return sc._compute_combo_proba_once(None, conditions, 1, 2, "2026-12-04")["proba"]


def test_exactement_n_est_une_intersection_pas_un_produit():
    p = _proba([[_cond(19.5, "OVER")], [_cond(20.5, "UNDER")]])
    assert p == pytest.approx(norm.cdf(20.5, MEAN, SCALE) - norm.cdf(19.5, MEAN, SCALE))
    assert p < 0.1  # le produit des deux marginales vaudrait ~0.27


def test_tranche_entre_deux_bornes():
    p = _proba([[_cond(10, "OVER")], [_cond(30, "UNDER")]])
    assert p == pytest.approx(norm.cdf(30, MEAN, SCALE) - norm.cdf(10, MEAN, SCALE))


def test_bornes_de_meme_sens_prennent_la_plus_stricte():
    p = _proba([[_cond(15, "OVER")], [_cond(25, "OVER")]])
    assert p == pytest.approx(1 - norm.cdf(25, MEAN, SCALE))


def test_variables_differentes_restent_independantes():
    a = _proba([[_cond(19.5, "OVER")]])
    b = _proba([[_cond(5.5, "OVER", stat="reb")]])
    assert _proba([[_cond(19.5, "OVER")], [_cond(5.5, "OVER", stat="reb")]]) == pytest.approx(a * b)


def test_tranche_vide():
    assert _proba([[_cond(30, "OVER")], [_cond(10, "UNDER")]]) == 0.0
