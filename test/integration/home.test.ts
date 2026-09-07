// Tests d'intégration lib/queries/home.ts (p1-1, feuille de route Phase 1) --
// zéro test sur ce module avant ça. Même patron que leaderboard.test.ts et
// bracket.test.ts (getServerClient mocké vers un vrai client Supabase local
// signé). getRemainingSeriesBets()/getRemainingMatchBets() (lib/queries/
// series-bets.ts, match-bets.ts) appellent elles-mêmes getServerClient() en
// interne -- couvertes par le même mock global, jamais appelées directement
// ici.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { type SupabaseClient } from "@supabase/supabase-js";
import {
  createSignedInTestUser,
  createTwoTestTeams,
  deleteCompetitionCascade,
  deleteTestTeams,
  createActiveCompetition,
  newRunId,
  purgeLeftoverTestUsers,
  serviceClient,
} from "./fixtures";

const RUN_ID = newRunId();
const EMAIL_DOMAIN = "@home-test.local";

const state = vi.hoisted(() => ({ client: null as SupabaseClient | null }));
vi.mock("@/lib/supabase/server", () => ({
  getServerClient: async () => state.client,
}));

const { getHomeData } = await import("@/lib/queries/home");

let userA: { id: string; client: SupabaseClient };
let userB: { id: string; client: SupabaseClient };
let userAdmin: { id: string; client: SupabaseClient };
let competitionId: string;
let teamA: { id: string; abbreviation: string };
let teamB: { id: string; abbreviation: string };

const inHours = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString();

beforeAll(async () => {
  await purgeLeftoverTestUsers(EMAIL_DOMAIN);

  userA = await createSignedInTestUser("a", RUN_ID, EMAIL_DOMAIN);
  userB = await createSignedInTestUser("b", RUN_ID, EMAIL_DOMAIN);
  userAdmin = await createSignedInTestUser("admin", RUN_ID, EMAIL_DOMAIN);
  const { error: promoteError } = await serviceClient.from("users").update({ role: "ADMIN" }).eq("id", userAdmin.id);
  if (promoteError) throw new Error(`Promotion admin échouée: ${promoteError.message}`);

  [teamA, teamB] = await createTwoTestTeams(RUN_ID);

  // Deadline lointaine par défaut -- chaque describe qui a besoin d'une
  // structure de bracket la pose elle-même.
  competitionId = await createActiveCompetition({ runId: RUN_ID, type: "PLAYOFFS", bracketDeadline: inHours(48) });
});

afterAll(async () => {
  await deleteCompetitionCascade(competitionId);
  await deleteTestTeams([teamA.id, teamB.id]);
  await serviceClient.auth.admin.deleteUser(userA.id);
  await serviceClient.auth.admin.deleteUser(userB.id);
  await serviceClient.auth.admin.deleteUser(userAdmin.id);
});

describe("getHomeData -- garde de session", () => {
  it("aucun utilisateur connecté -> données vides (ne devrait pas arriver en pratique, le layout garde déjà la session)", async () => {
    const anon = (await import("@supabase/supabase-js")).createClient(
      (await import("./env")).LOCAL_SUPABASE.url,
      (await import("./env")).LOCAL_SUPABASE.anonKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    state.client = anon;
    const data = await getHomeData();
    expect(data.header).toBeNull();
    expect(data.todo).toHaveLength(0);
  });
});

describe("getHomeData -- en-tête (rang, pointsBehindLeader)", () => {
  let seriesId: string;

  beforeAll(async () => {
    const { data: series, error } = await serviceClient
      .from("series")
      .insert({ competition_id: competitionId, round: "ROUND_1", conference: "EAST", slot_index: 0, official_status: "SCHEDULED" })
      .select("id")
      .single();
    if (error || !series) throw new Error(error?.message);
    seriesId = series.id;

    const { error: betsError } = await serviceClient.from("bets").insert([
      {
        competition_id: competitionId,
        user_id: userB.id,
        scope: "SERIES",
        series_id: seriesId,
        description: "Test home -- pari de B (leader)",
        status: "WON",
        points_awarded: 100,
        proposed_category: "TEAM_PROP",
        proposed_difficulty: 3,
      },
      {
        competition_id: competitionId,
        user_id: userA.id,
        scope: "SERIES",
        series_id: seriesId,
        description: "Test home -- pari de A",
        status: "WON",
        points_awarded: 40,
        proposed_category: "TEAM_PROP",
        proposed_difficulty: 2,
      },
    ]);
    if (betsError) throw new Error(`Insertion bets échouée: ${betsError.message}`);
  });

  afterAll(async () => {
    await serviceClient.from("bets").delete().eq("series_id", seriesId);
    await serviceClient.from("series").delete().eq("id", seriesId);
  });

  it("B est leader (rank 1, pointsBehindLeader null)", async () => {
    state.client = userB.client;
    const data = await getHomeData();
    expect(data.header?.rank).toBe(1);
    expect(data.header?.totalPoints).toBe(100);
    expect(data.header?.pointsBehindLeader).toBeNull();
  });

  it("A est 2e (rank 2, pointsBehindLeader = écart avec B)", async () => {
    state.client = userA.client;
    const data = await getHomeData();
    expect(data.header?.rank).toBe(2);
    expect(data.header?.totalPoints).toBe(40);
    expect(data.header?.pointsBehindLeader).toBe(60);
  });
});

describe("getHomeData -- « À traiter » (tri par deadline la plus proche)", () => {
  let seriesId: string;
  let matchToPredictId: string;
  let matchForBetId: string;
  let betId: string;

  beforeAll(async () => {
    const { data: series, error: seriesError } = await serviceClient
      .from("series")
      .insert({ competition_id: competitionId, round: "ROUND_1", conference: "EAST", slot_index: 1, official_status: "SCHEDULED" })
      .select("id")
      .single();
    if (seriesError || !series) throw new Error(seriesError?.message);
    seriesId = series.id;

    // 2 matchs de CETTE série : celui à pronostiquer (deadline la plus
    // lointaine des 3 items, status SCHEDULED -- seul statut lu par
    // getMatchesTodo) et celui visé par le pari MATCH ci-dessous (deadline la
    // plus proche -- doit sortir en tête du tri). Ce 2e match est marqué
    // IN_PROGRESS pour ne PAS être lui-même compté comme "à pronostiquer"
    // (computeBetDeadlines ne lit que scheduled_at, jamais status -- seul
    // getMatchesTodo filtre sur SCHEDULED).
    const { data: matches, error: matchesError } = await serviceClient
      .from("matches")
      .insert([
        { competition_id: competitionId, series_id: seriesId, game_number: 1, scheduled_at: inHours(24), home_team_id: teamA.id, away_team_id: teamB.id, status: "SCHEDULED" },
        { competition_id: competitionId, series_id: seriesId, game_number: 2, scheduled_at: inHours(3), status: "IN_PROGRESS" },
      ])
      .select("id");
    if (matchesError || !matches || matches.length !== 2) throw new Error(matchesError?.message);
    [{ id: matchToPredictId }, { id: matchForBetId }] = matches as { id: string }[];

    const { data: bet, error: betError } = await userA.client
      .from("bets")
      .insert({
        competition_id: competitionId,
        user_id: userA.id,
        scope: "MATCH",
        series_id: seriesId,
        match_id: matchForBetId,
        description: "Test home -- pari brouillon de A",
        status: "DRAFT",
        proposed_category: "SCORE_TOTAL",
        proposed_difficulty: 1,
      })
      .select("id")
      .single();
    if (betError || !bet) throw new Error(`Insertion du pari brouillon échouée: ${betError?.message}`);
    betId = bet.id;
  });

  afterAll(async () => {
    await serviceClient.from("bets").delete().eq("id", betId);
    await serviceClient.from("matches").delete().eq("series_id", seriesId);
    await serviceClient.from("series").delete().eq("id", seriesId);
  });

  it("liste bracket + matchs + paris, triés par deadline croissante (le pari MATCH à +3h en premier)", async () => {
    state.client = userA.client;
    const data = await getHomeData();
    const kinds = data.todo.map((item) => item.kind);
    expect(kinds).toEqual(["bets", "matches", "bracket"]);

    const betsItem = data.todo.find((item) => item.kind === "bets")!;
    expect(betsItem.count).toBe(1);
    expect(betsItem.href).toBe("/play"); // DRAFT -> édité sur /play, pas /play/bets/new

    const matchesItem = data.todo.find((item) => item.kind === "matches")!;
    expect(matchesItem.matchup).toEqual({
      home: { abbreviation: teamA.abbreviation, name: expect.any(String) },
      away: { abbreviation: teamB.abbreviation, name: expect.any(String) },
      gameNumber: 1,
    });
    // Confirme que c'est bien matchToPredictId (+24h) qui pilote la deadline
    // de l'item "matches", pas matchForBetId (+3h, IN_PROGRESS -- exclu de
    // getMatchesTodo, seulement visé par le pari MATCH ci-dessus).
    const { data: match } = await serviceClient.from("matches").select("scheduled_at").eq("id", matchToPredictId).single();
    expect(matchesItem.deadline).toBe(match?.scheduled_at);
  });

  it("le pari brouillon disparaît de « À traiter » une fois SUBMITTED (pas DRAFT/REJECTED)", async () => {
    const { error } = await serviceClient.from("bets").update({ status: "SUBMITTED" }).eq("id", betId);
    if (error) throw new Error(error.message);
    try {
      state.client = userA.client;
      const data = await getHomeData();
      expect(data.todo.some((item) => item.kind === "bets")).toBe(false);
    } finally {
      await serviceClient.from("bets").update({ status: "DRAFT" }).eq("id", betId);
    }
  });
});

describe("getHomeData -- « À traiter (admin) »", () => {
  let seriesId: string;
  let betId: string;

  beforeAll(async () => {
    const { data: series, error: seriesError } = await serviceClient
      .from("series")
      .insert({ competition_id: competitionId, round: "ROUND_1", conference: "WEST", slot_index: 2, official_status: "SCHEDULED" })
      .select("id")
      .single();
    if (seriesError || !series) throw new Error(seriesError?.message);
    seriesId = series.id;

    const { data: bet, error: betError } = await userA.client
      .from("bets")
      .insert({
        competition_id: competitionId,
        user_id: userA.id,
        scope: "SERIES",
        series_id: seriesId,
        description: "Test home -- pari à valider",
        status: "DRAFT",
        proposed_category: "TEAM_PROP",
        proposed_difficulty: 1,
      })
      .select("id")
      .single();
    if (betError || !bet) throw new Error(betError?.message);
    betId = bet.id;
    const { error: submitError } = await serviceClient.from("bets").update({ status: "SUBMITTED" }).eq("id", betId);
    if (submitError) throw new Error(submitError.message);
  });

  afterAll(async () => {
    await serviceClient.from("bets").delete().eq("id", betId);
    await serviceClient.from("series").delete().eq("id", seriesId);
  });

  it("vide pour un joueur non-admin", async () => {
    state.client = userA.client;
    const data = await getHomeData();
    expect(data.adminTodo).toHaveLength(0);
  });

  it("compte les paris SUBMITTED pour un admin", async () => {
    state.client = userAdmin.client;
    const data = await getHomeData();
    expect(data.adminTodo).toHaveLength(1);
    expect(data.adminTodo[0].count).toBe(1);
    expect(data.adminTodo[0].href).toBe("/admin/validation");
  });
});

describe("getHomeData -- « Ça vient de tomber » (fenêtre de 48h)", () => {
  let seriesId: string;
  let matchId: string;

  beforeAll(async () => {
    const { data: series, error: seriesError } = await serviceClient
      .from("series")
      .insert({ competition_id: competitionId, round: "ROUND_1", conference: "WEST", slot_index: 3, official_status: "FINISHED" })
      .select("id")
      .single();
    if (seriesError || !series) throw new Error(seriesError?.message);
    seriesId = series.id;

    const { data: match, error: matchError } = await serviceClient
      .from("matches")
      .insert({
        competition_id: competitionId,
        series_id: seriesId,
        game_number: 1,
        scheduled_at: inHours(-72),
        status: "FINISHED",
        home_team_id: teamA.id,
        away_team_id: teamB.id,
        home_score: 110,
        away_score: 100,
      })
      .select("id")
      .single();
    if (matchError || !match) throw new Error(matchError?.message);
    matchId = match.id;

    const { error: predictionsError } = await serviceClient.from("match_predictions").insert([
      {
        competition_id: competitionId,
        user_id: userA.id,
        match_id: matchId,
        status: "VALIDATED",
        is_winner_correct: true,
        margin_diff: 3,
        winner_points: 10,
        margin_bonus_points: 0,
        scored_at: inHours(-1), // récent -- dans la fenêtre de 48h
      },
    ]);
    if (predictionsError) throw new Error(predictionsError.message);
  });

  afterAll(async () => {
    await serviceClient.from("match_predictions").delete().eq("match_id", matchId);
    await serviceClient.from("matches").delete().eq("id", matchId);
    await serviceClient.from("series").delete().eq("id", seriesId);
  });

  it("affiche le match scoré récent, avec le bon libellé et lien vers Résultats", async () => {
    state.client = userA.client;
    const data = await getHomeData();
    const item = data.feed.find((entry) => entry.kind === "match_scored");
    expect(item).toBeDefined();
    expect(item!.outcome).toBe("win");
    expect(item!.points).toBe(10);
    expect(item!.label).toContain(`${teamA.abbreviation} 110 - 100 ${teamB.abbreviation}`);
    expect(item!.href).toContain(`#match-${matchId}`);
  });

  it("un score vieux de plus de 48h n'apparaît plus dans le feed", async () => {
    const { error } = await serviceClient
      .from("match_predictions")
      .update({ scored_at: inHours(-72) })
      .eq("match_id", matchId);
    if (error) throw new Error(error.message);
    try {
      state.client = userA.client;
      const data = await getHomeData();
      expect(data.feed.some((entry) => entry.kind === "match_scored")).toBe(false);
    } finally {
      await serviceClient.from("match_predictions").update({ scored_at: inHours(-1) }).eq("match_id", matchId);
    }
  });
});
