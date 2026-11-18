"use server";

import { getServerClient } from "@/lib/supabase/server";
import { toClientError } from "@/lib/actions/errors";
import { isRecapReactionKind, isRecapReactionTarget } from "@/lib/recaps/reactions";

// Réaction rapide à un highlight de nuit (Actualité, 13/11/2026 ; table
// recap_reactions). Même patron que setChatReaction : appelée depuis le
// client avec mise à jour optimiste, RLS reste l'autorité (sa propre ligne,
// compte actif). Pas de revalidatePath : les compteurs affichés sont pilotés
// par l'état local, relus au prochain chargement.

export type RecapReactionResult = { success: true } | { success: false; error: string };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export async function setRecapReaction(
  competitionId: string,
  recapDate: string,
  target: string,
  kind: string | null
): Promise<RecapReactionResult> {
  if (!competitionId || !DATE_KEY.test(recapDate)) return { success: false, error: "Nuit introuvable." };
  if (!isRecapReactionTarget(target)) return { success: false, error: "Élément introuvable." };
  if (kind !== null && !isRecapReactionKind(kind)) return { success: false, error: "Réaction inconnue." };

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Session expirée." };

  const key = { competition_id: competitionId, recap_date: recapDate, target, user_id: user.id };
  if (kind === null) {
    const { error } = await supabase
      .from("recap_reactions")
      .delete()
      .eq("competition_id", competitionId)
      .eq("recap_date", recapDate)
      .eq("target", target)
      .eq("user_id", user.id);
    if (error) return { success: false, error: toClientError("setRecapReaction/remove", error) };
  } else {
    const { error } = await supabase
      .from("recap_reactions")
      .upsert({ ...key, kind }, { onConflict: "competition_id,recap_date,target,user_id" });
    if (error) return { success: false, error: toClientError("setRecapReaction/set", error) };
  }
  return { success: true };
}
