import type { FormLabel, PlayerTrend, TeamFormSummary } from "./types";

// Libellés français de l'aide aux débutants. Vocabulaire de l'appli :
// « pronostiquer », jamais « parier / miser ».

export const FORM_LABEL_TEXT: Record<FormLabel, string> = {
  DEBUT: "Début de saison",
  EN_FEU: "En feu",
  EN_FORME: "En forme",
  IRREGULIERE: "Irrégulière",
  EN_DIFFICULTE: "En difficulté",
};

export const TREND_TEXT: Record<PlayerTrend, string> = {
  EN_HAUSSE: "En hausse",
  EN_BAISSE: "En baisse",
  STABLE: "Stable",
};

export function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n > 1 ? pluralForm : singular}`;
}

export function formatSignedDiff(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toString().replace(".", ",")}`;
}

/** Phrase complète pour les lecteurs d'écran (aucune info portée par la couleur seule). */
export function formAriaLabel(teamName: string, form: TeamFormSummary): string {
  const last5Wins = form.last5.filter((r) => r === "V").length;
  const parts = [
    `${teamName} : ${plural(form.record.wins, "victoire", "victoires")} ${plural(form.record.losses, "défaite", "défaites")}`,
  ];
  if (form.last5.length > 0) {
    parts.push(
      `${plural(last5Wins, "victoire", "victoires")} sur les ${form.last5.length} derniers matchs`
    );
  }
  parts.push(FORM_LABEL_TEXT[form.label].toLowerCase());
  return parts.join(", ");
}

export const STAT_LEGEND: { abbr: string; meaning: string }[] = [
  { abbr: "MIN", meaning: "minutes jouées par match" },
  { abbr: "PTS", meaning: "points marqués par match" },
  { abbr: "REB", meaning: "rebonds (ballons récupérés après un tir manqué)" },
  { abbr: "PD", meaning: "passes décisives (passes qui amènent un panier)" },
  { abbr: "3PTS", meaning: "paniers à 3 points réussis par match" },
  { abbr: "% tir", meaning: "part des tirs réussis" },
  { abbr: "Titulaire", meaning: "joueur du cinq de départ" },
];

/** « Stephen Curry » → « S. Curry » ; un prénom déjà en initiales (« LJ Cryer ») reste tel quel. */
export function abbreviateName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  const [first, ...rest] = parts;
  const isInitials = first.length <= 2 || /^(?:\p{Lu}\.)+$/u.test(first);
  return isInitials ? fullName : `${first.charAt(0)}. ${rest.join(" ")}`;
}

/** Décimale à virgule, 1 chiffre : 28.8 → « 28,8 ». */
export function formatDecimal(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

/** Pourcentage entier ou « – » si absent. */
export function formatPercent(v: number | null): string {
  return v === null ? "–" : `${Math.round(v * 100)} %`;
}

/** Libellé des traits de forme : « 5 derniers matchs : 3 victoires, 2 défaites ». */
export function last5AriaLabel(last5: ("V" | "D")[]): string {
  const wins = last5.filter((r) => r === "V").length;
  const losses = last5.length - wins;
  const count = last5.length === 1 ? "Dernier match" : `${last5.length} derniers matchs`;
  return `${count} : ${plural(wins, "victoire", "victoires")}, ${plural(losses, "défaite", "défaites")}`;
}

/** « 5 V » / « 2 D » (face à face). */
export function formatStreak(s: { type: "V" | "D"; length: number }): string {
  return `${s.length} ${s.type}`;
}

/** « 8e Ouest », « 1er Est ». */
export function formatConferenceRank(rank: number | null, conference: "EAST" | "WEST" | null): string {
  if (rank === null || !conference) return "–";
  return `${rank}${rank === 1 ? "er" : "e"} ${conference === "EAST" ? "Est" : "Ouest"}`;
}
