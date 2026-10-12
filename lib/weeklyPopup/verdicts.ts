// Verdicts du classifieur (plan §3.7). Pur. Échec fermé : toute anomalie vaut
// « bloque / doute » pour le candidat concerné ; un joueur dont un candidat
// est bloqué disparaît entièrement de la popup (décision 8).

import { createHash } from "node:crypto";
import { isVerdictCoherent, type ClassifierOutput } from "./schemas";
import type { WeeklyPopupCandidate } from "./types";

/** sha256(pseudo + NUL + texte) : le séparateur évite les collisions de concaténation. */
export function inputHash(pseudo: string, texte: string): string {
  return createHash("sha256").update(`${pseudo}\u0000${texte}`).digest("hex");
}

/** Clé de réutilisation d'un verdict : le pari, ou le joueur pour un champion. */
export function candidateKey(c: Pick<WeeklyPopupCandidate, "bet_id" | "user_id">): string {
  return c.bet_id ?? `champion:${c.user_id}`;
}

/**
 * Reprend le verdict d'une génération précédente quand rien n'a changé (même
 * pari ou même champion, même condensat pseudo + texte). Un appel de moins, et
 * un pari bloqué le reste.
 */
export function reuseVerdicts(
  current: readonly WeeklyPopupCandidate[],
  previous: readonly WeeklyPopupCandidate[],
): WeeklyPopupCandidate[] {
  const byKey = new Map<string, WeeklyPopupCandidate>();
  for (const p of previous) {
    if (p.verdict && p.input_hash) byKey.set(candidateKey(p), p);
  }
  return current.map((c) => {
    if (c.verdict) return c;
    const prev = byKey.get(candidateKey(c));
    if (!prev || !prev.verdict || prev.input_hash !== c.input_hash) return c;
    return {
      ...c,
      verdict: prev.verdict,
      categorie: prev.categorie ?? null,
      verdict_source: "reutilise" as const,
    };
  });
}

export interface VerdictAnomalies {
  absent: number;
  doublon: number;
  inconnu: number;
  incoherent: number;
}

/**
 * Applique la sortie du classifieur aux candidats SANS verdict. `output` null
 * (appel échoué) : tous ceux-là sont bloqués. Un id absent, en doublon, ou un
 * verdict incohérent (catégorie non nulle pour « ok », nulle pour « bloque »)
 * bloque le candidat ; un id inconnu est ignoré et compté.
 */
export function mergeVerdicts(
  candidates: readonly WeeklyPopupCandidate[],
  output: ClassifierOutput | null,
  source: "lot" | "unitaire",
): { candidates: WeeklyPopupCandidate[]; anomalies: VerdictAnomalies } {
  const anomalies: VerdictAnomalies = { absent: 0, doublon: 0, inconnu: 0, incoherent: 0 };
  const counts = new Map<string, number>();
  for (const v of output?.verdicts ?? []) counts.set(v.id, (counts.get(v.id) ?? 0) + 1);
  const known = new Set(candidates.map((c) => c.short_id));
  for (const id of counts.keys()) if (!known.has(id)) anomalies.inconnu += 1;

  const blocked = (c: WeeklyPopupCandidate): WeeklyPopupCandidate => ({
    ...c,
    verdict: "bloque",
    categorie: "doute",
    verdict_source: source,
  });

  const merged = candidates.map((c) => {
    if (c.verdict) return c;
    if (!output) return blocked(c);
    const n = counts.get(c.short_id) ?? 0;
    if (n === 0) {
      anomalies.absent += 1;
      return blocked(c);
    }
    if (n > 1) {
      anomalies.doublon += 1;
      return blocked(c);
    }
    const verdict = output.verdicts.find((v) => v.id === c.short_id);
    if (!verdict || !isVerdictCoherent(verdict)) {
      anomalies.incoherent += 1;
      return blocked(c);
    }
    return { ...c, verdict: verdict.verdict, categorie: verdict.categorie, verdict_source: source };
  });
  return { candidates: merged, anomalies };
}

/**
 * Candidats retenus (verdict ok) et joueurs bloqués. Un joueur bloqué perd
 * tous ses candidats, place de champion comprise ; sans verdict = non retenu.
 */
export function applyVerdicts(candidates: readonly WeeklyPopupCandidate[]): {
  kept: WeeklyPopupCandidate[];
  blockedUserIds: Set<string>;
} {
  const blockedUserIds = new Set<string>();
  for (const c of candidates) {
    if (c.verdict === "bloque") blockedUserIds.add(c.user_id);
  }
  const kept = candidates.filter((c) => c.verdict === "ok" && !blockedUserIds.has(c.user_id));
  return { kept, blockedUserIds };
}
