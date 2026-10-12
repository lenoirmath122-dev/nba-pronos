import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import {
  POPUP_DAILY_COST_CAP_USD,
  estimateCostUsd,
  estimateWorstCaseCostUsd,
  getTodaySpendUsd,
  recordAnthropicUsage,
  type AnthropicUsage,
  type UsageMeta,
} from "./usageTracking";

// Client Anthropic à STATUT EXPLICITE pour la popup hebdomadaire (lot 5, plan
// §2). Contrairement aux structure*Bet (qui renvoient `null` en silence), un
// appel ne lève jamais et rend toujours un `LlmCallResult` dont le statut dit
// ce qui s'est passé : c'est ce statut qui décide de relancer, de journaliser
// et du code de doute d'un brouillon. Les relances sont ailleurs (retry.ts).
//
// Choix de conception (plan §2) : `messages.create` non streamé + JSON.parse +
// Zod, pas `messages.parse` (qui ne lit pas `stop_reason` et lève sur un JSON
// tronqué). Ni `temperature`, ni `top_p`, ni `top_k` : 400 sur la génération 5.x.

export type LlmStatus =
  | "ok"
  | "refusal"
  | "invalid_output"
  | "max_tokens"
  | "api_error"
  | "timeout"
  | "cap_reached";

export type LlmCallSite = "popupClassifier" | "popupRedacteur";

export type LlmCallResult<T> = {
  status: LlmStatus;
  data?: T;
  rawText?: string;
  issues?: string[];
  /** `response.model` : le modèle réellement servi. */
  model?: string;
  stopReason?: string | null;
  refusal?: { category: string | null; explanation: string | null } | null;
  requestId?: string | null;
  httpStatus?: number;
  errorMessage?: string;
  latencyMs: number;
  attempt: number;
  usage?: { input: number; output: number; thinking: number; cacheRead: number; cacheWrite: number };
  costUsd: number;
  retriable: boolean;
  /** `retry-after` du serveur en ms, quand il en envoie un. */
  retryAfterMs?: number;
};

/** Sous-ensemble de la réponse du SDK dont on se sert (injectable en test). */
export type ClaudeResponseLike = {
  content: Array<{ type: string; text?: string }>;
  stop_reason: string | null;
  stop_details?: { category?: string | null; explanation?: string | null } | null;
  model?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
    output_tokens_details?: { thinking_tokens?: number | null } | null;
  };
  _request_id?: string | null;
};

export type CreateFn = (
  params: Record<string, unknown>,
  options: { timeout: number },
) => Promise<ClaudeResponseLike>;

export type RecordFn = (callSite: string, model: string, usage: AnthropicUsage, meta?: UsageMeta) => Promise<boolean>;

/**
 * État partagé d'un run de génération : cumule le coût en mémoire (le journal
 * peut échouer, et `recordAnthropicUsage` avale ses erreurs) et mémorise un
 * échec d'écriture du journal, après quoi tout appel suivant rend `cap_reached`.
 */
export type RunBudget = { spentUsd: number; journalFailed: boolean };
export const createRunBudget = (): RunBudget => ({ spentUsd: 0, journalFailed: false });

export type CallClaudeJsonOptions<T> = {
  callSite: LlmCallSite;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  effort: "low" | "medium";
  schema: z.ZodType<T>;
  timeoutMs: number;
  attempt: number;
  /** Appels lancés en parallèle dans le même paquet : leur pire coût est
   *  compté d'avance dans le contrôle du plafond. Défaut 1. */
  parallelCalls?: number;
  budget?: RunBudget;
  deps?: {
    create?: CreateFn;
    now?: () => number;
    spend?: () => Promise<number>;
    record?: RecordFn;
  };
};

let cachedClient: Anthropic | null = null;

/** Client singleton paresseux ; `null` si la clé est absente. */
function getClient(): Anthropic | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  cachedClient = new Anthropic({ apiKey, maxRetries: 0 });
  return cachedClient;
}

function makeDefaultCreate(): CreateFn | null {
  const client = getClient();
  if (!client) return null;
  return (params, options) =>
    client.messages.create(
      { ...params, stream: false } as unknown as Anthropic.MessageCreateParamsNonStreaming,
      options,
    ) as unknown as Promise<ClaudeResponseLike>;
}

const RETRIABLE_HTTP = new Set([408, 409, 429, 529]);

function isRetriableHttp(status: number | undefined): boolean {
  if (status === undefined) return true; // erreur réseau sans réponse
  return RETRIABLE_HTTP.has(status) || (status >= 500 && status <= 599);
}

/** Retire une clôture ```json … ``` éventuelle autour de la sortie. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = /^```[a-zA-Z]*\s*\n?([\s\S]*?)\n?\s*```$/.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

function readHeader(headers: unknown, name: string): string | null {
  const h = headers as { get?: (n: string) => string | null } | null | undefined;
  try {
    return typeof h?.get === "function" ? h.get(name) : null;
  } catch {
    return null;
  }
}

function parseRetryAfterMs(headers: unknown): number | undefined {
  const raw = readHeader(headers, "retry-after");
  if (!raw) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : undefined;
}

export async function callClaudeJson<T>(opts: CallClaudeJsonOptions<T>): Promise<LlmCallResult<T>> {
  const now = opts.deps?.now ?? Date.now;
  const spend = opts.deps?.spend ?? (() => getTodaySpendUsd("popup"));
  const record: RecordFn = opts.deps?.record ?? recordAnthropicUsage;
  const startedAt = now();
  const base = { attempt: opts.attempt } as const;
  const elapsed = () => Math.max(0, now() - startedAt);

  // ── Plafond : vérifié AVANT l'appel, échoue fermé, aucune ligne de journal.
  const worstCaseUsd = estimateWorstCaseCostUsd(opts.model, opts.system.length + opts.user.length, opts.maxTokens);
  const reserved = worstCaseUsd * Math.max(1, opts.parallelCalls ?? 1);
  let capReached = opts.budget?.journalFailed === true;
  if (!capReached) {
    try {
      const todayUsd = await spend();
      const known = Math.max(todayUsd, opts.budget?.spentUsd ?? 0);
      capReached = !Number.isFinite(known) || known + reserved > POPUP_DAILY_COST_CAP_USD;
    } catch {
      capReached = true;
    }
  }
  if (capReached) {
    return { ...base, status: "cap_reached", latencyMs: elapsed(), costUsd: 0, retriable: false };
  }

  const create = opts.deps?.create ?? makeDefaultCreate();
  if (!create) {
    return {
      ...base,
      status: "api_error",
      errorMessage: "ANTHROPIC_API_KEY absente",
      latencyMs: elapsed(),
      costUsd: 0,
      retriable: false,
    };
  }

  // Une ligne de journal par tentative ayant atteint l'API ; le coût entre dans
  // le cumul du run même si l'écriture échoue (et un échec ferme le plafond).
  const journal = async (
    result: LlmCallResult<T>,
    usage: AnthropicUsage,
    meta: UsageMeta,
  ): Promise<LlmCallResult<T>> => {
    if (opts.budget) opts.budget.spentUsd += result.costUsd;
    const model = result.model ?? opts.model;
    let written = false;
    try {
      written = await record(opts.callSite, model, usage, {
        ...meta,
        status: result.status,
        requestId: result.requestId ?? null,
        latencyMs: result.latencyMs,
        attempt: opts.attempt,
      });
    } catch {
      written = false; // le contrat « ne lève jamais » tient même avec un record injecté
    }
    if (written !== true && opts.budget) opts.budget.journalFailed = true;
    return result;
  };

  const requestParams: Record<string, unknown> = {
    model: opts.model,
    max_tokens: opts.maxTokens,
    thinking: { type: "adaptive" },
    output_config: { effort: opts.effort },
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  };

  let response: ClaudeResponseLike;
  try {
    response = await create(requestParams, { timeout: opts.timeoutMs });
  } catch (err) {
    const isTimeout = err instanceof Anthropic.APIConnectionTimeoutError;
    const status = (err as { status?: unknown } | null)?.status;
    const httpStatus = typeof status === "number" ? status : undefined;
    const requestId = ((err as { requestID?: string | null } | null)?.requestID ?? null) || null;
    const headers = (err as { headers?: unknown } | null)?.headers;
    const errorMessage = err instanceof Error ? err.message : String(err);
    const costUsd = isTimeout ? worstCaseUsd : 0;
    const result: LlmCallResult<T> = {
      ...base,
      status: isTimeout ? "timeout" : "api_error",
      httpStatus,
      requestId,
      errorMessage,
      latencyMs: elapsed(),
      costUsd,
      retriable: isTimeout ? true : isRetriableHttp(httpStatus),
      retryAfterMs: parseRetryAfterMs(headers),
    };
    return journal(result, { input_tokens: 0, output_tokens: 0 }, { estimatedCostUsd: costUsd });
  }

  const usageRaw = response.usage;
  const cacheRead = usageRaw.cache_read_input_tokens ?? 0;
  const cacheWrite = usageRaw.cache_creation_input_tokens ?? 0;
  // `output_tokens` est inclusif de la réflexion : `thinking` n'est qu'un
  // sous-total journalisé pour suivi, jamais ajouté au coût.
  const thinking = usageRaw.output_tokens_details?.thinking_tokens ?? 0;
  const billedUsage: AnthropicUsage = {
    input_tokens: usageRaw.input_tokens,
    output_tokens: usageRaw.output_tokens,
    cache_read_input_tokens: cacheRead,
    cache_creation_input_tokens: cacheWrite,
  };
  const servedModel = response.model || opts.model;
  const common = {
    ...base,
    model: servedModel,
    stopReason: response.stop_reason,
    requestId: response._request_id ?? null,
    usage: {
      input: usageRaw.input_tokens,
      output: usageRaw.output_tokens,
      thinking,
      cacheRead,
      cacheWrite,
    },
    costUsd: estimateCostUsd(servedModel, billedUsage),
    latencyMs: elapsed(),
  };
  const finish = (r: Partial<LlmCallResult<T>> & Pick<LlmCallResult<T>, "status" | "retriable">) =>
    journal({ ...common, ...r }, billedUsage, {
      stopReason: response.stop_reason,
      thinkingTokens: thinking,
    });

  const stop = response.stop_reason;

  if (stop === "refusal") {
    return finish({
      status: "refusal",
      refusal: {
        category: response.stop_details?.category ?? null,
        explanation: response.stop_details?.explanation ?? null,
      },
      // Un refus du rédacteur se relance ; celui du classifieur bascule sur le
      // repli unitaire (décidé par l'orchestration, pas par une relance).
      retriable: opts.callSite === "popupRedacteur",
    });
  }
  if (stop === "max_tokens" || stop === "model_context_window_exceeded") {
    return finish({ status: "max_tokens", retriable: true });
  }
  if (stop !== "end_turn") {
    return finish({
      status: "invalid_output",
      issues: [`stop_reason inattendu : ${String(stop)}`],
      retriable: true,
    });
  }

  // Blocs `text` concaténés ; la réflexion (blocs `thinking`) est ignorée.
  const rawText = response.content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("");

  let json: unknown;
  try {
    json = JSON.parse(stripCodeFence(rawText));
  } catch (err) {
    return finish({
      status: "invalid_output",
      rawText,
      issues: [`JSON invalide : ${err instanceof Error ? err.message : String(err)}`],
      retriable: true,
    });
  }

  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) {
    return finish({
      status: "invalid_output",
      rawText,
      issues: parsed.error.issues.map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`),
      retriable: true,
    });
  }

  return finish({ status: "ok", data: parsed.data, rawText, retriable: false });
}
