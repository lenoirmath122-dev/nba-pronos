import "server-only";

// Seul module autorisé à appeler l'API Highlightly (C-1, SPEC_TECHNIQUE_SYNCHRO_V0.1
// §3). Clé lue côté serveur uniquement (HIGHLIGHTLY_API_KEY), jamais exposée au
// navigateur (import "server-only", même garde que lib/supabase/service.ts).
//
// Les types ci-dessous sont calés sur DEUX appels réels effectués le 28/07/2026
// (GET /teams, GET /matches?date=2025-06-08&timezone=America/New_York — cette
// dernière date est un vrai jour de Finals 2025) : le repérage §5.1 de la spec
// n'avait sondé que l'enveloppe/statut/score, pas la forme complète des objets.
// Trouvailles complémentaires à ce repérage initial :
// - /teams renvoie un TABLEAU NU en racine (PAS d'enveloppe "data"), contrairement
//   à /matches qui, lui, enveloppe bien dans "data" — asymétrie non documentée par
//   la spec, vérifiée empiriquement.
// - /teams mélange, sous league="NBA", les 30 vraies franchises ET des entités
//   sans rapport (équipes All-Star "Team Durant"/"Team LeBron"/"Western Conf
//   All-Stars", une équipe internationale "NEWZEALAND Breakers", "World") —
//   voir lib/nba/teamAliases.ts, qui ne fait JAMAIS confiance à league="NBA" seul.

const BASE_URL = "https://nba.highlightly.net";

export type RawTeamRef = {
  id: number;
  displayName: string;
  name: string;
  abbreviation: string;
  logo: string | null;
};

export type RawTeam = RawTeamRef & { league: string };

export type RawMatch = {
  id: number;
  league: string;
  season: number;
  date: string; // ISO UTC — le paramètre timezone ne change que le regroupement par jour côté API, pas ce champ (A6, Découverte 1).
  state: {
    clock: number;
    period: number;
    description: string; // voir normalizeMatchStatus() — une seule valeur confirmée empiriquement à ce jour.
    score: { homeTeam: number[]; awayTeam: number[] }; // par quart-temps (A6, Découverte 2) — sommer via sumQuarters().
  };
  homeTeam: RawTeamRef;
  awayTeam: RawTeamRef;
};

export type FetchResult<T> = { data: T; requestsRemaining: number | null };

export class HighlightlyApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HighlightlyApiError";
  }
}

function apiKey(): string {
  const key = process.env.HIGHLIGHTLY_API_KEY;
  if (!key) throw new HighlightlyApiError("HIGHLIGHTLY_API_KEY manquante en environnement serveur.");
  return key;
}

async function request(path: string): Promise<{ json: unknown; requestsRemaining: number | null }> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { "x-rapidapi-key": apiKey() },
      cache: "no-store",
    });
  } catch (error) {
    throw new HighlightlyApiError(
      `Appel réseau Highlightly échoué (${path}) : ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const remainingHeader = response.headers.get("x-ratelimit-requests-remaining");
  const requestsRemaining = remainingHeader !== null ? Number(remainingHeader) : null;

  if (!response.ok) {
    throw new HighlightlyApiError(`Highlightly a répondu ${response.status} pour ${path}.`);
  }

  try {
    return { json: await response.json(), requestsRemaining };
  } catch {
    throw new HighlightlyApiError(`Réponse Highlightly illisible (JSON invalide) pour ${path}.`);
  }
}

/** SOMME du tableau par quart-temps (A6, Découverte 2) — 4 valeurs, 5 en
 *  prolongation. JAMAIS lire une valeur unique du tableau. */
export function sumQuarters(scoreArray: number[]): number {
  return scoreArray.reduce((total, quarter) => total + quarter, 0);
}

/** Chantier "prolongation" (GAPS_OUVERTS.md, 24/08/2026) -- MEME tableau que
 *  sumQuarters() ci-dessus (4 valeurs normalement, 5+ en prolongation), lu
 *  une 2e fois pour en tirer le signal OT plutot que de synchroniser tout
 *  play_by_play vers Supabase (jamais fait, design delibere -- voir
 *  backfill_supabase.py). */
export function wentToOvertime(scoreArray: number[]): boolean {
  return scoreArray.length > 4;
}

export type NormalizedMatchStatus = "SCHEDULED" | "IN_PROGRESS" | "FINISHED" | "POSTPONED" | "CANCELLED";

/**
 * Traduit `state.description` (texte libre côté Highlightly) vers notre enum
 * `match_status`. SEULE valeur confirmée empiriquement à ce jour (28/07/2026) :
 * "Finished". Les autres correspondances sont des hypothèses de vocabulaire
 * sportif anglais courant, PAS vérifiées sur un vrai payload — à confirmer au
 * premier test réel sur une fenêtre de matchs passée (SCHEDULED puis IN_PROGRESS
 * observés en vrai). Un texte non reconnu retombe sur IN_PROGRESS (jamais
 * SCHEDULED : un faux "en cours" qui bloque à tort une saisie manuelle admin est
 * moins dangereux qu'un match réellement en cours affiché comme pas commencé) et
 * remonte `recognized: false` pour que l'appelant le journalise dans sync_logs.
 */
export function normalizeMatchStatus(description: string): { status: NormalizedMatchStatus; recognized: boolean } {
  const normalized = description.trim().toLowerCase();
  if (normalized === "finished" || normalized === "final") return { status: "FINISHED", recognized: true };
  if (normalized === "scheduled" || normalized === "not started") return { status: "SCHEDULED", recognized: true };
  if (normalized === "postponed") return { status: "POSTPONED", recognized: true };
  if (normalized === "cancelled" || normalized === "canceled") return { status: "CANCELLED", recognized: true };
  if (
    ["in progress", "live", "halftime", "overtime", "1st quarter", "2nd quarter", "3rd quarter", "4th quarter"].includes(
      normalized
    )
  ) {
    return { status: "IN_PROGRESS", recognized: true };
  }
  return { status: "IN_PROGRESS", recognized: false };
}

/** GET /teams — racine = tableau nu (pas d'enveloppe "data", voir en-tête de
 *  fichier). Renvoie TOUTES les entrées telles quelles (NBA réel + NCAA +
 *  exhibitions/international mal taguées) — le tri se fait dans
 *  lib/nba/teamAliases.ts, jamais ici. */
export async function getTeams(): Promise<FetchResult<RawTeam[]>> {
  const { json, requestsRemaining } = await request("/teams");
  if (!Array.isArray(json)) {
    throw new HighlightlyApiError("Réponse /teams inattendue : racine non-tableau.");
  }
  return { data: json as RawTeam[], requestsRemaining };
}

/** GET /matches?date=...&timezone=America/New_York (A6, Découverte 1) —
 *  enveloppe "data" (contrairement à /teams). Mélange toutes les ligues (§5.1) :
 *  filtré ici sur league==="NBA", pas laissé à l'appelant. */
export async function getMatchesByDate(date: string): Promise<FetchResult<RawMatch[]>> {
  const { json, requestsRemaining } = await request(
    `/matches?date=${encodeURIComponent(date)}&timezone=America/New_York`
  );
  const body = json as { data?: unknown };
  if (!Array.isArray(body.data)) {
    throw new HighlightlyApiError("Réponse /matches inattendue : champ data absent ou non-tableau.");
  }
  const matches = (body.data as RawMatch[]).filter((match) => match.league === "NBA");
  return { data: matches, requestsRemaining };
}
