import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { sendPushToSubscriptions, type PushPayload, type PushSubscriptionRow } from "@/lib/push/send";

// Push à tous les admins ACTIVE (popup hebdo : brouillon prêt ou bloqué).
// Ne lève jamais : une alerte ratée ne doit pas faire échouer une génération.
// `recap_enabled` est ignoré : c'est une alerte d'administration, pas un récap.

export async function sendPushToAdmins(
  payload: PushPayload,
  options: { ttlSeconds?: number } = {},
): Promise<{ admins: number; subscriptions: number; dead: number }> {
  const result = { admins: 0, subscriptions: 0, dead: 0 };
  try {
    const supabase = getServiceClient();
    const { data: admins, error: adminsError } = await supabase
      .from("users")
      .select("id")
      .eq("role", "ADMIN")
      .eq("status", "ACTIVE");
    if (adminsError) throw new Error(adminsError.message);
    const adminIds = (admins ?? []).map((r) => r.id as string);
    result.admins = adminIds.length;
    if (adminIds.length === 0) return result;

    const { data: subsData, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh_key, auth_key")
      .in("user_id", adminIds);
    if (subsError) throw new Error(subsError.message);
    const subscriptions = (subsData ?? []) as PushSubscriptionRow[];
    result.subscriptions = subscriptions.length;
    if (subscriptions.length === 0) return result;

    const { deadSubscriptionIds } = await sendPushToSubscriptions(subscriptions, payload, options);
    result.dead = deadSubscriptionIds.length;
    if (deadSubscriptionIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", deadSubscriptionIds);
    }
  } catch (error) {
    console.error("sendPushToAdmins : échec non bloquant", error instanceof Error ? error.name : "Error");
  }
  return result;
}
