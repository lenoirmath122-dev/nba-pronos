import { describe, it, expect, vi, beforeEach } from "vitest";

const syncResults = vi.fn();
const invalidate = vi.fn();
let authorized = true;

vi.mock("next/server", async (importActual) => ({
  ...(await importActual<typeof import("next/server")>()),
  after: () => undefined,
}));
vi.mock("@/lib/sync/auth", () => ({ isAuthorizedSyncRequest: () => authorized }));
vi.mock("@/lib/sync/logging", () => ({ writeSyncLog: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/lib/sync/results", () => ({ syncResults: (d: unknown) => syncResults(d) }));
vi.mock("@/lib/ai/resolveCalculableBets", () => ({ resolveAllCalculableBets: vi.fn() }));
vi.mock("@/lib/cache/commonData", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/cache/commonData")>()),
  invalidateCommonData: (...tags: unknown[]) => invalidate(...tags),
}));

import { POST } from "./route";
import { COMMON_TAGS } from "@/lib/cache/commonData";

const req = () => new Request("http://localhost/api/sync/results", { method: "POST" });
const okResult = {
  changed: 1,
  unchanged: 0,
  skipped: [],
  notDrawn: 0,
  deferredToNba: 0,
  failedDates: [],
  unrecognizedStatuses: [],
  finishedNow: [],
  requestsRemaining: null,
};

beforeEach(() => {
  authorized = true;
  syncResults.mockReset();
  invalidate.mockReset();
  syncResults.mockResolvedValue(okResult);
});

describe("POST /api/sync/results : invalidation du cache commun", () => {
  it("invalide matchs et séries après la synchro", async () => {
    expect((await POST(req())).status).toBe(200);
    expect(invalidate).toHaveBeenCalledWith(COMMON_TAGS.matches, COMMON_TAGS.series);
  });

  it("invalide aussi en cas d'échec (écritures partielles possibles)", async () => {
    syncResults.mockRejectedValue(new Error("boom"));
    expect((await POST(req())).status).toBe(502);
    expect(invalidate).toHaveBeenCalledWith(COMMON_TAGS.matches, COMMON_TAGS.series);
  });

  it("n'invalide rien sans autorisation", async () => {
    authorized = false;
    expect((await POST(req())).status).toBe(401);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
