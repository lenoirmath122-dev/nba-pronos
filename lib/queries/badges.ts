import { getServerClient } from "@/lib/supabase/server";
import {
  resolveTier,
  nextThreshold,
  TIERED_BADGE_THRESHOLDS,
  LADDER_BADGE_THRESHOLD,
  type BadgeId,
  type BadgeTier,
  type TieredBadgeId,
  type LadderBadgeId,
} from "@/lib/badges/thresholds";
import { BADGE_CATEGORIES, BADGE_LABELS, BADGE_DESCRIPTIONS, type BadgeCategoryId } from "@/lib/badges/labels";
import type { BetCategory } from "@/lib/labels/bets";

// Onglet Stats > Badges (SPEC_BADGES_PERMANENTS_V0_1.md, phase 1 + phase 2 —
// 27 des ~30 badges du catalogue, dont Métronome/Pilier). Contrairement à
// getProfileStats (lib/queries/stats.ts), lecture À VIE (toutes compétitions
// confondues, pas seulement la compétition ACTIVE) et SANS paramètre de
// scope ligue — aucune comparaison entre joueurs sur un accomplissement
// personnel (spec §1).

export type BadgeDisplay =
  | { kind: "tiered"; id: TieredBadgeId; label: string; description: string; value: number; tier: BadgeTier | null; nextThreshold: number | null }
  | { kind: "binary"; id: "COMPLETISTE" | "SOCIABLE"; label: string; description: string; unlocked: boolean }
  | { kind: "ladderStep"; id: LadderBadgeId; label: string; description: string; level: 1 | 2 | 3 | 4 | 5; value: number; unlocked: boolean; threshold: number };

export type ProfileBadgesData = {
  categories: { id: BadgeCategoryId; title: string; badges: BadgeDisplay[] }[];
};

type UserBadgesLifetimeRow = {
  user_id: string;
  competitions_played: number;
  match_correct_winners: number;
  match_exact_margins: number;
  match_close_margins: number;
  match_predictions_committed: number;
  bracket_correct_winners: number;
  bracket_exact_scores: number;
  bracket_correct_matchups: number;
  bracket_perfect_rounds: number;
  has_validated_bracket: boolean;
  bets_won_by_category: Partial<Record<BetCategory, number>>;
  bets_attempted_by_difficulty: Partial<Record<"1" | "2" | "3" | "4" | "5", number>>;
  bets_posted_total: number;
  bets_posted_fun_off_court: number;
  matches_points_lifetime: number;
  bracket_points_lifetime: number;
  bets_points_lifetime: number;
  total_points_lifetime: number;
  podium_days: number;
  has_league_membership: boolean;
};

// Une ligne par (compétition, joueur) — le RECORD à vie affiché par le
// badge (Métronome/Pilier) est le max de ces lignes, réduit ici plutôt
// qu'en SQL (spec §2, choisi pour rester simple sur ce 1er usage de
// gaps-and-islands dans ce dépôt).
type UserCompetitionStreakRow = {
  user_id: string;
  competition_id: string;
  metronome_streak: number;
  pilier_streak: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function getProfileBadges(): Promise<ProfileBadgesData> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { categories: [] };

  const [{ data: badgeRow }, { data: profileRow }, { data: streakRows }] = await Promise.all([
    supabase.from("user_badges_lifetime").select("*").eq("user_id", user.id).maybeSingle<UserBadgesLifetimeRow>(),
    supabase.from("users").select("created_at").eq("id", user.id).single<{ created_at: string }>(),
    supabase
      .from("user_competition_streaks")
      .select("user_id, competition_id, metronome_streak, pilier_streak")
      .eq("user_id", user.id)
      .returns<UserCompetitionStreakRow[]>(),
  ]);

  // Aucune ligne dans la vue = joueur sans aucune activité à vie (jamais
  // pronostiqué/parié/rempli de bracket) — tous les compteurs à 0, pas une
  // erreur (même repli que les vues user_scores/user_recent_form ailleurs).
  const row: UserBadgesLifetimeRow =
    badgeRow ?? {
      user_id: user.id,
      competitions_played: 0,
      match_correct_winners: 0,
      match_exact_margins: 0,
      match_close_margins: 0,
      match_predictions_committed: 0,
      bracket_correct_winners: 0,
      bracket_exact_scores: 0,
      bracket_correct_matchups: 0,
      bracket_perfect_rounds: 0,
      has_validated_bracket: false,
      bets_won_by_category: {},
      bets_attempted_by_difficulty: {},
      bets_posted_total: 0,
      bets_posted_fun_off_court: 0,
      matches_points_lifetime: 0,
      bracket_points_lifetime: 0,
      bets_points_lifetime: 0,
      total_points_lifetime: 0,
      podium_days: 0,
      has_league_membership: false,
    };

  const accountAgeDays = profileRow?.created_at
    ? Math.floor((Date.now() - new Date(profileRow.created_at).getTime()) / MS_PER_DAY)
    : 0;

  const metronomeRecord = (streakRows ?? []).reduce((max, r) => Math.max(max, r.metronome_streak), 0);
  const pilierRecord = (streakRows ?? []).reduce((max, r) => Math.max(max, r.pilier_streak), 0);

  const tieredValues: Record<TieredBadgeId, number> = {
    CHIRURGIEN: row.match_correct_winners,
    HORLOGER: row.match_exact_margins,
    OEIL_DE_LYNX: row.match_close_margins,
    METRONOME: metronomeRecord,
    PILIER: pilierRecord,
    MACHINE_A_PRONOS: row.match_predictions_committed,

    CHIRURGIEN_SERIE: row.bracket_correct_winners,
    SCOREUR_SERIE: row.bracket_exact_scores,
    VISIONNAIRE: row.bracket_correct_matchups,
    SANS_FAUTE: row.bracket_perfect_rounds,

    SCOUT: row.bets_won_by_category.PLAYER_PROP ?? 0,
    COMPTABLE: row.bets_won_by_category.SCORE_TOTAL ?? 0,
    TACTICIEN: row.bets_won_by_category.TEAM_PROP ?? 0,
    MINUTEUR: row.bets_won_by_category.PERIOD ?? 0,
    DUELLISTE: row.bets_won_by_category.HEAD_TO_HEAD ?? 0,
    CHRONOMETRE: row.bets_won_by_category.PLAYING_TIME ?? 0,
    ASSEMBLEUR: row.bets_won_by_category.MULTI_PLAYER_COMBO ?? 0,
    LIMIER: row.bets_won_by_category.GAME_EVENT ?? 0,
    FANTAISISTE: row.bets_won_by_category.FUN_OFF_COURT ?? 0,
    ACCRO_DU_PARI: row.bets_posted_total,
    MAINO: row.bets_posted_fun_off_court,

    COLLECTIONNEUR: row.total_points_lifetime,
    PRONOS_MASTER: row.matches_points_lifetime,
    BRACKET_MASTER: row.bracket_points_lifetime,
    PARIS_PERSOS_MASTER: row.bets_points_lifetime,
    PODIUMISTA: row.podium_days,

    VETERAN: row.competitions_played,
    DOYEN: accountAgeDays,
  };

  const badgeById = new Map<BadgeId, BadgeDisplay>();

  for (const id of Object.keys(tieredValues) as TieredBadgeId[]) {
    const value = tieredValues[id];
    const thresholds = TIERED_BADGE_THRESHOLDS[id];
    badgeById.set(id, {
      kind: "tiered",
      id,
      label: BADGE_LABELS[id],
      description: BADGE_DESCRIPTIONS[id],
      value,
      tier: resolveTier(value, thresholds),
      nextThreshold: nextThreshold(value, thresholds),
    });
  }

  badgeById.set("COMPLETISTE", {
    kind: "binary",
    id: "COMPLETISTE",
    label: BADGE_LABELS.COMPLETISTE,
    description: BADGE_DESCRIPTIONS.COMPLETISTE,
    unlocked: row.has_validated_bracket,
  });
  badgeById.set("SOCIABLE", {
    kind: "binary",
    id: "SOCIABLE",
    label: BADGE_LABELS.SOCIABLE,
    description: BADGE_DESCRIPTIONS.SOCIABLE,
    unlocked: row.has_league_membership,
  });

  for (const id of Object.keys(LADDER_BADGE_THRESHOLD) as LadderBadgeId[]) {
    const { difficulty, threshold } = LADDER_BADGE_THRESHOLD[id];
    const value = row.bets_attempted_by_difficulty[String(difficulty) as "1" | "2" | "3" | "4" | "5"] ?? 0;
    badgeById.set(id, {
      kind: "ladderStep",
      id,
      label: BADGE_LABELS[id],
      description: BADGE_DESCRIPTIONS[id],
      level: difficulty,
      value,
      unlocked: value >= threshold,
      threshold,
    });
  }

  return {
    categories: BADGE_CATEGORIES.map((category) => ({
      id: category.id,
      title: category.title,
      badges: category.badges.map((id) => badgeById.get(id) as BadgeDisplay),
    })),
  };
}
