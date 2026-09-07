// Tests d'intégration RLS (A4, TEST-002) -- scope réduit décidé pour l'alpha
// NBA Cup du 20/09/2026 : les deux scénarios IDOR que l'alpha exerce
// réellement, plutôt que la matrice complète de audit/BACKLOG_TESTS.md
// (T-SEC-01 à T-SEC-04). T-SEC-01 ajouté le 07/09/2026 (p1-4, feuille de
// route Phase 1) -- les 3 autres (T-SEC-03/04) restent hors scope.
//
// Tape un vrai Postgres via un Supabase local (`npx supabase start`) --
// lancé séparément de la suite unitaire via `npm run test:integration`
// (voir vitest.integration.config.ts). Les fakes utilisés ailleurs dans le
// repo (ex. rateLimit.test.ts) n'appliquent pas la RLS : seule une vraie
// base peut confirmer que les policies bloquent ce qu'elles doivent
// bloquer.

import { type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSignedInTestUser, newRunId, purgeLeftoverTestUsers, serviceClient } from "./fixtures";

const RUN_ID = newRunId();
const COMPETITION_NAME_PREFIX = "RLS-TEST-";
const TEST_USER_EMAIL_DOMAIN = "@rls-test.local";

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

  await purgeLeftoverTestUsers(TEST_USER_EMAIL_DOMAIN);
}

let userA: { id: string; client: SupabaseClient };
let userB: { id: string; client: SupabaseClient };
let userAdmin: { id: string; client: SupabaseClient };
let competitionId: string;
let seriesId: string;
let matchId: string;

beforeAll(async () => {
  await purgeLeftoverTestData();

  userA = await createSignedInTestUser("a", RUN_ID, TEST_USER_EMAIL_DOMAIN);
  userB = await createSignedInTestUser("b", RUN_ID, TEST_USER_EMAIL_DOMAIN);
  userAdmin = await createSignedInTestUser("admin", RUN_ID, TEST_USER_EMAIL_DOMAIN);
  const { error: promoteError } = await serviceClient
    .from("users")
    .update({ role: "ADMIN" })
    .eq("id", userAdmin.id);
  if (promoteError) throw new Error(`Promotion admin échouée: ${promoteError.message}`);

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
  await serviceClient.auth.admin.deleteUser(userAdmin.id);
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

describe("RLS -- visibilité admin des ligues (tableau de bord admin)", () => {
  let leagueId: string;

  beforeAll(async () => {
    const { data, error } = await userA.client.rpc("create_league", {
      p_name: `RLS-TEST-LEAGUE-${RUN_ID}`,
    });
    if (error || !data?.[0]) throw new Error(`Création de la ligue de test échouée: ${error?.message}`);
    leagueId = data[0].id;
  });

  afterAll(async () => {
    await serviceClient.from("league_memberships").delete().eq("league_id", leagueId);
    await serviceClient.from("league_secrets").delete().eq("league_id", leagueId);
    await serviceClient.from("leagues").delete().eq("id", leagueId);
  });

  it("un joueur non-membre (B) ne voit ni la ligue de A ni son appartenance (IDOR)", async () => {
    const { data: seenLeague } = await userB.client.from("leagues").select("id").eq("id", leagueId).maybeSingle();
    expect(seenLeague).toBeNull();

    const { data: seenMemberships } = await userB.client
      .from("league_memberships")
      .select("user_id")
      .eq("league_id", leagueId);
    expect(seenMemberships).toHaveLength(0);
  });

  it("un admin voit la ligue de A et son appartenance, sans en être membre", async () => {
    const { data: seenLeague } = await userAdmin.client.from("leagues").select("id, name").eq("id", leagueId).maybeSingle();
    expect(seenLeague?.id).toBe(leagueId);

    const { data: seenMemberships } = await userAdmin.client
      .from("league_memberships")
      .select("user_id")
      .eq("league_id", leagueId);
    expect(seenMemberships).toHaveLength(1);
    expect(seenMemberships?.[0]?.user_id).toBe(userA.id);
  });
});

describe("RLS -- anti auto-promotion admin (T-SEC-01, p1-4)", () => {
  // users_update_self (id = auth.uid()) autorise un joueur à modifier SA
  // PROPRE ligne sans restriction de colonne au niveau RLS -- la vraie
  // garde vit dans le trigger enforce_users_invariants (migration #3),
  // jamais dans la policy elle-même. Objectif du test : confirmer que ce
  // trigger bloque bel et bien une tentative qui contournerait entièrement
  // setPlayerRole() (lib/actions/admin-players.ts, sa propre garde
  // is_admin() app-level) -- ex. un appel direct forgé au client Supabase,
  // hors UI/Server Action. Scénario "Server Action forgée" du backlog.
  it("un joueur non-admin ne peut pas se promouvoir ADMIN lui-même, même en écrivant directement sur sa propre ligne", async () => {
    const { data: before } = await serviceClient.from("users").select("role").eq("id", userA.id).single();
    expect(before?.role).toBe("PLAYER");

    const { data: updated, error } = await userA.client
      .from("users")
      .update({ role: "ADMIN" })
      .eq("id", userA.id)
      .select("id");
    expect(updated).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toContain("reservee aux admins");

    const { data: after } = await serviceClient.from("users").select("role").eq("id", userA.id).single();
    expect(after?.role).toBe("PLAYER");
  });

  it("aucune entrée audit_logs trompeuse n'apparaît suite à la tentative bloquée", async () => {
    const { data: entries } = await serviceClient
      .from("audit_logs")
      .select("id")
      .eq("target_type", "user")
      .eq("target_id", userA.id);
    expect(entries ?? []).toHaveLength(0);
  });
});

describe("Quota « 3 paris MATCH/série » -- aucun backstop DB (T-DATA-02, p1-4)", () => {
  // Documenté explicitement en tête de 20260726130000_bet_write_functions.sql
  // (migration #9) : ce cap n'est exprimable ni en index ni en RLS, donc
  // exclusivement gardé par un COUNT applicatif DANS save_bet() (+ un
  // pg_advisory_xact_lock pour fermer la fenêtre de course entre 2
  // soumissions quasi simultanées). Ce test CONFIRME ce trou déjà connu
  // plutôt que de le découvrir : une écriture directe via service_role
  // (jamais accessible à un joueur normal -- RLS s'applique à TOUT le
  // reste, seul save_bet() l'contourne délibérément en SECURITY DEFINER)
  // n'est bloquée par AUCUNE contrainte base. Résultat attendu du backlog
  // ("si l'insertion réussit, documenter le trou") : le trou existe, reste
  // sans risque tant que service_role n'est jamais exposé côté client
  // (jamais le cas dans ce dépôt -- clé service_role uniquement côté
  // serveur/cron, cf. lib/supabase/service.ts).
  // 4 matchs DÉDIÉS (game_number 2-5) -- jamais matchId (game_number 1, déjà
  // utilisé par le pari fixture de "RLS -- propriété des paris" plus haut
  // dans ce fichier) : uniq_active_match_bet (1 pari actif par match, CELUI-
  // LÀ a bien un backstop d'index) aurait fait échouer l'insertion pour une
  // raison différente de celle testée ici.
  let extraMatchIds: string[] = [];

  beforeAll(async () => {
    const inTwoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await serviceClient
      .from("matches")
      .insert([
        { competition_id: competitionId, series_id: seriesId, game_number: 2, scheduled_at: inTwoDays, status: "SCHEDULED" },
        { competition_id: competitionId, series_id: seriesId, game_number: 3, scheduled_at: inTwoDays, status: "SCHEDULED" },
        { competition_id: competitionId, series_id: seriesId, game_number: 4, scheduled_at: inTwoDays, status: "SCHEDULED" },
        { competition_id: competitionId, series_id: seriesId, game_number: 5, scheduled_at: inTwoDays, status: "SCHEDULED" },
      ])
      .select("id");
    if (error || !data || data.length !== 4) throw new Error(`Création des matchs supplémentaires échouée: ${error?.message}`);
    extraMatchIds = data.map((m) => m.id as string);
  });

  afterAll(async () => {
    await serviceClient.from("bets").delete().in("match_id", extraMatchIds).eq("user_id", userA.id).eq("description", "Test T-DATA-02");
    await serviceClient.from("matches").delete().in("id", extraMatchIds);
  });

  it("4 paris MATCH actifs sur 4 matchs différents de la même série s'insèrent tous sans erreur via service_role", async () => {
    const { data: inserted, error } = await serviceClient
      .from("bets")
      .insert(
        extraMatchIds.map((mId) => ({
          competition_id: competitionId,
          user_id: userA.id,
          scope: "MATCH" as const,
          series_id: seriesId,
          match_id: mId,
          description: "Test T-DATA-02",
          proposed_category: "SCORE_TOTAL" as const,
          proposed_difficulty: 1,
          status: "SUBMITTED" as const,
        }))
      )
      .select("id");
    expect(error).toBeNull();
    expect(inserted).toHaveLength(4);
  });
});
