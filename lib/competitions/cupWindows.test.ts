import { describe, expect, it } from "vitest";
import { cupRoundAllowsDay } from "./cupWindows";

describe("cupRoundAllowsDay", () => {
  it("quarts : 04-05/12 seulement", () => {
    expect(cupRoundAllowsDay("CUP_QUARTERS", "2026-12-04")).toBe(true);
    expect(cupRoundAllowsDay("CUP_QUARTERS", "2026-12-06")).toBe(false);
  });
  it("demies : 08-09/12 seulement", () => {
    expect(cupRoundAllowsDay("CUP_SEMIS", "2026-12-08")).toBe(true);
    expect(cupRoundAllowsDay("CUP_SEMIS", "2026-12-10")).toBe(false);
  });
  it("finale : 11/12 seulement", () => {
    expect(cupRoundAllowsDay("CUP_FINAL", "2026-12-11")).toBe(true);
    expect(cupRoundAllowsDay("CUP_FINAL", "2026-12-12")).toBe(false);
  });
  it("tour inconnu : autorisé", () => {
    expect(cupRoundAllowsDay(null, "2026-01-01")).toBe(true);
    expect(cupRoundAllowsDay("ROUND_1", "2026-01-01")).toBe(true);
  });
});
