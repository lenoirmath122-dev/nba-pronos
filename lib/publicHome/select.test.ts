import { describe, it, expect } from "vitest";
import { selectHomeMatches, voteSplit, isOpenForPronos, SOCIAL_PROOF_MIN, type HomeMatchRow } from "./select";

const NOW = Date.parse("2026-10-20T12:00:00Z");
const m = (id: string, at: string | null, status: HomeMatchRow["status"] = "SCHEDULED"): HomeMatchRow => ({
  id,
  scheduled_at: at,
  status,
});

describe("selectHomeMatches", () => {
  it("met en avant le prochain match et liste les suivants dans l'ordre", () => {
    const r = selectHomeMatches(
      [m("c", "2026-10-22T00:00:00Z"), m("a", "2026-10-21T00:00:00Z"), m("b", "2026-10-21T02:00:00Z")],
      NOW,
    );
    expect(r.featured?.id).toBe("a");
    expect(r.next.map((x) => x.id)).toEqual(["b", "c"]);
    expect(r.live).toBeNull();
  });

  it("signale le match commencé et met en avant le suivant", () => {
    const r = selectHomeMatches([m("a", "2026-10-20T11:00:00Z", "IN_PROGRESS"), m("b", "2026-10-21T00:00:00Z")], NOW);
    expect(r.live?.id).toBe("a");
    expect(r.featured?.id).toBe("b");
  });

  it("ignore les matchs reportés, annulés, finis ou sans date", () => {
    const r = selectHomeMatches(
      [
        m("p", "2026-10-21T00:00:00Z", "POSTPONED"),
        m("x", "2026-10-21T00:00:00Z", "CANCELLED"),
        m("f", "2026-10-19T00:00:00Z", "FINISHED"),
        m("n", null),
        m("ok", "2026-10-23T00:00:00Z"),
      ],
      NOW,
    );
    expect(r.featured?.id).toBe("ok");
    expect(r.next).toEqual([]);
    expect(r.live).toBeNull();
  });

  it("renvoie un état vide sans match", () => {
    expect(selectHomeMatches([], NOW)).toEqual({ live: null, featured: null, next: [] });
  });
});

describe("isOpenForPronos", () => {
  it("est fermé à l'instant du coup d'envoi", () => {
    expect(isOpenForPronos(m("a", "2026-10-20T12:00:00Z"), NOW)).toBe(false);
  });
});

describe("voteSplit", () => {
  it("fixe les seuils de preuve sociale validés le 27/10/2026", () => {
    expect(SOCIAL_PROOF_MIN).toEqual({ resultPlayers: 30, splitVotes: 20 });
  });
  it("masque les chiffres sous le seuil, les affiche au seuil", () => {
    expect(voteSplit(SOCIAL_PROOF_MIN.splitVotes - 1, 5)).toBeNull();
    expect(voteSplit(SOCIAL_PROOF_MIN.splitVotes, 10)).toEqual({ total: 20, homePercent: 50, awayPercent: 50 });
  });
  it("calcule des pourcentages qui font 100", () => {
    expect(voteSplit(23, 14)).toEqual({ total: 23, homePercent: 61, awayPercent: 39 });
  });
});
