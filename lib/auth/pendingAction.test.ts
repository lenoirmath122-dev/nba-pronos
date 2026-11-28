import { describe, it, expect } from "vitest";
import {
  funnelActionType,
  isSafeReturnUrl,
  parseChatDraft,
  parsePendingAction,
  resumeUrl,
  serializePendingAction,
  PENDING_ACTION_MAX_AGE_MS,
  type PendingAction,
} from "./pendingAction";

const NOW = 1_800_000_000_000;
const base: PendingAction = { type: "chat", returnUrl: "/chat", payload: { matchId: "abc" }, createdAt: NOW - 1000 };

describe("isSafeReturnUrl", () => {
  it("accepte un chemin interne", () => {
    expect(isSafeReturnUrl("/match/1?src=ig")).toBe(true);
  });
  it("refuse les URL absolues, les //host et les antislashs", () => {
    expect(isSafeReturnUrl("https://evil.test")).toBe(false);
    expect(isSafeReturnUrl("//evil.test")).toBe(false);
    expect(isSafeReturnUrl("/" + String.fromCharCode(92) + "evil.test")).toBe(false);
    expect(isSafeReturnUrl(42)).toBe(false);
  });
});

describe("parsePendingAction", () => {
  it("relit une action sérialisée", () => {
    expect(parsePendingAction(serializePendingAction(base), NOW)).toEqual(base);
  });
  it("rejette le JSON invalide, un type inconnu et une URL non sûre", () => {
    expect(parsePendingAction("{", NOW)).toBeNull();
    expect(parsePendingAction(null, NOW)).toBeNull();
    expect(parsePendingAction(JSON.stringify({ ...base, type: "hack" }), NOW)).toBeNull();
    expect(parsePendingAction(JSON.stringify({ ...base, returnUrl: "https://x.test" }), NOW)).toBeNull();
  });
  it("rejette une action trop ancienne ou datée du futur", () => {
    expect(parsePendingAction(JSON.stringify({ ...base, createdAt: NOW - PENDING_ACTION_MAX_AGE_MS - 1 }), NOW)).toBeNull();
    expect(parsePendingAction(JSON.stringify({ ...base, createdAt: NOW + 3_600_000 }), NOW)).toBeNull();
  });
  it("ne garde que les valeurs simples du payload", () => {
    const raw = JSON.stringify({ ...base, payload: { a: "x", b: { c: 1 }, d: 2 } });
    expect(parsePendingAction(raw, NOW)?.payload).toEqual({ a: "x", d: 2 });
  });
});

describe("resumeUrl", () => {
  it("ajoute le repère de reprise en gardant la requête", () => {
    expect(resumeUrl({ ...base, returnUrl: "/match/1?src=ig" })).toBe("/match/1?src=ig&reprise=chat");
  });
});

describe("parseChatDraft", () => {
  it("tronque et tolère l'absence", () => {
    expect(parseChatDraft(null)).toBe("");
    expect(parseChatDraft("x".repeat(5000))).toHaveLength(2000);
  });
});

describe("bracket invité", () => {
  it("reprise vers le bracket, comptée comme un prono dans le funnel", () => {
    const action: PendingAction = { type: "bracket", returnUrl: "/play/bracket", createdAt: NOW };
    expect(parsePendingAction(serializePendingAction(action), NOW)?.type).toBe("bracket");
    expect(resumeUrl(action)).toBe("/play/bracket?reprise=bracket");
    expect(funnelActionType("bracket")).toBe("predict");
    expect(funnelActionType("chat")).toBe("chat");
  });
});
