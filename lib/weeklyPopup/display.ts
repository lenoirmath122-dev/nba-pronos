// Affichage de la popup hebdomadaire côté joueur (lot 5, PR 5). Pur, sans I/O :
// le contenu stocké cite les joueurs par jetons `{{u:<uuid>}}` (tokens.ts),
// résolus ici au moment d'afficher ou d'exporter. Plan §1.5, §5.2.

import { detokenize, extractTokenUserIds, type TokenUserInfo } from "./tokens";
import type { WeeklyPopupContent } from "./types";

export type PopupSectionKey = "champion" | "classement" | "top" | "flop" | "refuse";

export interface PopupSection {
  key: PopupSectionKey;
  /** Sous-titre fixe, jamais produit par le LLM. */
  heading: string;
  text: string;
}

/** Ordre d'affichage et sous-titres fixes (plan §5.2). */
const SECTIONS: ReadonlyArray<{ key: PopupSectionKey; heading: string }> = [
  { key: "champion", heading: "En tête" },
  { key: "classement", heading: "Le classement" },
  { key: "top", heading: "Le coup de la semaine" },
  { key: "flop", heading: "Raté de peu" },
  { key: "refuse", heading: "Refusé" },
];

export interface DisplayedPopup {
  titre: string;
  sections: PopupSection[];
  /** Texte de repli (kind FALLBACK), `null` sinon. */
  repli: string | null;
  cta: string;
}

/** Identifiants cités par tous les champs texte du contenu. */
export function userIdsInContent(content: WeeklyPopupContent): string[] {
  const all = [
    content.titre,
    content.champion,
    content.classement,
    content.top,
    content.flop,
    content.refuse,
    content.repli,
    content.cta,
  ]
    .filter((v): v is string => typeof v === "string")
    .join("\n");
  return extractTokenUserIds(all);
}

function resolve(text: string | null | undefined, users: ReadonlyMap<string, TokenUserInfo>): string | null {
  if (typeof text !== "string") return null;
  const resolved = detokenize(text, users).trim();
  return resolved.length > 0 ? resolved : null;
}

/** Contenu prêt à afficher : jetons résolus, blocs vides écartés. */
export function toDisplayedPopup(content: WeeklyPopupContent, users: ReadonlyMap<string, TokenUserInfo>): DisplayedPopup {
  const sections: PopupSection[] = [];
  for (const { key, heading } of SECTIONS) {
    const text = resolve(content[key], users);
    if (text !== null) sections.push({ key, heading, text });
  }
  return {
    titre: resolve(content.titre, users) ?? "",
    sections,
    repli: resolve(content.repli, users),
    cta: resolve(content.cta, users) ?? "",
  };
}

/**
 * Export RGPD : seuls les blocs qui citent `userId`, détokenisés, pour ne
 * rendre ni UUID bruts ni popups entières (plan §1.5). Un autre joueur cité
 * dans le même bloc y reste nommé : c'est le texte publié tel que le joueur
 * l'a vu.
 */
export function mentionsForExport(
  content: WeeklyPopupContent,
  userId: string,
  users: ReadonlyMap<string, TokenUserInfo>,
): Array<{ bloc: PopupSectionKey; texte: string }> {
  const wanted = userId.toLowerCase();
  const out: Array<{ bloc: PopupSectionKey; texte: string }> = [];
  for (const { key } of SECTIONS) {
    const raw = content[key];
    if (typeof raw !== "string") continue;
    if (!extractTokenUserIds(raw).includes(wanted)) continue;
    const texte = resolve(raw, users);
    if (texte !== null) out.push({ bloc: key, texte });
  }
  return out;
}
