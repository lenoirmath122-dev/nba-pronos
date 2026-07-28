import { getServiceClient } from "@/lib/supabase/service";
import { getTeams } from "@/lib/nba/client";
import { HIGHLIGHTLY_TEAM_ID_BY_ABBREVIATION } from "@/lib/nba/teamAliases";

// Writer de /api/sync/teams (SPEC_TECHNIQUE_SYNCHRO_V0.1 §4, correctif
// post-validation §12.4 — voir lib/nba/teamAliases.ts pour le pourquoi).
// N'écrit JAMAIS `teams` (nos 30 lignes existantes, câblées aux SVG et à tous
// les FK de l'app, restent la source de vérité pour name/abbreviation/logo) —
// seulement `entity_mappings`, confirmé directement (référentiel fixe, 0.2.8
// §5). Idempotent (upsert par la contrainte unique (entity_type, internal_id,
// source_type)), ré-exécutable à la demande, jamais automatique (D6).

export type SyncTeamsResult = {
  mapped: number;
  missingFromApi: string[]; // nos abréviations absentes de la réponse API à cet appel (à surveiller, pas une erreur en soi)
  requestsRemaining: number | null;
};

export async function syncTeams(): Promise<SyncTeamsResult> {
  const supabase = getServiceClient();
  const { data: apiTeams, requestsRemaining } = await getTeams();
  const apiTeamIds = new Set(apiTeams.map((team) => team.id));

  const { data: ourTeams, error } = await supabase.from("teams").select("id, abbreviation");
  if (error) throw new Error(`syncTeams : lecture de teams échouée (${error.message})`);

  const missingFromApi: string[] = [];
  const rows: {
    entity_type: "TEAM";
    internal_id: string;
    source_type: string;
    source_ref: string;
    status: "CONFIRMED";
    confirmed_at: string;
  }[] = [];

  for (const team of ourTeams ?? []) {
    const abbreviation = team.abbreviation as string;
    const highlightlyId = HIGHLIGHTLY_TEAM_ID_BY_ABBREVIATION[abbreviation];
    if (highlightlyId === undefined) continue; // pas une des 30 franchises réelles — garde défensive, ne devrait pas arriver.
    if (!apiTeamIds.has(highlightlyId)) {
      missingFromApi.push(abbreviation);
      continue;
    }
    rows.push({
      entity_type: "TEAM",
      internal_id: team.id as string,
      source_type: "HIGHLIGHTLY",
      source_ref: String(highlightlyId),
      status: "CONFIRMED",
      confirmed_at: new Date().toISOString(),
    });
  }

  if (rows.length > 0) {
    const { error: upsertErr } = await supabase
      .from("entity_mappings")
      .upsert(rows, { onConflict: "entity_type,internal_id,source_type" });
    if (upsertErr) throw new Error(`syncTeams : upsert entity_mappings échoué (${upsertErr.message})`);
  }

  return { mapped: rows.length, missingFromApi, requestsRemaining };
}
