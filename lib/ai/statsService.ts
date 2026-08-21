import "server-only";
import { NO_THRESHOLD_STATS } from "./statCodes";
import type { StatCode } from "./statCodes";

// Appel HTTP au micro-service Python déployé sur Google Cloud Run
// (Cadrage/Stats/service/app.py, projet-data-nba.md §24) -- SEULE
// dépendance externe pour calculer une vraie probabilité, l'appli
// TypeScript ne réimplémente aucune logique de modèle.

export type StatsPredictResult = {
  proba: number; // toujours "P(stat > seuil)" côté service -- OVER/UNDER résolu par l'appelant (voir predictOverUnder)
  label: string;
  detail: string;
};

async function callPredict(body: Record<string, unknown>): Promise<StatsPredictResult | null> {
  const url = process.env.STATS_SERVICE_URL;
  if (!url) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Cloud Run peut se réveiller depuis zéro (scale à zéro, §23) -- laisse
      // le temps d'un cold start plutôt que d'abandonner trop tôt.
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.proba !== "number") return null;
    return { proba: data.proba, label: data.label, detail: data.detail };
  } catch {
    return null;
  }
}

/**
 * Résout la proba d'un pari OVER ou UNDER. Le service ne sait calculer que
 * P(stat > seuil) -- pour UNDER, approximation 1 - P(stat > seuil) (ignore
 * P(stat == seuil) pile sur le seuil, écart mineur assumé pour ce 1er jet,
 * cf. seuils de palier provisoires décidés le 21/08/2026).
 */
export async function predictOverUnder(
  playerName: string,
  stat: StatCode,
  threshold: number | null,
  comparison: "OVER" | "UNDER",
): Promise<StatsPredictResult | null> {
  const body: Record<string, unknown> = { joueur: playerName, stat };
  if (!NO_THRESHOLD_STATS.has(stat)) {
    if (threshold === null) return null;
    body.seuil = threshold;
  }

  const result = await callPredict(body);
  if (!result) return null;
  if (comparison === "UNDER" && !NO_THRESHOLD_STATS.has(stat)) {
    return { ...result, proba: 1 - result.proba };
  }
  return result;
}
