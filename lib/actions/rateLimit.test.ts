// Test de checkRateLimit() (SEC-001 de l'audit du 03/09/2026, item A2) --
// vérifie le passage des paramètres à la RPC et le comportement "laisse
// passer" en cas de panne du mécanisme lui-même (jamais bloquant pour une
// raison indépendante du joueur).

import { describe, it, expect, vi } from "vitest";
import { checkRateLimit } from "./rateLimit";

function fakeSupabase(rpcImpl: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>) {
  return { rpc: vi.fn(rpcImpl) } as unknown as Parameters<typeof checkRateLimit>[0];
}

describe("checkRateLimit", () => {
  it("appelle check_rate_limit avec les bons paramètres et renvoie true si la RPC renvoie true", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const supabase = { rpc } as unknown as Parameters<typeof checkRateLimit>[0];

    const result = await checkRateLimit(supabase, "chat_message", 8, 10);

    expect(result).toBe(true);
    expect(rpc).toHaveBeenCalledWith("check_rate_limit", {
      p_action: "chat_message",
      p_max_count: 8,
      p_window_seconds: 10,
    });
  });

  it("renvoie false si la RPC renvoie false (limite atteinte)", async () => {
    const supabase = fakeSupabase(async () => ({ data: false, error: null }));
    expect(await checkRateLimit(supabase, "bet_submit", 20, 60)).toBe(false);
  });

  it("laisse passer (true) si la RPC échoue -- jamais bloquant pour une panne du mécanisme", async () => {
    const supabase = fakeSupabase(async () => ({ data: null, error: { message: "fonction pas encore migrée" } }));
    expect(await checkRateLimit(supabase, "bug_report", 5, 3600)).toBe(true);
  });
});
