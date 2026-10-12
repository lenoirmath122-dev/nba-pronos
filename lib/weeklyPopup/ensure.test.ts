import { describe, expect, it, vi } from "vitest";
import { ensureWeeklyPopupDraft, reserveRegeneration } from "./ensure";
import { fakeClient, hasFilter, type Call, type Reply } from "./testSupabase";

// Lundi 26/10/2026 : 10h Paris = 09:00Z (heure d'hiver).
const MONDAY_0900Z = Date.parse("2026-10-26T09:00:00Z");
const MONDAY_0800Z = Date.parse("2026-10-26T08:00:00Z");
const WEDNESDAY = Date.parse("2026-10-28T12:00:00Z");
const DEADLINE = MONDAY_0900Z + 270_000;

type World = {
  competition?: { id: string; weekly_ranking: boolean; weekly_popup: boolean } | null;
  frozen?: boolean;
  popup?: { id: string; status: string; generation_id: string | null; generation_started_at: string | null } | null;
  upsertRows?: unknown[];
  updateRows?: unknown[];
  failTable?: string;
};

function setup(world: World = {}) {
  const w: World = {
    competition: { id: "comp", weekly_ranking: true, weekly_popup: true },
    frozen: true,
    popup: null,
    upsertRows: [{ id: "popup-new" }],
    updateRows: [{ id: "popup-1" }],
    ...world,
  };
  const { client, calls } = fakeClient((call: Call): Reply => {
    if (w.failTable === call.table) return { error: { message: "absente" } };
    if (call.table === "competitions") return { data: w.competition };
    if (call.table === "weekly_rankings") return { data: w.frozen ? { week_end_date: "x" } : null };
    if (call.table === "weekly_popups" && call.op === "select") return { data: w.popup };
    if (call.table === "weekly_popups" && call.op === "upsert") return { data: w.upsertRows };
    if (call.table === "weekly_popups" && call.op === "update") return { data: w.updateRows };
    return { data: null };
  });
  const tasks: (() => Promise<void>)[] = [];
  const run = vi.fn().mockResolvedValue({});
  const deps = {
    client,
    schedule: (task: () => Promise<void>) => void tasks.push(task),
    newId: () => "gen-new",
    run: run as never,
  };
  return { deps, calls, tasks, run };
}

const ensure = (nowMs: number, deps: ReturnType<typeof setup>["deps"], trigger: "CRON" | "ADMIN_FREEZE" = "CRON") =>
  ensureWeeklyPopupDraft(nowMs, { trigger, deadlineMs: DEADLINE, deps });

describe("ensureWeeklyPopupDraft : pas de génération", () => {
  it("aucune compétition active", async () => {
    const s = setup({ competition: null });
    expect(await ensure(MONDAY_0900Z, s.deps)).toMatchObject({ action: "none", reason: "aucune compétition active" });
  });
  it("popup désactivée", async () => {
    const s = setup({ competition: { id: "comp", weekly_ranking: true, weekly_popup: false } });
    expect(await ensure(MONDAY_0900Z, s.deps)).toMatchObject({ reason: "popup désactivée" });
  });
  it("semaine non figée", async () => {
    const s = setup({ frozen: false });
    expect(await ensure(MONDAY_0900Z, s.deps)).toMatchObject({ reason: "semaine non figée" });
  });
  it.each(["READY", "DOUBTFUL", "PUBLISHED", "SKIPPED", "RETRACTED"])("ligne %s : rien", async (status) => {
    const s = setup({ popup: { id: "popup-1", status, generation_id: "g", generation_started_at: null } });
    const r = await ensure(MONDAY_0900Z, s.deps);
    expect(r).toMatchObject({ action: "none", reason: "déjà générée", popupId: "popup-1" });
    expect(s.tasks).toHaveLength(0);
  });
  it("GENERATING de moins de 10 min : rien", async () => {
    const started = new Date(MONDAY_0900Z - 5 * 60_000).toISOString();
    const s = setup({ popup: { id: "popup-1", status: "GENERATING", generation_id: "g", generation_started_at: started } });
    expect(await ensure(MONDAY_0900Z, s.deps)).toMatchObject({ reason: "génération en cours" });
    expect(s.tasks).toHaveLength(0);
  });
});

describe("ensureWeeklyPopupDraft : génération", () => {
  it("ligne absente : réservation (upsert ignoreDuplicates) puis planification", async () => {
    const s = setup();
    const r = await ensure(MONDAY_0900Z, s.deps);
    expect(r).toEqual({ action: "scheduled", weekEnd: "2026-10-26", popupId: "popup-new" });
    const upsert = s.calls.find((c) => c.op === "upsert")!;
    expect(upsert.upsertOptions).toEqual({ onConflict: "competition_id,week_end_date", ignoreDuplicates: true });
    expect(upsert.payload).toMatchObject({ status: "GENERATING", generation_id: "gen-new", kind: "LLM" });
    expect(s.tasks).toHaveLength(1);
    await s.tasks[0]();
    expect(s.run).toHaveBeenCalledWith("popup-new", "gen-new", { deadlineMs: DEADLINE, trigger: "CRON" });
  });

  it("réservation concurrente (upsert vide) : pas de planification", async () => {
    const s = setup({ upsertRows: [] });
    const r = await ensure(MONDAY_0900Z, s.deps);
    expect(r).toMatchObject({ action: "none", reason: "réservée par un autre passage" });
    expect(s.tasks).toHaveLength(0);
  });

  it("GENERATING de plus de 10 min : reprise avec un nouvel identifiant", async () => {
    const started = new Date(MONDAY_0900Z - 11 * 60_000).toISOString();
    const s = setup({ popup: { id: "popup-1", status: "GENERATING", generation_id: "old", generation_started_at: started } });
    const r = await ensure(MONDAY_0900Z, s.deps);
    expect(r).toMatchObject({ action: "scheduled", popupId: "popup-1" });
    const update = s.calls.find((c) => c.op === "update")!;
    expect(update.payload).toMatchObject({ generation_id: "gen-new", admin_notified_at: null });
    expect(hasFilter(update, "eq", "generation_id", "old")).toBe(true);
  });

  it("26/10 à 08:00Z (hiver) : la semaine close est encore celle du 19/10, plus de 36 h, rien", async () => {
    const s = setup();
    const r = await ensure(MONDAY_0800Z, s.deps);
    expect(r).toMatchObject({ action: "none", weekEnd: "2026-10-19", reason: "semaine trop ancienne" });
    expect(s.tasks).toHaveLength(0);
  });

  it("26/10 à 09:00Z : la semaine du 26/10 est générée", async () => {
    const s = setup();
    expect((await ensure(MONDAY_0900Z, s.deps)).weekEnd).toBe("2026-10-26");
    expect(s.tasks).toHaveLength(1);
  });

  it("GENERATING périmé sur une semaine trop ancienne : DOUBTFUL stale", async () => {
    const started = new Date(WEDNESDAY - 3 * 3_600_000).toISOString();
    const s = setup({ popup: { id: "popup-1", status: "GENERATING", generation_id: "old", generation_started_at: started } });
    const r = await ensure(WEDNESDAY, s.deps);
    expect(r.reason).toBe("semaine trop ancienne");
    const update = s.calls.find((c) => c.op === "update")!;
    expect(update.payload).toMatchObject({ status: "DOUBTFUL", doubt_code: "stale" });
  });

  it("figement admin un mercredi : la garde de 36 h ne s'applique pas", async () => {
    const s = setup();
    const r = await ensure(WEDNESDAY, s.deps, "ADMIN_FREEZE");
    expect(r.action).toBe("scheduled");
  });

  it("erreur de lecture : lève avec l'indice de migration", async () => {
    const s = setup({ failTable: "weekly_popups" });
    await expect(ensure(MONDAY_0900Z, s.deps)).rejects.toThrow(/migration 20261013090000 poussée \?/);
  });
});

describe("reserveRegeneration", () => {
  it("READY, DOUBTFUL ou SKIPPED repassent à GENERATING", async () => {
    const { client, calls } = fakeClient(() => ({ data: [{ id: "p1" }] }));
    const r = await reserveRegeneration("p1", MONDAY_0900Z, { client, newId: () => "gen-2" });
    expect(r).toEqual({ ok: true, generationId: "gen-2" });
    expect(hasFilter(calls[0], "in", "status", ["READY", "DOUBTFUL", "SKIPPED"])).toBe(true);
  });

  it("PUBLISHED, RETRACTED ou génération récente : refusé", async () => {
    const { client } = fakeClient(() => ({ data: [] }));
    const r = await reserveRegeneration("p1", MONDAY_0900Z, { client });
    expect(r.ok).toBe(false);
  });
});
