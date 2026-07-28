#!/usr/bin/env node
// ============================================================================
// CLEANUP — jeu de données de TEST (symétrique de seed-playoffs-test-data.mjs)
// ============================================================================
// Fichier  : scripts/cleanup-test-data.mjs
// Usage    : node --env-file=.env.local scripts/cleanup-test-data.mjs        (dry-run, ne supprime rien)
//            node --env-file=.env.local scripts/cleanup-test-data.mjs --confirm  (exécute réellement)
// Nature   : script HORS supabase/migrations/ (même raison que le seed) : les
//            comptes de test ont été créés via l'API Admin (auth.admin.
//            createUser), leur suppression doit repasser par l'API Admin
//            (auth.admin.deleteUser) — jamais un DELETE SQL direct sur
//            auth.users. Écrit en réponse à SPEC_TECHNIQUE_DEPLOIEMENT_V0.1.md
//            §6 (T8, validé le 28/07/2026).
//
// PÉRIMÈTRE — liste EXPLICITE, jamais un motif large (`.test`, etc.) :
//   - Compétitions : "Playoffs NBA (test)" (seed initial) + "Test UI Matchs"
//     (créée pour le dry-run T4 puis les tests visuels de centralisation
//     prono/pari, ETAT_ACTUEL.md §2.34/§2.36).
//   - Comptes : les 7 `seed-*@nba-pronos.test` (pseudos ci-dessous).
// EXCLU DÉLIBÉRÉMENT : `demo-amis@nba-pronos.test` (Demo_Amis) — compte de
// démo ACTIVEMENT utilisé par les amis de l'utilisateur, pas un artefact de
// seed (GAPS_OUVERTS.md, "à retirer ou reconvertir" plus tard, PAS ici) ; le
// compte réel de l'utilisateur (Rillettes-31) — jamais touché par ce script,
// qui ne connaît que les 7 pseudos ci-dessous.
//
// SÉCURITÉ : service_role (contourne la RLS, comme le seed). DRY-RUN PAR
// DÉFAUT — affiche ce qui serait supprimé sans rien supprimer, tant que
// --confirm n'est pas passé explicitement en argument.
//
// ORDRE DE SUPPRESSION (respecte les FK du schéma T1, pas de cascade sauf
// competition_secrets/public.users — voir 20260718090000_initial_schema.sql
// et 20260718110000_rls.sql) : casse la FK circulaire correction_requests <->
// match_predictions/bets d'abord, puis feuilles vers racines, comptes en tout
// dernier (auth.admin.deleteUser cascade vers public.users via ON DELETE
// CASCADE, D5).
// ============================================================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être chargées " +
      "(lancer avec : node --env-file=.env.local scripts/cleanup-test-data.mjs)"
  );
}

const DRY_RUN = !process.argv.includes("--confirm");

const TEST_COMPETITION_NAMES = ["Playoffs NBA (test)", "Test UI Matchs"];
const SEED_PSEUDOS = ["Amine92", "Chloe_B", "Yanis44", "Sofia_Admin", "Marco_D", "Nina_R", "Tariq_M"];

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function ok(label, { data, error, count }) {
  if (error) {
    console.error(`ÉCHEC — ${label} :`, error.message);
    process.exit(1);
  }
  const n = count ?? (Array.isArray(data) ? data.length : undefined);
  console.log(`OK — ${label}${n !== undefined ? ` (${n} ligne(s))` : ""}`);
  return data;
}

async function deleteScoped(table, column, value) {
  if (DRY_RUN) {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(column, value);
    ok(`[dry-run] ${table} where ${column}=${value}`, { data: [], error, count: count ?? 0 });
    return;
  }
  const { error, count } = await supabase.from(table).delete({ count: "exact" }).eq(column, value);
  ok(`DELETE ${table} where ${column}=${value}`, { data: [], error, count: count ?? 0 });
}

async function main() {
  console.log(DRY_RUN ? "=== DRY-RUN (rien ne sera supprimé — relancer avec --confirm) ===" : "=== SUPPRESSION RÉELLE ===");

  // ── 1. Compétitions de test présentes en base ─────────────────────────
  const competitions = ok("lecture des compétitions de test", await supabase
    .from("competitions")
    .select("id, name")
    .in("name", TEST_COMPETITION_NAMES));

  if (!competitions || competitions.length === 0) {
    console.log("Aucune compétition de test trouvée (déjà nettoyé, ou noms différents).");
  }

  for (const competition of competitions ?? []) {
    console.log(`\n--- Compétition « ${competition.name} » (${competition.id}) ---`);

    // Casse la FK circulaire AVANT de toucher à correction_requests.
    if (!DRY_RUN) {
      ok(
        "correction_request_id -> NULL sur match_predictions",
        await supabase.from("match_predictions").update({ correction_request_id: null }).eq("competition_id", competition.id)
      );
      ok(
        "correction_request_id -> NULL sur bets",
        await supabase.from("bets").update({ correction_request_id: null }).eq("competition_id", competition.id)
      );
    } else {
      console.log("[dry-run] correction_request_id -> NULL sur match_predictions/bets (préparatoire, pas de suppression)");
    }

    // Requêtes de correction des joueurs de test (requester_user_id est
    // toujours un compte de seed dans ce jeu de données — pas de colonne
    // competition_id directe sur correction_requests).
    const seedUsers = ok(
      "lecture des comptes de seed (pour filtrer les correction_requests)",
      await supabase.from("users").select("id, pseudo").in("pseudo", SEED_PSEUDOS)
    );
    const seedUserIds = (seedUsers ?? []).map((u) => u.id);
    if (seedUserIds.length > 0) {
      if (DRY_RUN) {
        const { count, error } = await supabase
          .from("correction_requests")
          .select("id", { count: "exact", head: true })
          .in("requester_user_id", seedUserIds);
        ok("[dry-run] correction_requests des comptes de seed", { data: [], error, count: count ?? 0 });
      } else {
        ok(
          "DELETE correction_requests des comptes de seed",
          await supabase.from("correction_requests").delete({ count: "exact" }).in("requester_user_id", seedUserIds)
        );
      }
    }

    await deleteScoped("bets", "competition_id", competition.id);
    await deleteScoped("match_predictions", "competition_id", competition.id);
    await deleteScoped("bracket_picks", "competition_id", competition.id);
    await deleteScoped("brackets", "competition_id", competition.id);

    // entity_mappings des matchs/séries de CETTE compétition (pas de FK
    // réelle vers matches/series — nettoyage défensif, jamais bloquant).
    const matchIds = ok(
      "lecture des matchs (pour entity_mappings)",
      await supabase.from("matches").select("id").eq("competition_id", competition.id)
    );
    const seriesIds = ok(
      "lecture des séries (pour entity_mappings)",
      await supabase.from("series").select("id").eq("competition_id", competition.id)
    );
    const internalIds = [...(matchIds ?? []).map((r) => r.id), ...(seriesIds ?? []).map((r) => r.id)];
    if (internalIds.length > 0) {
      if (DRY_RUN) {
        const { count, error } = await supabase
          .from("entity_mappings")
          .select("id", { count: "exact", head: true })
          .in("internal_id", internalIds);
        ok("[dry-run] entity_mappings des matchs/séries", { data: [], error, count: count ?? 0 });
      } else {
        ok(
          "DELETE entity_mappings des matchs/séries",
          await supabase.from("entity_mappings").delete({ count: "exact" }).in("internal_id", internalIds)
        );
      }
    }

    await deleteScoped("matches", "competition_id", competition.id);
    await deleteScoped("series", "competition_id", competition.id);
    await deleteScoped("sync_logs", "competition_id", competition.id);
    await deleteScoped("competition_archives", "competition_id", competition.id);

    // La compétition elle-même EN DERNIER (cascade automatique vers
    // competition_secrets, ON DELETE CASCADE — migration #2/#3).
    if (DRY_RUN) {
      console.log(`[dry-run] DELETE competitions where id=${competition.id} (« ${competition.name} »)`);
    } else {
      ok(`DELETE competitions « ${competition.name} »`, await supabase.from("competitions").delete().eq("id", competition.id));
    }
  }

  // ── 2. Comptes de seed (auth.admin.deleteUser, cascade vers public.users) ──
  console.log("\n--- Comptes de seed ---");
  const users = ok(
    "lecture des comptes de seed",
    await supabase.from("users").select("id, pseudo").in("pseudo", SEED_PSEUDOS)
  );

  if (!users || users.length === 0) {
    console.log("Aucun compte de seed trouvé (déjà nettoyé, ou pseudos différents).");
    return;
  }

  // Audit trail des actions FAITES PAR un compte de seed (ex. Sofia_Admin) —
  // sinon la suppression de l'utilisateur échouerait sur la FK actor_user_id.
  // Les entrées où un compte de seed est seulement la CIBLE (target_id, sans
  // FK réelle) restent en base, intactes.
  const userIds = users.map((u) => u.id);
  if (DRY_RUN) {
    const { count, error } = await supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .in("actor_user_id", userIds);
    ok("[dry-run] audit_logs des comptes de seed (en tant qu'auteur)", { data: [], error, count: count ?? 0 });
  } else {
    ok(
      "DELETE audit_logs des comptes de seed (en tant qu'auteur)",
      await supabase.from("audit_logs").delete({ count: "exact" }).in("actor_user_id", userIds)
    );
  }

  for (const user of users) {
    if (DRY_RUN) {
      console.log(`[dry-run] auth.admin.deleteUser(${user.id})  — pseudo ${user.pseudo}`);
      continue;
    }
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) {
      console.error(`ÉCHEC — suppression du compte ${user.pseudo} :`, error.message);
      process.exit(1);
    }
    console.log(`OK — compte supprimé : ${user.pseudo}`);
  }

  console.log(DRY_RUN ? "\nDry-run terminé — relancer avec --confirm pour exécuter." : "\nNettoyage terminé.");
}

main();
