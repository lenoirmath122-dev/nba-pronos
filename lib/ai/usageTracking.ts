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
};
const FALLBACK_PRICE = PRICE_PER_MTOK_USD["claude-sonnet-5"];

type AnthropicUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

function estimateCostUsd(model: string, usage: AnthropicUsage): number {
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

// Plafond quotidien (Europe/Paris) de dépense IA sur la structuration de
// paris. Pas un budget chiffré ailleurs dans le projet -- départ prudent,
// à ajuster une fois une vraie conso observée en usage réel (même esprit
// que LOW_QUOTA_THRESHOLD, lib/sync/logging.ts). Vérifié AVANT chaque appel
// Claude (structureAndScoreBet.ts), jamais après coup.
export const DAILY_COST_CAP_USD = 5;

/** Best-effort : n'écrit jamais d'exception vers l'appelant (même contrat
 *  que writeSyncLog). Appelée après CHAQUE client.messages.parse() réussi
 *  dans les 9 fonctions structure*Bet(). */
export async function recordAnthropicUsage(callSite: string, model: string, usage: AnthropicUsage): Promise<void> {
  const estimatedCostUsd = estimateCostUsd(model, usage);
  try {
    const supabase = getServiceClient();
    const { error } = await supabase.from("ai_usage_logs").insert({
      call_site: callSite,
      model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_read_tokens: usage.cache_read_input_tokens ?? 0,
      cache_creation_tokens: usage.cache_creation_input_tokens ?? 0,
      estimated_cost_usd: estimatedCostUsd,
    });
    if (error) {
      console.error(`recordAnthropicUsage a échoué pour ${callSite} :`, error.message);
    }
  } catch (err) {
    console.error(`recordAnthropicUsage a échoué pour ${callSite} :`, err);
  }
}

/** Somme des coûts estimés depuis minuit Europe/Paris. Retourne 0 en cas
 *  d'erreur de lecture (best-effort) -- ne bloque jamais un pari sur une
 *  panne de CE contrôle, seulement sur un plafond réellement atteint. */
export async function getTodaySpendUsd(): Promise<number> {
  try {
    const supabase = getServiceClient();
    const { startIso } = parisDayBoundsUtc(parisDateKey(Date.now()));
    const { data, error } = await supabase
      .from("ai_usage_logs")
      .select("estimated_cost_usd")
      .gte("created_at", startIso);
    if (error || !data) return 0;
    return data.reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0);
  } catch {
    return 0;
  }
}
