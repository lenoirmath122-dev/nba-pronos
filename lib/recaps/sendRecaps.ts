import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { sendPushToSubscriptions, type PushSubscriptionRow } from "@/lib/push/send";
import { parisDateKey } from "@/lib/dates/paris";
import { canReceiveRecap } from "./access";
import { personalRecap } from "./build";
import { loadCompetitionRecap, loadUpcomingMatches } from "./load";
import { dailyPeriod, recapBoundaryIso, recapKindFor, weeklyPeriod } from "./period";
import { dailyPushText, weeklyPushText, type PushText } from "./text";
import { getTrashTalkArticles } from "./trashtalkFeed";

// Envoi des récaps du matin (p3-10), appelé par /api/recaps (cron GitHub
// Actions à 8h et 9h UTC). Ne fait rien avant 10h Paris : en hiver le passage
// de 8h UTC tombe à 9h Paris et s'arrête là, celui de 9h UTC envoie ; en été
// le premier envoie et le second ne retrouve que des joueurs déjà servis
// (recap_log). Au-delà de 3h de retard (cron GitHub très en retard), on
// renonce plutôt que d'envoyer un « récap du matin » l'après-midi.
const MAX_DELAY_MS = 3 * 60 * 60 * 1000;

export type RecapRunResult = {
  skipped?: string;
  kind?: string;
  notified: number;
  candidates: number;
};

export async function runRecaps(nowMs: number = Date.now(), options: { force?: boolean } = {}): Promise<RecapRunResult> {
  const recapDate = parisDateKey(nowMs);
  const boundaryMs = Date.parse(recapBoundaryIso(recapDate));
  if (!options.force) {
    if (nowMs < boundaryMs) return { skipped: "avant 10h (Paris)", notified: 0, candidates: 0 };
    if (nowMs > boundaryMs + MAX_DELAY_MS) return { skipped: "trop tard dans la journée", notified: 0, candidates: 0 };
  }

  const supabase = getServiceClient();
  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("status", "ACTIVE")
    .maybeSingle<{ id: string }>();
  if (!competition) return { skipped: "aucune compétition active", notified: 0, candidates: 0 };

  const kind = recapKindFor(recapDate);

  const { data: usersData } = await supabase
    .from("users")
    .select("id")
    .eq("status", "ACTIVE")
    .eq("notification_preference", "PUSH")
    .eq("recap_enabled", true);
  const { data: alreadySent } = await supabase
    .from("recap_log")
    .select("user_id")
    .eq("kind", kind)
    .eq("recap_date", recapDate);
  const sent = new Set((alreadySent ?? []).map((row) => row.user_id as string));
  const candidates = ((usersData ?? []) as { id: string }[])
    .map((row) => row.id)
    .filter((userId) => !sent.has(userId) && canReceiveRecap(userId, kind));
  if (candidates.length === 0) return { kind, notified: 0, candidates: 0 };

  const period = kind === "WEEKLY" ? weeklyPeriod(recapDate) : { ...dailyPeriod(nowMs), endIso: new Date(boundaryMs).toISOString(), inProgress: false };
  const [recap, upcoming, { data: subscriptionsData }] = await Promise.all([
    loadCompetitionRecap(supabase, competition.id, period, getTrashTalkArticles),
    loadUpcomingMatches(supabase, competition.id, nowMs),
    supabase.from("push_subscriptions").select("id, user_id, endpoint, p256dh_key, auth_key").in("user_id", candidates),
  ]);

  const subscriptionsByUser = new Map<string, PushSubscriptionRow[]>();
  for (const row of subscriptionsData ?? []) {
    const list = subscriptionsByUser.get(row.user_id) ?? [];
    list.push(row);
    subscriptionsByUser.set(row.user_id, list);
  }

  const deadSubscriptionIds = new Set<string>();
  let notified = 0;

  for (const userId of candidates) {
    const subscriptions = subscriptionsByUser.get(userId) ?? [];
    if (subscriptions.length === 0) continue;

    const me = personalRecap(recap, userId);
    let text: PushText | null;
    if (kind === "WEEKLY") {
      text = weeklyPushText(recap, me, userId);
    } else {
      const predicted = upcoming.predictedByUser.get(userId) ?? new Set<string>();
      const remaining = upcoming.matches.filter((match) => !predicted.has(match.id));
      text = dailyPushText(me, {
        matchesToPredict: remaining.length,
        firstKickoffIso: remaining[0]?.scheduledAt ?? null,
      });
    }
    if (!text) continue;

    const { deadSubscriptionIds: dead } = await sendPushToSubscriptions(
      subscriptions,
      { ...text, url: "/home#recap" },
      // Un récap du matin n'a plus d'intérêt le soir.
      { ttlSeconds: 12 * 60 * 60 }
    );
    dead.forEach((id) => deadSubscriptionIds.add(id));

    await supabase.from("recap_log").insert({ user_id: userId, kind, recap_date: recapDate });
    notified += 1;
  }

  if (deadSubscriptionIds.size > 0) {
    await supabase.from("push_subscriptions").delete().in("id", [...deadSubscriptionIds]);
  }

  return { kind, notified, candidates: candidates.length };
}
