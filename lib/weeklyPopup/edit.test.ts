import { describe, expect, it } from "vitest";
import {
  buildValidationContext,
  checkEditedContent,
  checkForPublication,
  citedUserIds,
  featuredUserIds,
  fromEditorFields,
  isEditable,
  isPublishable,
  isRegenerable,
  isRetractable,
  isSkippable,
  toEditorFields,
  type EditorUser,
} from "./edit";
import { U1, U2, U3 } from "./testFixtures";
import { makeToken } from "./tokens";
import type { WeeklyPopupCandidate, WeeklyPopupContent, WeeklyPopupStatus } from "./types";

const users = (entries: Record<string, Partial<EditorUser> & { pseudo: string }>): Map<string, EditorUser> =>
  new Map(
    Object.entries(entries).map(([id, u]) => [id, { status: "ACTIVE", popup_mentions_opt_out: false, ...u }]),
  );

const cand = (over: Partial<WeeklyPopupCandidate>): WeeklyPopupCandidate => ({
  short_id: "t1",
  bloc: "top",
  bet_id: "bet-1",
  user_id: U1,
  texte: "Shai plus de 25 points",
  verdict: "ok",
  ...over,
});

const content = (over: Partial<WeeklyPopupContent> = {}): WeeklyPopupContent => ({
  titre: "Semaine folle",
  champion: null,
  top: `${makeToken(U1)} a vu juste.`,
  flop: null,
  refuse: null,
  cta: "Reviens vite.",
  ...over,
});

const NICO = { [U1]: { pseudo: "Nico" }, [U2]: { pseudo: "Alix" } };

describe("gardes de transition (plan §1.3)", () => {
  const all: WeeklyPopupStatus[] = ["GENERATING", "READY", "DOUBTFUL", "PUBLISHED", "SKIPPED", "RETRACTED"];
  const allowed = (guard: (s: WeeklyPopupStatus) => boolean) => all.filter(guard);

  it("enregistrer, publier et écarter : READY et DOUBTFUL seulement", () => {
    expect(allowed(isEditable)).toEqual(["READY", "DOUBTFUL"]);
    expect(allowed(isPublishable)).toEqual(["READY", "DOUBTFUL"]);
    expect(allowed(isSkippable)).toEqual(["READY", "DOUBTFUL"]);
  });

  it("retirer : PUBLISHED seulement", () => {
    expect(allowed(isRetractable)).toEqual(["PUBLISHED"]);
  });

  it("régénérer : jamais une popup publiée ou retirée", () => {
    expect(allowed(isRegenerable)).toEqual(["GENERATING", "READY", "DOUBTFUL", "SKIPPED"]);
  });
});

describe("toEditorFields / fromEditorFields", () => {
  it("résout les jetons en @pseudo et null en chaîne vide", () => {
    const fields = toEditorFields(content(), users(NICO));
    expect(fields.top).toBe("@Nico a vu juste.");
    expect(fields.flop).toBe("");
    expect(fields.titre).toBe("Semaine folle");
  });

  it("un compte supprimé ou désengagé apparaît sous son libellé neutre", () => {
    const text = `${makeToken(U1)} et ${makeToken(U2)} et ${makeToken(U3)}`;
    const fields = toEditorFields(
      content({ top: text }),
      users({ [U1]: { pseudo: "Nico" }, [U2]: { pseudo: "Alix", popup_mentions_opt_out: true } }),
    );
    expect(fields.top).toBe("@Nico et un joueur discret et un ancien joueur");
  });

  it("un champ vide ou blanc devient null (titre et cta restent vides, donc en erreur)", () => {
    const out = fromEditorFields({ titre: "  ", champion: "", top: " Bravo ", cta: "" });
    expect(out.top).toBe("Bravo");
    expect(out.champion).toBeNull();
    expect(out.flop).toBeNull();
    expect(out.titre).toBeNull();
    expect(out.cta).toBeNull();
  });
});

describe("buildValidationContext", () => {
  it("n'admet que les candidats ok de joueurs actifs et non désengagés", () => {
    const candidates = [
      cand({ short_id: "t1", user_id: U1 }),
      cand({ short_id: "f1", bloc: "flop", user_id: U2 }),
      cand({ short_id: "r1", bloc: "refuse", user_id: U3, verdict: "bloque" }),
    ];
    const ctx = buildValidationContext(
      candidates,
      users({ ...NICO, [U3]: { pseudo: "Zoé" } }),
      content(),
    );
    expect(ctx.closedSet.map((u) => u.pseudo).sort()).toEqual(["Alix", "Nico"]);
    expect([...ctx.idsByBloc.top]).toEqual(["t1"]);
    expect([...ctx.idsByBloc.flop]).toEqual(["f1"]);
    expect(ctx.idsByBloc.refuse.size).toBe(0);
  });

  it("un joueur désengagé depuis la génération n'est plus citable", () => {
    const ctx = buildValidationContext(
      [cand({ user_id: U1 })],
      users({ [U1]: { pseudo: "Nico", popup_mentions_opt_out: true } }),
      content(),
    );
    expect(ctx.closedSet).toHaveLength(0);
  });

  it("un joueur bloqué retire tous ses candidats, champion compris", () => {
    const candidates = [
      cand({ short_id: "t1", user_id: U1 }),
      cand({ short_id: "f1", bloc: "flop", user_id: U1, verdict: "bloque" }),
      cand({ short_id: "c1", bloc: "champion", user_id: U1 }),
    ];
    const ctx = buildValidationContext(candidates, users(NICO), content());
    expect(ctx.closedSet).toHaveLength(0);
    expect(ctx.hasChampion).toBe(false);
  });

  it("semaine pauvre (champion non classé) : les joueurs du jeton champion sont admis", () => {
    const ctx = buildValidationContext([], users(NICO), content({ champion: `En tête : ${makeToken(U1)}, 42 points.` }));
    expect(ctx.hasChampion).toBe(true);
    expect(ctx.closedSet.map((u) => u.pseudo)).toEqual(["Nico"]);
  });

  it("champion classé puis bloqué : le jeton du bloc champion n'ouvre rien", () => {
    const candidates = [cand({ short_id: "c1", bloc: "champion", user_id: U1, verdict: "bloque" })];
    const ctx = buildValidationContext(candidates, users(NICO), content({ champion: `Bravo ${makeToken(U1)}` }));
    expect(ctx.hasChampion).toBe(false);
    expect(ctx.closedSet).toHaveLength(0);
  });
});

describe("checkEditedContent", () => {
  const ctx = buildValidationContext(
    [cand({ short_id: "t1", user_id: U1 }), cand({ short_id: "f1", bloc: "flop", user_id: U2 })],
    users(NICO),
    content(),
  );

  it("retokenise les @pseudo de l'ensemble fermé", () => {
    const check = checkEditedContent({ titre: "Titre", top: "@Nico a vu juste.", cta: "Go" }, ctx);
    expect(check.errors).toEqual([]);
    expect(check.tokenized.top).toBe(`${makeToken(U1)} a vu juste.`);
  });

  it("refuse une mention hors ensemble fermé (le texte reste enregistrable)", () => {
    const check = checkEditedContent({ titre: "Titre", top: "@Inconnu a vu juste.", cta: "Go" }, ctx);
    expect(check.errors.map((e) => e.code)).toContain("mention_hors_ensemble");
  });

  it("titre ou cta vide : erreur champ_vide", () => {
    const check = checkEditedContent({ titre: "", top: "Bravo", cta: "  " }, ctx);
    expect(check.errors.filter((e) => e.code === "champ_vide").map((e) => e.bloc)).toEqual(["titre", "cta"]);
  });

  it("conserve le texte de repli tel quel", () => {
    const check = checkEditedContent({ titre: "Titre", cta: "Go" }, ctx, "Texte de repli fixe.");
    expect(check.tokenized.repli).toBe("Texte de repli fixe.");
  });

  it("un jeton saisi à la main est retiré et signalé", () => {
    const check = checkEditedContent({ titre: "Titre", top: `${makeToken(U2)} a gagné.`, cta: "Go" }, ctx);
    expect(check.errors.map((e) => e.code)).toContain("jeton_entrant");
    expect(check.tokenized.top).not.toContain("{{u:");
  });
});

describe("checkForPublication", () => {
  const candidates = [cand({ short_id: "t1", user_id: U1 })];

  it("laisse passer un contenu propre et le renvoie tokenisé", () => {
    const u = users(NICO);
    const ctx = buildValidationContext(candidates, u, content());
    const check = checkForPublication(content(), ctx, u);
    expect(check.errors).toEqual([]);
    expect(check.tokenized.top).toBe(`${makeToken(U1)} a vu juste.`);
  });

  it("bloque un pseudo cité sans « @ »", () => {
    const u = users(NICO);
    const c = content({ top: "Nico a vu juste." });
    const check = checkForPublication(c, buildValidationContext(candidates, u, c), u);
    expect(check.errors.map((e) => e.code)).toContain("pseudo_sans_arobase");
    expect(check.warnings.map((w) => w.code)).not.toContain("pseudo_sans_arobase");
  });

  it("bloque la mention d'un joueur qui a refusé d'être cité depuis la génération", () => {
    const u = users({ [U1]: { pseudo: "Nico", popup_mentions_opt_out: true } });
    const c = content();
    const check = checkForPublication(c, buildValidationContext(candidates, u, c), u);
    expect(check.errors.map((e) => e.code)).toContain("mention_refusee");
  });

  it("bloque un candidat bloqué cité dans le texte", () => {
    const u = users(NICO);
    const blocked = [cand({ short_id: "t1", user_id: U1, verdict: "bloque" })];
    const c = content();
    const check = checkForPublication(c, buildValidationContext(blocked, u, c), u);
    expect(check.errors.length).toBeGreaterThan(0);
  });

  it("garde le repli et valide le champion d'une semaine pauvre", () => {
    const u = users(NICO);
    const c: WeeklyPopupContent = {
      titre: "Semaine calme",
      champion: `En tête de la semaine : ${makeToken(U1)} avec 42 points.`,
      top: null,
      flop: null,
      refuse: null,
      cta: "Passe sur Jouer.",
      repli: "Peu de paris cette semaine.",
    };
    const check = checkForPublication(c, buildValidationContext([], u, c), u);
    expect(check.errors).toEqual([]);
    expect(check.tokenized.repli).toBe("Peu de paris cette semaine.");
  });
});

describe("featuredUserIds et citedUserIds", () => {
  it("featured : top, flop, refuse seulement (ni champion, ni titre, ni cta)", () => {
    const c = content({
      titre: `Bravo ${makeToken(U3)}`,
      champion: `En tête ${makeToken(U2)}`,
      top: makeToken(U1),
      flop: null,
      refuse: `${makeToken(U1)} et ${makeToken(U2)}`,
    });
    expect(featuredUserIds(c).sort()).toEqual([U1, U2].sort());
  });

  it("cited : tous les champs, sans doublon", () => {
    const c = content({ titre: `x ${makeToken(U3)}`, champion: makeToken(U2), top: makeToken(U1), cta: makeToken(U1) });
    expect(citedUserIds(c).sort()).toEqual([U1, U2, U3].sort());
    expect(citedUserIds(null)).toEqual([]);
  });
});
