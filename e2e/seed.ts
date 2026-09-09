import { createClient } from "@supabase/supabase-js";
import { LOCAL_SUPABASE } from "../test/integration/env";
import { E2E_BROWSER_PROJECTS, type E2EBrowserProject } from "./projects";

// Données de test pour la suite e2e (C1) -- même patron que
// test/integration/rls.test.ts (A4) : service_role contre le Supabase
// LOCAL, jamais le projet hébergé de .env.local. Un seul jeu de données créé
// une fois par `globalSetup` (nettoyé par `globalTeardown`), écrit dans
// e2e/.e2e-seed.json pour que chaque fichier de test (process séparé) puisse
// le relire -- partagé par les 3 specs T-UI-01/02/03, sauf match2/match3 qui
// ont une entrée par project Playwright (voir E2ESeed ci-dessous).

export const SEED_FILE = `${__dirname}/.e2e-seed.json`;
const NAME_PREFIX = "E2E-TEST-";
const EMAIL_DOMAIN = "@e2e-test.local";

type MatchSeed = { id: string; homeTeamName: string; homeTeamAbbreviation: string };

export type E2ESeed = {
  competitionId: string;
  match1: MatchSeed; // T-UI-01 -- pré-alimenté d'un pari DRAFT à supprimer (jamais confirmé par le test, rejouable par plusieurs projects sans conflit).
  // T-UI-02/03 MUTENT l'état serveur (bet validé / soumis) -- pas rejouables
  // à l'identique par 2 projects Playwright qui partagent le même
  // serveur/DB (workers: 1, un seul webServer, voir playwright.config.ts).
  // Un match DISTINCT par project (e2e/projects.ts) plutôt qu'un seul
  // partagé -- sinon le 2e project à s'exécuter retrouve l'état déjà muté
  // par le 1er (bug trouvé le 07/09/2026 en ajoutant mobile-chrome : le
  // pari de T-UI-02 était déjà VALIDATED, le bouton de T-UI-03 déjà passé
  // à "Modifier le pari").
  match2: Record<E2EBrowserProject, MatchSeed>; // T-UI-02 -- prono de bout en bout (joueur B, connexion réelle).
  match3: Record<E2EBrowserProject, MatchSeed>; // T-UI-03 -- nouveau pari personnalisé (joueur A).
  match4: Record<E2EBrowserProject, MatchSeed>; // T-ERR-02 -- session expirée en cours de soumission (joueur A).
  playerA: { email: string; password: string };
  playerB: { email: string; password: string };
  preSeededBetId: string;
};

function serviceClient() {
  return createClient(LOCAL_SUPABASE.url, LOCAL_SUPABASE.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function purgeLeftovers(supabase: ReturnType<typeof serviceClient>) {
  const { data: competitions } = await supabase
    .from("competitions")
    .select("id")
    .like("name", `${NAME_PREFIX}%`);
  const ids = (competitions ?? []).map((c) => c.id as string);
  if (ids.length > 0) {
    await supabase.from("bets").delete().in("competition_id", ids);
    await supabase.from("match_predictions").delete().in("competition_id", ids);
    await supabase.from("matches").delete().in("competition_id", ids);
    await supabase.from("series").delete().in("competition_id", ids);
    await supabase.from("competitions").delete().in("id", ids);
  }

  const { data: usersPage } = await supabase.auth.admin.listUsers({ perPage: 200 });
  for (const u of usersPage?.users ?? []) {
    if (u.email?.endsWith(EMAIL_DOMAIN)) await supabase.auth.admin.deleteUser(u.id);
  }

  // Équipes e2e d'un run précédent : purgées aussi (pas seulement les
  // compétitions) -- sinon `ensureTeam` retrouve une ligne existante par
  // ABRÉVIATION et réutilise son NOM tel quel (jamais mis à jour), ce qui
  // avait fait fuiter le nom "E2E Team Alpha" d'un ancien schéma de seed
  // dans un run suivant, cassant les sélecteurs par nom d'équipe.
  await supabase.from("teams").delete().like("name", "E2E %");
}

async function ensureTeam(supabase: ReturnType<typeof serviceClient>, name: string, abbreviation: string) {
  const { data: existing } = await supabase.from("teams").select("id").eq("abbreviation", abbreviation).maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await supabase
    .from("teams")
    .insert({ name, abbreviation, conference: "EAST" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Création équipe e2e échouée: ${error?.message}`);
  return data.id as string;
}

async function createTestUser(supabase: ReturnType<typeof serviceClient>, label: string) {
  const email = `e2e-${label}${EMAIL_DOMAIN}`;
  const password = "E2e-Test-Password-1!";
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { pseudo: `e2e_${label}` },
  });
  if (error || !data.user) throw new Error(`Création user e2e échouée (${label}): ${error?.message}`);
  return { id: data.user.id, email, password };
}

export async function seedE2EData(): Promise<E2ESeed> {
  const supabase = serviceClient();
  await purgeLeftovers(supabase);

  const playerA = await createTestUser(supabase, "player-a");
  const playerB = await createTestUser(supabase, "player-b");

  const { data: competition, error: competitionError } = await supabase
    .from("competitions")
    .insert({ name: `${NAME_PREFIX}${Date.now()}`, type: "NBA_CUP", status: "ACTIVE" })
    .select("id")
    .single();
  if (competitionError || !competition) throw new Error(`Compétition e2e échouée: ${competitionError?.message}`);
  const competitionId = competition.id as string;

  const inTwoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

  // /play affiche TOUS les matchs de la compétition active à TOUT joueur
  // connecté (pas seulement "ses" matchs) -- une paire d'équipes DISTINCTE
  // par match est donc nécessaire pour que chaque spec puisse cibler sa
  // propre ligne sans ambiguïté de sélecteur (nom d'équipe unique), plutôt
  // que de dépendre d'un ordre de tri fragile.
  async function createMatch(index: number, slotIndex: number) {
    const homeTeamId = await ensureTeam(supabase, `E2E T${index} Home`, `E${index}H`);
    const awayTeamId = await ensureTeam(supabase, `E2E T${index} Away`, `E${index}A`);

    const { data: series, error: seriesError } = await supabase
      .from("series")
      .insert({ competition_id: competitionId, round: "CUP_QUARTERS", slot_index: slotIndex, official_status: "SCHEDULED" })
      .select("id")
      .single();
    if (seriesError || !series) throw new Error(`Série e2e échouée: ${seriesError?.message}`);

    const { data: match, error: matchError } = await supabase
      .from("matches")
      .insert({
        competition_id: competitionId,
        series_id: series.id,
        game_number: 1,
        scheduled_at: inTwoDays,
        status: "SCHEDULED",
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
      })
      .select("id, series_id")
      .single();
    if (matchError || !match) throw new Error(`Match e2e échoué: ${matchError?.message}`);
    return {
      id: match.id as string,
      seriesId: match.series_id as string,
      homeTeamName: `E2E T${index} Home`,
      homeTeamAbbreviation: `E${index}H`,
    };
  }

  const match1 = await createMatch(1, 0);

  const match2 = {} as Record<E2EBrowserProject, MatchSeed>;
  const match3 = {} as Record<E2EBrowserProject, MatchSeed>;
  const match4 = {} as Record<E2EBrowserProject, MatchSeed>;
  let nextIndex = 2;
  let nextSlot = 1;
  for (const projectName of E2E_BROWSER_PROJECTS) {
    match2[projectName] = await createMatch(nextIndex++, nextSlot++);
    match3[projectName] = await createMatch(nextIndex++, nextSlot++);
    match4[projectName] = await createMatch(nextIndex++, nextSlot++);
  }

  // Pari DRAFT pré-alimenté pour playerA sur match1 (T-UI-01 -- teste la
  // suppression, pas besoin de d'abord passer par tout le flux de saisie).
  const { data: bet, error: betError } = await supabase
    .from("bets")
    .insert({
      competition_id: competitionId,
      user_id: playerA.id,
      scope: "MATCH",
      series_id: match1.seriesId,
      match_id: match1.id,
      description: "Pari e2e à supprimer",
      proposed_category: "SCORE_TOTAL",
      proposed_difficulty: 1,
      status: "DRAFT",
    })
    .select("id")
    .single();
  if (betError || !bet) throw new Error(`Pari e2e pré-semé échoué: ${betError?.message}`);

  const seed: E2ESeed = {
    competitionId,
    match1: { id: match1.id, homeTeamName: match1.homeTeamName, homeTeamAbbreviation: match1.homeTeamAbbreviation },
    match2,
    match3,
    match4,
    playerA: { email: playerA.email, password: playerA.password },
    playerB: { email: playerB.email, password: playerB.password },
    preSeededBetId: bet.id as string,
  };
  return seed;
}

export async function teardownE2EData() {
  const supabase = serviceClient();
  await purgeLeftovers(supabase);
}
