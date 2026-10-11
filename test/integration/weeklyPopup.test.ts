// Tests d'intégration de la migration 20261013090000_weekly_popup.sql (lot 5,
// PR 1) : trigger rejected_at, RLS de weekly_popups / weekly_popup_views, RPC de
// lecture joueur, purge de compte. Nécessitent `npx supabase start` (Docker) :
// NE PAS LANCER sans accord de l'utilisateur (machine à 8 Go de RAM).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type SupabaseClient } from "@supabase/supabase-js";
import {
  createActiveCompetition,
  createSignedInTestUser,
  deleteCompetitionCascade,
  newRunId,
  purgeLeftoverTestUsers,
  serviceClient,
} from "./fixtures";

const RUN_ID = newRunId();
const EMAIL_DOMAIN = "@weekly-popup-test.local";

let userA: { id: string; client: SupabaseClient };
let userB: { id: string; client: SupabaseClient };
let userAdmin: { id: string; client: SupabaseClient };
let competitionId: string;
let seriesIds: string[] = [];
const WEEK_END = "2026-10-26";

async function insertBet(params: { seriesId: string; userId: string; status: string; description: string }) {
  const { data, error } = await serviceClient
    .from("bets")
    .insert({
      competition_id: competitionId,
      user_id: params.userId,
      scope: "SERIES",
      series_id: params.seriesId,
      description: params.description,
      status: params.status,
      proposed_category: "TEAM_PROP",
      proposed_difficulty: 2,
    })
    .select("id, rejected_at")
    .single();
  if (error || !data) throw new Error(`Insertion pari échouée: ${error?.message}`);
  return data as { id: string; rejected_at: string | null };
}

beforeAll(async () => {
  await purgeLeftoverTestUsers(EMAIL_DOMAIN);

  userA = await createSignedInTestUser("a", RUN_ID, EMAIL_DOMAIN);
  userB = await createSignedInTestUser("b", RUN_ID, EMAIL_DOMAIN);
  userAdmin = await createSignedInTestUser("admin", RUN_ID, EMAIL_DOMAIN);
  const { error: promoteError } = await serviceClient.from("users").update({ role: "ADMIN" }).eq("id", userAdmin.id);
  if (promoteError) throw new Error(`Promotion admin échouée: ${promoteError.message}`);

  competitionId = await createActiveCompetition({ runId: RUN_ID, type: "PLAYOFFS" });

  const { data: series, error: seriesError } = await serviceClient
    .from("series")
    .insert([
      { competition_id: competitionId, round: "ROUND_1", conference: "EAST", slot_index: 0, official_status: "SCHEDULED" },
      { competition_id: competitionId, round: "ROUND_1", conference: "EAST", slot_index: 1, official_status: "SCHEDULED" },
      { competition_id: competitionId, round: "ROUND_1", conference: "EAST", slot_index: 2, official_status: "SCHEDULED" },
    ])
    .select("id");
  if (seriesError || !series) throw new Error(`Création séries échouée: ${seriesError?.message}`);
  seriesIds = series.map((s) => s.id as string);

  const { error: rankingError } = await serviceClient.from("weekly_rankings").insert({
    competition_id: competitionId,
    week_end_date: WEEK_END,
    start_snapshot_date: "2026-10-19",
    end_snapshot_date: WEEK_END,
    tiebreak_available: true,
    frozen_by: "ADMIN",
  });
  if (rankingError) throw new Error(`Création weekly_rankings échouée: ${rankingError.message}`);
});

afterAll(async () => {
  await serviceClient.from("bets").delete().eq("competition_id", competitionId);
  await serviceClient.from("series").delete().eq("competition_id", competitionId);
  // deleteCompetitionCascade retire weekly_popups avant weekly_rankings.
  await deleteCompetitionCascade(competitionId);
  await serviceClient.auth.admin.deleteUser(userA.id);
  await serviceClient.auth.admin.deleteUser(userB.id);
  await serviceClient.auth.admin.deleteUser(userAdmin.id);
});

describe("bets.rejected_at (trigger)", () => {
  it("un pari inséré SUBMITTED n'a pas de date de refus, le passage à REJECTED la pose", async () => {
    const bet = await insertBet({ seriesId: seriesIds[0], userId: userA.id, status: "SUBMITTED", description: "Test rejected_at update" });
    expect(bet.rejected_at).toBeNull();

    const { data, error } = await serviceClient
      .from("bets")
      .update({ status: "REJECTED", refusal_reason: "test" })
      .eq("id", bet.id)
      .select("rejected_at")
      .single();
    expect(error).toBeNull();
    expect(data?.rejected_at).not.toBeNull();
  });

  it("un pari inséré directement REJECTED reçoit la date", async () => {
    const bet = await insertBet({ seriesId: seriesIds[1], userId: userA.id, status: "REJECTED", description: "Test rejected_at insert" });
    expect(bet.rejected_at).not.toBeNull();
  });

  it("une mise à jour sans changement de statut ne déplace pas la date", async () => {
    const bet = await insertBet({ seriesId: seriesIds[2], userId: userB.id, status: "REJECTED", description: "Test rejected_at stable" });
    const { data } = await serviceClient
      .from("bets")
      .update({ refusal_reason: "autre motif" })
      .eq("id", bet.id)
      .select("rejected_at")
      .single();
    expect(new Date(data!.rejected_at as string).getTime()).toBe(new Date(bet.rejected_at as string).getTime());
  });
});

describe("weekly_popups : RLS et RPC de lecture", () => {
  let popupId: string;

  beforeAll(async () => {
    const { data, error } = await serviceClient
      .from("weekly_popups")
      .insert({
        competition_id: competitionId,
        week_end_date: WEEK_END,
        kind: "LLM",
        status: "PUBLISHED",
        published_at: new Date().toISOString(),
        content: { titre: "Titre test", top: `Bravo {{u:${userA.id}}}`, flop: null, refuse: null, champion: null, cta: "Joue" },
        generated_content: { titre: "Titre test", top: `Bravo {{u:${userA.id}}}` },
        candidates: [
          { short_id: "t1", bloc: "top", user_id: userA.id, texte: "texte de A", verdict: "ok" },
          { short_id: "t2", bloc: "top", user_id: userB.id, texte: "texte de B", verdict: "bloque" },
        ],
        featured_user_ids: [userA.id],
        raw_output: "sortie brute",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Insertion weekly_popups échouée: ${error?.message}`);
    popupId = data.id as string;
  });

  it("un joueur ne lit jamais la table des brouillons", async () => {
    const { data, error } = await userA.client.from("weekly_popups").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("un admin la lit", async () => {
    const { data } = await userAdmin.client.from("weekly_popups").select("id").eq("id", popupId);
    expect(data).toHaveLength(1);
  });

  it("un joueur ne peut pas écrire dans la table", async () => {
    const { error } = await userA.client.from("weekly_popups").update({ status: "RETRACTED" }).eq("id", popupId);
    // RLS sans policy d'écriture : zéro ligne touchée ou erreur, jamais une mise à jour.
    const { data } = await serviceClient.from("weekly_popups").select("status").eq("id", popupId).single();
    expect(data?.status).toBe("PUBLISHED");
    void error;
  });

  it("current_weekly_popup renvoie le contenu publié, sans candidats ni sortie brute", async () => {
    const { data, error } = await userB.client.rpc("current_weekly_popup");
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(Object.keys(data as object).sort()).toEqual(["content", "id", "kind", "week_end_date"]);
    expect((data as { id: string }).id).toBe(popupId);
  });

  it("après une vue, current_weekly_popup renvoie null pour ce joueur seulement", async () => {
    const { error } = await userB.client.from("weekly_popup_views").insert({ popup_id: popupId, user_id: userB.id });
    expect(error).toBeNull();

    const forB = await userB.client.rpc("current_weekly_popup");
    expect(forB.data).toBeNull();
    const forA = await userA.client.rpc("current_weekly_popup");
    expect(forA.data).not.toBeNull();
  });

  it("un joueur ne peut pas marquer une popup comme vue au nom d'un autre", async () => {
    const { error } = await userA.client.from("weekly_popup_views").insert({ popup_id: popupId, user_id: userB.id });
    expect(error).not.toBeNull();
  });

  it("my_weekly_popup_mentions ne renvoie que les popups qui citent l'appelant", async () => {
    const forA = await userA.client.rpc("my_weekly_popup_mentions");
    expect(forA.data).toHaveLength(1);
    const forB = await userB.client.rpc("my_weekly_popup_mentions");
    expect(forB.data).toEqual([]);
  });

  it("delete_account_data : mentions retirées, candidats purgés, sortie brute effacée", async () => {
    const { error } = await serviceClient.rpc("delete_account_data", { p_user_id: userA.id });
    expect(error).toBeNull();

    const { data } = await serviceClient
      .from("weekly_popups")
      .select("content, generated_content, candidates, featured_user_ids, raw_output")
      .eq("id", popupId)
      .single();
    expect(JSON.stringify(data?.content)).toContain("{{u:supprime}}");
    expect(JSON.stringify(data?.content)).not.toContain(userA.id);
    expect(JSON.stringify(data?.generated_content)).not.toContain(userA.id);
    expect(data?.featured_user_ids).toEqual([]);
    expect((data?.candidates as { user_id: string }[]).map((c) => c.user_id)).toEqual([userB.id]);
    expect(data?.raw_output).toBeNull();
  });
});
