import { getMatchesByDate, type RawMatch } from "@/lib/nba/client";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";

// Détection des 4 quarts de finale de la NBA Cup (chantier bêta Cup,
// 18/11/2026, lot L6). PROPOSITION seulement : le résultat pré-remplit le
// formulaire de création, l'admin vérifie puis confirme (jamais de création
// automatique — un faux positif casserait toute la compétition).
//
// Les quarts réels sont les 04 et 05/12/2026 (jours NY, source nba.com). La
// synchro calendrier n'y voit que 4 jours à l'avance : on interroge donc
// directement ces dates.
export const CUP_QUARTER_NY_DATES = ["2026-12-04", "2026-12-05"] as const;

export type TeamRef = { id: string; conference: "EAST" | "WEST" | null };

export type CupQuartersProposal =
  | {
      ok: true;
      /** Ordre du formulaire : Est — Quart 1, Est — Quart 2, Ouest — Quart 1, Ouest — Quart 2.
       *  [équipe à domicile, équipe à l'extérieur] (ids internes). */
      quarters: [string, string][];
    }
  | { ok: false; reason: string };

/** Fonction pure : retient les matchs entre équipes mappées, dédoublonne,
 *  vérifie qu'il reste exactement 4 affiches, 8 équipes distinctes, 2 par
 *  conférence (un quart de Cup se joue au sein d'une conférence). Tout autre
 *  cas → message clair, l'admin saisit à la main. */
export function proposeCupQuarters(
  matches: RawMatch[],
  teamByHighlightlyId: Map<string, TeamRef>
): CupQuartersProposal {
  const seenMatchIds = new Set<number>();
  const candidates: { date: string; home: TeamRef; away: TeamRef }[] = [];
  let unmapped = 0;

  for (const m of matches) {
    if (seenMatchIds.has(m.id)) continue; // même match renvoyé sur 2 dates
    seenMatchIds.add(m.id);
    const home = teamByHighlightlyId.get(String(m.homeTeam.id));
    const away = teamByHighlightlyId.get(String(m.awayTeam.id));
    if (!home || !away) {
      unmapped++;
      continue;
    }
    candidates.push({ date: m.date, home, away });
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      reason:
        unmapped > 0
          ? "Aucun match entre équipes connues sur les dates des quarts. Saisis les affiches à la main."
          : "Aucun match trouvé sur les dates des quarts (04-05/12) : le calendrier n'est peut-être pas encore publié. Saisis les affiches à la main.",
    };
  }
  if (candidates.length !== 4) {
    return {
      ok: false,
      reason: `${candidates.length} match(s) trouvé(s) au lieu de 4 : proposition impossible sans risque de se tromper. Saisis les affiches à la main.`,
    };
  }

  const teamIds = new Set<string>();
  for (const c of candidates) {
    teamIds.add(c.home.id);
    teamIds.add(c.away.id);
  }
  if (teamIds.size !== 8) {
    return {
      ok: false,
      reason: `${teamIds.size} équipes distinctes au lieu de 8 : une équipe apparaît deux fois. Saisis les affiches à la main.`,
    };
  }

  const east: typeof candidates = [];
  const west: typeof candidates = [];
  for (const c of candidates) {
    if (c.home.conference === null || c.home.conference !== c.away.conference) {
      return {
        ok: false,
        reason: "Un match oppose deux conférences (ou une conférence inconnue) : pas un quart de Cup. Saisis les affiches à la main.",
      };
    }
    (c.home.conference === "EAST" ? east : west).push(c);
  }
  if (east.length !== 2 || west.length !== 2) {
    return {
      ok: false,
      reason: `Conférences déséquilibrées (${east.length} Est / ${west.length} Ouest, attendu 2 / 2). Saisis les affiches à la main.`,
    };
  }

  const byDate = (a: { date: string }, b: { date: string }) => Date.parse(a.date) - Date.parse(b.date);
  const ordered = [...east.sort(byDate), ...west.sort(byDate)];
  return { ok: true, quarters: ordered.map((c) => [c.home.id, c.away.id] as [string, string]) };
}

/** IO : 2 appels Highlightly (un par jour NY). Réservé aux admins, appelé
 *  uniquement sur clic (voir la page de création de compétition). */
export async function detectCupQuarters(): Promise<CupQuartersProposal> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "Tu dois être connecté." };
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { ok: false, reason: "Réservé aux admins." };

  const raw: RawMatch[] = [];
  try {
    for (const date of CUP_QUARTER_NY_DATES) {
      const { data } = await getMatchesByDate(date);
      raw.push(...data);
    }
  } catch {
    return { ok: false, reason: "Highlightly injoignable. Saisis les affiches à la main." };
  }

  const service = getServiceClient();
  const [{ data: mappings }, { data: teams }] = await Promise.all([
    service.from("entity_mappings").select("internal_id, source_ref").eq("entity_type", "TEAM").eq("source_type", "HIGHLIGHTLY"),
    service.from("teams").select("id, conference"),
  ]);
  const conferenceById = new Map((teams ?? []).map((t) => [t.id as string, t.conference as TeamRef["conference"]]));
  const teamByHighlightlyId = new Map<string, TeamRef>();
  for (const m of mappings ?? []) {
    const id = m.internal_id as string;
    teamByHighlightlyId.set(m.source_ref as string, { id, conference: conferenceById.get(id) ?? null });
  }
  return proposeCupQuarters(raw, teamByHighlightlyId);
}
