import { getServiceClient } from "@/lib/supabase/service";

// Numéro de semaine dans le nom de la compétition active (affiché sur
// l'accueil, le classement, les récaps). « Semaine N » = nombre de semaines
// figées + 1 : le cron du lundi 10h Paris fige la semaine qui se termine, la
// suivante commence. N'écrit que si le nom suit déjà `<préfixe> - Semaine <n>`,
// un nom saisi à la main n'est jamais écrasé.

const WEEK_NAME = /^(.+ - Semaine )(\d+)$/;

/** Nouveau nom, ou `null` si le format n'est pas reconnu ou déjà à jour. */
export function nextCompetitionName(currentName: string, frozenWeeks: number): string | null {
  const match = WEEK_NAME.exec(currentName);
  if (!match) return null;
  const next = frozenWeeks + 1;
  if (Number(match[2]) === next) return null;
  return `${match[1]}${next}`;
}

export type CompetitionNameResult = { renamed: boolean; name?: string; skipped?: string };

export async function runCompetitionWeekName(): Promise<CompetitionNameResult> {
  const supabase = getServiceClient();

  const { data: competition, error: competitionError } = await supabase
    .from("competitions")
    .select("id, name")
    .eq("status", "ACTIVE")
    .maybeSingle<{ id: string; name: string }>();
  if (competitionError) throw new Error(`Lecture de la compétition : ${competitionError.message}`);
  if (!competition) return { renamed: false, skipped: "aucune compétition active" };

  const { count, error: countError } = await supabase
    .from("weekly_rankings")
    .select("*", { count: "exact", head: true })
    .eq("competition_id", competition.id);
  if (countError) throw new Error(`Lecture des semaines figées : ${countError.message}`);

  const name = nextCompetitionName(competition.name, count ?? 0);
  if (name === null) return { renamed: false, skipped: "nom inchangé ou format non reconnu" };

  const { error: updateError } = await supabase
    .from("competitions")
    .update({ name })
    .eq("id", competition.id);
  if (updateError) throw new Error(`Renommage de la compétition : ${updateError.message}`);
  return { renamed: true, name };
}
