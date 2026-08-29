"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";
import { toClientError } from "@/lib/actions/errors";

// Server actions du réglage "Rappels" (Profil, backlog "Rappels ciblés").
// Contrairement aux autres actions de lib/actions/profile.ts (formulaires
// natifs SANS JS, redirection), celles-ci sont appelées PROGRAMMATIQUEMENT
// depuis components/profile/NotificationSettings.tsx ("use client") — la
// permission navigateur + l'abonnement Push doivent se faire côté client
// AVANT l'écriture serveur, donc un simple <form action> ne suffit pas ici.
// Retournent un résultat typé (jamais de redirect) pour un retour inline.

type ActionResult = { success: true } | { success: false; error: string };

export async function updateNotificationPreference(
  preference: "NONE" | "PUSH" | "EMAIL"
): Promise<ActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Session expirée." };

  const { error } = await supabase
    .from("users")
    .update({ notification_preference: preference })
    .eq("id", user.id);

  if (error) return { success: false, error: toClientError("updateNotificationPreference", error) };

  revalidatePath("/profile");
  return { success: true };
}

type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function savePushSubscription(subscription: PushSubscriptionInput): Promise<ActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Session expirée." };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh_key: subscription.keys.p256dh,
      auth_key: subscription.keys.auth,
    },
    { onConflict: "user_id,endpoint" }
  );

  if (error) return { success: false, error: toClientError("savePushSubscription", error) };
  return { success: true };
}

export async function deletePushSubscription(endpoint: string): Promise<ActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Session expirée." };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) return { success: false, error: toClientError("deletePushSubscription", error) };
  return { success: true };
}
