// Événement fenêtre : demande l'ouverture du panneau Profil (écouté par la
// TabBar).
export const OPEN_PROFILE_MENU_EVENT = "open-profile-menu";

// Paramètre d'URL qui ouvre le panneau Profil à l'arrivée sur une page
// (/home?menu=profil) : repli du bouton retour des sous-pages, et cible de
// l'ancienne URL /profile.
export const PROFILE_MENU_PARAM = "menu";
export const PROFILE_MENU_PARAM_VALUE = "profil";
export const PROFILE_MENU_URL = `/home?${PROFILE_MENU_PARAM}=${PROFILE_MENU_PARAM_VALUE}`;

// A-t-on déjà navigué dans l'app depuis le chargement complet de la page ?
// Alimenté par la TabBar (qui persiste entre les pages). Sans historique
// interne (lien direct, rechargement), `router.back()` quitterait l'app.
let navigatedInApp = false;
export function markInternalNavigation() {
  navigatedInApp = true;
}
export function hasInternalNavigation() {
  return navigatedInApp;
}
