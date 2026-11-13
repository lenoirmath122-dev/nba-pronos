"""Tests des feuilles de match statiques (box_scores.py) et de leur branchement dans le
poller. Aucun réseau : fetch NBA, Storage et Secret Manager sont remplacés.

La capture BoxScoreTraditionalV3 est SYNTHÉTIQUE (stats.nba.com n'est joignable que
depuis la VM) : même structure que celle lue par nba_api 1.11.4
(nba_api/stats/endpoints/_parsers/boxscoretraditionalv3.py), alignée sur le match
0012600029 de la capture ScoreboardV3 réelle (IND 123 - MIN 112). Le premier passage
en BOX_SCORES_PUBLISH=dry sur la VM sert de vérification contre une vraie réponse.
La version réduite est aussi lue par lib/boxScores/schema.test.ts (contrat Python <-> zod)."""

import copy
import datetime as dt
import json
import sys
from pathlib import Path

import pytest

SERVICE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVICE_DIR))

import box_scores as bs  # noqa: E402
import poll_results as poll  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures"
BOX = json.loads((FIXTURES / "boxscoretraditionalv3_synthetique.json").read_text(encoding="utf-8"))
SCOREBOARD = json.loads((FIXTURES / "scoreboardv3_raw.json").read_text(encoding="utf-8"))
REDUCED_FIXTURE = FIXTURES / "box_score_reduced.json"
NOW = dt.datetime(2026, 10, 8, 3, 0, tzinfo=dt.timezone.utc)
TODAY = dt.date(2026, 10, 8)


# ---------------------------------------------------------------------- réduction


def test_reduction_contrat_avec_l_appli():
    sheet = bs.reduce_box_score(BOX, "2026-10-07", "poll", {"IND": 123, "MIN": 112}, now=NOW)
    # Fixture partagée avec le test TypeScript : à régénérer exprès si le format change
    # (et SCHEMA_VERSION à monter si l'appli doit lire les deux formats).
    assert sheet == json.loads(REDUCED_FIXTURE.read_text(encoding="utf-8"))


def test_reduction_extérieur_puis_domicile_titulaires_d_abord_dnp_à_part():
    sheet = bs.reduce_box_score(BOX, "2026-10-07", "poll", now=NOW)
    away, home = sheet["teams"]
    assert (away["side"], away["tricode"], away["score"]) == ("away", "MIN", 112)
    assert (home["side"], home["tricode"], home["score"]) == ("home", "IND", 123)
    assert [p["starter"] for p in home["players"]][:5] == [True] * 5
    assert not any(p["starter"] for p in home["players"][5:])
    assert home["dnp"] == [{"name": "Prénom8 IND-Nom8", "reason": "DNP - Coach's Decision"}]
    assert all(p["min"] for p in home["players"])
    assert home["players"][0]["min"] == "34:12"
    assert home["totals"]["pts"] == 123 == sum(p["pts"] for p in home["players"])


@pytest.mark.parametrize(
    "raw,expected",
    [("34:12", "34:12"), ("34:12.00", "34:12"), ("PT34M12.00S", "34:12"), ("9:05", "9:05"), ("7", "7:00"),
     ("", None), ("0:00", None), ("PT00M00.00S", None), (None, None), ("n/a", None)],
)
def test_minutes(raw, expected):
    assert bs.normalize_minutes(raw) == expected


def test_score_différent_du_scoreboard_refusé():
    with pytest.raises(ValueError, match="scoreboard"):
        bs.reduce_box_score(BOX, "2026-10-07", "poll", {"IND": 125, "MIN": 112}, now=NOW)


def test_total_incohérent_refusé():
    broken = copy.deepcopy(BOX)
    broken["boxScoreTraditional"]["homeTeam"]["statistics"]["points"] = 130
    with pytest.raises(ValueError, match="incohérent"):
        bs.reduce_box_score(broken, "2026-10-07", "poll", now=NOW)


def test_box_score_vide_refusé():
    empty = copy.deepcopy(BOX)
    for player in empty["boxScoreTraditional"]["awayTeam"]["players"]:
        player["statistics"]["minutes"] = ""
    with pytest.raises(ValueError, match="aucun joueur"):
        bs.reduce_box_score(empty, "2026-10-07", "poll", now=NOW)


def test_chemin_tricodes_triés():
    assert bs.object_path("2026-10-07", "MIN", "IND") == "2026-10-07/IND-MIN.json"
    assert bs.object_path("2026-10-07", "IND", "MIN") == "2026-10-07/IND-MIN.json"


@pytest.mark.parametrize("value,mode", [(None, bs.OFF), ("", bs.OFF), ("0", bs.OFF), ("true", bs.OFF), ("1", bs.ON), (" DRY ", bs.DRY)])
def test_interrupteur(value, mode):
    assert bs.publish_mode(value) == mode


def test_candidats_matchs_terminés_seulement():
    live = copy.deepcopy(SCOREBOARD)
    live["gameId"], live["gameStatus"] = "0012600030", 2
    candidates = bs.finished_candidates("2026-10-07", [SCOREBOARD, live, {"gameStatus": 3}])
    assert candidates == [{"gameId": "0012600029", "date": "2026-10-07", "tricodes": ("IND", "MIN"), "scores": {"IND": 123, "MIN": 112}}]


# --------------------------------------------------------------------- publication


@pytest.fixture
def storage(monkeypatch, tmp_path):
    calls = {"fetch": [], "upload": [], "box": BOX}
    monkeypatch.setenv("BOX_SCORES_STATE", str(tmp_path / "state.json"))
    monkeypatch.setenv("SUPABASE_URL", "https://exemple.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "cle-de-test")

    def fetch(game_id, timeout=10):
        calls["fetch"].append(game_id)
        if isinstance(calls["box"], Exception):
            raise calls["box"]
        return calls["box"]

    class Resp:
        def __init__(self, status):
            self.status_code = status

    def post(url, **kw):
        calls["upload"].append((url, kw))
        return Resp(calls.get("upload_status", 200))

    monkeypatch.setattr(bs, "fetch_box_score", fetch)
    monkeypatch.setattr(bs.requests, "post", post)
    return calls


def candidates(date="2026-10-07"):
    return bs.finished_candidates(date, [SCOREBOARD])


def test_publie_une_seule_fois(storage):
    assert bs.publish(candidates(), bs.ON, today=TODAY)["published"] == 1
    url, kw = storage["upload"][0]
    assert url == "https://exemple.supabase.co/storage/v1/object/box-scores/2026-10-07/IND-MIN.json"
    assert kw["headers"]["x-upsert"] == "true" and kw["headers"]["Authorization"] == "Bearer cle-de-test"
    assert kw["allow_redirects"] is False
    assert json.loads(kw["data"])["gameId"] == "0012600029"
    # Passages suivants du poller : plus aucun appel NBA ni envoi.
    assert bs.publish(candidates(), bs.ON, today=TODAY)["published"] == 0
    assert len(storage["fetch"]) == 1 and len(storage["upload"]) == 1


def test_désactivé_par_défaut_aucun_appel(storage):
    assert bs.publish(candidates(), bs.OFF, today=TODAY) == {"published": 0, "failed": 0, "skipped": 0}
    assert storage["fetch"] == [] and storage["upload"] == []


def test_dry_vérifie_sans_envoyer_puis_1_publie(storage):
    assert bs.publish(candidates(), bs.DRY, today=TODAY)["published"] == 1
    assert storage["upload"] == []
    assert bs.publish(candidates(), bs.DRY, today=TODAY)["published"] == 0  # pas re-vérifié toutes les 2 min
    assert bs.publish(candidates(), bs.ON, today=TODAY)["published"] == 1  # le passage à 1 publie bien
    assert len(storage["upload"]) == 1


def test_box_score_pas_encore_final_réessayé_puis_abandonné(storage):
    storage["box"] = ValueError("IND : 120 pts au box score, 123 au scoreboard")
    for _ in range(bs.MAX_ATTEMPTS):
        assert bs.publish(candidates(), bs.ON, today=TODAY)["failed"] == 1
    assert bs.publish(candidates(), bs.ON, today=TODAY)["skipped"] == 1
    assert len(storage["fetch"]) == bs.MAX_ATTEMPTS
    # Le passage de 12h (réécriture) ignore le plafond d'essais.
    storage["box"] = BOX
    assert bs.publish(candidates(), bs.ON, rewrite=True, today=TODAY)["published"] == 1


def test_échec_storage_jamais_d_exception(storage, capsys):
    storage["upload_status"] = 401
    assert bs.publish(candidates(), bs.ON, today=TODAY)["failed"] == 1
    out = capsys.readouterr().out
    assert "RuntimeError" in out and "cle-de-test" not in out


def test_réécriture_une_fois_le_lendemain(storage):
    bs.publish(candidates(), bs.ON, today=dt.date(2026, 10, 7))  # poller, le soir même
    # Refresh du jour même : pas encore de réécriture (jour NY pas terminé).
    assert bs.publish(candidates(), bs.ON, rewrite=True, today=dt.date(2026, 10, 7))["published"] == 0
    # Lendemain 12h : réécrit une fois avec la source « import », puis plus jamais.
    assert bs.publish(candidates(), bs.ON, rewrite=True, source="import", today=TODAY)["published"] == 1
    assert json.loads(storage["upload"][-1][1]["data"])["source"] == "import"
    assert bs.publish(candidates(), bs.ON, rewrite=True, today=TODAY)["published"] == 0
    assert len(storage["upload"]) == 2


def test_plafond_de_matchs_par_passage(storage):
    many = []
    for i in range(6):
        game = dict(candidates()[0])
        game["gameId"] = f"00126000{40 + i}"
        many.append(game)
    assert bs.publish(many, bs.ON, today=TODAY)["published"] == bs.POLL_MAX_GAMES


def test_état_purgé(storage, tmp_path):
    old = {"gameId": "0012500001", "date": "2026-09-01", "tricodes": ("IND", "MIN"), "scores": {}}
    bs.publish([old] + candidates(), bs.ON, today=TODAY)
    state = json.loads((tmp_path / "state.json").read_text(encoding="utf-8"))
    assert list(state) == ["0012600029"]


# --------------------------------------------------------------------- poller


def test_poller_publie_après_les_résultats(monkeypatch):
    order = []
    monkeypatch.setenv("BOX_SCORES_PUBLISH", "1")

    def fake_run_status(dates, dry_run, finished_sink=None):
        order.append("résultats")
        finished_sink.extend(bs.finished_candidates(dates[0], [SCOREBOARD]))
        return poll.OK, []

    def fake_publish(found, mode, **kw):
        order.append(("feuilles", [g["gameId"] for g in found], mode))
        return {}

    monkeypatch.setattr(poll, "run_status", fake_run_status)
    monkeypatch.setattr(poll.bs, "publish", fake_publish)
    assert poll.main([]) == 0
    assert order == ["résultats", ("feuilles", ["0012600029"], bs.ON)]


def test_poller_essai_à_la_main_ne_publie_pas(monkeypatch):
    called = []
    monkeypatch.setattr(poll, "run_status", lambda dates, dry_run, finished_sink=None: (poll.OK, []))
    monkeypatch.setattr(poll.bs, "publish", lambda *a, **k: called.append(a))
    assert poll.main(["--dates", "2026-10-07"]) == 0
    assert called == []


def test_échec_des_feuilles_ne_change_pas_le_code_de_sortie(monkeypatch, capsys):
    monkeypatch.setenv("BOX_SCORES_PUBLISH", "1")

    def fake_run_status(dates, dry_run, finished_sink=None):
        finished_sink.extend(bs.finished_candidates(dates[0], [SCOREBOARD]))
        return poll.OK, []

    def broken_state():
        raise OSError("disque")

    monkeypatch.setattr(poll, "run_status", fake_run_status)
    monkeypatch.setattr(poll.bs, "load_state", broken_state)
    assert poll.main([]) == 0
    assert "[box-scores] échec ignoré (OSError)" in capsys.readouterr().out


def test_run_status_relève_les_matchs_terminés_même_si_le_post_échoue(monkeypatch):
    monkeypatch.setenv("SYNC_SECRET", "secret-de-test")
    monkeypatch.setattr(poll, "fetch_scoreboard", lambda date, timeout=10: [SCOREBOARD])

    def failing_post(*a, **k):
        raise poll.requests.ConnectionError("réseau")

    monkeypatch.setattr(poll.requests, "post", failing_post)
    sink = []
    status, _ = poll.run_status(["2026-10-07"], dry_run=False, finished_sink=sink)
    assert status == poll.TRANSIENT
    assert [g["gameId"] for g in sink] == ["0012600029"]
