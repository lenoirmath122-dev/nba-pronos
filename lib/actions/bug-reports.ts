"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { toClientError } from "@/lib/actions/errors";
import { requiredBoundedText } from "@/lib/actions/validation";

// Signalement rapide (28/08/2026, migration #33) — 2 actions distinctes :
// submitBugReport (joueur, appelée en useTransition depuis BugReportButton,
// bouton flottant présent sur tout /(app)) et resolveBugReportFormAction
// (admin, formulaire natif, même patron redirection+erreur que
// lib/actions/corrections.ts). Écriture directe sur bug_reports (RLS) --
// pas de logique métier assez riche pour justifier une fonction SQL
// SECURITY DEFINER comme request_prediction_correction.

export type ActionResult = { success: true } | { success: false; error: string };

const MAX_DESCRIPTION_LENGTH = 5000;
const DescriptionSchema = requiredBoundedText(MAX_DESCRIPTION_LENGTH);

export async function submitBugReport(input: {
  description: string;
  screenPath: string;
}): Promise<ActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const parsed = DescriptionSchema.safeParse(input.description);
  if (!parsed.success) {
    const tooLong = input.description.trim().length > MAX_DESCRIPTION_LENGTH;
    return { success: false, error: tooLong ? `${MAX_DESCRIPTION_LENGTH} caractères maximum.` : "Décris le souci avant d'envoyer." };
  }
  const description = parsed.data;

  const { error } = await supabase.from("bug_reports").insert({
    user_id: user.id,
    description,
    screen_path: input.screenPath || null,
  });
  if (error) return { success: false, error: toClientError("submitBugReport", error) };

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

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect(`/admin/bug-reports?reportId=${reportId}&bugReportError=${encodeURIComponent("Réservé aux admins.")}`);

  const { data: updated, error } = await supabase
    .from("bug_reports")
    .update({
      status: "RESOLVED",
      admin_note: adminNote.length > 0 ? adminNote : null,
      resolved_at: new Date().toISOString(),
      resolved_by_admin_id: user!.id,
    })
    .eq("id", reportId)
    .select("id")
    .maybeSingle();

  if (error) {
    redirect(`/admin/bug-reports?reportId=${reportId}&bugReportError=${encodeURIComponent(toClientError("resolveBugReportFormAction", error))}`);
  }
  if (!updated) {
    redirect(`/admin/bug-reports?reportId=${reportId}&bugReportError=${encodeURIComponent("Aucune ligne modifiée.")}`);
  }

  revalidatePath("/admin/bug-reports");
  redirect("/admin/bug-reports");
}
