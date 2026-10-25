import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, siteUrl, unsubscribeUrl } from "@/lib/email/send";
import { weeklyPopupEmail } from "@/lib/email/templates";
import { getServiceClient } from "@/lib/supabase/service";
import { toDisplayedPopup, userIdsInContent } from "./display";
import type { TokenUserInfo } from "./tokens";
import type { WeeklyPopupContent } from "./types";

// E-mail de la popup hebdomadaire, indépendant du reste (hors règle « un e-mail
// par jour » d'`email_log`). Déclenché par la publication manuelle de l'admin
// (`email_requested_at`), repris par les crons e-mails pour finir un envoi
// interrompu. Journal `weekly_popup_email_log` : une ligne (popup, joueur) est
// RÉSERVÉE avant l'envoi puis supprimée si l'envoi échoue, comme `email_log` ;
// deux passages simultanés ne peuvent donc pas envoyer deux fois.
// Destinataires : comptes ACTIVE qui reçoivent les e-mails de résultats (même
// préférence, même lien de désinscription : « results »).

/** Une popup publiée il y a plus longtemps n'est plus envoyée par un rattrapage. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const RECHECK_EVERY = 25;
const PREVIEW_SIZE = 3;

export interface WeeklyPopupEmailResult {
  skipped?: string;
  popupId?: string;
  candidates: number;
  sent: number;
  failed: number;
  dryRun?: boolean;
  /** Dry-run seulement : sujet et premier destinataire. */
  preview?: string[];
}

export interface WeeklyPopupEmailOptions {
  /** Instant (ms) au-delà duquel on s'arrête proprement ; le passage suivant reprend. */
  deadlineMs?: number;
  dryRun?: boolean;
  onlyUserId?: string;
}

interface Deps {
  client?: SupabaseClient;
  send?: typeof sendEmail;
  address?: (userId: string) => Promise<string | null>;
  now?: () => number;
}

interface PopupToSend {
  id: string;
  status: string;
  content: WeeklyPopupContent | null;
}

export async function runWeeklyPopupEmail(
  options: WeeklyPopupEmailOptions = {},
  deps: Deps = {},
): Promise<WeeklyPopupEmailResult> {
  const base: WeeklyPopupEmailResult = { candidates: 0, sent: 0, failed: 0, ...(options.dryRun ? { dryRun: true } : {}) };
  const service = deps.client ?? getServiceClient();
  const now = deps.now ?? Date.now;
  const send = deps.send ?? sendEmail;
  const address =
    deps.address ??
    (async (userId: string) => {
      const { data } = await service.auth.admin.getUserById(userId);
      return data.user?.email ?? null;
    });

  const { data: popupData, error: popupError } = await service
    .from("weekly_popups")
    .select("id, status, content")
    .eq("status", "PUBLISHED")
    .not("email_requested_at", "is", null)
    .gte("published_at", new Date(now() - MAX_AGE_MS).toISOString())
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (popupError) throw new Error(`Lecture de la popup hebdo : ${popupError.message}`);
  const popup = popupData as PopupToSend | null;
  if (!popup) return { ...base, skipped: "aucune popup publiée à envoyer" };
  if (!popup.content) return { ...base, popupId: popup.id, skipped: "popup sans contenu" };
  const withPopup = { ...base, popupId: popup.id };

  let usersQuery = service
    .from("users")
    .select("id, pseudo")
    .eq("status", "ACTIVE")
    .eq("email_results_enabled", true);
  if (options.onlyUserId) usersQuery = usersQuery.eq("id", options.onlyUserId);
  const [{ data: usersData }, { data: loggedData }] = await Promise.all([
    usersQuery,
    service.from("weekly_popup_email_log").select("user_id").eq("popup_id", popup.id),
  ]);
  const done = new Set((loggedData ?? []).map((row) => (row as { user_id: string }).user_id));
  const targets = ((usersData ?? []) as { id: string; pseudo: string }[]).filter((user) => !done.has(user.id));
  if (targets.length === 0) return withPopup;

  // Mentions résolues une fois pour toutes : le texte est le même pour tout le monde.
  const mentioned = userIdsInContent(popup.content);
  const { data: mentionData } =
    mentioned.length > 0
      ? await service.from("users").select("id, pseudo, popup_mentions_opt_out").in("id", mentioned)
      : { data: [] };
  const info = new Map<string, TokenUserInfo>();
  for (const row of (mentionData ?? []) as { id: string; pseudo: string; popup_mentions_opt_out: boolean }[]) {
    info.set(row.id, { pseudo: row.pseudo, popupMentionsOptOut: row.popup_mentions_opt_out });
  }
  const displayed = toDisplayedPopup(popup.content, info);
  const playUrl = `${siteUrl()}/play`;

  let sent = 0;
  let failed = 0;
  const preview: string[] = [];
  for (const [index, user] of targets.entries()) {
    if (options.deadlineMs !== undefined && now() >= options.deadlineMs) break;
    // Retrait de la popup en cours d'envoi : on s'arrête, sans rien envoyer de plus.
    if (!options.dryRun && index > 0 && index % RECHECK_EVERY === 0) {
      const { data: current } = await service.from("weekly_popups").select("status").eq("id", popup.id).maybeSingle();
      if ((current as { status: string } | null)?.status !== "PUBLISHED") break;
    }
    const to = await address(user.id);
    if (!to) continue;
    const content = weeklyPopupEmail({
      pseudo: user.pseudo,
      titre: displayed.titre,
      sections: displayed.sections.map(({ heading, text }) => ({ heading, text })),
      repli: displayed.repli,
      cta: displayed.cta,
      playUrl,
      unsubscribeUrl: options.dryRun ? "" : unsubscribeUrl(user.id, "results"),
    });
    if (options.dryRun) {
      sent += 1;
      if (preview.length < PREVIEW_SIZE) preview.push(content.subject);
      continue;
    }
    const { error: reserveError } = await service
      .from("weekly_popup_email_log")
      .insert({ popup_id: popup.id, user_id: user.id });
    // Violation d'unicité : un autre passage l'a déjà servi.
    if (reserveError) continue;
    try {
      const providerId = await send({ to, ...content }, { userId: user.id, scope: "results" });
      await service
        .from("weekly_popup_email_log")
        .update({ provider_id: providerId })
        .eq("popup_id", popup.id)
        .eq("user_id", user.id);
      sent += 1;
    } catch (error) {
      console.error("runWeeklyPopupEmail : envoi en échec —", error instanceof Error ? error.message : error);
      await service.from("weekly_popup_email_log").delete().eq("popup_id", popup.id).eq("user_id", user.id);
      failed += 1;
    }
  }
  return { ...withPopup, candidates: targets.length, sent, failed, ...(options.dryRun ? { preview } : {}) };
}
