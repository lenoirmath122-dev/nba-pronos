// Séparateurs de jour dans le fil du chat (23/11/2026) : sans eux, les
// messages n'affichent que l'heure et le fil devient illisible d'un jour
// à l'autre. Fuseau Paris figé (pas celui du navigateur) pour que le rendu
// serveur et le rendu client tombent sur le même jour.

const TIME_ZONE = "Europe/Paris";

const dayKeyFormat = new Intl.DateTimeFormat("fr-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const longFormat = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" });
const longWithYearFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Jour calendaire à Paris, au format AAAA-MM-JJ. */
export function chatDayKey(iso: string): string {
  return dayKeyFormat.format(new Date(iso));
}

/** « Aujourd'hui », « Hier », sinon « lundi 17 novembre » (année ajoutée
 *  si ce n'est pas l'année en cours). */
export function chatDayLabel(iso: string, now: Date = new Date()): string {
  const key = chatDayKey(iso);
  const todayKey = dayKeyFormat.format(now);
  if (key === todayKey) return "Aujourd'hui";
  const yesterdayKey = dayKeyFormat.format(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  if (key === yesterdayKey) return "Hier";
  const sameYear = key.slice(0, 4) === todayKey.slice(0, 4);
  const label = (sameYear ? longFormat : longWithYearFormat).format(new Date(iso));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
