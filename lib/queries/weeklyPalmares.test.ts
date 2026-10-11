import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;

let ownChampions: Row[]; // weekly_champions filtré sur user_id
let sameWeekChampions: Row[]; // weekly_champions lu par compétition et date
let competitions: Row[];
let failing: Set<string>; // "weekly_champions:own" | "weekly_champions:sameWeek" | "competitions"
let fromSpy: ReturnType<typeof vi.fn<(table: string) => void>>;

// Chaîne PostgREST minimale : mémorise les filtres, résout selon la table.
// La lecture « siennes » se reconnaît à eq:user_id, l'autre à ses filtres in.
function query(table: string) {
  const filters: Record<string, unknown> = {};
  const c: Record<string, unknown> = {};
  c.select = () => c;
  c.eq = (column: string, value: unknown) => {
    filters[`eq:${column}`] = value;
    return c;
  };
  c.in = (column: string, value: unknown) => {
    filters[`in:${column}`] = value;
    return c;
  };
  c.then = (res: (v: unknown) => unknown) => {
    const isOwn = "eq:user_id" in filters;
    const key = table === "weekly_champions" ? (isOwn ? "weekly_champions:own" : "weekly_champions:sameWeek") : table;
    if (failing.has(key)) return res({ data: null, error: { message: "boom" } });
    if (table === "weekly_champions") return res({ data: isOwn ? ownChampions : sameWeekChampions, error: null });
    if (table === "competitions") return res({ data: competitions, error: null });
    return res({ data: [], error: null });
  };
  return c;
}

vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));

import { getWeeklyPalmares } from "./weeklyPalmares";

const client = {
  from: (table: string) => {
    fromSpy(table);
    return query(table);
  },
} as never;

const champion = (competition_id: string, week_end_date: string, points = 12) => ({
  competition_id,
  week_end_date,
  points,
});

beforeEach(() => {
  ownChampions = [];
  sameWeekChampions = [];
  competitions = [];
  failing = new Set();
  fromSpy = vi.fn<(table: string) => void>();
});

describe("getWeeklyPalmares", () => {
  it("renvoie le total et les semaines de deux compétitions", async () => {
    ownChampions = [champion("cup", "2026-10-26", 30), champion("season", "2026-11-02", 18)];
    sameWeekChampions = [
      { competition_id: "cup", week_end_date: "2026-10-26" },
      { competition_id: "season", week_end_date: "2026-11-02" },
    ];
    competitions = [
      { id: "cup", name: "NBA Cup" },
      { id: "season", name: "Saison régulière" },
    ];

    const result = await getWeeklyPalmares(client, "me");

    expect(result.state).toBe("ok");
    expect(result.total).toBe(2);
    expect(result.weeks.map((w) => w.competitionName)).toEqual(["Saison régulière", "NBA Cup"]);
    expect(result.weeks.every((w) => !w.isCoChampion)).toBe(true);
  });

  it("ne lit pas competitions quand le joueur n'a aucune victoire", async () => {
    const result = await getWeeklyPalmares(client, "me");

    expect(result).toEqual({ state: "ok", total: 0, weeks: [] });
    expect(fromSpy).not.toHaveBeenCalledWith("competitions");
  });

  it("renvoie error quand la lecture des victoires échoue", async () => {
    failing.add("weekly_champions:own");

    expect(await getWeeklyPalmares(client, "me")).toEqual({ state: "error", total: 0, weeks: [] });
  });

  it("garde les victoires avec un nom de repli quand competitions échoue", async () => {
    ownChampions = [champion("cup", "2026-10-26")];
    sameWeekChampions = [{ competition_id: "cup", week_end_date: "2026-10-26" }];
    failing.add("competitions");

    const result = await getWeeklyPalmares(client, "me");

    expect(result.state).toBe("ok");
    expect(result.weeks[0].competitionName).toBe("Compétition");
  });

  it("détecte un co-champion", async () => {
    ownChampions = [champion("cup", "2026-10-26")];
    sameWeekChampions = [
      { competition_id: "cup", week_end_date: "2026-10-26" },
      { competition_id: "cup", week_end_date: "2026-10-26" },
    ];
    competitions = [{ id: "cup", name: "NBA Cup" }];

    expect((await getWeeklyPalmares(client, "me")).weeks[0].isCoChampion).toBe(true);
  });

  it("ignore les lignes du produit cartésien qui ne sont pas ses victoires", async () => {
    // Victoires : (cup, 26/10) et (season, 02/11). La requête croisée ramène
    // aussi (cup, 02/11), qui ne doit pas faire passer (cup, 26/10) en co-champion.
    ownChampions = [champion("cup", "2026-10-26"), champion("season", "2026-11-02")];
    sameWeekChampions = [
      { competition_id: "cup", week_end_date: "2026-10-26" },
      { competition_id: "cup", week_end_date: "2026-11-02" },
      { competition_id: "season", week_end_date: "2026-11-02" },
    ];
    competitions = [
      { id: "cup", name: "NBA Cup" },
      { id: "season", name: "Saison régulière" },
    ];

    const result = await getWeeklyPalmares(client, "me");

    expect(result.weeks.every((w) => !w.isCoChampion)).toBe(true);
  });

  it("n'affiche aucun co-champion quand la lecture des semaines échoue", async () => {
    ownChampions = [champion("cup", "2026-10-26")];
    competitions = [{ id: "cup", name: "NBA Cup" }];
    failing.add("weekly_champions:sameWeek");

    const result = await getWeeklyPalmares(client, "me");

    expect(result.state).toBe("ok");
    expect(result.weeks[0].isCoChampion).toBe(false);
  });
});
