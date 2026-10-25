// Mise en forme des candidats et des entrées LLM (plan §3.5, prompts v5 et
// classifieur v1, « Format des données »). Pur.
// Le pseudo n'est jamais stocké dans un candidat : il est relu dans la table
// des joueurs au moment de construire l'entrée.

import { TEXT_MAX_CHARS } from "./config";
import { inputHash } from "./verdicts";
import type { Preselected } from "./preselect";
import type { PopupUserRow, WeeklyPopupCandidate } from "./types";

/** « BOS - NYK » ; « ? » pour une équipe inconnue ; null si pas de match. */
export function matchLabel(home?: string | null, away?: string | null): string | null {
  if (!home && !away) return null;
  return `${home || "?"} - ${away || "?"}`;
}

/** Tronque sur les points de code (jamais au milieu d'une paire de substitution). */
export function truncateText(text: string, max: number = TEXT_MAX_CHARS): string {
  const chars = Array.from(text);
  return chars.length <= max ? text : chars.slice(0, max).join("");
}

const STATUT_FR = { WON: "gagné", LOST: "perdu", REJECTED: "refusé" } as const;

export interface ShortIdContext {
  users: ReadonlyMap<string, PopupUserRow>;
  matchLabels: ReadonlyMap<string, string>;
  recentlyFeaturedIds: ReadonlySet<string>;
}

const pseudoOf = (users: ReadonlyMap<string, PopupUserRow>, userId: string): string =>
  users.get(userId)?.pseudo ?? "";

/**
 * Candidats avec ids courts, dans l'ordre du tri : t1.., f1.., r1.., puis
 * c1..cN pour les champions (ex aequo non plafonnés).
 */
export function assignShortIds(
  selected: { top: Preselected[]; flop: Preselected[]; refuse: Preselected[] },
  champions: readonly { userId: string; points: number }[],
  ctx: ShortIdContext,
  rankingUserIds: readonly string[] = [],
): WeeklyPopupCandidate[] {
  const out: WeeklyPopupCandidate[] = [];
  const prefix = { top: "t", flop: "f", refuse: "r" } as const;
  for (const bloc of ["top", "flop", "refuse"] as const) {
    selected[bloc].forEach((item, index) => {
      const { bet } = item;
      const texte = truncateText(bet.description.trim());
      const proba = bet.calculated_proba === null ? null : Number(bet.calculated_proba);
      out.push({
        short_id: `${prefix[bloc]}${index + 1}`,
        bloc,
        bet_id: bet.id,
        user_id: bet.user_id,
        texte,
        match: bet.match_id ? (ctx.matchLabels.get(bet.match_id) ?? null) : null,
        statut: STATUT_FR[bet.status as keyof typeof STATUT_FR] ?? null,
        chance_pct:
          bloc === "refuse" || proba === null || !Number.isFinite(proba) ? null : Math.round(proba * 100),
        raison: item.raison,
        seuil: bloc === "flop" ? item.seuil : null,
        sens: bloc === "flop" ? item.sens : null,
        cite_recemment: ctx.recentlyFeaturedIds.has(bet.user_id),
        input_hash: inputHash(pseudoOf(ctx.users, bet.user_id), texte),
      });
    });
  }
  champions.forEach((champion, index) => {
    out.push({
      short_id: `c${index + 1}`,
      bloc: "champion",
      bet_id: null,
      user_id: champion.userId,
      texte: "",
      points: champion.points,
      input_hash: inputHash(pseudoOf(ctx.users, champion.userId), ""),
    });
  });
  // Joueurs du bloc classement (v6) : classés sur le seul pseudo, comme le champion.
  rankingUserIds.forEach((userId, index) => {
    out.push({
      short_id: `k${index + 1}`,
      bloc: "classement",
      bet_id: null,
      user_id: userId,
      texte: "",
      input_hash: inputHash(pseudoOf(ctx.users, userId), ""),
    });
  });
  return out;
}

/** Une ligne JSON par candidat : id, pseudo, texte (rien d'autre). */
export function buildClassifierInput(
  candidates: readonly WeeklyPopupCandidate[],
  users: ReadonlyMap<string, PopupUserRow>,
): string {
  return candidates
    .map((c) =>
      JSON.stringify({ id: c.short_id, pseudo: `@${pseudoOf(users, c.user_id)}`, texte: c.texte }),
    )
    .join("\n");
}

/**
 * Entrée du rédacteur : champion + candidats « ok » du top, flop et refusé.
 * Ni `user_id`, ni `bet_id`, ni `refusal_reason`.
 */
export function buildRedacteurInput(
  okCandidates: readonly WeeklyPopupCandidate[],
  champion: { pseudos: string[]; points: number } | null,
  users: ReadonlyMap<string, PopupUserRow>,
  rankingLine: string = "null",
): string {
  const championLine = champion
    ? JSON.stringify({ pseudos: champion.pseudos.map((p) => `@${p}`), points: champion.points })
    : "null";
  const lines = okCandidates
    .filter((c) => c.bloc !== "champion" && c.bloc !== "classement")
    .map((c) =>
      JSON.stringify({
        id: c.short_id,
        bloc: c.bloc,
        pseudo: `@${pseudoOf(users, c.user_id)}`,
        match: c.match ?? null,
        texte: c.texte,
        statut: c.statut ?? null,
        chance_annoncee_pct: c.chance_pct ?? null,
        raison: c.bloc === "refuse" ? null : (c.raison ?? null),
        seuil: c.seuil ?? null,
        sens: c.sens ?? null,
        cite_recemment: c.cite_recemment === true,
      }),
    );
  return `CHAMPION: ${championLine}\nCLASSEMENT: ${rankingLine}\nCANDIDATS:\n${lines.join("\n")}`;
}
