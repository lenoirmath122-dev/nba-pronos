import { cookies } from "next/headers";
import {
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  encodeThemeCookie,
  type BackgroundTheme,
  type ThemePreference,
} from "@/lib/theme/cookie";

// Écriture du cookie de thème depuis une server action (seul contexte serveur
// où les cookies sont modifiables, avec les route handlers et le proxy).
// `httpOnly: false` : lu par public/theme-init.js avant le premier rendu.
export async function setThemeCookie(theme: ThemePreference, background: BackgroundTheme): Promise<void> {
  const store = await cookies();
  store.set(THEME_COOKIE, encodeThemeCookie(theme, background), {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  });
}

/** À la déconnexion : le visiteur retrouve le thème par défaut, comme avant. */
export async function clearThemeCookie(): Promise<void> {
  const store = await cookies();
  store.delete(THEME_COOKIE);
}
