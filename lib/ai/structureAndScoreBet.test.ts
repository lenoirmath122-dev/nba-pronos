// Test du ROUTAGE PAR MOT-CLÉ (Cadrage/Suivi/BILAN_GLOBAL_01_09_2026.md,
// chantier fiabilité & QA, 01/09/2026) -- déterministe, aucun appel Claude,
// aucune base de données. `routeBetDescription()` a été extraite de
// structureAndScoreBet() spécifiquement pour ce test (voir son commentaire
// dans structureAndScoreBet.ts) : zéro changement de comportement, le vrai
// code appelle désormais cette fonction au lieu de réévaluer 8 `if` en
// ligne -- donc CE test protège réellement le routage en production, pas
// une copie indépendante de la logique.
//
// Toutes les phrases ci-dessous viennent du corpus réel
// (Cadrage/Stats/types_de_paris_playoffs_2026.md), jamais inventées --
// même convention que le reste du projet.

import { describe, it, expect } from "vitest";
import { routeBetDescription } from "./structureAndScoreBet";

describe("routeBetDescription — chaque forme vers son propre schéma", () => {
  it.each([
    ["L'écart de points à la fin du 3ème quart-temps est strictement inférieur à 5.", "PERIOD"],
    // "quart" SANS "temps" (06/09/2026, GAPS_OUVERTS.md) -- phrasing exact
    // du gap réel confirmé (Cadrage/Suivi/archive/
    // GAPS_OUVERTS_journal_archive_jusquau_2026-09-06.md, cas "Simon").
    ["L'équipe qui gagne au début du 4e quart perd le match.", "PERIOD"],
    ["Les Knicks gagnent le premier quart.", "PERIOD"],
    ["Au moins deux joueurs du match ne joueront aucune minute (DNP).", "ROSTER_COUNT"],
    ["Le cinq majeur des Knicks marque plus de 68% des points totaux de l'équipe.", "ROSTER_SPLIT"],
    ["Jaylen Brown marque plus de points que tout autre joueur du match.", "SUPERLATIVE"],
    ["Orlando Magic reçoit exactement 2 fautes techniques dans le match.", "TECHNICAL_FOULS_COUNT"],
    ["Il y aura exactement 2 fautes techniques dans le match.", "TECHNICAL_FOULS_COUNT"],
    ["Devin Vassell inscrit le dernier panier du match.", "LAST_BASKET"],
    ["Victor Wembanyama réalise au moins 1 contre sur Chet Holmgren", "BLOCK_ON_PLAYER"],
    ["Nikola Jokic réalise un triple-double avec au moins 40 points et au moins 20 rebonds ou passes.", "COMBO_NESTED_OR"],
  ] as const)("%s -> %s", (description, expected) => {
    expect(routeBetDescription(description)).toBe(expected);
  });
});

describe("routeBetDescription — collisions documentées, l'ORDRE de vérification tranche", () => {
  it("'titulaires' + 'chacun' matche ROSTER_SPLIT ET ROSTER_COUNT -- ROSTER_COUNT gagne (vérifié en premier)", () => {
    // Exemple réel exact cité dans le commentaire de ROSTER_COUNT_KEYWORD_REGEX
    // (structureAndScoreBet.ts) comme motivation de cet ordre : une lecture
    // "somme" (ROSTER_SPLIT) serait fausse ici, c'est une condition
    // INDIVIDUELLE par joueur.
    expect(routeBetDescription("Les 10 joueurs titulaires marquent chacun plus de 8 points.")).toBe("ROSTER_COUNT");
  });

  it("un combo SANS 'ou' (simple, pas imbriqué) ne déclenche PAS COMBO_NESTED_OR -- retombe sur GENERAL", () => {
    // Cas réel du corpus : contient "et" mais jamais "ou" -- doit rester
    // sur le schéma combo simple partagé (structureBet.ts), pas le schéma
    // dédié à l'OU imbriqué.
    expect(routeBetDescription("Jalen Duren réalise un double-double et marque au moins 12 points.")).toBe("GENERAL");
  });

  it("le superlatif ('tout autre joueur') ne collisionne pas avec ROSTER_COUNT malgré le mot 'joueur'", () => {
    expect(routeBetDescription("De'Aaron Fox marque plus de points que tout autre joueur sur le terrain.")).toBe("SUPERLATIVE");
  });

  it("'quart de finale' (vocabulaire NBA Cup) ne déclenche PAS PERIOD malgré un ordinal + 'quart'", () => {
    expect(routeBetDescription("Les Knicks sont éliminés en quart de finale.")).not.toBe("PERIOD");
    expect(routeBetDescription("Les 4 quarts de finale sont joués le même soir.")).not.toBe("PERIOD");
  });
});

describe("routeBetDescription — GENERAL par défaut", () => {
  it("aucun mot-clé reconnu -> GENERAL (repli vers le schéma partagé structureBet.ts)", () => {
    expect(routeBetDescription("Paolo Banchero réalise un triple-double.")).toBe("GENERAL");
    expect(routeBetDescription("Jaylen Brown marque plus de 25 points.")).toBe("GENERAL");
  });
});
