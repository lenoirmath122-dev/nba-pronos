// Jour calendaire America/New_York pour un instant donné — même besoin que
// lib/dates/paris.ts (fuseau différent, ici parce que l'API Highlightly
// interprète le paramètre `date` d'un appel daté comme un jour NY, A6
// Découverte 1). Locale en-CA : seule locale native dont le format court est
// déjà YYYY-MM-DD, évite un recalcul d'offset comme paris.ts.
const NY_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });

export function nyDateString(instant: Date): string {
  return NY_DATE_FORMATTER.format(instant);
}

// Un match NBA de la côte Ouest démarre vers 22h-22h30 ET et finit vers
// 1h-1h30 ET : après minuit NY, `nyDateString(now)` désigne déjà le jour
// SUIVANT, et l'API Highlightly (qui filtre par jour NY) ne le renvoie plus
// avec le jour courant. On interroge donc aussi la veille NY pendant les
// premières heures du jour NY (cadrage Match du jour §8 point 5).
export const NY_YESTERDAY_WINDOW_HOURS = 6;

const NY_HOUR_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/New_York",
  hour: "2-digit",
  hourCycle: "h23",
});

/** Jours NY à interroger pour récupérer les résultats : [aujourd'hui], ou
 *  [veille, aujourd'hui] pendant les premières heures du jour NY. */
export function nyResultDates(instant: Date): string[] {
  const today = nyDateString(instant);
  const nyHour = Number(NY_HOUR_FORMATTER.format(instant));
  if (nyHour >= NY_YESTERDAY_WINDOW_HOURS) return [today];
  // -24h depuis une heure NY < 6h retombe toujours sur la veille calendaire,
  // y compris les jours de bascule DST (décalage d'1h max).
  return [nyDateString(new Date(instant.getTime() - 24 * 3600 * 1000)), today];
}

/** Début (00:00, heure de New York) du jour NY `day` (YYYY-MM-DD), en ISO UTC.
 *  Offset lu à midi UTC de ce jour (aucune bascule DST à minuit NY), jamais
 *  -4/-5 codé en dur. */
export function nyDayStartUtcIso(day: string): string {
  const noonUtcMs = Date.parse(`${day}T12:00:00.000Z`);
  const tzName =
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" })
      .formatToParts(new Date(noonUtcMs))
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT-5";
  const match = /GMT([+-]\d+)(?::(\d+))?/.exec(tzName);
  const hours = match ? parseInt(match[1], 10) : -5;
  const minutes = match?.[2] ? parseInt(match[2], 10) : 0;
  const offsetMinutes = hours * 60 + (hours < 0 ? -minutes : minutes);
  return new Date(Date.parse(`${day}T00:00:00.000Z`) - offsetMinutes * 60_000).toISOString();
}
