// Joueurs « mis en avant » par une popup (plan §3.9, point 6). Pur.
// Calculé à la publication depuis le contenu final (les retouches de l'admin
// comptent) : jetons du top, du flop et du refusé. Le champion, le titre et le
// cta n'entrent pas dans l'historique.

import { extractTokenUserIds } from "./tokens";
import type { WeeklyPopupContent } from "./types";

export function computeFeaturedUserIds(content: Pick<WeeklyPopupContent, "top" | "flop" | "refuse">): string[] {
  const ids = new Set<string>();
  for (const text of [content.top, content.flop, content.refuse]) {
    if (!text) continue;
    for (const id of extractTokenUserIds(text)) ids.add(id);
  }
  return [...ids];
}
