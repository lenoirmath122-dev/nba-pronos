import { getServerClient } from "@/lib/supabase/server";

// Lecture des demandes de changement de pseudo (migration 20261014090000).
// RLS pcr_select_own_or_admin : un joueur ne voit que les siennes, un admin
// toutes.

export type PseudoRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type MyPseudoRequest = {
  status: PseudoRequestStatus;
  requestedPseudo: string;
  rejectReason: string | null;
  createdAt: string;
  decidedAt: string | null;
};

export type PendingPseudoRequest = {
  requestId: string;
  userId: string;
  oldPseudo: string;
  requestedPseudo: string;
  createdAt: string;
};

/** Dernière demande du joueur (toutes issues confondues), ou null. */
export async function getMyLatestPseudoRequest(userId: string): Promise<MyPseudoRequest | null> {
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("pseudo_change_requests")
    .select("status, requested_pseudo, reject_reason, created_at, decided_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      status: PseudoRequestStatus;
      requested_pseudo: string;
      reject_reason: string | null;
      created_at: string;
      decided_at: string | null;
    }>();
  if (!data) return null;
  return {
    status: data.status,
    requestedPseudo: data.requested_pseudo,
    rejectReason: data.reject_reason,
    createdAt: data.created_at,
    decidedAt: data.decided_at,
  };
}

export async function getPendingPseudoRequests(): Promise<PendingPseudoRequest[]> {
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("pseudo_change_requests")
    .select("id, user_id, old_pseudo, requested_pseudo, created_at")
    .eq("status", "PENDING")
    .order("created_at", { ascending: true })
    .limit(200);
  return (data ?? []).map((r) => ({
    requestId: r.id as string,
    userId: r.user_id as string,
    oldPseudo: r.old_pseudo as string,
    requestedPseudo: r.requested_pseudo as string,
    createdAt: r.created_at as string,
  }));
}
