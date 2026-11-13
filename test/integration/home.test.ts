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
const { dailyPeriod } = await import("@/lib/recaps/period");

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
    expect(data.nights).toHaveLength(0);
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

// « À traiter » et « À traiter (admin) » ne sont plus sur l'Actualité depuis
// le 13/11/2026 (Jouer les porte) : leurs tests sont partis avec eux.

describe("getHomeData -- carte « Ta nuit » (même fenêtre que le récap)", () => {
  let seriesId: string;
  let matchId: string;
  const night = dailyPeriod(Date.now());
  const inNight = new Date(Date.parse(night.startIso) + 60 * 60 * 1000).toISOString();
  const beforeNight = new Date(Date.parse(night.startIso) - 60 * 60 * 1000).toISOString();

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
        scheduled_at: inNight,
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
        scored_at: inHours(-1),
      },
    ]);
    if (predictionsError) throw new Error(predictionsError.message);
  });

  afterAll(async () => {
    await serviceClient.from("match_predictions").delete().eq("match_id", matchId);
    await serviceClient.from("matches").delete().eq("id", matchId);
    await serviceClient.from("series").delete().eq("id", seriesId);
  });

  it("liste le match de la nuit, avec le bon libellé et lien vers Résultats", async () => {
    state.client = userA.client;
    const data = await getHomeData();
    expect(data.nights[0].recapDate).toBe(night.recapDate);
    const item = data.nights[0].items.find((entry) => entry.kind === "match_scored");
    expect(item).toBeDefined();
    expect(item!.outcome).toBe("win");
    expect(item!.points).toBe(10);
    expect(item!.label).toContain(`${teamA.abbreviation} 110 - 100 ${teamB.abbreviation}`);
    expect(item!.href).toContain(`#match-${matchId}`);
    expect(data.latestFeedAt).not.toBeNull();
  });

  it("un match de la nuit d'avant n'apparaît pas, même scoré récemment (scored_at réécrit au recalcul)", async () => {
    const { error } = await serviceClient.from("matches").update({ scheduled_at: beforeNight }).eq("id", matchId);
    if (error) throw new Error(error.message);
    try {
      state.client = userA.client;
      const data = await getHomeData();
      expect(data.nights[0].items.some((entry) => entry.kind === "match_scored")).toBe(false);
    } finally {
      await serviceClient.from("matches").update({ scheduled_at: inNight }).eq("id", matchId);
    }
  });

  it("?nuits=2 ajoute la nuit précédente, qui reprend ce match", async () => {
    const { error } = await serviceClient.from("matches").update({ scheduled_at: beforeNight }).eq("id", matchId);
    if (error) throw new Error(error.message);
    try {
      state.client = userA.client;
      const data = await getHomeData({ nights: 2 });
      expect(data.nights).toHaveLength(2);
      expect(data.nights[1].items.some((entry) => entry.kind === "match_scored")).toBe(true);
    } finally {
      await serviceClient.from("matches").update({ scheduled_at: inNight }).eq("id", matchId);
    }
  });
});
