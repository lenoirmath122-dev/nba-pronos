import { describe, expect, it } from "vitest";
import { focusFromSearch } from "./focus";

describe("focusFromSearch", () => {
  it("lit focus", () => {
    expect(focusFromSearch("?focus=bracket")).toBe("bracket");
  });
  it("retombe sur utm_content", () => {
    expect(focusFromSearch("?utm_source=instagram&utm_content=paris-perso")).toBe("paris-perso");
  });
  it("focus l'emporte sur utm_content", () => {
    expect(focusFromSearch("?focus=classement&utm_content=bracket")).toBe("classement");
  });
  it("un focus inconnu laisse la chance à utm_content", () => {
    expect(focusFromSearch("?focus=zzz&utm_content=bracket")).toBe("bracket");
  });
  it("tolère la casse et les espaces", () => {
    expect(focusFromSearch("?focus=%20Classement%20")).toBe("classement");
  });
  it("absent ou inconnu : null", () => {
    expect(focusFromSearch("")).toBeNull();
    expect(focusFromSearch("?utm_content=autre")).toBeNull();
  });
});
