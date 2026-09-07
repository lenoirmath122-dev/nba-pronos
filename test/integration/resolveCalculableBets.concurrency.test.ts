// Test d'intégration T-ERR-01 (audit/BACKLOG_TESTS.md, p1-4 feuille de route
// Phase 1) -- confirme que le mécanisme réel utilisé par CHAQUE écriture de
// résolution dans lib/ai/resolveCalculableBets.ts (`.update({status:...})
// .eq("id", betId).eq("status", "VALIDATED")`, ~19 occurrences dans ce
// fichier) tient bien la course quand deux exécutions concurrentes ciblent
// le MÊME pari : une seule aboutit, l'autre affecte 0 ligne et le code
// appelant le détecte déjà comme "déjà résolu entre-temps (concurrence)".
//
// Exerce directement ce pattern UPDATE conditionnel plutôt que la fonction
// resolveCalculableBets() elle-même (qui a besoin du micro-service Python de
// stats en plus de Supabase local, hors périmètre d'un test d'intégration
// pur-DB) -- c'est ce pattern, pas le calcul de proba en amont, qui est le
// vrai mécanisme de sécurité testé ici.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { serviceClient, newRunId, createActiveCompetition, deleteCompetitionCascade, createSignedInTestUser, purgeLeftoverTestUsers } from "./fixtures";

const RUN_ID = newRunId();
const EMAIL_DOMAIN = "@err01-test.local";

let competitionId: string;
let seriesId: string;
let matchId: string;
let userAId: string;

beforeAll(async () => {
  await purgeLeftoverTestUsers(EMAIL_DOMAIN);
  competitionId = await createActiveCompetition({ runId: RUN_ID, type: "PLAYOFFS" });

  const { data: series, error: seriesError } = await serviceClient
    .from("series")
    .insert({ competition_id: competitionId, round: "NBA_FINALS", slot_index: 0, official_status: "SCHEDULED" })
    .select("id")
    .single();
  if (seriesError || !series) throw new Error(`Création série de test échouée: ${seriesError?.message}`);
  seriesId = series.id;

  const { data: match, error: matchError } = await serviceClient
    .from("matches")
    .insert({
      competition_id: competitionId,
      series_id: seriesId,
      game_number: 1,
      scheduled_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      status: "FINISHED",
    })
    .select("id")
    .single();
  if (matchError || !match) throw new Error(`Création match de test échouée: ${matchError?.message}`);
  matchId = match.id;

  const user = await createSignedInTestUser("a", RUN_ID, EMAIL_DOMAIN);
  userAId = user.id;
});

afterAll(async () => {
  await deleteCompetitionCascade(competitionId);
  await serviceClient.auth.admin.deleteUser(userAId);
});

describe("Double résolution concurrente du même pari (T-ERR-01)", () => {
  it("2 UPDATE conditionnels simultanés sur le même pari VALIDATED -- un seul aboutit", async () => {
    const { data: bet, error: insertError } = await serviceClient
      .from("bets")
      .insert({
        competition_id: competitionId,
        user_id: userAId,
        scope: "MATCH",
        series_id: seriesId,
        match_id: matchId,
        description: "Test T-ERR-01",
        proposed_category: "SCORE_TOTAL",
        validated_category: "SCORE_TOTAL",
        proposed_difficulty: 1,
        validated_difficulty: 1,
        status: "VALIDATED",
      })
      .select("id")
      .single();
    if (insertError || !bet) throw new Error(`Insertion du pari de test échouée: ${insertError?.message}`);
    const betId = bet.id as string;

    // Même pattern EXACT que les ~19 sites de résolution de
    // resolveCalculableBets.ts -- 2 requêtes indépendantes (jamais la même
    // transaction), tirées "en même temps" via Promise.all pour maximiser
    // la fenêtre de course réelle.
    const attempt = (outcome: "WON" | "LOST") =>
      serviceClient
        .from("bets")
        .update({ status: outcome, resolution_reason: `Tentative ${outcome}`, resolved_at: new Date().toISOString() })
        .eq("id", betId)
        .eq("status", "VALIDATED")
        .select("id")
        .maybeSingle();

    const [resultWon, resultLost] = await Promise.all([attempt("WON"), attempt("LOST")]);

    const successes = [resultWon, resultLost].filter((r) => r.data !== null);
    const noOps = [resultWon, resultLost].filter((r) => r.data === null);
    expect(successes).toHaveLength(1);
    expect(noOps).toHaveLength(1);
    // Aucune des deux requêtes ne doit lever d'erreur -- le "perdant" de la
    // course affecte simplement 0 ligne (comportement PostgREST normal d'un
    // UPDATE dont le WHERE ne matche plus rien), jamais une exception.
    expect(resultWon.error).toBeNull();
    expect(resultLost.error).toBeNull();

    // L'état final en base correspond à EXACTEMENT le gagnant de la course,
    // jamais un mélange des deux (ex. status d'un côté, resolution_reason
    // de l'autre).
    const winningOutcome: "WON" | "LOST" = resultWon.data !== null ? "WON" : "LOST";
    const { data: final } = await serviceClient.from("bets").select("status, resolution_reason").eq("id", betId).single();
    expect(final?.status).toBe(winningOutcome);
    expect(final?.resolution_reason).toBe(`Tentative ${winningOutcome}`);
  });
});
