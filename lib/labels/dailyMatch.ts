import { nyDateString } from "@/lib/dates/newyork";
import { parisDateKey } from "@/lib/dates/paris";

// Libellé de carte du « Match du jour » (cadrage §8.4) : le jour affiché est
// celui de New York (celui du tirage et de la publication), l'heure est celle
// de Paris. Un match à 19h30 à NY se joue à 01h30 à Paris le lendemain : sans
// sous-titre « dans la nuit du … au … », l'heure seule serait trompeuse.
// Calculé côté serveur (play.ts) à partir de scheduledAt seul — jamais
// d'arithmétique sur le jour : le lendemain vient toujours de la date de Paris
// du coup d'envoi.

export type DailyKickoffLabel = {
  /** « Match du 20/10 » (jour NY). */
  dayLabel: string;
  /** Heure de Paris, « 01:30 ». */
  time: string;
  /** « dans la nuit du 20 au 21 », null si le coup d'envoi est le même jour à Paris. */
  nightLabel: string | null;
  /** Version courte pour les lignes verrouillées : « 01:30 · nuit du 20 au 21 ». */
  shortLabel: string;
};

const PARIS_TIME = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
});

function ddmm(key: string): string {
  const [, month, day] = key.split("-");
  return `${day}/${month}`;
}

function dd(key: string): string {
  return key.split("-")[2];
}

function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function dailyKickoffLabel(iso: string): DailyKickoffLabel {
  const ms = Date.parse(iso);
  const nyDay = nyDateString(new Date(ms));
  const parisDay = parisDateKey(ms);
  const time = PARIS_TIME.format(new Date(ms));
  const dayLabel = `Match du ${ddmm(nyDay)}`;

  // Paris est toujours égal au jour NY ou au lendemain. Un écart plus grand
  // serait une incohérence de données : pas de sous-titre plutôt qu'un faux.
  const isNextDay = parisDay > nyDay && Date.parse(`${parisDay}T00:00:00Z`) - Date.parse(`${nyDay}T00:00:00Z`) === 86_400_000;

  let nightLabel: string | null = null;
  let shortNight: string | null = null;
  if (isNextDay) {
    const sameMonthPair = sameMonth(nyDay, parisDay);
    const range = sameMonthPair ? `du ${dd(nyDay)} au ${dd(parisDay)}` : `du ${ddmm(nyDay)} au ${ddmm(parisDay)}`;
    nightLabel = `dans la nuit ${range}`;
    shortNight = `nuit ${range}`;
  }

  return {
    dayLabel,
    time,
    nightLabel,
    shortLabel: shortNight ? `${time} · ${shortNight}` : time,
  };
}
