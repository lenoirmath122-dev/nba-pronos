import "server-only";
import { getServiceClient } from "@/lib/supabase/service";

type SupabaseServiceClient = ReturnType<typeof getServiceClient>;

// Fenêtre "roster récent" (BUG-003 de l'audit du 03/09/2026, GAPS_OUVERTS.md
// §"limite architecturale") -- il n'existe aucune table de roster à jour
// dans ce pipeline (stats_joueurs ne porte que l'identité, jamais l'équipe
// courante). Un joueur ayant joué pour cette équipe dans les N derniers
// jours est pris comme proxy raisonnable de "fait partie de l'effectif
// actuel" -- pas une vraie source de vérité (un joueur blessé de longue
// durée en sortirait à tort), mais un signal réel et à jour, là où
// buildDynamicSystemText() ne s'appuyait jusqu'ici QUE sur la connaissance
// générale de Claude (déjà en défaut sur 2 cas constatés : joueurs
// récemment échangés jugés absents du match alors qu'ils jouaient bien pour
// leur nouvelle équipe -- Harden aux Cavaliers, Bane à Detroit).
const ROSTER_WINDOW_DAYS = 30;

/** Même rapprochement que resolveNbaTeamId() dans resolveCalculableBets.ts
 *  (dupliquée ici plutôt que factorisée, convention déjà établie dans ce
 *  module pour les petits résolveurs indépendants) -- pont app teams.id
 *  (uuid) -> stats_equipes.team_id (numérique NBA) via l'abréviation. */
async function resolveNbaTeamId(supabase: SupabaseServiceClient, appTeamId: string): Promise<number | null> {
  const { data: team } = await supabase
    .from("teams")
    .select("abbreviation")
    .eq("id", appTeamId)
    .maybeSingle<{ abbreviation: string }>();
  if (!team?.abbreviation) return null;

  const { data: statsTeam } = await supabase
    .from("stats_equipes")
    .select("team_id")
    .eq("tricode", team.abbreviation)
    .maybeSingle<{ team_id: number }>();
  return statsTeam?.team_id ?? null;
}

async function getTeamRoster(supabase: SupabaseServiceClient, nbaTeamId: number): Promise<string[]> {
  const sinceDate = new Date(Date.now() - ROSTER_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: rows } = await supabase
    .from("stats_box_scores")
    .select("player_id")
    .eq("team_id", nbaTeamId)
    .gte("game_date", sinceDate);
  const playerIds = [...new Set((rows ?? []).map((row) => row.player_id as number))];
  if (playerIds.length === 0) return [];

  const { data: players } = await supabase
    .from("stats_joueurs")
    .select("first_name, family_name")
    .in("player_id", playerIds);
  return ((players ?? []) as { first_name: string; family_name: string }[])
    .map((p) => `${p.first_name} ${p.family_name}`)
    .sort((a, b) => a.localeCompare(b));
}

export type KnownRosters = { team1: string[]; team2: string[] };

/** Effectifs connus des 2 équipes d'un match/série, à injecter dans le
 *  prompt de structuration IA (lib/ai/structureBet.ts, structurePeriodBet.ts)
 *  pour donner à Claude une donnée réelle plutôt que sa seule mémoire
 *  d'entraînement pour juger `not_in_match`. `null` si l'une des 2 équipes
 *  n'est pas mappée côté pipeline stats (ex. équipe fictive de la NBA Cup
 *  Alpha) -- l'appelant retombe alors sur le comportement précédent (aucun
 *  roster injecté, jugement de Claude seul). Jamais levée : une panne ici
 *  ne doit pas casser la structuration, seulement priver ce tour de son
 *  signal supplémentaire. */
export async function resolveKnownRosters(appTeam1Id: string, appTeam2Id: string): Promise<KnownRosters | null> {
  try {
    const supabase = getServiceClient();
    const [nbaTeam1Id, nbaTeam2Id] = await Promise.all([
      resolveNbaTeamId(supabase, appTeam1Id),
      resolveNbaTeamId(supabase, appTeam2Id),
    ]);
    if (nbaTeam1Id === null || nbaTeam2Id === null) return null;

    const [team1, team2] = await Promise.all([
      getTeamRoster(supabase, nbaTeam1Id),
      getTeamRoster(supabase, nbaTeam2Id),
    ]);
    return { team1, team2 };
  } catch {
    return null;
  }
}
