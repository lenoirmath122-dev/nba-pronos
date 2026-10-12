import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient, hasFilter, type Call, type Reply } from "@/lib/weeklyPopup/testSupabase";

let handler: (call: Call) => Reply = () => ({ data: [] });
let calls: Call[] = [];
const send = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: () => {
    const fake = fakeClient((call) => handler(call));
    calls = fake.calls;
    return fake.client;
  },
}));
vi.mock("@/lib/push/send", () => ({ sendPushToSubscriptions: (...args: unknown[]) => send(...args) }));

import { sendPushToAdmins } from "./admins";

beforeEach(() => {
  send.mockReset();
  calls = [];
});

describe("sendPushToAdmins", () => {
  it("filtre sur le rôle ADMIN et le statut ACTIVE, puis envoie", async () => {
    handler = (call) => {
      if (call.table === "users") return { data: [{ id: "a1" }, { id: "a2" }] };
      return { data: [{ id: "s1", user_id: "a1", endpoint: "e", p256dh_key: "p", auth_key: "k" }] };
    };
    send.mockResolvedValue({ deadSubscriptionIds: [] });
    const r = await sendPushToAdmins({ title: "t", body: "b" });
    expect(r).toEqual({ admins: 2, subscriptions: 1, dead: 0, ok: true });
    const users = calls.find((c) => c.table === "users")!;
    expect(hasFilter(users, "eq", "role", "ADMIN")).toBe(true);
    expect(hasFilter(users, "eq", "status", "ACTIVE")).toBe(true);
    expect(send).toHaveBeenCalledOnce();
  });

  it("aucun admin : aucun envoi", async () => {
    handler = () => ({ data: [] });
    expect(await sendPushToAdmins({ title: "t", body: "b" })).toEqual({ admins: 0, subscriptions: 0, dead: 0, ok: false });
    expect(send).not.toHaveBeenCalled();
  });

  it("aucun abonnement : aucun envoi", async () => {
    handler = (call) => (call.table === "users" ? { data: [{ id: "a1" }] } : { data: [] });
    const r = await sendPushToAdmins({ title: "t", body: "b" });
    expect(r.subscriptions).toBe(0);
    expect(r.ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("supprime les abonnements morts", async () => {
    handler = (call) =>
      call.table === "users"
        ? { data: [{ id: "a1" }] }
        : { data: [{ id: "s1", user_id: "a1", endpoint: "e", p256dh_key: "p", auth_key: "k" }] };
    send.mockResolvedValue({ deadSubscriptionIds: ["s1"] });
    const r = await sendPushToAdmins({ title: "t", body: "b" });
    expect(r.dead).toBe(1);
    const del = calls.find((c) => c.op === "delete")!;
    expect(del.table).toBe("push_subscriptions");
    expect(hasFilter(del, "in", "id", ["s1"])).toBe(true);
  });

  it("ne lève jamais", async () => {
    handler = () => ({ error: { message: "boom" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(sendPushToAdmins({ title: "t", body: "b" })).resolves.toEqual({
      admins: 0,
      subscriptions: 0,
      dead: 0,
      ok: false,
    });
  });
});
