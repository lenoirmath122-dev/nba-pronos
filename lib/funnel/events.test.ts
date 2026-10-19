import { describe, it, expect } from "vitest";
import { parseFunnelPayload } from "./events";

const base = { visitorId: "a1b2c3d4-e5f6-4789-a012-3456789abcde", event: "home_view" };

describe("parseFunnelPayload", () => {
  it("accepte un événement valide et réduit le référent à son hôte", () => {
    const p = parseFunnelPayload({ ...base, referrer: "https://l.instagram.com/?u=secret&x=1" });
    expect(p).toEqual({ visitorId: base.visitorId, event: "home_view", matchId: null, referrer: "l.instagram.com" });
  });

  it("rejette un événement inconnu, un visiteur invalide ou un corps non objet", () => {
    expect(parseFunnelPayload({ ...base, event: "hack" })).toBeNull();
    expect(parseFunnelPayload({ ...base, visitorId: "x" })).toBeNull();
    expect(parseFunnelPayload(null)).toBeNull();
  });

  it("ignore un matchId ou un référent mal formé sans rejeter l'événement", () => {
    const p = parseFunnelPayload({ ...base, matchId: "pas-un-uuid", referrer: "pas une url" });
    expect(p).toMatchObject({ matchId: null, referrer: null });
  });
});
