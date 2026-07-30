"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";

// Server action du tutoriel joueur (SPEC_TUTORIEL_JOUEUR_V0_1 §4). Appelée
// PROGRAMMATIQUEMENT depuis les composants client (bannière Accueil, wizard,
// lien Profil) — même patron que lib/actions/notifications.ts (retour typé,
// jamais de redirect).

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Marque le tutoriel comme proposé/vu. Idempotent : n'écrit QUE si
 * tutorial_seen_at est encore NULL (§4) — un rappel depuis le lien Profil
 * (déjà vu) ne doit pas réinitialiser la date d'origine, mais rester sans
 * effet ni erreur.
 */
export async function markTutorialSeen(): Promise<ActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Session expirée." };

  const { error } = await supabase
    .from("users")
    .update({ tutorial_seen_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("tutorial_seen_at", null);

  if (error) return { success: false, error: error.message };

  revalidatePath("/home");
  return { success: true };
}
