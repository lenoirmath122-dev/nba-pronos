// Navigateurs intégrés (Instagram, Facebook, Messenger...) : Google y bloque la
// connexion OAuth (plan d'attractivité, §1.9). Le bouton Google y est masqué.
// La même expression sert à la mesure d'audience (lib/funnel) : une seule source.

const IN_APP_RE = /(Instagram|FBAN|FBAV|FB_IAB|Messenger|musical_ly|BytedanceWebview|Snapchat|Line\/)/i;

export type InAppBrowser = "instagram" | "facebook" | "tiktok" | "snapchat" | "autre";

export function isInAppBrowser(userAgent: string): boolean {
  return IN_APP_RE.test(userAgent);
}

/** Famille du navigateur intégré, ou null pour un navigateur ordinaire. */
export function detectInAppBrowser(userAgent: string | null | undefined): InAppBrowser | null {
  if (!userAgent || !IN_APP_RE.test(userAgent)) return null;
  if (/Instagram/i.test(userAgent)) return "instagram";
  if (/FBAN|FBAV|FB_IAB|Messenger/i.test(userAgent)) return "facebook";
  if (/musical_ly|BytedanceWebview/i.test(userAgent)) return "tiktok";
  if (/Snapchat/i.test(userAgent)) return "snapchat";
  return "autre";
}

export function isAndroid(userAgent: string): boolean {
  return /Android/i.test(userAgent);
}

/**
 * Lien « intent » Android qui rouvre la page dans Chrome depuis un navigateur
 * intégré. Null si l'URL n'est pas en https. iOS n'a pas d'équivalent : on
 * affiche une consigne (menu ··· > Ouvrir dans Safari).
 */
export function androidChromeIntentUrl(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;end`;
}
