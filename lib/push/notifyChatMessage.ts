import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { sendPushToSubscriptions, type PushSubscriptionRow } from "@/lib/push/send";

// Notification push d'un nouveau message de chat (SPEC_CHAT_V0_1.md,
// addendum notifications 27/08/2026). Appelée en direct depuis
// postChatMessageFormAction (lib/actions/chat.ts) -- PAS un cron comme
// lib/reminders/* : le besoin (prévenir vite qu'un message vient d'arriver)
// est intrinsèquement synchrone. Voir lib/supabase/service.ts pour pourquoi
// service_role est légitime ici.
//
// Par défaut, un canal accessible est notifié (décision actée) : cette
// fonction lit les EXCEPTIONS (chat_muted_channels) plutôt qu'une liste
// d'abonnés positive.

const PREVIEW_LENGTH = 140;

type NewChatMessage = {
  scopeType: "GLOBAL" | "LEAGUE";
  leagueId: string | null;
  authorId: string;
  authorPseudo: string;
  channelLabel: string;
  body: string;
};

function truncate(body: string): string {
  return body.length > PREVIEW_LENGTH ? `${body.slice(0, PREVIEW_LENGTH)}…` : body;
}

/** Ne lève jamais -- une notif ratée ne doit pas faire échouer l'envoi du
 *  message lui-même (appelant : postChatMessageFormAction). */
export async function notifyNewChatMessage(message: NewChatMessage): Promise<void> {
  try {
    await doNotify(message);
  } catch (error) {
    console.error("notifyNewChatMessage: échec non bloquant", error);
  }
}

async function doNotify(message: NewChatMessage): Promise<void> {
  const supabase = getServiceClient();

  // 1. Destinataires potentiels : ACTIVE + préférence PUSH, hors l'auteur --
  //    tout le monde pour Général, les seuls membres pour une ligue.
  let candidateIds: string[];
  if (message.scopeType === "GLOBAL") {
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("status", "ACTIVE")
      .eq("notification_preference", "PUSH")
      .neq("id", message.authorId);
    candidateIds = (data ?? []).map((r) => r.id as string);
  } else {
    const { data: members } = await supabase
      .from("league_memberships")
      .select("user_id")
      .eq("league_id", message.leagueId!);
    const memberIds = (members ?? []).map((r) => r.user_id as string).filter((id) => id !== message.authorId);
    if (memberIds.length === 0) return;
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("status", "ACTIVE")
      .eq("notification_preference", "PUSH")
      .in("id", memberIds);
    candidateIds = (data ?? []).map((r) => r.id as string);
  }
  if (candidateIds.length === 0) return;

  // 2. Retire ceux qui ont mis CE canal en sourdine.
  let mutedQuery = supabase
    .from("chat_muted_channels")
    .select("user_id")
    .eq("scope_type", message.scopeType)
    .in("user_id", candidateIds);
  mutedQuery = message.scopeType === "GLOBAL" ? mutedQuery.is("league_id", null) : mutedQuery.eq("league_id", message.leagueId!);
  const { data: mutedRows } = await mutedQuery;
  const mutedIds = new Set((mutedRows ?? []).map((r) => r.user_id as string));
  const recipientIds = candidateIds.filter((id) => !mutedIds.has(id));
  if (recipientIds.length === 0) return;

  // 3. Abonnements Push réels (plusieurs appareils possibles par joueur).
  const { data: subsData } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh_key, auth_key")
    .in("user_id", recipientIds);
  const subscriptions = (subsData ?? []) as PushSubscriptionRow[];
  if (subscriptions.length === 0) return;

  const { deadSubscriptionIds } = await sendPushToSubscriptions(subscriptions, {
    title: message.channelLabel,
    body: `${message.authorPseudo} : ${truncate(message.body)}`,
    url: message.scopeType === "GLOBAL" ? "/chat?canal=general" : `/chat?canal=${message.leagueId}`,
  });

  if (deadSubscriptionIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", deadSubscriptionIds);
  }
}
