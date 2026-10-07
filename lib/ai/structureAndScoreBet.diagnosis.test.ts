// Motif de non-calcul écrit par structureAndScoreBet() (GAPS_OUVERTS.md,
// « Couverture des types de paris », étape 1-A) -- vérifie
// p_calculability_diagnosis.reason sur chaque famille de cause. Aucun appel
// IA ni base réelle : tout est mocké.

import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  tables: {} as Record<string, { single?: unknown; rows?: unknown[] }>,
  spend: 0,
}));

function chain(table: string) {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in"]) c[m] = () => c;
  c.maybeSingle = async () => ({ data: h.tables[table]?.single ?? null, error: null });
  c.then = (resolve: (v: unknown) => unknown) => resolve({ data: h.tables[table]?.rows ?? [], error: null });
  return c;
}

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: async () => ({ from: (t: string) => chain(t), rpc: h.rpc }),
}));
vi.mock("./usageTracking", () => ({
  DAILY_COST_CAP_USD: 10,
  getTodaySpendUsd: async () => h.spend,
}));
vi.mock("./roster", () => ({ resolveKnownRosters: async () => null }));
vi.mock("./structureBet", () => ({ structureBet: vi.fn() }));
vi.mock("./structurePeriodBet", () => ({ structurePeriodBet: vi.fn() }));
vi.mock("./structureRosterSplitBet", () => ({ structureRosterSplitBet: vi.fn() }));
vi.mock("./structureRosterCountBet", () => ({ structureRosterCountBet: vi.fn() }));
vi.mock("./structureSuperlativeBet", () => ({ structureSuperlativeBet: vi.fn() }));
vi.mock("./structureTechnicalFoulsCountBet", () => ({ structureTechnicalFoulsCountBet: vi.fn() }));
vi.mock("./structureLastBasketBet", () => ({ structureLastBasketBet: vi.fn() }));
vi.mock("./structureBlockOnPlayerBet", () => ({ structureBlockOnPlayerBet: vi.fn() }));
vi.mock("./structureComboBet", () => ({ structureComboNestedBet: vi.fn() }));
vi.mock("./statsService", () => ({
  predictOverUnder: vi.fn(),
  predictSeriesStat: vi.fn(),
  predictTotalPoints: vi.fn(),
  predictTotalTeamStat: vi.fn(),
  predictTeamStat: vi.fn(),
  predictComparison: vi.fn(),
  predictCombo: vi.fn(),
  predictOvertime: vi.fn(),
  predictTotalTimeouts: vi.fn(),
  predictBackcourtTurnover: vi.fn(),
  predictBuzzerBeater: vi.fn(),
  predictPeriodTeamOutcome: vi.fn(),
  predictPlayerPeriodStat: vi.fn(),
  predictRosterSplit: vi.fn(),
  predictRosterCount: vi.fn(),
  predictSuperlative: vi.fn(),
  predictTechnicalFoulsCount: vi.fn(),
  predictLastBasket: vi.fn(),
  predictBlockOnPlayer: vi.fn(),
}));

import { structureAndScoreBet } from "./structureAndScoreBet";
import { structureBet } from "./structureBet";
import { structurePeriodBet } from "./structurePeriodBet";
import { predictOverUnder, predictTeamStat } from "./statsService";

const GENERAL_TEXT = "Jalen Brunson marque plus de 20 points.";
const PERIOD_TEXT = "Les Knicks mènent au 3ème quart-temps et gagnent le match.";

const MATCH_ROW = { home_team_id: "t1", away_team_id: "t2", scheduled_at: "2026-10-20T00:30:00Z" };

function setTables(withMatch = true) {
  h.tables = {
    series: { single: { team1_id: "t1", team2_id: "t2" } },
    teams: {
      rows: [
        { id: "t1", name: "Knicks" },
        { id: "t2", name: "Celtics" },
      ],
    },
    matches: { single: withMatch ? MATCH_ROW : null },
  };
}

type Call = Record<string, unknown>;
function lastCall(): Call {
  return h.rpc.mock.calls.at(-1)![1] as Call;
}
function diagnosis(): Record<string, unknown> {
  return lastCall().p_calculability_diagnosis as Record<string, unknown>;
}

const TEAM_STAT_STRUCT = {
  calculable: true,
  bet_subject: "TEAM_STAT",
  reasoning: "x",
  team_stat: { team: "team1", stat: "pts", threshold: 100, comparison: "OVER" },
};

const PLAYER_STRUCT = {
  calculable: true,
  bet_subject: "PLAYER",
  reasoning: "ok",
  player: { name: "Jalen Brunson", stat: "pts", threshold: 20, comparison: "OVER", team: "team1", not_in_match: false },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.spend = 0;
  h.rpc.mockResolvedValue({ error: null });
  setTables();
});

describe("motif de non-calcul", () => {
  it("plafond de dépense atteint -> AI_COST_CAP, sans appel IA", async () => {
    h.spend = 10;
    await structureAndScoreBet("b1", GENERAL_TEXT, "s1", "MATCH", "m1");
    expect(diagnosis()).toMatchObject({ reason: "AI_COST_CAP", group: "OPERATIONAL", raw_text: GENERAL_TEXT });
    expect(structureBet).not.toHaveBeenCalled();
  });

  it("structureBet null -> AI_UNAVAILABLE", async () => {
    vi.mocked(structureBet).mockResolvedValue(null);
    await structureAndScoreBet("b1", GENERAL_TEXT, "s1", "MATCH", "m1");
    expect(diagnosis()).toMatchObject({ reason: "AI_UNAVAILABLE", route: "GENERAL", subject: null });
  });

  it("calculable=false -> UNKNOWN_TYPE, avec le raisonnement de l'IA", async () => {
    vi.mocked(structureBet).mockResolvedValue({ calculable: false, bet_subject: null, reasoning: "pas un type connu" } as never);
    await structureAndScoreBet("b1", GENERAL_TEXT, "s1", "MATCH", "m1");
    expect(diagnosis()).toMatchObject({ reason: "UNKNOWN_TYPE", group: "COVERAGE", ai_reasoning: "pas un type connu" });
    expect(lastCall()).toMatchObject({ p_is_calculable: false, p_calculated_proba: null });
  });

  it("PERIOD avec un autre bet_subject -> ROUTE_MISMATCH", async () => {
    vi.mocked(structurePeriodBet).mockResolvedValue({ calculable: true, bet_subject: "GENERAL", reasoning: "x" } as never);
    await structureAndScoreBet("b1", PERIOD_TEXT, "s1", "MATCH", "m1");
    expect(diagnosis()).toMatchObject({ reason: "ROUTE_MISMATCH", route: "PERIOD", subject: "GENERAL" });
  });

  it("TEAM_STAT en SÉRIE -> SERIES_SCOPE_UNSUPPORTED", async () => {
    vi.mocked(structureBet).mockResolvedValue(TEAM_STAT_STRUCT as never);
    await structureAndScoreBet("b1", GENERAL_TEXT, "s1", "SERIES", null);
    expect(diagnosis()).toMatchObject({ reason: "SERIES_SCOPE_UNSUPPORTED" });
  });

  it("match introuvable -> MATCH_CONTEXT_MISSING", async () => {
    setTables(false);
    vi.mocked(structureBet).mockResolvedValue(TEAM_STAT_STRUCT as never);
    await structureAndScoreBet("b1", GENERAL_TEXT, "s1", "MATCH", "m1");
    expect(diagnosis()).toMatchObject({ reason: "MATCH_CONTEXT_MISSING" });
  });

  it("prédiction nulle -> STATS_NO_PREDICTION", async () => {
    vi.mocked(structureBet).mockResolvedValue(TEAM_STAT_STRUCT as never);
    vi.mocked(predictTeamStat).mockResolvedValue(null);
    await structureAndScoreBet("b1", GENERAL_TEXT, "s1", "MATCH", "m1");
    expect(diagnosis()).toMatchObject({ reason: "STATS_NO_PREDICTION", group: "OPERATIONAL" });
  });

  it("combo avec une stat interdite dans une somme -> UNSUPPORTED_STAT", async () => {
    vi.mocked(structureBet).mockResolvedValue({
      calculable: true,
      bet_subject: "COMBO",
      reasoning: "x",
      combo_bet: {
        conditions: [{ kind: "PLAYER", players: ["A", "B"], stats: ["zzz"], threshold: 5, comparison: "OVER" }],
      },
    } as never);
    await structureAndScoreBet("b1", GENERAL_TEXT, "s1", "MATCH", "m1");
    expect(diagnosis()).toMatchObject({ reason: "UNSUPPORTED_STAT", group: "COVERAGE" });
  });

  it("LEADS_HALF_RESULT en Q3 -> NO_MODEL_FOR_PERIOD avec estimation informative", async () => {
    vi.mocked(structurePeriodBet).mockResolvedValue({
      calculable: true,
      bet_subject: "PERIOD",
      reasoning: "x",
      period_bet: {
        player: null,
        period: "Q3",
        outcome_kind: "LEADS_HALF_RESULT",
        team: "team1",
        comparison: "OVER",
        threshold: null,
        exact_count: null,
        player_stat: null,
      },
    } as never);
    await structureAndScoreBet("b1", PERIOD_TEXT, "s1", "MATCH", "m1");
    expect(diagnosis()).toMatchObject({ reason: "NO_MODEL_FOR_PERIOD" });
    expect(lastCall().p_calculated_proba).not.toBeNull();
    expect(lastCall().p_is_calculable).toBe(false);
  });

  it("SÉRIE sans match 1 -> SERIES_CONTEXT_MISSING", async () => {
    setTables(false);
    vi.mocked(structureBet).mockResolvedValue(PLAYER_STRUCT as never);
    await structureAndScoreBet("b1", GENERAL_TEXT, "s1", "SERIES", null);
    expect(diagnosis()).toMatchObject({ reason: "SERIES_CONTEXT_MISSING" });
  });
});

describe("écriture", () => {
  it("un chemin calculable ne passe pas p_calculability_diagnosis", async () => {
    vi.mocked(structureBet).mockResolvedValue(PLAYER_STRUCT as never);
    vi.mocked(predictOverUnder).mockResolvedValue({ proba: 0.5, playerId: 7 } as never);
    await structureAndScoreBet("b1", GENERAL_TEXT, "s1", "MATCH", "m1");
    expect(lastCall()).toMatchObject({ p_is_calculable: true });
    expect("p_calculability_diagnosis" in lastCall()).toBe(false);
  });

  it("PGRST202 (migration pas poussée) -> second appel sans le paramètre", async () => {
    vi.mocked(structureBet).mockResolvedValue(null);
    h.rpc.mockResolvedValueOnce({ error: { code: "PGRST202" } }).mockResolvedValueOnce({ error: null });
    await structureAndScoreBet("b1", GENERAL_TEXT, "s1", "MATCH", "m1");
    expect(h.rpc).toHaveBeenCalledTimes(2);
    expect("p_calculability_diagnosis" in (h.rpc.mock.calls[0][1] as Call)).toBe(true);
    expect("p_calculability_diagnosis" in (h.rpc.mock.calls[1][1] as Call)).toBe(false);
    expect(h.rpc.mock.calls[1][1]).toMatchObject({ p_is_calculable: false });
  });

  it("une erreur RPC est journalisée sans le texte du pari", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(structureBet).mockResolvedValue(null);
    h.rpc.mockResolvedValue({ error: { code: "23514", message: GENERAL_TEXT } });
    await structureAndScoreBet("b1", GENERAL_TEXT, "s1", "MATCH", "m1");
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0][0]);
    expect(msg).toContain("b1");
    expect(msg).toContain("AI_UNAVAILABLE");
    expect(msg).not.toContain("Brunson");
    warn.mockRestore();
  });
});
