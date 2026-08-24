import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { nyDateString } from "@/lib/dates/newyork";
import { recomputeBet } from "@/lib/scoring/recompute";
import { NO_THRESHOLD_STATS, PERCENTAGE_STATS, type StatCode } from "./statCodes";
import { TEAM_STAT_CODES, TEAM_PERCENTAGE_STATS, type TeamStatCode } from "./teamStatCodes";
import { TEAM_TARGETED_PERIOD_OUTCOMES, PERIOD_LABELS_FR, type PeriodCode, type PeriodOutcomeKind } from "./periodStatCodes";

// Phase 6 (résolution automatique des paris IA calculables, 22/08/2026,
// demandé par l'utilisateur) -- bloc 2-3 du plan (voir JOURNAL_SESSIONS.md).
// Portée initialement réduite au 1er jet : scope MATCH uniquement (un pari
// SÉRIE n'a pas de match unique évident qui fait foi) -- resolveCalculableBets()
// ci-dessous. resolveCalculableSeriesBets() (pièce (e), 23/08/2026, paris
// SÉRIE) l'étend au scope SERIES en cherchant TOUS les vrais matchs déjà
// joués de la série, cf. plus bas. Dans les 2 cas : seulement les paris déjà
// VALIDATED avec structured_player_id connu (Phase 6 bloc 1) -- un pari sans
// player_id (structuré avant ce correctif, ou joueur hors match/série forcé
// à 0%) reste manuel pour l'instant.
//
// Architecture : un SEUL Supabase héberge à la fois les tables de l'appli
// (bets/matches/teams/entity_mappings) ET celles du projet Data NBA
// (stats_matchs/stats_equipes/stats_box_scores) -- tout se fait ici en
// TypeScript, service_role, aucun appel réseau vers le service Cloud Run
// (qui ne sert qu'au CALCUL DE PROBA avant le match, pas à la lecture du
// résultat réel après).

type SupabaseServiceClient = ReturnType<typeof getServiceClient>;

export type ResolveBetsSummary = {
  resolved: { betId: string; outcome: "WON" | "LOST" }[];
  skipped: { betId: string; reason: string }[];
};

/** "12:34" -> 12.5666..., "" ou null -> 0 -- même convention que
 *  minutes_to_float() dans tester_modele.py (Python), jamais dupliquée à
 *  l'identique jusqu'ici côté TypeScript (ce module est le 1er endroit
 *  côté appli à avoir besoin de parser une vraie valeur de minutes). */
function minutesToFloat(raw: string | null): number {
  if (!raw) return 0;
  if (raw.includes(":")) {
    const [mins, secs] = raw.split(":");
    return Number(mins) + Number(secs) / 60;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Colonne stats_box_scores brute pour chaque stat comptée simple --
 *  n'inclut PAS dd/td (calculées, voir isDoubleOrTripleDouble) ni les
 *  stats en pourcentage (voir PCT_MAKES_ATTEMPTS_COLUMNS), qui ont chacune
 *  leur propre logique ci-dessous. */
const COUNTING_STAT_COLUMN: Partial<Record<StatCode, "pts" | "reb" | "ast" | "fg3m" | "stl" | "blk" | "fga" | "fg3a" | "oreb">> = {
  pts: "pts",
  reb: "reb",
  ast: "ast",
  fg3m: "fg3m",
  stl: "stl",
  blk: "blk",
  // ajoutees le 23/08/2026 (extension "faciles") -- fga/fg3a sont deja
  // presentes dans BoxScoreRow (utilisees par PCT_MAKES_ATTEMPTS_COLUMNS),
  // pareil pour la resolution en tant que stat a seuil directe.
  fga: "fga",
  fg3a: "fg3a",
  oreb: "oreb",
};

const PCT_MAKES_ATTEMPTS_COLUMNS: Partial<Record<StatCode, ["ftm" | "fgm" | "fg3m", "fta" | "fga" | "fg3a"]>> = {
  ft: ["ftm", "fta"],
  fg: ["fgm", "fga"],
  fg3: ["fg3m", "fg3a"],
};

type BoxScoreRow = {
  minutes: string | null;
  pts: number | null;
  reb: number | null;
  ast: number | null;
  fg3m: number | null;
  stl: number | null;
  blk: number | null;
  ftm: number | null;
  fta: number | null;
  fgm: number | null;
  fga: number | null;
  fg3a: number | null;
  oreb: number | null;
};

/** Même définition EXACTE que build_targets.py (Cadrage/Stats/scripts,
 *  Data NBA) -- >= 10 dans au moins 2 des 5 catégories = double-double,
 *  >= 3 = triple-double. Ne PAS diverger : c'est la même convention que
 *  celle utilisée pour entraîner les modèles dd/td. */
function categoriesAtTen(box: BoxScoreRow): number {
  return [box.pts, box.reb, box.ast, box.stl, box.blk].filter((v) => (v ?? 0) >= 10).length;
}

/** true = pari gagné, false = perdu, null = donnée insuffisante pour
 *  trancher (jamais résolu dans ce cas -- pas de statut "annulé"/"push"
 *  dans ce projet, une égalité EXACTE au seuil est traitée comme perdue,
 *  cohérent avec "plus de X" qui exige STRICTEMENT plus que X). */
function computeOutcome(
  stat: StatCode,
  threshold: number | null,
  comparison: "OVER" | "UNDER" | null,
  box: BoxScoreRow
): boolean | null {
  if (NO_THRESHOLD_STATS.has(stat)) {
    const categories = categoriesAtTen(box);
    return stat === "dd" ? categories >= 2 : categories >= 3;
  }

  if (PERCENTAGE_STATS.has(stat)) {
    if (threshold === null || comparison === null) return null;
    const [makesCol, attemptsCol] = PCT_MAKES_ATTEMPTS_COLUMNS[stat]!;
    const makes = box[makesCol] ?? 0;
    const attempts = box[attemptsCol] ?? 0;
    const actualPct = attempts > 0 ? makes / attempts : 0;
    return comparison === "UNDER" ? actualPct < threshold : actualPct > threshold;
  }

  if (threshold === null || comparison === null) return null;
  const actual = stat === "min" ? minutesToFloat(box.minutes) : (box[COUNTING_STAT_COLUMN[stat]!] ?? 0);
  return comparison === "UNDER" ? actual < threshold : actual > threshold;
}

/** Retrouve le vrai game_id NBA (stats_matchs) pour un match de l'appli --
 *  cache-first via entity_mappings (source_type NBA_API, même table déjà
 *  utilisée pour Highlightly, nouveau source_type). Si absent, rapproche
 *  PAR DATE (America/New_York, même convention que nba_api) + PAIRE
 *  D'ÉQUIPES (peu importe l'ordre domicile/extérieur, qui peut différer
 *  entre les 2 sources) -- même philosophie déterministe que le
 *  rapprochement Highlightly existant (lib/sync/schedule.ts) : 0 ou 2+
 *  candidats = ambigu, on abandonne cette passe plutôt que de deviner
 *  (pas d'écran de confirmation admin pour ce type d'entité, même
 *  décision déjà actée pour Highlightly). */
async function resolveNbaGameId(supabase: SupabaseServiceClient, matchId: string): Promise<string | null> {
  const { data: cached } = await supabase
    .from("entity_mappings")
    .select("source_ref")
    .eq("entity_type", "MATCH")
    .eq("source_type", "NBA_API")
    .eq("internal_id", matchId)
    .maybeSingle<{ source_ref: string }>();
  if (cached?.source_ref) return cached.source_ref;

  const { data: match } = await supabase
    .from("matches")
    .select("id, scheduled_at, home_team_id, away_team_id")
    .eq("id", matchId)
    .maybeSingle<{ id: string; scheduled_at: string | null; home_team_id: string | null; away_team_id: string | null }>();
  if (!match?.scheduled_at || !match.home_team_id || !match.away_team_id) return null;

  const { data: teams } = await supabase
    .from("teams")
    .select("id, abbreviation")
    .in("id", [match.home_team_id, match.away_team_id]);
  const abbrById = new Map((teams ?? []).map((t) => [t.id as string, t.abbreviation as string]));
  const homeAbbr = abbrById.get(match.home_team_id);
  const awayAbbr = abbrById.get(match.away_team_id);
  if (!homeAbbr || !awayAbbr) return null;

  const { data: statsTeams } = await supabase
    .from("stats_equipes")
    .select("team_id, tricode")
    .in("tricode", [homeAbbr, awayAbbr]);
  const nbaIdByTricode = new Map((statsTeams ?? []).map((t) => [t.tricode as string, t.team_id as number]));
  const homeNbaId = nbaIdByTricode.get(homeAbbr);
  const awayNbaId = nbaIdByTricode.get(awayAbbr);
  if (homeNbaId === undefined || awayNbaId === undefined) return null;

  const gameDate = nyDateString(new Date(match.scheduled_at));
  const { data: candidates } = await supabase
    .from("stats_matchs")
    .select("game_id")
    .eq("game_date", gameDate)
    .or(
      `and(home_team_id.eq.${homeNbaId},away_team_id.eq.${awayNbaId}),` +
        `and(home_team_id.eq.${awayNbaId},away_team_id.eq.${homeNbaId})`
    );
  if (!candidates || candidates.length !== 1) return null;

  const gameId = candidates[0].game_id as string;
  await supabase.from("entity_mappings").upsert(
    {
      entity_type: "MATCH",
      internal_id: matchId,
      source_type: "NBA_API",
      source_ref: gameId,
      status: "CONFIRMED",
      confirmed_at: new Date().toISOString(),
    },
    { onConflict: "entity_type,internal_id,source_type" }
  );
  return gameId;
}

type EligibleBetRow = {
  id: string;
  match_id: string | null;
  structured_player_id: number | null;
  structured_stat: string | null;
  structured_threshold: number | null;
  structured_comparison: "OVER" | "UNDER" | null;
};

/** Point d'entrée appelé par /api/resolve-bets (chaîné après le
 *  rafraîchissement quotidien Data NBA, GAPS_OUVERTS.md/JOURNAL_SESSIONS.md
 *  -- les vraies stats de la veille doivent être en base AVANT de tenter
 *  une résolution, sinon tout échoue en "pas de ligne stats_box_scores"). */
export async function resolveCalculableBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_player_id, structured_stat, structured_threshold, structured_comparison")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .not("structured_player_id", "is", null);
  const bets = (betsData ?? []) as EligibleBetRow[];
  if (bets.length === 0) return summary;

  // Ne retient que les matchs FINISHED (matcher un match pas encore joué
  // n'aurait aucune stat_box_scores de toute façon) -- une seule requête
  // pour tous les bets de cette passe plutôt qu'une par bet.
  const matchIds = [...new Set(bets.map((b) => b.match_id).filter((id): id is string => id !== null))];
  const { data: matchesData } = await supabase.from("matches").select("id, status").in("id", matchIds);
  const finishedMatchIds = new Set(
    (matchesData ?? []).filter((m) => m.status === "FINISHED").map((m) => m.id as string)
  );

  // Paris déjà contestés (requête de correction en attente) -- jamais
  // résolus automatiquement, même garde que resolveBet() (admin-resolution.ts).
  const { data: pendingCorrections } = await supabase
    .from("correction_requests")
    .select("target_bet_id")
    .eq("status", "PENDING")
    .in(
      "target_bet_id",
      bets.map((b) => b.id)
    );
  const contestedBetIds = new Set((pendingCorrections ?? []).map((r) => r.target_bet_id as string));

  for (const bet of bets) {
    if (!bet.match_id || !finishedMatchIds.has(bet.match_id)) {
      summary.skipped.push({ betId: bet.id, reason: "match pas encore terminé" });
      continue;
    }
    if (contestedBetIds.has(bet.id)) {
      summary.skipped.push({ betId: bet.id, reason: "requête de correction en attente" });
      continue;
    }
    if (bet.structured_player_id === null || !bet.structured_stat) {
      summary.skipped.push({ betId: bet.id, reason: "player_id ou stat manquant" });
      continue;
    }

    const gameId = await resolveNbaGameId(supabase, bet.match_id);
    if (!gameId) {
      summary.skipped.push({ betId: bet.id, reason: "match NBA correspondant introuvable" });
      continue;
    }

    const { data: box } = await supabase
      .from("stats_box_scores")
      .select("minutes, pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb")
      .eq("game_id", gameId)
      .eq("player_id", bet.structured_player_id)
      .maybeSingle<BoxScoreRow>();
    if (!box) {
      // Pas encore synchronisé (ou joueur réellement absent du match) --
      // on ne tranche jamais un pari sur une absence de donnée, on
      // réessaiera à la prochaine passe quotidienne.
      summary.skipped.push({ betId: bet.id, reason: "pas de ligne stats_box_scores pour ce joueur/match" });
      continue;
    }

    const won = computeOutcome(
      bet.structured_stat as StatCode,
      bet.structured_threshold,
      bet.structured_comparison,
      box
    );
    if (won === null) {
      summary.skipped.push({ betId: bet.id, reason: "seuil/comparaison manquant" });
      continue;
    }

    const outcome: "WON" | "LOST" = won ? "WON" : "LOST";
    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: "Résolu automatiquement via les statistiques officielles du match.",
        resolved_at: new Date().toISOString(),
        resolved_by_admin_id: null, // signal "résolu par le système", pas un humain -- même convention que validated_by_admin_id
      })
      .eq("id", bet.id)
      .eq("status", "VALIDATED")
      .select("id")
      .maybeSingle();
    if (!updated) {
      summary.skipped.push({ betId: bet.id, reason: "déjà résolu entre-temps (concurrence)" });
      continue;
    }

    await recomputeBet(bet.id);
    summary.resolved.push({ betId: bet.id, outcome });
  }

  return summary;
}

type EligibleSeriesBetRow = {
  id: string;
  series_id: string;
  structured_player_id: number | null;
  structured_stat: string | null;
  structured_threshold: number | null;
  structured_comparison: "OVER" | "UNDER" | null;
};

/** Pièce (e) du chantier paris SÉRIE (23/08/2026, GAPS_OUVERTS.md) --
 *  équivalent SERIES de resolveCalculableBets() ci-dessus. Sémantique "au
 *  moins une fois sur la série" (retenue avec l'utilisateur, pièce (c)) :
 *  dès qu'UN match réellement joué de la série satisfait le seuil, le pari
 *  est gagné immédiatement -- pas besoin d'attendre la fin de la série. Si
 *  aucun hit pour l'instant, le pari n'est résolu LOST QUE si la série
 *  elle-même est terminée (`series.official_status = 'FINISHED'`, plus de
 *  match à venir qui pourrait encore faire gagner le pari) ET que tous ses
 *  matchs FINISHED ont bien une ligne stats_box_scores pour ce joueur (même
 *  prudence que resolveCalculableBets() : jamais trancher sur une absence
 *  de donnée -- si un match manque de données, le pari reste en attente
 *  plutôt que risquer un LOST à tort). */
export async function resolveCalculableSeriesBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, series_id, structured_player_id, structured_stat, structured_threshold, structured_comparison")
    .eq("scope", "SERIES")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .not("structured_player_id", "is", null);
  const bets = (betsData ?? []) as EligibleSeriesBetRow[];
  if (bets.length === 0) return summary;

  const seriesIds = [...new Set(bets.map((b) => b.series_id))];

  const { data: seriesData } = await supabase.from("series").select("id, official_status").in("id", seriesIds);
  const seriesStatusById = new Map((seriesData ?? []).map((s) => [s.id as string, s.official_status as string]));

  const { data: matchesData } = await supabase.from("matches").select("id, series_id, status").in("series_id", seriesIds);
  const finishedMatchIdsBySeries = new Map<string, string[]>();
  for (const m of matchesData ?? []) {
    if (m.status !== "FINISHED") continue;
    const seriesId = m.series_id as string;
    finishedMatchIdsBySeries.set(seriesId, [...(finishedMatchIdsBySeries.get(seriesId) ?? []), m.id as string]);
  }

  // Paris déjà contestés -- jamais résolus automatiquement, même garde que
  // resolveCalculableBets() ci-dessus.
  const { data: pendingCorrections } = await supabase
    .from("correction_requests")
    .select("target_bet_id")
    .eq("status", "PENDING")
    .in(
      "target_bet_id",
      bets.map((b) => b.id)
    );
  const contestedBetIds = new Set((pendingCorrections ?? []).map((r) => r.target_bet_id as string));

  for (const bet of bets) {
    if (contestedBetIds.has(bet.id)) {
      summary.skipped.push({ betId: bet.id, reason: "requête de correction en attente" });
      continue;
    }
    if (bet.structured_player_id === null || !bet.structured_stat) {
      summary.skipped.push({ betId: bet.id, reason: "player_id ou stat manquant" });
      continue;
    }
    const stat = bet.structured_stat as StatCode;
    if (!NO_THRESHOLD_STATS.has(stat) && (bet.structured_threshold === null || bet.structured_comparison === null)) {
      summary.skipped.push({ betId: bet.id, reason: "seuil/comparaison manquant" });
      continue;
    }

    const finishedMatchIds = finishedMatchIdsBySeries.get(bet.series_id) ?? [];
    let hit = false;
    let dataMissing = false;
    for (const matchId of finishedMatchIds) {
      const gameId = await resolveNbaGameId(supabase, matchId);
      if (!gameId) {
        dataMissing = true;
        continue;
      }
      const { data: box } = await supabase
        .from("stats_box_scores")
        .select("minutes, pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb")
        .eq("game_id", gameId)
        .eq("player_id", bet.structured_player_id)
        .maybeSingle<BoxScoreRow>();
      if (!box) {
        // Pas encore synchronisé (ou joueur réellement absent de CE match
        // précis -- traded, DNP...) -- même prudence que resolveCalculableBets() :
        // ne bloque que la décision LOST, un hit sur un AUTRE match de la
        // série reste possible et prime de toute façon.
        dataMissing = true;
        continue;
      }
      if (computeOutcome(stat, bet.structured_threshold, bet.structured_comparison, box)) {
        hit = true;
        break;
      }
    }

    if (!hit) {
      const seriesOver = seriesStatusById.get(bet.series_id) === "FINISHED";
      if (!seriesOver) {
        summary.skipped.push({ betId: bet.id, reason: "série pas encore terminée, pas encore de hit" });
        continue;
      }
      if (dataMissing || finishedMatchIds.length === 0) {
        summary.skipped.push({ betId: bet.id, reason: "données manquantes pour au moins un match de la série" });
        continue;
      }
    }

    const outcome: "WON" | "LOST" = hit ? "WON" : "LOST";
    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: hit
          ? "Résolu automatiquement via les statistiques officielles d'un match de la série."
          : "Résolu automatiquement : série terminée, seuil jamais atteint sur les matchs joués.",
        resolved_at: new Date().toISOString(),
        resolved_by_admin_id: null,
      })
      .eq("id", bet.id)
      .eq("status", "VALIDATED")
      .select("id")
      .maybeSingle();
    if (!updated) {
      summary.skipped.push({ betId: bet.id, reason: "déjà résolu entre-temps (concurrence)" });
      continue;
    }

    await recomputeBet(bet.id);
    summary.resolved.push({ betId: bet.id, outcome });
  }

  return summary;
}

type EligibleMatchTotalBetRow = {
  id: string;
  match_id: string | null;
  structured_stat: string | null;
  structured_threshold: number | null;
  structured_comparison: "OVER" | "UNDER" | null;
};

type MatchScoreRow = {
  id: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  went_to_ot: boolean | null;
};

type QuarterScores = { homeTeam: number[]; awayTeam: number[] };

type MatchPeriodRow = {
  id: string;
  status: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  quarter_scores: QuarterScores | null;
};

/** Pièce (a) du chantier paris équipe (GAPS_OUVERTS.md, cadré le
 *  23/08/2026) -- résolution des paris MATCH_TOTAL (structured_stat=
 *  "total_points"/"went_to_ot", jamais de structured_player_id -- paris SANS
 *  JOUEUR). Contrairement à resolveCalculableBets()/resolveCalculableSeriesBets()
 *  (qui lisent stats_box_scores, le pipeline Data NBA), la résolution ici
 *  n'a besoin QUE de `matches.home_score`/`away_score`/`went_to_ot` -- déjà
 *  synchronisés par le sync existant, aucune dépendance au pipeline Data NBA
 *  pour VÉRIFIER après coup (seulement pour PRÉDIRE avant le match, cf.
 *  compute_total_points_proba()/compute_overtime_proba() côté service).
 *  MATCH uniquement pour l'instant (même limite que la prédiction, pas
 *  encore de SÉRIE). Les autres stats "total_X" (reb/ast/fg3m/stl/blk/oreb)
 *  passent par resolveCalculableTeamStatBets() ci-dessus (structured_stat
 *  matché indépendamment du bet_subject qui l'a écrit) -- went_to_ot n'y a
 *  pas sa place (pas de colonne numérique à comparer à un seuil), traité
 *  ici à côté de total_points (24/08/2026, chantier "prolongation"). */
export async function resolveCalculableMatchTotalBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_stat, structured_threshold, structured_comparison")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .in("structured_stat", ["total_points", "went_to_ot"])
    .is("structured_player_id", null); // discrimine des paris JOUEUR -- garde explicite, jamais coexistant avec un vrai player_id
  const bets = (betsData ?? []) as EligibleMatchTotalBetRow[];
  if (bets.length === 0) return summary;

  const matchIds = [...new Set(bets.map((b) => b.match_id).filter((id): id is string => id !== null))];
  const { data: matchesData } = await supabase
    .from("matches")
    .select("id, status, home_score, away_score, went_to_ot")
    .in("id", matchIds);
  const matchById = new Map(((matchesData ?? []) as MatchScoreRow[]).map((m) => [m.id, m]));

  // Paris déjà contestés -- jamais résolus automatiquement, même garde que
  // les 2 resolvers ci-dessus.
  const { data: pendingCorrections } = await supabase
    .from("correction_requests")
    .select("target_bet_id")
    .eq("status", "PENDING")
    .in(
      "target_bet_id",
      bets.map((b) => b.id)
    );
  const contestedBetIds = new Set((pendingCorrections ?? []).map((r) => r.target_bet_id as string));

  for (const bet of bets) {
    if (!bet.match_id) {
      summary.skipped.push({ betId: bet.id, reason: "match manquant" });
      continue;
    }
    if (contestedBetIds.has(bet.id)) {
      summary.skipped.push({ betId: bet.id, reason: "requête de correction en attente" });
      continue;
    }
    // went_to_ot n'a ni seuil ni comparaison (probabilité directe) -- garde
    // restreinte à total_points, même principe que la garde symétrique côté
    // structuration (structureAndScoreBet.ts, NO_THRESHOLD_MATCH_STATS).
    if (bet.structured_stat === "total_points" && (bet.structured_threshold === null || !bet.structured_comparison)) {
      summary.skipped.push({ betId: bet.id, reason: "seuil/comparaison manquant" });
      continue;
    }

    const match = matchById.get(bet.match_id);
    if (!match || match.status !== "FINISHED") {
      summary.skipped.push({ betId: bet.id, reason: "match pas encore terminé" });
      continue;
    }

    let outcome: "WON" | "LOST";
    let resolutionReason: string;

    if (bet.structured_stat === "went_to_ot") {
      if (match.went_to_ot === null) {
        // Match FINISHED mais signal pas encore synchronisé -- ne tranche
        // jamais sur une absence de donnée, même prudence que le cas
        // total_points ci-dessous.
        summary.skipped.push({ betId: bet.id, reason: "signal de prolongation pas encore synchronisé" });
        continue;
      }
      outcome = match.went_to_ot ? "WON" : "LOST";
      resolutionReason = match.went_to_ot
        ? "Résolu automatiquement -- le match est allé en prolongation."
        : "Résolu automatiquement -- le match n'est pas allé en prolongation.";
    } else {
      if (match.home_score === null || match.away_score === null) {
        // Match FINISHED mais score pas encore synchronisé -- ne tranche
        // jamais sur une absence de donnée, même prudence que les 2 resolvers
        // ci-dessus.
        summary.skipped.push({ betId: bet.id, reason: "score du match pas encore synchronisé" });
        continue;
      }
      const total = match.home_score + match.away_score;
      const won =
        bet.structured_comparison === "UNDER" ? total < (bet.structured_threshold as number) : total > (bet.structured_threshold as number);
      outcome = won ? "WON" : "LOST";
      resolutionReason = `Résolu automatiquement via le score officiel du match (${total} points combinés).`;
    }

    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: resolutionReason,
        resolved_at: new Date().toISOString(),
        resolved_by_admin_id: null,
      })
      .eq("id", bet.id)
      .eq("status", "VALIDATED")
      .select("id")
      .maybeSingle();
    if (!updated) {
      summary.skipped.push({ betId: bet.id, reason: "déjà résolu entre-temps (concurrence)" });
      continue;
    }

    await recomputeBet(bet.id);
    summary.resolved.push({ betId: bet.id, outcome });
  }

  return summary;
}

type EligibleTeamStatBetRow = {
  id: string;
  match_id: string | null;
  structured_stat: string | null; // "{stat}" (TEAM_STAT, vise structured_team_id) ou "total_{stat}" (MATCH_TOTAL, combiné)
  structured_team_id: string | null; // non-null uniquement pour la forme "{stat}"
  structured_threshold: number | null;
  structured_comparison: "OVER" | "UNDER" | null;
};

// Libellés FR pour le message de résolution (23/08/2026, piece (a) suite --
// reb fait 1er en pilote, ast/fg3m/stl/blk généralisés dans la foulée, même
// geste). Distinct de teamStatCodes.ts::TEAM_STAT_LABELS_FR (celui-ci
// contient déjà "de l'équipe", pas adapté à "X {label} du match").
const TEAM_STAT_RESOLUTION_LABELS_FR: Record<TeamStatCode, string> = {
  pts: "points", reb: "rebonds", ast: "passes décisives", fg3m: "3-points réussis", stl: "interceptions", blk: "contres",
  oreb: "rebonds offensifs", ft: "% aux lancers francs", fg: "% au tir", fg3: "% à 3-points", fga: "tirs tentés",
};

// Chantier "% tir équipe" (24/08/2026, GAPS_OUVERTS.md) -- ft/fg/fg3 n'ont
// PAS de colonne pré-calculée dans stats_box_scores (contrairement aux
// autres TEAM_STAT_CODES, sommables directement) : besoin de sommer les 2
// colonnes brutes réussites/tentatives sur tous les joueurs de l'équipe
// pour CE match, puis calculer le ratio -- même principe que
// PCT_MAKES_ATTEMPTS_COLUMNS (résolution JOUEUR, plus haut dans ce fichier),
// agrégé équipe entière au lieu d'un seul joueur.
const TEAM_PCT_MAKES_ATTEMPTS_COLUMNS: Record<"ft" | "fg" | "fg3", readonly [string, string]> = {
  ft: ["ftm", "fta"],
  fg: ["fgm", "fga"],
  fg3: ["fg3m", "fg3a"],
};

/** Equipe NBA reelle (stats_equipes.team_id, numerique) pour une equipe de
 *  l'appli -- meme rapprochement par tricode que resolveNbaGameId()
 *  ci-dessus (dupliquee ici plutot que factorisee : cette fonction n'a pas
 *  besoin du match/de la date, juste de l'equipe). */
async function resolveNbaTeamId(supabase: SupabaseServiceClient, appTeamId: string): Promise<number | null> {
  const { data: team } = await supabase
    .from("teams")
    .select("abbreviation")
    .eq("id", appTeamId)
    .maybeSingle<{ abbreviation: string }>();
  if (!team?.abbreviation) return null;

  const { data: statsTeam } = await supabase
    .from("stats_equipes")
    .select("team_id")
    .eq("tricode", team.abbreviation)
    .maybeSingle<{ team_id: number }>();
  return statsTeam?.team_id ?? null;
}

/** Pièce (a) du chantier paris équipe, suite (GAPS_OUVERTS.md, 23/08/2026)
 *  -- résolution des paris stat équipe (les 2 formes, pour reb/ast/fg3m/stl/
 *  blk : TEAM_STAT "{stat}" pour une équipe précise, MATCH_TOTAL "total_{stat}"
 *  combiné -- reb fait 1er en pilote, généralisé aux 4 autres dans la foulée,
 *  même geste). Contrairement à resolveCalculableMatchTotalBets()
 *  (total_points, direct via matches.home_score/away_score) : ces stats
 *  n'existent PAS sur `matches`, seulement dans stats_box_scores (pipeline
 *  Data NBA) -- réutilise resolveNbaGameId() (déjà éprouvée côté joueur) +
 *  une nouvelle résolution d'équipe NBA (resolveNbaTeamId(), même
 *  rapprochement par tricode) pour filtrer/sommer les vraies stats. MATCH
 *  uniquement (même limite que la prédiction). */
export async function resolveCalculableTeamStatBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const eligibleStats = TEAM_STAT_CODES.flatMap((stat) => [stat, `total_${stat}`]);
  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_stat, structured_team_id, structured_threshold, structured_comparison")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .in("structured_stat", eligibleStats);
  const bets = (betsData ?? []) as EligibleTeamStatBetRow[];
  if (bets.length === 0) return summary;

  const matchIds = [...new Set(bets.map((b) => b.match_id).filter((id): id is string => id !== null))];
  const { data: matchesData } = await supabase.from("matches").select("id, status").in("id", matchIds);
  const finishedMatchIds = new Set(
    (matchesData ?? []).filter((m) => m.status === "FINISHED").map((m) => m.id as string)
  );

  const { data: pendingCorrections } = await supabase
    .from("correction_requests")
    .select("target_bet_id")
    .eq("status", "PENDING")
    .in(
      "target_bet_id",
      bets.map((b) => b.id)
    );
  const contestedBetIds = new Set((pendingCorrections ?? []).map((r) => r.target_bet_id as string));

  for (const bet of bets) {
    if (!bet.match_id || !finishedMatchIds.has(bet.match_id)) {
      summary.skipped.push({ betId: bet.id, reason: "match pas encore terminé" });
      continue;
    }
    if (contestedBetIds.has(bet.id)) {
      summary.skipped.push({ betId: bet.id, reason: "requête de correction en attente" });
      continue;
    }
    if (bet.structured_threshold === null || !bet.structured_comparison) {
      summary.skipped.push({ betId: bet.id, reason: "seuil/comparaison manquant" });
      continue;
    }
    const isTotal = bet.structured_stat?.startsWith("total_") ?? false;
    const stat = (isTotal ? bet.structured_stat?.slice("total_".length) : bet.structured_stat) as TeamStatCode;
    if (!isTotal && !bet.structured_team_id) {
      summary.skipped.push({ betId: bet.id, reason: "équipe manquante" });
      continue;
    }

    const gameId = await resolveNbaGameId(supabase, bet.match_id);
    if (!gameId) {
      summary.skipped.push({ betId: bet.id, reason: "match NBA correspondant introuvable" });
      continue;
    }

    // ft/fg/fg3 n'existent QUE sous la forme "équipe précise" (pas de
    // modèle/mécanisme "total_" pour un pourcentage combiné, décidé au
    // cadrage du chantier "% tir équipe") -- jamais produit par
    // structureAndScoreBet.ts, mais garde explicite ici plutôt qu'un calcul
    // silencieusement faux si ce cas apparaissait un jour.
    if (isTotal && TEAM_PERCENTAGE_STATS.has(stat)) {
      summary.skipped.push({ betId: bet.id, reason: "forme combinée non supportée pour un pourcentage" });
      continue;
    }

    let actualStat: number;
    if (isTotal) {
      const { data: rows } = await supabase.from("stats_box_scores").select(stat).eq("game_id", gameId);
      if (!rows || rows.length === 0) {
        summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour ce match" });
        continue;
      }
      actualStat = rows.reduce((sum, r) => sum + (((r as Record<string, number | null>)[stat]) ?? 0), 0);
    } else {
      const nbaTeamId = await resolveNbaTeamId(supabase, bet.structured_team_id as string);
      if (nbaTeamId === null) {
        summary.skipped.push({ betId: bet.id, reason: "équipe NBA correspondante introuvable" });
        continue;
      }
      if (TEAM_PERCENTAGE_STATS.has(stat)) {
        const [makesCol, attemptsCol] = TEAM_PCT_MAKES_ATTEMPTS_COLUMNS[stat as "ft" | "fg" | "fg3"];
        // Selection LITTERALE fixe (les 6 colonnes des 3 stats de %), pas un
        // template dynamique -- le typage genere de @supabase/supabase-js
        // pour .select() analyse la chaine litteralement, un template
        // `${a}, ${b}` casse ce typage (TS2352).
        const { data: rows } = await supabase
          .from("stats_box_scores")
          .select("ftm, fta, fgm, fga, fg3m, fg3a")
          .eq("game_id", gameId)
          .eq("team_id", nbaTeamId);
        if (!rows || rows.length === 0) {
          summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour cette équipe" });
          continue;
        }
        const totalMakes = rows.reduce((sum, r) => sum + (((r as Record<string, number | null>)[makesCol]) ?? 0), 0);
        const totalAttempts = rows.reduce((sum, r) => sum + (((r as Record<string, number | null>)[attemptsCol]) ?? 0), 0);
        actualStat = totalAttempts > 0 ? totalMakes / totalAttempts : 0;
      } else {
        const { data: rows } = await supabase
          .from("stats_box_scores")
          .select(stat)
          .eq("game_id", gameId)
          .eq("team_id", nbaTeamId);
        if (!rows || rows.length === 0) {
          summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour cette équipe" });
          continue;
        }
        actualStat = rows.reduce((sum, r) => sum + (((r as Record<string, number | null>)[stat]) ?? 0), 0);
      }
    }

    const won =
      bet.structured_comparison === "UNDER" ? actualStat < bet.structured_threshold : actualStat > bet.structured_threshold;
    const outcome: "WON" | "LOST" = won ? "WON" : "LOST";
    const actualStatLabel = TEAM_PERCENTAGE_STATS.has(stat) ? `${Math.round(actualStat * 100)}%` : actualStat;

    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason:
          `Résolu automatiquement via les statistiques officielles du match ` +
          `(${actualStatLabel} ${TEAM_STAT_RESOLUTION_LABELS_FR[stat]}).`,
        resolved_at: new Date().toISOString(),
        resolved_by_admin_id: null,
      })
      .eq("id", bet.id)
      .eq("status", "VALIDATED")
      .select("id")
      .maybeSingle();
    if (!updated) {
      summary.skipped.push({ betId: bet.id, reason: "déjà résolu entre-temps (concurrence)" });
      continue;
    }

    await recomputeBet(bet.id);
    summary.resolved.push({ betId: bet.id, outcome });
  }

  return summary;
}

type DuelOperandMeta = {
  kind: "PLAYER" | "TEAM";
  player_ids?: number[] | null;
  team_id?: string | null;
  stat: string;
};

type StructuredDuel = {
  left: DuelOperandMeta;
  right: DuelOperandMeta;
  relation: "GT" | "DIFF_LT" | "OR";
  multiplier: number;
};

type EligibleDuelBetRow = {
  id: string;
  match_id: string | null;
  structured_duel: StructuredDuel | null;
  structured_threshold: number | null;
};

/** Valeur réelle d'UN côté d'un duel pour le match résolu -- kind=PLAYER :
 *  somme la stat sur TOUS les player_ids de l'opérande (1 = joueur seul,
 *  2+ = cumul, même geste). kind=TEAM : même somme par team_id que
 *  resolveCalculableTeamStatBets() ci-dessus (team_id NBA résolu depuis
 *  l'uuid app via resolveNbaTeamId()). "min" à part (colonne `minutes`,
 *  format texte "12:34" -- minutesToFloat() comme le reste du fichier).
 *  null si les stats ne sont pas encore synchronisées pour ce match. */
async function resolveDuelOperandActual(
  supabase: SupabaseServiceClient, operand: DuelOperandMeta, gameId: string
): Promise<number | null> {
  // Cast vers une union de litéraux (pas `string` générique) -- necessaire
  // pour que le client Supabase typé résolve un vrai type de ligne au lieu
  // de GenericStringError sur un .select() dynamique (meme piège que
  // resolveCalculableTeamStatBets() ci-dessus, qui caste `stat` en
  // TeamStatCode pour la meme raison).
  const column = (operand.stat === "min" ? "minutes" : operand.stat) as
    | "pts" | "reb" | "ast" | "fg3m" | "stl" | "blk" | "fga" | "fg3a" | "oreb" | "minutes";

  if (operand.kind === "PLAYER") {
    const playerIds = operand.player_ids ?? [];
    if (playerIds.length === 0) return null;
    const { data: rows } = await supabase
      .from("stats_box_scores")
      .select(column)
      .eq("game_id", gameId)
      .in("player_id", playerIds);
    if (!rows || rows.length === 0) return null;
    return rows.reduce((sum, r) => {
      const raw = (r as Record<string, unknown>)[column];
      return sum + (operand.stat === "min" ? minutesToFloat(raw as string | null) : ((raw as number | null) ?? 0));
    }, 0);
  }

  const nbaTeamId = operand.team_id ? await resolveNbaTeamId(supabase, operand.team_id) : null;
  if (nbaTeamId === null) return null;
  const { data: rows } = await supabase
    .from("stats_box_scores")
    .select(column)
    .eq("game_id", gameId)
    .eq("team_id", nbaTeamId);
  if (!rows || rows.length === 0) return null;
  return rows.reduce((sum, r) => sum + (((r as Record<string, number | null>)[column]) ?? 0), 0);
}

/** Chantier comparaison/duel (24/08/2026, GAPS_OUVERTS.md) -- résolution
 *  des paris COMPARISON (2 côtés, structured_duel JSONB plutôt que
 *  structured_stat/structured_team_id -- cf. migration 20260824090000).
 *  Même limite MATCH uniquement que les autres resolvers de ce fichier.
 *  relation=GT : gagné si gauche > multiplier*droite. relation=DIFF_LT :
 *  gagné si |gauche-droite| < structured_threshold (égalité EXACTE au
 *  seuil traitée comme perdue, même convention que computeOutcome()
 *  ci-dessus). */
export async function resolveCalculableComparisonBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_duel, structured_threshold")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .not("structured_duel", "is", null);
  const bets = (betsData ?? []) as EligibleDuelBetRow[];
  if (bets.length === 0) return summary;

  const matchIds = [...new Set(bets.map((b) => b.match_id).filter((id): id is string => id !== null))];
  const { data: matchesData } = await supabase.from("matches").select("id, status").in("id", matchIds);
  const finishedMatchIds = new Set(
    (matchesData ?? []).filter((m) => m.status === "FINISHED").map((m) => m.id as string)
  );

  const { data: pendingCorrections } = await supabase
    .from("correction_requests")
    .select("target_bet_id")
    .eq("status", "PENDING")
    .in(
      "target_bet_id",
      bets.map((b) => b.id)
    );
  const contestedBetIds = new Set((pendingCorrections ?? []).map((r) => r.target_bet_id as string));

  for (const bet of bets) {
    if (!bet.match_id || !finishedMatchIds.has(bet.match_id)) {
      summary.skipped.push({ betId: bet.id, reason: "match pas encore terminé" });
      continue;
    }
    if (contestedBetIds.has(bet.id)) {
      summary.skipped.push({ betId: bet.id, reason: "requête de correction en attente" });
      continue;
    }
    if (!bet.structured_duel) {
      summary.skipped.push({ betId: bet.id, reason: "duel structuré manquant" });
      continue;
    }
    const { left, right, relation, multiplier } = bet.structured_duel;
    if ((relation === "DIFF_LT" || relation === "OR") && bet.structured_threshold === null) {
      summary.skipped.push({ betId: bet.id, reason: "seuil manquant pour ce duel" });
      continue;
    }

    const gameId = await resolveNbaGameId(supabase, bet.match_id);
    if (!gameId) {
      summary.skipped.push({ betId: bet.id, reason: "match NBA correspondant introuvable" });
      continue;
    }

    const actualLeft = await resolveDuelOperandActual(supabase, left, gameId);
    const actualRight = await resolveDuelOperandActual(supabase, right, gameId);
    if (actualLeft === null || actualRight === null) {
      summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour ce duel" });
      continue;
    }

    const won =
      relation === "GT"
        ? actualLeft > multiplier * actualRight
        : relation === "OR"
          ? actualLeft > (bet.structured_threshold as number) || actualRight > (bet.structured_threshold as number)
          : Math.abs(actualLeft - actualRight) < (bet.structured_threshold as number);
    const outcome: "WON" | "LOST" = won ? "WON" : "LOST";

    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason:
          `Résolu automatiquement via les statistiques officielles du match ` +
          `(gauche=${actualLeft.toFixed(1)}, droite=${actualRight.toFixed(1)}).`,
        resolved_at: new Date().toISOString(),
        resolved_by_admin_id: null,
      })
      .eq("id", bet.id)
      .eq("status", "VALIDATED")
      .select("id")
      .maybeSingle();
    if (!updated) {
      summary.skipped.push({ betId: bet.id, reason: "déjà résolu entre-temps (concurrence)" });
      continue;
    }

    await recomputeBet(bet.id);
    summary.resolved.push({ betId: bet.id, outcome });
  }

  return summary;
}

type ComboConditionRow = {
  kind: "PLAYER" | "TEAM";
  player_ids: number[] | null;
  team_id: string | null;
  stats: string[];
  threshold: number | null;
  comparison: "OVER" | "UNDER";
};

type StructuredCombo = { conditions: ComboConditionRow[] };

type EligibleComboBetRow = {
  id: string;
  match_id: string | null;
  structured_combo: StructuredCombo | null;
};

// Colonnes comptees potentiellement sommees dans une condition combo
// "somme" (2+ joueurs et/ou 2+ stats) -- meme restriction que cote
// service (supabase_context.py::_condition_proba, REGRESSION_STATS) : pas
// de dd/td/pourcentage, qui n'ont pas de valeur numerique directe a
// sommer.
type ComboSumColumn = "pts" | "reb" | "ast" | "fg3m" | "stl" | "blk" | "fga" | "fg3a" | "oreb";

/** Valeur réelle (true/false/null) d'UNE condition combo pour le match
 *  résolu (24/08/2026, GAPS_OUVERTS.md, chantier combo). 2 chemins, MÊME
 *  dispatch que _condition_proba() côté service (supabase_context.py) :
 *  - SIMPLE (1 entité, 1 stat) : réutilise TEL QUEL computeOutcome() --
 *    couverture complète (dd/td, pourcentages, comptées), déjà éprouvée
 *    pour les paris PLAYER classiques.
 *  - SOMME (plusieurs entités et/ou plusieurs stats) : additionne les
 *    valeurs brutes (stats comptées uniquement, déjà garanti côté
 *    structuration -- structureAndScoreBet.ts/supabase_context.py).
 *  null si les stats ne sont pas encore synchronisées pour ce match. */
async function resolveComboConditionSatisfied(
  supabase: SupabaseServiceClient, condition: ComboConditionRow, gameId: string
): Promise<boolean | null> {
  const isSimple = condition.kind === "TEAM"
    ? condition.stats.length === 1
    : condition.stats.length === 1 && (condition.player_ids?.length ?? 0) === 1;

  if (condition.kind === "PLAYER" && isSimple) {
    const playerId = condition.player_ids?.[0];
    if (!playerId) return null;
    const { data: rows } = await supabase
      .from("stats_box_scores")
      .select("minutes, pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb")
      .eq("game_id", gameId)
      .eq("player_id", playerId);
    if (!rows || rows.length === 0) return null;
    return computeOutcome(condition.stats[0] as StatCode, condition.threshold, condition.comparison, rows[0] as BoxScoreRow);
  }

  let total = 0;
  if (condition.kind === "PLAYER") {
    const playerIds = condition.player_ids ?? [];
    if (playerIds.length === 0) return null;
    const { data: rows } = await supabase
      .from("stats_box_scores")
      .select("minutes, pts, reb, ast, fg3m, stl, blk, fga, fg3a, oreb")
      .eq("game_id", gameId)
      .in("player_id", playerIds);
    if (!rows || rows.length === 0) return null;
    for (const r of rows as (Pick<BoxScoreRow, "minutes"> & Record<ComboSumColumn, number | null>)[]) {
      for (const s of condition.stats) {
        total += s === "min" ? minutesToFloat(r.minutes) : (r[s as ComboSumColumn] ?? 0);
      }
    }
  } else {
    const nbaTeamId = condition.team_id ? await resolveNbaTeamId(supabase, condition.team_id) : null;
    if (nbaTeamId === null) return null;
    const { data: rows } = await supabase
      .from("stats_box_scores")
      .select("pts, reb, ast, fg3m, stl, blk, fga, fg3a, oreb")
      .eq("game_id", gameId)
      .eq("team_id", nbaTeamId);
    if (!rows || rows.length === 0) return null;
    for (const r of rows as Record<ComboSumColumn, number | null>[]) {
      for (const s of condition.stats) {
        total += r[s as ComboSumColumn] ?? 0;
      }
    }
  }
  if (condition.threshold === null) return null;
  return condition.comparison === "UNDER" ? total < condition.threshold : total > condition.threshold;
}

/** Chantier combo (24/08/2026, GAPS_OUVERTS.md) -- résolution des paris
 *  COMBO (ET de N conditions, structured_combo JSONB -- cf. migration
 *  20260824100000). Même limite MATCH uniquement que les autres resolvers.
 *  Court-circuite dès la 1ère condition FAUSSE (le combo est perdu, peu
 *  importe que les conditions suivantes aient des stats synchronisées ou
 *  non) -- résout les paris perdus plus vite sans attendre des données qui
 *  ne changeront pas l'issue. */
export async function resolveCalculableComboBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_combo")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .not("structured_combo", "is", null);
  const bets = (betsData ?? []) as EligibleComboBetRow[];
  if (bets.length === 0) return summary;

  const matchIds = [...new Set(bets.map((b) => b.match_id).filter((id): id is string => id !== null))];
  const { data: matchesData } = await supabase.from("matches").select("id, status").in("id", matchIds);
  const finishedMatchIds = new Set(
    (matchesData ?? []).filter((m) => m.status === "FINISHED").map((m) => m.id as string)
  );

  const { data: pendingCorrections } = await supabase
    .from("correction_requests")
    .select("target_bet_id")
    .eq("status", "PENDING")
    .in(
      "target_bet_id",
      bets.map((b) => b.id)
    );
  const contestedBetIds = new Set((pendingCorrections ?? []).map((r) => r.target_bet_id as string));

  for (const bet of bets) {
    if (!bet.match_id || !finishedMatchIds.has(bet.match_id)) {
      summary.skipped.push({ betId: bet.id, reason: "match pas encore terminé" });
      continue;
    }
    if (contestedBetIds.has(bet.id)) {
      summary.skipped.push({ betId: bet.id, reason: "requête de correction en attente" });
      continue;
    }
    if (!bet.structured_combo || bet.structured_combo.conditions.length === 0) {
      summary.skipped.push({ betId: bet.id, reason: "combo structuré manquant" });
      continue;
    }

    const gameId = await resolveNbaGameId(supabase, bet.match_id);
    if (!gameId) {
      summary.skipped.push({ betId: bet.id, reason: "match NBA correspondant introuvable" });
      continue;
    }

    let allSatisfied = true;
    let incomplete = false;
    for (const condition of bet.structured_combo.conditions) {
      const satisfied = await resolveComboConditionSatisfied(supabase, condition, gameId);
      if (satisfied === null) {
        incomplete = true;
        break;
      }
      if (!satisfied) {
        allSatisfied = false;
        break;
      }
    }
    if (incomplete) {
      summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour ce combo" });
      continue;
    }

    const outcome: "WON" | "LOST" = allSatisfied ? "WON" : "LOST";

    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: `Résolu automatiquement via les statistiques officielles du match (${bet.structured_combo.conditions.length} conditions).`,
        resolved_at: new Date().toISOString(),
        resolved_by_admin_id: null,
      })
      .eq("id", bet.id)
      .eq("status", "VALIDATED")
      .select("id")
      .maybeSingle();
    if (!updated) {
      summary.skipped.push({ betId: bet.id, reason: "déjà résolu entre-temps (concurrence)" });
      continue;
    }

    await recomputeBet(bet.id);
    summary.resolved.push({ betId: bet.id, outcome });
  }

  return summary;
}

// ============================================================================
// Chantier "pari période" équipe + joueur (GAPS_OUVERTS.md, 24/08/2026).
// ============================================================================

type StructuredPeriod = {
  period: PeriodCode | null;
  outcome_kind: PeriodOutcomeKind | null;
  team_id: string | null;
  player_id: number | null;
  exact_count: boolean | null;
};

type EligiblePeriodBetRow = {
  id: string;
  match_id: string | null;
  structured_period: StructuredPeriod | null;
  structured_stat: string | null;
  structured_threshold: number | null;
  structured_comparison: "OVER" | "UNDER" | null;
};

/** Indices 0-based de matches.quarter_scores.{homeTeam,awayTeam} couverts
 *  par une période -- Q1-Q4 = 1 quart-temps, H1/H2 = 2 quarts-temps
 *  (mi-temps). Jamais appelée pour QUARTERS_WON_COUNT (period=null, lit les
 *  4 quarts-temps directement -- voir plus bas). */
function periodQuarterIndices(period: PeriodCode): number[] {
  switch (period) {
    case "Q1": return [0];
    case "Q2": return [1];
    case "Q3": return [2];
    case "Q4": return [3];
    case "H1": return [0, 1];
    case "H2": return [2, 3];
  }
}

function sumQuarterRange(scores: number[], indices: number[]): number {
  return indices.reduce((sum, i) => sum + (scores[i] ?? 0), 0);
}

/** Indices CUMULATIFS depuis le début du match jusqu'à la fin de la période
 *  donnée -- distinct de periodQuarterIndices() (segment de cette seule
 *  période). Utilisé UNIQUEMENT pour MARGIN : "l'écart à la fin du 3e
 *  quart-temps" désigne l'écart de score cumulé Q1+Q2+Q3, pas l'écart du
 *  seul 3e quart-temps (bug réel trouvé en cadrant, avant de coder les
 *  modèles Python -- corrigé ici et dans build_targets.py/supabase_context.py
 *  pour rester cohérent). TOTAL_POINTS reste un segment (periodQuarterIndices)
 *  -- "le total du 4e quart-temps" désigne bien les points marqués PENDANT
 *  cette période, pas le score cumulé. */
function cumulativeQuarterIndices(period: PeriodCode): number[] {
  switch (period) {
    case "Q1": return [0];
    case "Q2": return [0, 1];
    case "Q3": return [0, 1, 2];
    case "Q4": return [0, 1, 2, 3];
    case "H1": return [0, 1];
    case "H2": return [0, 1, 2, 3];
  }
}

/** Résultat ÉQUIPE réel pour un outcome_kind donné -- null si donnée
 *  insuffisante pour trancher (même convention que computeOutcome()
 *  ci-dessus, jamais résolu dans ce cas). `teamIsHome` : le côté visé par le
 *  pari (team_id résolu) est-il l'équipe DOMICILE de ce match -- null pour
 *  les outcome_kind symétriques (MARGIN/TOTAL_POINTS). */
function computePeriodTeamOutcome(
  outcomeKind: PeriodOutcomeKind,
  period: PeriodCode | null,
  teamIsHome: boolean | null,
  exactCount: boolean | null,
  threshold: number | null,
  comparison: "OVER" | "UNDER" | null,
  match: MatchPeriodRow
): { won: boolean; detail: string } | null {
  const qs = match.quarter_scores;
  if (!qs) return null;

  if (outcomeKind === "QUARTERS_WON_COUNT") {
    if (teamIsHome === null || threshold === null) return null;
    let wonCount = 0;
    for (let i = 0; i < 4; i++) {
      const home = qs.homeTeam[i] ?? 0;
      const away = qs.awayTeam[i] ?? 0;
      const teamScore = teamIsHome ? home : away;
      const oppScore = teamIsHome ? away : home;
      if (teamScore > oppScore) wonCount++;
    }
    const won = exactCount ? wonCount === threshold : comparison === "UNDER" ? wonCount < threshold : wonCount > threshold;
    return { won, detail: `${wonCount} quart(s)-temps remporté(s)` };
  }

  if (outcomeKind === "LEADS_HALF_RESULT") {
    if (teamIsHome === null || match.home_score === null || match.away_score === null) return null;
    const indices = periodQuarterIndices("H1");
    const homeHalf = sumQuarterRange(qs.homeTeam, indices);
    const awayHalf = sumQuarterRange(qs.awayTeam, indices);
    const teamLeadsAtHalf = teamIsHome ? homeHalf > awayHalf : awayHalf > homeHalf;
    if (!teamLeadsAtHalf) {
      // L'équipe visée ne mène même pas à la mi-temps -- le pari (qui
      // affirme qu'elle mène ET gagne/perd) est faux quel que soit le
      // résultat final, même mi-temps nulle traitée comme "ne mène pas".
      return { won: false, detail: `ne mène pas à la mi-temps (${homeHalf}-${awayHalf})` };
    }
    const teamWinsMatch = teamIsHome ? match.home_score > match.away_score : match.away_score > match.home_score;
    // comparison=OVER : le pari affirme que l'équipe qui mène GAGNE le match.
    // comparison=UNDER : le pari affirme qu'elle PERD (mène puis perd).
    const won = comparison === "UNDER" ? !teamWinsMatch : teamWinsMatch;
    return { won, detail: `mène à la mi-temps (${homeHalf}-${awayHalf}), ${teamWinsMatch ? "gagne" : "perd"} le match` };
  }

  if (outcomeKind === "MARGIN" || outcomeKind === "TOTAL_POINTS") {
    if (!period || threshold === null || !comparison) return null;
    // MARGIN = écart CUMULATIF depuis le début du match (cumulativeQuarterIndices).
    // TOTAL_POINTS = points marqués PENDANT cette période uniquement (segment).
    const indices = outcomeKind === "MARGIN" ? cumulativeQuarterIndices(period) : periodQuarterIndices(period);
    const homeSum = sumQuarterRange(qs.homeTeam, indices);
    const awaySum = sumQuarterRange(qs.awayTeam, indices);
    const actual = outcomeKind === "MARGIN" ? Math.abs(homeSum - awaySum) : homeSum + awaySum;
    const won = comparison === "UNDER" ? actual < threshold : actual > threshold;
    return { won, detail: `${actual} (${outcomeKind === "MARGIN" ? "écart cumulé" : "total combiné"})` };
  }

  if (!period) return null;
  const indices = periodQuarterIndices(period);
  const homeSum = sumQuarterRange(qs.homeTeam, indices);
  const awaySum = sumQuarterRange(qs.awayTeam, indices);

  if (outcomeKind === "QUARTER_WINNER" || outcomeKind === "HALF_WINNER") {
    if (teamIsHome === null) return null;
    const teamSum = teamIsHome ? homeSum : awaySum;
    const oppSum = teamIsHome ? awaySum : homeSum;
    return { won: teamSum > oppSum, detail: `${homeSum}-${awaySum} sur cette période` };
  }

  if (outcomeKind === "POINT_SHARE_PCT") {
    if (teamIsHome === null || threshold === null || !comparison || match.home_score === null || match.away_score === null) return null;
    const periodSum = teamIsHome ? homeSum : awaySum;
    const gameTotal = teamIsHome ? match.home_score : match.away_score;
    if (gameTotal === 0) return null;
    const actualPct = periodSum / gameTotal;
    const won = comparison === "UNDER" ? actualPct < threshold : actualPct > threshold;
    return { won, detail: `${(actualPct * 100).toFixed(0)}% des points sur cette période` };
  }

  return null;
}

/** Chantier "pari période" équipe (GAPS_OUVERTS.md, 24/08/2026) -- résolution
 *  des paris PERIOD, 2 formes distinguées par structured_period.player_id :
 *  ÉQUIPE (lit matches.quarter_scores DIRECTEMENT, même patron que
 *  resolveCalculableMatchTotalBets() -- aucune dépendance à
 *  stats_box_scores) ou JOUEUR (lit stats_box_scores_by_period, nouvelle
 *  table du chantier joueur+période construit le même jour -- réutilise
 *  computeOutcome()/COUNTING_STAT_COLUMN/PCT_MAKES_ATTEMPTS_COLUMNS déjà
 *  définis plus haut, colonnes identiques à stats_box_scores). MATCH
 *  uniquement, même limite que les autres resolvers de ce fichier. */
export async function resolveCalculablePeriodBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_period, structured_stat, structured_threshold, structured_comparison")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .not("structured_period", "is", null);
  const bets = (betsData ?? []) as EligiblePeriodBetRow[];
  if (bets.length === 0) return summary;

  const matchIds = [...new Set(bets.map((b) => b.match_id).filter((id): id is string => id !== null))];
  const { data: matchesData } = await supabase
    .from("matches")
    .select("id, status, home_team_id, away_team_id, home_score, away_score, quarter_scores")
    .in("id", matchIds);
  const matchById = new Map(((matchesData ?? []) as MatchPeriodRow[]).map((m) => [m.id, m]));

  const { data: pendingCorrections } = await supabase
    .from("correction_requests")
    .select("target_bet_id")
    .eq("status", "PENDING")
    .in(
      "target_bet_id",
      bets.map((b) => b.id)
    );
  const contestedBetIds = new Set((pendingCorrections ?? []).map((r) => r.target_bet_id as string));

  for (const bet of bets) {
    if (!bet.match_id || !bet.structured_period) {
      summary.skipped.push({ betId: bet.id, reason: "période structurée manquante" });
      continue;
    }
    if (contestedBetIds.has(bet.id)) {
      summary.skipped.push({ betId: bet.id, reason: "requête de correction en attente" });
      continue;
    }
    const match = matchById.get(bet.match_id);
    if (!match || match.status !== "FINISHED") {
      summary.skipped.push({ betId: bet.id, reason: "match pas encore terminé" });
      continue;
    }

    const sp = bet.structured_period;

    // ---- Forme JOUEUR ----
    if (sp.player_id !== null) {
      const stat = bet.structured_stat as StatCode | null;
      if (!stat || !sp.period) {
        summary.skipped.push({ betId: bet.id, reason: "stat/période joueur manquante" });
        continue;
      }
      const gameId = await resolveNbaGameId(supabase, bet.match_id);
      if (!gameId) {
        summary.skipped.push({ betId: bet.id, reason: "match NBA correspondant introuvable" });
        continue;
      }
      const dbPeriods = periodQuarterIndices(sp.period).map((i) => i + 1); // 0-based -> 1-4 stocké en base
      const { data: rows } = await supabase
        .from("stats_box_scores_by_period")
        .select("pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb, minutes")
        .eq("game_id", gameId)
        .eq("player_id", sp.player_id)
        .in("period", dbPeriods);
      if (!rows || rows.length === 0) {
        summary.skipped.push({ betId: bet.id, reason: "pas encore de stats par période synchronisées pour ce joueur" });
        continue;
      }
      const box: BoxScoreRow = {
        minutes: rows.reduce((sum, r) => sum + ((r.minutes as number | null) ?? 0), 0).toString(),
        pts: rows.reduce((sum, r) => sum + ((r.pts as number | null) ?? 0), 0),
        reb: rows.reduce((sum, r) => sum + ((r.reb as number | null) ?? 0), 0),
        ast: rows.reduce((sum, r) => sum + ((r.ast as number | null) ?? 0), 0),
        fg3m: rows.reduce((sum, r) => sum + ((r.fg3m as number | null) ?? 0), 0),
        stl: rows.reduce((sum, r) => sum + ((r.stl as number | null) ?? 0), 0),
        blk: rows.reduce((sum, r) => sum + ((r.blk as number | null) ?? 0), 0),
        ftm: rows.reduce((sum, r) => sum + ((r.ftm as number | null) ?? 0), 0),
        fta: rows.reduce((sum, r) => sum + ((r.fta as number | null) ?? 0), 0),
        fgm: rows.reduce((sum, r) => sum + ((r.fgm as number | null) ?? 0), 0),
        fga: rows.reduce((sum, r) => sum + ((r.fga as number | null) ?? 0), 0),
        fg3a: rows.reduce((sum, r) => sum + ((r.fg3a as number | null) ?? 0), 0),
        oreb: rows.reduce((sum, r) => sum + ((r.oreb as number | null) ?? 0), 0),
      };
      const won = computeOutcome(stat, bet.structured_threshold, bet.structured_comparison, box);
      if (won === null) {
        summary.skipped.push({ betId: bet.id, reason: "seuil/comparaison manquant pour ce pari joueur+période" });
        continue;
      }
      const outcome: "WON" | "LOST" = won ? "WON" : "LOST";
      const { data: updated } = await supabase
        .from("bets")
        .update({
          status: outcome,
          resolution_reason: `Résolu automatiquement via les statistiques officielles du match, ${PERIOD_LABELS_FR[sp.period]}.`,
          resolved_at: new Date().toISOString(),
          resolved_by_admin_id: null,
        })
        .eq("id", bet.id)
        .eq("status", "VALIDATED")
        .select("id")
        .maybeSingle();
      if (!updated) {
        summary.skipped.push({ betId: bet.id, reason: "déjà résolu entre-temps (concurrence)" });
        continue;
      }
      await recomputeBet(bet.id);
      summary.resolved.push({ betId: bet.id, outcome });
      continue;
    }

    // ---- Forme ÉQUIPE ----
    if (!sp.outcome_kind) {
      summary.skipped.push({ betId: bet.id, reason: "outcome_kind manquant" });
      continue;
    }
    let teamIsHome: boolean | null = null;
    if (TEAM_TARGETED_PERIOD_OUTCOMES.has(sp.outcome_kind)) {
      if (!sp.team_id || !match.home_team_id || !match.away_team_id) {
        summary.skipped.push({ betId: bet.id, reason: "équipe visée manquante" });
        continue;
      }
      if (sp.team_id !== match.home_team_id && sp.team_id !== match.away_team_id) {
        summary.skipped.push({ betId: bet.id, reason: "équipe visée hors de ce match" });
        continue;
      }
      teamIsHome = sp.team_id === match.home_team_id;
    }

    const result = computePeriodTeamOutcome(
      sp.outcome_kind,
      sp.period,
      teamIsHome,
      sp.exact_count,
      bet.structured_threshold,
      bet.structured_comparison,
      match
    );
    if (!result) {
      summary.skipped.push({ betId: bet.id, reason: "pas encore de score par quart-temps synchronisé pour ce match" });
      continue;
    }
    const outcome: "WON" | "LOST" = result.won ? "WON" : "LOST";

    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: `Résolu automatiquement via les statistiques officielles du match (${result.detail}).`,
        resolved_at: new Date().toISOString(),
        resolved_by_admin_id: null,
      })
      .eq("id", bet.id)
      .eq("status", "VALIDATED")
      .select("id")
      .maybeSingle();
    if (!updated) {
      summary.skipped.push({ betId: bet.id, reason: "déjà résolu entre-temps (concurrence)" });
      continue;
    }

    await recomputeBet(bet.id);
    summary.resolved.push({ betId: bet.id, outcome });
  }

  return summary;
}

type StructuredRosterSplit = {
  kind: "STARTERS_SUM" | "BENCH_SUM" | "STARTERS_SHARE";
  team_id: string;
  stat: string;
};

type EligibleRosterSplitBetRow = {
  id: string;
  match_id: string | null;
  structured_roster_split: StructuredRosterSplit | null;
  structured_stat: string | null;
  structured_threshold: number | null;
  structured_comparison: "OVER" | "UNDER" | null;
};

type RosterSplitBoxRow = Omit<BoxScoreRow, "minutes"> & { position: string | null };

function sumBoxRows(rows: RosterSplitBoxRow[]): BoxScoreRow {
  const sum = (key: keyof Omit<BoxScoreRow, "minutes">) => rows.reduce((s, r) => s + (r[key] ?? 0), 0);
  return {
    minutes: null,
    pts: sum("pts"), reb: sum("reb"), ast: sum("ast"), fg3m: sum("fg3m"),
    stl: sum("stl"), blk: sum("blk"), ftm: sum("ftm"), fta: sum("fta"),
    fgm: sum("fgm"), fga: sum("fga"), fg3a: sum("fg3a"), oreb: sum("oreb"),
  };
}

/** Chantier "5 majeur / banc" (GAPS_OUVERTS.md, 24/08/2026) -- résolution
 *  des paris ROSTER_SPLIT. Lit stats_box_scores DIRECTEMENT (colonne
 *  position, "F"/"C"/"G" = titulaire, "" = remplaçant -- même chantier),
 *  pas de nouvelle table. resolveNbaTeamId() (défini plus haut, chantier
 *  % tir équipe) fait le pont app teams.id (uuid) -> stats_equipes.team_id
 *  (numérique NBA) -- stats_box_scores.team_id est dans cet espace NBA,
 *  PAS l'uuid app (piège déjà rencontré par les resolvers précédents,
 *  réutilisé ici plutôt que recontourné). MATCH uniquement, même limite
 *  que les autres resolvers de ce fichier. */
export async function resolveCalculableRosterSplitBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_roster_split, structured_stat, structured_threshold, structured_comparison")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .not("structured_roster_split", "is", null);
  const bets = (betsData ?? []) as EligibleRosterSplitBetRow[];
  if (bets.length === 0) return summary;

  const matchIds = [...new Set(bets.map((b) => b.match_id).filter((id): id is string => id !== null))];
  const { data: matchesData } = await supabase.from("matches").select("id, status").in("id", matchIds);
  const matchById = new Map(((matchesData ?? []) as { id: string; status: string }[]).map((m) => [m.id, m]));

  const { data: pendingCorrections } = await supabase
    .from("correction_requests")
    .select("target_bet_id")
    .eq("status", "PENDING")
    .in(
      "target_bet_id",
      bets.map((b) => b.id)
    );
  const contestedBetIds = new Set((pendingCorrections ?? []).map((r) => r.target_bet_id as string));

  for (const bet of bets) {
    if (!bet.match_id || !bet.structured_roster_split || !bet.structured_stat) {
      summary.skipped.push({ betId: bet.id, reason: "5 majeur/banc structuré manquant" });
      continue;
    }
    if (contestedBetIds.has(bet.id)) {
      summary.skipped.push({ betId: bet.id, reason: "requête de correction en attente" });
      continue;
    }
    const match = matchById.get(bet.match_id);
    if (!match || match.status !== "FINISHED") {
      summary.skipped.push({ betId: bet.id, reason: "match pas encore terminé" });
      continue;
    }

    const gameId = await resolveNbaGameId(supabase, bet.match_id);
    if (!gameId) {
      summary.skipped.push({ betId: bet.id, reason: "match NBA correspondant introuvable" });
      continue;
    }
    const rs = bet.structured_roster_split;
    const nbaTeamId = await resolveNbaTeamId(supabase, rs.team_id);
    if (nbaTeamId === null) {
      summary.skipped.push({ betId: bet.id, reason: "équipe NBA correspondante introuvable" });
      continue;
    }

    const { data: rows } = await supabase
      .from("stats_box_scores")
      .select("player_id, position, pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb")
      .eq("game_id", gameId)
      .eq("team_id", nbaTeamId);
    if (!rows || rows.length === 0) {
      summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour cette équipe" });
      continue;
    }
    const boxRows = rows as RosterSplitBoxRow[];
    const starters = boxRows.filter((r) => r.position);
    const bench = boxRows.filter((r) => !r.position);

    const stat = bet.structured_stat as StatCode;
    let won: boolean | null;
    let detail: string;
    if (rs.kind === "STARTERS_SUM") {
      won = computeOutcome(stat, bet.structured_threshold, bet.structured_comparison, sumBoxRows(starters));
      detail = `total titulaires (${starters.length} joueurs, position renseignée)`;
    } else if (rs.kind === "BENCH_SUM") {
      won = computeOutcome(stat, bet.structured_threshold, bet.structured_comparison, sumBoxRows(bench));
      detail = `total banc (${bench.length} joueurs, position vide)`;
    } else {
      // STARTERS_SHARE : pas un seuil brut, une FRACTION du total équipe --
      // même calcul que POINT_SHARE_PCT (computePeriodTeamOutcome plus haut).
      if (bet.structured_threshold === null || !bet.structured_comparison) {
        won = null;
        detail = "";
      } else {
        const starterTotal = (sumBoxRows(starters)[stat as keyof BoxScoreRow] as number | null) ?? 0;
        const teamTotal = (sumBoxRows(boxRows)[stat as keyof BoxScoreRow] as number | null) ?? 0;
        const share = teamTotal > 0 ? starterTotal / teamTotal : null;
        won = share === null ? null : bet.structured_comparison === "UNDER" ? share < bet.structured_threshold : share > bet.structured_threshold;
        detail = share === null ? "" : `${(share * 100).toFixed(0)}% des points de l'équipe marqués par les titulaires`;
      }
    }

    if (won === null) {
      summary.skipped.push({ betId: bet.id, reason: "seuil/comparaison manquant pour ce pari 5 majeur/banc" });
      continue;
    }
    const outcome: "WON" | "LOST" = won ? "WON" : "LOST";
    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: `Résolu automatiquement via les statistiques officielles du match (${detail}).`,
        resolved_at: new Date().toISOString(),
        resolved_by_admin_id: null,
      })
      .eq("id", bet.id)
      .eq("status", "VALIDATED")
      .select("id")
      .maybeSingle();
    if (!updated) {
      summary.skipped.push({ betId: bet.id, reason: "déjà résolu entre-temps (concurrence)" });
      continue;
    }

    await recomputeBet(bet.id);
    summary.resolved.push({ betId: bet.id, outcome });
  }

  return summary;
}
