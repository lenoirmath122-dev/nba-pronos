// Tests d'intégration lib/queries/leaderboard.ts (p1-1, feuille de route
// Phase 1) -- zéro test sur ce module avant ça. Tape un vrai Postgres via
// Supabase local, comme rls.test.ts : getLeaderboard() appelle
// getServerClient() en interne (lit les cookies via next/headers), donc
// mocké ici pour renvoyer un client déjà signé -- la RLS s'applique quand
// même normalement, seul le transport de session change par rapport à un
// vrai composant serveur Next.js.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { type SupabaseClient } from "@supabase/supabase-js";
import {
  createSignedInTestUser,
  deleteCompetitionCascade,
  createActiveCompetition,
  newRunId,
  purgeLeftoverTestUsers,
  serviceClient,
} from "./fixtures";

const RUN_ID = newRunId();
const EMAIL_DOMAIN = "@leaderboard-test.local";

const state = vi.hoisted(() => ({ client: null as SupabaseClient | null }));
vi.mock("@/lib/supabase/server", () => ({
  getServerClient: async () => state.client,
}));

const { getLeaderboard } = await import("@/lib/queries/leaderboard");

let userA: { id: string; client: SupabaseClient };
let userB: { id: string; client: SupabaseClient };
let userC: { id: string; client: SupabaseClient };
let competitionId: string;
let leagueId: string;

beforeAll(async () => {
  await purgeLeftoverTestUsers(EMAIL_DOMAIN);

  userA = await createSignedInTestUser("a", RUN_ID, EMAIL_DOMAIN);
  userB = await createSignedInTestUser("b", RUN_ID, EMAIL_DOMAIN);
  userC = await createSignedInTestUser("c", RUN_ID, EMAIL_DOMAIN);

  competitionId = await createActiveCompetition({ runId: RUN_ID, type: "NBA_CUP" });

  // user_scores/user_recent_form sont des VUES calculées depuis
  // match_predictions/bets/bracket_picks (migration #5) -- jamais
  // insérables directement. On seed les tables sous-jacentes : matches_points
  // via match_predictions (winner_points/margin_bonus_points, colonne
  // générée), bets_points via bets.points_awarded (colonne ordinaire).
  // series_id est NOT NULL même pour un pari SERIES/une prédiction MATCH --
  // une série + un match jetables suffisent, jamais lus par getLeaderboard().
  // 2 séries : uniq_active_series_bet (1 pari actif max par (user, série),
  // WON/LOST compris -- seuls REJECTED/CANCELLED sont exclus) interdit à A
  // d'avoir ses 2 paris sur la même série.
  const { data: seriesRows, error: seriesError } = await serviceClient
    .from("series")
    .insert([
      { competition_id: competitionId, round: "CUP_QUARTERS", slot_index: 0, official_status: "SCHEDULED" },
      { competition_id: competitionId, round: "CUP_QUARTERS", slot_index: 1, official_status: "SCHEDULED" },
    ])
    .select("id");
  if (seriesError || !seriesRows || seriesRows.length !== 2) {
    throw new Error(`Création séries de test échouée: ${seriesError?.message}`);
  }
  const [seriesRow, seriesRow2] = seriesRows;

  // scheduled_at dans le passé : bet_is_public() (RLS, migration #3) exige
  // le coup d'envoi passé pour qu'un pari SÉRIE d'un AUTRE joueur devienne
  // visible -- sans ça, getLeaderboard() (appelé par A) sous-compterait
  // silencieusement betsAttempted/betsWon des paris déjà résolus de B/C.
  const { data: matchRow, error: matchError } = await serviceClient
    .from("matches")
    .insert({
      competition_id: competitionId,
      series_id: seriesRow.id,
      game_number: 1,
      scheduled_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (matchError || !matchRow) throw new Error(`Création match de test échouée: ${matchError?.message}`);

  // A : total 100 entièrement via bets (100 = 70 WON + 30 LOST) -- exerce
  // betsAttempted/betsWon/betsAvgDifficulty. B : total 100 via 60 de
  // matches_points + 40 de bets -- ex-aequo avec A sur Total, mais PAS sur
  // matches_points, pour vérifier que sortKey="matches" réordonne les lignes
  // indépendamment du rang (toujours calculé sur Total). C : total 20, loin
  // derrière -- doit être classé 3e (pas 2e, malgré l'ex-aequo 1/1 au-dessus).
  const { error: betsError } = await serviceClient.from("bets").insert([
    {
      competition_id: competitionId,
      user_id: userA.id,
      scope: "SERIES",
      series_id: seriesRow.id,
      description: "Test leaderboard -- pari gagné de A",
      status: "WON",
      points_awarded: 70,
      proposed_category: "SCORE_TOTAL",
      proposed_difficulty: 2,
      validated_difficulty: 3,
    },
    {
      competition_id: competitionId,
      user_id: userA.id,
      scope: "SERIES",
      series_id: seriesRow2.id,
      description: "Test leaderboard -- pari perdu de A",
      status: "LOST",
      points_awarded: 30,
      proposed_category: "SCORE_TOTAL",
      proposed_difficulty: 1,
      validated_difficulty: null,
    },
    {
      competition_id: competitionId,
      user_id: userB.id,
      scope: "SERIES",
      series_id: seriesRow.id,
      description: "Test leaderboard -- pari gagné de B",
      status: "WON",
      points_awarded: 40,
      proposed_category: "SCORE_TOTAL",
      proposed_difficulty: 2,
      validated_difficulty: 2,
    },
    {
      competition_id: competitionId,
      user_id: userC.id,
      scope: "SERIES",
      series_id: seriesRow.id,
      description: "Test leaderboard -- pari gagné de C",
      status: "WON",
      points_awarded: 20,
      proposed_category: "SCORE_TOTAL",
      proposed_difficulty: 1,
      validated_difficulty: 1,
    },
  ]);
  if (betsError) throw new Error(`Insertion bets échouée: ${betsError.message}`);

  // is_winner_correct=false/margin_diff<>0 (donc correct_match_winners et
  // exact_margins restent à 0, comme pour A) -- assignRanks (lib/scoring/
  // ranking.ts) ne considère 2 joueurs ex-aequo que si total_points ET ces
  // 2 tiebreaks ET bracket_points sont TOUS égaux, pas seulement le total.
  const { error: predictionError } = await serviceClient.from("match_predictions").insert({
    competition_id: competitionId,
    user_id: userB.id,
    match_id: matchRow.id,
    status: "VALIDATED",
    is_winner_correct: false,
    margin_diff: 5,
    winner_points: 0,
    margin_bonus_points: 60,
    scored_at: new Date().toISOString(),
  });
  if (predictionError) throw new Error(`Insertion match_predictions échouée: ${predictionError.message}`);

  // Ligue avec A et B seulement -- C doit disparaître de la portée ligue.
  const { data: leagueData, error: leagueError } = await userA.client.rpc("create_league", {
    p_name: `LEADERBOARD-TEST-${RUN_ID}`,
  });
  if (leagueError || !leagueData?.[0]) throw new Error(`Création ligue échouée: ${leagueError?.message}`);
  leagueId = leagueData[0].id;
  const { error: joinError } = await userB.client.rpc("join_league", { p_code: leagueData[0].code as string });
  if (joinError) throw new Error(`B rejoint la ligue échoué: ${joinError.message}`);
});

afterAll(async () => {
  await serviceClient.from("league_memberships").delete().eq("league_id", leagueId);
  await serviceClient.from("league_secrets").delete().eq("league_id", leagueId);
  await serviceClient.from("leagues").delete().eq("id", leagueId);
  await deleteCompetitionCascade(competitionId);
  await serviceClient.auth.admin.deleteUser(userA.id);
  await serviceClient.auth.admin.deleteUser(userB.id);
  await serviceClient.auth.admin.deleteUser(userC.id);
});

describe("getLeaderboard -- classement général", () => {
  it("classe A et B ex-aequo au rang 1, C au rang 3 (pas 2)", async () => {
    state.client = userA.client;
    const data = await getLeaderboard("total");
    expect(data.competitionId).toBe(competitionId);
    expect(data.rankedCount).toBe(3);

    const byId = new Map(data.rows.map((row) => [row.userId, row]));
    expect(byId.get(userA.id)?.rank).toBe(1);
    expect(byId.get(userB.id)?.rank).toBe(1);
    expect(byId.get(userC.id)?.rank).toBe(3);
    expect(data.currentUserRank).toBe(1); // A est le joueur connecté ici
    expect(byId.get(userA.id)?.isCurrentUser).toBe(true);
    expect(byId.get(userB.id)?.isCurrentUser).toBe(false);
  });

  it("trie par la colonne demandée, indépendamment du rang (toujours sur Total)", async () => {
    state.client = userA.client;
    const data = await getLeaderboard("matches");
    // B (60 pts matches) doit passer devant A (0 pt matches) dans l'ordre des
    // lignes, même si le RANG de chacun reste calculé sur Total (1/1/3) -- A
    // et B sont ex-aequo sur Total mais PAS sur matches_points.
    expect(data.rows[0].userId).toBe(userB.id);
    expect(data.rows[0].rank).toBe(1);
    expect(data.rows[1].userId).toBe(userA.id);
    expect(data.rows[1].rank).toBe(1);
  });

  it("inverse l'ordre en sortDirection asc sans changer le rang", async () => {
    state.client = userA.client;
    const data = await getLeaderboard("total", null, "asc");
    expect(data.rows[0].userId).toBe(userC.id); // dernier en desc, premier en asc
    expect(data.rows[0].rank).toBe(3); // le rang ne bouge pas avec la direction
  });

  it("agrège les paris résolus de A (1 WON + 1 LOST, moyenne de difficulté sur la validée puis la proposée)", async () => {
    state.client = userA.client;
    const data = await getLeaderboard("total");
    const rowA = data.rows.find((row) => row.userId === userA.id)!;
    expect(rowA.betsAttempted).toBe(2);
    expect(rowA.betsWon).toBe(1);
    expect(rowA.betsAvgDifficulty).toBe((3 + 1) / 2); // validated_difficulty de WON, proposed_difficulty de LOST

    const rowC = data.rows.find((row) => row.userId === userC.id)!;
    expect(rowC.betsAttempted).toBe(1);
    expect(rowC.betsAvgDifficulty).toBe(1);
  });

  it("rankTrend est 'unavailable' sans snapshot préalable", async () => {
    state.client = userA.client;
    const data = await getLeaderboard("total");
    const rowA = data.rows.find((row) => row.userId === userA.id)!;
    expect(rowA.rankTrend).toEqual({ kind: "unavailable" });
  });
});

describe("getLeaderboard -- portée ligue", () => {
  it("filtre aux seuls membres (A, B) et recalcule le rang dans ce sous-ensemble", async () => {
    state.client = userA.client;
    const data = await getLeaderboard("total", leagueId);
    expect(data.scopeLeagueId).toBe(leagueId);
    expect(data.rankedCount).toBe(2);
    expect(data.rows.some((row) => row.userId === userC.id)).toBe(false);
    // rankTrend désactivé en portée ligue (jamais de sens à comparer un rang
    // de ligue au rang général d'hier).
    expect(data.rows.every((row) => row.rankTrend === null)).toBe(true);
  });

  it("un id de ligue invalide retombe silencieusement sur le classement Général", async () => {
    state.client = userA.client;
    const data = await getLeaderboard("total", "00000000-0000-0000-0000-000000000000");
    expect(data.scopeLeagueId).toBeNull();
    expect(data.rankedCount).toBe(3);
  });
});

describe("getLeaderboard -- états vides", () => {
  it("aucune compétition ACTIVE -> données vides, scopeLeagueId reflète quand même la demande", async () => {
    // competition_status n'a que ACTIVE/ARCHIVED (pas de "DRAFT").
    const { error: archiveError } = await serviceClient
      .from("competitions")
      .update({ status: "ARCHIVED" })
      .eq("id", competitionId);
    if (archiveError) throw new Error(`Passage en ARCHIVED échoué: ${archiveError.message}`);
    try {
      state.client = userA.client;
      const data = await getLeaderboard("total", leagueId);
      expect(data.competitionId).toBeNull();
      expect(data.rows).toHaveLength(0);
      expect(data.scopeLeagueId).toBe(leagueId);
    } finally {
      const { error: reactivateError } = await serviceClient
        .from("competitions")
        .update({ status: "ACTIVE" })
        .eq("id", competitionId);
      if (reactivateError) throw new Error(`Réactivation échouée: ${reactivateError.message}`);
    }
  });
});
