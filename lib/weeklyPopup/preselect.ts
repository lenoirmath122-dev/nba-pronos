// Présélection des candidats de la popup hebdomadaire (plan §3.3 et §3.5). Pur.
// Le code coupe, le LLM choisit : top 5, flop 8, zone Maïno 5 (paris refusés ou acceptés à moins de 5 %), au plus 2 paris par
// joueur et par bloc (appliqué AVANT la coupe, sinon un joueur prolifique
// vide le bloc). Pas de remplissage après un blocage du classifieur (déc. 17).

import { BLOCK_CAPS, MAINO_MAX_PROBA, PER_USER_PER_BLOCK } from "./config";
import { flopIneligibility } from "./families";
import { seuilEtSens } from "./sens";
import type { PopupBetRow, PopupUserRow, Sens } from "./types";

export type PopupBlock = "top" | "flop" | "refuse";

export type ExclusionCode =
  | "admin_corrige"
  | "auteur_inactif"
  | "opt_out"
  | "texte_vide"
  | "annule"
  | "mention"
  | "refus_sans_date";

export interface Preselected {
  bet: PopupBetRow;
  bloc: PopupBlock;
  seuil: number | null;
  sens: Sens | null;
  /** `resolution_reason` tel quel ; null si résolu par un admin ou si refusé. */
  raison: string | null;
}

export interface PreselectResult {
  top: Preselected[];
  flop: Preselected[];
  refuse: Preselected[];
  /** Comptes seulement (jamais d'identifiant ni de texte). */
  excluded: Record<ExclusionCode, number>;
  /** Paris LOST écartés du flop faute de famille éligible (doute f). */
  flopIneligible: number;
}

/** V1 stricte : un `@pseudo` dans le texte du pari écarte le candidat. */
const MENTION_IN_TEXT_RE = /@[\p{L}\p{N}_-]/u;

function exclusionOf(bet: PopupBetRow, users: ReadonlyMap<string, PopupUserRow>): ExclusionCode | null {
  if (bet.status !== "WON" && bet.status !== "LOST" && bet.status !== "REJECTED") return "annule";
  if (bet.is_admin_corrected) return "admin_corrige";
  const author = users.get(bet.user_id);
  if (!author || author.status !== "ACTIVE") return "auteur_inactif";
  if (author.popup_mentions_opt_out) return "opt_out";
  if (bet.description.trim() === "") return "texte_vide";
  if (MENTION_IN_TEXT_RE.test(bet.description)) return "mention";
  if (bet.status === "REJECTED" && bet.rejected_at === null) return "refus_sans_date";
  return null;
}

/** Comparaison croissante, les valeurs absentes en dernier. */
function ascNullsLast(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}
function descNullsLast(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function dateOf(bet: PopupBetRow): number {
  const iso = bet.status === "REJECTED" ? bet.rejected_at : bet.resolved_at;
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? ms : Number.MAX_SAFE_INTEGER;
}

function tieBreak(a: PopupBetRow, b: PopupBetRow): number {
  return dateOf(a) - dateOf(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function capPerUser(sorted: Preselected[], cap: number): Preselected[] {
  const perUser = new Map<string, number>();
  const kept: Preselected[] = [];
  for (const item of sorted) {
    const n = perUser.get(item.bet.user_id) ?? 0;
    if (n >= PER_USER_PER_BLOCK) continue;
    perUser.set(item.bet.user_id, n + 1);
    kept.push(item);
    if (kept.length >= cap) break;
  }
  return kept;
}

const num = (value: number | null | undefined): number | null =>
  value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);

export function preselect(
  bets: readonly PopupBetRow[],
  users: ReadonlyMap<string, PopupUserRow>,
): PreselectResult {
  const excluded: Record<ExclusionCode, number> = {
    admin_corrige: 0,
    auteur_inactif: 0,
    opt_out: 0,
    texte_vide: 0,
    annule: 0,
    mention: 0,
    refus_sans_date: 0,
  };
  let flopIneligible = 0;
  const top: Preselected[] = [];
  const flop: Preselected[] = [];
  const refuse: Preselected[] = [];

  for (const bet of bets) {
    const excl = exclusionOf(bet, users);
    if (excl) {
      excluded[excl] += 1;
      continue;
    }
    const raison = bet.resolved_by_admin_id ? null : bet.resolution_reason?.trim() || null;
    const proba = num(bet.calculated_proba);
    if (bet.status !== "REJECTED" && proba !== null && proba < MAINO_MAX_PROBA) {
      // Zone Maïno : un pari accepté à moins de 5 % de chance va là, ni au top ni au flop.
      refuse.push({ bet, bloc: "refuse", seuil: null, sens: null, raison });
    } else if (bet.status === "WON") {
      const { seuil, sens } = seuilEtSens(bet);
      top.push({ bet, bloc: "top", seuil, sens, raison });
    } else if (bet.status === "LOST") {
      const { seuil, sens } = seuilEtSens(bet);
      if (flopIneligibility(bet, sens) !== null) {
        flopIneligible += 1;
        continue;
      }
      flop.push({ bet, bloc: "flop", seuil, sens, raison });
    } else {
      refuse.push({ bet, bloc: "refuse", seuil: null, sens: null, raison: null });
    }
  }

  top.sort(
    (a, b) =>
      descNullsLast(num(a.bet.validated_difficulty), num(b.bet.validated_difficulty)) ||
      ascNullsLast(num(a.bet.calculated_proba), num(b.bet.calculated_proba)) ||
      tieBreak(a.bet, b.bet),
  );
  flop.sort(
    (a, b) =>
      descNullsLast(num(a.bet.calculated_proba), num(b.bet.calculated_proba)) || tieBreak(a.bet, b.bet),
  );
  refuse.sort((a, b) => tieBreak(a.bet, b.bet));

  return {
    top: capPerUser(top, BLOCK_CAPS.top),
    flop: capPerUser(flop, BLOCK_CAPS.flop),
    refuse: capPerUser(refuse, BLOCK_CAPS.refuse),
    excluded,
    flopIneligible,
  };
}
