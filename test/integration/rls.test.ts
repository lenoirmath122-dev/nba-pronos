// Tests d'intégration RLS (A4, TEST-002) -- scope réduit décidé pour l'alpha
// NBA Cup du 20/09/2026 : les deux scénarios IDOR que l'alpha exerce
// réellement, plutôt que la matrice complète de audit/BACKLOG_TESTS.md
// (T-SEC-01 à T-SEC-04).
//
// Tape un vrai Postgres via un Supabase local (`npx supabase start`) --
// lancé séparément de la suite unitaire via `npm run test:integration`
// (voir vitest.integration.config.ts). Les fakes utilisés ailleurs dans le
// repo (ex. rateLimit.test.ts) n'appliquent pas la RLS : seule une vraie
// base peut confirmer que les policies bloquent ce qu'elles doivent
// bloquer.

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LOCAL_SUPABASE } from "./env";

const RUN_ID = randomUUID().slice(0, 8);
const COMPETITION_NAME_PREFIX = "RLS-TEST-";
const TEST_USER_EMAIL_DOMAIN = "@rls-test.local";

const serviceClient = createClient(LOCAL_SUPABASE.url, LOCAL_SUPABASE.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Nettoie les résidus d'une exécution précédente interrompue avant son
// afterAll (ex. process tué) -- sans ça, l'index unique "1 seule compétition
// ACTIVE" ferait échouer la création de la compétition de ce run.
async function purgeLeftoverTestData() {
  const { data: competitions } = await serviceClient
    .from("competitions")
    .select("id")
    .like("name", `${COMPETITION_NAME_PREFIX}%`);
  const competitionIds = (competitions ?? []).map((c) => c.id as string);
  if (competitionIds.length > 0) {
    await serviceClient.from("bracket_picks").delete().in("competition_id", competitionIds);
    await serviceClient.from("brackets").delete().in("competition_id", competitionIds);
    await serviceClient.from("bets").delete().in("competition_id", competitionIds);
    await serviceClient.from("matches").delete().in("competition_id", competitionIds);
    await serviceClient.from("series").delete().in("competition_id", competitionIds);
    await serviceClient.from("competitions").delete().in("id", competitionIds);
  }

  const { data: usersPage } = await serviceClient.auth.admin.listUsers({ perPage: 200 });
  for (const u of usersPage?.users ?? []) {
    if (u.email?.endsWith(TEST_USER_EMAIL_DOMAIN)) {
      await serviceClient.auth.admin.deleteUser(u.id);
    }
  }
}

async function createSignedInTestUser(label: string) {
  const email = `rls-${label}-${RUN_ID}${TEST_USER_EMAIL_DOMAIN}`;
  const password = `Test-${randomUUID()}`;
  const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { pseudo: `rls_${label}_${RUN_ID}` },
  });
  if (createError || !created.user) {
    throw new Error(`Création user de test échouée (${label}): ${createError?.message}`);
  }

  const anonClient = createClient(LOCAL_SUPABASE.url, LOCAL_SUPABASE.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await anonClient.auth.signInWithPassword({ email, password });
  if (signInError) {
    throw new Error(`Sign-in user de test échoué (${label}): ${signInError.message}`);
  }

  return { id: created.user.id, client: anonClient };
}

let userA: { id: string; client: SupabaseClient };
let userB: { id: string; client: SupabaseClient };
let competitionId: string;
let seriesId: string;
let matchId: string;

beforeAll(async () => {
  await purgeLeftoverTestData();

  userA = await createSignedInTestUser("a");
  userB = await createSignedInTestUser("b");

  const inOneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const inTwoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

  const { data: competition, error: competitionError } = await serviceClient
    .from("competitions")
    .insert({
      name: `${COMPETITION_NAME_PREFIX}${RUN_ID}`,
      type: "NBA_CUP",
      status: "ACTIVE",
      bracket_deadline: inOneHour,
    })
    .select("id")
    .single();
  if (competitionError || !competition) {
    throw new Error(`Création compétition de test échouée: ${competitionError?.message}`);
  }
  competitionId = competition.id;

  const { data: series, error: seriesError } = await serviceClient
    .from("series")
    .insert({
      competition_id: competitionId,
      round: "CUP_QUARTERS",
      slot_index: 0,
      official_status: "SCHEDULED",
    })
    .select("id")
    .single();
  if (seriesError || !series) {
    throw new Error(`Création série de test échouée: ${seriesError?.message}`);
  }
  seriesId = series.id;

  const { data: match, error: matchError } = await serviceClient
    .from("matches")
    .insert({
      competition_id: competitionId,
      series_id: seriesId,
      game_number: 1,
      scheduled_at: inTwoDays,
      status: "SCHEDULED",
    })
    .select("id")
    .single();
  if (matchError || !match) {
    throw new Error(`Création match de test échouée: ${matchError?.message}`);
  }
  matchId = match.id;
});

afterAll(async () => {
  await serviceClient.from("bracket_picks").delete().eq("competition_id", competitionId);
  await serviceClient.from("brackets").delete().eq("competition_id", competitionId);
  await serviceClient.from("bets").delete().eq("competition_id", competitionId);
  await serviceClient.from("matches").delete().eq("competition_id", competitionId);
  await serviceClient.from("series").delete().eq("competition_id", competitionId);
  await serviceClient.from("competitions").delete().eq("id", competitionId);
  await serviceClient.auth.admin.deleteUser(userA.id);
  await serviceClient.auth.admin.deleteUser(userB.id);
});

describe("RLS -- propriété des paris (T-SEC-02)", () => {
  let betId: string;

  beforeAll(async () => {
    const { data: bet, error } = await userA.client
      .from("bets")
      .insert({
        competition_id: competitionId,
        user_id: userA.id,
        scope: "MATCH",
        series_id: seriesId,
        match_id: matchId,
        description: "Test IDOR -- pari de A",
        proposed_category: "SCORE_TOTAL",
        proposed_difficulty: 1,
      })
      .select("id")
      .single();
    if (error || !bet) throw new Error(`Insertion du pari de A échouée: ${error?.message}`);
    betId = bet.id;
  });

  it("le propriétaire (A) voit et peut éditer son propre pari", async () => {
    const { data: seen } = await userA.client.from("bets").select("id, description").eq("id", betId).maybeSingle();
    expect(seen?.id).toBe(betId);

    const { data: updated } = await userA.client
      .from("bets")
      .update({ description: "Description modifiée par A" })
      .eq("id", betId)
      .select("id");
    expect(updated).toHaveLength(1);
  });

  it("un autre joueur (B) ne peut PAS lire le pari privé de A (IDOR)", async () => {
    const { data: seenByB, error } = await userB.client
      .from("bets")
      .select("id")
      .eq("id", betId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(seenByB).toBeNull();
  });

  it("un autre joueur (B) ne peut PAS éditer le pari de A via son id (IDOR en écriture)", async () => {
    const { data: updatedByB } = await userB.client
      .from("bets")
      .update({ description: "Modifié frauduleusement par B" })
      .eq("id", betId)
      .select("id");
    expect(updatedByB).toHaveLength(0);

    const { data: stillA } = await serviceClient.from("bets").select("description").eq("id", betId).single();
    expect(stillA?.description).not.toContain("frauduleusement");
  });

  it("une fois le pari public (validé + deadline passée), B peut enfin le lire", async () => {
    await serviceClient.from("matches").update({ scheduled_at: new Date(Date.now() - 1000).toISOString() }).eq("id", matchId);
    // La machine à états (enforce_bet_transitions) interdit DRAFT -> VALIDATED
    // directement -- repasser par SUBMITTED comme le flux réel.
    const { error: submitError } = await serviceClient.from("bets").update({ status: "SUBMITTED" }).eq("id", betId);
    expect(submitError).toBeNull();
    const { error: validateError } = await serviceClient
      .from("bets")
      .update({ status: "VALIDATED", validated_category: "SCORE_TOTAL", validated_difficulty: 1 })
      .eq("id", betId);
    expect(validateError).toBeNull();

    const { data: seenByB } = await userB.client.from("bets").select("id").eq("id", betId).maybeSingle();
    expect(seenByB?.id).toBe(betId);
  });
});

describe("RLS -- visibilité du bracket (analogue T-SEC-02/03 pour la Cup)", () => {
  let bracketId: string;

  beforeAll(async () => {
    const { data: bracket, error } = await userA.client
      .from("brackets")
      .insert({ user_id: userA.id, competition_id: competitionId })
      .select("id")
      .single();
    if (error || !bracket) throw new Error(`Insertion du bracket de A échouée: ${error?.message}`);
    bracketId = bracket.id;

    const { error: pickError } = await userA.client.from("bracket_picks").insert({
      competition_id: competitionId,
      bracket_id: bracketId,
      series_id: seriesId,
      predicted_winner_team_id: null,
    });
    if (pickError) throw new Error(`Insertion du pick de A échouée: ${pickError.message}`);
  });

  it("le propriétaire (A) voit son propre bracket avant la deadline", async () => {
    const { data: seen } = await userA.client.from("brackets").select("id").eq("id", bracketId).maybeSingle();
    expect(seen?.id).toBe(bracketId);
  });

  it("un autre joueur (B) ne peut PAS voir le bracket de A avant la deadline", async () => {
    const { data: seenByB, error } = await userB.client
      .from("brackets")
      .select("id")
      .eq("id", bracketId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(seenByB).toBeNull();

    const { data: picksByB } = await userB.client
      .from("bracket_picks")
      .select("id")
      .eq("bracket_id", bracketId);
    expect(picksByB).toHaveLength(0);
  });

  it("un autre joueur (B) ne peut PAS écrire un pick dans le bracket de A (IDOR en écriture)", async () => {
    const { error } = await userB.client.from("bracket_picks").insert({
      competition_id: competitionId,
      bracket_id: bracketId,
      series_id: seriesId,
      predicted_winner_team_id: null,
    });
    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toContain("row-level security");
  });

  it("une fois la deadline du bracket passée, B peut enfin voir le bracket de A", async () => {
    await serviceClient
      .from("competitions")
      .update({ bracket_deadline: new Date(Date.now() - 1000).toISOString() })
      .eq("id", competitionId);

    const { data: seenByB } = await userB.client.from("brackets").select("id").eq("id", bracketId).maybeSingle();
    expect(seenByB?.id).toBe(bracketId);
  });
});
