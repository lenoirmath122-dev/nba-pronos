// Navigateurs intégrés (Instagram, Facebook, Messenger...) : Google y bloque la
// connexion OAuth (plan d'attractivité, §1.9). Le bouton Google y est masqué.

const IN_APP_RE = /(Instagram|FBAN|FBAV|FB_IAB|Messenger|musical_ly|BytedanceWebview|Snapchat|Line\/)/i;

export function isInAppBrowser(userAgent: string): boolean {
  return IN_APP_RE.test(userAgent);
}
