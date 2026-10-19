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

/** Raccourcis du curseur d'écart (plan §1.4, bloc 3). */
export const MARGIN_SHORTCUTS: { label: string; value: number }[] = [
  { label: "1–5", value: 3 },
  { label: "6–10", value: 8 },
  { label: "11–15", value: 13 },
  { label: "16+", value: 20 },
];
