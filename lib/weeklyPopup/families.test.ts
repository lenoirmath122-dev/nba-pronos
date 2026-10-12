import { describe, expect, it } from "vitest";
import { DNP_RESOLUTION_REASON } from "@/lib/ai/resolveBetsShared";
import {
  NOT_IN_MATCH_RESOLUTION_REASON,
  NOT_IN_SERIES_RESOLUTION_REASON,
} from "@/lib/ai/resolveNotInMatchBets";
import { flopFamily, flopIneligibility, isFlopEligible } from "./families";
import { bet } from "./testFixtures";

describe("flopFamily", () => {
  it("joueur simple", () => {
    expect(flopFamily(bet())).toBe("player");
  });

  it.each(["plus_minus", "ft", "fg3", "min", "dd", "td", "tech"])("joueur, stat %s : exclue", (stat) => {
    expect(flopFamily(bet({ structured_stat: stat }))).toBeNull();
  });

  it("joueur dont l'identité n'est pas fixée (NotInMatch) : exclu", () => {
    expect(flopFamily(bet({ structured_player_id: null }))).toBeNull();
  });

  it("formes joueur composées : exclues", () => {
    for (const key of [
      "structured_duel",
      "structured_combo",
      "structured_roster_split",
      "structured_roster_count",
      "structured_superlative",
      "structured_block_on_player",
    ] as const) {
      expect(flopFamily(bet({ [key]: { x: 1 } }))).toBeNull();
    }
    expect(flopFamily(bet({ structured_last_basket: true }))).toBeNull();
    expect(flopFamily(bet({ structured_period: { outcome_kind: "MARGIN", player_id: 3 } }))).toBeNull();
  });

  it("went_to_ot et pourcentage d'équipe : exclus", () => {
    expect(flopFamily(bet({ structured_stat: "went_to_ot", structured_player_id: null }))).toBeNull();
    expect(
      flopFamily(bet({ structured_stat: "fg", structured_player_id: null, structured_team_id: "t1" })),
    ).toBeNull();
  });

  it("totaux du match", () => {
    for (const stat of ["total_points", "total_reb", "total_timeouts"]) {
      expect(flopFamily(bet({ structured_stat: stat, structured_player_id: null }))).toBe("match_total");
    }
  });

  it("stat d'équipe", () => {
    expect(
      flopFamily(bet({ structured_stat: "pts", structured_player_id: null, structured_team_id: "t1" })),
    ).toBe("team_stat");
  });

  it("pièges de structured_team_id : roster split, période et fautes techniques", () => {
    expect(
      flopFamily(
        bet({ structured_player_id: null, structured_team_id: "t1", structured_roster_split: { x: 1 } }),
      ),
    ).toBeNull();
    expect(
      flopFamily(
        bet({
          structured_stat: null,
          structured_player_id: null,
          structured_team_id: "t1",
          structured_period: { outcome_kind: "QUARTERS_WON_COUNT" },
        }),
      ),
    ).toBe("period_team");
    expect(
      flopFamily(
        bet({
          structured_stat: null,
          structured_player_id: null,
          structured_team_id: "t1",
          structured_technical_fouls_count: { count_relation: "AT_LEAST" },
        }),
      ),
    ).toBe("tech_count");
  });

  it("périodes d'équipe éligibles, issues sans seuil exclues", () => {
    const period = (outcome_kind: string) =>
      bet({ structured_stat: null, structured_player_id: null, structured_period: { outcome_kind } });
    expect(flopFamily(period("MARGIN"))).toBe("period_team");
    expect(flopFamily(period("TOTAL_POINTS"))).toBe("period_team");
    for (const kind of ["POINT_SHARE_PCT", "QUARTER_WINNER", "HALF_WINNER", "LEADS_HALF_RESULT"]) {
      expect(flopFamily(period(kind))).toBeNull();
    }
  });
});

describe("flopIneligibility", () => {
  it("un pari standard est éligible", () => {
    expect(isFlopEligible(bet(), "plus de")).toBe(true);
  });

  it.each([
    ["pas_perdu", { status: "WON" as const }],
    ["pas_match", { scope: "SERIES" as const }],
    ["pas_match", { match_id: null }],
    ["seuil_absent", { structured_threshold: null }],
    ["raison_absente", { resolution_reason: null }],
    ["raison_absente", { resolution_reason: "   " }],
    ["resolu_par_admin", { resolved_by_admin_id: "admin-1" }],
    ["raison_automatique", { resolution_reason: DNP_RESOLUTION_REASON }],
    ["raison_automatique", { resolution_reason: NOT_IN_MATCH_RESOLUTION_REASON }],
    ["raison_automatique", { resolution_reason: NOT_IN_SERIES_RESOLUTION_REASON }],
    ["negation", { structured_negation: true }],
  ] as const)("%s", (code, overrides) => {
    expect(flopIneligibility(bet(overrides), "plus de")).toBe(code);
  });

  it("sens absent", () => {
    expect(flopIneligibility(bet(), null)).toBe("sens_absent");
  });
});
