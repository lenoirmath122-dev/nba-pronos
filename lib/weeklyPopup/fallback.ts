// Textes de repli (semaine pauvre) et phrase du champion (plan §3.10, §9 bis
// décision 19). Pur. Sans genre, sans argent, sans emoji, aucun pseudo : le
// champion n'est cité que par jeton, dans `championSentence`.

import { makeToken } from "./tokens";
import type { WeeklyPopupContent } from "./types";

export interface FallbackText {
  titre: string;
  repli: string;
  cta: string;
}

/** Les 5 textes validés le 11/10/2026, dans cet ordre (rotation modulo 5). */
export const FALLBACK_TEXTS: readonly FallbackText[] = [
  {
    titre: "Semaine calme au comptoir",
    repli:
      "Peu de paris cette semaine, et le classement a fait la sieste. Les prochains matchs ne vont pas se pronostiquer tout seuls.",
    cta: "Passe sur Jouer, les matchs t'attendent.",
  },
  {
    titre: "Le banc était plein",
    repli:
      "Les pronos ont fait banquette cette semaine. Pas de quoi faire une vanne, et c'est bien le problème.",
    cta: "Un pari perso, une idée farfelue : lance-toi.",
  },
  {
    titre: "Semaine sans histoire",
    repli: "Rien à raconter : peu de paris, aucune légende. La rédaction cherche encore ses vannes.",
    cta: "Remplis ta grille, on se retrouve lundi prochain.",
  },
  {
    titre: "Mi-temps",
    repli:
      "Vestiaires silencieux cette semaine. Peu de pronos, peu de paris, donc peu de matière. À toi de remettre du sel.",
    cta: "Un pronostic, un pari : fais du bruit.",
  },
  {
    titre: "Temps mort",
    repli:
      "Temps mort sur le terrain des paris : pas assez de matière pour une vraie revue de presse. Le prochain coup d'envoi est déjà là.",
    cta: "Ouvre l'appli et pronostique avant le coup d'envoi.",
  },
];

/** Index du prochain texte : nombre de popups FALLBACK déjà publiées, modulo 5. */
export function pickFallback(publishedFallbackCount: number): number {
  const n = Math.max(0, Math.trunc(publishedFallbackCount));
  return n % FALLBACK_TEXTS.length;
}

function joinTokens(userIds: readonly string[]): string {
  const tokens = userIds.map(makeToken);
  if (tokens.length <= 1) return tokens.join("");
  return `${tokens.slice(0, -1).join(", ")} et ${tokens[tokens.length - 1]}`;
}

/** Une phrase factuelle, sans genre ; null s'il n'y a pas de champion. */
export function championSentence(champions: readonly { userId: string; points: number }[]): string | null {
  if (champions.length === 0) return null;
  const points = champions[0].points;
  const unit = Math.abs(points) === 1 ? "point" : "points";
  const ids = champions.map((c) => c.userId);
  return champions.length === 1
    ? `En tête de la semaine : ${joinTokens(ids)} avec ${points} ${unit}.`
    : `À égalité en tête : ${joinTokens(ids)}, ${points} ${unit}.`;
}

export function buildFallbackContent(
  index: number,
  champions: readonly { userId: string; points: number }[],
): WeeklyPopupContent {
  const text = FALLBACK_TEXTS[((index % FALLBACK_TEXTS.length) + FALLBACK_TEXTS.length) % FALLBACK_TEXTS.length];
  return {
    titre: text.titre,
    repli: text.repli,
    cta: text.cta,
    champion: championSentence(champions),
    top: null,
    flop: null,
    refuse: null,
  };
}
