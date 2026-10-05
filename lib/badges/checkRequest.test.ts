import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onBadgeCheckRequest, requestBadgeCheck } from "./checkRequest";

// Tests purs Node (vitest.config.ts) : un EventTarget tient lieu de window.
describe("requestBadgeCheck", () => {
  beforeEach(() => {
    vi.stubGlobal("window", new EventTarget());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prévient chaque abonné", () => {
    const first = vi.fn();
    const second = vi.fn();
    onBadgeCheckRequest(first);
    onBadgeCheckRequest(second);
    requestBadgeCheck();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("ne prévient plus un abonné désinscrit", () => {
    const listener = vi.fn();
    const unsubscribe = onBadgeCheckRequest(listener);
    unsubscribe();
    requestBadgeCheck();
    expect(listener).not.toHaveBeenCalled();
  });
});
