import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { personalRecap, type NightMatch, type PersonalRecap, type RecapBet, type RecapPlayer } from "./build";
import { loadCompetitionRecap } from "./load";
import { dailyPeriod, visibleWeeklyPeriod, type RecapKind, type RecapPeriod } from "./period";
import { TRASHTALK_HOME_URL } from "./trashtalk";
import { getTrashTalkArticles } from "./trashtalkFeed";

// Récap affiché en tête de « Ça vient de tomber » (p3-10, fusion choisie par
// l'utilisateur le 05/10/2026 plutôt qu'un écran dédié). « Ta nuit » tous les
// jours ; « Ta semaine » en plus, du lundi 10h au mardi 10h.

export type RecapView = {
  kind: RecapKind;
  /** Avant 10h : la nuit n'est pas finie, le récap se remplit encore. */
  inProgress: boolean;
  me: PersonalRecap | null;
  topScorers: RecapPlayer[];
  bestBet: RecapBet | null;
  craziestLostBet: RecapBet | null;
  weeklyTop: (RecapPlayer & { rank: number; isMe: boolean })[];
  biggestClimb: RecapPlayer[];
  sniper: RecapPlayer[];
  nightMatches: NightMatch[];
  debriefUrl: string;
};

export type HomeRecap = { weekly: RecapView | null; daily: RecapView | null };

async function viewFor(
  supabase: SupabaseClient,
  competitionId: string,
  userId: string,
  period: RecapPeriod
): Promise<RecapView | null> {
  const recap = await loadCompetitionRecap(supabase, competitionId, period, getTrashTalkArticles);
  if (!recap.hasActivity) return null;
  return {
    kind: period.kind,
    inProgress: period.inProgress,
    me: personalRecap(recap, userId),
    topScorers: recap.topScorers,
    bestBet: recap.bestBet,
    craziestLostBet: recap.craziestLostBet,
    weeklyTop: recap.weeklyTop.map((entry) => ({
      ...entry,
      rank: recap.periodRanks.get(entry.userId) ?? 0,
      isMe: entry.userId === userId,
    })),
    biggestClimb: recap.biggestClimb,
    sniper: recap.sniper,
    // Les scores et le débrief ne concernent que la nuit, pas toute la semaine.
    nightMatches: period.kind === "DAILY" ? recap.nightMatches : [],
    debriefUrl: TRASHTALK_HOME_URL,
  };
}

export async function getHomeRecap(
  supabase: SupabaseClient,
  competitionId: string,
  userId: string,
  nowMs: number = Date.now()
): Promise<HomeRecap> {
  const weeklyPeriod = visibleWeeklyPeriod(nowMs);
  const [weekly, daily] = await Promise.all([
    weeklyPeriod ? viewFor(supabase, competitionId, userId, weeklyPeriod) : Promise.resolve(null),
    viewFor(supabase, competitionId, userId, dailyPeriod(nowMs)),
  ]);
  return { weekly, daily };
}
