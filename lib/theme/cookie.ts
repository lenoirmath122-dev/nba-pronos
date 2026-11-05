// Thème du site porté par un cookie lisible côté navigateur (05/11/2026,
// alerte quota CPU Vercel) : le layout racine ne lit plus la session, ce qui
// rend les pages publiques cachables. Le cookie est appliqué avant le premier
// rendu par `public/theme-init.js` (même logique que `themeAttributes`, à
// garder alignée -- test lib/theme/cookie.test.ts) et resynchronisé avec la
// base par <ThemeSync> dans le layout (app).
//
// Le cookie n'est pas une donnée de confiance : il ne sert qu'à l'affichage,
// la préférence réelle reste `users.theme_preference` / `background_theme`.

export type ThemePreference = "LIGHT" | "DARK" | "PHOTO";
export type BackgroundTheme = "MURAL" | "HOOP" | "HK";

export const THEME_COOKIE = "pb-theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function encodeThemeCookie(theme: ThemePreference, background: BackgroundTheme): string {
  return `${theme}.${background}`;
}

/** Attributs posés sur <html> : mêmes règles que l'ancien layout racine
 *  (DARK et MURAL = défauts CSS de :root, donc aucun attribut). */
export function themeAttributes(
  theme: ThemePreference,
  background: BackgroundTheme
): { theme?: "light" | "photo"; bg?: "hoop" | "hk" } {
  if (theme === "LIGHT") return { theme: "light" };
  if (theme === "PHOTO") {
    return background === "MURAL" ? { theme: "photo" } : { theme: "photo", bg: background === "HOOP" ? "hoop" : "hk" };
  }
  return {};
}
