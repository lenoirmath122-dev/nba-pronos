// Contrôles de la sortie du rédacteur et d'un texte édité (plan §3.8). Pur.
//
// Erreurs : bloquent (relance, puis brouillon douteux à la génération ;
// bloquent la publication en PR 4). Avertissements : affichés à la relecture.
// Aucun `detail` ne contient de pseudo ni de texte : des codes et des
// compteurs (ils finissent dans `weekly_popups.warnings`, lisible des admins
// et exportable).

import { TOTAL_WORD_LIMIT, WORD_LIMITS } from "./config";
import { countBareMentions, scanMentions } from "./mentions";
import { findMoneyWords } from "./money";
import type { RedacteurOutput } from "./schemas";
import { extractTokenUserIds, tokenize, type MentionableUser } from "./tokens";
import type { WeeklyPopupContent, WeeklyPopupWarning } from "./types";
import { countWords, wordStatus } from "./words";

type PopupBloc = "top" | "flop" | "refuse";
const BLOCS: readonly PopupBloc[] = ["top", "flop", "refuse"];

export interface ValidationContext {
  /** Candidats « ok » + champions retenus : les seuls joueurs citables. */
  closedSet: readonly MentionableUser[];
  /** Ids courts valides par bloc (candidats « ok » seulement). */
  idsByBloc: Record<PopupBloc, ReadonlySet<string>>;
  /** Un champion est fourni au rédacteur. */
  hasChampion: boolean;
  /** Des faits de classement sont fournis au rédacteur (v6). Absent = non. */
  hasRanking?: boolean;
}

export type ValidationError = WeeklyPopupWarning;

export interface TextValidation {
  errors: ValidationError[];
  warnings: WeeklyPopupWarning[];
  /** Contenu avec mentions en jetons (jetons entrants retirés). */
  tokenized: WeeklyPopupContent;
}

const EMOJI_RE = /\p{Extended_Pictographic}/u;

type Field = "titre" | "champion" | "classement" | "top" | "flop" | "refuse" | "cta";
const FIELDS: readonly Field[] = ["titre", "champion", "classement", "top", "flop", "refuse", "cta"];

/**
 * Contrôles qui ne dépendent que du texte et du contexte (réutilisables à la
 * publication et à l'enregistrement d'un brouillon édité). `content` porte des
 * `@pseudo` en clair.
 */
export function validateText(
  content: Omit<WeeklyPopupContent, "repli">,
  ctx: ValidationContext,
): TextValidation {
  const errors: ValidationError[] = [];
  const warnings: WeeklyPopupWarning[] = [];
  const tokenized: WeeklyPopupContent = {
    titre: "",
    champion: null,
    classement: null,
    top: null,
    flop: null,
    refuse: null,
    cta: "",
  };
  let total = 0;

  for (const field of FIELDS) {
    const raw = content[field];
    const bloc = field;
    // Une chaîne vide vaut absent (champ d'éditeur laissé vide).
    if (raw === null || raw === undefined || raw.trim() === "") {
      if (field === "titre" || field === "cta") errors.push({ code: "champ_vide", bloc });
      continue;
    }
    if (raw.trim().toLowerCase() === "null") {
      errors.push({ code: "bloc_chaine_null", bloc });
      continue;
    }

    const scan = scanMentions(raw, ctx.closedSet);
    if (scan.incomingTokens > 0) {
      errors.push({ code: "jeton_entrant", bloc, detail: String(scan.incomingTokens) });
    }
    if (scan.unknownCount > 0) {
      errors.push({ code: "mention_hors_ensemble", bloc, detail: String(scan.unknownCount) });
    }

    const text = tokenize(raw, ctx.closedSet);
    if (field === "titre") tokenized.titre = text;
    else if (field === "cta") tokenized.cta = text;
    else tokenized[field] = text;

    const words = countWords(text);
    total += words;
    const status = wordStatus(words, WORD_LIMITS[field]);
    if (status === "error") {
      errors.push({ code: "mots_bloc", bloc, detail: `${words}/${WORD_LIMITS[field]}` });
    } else if (status === "warn") {
      warnings.push({ code: "mots_bloc", bloc, detail: `${words}/${WORD_LIMITS[field]}` });
    }

    // Pseudo cité sans « @ » : pas tokenisé, donc hors désengagement et purge
    // de compte (avertissement ; à rendre bloquant à la publication, PR 4).
    const bare = countBareMentions(raw, ctx.closedSet);
    if (bare > 0) warnings.push({ code: "pseudo_sans_arobase", bloc, detail: String(bare) });

    const money = findMoneyWords(raw);
    if (money.length > 0) warnings.push({ code: "argent", bloc, detail: money.join(",") });
    if (EMOJI_RE.test(raw)) warnings.push({ code: "emoji", bloc });
  }

  if (total > TOTAL_WORD_LIMIT) {
    errors.push({ code: "mots_total", bloc: "total", detail: `${total}/${TOTAL_WORD_LIMIT}` });
  }

  if (content.champion && !ctx.hasChampion) errors.push({ code: "champion_invente", bloc: "champion" });
  if (!content.champion && ctx.hasChampion) warnings.push({ code: "champion_absent", bloc: "champion" });
  if (content.classement && !ctx.hasRanking) errors.push({ code: "classement_invente", bloc: "classement" });
  if (!content.classement && ctx.hasRanking) warnings.push({ code: "classement_absent", bloc: "classement" });
  for (const bloc of BLOCS) {
    if (content[bloc] === null && ctx.idsByBloc[bloc].size > 0) {
      warnings.push({ code: "bloc_vide_avec_candidats", bloc });
    }
  }

  // Défense en profondeur : après tokenisation, tout jeton doit être un joueur
  // de l'ensemble fermé (la tokenisation ne produit que ceux-là).
  const allowed = new Set(ctx.closedSet.map((u) => u.userId.toLowerCase()));
  const cited = FIELDS.flatMap((f) => {
    const value = tokenized[f];
    return value ? extractTokenUserIds(value) : [];
  });
  if (cited.some((id) => !allowed.has(id))) {
    errors.push({ code: "jeton_hors_ensemble" });
  }

  return { errors, warnings, tokenized };
}

export interface OutputValidation {
  ok: boolean;
  errors: ValidationError[];
  warnings: WeeklyPopupWarning[];
  /** Contenu tokenisé si `ok`, sinon null. */
  content: WeeklyPopupContent | null;
}

/**
 * `validateText` plus les contrôles propres à `paris_cites` : bloc null et
 * ids cohérents, ids connus et du bon bloc. La structure (clés, types,
 * longueurs, doublons) est déjà garantie par `RedacteurOutputSchema`.
 */
export function validateOutput(out: RedacteurOutput, ctx: ValidationContext): OutputValidation {
  const text = validateText(
    {
      titre: out.titre,
      champion: out.champion,
      classement: out.classement ?? null,
      top: out.top,
      flop: out.flop,
      refuse: out.refuse,
      cta: out.cta,
    },
    ctx,
  );
  const errors = [...text.errors];

  for (const bloc of BLOCS) {
    const cited = out.paris_cites[bloc];
    const isNull = out[bloc] === null;
    if (isNull && cited.length > 0) errors.push({ code: "bloc_nul_avec_ids", bloc });
    if (!isNull && cited.length === 0) errors.push({ code: "bloc_sans_ids", bloc });
    const unknown = cited.filter((id) => !ctx.idsByBloc[bloc].has(id)).length;
    if (unknown > 0) errors.push({ code: "id_inconnu", bloc, detail: String(unknown) });
  }

  const ok = errors.length === 0;
  return { ok, errors, warnings: text.warnings, content: ok ? text.tokenized : null };
}
