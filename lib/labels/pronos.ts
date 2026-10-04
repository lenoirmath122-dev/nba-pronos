// Rappel d'un prono de match en une ligne (« LAL bat BOS de 7 pts »), affiché
// dans la popup de validation (components/ui/ValidatedDialog.tsx) — partagé
// entre la validation d'un prono seul (UpcomingRow) et « Tout valider ».
export function formatPronoRecap(winner: string, loser: string, margin: number): string {
  return `${winner} bat ${loser} de ${margin} pt${margin > 1 ? "s" : ""}`;
}
