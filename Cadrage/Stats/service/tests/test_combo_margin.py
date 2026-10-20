"""Ecart final signe dans un combo (Lot 1 S3) : probas sans base ni modeles."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Memes dependances lourdes que supabase_context : ignore sans scipy/sklearn.
pytest.importorskip("scipy")
pytest.importorskip("sklearn")

import supabase_context as sc  # noqa: E402

HOME, AWAY = 1, 2
P_HOME_WIN = 0.60


@pytest.fixture(autouse=True)
def _stub_models(monkeypatch):
    monkeypatch.setattr(sc, "compute_home_win_proba", lambda *a, **k: {"p_home_win": P_HOME_WIN})
    monkeypatch.setattr(
        sc, "_team_stat_mean_scale",
        lambda client, stat, team_id, opp, is_home, d, season=None: (115.0, 11.0) if is_home else (110.0, 11.0),
    )


def _margin(side, seuil, comparison="OVER"):
    return {"kind": "TEAM", "equipe": side, "stats": ["margin"], "seuil": seuil, "comparison": comparison}


def _win(side, comparison="OVER"):
    return {"kind": "TEAM", "equipe": side, "stats": ["win"], "seuil": None, "comparison": comparison}


def _pts(side, seuil, comparison="OVER"):
    return {"kind": "TEAM", "equipe": side, "stats": ["pts"], "seuil": seuil, "comparison": comparison}


def _proba(conditions):
    return sc._compute_combo_proba_once(None, conditions, HOME, AWAY, "2026-12-04")["proba"]


def test_ecart_zero_equivaut_au_vainqueur():
    assert _proba([[_margin("domicile", 0)]]) == pytest.approx(P_HOME_WIN)
    assert _proba([[_margin("exterieur", 0)]]) == pytest.approx(1 - P_HOME_WIN)


def test_gagner_de_plus_est_moins_probable_et_decroit_avec_le_seuil():
    p0 = _proba([[_margin("domicile", 0)]])
    p5 = _proba([[_margin("domicile", 5)]])
    p15 = _proba([[_margin("domicile", 15)]])
    assert p0 > p5 > p15 > 0


def test_handicap_negatif_plus_probable_que_la_victoire():
    assert _proba([[_margin("domicile", -5.5)]]) > P_HOME_WIN


def test_symetrie_domicile_exterieur_et_complement():
    # M < -s pour l'exterieur qui gagne de plus de s == ecart exterieur > s
    p_away = _proba([[_margin("exterieur", 5)]])
    p_home_under = _proba([[_margin("domicile", -5, "UNDER")]])
    assert p_away == pytest.approx(p_home_under)
    over = _proba([[_margin("domicile", 5)]])
    under = _proba([[_margin("domicile", 5, "UNDER")]])
    assert over + under == pytest.approx(1.0)


def test_tranche_est_une_intersection_pas_un_produit():
    # gagne de 5 a 10 inclus : > 4 ET < 11
    a, b = _margin("domicile", 4), _margin("domicile", 11, "UNDER")
    tranche = _proba([[a], [b]])
    assert tranche == pytest.approx(_proba([[a]]) - _proba([[_margin("domicile", 11)]]))
    assert tranche < _proba([[a]]) * _proba([[b]])


def test_tranche_vide():
    assert _proba([[_margin("domicile", 10)], [_margin("domicile", 5, "UNDER")]]) == 0.0


def test_ecart_et_beaucoup_de_points_correles():
    m, pts = _margin("domicile", 5), _pts("domicile", 120)
    p_pts = 1 - sc.norm.cdf(120, loc=115, scale=11)
    joint = _proba([[m], [pts]])
    assert joint > _proba([[m]]) * p_pts
    assert joint < min(_proba([[m]]), p_pts)


def test_margin_meta_pour_le_stockage():
    p, meta = sc._condition_proba(None, _margin("exterieur", 3), HOME, AWAY, "2026-12-04")
    assert meta == {"kind": "TEAM", "team_id": AWAY, "stats": ["margin"]}
    assert 0 < p < 1 - P_HOME_WIN
