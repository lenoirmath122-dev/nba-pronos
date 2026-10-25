// HISTORIQUE de la popup : qui a été mis en avant récemment (plan §3.6) et
// titres/cta déjà publiés (prompt v6). Pur.

import { ANY_TOKEN_RE } from "./tokens";
import type { RecentPhrasing, WeeklyPopupContent, WeeklyPopupStatus } from "./types";

/** Nombre de popups publiées relues pour `cite_recemment`. */
export const HISTORY_DEPTH = 2;

/**
 * Joueurs cités par les 2 dernières popups PUBLISHED antérieures à `weekEnd`.
 * Une popup retirée (RETRACTED) ne compte pas, ni une régénération.
 */
export function recentlyFeatured(
  rows: readonly { week_end_date: string; status: WeeklyPopupStatus; featured_user_ids: readonly string[] }[],
  weekEnd: string,
): Set<string> {
  const recent = rows
    .filter((r) => r.status === "PUBLISHED" && r.week_end_date < weekEnd)
    .sort((a, b) => (a.week_end_date < b.week_end_date ? 1 : a.week_end_date > b.week_end_date ? -1 : 0))
    .slice(0, HISTORY_DEPTH);
  const ids = new Set<string>();
  for (const row of recent) for (const id of row.featured_user_ids) ids.add(id.toLowerCase());
  return ids;
}

/** Nombre de popups publiées dont le titre et le cta sont transmis au rédacteur (v6). */
export const PHRASING_DEPTH = 4;
/** Longueur maximale d'un titre ou d'un cta transmis (en points de code). */
export const PHRASING_MAX_CHARS = 200;

const PLAYER_PLACEHOLDER = "[joueur]";
/** Une mention restée en clair (contenu non tokenisé) : jamais transmise. */
const RAW_MENTION_RE = /@[\p{L}\p{N}\p{M}_-]+/gu;

/** Texte transmis : sans jeton, sans pseudo ni uuid, borné ; null si vide. */
function anonymize(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const cleaned = text
    .replace(ANY_TOKEN_RE, PLAYER_PLACEHOLDER)
    .replace(RAW_MENTION_RE, PLAYER_PLACEHOLDER)
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length === 0) return null;
  const chars = Array.from(cleaned);
  return chars.length <= PHRASING_MAX_CHARS ? cleaned : chars.slice(0, PHRASING_MAX_CHARS).join("");
}

/**
 * Titres et cta des 4 dernières popups PUBLISHED antérieures à `weekEnd`, de la
 * plus récente à la plus ancienne (LLM et repli). Ni RETRACTED ni brouillon.
 * Les mentions deviennent « [joueur] » : le rédacteur ne doit ni les recopier
 * ni recevoir de pseudo hors de l'ensemble fermé.
 */
export function recentPhrasing(
  rows: readonly {
    week_end_date: string;
    status: WeeklyPopupStatus;
    content: Pick<WeeklyPopupContent, "titre" | "cta"> | null;
  }[],
  weekEnd: string,
): RecentPhrasing {
  const recent = rows
    .filter((r) => r.status === "PUBLISHED" && r.week_end_date < weekEnd)
    .sort((a, b) => (a.week_end_date < b.week_end_date ? 1 : a.week_end_date > b.week_end_date ? -1 : 0))
    .slice(0, PHRASING_DEPTH);
  const titres: string[] = [];
  const cta: string[] = [];
  for (const row of recent) {
    const titre = anonymize(row.content?.titre);
    if (titre) titres.push(titre);
    const line = anonymize(row.content?.cta);
    if (line) cta.push(line);
  }
  return { titres, cta };
}
