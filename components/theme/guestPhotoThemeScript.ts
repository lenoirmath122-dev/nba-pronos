// Invité sans thème mémorisé (pas de cookie pb-theme) : fond photo par défaut
// sur les écrans de l'appli (18/11/2026, demandé par l'utilisateur). Un
// visiteur qui a déjà choisi un thème (ancien compte déconnecté) le garde ;
// à la connexion, ThemeSync aligne <html> sur la préférence du compte.
export const GUEST_PHOTO_THEME_SCRIPT =
  "try{if(!/(?:^|;\s*)pb-theme=/.test(document.cookie))document.documentElement.setAttribute('data-theme','photo')}catch(e){}";

export function applyGuestPhotoTheme(): void {
  if (!/(?:^|;\s*)pb-theme=/.test(document.cookie)) {
    document.documentElement.setAttribute("data-theme", "photo");
  }
}
