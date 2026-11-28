import type { CompetitionType } from "@/lib/competitions/types";
import { CUP_ROUND_NY_WINDOWS } from "@/lib/competitions/cupWindows";
import { nyDayStartUtcIso } from "@/lib/dates/newyork";

// Popup « Remplis ton bracket NBA Cup » (chantier du 28/11/2026,
// Cadrage/Suivi/chantiers/CHANTIER_POPUP_NBA_CUP.md) : règle d'affichage PURE,
// testée sans base. La requête (lib/queries/nbaCupPopup.ts) ne fait que lire
// les lignes et déléguer ici.
//
// Période : compétition NBA_CUP active, quarts connus (2 équipes par série),
// date limite du bracket dans le futur. Aucun interrupteur admin : la popup
// s'arrête seule à `bracket_deadline` (coup d'envoi du 1er quart).
//
// `bracket_deadline` reste NULL tant qu'aucun match n'est rattaché (la synchro
// ne les crée qu'à J-4) ; getBracket considère alors le bracket OUVERT. On
// prend dans ce cas une date de repli : début (heure NY) du premier jour de la
// fenêtre officielle des quarts (lib/competitions/cupWindows.ts).

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

/** Date limite à afficher : la vraie si connue, sinon le repli NY. */
export function effectiveNbaCupDeadline(bracketDeadline: string | null): string | null {
  if (bracketDeadline) return bracketDeadline;
  const firstQuarterDay = CUP_ROUND_NY_WINDOWS[CUP_QUARTERS_ROUND]?.[0];
  return firstQuarterDay ? nyDayStartUtcIso(firstQuarterDay) : null;
}

export function resolveNbaCupPopup(input: NbaCupPopupInput): NbaCupPopupState | null {
  const { competition, series, filled, nowMs } = input;
  if (!competition || competition.type !== "NBA_CUP") return null;
  const deadline = effectiveNbaCupDeadline(competition.bracket_deadline);
  if (!deadline || Date.parse(deadline) <= nowMs) return null;

  const quarters = series.filter((s) => s.round === CUP_QUARTERS_ROUND);
  if (quarters.length === 0) return null;
  // Bracket remplissable seulement quand chaque quart a ses 2 équipes.
  if (quarters.some((s) => !s.team1_id || !s.team2_id)) return null;

  const total = series.length;
  if (filled === null) {
    return { audience: "guest", deadline, filled: 0, total };
  }
  if (filled >= total) return null; // bracket complet : plus rien à demander
  return { audience: "user", deadline, filled, total };
}
