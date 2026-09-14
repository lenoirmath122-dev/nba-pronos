"use server";

import { cookies } from "next/headers";
import { getServerClient } from "@/lib/supabase/server";
import { generateRecoveryCodes, hashRecoveryCode } from "@/lib/auth/mfa";
import { toClientError } from "@/lib/actions/errors";

// 2FA admin obligatoire (p2-8, feuille de route Phase 2) — l'enrôlement/la
// vérification TOTP et l'AAL de session sont gérés par Supabase Auth
// (auth.mfa.*, natif), cette couche ne fait que : (1) générer/stocker les
// codes de récupération (plan de secours choisi avec l'utilisateur, cf.
// migration 20260914110000) et (2) exposer la liste des sessions actives.
// La garde d'accès elle-même vit dans app/(admin)/admin/layout.tsx.

export type MfaActionResult<T = undefined> =
  | ({ success: true } & (T extends undefined ? object : { data: T }))
  | { success: false; error: string };

const RECOVERY_COOKIE = "admin_recovery_session";

export async function startMfaEnrollment(): Promise<
  MfaActionResult<{ factorId: string; qrCode: string; secret: string }>
> {
  const supabase = await getServerClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Réservé aux admins." };

  // Nettoie tout facteur TOTP jamais vérifié d'un essai précédent (page
  // rechargée avant de saisir le code, double-montage React StrictMode en
  // dev...) -- sinon enroll() échoue avec "A factor with the friendly name
  // ... already exists" (Supabase refuse 2 facteurs du même nom pour un
  // utilisateur, même non vérifiés).
  const { data: existingFactors } = await supabase.auth.mfa.listFactors();
  const stale = existingFactors?.all.filter((f) => f.factor_type === "totp" && f.status === "unverified") ?? [];
  for (const factor of stale) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error || !data) {
    return { success: false, error: toClientError("startMfaEnrollment", error ?? { message: "no data" }) };
  }

  return {
    success: true,
    data: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret },
  };
}

// Vérifie le code TOTP saisi et active le facteur (challengeAndVerify fait
// les deux étapes en une seule requête) — puis génère la 1ère série de codes
// de récupération, montrée UNE SEULE FOIS à l'écran juste après (jamais
// relisible depuis la base, seul le hash y est stocké).
export async function confirmMfaEnrollment(
  factorId: string,
  code: string
): Promise<MfaActionResult<{ recoveryCodes: string[] }>> {
  const supabase = await getServerClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Réservé aux admins." };

  const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (verifyError) {
    return { success: false, error: "Code invalide. Vérifie l'heure de ton téléphone et réessaie." };
  }

  const { codes, hashes } = generateRecoveryCodes();
  const { error: rpcError } = await supabase.rpc("regenerate_admin_recovery_codes", { p_code_hashes: hashes });
  if (rpcError) {
    return { success: false, error: toClientError("confirmMfaEnrollment", rpcError) };
  }

  return { success: true, data: { recoveryCodes: codes } };
}

// Régénère les codes de récupération à la demande (écran /admin/security,
// atteignable seulement une fois déjà passé par la 2FA — invalide tous les
// anciens codes, y compris non utilisés).
export async function regenerateRecoveryCodes(): Promise<MfaActionResult<{ recoveryCodes: string[] }>> {
  const supabase = await getServerClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Réservé aux admins." };

  const { codes, hashes } = generateRecoveryCodes();
  const { error } = await supabase.rpc("regenerate_admin_recovery_codes", { p_code_hashes: hashes });
  if (error) return { success: false, error: toClientError("regenerateRecoveryCodes", error) };

  return { success: true, data: { recoveryCodes: codes } };
}

// Étape de connexion (/mfa-challenge) — le facteur est déjà enrôlé, on
// cherche son id nous-mêmes plutôt que de faire confiance à une valeur
// venue du client.
export async function verifyMfaChallenge(code: string): Promise<MfaActionResult> {
  const supabase = await getServerClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Réservé aux admins." };

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verifiedTotp = factors?.all.find((f) => f.factor_type === "totp" && f.status === "verified");
  if (!verifiedTotp) return { success: false, error: "Aucune 2FA activée sur ce compte." };

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: verifiedTotp.id, code });
  if (error) return { success: false, error: "Code invalide." };

  return { success: true };
}

// Repli sans TOTP (téléphone perdu/cassé) — l'AAL Supabase reste aal1 ici
// (impossible de la faire monter sans challengeAndVerify), donc on pose une
// session de secours à part (voir consume_admin_recovery_code, migration
// 20260914110000) que admin/layout.tsx accepte en plus de l'AAL.
export async function verifyRecoveryCode(code: string): Promise<MfaActionResult> {
  const supabase = await getServerClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Réservé aux admins." };

  const { data: sessionId, error } = await supabase.rpc("consume_admin_recovery_code", {
    p_code_hash: hashRecoveryCode(code),
  });
  if (error || !sessionId) return { success: false, error: "Code de récupération invalide ou déjà utilisé." };

  const cookieStore = await cookies();
  cookieStore.set(RECOVERY_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 60,
    path: "/",
  });

  return { success: true };
}

export type AdminSession = { id: string; createdAt: string; updatedAt: string; userAgent: string | null };

export async function listMySessions(): Promise<MfaActionResult<AdminSession[]>> {
  const supabase = await getServerClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Réservé aux admins." };

  const { data, error } = await supabase.rpc("list_admin_sessions");
  if (error) return { success: false, error: toClientError("listMySessions", error) };

  const rows = (data ?? []) as { id: string; created_at: string; updated_at: string; user_agent: string | null }[];
  return {
    success: true,
    data: rows.map((r) => ({ id: r.id, createdAt: r.created_at, updatedAt: r.updated_at, userAgent: r.user_agent })),
  };
}

export async function signOutOtherSessions(): Promise<MfaActionResult> {
  const supabase = await getServerClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Réservé aux admins." };

  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return { success: false, error: toClientError("signOutOtherSessions", error) };

  return { success: true };
}
