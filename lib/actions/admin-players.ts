"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/actions/audit";
import { toClientError } from "@/lib/actions/errors";

// Écriture de Gestion des joueurs (SPEC_ECRAN_ADMIN_PLAYERS_V0_1 §3).
// Catégorie B SANS recompute (T6a §5.3) : UPDATE direct sur `users`, session
// admin (RLS users_update_admin = is_admin()). AUCUNE fonction SQL — les
// garde-fous (anti auto-rétrogradation, dernier admin) vivent déjà dans le
// trigger enforce_users_invariants (migration #3/#4) ; ses messages
// d'erreur sont déjà rédigés pour un lecteur humain, remontés tels quels.

export type ActionResult = { success: true } | { success: false; error: string };

export async function setPlayerRole(input: { userId: string; role: "PLAYER" | "ADMIN" }): Promise<ActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Réservé aux admins." };

  const { data: before } = await supabase.from("users").select("role").eq("id", input.userId).single();

  const { data: updated, error } = await supabase
    .from("users")
    .update({ role: input.role })
    .eq("id", input.userId)
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: toClientError("setPlayerRole", error) };
  if (!updated) return { success: false, error: "Aucune ligne modifiée (bloqué par une règle de sécurité)." };

  await logAdminAction(supabase, {
    actorUserId: user.id,
    action: "SET_PLAYER_ROLE",
    targetType: "user",
    targetId: input.userId,
    before: before ? { role: before.role } : undefined,
    after: { role: input.role },
  });

  revalidatePath("/admin/players");
  return { success: true };
}

export async function setPlayerStatus(input: { userId: string; status: "ACTIVE" | "DISABLED" }): Promise<ActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Réservé aux admins." };

  const { data: before } = await supabase.from("users").select("status").eq("id", input.userId).single();

  const { data: updated, error } = await supabase
    .from("users")
    .update({ status: input.status })
    .eq("id", input.userId)
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: toClientError("setPlayerStatus", error) };
  if (!updated) return { success: false, error: "Aucune ligne modifiée (bloqué par une règle de sécurité)." };

  await logAdminAction(supabase, {
    actorUserId: user.id,
    action: "SET_PLAYER_STATUS",
    targetType: "user",
    targetId: input.userId,
    before: before ? { status: before.status } : undefined,
    after: { status: input.status },
  });

  revalidatePath("/admin/players");
  return { success: true };
}

/**
 * Variantes `<form action={...}>` NATIVES : FormData brut, appel de
 * l'action, puis REDIRECTION — même patron que lib/actions/admin-validation.ts.
 */
export async function setPlayerRoleFormAction(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as "PLAYER" | "ADMIN";

  const result = await setPlayerRole({ userId, role });
  if (!result.success) {
    redirect(`/admin/players?playersError=${encodeURIComponent(result.error)}&userId=${userId}`);
  }
  redirect("/admin/players");
}

export async function setPlayerStatusFormAction(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") ?? "");
  const status = String(formData.get("status") ?? "") as "ACTIVE" | "DISABLED";

  const result = await setPlayerStatus({ userId, status });
  if (!result.success) {
    redirect(`/admin/players?playersError=${encodeURIComponent(result.error)}&userId=${userId}`);
  }
  redirect("/admin/players");
}
