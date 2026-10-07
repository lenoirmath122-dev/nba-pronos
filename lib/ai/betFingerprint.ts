// Empreinte de TYPE d'un pari personnalisé (GAPS_OUVERTS.md, « Couverture des
// types de paris », étape 1) -- pure, déterministe, aucun appel IA.
//
// Deux paris qui ne diffèrent que par le joueur, l'équipe ou le seuil
// ("Cade Cunningham marque plus de 20 points" / "Jalen Williams marque plus
// de 25 points") ont le même squelette, donc la même empreinte : on peut
// ainsi compter combien de paris d'un même type tombent en non-calculable
// sans lire les textes un à un. Version 1 : si les règles changent,
// incrémenter FINGERPRINT_VERSION et mettre à jour la valeur figée du test
// (les empreintes déjà stockées ne sont plus comparables à celles de la
// version précédente).
//
// Limites assumées (le squelette n'a de sens qu'au sein d'un même type) :
// un joueur et une équipe donnent le même X ; "Les Knicks" et "Knicks" ne
// donnent pas le même squelette ; "au moins un tir" et "au moins 1 tir"
// non plus ; un mot courant absent de SENTENCE_START_WORDS en début de
// phrase est masqué en X.

import { createHash } from "node:crypto";

export const FINGERPRINT_VERSION = 1;

// Mots courants qui prennent une majuscule en début de phrase sans être un
// nom propre -- jamais masqués, où qu'ils soient dans le texte.
const COMMON_WORDS = new Set([
  "le", "la", "les", "l", "un", "une", "des", "au", "aux", "du", "il", "elle",
  "ils", "elles", "aucun", "aucune", "plus", "moins", "chaque", "ce", "cet",
  "cette", "ces", "si", "pas", "lors", "durant", "avant", "apres", "dans",
  "pari", "tous", "toutes", "tout", "toute", "en", "sur", "entre", "a", "mi",
  "total", "nombre", "score", "ecart", "match", "quel", "quelle", "combien",
  "dernier", "derniere", "premier", "premiere", "meilleur", "meilleure",
  "equipe", "equipes", "joueur", "joueurs", "et", "ou", "mais", "pour", "avec",
  "sans", "quand", "que", "qui",
]);

// Sigles métier à conserver (dnp, pra...) ; tout autre sigle (LAL, OKC, UCLA,
// ICE) est traité comme un nom propre.
const KEPT_ACRONYMS = new Set(["dnp", "pra", "qt", "mt", "nba", "lf", "ot", "mvp"]);

const NUMBER_WORDS = new Set([
  "zero", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "vingt",
  "vingts", "trente", "quarante", "cinquante", "soixante", "cent", "cents",
  "mille",
]);

const ORDINAL_SUFFIX = /^(?:eme|emes|ere|eres|er|e|es|nd|rd|st|th)$/;

// Jeton : nombre (milliers, décimales, score/intervalle "121-108") non collé
// à une lettre | nombre collé à des lettres ("3pts", "1er", "76ers") | mot.
const TOKEN_RE =
  /(\d{1,3}(?:[  ]\d{3})+|\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)*)(?![\p{L}\d])|(\d+(?:[.,]\d+)?)(\p{L}+)|\p{L}+/gu;

/** Squelette du pari : noms propres -> X, nombres -> N, ordinaux -> Ne. */
export function betSkeleton(text: string): string {
  const normalized = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[«»“”"]/g, " ")
    .replace(/…/g, "...");

  let out = "";
  let pos = 0;
  let prevName = false;
  let prevInitial = false;

  for (const m of normalized.matchAll(TOKEN_RE)) {
    const gap = normalized.slice(pos, m.index);
    pos = m.index + m[0].length;

    let tok: string;
    let isName = false;
    let isInitial = false;

    if (m[1] !== undefined) {
      tok = "N";
    } else if (m[2] !== undefined) {
      const suffix = m[3].toLowerCase();
      if (ORDINAL_SUFFIX.test(suffix)) tok = "Ne";
      else if (m[2] === "76" && suffix === "ers") {
        tok = "X"; // les 76ers : une équipe, pas un nombre
        isName = true;
      } else tok = `N ${suffix}`; // "3pts" -> "N pts"
    } else {
      const word = m[0];
      const lower = word.toLowerCase();
      const startsUpper = word[0] !== lower[0];
      if (NUMBER_WORDS.has(lower)) tok = "N";
      else if (!startsUpper || COMMON_WORDS.has(lower)) tok = lower;
      else if (word.length >= 2 && word === word.toUpperCase()) {
        if (KEPT_ACRONYMS.has(lower)) tok = lower;
        else {
          tok = "X";
          isName = true;
        }
      } else {
        tok = "X";
        isName = true;
        isInitial = word.length === 1;
      }
    }

    // Nom propre collé au précédent (prénom + nom, "Gilgeous-Alexander",
    // "O'Neal", initiales "V. J. Edgecombe") : un seul X. Un point seul ne
    // fusionne qu'après une initiale, jamais à travers une fin de phrase.
    if (
      isName &&
      prevName &&
      (/^[\s'\-]+$/.test(gap) || (prevInitial && /^\.\s*$/.test(gap)))
    ) {
      prevInitial = isInitial;
      continue;
    }

    out += gap + tok;
    prevName = isName;
    prevInitial = isInitial;
  }
  out += normalized.slice(pos);

  return out
    .replace(/N(?:-N)+/g, "N") // "vingt-deux", "quatre-vingt-dix"
    .replace(/\s+/g, " ")
    .replace(/[\s.!?;:,]+$/, "")
    .trim();
}

/** Empreinte courte (12 hex) du squelette -- clé de regroupement par type. */
export function betFingerprint(text: string): string {
  return createHash("sha256").update(betSkeleton(text)).digest("hex").slice(0, 12);
}
