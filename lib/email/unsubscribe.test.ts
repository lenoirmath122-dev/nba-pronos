import { describe, expect, it } from "vitest";
import { createUnsubscribeToken, verifyUnsubscribeToken } from "@/lib/email/unsubscribe";

const SECRET = "secret-de-test";
const USER = "6f1c2f3e-8c1a-4a53-9a0e-0d3f4c5b6a7d";

describe("jeton de désinscription", () => {
  it("accepte un jeton valide", () => {
    const token = createUnsubscribeToken(USER, "results", SECRET);
    expect(verifyUnsubscribeToken(token, SECRET)).toEqual({ userId: USER, scope: "results" });
  });

  it("refuse un autre secret", () => {
    const token = createUnsubscribeToken(USER, "results", SECRET);
    expect(verifyUnsubscribeToken(token, "autre")).toBeNull();
  });

  it("refuse un jeton dont le scope a été changé", () => {
    const token = createUnsubscribeToken(USER, "reminders", SECRET).replace(".reminders.", ".results.");
    expect(verifyUnsubscribeToken(token, SECRET)).toBeNull();
  });

  it("refuse un jeton d'un autre joueur", () => {
    const token = createUnsubscribeToken(USER, "results", SECRET);
    expect(verifyUnsubscribeToken(token.replace(USER, "autre-id"), SECRET)).toBeNull();
  });

  it("refuse un jeton mal formé", () => {
    expect(verifyUnsubscribeToken("", SECRET)).toBeNull();
    expect(verifyUnsubscribeToken("a.b", SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(`${USER}.results.x.y`, SECRET)).toBeNull();
  });
});
