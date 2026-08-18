import { getServiceClient } from "@/lib/supabase/service";
import { sendPushToSubscriptions, type PushSubscriptionRow } from "@/lib/push/send";

// Rappel "match du soir non pronostiqué" (backlog "Rappels ciblés", PRIORITÉ).
// Fenêtre de déclenchement (choix d'implémentation, non fixé par le backlog —
// qui liste le QUOI, pas le QUAND, BACKLOG_V1.md en-tête) : matchs dont le
// coup d'envoi tombe dans les 4 prochaines heures, plutôt qu'une notion de
// "jour du match" (éviterait un calcul de fuseau/journée en plus, alors que
// "quelques heures avant" couvre déjà le besoin exprimé : relancer avant que
// ce soit trop tard pour pronostiquer). À ajuster si l'usage montre qu'il
// faut un délai différent.
const WINDOW_HOURS = 4;

type MatchRow = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  scheduled_at: string;
};

type TeamRow = { id: string; abbreviation: string };

export async function runMatchesReminder(): Promise<{ notified: number; matchesChecked: number }> {
  const supabase = getServiceClient();

  const windowEnd = new Date(Date.now() + WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { data: matchesData } = await supabase
    .from("matches")
    .select("id, home_team_id, away_team_id, scheduled_at")
    .gt("scheduled_at", new Date().toISOString())
    .lte("scheduled_at", windowEnd);

  const matches = (matchesData ?? []) as MatchRow[];
  if (matches.length === 0) return { notified: 0, matchesChecked: 0 };

  const matchIds = matches.map((m) => m.id);

  const [{ data: predictionsData }, { data: activeUsersData }, { data: teamsData }] = await Promise.all([
    supabase.from("match_predictions").select("match_id, user_id").in("match_id", matchIds).neq("status", "DRAFT"),
    supabase
      .from("users")
      .select("id, notification_preference")
      .eq("status", "ACTIVE")
      .eq("notification_preference", "PUSH"),
    supabase.from("teams").select("id, abbreviation"),
  ]);

  const committedByMatch = new Map<string, Set<string>>();
  for (const row of predictionsData ?? []) {
    const set = committedByMatch.get(row.match_id) ?? new Set<string>();
    set.add(row.user_id);
    committedByMatch.set(row.match_id, set);
  }

  const pushUsers = (activeUsersData ?? []) as { id: string }[];
  if (pushUsers.length === 0) return { notified: 0, matchesChecked: matches.length };

  const teamById = new Map(((teamsData ?? []) as TeamRow[]).map((t) => [t.id, t.abbreviation]));

  // Dédoublonnage : une ligne (user_id, 'MATCH_TONIGHT', match_id) déjà
  // présente = déjà notifié pour CE match, ne jamais renvoyer.
  const { data: alreadySentData } = await supabase
    .from("reminder_log")
    .select("user_id, ref_id")
    .eq("kind", "MATCH_TONIGHT")
    .in("ref_id", matchIds);
  const alreadySent = new Set((alreadySentData ?? []).map((r) => `${r.user_id}:${r.ref_id}`));

  const toNotify: { userId: string; match: MatchRow }[] = [];
  for (const match of matches) {
    const committed = committedByMatch.get(match.id) ?? new Set<string>();
    for (const user of pushUsers) {
      if (committed.has(user.id)) continue;
      if (alreadySent.has(`${user.id}:${match.id}`)) continue;
      toNotify.push({ userId: user.id, match });
    }
  }
  if (toNotify.length === 0) return { notified: 0, matchesChecked: matches.length };

  const userIds = [...new Set(toNotify.map((t) => t.userId))];
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

  const deadSubscriptionIds = new Set<string>();
  let notified = 0;

  for (const { userId, match } of toNotify) {
    const subscriptions = subscriptionsByUser.get(userId) ?? [];
    if (subscriptions.length === 0) continue; // préférence PUSH mais aucun abonnement navigateur actif

    const home = teamById.get(match.home_team_id) ?? "?";
    const away = teamById.get(match.away_team_id) ?? "?";
    const { deadSubscriptionIds: dead } = await sendPushToSubscriptions(subscriptions, {
      title: "Match ce soir",
      body: `${home} - ${away} : tu n'as pas encore pronostiqué.`,
      url: "/play",
    });
    dead.forEach((id) => deadSubscriptionIds.add(id));

    await supabase.from("reminder_log").insert({ user_id: userId, kind: "MATCH_TONIGHT", ref_id: match.id });
    notified += 1;
  }

  if (deadSubscriptionIds.size > 0) {
    await supabase.from("push_subscriptions").delete().in("id", [...deadSubscriptionIds]);
  }

  return { notified, matchesChecked: matches.length };
}
