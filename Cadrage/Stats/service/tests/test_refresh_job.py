"""Tests du point d'entrée de la VM : l'import puis la résolution des paris, avec
les bons codes de sortie. Aucun réseau (rd.run et requests.post sont remplacés)."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import refresh_daily as rd  # noqa: E402
import refresh_job as job  # noqa: E402


class FakeResponse:
    def __init__(self, status):
        self.status_code, self.text, self.ok = status, "{}", 200 <= status < 300


@pytest.fixture
def wiring(monkeypatch):
    calls = {"post": [], "logs": []}
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
