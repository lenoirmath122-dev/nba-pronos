import { parisDateKey } from "@/lib/dates/paris";

// Libellés de l'accueil public (plan d'attractivité, §1.4/§1.5). Heures en
// Europe/Paris, calculées côté serveur pour que le rendu serveur et client
// restent identiques.

const TZ = "Europe/Paris";

function parisHm(ms: number): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "numeric", minute: "2-digit", hourCycle: "h23" }).formatToParts(
    new Date(ms),
  );
  const num = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { h: num("hour"), m: num("minute") };
}

/** "1h00", "20h30". */
export function frenchTime(ms: number): string {
  const { h, m } = parisHm(ms);
  return `${h}h${String(m).padStart(2, "0")}`;
}

/** Surtitre du match mis en avant : « Match de cette nuit · 1h00 », « Jeudi · 1h30 »... */
export function matchKicker(scheduledAt: string, nowMs: number): string {
  const at = Date.parse(scheduledAt);
  const time = frenchTime(at);
  if (at - nowMs <= 24 * 3600_000) {
    if (parisHm(at).h < 6) return `Match de cette nuit · ${time}`;
    const sameParisDay = parisDateKey(at) === parisDateKey(nowMs);
    return `Match ${sameParisDay ? "de ce soir" : "de demain"} · ${time}`;
  }
  const weekday = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long" }).format(new Date(at));
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} · ${time}`;
}

/** « 15 h 42 min » à partir d'une durée en ms (minutes arrondies à l'inférieur). */
export function remainingLabel(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d} j ${h} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  return `${m} min`;
}

// Les matchs de nuit (avant 6 h) comptent pour la soirée qui les précède : « Ce soir 1h00 ».
const NIGHT_END_HOUR = 6;

function eveningKey(ms: number): string {
  return parisDateKey(ms - NIGHT_END_HOUR * 3600_000);
}

function weekdayShort(ms: number): string {
  const day = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "short" }).format(new Date(ms));
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}`;
}

/** Jour et heure de Paris d'une carte de match : « Ce soir 1h00 », « Jeu. 3h30 ». */
export function dayTimeLabel(scheduledAt: string, nowMs: number): string {
  const at = Date.parse(scheduledAt);
  const day = eveningKey(at) === parisDateKey(nowMs) ? "Ce soir" : weekdayShort(at);
  return `${day} ${frenchTime(at)}`;
}

/** Échéance d'enregistrement affichée dans la barre « Mes pronos » : « 1h00 » dans les 24 h, sinon « jeu. 3h30 ». */
export function deadlineLabel(scheduledAt: string, nowMs: number): string {
  const at = Date.parse(scheduledAt);
  if (at - nowMs <= 24 * 3600_000) return frenchTime(at);
  return `${weekdayShort(at).toLowerCase()} ${frenchTime(at)}`;
}
