import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { LOCAL_SUPABASE } from "./env";

// Helpers communs aux suites d'intégration (RLS, lib/queries/*) -- extrait de
// test/integration/rls.test.ts (seule suite existante avant celle-ci) pour
// éviter de tripler cette logique dans chaque nouveau fichier (p1-30 :
// factoriser plutôt que dupliquer). Tape un vrai Postgres via Supabase local
// (`npx supabase start`), jamais le projet hébergé.

export const TEST_USER_EMAIL_DOMAIN = "@queries-test.local";

export const serviceClient = createClient(LOCAL_SUPABASE.url, LOCAL_SUPABASE.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Un id court par run (8 hex) -- préfixe les noms de compétition/pseudo pour
 *  distinguer les résidus d'exécutions concurrentes/interrompues. */
export function newRunId(): string {
  return randomUUID().slice(0, 8);
}

export async function purgeLeftoverTestUsers(emailDomain: string) {
  const { data: usersPage } = await serviceClient.auth.admin.listUsers({ perPage: 200 });
  for (const u of usersPage?.users ?? []) {
    if (u.email?.endsWith(emailDomain)) {
      await serviceClient.auth.admin.deleteUser(u.id);
    }
  }
}

export async function createSignedInTestUser(
  label: string,
  runId: string,
  emailDomain: string = TEST_USER_EMAIL_DOMAIN
): Promise<{ id: string; client: SupabaseClient }> {
  const email = `q-${label}-${runId}${emailDomain}`;
  const password = `Test-${randomUUID()}`;
  const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { pseudo: `q_${label}_${runId}` },
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

/** Une compétition ACTIVE à la fois (index partiel unique, migration initiale)
 *  -- toute suite qui en crée une doit la nettoyer dans son afterAll avant
 *  qu'une autre suite (fichier différent) ne tourne. `fileParallelism: false`
 *  dans vitest.integration.config.ts garantit qu'aucune ne se chevauche. */
export async function createActiveCompetition(params: {
  runId: string;
  type?: "PLAYOFFS" | "NBA_CUP";
  bracketDeadline?: string | null;
}): Promise<string> {
  const { data, error } = await serviceClient
    .from("competitions")
    .insert({
      name: `QUERIES-TEST-${params.runId}`,
      type: params.type ?? "PLAYOFFS",
      status: "ACTIVE",
      bracket_deadline: params.bracketDeadline ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Création compétition de test échouée: ${error?.message}`);
  }
  return data.id as string;
}

export async function deleteCompetitionCascade(competitionId: string) {
  await serviceClient.from("bracket_picks").delete().eq("competition_id", competitionId);
  await serviceClient.from("brackets").delete().eq("competition_id", competitionId);
  await serviceClient.from("bets").delete().eq("competition_id", competitionId);
  await serviceClient.from("match_predictions").delete().eq("competition_id", competitionId);
  await serviceClient.from("matches").delete().eq("competition_id", competitionId);
  await serviceClient.from("series").delete().eq("competition_id", competitionId);
  await serviceClient.from("user_scores").delete().eq("competition_id", competitionId);
  await serviceClient.from("user_recent_form").delete().eq("competition_id", competitionId);
  await serviceClient.from("leaderboard_snapshots").delete().eq("competition_id", competitionId);
  await serviceClient.from("competitions").delete().eq("id", competitionId);
}

/** Le référentiel `teams` n'est peuplé que par la synchro Highlightly réelle
 *  (aucun seed local) -- 2 équipes jetables créées ici, `abbreviation`
 *  suffixée par le runId (contrainte unique en base) et supprimées dans
 *  `deleteTestTeams` par l'appelant. */
export async function createTwoTestTeams(
  runId: string
): Promise<[{ id: string; abbreviation: string }, { id: string; abbreviation: string }]> {
  const { data, error } = await serviceClient
    .from("teams")
    .insert([
      { name: `Test Team A ${runId}`, abbreviation: `TA${runId}`.slice(0, 10), conference: "EAST" },
      { name: `Test Team B ${runId}`, abbreviation: `TB${runId}`.slice(0, 10), conference: "WEST" },
    ])
    .select("id, abbreviation");
  if (error || !data || data.length !== 2) {
    throw new Error(`Création des équipes de test échouée: ${error?.message}`);
  }
  return [data[0] as { id: string; abbreviation: string }, data[1] as { id: string; abbreviation: string }];
}

export async function deleteTestTeams(teamIds: string[]) {
  await serviceClient.from("teams").delete().in("id", teamIds);
}
