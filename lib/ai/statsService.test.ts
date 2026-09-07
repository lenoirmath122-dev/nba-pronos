// T-API-01 (audit/BACKLOG_TESTS.md §4, feuille de route p1-4) : le
// comportement "un fetch en échec (timeout, 500, réseau) vers
// STATS_SERVICE_URL fait basculer sur null (jamais d'exception qui
// remonterait)" avait été vérifié par lecture de code le 03/09/2026 --
// ce test le fige. Portée volontairement limitée à predictOverUnder()
// (chemin direct) et predictTotalPoints() (passe par le helper partagé
// callMatchTotalPredict()) : les ~8 autres predict*() de ce fichier
// suivent le MÊME patron try/catch/AbortSignal.timeout exact -- les
// re-tester un par un n'aurait rien attrapé de plus (même philosophie que
// le reste du dépôt : le plus critique/représentatif, pas l'exhaustivité).
// L'écriture d'is_calculable=false en base (structureAndScoreBet.ts,
// markNotCalculable()) reste hors périmètre ici : orchestration bien plus
// lourde à mocker (RPC Supabase), déjà protégée par son propre try/catch
// englobant (voir le commentaire à la fin de structureAndScoreBet.ts).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { predictOverUnder, predictTotalPoints } from "./statsService";

const ORIGINAL_URL = process.env.STATS_SERVICE_URL;

beforeEach(() => {
  process.env.STATS_SERVICE_URL = "https://stats.example.test";
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_URL === undefined) delete process.env.STATS_SERVICE_URL;
  else process.env.STATS_SERVICE_URL = ORIGINAL_URL;
});

describe("predictOverUnder — jamais d'exception qui remonte en cas de panne", () => {
  it("STATS_SERVICE_URL absent -> null immédiatement, aucun fetch tenté", async () => {
    delete process.env.STATS_SERVICE_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await predictOverUnder("LeBron James", "pts", 25, "OVER");
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("erreur réseau (fetch rejette) -> null, pas d'exception propagée", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(predictOverUnder("LeBron James", "pts", 25, "OVER")).resolves.toBeNull();
  });

  it("timeout (AbortSignal, DOMException) -> null, pas d'exception propagée", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("The operation was aborted", "TimeoutError")),
    );

    await expect(predictOverUnder("LeBron James", "pts", 25, "OVER")).resolves.toBeNull();
  });

  it("réponse HTTP non-ok (500) -> null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));

    await expect(predictOverUnder("LeBron James", "pts", 25, "OVER")).resolves.toBeNull();
  });

  it("réponse HTTP ok mais corps malformé (proba absente) -> null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ label: "?", detail: "?" }) }),
    );

    await expect(predictOverUnder("LeBron James", "pts", 25, "OVER")).resolves.toBeNull();
  });

  it("chemin nominal OVER -> renvoie proba/label/detail/playerId tels quels", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ proba: 0.62, label: "probable", detail: "sur les 10 derniers matchs", joueur_id: 2544 }),
      }),
    );

    await expect(predictOverUnder("LeBron James", "pts", 25, "OVER")).resolves.toEqual({
      proba: 0.62,
      label: "probable",
      detail: "sur les 10 derniers matchs",
      playerId: 2544,
    });
  });

  it("chemin nominal UNDER -> proba inversée (1 - proba) côté TypeScript", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ proba: 0.62, label: "probable", detail: "?", joueur_id: null }),
      }),
    );

    const result = await predictOverUnder("LeBron James", "pts", 25, "UNDER");
    expect(result?.proba).toBeCloseTo(0.38);
  });
});

describe("predictTotalPoints — même contrat de panne via le helper partagé callMatchTotalPredict", () => {
  it("erreur réseau -> null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(predictTotalPoints("Lakers", "Celtics", 220, "OVER", "2026-03-15")).resolves.toBeNull();
  });

  it("chemin nominal -> proba/label transmis tels quels (inversion OVER/UNDER faite côté service, jamais ici)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ proba: 0.55, label: "serré" }) }),
    );

    await expect(predictTotalPoints("Lakers", "Celtics", 220, "UNDER", "2026-03-15")).resolves.toEqual({
      proba: 0.55,
      label: "serré",
    });
  });
});
