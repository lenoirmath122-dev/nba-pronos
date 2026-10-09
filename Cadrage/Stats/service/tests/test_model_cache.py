"""Tests de model_cache (bibliotheque standard uniquement, pas de supabase_context)."""

import random
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from model_cache import ModelCache, _max_bytes_from_env  # noqa: E402


class Counting:
    """Faux loader : compte les appels, renvoie un objet neuf par appel."""

    def __init__(self):
        self.calls = 0
        self._lock = threading.Lock()

    def __call__(self, path):
        with self._lock:
            self.calls += 1
        return object()


def make(max_bytes, sizes=None, loader=None):
    sizes = sizes or {}
    return ModelCache(
        max_bytes,
        loader=loader or Counting(),
        sizer=lambda p: sizes.get(str(p), 100),
    )


def test_hit_loads_once():
    loader = Counting()
    c = make(1000, loader=loader)
    a = c.get("a")
    assert c.get("a") is a
    s = c.stats()
    assert loader.calls == 1 and s["hits"] == 1 and s["misses"] == 1


def test_lru_eviction_keeps_recently_used():
    c = make(250)
    c.get("a"); c.get("b"); c.get("a"); c.get("c")
    s = c.stats()
    assert s["models"] == ["a", "c"]
    assert s["total_bytes"] <= 250 and s["evictions"] == 1


def test_oversize_returned_not_cached_nothing_evicted():
    loader = Counting()
    c = make(250, sizes={"big": 300}, loader=loader)
    c.get("a")
    c.get("big"); c.get("big")
    s = c.stats()
    assert loader.calls == 3  # a, big, big
    assert s["models"] == ["a"] and s["oversize"] == 2 and s["evictions"] == 0


def test_zero_disables_cache():
    loader = Counting()
    c = make(0, loader=loader)
    c.get("a"); c.get("a")
    assert loader.calls == 2 and c.stats()["entries"] == 0


def test_exception_propagates_and_is_not_cached():
    state = {"fail": True}

    def loader(path):
        if state["fail"]:
            raise FileNotFoundError(path)
        return "ok"

    c = make(1000, loader=loader)
    with pytest.raises(FileNotFoundError):
        c.get("a")
    assert c._inflight == {} and c.stats()["load_errors"] == 1
    state["fail"] = False
    assert c.get("a") == "ok"


def test_concurrent_gets_load_once():
    release = threading.Event()
    calls = []

    def loader(path):
        calls.append(path)
        assert release.wait(5)
        return object()

    c = make(1000, loader=loader)
    with ThreadPoolExecutor(20) as ex:
        futs = [ex.submit(c.get, "a") for _ in range(20)]
        while c.stats()["misses"] + c.stats()["waits"] < 20:
            pass
        release.set()
        results = [f.result(timeout=5) for f in futs]
    assert len(calls) == 1 and all(r is results[0] for r in results)


def test_loading_does_not_block_other_hits():
    release = threading.Event()

    def loader(path):
        if path == "slow":
            assert release.wait(5)
        return path

    c = make(1000, loader=loader)
    c.get("b")
    with ThreadPoolExecutor(2) as ex:
        slow = ex.submit(c.get, "slow")
        assert ex.submit(c.get, "b").result(timeout=2) == "b"
        release.set()
        assert slow.result(timeout=5) == "slow"


def test_concurrent_exception_reaches_all_waiters():
    release = threading.Event()

    def loader(path):
        assert release.wait(5)
        raise RuntimeError("boom")

    c = make(1000, loader=loader)
    with ThreadPoolExecutor(5) as ex:
        futs = [ex.submit(c.get, "a") for _ in range(5)]
        while c.stats()["misses"] + c.stats()["waits"] < 5:
            pass
        release.set()
        for f in futs:
            with pytest.raises(RuntimeError):
                f.result(timeout=5)


def test_stress_invariants():
    c = make(350)
    keys = [f"k{i}" for i in range(10)]

    def work(seed):
        rnd = random.Random(seed)
        for _ in range(200):
            c.get(rnd.choice(keys))

    with ThreadPoolExecutor(8) as ex:
        list(ex.map(work, range(8)))
    s = c.stats()
    assert s["total_bytes"] <= 350
    assert s["total_bytes"] == 100 * s["entries"]


def test_max_bytes_from_env():
    assert _max_bytes_from_env({}) == 1_000_000_000
    assert _max_bytes_from_env({"MODEL_CACHE_MAX_BYTES": "0"}) == 0
    for bad in ("abc", "-1"):
        with pytest.raises(ValueError):
            _max_bytes_from_env({"MODEL_CACHE_MAX_BYTES": bad})


def test_supabase_context_has_no_direct_joblib_load():
    src = (Path(__file__).resolve().parent.parent / "supabase_context.py").read_text(encoding="utf-8")
    assert "joblib.load(" not in src


def test_real_joblib_roundtrip(tmp_path):
    joblib = pytest.importorskip("joblib")
    np = pytest.importorskip("numpy")
    p = tmp_path / "m.joblib"
    joblib.dump({"x": np.arange(10)}, p)
    c = ModelCache(10_000_000)
    got = c.get(p)
    assert (got["x"] == np.arange(10)).all()
    assert c.stats()["total_bytes"] == p.stat().st_size


def test_cached_random_forest_predicts_identically(tmp_path):
    joblib = pytest.importorskip("joblib")
    np = pytest.importorskip("numpy")
    ens = pytest.importorskip("sklearn.ensemble")
    rng = np.random.RandomState(0)
    X = rng.rand(200, 4)
    y = X[:, 0] * 3 + rng.rand(200)
    p = tmp_path / "rf.joblib"
    joblib.dump({"model": ens.RandomForestRegressor(n_estimators=10, random_state=0).fit(X, y)}, p)
    fresh = joblib.load(p)["model"].predict(X)
    c = ModelCache(100_000_000)
    before = joblib.hash(c.get(p))
    assert np.array_equal(c.get(p)["model"].predict(X), fresh)
    assert np.array_equal(c.get(p)["model"].predict(X), fresh)
    assert joblib.hash(c.get(p)) == before
