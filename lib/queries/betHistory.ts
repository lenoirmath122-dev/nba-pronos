import { getServerClient } from "@/lib/supabase/server";
import { BET_CATEGORY_OPTIONS, BET_DIFFICULTY_LABELS, type BetCategory, type BetDifficulty } from "@/lib/labels/bets";

// Historique complet des paris RÉSOLUS du joueur connecté, toutes compétitions
// confondues (onglet Stats > Paris de « Mon profil »). Réussi = WON, raté =
// LOST ; les paris encore en attente, refusés ou annulés n'y figurent pas.
// Composant serveur, RLS seule autorité (le joueur lit ses propres paris).

const CATEGORY_LABELS = Object.fromEntries(BET_CATEGORY_OPTIONS.map((option) => [option.value, option.label])) as Record<
  BetCategory,
  string
>;

export type BetHistoryItem = {
  betId: string;
  description: string;
  won: boolean;
  /** Points marqués ; 0 pour un pari raté. */
  points: number;
  /** Date de résolution (ISO) ; null si absente (ancien pari). */
  resolvedAt: string | null;
  categoryLabel: string;
  difficultyLabel: string;
  competitionName: string | null;
};

type BetRow = {
  id: string;
  description: string;
  status: "WON" | "LOST";
  points_awarded: number | null;
  scored_at: string | null;
  competition_id: string;
  validated_category: BetCategory | null;
  proposed_category: BetCategory;
  validated_difficulty: BetDifficulty | null;
  proposed_difficulty: BetDifficulty;
};

export async function getMyBetHistory(): Promise<BetHistoryItem[]> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("bets")
    .select(
      "id, description, status, points_awarded, scored_at, competition_id, validated_category, proposed_category, validated_difficulty, proposed_difficulty"
    )
    .eq("user_id", user.id)
    .in("status", ["WON", "LOST"])
    .order("scored_at", { ascending: false, nullsFirst: false })
    .returns<BetRow[]>();
  const bets = data ?? [];
  if (bets.length === 0) return [];

  const competitionIds = [...new Set(bets.map((bet) => bet.competition_id))];
  const { data: competitions } = await supabase.from("competitions").select("id, name").in("id", competitionIds);
  const nameById = new Map((competitions ?? []).map((competition) => [competition.id as string, competition.name as string]));

  return bets.map((bet) => ({
    betId: bet.id,
    description: bet.description,
    won: bet.status === "WON",
    points: bet.status === "WON" ? (bet.points_awarded ?? 0) : 0,
    resolvedAt: bet.scored_at,
    categoryLabel: CATEGORY_LABELS[bet.validated_category ?? bet.proposed_category] ?? "",
    difficultyLabel: BET_DIFFICULTY_LABELS[bet.validated_difficulty ?? bet.proposed_difficulty] ?? "",
    competitionName: nameById.get(bet.competition_id) ?? null,
  }));
}
