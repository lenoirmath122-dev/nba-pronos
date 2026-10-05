import type { RecapKind } from "./period";

// Point d'accès unique aux récaps (p3-10). Tout est gratuit aujourd'hui ; à
// la bascule payante (Phase 7), le journalier passera en payant et le hebdo
// « par ligue » aussi (le hebdo général reste gratuit) : c'est ici, et
// seulement ici, qu'il faudra brancher l'abonnement du joueur.
// Paramètres gardés dès maintenant pour que les appelants n'aient pas à changer.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function canReceiveRecap(_userId: string, _kind: RecapKind): boolean {
  return true;
}
