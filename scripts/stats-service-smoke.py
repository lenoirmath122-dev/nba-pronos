import json
import re
import sys
import time
import urllib.error
import urllib.request

# Lit le secret dans .env.local, ne l'affiche jamais.
env = {}
for line in open(r"C:\dev\nba-pronos\.env.local", encoding="utf-8"):
    m = re.match(r"\s*(STATS_SERVICE_URL|STATS_SERVICE_SECRET)\s*=\s*(.*)", line)
    if m:
        env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
base = env["STATS_SERVICE_URL"].rstrip("/")
H = {"Authorization": "Bearer " + env["STATS_SERVICE_SECRET"], "Content-Type": "application/json"}


def call(path, body=None):
    req = urllib.request.Request(base + path, data=json.dumps(body).encode() if body else None, headers=H)
    t = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, json.loads(r.read()), time.perf_counter() - t
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300], time.perf_counter() - t


def brief(s):
    return {k: s[k] for k in ("entries", "total_bytes", "hits", "misses", "waits", "evictions", "hit_rate", "rss_bytes", "load_seconds_total")}


n = int(sys.argv[1]) if len(sys.argv) > 1 else 20
st, s, _ = call("/cache-stats")
print("cache-stats avant:", st, brief(s) if st == 200 else s)
body = {"equipe_domicile": "Memphis Grizzlies", "equipe_exterieur": "Boston Celtics", "as_of_date": "2026-10-09", "seuil": 225.5, "comparison": "OVER"}
vals, times = [], []
r = None
for i in range(n):
    st, r, dt = call("/predict-total-points", body)
    if st != 200:
        print("erreur", st, r)
        break
    vals.append(r.get("proba", r.get("probabilite")))
    times.append(dt)
print("clés de la réponse:", sorted(r) if isinstance(r, dict) else r)
print("appels:", len(vals), "| valeurs distinctes:", sorted(set(vals)))
if len(times) > 1:
    print("latence 1er appel: %.2fs | médiane suivants: %.2fs" % (times[0], sorted(times[1:])[len(times[1:]) // 2]))
st, s, _ = call("/cache-stats")
print("cache-stats après:", st, brief(s) if st == 200 else s)
