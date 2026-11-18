import type { getServiceClient } from "@/lib/supabase/service";
import { hasBracket, type CompetitionType } from "@/lib/competitions/types";

// Deadline de remplissage du bracket (BACKLOG_V1.md — trouvé en creusant
// pourquoi le bracket ne se comparait jamais entre joueurs, 30/07/2026) :
// « le début du premier match qui commence dans la compétition » (définition
// de l'utilisateur, plus simple que "1er tour uniquement" et strictement
// équivalente en pratique — un match d'un tour ultérieur ne peut de toute
// façon pas être créé avant que le tour précédent y ait avancé les 2
// équipes).
//
// Recalculée en ENTIER (jamais "si plus tôt que l'actuel") à chaque création
// de match : un admin peut saisir les matchs dans n'importe quel ordre, donc
// seul un recalcul complet du minimum reste exact à coup sûr.
//
// Module partagé : appelé par la saisie admin (lib/actions/admin-results.ts)
// ET par la synchro calendrier (lib/sync/schedule.ts), qui crée aussi des
// matchs (bêta NBA Cup, chantier du 18/11/2026).
export async function recomputeBracketDeadline(
  service: ReturnType<typeof getServiceClient>,
  competitionId: string
): Promise<void> {
  // Match du jour : pas de bracket, la deadline doit rester NULL (sinon le
  // rappel de bracket notifierait tout le monde pour un bracket inexistant).
  const { data: competition } = await service
    .from("competitions")
    .select("type")
    .eq("id", competitionId)
    .maybeSingle<{ type: CompetitionType }>();
  if (competition && !hasBracket(competition.type)) return;

  const { data: earliest } = await service
    .from("matches")
    .select("scheduled_at")
    .eq("competition_id", competitionId)
    .not("scheduled_at", "is", null)
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ scheduled_at: string }>();

  await service
    .from("competitions")
    .update({ bracket_deadline: earliest?.scheduled_at ?? null })
    .eq("id", competitionId);
}
