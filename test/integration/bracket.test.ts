// Tests d'intégration lib/queries/bracket.ts (p1-1, feuille de route Phase 1)
// -- zéro test sur ce module avant ça. Même patron que leaderboard.test.ts
// (getServerClient mocké vers un vrai client Supabase local signé).
//
// Priorité donnée à l'IMPÉRATIF DE CONFIDENTIALITÉ explicitement documenté
// en tête de bracket.ts (§15.2 : groups/players/myPick VIDES côté serveur
// avant la deadline) et à la machine à états myBetAction/myBet -- pas au
// calcul de pourcentage (seuil ≥ 11 brackets, coûteux à seeder) ni au score
// en direct (arithmétique simple, risque plus faible).

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
const EMAIL_DOMAIN = "@bracket-test.local";

const state = vi.hoisted(() => ({ client: null as SupabaseClient | null }));
vi.mock("@/lib/supabase/server", () => ({
  getServerClient: async () => state.client,
}));

const { getBracket } = await import("@/lib/queries/bracket");

let userA: { id: string; client: SupabaseClient };
let userB: { id: string; client: SupabaseClient };
let competitionId: string;
let teamA: { id: string; abbreviation: string };
let teamB: { id: string; abbreviation: string };
let seriesId: string;
let bracketAId: string;

const FUTURE_DEADLINE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const PAST_DEADLINE = new Date(Date.now() - 60 * 60 * 1000).toISOString();

beforeAll(async () => {
  await purgeLeftoverTestUsers(EMAIL_DOMAIN);

  userA = await createSignedInTestUser("a", RUN_ID, EMAIL_DOMAIN);
  userB = await createSignedInTestUser("b", RUN_ID, EMAIL_DOMAIN);
  [teamA, teamB] = await createTwoTestTeams(RUN_ID);

  competitionId = await createActiveCompetition({
    runId: RUN_ID,
    type: "PLAYOFFS",
    bracketDeadline: FUTURE_DEADLINE,
  });

  const { data: seriesRow, error: seriesError } = await serviceClient
    .from("series")
    .insert({
      competition_id: competitionId,
      round: "ROUND_1",
      conference: "EAST",
      slot_index: 0,
      team1_id: teamA.id,
      team2_id: teamB.id,
      official_status: "SCHEDULED",
    })
    .select("id")
    .single();
  if (seriesError || !seriesRow) throw new Error(`Création série de test échouée: ${seriesError?.message}`);
  seriesId = seriesRow.id;

  // A remplit son pronostic (vainqueur + format, Playoffs) -- doit rester
  // invisible aux AUTRES joueurs avant la deadline, et invisible dans
  // `groups`/`players` même si A le connaît déjà lui-même (§15.2 : jamais
  // affiché en avant-première sur cet écran partagé).
  const { data: bracketA, error: bracketAError } = await userA.client
    .from("brackets")
    .insert({ user_id: userA.id, competition_id: competitionId })
    .select("id")
    .single();
  if (bracketAError || !bracketA) throw new Error(`Création bracket de A échouée: ${bracketAError?.message}`);
  bracketAId = bracketA.id;

  const { error: pickError } = await userA.client.from("bracket_picks").insert({
    competition_id: competitionId,
    bracket_id: bracketAId,
    series_id: seriesId,
    predicted_winner_team_id: teamA.id,
    predicted_score_format: "4-2",
  });
  if (pickError) throw new Error(`Insertion du pick de A échouée: ${pickError.message}`);
});

afterAll(async () => {
  await deleteCompetitionCascade(competitionId);
  await deleteTestTeams([teamA.id, teamB.id]);
  await serviceClient.auth.admin.deleteUser(userA.id);
  await serviceClient.auth.admin.deleteUser(userB.id);
});

describe("getBracket -- états vides", () => {
  it("aucune compétition ACTIVE -> données vides", async () => {
    const { error } = await serviceClient.from("competitions").update({ status: "ARCHIVED" }).eq("id", competitionId);
    if (error) throw new Error(error.message);
    try {
      state.client = userA.client;
      const data = await getBracket();
      expect(data.competitionId).toBeNull();
      expect(data.rounds).toHaveLength(0);
    } finally {
      const { error: reactivateError } = await serviceClient
        .from("competitions")
        .update({ status: "ACTIVE" })
        .eq("id", competitionId);
      if (reactivateError) throw new Error(reactivateError.message);
    }
  });

  it("NBA Cup avant qualification (aucune série en base) -> isStructureKnown=false", async () => {
    const cupId = await createActiveCompetitionArchivingCurrent();
    try {
      state.client = userA.client;
      const data = await getBracket();
      expect(data.competitionId).toBe(cupId);
      expect(data.isStructureKnown).toBe(false);
      expect(data.rounds).toHaveLength(0);
    } finally {
      await deleteCompetitionCascade(cupId);
      const { error } = await serviceClient.from("competitions").update({ status: "ACTIVE" }).eq("id", competitionId);
      if (error) throw new Error(error.message);
    }
  });
});

// Bascule temporairement la compétition principale en ARCHIVED pour respecter
// l'index unique "1 seule compétition ACTIVE", crée une 2e compétition Cup
// vide, la temps du test -- restaurée par l'appelant.
async function createActiveCompetitionArchivingCurrent(): Promise<string> {
  const { error } = await serviceClient.from("competitions").update({ status: "ARCHIVED" }).eq("id", competitionId);
  if (error) throw new Error(error.message);
  return createActiveCompetition({ runId: `${RUN_ID}-cup`, type: "NBA_CUP" });
}

describe("getBracket -- confidentialité avant la deadline (§15.2)", () => {
  it("groups et myPick restent VIDES pour A alors même que son pick existe en base", async () => {
    state.client = userA.client;
    const data = await getBracket();
    expect(data.isDeadlinePassed).toBe(false);
    const node = data.rounds.flatMap((round) => round.nodes).find((n) => n.nodeId === seriesId)!;
    expect(node.groups).toHaveLength(0);
    expect(node.myPick).toBeNull();
    expect(node.filledBracketsCount).toBe(0);
  });

  it("groups et myPick restent VIDES pour B aussi", async () => {
    state.client = userB.client;
    const data = await getBracket();
    const node = data.rounds.flatMap((round) => round.nodes).find((n) => n.nodeId === seriesId)!;
    expect(node.groups).toHaveLength(0);
    expect(node.myPick).toBeNull();
  });
});

describe("getBracket -- après la deadline", () => {
  beforeAll(async () => {
    const { error } = await serviceClient
      .from("competitions")
      .update({ bracket_deadline: PAST_DEADLINE })
      .eq("id", competitionId);
    if (error) throw new Error(`Passage de la deadline échoué: ${error.message}`);
  });

  afterAll(async () => {
    const { error } = await serviceClient
      .from("competitions")
      .update({ bracket_deadline: FUTURE_DEADLINE })
      .eq("id", competitionId);
    if (error) throw new Error(`Restauration de la deadline échouée: ${error.message}`);
  });

  it("le pronostic de A devient visible dans groups, et myPick se peuple pour A", async () => {
    state.client = userA.client;
    const data = await getBracket();
    expect(data.isDeadlinePassed).toBe(true);
    const node = data.rounds.flatMap((round) => round.nodes).find((n) => n.nodeId === seriesId)!;
    expect(node.filledBracketsCount).toBe(1);
    expect(node.groups).toHaveLength(1);
    expect(node.groups[0].teamAbbreviation).toBe(teamA.abbreviation);
    expect(node.groups[0].players).toEqual([{ userId: userA.id, pseudo: expect.any(String) }]);
    expect(node.groups[0].percentage).toBeNull(); // < 11 brackets remplis sur cette série
    expect(node.myPick).toEqual({ teamAbbreviation: teamA.abbreviation, seriesFormat: "4-2", points: null });
  });

  it("myPick reste null pour B (n'a rempli aucun bracket)", async () => {
    state.client = userB.client;
    const data = await getBracket();
    const node = data.rounds.flatMap((round) => round.nodes).find((n) => n.nodeId === seriesId)!;
    expect(node.myPick).toBeNull();
    // Le pronostic de A, lui, est bien visible par B une fois la deadline passée.
    expect(node.groups).toHaveLength(1);
  });
});

describe("getBracket -- myBetAction / myBet (pari SÉRIE)", () => {
  it("PROPOSE quand A n'a aucun pari actif sur la série", async () => {
    state.client = userA.client;
    const data = await getBracket();
    const node = data.rounds.flatMap((round) => round.nodes).find((n) => n.nodeId === seriesId)!;
    expect(node.myBetAction).toEqual({ kind: "PROPOSE" });
    expect(node.myBet).toBeNull();
  });

  it("EDIT quand A a un pari DRAFT, puis null+myBet en lecture seule une fois VALIDATED", async () => {
    const { data: bet, error } = await userA.client
      .from("bets")
      .insert({
        competition_id: competitionId,
        user_id: userA.id,
        scope: "SERIES",
        series_id: seriesId,
        description: "Test bracket -- pari série de A",
        status: "DRAFT",
        proposed_category: "TEAM_PROP",
        proposed_difficulty: 2,
      })
      .select("id")
      .single();
    if (error || !bet) throw new Error(`Insertion du pari échouée: ${error?.message}`);

    try {
      state.client = userA.client;
      let data = await getBracket();
      let node = data.rounds.flatMap((round) => round.nodes).find((n) => n.nodeId === seriesId)!;
      expect(node.myBetAction).toEqual({ kind: "EDIT", betId: bet.id });
      expect(node.myBet).toBeNull(); // éditable -> pas encore de contenu en lecture seule

      // Machine à états réelle (enforce_bet_transitions) : DRAFT -> SUBMITTED -> VALIDATED.
      const { error: submitError } = await serviceClient.from("bets").update({ status: "SUBMITTED" }).eq("id", bet.id);
      if (submitError) throw new Error(submitError.message);
      const { error: validateError } = await serviceClient
        .from("bets")
        .update({ status: "VALIDATED", validated_category: "TEAM_PROP", validated_difficulty: 2 })
        .eq("id", bet.id);
      if (validateError) throw new Error(validateError.message);

      data = await getBracket();
      node = data.rounds.flatMap((round) => round.nodes).find((n) => n.nodeId === seriesId)!;
      expect(node.myBetAction).toBeNull(); // engagé -> plus aucun bouton
      expect(node.myBet?.betId).toBe(bet.id);
      expect(node.myBet?.status).toBe("VALIDATED");
      expect(node.myBet?.isForgottenResolution).toBe(false); // série pas encore FINISHED
    } finally {
      await serviceClient.from("bets").delete().eq("id", bet.id);
    }
  });

  it("isForgottenResolution=true si le pari reste VALIDATED alors que la série est FINISHED", async () => {
    const { data: bet, error } = await serviceClient
      .from("bets")
      .insert({
        competition_id: competitionId,
        user_id: userA.id,
        scope: "SERIES",
        series_id: seriesId,
        description: "Test bracket -- pari oublié de A",
        status: "VALIDATED",
        proposed_category: "TEAM_PROP",
        validated_category: "TEAM_PROP",
        proposed_difficulty: 2,
        validated_difficulty: 2,
      })
      .select("id")
      .single();
    if (error || !bet) throw new Error(`Insertion du pari échouée: ${error?.message}`);

    const { error: finishError } = await serviceClient
      .from("series")
      .update({ official_status: "FINISHED", official_winner_team_id: teamA.id })
      .eq("id", seriesId);
    if (finishError) throw new Error(finishError.message);

    try {
      state.client = userA.client;
      const data = await getBracket();
      const node = data.rounds.flatMap((round) => round.nodes).find((n) => n.nodeId === seriesId)!;
      expect(node.myBet?.isForgottenResolution).toBe(true);
      // Série non-pariable (FINISHED) : myBetAction reste null pour un visiteur
      // sans pari (pas testé ici, A a déjà un pari engagé -- déjà couvert par
      // le null ci-dessus via activeBet).
    } finally {
      await serviceClient.from("bets").delete().eq("id", bet.id);
      await serviceClient
        .from("series")
        .update({ official_status: "SCHEDULED", official_winner_team_id: null })
        .eq("id", seriesId);
    }
  });

  it("myBetAction reste null (pas de PROPOSE) sur une série FINISHED même sans pari actif", async () => {
    const { error: finishError } = await serviceClient
      .from("series")
      .update({ official_status: "FINISHED", official_winner_team_id: teamA.id })
      .eq("id", seriesId);
    if (finishError) throw new Error(finishError.message);

    try {
      state.client = userB.client; // B n'a jamais eu de pari sur cette série
      const data = await getBracket();
      const node = data.rounds.flatMap((round) => round.nodes).find((n) => n.nodeId === seriesId)!;
      expect(node.myBetAction).toBeNull();
      expect(node.status).toBe("FINISHED");
    } finally {
      await serviceClient
        .from("series")
        .update({ official_status: "SCHEDULED", official_winner_team_id: null })
        .eq("id", seriesId);
    }
  });
});
