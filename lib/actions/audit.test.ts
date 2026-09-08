// Test de logAdminAction() (p1-17, feuille de route Phase 1) -- vérifie que
// l'écriture reste best-effort (ne lève jamais) mais qu'un échec est bien
// remonté à Sentry en plus du console.error, pas seulement journalisé dans
// des logs serverless que personne ne surveille.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { logAdminAction } from "./audit";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import * as Sentry from "@sentry/nextjs";

function fakeSupabase(error: { message: string } | null) {
  return { from: () => ({ insert: () => Promise.resolve({ error }) }) } as unknown as Parameters<typeof logAdminAction>[0];
}

const baseInput = {
  actorUserId: "admin-1",
  action: "VALIDATE_BET",
  targetType: "bet",
  targetId: "bet-1",
};

describe("logAdminAction", () => {
  beforeEach(() => {
    vi.mocked(Sentry.captureException).mockReset();
  });

  it("n'appelle pas Sentry quand l'insert réussit", async () => {
    await logAdminAction(fakeSupabase(null), baseInput);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("remonte l'échec à Sentry sans lever, quand l'insert échoue", async () => {
    await expect(logAdminAction(fakeSupabase({ message: "panne" }), baseInput)).resolves.toBeUndefined();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    const [error, context] = vi.mocked(Sentry.captureException).mock.calls[0];
    expect((error as Error).message).toContain("panne");
    expect(context).toMatchObject({ extra: { targetId: "bet-1", action: "VALIDATE_BET" } });
  });
});
