#!/usr/bin/env node
// ============================================================================
// SUPPRESSION — compte joueur + données personnelles associées
// ============================================================================
// Fichier  : scripts/delete-player-account.mjs
// Usage    : node --env-file=.env.local scripts/delete-player-account.mjs <pseudo>              (dry-run, ne supprime rien)
//            node --env-file=.env.local scripts/delete-player-account.mjs <pseudo> --confirm     (exécute réellement)
// Motif    : audit de sécurité, finding 15 (security-audit-report.md §9) --
//            aucune procédure de rétention/effacement RGPD n'existait pour un
//            compte joueur. Généralise scripts/cleanup-test-data.mjs (même
//            patron : service_role, dry-run par défaut, ordre de suppression
//            qui respecte les FK du schéma) à UN joueur quelconque désigné
//            par son pseudo, plutôt qu'une liste de pseudos de seed en dur.
//
// SÉCURITÉ : service_role (contourne la RLS). DRY-RUN PAR DÉFAUT.
//
// GARDE-FOUS EXPLICITES (refuse de continuer plutôt que de deviner) :
//   - cible role=ADMIN : jamais purgée par ce script (perte d'historique
//     d'audit disproportionnée pour un cas qui doit rester une décision
//     humaine explicite -- rétrograder en PLAYER d'abord si c'est bien voulu).
//   - cible a créé une ligue qui a D'AUTRES membres : refuse (supprimer la
//     ligue les expulserait tous sans qu'ils l'aient demandé -- à traiter
//     à la main : transférer la ligue ou prévenir les membres avant).
//
// ORDRE DE SUPPRESSION (respecte les FK du schéma T1/#15/#16/#18/#33, pas de
// cascade sauf push_subscriptions/reminder_log/chat_muted_channels/
// public.users -- voir 20260718090000_initial_schema.sql et les migrations
// listées dans TABLES ci-dessous) : feuilles vers racines, compte en tout
// dernier (auth.admin.deleteUser cascade vers public.users ET les 3 tables
// à cascade automatique).
// ============================================================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être chargées " +
      "(lancer avec : node --env-file=.env.local scripts/delete-player-account.mjs <pseudo>)"
  );
}

const DRY_RUN = !process.argv.includes("--confirm");
const pseudo = process.argv[2];

if (!pseudo || pseudo === "--confirm") {
  throw new Error("Usage : node scripts/delete-player-account.mjs <pseudo> [--confirm]");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function ok(label, { data, error, count }) {
  if (error) {
    console.error(`ÉCHEC — ${label} :`, error.message);
    process.exitCode = 1;
    throw new Error("abandonné");
  }
  const n = count ?? (Array.isArray(data) ? data.length : undefined);
  console.log(`OK — ${label}${n !== undefined ? ` (${n} ligne(s))` : ""}`);
  return data;
}

// Ordre = feuilles vers racines. `admin` = colonnes de référence admin à
// NULLIFIER plutôt que supprimer (des lignes appartenant à D'AUTRES joueurs,
// où la cible a seulement agi en tant qu'admin) -- jamais de suppression en
// cascade sur les données d'un autre joueur.
const OWNED_TABLES = [
  { table: "correction_requests", column: "requester_user_id" }, // migration T1 §13
  { table: "bets", column: "user_id" },                          // migration T1 §12
  { table: "match_predictions", column: "user_id" },             // migration T1 §11
  { table: "bracket_picks", column: null },                      // via bracket_id, cf. ci-dessous
  { table: "brackets", column: "user_id" },                      // migration T1 §9
  { table: "chat_messages", column: "user_id" },                 // migration #27/08
  { table: "bug_reports", column: "user_id" },                   // migration #33
  { table: "league_memberships", column: "user_id" },            // migration #16
  { table: "leaderboard_snapshots", column: "user_id" },         // migration #18
  { table: "competition_superlatives", column: "user_id" },      // migration #18
  { table: "competition_archives", column: "user_id" },          // migration T1 §16 (snapshot historique, purgé quand même -- RGPD prime)
  { table: "audit_logs", column: "actor_user_id" },               // migration T1 §14 (la cible en tant qu'auteur)
];

const ADMIN_REFERENCE_COLUMNS = [
  { table: "bets", columns: ["validated_by_admin_id", "resolved_by_admin_id", "corrected_by_admin_id"] },
  { table: "match_predictions", columns: ["corrected_by_admin_id"] },
  { table: "bug_reports", columns: ["resolved_by_admin_id"] },
  { table: "correction_requests", columns: ["handled_by_admin_id"] },
  { table: "entity_mappings", columns: ["confirmed_by_admin_id"] },
];

async function main() {
  console.log(DRY_RUN ? "=== DRY-RUN (rien ne sera supprimé — relancer avec --confirm) ===" : "=== SUPPRESSION RÉELLE ===");

  const user = ok(
    `lecture du compte « ${pseudo} »`,
    await supabase.from("users").select("id, pseudo, role").eq("pseudo", pseudo).maybeSingle()
  );
  if (!user) {
    console.log(`Aucun compte avec le pseudo « ${pseudo} ».`);
    return;
  }

  // ── Garde-fous ────────────────────────────────────────────────────────────
  if (user.role === "ADMIN") {
    console.error(`REFUS — « ${pseudo} » est ADMIN. Rétrograde-le en PLAYER d'abord si la suppression est bien voulue.`);
    process.exitCode = 1;
    return;
  }

  const createdLeagues = ok(
    "vérification des ligues créées par ce compte",
    await supabase.from("leagues").select("id, name").eq("created_by_user_id", user.id)
  );
  for (const league of createdLeagues ?? []) {
    const { count, error } = await supabase
      .from("league_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("league_id", league.id)
      .neq("user_id", user.id);
    if (error) {
      console.error(`ÉCHEC — vérification des membres de « ${league.name} » :`, error.message);
      process.exitCode = 1;
      return;
    }
    if ((count ?? 0) > 0) {
      console.error(
        `REFUS — « ${pseudo} » a créé la ligue « ${league.name} » qui a ${count} autre(s) membre(s). ` +
          "Transfère-la ou préviens les membres avant de continuer."
      );
      process.exitCode = 1;
      return;
    }
  }
  console.log(`OK — aucun garde-fou déclenché pour « ${pseudo} » (id ${user.id}).`);

  // ── Nullification des références admin (jamais de suppression de données appartenant à d'autres) ──
  for (const { table, columns } of ADMIN_REFERENCE_COLUMNS) {
    for (const column of columns) {
      if (DRY_RUN) {
        const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true }).eq(column, user.id);
        ok(`[dry-run] ${table}.${column} -> NULL`, { data: [], error, count: count ?? 0 });
      } else {
        ok(`${table}.${column} -> NULL`, await supabase.from(table).update({ [column]: null }).eq(column, user.id));
      }
    }
  }

  // ── bracket_picks : pas de user_id direct, purgé via les brackets de la cible ──
  const brackets = ok("lecture des brackets de la cible", await supabase.from("brackets").select("id").eq("user_id", user.id));
  const bracketIds = (brackets ?? []).map((b) => b.id);
  if (bracketIds.length > 0) {
    if (DRY_RUN) {
      const { count, error } = await supabase.from("bracket_picks").select("*", { count: "exact", head: true }).in("bracket_id", bracketIds);
      ok("[dry-run] bracket_picks des brackets de la cible", { data: [], error, count: count ?? 0 });
    } else {
      ok("DELETE bracket_picks des brackets de la cible", await supabase.from("bracket_picks").delete({ count: "exact" }).in("bracket_id", bracketIds));
    }
  }

  // ── Casse la FK circulaire bets/match_predictions <-> correction_requests avant de purger cette dernière ──
  if (!DRY_RUN) {
    ok(
      "correction_request_id -> NULL sur match_predictions (comme requérant)",
      await supabase.from("match_predictions").update({ correction_request_id: null }).eq("user_id", user.id)
    );
    ok(
      "correction_request_id -> NULL sur bets (comme requérant)",
      await supabase.from("bets").update({ correction_request_id: null }).eq("user_id", user.id)
    );
  } else {
    console.log("[dry-run] correction_request_id -> NULL sur match_predictions/bets (préparatoire)");
  }

  // ── Tables possédées, feuilles vers racines ──────────────────────────────
  for (const { table, column } of OWNED_TABLES) {
    if (column === null) continue; // bracket_picks, déjà traité ci-dessus
    if (DRY_RUN) {
      const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true }).eq(column, user.id);
      ok(`[dry-run] ${table} where ${column}=${user.id}`, { data: [], error, count: count ?? 0 });
    } else {
      ok(`DELETE ${table} where ${column}=${user.id}`, await supabase.from(table).delete({ count: "exact" }).eq(column, user.id));
    }
  }

  // ── Compte auth (cascade vers public.users, push_subscriptions, reminder_log, chat_muted_channels) ──
  if (DRY_RUN) {
    console.log(`[dry-run] auth.admin.deleteUser(${user.id}) — pseudo ${pseudo} (cascade : public.users, push_subscriptions, reminder_log, chat_muted_channels)`);
    console.log("\nDry-run terminé — relancer avec --confirm pour exécuter.");
    return;
  }
  const { error } = await supabase.auth.admin.deleteUser(user.id);
  if (error) {
    console.error(`ÉCHEC — suppression du compte ${pseudo} :`, error.message);
    process.exitCode = 1;
    return;
  }
  console.log(`OK — compte supprimé : ${pseudo}`);
  console.log("\nSuppression terminée.");
}

main().catch(() => {}); // erreur déjà journalisée par ok()/console.error ci-dessus, exitCode déjà positionné
