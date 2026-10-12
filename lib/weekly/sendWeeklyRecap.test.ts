import { describe, it, expect, vi, beforeEach } from "vitest";

type Result = { data: unknown; error: { message: string } | null };
type Row = Record<string, unknown>;

let competition: Result;
let popup: Result;
let header: Result;
let champions: Row[];
let users: Row[];
let pseudos: Row[];
let logged: Row[];
let subscriptions: Row[];
let rowsByDate: Record<string, Row[]>;
let upsertReturns: (userId: string) => Row[];
let upserts: Row[];
let pushes: Array<{ userId: string; body: string; url?: string }>;
let deleted: Array<{ table: string; filters: Record<string, unknown> }>;
let pushFails: boolean;
let snapshotDates: string[]; // du plus récent au plus ancien, pour l'aperçu

// Chaîne PostgREST minimale : mémorise les filtres, résout selon la table.
function query(table: string) {
  const filters: Record<string, unknown> = {};
  let selectedColumns = "";
  let upserted: Row | null = null;
  let isDelete = false;
  const c: Record<string, unknown> = {};
  c.select = (columns: string) => {
    selectedColumns = columns;
    return c;
  };
  c.eq = (column: string, value: unknown) => {
    filters[`eq:${column}`] = value;
    return c;
  };
  c.in = (column: string, values: unknown) => {
    filters[`in:${column}`] = values;
    return c;
  };
  c.order = () => c;
  c.limit = () => c;
  c.lt = (column: string, value: unknown) => {
    filters[`lt:${column}`] = value;
    return c;
  };
  c.upsert = (row: Row) => {
    upserted = row;
    upserts.push(row);
    return c;
  };
  c.delete = () => {
    isDelete = true;
    return c;
  };
  c.maybeSingle = () =>
    Promise.resolve(table === "competitions" ? competition : table === "weekly_popups" ? popup : header);
  const resolve = (): Result => {
    if (isDelete) {
      deleted.push({ table, filters: { ...filters } });
      return { data: null, error: null };
    }
    if (upserted) return { data: upsertReturns(upserted.user_id as string), error: null };
    switch (table) {
      case "weekly_champions":
        return { data: champions, error: null };
      case "users":
        if (selectedColumns.includes("pseudo")) return { data: pseudos, error: null };
        return {
          data: users.filter((row) => !filters["eq:id"] || row.id === filters["eq:id"]),
          error: null,
        };
      case "recap_log":
        return { data: logged, error: null };
      case "push_subscriptions":
        return { data: subscriptions, error: null };
      case "leaderboard_snapshots":
        if (selectedColumns === "snapshot_date") {
          const below = filters["lt:snapshot_date"] as string | undefined;
          const date = snapshotDates.find((candidate) => !below || candidate < below);
          return { data: date ? [{ snapshot_date: date }] : [], error: null };
        }
        return { data: rowsByDate[filters["eq:snapshot_date"] as string] ?? [], error: null };
      default:
        return { data: [], error: null };
    }
  };
  c.then = (res: (v: Result) => unknown) => res(resolve());
  return c;
}

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: () => ({ from: (table: string) => query(table) }),
}));

vi.mock("@/lib/push/send", () => ({
  sendPushToSubscriptions: vi.fn(async (subs: Array<{ user_id: string }>, payload: { body: string; url?: string }) => {
    if (pushFails) throw new Error("VAPID absent");
    pushes.push({ userId: subs[0].user_id, body: payload.body, url: payload.url });
    return { deadSubscriptionIds: [] };
  }),
}));

import { runWeeklyRecapSend } from "./sendWeeklyRecap";

const MONDAY_26 = Date.parse("2026-10-26T09:00:00Z"); // 10h Paris (CET)

const snap = (user_id: string, total_points: number) => ({
  user_id,
  total_points,
  correct_match_winners: 0,
  exact_margins: 0,
});
const sub = (user_id: string) => ({ id: `s-${user_id}`, user_id, endpoint: "e", p256dh_key: "p", auth_key: "a" });

beforeEach(() => {
  competition = { data: { id: "comp", weekly_ranking: true, weekly_popup: false }, error: null };
  popup = { data: null, error: null };
  header = { data: { start_snapshot_date: "2026-10-19", end_snapshot_date: "2026-10-26" }, error: null };
  champions = [{ user_id: "a", points: 20 }];
  users = [{ id: "a" }, { id: "b" }, { id: "c" }];
  pseudos = [{ id: "a", pseudo: "Alice" }];
  logged = [];
  subscriptions = [sub("a"), sub("b"), sub("c")];
  rowsByDate = {
    "2026-10-19": [snap("a", 10), snap("b", 10), snap("c", 10)],
    "2026-10-26": [snap("a", 30), snap("b", 14), snap("c", 10)],
  };
  upsertReturns = (userId) => [{ user_id: userId }];
  upserts = [];
  pushes = [];
  deleted = [];
  pushFails = false;
  snapshotDates = ["2026-10-26", "2026-10-19"];
});

describe("runWeeklyRecapSend", () => {
  it("refuse sans compétition active, classement désactivé ou semaine non figée", async () => {
    competition = { data: null, error: null };
    expect((await runWeeklyRecapSend(MONDAY_26)).skipped).toBe("aucune compétition active");

    competition = { data: { id: "comp", weekly_ranking: false }, error: null };
    expect((await runWeeklyRecapSend(MONDAY_26)).skipped).toBe("classement hebdo désactivé");

    competition = { data: { id: "comp", weekly_ranking: true }, error: null };
    header = { data: null, error: null };
    const result = await runWeeklyRecapSend(MONDAY_26);
    expect(result).toMatchObject({ sent: false, skipped: "semaine non figée" });
    expect(pushes).toHaveLength(0);
  });

  it("envoie à chaque joueur avec un texte personnalisé et réserve dans recap_log", async () => {
    const result = await runWeeklyRecapSend(MONDAY_26);
    expect(result).toMatchObject({ sent: true, weekEnd: "2026-10-26", notified: 3, alreadySent: 0, noSubscription: 0 });
    expect(upserts).toEqual([
      { user_id: "a", kind: "WEEKLY", recap_date: "2026-10-26" },
      { user_id: "b", kind: "WEEKLY", recap_date: "2026-10-26" },
      { user_id: "c", kind: "WEEKLY", recap_date: "2026-10-26" },
    ]);
    const bodyOf = (userId: string) => pushes.find((push) => push.userId === userId)?.body;
    expect(bodyOf("a")).toBe("Tu es champion de la semaine (+20 pts) !");
    expect(bodyOf("b")).toBe("Alice est champion de la semaine (+20 pts). Toi : +4 pts, 2e de la semaine.");
    expect(bodyOf("c")).toBe("Alice est champion de la semaine (+20 pts). À toi de jouer cette semaine !");
    expect(pushes.every((push) => push.url === "/home")).toBe(true);
  });

  describe("popup hebdo active (plan §4.5)", () => {
    beforeEach(() => {
      competition = { data: { id: "comp", weekly_ranking: true, weekly_popup: true }, error: null };
    });

    it.each([
      ["aucune ligne", null],
      ["brouillon prêt", { status: "READY" }],
      ["brouillon douteux", { status: "DOUBTFUL" }],
      ["génération en cours", { status: "GENERATING" }],
      ["popup retirée", { status: "RETRACTED" }],
    ])("refuse l'envoi réel : %s", async (_label, data) => {
      popup = { data, error: null };
      const result = await runWeeklyRecapSend(MONDAY_26);
      expect(result).toMatchObject({ sent: false, skipped: "popup non publiée" });
      expect(pushes).toHaveLength(0);
      expect(upserts).toHaveLength(0);
    });

    it.each([["publiée", "PUBLISHED"], ["écartée", "SKIPPED"]])("autorise l'envoi réel : %s", async (_label, status) => {
      popup = { data: { status }, error: null };
      const result = await runWeeklyRecapSend(MONDAY_26);
      expect(result).toMatchObject({ sent: true, notified: 3 });
    });

    it("autorise toujours l'essai, même sans popup publiée", async () => {
      popup = { data: { status: "READY" }, error: null };
      const result = await runWeeklyRecapSend(MONDAY_26, { onlyUserId: "b" });
      expect(result).toMatchObject({ sent: true, test: true, notified: 1 });
    });

    it("ne regarde pas la popup quand l'interrupteur est coupé", async () => {
      competition = { data: { id: "comp", weekly_ranking: true, weekly_popup: false }, error: null };
      popup = { data: null, error: null };
      const result = await runWeeklyRecapSend(MONDAY_26);
      expect(result).toMatchObject({ sent: true, notified: 3 });
    });
  });

  it("ne renvoie pas aux joueurs déjà servis (relance)", async () => {
    logged = [{ user_id: "a" }, { user_id: "b" }];
    const result = await runWeeklyRecapSend(MONDAY_26);
    expect(result).toMatchObject({ notified: 1, alreadySent: 2 });
    expect(pushes.map((push) => push.userId)).toEqual(["c"]);
  });

  it("n'envoie pas si la réservation est perdue (double clic concurrent)", async () => {
    upsertReturns = (userId) => (userId === "b" ? [] : [{ user_id: userId }]);
    const result = await runWeeklyRecapSend(MONDAY_26);
    expect(result).toMatchObject({ notified: 2, alreadySent: 1 });
    expect(pushes.map((push) => push.userId)).toEqual(["a", "c"]);
  });

  it("ne réserve pas les joueurs sans abonnement push", async () => {
    subscriptions = [sub("a")];
    const result = await runWeeklyRecapSend(MONDAY_26);
    expect(result).toMatchObject({ notified: 1, noSubscription: 2 });
    expect(upserts.map((row) => row.user_id)).toEqual(["a"]);
  });

  it("une semaine sans champion est annoncée comme telle", async () => {
    champions = [];
    await runWeeklyRecapSend(MONDAY_26);
    expect(pushes.find((push) => push.userId === "c")?.body).toBe(
      "Pas de champion cette semaine. À toi de jouer cette semaine !",
    );
  });

  it("libère la réservation si le push lève une exception", async () => {
    pushFails = true;
    await expect(runWeeklyRecapSend(MONDAY_26)).rejects.toThrow("VAPID absent");
    expect(deleted).toEqual([
      {
        table: "recap_log",
        filters: { "eq:user_id": "a", "eq:kind": "WEEKLY", "eq:recap_date": "2026-10-26" },
      },
    ]);
  });

  it("essai : un seul destinataire, aucune réservation, aperçu si semaine non figée", async () => {
    header = { data: null, error: null };
    const result = await runWeeklyRecapSend(MONDAY_26, { onlyUserId: "b" });
    expect(result).toMatchObject({ sent: true, test: true, preview: true, notified: 1 });
    expect(pushes).toEqual([
      { userId: "b", body: "Alice est champion de la semaine (+20 pts). Toi : +4 pts, 2e de la semaine.", url: "/home" },
    ]);
    expect(upserts).toHaveLength(0);
  });

  it("essai : même sur une semaine figée, rien n'est réservé et les déjà servis sont ignorés", async () => {
    logged = [{ user_id: "b" }];
    const result = await runWeeklyRecapSend(MONDAY_26, { onlyUserId: "b" });
    expect(result).toMatchObject({ test: true, preview: false, notified: 1 });
    expect(upserts).toHaveLength(0);
  });
});
