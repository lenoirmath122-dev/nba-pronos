// Test de checkAnonRateLimit() (p1-12, feuille de route Phase 1) -- même
// esprit que rateLimit.test.ts (vérifie le passage des paramètres à la
// RPC), mais fail-CLOSED en cas de panne (contrairement à checkRateLimit(),
// best-effort) et clé sur l'IP dérivée de x-forwarded-for plutôt que
// auth.uid().

import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkAnonRateLimit } from "./anonRateLimit";

const rpcMock = vi.fn();
const headersMock = vi.fn();

vi.mock("next/headers", () => ({ headers: () => headersMock() }));
vi.mock("@/lib/supabase/service", () => ({ getServiceClient: () => ({ rpc: rpcMock }) }));

function fakeHeaders(forwardedFor: string | null) {
  return { get: (name: string) => (name === "x-forwarded-for" ? forwardedFor : null) };
}

describe("checkAnonRateLimit", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    headersMock.mockReset();
  });

  it("appelle check_anon_rate_limit avec l'IP (1er segment de x-forwarded-for) et renvoie true si la RPC renvoie true", async () => {
    headersMock.mockResolvedValue(fakeHeaders("203.0.113.7, 10.0.0.1"));
    rpcMock.mockResolvedValue({ data: true, error: null });

    const result = await checkAnonRateLimit("login", 10, 300);

    expect(result).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith("check_anon_rate_limit", {
      p_identifier: "203.0.113.7",
      p_action: "login",
      p_max_count: 10,
      p_window_seconds: 300,
    });
  });

  it("renvoie false si la RPC renvoie false (limite atteinte)", async () => {
    headersMock.mockResolvedValue(fakeHeaders("203.0.113.7"));
    rpcMock.mockResolvedValue({ data: false, error: null });

    expect(await checkAnonRateLimit("signup", 5, 3600)).toBe(false);
  });

  it("bloque (fail-closed) si la RPC échoue -- contrairement à checkRateLimit()", async () => {
    headersMock.mockResolvedValue(fakeHeaders("203.0.113.7"));
    rpcMock.mockResolvedValue({ data: null, error: { message: "panne" } });

    expect(await checkAnonRateLimit("login", 10, 300)).toBe(false);
  });

  it("bloque (fail-closed) si la RPC lève une exception", async () => {
    headersMock.mockResolvedValue(fakeHeaders("203.0.113.7"));
    rpcMock.mockRejectedValue(new Error("réseau"));

    expect(await checkAnonRateLimit("login", 10, 300)).toBe(false);
  });

  it("laisse passer si aucune IP n'est résolvable (hors Vercel, dev/test) -- jamais bloquant hors prod", async () => {
    headersMock.mockResolvedValue(fakeHeaders(null));

    expect(await checkAnonRateLimit("login", 10, 300)).toBe(true);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
