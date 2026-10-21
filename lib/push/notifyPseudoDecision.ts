import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { sendPushToSubscriptions, type PushSubscriptionRow } from "@/lib/push/send";

// Prévient un joueur que sa demande de changement de pseudo a été traitée.
// Même contrat que notifyNewChatMessage : ne lève jamais, une notif ratée
// n'annule pas la décision (déjà posée en base). Le joueur voit de toute
// façon le résultat sur son profil.

export async function notifyPseudoDecision(input: {
  userId: string;
  approved: boolean;
  newPseudo: string;
}): Promise<void> {
  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh_key, auth_key")
      .eq("user_id", input.userId);
    const subscriptions = (data ?? []) as PushSubscriptionRow[];
    if (subscriptions.length === 0) return;

    const { deadSubscriptionIds } = await sendPushToSubscriptions(subscriptions, {
      title: input.approved ? "Pseudo changé" : "Demande de pseudo refusée",
      body: input.approved
        ? `Tu t'appelles désormais « ${input.newPseudo} ».`
        : `Ta demande pour « ${input.newPseudo} » a été refusée.`,
      url: "/profile/pseudo",
    });
    if (deadSubscriptionIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", deadSubscriptionIds);
    }
  } catch (error) {
    console.error("notifyPseudoDecision: échec non bloquant", error);
  }
}
