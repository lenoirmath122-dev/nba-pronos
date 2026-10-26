import { beforeEach, describe, expect, it, vi } from "vitest";
import { runWeeklyPopupEmail } from "./email";
import { fakeClient, type Call } from "./testSupabase";

const POPUP = {
  id: "p1",
  status: "PUBLISHED",
  content: { titre: "Le récap", champion: "En tête cette semaine", top: null, flop: null, refuse: null, cta: "À ce soir !" },
};

function handler(overrides: { popup?: unknown; users?: unknown[]; logged?: unknown[]; reserveError?: boolean } = {}) {
  return (call: Call) => {
    if (call.table === "weekly_popups") return { data: "popup" in overrides ? overrides.popup : POPUP };
    if (call.table === "users") return { data: overrides.users ?? [{ id: "u1", pseudo: "Max" }, { id: "u2", pseudo: "Léa" }] };
    if (call.table === "weekly_popup_email_log") {
      if (call.op === "select") return { data: overrides.logged ?? [] };
      if (call.op === "insert" && overrides.reserveError) return { error: { message: "duplicate", code: "23505" } };
    }
    return { data: null };
  };
}

beforeEach(() => {
  process.env.EMAIL_UNSUBSCRIBE_SECRET = "secret";
});

describe("runWeeklyPopupEmail", () => {
  it("aucune popup publiée à envoyer : rien", async () => {
    const { client } = fakeClient(handler({ popup: null }));
    const send = vi.fn();
    const r = await runWeeklyPopupEmail({}, { client, send, address: async () => "a@b.fr" });
    expect(r.skipped).toBe("aucune popup publiée à envoyer");
    expect(send).not.toHaveBeenCalled();
  });

  it("sélectionne la popup PUBLISHED dont l'envoi a été demandé", async () => {
    const { client, calls } = fakeClient(handler());
    await runWeeklyPopupEmail({}, { client, send: vi.fn().mockResolvedValue("m1"), address: async () => "a@b.fr" });
    const lookup = calls.find((c) => c.table === "weekly_popups");
    expect(lookup?.filters).toContainEqual(["eq", "status", "PUBLISHED"]);
    expect(lookup?.filters).toContainEqual(["not", "email_requested_at", ["is", null]]);
  });

  it("réserve puis envoie à chaque destinataire, avec la désinscription « results »", async () => {
    const { client, calls } = fakeClient(handler());
    const send = vi.fn().mockResolvedValue("m1");
    const r = await runWeeklyPopupEmail({}, { client, send, address: async (id) => `${id}@b.fr` });
    expect(r).toMatchObject({ popupId: "p1", candidates: 2, sent: 2, failed: 0 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0]).toMatchObject({ to: "u1@b.fr", subject: "Le récap" });
    expect(send.mock.calls[0][1]).toEqual({ userId: "u1", scope: "results" });
    const inserts = calls.filter((c) => c.table === "weekly_popup_email_log" && c.op === "insert");
    expect(inserts.map((c) => c.payload)).toEqual([
      { popup_id: "p1", user_id: "u1" },
      { popup_id: "p1", user_id: "u2" },
    ]);
  });

  it("destinataires : tous les comptes ACTIVE (préférence résultats ignorée), hors déjà servis", async () => {
    const { client, calls } = fakeClient(handler({ logged: [{ user_id: "u1" }] }));
    const send = vi.fn().mockResolvedValue("m1");
    await runWeeklyPopupEmail({}, { client, send, address: async () => "a@b.fr" });
    const users = calls.find((c) => c.table === "users");
    expect(users?.filters).toContainEqual(["eq", "status", "ACTIVE"]);
    expect(users?.filters.some((f) => f[1] === "email_results_enabled")).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1]).toEqual({ userId: "u2", scope: "results" });
  });

  it("réservation refusée (déjà servi par un autre passage) : pas d'envoi", async () => {
    const { client } = fakeClient(handler({ reserveError: true }));
    const send = vi.fn();
    const r = await runWeeklyPopupEmail({}, { client, send, address: async () => "a@b.fr" });
    expect(send).not.toHaveBeenCalled();
    expect(r.sent).toBe(0);
  });

  it("envoi en échec : la réservation est supprimée pour que le passage suivant réessaie", async () => {
    const { client, calls } = fakeClient(handler({ users: [{ id: "u1", pseudo: "Max" }] }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const send = vi.fn().mockRejectedValue(new Error("Resend 500"));
    const r = await runWeeklyPopupEmail({}, { client, send, address: async () => "a@b.fr" });
    expect(r).toMatchObject({ sent: 0, failed: 1 });
    expect(calls.some((c) => c.table === "weekly_popup_email_log" && c.op === "delete")).toBe(true);
  });

  it("dry-run : ni réservation ni envoi, aperçu du sujet", async () => {
    const { client, calls } = fakeClient(handler());
    const send = vi.fn();
    const r = await runWeeklyPopupEmail({ dryRun: true }, { client, send, address: async () => "a@b.fr" });
    expect(r).toMatchObject({ dryRun: true, sent: 2, preview: ["Le récap", "Le récap"] });
    expect(send).not.toHaveBeenCalled();
    expect(calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("s'arrête à l'échéance sans rien perdre", async () => {
    const { client } = fakeClient(handler());
    const send = vi.fn().mockResolvedValue("m1");
    const r = await runWeeklyPopupEmail({ deadlineMs: 0 }, { client, send, address: async () => "a@b.fr", now: () => 1 });
    expect(send).not.toHaveBeenCalled();
    expect(r).toMatchObject({ candidates: 2, sent: 0 });
  });
});
