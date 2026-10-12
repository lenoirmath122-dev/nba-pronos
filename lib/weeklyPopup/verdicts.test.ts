import { describe, expect, it } from "vitest";
import { applyVerdicts, candidateKey, inputHash, mergeVerdicts, reuseVerdicts } from "./verdicts";
import type { WeeklyPopupCandidate } from "./types";
import { U1, U2 } from "./testFixtures";

const cand = (overrides: Partial<WeeklyPopupCandidate> = {}): WeeklyPopupCandidate => ({
  short_id: "t1",
  bloc: "top",
  bet_id: "b1",
  user_id: U1,
  texte: "pari",
  input_hash: inputHash("Nico", "pari"),
  ...overrides,
});

describe("inputHash", () => {
  it("stable, et sensible au pseudo comme au texte (séparateur NUL)", () => {
    expect(inputHash("a", "b")).toBe(inputHash("a", "b"));
    expect(inputHash("a", "b")).not.toBe(inputHash("a", "c"));
    expect(inputHash("ab", "c")).not.toBe(inputHash("a", "bc"));
  });
});

describe("reuseVerdicts", () => {
  const previous = [cand({ verdict: "bloque", categorie: "racisme", verdict_source: "lot" })];

  it("réutilise par bet_id et input_hash", () => {
    const [out] = reuseVerdicts([cand()], previous);
    expect(out).toMatchObject({ verdict: "bloque", categorie: "racisme", verdict_source: "reutilise" });
  });
  it("pas de réutilisation si le texte (donc le hash) a changé", () => {
    const [out] = reuseVerdicts([cand({ input_hash: inputHash("Nico", "autre") })], previous);
    expect(out.verdict).toBeUndefined();
  });
  it("champion réutilisé par user_id", () => {
    const champ = cand({ bet_id: null, bloc: "champion", short_id: "c1", texte: "" });
    const prev = [{ ...champ, verdict: "ok" as const, categorie: null, verdict_source: "lot" as const }];
    expect(candidateKey(champ)).toBe(`champion:${U1}`);
    expect(reuseVerdicts([champ], prev)[0].verdict).toBe("ok");
  });
});

describe("mergeVerdicts", () => {
  const two = [cand(), cand({ short_id: "f1", bet_id: "b2", bloc: "flop" })];

  it("applique les verdicts du lot", () => {
    const { candidates, anomalies } = mergeVerdicts(
      two,
      {
        verdicts: [
          { id: "t1", verdict: "ok", categorie: null },
          { id: "f1", verdict: "bloque", categorie: "racisme" },
        ],
      },
      "lot",
    );
    expect(candidates.map((c) => c.verdict)).toEqual(["ok", "bloque"]);
    expect(anomalies).toEqual({ absent: 0, doublon: 0, inconnu: 0, incoherent: 0 });
  });

  it("id absent, doublon, inconnu et incohérent : échec fermé", () => {
    const { candidates, anomalies } = mergeVerdicts(
      [...two, cand({ short_id: "r1", bet_id: "b3", bloc: "refuse" }), cand({ short_id: "r2", bet_id: "b4", bloc: "refuse" })],
      {
        verdicts: [
          { id: "t1", verdict: "ok", categorie: null },
          { id: "t1", verdict: "ok", categorie: null },
          { id: "zz9", verdict: "ok", categorie: null },
          { id: "r1", verdict: "ok", categorie: "doute" },
        ],
      },
      "lot",
    );
    expect(anomalies).toEqual({ absent: 2, doublon: 1, inconnu: 1, incoherent: 1 });
    expect(candidates.every((c) => c.verdict === "bloque" && c.categorie === "doute")).toBe(true);
  });

  it("ne touche pas un candidat qui a déjà un verdict ; sortie nulle = tout bloqué", () => {
    const keep = cand({ verdict: "ok", categorie: null, verdict_source: "reutilise" });
    const { candidates } = mergeVerdicts([keep, cand({ short_id: "t2", bet_id: "b9" })], null, "unitaire");
    expect(candidates[0].verdict).toBe("ok");
    expect(candidates[1]).toMatchObject({ verdict: "bloque", categorie: "doute", verdict_source: "unitaire" });
  });
});

describe("applyVerdicts", () => {
  it("un candidat bloqué retire tous ceux du joueur, champion compris", () => {
    const { kept, blockedUserIds } = applyVerdicts([
      cand({ verdict: "ok" }),
      cand({ short_id: "f1", bet_id: "b2", bloc: "flop", verdict: "bloque", categorie: "doute" }),
      cand({ short_id: "c1", bet_id: null, bloc: "champion", verdict: "ok" }),
      cand({ short_id: "t2", bet_id: "b5", user_id: U2, verdict: "ok" }),
    ]);
    expect([...blockedUserIds]).toEqual([U1]);
    expect(kept.map((c) => c.short_id)).toEqual(["t2"]);
  });

  it("sans verdict : non retenu", () => {
    expect(applyVerdicts([cand()]).kept).toHaveLength(0);
  });
});
