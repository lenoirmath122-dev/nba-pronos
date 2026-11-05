import { describe, it, expect, vi, beforeEach } from "vitest";

// Un compte qui passe PENDING -> ACTIVE entre au classement (ses pronos
// invités comptent) : le callback doit invalider le classement mis en cache.

const invalidate = vi.fn();
let activatedRows: unknown[] = [];

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: async () => ({
    auth: {
      verifyOtp: async () => ({ error: null }),
      getUser: async () => ({ data: { user: { id: "u1", user_metadata: {} } } }),
    },
  }),
}));
vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.update = () => ({ eq: () => ({ eq: () => ({ select: async () => ({ data: activatedRows }) }) }) });
      chain.maybeSingle = async () => ({ data: { status: "PENDING", age_confirmed_at: "2026-11-01T00:00:00Z" } });
      return chain;
    },
    auth: { admin: { updateUserById: vi.fn() } },
  }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/funnel/record", () => ({ insertFunnelEvent: vi.fn(), trackAccountCreated: vi.fn() }));
vi.mock("@/lib/cache/commonData", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/cache/commonData")>()),
  invalidateCommonData: (...tags: unknown[]) => invalidate(...tags),
}));

import { GET } from "./route";
import { COMMON_TAGS } from "@/lib/cache/commonData";
import { NextRequest } from "next/server";

const req = () => new NextRequest("http://localhost/auth/callback?token_hash=abc&type=email");

beforeEach(() => {
  invalidate.mockReset();
  activatedRows = [];
});

describe("GET /auth/callback : invalidation du classement", () => {
  it("invalide le classement quand le compte vient d'être activé", async () => {
    activatedRows = [{ id: "u1" }];
    await GET(req());
    expect(invalidate).toHaveBeenCalledWith(COMMON_TAGS.leaderboard);
  });

  it("n'invalide rien si aucun compte n'a été activé", async () => {
    activatedRows = [];
    await GET(req());
    expect(invalidate).not.toHaveBeenCalled();
  });
});
