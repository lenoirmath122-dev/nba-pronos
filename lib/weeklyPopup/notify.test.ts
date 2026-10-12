import { describe, expect, it, vi } from "vitest";
import { draftPayload, notifyAdminsOfDraft } from "./notify";
import { fakeClient } from "./testSupabase";

describe("draftPayload", () => {
  it("brouillon prêt", () => {
    const p = draftPayload({ status: "READY", kind: "LLM", doubtCode: null, weekEnd: "2026-10-26" });
    expect(p.title).toBe("Popup hebdo prête à relire");
    expect(p.body).toContain("26/10");
    expect(p.url).toBe("/admin/popup");
  });
  it("texte de repli", () => {
    const p = draftPayload({ status: "READY", kind: "FALLBACK", doubtCode: null, weekEnd: "2026-10-26" });
    expect(p.body).toContain("repli");
  });
  it("douteux : motif français fixe", () => {
    const p = draftPayload({ status: "DOUBTFUL", kind: "LLM", doubtCode: "cap_reached", weekEnd: "2026-10-26" });
    expect(p.title).toBe("Popup hebdo bloquée : plafond de dépense atteint");
  });
});

describe("notifyAdminsOfDraft", () => {
  const info = { status: "READY" as const, kind: "LLM" as const, doubtCode: null, weekEnd: "2026-10-26" };

  it("réserve admin_notified_at (is null) puis envoie", async () => {
    const { client, calls } = fakeClient(() => ({ data: [{ id: "p1" }] }));
    const send = vi.fn().mockResolvedValue({ admins: 1, subscriptions: 1, dead: 0, ok: true });
    const r = await notifyAdminsOfDraft("p1", info, { client, send, now: () => 0 });
    expect(r.sent).toBe(true);
    expect(calls[0].filters).toContainEqual(["is", "admin_notified_at", null]);
    expect(send).toHaveBeenCalledOnce();
  });

  it("alerte non délivrée (aucun abonné) : le tampon est retiré pour ne pas perdre l'alerte", async () => {
    const { client, calls } = fakeClient(() => ({ data: [{ id: "p1" }] }));
    const send = vi.fn().mockResolvedValue({ admins: 1, subscriptions: 0, dead: 0, ok: false });
    const r = await notifyAdminsOfDraft("p1", info, { client, send, now: () => 0 });
    expect(r.sent).toBe(false);
    const reset = calls[calls.length - 1];
    expect(reset.op).toBe("update");
    expect(reset.payload).toEqual({ admin_notified_at: null });
  });

  it("déjà notifié : aucun envoi", async () => {
    const { client } = fakeClient(() => ({ data: [] }));
    const send = vi.fn();
    expect((await notifyAdminsOfDraft("p1", info, { client, send })).sent).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("ne lève pas si le push échoue", async () => {
    const { client } = fakeClient(() => ({ data: [{ id: "p1" }] }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const send = vi.fn().mockRejectedValue(new Error("push"));
    await expect(notifyAdminsOfDraft("p1", info, { client, send })).resolves.toEqual({ sent: false });
  });
});
