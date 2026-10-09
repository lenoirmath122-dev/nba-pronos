import { describe, it, expect } from "vitest";
import { validatedBetDialog } from "./validatedBetDialog";

describe("validatedBetDialog", () => {
  it("proba + points : « Pari validé : x % de chance pour x pts à gagner »", () => {
    expect(validatedBetDialog("Jokic 25+", 42, 15)).toEqual({
      title: "Pari validé : 42 % de chance pour 15 pts à gagner",
      items: ["Jokic 25+"],
    });
  });

  it("proba arrondie à 0 : « moins de 1 % »", () => {
    expect(validatedBetDialog("x", 0, 25).title).toBe("Pari validé : moins de 1 % de chance pour 25 pts à gagner");
  });

  it("points seuls ou proba seule", () => {
    expect(validatedBetDialog("x", null, 9).title).toBe("Pari validé : 9 pts à gagner");
    expect(validatedBetDialog("x", 60, null).title).toBe("Pari validé : 60 % de chance");
  });

  it("rien de connu : titre simple", () => {
    expect(validatedBetDialog("x", null, null).title).toBe("Pari validé");
  });
});
