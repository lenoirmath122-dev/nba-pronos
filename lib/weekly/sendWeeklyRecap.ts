import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { sendPushToSubscriptions, type PushSubscriptionRow } from "@/lib/push/send";
import { canReceiveRecap } from "@/lib/recaps/access";
import { weeklyChampionPushText } from "@/lib/recaps/text";
import {
  computeWeeklyStandings,
  weekEndFor,
  type WeeklySnapshotRow,
  type WeeklyStanding,
} from "./standings";

// Envoi MANUEL du récap hebdo (classement hebdo, lot 3), déclenché par le
// bouton admin « Envoyer le récap hebdo ». Envoie la dernière semaine close,
// déjà figée (jamais recalculée : champion lu dans `weekly_champions`, points
// perso recalculés sur les deux snapshots de l'en-tête `weekly_rankings`).
//
// Idempotence sans migration : `recap_log` (unique user_id + kind +
// recap_date) avec kind WEEKLY et recap_date = lundi de fin de semaine. Chaque
// joueur est RÉSERVÉ avant l'envoi : double clic ou deux admins ne produisent
// jamais deux push, et une relance après échec partiel reprend les restants.
// Contrepartie assumée (au plus une fois) : une erreur entre la réservation et
// le push prive ce joueur de son récap.

export type WeeklySendResult = {
  sent: boolean;
  weekEnd?: string;
  /** Joueurs notifiés par cet appel. */
  notified: number;
  /** Joueurs éligibles déjà servis (envoi précédent). */
  alreadySent: number;
  /** Joueurs éligibles sans abonnement push (non réservés : servis à une relance). */
  noSubscription: number;
  candidates: number;
  skipped?: "aucune compétition active" | "classement hebdo désactivé" | "semaine non figée";
};

const RECAP_URL = "/leaderboard?vue=semaine";
// Un récap hebdo garde son intérêt toute la journée.
const TTL_SECONDS = 24 * 60 * 60;

function fail(context: string, error: { message: string }): never {
  throw new Error(`${context} : ${error.message}`);
}

export async function runWeeklyRecapSend(nowMs: number = Date.now()): Promise<WeeklySendResult> {
  const weekEnd = weekEndFor(nowMs);
  const none = { notified: 0, alreadySent: 0, noSubscription: 0, candidates: 0 };
  const supabase = getServiceClient();

  const { data: competition, error: competitionError } = await supabase
    .from("competitions")
    .select("id, weekly_ranking")
    .eq("status", "ACTIVE")
    .maybeSingle<{ id: string; weekly_ranking: boolean }>();
  if (competitionError) fail("Lecture de la compétition", competitionError);
  if (!competition) return { sent: false, weekEnd, skipped: "aucune compétition active", ...none };
  if (!competition.weekly_ranking) return { sent: false, weekEnd, skipped: "classement hebdo désactivé", ...none };

  const { data: header, error: headerError } = await supabase
    .from("weekly_rankings")
    .select("start_snapshot_date, end_snapshot_date")
    .eq("competition_id", competition.id)
    .eq("week_end_date", weekEnd)
    .maybeSingle<{ start_snapshot_date: string; end_snapshot_date: string }>();
  if (headerError) fail("Lecture de la semaine figée", headerError);
  if (!header) return { sent: false, weekEnd, skipped: "semaine non figée", ...none };

  const loadRows = async (date: string): Promise<WeeklySnapshotRow[]> => {
    const { data, error } = await supabase
      .from("leaderboard_snapshots")
      .select("user_id, total_points, correct_match_winners, exact_margins")
      .eq("competition_id", competition.id)
      .eq("snapshot_date", date);
    if (error) fail(`Lecture du snapshot du ${date}`, error);
    return (data ?? []) as WeeklySnapshotRow[];
  };

  const [startRows, endRows, championsResult, usersResult, loggedResult] = await Promise.all([
    loadRows(header.start_snapshot_date),
    loadRows(header.end_snapshot_date),
    supabase
      .from("weekly_champions")
      .select("user_id, points")
      .eq("competition_id", competition.id)
      .eq("week_end_date", weekEnd),
    supabase
      .from("users")
      .select("id")
      .eq("status", "ACTIVE")
      .eq("notification_preference", "PUSH")
      .eq("recap_enabled", true),
    supabase.from("recap_log").select("user_id").eq("kind", "WEEKLY").eq("recap_date", weekEnd),
  ]);
  if (championsResult.error) fail("Lecture des champions", championsResult.error);
  if (usersResult.error) fail("Lecture des joueurs", usersResult.error);
  if (loggedResult.error) fail("Lecture de recap_log", loggedResult.error);

  const championRows = (championsResult.data ?? []) as { user_id: string; points: number }[];
  const { data: pseudoRows, error: pseudoError } =
    championRows.length > 0
      ? await supabase
          .from("users")
          .select("id, pseudo")
          .in("id", championRows.map((row) => row.user_id))
      : { data: [], error: null };
  if (pseudoError) fail("Lecture des pseudos", pseudoError);
  const pseudoById = new Map(((pseudoRows ?? []) as { id: string; pseudo: string }[]).map((row) => [row.id, row.pseudo]));
  const champions = championRows.map((row) => ({
    userId: row.user_id,
    pseudo: pseudoById.get(row.user_id) ?? "Un joueur",
    points: row.points,
  }));

  const { standings } = computeWeeklyStandings(startRows, endRows);
  const standingByUser = new Map<string, WeeklyStanding>(standings.map((standing) => [standing.userId, standing]));

  const logged = new Set(((loggedResult.data ?? []) as { user_id: string }[]).map((row) => row.user_id));
  const eligible = ((usersResult.data ?? []) as { id: string }[])
    .map((row) => row.id)
    .filter((userId) => canReceiveRecap(userId, "WEEKLY"));
  const candidates = eligible.length;
  const alreadySent = eligible.filter((userId) => logged.has(userId)).length;
  const pending = eligible.filter((userId) => !logged.has(userId));
  if (pending.length === 0) return { sent: true, weekEnd, notified: 0, alreadySent, noSubscription: 0, candidates };

  const { data: subscriptionsData, error: subscriptionsError } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh_key, auth_key")
    .in("user_id", pending);
  if (subscriptionsError) fail("Lecture des abonnements push", subscriptionsError);
  const subscriptionsByUser = new Map<string, PushSubscriptionRow[]>();
  for (const row of (subscriptionsData ?? []) as (PushSubscriptionRow & { user_id: string })[]) {
    const list = subscriptionsByUser.get(row.user_id) ?? [];
    list.push(row);
    subscriptionsByUser.set(row.user_id, list);
  }

  const deadSubscriptionIds = new Set<string>();
  let notified = 0;
  let noSubscription = 0;
  let servedMeanwhile = 0;

  for (const userId of pending) {
    const subscriptions = subscriptionsByUser.get(userId) ?? [];
    if (subscriptions.length === 0) {
      noSubscription += 1;
      continue;
    }

    // Réservation atomique : seule la ligne réellement insérée donne le droit
    // d'envoyer.
    const { data: reserved, error: reserveError } = await supabase
      .from("recap_log")
      .upsert(
        { user_id: userId, kind: "WEEKLY", recap_date: weekEnd },
        { onConflict: "user_id,kind,recap_date", ignoreDuplicates: true },
      )
      .select("user_id");
    if (reserveError) fail("Réservation de l'envoi", reserveError);
    if (!reserved || reserved.length === 0) {
      servedMeanwhile += 1;
      continue;
    }

    const text = weeklyChampionPushText({
      champions,
      me: standingByUser.get(userId) ?? null,
      userId,
    });
    let dead: string[];
    try {
      ({ deadSubscriptionIds: dead } = await sendPushToSubscriptions(
        subscriptions,
        { ...text, url: RECAP_URL },
        { ttlSeconds: TTL_SECONDS },
      ));
    } catch (error) {
      // Exception avant tout envoi (clés VAPID absentes...) : on libère la
      // réservation pour que la relance serve ce joueur, puis on remonte.
      await supabase
        .from("recap_log")
        .delete()
        .eq("user_id", userId)
        .eq("kind", "WEEKLY")
        .eq("recap_date", weekEnd);
      throw error;
    }
    dead.forEach((id) => deadSubscriptionIds.add(id));
    notified += 1;
  }

  if (deadSubscriptionIds.size > 0) {
    await supabase.from("push_subscriptions").delete().in("id", [...deadSubscriptionIds]);
  }

  return {
    sent: true,
    weekEnd,
    notified,
    alreadySent: alreadySent + servedMeanwhile,
    noSubscription,
    candidates,
  };
}
