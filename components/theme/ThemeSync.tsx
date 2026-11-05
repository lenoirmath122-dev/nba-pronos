"use client";

import { useEffect } from "react";
import {
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  encodeThemeCookie,
  themeAttributes,
  type BackgroundTheme,
  type ThemePreference,
} from "@/lib/theme/cookie";

// Aligne <html> et le cookie pb-theme sur la préférence en base, lue par le
// layout (app) (nouvel appareil, cookie effacé, changement depuis un autre
// navigateur). Le layout étant revalidé après chaque changement de thème,
// ce composant reçoit aussi la nouvelle valeur sans rechargement.
export function ThemeSync({ theme, background }: { theme: ThemePreference; background: BackgroundTheme }) {
  useEffect(() => {
    const root = document.documentElement;
    const attrs = themeAttributes(theme, background);
    if (attrs.theme) root.setAttribute("data-theme", attrs.theme);
    else root.removeAttribute("data-theme");
    if (attrs.bg) root.setAttribute("data-bg", attrs.bg);
    else root.removeAttribute("data-bg");

    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${THEME_COOKIE}=${encodeThemeCookie(theme, background)}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  }, [theme, background]);

  return null;
}
