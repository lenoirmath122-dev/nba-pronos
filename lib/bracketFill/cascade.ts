import type { CompetitionType } from "@/lib/competitions/types";

// Cascade des équipes CANDIDATES du bracket, PURE et sans import serveur
// (extraite de lib/queries/bracket-fill.ts, qui la ré-exporte) : partagée par
// la lecture serveur, la validation d'un pick (lib/actions/bracket-fill.ts) et
// le mode invité côté client (lib/bracketFill/guestDraft.ts). Une seule
// implémentation, jamais deux qui divergent.
//
// RÈGLE NON NÉGOCIABLE : les candidats d'un tour 2+ ne lisent JAMAIS le
// résultat OFFICIEL de la série précédente, seulement le pick du JOUEUR.

// Tour "racine" : ses 2 équipes sont OFFICIELLES (team1_id/team2_id), pas
// dérivées d'un pick. Tous les tours suivants dérivent de la cascade (§3).
export function isRootRound(round: string, competitionType: CompetitionType): boolean {
  return competitionType === "PLAYOFFS" ? round === "ROUND_1" : round === "CUP_QUARTERS";
}

export type CascadeSeriesRow = {
  id: string;
  round: string;
  next_series_id: string | null;
  next_series_slot: number | null;
  team1_id: string | null;
  team2_id: string | null;
};

/** Calcule les 2 équipes CANDIDATES de chaque série, PURE — voir avertissement
 *  en tête de fichier. `myWinnerBySeriesId` = pick du joueur (vainqueur
 *  choisi), PAS le résultat officiel. */
export function computeCandidateTeamIds(
  series: CascadeSeriesRow[],
  myWinnerBySeriesId: Map<string, string | null>,
  competitionType: CompetitionType
): Map<string, { teamAId: string | null; teamBId: string | null }> {
  const feedersByNextSeriesId = new Map<string, CascadeSeriesRow[]>();
  for (const s of series) {
    if (s.next_series_id) {
      const list = feedersByNextSeriesId.get(s.next_series_id) ?? [];
      list.push(s);
      feedersByNextSeriesId.set(s.next_series_id, list);
    }
  }
  for (const list of feedersByNextSeriesId.values()) {
    list.sort((a, b) => (a.next_series_slot ?? 0) - (b.next_series_slot ?? 0));
  }

  const result = new Map<string, { teamAId: string | null; teamBId: string | null }>();
  for (const s of series) {
    if (isRootRound(s.round, competitionType)) {
      result.set(s.id, { teamAId: s.team1_id, teamBId: s.team2_id });
      continue;
    }
    const feeders = feedersByNextSeriesId.get(s.id) ?? [];
    const teamAId = feeders[0] ? (myWinnerBySeriesId.get(feeders[0].id) ?? null) : null;
    const teamBId = feeders[1] ? (myWinnerBySeriesId.get(feeders[1].id) ?? null) : null;
    result.set(s.id, { teamAId, teamBId });
  }
  return result;
}
