"use server";

import { getServerClient } from "@/lib/supabase/server";

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

export type PostChatMessageState = { error: string | null } | undefined;

export async function postChatMessageFormAction(
  _prevState: PostChatMessageState,
  formData: FormData
): Promise<PostChatMessageState> {
  const scopeType = String(formData.get("scopeType") ?? "");
  const leagueIdRaw = String(formData.get("leagueId") ?? "");
  const leagueId = leagueIdRaw === "" ? null : leagueIdRaw;
  const body = String(formData.get("body") ?? "").trim();

  if (scopeType !== "GLOBAL" && scopeType !== "LEAGUE") {
    return { error: "Canal invalide." };
  }
  if (scopeType === "LEAGUE" && !leagueId) {
    return { error: "Canal invalide." };
  }
  if (body.length === 0) {
    return { error: null }; // pas d'erreur affichée pour un envoi vide (espace/entrée seuls)
  }
  if (body.length > MAX_MESSAGE_LENGTH) {
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

  if (error) return { error: error.message };
  return { error: null };
}

export type DeleteChatMessageState = { error: string | null } | undefined;

/** Suppression admin (décision actée : pas de self-delete). L'UI ne montre
 *  ce bouton qu'à un compte admin (ChatMessageRow), mais chat_messages_delete_admin
 *  (RLS) reste la SEULE autorité réelle -- un appel forgé par un non-admin
 *  supprime 0 ligne, silencieusement. */
export async function deleteChatMessageFormAction(
  _prevState: DeleteChatMessageState,
  formData: FormData
): Promise<DeleteChatMessageState> {
  const messageId = String(formData.get("messageId") ?? "");
  if (!messageId) return { error: null };

  const supabase = await getServerClient();
  const { error } = await supabase.from("chat_messages").delete().eq("id", messageId);
  if (error) return { error: error.message };
  return { error: null };
}
