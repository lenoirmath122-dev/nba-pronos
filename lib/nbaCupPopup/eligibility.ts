import type { CompetitionType } from "@/lib/competitions/types";

// Popup « Remplis ton bracket NBA Cup » (chantier du 28/11/2026,
// Cadrage/Suivi/chantiers/CHANTIER_POPUP_NBA_CUP.md) : règle d'affichage PURE,
// testée sans base. La requête (lib/queries/nbaCupPopup.ts) ne fait que lire
// les lignes et déléguer ici.
//
// Période : compétition NBA_CUP active, quarts connus (2 équipes par série),
// date limite du bracket dans le futur. Aucun interrupteur admin : la popup
// s'arrête seule à `bracket_deadline` (coup d'envoi du 1er quart).

export type NbaCupPopupAudience = "user" | "guest";

export type NbaCupPopupState = {
  audience: NbaCupPopupAudience;
  /** Date limite ISO du bracket (compte à rebours). */
  deadline: string;
  /** Séries déjà pronostiquées (0 pour un visiteur). */
  filled: number;
  /** Nombre de séries du bracket (7 pour la NBA Cup). */
  total: number;
};

export type NbaCupSeriesRow = {
  round: string;
  team1_id: string | null;
  team2_id: string | null;
};

export type NbaCupPopupInput = {
  competition: { type: CompetitionType; bracket_deadline: string | null } | null;
  series: NbaCupSeriesRow[];
  /** null = visiteur. */
  filled: number | null;
  nowMs: number;
};

export const CUP_QUARTERS_ROUND = "CUP_QUARTERS";

export function resolveNbaCupPopup(input: NbaCupPopupInput): NbaCupPopupState | null {
  const { competition, series, filled, nowMs } = input;
  if (!competition || competition.type !== "NBA_CUP") return null;
  if (!competition.bracket_deadline) return null;
  if (Date.parse(competition.bracket_deadline) <= nowMs) return null;

  const quarters = series.filter((s) => s.round === CUP_QUARTERS_ROUND);
  if (quarters.length === 0) return null;
  // Bracket remplissable seulement quand chaque quart a ses 2 équipes.
  if (quarters.some((s) => !s.team1_id || !s.team2_id)) return null;

  const total = series.length;
  if (filled === null) {
    return { audience: "guest", deadline: competition.bracket_deadline, filled: 0, total };
  }
  if (filled >= total) return null; // bracket complet : plus rien à demander
  return { audience: "user", deadline: competition.bracket_deadline, filled, total };
}
