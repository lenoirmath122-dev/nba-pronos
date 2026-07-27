import { getServerClient } from "@/lib/supabase/server";

// Journalisation admin partagée (T6b §6, SPEC_ECRAN_ADMIN_VALIDATION_V0_1
// §5) — appelée par CHAQUE action admin, pas seulement la validation. RLS
// audit_insert (migration #3) : is_admin() ET actor_user_id = auth.uid()
// (session admin normale, aucun privilège requis).

type SupabaseServerClient = Awaited<ReturnType<typeof getServerClient>>;

export async function logAdminAction(
  supabase: SupabaseServerClient,
  input: {
    actorUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    reason?: string;
    before?: unknown;
    after?: unknown;
  }
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    actor_user_id: input.actorUserId,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason ?? null,
    before_value: input.before ?? null,
    after_value: input.after ?? null,
  });

  // Best-effort (§4 de la spec validation) : la transition métier est déjà
  // posée au moment où logAdminAction est appelée, on ne l'annule pas pour
  // un problème d'audit — mais on ne le passe pas sous silence non plus.
  if (error) {
    console.error(`logAdminAction a échoué pour "${input.action}" (${input.targetId}) :`, error.message);
  }
}
