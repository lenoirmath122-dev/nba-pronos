/** Un pari validé peut être rouvert une seule fois par cible, tant que la
 *  deadline est ouverte (SQL : reopen_bet, table bet_reopenings). */
export function canReopenBet(status: string, deadlineOpen: boolean, alreadyReopened: boolean): boolean {
  return status === "VALIDATED" && deadlineOpen && !alreadyReopened;
}

/** Pari pas encore figé : soumis ou validé, deadline ouverte, modification
 *  unique pas encore consommée (un SUBMITTED peut devenir VALIDATED puis être
 *  rouvert). Tant que c'est le cas, les paris des autres restent cachés
 *  (SQL : bet_is_public). */
export function isBetStillModifiable(status: string, deadlineOpen: boolean, alreadyReopened: boolean): boolean {
  return (status === "SUBMITTED" || status === "VALIDATED") && deadlineOpen && !alreadyReopened;
}
