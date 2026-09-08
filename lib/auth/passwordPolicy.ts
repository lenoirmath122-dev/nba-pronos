// p1-14 (feuille de route Phase 1) : durcissement "un peu" de la politique
// de mot de passe, au-delà du seul "8 caractères" (SignupForm.tsx,
// ResetPasswordForm.tsx, actions.ts::signup dupliquaient déjà ce même
// contrôle en 3 endroits -- centralisé ici plutôt que durci 3 fois en
// divergeant). Volontairement modeste (pas de règle de complexité par
// classe de caractères type majuscule/spécial, pas de liste noire) : ce
// n'est pas une banque, l'objectif est d'éliminer les cas triviaux
// ("12345678", "aaaaaaaaaa") sans pénaliser un joueur qui choisit une
// phrase de passe simple.

export const MIN_PASSWORD_LENGTH = 10;

/** `null` si le mot de passe est acceptable, sinon le message d'erreur à
 *  afficher tel quel (déjà en français, prêt pour l'UI). */
export function passwordPolicyError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Le mot de passe doit contenir au moins une lettre et un chiffre.";
  }
  return null;
}
