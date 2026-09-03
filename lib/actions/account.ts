"use server";

import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { toClientError } from "@/lib/actions/errors";

// Suppression de compte en self-service (§8.2 conseils_juridiques_
// deploiement_application.md, cadré le 03/09/2026) — reprend l'ordre de
// suppression du script CLI existant (scripts/delete-player-account.mjs,
// audit sécurité finding 15), avec 2 différences volontaires :
//   - la cible est TOUJOURS l'utilisateur de la session (getServerClient),
//     jamais un pseudo passé en paramètre — aucun appel ci-dessous n'est
//     scopé autrement qu'avec `user.id` lu du JWT.
//   - chat_message_reports (migration 20260903130000, postérieure au script
//     CLI) est couvert : message_author_id/resolved_by_admin_id nullifiés
//     (référence à une ligne appartenant à quelqu'un d'autre),
//     reporter_user_id supprimé (ligne possédée, colonne NOT NULL).
//
// La purge multi-tables (une quinzaine de tables) passe par la fonction SQL
// delete_account_data() (migration 20260903140000, DATA-002 de l'audit du
// 03/09/2026) plutôt que par une séquence de .update()/.delete() séparés :
// chacun de ces appels étant sa propre requête HTTP (donc sa propre
// transaction Postgres implicite), une interruption en cours de route
// pouvait auparavant laisser un compte partiellement supprimé. Une
// fonction PL/pgSQL s'exécute dans une seule transaction Postgres — soit
// tout est purgé, soit rien ne l'est. auth.admin.deleteUser() reste un 2e
// appel distinct (API GoTrue, système séparé de Postgres, ne peut pas
// partager la même transaction) — voir le commentaire de la migration pour
// le détail de ce compromis structurel.
//
// getServiceClient() (service_role) est nécessaire pour appeler cette
// fonction (verrouillée par REVOKE à service_role uniquement, voir la
// migration) et pour auth.admin.deleteUser() — mêmes garde-fous "scopé à
// la session" que recalculateCompetition (lib/actions/admin.ts), juste
// avec service_role au lieu du client RLS.

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
    // Purge atomique (migration 20260903140000) -- soit tout est supprimé,
    // soit rien ne l'est (rollback automatique côté Postgres en cas d'erreur).
    const { error: purgeError } = await service.rpc("delete_account_data", { p_user_id: user!.id });
    if (purgeError) throw purgeError;

    const { error: deleteUserError } = await service.auth.admin.deleteUser(user!.id);
    if (deleteUserError) throw deleteUserError;
  } catch (error) {
    redirectWithError(toClientError("deleteAccountFormAction", error instanceof Error ? error : { message: String(error) }));
  }

  await supabase.auth.signOut();
  redirect("/login?accountDeleted=1");
}
