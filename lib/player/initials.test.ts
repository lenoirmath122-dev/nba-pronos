import { describe, expect, it } from "vitest";
import { getInitials } from "./initials";

describe("getInitials", () => {
  it("prend la première lettre de deux morceaux séparés", () => {
    expect(getInitials("le haricot mystérieu")).toBe("LH");
    expect(getInitials("Big_ball")).toBe("BB");
  });

  it("ignore un morceau numérique : Rillettes-31 donne RI et non R3", () => {
    expect(getInitials("Rillettes-31")).toBe("RI");
  });

  it("prend les 2 premiers caractères d'un pseudo d'un seul bloc", () => {
    expect(getInitials("cyril535")).toBe("CY");
    expect(getInitials("TheAnsw3r")).toBe("TH");
  });

  it("garde des chiffres quand il n'y a aucune lettre, et un repli sinon", () => {
    expect(getInitials("1234")).toBe("12");
    expect(getInitials("--")).toBe("?");
  });
});
