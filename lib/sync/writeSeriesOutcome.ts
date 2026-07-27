import { getServiceClient } from "@/lib/supabase/service";
import type { SeriesFormatValue, SeriesStatusValue } from "@/lib/scoring/engine";

// Point d'écriture UNIQUE de series.official_* (SPEC_TECHNIQUE_SCORING_V0_1
// §12.1/§12.2, C-2). Les DEUX chemins appelants (la dérivation pilotée par
// les données, lib/scoring/recompute.ts ; ET la résolution manuelle admin,
// A2) passent par CETTE fonction — jamais d'écriture directe sur `series`
// ailleurs. Contexte SYSTÈME (service_role, contourne la RLS) : cette
// fonction ne re-vérifie PAS is_admin() elle-même, c'est la responsabilité
// de l'appelant (l'action admin re-vérifie AVANT d'appeler, T6a §5.1).
//
// Périmètre de CE lot (2/4 de T5) : uniquement ce writer, PAS le reste de
// T4 (aucune route /api/sync/*, aucun client Highlightly, aucun cron) — ces
// pièces restent à construire séparément le jour où la vraie synchro API
// est câblée.
//
// Écrivain SANS garde de "changement" : réécrit toujours les 3 colonnes
// telles que fournies (idempotent — réécrire la même valeur est sans
// effet). La décision d'appeler ou non cette fonction (agrégat inchangé →
// ne pas écrire, T5 §10.3 "on ne rejoue pas pour rien") appartient à
// L'APPELANT, pas à ce writer.
export async function writeSeriesOutcome(input: {
  seriesId: string;
  status: SeriesStatusValue;
  winnerTeamId: string | null;
  scoreFormat: SeriesFormatValue | null;
}): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await supabase
    .from("series")
    .update({
      official_status: input.status,
      official_winner_team_id: input.winnerTeamId,
      official_score_format: input.scoreFormat,
    })
    .eq("id", input.seriesId);

  if (error) {
    throw new Error(`writeSeriesOutcome a échoué pour la série ${input.seriesId} : ${error.message}`);
  }
}
