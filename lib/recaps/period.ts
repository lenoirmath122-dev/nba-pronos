import { parisDateKey, parisLocalToUtcIso } from "@/lib/dates/paris";

// Fenêtres des récaps (p3-10). Un récap porte un jour Europe/Paris et
// couvre ce qui s'est passé jusqu'à 10h ce jour-là : le journalier depuis la
// veille 10h, l'hebdo depuis le lundi précédent 10h. 10h = heure d'envoi du
// push, choisie avec l'utilisateur (05/10/2026) : les matchs NBA finissent
// vers 5-6h, la synchro des résultats passe toutes les 30 min.
//
// Module pur (aucun accès base), partagé par l'Accueil et le job d'envoi.

export const RECAP_HOUR = 10;

export type RecapKind = "DAILY" | "WEEKLY";

export type RecapPeriod = {
  kind: RecapKind;
  /** Jour du récap, "YYYY-MM-DD" (Europe/Paris). */
  recapDate: string;
  startIso: string;
  /** Fin réelle de la fenêtre : 10h le jour du récap, ou maintenant si la
   *  nuit est encore en cours (récap journalier lu sur l'Accueil avant 10h). */
  endIso: string;
  /** Vrai tant que 10h n'est pas passée : le récap se remplit encore. */
  inProgress: boolean;
  /** Les classements de référence sont les snapshots quotidiens (pris à 14h)
   *  STRICTEMENT antérieurs à ce jour : le plus récent d'entre eux sert de
   *  point de départ pour les points gagnés et l'évolution du rang. */
  baselineBefore: string;
};

/** "YYYY-MM-DD" décalé de `days` jours (arithmétique de calendrier pure). */
export function addDays(dateKey: string, days: number): string {
  const ms = Date.parse(`${dateKey}T12:00:00.000Z`) + days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** 1 = lundi ... 7 = dimanche. */
export function isoWeekday(dateKey: string): number {
  const day = new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Instant UTC de 10h (Paris) le jour donné, été comme hiver. */
export function recapBoundaryIso(dateKey: string): string {
  return parisLocalToUtcIso(`${dateKey}T${String(RECAP_HOUR).padStart(2, "0")}:00`);
}

/** Le récap hebdo part le lundi, à la place du journalier. */
export function recapKindFor(recapDate: string): RecapKind {
  return isoWeekday(recapDate) === 1 ? "WEEKLY" : "DAILY";
}

/** Récap journalier du jour : la nuit en cours avant 10h, la nuit passée
 *  ensuite (jusqu'au lendemain 10h). */
export function dailyPeriod(nowMs: number): RecapPeriod {
  const recapDate = parisDateKey(nowMs);
  const boundaryMs = Date.parse(recapBoundaryIso(recapDate));
  const inProgress = nowMs < boundaryMs;
  return {
    kind: "DAILY",
    recapDate,
    startIso: recapBoundaryIso(addDays(recapDate, -1)),
    endIso: new Date(inProgress ? nowMs : boundaryMs).toISOString(),
    inProgress,
    baselineBefore: recapDate,
  };
}

/** Récap hebdo de `recapDate` (un lundi) : du lundi précédent 10h au lundi
 *  10h, comparé au classement d'il y a 7 jours. */
export function weeklyPeriod(recapDate: string): RecapPeriod {
  const weekStart = addDays(recapDate, -7);
  return {
    kind: "WEEKLY",
    recapDate,
    startIso: recapBoundaryIso(weekStart),
    endIso: recapBoundaryIso(recapDate),
    inProgress: false,
    baselineBefore: addDays(weekStart, 1),
  };
}

/** Le hebdo reste affiché sur l'Accueil du lundi 10h au mardi 10h, au-dessus
 *  du journalier. Null le reste de la semaine. */
export function visibleWeeklyPeriod(nowMs: number): RecapPeriod | null {
  const today = parisDateKey(nowMs);
  const lastSent = nowMs >= Date.parse(recapBoundaryIso(today)) ? today : addDays(today, -1);
  return isoWeekday(lastSent) === 1 ? weeklyPeriod(lastSent) : null;
}
