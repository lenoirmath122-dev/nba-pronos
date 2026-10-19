import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/supabase/service";
import { parisDateKey } from "@/lib/dates/paris";
import { getAllTeams } from "@/lib/queries/teams";
import { personalRecap } from "@/lib/recaps/build";
import { loadCompetitionRecap, loadUpcomingMatches } from "@/lib/recaps/load";
import { dailyPeriod, recapBoundaryIso } from "@/lib/recaps/period";
import { kickoffHour } from "@/lib/recaps/text";
import { getTrashTalkArticles } from "@/lib/recaps/trashtalkFeed";
import { sendEmail, siteUrl, unsubscribeUrl, type OutgoingEmail } from "./send";
import { relanceEmail, reminderEmail, resultEmail, type EmailContent, type NextMatch, type ResultLine } from "./templates";
import { createUnsubscribeToken } from "./unsubscribe";

// Envois planifiés (1B) : résultat du matin, relance unique, rappel du soir.
// Appelé par /api/emails (crons Vercel). Règle produit : un seul e-mail par
// jour et par personne, imposée par la contrainte unique de `email_log`.
// La ligne est RÉSERVÉE avant l'envoi (deux passages simultanés ne peuvent pas
// envoyer deux fois) et supprimée si l'envoi échoue (le passage suivant réessaie).
//
// Heure : résultat et relance partent à 10h Paris, comme les récaps push. Le
// match du jour n'est publié qu'à 10h et les résultats ne sont fiables qu'à ce
// moment-là (plan initial : ~8h). Le rappel part à partir de 18h Paris.

export type EmailKind = "RESULT" | "RELANCE" | "REMINDER";

export type EmailRunResult = {
  skipped?: string;
  kind: EmailKind;
  candidates: number;
  sent: number;
  failed: number;
  dryRun?: boolean;
  /** Dry-run seulement : sujets des premiers e-mails qui seraient envoyés. */
  preview?: string[];
};

type Options = { force?: boolean; onlyUserId?: string; dryRun?: boolean };

const MAX_DELAY_MS = 3 * 60 * 60 * 1000;
const REMINDER_FIRST_HOUR = 18;
const REMINDER_LAST_HOUR = 21; // exclu
const REMINDER_HORIZON_MS = 12 * 60 * 60 * 1000;
const RELANCE_LOOKBACK_MS = 48 * 60 * 60 * 1000;
/** Pas de pourcentage sous ce nombre de pronos (plan §1.5 : pas de chiffre sur un échantillon trop petit). */
const MIN_VOTES_FOR_SHARE = 10;
const PREVIEW_SIZE = 3;

function parisHour(ms: number): number {
  const part = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(ms))
    .find((p) => p.type === "hour");
  return Number(part?.value ?? 0);
}

function skipReason(kind: EmailKind, nowMs: number): string | null {
  if (kind === "REMINDER") {
    const hour = parisHour(nowMs);
    return hour >= REMINDER_FIRST_HOUR && hour < REMINDER_LAST_HOUR ? null : "hors de la plage 18h-21h (Paris)";
  }
  const boundaryMs = Date.parse(recapBoundaryIso(parisDateKey(nowMs)));
  if (nowMs < boundaryMs) return "avant 10h (Paris)";
  if (nowMs > boundaryMs + MAX_DELAY_MS) return "trop tard dans la journée";
  return null;
}

async function emailAddress(service: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await service.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

/** Envoie un lot : réserve la ligne email_log, envoie, libère la ligne en cas d'échec. */
async function deliver(
  service: SupabaseClient,
  kind: EmailKind,
  sendDate: string,
  items: { userId: string; build: (email: string) => { content: EmailContent; scope: "results" | "reminders" | null } | null }[],
  dryRun: boolean
): Promise<{ sent: number; failed: number; preview: string[] }> {
  let sent = 0;
  let failed = 0;
  const preview: string[] = [];
  for (const item of items) {
    const address = await emailAddress(service, item.userId);
    if (!address) continue;
    const built = item.build(address);
    if (!built) continue;
    if (dryRun) {
      sent += 1;
      if (preview.length < PREVIEW_SIZE) preview.push(built.content.subject);
      continue;
    }
    const { error: reserveError } = await service
      .from("email_log")
      .insert({ user_id: item.userId, kind, send_date: sendDate });
    // Violation d'unicité : déjà servi aujourd'hui (ou relance déjà envoyée).
    if (reserveError) continue;
    try {
      const outgoing: OutgoingEmail = { to: address, ...built.content };
      const providerId = await sendEmail(outgoing, built.scope ? { userId: item.userId, scope: built.scope } : null);
      await service.from("email_log").update({ provider_id: providerId }).eq("user_id", item.userId).eq("send_date", sendDate);
      sent += 1;
    } catch (error) {
      console.error(`runEmails ${kind} : envoi en échec —`, error instanceof Error ? error.message : error);
      await service.from("email_log").delete().eq("user_id", item.userId).eq("send_date", sendDate);
      failed += 1;
    }
  }
  return { sent, failed, preview };
}

async function alreadyEmailedToday(service: SupabaseClient, sendDate: string): Promise<Set<string>> {
  const { data } = await service.from("email_log").select("user_id").eq("send_date", sendDate);
  return new Set((data ?? []).map((row) => row.user_id as string));
}

export async function runEmails(kind: EmailKind, nowMs: number = Date.now(), options: Options = {}): Promise<EmailRunResult> {
  const base = { kind, candidates: 0, sent: 0, failed: 0, ...(options.dryRun ? { dryRun: true } : {}) };
  if (!options.force) {
    const reason = skipReason(kind, nowMs);
    if (reason) return { ...base, skipped: reason };
  }
  const service = getServiceClient();
  const sendDate = parisDateKey(nowMs);
  const dryRun = options.dryRun === true;

  if (kind === "RELANCE") return runRelance(service, nowMs, sendDate, options, base);

  const { data: competition, error: competitionError } = await service
    .from("competitions")
    .select("id")
    .eq("status", "ACTIVE")
    .maybeSingle<{ id: string }>();
  if (competitionError) throw new Error(`Lecture de la compétition : ${competitionError.message}`);
  if (!competition) return { ...base, skipped: "aucune compétition active" };

  let usersQuery = service
    .from("users")
    .select("id, pseudo")
    .eq("status", "ACTIVE")
    .eq(kind === "RESULT" ? "email_results_enabled" : "email_reminders_enabled", true);
  if (options.onlyUserId) usersQuery = usersQuery.eq("id", options.onlyUserId);
  const { data: usersData } = await usersQuery;
  const done = await alreadyEmailedToday(service, sendDate);
  const users = ((usersData ?? []) as { id: string; pseudo: string }[]).filter((user) => !done.has(user.id));
  if (users.length === 0) return base;

  const [upcoming, teams] = await Promise.all([loadUpcomingMatches(service, competition.id, nowMs), getAllTeams()]);
  const abbreviationById = new Map(teams.map((team) => [team.id, team.abbreviation]));
  const labelOf = (match: { homeTeamId: string; awayTeamId: string }) =>
    `${abbreviationById.get(match.homeTeamId) ?? "?"} - ${abbreviationById.get(match.awayTeamId) ?? "?"}`;
  const playUrl = `${siteUrl()}/play`;

  if (kind === "REMINDER") {
    const tonight = upcoming.matches.find((match) => Date.parse(match.scheduledAt) - nowMs <= REMINDER_HORIZON_MS);
    if (!tonight) return { ...base, skipped: "pas de match dans les 12 prochaines heures" };
    let homeShare: number | null = null;
    const { data: counts } = await service.rpc("home_match_vote_counts", { p_match_ids: [tonight.id] });
    const row = ((counts ?? []) as { total: number; home_votes: number }[])[0];
    if (row && row.total >= MIN_VOTES_FOR_SHARE) homeShare = Math.round((row.home_votes / row.total) * 100);
    const targets = users.filter((user) => !(upcoming.predictedByUser.get(user.id) ?? new Set()).has(tonight.id));
    const result = await deliver(
      service,
      kind,
      sendDate,
      targets.map((user) => ({
        userId: user.id,
        build: () => ({
          scope: "reminders" as const,
          content: reminderEmail({
            pseudo: user.pseudo,
            matchLabel: labelOf(tonight),
            kickoff: kickoffHour(tonight.scheduledAt),
            homeSharePercent: homeShare,
            homeAbbreviation: abbreviationById.get(tonight.homeTeamId) ?? "?",
            awayAbbreviation: abbreviationById.get(tonight.awayTeamId) ?? "?",
            playUrl,
            unsubscribeUrl: unsubscribeUrl(user.id, "reminders"),
          }),
        }),
      })),
      dryRun
    );
    return { ...base, candidates: targets.length, ...result };
  }

  // RESULT
  const boundaryMs = Date.parse(recapBoundaryIso(sendDate));
  const period = { ...dailyPeriod(nowMs), endIso: new Date(boundaryMs).toISOString(), inProgress: false };
  const recap = await loadCompetitionRecap(service, competition.id, period, getTrashTalkArticles);
  const played = users.filter((user) => personalRecap(recap, user.id)?.played);
  if (played.length === 0) return base;

  const nightLabel = new Map(recap.nightMatches.map((match) => [match.id, match.label]));
  const { data: predictionRows } =
    nightLabel.size > 0
      ? await service
          .from("match_predictions")
          .select("user_id, match_id, is_winner_correct, margin_diff, points_awarded")
          .in("match_id", [...nightLabel.keys()])
          .in("user_id", played.map((user) => user.id))
          .neq("status", "DRAFT")
          .not("scored_at", "is", null)
      : { data: [] };
  const linesByUser = new Map<string, ResultLine[]>();
  for (const row of (predictionRows ?? []) as {
    user_id: string;
    match_id: string;
    is_winner_correct: boolean | null;
    margin_diff: number | null;
    points_awarded: number | null;
  }[]) {
    const list = linesByUser.get(row.user_id) ?? [];
    list.push({
      label: nightLabel.get(row.match_id) ?? "Match",
      winnerCorrect: row.is_winner_correct === true,
      marginDiff: row.margin_diff,
      points: row.points_awarded ?? 0,
    });
    linesByUser.set(row.user_id, list);
  }

  const result = await deliver(
    service,
    kind,
    sendDate,
    played.map((user) => ({
      userId: user.id,
      build: () => {
        const me = personalRecap(recap, user.id);
        if (!me) return null;
        const predicted = upcoming.predictedByUser.get(user.id) ?? new Set<string>();
        const nextMatch = upcoming.matches.find((match) => !predicted.has(match.id));
        const next: NextMatch | null = nextMatch ? { label: labelOf(nextMatch), kickoff: kickoffHour(nextMatch.scheduledAt) } : null;
        return {
          scope: "results" as const,
          content: resultEmail({
            pseudo: user.pseudo,
            pointsGained: me.pointsGained,
            rank: me.rank,
            rankDelta: me.rankDelta,
            lines: linesByUser.get(user.id) ?? [],
            next,
            playUrl,
            unsubscribeUrl: unsubscribeUrl(user.id, "results"),
          }),
        };
      },
    })),
    dryRun
  );
  return { ...base, candidates: played.length, ...result };
}

async function runRelance(
  service: SupabaseClient,
  nowMs: number,
  sendDate: string,
  options: Options,
  base: { kind: EmailKind; candidates: number; sent: number; failed: number }
): Promise<EmailRunResult> {
  let pendingQuery = service
    .from("users")
    .select("id, pseudo")
    .eq("status", "PENDING")
    .gte("created_at", new Date(nowMs - RELANCE_LOOKBACK_MS).toISOString());
  if (options.onlyUserId) pendingQuery = pendingQuery.eq("id", options.onlyUserId);
  const { data: pendingData } = await pendingQuery;
  const pending = (pendingData ?? []) as { id: string; pseudo: string }[];
  if (pending.length === 0) return base;

  // Une seule relance dans la vie d'un compte en attente.
  const [{ data: relanced }, { data: scoredData }] = await Promise.all([
    service.from("email_log").select("user_id").eq("kind", "RELANCE").in("user_id", pending.map((u) => u.id)),
    service
      .from("match_predictions")
      .select("user_id, points_awarded")
      .in("user_id", pending.map((u) => u.id))
      .neq("status", "DRAFT")
      .not("scored_at", "is", null),
  ]);
  const alreadyRelanced = new Set((relanced ?? []).map((row) => row.user_id as string));
  const pointsByUser = new Map<string, number>();
  for (const row of (scoredData ?? []) as { user_id: string; points_awarded: number | null }[]) {
    pointsByUser.set(row.user_id, (pointsByUser.get(row.user_id) ?? 0) + (row.points_awarded ?? 0));
  }
  const targets = pending.filter((user) => pointsByUser.has(user.id) && !alreadyRelanced.has(user.id));
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  if (targets.length > 0 && !secret) throw new Error("Variable d'environnement manquante : EMAIL_UNSUBSCRIBE_SECRET");

  const result = await deliver(
    service,
    "RELANCE",
    sendDate,
    targets.map((user) => ({
      userId: user.id,
      build: () => ({
        scope: null,
        content: relanceEmail({
          pseudo: user.pseudo,
          pointsPending: pointsByUser.get(user.id) ?? 0,
          validateUrl: `${siteUrl()}/api/email/validate?token=${encodeURIComponent(createUnsubscribeToken(user.id, "validate", secret!))}`,
        }),
      }),
    })),
    options.dryRun === true
  );
  return { ...base, candidates: targets.length, ...result };
}
