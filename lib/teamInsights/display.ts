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
