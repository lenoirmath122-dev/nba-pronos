/** Un pari validé peut être rouvert une seule fois par cible, tant que la
 *  deadline est ouverte (SQL : reopen_bet, table bet_reopenings). */
export function canReopenBet(status: string, deadlineOpen: boolean, alreadyReopened: boolean): boolean {
  return status === "VALIDATED" && deadlineOpen && !alreadyReopened;
}
