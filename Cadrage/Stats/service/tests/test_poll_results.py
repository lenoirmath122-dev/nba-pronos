"""Tests du poller des résultats NBA. Aucun réseau : le fetch NBA, requests.post et le
serveur de métadonnées sont remplacés. La capture ScoreboardV3 vient d'un vrai appel
depuis la VM (07/10/2026) ; sa version réduite est aussi lue par le test TypeScript
lib/sync/resultsNba.test.ts (contrat Python <-> zod)."""

import datetime as dt
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

SERVICE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVICE_DIR))

import poll_results as poll  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures"
RAW = json.loads((FIXTURES / "scoreboardv3_raw.json").read_text(encoding="utf-8"))
REDUCED = json.loads((FIXTURES / "scoreboardv3_reduced.json").read_text(encoding="utf-8"))
UTC = dt.timezone.utc


class FakeResponse:
    def __init__(self, status=200, body=None):
        self.status_code, self._body = status, body if body is not None else {"changed": 0, "unchanged": 1, "unmapped": 0, "skipped": []}
        self.ok = 200 <= status < 300
        self.text = json.dumps(self._body)

    def json(self):
        return self._body


@pytest.fixture
def wiring(monkeypatch):
    calls = {"post": [], "fetch": []}
    monkeypatch.setenv("SYNC_SECRET", "secret-de-test")
    monkeypatch.setenv("APP_URL", "https://exemple.test")
    monkeypatch.delenv("RESULTS_POLL_DRYRUN", raising=False)
    calls["games"] = {"2026-10-07": [RAW]}
    calls["response"] = FakeResponse()

    def fetch(date, timeout=10):
        calls["fetch"].append(date)
        value = calls["games"].get(date, [])
        if isinstance(value, Exception):
            raise value
        return value

    def post(url, **kw):
        calls["post"].append((url, kw))
        outcome = calls["response"]
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    monkeypatch.setattr(poll, "fetch_scoreboard", fetch)
    monkeypatch.setattr(poll.requests, "post", post)
    return calls


# ------------------------------------------------------------------ reduce_game


def test_reduce_game_sur_la_capture_reelle_donne_exactement_la_fixture_reduite():
    assert poll.reduce_game(RAW) == REDUCED


def test_reduce_game_ne_garde_ni_leaders_ni_diffuseurs():
    reduced = poll.reduce_game(RAW)
    assert "gameLeaders" not in reduced and "broadcasters" not in reduced
    assert set(reduced["homeTeam"]) == {"teamTricode", "score", "periods"}
    assert len(json.dumps(reduced)) < len(json.dumps(RAW)) / 3


@pytest.mark.parametrize(
    "mutate",
    [
        lambda g: g["homeTeam"].update(teamTricode=""),  # équipe « TBD » à tricode vide
        lambda g: g["homeTeam"].update(teamTricode="tbd"),
        lambda g: g["awayTeam"].update(score=None),
        lambda g: g["awayTeam"].update(score=-1),
        lambda g: g["awayTeam"].update(score=True),
        lambda g: g.update(gameStatus=4),
        lambda g: g.update(gameStatus="3"),
        lambda g: g.update(gameId="12600029"),
        lambda g: g.update(gameTimeUTC="2026-10-07 23:00:00"),
        lambda g: g.update(period=21),
        lambda g: g["homeTeam"].update(periods=[{"period": 0, "periodType": "REGULAR", "score": 1}]),
        lambda g: g["homeTeam"].update(periods=[{"period": i, "score": 1} for i in range(1, 22)]),
        lambda g: g.pop("homeTeam"),
    ],
)
def test_reduce_game_ecarte_un_match_que_la_route_rejetterait(mutate):
    game = json.loads(json.dumps(RAW))
    mutate(game)
    assert poll.reduce_game(game) is None


def test_reduce_game_accepte_un_match_a_venir_sans_periodes():
    game = json.loads(json.dumps(RAW))
    game.update(gameStatus=1, gameStatusText="7:00 pm ET", period=0)
    for side in ("homeTeam", "awayTeam"):
        game[side].update(score=0, periods=[])
    assert poll.reduce_game(game)["gameStatus"] == 1


# --------------------------------------------------------------------- dates NY


def test_ny_dates_avant_6h_ny_inclut_la_veille():
    # 05:59 EDT = 09:59Z
    assert poll.ny_dates(dt.datetime(2026, 10, 8, 9, 59, tzinfo=UTC)) == ["2026-10-07", "2026-10-08"]


def test_ny_dates_a_6h_ny_jour_seul():
    assert poll.ny_dates(dt.datetime(2026, 10, 8, 10, 0, tzinfo=UTC)) == ["2026-10-08"]


def test_ny_dates_jour_de_bascule_dst():
    # 07/11/2026 : fin de l'heure d'été US le 01/11 ; 05:59 EST = 10:59Z le 02/11
    assert poll.ny_dates(dt.datetime(2026, 11, 2, 10, 59, tzinfo=UTC)) == ["2026-11-01", "2026-11-02"]
    # 08/03/2026 : début de l'heure d'été ; 05:59 EDT = 09:59Z
    assert poll.ny_dates(dt.datetime(2026, 3, 8, 9, 59, tzinfo=UTC)) == ["2026-03-07", "2026-03-08"]


def test_backup_dates_deux_jours_ny_precedents_et_le_jour():
    assert poll.backup_dates(dt.datetime(2026, 10, 8, 10, 0, tzinfo=UTC)) == ["2026-10-06", "2026-10-07", "2026-10-08"]


# ----------------------------------------------------------------------- dryRun


@pytest.mark.parametrize(
    "value, expected",
    [(None, True), ("", True), ("1", True), ("garbage", True), ("0", False), ("false", False), (" FALSE ", False), ("False", False)],
)
def test_resolve_dry_run_defaut_sur(value, expected):
    assert poll.resolve_dry_run(value) is expected


def test_flags_cli_l_emportent_sur_la_variable():
    assert poll.resolve_dry_run("0", cli_dry_run=True) is True
    assert poll.resolve_dry_run("1", cli_live=True) is False


# ------------------------------------------------------------------ run / POST


def test_post_mocke_url_entete_source_et_dryrun(wiring):
    assert poll.main(["--dates", "2026-10-07"]) == 0  # variable absente -> dryRun
    (url, kw), = wiring["post"]
    assert url == "https://exemple.test/api/sync/results-nba"
    assert kw["headers"] == {"Authorization": "Bearer secret-de-test"}
    assert kw["allow_redirects"] is False
    assert kw["json"] == {"source": "NBA_STATS_SCOREBOARDV3", "dryRun": True, "games": [REDUCED]}


def test_live_envoie_dryrun_false(wiring, monkeypatch):
    monkeypatch.setenv("RESULTS_POLL_DRYRUN", "0")
    assert poll.main(["--dates", "2026-10-07"]) == 0
    assert wiring["post"][0][1]["json"]["dryRun"] is False


def test_decoupe_par_paquets_de_30(wiring):
    wiring["games"]["2026-10-07"] = [dict(RAW, gameId=f"00126{i:05d}") for i in range(65)]
    assert poll.run(["2026-10-07"], dry_run=True) is True
    assert [len(kw["json"]["games"]) for _, kw in wiring["post"]] == [30, 30, 5]


def test_un_match_invalide_n_empeche_pas_les_autres(wiring):
    bad = json.loads(json.dumps(RAW))
    bad["gameId"] = "0012600099"
    bad["homeTeam"]["teamTricode"] = ""
    wiring["games"]["2026-10-07"] = [bad, RAW]
    assert poll.run(["2026-10-07"], dry_run=True) is True
    assert [g["gameId"] for g in wiring["post"][0][1]["json"]["games"]] == ["0012600029"]


def test_aucun_match_aucun_post_code_0(wiring):
    assert poll.main(["--dates", "2026-12-25"]) == 0
    assert wiring["post"] == []


def test_une_date_par_requete_et_regle_de_la_veille(wiring, monkeypatch):
    class FixedNow(dt.datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 10, 8, 4, 0, tzinfo=tz)  # 00:00 EDT

    monkeypatch.setattr(poll.dt, "datetime", FixedNow)
    assert poll.main([]) == 0
    assert wiring["fetch"] == ["2026-10-07", "2026-10-08"]


@pytest.mark.parametrize("status", [401, 502])
def test_post_http_en_erreur_code_1(wiring, status):
    wiring["response"] = FakeResponse(status, {"error": "x"})
    assert poll.run(["2026-10-07"], dry_run=True) is False


def test_erreur_reseau_au_post_code_1(wiring):
    wiring["response"] = poll.requests.ConnectionError("down")
    assert poll.run(["2026-10-07"], dry_run=True) is False


def test_echec_du_fetch_code_1_et_aucun_post(wiring):
    wiring["games"]["2026-10-07"] = TimeoutError("lent")
    assert poll.run(["2026-10-07"], dry_run=True) is False
    assert wiring["post"] == []


def test_un_fetch_en_echec_n_empeche_pas_la_date_suivante(wiring):
    wiring["games"]["2026-10-06"] = TimeoutError("lent")
    assert poll.run(["2026-10-06", "2026-10-07"], dry_run=True) is False
    assert len(wiring["post"]) == 1


def test_le_secret_n_apparait_jamais_dans_le_journal(wiring, capsys):
    wiring["response"] = poll.requests.ConnectionError("Bearer secret-de-test")
    poll.run(["2026-10-07"], dry_run=True)
    poll.main(["--dates", "2026-10-07"])
    out = capsys.readouterr()
    assert "secret-de-test" not in out.out + out.err


def test_le_journal_resume_la_reponse_de_la_route(wiring, capsys):
    wiring["response"] = FakeResponse(200, {"changed": 1, "unchanged": 0, "unmapped": 4, "skipped": [], "dryRunDiffs": [{"gameId": "0012600030", "from": "FINISHED", "to": "FINISHED", "fields": ["quarter_scores"]}]})
    poll.run(["2026-10-07"], dry_run=True)
    out = capsys.readouterr().out
    assert "mode=dryRun" in out and "HTTP 200" in out and "changed=1" in out and "0012600030" in out and "quarter_scores" in out


# ------------------------------------------------- codes de sortie (0 / 75 / 1)


@pytest.mark.parametrize("status", [500, 502, 503, 408, 429])
def test_http_passager_code_75(wiring, status):
    wiring["response"] = FakeResponse(status, {"error": "x"})
    assert poll.main(["--dates", "2026-10-07"]) == 75


@pytest.mark.parametrize("status", [301, 307, 400, 401, 403, 413])
def test_http_durable_code_1(wiring, status):
    wiring["response"] = FakeResponse(status, {})
    assert poll.main(["--dates", "2026-10-07"]) == 1


def test_fetch_en_echec_et_erreur_reseau_au_post_code_75(wiring):
    wiring["games"]["2026-10-07"] = TimeoutError("lent")
    assert poll.main(["--dates", "2026-10-07"]) == 75
    wiring["games"]["2026-10-07"] = [RAW]
    wiring["response"] = poll.requests.ConnectionError("down")
    assert poll.main(["--dates", "2026-10-07"]) == 75


def test_secret_introuvable_code_1(wiring, monkeypatch):
    monkeypatch.delenv("SYNC_SECRET")
    monkeypatch.setattr(poll.requests, "get", lambda *a, **k: (_ for _ in ()).throw(poll.requests.ConnectionError("pas de métadonnées")))
    assert poll.main(["--dates", "2026-10-07"]) == 1


def test_le_pire_statut_l_emporte(wiring):
    wiring["games"]["2026-10-06"] = TimeoutError("lent")  # passager
    wiring["response"] = FakeResponse(401, {})  # durable, sur la date suivante
    assert poll.run_status(["2026-10-06", "2026-10-07"], dry_run=True) == (poll.FATAL, True)


# ----------------------------------------------- repli Highlightly (VM)


@pytest.fixture
def fallback(wiring, monkeypatch, tmp_path):
    monkeypatch.setenv("RESULTS_FALLBACK_STAMP", str(tmp_path / "hl.stamp"))
    monkeypatch.setenv("RESULTS_POLL_DRYRUN", "0")
    monkeypatch.setattr(poll, "ny_dates", lambda now: ["2026-10-07"])
    return tmp_path / "hl.stamp"


def test_repli_appele_quand_le_fetch_nba_echoue_en_reel(fallback, wiring):
    wiring["games"]["2026-10-07"] = TimeoutError("lent")
    assert poll.main([]) == 75
    (url, kw), = wiring["post"]
    assert url == "https://exemple.test/api/sync/results"
    assert kw["headers"] == {"Authorization": "Bearer secret-de-test"}
    assert kw["allow_redirects"] is False
    assert fallback.exists()


def test_repli_au_plus_une_fois_par_heure(fallback, wiring):
    wiring["games"]["2026-10-07"] = TimeoutError("lent")
    poll.main([])
    poll.main([])
    assert len(wiring["post"]) == 1
    old = fallback.stat().st_mtime - poll.HL_FALLBACK_INTERVAL_SECONDS - 1
    os.utime(fallback, (old, old))
    poll.main([])
    assert len(wiring["post"]) == 2


def test_repli_jamais_en_dryrun_ni_avec_dates_ni_si_le_fetch_reussit(fallback, wiring, monkeypatch):
    wiring["games"]["2026-10-07"] = TimeoutError("lent")
    monkeypatch.setenv("RESULTS_POLL_DRYRUN", "1")
    poll.main([])
    monkeypatch.setenv("RESULTS_POLL_DRYRUN", "0")
    poll.main(["--dates", "2026-10-07"])
    assert wiring["post"] == []
    wiring["games"]["2026-10-07"] = [RAW]
    wiring["response"] = FakeResponse(503, {})  # échec du POST NBA, pas du fetch
    poll.main([])
    assert [u for u, _ in wiring["post"]] == ["https://exemple.test/api/sync/results-nba"]


def test_repli_en_echec_ne_leve_pas_et_ne_boucle_pas(fallback, wiring):
    wiring["games"]["2026-10-07"] = TimeoutError("lent")
    wiring["response"] = poll.requests.ConnectionError("down")
    assert poll.main([]) == 75
    assert poll.main([]) == 75
    assert len(wiring["post"]) == 1  # l'horodatage est posé avant l'appel


# ---------------------------------------------------------------- load_sync_secret


def test_secret_de_l_environnement_d_abord(monkeypatch):
    monkeypatch.setenv("SYNC_SECRET", "depuis-env")
    assert poll.load_sync_secret() == "depuis-env"


def test_secret_via_metadonnees_et_secret_manager(monkeypatch):
    import base64

    monkeypatch.delenv("SYNC_SECRET", raising=False)
    seen = []

    class R:
        def __init__(self, payload=None, text=""):
            self._p, self.text = payload, text

        def json(self):
            return self._p

        def raise_for_status(self):
            pass

    def get(url, **kw):
        seen.append((url, kw))
        if url.endswith("/token"):
            return R({"access_token": "tok"})
        if url.endswith("/project-id"):
            return R(text="mon-projet\n")
        return R({"payload": {"data": base64.b64encode(b"le-secret").decode()}})

    monkeypatch.setattr(poll.requests, "get", get)
    assert poll.load_sync_secret() == "le-secret"
    assert seen[0][1]["headers"] == {"Metadata-Flavor": "Google"}
    assert seen[2][0] == "https://secretmanager.googleapis.com/v1/projects/mon-projet/secrets/nba-pronos-sync-secret/versions/latest:access"
    assert seen[2][1]["headers"] == {"Authorization": "Bearer tok"}


def test_secret_introuvable_code_1_sans_post(wiring, monkeypatch):
    monkeypatch.delenv("SYNC_SECRET")
    monkeypatch.setattr(poll.requests, "get", lambda *a, **k: (_ for _ in ()).throw(poll.requests.ConnectionError("pas de métadonnées")))
    assert poll.run(["2026-10-07"], dry_run=True) is False
    assert wiring["post"] == []


# ------------------------------------------------------------------------ import


def test_import_ne_charge_pas_pandas():
    """Démarrage Python lent sur e2-micro : le poller ne doit jamais tirer pandas."""
    code = f"import sys; sys.path.insert(0, {str(SERVICE_DIR)!r}); import poll_results; sys.exit(1 if 'pandas' in sys.modules else 0)"
    result = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr


@pytest.mark.parametrize("status", [301, 307, 308])
def test_une_redirection_n_est_pas_un_succes(wiring, status):
    wiring["response"] = FakeResponse(status, {})
    assert poll.run(["2026-10-07"], dry_run=True) is False


def test_reduce_game_rejette_un_saut_de_ligne_final_comme_zod():
    for field, value in (("gameId", "0012600029\n"), ("gameTimeUTC", "2026-10-07T23:00:00Z\n")):
        game = json.loads(json.dumps(RAW))
        game[field] = value
        assert poll.reduce_game(game) is None
    game = json.loads(json.dumps(RAW))
    game["homeTeam"]["teamTricode"] = "IND\n"
    assert poll.reduce_game(game) is None


def test_reduce_game_accepte_un_score_flottant_entier_mais_pas_fractionnaire():
    game = json.loads(json.dumps(RAW))
    game["homeTeam"]["score"] = 123.0
    assert poll.reduce_game(game)["homeTeam"]["score"] == 123
    game["homeTeam"]["score"] = 123.5
    assert poll.reduce_game(game) is None


def test_secret_manager_nettoie_le_saut_de_ligne_final(monkeypatch):
    import base64

    monkeypatch.delenv("SYNC_SECRET", raising=False)

    class R:
        text = "projet"

        def __init__(self, payload=None):
            self._p = payload

        def json(self):
            return self._p

        def raise_for_status(self):
            pass

    def get(url, **kw):
        if url.endswith("/token"):
            return R({"access_token": "tok"})
        if url.endswith("/project-id"):
            return R()
        return R({"payload": {"data": base64.b64encode(b"le-secret\n").decode()}})

    monkeypatch.setattr(poll.requests, "get", get)
    assert poll.load_sync_secret() == "le-secret"
