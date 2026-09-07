import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveReferenceDate } from "./devDateOverride";

describe("resolveReferenceDate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("honore le paramètre de date hors production", () => {
    vi.stubEnv("NODE_ENV", "test");
    const result = resolveReferenceDate("2026-04-15");
    expect(result.toISOString()).toBe("2026-04-15T12:00:00.000Z");
  });

  it("ignore le paramètre de date en production (GAPS_OUVERTS, Phase 0)", () => {
    vi.stubEnv("NODE_ENV", "production");
    const before = Date.now();
    const result = resolveReferenceDate("2026-04-15");
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });

  it("renvoie la date courante quand aucun paramètre n'est fourni", () => {
    vi.stubEnv("NODE_ENV", "test");
    const before = Date.now();
    const result = resolveReferenceDate(null);
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });
});
