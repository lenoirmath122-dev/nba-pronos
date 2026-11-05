import { describe, expect, it } from "vitest";
import { LOAD_MAX_ROWS, LOAD_PAGE_SIZE } from "./config";
import { loadWeekData } from "./load";
import { U1, U2, bet } from "./testFixtures";
import { fakeClient, hasFilter, type Call, type Reply } from "./testSupabase";

const WEEK_END = "2026-10-26";

function handlerFor(options: {
  settled?: number;
  refused?: number;
  pageRows?: (call: Call) => unknown[];
  fail?: string;
}) {
  return (call: Call): Reply => {
    if (options.fail === call.table) return { error: { message: "relation absente" } };
    if (call.table === "bets" && call.head) {
      return { count: hasFilter(call, "eq", "status", "REJECTED") ? (options.refused ?? 0) : (options.settled ?? 0) };
    }
    if (call.table === "bets") return { data: options.pageRows ? options.pageRows(call) : [] };
    if (call.table === "weekly_champions") return { data: [{ user_id: U2, points: "42" }] };
    if (call.table === "users") {
      return {
        data: [
          { id: U1, pseudo: "Nico", status: "ACTIVE", popup_mentions_opt_out: false },
          { id: U2, pseudo: "Alix", status: "ACTIVE", popup_mentions_opt_out: true },
        ],
      };
    }
    if (call.table === "matches") return { data: [{ id: "match-1", home_team_id: "t1", away_team_id: "t2" }] };
    if (call.table === "teams") return { data: [{ id: "t1", abbreviation: "BOS" }, { id: "t2", abbreviation: "NYK" }] };
    if (call.table === "weekly_popups" && call.head) return { count: 3 };
    if (call.table === "weekly_popups") {
      return {
        data: [
          {
            week_end_date: "2026-10-19",
            status: "PUBLISHED",
            featured_user_ids: [U1],
            content: { titre: `{{u:${U1}}} règne`, cta: "Reviens parier." },
          },
        ],
      };
    }
    return { data: [] };
  };
}

const row = (i: number) => ({ ...bet({ id: `b${i}`, user_id: U1 }), structured_threshold: "25", calculated_proba: "0.6" });

describe("loadWeekData", () => {
  it("fenêtre : lundi 10h Paris à lundi 10h Paris, heure d'été puis d'hiver", async () => {
    const { client, calls } = fakeClient(handlerFor({ settled: 1 }));
    const data = await loadWeekData("comp", WEEK_END, { client });
    // 19/10 10h (CEST) = 08:00Z ; 26/10 10h (CET) = 09:00Z.
    expect(Date.parse(data.startIso)).toBe(Date.parse("2026-10-19T08:00:00Z"));
    expect(Date.parse(data.endIso)).toBe(Date.parse("2026-10-26T09:00:00Z"));
    const head = calls.find((c) => c.table === "bets" && c.head)!;
    expect(hasFilter(head, "gte", "resolved_at", data.startIso)).toBe(true);
  });

  it("semaine pauvre (< 3) : les paris ne sont pas lus, champions et compteur le sont", async () => {
    const { client, calls } = fakeClient(handlerFor({ settled: 1, refused: 1 }));
    const data = await loadWeekData("comp", WEEK_END, { client });
    expect(data.rawCount).toBe(2);
    expect(data.bets).toEqual([]);
    expect(calls.some((c) => c.table === "bets" && !c.head)).toBe(false);
    expect(data.champions).toEqual([{ userId: U2, points: 42 }]);
    expect(data.publishedFallbackCount).toBe(3);
  });

  it("pagination par 300 : 300, 300 puis 12 ; colonnes numeric coercées", async () => {
    const pages = [LOAD_PAGE_SIZE, LOAD_PAGE_SIZE, 12];
    let index = 0;
    const { client } = fakeClient(
      handlerFor({
        settled: 612,
        pageRows: (call) => {
          if (hasFilter(call, "eq", "status", "REJECTED")) return [];
          const n = pages[index++] ?? 0;
          return Array.from({ length: n }, (_, i) => row(index * 1000 + i));
        },
      }),
    );
    const data = await loadWeekData("comp", WEEK_END, { client });
    expect(data.bets).toHaveLength(612);
    expect(data.truncated).toBe(false);
    expect(data.bets[0].structured_threshold).toBe(25);
    expect(data.bets[0].calculated_proba).toBe(0.6);
  });

  it("plafond de lecture : truncated", async () => {
    const { client } = fakeClient(
      handlerFor({
        settled: 9_999,
        pageRows: (call) =>
          hasFilter(call, "eq", "status", "REJECTED") ? [] : Array.from({ length: LOAD_PAGE_SIZE }, (_, i) => row(i)),
      }),
    );
    const data = await loadWeekData("comp", WEEK_END, { client });
    expect(data.bets).toHaveLength(LOAD_MAX_ROWS);
    expect(data.truncated).toBe(true);
  });

  it("libellés de match, historique et joueurs", async () => {
    const { client } = fakeClient(handlerFor({ settled: 3, pageRows: (c) => (hasFilter(c, "eq", "status", "REJECTED") ? [] : [row(1)]) }));
    const data = await loadWeekData("comp", WEEK_END, { client });
    expect(data.matchLabels.get("match-1")).toBe("BOS - NYK");
    expect(data.recentlyFeaturedIds.has(U1)).toBe(true);
    expect(data.recentPhrasing).toEqual({ titres: ["[joueur] règne"], cta: ["Reviens parier."] });
    expect(data.users.get(U2)?.popup_mentions_opt_out).toBe(true);
  });

  it("erreur : message avec l'indice de migration, sans donnée de joueur", async () => {
    const { client } = fakeClient(handlerFor({ fail: "weekly_champions", settled: 3 }));
    await expect(loadWeekData("comp", WEEK_END, { client })).rejects.toThrow(/migration 20261013090000 poussée \?/);
  });
});
