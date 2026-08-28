"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";

// Signalement rapide (28/08/2026, migration #33) — 2 actions distinctes :
// submitBugReport (joueur, appelée en useTransition depuis BugReportButton,
// bouton flottant présent sur tout /(app)) et resolveBugReportFormAction
// (admin, formulaire natif, même patron redirection+erreur que
// lib/actions/corrections.ts). Écriture directe sur bug_reports (RLS) --
// pas de logique métier assez riche pour justifier une fonction SQL
// SECURITY DEFINER comme request_prediction_correction.

export type ActionResult = { success: true } | { success: false; error: string };

export async function submitBugReport(input: {
  description: string;
  screenPath: string;
}): Promise<ActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const description = input.description.trim();
  if (description.length === 0) return { success: false, error: "Décris le souci avant d'envoyer." };

  const { error } = await supabase.from("bug_reports").insert({
    user_id: user.id,
    description,
    screen_path: input.screenPath || null,
  });
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/bug-reports");
  return { success: true };
}

/**
 * Formulaire natif admin (marquer résolu, note optionnelle) — même patron
 * FormData brut + redirection que requestPredictionCorrectionFormAction :
 * l'erreur est portée par l'URL, rendue par la page au rechargement.
 */
export async function resolveBugReportFormAction(formData: FormData): Promise<void> {
  const reportId = String(formData.get("reportId") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim();

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("bug_reports")
    .update({
      status: "RESOLVED",
      admin_note: adminNote.length > 0 ? adminNote : null,
      resolved_at: new Date().toISOString(),
      resolved_by_admin_id: user!.id,
    })
    .eq("id", reportId);

  if (error) {
    redirect(`/admin/bug-reports?reportId=${reportId}&bugReportError=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/bug-reports");
  redirect("/admin/bug-reports");
}
