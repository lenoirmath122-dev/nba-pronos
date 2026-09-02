"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";
import { notifyNewChatMessage } from "@/lib/push/notifyChatMessage";
import { toClientError } from "@/lib/actions/errors";
import { z } from "zod";
import { boundedText } from "@/lib/actions/validation";

const ChatScopeSchema = z.enum(["GLOBAL", "LEAGUE"]);

// Server actions du chat (SPEC_CHAT_V0_1.md, 27/08/2026). PAS le patron
// "formulaire natif + redirect" du reste de lib/actions/* (profile.ts,
// corrections.ts) : une redirection à chaque message casserait le scroll et
// viderait le champ de saisie sur un écran pensé pour poster en rafale --
// même exception déjà faite pour LoginForm/SignupForm (useActionState, pas
// de redirect direct). Le message envoyé revient via Realtime (ChatSubscriber)
// comme celui des autres joueurs : pas d'optimistic update ici, pas de
// revalidatePath non plus (la liste affichée est pilotée par Realtime, pas
// par un rechargement SSR).

const MAX_MESSAGE_LENGTH = 2000;
const MessageBodySchema = boundedText(MAX_MESSAGE_LENGTH);

export type PostChatMessageState = { error: string | null } | undefined;

export async function postChatMessageFormAction(
  _prevState: PostChatMessageState,
  formData: FormData
): Promise<PostChatMessageState> {
  const scopeParsed = ChatScopeSchema.safeParse(String(formData.get("scopeType") ?? ""));
  if (!scopeParsed.success) {
    return { error: "Canal invalide." };
  }
  const scopeType = scopeParsed.data;
  const leagueIdRaw = String(formData.get("leagueId") ?? "");
  const leagueId = leagueIdRaw === "" ? null : leagueIdRaw;
  const body = String(formData.get("body") ?? "").trim();

  if (scopeType === "LEAGUE" && !leagueId) {
    return { error: "Canal invalide." };
  }
  if (body.length === 0) {
    return { error: null }; // pas d'erreur affichée pour un envoi vide (espace/entrée seuls)
  }
  if (!MessageBodySchema.safeParse(body).success) {
    return { error: `${MAX_MESSAGE_LENGTH} caractères maximum.` };
  }

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnecte-toi." };

  const { error } = await supabase.from("chat_messages").insert({
    scope_type: scopeType,
    league_id: scopeType === "LEAGUE" ? leagueId : null,
    user_id: user.id,
    body,
  });

  if (error) return { error: toClientError("postChatMessageFormAction", error) };

  // Notif push (addendum SPEC_CHAT_V0_1.md, 27/08/2026) -- résolue ici, PAS
  // fournie par le client (le libellé du canal comme le pseudo doivent venir
  // du serveur, sinon un client modifié pourrait faire apparaître n'importe
  // quel texte dans la notif poussée à d'autres joueurs). Ne bloque jamais
  // l'envoi du message si elle échoue (notifyNewChatMessage n'est pas censée
  // lever, mais awaitée quand même pour garder l'ordre simple -- volume trop
  // faible, groupe d'amis, pour justifier un envoi vraiment détaché).
  const [{ data: author }, channelLabel] = await Promise.all([
    supabase.from("users").select("pseudo").eq("id", user.id).single<{ pseudo: string }>(),
    resolveChannelLabel(supabase, scopeType, leagueId),
  ]);
  await notifyNewChatMessage({
    scopeType,
    leagueId,
    authorId: user.id,
    authorPseudo: author?.pseudo ?? "Joueur",
    channelLabel,
    body,
  });

  return { error: null };
}

type SupabaseServerClient = Awaited<ReturnType<typeof getServerClient>>;

async function resolveChannelLabel(supabase: SupabaseServerClient, scopeType: "GLOBAL" | "LEAGUE", leagueId: string | null): Promise<string> {
  if (scopeType === "GLOBAL") return "Général";
  const { data } = await supabase.from("leagues").select("name").eq("id", leagueId!).single<{ name: string }>();
  return data?.name ?? "Ligue";
}

export type DeleteChatMessageState = { error: string | null } | undefined;

/** Suppression admin (décision actée : pas de self-delete). L'UI ne montre
 *  ce bouton qu'à un compte admin (ChatMessageRow) ; chat_messages_delete_admin
 *  (RLS) reste l'autorité réelle, mais is_admin() est revérifié explicitement
 *  ici pour ne jamais renvoyer un faux succès sur un appel forgé. */
export async function deleteChatMessageFormAction(
  _prevState: DeleteChatMessageState,
  formData: FormData
): Promise<DeleteChatMessageState> {
  const messageId = String(formData.get("messageId") ?? "");
  if (!messageId) return { error: null };

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée." };

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { error: "Réservé aux admins." };

  const { data: deleted, error } = await supabase.from("chat_messages").delete().eq("id", messageId).select("id").maybeSingle();
  if (error) return { error: toClientError("deleteChatMessageFormAction", error) };
  if (!deleted) return { error: "Aucune ligne supprimée." };
  return { error: null };
}

type ActionResult = { success: true } | { success: false; error: string };

/** Active/désactive les notifs d'UN canal (addendum SPEC_CHAT_V0_1.md,
 *  27/08/2026). Appelée PROGRAMMATIQUEMENT (pas un <form>) depuis
 *  ChatNotificationToggle ("use client") -- activer peut d'abord exiger
 *  d'obtenir la permission navigateur + un abonnement Push (ensurePushSubscribed,
 *  lib/push/client.ts), un simple <form action> ne suffit pas, même patron
 *  que lib/actions/notifications.ts. Par défaut = activé (décision actée) :
 *  chat_muted_channels ne stocke que les EXCEPTIONS, donc "activer" = retirer
 *  une éventuelle ligne, "désactiver" = en poser une (idempotent dans les 2 sens). */
export async function setChatChannelNotifications(
  scopeType: "GLOBAL" | "LEAGUE",
  leagueId: string | null,
  enabled: boolean
): Promise<ActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Session expirée." };

  if (enabled) {
    let query = supabase.from("chat_muted_channels").delete().eq("user_id", user.id).eq("scope_type", scopeType);
    query = scopeType === "GLOBAL" ? query.is("league_id", null) : query.eq("league_id", leagueId!);
    const { error } = await query;
    if (error) return { success: false, error: toClientError("setChatChannelNotifications/unmute", error) };
  } else {
    const { error } = await supabase.from("chat_muted_channels").insert({
      user_id: user.id,
      scope_type: scopeType,
      league_id: scopeType === "LEAGUE" ? leagueId : null,
    });
    // 23505 = déjà en sourdine (index unique partiel) -- idempotent, pas une erreur.
    if (error && error.code !== "23505") return { success: false, error: toClientError("setChatChannelNotifications/mute", error) };
  }

  revalidatePath("/chat");
  return { success: true };
}
