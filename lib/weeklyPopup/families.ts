// Familles de paris éligibles au flop (plan §3.4, doute f). Pur.
//
// Règle d'échelle : le flop compare un seuil à une valeur réelle ; le LLM
// déduit l'écart de la raison du résolveur. Il faut donc que seuil et raison
// parlent de la même grandeur (valeur du joueur, de l'équipe, total combiné).
// Hors liste blanche : pourcentages, minutes, formes sans seuil, duels,
// combos, joueurs de période, séries, superlatifs, rosters, dernier panier,
// contres sur un joueur.

import {
  COUNTING_STAT_COLUMN,
  DNP_RESOLUTION_REASON,
} from "@/lib/ai/resolveBetsShared";
import {
  NOT_IN_MATCH_RESOLUTION_REASON,
  NOT_IN_SERIES_RESOLUTION_REASON,
} from "@/lib/ai/resolveNotInMatchBets";
import { MATCH_STAT_CODES, NO_THRESHOLD_MATCH_STATS } from "@/lib/ai/matchStatCodes";
import { TEAM_PERCENTAGE_STATS, TEAM_STAT_CODES } from "@/lib/ai/teamStatCodes";
import type { PopupBetRow, Sens } from "./types";

export type FlopFamily = "player" | "match_total" | "team_stat" | "period_team" | "tech_count";

export type FlopIneligibleCode =
  | "pas_perdu"
  | "pas_match"
  | "seuil_absent"
  | "sens_absent"
  | "raison_absente"
  | "resolu_par_admin"
  | "raison_automatique"
  | "negation"
  | "famille";

/** Formes jsonb et colonnes « autres » d'un pari (même liste que le résolveur). */
function otherShapes(bet: PopupBetRow, except: keyof PopupBetRow | null): unknown[] {
  const columns: (keyof PopupBetRow)[] = [
    "structured_duel",
    "structured_combo",
    "structured_roster_split",
    "structured_roster_count",
    "structured_technical_fouls_count",
    "structured_superlative",
    "structured_block_on_player",
    "structured_period",
    "structured_last_basket",
  ];
  return columns.filter((c) => c !== except).map((c) => bet[c]);
}

const present = (value: unknown) => value !== null && value !== undefined;

const PERIOD_TEAM_OUTCOMES = new Set(["MARGIN", "TOTAL_POINTS", "QUARTERS_WON_COUNT"]);
const AUTOMATIC_REASONS = new Set<string>([
  DNP_RESOLUTION_REASON,
  NOT_IN_MATCH_RESOLUTION_REASON,
  NOT_IN_SERIES_RESOLUTION_REASON,
]);

/**
 * Famille d'un pari, ou null. L'ordre compte : fautes techniques, période
 * équipe et roster split écrivent aussi `structured_team_id`, donc les formes
 * jsonb se testent avant la stat d'équipe.
 */
export function flopFamily(bet: PopupBetRow): FlopFamily | null {
  const stat = bet.structured_stat;

  if (present(bet.structured_technical_fouls_count)) {
    return otherShapes(bet, "structured_technical_fouls_count").some(present) ? null : "tech_count";
  }

  const period = bet.structured_period;
  if (present(period)) {
    if (otherShapes(bet, "structured_period").some(present)) return null;
    if (present(period?.player_id) || present(bet.structured_player_id)) return null;
    return period?.outcome_kind && PERIOD_TEAM_OUTCOMES.has(period.outcome_kind) ? "period_team" : null;
  }

  if (otherShapes(bet, null).some(present)) return null;
  if (!stat) return null;

  if (present(bet.structured_player_id) && !present(bet.structured_team_id)) {
    return stat !== "plus_minus" && Object.hasOwn(COUNTING_STAT_COLUMN, stat) ? "player" : null;
  }
  if (!present(bet.structured_player_id) && !present(bet.structured_team_id)) {
    const isMatchStat = (MATCH_STAT_CODES as string[]).includes(stat);
    const noThreshold = (NO_THRESHOLD_MATCH_STATS as Set<string>).has(stat);
    return isMatchStat && !noThreshold ? "match_total" : null;
  }
  if (present(bet.structured_team_id) && !present(bet.structured_player_id)) {
    const isTeamStat = (TEAM_STAT_CODES as string[]).includes(stat);
    const isPct = (TEAM_PERCENTAGE_STATS as Set<string>).has(stat);
    return isTeamStat && !isPct ? "team_stat" : null;
  }
  return null;
}

/** Pourquoi un pari ne peut pas figurer au flop (null = éligible). */
export function flopIneligibility(bet: PopupBetRow, sens: Sens | null): FlopIneligibleCode | null {
  if (bet.status !== "LOST") return "pas_perdu";
  if (bet.scope !== "MATCH" || !bet.match_id) return "pas_match";
  if (bet.structured_threshold === null || !Number.isFinite(bet.structured_threshold)) return "seuil_absent";
  if (sens === null) return "sens_absent";
  const reason = bet.resolution_reason?.trim() ?? "";
  if (reason === "") return "raison_absente";
  if (bet.resolved_by_admin_id) return "resolu_par_admin";
  if (AUTOMATIC_REASONS.has(reason) || AUTOMATIC_REASONS.has(bet.resolution_reason ?? "")) {
    return "raison_automatique";
  }
  if (bet.structured_negation === true) return "negation";
  if (flopFamily(bet) === null) return "famille";
  return null;
}

export function isFlopEligible(bet: PopupBetRow, sens: Sens | null): boolean {
  return flopIneligibility(bet, sens) === null;
}
