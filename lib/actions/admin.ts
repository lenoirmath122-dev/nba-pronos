"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";
import { recomputeCompetition } from "@/lib/scoring/recompute";
import { logAdminAction } from "@/lib/actions/audit";
import { toClientError } from "@/lib/actions/errors";

// Bouton « Recalculer » du tableau de bord (SPEC_ECRAN_ADMIN_DASHBOARD_V0_1
// §4/§7, design cible enfin codable — lot 4/4 de T5). Catégorie B AVEC
// recompute (T6a §5.3) : session admin (getServerClient) pour RE-VÉRIFIER
// is_admin() côté serveur, PUIS délègue à recomputeCompetition
// (lib/scoring/recompute.ts, getServiceClient en interne) — jamais de
// service_role directement dans cette action.

export type ActionResult = { success: true } | { success: false; error: string };

export async function recalculateCompetition(): Promise<ActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Réservé aux admins." };

  // Pas de sélecteur (§4) : lit la compétition ACTIVE serveur — un client
  // ne choisit jamais la cible d'une opération privilégiée.
  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("status", "ACTIVE")
    .maybeSingle<{ id: string }>();
  if (!competition) return { success: false, error: "Aucune compétition active." };

  try {
    await recomputeCompetition(competition.id);
  } catch (error) {
    return { success: false, error: toClientError("recalculateCompetition", error instanceof Error ? error : { message: String(error) }) };
  }

  await logAdminAction(supabase, {
    actorUserId: user.id,
    action: "RECALCULATE_COMPETITION",
    targetType: "competition",
    targetId: competition.id,
  });

  revalidatePath("/admin");
  return { success: true };
}
