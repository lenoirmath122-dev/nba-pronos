// Jour calendaire America/New_York pour un instant donné — même besoin que
// lib/dates/paris.ts (fuseau différent, ici parce que l'API Highlightly
// interprète le paramètre `date` d'un appel daté comme un jour NY, A6
// Découverte 1). Locale en-CA : seule locale native dont le format court est
// déjà YYYY-MM-DD, évite un recalcul d'offset comme paris.ts.
const NY_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });

export function nyDateString(instant: Date): string {
  return NY_DATE_FORMATTER.format(instant);
}
