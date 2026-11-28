import { getServerClient } from "@/lib/supabase/server";
import { getActiveCompetition } from "@/lib/cache/commonData";
import { effectiveNbaCupDeadline, resolveNbaCupPopup, type NbaCupPopupState, type NbaCupSeriesRow } from "@/lib/nbaCupPopup/eligibility";

// État de la popup NBA Cup pour la session courante (connecté ou visiteur).
// Lecture légère (pas getBracket complet) : séries de la compétition, puis,
// pour un connecté, le NOMBRE de séries pronostiquées. Même règle de
// complétude que getBracketTodo (lib/queries/home.ts) : en NBA Cup, un pick
// compte dès que le vainqueur est choisi.
export async function getNbaCupPopupState(): Promise<NbaCupPopupState | null> {
  const supabase = await getServerClient();
  const competition = await getActiveCompetition(supabase);
  // Court-circuit avant toute autre lecture : hors NBA Cup, rien à faire.
  if (!competition || competition.type !== "NBA_CUP") return null;
  // Date limite NULL (aucun match rattaché) : repli sur la fenêtre des quarts.
  const deadline = effectiveNbaCupDeadline(competition.bracket_deadline);
  if (!deadline || Date.parse(deadline) <= Date.now()) return null;

  const [{ data: seriesData }, { data: userData }] = await Promise.all([
    supabase.from("series").select("round, team1_id, team2_id").eq("competition_id", competition.id),
    supabase.auth.getUser(),
  ]);
  const series = (seriesData ?? []) as NbaCupSeriesRow[];
  const user = userData.user;

  let filled: number | null = null;
  if (user) {
    filled = 0;
    const { data: bracket } = await supabase
      .from("brackets")
      .select("id")
      .eq("competition_id", competition.id)
      .eq("user_id", user.id)
      .maybeSingle<{ id: string }>();
    if (bracket) {
      const { count } = await supabase
        .from("bracket_picks")
        .select("id", { count: "exact", head: true })
        .eq("bracket_id", bracket.id)
        .not("predicted_winner_team_id", "is", null);
      filled = count ?? 0;
    }
  }

  return resolveNbaCupPopup({ competition, series, filled, nowMs: Date.now() });
}
