// Promesse reprise sur l'accueil quand le visiteur arrive d'un reel (27/10/2026).
// Le lien du reel porte `?focus=` ou, à défaut, `?utm_content=` (voir
// Cadrage/Business/panier_ballon_cadrage_business_communication.md). Lu côté
// navigateur pour que la page reste en cache. Valeur inconnue : accueil inchangé.
//
// Seules des promesses vraies : sans compte on peut voir le classement et le
// bracket, et faire un prono ; les paris persos et le bracket personnel
// demandent un compte, et un prono n'entre au classement qu'une fois enregistré.

export const FOCUS_VALUES = ["paris-perso", "bracket", "classement"] as const;
export type Focus = (typeof FOCUS_VALUES)[number];

export type FocusCopy = { title: string; text: string };

export const FOCUS_COPY: Record<Focus, FocusCopy> = {
  "paris-perso": {
    title: "Invente tes propres paris.",
    text: "Prono du soir d'abord, compte ensuite.",
  },
  bracket: {
    title: "Le bracket NBA Cup arrive en décembre.",
    text: "Chauffe-toi avec le prono du soir.",
  },
  classement: {
    title: "Le classement se joue chaque nuit.",
    text: "Enregistre ton prono avant le coup d'envoi.",
  },
};

function asFocus(raw: string | null): Focus | null {
  const value = raw?.trim().toLowerCase() ?? "";
  return (FOCUS_VALUES as readonly string[]).includes(value) ? (value as Focus) : null;
}

/** `focus` d'abord, sinon `utm_content` ; null si absent ou inconnu. */
export function focusFromSearch(search: string): Focus | null {
  const params = new URLSearchParams(search);
  return asFocus(params.get("focus")) ?? asFocus(params.get("utm_content"));
}
