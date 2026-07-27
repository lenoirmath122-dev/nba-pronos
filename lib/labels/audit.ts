// Vocabulaire FERMÉ des actions admin journalisées (SPEC_ECRAN_ADMIN_LOGS_V0_1
// §0) — chaque futur lot admin (résolution, requêtes) DOIT ajouter son
// action ici au moment où il commence à journaliser, même rôle que
// lib/labels/bets.ts pour les catégories de pari.

export const ADMIN_ACTION_LABELS: Record<string, string> = {
  VALIDATE_BET: "Pari validé",
  REJECT_BET: "Pari refusé",
  SET_PLAYER_ROLE: "Rôle modifié",
  SET_PLAYER_STATUS: "Statut modifié",
};

export function adminActionLabel(action: string): string {
  return ADMIN_ACTION_LABELS[action] ?? action;
}
