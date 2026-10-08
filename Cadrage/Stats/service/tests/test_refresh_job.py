"""Tests du point d'entrée de la VM : l'import puis la résolution des paris, avec
les bons codes de sortie. Aucun réseau (rd.run et requests.post sont remplacés)."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import poll_results as pr  # noqa: E402
import refresh_daily as rd  # noqa: E402
import refresh_job as job  # noqa: E402


class FakeResponse:
    def __init__(self, status):
        self.status_code, self.text, self.ok = status, "{}", 200 <= status < 300


@pytest.fixture
def wiring(monkeypatch):
    calls = {"post": [], "logs": [], "backup": [], "order": []}
    monkeypatch.delenv("RESULTS_POLL_DRYRUN", raising=False)

    # Le secours ne doit JAMAIS faire de réseau dans ces tests (le fetch nba_api ne
    # passe pas par le mock de requests.post) : pr.run est remplacé.
    def fake_backup(dates, dry_run):
        calls["order"].append("backup")
        calls["backup"].append((dates, dry_run))
        if isinstance(calls.get("backup_error"), BaseException):
            raise calls["backup_error"]
        return True

    monkeypatch.setattr(pr, "run", fake_backup)
    monkeypatch.setenv("SYNC_SECRET", "secret-de-test")
    monkeypatch.setenv("APP_URL", "https://exemple.test")
    monkeypatch.setattr(rd, "get_supabase_client", lambda: object())
    monkeypatch.setattr(rd, "write_sync_log", lambda client, success, summary: calls["logs"].append((success, summary)))
    monkeypatch.setattr(job.requests, "post", lambda url, **kw: calls["post"].append((url, kw)) or calls.get("response", FakeResponse(200)))
    return calls


def test_tout_va_bien(wiring, monkeypatch):
    monkeypatch.setattr(rd, "run", lambda *a, **k: None)
    assert job.main(["--season", "2026-27"]) == 0
    url, kw = wiring["post"][0]
    assert url == "https://exemple.test/api/resolve-bets"
    assert kw["headers"] == {"Authorization": "Bearer secret-de-test"}
    assert kw["allow_redirects"] is False


def test_import_incomplet_resout_quand_meme_mais_sort_en_erreur(wiring, monkeypatch):
    def incomplet(*a, **k):
        raise SystemExit(1)

    monkeypatch.setattr(rd, "run", incomplet)
    assert job.main(["--season", "2026-27"]) == 1
    assert len(wiring["post"]) == 1  # la résolution a bien eu lieu


def test_exception_pendant_limport_ne_resout_pas(wiring, monkeypatch):
    def plante(*a, **k):
        raise RuntimeError("boom")

    monkeypatch.setattr(rd, "run", plante)
    assert job.main(["--season", "2026-27"]) == 1
    assert wiring["post"] == []


def test_resolve_bets_http_500_sort_en_erreur_et_trace(wiring, monkeypatch):
    monkeypatch.setattr(rd, "run", lambda *a, **k: None)
    wiring["response"] = FakeResponse(500)
    assert job.main(["--season", "2026-27", "--trigger", "vm-manuel"]) == 1
    assert wiring["logs"] == [(False, "[vm-manuel] resolve-bets : HTTP 500")]


def test_secret_manquant(wiring, monkeypatch):
    monkeypatch.setattr(rd, "run", lambda *a, **k: None)
    monkeypatch.delenv("SYNC_SECRET")
    assert job.main(["--season", "2026-27"]) == 1
    assert wiring["post"] == []


def test_secours_lance_avant_l_import_avec_les_trois_derniers_jours_ny(wiring, monkeypatch):
    monkeypatch.setattr(rd, "run", lambda *a, **k: wiring["order"].append("import"))
    assert job.main(["--season", "2026-27"]) == 0
    assert wiring["order"] == ["backup", "import"]
    (dates, dry_run), = wiring["backup"]
    assert len(dates) == 3 and dates == sorted(dates)
    assert dry_run is True  # variable absente -> dryRun


def test_secours_respecte_la_variable_dryrun(wiring, monkeypatch):
    monkeypatch.setattr(rd, "run", lambda *a, **k: None)
    monkeypatch.setenv("RESULTS_POLL_DRYRUN", "0")
    job.main(["--season", "2026-27"])
    assert wiring["backup"][0][1] is False


def test_une_exception_du_secours_ne_change_rien(wiring, monkeypatch, capsys):
    ran = []
    monkeypatch.setattr(rd, "run", lambda *a, **k: ran.append("import"))
    wiring["backup_error"] = RuntimeError("secret-de-test dans le message")
    assert job.main(["--season", "2026-27"]) == 0
    assert ran == ["import"] and len(wiring["post"]) == 1  # import et résolution ont bien eu lieu
    out = capsys.readouterr().out
    assert "RuntimeError" in out and "secret-de-test" not in out


def test_le_secours_s_execute_meme_si_l_import_plante(wiring, monkeypatch):
    def plante(*a, **k):
        raise RuntimeError("boom")

    monkeypatch.setattr(rd, "run", plante)
    assert job.main(["--season", "2026-27"]) == 1
    assert len(wiring["backup"]) == 1
