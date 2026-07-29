import { getServiceClient } from "@/lib/supabase/service";
import { sendPushToSubscriptions, type PushSubscriptionRow } from "@/lib/push/send";

// Rappel "la deadline du bracket approche" (backlog "Rappels ciblés",
// PRIORITÉ). Fenêtre de déclenchement (choix d'implémentation, non fixé par
// le backlog) : 24h avant `bracket_deadline` — assez tôt pour agir, jamais
// répété (dédoublonné par compétition, pas par heure de passage du
// planificateur).
const WINDOW_HOURS = 24;

type CompetitionRow = {
  id: string;
  type: "PLAYOFFS" | "NBA_CUP";
  bracket_deadline: string;
};

export async function runBracketReminder(): Promise<{ notified: number }> {
  const supabase = getServiceClient();

  const now = Date.now();
  const windowEnd = new Date(now + WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { data: competitionsData } = await supabase
    .from("competitions")
    .select("id, type, bracket_deadline")
    .eq("status", "ACTIVE")
    .not("bracket_deadline", "is", null)
    .gt("bracket_deadline", new Date(now).toISOString())
    .lte("bracket_deadline", windowEnd);

  const competitions = (competitionsData ?? []) as CompetitionRow[];
  if (competitions.length === 0) return { notified: 0 };

  const { data: activeUsersData } = await supabase
    .from("users")
    .select("id")
    .eq("status", "ACTIVE")
    .eq("notification_preference", "PUSH");
  const pushUsers = (activeUsersData ?? []) as { id: string }[];
  if (pushUsers.length === 0) return { notified: 0 };

  let notified = 0;
  const deadSubscriptionIds = new Set<string>();

  for (const competition of competitions) {
    const { data: seriesData } = await supabase.from("series").select("id").eq("competition_id", competition.id);
    const totalSlots = seriesData?.length ?? 0;
    if (totalSlots === 0) continue; // structure pas encore connue (Cup avant qualification, même garde que getBracketTodo)

    const { data: bracketsData } = await supabase
      .from("brackets")
      .select("id, user_id")
      .eq("competition_id", competition.id);
    const bracketIdByUser = new Map((bracketsData ?? []).map((b) => [b.user_id as string, b.id as string]));

    const { data: picksData } = await supabase
      .from("bracket_picks")
      .select("bracket_id, predicted_winner_team_id, predicted_score_format")
      .eq("competition_id", competition.id);
    const completedByBracket = new Map<string, number>();
    for (const pick of picksData ?? []) {
      const isComplete =
        competition.type === "PLAYOFFS"
          ? pick.predicted_winner_team_id !== null && pick.predicted_score_format !== null
          : pick.predicted_winner_team_id !== null;
      if (!isComplete) continue;
      completedByBracket.set(pick.bracket_id, (completedByBracket.get(pick.bracket_id) ?? 0) + 1);
    }

    const { data: alreadySentData } = await supabase
      .from("reminder_log")
      .select("user_id")
      .eq("kind", "BRACKET_DEADLINE")
      .eq("ref_id", competition.id);
    const alreadySent = new Set((alreadySentData ?? []).map((r) => r.user_id as string));

    const usersToNotify = pushUsers.filter((user) => {
      if (alreadySent.has(user.id)) return false;
      const bracketId = bracketIdByUser.get(user.id);
      const completed = bracketId ? (completedByBracket.get(bracketId) ?? 0) : 0;
      return completed < totalSlots;
    });
    if (usersToNotify.length === 0) continue;

    const userIds = usersToNotify.map((u) => u.id);
    const { data: subscriptionsData } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh_key, auth_key")
      .in("user_id", userIds);
    const subscriptionsByUser = new Map<string, PushSubscriptionRow[]>();
    for (const row of subscriptionsData ?? []) {
      const list = subscriptionsByUser.get(row.user_id) ?? [];
      list.push(row);
      subscriptionsByUser.set(row.user_id, list);
    }

    for (const user of usersToNotify) {
      const subscriptions = subscriptionsByUser.get(user.id) ?? [];
      if (subscriptions.length === 0) continue;

      const { deadSubscriptionIds: dead } = await sendPushToSubscriptions(subscriptions, {
        title: "Deadline du bracket",
        body: "Ton bracket n'est pas encore complet et la deadline approche.",
        url: "/play/bracket",
      });
      dead.forEach((id) => deadSubscriptionIds.add(id));

      await supabase
        .from("reminder_log")
        .insert({ user_id: user.id, kind: "BRACKET_DEADLINE", ref_id: competition.id });
      notified += 1;
    }
  }

  if (deadSubscriptionIds.size > 0) {
    await supabase.from("push_subscriptions").delete().in("id", [...deadSubscriptionIds]);
  }

  return { notified };
}
