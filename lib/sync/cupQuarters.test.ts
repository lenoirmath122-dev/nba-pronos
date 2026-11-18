import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ getServiceClient: vi.fn() }));

import { proposeCupQuarters, type TeamRef } from "./cupQuarters";
import type { RawMatch } from "@/lib/nba/client";

// Équipes 1-4 Est (e1..e4), 5-8 Ouest (w1..w4), 9 = Est supplémentaire.
const teams = new Map<string, TeamRef>([
  ["1", { id: "e1", conference: "EAST" }],
  ["2", { id: "e2", conference: "EAST" }],
  ["3", { id: "e3", conference: "EAST" }],
  ["4", { id: "e4", conference: "EAST" }],
  ["5", { id: "w1", conference: "WEST" }],
  ["6", { id: "w2", conference: "WEST" }],
  ["7", { id: "w3", conference: "WEST" }],
  ["8", { id: "w4", conference: "WEST" }],
  ["9", { id: "e5", conference: "EAST" }],
]);

let n = 0;
const m = (home: number, away: number, date: string, id = ++n): RawMatch =>
  ({
    id,
    league: "NBA",
    season: 2026,
    date,
    state: { clock: 0, period: 0, description: "Scheduled", score: { homeTeam: [], awayTeam: [] } },
    homeTeam: { id: home },
    awayTeam: { id: away },
  }) as unknown as RawMatch;

const valid = () => [
  m(7, 8, "2026-12-06T02:00:00Z"), // Ouest, 2e
  m(1, 2, "2026-12-05T00:30:00Z"), // Est, 1er
  m(5, 6, "2026-12-05T02:00:00Z"), // Ouest, 1er
  m(3, 4, "2026-12-05T23:00:00Z"), // Est, 2e
];

describe("proposeCupQuarters", () => {
  it("4 affiches valides : Est puis Ouest, triées par date, domicile en premier", () => {
    expect(proposeCupQuarters(valid(), teams)).toEqual({
      ok: true,
      quarters: [
        ["e1", "e2"],
        ["e3", "e4"],
        ["w1", "w2"],
        ["w3", "w4"],
      ],
    });
  });
  it("0 match : refus (calendrier non publié)", () => {
    expect(proposeCupQuarters([], teams).ok).toBe(false);
  });
  it("3 matchs : refus", () => {
    const r = proposeCupQuarters(valid().slice(0, 3), teams);
    expect(!r.ok && r.reason).toContain("3 match");
  });
  it("5 matchs : refus (ambigu)", () => {
    const r = proposeCupQuarters([...valid(), m(9, 1, "2026-12-05T01:00:00Z")], teams);
    expect(!r.ok && r.reason).toContain("5 match");
  });
  it("même match renvoyé deux fois : dédoublonné", () => {
    const list = valid();
    expect(proposeCupQuarters([...list, list[0]], teams).ok).toBe(true);
  });
  it("équipe en double sur 4 matchs : refus", () => {
    const list = [
      m(1, 2, "2026-12-05T00:00:00Z"),
      m(2, 3, "2026-12-05T01:00:00Z"),
      m(5, 6, "2026-12-05T02:00:00Z"),
      m(7, 8, "2026-12-05T03:00:00Z"),
    ];
    const r = proposeCupQuarters(list, teams);
    expect(!r.ok && r.reason).toContain("distinctes");
  });
  it("conférences déséquilibrées (3 Est / 1 Ouest) : refus", () => {
    const list = [
      m(1, 2, "2026-12-05T00:00:00Z"),
      m(3, 4, "2026-12-05T01:00:00Z"),
      m(9, 5, "2026-12-05T02:00:00Z"),
      m(6, 7, "2026-12-05T03:00:00Z"),
    ];
    expect(proposeCupQuarters(list, teams).ok).toBe(false);
  });
  it("match inter-conférences : refus", () => {
    const list = [
      m(1, 5, "2026-12-05T00:00:00Z"),
      m(2, 6, "2026-12-05T01:00:00Z"),
      m(3, 7, "2026-12-05T02:00:00Z"),
      m(4, 8, "2026-12-05T03:00:00Z"),
    ];
    expect(proposeCupQuarters(list, teams).ok).toBe(false);
  });
  it("équipes non mappées ignorées", () => {
    expect(proposeCupQuarters([m(99, 98, "2026-12-05T00:00:00Z")], teams).ok).toBe(false);
  });
});
