"""Cache LRU des modeles .joblib, borne en OCTETS, chargement unique.

ATTENTION : l'objet renvoye par get()/load_model() est PARTAGE entre toutes
les requetes. Ne jamais le modifier (aucun appelant ne le fait aujourd'hui :
predict/predict_proba et lectures de cles uniquement).

Bibliotheque standard uniquement (joblib est importe dans le chargeur par
defaut) : le job CI `python-import` n'installe ni joblib ni sklearn.

MODEL_CACHE_MAX_BYTES=0 desactive le cache (un chargement par appel, comme
avant) -- coupe-circuit sans redeploiement de code.
"""

import json
import os
import threading
import time
from collections import OrderedDict
from concurrent.futures import Future

DEFAULT_MAX_BYTES = 1_000_000_000  # dimensionne pour un service a 2 Gi


def _log(event: str, **fields) -> None:
    # print + JSON plutot que logging : app.py ne configure aucun logger.
    # Toujours le nom de base du fichier, jamais de chemin.
    print(json.dumps({"severity": "INFO", "event": event, **fields}), flush=True)


def _default_loader(path):
    import joblib

    return joblib.load(path)


def _default_sizer(path) -> int:
    return os.stat(path).st_size


def _rss_bytes():
    try:
        with open("/proc/self/status", encoding="utf-8") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    return int(line.split()[1]) * 1024
    except OSError:
        pass
    return None


class ModelCache:
    def __init__(self, max_bytes: int, loader=None, sizer=None, size_factor: float = 1.0):
        if max_bytes < 0:
            raise ValueError("max_bytes doit etre >= 0")
        self.max_bytes = max_bytes
        self.size_factor = size_factor
        self._loader = loader or _default_loader
        self._sizer = sizer or _default_sizer
        self._lock = threading.Lock()
        self._entries: "OrderedDict[str, tuple[object, int]]" = OrderedDict()
        self._inflight: "dict[str, Future]" = {}
        self._total = 0
        self._hits = self._misses = self._waits = 0
        self._evictions = self._oversize = self._load_errors = 0
        self._load_seconds = 0.0
        self._warned_oversize: "set[str]" = set()

    def get(self, path):
        key = os.fspath(path)
        with self._lock:
            entry = self._entries.get(key)
            if entry is not None:
                self._entries.move_to_end(key)
                self._hits += 1
                return entry[0]
            fut = self._inflight.get(key)
            if fut is not None:
                self._waits += 1
                loader_thread = False
            else:
                fut = Future()
                self._inflight[key] = fut
                self._misses += 1
                loader_thread = True
        if not loader_thread:
            return fut.result()
        return self._load(key, path, fut)

    def _load(self, key, path, fut):
        name = os.path.basename(key)
        try:
            size = int(self._sizer(path) * self.size_factor)
            t0 = time.perf_counter()
            value = self._loader(path)
            elapsed = time.perf_counter() - t0
        except BaseException as exc:
            with self._lock:
                self._inflight.pop(key, None)
                self._load_errors += 1
            fut.set_exception(exc)
            raise
        evicted = []
        oversize = False
        with self._lock:
            self._inflight.pop(key, None)
            self._load_seconds += elapsed
            if size > self.max_bytes:
                self._oversize += 1
                oversize = key not in self._warned_oversize
                self._warned_oversize.add(key)
            else:
                self._entries[key] = (value, size)
                self._total += size
                while self._total > self.max_bytes and len(self._entries) > 1:
                    old_key, (_, old_size) = self._entries.popitem(last=False)
                    self._total -= old_size
                    self._evictions += 1
                    evicted.append(os.path.basename(old_key))
            total, entries = self._total, len(self._entries)
        fut.set_result(value)
        _log("model_cache_miss", model=name, bytes=size, load_ms=round(elapsed * 1000), total_bytes=total, entries=entries)
        for old in evicted:
            _log("model_cache_evict", model=old, total_bytes=total)
        if oversize:
            _log("model_cache_oversize", model=name, bytes=size, max_bytes=self.max_bytes)
        return value

    def stats(self) -> dict:
        with self._lock:
            lookups = self._hits + self._misses + self._waits
            return {
                "entries": len(self._entries),
                "total_bytes": self._total,
                "max_bytes": self.max_bytes,
                "size_factor": self.size_factor,
                "hits": self._hits,
                "misses": self._misses,
                "waits": self._waits,
                "evictions": self._evictions,
                "oversize": self._oversize,
                "load_errors": self._load_errors,
                "hit_rate": (self._hits / lookups) if lookups else None,
                "load_seconds_total": round(self._load_seconds, 3),
                "models": [os.path.basename(k) for k in self._entries],
                "rss_bytes": _rss_bytes(),
            }

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()
            self._total = 0


def _max_bytes_from_env(environ=os.environ) -> int:
    raw = environ.get("MODEL_CACHE_MAX_BYTES")
    if raw is None or raw == "":
        return DEFAULT_MAX_BYTES
    value = int(raw)  # ValueError si invalide : la revision ne demarre pas
    if value < 0:
        raise ValueError("MODEL_CACHE_MAX_BYTES doit etre >= 0")
    return value


def _size_factor_from_env(environ=os.environ) -> float:
    raw = environ.get("MODEL_CACHE_SIZE_FACTOR")
    return float(raw) if raw else 1.0


_DEFAULT = ModelCache(_max_bytes_from_env(), size_factor=_size_factor_from_env())
_log("model_cache_init", max_bytes=_DEFAULT.max_bytes)


def load_model(path):
    return _DEFAULT.get(path)


def cache_stats() -> dict:
    return _DEFAULT.stats()
