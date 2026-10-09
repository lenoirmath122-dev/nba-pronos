import type { ValidatedDialogContent } from "@/components/ui/ValidatedDialog";

/** Contenu de la popup affichée quand l'IA valide un pari perso sur-le-champ :
 *  « Pari validé : 42 % de chance pour 15 pts à gagner ». Une proba qui
 *  s'arrondit à 0 s'affiche « moins de 1 % » plutôt qu'un 0 % trompeur. */
export function validatedBetDialog(description: string, probaPct: number | null, points: number | null): ValidatedDialogContent {
  const parts: string[] = [];
  if (probaPct !== null) parts.push(`${probaPct < 1 ? "moins de 1" : probaPct} % de chance`);
  if (points !== null) parts.push(`${points} pts à gagner`);
  const title = parts.length > 0 ? `Pari validé : ${parts.join(" pour ")}` : "Pari validé";
  return { title, items: [description] };
}

/** Toast quand le pari n'a pas pu être calculé automatiquement : un admin le traite. */
export const PENDING_ADMIN_TOAST = "Pari non calculable automatiquement : un admin va le valider et fixer sa difficulté";
