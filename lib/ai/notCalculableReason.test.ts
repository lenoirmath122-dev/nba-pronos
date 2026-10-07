import { describe, expect, it } from "vitest";
import {
  AI_REASONING_MAX,
  buildCalculabilityDiagnosis,
  RAW_TEXT_MAX,
  REASON_GROUP,
  type NotCalculableReason,
} from "./notCalculableReason";
import { betFingerprint } from "./betFingerprint";

describe("REASON_GROUP", () => {
  it("couvre exactement les 13 codes", () => {
    expect(Object.keys(REASON_GROUP)).toHaveLength(13);
    for (const group of Object.values(REASON_GROUP)) {
      expect(["COVERAGE", "AI_QUALITY", "OPERATIONAL"]).toContain(group);
    }
  });
});

describe("buildCalculabilityDiagnosis", () => {
  const text = "Cade Cunningham marque plus de 20 points";

  it("construit la forme attendue sans trace IA", () => {
    const d = buildCalculabilityDiagnosis({ reason: "AI_COST_CAP", rawText: text, route: "GENERAL" });
    expect(d).toMatchObject({
      v: 1,
      reason: "AI_COST_CAP",
      group: "OPERATIONAL",
      route: "GENERAL",
      subject: null,
      raw_text: text,
      fingerprint: betFingerprint(text),
    });
    expect(d.skeleton).toContain("N");
    expect("ai_reasoning" in d).toBe(false);
  });

  it("reprend le sujet et le raisonnement de l'IA, bornés", () => {
    const reason: NotCalculableReason = "UNKNOWN_TYPE";
    const d = buildCalculabilityDiagnosis({
      reason,
      rawText: "x".repeat(RAW_TEXT_MAX + 50),
      route: "PERIOD",
      ai: { bet_subject: "COMPARISON", reasoning: "y".repeat(AI_REASONING_MAX + 100) },
    });
    expect(d.subject).toBe("COMPARISON");
    expect(d.raw_text).toHaveLength(RAW_TEXT_MAX);
    expect(d.ai_reasoning).toHaveLength(AI_REASONING_MAX);
  });

  it("n'écrit pas un raisonnement vide", () => {
    const d = buildCalculabilityDiagnosis({
      reason: "UNKNOWN_TYPE",
      rawText: text,
      route: "GENERAL",
      ai: { bet_subject: null, reasoning: "   " },
    });
    expect("ai_reasoning" in d).toBe(false);
  });
});
