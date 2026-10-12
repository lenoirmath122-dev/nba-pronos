import { describe, expect, it } from "vitest";
import { resolveOnboarding, type OnboardingInputs } from "./onboarding";

const base: OnboardingInputs = {
  platform: "android",
  standalone: false,
  pushSupported: true,
  permission: "default",
  subscribedHere: false,
  installConfirmed: false,
};

describe("resolveOnboarding", () => {
  it("Android dans Chrome, rien fait : notifications + installation à faire", () => {
    expect(resolveOnboarding(base)).toEqual({ notif: "enable", install: "todo", show: true });
  });

  it("iPhone dans Safari : le push attend l'installation", () => {
    const state = resolveOnboarding({ ...base, platform: "ios", pushSupported: false, permission: "unsupported" });
    expect(state).toEqual({ notif: "needs-install", install: "todo", show: true });
  });

  it("iPhone depuis l'écran d'accueil, push pas encore activé", () => {
    const state = resolveOnboarding({ ...base, platform: "ios", standalone: true });
    expect(state).toEqual({ notif: "enable", install: "done", show: true });
  });

  it("tout est fait : le guide ne s'ouvre pas", () => {
    const state = resolveOnboarding({ ...base, standalone: true, permission: "granted", subscribedHere: true });
    expect(state).toEqual({ notif: "done", install: "done", show: false });
  });

  it("ordinateur : pas d'étape d'installation, seul le push compte", () => {
    expect(resolveOnboarding({ ...base, platform: "desktop" })).toEqual({
      notif: "enable",
      install: "na",
      show: true,
    });
    const done = resolveOnboarding({ ...base, platform: "desktop", permission: "granted", subscribedHere: true });
    expect(done.show).toBe(false);
  });

  it("notifications bloquées + app installée : on ne relance pas le joueur", () => {
    const state = resolveOnboarding({ ...base, standalone: true, permission: "denied" });
    expect(state).toEqual({ notif: "blocked", install: "done", show: false });
  });

  it("notifications bloquées mais installation à faire : le guide s'ouvre et explique le blocage", () => {
    const state = resolveOnboarding({ ...base, permission: "denied" });
    expect(state).toEqual({ notif: "blocked", install: "todo", show: true });
  });

  it("« C'est fait » confirme l'installation sans mode standalone", () => {
    const state = resolveOnboarding({ ...base, installConfirmed: true, permission: "granted", subscribedHere: true });
    expect(state.show).toBe(false);
  });
});
