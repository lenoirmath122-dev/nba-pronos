import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient, hasFilter, type Call, type Reply } from "@/lib/weeklyPopup/testSupabase";
import { U1, U2 } from "@/lib/weeklyPopup/testFixtures";
import { makeToken } from "@/lib/weeklyPopup/tokens";
import type { WeeklyPopupRow } from "@/lib/weeklyPopup/types";

// Actions admin de la popup hebdo : session admin moquée, service_role faux
// (patron des tests du dépôt, plan §6 « service moqué »). On vérifie les
// gardes de statut, les contrôles de publication et le contenu des écritures.

let isAdmin = true;
let signedIn = true;
let handler: (call: Call) => Reply = () => ({ data: null });
let calls: Call[] = [];

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: "admin-1" } : null } }) },
    rpc: async () => ({ data: isAdmin }),
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { weekly_ranking: true } }) }) }),
      }),
    }),
  }),
}));
vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: () => fakeClient((call) => handler(call)).client,
}));
const audit = vi.fn();
vi.mock("@/lib/actions/audit", () => ({ logAdminAction: (...args: unknown[]) => audit(...args) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const runEmail = vi.fn().mockResolvedValue({});
const afterCallbacks: Array<() => unknown> = [];
vi.mock("next/server", () => ({ after: (callback: () => unknown) => afterCallbacks.push(callback) }));
vi.mock("@/lib/weeklyPopup/email", () => ({ runWeeklyPopupEmail: (...args: unknown[]) => runEmail(...args) }));
vi.mock("@/lib/weeklyPopup/ensure", () => ({ ensureWeeklyPopupDraft: vi.fn(), reserveRegeneration: vi.fn() }));
vi.mock("@/lib/weeklyPopup/generate", () => ({ runWeeklyPopupGeneration: vi.fn() }));
vi.mock("@/lib/weeklyPopup/notify", () => ({ doubtReason: (c: string | null) => c ?? "motif inconnu" }));

import {
  publishWeeklyPopup,
  retractWeeklyPopup,
  saveWeeklyPopupDraft,
  skipWeeklyPopup,
} from "./admin-weekly-popup";

const POPUP_ID = "popup-1";

function row(over: Partial<WeeklyPopupRow> = {}): WeeklyPopupRow {
  return {
    id: POPUP_ID,
    competition_id: "comp",
    week_end_date: "2026-10-26",
    kind: "LLM",
    status: "READY",
    doubt_code: null,
    doubt_detail: null,
    generation_id: null,
    generation_started_at: null,
    generation_count: 1,
    prompt_version: "v",
    candidates: [
      { short_id: "t1", bloc: "top", bet_id: "b1", user_id: U1, texte: "x", verdict: "ok" },
      { short_id: "f1", bloc: "flop", bet_id: "b2", user_id: U2, texte: "y", verdict: "ok" },
    ],
    generated_content: null,
    raw_output: "brut",
    content: {
      titre: "Semaine folle",
      champion: null,
      top: `${makeToken(U1)} a vu juste.`,
      flop: `${makeToken(U2)} a raté de peu.`,
      refuse: null,
      cta: "Reviens vite.",
    },
    warnings: [],
    attempts: [],
    featured_user_ids: [],
    admin_notified_at: null,
    published_at: null,
    published_by: null,
    created_at: "",
    updated_at: "",
    ...over,
  };
}

const usersReply = (over: Record<string, Record<string, unknown>> = {}) => [
  { id: U1, pseudo: "Nico", status: "ACTIVE", popup_mentions_opt_out: false, ...over[U1] },
  { id: U2, pseudo: "Alix", status: "ACTIVE", popup_mentions_opt_out: false, ...over[U2] },
];

/** Handler type : lit `current`, répond aux utilisateurs, enregistre les updates. */
function backend(current: WeeklyPopupRow | null, users = usersReply()) {
  const writes: Call[] = [];
  handler = (call) => {
    calls.push(call);
    if (call.table === "weekly_popups" && call.op === "select") return { data: current };
    if (call.table === "users") return { data: users };
    if (call.table === "weekly_popups" && (call.op === "update" || call.op === "insert")) {
      writes.push(call);
      return { data: { id: POPUP_ID, status: "PUBLISHED" } };
    }
    return { data: null };
  };
  return writes;
}

beforeEach(() => {
  isAdmin = true;
  signedIn = true;
  calls = [];
  audit.mockClear();
  runEmail.mockClear();
  afterCallbacks.length = 0;
});

describe("garde d'accès", () => {
  it("refuse sans session", async () => {
    signedIn = false;
    const writes = backend(row());
    expect(await publishWeeklyPopup(POPUP_ID)).toEqual({ success: false, error: "Tu dois être connecté." });
    expect(writes).toHaveLength(0);
  });

  it("refuse un non-admin, aucune lecture ni écriture", async () => {
    isAdmin = false;
    const writes = backend(row());
    expect(await saveWeeklyPopupDraft(POPUP_ID, { titre: "a", cta: "b" })).toMatchObject({ success: false });
    expect(await skipWeeklyPopup({ popupId: POPUP_ID })).toMatchObject({ success: false });
    expect(await retractWeeklyPopup(POPUP_ID)).toMatchObject({ success: false });
    expect(writes).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });
});

describe("publishWeeklyPopup", () => {
  it("publie : statut conditionnel, raw_output effacée, featured_user_ids posés", async () => {
    const writes = backend(row());
    const result = await publishWeeklyPopup(POPUP_ID);
    expect(result.success).toBe(true);
    expect(writes).toHaveLength(1);
    const payload = writes[0].payload as Record<string, unknown>;
    expect(payload).toMatchObject({ status: "PUBLISHED", raw_output: null, published_by: "admin-1" });
    expect((payload.featured_user_ids as string[]).sort()).toEqual([U1, U2].sort());
    expect(typeof payload.published_at).toBe("string");
    expect(typeof payload.email_requested_at).toBe("string");
    expect(hasFilter(writes[0], "eq", "status", "READY")).toBe(true);
    // L'e-mail part après la réponse, pas avant.
    expect(runEmail).not.toHaveBeenCalled();
    await afterCallbacks[0]();
    expect(runEmail).toHaveBeenCalledOnce();
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "WEEKLY_POPUP_PUBLISH" }));
  });

  it.each(["GENERATING", "PUBLISHED", "SKIPPED", "RETRACTED"] as const)("refuse un statut %s", async (status) => {
    const writes = backend(row({ status }));
    expect(await publishWeeklyPopup(POPUP_ID)).toMatchObject({ success: false });
    expect(writes).toHaveLength(0);
    expect(afterCallbacks).toHaveLength(0);
  });

  it("refuse un brouillon sans texte", async () => {
    const writes = backend(row({ status: "DOUBTFUL", content: null }));
    expect(await publishWeeklyPopup(POPUP_ID)).toMatchObject({ success: false });
    expect(writes).toHaveLength(0);
  });

  it("refuse la mention d'un joueur désengagé depuis la génération", async () => {
    const writes = backend(row(), usersReply({ [U1]: { popup_mentions_opt_out: true } }));
    const result = await publishWeeklyPopup(POPUP_ID);
    expect(result).toMatchObject({ success: false });
    expect(JSON.stringify(result)).toContain("mention_refusee");
    expect(writes).toHaveLength(0);
  });

  it("refuse un pseudo cité sans « @ »", async () => {
    const writes = backend(row({ content: { ...row().content!, top: "Nico a vu juste." } }));
    const result = await publishWeeklyPopup(POPUP_ID);
    expect(JSON.stringify(result)).toContain("pseudo_sans_arobase");
    expect(writes).toHaveLength(0);
  });

  it("signale un changement de statut concurrent (aucune ligne mise à jour)", async () => {
    const writes: Call[] = [];
    handler = (call) => {
      if (call.table === "weekly_popups" && call.op === "select") return { data: row() };
      if (call.table === "users") return { data: usersReply() };
      if (call.op === "update") {
        writes.push(call);
        return { data: null };
      }
      return { data: null };
    };
    const result = await publishWeeklyPopup(POPUP_ID);
    expect(result).toMatchObject({ success: false });
    expect(audit).not.toHaveBeenCalled();
  });
});

describe("saveWeeklyPopupDraft", () => {
  it("enregistre le texte retokenisé, même avec des erreurs (affichées)", async () => {
    const writes = backend(row());
    const result = await saveWeeklyPopupDraft(POPUP_ID, { titre: "", top: "@Nico a vu juste.", cta: "Go" });
    expect(result).toMatchObject({ success: true });
    expect(JSON.stringify(result)).toContain("champ_vide");
    const content = (writes[0].payload as { content: { top: string } }).content;
    expect(content.top).toBe(`${makeToken(U1)} a vu juste.`);
    expect(hasFilter(writes[0], "eq", "status", "READY")).toBe(true);
  });

  it("refuse l'enregistrement d'une popup publiée", async () => {
    const writes = backend(row({ status: "PUBLISHED" }));
    expect(await saveWeeklyPopupDraft(POPUP_ID, { titre: "a", cta: "b" })).toMatchObject({ success: false });
    expect(writes).toHaveLength(0);
  });
});

describe("skipWeeklyPopup", () => {
  it("écarte un brouillon READY", async () => {
    const writes = backend(row());
    expect(await skipWeeklyPopup({ popupId: POPUP_ID })).toMatchObject({ success: true });
    expect(writes[0].payload).toEqual({ status: "SKIPPED" });
    expect(hasFilter(writes[0], "eq", "status", "READY")).toBe(true);
  });

  it.each(["PUBLISHED", "RETRACTED", "GENERATING"] as const)("n'écarte pas un statut %s", async (status) => {
    const writes = backend(row({ status }));
    expect(await skipWeeklyPopup({ popupId: POPUP_ID })).toMatchObject({ success: false });
    expect(writes).toHaveLength(0);
  });

  it("crée la ligne SKIPPED d'une semaine sans popup", async () => {
    const writes: Call[] = [];
    handler = (call) => {
      if (call.table === "competitions") return { data: { id: "comp" } };
      if (call.table === "weekly_popups" && call.op === "select") return { data: null };
      if (call.table === "weekly_popups" && call.op === "insert") {
        writes.push(call);
        return { data: { id: "new-popup" } };
      }
      return { data: null };
    };
    expect(await skipWeeklyPopup({ weekEnd: "2026-10-26" })).toMatchObject({ success: true });
    expect(writes[0].payload).toMatchObject({
      competition_id: "comp",
      week_end_date: "2026-10-26",
      status: "SKIPPED",
    });
  });

  it("semaine non figée : la clé étrangère refuse, message clair", async () => {
    handler = (call) => {
      if (call.table === "competitions") return { data: { id: "comp" } };
      if (call.op === "insert") return { error: { message: "fk", code: "23503" } };
      return { data: null };
    };
    const result = await skipWeeklyPopup({ weekEnd: "2026-10-26" });
    expect(result).toMatchObject({ success: false });
    expect(JSON.stringify(result)).toContain("figée");
  });
});

describe("retractWeeklyPopup", () => {
  it("retire une popup publiée, update conditionnel sur PUBLISHED", async () => {
    const writes = backend(row({ status: "PUBLISHED" }));
    expect(await retractWeeklyPopup(POPUP_ID)).toMatchObject({ success: true });
    expect(writes[0].payload).toEqual({ status: "RETRACTED" });
    expect(hasFilter(writes[0], "eq", "status", "PUBLISHED")).toBe(true);
  });

  it("refuse tout autre statut", async () => {
    handler = (call) => {
      if (call.table === "weekly_popups" && call.op === "update") return { data: null };
      if (call.table === "weekly_popups" && call.op === "select") return { data: row({ status: "READY" }) };
      return { data: null };
    };
    const result = await retractWeeklyPopup(POPUP_ID);
    expect(result).toMatchObject({ success: false });
    expect(audit).not.toHaveBeenCalled();
  });
});
