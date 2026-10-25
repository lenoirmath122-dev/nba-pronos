// Édition et publication d'une popup hebdomadaire par l'admin (lot 5, PR 4).
// Pur, sans I/O : les actions (`lib/actions/admin-weekly-popup.ts`) lisent la
// base, appellent ces fonctions, puis écrivent. Plan §3.9, §4.4, §5.1.

import { validateText, type ValidationContext, type ValidationError } from "./validate";
import { applyVerdicts } from "./verdicts";
import {
  detokenize,
  extractTokenUserIds,
  type MentionableUser,
  type TokenUserInfo,
} from "./tokens";
import type {
  PopupUserRow,
  WeeklyPopupCandidate,
  WeeklyPopupContent,
  WeeklyPopupStatus,
  WeeklyPopupWarning,
} from "./types";

export const EDITABLE_FIELDS = ["titre", "champion", "classement", "top", "flop", "refuse", "cta"] as const;
export type EditableField = (typeof EDITABLE_FIELDS)[number];
export type EditorFields = Record<EditableField, string>;

/** Ce que l'admin voit et modifie : le texte avec des `@pseudo`, jamais de jeton. */
export type EditorUser = Pick<PopupUserRow, "pseudo" | "status" | "popup_mentions_opt_out">;

// --- Transitions (plan §1.3) ------------------------------------------------

/** Statuts depuis lesquels un texte peut être enregistré (jamais en cours de génération). */
export const EDITABLE_STATUSES: readonly WeeklyPopupStatus[] = ["READY", "DOUBTFUL"];
export const PUBLISHABLE_STATUSES: readonly WeeklyPopupStatus[] = ["READY", "DOUBTFUL"];
/** « Ne pas publier » ; une ligne absente est créée directement en SKIPPED. */
export const SKIPPABLE_STATUSES: readonly WeeklyPopupStatus[] = ["READY", "DOUBTFUL"];
export const RETRACTABLE_STATUSES: readonly WeeklyPopupStatus[] = ["PUBLISHED"];

export const isEditable = (status: WeeklyPopupStatus): boolean => EDITABLE_STATUSES.includes(status);
export const isPublishable = (status: WeeklyPopupStatus): boolean => PUBLISHABLE_STATUSES.includes(status);
export const isSkippable = (status: WeeklyPopupStatus): boolean => SKIPPABLE_STATUSES.includes(status);
export const isRetractable = (status: WeeklyPopupStatus): boolean => RETRACTABLE_STATUSES.includes(status);

/**
 * Régénération permise : READY, DOUBTFUL, SKIPPED, ou GENERATING périmé (le
 * jugement « périmé » reste à `reserveRegeneration`, qui le fait en base).
 */
export const isRegenerable = (status: WeeklyPopupStatus): boolean =>
  status === "READY" || status === "DOUBTFUL" || status === "SKIPPED" || status === "GENERATING";

// --- Passage jetons <-> texte éditable -------------------------------------

const tokenInfo = (users: ReadonlyMap<string, EditorUser>): Map<string, TokenUserInfo> => {
  const out = new Map<string, TokenUserInfo>();
  for (const [id, u] of users) {
    out.set(id.toLowerCase(), { pseudo: u.pseudo, popupMentionsOptOut: u.popup_mentions_opt_out });
  }
  return out;
};

/**
 * Contenu stocké (jetons) vers les champs de l'éditeur (`@pseudo`). Un compte
 * supprimé ou ayant refusé d'être cité y apparaît sous son libellé neutre :
 * l'enregistrer supprime de fait la mention.
 */
export function toEditorFields(
  content: WeeklyPopupContent | null,
  users: ReadonlyMap<string, EditorUser>,
): EditorFields {
  const info = tokenInfo(users);
  const field = (value: string | null | undefined): string =>
    typeof value === "string" ? detokenize(value, info) : "";
  return {
    titre: field(content?.titre),
    champion: field(content?.champion),
    classement: field(content?.classement),
    top: field(content?.top),
    flop: field(content?.flop),
    refuse: field(content?.refuse),
    cta: field(content?.cta),
  };
}

/**
 * Champs saisis vers un contenu à contrôler : un bloc vide devient `null`
 * (jamais la chaîne vide, que le rédacteur n'est pas censé produire).
 */
export function fromEditorFields(fields: Partial<Record<EditableField, string>>): Omit<WeeklyPopupContent, "repli"> {
  const clean = (value: string | undefined): string | null => {
    const trimmed = (value ?? "").trim();
    return trimmed === "" ? null : trimmed;
  };
  return {
    titre: clean(fields.titre) as string,
    champion: clean(fields.champion),
    classement: clean(fields.classement),
    top: clean(fields.top),
    flop: clean(fields.flop),
    refuse: clean(fields.refuse),
    cta: clean(fields.cta) as string,
  };
}

// --- Contexte de contrôle ---------------------------------------------------

/**
 * Ensemble fermé et blocs valides d'un brouillon, reconstruits de ses
 * candidats (verdict « ok », joueur non bloqué) et des joueurs d'aujourd'hui :
 * un joueur supprimé, suspendu ou ayant refusé d'être cité depuis la
 * génération n'est plus citable.
 *
 * Semaine pauvre (aucun candidat champion stocké) : le champion n'a pas été
 * classé, les joueurs cités par le jeton du bloc `champion` sont admis (ils
 * viennent de `weekly_champions`, déjà filtrés à la génération).
 */
export function buildValidationContext(
  candidates: readonly WeeklyPopupCandidate[],
  users: ReadonlyMap<string, EditorUser>,
  content: WeeklyPopupContent | null,
): ValidationContext {
  const { kept } = applyVerdicts(candidates);
  const citable = (userId: string): EditorUser | null => {
    const u = users.get(userId) ?? users.get(userId.toLowerCase());
    return u && u.status === "ACTIVE" && !u.popup_mentions_opt_out && u.pseudo.length > 0 ? u : null;
  };

  const closed = new Map<string, MentionableUser>();
  const add = (userId: string) => {
    const u = citable(userId);
    if (u) closed.set(userId.toLowerCase(), { userId, pseudo: u.pseudo });
  };

  const keptBets = kept.filter((c) => c.bloc !== "champion" && c.bloc !== "classement");
  const keptChampions = kept.filter((c) => c.bloc === "champion" && citable(c.user_id));
  for (const c of kept) add(c.user_id);

  let hasChampion = keptChampions.length > 0;
  const championWasClassified = candidates.some((c) => c.bloc === "champion");
  if (!championWasClassified && content?.champion) {
    for (const id of extractTokenUserIds(content.champion)) add(id);
    hasChampion = extractTokenUserIds(content.champion).some((id) => citable(id) !== null);
  }

  const idsFor = (bloc: "top" | "flop" | "refuse") =>
    new Set(keptBets.filter((c) => c.bloc === bloc).map((c) => c.short_id));
  // Classement (v6) : présent s'il a été fourni au rédacteur (candidats k..),
  // ou, pour un contenu édité d'une ancienne génération, s'il est déjà rempli.
  const hasRanking = kept.some((c) => c.bloc === "classement") || !!content?.classement;
  return {
    closedSet: [...closed.values()],
    idsByBloc: { top: idsFor("top"), flop: idsFor("flop"), refuse: idsFor("refuse") },
    hasChampion,
    hasRanking,
  };
}

// --- Contrôles ---------------------------------------------------------------

export interface DraftCheck {
  /** Contenu retokenisé : ce qu'on enregistre ou publie. */
  tokenized: WeeklyPopupContent;
  /** Bloquent la publication (affichées à l'enregistrement, qui reste permis). */
  errors: ValidationError[];
  warnings: WeeklyPopupWarning[];
}

/**
 * Contrôle d'un texte saisi (`@pseudo`). Le contenu `repli` d'un texte de
 * repli est conservé tel quel : il est fixe et ne cite personne.
 */
export function checkEditedContent(
  fields: Partial<Record<EditableField, string>>,
  ctx: ValidationContext,
  repli?: string,
): DraftCheck {
  const result = validateText(fromEditorFields(fields), ctx);
  const tokenized: WeeklyPopupContent = repli === undefined ? result.tokenized : { ...result.tokenized, repli };
  return { tokenized, errors: result.errors, warnings: result.warnings };
}

/**
 * Contrôle bloquant de la publication (plan §3.9) sur le contenu stocké :
 *  - les erreurs de `validateText` ;
 *  - un pseudo cité sans « @ » (hors désengagement et purge de compte) ;
 *  - un jeton vers un joueur ayant refusé d'être cité depuis la génération.
 */
export function checkForPublication(
  content: WeeklyPopupContent,
  ctx: ValidationContext,
  users: ReadonlyMap<string, EditorUser>,
): DraftCheck {
  const fields = toEditorFields(content, users);
  const checked = checkEditedContent(fields, ctx, content.repli);

  const errors: ValidationError[] = [...checked.errors];
  const warnings: WeeklyPopupWarning[] = [];
  for (const w of checked.warnings) {
    if (w.code === "pseudo_sans_arobase") errors.push(w);
    else warnings.push(w);
  }

  const cited = EDITABLE_FIELDS.flatMap((f) => {
    const value = content[f];
    return typeof value === "string" ? extractTokenUserIds(value) : [];
  });
  const refused = new Set(
    cited.filter((id) => {
      const u = users.get(id) ?? users.get(id.toLowerCase());
      return u?.popup_mentions_opt_out === true;
    }),
  );
  if (refused.size > 0) errors.push({ code: "mention_refusee", detail: String(refused.size) });

  return { tokenized: checked.tokenized, errors, warnings };
}

/**
 * Joueurs « mis en avant » : cités par un jeton dans top, flop ou refuse
 * (hors champion, titre et cta). Alimente l'anti-répétition de la semaine
 * suivante (`recentlyFeatured`).
 */
export function featuredUserIds(content: WeeklyPopupContent): string[] {
  return extractTokenUserIds([content.top, content.flop, content.refuse].filter((v): v is string => !!v).join("\n"));
}

/** Tous les joueurs cités par un contenu (pour lire leurs pseudos). */
export function citedUserIds(content: WeeklyPopupContent | null): string[] {
  if (!content) return [];
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
