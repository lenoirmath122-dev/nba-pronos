import { afterEach, describe, expect, it } from "vitest";
import {
  DEADLINE_SAFETY_MARGIN_MS,
  MIN_CALL_TIMEOUT_MS,
  POPUP_LLM_MODEL_DEFAULT,
  ROLES,
  boundedTimeoutMs,
  deadlineFrom,
  popupModel,
} from "./config";

const ORIGINAL = process.env.POPUP_LLM_MODEL;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.POPUP_LLM_MODEL;
  else process.env.POPUP_LLM_MODEL = ORIGINAL;
});

describe("popupModel", () => {
  it("défaut puis surcharge par l'environnement", () => {
    delete process.env.POPUP_LLM_MODEL;
    expect(popupModel()).toBe(POPUP_LLM_MODEL_DEFAULT);
    process.env.POPUP_LLM_MODEL = " claude-autre ";
    expect(popupModel()).toBe("claude-autre");
  });
});

describe("échéances", () => {
  it("deadlineFrom : début + maxDuration - marge de 30 s", () => {
    expect(deadlineFrom(1_000)).toBe(1_000 + 270_000);
    expect(DEADLINE_SAFETY_MARGIN_MS).toBe(30_000);
  });

  it("le timeout d'un appel est borné par ce qu'il reste, avec un plancher", () => {
    // 30 s restantes, 10 s réservées pour finir : 20 s au plus.
    expect(boundedTimeoutMs(ROLES.redacteur.timeoutMs, 30_000, 0)).toBe(20_000);
    // Beaucoup de marge : le timeout du rôle.
    expect(boundedTimeoutMs(ROLES.classifier.timeoutMs, 280_000, 0)).toBe(25_000);
    // Presque plus de temps : jamais sous le plancher.
    expect(boundedTimeoutMs(45_000, 12_000, 0)).toBe(MIN_CALL_TIMEOUT_MS);
  });
});
