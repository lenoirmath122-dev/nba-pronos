import { describe, expect, it } from "vitest";
import { findMoneyWords } from "./money";

describe("findMoneyWords", () => {
  it.each([
    "Ta mise est perdue",
    "Un gain énorme",
    "Dix euros",
    "50 €",
    "du cash",
    "il a payé",
    "pour payer",
    "le paiement",
    "il a misé gros",
    "la douille",
    "le jackpot",
    "la cagnotte",
    "le pactole",
    "la cote est belle",
    "remboursé",
    "une récompense",
    "une rente",
  ])("détecte : %s", (text) => {
    expect(findMoneyWords(text).length).toBeGreaterThan(0);
  });

  it.each([
    "la mise en place",
    "une mise à jour",
    "une mise au point",
    "il a gagné",
    "à côté",
    "une remise",
    "compromise",
    "un abonnement payant",
    "un regain de forme",
  ])("ne signale pas : %s", (text) => {
    expect(findMoneyWords(text)).toEqual([]);
  });

  it("renvoie des libellés de la liste fermée, jamais le texte", () => {
    expect(findMoneyWords("Nico a misé son jackpot")).toEqual(["misé", "jackpot"]);
  });
});
