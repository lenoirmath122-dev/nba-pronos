"""Vainqueur du match dans un combo (Lot 1 S4) : probas sans base ni modeles."""

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
    # (moyenne, ecart-type) des points : domicile 115, exterieur 110, sigma 11
    monkeypatch.setattr(
        sc, "_team_stat_mean_scale",
        lambda client, stat, team_id, opp, is_home, d, season=None: (115.0, 11.0) if is_home else (110.0, 11.0),
    )


def _win(side, comparison="OVER"):
    return {"kind": "TEAM", "equipe": side, "stats": ["win"], "seuil": None, "comparison": comparison}


def _pts(side, seuil, comparison="OVER"):
    return {"kind": "TEAM", "equipe": side, "stats": ["pts"], "seuil": seuil, "comparison": comparison}


def _proba(conditions):
    return sc._compute_combo_proba_once(None, conditions, HOME, AWAY, "2026-12-04")["proba"]


def test_win_seul_domicile_exterieur_et_perd():
    assert _proba([[_win("domicile")]]) == pytest.approx(P_HOME_WIN)
    assert _proba([[_win("exterieur")]]) == pytest.approx(1 - P_HOME_WIN)
    assert _proba([[_win("domicile", "UNDER")]]) == pytest.approx(1 - P_HOME_WIN)


def test_win_meta_pour_le_stockage():
    p, meta = sc._condition_proba(None, _win("exterieur"), HOME, AWAY, "2026-12-04")
    assert meta == {"kind": "TEAM", "team_id": AWAY, "stats": ["win"]}
    assert p == pytest.approx(1 - P_HOME_WIN)


def test_victoire_et_beaucoup_de_points_plus_probable_que_l_independance():
    win, pts = _win("domicile"), _pts("domicile", 120)
    joint = _proba([[win], [pts]])
    p_pts = 1 - sc.norm.cdf(120, loc=115, scale=11)
    assert joint > P_HOME_WIN * p_pts
    assert joint < min(P_HOME_WIN, p_pts)


def test_victoire_et_peu_de_points_moins_probable_que_l_independance():
    win, pts = _win("domicile"), _pts("domicile", 105, "UNDER")
    joint = _proba([[win], [pts]])
    p_pts = sc.norm.cdf(105, loc=115, scale=11)
    assert joint < P_HOME_WIN * p_pts


def test_points_adverses_correlation_inverse():
    # Le domicile gagne ET l'exterieur marque 120+ : moins probable qu'en independance.
    joint = _proba([[_win("domicile")], [_pts("exterieur", 120)]])
    p_pts = 1 - sc.norm.cdf(120, loc=110, scale=11)
    assert joint < P_HOME_WIN * p_pts


def test_coherence_des_evenements_complementaires():
    # P(gagne ET pts>t) + P(gagne ET pts<t) = P(gagne)
    a = _proba([[_win("domicile")], [_pts("domicile", 112, "OVER")]])
    b = _proba([[_win("domicile")], [_pts("domicile", 112, "UNDER")]])
    assert a + b == pytest.approx(P_HOME_WIN, abs=1e-6)
    c = _proba([[_win("exterieur")], [_pts("domicile", 112, "OVER")]])
    d = _proba([[_win("exterieur")], [_pts("domicile", 112, "UNDER")]])
    assert c + d == pytest.approx(1 - P_HOME_WIN, abs=1e-6)


def test_win_avec_stat_non_pts_reste_independant(monkeypatch):
    other = {"kind": "TEAM", "equipe": "domicile", "stats": ["reb"], "seuil": 45, "comparison": "OVER"}
    monkeypatch.setattr(sc, "_team_stat_mean_scale", lambda *a, **k: (45.0, 6.0))
    assert _proba([[_win("domicile")], [other]]) == pytest.approx(P_HOME_WIN * 0.5, abs=1e-6)
