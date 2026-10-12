import { describe, expect, it } from "vitest";
import type { RedacteurOutput } from "./schemas";
import { U1, U2 } from "./testFixtures";
import { validateOutput, validateText, type ValidationContext } from "./validate";

const ctx: ValidationContext = {
  closedSet: [
    { userId: U1, pseudo: "Nico" },
    { userId: U2, pseudo: "Alix" },
  ],
  idsByBloc: { top: new Set(["t1"]), flop: new Set(["f1", "f2"]), refuse: new Set(["r1"]) },
  hasChampion: true,
};

const words = (n: number) => Array.from({ length: n }, (_, i) => `mot${i}`).join(" ");

function output(overrides: Partial<RedacteurOutput> = {}): RedacteurOutput {
  return {
    titre: "Semaine folle",
    champion: "@Nico est en tête.",
    top: "@Alix a vu juste.",
    flop: "@Nico a raté de peu.",
    refuse: "Un pari absurde.",
    cta: "Reviens vite.",
    paris_cites: { top: ["t1"], flop: ["f1"], refuse: ["r1"] },
    ...overrides,
  };
}

const codes = (r: { errors: { code: string }[] }) => r.errors.map((e) => e.code);

describe("validateOutput", () => {
  it("sortie valide : contenu tokenisé", () => {
    const r = validateOutput(output(), ctx);
    expect(r.ok).toBe(true);
    expect(r.content?.champion).toBe(`{{u:${U1}}} est en tête.`);
    expect(r.content?.top).toBe(`{{u:${U2}}} a vu juste.`);
  });

  it("bloc « null » écrit en chaîne", () => {
    expect(codes(validateOutput(output({ flop: "null", paris_cites: { top: ["t1"], flop: [], refuse: ["r1"] } }), ctx))).toContain(
      "bloc_chaine_null",
    );
  });

  it("bloc null avec ids, et ids sans bloc", () => {
    expect(
      codes(validateOutput(output({ refuse: null, paris_cites: { top: ["t1"], flop: ["f1"], refuse: ["r1"] } }), ctx)),
    ).toContain("bloc_nul_avec_ids");
    expect(
      codes(validateOutput(output({ paris_cites: { top: ["t1"], flop: [], refuse: ["r1"] } }), ctx)),
    ).toContain("bloc_sans_ids");
  });

  it("id inconnu ou d'un autre bloc", () => {
    expect(
      codes(validateOutput(output({ paris_cites: { top: ["t9"], flop: ["r1"], refuse: ["r1"] } }), ctx)),
    ).toContain("id_inconnu");
  });

  it("mention hors ensemble fermé", () => {
    const r = validateOutput(output({ top: "@Intrus a vu juste." }), ctx);
    expect(codes(r)).toContain("mention_hors_ensemble");
    expect(r.content).toBeNull();
  });

  it("jeton entrant (id copié du prompt)", () => {
    expect(codes(validateOutput(output({ top: `{{u:${U2}}} a vu juste.` }), ctx))).toContain("jeton_entrant");
  });

  it("champion inventé quand il n'y en a pas", () => {
    expect(codes(validateOutput(output(), { ...ctx, hasChampion: false }))).toContain("champion_invente");
  });

  it("longueurs : avertissement de +20 % à +50 %, erreur au-delà, total 180", () => {
    const warn = validateOutput(output({ top: words(55) }), ctx);
    expect(warn.ok).toBe(true);
    expect(warn.warnings).toContainEqual({ code: "mots_bloc", bloc: "top", detail: "55/45" });
    const err = validateOutput(output({ top: words(68) }), ctx);
    expect(codes(err)).toContain("mots_bloc");
    const total = validateOutput(output({ top: words(54), flop: words(60), refuse: words(48), champion: words(36) }), ctx);
    expect(codes(total)).toContain("mots_total");
  });

  it("avertissements : argent, emoji, champion absent, bloc vide avec candidats", () => {
    const r = validateOutput(
      output({ top: "Un gain 😀 énorme.", champion: null, flop: null, paris_cites: { top: ["t1"], flop: [], refuse: ["r1"] } }),
      ctx,
    );
    const w = r.warnings.map((x) => x.code);
    expect(w).toEqual(expect.arrayContaining(["argent", "emoji", "champion_absent", "bloc_vide_avec_candidats"]));
  });

  it("aucun pseudo ni texte dans les erreurs et avertissements", () => {
    const r = validateOutput(
      output({ top: `@Intrus et @Nico ${words(70)} gain` }),
      ctx,
    );
    const dump = JSON.stringify([r.errors, r.warnings]);
    expect(dump).not.toMatch(/Intrus|Nico|mot1/);
  });
});

describe("validateText", () => {
  it("accepte un texte édité par un admin (pseudos en clair)", () => {
    const r = validateText(
      { titre: "Titre", champion: null, top: "@Nico gagne.", flop: null, refuse: null, cta: "Allez." },
      { ...ctx, hasChampion: false },
    );
    expect(r.errors).toEqual([]);
    expect(r.tokenized.top).toBe(`{{u:${U1}}} gagne.`);
  });
});
