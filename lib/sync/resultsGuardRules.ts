// Règles pures de la garde « match sans score » (route /api/cron/results-guard,
// lib/sync/resultsGuard.ts). Séparées pour être testées sans base ni réseau.
//
// Contexte : le 18/11/2026, la VM `nba-refresh` (poller des résultats NBA) était
// figée ; le match de la nuit est resté SCHEDULED sans score, et le watchdog GitHub
// (R2 à +5 h) n'est passé qu'une fois toutes les 5 à 9 h. La garde tourne en cron
// Vercel (fiable à l'heure près), relance le repli Highlightly et prévient les admins.

/** Un match NBA dure ~2 h 15 (2 h 45 avec prolongations) : au-delà, il devrait être fini. */
export const LATE_AFTER_MS = 3.5 * 3600e3;
/** Fenêtre de rattrapage (même borne que le watchdog R2). */
export const LATE_WINDOW_MS = 36 * 3600e3;
/** Push « toujours sans score » limité aux premières heures : quelques alertes, pas une par heure pendant 36 h. */
export const ALERT_WINDOW_MS = 7 * 3600e3;

export type GuardMatch = {
  id: string;
  status: string;
  scheduled_at: string;
  home_team_id: string | null;
  away_team_id: string | null;
};

export type GuardPush = { title: string; body: string; url: string };

/** Bornes ISO de `scheduled_at` pour un match en retard : coup d'envoi entre now-36 h et now-3 h 30. */
export function lateWindow(now: Date): { from: string; to: string } {
  return {
    from: new Date(now.getTime() - LATE_WINDOW_MS).toISOString(),
    to: new Date(now.getTime() - LATE_AFTER_MS).toISOString(),
  };
}

export function isOpenStatus(status: string): boolean {
  return status === "SCHEDULED" || status === "IN_PROGRESS";
}

function label(match: GuardMatch, abbreviations: Map<string, string>): string {
  const away = (match.away_team_id && abbreviations.get(match.away_team_id)) || "?";
  const home = (match.home_team_id && abbreviations.get(match.home_team_id)) || "?";
  return `${away} @ ${home}`;
}

function hoursSince(match: GuardMatch, now: Date): number {
  return Math.floor((now.getTime() - Date.parse(match.scheduled_at)) / 3600e3);
}

/** Message aux admins après la passe de rattrapage, ou null s'il n'y a rien à dire.
 *  `healed` : matchs en retard que le repli Highlightly vient de terminer (le score est
 *  là, mais le poller de la VM ne l'a pas posé : c'est lui qu'il faut regarder).
 *  `stillLate` : matchs toujours sans score ; seuls ceux de moins de 7 h déclenchent le push. */
export function buildGuardPush(
  healed: GuardMatch[],
  stillLate: GuardMatch[],
  abbreviations: Map<string, string>,
  now: Date,
): GuardPush | null {
  const alerting = stillLate.filter((m) => now.getTime() - Date.parse(m.scheduled_at) <= ALERT_WINDOW_MS);
  const url = "/admin/sync-logs";

  if (alerting.length > 0) {
    const list = alerting.map((m) => `${label(m, abbreviations)} (coup d'envoi il y a ${hoursSince(m, now)} h)`).join(", ");
    return {
      title: alerting.length > 1 ? `${alerting.length} matchs sans score` : "Match sans score",
      body: `${list} : toujours pas terminé, même après le repli Highlightly. Vérifier la VM nba-refresh et le quota Highlightly.`,
      url,
    };
  }
  if (healed.length > 0) {
    const list = healed.map((m) => label(m, abbreviations)).join(", ");
    return {
      title: "Score rattrapé par le secours",
      body: `${list} : pas de score ${hoursSince(healed[0], now)} h après le coup d'envoi, rattrapé via Highlightly. Le poller de la VM nba-refresh est probablement en panne.`,
      url,
    };
  }
  return null;
}
