import "server-only";
import { createRunBudget, callClaudeJson, type LlmCallResult, type LlmStatus } from "@/lib/ai/claudeJson";
import { withRetries } from "@/lib/ai/retry";
import { getServiceClient } from "@/lib/supabase/service";
import {
  ATTEMPTS_KEPT,
  BACKOFF_MS,
  MAX_ATTEMPTS,
  MIN_REMAINING_MS,
  PROMPT_VERSION,
  POOR_WEEK_MIN_BETS,
  ROLES,
  UNIT_FALLBACK_PARALLEL,
  boundedTimeoutMs,
  popupModel,
} from "./config";
import { buildFallbackContent, pickFallback } from "./fallback";
import { assignShortIds, buildClassifierInput, buildRedacteurInput } from "./format";
import { loadWeekData } from "./load";
import { notifyAdminsOfDraft } from "./notify";
import { preselect } from "./preselect";
import { CLASSIFIER_SYSTEM_PROMPT, REDACTEUR_SYSTEM_PROMPT } from "./prompts";
import {
  ClassifierOutputSchema,
  RedacteurOutputSchema,
  type ClassifierOutput,
  type RedacteurOutput,
} from "./schemas";
import type {
  GenerationTrigger,
  PopupUserRow,
  WeeklyPopupAttempt,
  WeeklyPopupCandidate,
  WeeklyPopupContent,
  WeeklyPopupDoubtCode,
  WeeklyPopupKind,
  WeeklyPopupRow,
  WeeklyPopupWarning,
} from "./types";
import { validateOutput, type OutputValidation, type ValidationContext } from "./validate";
import { applyVerdicts, mergeVerdicts, reuseVerdicts } from "./verdicts";

// Génération d'un brouillon de popup hebdo (plan §3, §4.1). Ne lève jamais :
// toute issue est écrite dans la ligne (READY ou DOUBTFUL + motif).
//
// Données personnelles : `warnings`, `doubt_detail`, `attempts` et les logs ne
// portent que des codes et des compteurs (jamais de pseudo, de texte, de
// `errorMessage`, d'`issues` Zod ni de sortie brute). `candidates` et
// `raw_output` en contiennent : réservés aux admins (RLS), purgés à la
// publication et à la suppression d'un compte.

type Client = ReturnType<typeof getServiceClient>;

export type GenerationOutcome = {
  written: boolean;
  status: "READY" | "DOUBTFUL" | "abandoned";
  kind?: WeeklyPopupKind;
  doubtCode?: WeeklyPopupDoubtCode;
  costUsd: number;
  notified: boolean;
};

export type GenerateDeps = {
  client?: Client;
  call?: typeof callClaudeJson;
  load?: typeof loadWeekData;
  notify?: typeof notifyAdminsOfDraft;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export type GenerateOptions = {
  deadlineMs: number;
  trigger: GenerationTrigger;
  deps?: GenerateDeps;
};

/** Résultat d'une tentative du rédacteur : réponse LLM puis contrôles du code. */
type RedactionResult = {
  llm: LlmCallResult<RedacteurOutput>;
  status: LlmStatus | "structure";
  retriable: boolean;
  retryAfterMs?: number;
  validation?: OutputValidation;
};

class Abort extends Error {
  constructor(
    readonly code: WeeklyPopupDoubtCode,
    readonly detail: string,
    readonly rawText?: string,
  ) {
    super(code);
    this.name = "Abort";
  }
}

const DOUBT_BY_STATUS: Record<Exclude<LlmStatus, "ok">, WeeklyPopupDoubtCode> = {
  invalid_output: "invalid_output",
  max_tokens: "max_tokens",
  api_error: "api_error",
  timeout: "timeout",
  cap_reached: "cap_reached",
  refusal: "refusal",
};

function describeErrors(errors: { code: string; bloc?: string; detail?: string }[]): string {
  return errors
    .map((e) => `${e.code}${e.bloc ? `:${e.bloc}` : ""}${e.detail ? `(${e.detail})` : ""}`)
    .join(", ")
    .slice(0, 500);
}

function countBy(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].map(([k, n]) => `${k}=${n}`).join(",");
}

export async function runWeeklyPopupGeneration(
  popupId: string,
  generationId: string,
  opts: GenerateOptions,
): Promise<GenerationOutcome> {
  const deps = opts.deps ?? {};
  const client = deps.client ?? getServiceClient();
  const call = deps.call ?? callClaudeJson;
  const load = deps.load ?? loadWeekData;
  const notify = deps.notify ?? notifyAdminsOfDraft;
  const now = deps.now ?? Date.now;
  const model = popupModel();
  const budget = createRunBudget();
  const attempts: WeeklyPopupAttempt[] = [];
  const warnings: WeeklyPopupWarning[] = [];
  let finalWritten = false;
  /** Statut réellement écrit par `finish` (pour un retour fidèle si la suite lève). */
  let writtenOutcome: GenerationOutcome | null = null;
  let costUsd = 0;
  let row: WeeklyPopupRow | null = null;
  /** Derniers candidats avec verdicts : conservés même si la génération échoue. */
  let latestCandidates: WeeklyPopupCandidate[] | null = null;

  const record = (
    role: WeeklyPopupAttempt["role"],
    r: LlmCallResult<unknown>,
    extra: Partial<WeeklyPopupAttempt> = {},
  ) => {
    costUsd += r.costUsd;
    attempts.push({
      role,
      attempt: r.attempt,
      status: r.status,
      stop_reason: r.stopReason ?? null,
      http_status: r.httpStatus,
      request_id: r.requestId ?? null,
      latency_ms: r.latencyMs,
      cost_usd: r.costUsd,
      input_tokens: r.usage?.input,
      output_tokens: r.usage?.output,
      thinking_tokens: r.usage?.thinking,
      issues_count: r.issues?.length,
      at: new Date(now()).toISOString(),
      ...extra,
    });
  };

  /** Écriture finale, gardée : seule la génération qui détient `generationId` écrit. */
  const finalize = async (fields: Record<string, unknown>): Promise<boolean> => {
    const { data, error } = await client
      .from("weekly_popups")
      .update(fields)
      .eq("id", popupId)
      .eq("generation_id", generationId)
      .eq("status", "GENERATING")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`écriture finale : ${error.code ?? "erreur"}`);
    return data !== null;
  };

  const commonFields = (candidates: WeeklyPopupCandidate[]) => ({
    candidates,
    warnings,
    attempts: [...(row?.attempts ?? []), ...attempts].slice(-ATTEMPTS_KEPT),
    prompt_version: PROMPT_VERSION,
    generation_count: (row?.generation_count ?? 0) + 1,
  });

  const finish = async (
    status: "READY" | "DOUBTFUL",
    kind: WeeklyPopupKind,
    fields: Record<string, unknown>,
    doubtCode: WeeklyPopupDoubtCode | null,
    weekEnd: string,
  ): Promise<GenerationOutcome> => {
    const written = await finalize({ status, kind, ...fields });
    finalWritten = true;
    writtenOutcome = { written, status, kind, doubtCode: doubtCode ?? undefined, costUsd, notified: false };
    let notified = false;
    if (written && opts.trigger === "CRON") {
      const result = await notify(popupId, { status, kind, doubtCode, weekEnd }, { client });
      notified = result.sent;
    }
    return {
      written,
      status,
      kind,
      doubtCode: doubtCode ?? undefined,
      costUsd,
      notified,
    };
  };

  try {
    const { data: found, error: readError } = await client
      .from("weekly_popups")
      .select("*")
      .eq("id", popupId)
      .maybeSingle();
    if (readError) throw new Error("lecture de la ligne");
    row = found as WeeklyPopupRow | null;
    if (!row || row.status !== "GENERATING" || row.generation_id !== generationId) {
      return { written: false, status: "abandoned", costUsd, notified: false };
    }
    const weekEnd = row.week_end_date;

    const data = await load(row.competition_id, weekEnd, { client });
    if (data.truncated) warnings.push({ code: "chargement_tronque" });

    const retained = data.champions.filter((c) => {
      const u = data.users.get(c.userId);
      return u && u.status === "ACTIVE" && !u.popup_mentions_opt_out;
    });
    const users = data.users as ReadonlyMap<string, PopupUserRow>;

    // Niveau 1 : semaine pauvre, aucun appel (le champion n'est pas classé :
    // avertissement, la publication reste manuelle).
    if (data.rawCount < POOR_WEEK_MIN_BETS) {
      if (retained.length > 0) warnings.push({ code: "champion_non_classe", bloc: "champion" });
      const content = buildFallbackContent(pickFallback(data.publishedFallbackCount), retained);
      return await finish(
        "READY",
        "FALLBACK",
        {
          ...commonFields([]),
          doubt_code: null,
          doubt_detail: null,
          raw_output: null,
          content,
          generated_content: content,
        },
        null,
        weekEnd,
      );
    }

    const selected = preselect(data.bets, users);
    const exclusions = Object.entries(selected.excluded).filter(([, n]) => n > 0);
    if (exclusions.length > 0) {
      warnings.push({
        code: "exclusions",
        detail: exclusions.map(([k, n]) => `${k}=${n}`).join(","),
      });
    }
    if (selected.flopIneligible > 0) {
      warnings.push({ code: "flop_ineligible", bloc: "flop", detail: String(selected.flopIneligible) });
    }

    let candidates = assignShortIds(selected, retained, {
      users,
      matchLabels: data.matchLabels,
      recentlyFeaturedIds: data.recentlyFeaturedIds,
    });
    candidates = reuseVerdicts(candidates, row.candidates ?? []);
    latestCandidates = candidates;

    const timeout = (role: keyof typeof ROLES) =>
      boundedTimeoutMs(ROLES[role].timeoutMs, opts.deadlineMs, now());
    const retryOptions = {
      maxAttempts: MAX_ATTEMPTS,
      deadlineMs: opts.deadlineMs,
      backoffMs: BACKOFF_MS,
      minRemainingMs: MIN_REMAINING_MS,
      now,
      sleep: deps.sleep,
    };

    // --- Classifieur : lot, puis repli unitaire si le lot est refusé.
    const classify = (batch: WeeklyPopupCandidate[], role: "classifier" | "classifier_unit", parallel = 1) =>
      withRetries(
        async (attempt) => {
          const r = await call<ClassifierOutput>({
            callSite: ROLES.classifier.callSite,
            model,
            system: CLASSIFIER_SYSTEM_PROMPT,
            user: buildClassifierInput(batch, users),
            maxTokens: ROLES.classifier.maxTokens,
            effort: ROLES.classifier.effort,
            schema: ClassifierOutputSchema,
            timeoutMs: timeout("classifier"),
            attempt,
            parallelCalls: parallel,
            budget,
          });
          record(role, r, role === "classifier_unit" ? { short_id: batch[0]?.short_id } : {});
          return r;
        },
        {
          ...retryOptions,
          // Un refus du classifieur n'est pas relancé : repli unitaire.
          shouldRetry: (r) => r.retriable && r.status !== "refusal" && r.status !== "cap_reached",
        },
      );

    const pending = candidates.filter((c) => !c.verdict);
    if (pending.length > 0) {
      const batch = await classify(pending, "classifier");
      const result = batch.result;
      if (!result) throw new Abort("budget", "classifieur : temps insuffisant");

      if (result.status === "ok" && result.data) {
        const merged = mergeVerdicts(pending, result.data, "lot");
        const byId = new Map(merged.candidates.map((c) => [c.short_id, c]));
        candidates = candidates.map((c) => byId.get(c.short_id) ?? c);
        const anomalies = Object.entries(merged.anomalies).filter(([, n]) => n > 0);
        if (anomalies.length > 0) {
          warnings.push({ code: "verdicts_anomalies", detail: anomalies.map(([k, n]) => `${k}=${n}`).join(",") });
        }
      } else if (result.status === "refusal") {
        warnings.push({ code: "classifieur_repli_unitaire", detail: String(pending.length) });
        const verdicts = new Map<string, WeeklyPopupCandidate>();
        for (let i = 0; i < pending.length; i += UNIT_FALLBACK_PARALLEL) {
          const group = pending.slice(i, i + UNIT_FALLBACK_PARALLEL);
          const outcomes = await Promise.all(
            group.map(async (c) => ({ c, out: await classify([c], "classifier_unit", group.length) })),
          );
          let abort: Abort | null = null;
          for (const { c, out } of outcomes) {
            const r = out.result;
            if (r?.status === "cap_reached") {
              abort ??= new Abort("cap_reached", "classifieur unitaire : plafond");
              continue;
            }
            if (!r) {
              abort ??= new Abort("budget", "classifieur unitaire : temps insuffisant");
              continue;
            }
            // Refus, erreur ou sortie invalide après relances : bloqué (échec fermé).
            const merged = mergeVerdicts([c], r.status === "ok" && r.data ? r.data : null, "unitaire");
            verdicts.set(c.short_id, merged.candidates[0]);
          }
          // Les verdicts déjà payés survivent à un abandon (le « Relancer »
          // ne les repaie pas).
          latestCandidates = candidates.map((c) => verdicts.get(c.short_id) ?? c);
          if (abort) throw abort;
        }
        candidates = candidates.map((c) => verdicts.get(c.short_id) ?? c);
      } else {
        const code = result.status === "ok" ? "internal" : DOUBT_BY_STATUS[result.status];
        throw new Abort(
          batch.budgetExhausted && result.status !== "cap_reached" ? "budget" : code,
          `classifieur : ${result.status} (${batch.attempts} tentative(s))`,
        );
      }
    }

    latestCandidates = candidates;
    const { kept, blockedUserIds } = applyVerdicts(candidates);
    const blockedCategories = candidates
      .filter((c) => c.verdict === "bloque")
      .map((c) => c.categorie ?? "doute");
    if (blockedCategories.length > 0) {
      warnings.push({
        code: "candidats_bloques",
        detail: `${countBy(blockedCategories)};joueurs=${blockedUserIds.size}`,
      });
    }

    const keptChampions = kept.filter((c) => c.bloc === "champion");
    const keptBets = kept.filter((c) => c.bloc !== "champion");
    const championsOk = retained.filter((c) => keptChampions.some((k) => k.user_id === c.userId));

    // Niveau 2 : plus rien à raconter après exclusions et blocages.
    if (keptBets.length === 0) {
      const content = buildFallbackContent(pickFallback(data.publishedFallbackCount), championsOk);
      return await finish(
        "READY",
        "FALLBACK",
        {
          ...commonFields(candidates),
          doubt_code: null,
          doubt_detail: null,
          raw_output: null,
          content,
          generated_content: content,
        },
        null,
        weekEnd,
      );
    }

    // --- Rédacteur : appel, puis contrôles du code (une structure invalide se relance).
    const closed = new Map<string, { userId: string; pseudo: string }>();
    for (const c of kept) {
      const pseudo = users.get(c.user_id)?.pseudo;
      if (pseudo) closed.set(c.user_id, { userId: c.user_id, pseudo });
    }
    const idsFor = (bloc: "top" | "flop" | "refuse") =>
      new Set(keptBets.filter((c) => c.bloc === bloc).map((c) => c.short_id));
    const ctx: ValidationContext = {
      closedSet: [...closed.values()],
      idsByBloc: { top: idsFor("top"), flop: idsFor("flop"), refuse: idsFor("refuse") },
      hasChampion: championsOk.length > 0,
    };
    const championInput =
      championsOk.length > 0
        ? {
            pseudos: championsOk.map((c) => users.get(c.userId)?.pseudo ?? ""),
            points: championsOk[0].points,
          }
        : null;
    const userInput = buildRedacteurInput(keptBets, championInput, users);

    const drafted = await withRetries<RedactionResult>(
      async (attempt) => {
        const llm = await call<RedacteurOutput>({
          callSite: ROLES.redacteur.callSite,
          model,
          system: REDACTEUR_SYSTEM_PROMPT,
          user: userInput,
          maxTokens: ROLES.redacteur.maxTokens,
          effort: ROLES.redacteur.effort,
          schema: RedacteurOutputSchema,
          timeoutMs: timeout("redacteur"),
          attempt,
          budget,
        });
        if (llm.status !== "ok" || !llm.data) {
          record("redacteur", llm);
          return { llm, status: llm.status, retriable: llm.retriable, retryAfterMs: llm.retryAfterMs };
        }
        const validation = validateOutput(llm.data, ctx);
        if (validation.ok) {
          record("redacteur", llm);
          return { llm, status: "ok", retriable: false, validation };
        }
        record("redacteur", llm, {
          status: "structure",
          error_codes: [...new Set(validation.errors.map((e) => e.code))],
        });
        return { llm, status: "structure", retriable: true, validation };
      },
      {
        ...retryOptions,
        // Le refus du rédacteur est relancé ; le plafond de dépense, jamais.
        shouldRetry: (r) => r.retriable && r.status !== "cap_reached",
      },
    );

    const last = drafted.result;
    if (!last) throw new Abort("budget", "rédacteur : temps insuffisant");

    if (last.status === "ok" && last.validation?.content) {
      warnings.push(...last.validation.warnings);
      const content: WeeklyPopupContent = last.validation.content;
      return await finish(
        "READY",
        "LLM",
        {
          ...commonFields(candidates),
          doubt_code: null,
          doubt_detail: null,
          raw_output: null,
          content,
          generated_content: content,
        },
        null,
        weekEnd,
      );
    }

    if (last.status === "structure") {
      throw new Abort(
        drafted.budgetExhausted ? "budget" : "structure",
        `structure : ${describeErrors(last.validation?.errors ?? [])}`,
        last.llm.rawText,
      );
    }
    const status = last.status as Exclude<LlmStatus, "ok">;
    throw new Abort(
      drafted.budgetExhausted && status !== "cap_reached" ? "budget" : (DOUBT_BY_STATUS[status] ?? "internal"),
      `rédacteur : ${status}${last.llm.httpStatus ? ` http=${last.llm.httpStatus}` : ""} (${drafted.attempts} tentative(s))`,
      status === "invalid_output" ? last.llm.rawText : undefined,
    );
  } catch (error) {
    return await failClosed(error);
  }

  /** Brouillon douteux : le contenu précédent n'est jamais détruit. */
  async function failClosed(error: unknown): Promise<GenerationOutcome> {
    if (finalWritten) {
      // La ligne est déjà écrite (ce qui a levé vient après) : rendre son vrai statut.
      return writtenOutcome ?? { written: true, status: "DOUBTFUL", costUsd, notified: false };
    }
    const abort = error instanceof Abort ? error : null;
    const code: WeeklyPopupDoubtCode = abort ? abort.code : "internal";
    const detail = abort
      ? abort.detail
      : `exception:${error instanceof Error ? error.name : "Error"}`;
    try {
      const weekEnd = row?.week_end_date ?? "";
      const written = await finalize({
        status: "DOUBTFUL",
        doubt_code: code,
        doubt_detail: detail.slice(0, 500),
        raw_output: abort?.rawText ?? null,
        candidates: latestCandidates ?? row?.candidates ?? [],
        warnings,
        attempts: [...(row?.attempts ?? []), ...attempts].slice(-ATTEMPTS_KEPT),
        prompt_version: PROMPT_VERSION,
        generation_count: (row?.generation_count ?? 0) + 1,
      });
      finalWritten = true;
      let notified = false;
      if (written && opts.trigger === "CRON" && weekEnd) {
        const result = await notify(popupId, { status: "DOUBTFUL", kind: row?.kind ?? "LLM", doubtCode: code, weekEnd }, { client });
        notified = result.sent;
      }
      return { written, status: "DOUBTFUL", kind: row?.kind, doubtCode: code, costUsd, notified };
    } catch (writeError) {
      // La ligne reste GENERATING : périmée à 10 min, reprise par le cron ou
      // par « Relancer ». Codes seulement dans les logs (Sentry les capture).
      console.error(
        "[weeklyPopup] écriture du brouillon douteux impossible",
        popupId,
        writeError instanceof Error ? writeError.name : "Error",
      );
      return { written: false, status: "DOUBTFUL", doubtCode: code, costUsd, notified: false };
    }
  }
}
