import type { getServerClient } from "@/lib/supabase/server";
import {
  summarizePalmares,
  type PalmaresOwnRow,
  type PalmaresSameWeekRow,
  type PalmaresWeek,
} from "@/lib/weekly/palmares";

// Lecture du palmarès hebdo d'un joueur (lot 4 du classement hebdo), pour son
// profil et la page d'un autre joueur. Appelée avec le client serveur (RLS,
// jamais service_role) : weekly_champions et competitions sont en lecture
// publique. Ne lève jamais : une panne de lecture ne doit pas casser un profil.
//
// Toutes les compétitions, archivées comprises : le palmarès survit à
// l'archivage. weekly_champions n'a pas de FK vers competitions, donc les noms
// sont lus à part (pas d'embed PostgREST, même patron que player-profile.ts).
//
// Pas de limite de lignes : au plus une ligne par semaine et par compétition
// (une trentaine par saison), très en dessous du plafond PostgREST de 1000. Une
// limite fausserait le total.
//
// Effet de bord assumé : « co-champion » est recalculé en direct. Si un co-
// champion supprime son compte (delete_account_data purge ses lignes), l'autre
// perd la mention.

type SupabaseServerClient = Awaited<ReturnType<typeof getServerClient>>;

export type { PalmaresWeek };

export type WeeklyPalmaresData = {
  /** "error" : la lecture des victoires a échoué, rien de fiable à afficher. */
  state: "ok" | "error";
  total: number;
  weeks: PalmaresWeek[];
};

const EMPTY_OK: WeeklyPalmaresData = { state: "ok", total: 0, weeks: [] };
const ERROR: WeeklyPalmaresData = { state: "error", total: 0, weeks: [] };

export async function getWeeklyPalmares(supabase: SupabaseServerClient, userId: string): Promise<WeeklyPalmaresData> {
  try {
    const { data: own, error } = await supabase
      .from("weekly_champions")
      .select("competition_id, week_end_date, points")
      .eq("user_id", userId);
    if (error || !own) return ERROR;
    const ownRows = own as PalmaresOwnRow[];
    if (ownRows.length === 0) return EMPTY_OK;

    const competitionIds = [...new Set(ownRows.map((r) => r.competition_id))];
    const weekDates = [...new Set(ownRows.map((r) => r.week_end_date))];

    const [competitions, sameWeek] = await Promise.all([
      supabase.from("competitions").select("id, name").in("id", competitionIds),
      supabase
        .from("weekly_champions")
        .select("competition_id, week_end_date")
        .in("competition_id", competitionIds)
        .in("week_end_date", weekDates),
    ]);

    const competitionNames = new Map<string, string>();
    if (!competitions.error) {
      for (const row of (competitions.data ?? []) as { id: string; name: string }[]) {
        competitionNames.set(row.id, row.name);
      }
    }

    // Le produit cartésien (compétitions x dates) ramène des lignes en trop :
    // on ne garde que les paires qui sont des victoires du joueur.
    const wanted = new Set(ownRows.map((r) => `${r.competition_id}|${r.week_end_date}`));
    const sameWeekRows: PalmaresSameWeekRow[] | null = sameWeek.error
      ? null
      : ((sameWeek.data ?? []) as PalmaresSameWeekRow[]).filter((r) => wanted.has(`${r.competition_id}|${r.week_end_date}`));

    const { total, weeks } = summarizePalmares({ own: ownRows, sameWeekRows, competitionNames });
    return { state: "ok", total, weeks };
  } catch {
    return ERROR;
  }
}
