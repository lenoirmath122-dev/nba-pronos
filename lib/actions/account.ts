"use server";

import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { toClientError } from "@/lib/actions/errors";

// Suppression de compte en self-service (§8.2 conseils_juridiques_
// deploiement_application.md, cadré le 03/09/2026) — reprend l'ordre de
// suppression du script CLI existant (scripts/delete-player-account.mjs,
// audit sécurité finding 15) tel quel, avec 2 différences volontaires :
//   - la cible est TOUJOURS l'utilisateur de la session (getServerClient),
//     jamais un pseudo passé en paramètre — aucune requête ci-dessous n'est
//     scopée autrement qu'avec `user.id` lu du JWT.
//   - chat_message_reports (migration 20260903130000, postérieure au script
//     CLI) est couvert ici : message_author_id/resolved_by_admin_id
//     nullifiés (référence à une ligne appartenant à quelqu'un d'autre),
//     reporter_user_id supprimé (ligne possédée, colonne NOT NULL).
// getServiceClient() (service_role) est nécessaire pour auth.admin.deleteUser
// et pour ne pas dépendre de policies DELETE/UPDATE qui n'existent pas sur
// ces tables (les joueurs ne suppriment normalement jamais leurs paris/
// messages) — mêmes garde-fous "scopé à la session" que recalculateCompetition
// (lib/actions/admin.ts), juste avec service_role au lieu du client RLS.
const ADMIN_REFERENCE_COLUMNS: { table: string; columns: string[] }[] = [
  { table: "bets", columns: ["validated_by_admin_id", "resolved_by_admin_id", "corrected_by_admin_id"] },
  { table: "match_predictions", columns: ["corrected_by_admin_id"] },
  { table: "bug_reports", columns: ["resolved_by_admin_id"] },
  { table: "correction_requests", columns: ["handled_by_admin_id"] },
  { table: "entity_mappings", columns: ["confirmed_by_admin_id"] },
  { table: "chat_message_reports", columns: ["message_author_id", "resolved_by_admin_id"] },
];

// Feuilles vers racines, comme le script CLI.
const OWNED_TABLES: { table: string; column: string }[] = [
  { table: "correction_requests", column: "requester_user_id" },
  { table: "bets", column: "user_id" },
  { table: "match_predictions", column: "user_id" },
  { table: "brackets", column: "user_id" },
  { table: "chat_messages", column: "user_id" },
  { table: "bug_reports", column: "user_id" },
  { table: "chat_message_reports", column: "reporter_user_id" },
  { table: "league_memberships", column: "user_id" },
  { table: "leaderboard_snapshots", column: "user_id" },
  { table: "competition_superlatives", column: "user_id" },
  { table: "competition_archives", column: "user_id" },
  { table: "audit_logs", column: "actor_user_id" },
];

function redirectWithError(message: string): never {
  redirect(`/profile?tab=compte&profileError=${encodeURIComponent(message)}`);
}

export async function deleteAccountFormAction(formData: FormData): Promise<void> {
  const pseudoConfirm = String(formData.get("pseudoConfirm") ?? "").trim();

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = getServiceClient();

  const { data: account, error: accountError } = await service
    .from("users")
    .select("pseudo, role")
    .eq("id", user!.id)
    .single<{ pseudo: string; role: string }>();
  if (accountError || !account) {
    redirectWithError(toClientError("deleteAccountFormAction:lookup", accountError ?? { message: "compte introuvable" }));
  }

  if (pseudoConfirm !== account!.pseudo) {
    redirectWithError("Le pseudo saisi ne correspond pas — tape-le exactement pour confirmer la suppression.");
  }

  // ── Garde-fous (identiques au script CLI) ─────────────────────────────
  if (account!.role === "ADMIN") {
    redirectWithError(
      "Ton compte a le rôle Admin : demande à un autre admin de te rétrograder en Joueur avant de pouvoir le supprimer toi-même."
    );
  }

  const { data: createdLeagues, error: leaguesError } = await service
    .from("leagues")
    .select("id, name")
    .eq("created_by_user_id", user!.id);
  if (leaguesError) {
    redirectWithError(toClientError("deleteAccountFormAction:leagues", leaguesError));
  }
  for (const league of createdLeagues ?? []) {
    const { count, error } = await service
      .from("league_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("league_id", league.id)
      .neq("user_id", user!.id);
    if (error) {
      redirectWithError(toClientError("deleteAccountFormAction:league-members", error));
    }
    if ((count ?? 0) > 0) {
      redirectWithError(
        `Tu as créé la ligue « ${league.name} » qui a d'autres membres — transfère-la ou préviens-les avant de supprimer ton compte.`
      );
    }
  }

  try {
    for (const { table, columns } of ADMIN_REFERENCE_COLUMNS) {
      for (const column of columns) {
        const { error } = await service.from(table).update({ [column]: null }).eq(column, user!.id);
        if (error) throw error;
      }
    }

    const { data: brackets, error: bracketsError } = await service.from("brackets").select("id").eq("user_id", user!.id);
    if (bracketsError) throw bracketsError;
    const bracketIds = (brackets ?? []).map((b) => b.id);
    if (bracketIds.length > 0) {
      const { error } = await service.from("bracket_picks").delete().in("bracket_id", bracketIds);
      if (error) throw error;
    }

    // Casse la FK circulaire avant de purger correction_requests.
    const { error: mpError } = await service
      .from("match_predictions")
      .update({ correction_request_id: null })
      .eq("user_id", user!.id);
    if (mpError) throw mpError;
    const { error: betsError } = await service.from("bets").update({ correction_request_id: null }).eq("user_id", user!.id);
    if (betsError) throw betsError;

    for (const { table, column } of OWNED_TABLES) {
      const { error } = await service.from(table).delete().eq(column, user!.id);
      if (error) throw error;
    }

    const { error: deleteUserError } = await service.auth.admin.deleteUser(user!.id);
    if (deleteUserError) throw deleteUserError;
  } catch (error) {
    redirectWithError(toClientError("deleteAccountFormAction", error instanceof Error ? error : { message: String(error) }));
  }

  await supabase.auth.signOut();
  redirect("/login?accountDeleted=1");
}
