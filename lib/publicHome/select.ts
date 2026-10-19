// Logique pure de l'accueil public (plan d'attractivité, §1.4/§1.5) :
// quel match mettre en avant, et quand afficher les compteurs de pronos.

export type HomeMatchRow = {
  id: string;
  scheduled_at: string | null;
  status: "SCHEDULED" | "IN_PROGRESS" | "FINISHED" | "POSTPONED" | "CANCELLED";
};

/** Règle des petits nombres : sous ce seuil, ni compteur ni pourcentage. */
export const MIN_VOTES_TO_SHOW = 10;

export type MatchSelection<T extends HomeMatchRow> = {
  /** Match commencé et pas fini : affiché « En cours ». */
  live: T | null;
  /** Prochain match ouvert aux pronos (mis en avant). */
  featured: T | null;
  /** Les matchs suivants, ouverts aux pronos. */
  next: T[];
};

/** Un match est ouvert aux pronos s'il est programmé, daté et pas commencé. */
export function isOpenForPronos(m: HomeMatchRow, nowMs: number): boolean {
  return m.status === "SCHEDULED" && m.scheduled_at !== null && Date.parse(m.scheduled_at) > nowMs;
}

export function selectHomeMatches<T extends HomeMatchRow>(rows: T[], nowMs: number, nextCount = 3): MatchSelection<T> {
  const byDate = [...rows]
    .filter((m) => m.scheduled_at !== null)
    .sort((a, b) => Date.parse(a.scheduled_at!) - Date.parse(b.scheduled_at!));
  const open = byDate.filter((m) => isOpenForPronos(m, nowMs));
  const live =
    [...byDate]
      .reverse()
      .find(
        (m) =>
          (m.status === "SCHEDULED" || m.status === "IN_PROGRESS") && Date.parse(m.scheduled_at!) <= nowMs,
      ) ?? null;
  return { live, featured: open[0] ?? null, next: open.slice(1, 1 + nextCount) };
}

export type VoteSplit = { total: number; homePercent: number; awayPercent: number } | null;

/** null sous le seuil : l'accueil affiche « Sois parmi les premiers ». */
export function voteSplit(total: number, homeVotes: number): VoteSplit {
  if (total < MIN_VOTES_TO_SHOW) return null;
  const homePercent = Math.round((homeVotes / total) * 100);
  return { total, homePercent, awayPercent: 100 - homePercent };
}
