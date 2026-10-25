"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/actions/audit";
import { weekEndFor } from "@/lib/weekly/standings";
import { addDays } from "@/lib/recaps/period";
import { deadlineFrom } from "@/lib/weeklyPopup/config";
import { toDisplayedPopup, type DisplayedPopup } from "@/lib/weeklyPopup/display";
import {
  buildValidationContext,
  checkEditedContent,
  checkForPublication,
  citedUserIds,
  featuredUserIds,
  isEditable,
  isPublishable,
  isRetractable,
  isSkippable,
  type EditableField,
  type EditorUser,
} from "@/lib/weeklyPopup/edit";
import { ensureWeeklyPopupDraft, reserveRegeneration } from "@/lib/weeklyPopup/ensure";
import { runWeeklyPopupGeneration } from "@/lib/weeklyPopup/generate";
import { doubtReason } from "@/lib/weeklyPopup/notify";
import type { TokenUserInfo } from "@/lib/weeklyPopup/tokens";
import type {
  WeeklyPopupDoubtCode,
  WeeklyPopupKind,
  WeeklyPopupRow,
  WeeklyPopupWarning,
} from "@/lib/weeklyPopup/types";

// Actions admin de la popup hebdomadaire (lot 5, PR 4, plan §4.4). Chacune :
// session admin (`is_admin()`), écriture en service_role (aucune policy
// d'écriture sur `weekly_popups`), update conditionnel sur le statut attendu
// (patron des paris), `logAdminAction`, revalidation. Les journaux d'audit ne
// portent que des codes et des compteurs, jamais un texte de joueur.

export type PopupActionResult = { success: true; message: string } | { success: false; error: string };

export type PopupTrial = {
  weekEnd: string;
  status: "READY" | "DOUBTFUL" | "abandoned";
  kind: WeeklyPopupKind | null;
  doubtCode: WeeklyPopupDoubtCode | null;
  doubtDetail: string | null;
  costUsd: number;
  popup: DisplayedPopup | null;
  warnings: WeeklyPopupWarning[];
  candidateCount: number;
  blockedCount: number;
};

export type PopupTrialResult = { success: true; message: string; trial: PopupTrial } | { success: false; error: string };

type Client = ReturnType<typeof getServiceClient>;
type AdminSession = { supabase: Awaited<ReturnType<typeof getServerClient>>; userId: string };

const MIGRATION_HINT = "migration 20261013090000 poussée ?";

async function requireAdmin(): Promise<AdminSession | { error: string }> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu dois être connecté." };
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { error: "Réservé aux admins." };
  return { supabase, userId: user.id };
}

const isFailure = (value: AdminSession | { error: string }): value is { error: string } => "error" in value;

async function readPopup(client: Client, popupId: string): Promise<WeeklyPopupRow | null> {
  const { data, error } = await client.from("weekly_popups").select("*").eq("id", popupId).maybeSingle();
  if (error) throw new Error(`Lecture de la popup (${MIGRATION_HINT}) : ${error.message}`);
  return (data as WeeklyPopupRow | null) ?? null;
}

/** Joueurs d'aujourd'hui (pseudo, statut, refus d'être cité) : service_role. */
async function readUsers(client: Client, ids: string[]): Promise<Map<string, EditorUser>> {
  const out = new Map<string, EditorUser>();
  const unique = [...new Set(ids.map((id) => id.toLowerCase()))];
  for (let i = 0; i < unique.length; i += 100) {
    const { data, error } = await client
      .from("users")
      .select("id, pseudo, status, popup_mentions_opt_out")
      .in("id", unique.slice(i, i + 100));
    if (error) throw new Error(`Lecture des joueurs : ${error.message}`);
    for (const row of data ?? []) {
      out.set(String(row.id).toLowerCase(), {
        pseudo: String(row.pseudo ?? ""),
        status: String(row.status ?? ""),
        popup_mentions_opt_out: row.popup_mentions_opt_out === true,
      });
    }
  }
  return out;
}

const idsOf = (row: WeeklyPopupRow): string[] => [
  ...row.candidates.map((c) => c.user_id),
  ...citedUserIds(row.content),
];

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : "Erreur inconnue.");

function revalidate(): void {
  revalidatePath("/admin/popup");
  revalidatePath("/admin");
}

const codes = (list: { code: string; bloc?: string }[]): string =>
  list.map((e) => (e.bloc ? `${e.code} (${e.bloc})` : e.code)).join(", ");

// --- Enregistrer --------------------------------------------------------------

export async function saveWeeklyPopupDraft(
  popupId: string,
  fields: Partial<Record<EditableField, string>>,
): Promise<PopupActionResult> {
  const session = await requireAdmin();
  if (isFailure(session)) return { success: false, error: session.error };

  try {
    const client = getServiceClient();
    const row = await readPopup(client, popupId);
    if (!row) return { success: false, error: "Popup introuvable." };
    if (!isEditable(row.status)) {
      return { success: false, error: "Ce brouillon ne peut plus être modifié (génération en cours, publié ou écarté)." };
    }

    const users = await readUsers(client, idsOf(row));
    const ctx = buildValidationContext(row.candidates, users, row.content);
    const check = checkEditedContent(fields, ctx, row.content?.repli);

    const { data, error } = await client
      .from("weekly_popups")
      .update({ content: check.tokenized })
      .eq("id", popupId)
      .eq("status", row.status)
      .select("id")
      .maybeSingle();
    if (error) return { success: false, error: `Enregistrement impossible : ${error.message}` };
    if (!data) return { success: false, error: "Le statut a changé entre-temps : recharge la page." };

    await logAdminAction(session.supabase, {
      actorUserId: session.userId,
      action: "WEEKLY_POPUP_EDIT",
      targetType: "weekly_popup",
      targetId: popupId,
      after: { errors: check.errors.map((e) => e.code), warnings: check.warnings.map((w) => w.code) },
    });
    revalidate();

    const blocking = check.errors.length;
    return {
      success: true,
      message:
        blocking === 0
          ? "Brouillon enregistré."
          : `Brouillon enregistré, mais ${blocking} erreur${blocking > 1 ? "s" : ""} bloque${blocking > 1 ? "nt" : ""} la publication : ${codes(check.errors)}.`,
    };
  } catch (error) {
    return { success: false, error: errorMessage(error) };
  }
}

// --- Publier ------------------------------------------------------------------

export async function publishWeeklyPopup(popupId: string): Promise<PopupActionResult> {
  const session = await requireAdmin();
  if (isFailure(session)) return { success: false, error: session.error };

  try {
    const client = getServiceClient();
    const row = await readPopup(client, popupId);
    if (!row) return { success: false, error: "Popup introuvable." };
    if (!isPublishable(row.status)) {
      return { success: false, error: "Seul un brouillon prêt ou douteux peut être publié." };
    }
    if (!row.content) return { success: false, error: "Aucun texte à publier : rédige-le ou régénère." };

    const users = await readUsers(client, idsOf(row));
    const ctx = buildValidationContext(row.candidates, users, row.content);
    const check = checkForPublication(row.content, ctx, users);
    if (check.errors.length > 0) {
      return { success: false, error: `Publication refusée : ${codes(check.errors)}.` };
    }

    const { data, error } = await client
      .from("weekly_popups")
      .update({
        status: "PUBLISHED",
        content: check.tokenized,
        featured_user_ids: featuredUserIds(check.tokenized),
        published_at: new Date().toISOString(),
        published_by: session.userId,
        raw_output: null,
      })
      .eq("id", popupId)
      .eq("status", row.status)
      .select("id")
      .maybeSingle();
    if (error) return { success: false, error: `Publication impossible : ${error.message}` };
    if (!data) return { success: false, error: "Le statut a changé entre-temps : recharge la page." };

    await logAdminAction(session.supabase, {
      actorUserId: session.userId,
      action: "WEEKLY_POPUP_PUBLISH",
      targetType: "weekly_popup",
      targetId: popupId,
      before: { status: row.status },
      after: { status: "PUBLISHED", kind: row.kind, weekEnd: row.week_end_date },
    });
    revalidate();
    return { success: true, message: "Popup publiée : les joueurs la verront à leur prochaine ouverture." };
  } catch (error) {
    return { success: false, error: errorMessage(error) };
  }
}

// --- Ne pas publier -----------------------------------------------------------

/**
 * `popupId` : une ligne existante. Sinon `weekEnd` : crée la ligne SKIPPED de la
 * semaine (sinon l'envoi réel du push, bloqué tant que la popup n'est ni
 * PUBLISHED ni SKIPPED, serait impossible quand la génération n'a jamais tourné).
 */
export async function skipWeeklyPopup(target: { popupId: string } | { weekEnd: string }): Promise<PopupActionResult> {
  const session = await requireAdmin();
  if (isFailure(session)) return { success: false, error: session.error };

  try {
    const client = getServiceClient();
    let popupId: string | null = "popupId" in target ? target.popupId : null;
    let weekEnd: string | null = "weekEnd" in target ? target.weekEnd : null;
    let competitionId: string | null = null;
    if (weekEnd !== null && !/^\d{4}-\d{2}-\d{2}$/.test(weekEnd)) {
      return { success: false, error: "Date de semaine invalide." };
    }

    if (popupId === null) {
      const { data: competition, error: competitionError } = await client
        .from("competitions")
        .select("id")
        .eq("status", "ACTIVE")
        .maybeSingle<{ id: string }>();
      if (competitionError) return { success: false, error: competitionError.message };
      if (!competition) return { success: false, error: "Aucune compétition active." };
      competitionId = competition.id;
      const { data: existing, error: existingError } = await client
        .from("weekly_popups")
        .select("id")
        .eq("competition_id", competition.id)
        .eq("week_end_date", weekEnd as string)
        .maybeSingle<{ id: string }>();
      if (existingError) return { success: false, error: `Lecture impossible (${MIGRATION_HINT}) : ${existingError.message}` };
      popupId = existing?.id ?? null;
    }

    if (popupId === null) {
      // Ligne absente : créée directement en SKIPPED.
      const { data, error } = await client
        .from("weekly_popups")
        .insert({ competition_id: competitionId, week_end_date: weekEnd, kind: "LLM", status: "SKIPPED" })
        .select("id")
        .maybeSingle<{ id: string }>();
      if (error) {
        if (error.code === "23503") return { success: false, error: "La semaine n'est pas figée : fige-la d'abord." };
        if (error.code === "23505") return { success: false, error: "Une popup existe maintenant pour cette semaine : recharge la page." };
        return { success: false, error: `Écriture impossible : ${error.message}` };
      }
      popupId = data?.id ?? null;
    } else {
      const row = await readPopup(client, popupId);
      if (!row) return { success: false, error: "Popup introuvable." };
      weekEnd = row.week_end_date;
      if (!isSkippable(row.status)) {
        return { success: false, error: "Seul un brouillon prêt ou douteux peut être écarté." };
      }
      const { data, error } = await client
        .from("weekly_popups")
        .update({ status: "SKIPPED" })
        .eq("id", popupId)
        .eq("status", row.status)
        .select("id")
        .maybeSingle();
      if (error) return { success: false, error: `Écriture impossible : ${error.message}` };
      if (!data) return { success: false, error: "Le statut a changé entre-temps : recharge la page." };
    }

    if (popupId) {
      await logAdminAction(session.supabase, {
        actorUserId: session.userId,
        action: "WEEKLY_POPUP_SKIP",
        targetType: "weekly_popup",
        targetId: popupId,
        after: { weekEnd },
      });
    }
    revalidate();
    return { success: true, message: "Popup écartée : rien ne sera publié pour cette semaine." };
  } catch (error) {
    return { success: false, error: errorMessage(error) };
  }
}

// --- Retirer ------------------------------------------------------------------

export async function retractWeeklyPopup(popupId: string): Promise<PopupActionResult> {
  const session = await requireAdmin();
  if (isFailure(session)) return { success: false, error: session.error };

  try {
    const client = getServiceClient();
    const { data, error } = await client
      .from("weekly_popups")
      .update({ status: "RETRACTED" })
      .eq("id", popupId)
      .eq("status", "PUBLISHED")
      .select("id, status")
      .maybeSingle();
    if (error) return { success: false, error: `Retrait impossible : ${error.message}` };
    if (!data) {
      const row = await readPopup(client, popupId);
      if (row && !isRetractable(row.status)) {
        return { success: false, error: "Seule une popup publiée peut être retirée." };
      }
      return { success: false, error: "Popup introuvable." };
    }

    await logAdminAction(session.supabase, {
      actorUserId: session.userId,
      action: "WEEKLY_POPUP_RETRACT",
      targetType: "weekly_popup",
      targetId: popupId,
      before: { status: "PUBLISHED" },
      after: { status: "RETRACTED" },
    });
    revalidate();
    return { success: true, message: "Popup retirée : les joueurs qui ne l'ont pas encore vue ne la verront plus." };
  } catch (error) {
    return { success: false, error: errorMessage(error) };
  }
}

// --- Générer et régénérer (appels payants) -----------------------------------

function describeOutcome(
  outcome: Awaited<ReturnType<typeof runWeeklyPopupGeneration>>,
): { ok: boolean; text: string } {
  const cost = `${outcome.costUsd.toFixed(3)} $`;
  if (outcome.status === "abandoned" || !outcome.written) {
    return {
      ok: false,
      text: `Génération abandonnée : une autre génération a pris la main ou la ligne a changé (coût engagé : ${cost}).`,
    };
  }
  if (outcome.status === "DOUBTFUL") {
    return { ok: false, text: `Brouillon douteux : ${doubtReason(outcome.doubtCode ?? null)} (coût : ${cost}).` };
  }
  return {
    ok: true,
    text:
      outcome.kind === "FALLBACK"
        ? `Texte de repli prêt à relire (coût : ${cost}).`
        : `Brouillon prêt à relire (coût : ${cost}).`,
  };
}

export async function regenerateWeeklyPopup(popupId: string): Promise<PopupActionResult> {
  // La durée maximale de la page (300 s) compte depuis le début de l'action.
  const startedMs = Date.now();
  const session = await requireAdmin();
  if (isFailure(session)) return { success: false, error: session.error };

  try {
    const reserved = await reserveRegeneration(popupId, Date.now());
    if (!reserved.ok) return { success: false, error: `Régénération impossible : ${reserved.reason}.` };

    const outcome = await runWeeklyPopupGeneration(popupId, reserved.generationId, {
      deadlineMs: deadlineFrom(startedMs),
      trigger: "ADMIN_REGENERATE",
    });
    await logAdminAction(session.supabase, {
      actorUserId: session.userId,
      action: "WEEKLY_POPUP_REGENERATE",
      targetType: "weekly_popup",
      targetId: popupId,
      after: { status: outcome.status, doubtCode: outcome.doubtCode ?? null, costUsd: outcome.costUsd },
    });
    revalidate();
    const described = describeOutcome(outcome);
    return described.ok ? { success: true, message: described.text } : { success: false, error: described.text };
  } catch (error) {
    revalidate();
    return { success: false, error: errorMessage(error) };
  }
}

export async function generateWeeklyPopupNow(): Promise<PopupActionResult> {
  const startedMs = Date.now();
  const session = await requireAdmin();
  if (isFailure(session)) return { success: false, error: session.error };

  try {
    // Même réservation que le cron ; la génération, ici, est attendue dans la
    // requête (l'admin est devant l'écran) au lieu d'être différée.
    let task: (() => Promise<void>) | null = null;
    const ensured = await ensureWeeklyPopupDraft(Date.now(), {
      trigger: "ADMIN_GENERATE",
      deadlineMs: deadlineFrom(startedMs),
      deps: {
        schedule: (run) => {
          task = run;
        },
      },
    });

    if (ensured.action !== "scheduled" || !task) {
      const reasons: Record<string, string> = {
        "aucune compétition active": "Aucune compétition active.",
        "popup désactivée": "La popup hebdo n'est pas activée sur la compétition : active-la d'abord.",
        "semaine non figée": "La semaine n'est pas figée : fige-la d'abord.",
        "déjà générée": "Un brouillon existe déjà pour cette semaine : utilise « Régénérer ».",
        "génération en cours": "Une génération est déjà en cours pour cette semaine.",
        "réservée par un autre passage": "Une autre génération vient de démarrer : recharge la page.",
      };
      return { success: false, error: reasons[ensured.reason ?? ""] ?? "Rien n'a été généré." };
    }

    await (task as () => Promise<void>)();

    const client = getServiceClient();
    const row = ensured.popupId ? await readPopup(client, ensured.popupId) : null;
    // `audit_logs.target_id` est un uuid : sans ligne, rien à journaliser.
    if (ensured.popupId) {
      await logAdminAction(session.supabase, {
        actorUserId: session.userId,
        action: "WEEKLY_POPUP_GENERATE",
        targetType: "weekly_popup",
        targetId: ensured.popupId,
        after: { status: row?.status ?? null, doubtCode: row?.doubt_code ?? null, weekEnd: ensured.weekEnd },
      });
    }
    revalidate();

    if (row?.status === "READY") {
      return {
        success: true,
        message: row.kind === "FALLBACK" ? "Texte de repli prêt à relire." : "Brouillon prêt à relire.",
      };
    }
    if (row?.status === "DOUBTFUL") {
      return { success: false, error: `Brouillon douteux : ${doubtReason(row.doubt_code)}.` };
    }
    return { success: false, error: "La génération n'a pas abouti : recharge la page." };
  } catch (error) {
    revalidate();
    return { success: false, error: errorMessage(error) };
  }
}

// --- Essai (décision 13) -------------------------------------------------------

/**
 * Exécute le pipeline sans figement ni écriture dans `weekly_popups` : seul
 * moyen de tester avant le premier figement réel. Par défaut sur la dernière
 * semaine close ; `week: "current"` vise la semaine en cours (paris résolus
 * depuis le lundi 10 h jusqu'à maintenant, sans champion puisqu'elle n'est pas
 * figée). **Chaque appel est payant** (jusqu'à 3 appels LLM) ; coût journalisé
 * dans `ai_usage_logs` et compté dans le plafond du jour.
 */
export async function generateWeeklyPopupTrial(
  opts: { week?: "closed" | "current" } = {},
): Promise<PopupTrialResult> {
  const startedMs = Date.now();
  const session = await requireAdmin();
  if (isFailure(session)) return { success: false, error: session.error };

  try {
    const client = getServiceClient();
    const { data: competition, error: competitionError } = await client
      .from("competitions")
      .select("id, weekly_ranking")
      .eq("status", "ACTIVE")
      .maybeSingle<{ id: string; weekly_ranking: boolean }>();
    if (competitionError) return { success: false, error: competitionError.message };
    if (!competition) return { success: false, error: "Aucune compétition active." };

    const closedWeekEnd = weekEndFor(startedMs);
    const weekEnd = opts.week === "current" ? addDays(closedWeekEnd, 7) : closedWeekEnd;
    const outcome = await runWeeklyPopupGeneration("essai", "essai", {
      deadlineMs: deadlineFrom(startedMs),
      trigger: "ADMIN_GENERATE",
      preview: { competitionId: competition.id, weekEnd },
    });

    const preview = outcome.preview;
    let popup: DisplayedPopup | null = null;
    if (preview?.content) {
      const users = await readUsers(client, citedUserIds(preview.content));
      const info = new Map<string, TokenUserInfo>();
      for (const [id, u] of users) info.set(id, { pseudo: u.pseudo, popupMentionsOptOut: u.popup_mentions_opt_out });
      popup = toDisplayedPopup(preview.content, info);
    }

    const trial: PopupTrial = {
      weekEnd,
      status: outcome.status,
      kind: outcome.kind ?? null,
      doubtCode: outcome.doubtCode ?? null,
      doubtDetail: preview?.doubtDetail ?? null,
      costUsd: outcome.costUsd,
      popup,
      warnings: preview?.warnings ?? [],
      candidateCount: preview?.candidates.length ?? 0,
      blockedCount: preview?.candidates.filter((c) => c.verdict === "bloque").length ?? 0,
    };

    await logAdminAction(session.supabase, {
      actorUserId: session.userId,
      action: "WEEKLY_POPUP_TRIAL",
      targetType: "competition",
      targetId: competition.id,
      after: { weekEnd, week: opts.week ?? "closed", status: outcome.status, doubtCode: outcome.doubtCode ?? null, costUsd: outcome.costUsd },
    });
    revalidate();

    return {
      success: true,
      message:
        outcome.status === "DOUBTFUL"
          ? `Essai terminé : brouillon douteux (${doubtReason(outcome.doubtCode ?? null)}), coût ${outcome.costUsd.toFixed(3)} $.`
          : `Essai terminé, coût ${outcome.costUsd.toFixed(3)} $. Rien n'a été enregistré.`,
      trial,
    };
  } catch (error) {
    revalidate();
    return { success: false, error: errorMessage(error) };
  }
}

// Variante `<form action>` native de l'interrupteur `competitions.weekly_popup`
// (même patron que `setWeeklyRankingFormAction`) : `weekly_popup` ne s'active
// que si le classement hebdo l'est.
export async function setWeeklyPopupFormAction(formData: FormData): Promise<void> {
  const competitionId = String(formData.get("competition_id") ?? "");
  const enabled = formData.get("enabled") === "1";
  if (competitionId.length === 0) return;

  const session = await requireAdmin();
  if (isFailure(session)) return;

  if (enabled) {
    const { data: competition } = await session.supabase
      .from("competitions")
      .select("weekly_ranking")
      .eq("id", competitionId)
      .maybeSingle<{ weekly_ranking: boolean }>();
    if (!competition?.weekly_ranking) {
      revalidatePath("/admin/competitions");
      return;
    }
  }

  const { data: updated, error } = await session.supabase
    .from("competitions")
    .update({ weekly_popup: enabled })
    .eq("id", competitionId)
    .eq("status", "ACTIVE")
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error || !updated) {
    revalidatePath("/admin/competitions");
    return;
  }

  await logAdminAction(session.supabase, {
    actorUserId: session.userId,
    action: "SET_WEEKLY_POPUP",
    targetType: "competition",
    targetId: competitionId,
    after: { weeklyPopup: enabled },
  });
  revalidatePath("/admin/competitions");
  revalidatePath("/admin/popup");
}
