// Comptage de mots de la popup (plan §3.8). Pur.
// Sur du texte TOKENISÉ : un jeton `{{u:<uuid>}}` vaut un mot, comme un
// `@pseudo` à l'affichage (un pseudo à espaces ne doit pas compter double).

import { WORD_ERROR_RATIO, WORD_WARN_RATIO } from "./config";

export function countWords(tokenizedText: string): number {
  const trimmed = tokenizedText.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/u).length;
}

/**
 * ok jusqu'à +20 %, avertissement jusqu'à +50 %, erreur au-delà. Arithmétique
 * entière (les ratios sont 1,2 et 1,5) pour éviter tout arrondi flottant.
 */
export function wordStatus(count: number, limit: number): "ok" | "warn" | "error" {
  const warnTenths = Math.round(WORD_WARN_RATIO * 10);
  const errorTenths = Math.round(WORD_ERROR_RATIO * 10);
  if (count * 10 <= limit * warnTenths) return "ok";
  if (count * 10 <= limit * errorTenths) return "warn";
  return "error";
}
