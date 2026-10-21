import type { BetSlotIndicator, UpcomingMatchRow } from "@/lib/queries/play";
import type { InlineBetOwned } from "@/components/bets/InlineBetForm";

// Nombre de paris encore possibles sur ce match, dérivé du même
// BetSlotIndicator : BINARY autorise 1 pari par match (0 ou 1 restant),
// SERIES_QUOTA un quota partagé par série (totalSlots − usedSlots).
// Partagé entre UpcomingRow (/play) et la carte « Prochain prono » (/home).
export function remainingBets(betSlot: BetSlotIndicator): number {
  return betSlot.mode === "BINARY" ? (betSlot.hasBetOnThisMatch ? 0 : 1) : Math.max(0, betSlot.totalSlots - betSlot.usedSlots);
}

/** Un pari DRAFT/SUBMITTED reste éditable (InlineBetForm) ; tout autre statut
 *  existant bascule en lecture seule (BetBlock) — même statuts, y compris
 *  annulé/refusé, restent visibles (décision actée avant la fusion). */
export function toInlineBetOwned(bet: UpcomingMatchRow["bet"]): InlineBetOwned | null {
  if (!bet || (bet.status !== "DRAFT" && bet.status !== "SUBMITTED")) return null;
  return { betId: bet.betId, status: bet.status, description: bet.description };
}
