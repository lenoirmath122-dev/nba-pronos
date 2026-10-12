import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { parisDateKey, parisDayBoundsUtc } from "@/lib/dates/paris";

// Compteur + plafond de dépense sur les appels Anthropic de structuration IA
// (p1-8, feuille de route Phase 1) -- 9 fonctions structure*Bet() dans ce
// dossier appellent toutes client.messages.parse() avec le même modèle par
// défaut (claude-sonnet-5), un appel synchrone par pari soumis. Best-effort
// partout ici, même patron que lib/sync/logging.ts::writeSyncLog : un échec
// d'écriture/lecture ne doit jamais faire échouer la structuration elle-même.

// Tarif $/1M tokens (Cadrage/Stats/projet-data-nba.md §35 pour le choix du
// modèle par défaut) -- cache write/read au ratio standard Anthropic pour
// un TTL éphémère 5 min (1.25x / 0.1x du prix input de base), aucun tarif
// séparé publié pour le cache. Approximatif par construction : sert à
// comparer à un plafond, pas à une facture exacte.
const PRICE_PER_MTOK_USD: Record<
  string,
  { input: number; output: number; cacheWrite: number; cacheRead: number }
> = {
  "claude-sonnet-5": { input: 2.0, output: 10.0, cacheWrite: 2.5, cacheRead: 0.2 },
  // À CONFIRMER (lot 5, décision 12 du plan popup hebdo) : tarif de sonnet-5
  // repris provisoirement, la console Anthropic n'affichait pas encore de coût
  // réel le 11/10/2026. Surestimation sans danger pour un coupe-circuit ; à
  // ajuster une fois le coût réel lu.
  "claude-sonnet-5-5": { input: 2.0, output: 10.0, cacheWrite: 2.5, cacheRead: 0.2 },
};
// Modèle inconnu : tarif connu le plus cher (jamais sous-estimer un plafond).
const FALLBACK_PRICE = Object.values(PRICE_PER_MTOK_USD).reduce((max, p) =>
  p.output > max.output || (p.output === max.output && p.input > max.input) ? p : max,
);

export type AnthropicUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

export function estimateCostUsd(model: string, usage: AnthropicUsage): number {
  const price = PRICE_PER_MTOK_USD[model] ?? FALLBACK_PRICE;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  return (
    (usage.input_tokens * price.input +
      usage.output_tokens * price.output +
      cacheRead * price.cacheRead +
      cacheWrite * price.cacheWrite) /
    1_000_000
  );
}

/** Pire coût d'un appel : entrée estimée (~3 caractères par token, large pour
 *  du français) + `maxTokens` de sortie (la réflexion est facturée en sortie).
 *  Sert au contrôle du plafond AVANT l'appel, et à l'estimation au pire d'un
 *  timeout (une requête abandonnée côté client peut être facturée). */
export function estimateWorstCaseCostUsd(model: string, inputChars: number, maxTokens: number): number {
  return estimateCostUsd(model, { input_tokens: Math.ceil(inputChars / 3), output_tokens: maxTokens });
}

// Plafond quotidien (Europe/Paris) de dépense IA sur la structuration de
// paris. Pas un budget chiffré ailleurs dans le projet -- départ prudent,
// à ajuster une fois une vraie conso observée en usage réel (même esprit
// que LOW_QUOTA_THRESHOLD, lib/sync/logging.ts). Vérifié AVANT chaque appel
// Claude (structureAndScoreBet.ts), jamais après coup.
export const DAILY_COST_CAP_USD = 5;

/** Plafond quotidien de la popup hebdomadaire (lot 5) : coupe-circuit, pas un
 *  budget. Compté à part de la structuration (filtre sur `call_site`) et
 *  FERMÉ : une lecture en erreur vaut plafond atteint. */
export const POPUP_DAILY_COST_CAP_USD = 1;

export type SpendScope = "structuration" | "popup";

/** Les `call_site` de la popup hebdomadaire commencent tous par `popup`. */
const POPUP_CALL_SITE_PREFIX = "popup";

/** Colonnes de journal d'`ai_usage_logs` (migration 20261013090000). */
export type UsageMeta = {
  status?: string;
  stopReason?: string | null;
  requestId?: string | null;
  latencyMs?: number;
  thinkingTokens?: number;
  attempt?: number;
  /** Remplace l'estimation par les tokens (timeout : estimation au pire). */
  estimatedCostUsd?: number;
};

/** Best-effort : n'écrit jamais d'exception vers l'appelant (même contrat
 *  que writeSyncLog). Appelée après CHAQUE client.messages.parse() réussi
 *  dans les 9 fonctions structure*Bet(). `meta` est optionnel : sans lui,
 *  seules les colonnes historiques sont écrites. Renvoie `true` si la ligne a
 *  été insérée ; les appelants historiques ignorent la valeur, la popup s'en
 *  sert pour ne pas devenir aveugle (plafond lu à 0 si le journal échoue). */
export async function recordAnthropicUsage(
  callSite: string,
  model: string,
  usage: AnthropicUsage,
  meta?: UsageMeta,
): Promise<boolean> {
  const estimatedCostUsd = meta?.estimatedCostUsd ?? estimateCostUsd(model, usage);
  try {
    const supabase = getServiceClient();
    const row: Record<string, unknown> = {
      call_site: callSite,
      model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_read_tokens: usage.cache_read_input_tokens ?? 0,
      cache_creation_tokens: usage.cache_creation_input_tokens ?? 0,
      estimated_cost_usd: estimatedCostUsd,
    };
    if (meta) {
      row.status = meta.status ?? null;
      row.stop_reason = meta.stopReason ?? null;
      row.request_id = meta.requestId ?? null;
      row.latency_ms = meta.latencyMs ?? null;
      row.thinking_tokens = meta.thinkingTokens ?? null;
      row.attempt = meta.attempt ?? null;
    }
    const { error } = await supabase.from("ai_usage_logs").insert(row);
    if (error) {
      console.error(`recordAnthropicUsage a échoué pour ${callSite} :`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`recordAnthropicUsage a échoué pour ${callSite} :`, err);
    return false;
  }
}

// Limite par défaut de PostgREST : au-delà, la somme serait tronquée en silence.
const SPEND_ROWS_LIMIT = 1000;

/** Somme des coûts estimés depuis minuit Europe/Paris.
 *
 *  - `structuration` (défaut) : tous les `call_site` hors popup. Best-effort :
 *    retourne 0 en cas d'erreur de lecture -- ne bloque jamais un pari sur une
 *    panne de CE contrôle, seulement sur un plafond réellement atteint.
 *  - `popup` : les `call_site` `popup%`. Échoue FERMÉ : erreur de lecture ou
 *    somme potentiellement tronquée = `Infinity`, donc plafond atteint. */
export async function getTodaySpendUsd(scope: SpendScope = "structuration"): Promise<number> {
  const failed = scope === "popup" ? Number.POSITIVE_INFINITY : 0;
  try {
    const supabase = getServiceClient();
    const { startIso } = parisDayBoundsUtc(parisDateKey(Date.now()));
    let query = supabase.from("ai_usage_logs").select("estimated_cost_usd").gte("created_at", startIso);
    query =
      scope === "popup"
        ? query.like("call_site", `${POPUP_CALL_SITE_PREFIX}%`)
        : query.not("call_site", "like", `${POPUP_CALL_SITE_PREFIX}%`);
    const { data, error } = await query;
    if (error || !data) return failed;
    if (scope === "popup" && data.length >= SPEND_ROWS_LIMIT) return failed;
    return data.reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0);
  } catch {
    return failed;
  }
}
