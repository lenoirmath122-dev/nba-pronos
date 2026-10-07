import { describe, it, expect } from "vitest";
import { betSkeleton, betFingerprint } from "./betFingerprint";

describe("betSkeleton", () => {
  it("masque les noms propres et les nombres", () => {
    expect(betSkeleton("Cade Cunningham marque plus de 20 points.")).toBe(
      "X marque plus de N points",
    );
  });

  it("donne le même squelette à deux joueurs et deux seuils différents", () => {
    expect(betSkeleton("Jalen Williams marque plus de 25 points.")).toBe(
      betSkeleton("Cade Cunningham marque plus de 20 points."),
    );
  });

  it("traite les ordinaux, chiffrés ou non, comme un même type", () => {
    expect(betSkeleton("Les Knicks gagnent le 3ème quart-temps")).toBe(
      betSkeleton("Les Knicks gagnent le 4e quart-temps"),
    );
    expect(betSkeleton("fin du 1er quart-temps")).toBe("fin du Ne quart-temps");
  });

  it("ne masque pas un mot courant en début de phrase", () => {
    expect(betSkeleton("Les Knicks gagnent le match")).toBe("les X gagnent le match");
    expect(betSkeleton("Il y aura exactement 2 fautes techniques")).toBe(
      "il y aura exactement N fautes techniques",
    );
  });

  it("conserve les sigles en minuscules", () => {
    expect(betSkeleton("Au moins deux joueurs ne joueront pas (DNP).")).toBe(
      "au moins N joueurs ne joueront pas (dnp)",
    );
  });

  it("fusionne initiales, prénoms composés et noms à trait d'union", () => {
    expect(betSkeleton("V. J. Edgecombe marque au moins 20 points")).toBe(
      "X marque au moins N points",
    );
    expect(betSkeleton("Shai Gilgeous-Alexander réalise un triple-double")).toBe(
      "X realise un triple-double",
    );
  });

  it("remplace un score ou un pourcentage par N", () => {
    expect(betSkeleton("Le score final est 121-108")).toBe("le score final est N");
    expect(betSkeleton("Tatum termine à plus de 42% de réussite")).toBe(
      "X termine a plus de N% de reussite",
    );
  });

  it("ignore accents, apostrophe typographique et ponctuation finale", () => {
    expect(betSkeleton("L’équipe gagne.")).toBe(betSkeleton("L'equipe gagne"));
  });

  it("ne transforme pas 76ers, 2èmes ou 3pts en nombre collé à des lettres", () => {
    expect(betSkeleton("Les 76ers gagnent")).toBe(betSkeleton("Les Knicks gagnent"));
    expect(betSkeleton("Les 2èmes quart-temps")).toBe("les Ne quart-temps");
    expect(betSkeleton("2nd quart-temps")).toBe("Ne quart-temps");
    expect(betSkeleton("Tatum fait 30pts")).toBe("X fait N pts");
  });

  it("traite un code d'équipe comme un nom propre, mais garde les sigles métier", () => {
    expect(betSkeleton("LAL gagne et OKC perd")).toBe(betSkeleton("Boston gagne et Denver perd"));
    expect(betSkeleton("Deux joueurs en DNP")).toBe("N joueurs en dnp");
  });

  it("ne fusionne pas des noms propres à travers une fin de phrase", () => {
    expect(betSkeleton("Denver gagne chez Boston. Jokic marque")).toBe(
      "X gagne chez X. X marque",
    );
    expect(betSkeleton("Boston gagne. Le match va en prolongation")).toBe(
      "X gagne. le match va en prolongation",
    );
  });

  it("protège les mots courants en début de phrase, où qu'ils soient", () => {
    expect(betSkeleton("Mi-temps: Denver mène")).toBe("mi-temps: X mene");
    expect(betSkeleton("À Boston, Denver gagne")).toBe("a X, X gagne");
  });

  it("gère les nombres en toutes lettres, composés et capitalisés", () => {
    expect(betSkeleton("Cinq joueurs ou plus")).toBe("N joueurs ou plus");
    expect(betSkeleton("Vingt-deux points")).toBe("N points");
    expect(betSkeleton("Quatre-vingt-dix points")).toBe("N points");
  });

  it("traite un séparateur de milliers comme un seul nombre", () => {
    expect(betSkeleton("plus de 10 000 spectateurs")).toBe("plus de N spectateurs");
    expect(betSkeleton("plus de 10,5 spectateurs")).toBe("plus de N spectateurs");
  });

  it("normalise guillemets et points de suspension", () => {
    expect(betSkeleton("« Boston » gagne…")).toBe("X gagne");
  });

  it("supporte un texte vide ou de la ponctuation seule", () => {
    expect(betSkeleton("")).toBe("");
    expect(betSkeleton("...")).toBe("");
  });
});

describe("betFingerprint", () => {
  it("est identique pour deux paris du même type", () => {
    expect(betFingerprint("Cade Cunningham marque plus de 20 points.")).toBe(
      betFingerprint("Jalen Williams marque plus de 25 points"),
    );
  });

  it("diffère entre deux types", () => {
    expect(betFingerprint("X marque plus de 20 points")).not.toBe(
      betFingerprint("X prend plus de 10 rebonds"),
    );
  });

  it("reste stable pour la version 1 (valeur figée)", () => {
    expect(betFingerprint("Cade Cunningham marque plus de 20 points.")).toBe("21f0aba6c25a");
  });
});
