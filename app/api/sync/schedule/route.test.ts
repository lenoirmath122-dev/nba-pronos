import { describe, it, expect, vi, beforeEach } from "vitest";

const syncSchedule = vi.fn();
const invalidate = vi.fn();
let authorized = true;

vi.mock("@/lib/sync/auth", () => ({ isAuthorizedSyncRequest: () => authorized }));
vi.mock("@/lib/sync/logging", () => ({ writeSyncLog: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/lib/sync/schedule", () => ({ syncSchedule: (d: unknown) => syncSchedule(d) }));
vi.mock("@/lib/cache/commonData", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/cache/commonData")>()),
  invalidateCommonData: (...tags: unknown[]) => invalidate(...tags),
}));

import { POST } from "./route";
import { COMMON_TAGS } from "@/lib/cache/commonData";

const req = () => new Request("http://localhost/api/sync/schedule", { method: "POST" });

beforeEach(() => {
  authorized = true;
  syncSchedule.mockReset();
  invalidate.mockReset();
  syncSchedule.mockResolvedValue({
    created: 1,
    updated: 0,
    skipped: [],
    ignoredNotDrawn: 0,
    dayMoved: [],
    unrecognizedStatuses: [],
    requestsRemaining: null,
  });
});

describe("POST /api/sync/schedule : invalidation du cache commun", () => {
  it("invalide matchs, séries et compétition après la synchro", async () => {
    expect((await POST(req())).status).toBe(200);
    expect(invalidate).toHaveBeenCalledWith(COMMON_TAGS.matches, COMMON_TAGS.series, COMMON_TAGS.competition);
  });

  it("invalide aussi en cas d'échec", async () => {
    syncSchedule.mockRejectedValue(new Error("boom"));
    expect((await POST(req())).status).toBe(502);
    expect(invalidate).toHaveBeenCalled();
  });

  it("n'invalide rien sans autorisation", async () => {
    authorized = false;
    expect((await POST(req())).status).toBe(401);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
