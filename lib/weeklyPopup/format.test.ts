import { describe, expect, it } from "vitest";
import {
  assignShortIds,
  buildClassifierInput,
  buildRedacteurInput,
  matchLabel,
  truncateText,
} from "./format";
import { preselect } from "./preselect";
import { U1, U2, U3, bet, user, usersMap } from "./testFixtures";

const users = usersMap(user(U1, "Nico"), user(U2, "Alix"), user(U3, "Zoé"));
const ctx = {
  users,
  matchLabels: new Map([["match-1", "OKC - NOP"]]),
  recentlyFeaturedIds: new Set([U2]),
};

function candidates() {
  const selected = preselect(
    [
      bet({ user_id: U1, status: "WON", description: "Brunson +30", resolution_reason: "41 points." }),
      bet({ user_id: U2, calculated_proba: 0.614 }),
      bet({
        user_id: U3,
        status: "REJECTED",
        resolved_at: null,
        rejected_at: "2026-10-21T09:00:00Z",
        calculated_proba: null,
        resolution_reason: null,
        description: "ligne\navec \"guillemets\" | et barre",
      }),
    ],
    users,
  );
  return assignShortIds(selected, [{ userId: U1, points: 42 }], ctx);
}

describe("assignShortIds", () => {
  it("t, f, r puis c, dans l'ordre", () => {
    expect(candidates().map((c) => c.short_id)).toEqual(["t1", "f1", "r1", "c1"]);
  });

  it("champions ex aequo : c1..cN sans plafond", () => {
    const out = assignShortIds(
      { top: [], flop: [], refuse: [] },
      [1, 2, 3, 4, 5].map((n) => ({ userId: U1, points: 10 + n - n })),
      ctx,
    );
    expect(out.map((c) => c.short_id)).toEqual(["c1", "c2", "c3", "c4", "c5"]);
  });

  it("chance arrondie, null pour un refusé ; cite_recemment ; statut en français", () => {
    const [top, flop, refuse] = candidates();
    expect(flop.chance_pct).toBe(61);
    expect(refuse.chance_pct).toBeNull();
    expect(flop.cite_recemment).toBe(true);
    expect(top.cite_recemment).toBe(false);
    expect([top.statut, flop.statut, refuse.statut]).toEqual(["gagné", "perdu", "refusé"]);
    expect(flop.match).toBe("OKC - NOP");
  });

  it("le pseudo n'est pas stocké dans le candidat", () => {
    expect(JSON.stringify(candidates())).not.toContain("Nico");
  });

  it("input_hash dépend du pseudo et du texte", () => {
    const a = candidates();
    const other = assignShortIds(
      preselect([bet({ user_id: U1, description: "autre texte" })], users),
      [],
      ctx,
    );
    expect(other[0].input_hash).not.toBe(a[1].input_hash);
  });
});

describe("entrées LLM", () => {
  it("classifieur : id, pseudo, texte seulement", () => {
    const lines = buildClassifierInput(candidates(), users).split("\n");
    expect(lines).toHaveLength(4);
    for (const line of lines) expect(Object.keys(JSON.parse(line)).sort()).toEqual(["id", "pseudo", "texte"]);
    expect(JSON.parse(lines[0]).pseudo).toBe("@Nico");
  });

  it("rédacteur : ni user_id, ni bet_id, ni raison d'un refusé ; JSON échappé", () => {
    const cands = candidates().map((c) => ({ ...c, verdict: "ok" as const }));
    const input = buildRedacteurInput(cands, { pseudos: ["Nico"], points: 42 }, users);
    expect(input).toContain('CHAMPION: {"pseudos":["@Nico"],"points":42}');
    expect(input).not.toContain(U1);
    expect(input).not.toContain("bet-");
    expect(input).not.toContain("refusal_reason");
    expect(input).toContain("\nCLASSEMENT: null\n");
    const lines = input.split("\n").slice(3);
    expect(lines).toHaveLength(3);
    const refuse = JSON.parse(lines[2]);
    expect(refuse.raison).toBeNull();
    expect(refuse.texte).toBe('ligne\navec "guillemets" | et barre');
    expect(JSON.parse(lines[1])).toMatchObject({ seuil: 25, sens: "plus de", cite_recemment: true });
  });

  it("sans champion : CHAMPION: null", () => {
    expect(buildRedacteurInput([], null, users).startsWith("CHAMPION: null\nCLASSEMENT: null\nCANDIDATS:")).toBe(true);
  });
});

describe("matchLabel et truncateText", () => {
  it("équipe manquante : « ? » ; aucun match : null", () => {
    expect(matchLabel("BOS", "NYK")).toBe("BOS - NYK");
    expect(matchLabel("BOS", undefined)).toBe("BOS - ?");
    expect(matchLabel(undefined, undefined)).toBeNull();
  });
  it("tronque sans couper une paire de substitution", () => {
    const text = "😀".repeat(300);
    const cut = truncateText(text, 280);
    expect(Array.from(cut)).toHaveLength(280);
    expect(truncateText("court", 280)).toBe("court");
  });
});
