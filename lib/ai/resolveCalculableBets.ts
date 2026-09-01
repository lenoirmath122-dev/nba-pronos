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
export function minutesToFloat(raw: string | null): number {
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
const COUNTING_STAT_COLUMN: Partial<Record<StatCode, "pts" | "reb" | "ast" | "fg3m" | "stl" | "blk" | "fga" | "fg3a" | "oreb" | "plus_minus">> = {
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
  // Bug réel trouvé le 25/08/2026 (étape 4, en construisant la résolution du
  // superlatif implicite) : "plus_minus" est une stat pariable depuis le
  // 24/08/2026 (chantier "petits gains groupés", étape 2) mais n'avait
  // JAMAIS été ajoutée ici -- toute résolution passant par computeOutcome()
  // (PLAYER classique, COMBO condition simple, ROSTER_SPLIT, ROSTER_COUNT)
  // retombait silencieusement sur `actual=0` pour cette stat (COUNTING_STAT_COLUMN[stat]
  // undefined -> box[undefined] -> 0), résolvant TOUJOURS "LOST" quel que
  // soit le vrai +/- du joueur. Corrigé ici + dans tous les SELECT qui
  // alimentent ces chemins (voir plus bas).
  plus_minus: "plus_minus",
};

const PCT_MAKES_ATTEMPTS_COLUMNS: Partial<Record<StatCode, ["ftm" | "fgm" | "fg3m", "fta" | "fga" | "fg3a"]>> = {
  ft: ["ftm", "fta"],
  fg: ["fgm", "fga"],
  fg3: ["fg3m", "fg3a"],
};

export type BoxScoreRow = {
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
  plus_minus: number | null;
  technical_fouls: number | null;
};

/** Même définition EXACTE que build_targets.py (Cadrage/Stats/scripts,
 *  Data NBA) -- >= 10 dans au moins 2 des 5 catégories = double-double,
 *  >= 3 = triple-double. Ne PAS diverger : c'est la même convention que
 *  celle utilisée pour entraîner les modèles dd/td. */
export function categoriesAtTen(box: BoxScoreRow): number {
  return [box.pts, box.reb, box.ast, box.stl, box.blk].filter((v) => (v ?? 0) >= 10).length;
}

/** true = pari gagné, false = perdu, null = donnée insuffisante pour
 *  trancher (jamais résolu dans ce cas -- pas de statut "annulé"/"push"
 *  dans ce projet, une égalité EXACTE au seuil est traitée comme perdue,
 *  cohérent avec "plus de X" qui exige STRICTEMENT plus que X). */
export function computeOutcome(
  stat: StatCode,
  threshold: number | null,
  comparison: "OVER" | "UNDER" | null,
  box: BoxScoreRow
): boolean | null {
  if (stat === "dd" || stat === "td") {
    const categories = categoriesAtTen(box);
    return stat === "dd" ? categories >= 2 : categories >= 3;
  }

  // "tech" ajoutee le 25/08/2026 (etape 5, GAPS_OUVERTS.md) -- AUSSI dans
  // NO_THRESHOLD_STATS mais PAS dd/td (probabilite directe pour une raison
  // differente : au moins 1 faute technique, pas un seuil de categories).
  // Bug reel trouve en cablant cette resolution : le check generique
  // `NO_THRESHOLD_STATS.has(stat)` ci-dessus aurait fait tomber "tech" dans
  // la branche dd/td (categoriesAtTen >= 3, comme "td") -- jamais teste
  // avant d'ajouter "tech" a NO_THRESHOLD_STATS, corrige avant tout
  // deploiement.
  if (stat === "tech") {
    return (box.technical_fouls ?? 0) >= 1;
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
      .select("minutes, pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb, plus_minus, technical_fouls")
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
        .select("minutes, pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb, plus_minus, technical_fouls")
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
  structured_negation: boolean | null;
};

type MatchScoreRow = {
  id: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  went_to_ot: boolean | null;
};

export type QuarterScores = { homeTeam: number[]; awayTeam: number[] };

export type MatchPeriodRow = {
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
    .select("id, match_id, structured_stat, structured_threshold, structured_comparison, structured_negation")
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
      // Négation (même correctif que had_buzzer_beater, GAPS_OUVERTS.md
      // 25/08/2026, appliqué ici par précaution même sans exemple réel du
      // corpus -- "le match n'ira pas en prolongation" resterait sinon mal
      // résolu comme had_buzzer_beater l'a été).
      {
        const won = bet.structured_negation ? !match.went_to_ot : match.went_to_ot;
        outcome = won ? "WON" : "LOST";
      }
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

type ComboConditionGroup = { or: ComboConditionRow[] };

type StructuredCombo = { conditions: ComboConditionGroup[] };

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
type ComboSumColumn = "pts" | "reb" | "ast" | "fg3m" | "stl" | "blk" | "fga" | "fg3a" | "oreb" | "plus_minus";

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
      .select("minutes, pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb, plus_minus, technical_fouls")
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
      .select("minutes, pts, reb, ast, fg3m, stl, blk, fga, fg3a, oreb, plus_minus")
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
      .select("pts, reb, ast, fg3m, stl, blk, fga, fg3a, oreb, plus_minus")
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

/** Valeur réelle (true/false/null) d'UN GROUPE combo -- étape 7 du plan de
 *  reprise post-audit (25/08/2026, GAPS_OUVERTS.md, "OU imbriqué dans un
 *  ET"). 1 seule condition dans le groupe : comportement INCHANGÉ (délègue
 *  directement à resolveComboConditionSatisfied()). 2+ conditions : le
 *  groupe est VRAI dès qu'UNE SEULE condition l'est (court-circuite sur le
 *  premier true trouvé, même esprit que le court-circuit du ET global sur
 *  le premier false) -- NULL (données pas encore synchronisées) seulement
 *  si AUCUNE condition n'est trouvée vraie ET qu'au moins une reste
 *  incomplète (une donnée manquante ne peut jamais, à elle seule, faire
 *  perdre un groupe OU si une autre condition du même groupe est déjà
 *  confirmée vraie). */
async function resolveComboGroupSatisfied(
  supabase: SupabaseServiceClient, group: ComboConditionGroup, gameId: string
): Promise<boolean | null> {
  let sawIncomplete = false;
  for (const condition of group.or) {
    const satisfied = await resolveComboConditionSatisfied(supabase, condition, gameId);
    if (satisfied === true) return true;
    if (satisfied === null) sawIncomplete = true;
  }
  return sawIncomplete ? null : false;
}

/** Chantier combo (24/08/2026, GAPS_OUVERTS.md ; étendu étape 7,
 *  25/08/2026, "OU imbriqué dans un ET") -- résolution des paris COMBO (ET
 *  de N GROUPES, structured_combo JSONB -- même colonne que le chantier
 *  d'origine, migration 20260824100000, juste une forme imbriquée en plus
 *  à l'intérieur -- aucune nouvelle migration nécessaire). Même limite
 *  MATCH uniquement que les autres resolvers. Court-circuite dès le 1er
 *  GROUPE FAUX (le combo est perdu, peu importe
 *  que les groupes suivants aient des stats synchronisées ou non) --
 *  résout les paris perdus plus vite sans attendre des données qui ne
 *  changeront pas l'issue. */
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
    for (const group of bet.structured_combo.conditions) {
      const satisfied = await resolveComboGroupSatisfied(supabase, group, gameId);
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
        resolution_reason: `Résolu automatiquement via les statistiques officielles du match (${bet.structured_combo.conditions.length} groupes).`,
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
export function periodQuarterIndices(period: PeriodCode): number[] {
  switch (period) {
    case "Q1": return [0];
    case "Q2": return [1];
    case "Q3": return [2];
    case "Q4": return [3];
    case "H1": return [0, 1];
    case "H2": return [2, 3];
  }
}

export function sumQuarterRange(scores: number[], indices: number[]): number {
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
export function cumulativeQuarterIndices(period: PeriodCode): number[] {
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
export function computePeriodTeamOutcome(
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
        // stats_box_scores_by_period n'a PAS de colonne plus_minus (cf.
        // migration 20260824150000) -- un pari joueur+période sur cette
        // stat resterait donc structurable (plus_minus est dans
        // REGRESSION_STATS côté service) mais mal résolu ici (toujours 0).
        // Gap réel découvert le 25/08/2026 (étape 4) en généralisant
        // COUNTING_STAT_COLUMN, noté dans GAPS_OUVERTS.md -- pas corrigé
        // maintenant (demande un nouveau backfill, hors périmètre de ce
        // chantier).
        plus_minus: null,
        // Même limite pour technical_fouls (étape 5, GAPS_OUVERTS.md) --
        // "tech" n'a de toute façon pas de sens à l'échelle d'une seule
        // période (probabilité directe "au moins 1 sur le match entier").
        technical_fouls: null,
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

export type RosterSplitBoxRow = Omit<BoxScoreRow, "minutes"> & { position: string | null };

export function sumBoxRows(rows: RosterSplitBoxRow[]): BoxScoreRow {
  const sum = (key: keyof Omit<BoxScoreRow, "minutes">) => rows.reduce((s, r) => s + (r[key] ?? 0), 0);
  return {
    minutes: null,
    pts: sum("pts"), reb: sum("reb"), ast: sum("ast"), fg3m: sum("fg3m"),
    stl: sum("stl"), blk: sum("blk"), ftm: sum("ftm"), fta: sum("fta"),
    fgm: sum("fgm"), fga: sum("fga"), fg3a: sum("fg3a"), oreb: sum("oreb"),
    plus_minus: sum("plus_minus"),
    technical_fouls: sum("technical_fouls"),
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
      .select("player_id, position, pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb, plus_minus, technical_fouls")
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

// ============================================================================
// Chantier "comptage roster-wide" (étape 3 du plan de reprise post-audit,
// 25/08/2026, GAPS_OUVERTS.md).
// ============================================================================

type StructuredRosterCount = {
  scope: "MATCH" | "team1" | "team2";
  pool: "ALL" | "STARTERS";
  count_relation: "AT_LEAST" | "MORE_THAN" | "FEWER_THAN";
  min_players: number;
  /** Bassin RÉEL résolu côté service au moment du calcul de proba (via
   *  _team_rotation()/_team_starters()) -- jamais recalculé ici, même leçon
   *  que structured_duel/structured_combo (structured_player_id) : la
   *  résolution doit voir EXACTEMENT le même bassin que la prédiction. */
  player_ids: number[];
};

type EligibleRosterCountBetRow = {
  id: string;
  match_id: string | null;
  structured_roster_count: StructuredRosterCount | null;
  structured_stat: string | null;
  structured_threshold: number | null;
  structured_comparison: "OVER" | "UNDER" | null;
};

/** Ligne "vide" pour un joueur du bassin ABSENT du box score du match --
 *  càd un vrai DNP (stats_box_scores ne contient QUE des lignes "a joué",
 *  cf. refresh_daily.py) -- traité comme 0 partout, JAMAIS comme une
 *  donnée manquante. Distinct du chantier combo (resolveComboConditionSatisfied)
 *  qui renvoie null (résolution différée) dans ce même cas : là-bas, les
 *  joueurs sont NOMMÉS explicitement par le parieur (un DNP inattendu est
 *  ambigu, mieux vaut attendre confirmation) ; ici, le bassin est
 *  structurellement un grand groupe où des DNP sont un résultat NORMAL et
 *  attendu -- le pari DNP lui-même (§ "au moins N joueurs ne jouent aucune
 *  minute") dépend justement de ce comptage pour être résolu du tout. */
const ZERO_BOX_ROW: BoxScoreRow = {
  minutes: null, pts: 0, reb: 0, ast: 0, fg3m: 0, stl: 0, blk: 0,
  ftm: 0, fta: 0, fgm: 0, fga: 0, fg3a: 0, oreb: 0, plus_minus: 0, technical_fouls: 0,
};

/** Résolution des paris ROSTER_COUNT -- lit stats_box_scores PAR
 *  player_id (pas par équipe comme ROSTER_SPLIT, le bassin peut couvrir les
 *  2 équipes à la fois), reconstitue le nombre réel de joueurs du bassin
 *  qui remplissent structured_stat/structured_threshold/structured_comparison
 *  (computeOutcome(), même helper que le reste de ce fichier) puis compare
 *  ce compte à min_players/count_relation. MATCH uniquement, même limite
 *  que les autres resolvers. */
export async function resolveCalculableRosterCountBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_roster_count, structured_stat, structured_threshold, structured_comparison")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .not("structured_roster_count", "is", null);
  const bets = (betsData ?? []) as EligibleRosterCountBetRow[];
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
    if (!bet.match_id || !bet.structured_roster_count || !bet.structured_stat) {
      summary.skipped.push({ betId: bet.id, reason: "comptage roster-wide structuré manquant" });
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

    const rc = bet.structured_roster_count;
    if (rc.player_ids.length === 0) {
      summary.skipped.push({ betId: bet.id, reason: "aucun joueur dans le bassin structuré" });
      continue;
    }

    // "Synchronisé ?" : au moins UNE ligne pour ce match, tout joueur/toute
    // équipe confondus (PAS filtré par player_ids -- un bassin de 10-30
    // joueurs peut légitimement compter des DNP réels, cf. ZERO_BOX_ROW
    // ci-dessus, donc un résultat vide filtré par player_ids ne prouve
    // rien sur l'état de la synchro).
    const { data: anyRows } = await supabase.from("stats_box_scores").select("player_id").eq("game_id", gameId).limit(1);
    if (!anyRows || anyRows.length === 0) {
      summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour ce match" });
      continue;
    }

    const { data: rows } = await supabase
      .from("stats_box_scores")
      .select("player_id, minutes, pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb, plus_minus, technical_fouls")
      .eq("game_id", gameId)
      .in("player_id", rc.player_ids);
    const boxByPlayer = new Map(
      ((rows ?? []) as (BoxScoreRow & { player_id: number })[]).map((r) => [r.player_id, r])
    );

    const stat = bet.structured_stat as StatCode;
    let incomplete = false;
    let count = 0;
    for (const playerId of rc.player_ids) {
      const box = boxByPlayer.get(playerId) ?? ZERO_BOX_ROW;
      const satisfied = computeOutcome(stat, bet.structured_threshold, bet.structured_comparison, box);
      if (satisfied === null) {
        incomplete = true;
        break;
      }
      if (satisfied) count += 1;
    }
    if (incomplete) {
      summary.skipped.push({ betId: bet.id, reason: "seuil/comparaison manquant pour ce comptage roster-wide" });
      continue;
    }

    const won =
      rc.count_relation === "AT_LEAST" ? count >= rc.min_players
      : rc.count_relation === "MORE_THAN" ? count > rc.min_players
      : count < rc.min_players;
    const outcome: "WON" | "LOST" = won ? "WON" : "LOST";

    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: `Résolu automatiquement via les statistiques officielles du match (${count}/${rc.player_ids.length} joueurs du bassin remplissent la condition).`,
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
// Chantier "meilleur marqueur" / superlatif implicite (étape 4 du plan de
// reprise post-audit, 25/08/2026, GAPS_OUVERTS.md).
// ============================================================================

type StructuredSuperlative = { stat: string };

type EligibleSuperlativeBetRow = {
  id: string;
  match_id: string | null;
  structured_player_id: number | null;
  structured_superlative: StructuredSuperlative | null;
};

/** Valeur brute réelle d'une stat comptée pour 1 ligne de box score --
 *  même logique que la branche "comptée" de computeOutcome() (min à part,
 *  reste via COUNTING_STAT_COLUMN), extraite ici car le superlatif compare
 *  des VALEURS entre elles plutôt qu'une valeur à un seuil fixe. */
export function rawStatValue(stat: StatCode, box: BoxScoreRow): number {
  return stat === "min" ? minutesToFloat(box.minutes) : (box[COUNTING_STAT_COLUMN[stat]!] ?? 0);
}

/** Résolution des paris SUPERLATIVE -- "X marque plus de {stat} que TOUT
 *  AUTRE joueur du match" (cf. structureSuperlativeBet.ts). Contrairement
 *  aux autres resolvers de ce fichier, lit TOUS les joueurs du match (les
 *  2 équipes, sans filtre team_id/player_ids -- l'ensemble de comparaison
 *  N'EST PAS un bassin pré-résolu comme ROSTER_COUNT, c'est litéralement
 *  "tout le monde qui a une ligne réelle dans ce match"), donc PAS besoin
 *  de persister un bassin de player_ids ici (structured_player_id suffit à
 *  identifier le joueur visé, structured_superlative ne porte que `stat`).
 *  Un joueur absent du box score (DNP) est traité comme une ligne à 0 --
 *  même convention que ZERO_BOX_ROW (ROSTER_COUNT) -- que ce soit le joueur
 *  visé (perd quasi certainement) ou un autre (ne compte simplement pas
 *  comme un concurrent réel, ce qui est déjà le comportement naturel en ne
 *  l'incluant pas dans boxRows). MATCH uniquement, même limite que les
 *  autres resolvers. */
export async function resolveCalculableSuperlativeBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_player_id, structured_superlative")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .not("structured_superlative", "is", null);
  const bets = (betsData ?? []) as EligibleSuperlativeBetRow[];
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
    if (!bet.match_id || !bet.structured_superlative || bet.structured_player_id === null) {
      summary.skipped.push({ betId: bet.id, reason: "superlatif structuré manquant" });
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

    const { data: rows } = await supabase
      .from("stats_box_scores")
      .select("player_id, minutes, pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb, plus_minus")
      .eq("game_id", gameId);
    if (!rows || rows.length === 0) {
      summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour ce match" });
      continue;
    }

    const stat = bet.structured_superlative.stat as StatCode;
    const boxRows = rows as (BoxScoreRow & { player_id: number })[];
    const playerBox = boxRows.find((r) => r.player_id === bet.structured_player_id);
    const playerValue = rawStatValue(stat, playerBox ?? ZERO_BOX_ROW);

    // Gagné si CHAQUE autre joueur du match a une valeur STRICTEMENT
    // inférieure (égalité = perdu, même convention que computeOutcome()).
    const won = boxRows
      .filter((r) => r.player_id !== bet.structured_player_id)
      .every((r) => rawStatValue(stat, r) < playerValue);
    const outcome: "WON" | "LOST" = won ? "WON" : "LOST";

    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: `Résolu automatiquement via les statistiques officielles du match (${playerValue} vs le reste du match).`,
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
// Chantier "événements de match" (étape 5 du plan de reprise post-audit,
// 25/08/2026, GAPS_OUVERTS.md) -- total_timeouts/had_backcourt_turnover,
// bet_subject=MATCH_TOTAL. Résolveur SÉPARÉ de resolveCalculableMatchTotalBets()
// ci-dessus (total_points/went_to_ot) : celui-ci lit `matches` (app-side,
// peuplé par lib/sync/results.ts), ces 2 nouvelles stats vivent côté
// Data NBA (stats_matchs/stats_box_scores, peuplées par refresh_daily.py) --
// même pont resolveNbaGameId() que resolveCalculableTeamStatBets().
// ============================================================================

type EligibleGameEventMatchTotalBetRow = {
  id: string;
  match_id: string | null;
  structured_stat: string | null;
  structured_threshold: number | null;
  structured_comparison: "OVER" | "UNDER" | null;
  structured_negation: boolean | null;
};

export async function resolveCalculableGameEventBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_stat, structured_threshold, structured_comparison, structured_negation")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .in("structured_stat", ["total_timeouts", "had_backcourt_turnover", "had_buzzer_beater"])
    .is("structured_player_id", null); // discrimine des paris JOUEUR, même garde que resolveCalculableMatchTotalBets()
  const bets = (betsData ?? []) as EligibleGameEventMatchTotalBetRow[];
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
    // had_backcourt_turnover n'a ni seuil ni comparaison (probabilité
    // directe) -- garde restreinte à total_timeouts, même principe que la
    // garde symétrique côté structuration (NO_THRESHOLD_MATCH_STATS).
    if (bet.structured_stat === "total_timeouts" && (bet.structured_threshold === null || !bet.structured_comparison)) {
      summary.skipped.push({ betId: bet.id, reason: "seuil/comparaison manquant" });
      continue;
    }

    const gameId = await resolveNbaGameId(supabase, bet.match_id);
    if (!gameId) {
      summary.skipped.push({ betId: bet.id, reason: "match NBA correspondant introuvable" });
      continue;
    }

    let outcome: "WON" | "LOST";
    let resolutionReason: string;

    if (bet.structured_stat === "total_timeouts") {
      const { data: match } = await supabase
        .from("stats_matchs")
        .select("home_timeouts, away_timeouts")
        .eq("game_id", gameId)
        .maybeSingle<{ home_timeouts: number | null; away_timeouts: number | null }>();
      if (!match || match.home_timeouts === null || match.away_timeouts === null) {
        summary.skipped.push({ betId: bet.id, reason: "temps morts pas encore synchronisés pour ce match" });
        continue;
      }
      const total = match.home_timeouts + match.away_timeouts;
      const won =
        bet.structured_comparison === "UNDER" ? total < (bet.structured_threshold as number) : total > (bet.structured_threshold as number);
      outcome = won ? "WON" : "LOST";
      resolutionReason = `Résolu automatiquement via les statistiques officielles du match (${total} temps morts combinés).`;
    } else if (bet.structured_stat === "had_backcourt_turnover") {
      // had_backcourt_turnover : au moins 1 sur TOUT le match (les 2
      // équipes) -- pas d'attribution match-wide stockée directement,
      // sommée depuis stats_box_scores.backcourt_turnovers (même geste que
      // resolveCalculableSuperlativeBets(), qui lit aussi TOUS les joueurs
      // du match sans filtre team_id).
      const { data: rows } = await supabase.from("stats_box_scores").select("backcourt_turnovers").eq("game_id", gameId);
      if (!rows || rows.length === 0) {
        summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour ce match" });
        continue;
      }
      const total = rows.reduce((sum, r) => sum + ((r.backcourt_turnovers as number | null) ?? 0), 0);
      // Négation (bug réel trouvé le 25/08/2026, GAPS_OUVERTS.md) -- "aucun
      // retour en zone durant le match" est le miroir exact du bug trouvé
      // sur had_buzzer_beater (voir ci-dessous), corrigé par précaution ici
      // aussi même sans exemple réel du corpus (même champ, même risque).
      const eventOccurred = total > 0;
      const won = bet.structured_negation ? !eventOccurred : eventOccurred;
      outcome = won ? "WON" : "LOST";
      resolutionReason = eventOccurred
        ? "Résolu automatiquement -- au moins un retour en zone a eu lieu durant le match."
        : "Résolu automatiquement -- aucun retour en zone n'a eu lieu durant le match.";
    } else {
      // had_buzzer_beater (étape 6, GAPS_OUVERTS.md) -- flag MATCH direct
      // (stats_matchs.had_buzzer_beater), contrairement à
      // had_backcourt_turnover -- rien à sommer ici, la valeur est déjà
      // agrégée à la synchro (refresh_daily.py/backfill_game_events.py).
      const { data: match } = await supabase
        .from("stats_matchs")
        .select("had_buzzer_beater")
        .eq("game_id", gameId)
        .maybeSingle<{ had_buzzer_beater: boolean | null }>();
      if (!match || match.had_buzzer_beater === null) {
        summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour ce match" });
        continue;
      }
      // Bug réel trouvé en testant en conditions réelles (25/08/2026,
      // GAPS_OUVERTS.md) : le pari réel du corpus ("Aucun panier marqué au
      // buzzer durant le match") est une NÉGATION -- résolu à tort en LOST
      // sur un vrai match SANS buzzer beater avant ce correctif
      // (structured_negation inverse le résultat quand le texte affirme
      // l'ABSENCE de l'événement, cf. migration 20260825190000).
      const eventOccurred = match.had_buzzer_beater;
      const won = bet.structured_negation ? !eventOccurred : eventOccurred;
      outcome = won ? "WON" : "LOST";
      resolutionReason = eventOccurred
        ? "Résolu automatiquement -- au moins un panier a été marqué au buzzer durant le match."
        : "Résolu automatiquement -- aucun panier n'a été marqué au buzzer durant le match.";
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

// ============================================================================
// Chantier "fautes techniques équipe/match, comptage exact" (étape 5,
// GAPS_OUVERTS.md).
// ============================================================================

type StructuredTechnicalFoulsCount = {
  scope: "MATCH" | "team1" | "team2";
  count_relation: "AT_LEAST" | "MORE_THAN" | "FEWER_THAN" | "EXACTLY";
};

type EligibleTechnicalFoulsCountBetRow = {
  id: string;
  match_id: string | null;
  structured_team_id: string | null;
  structured_threshold: number | null;
  structured_technical_fouls_count: StructuredTechnicalFoulsCount | null;
};

/** Résolution des paris TECHNICAL_FOULS_COUNT -- somme
 *  stats_box_scores.technical_fouls (scope=MATCH : les 2 équipes, sans
 *  filtre team_id, même geste que resolveCalculableSuperlativeBets()/
 *  resolveCalculableGameEventBets() [had_backcourt_turnover] ; scope=team1/
 *  team2 : filtré par team_id via resolveNbaTeamId(), même pont que
 *  resolveCalculableTeamStatBets()). MATCH uniquement, même limite que les
 *  autres resolvers. */
export async function resolveCalculableTechnicalFoulsCountBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_team_id, structured_threshold, structured_technical_fouls_count")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .not("structured_technical_fouls_count", "is", null);
  const bets = (betsData ?? []) as EligibleTechnicalFoulsCountBetRow[];
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
    const tfc = bet.structured_technical_fouls_count;
    if (!tfc || bet.structured_threshold === null) {
      summary.skipped.push({ betId: bet.id, reason: "comptage fautes techniques structuré manquant" });
      continue;
    }

    const gameId = await resolveNbaGameId(supabase, bet.match_id);
    if (!gameId) {
      summary.skipped.push({ betId: bet.id, reason: "match NBA correspondant introuvable" });
      continue;
    }

    let rows: { technical_fouls: number | null }[] | null;
    if (tfc.scope === "MATCH") {
      ({ data: rows } = await supabase.from("stats_box_scores").select("technical_fouls").eq("game_id", gameId));
    } else {
      const nbaTeamId = bet.structured_team_id ? await resolveNbaTeamId(supabase, bet.structured_team_id) : null;
      if (nbaTeamId === null) {
        summary.skipped.push({ betId: bet.id, reason: "équipe NBA correspondante introuvable" });
        continue;
      }
      ({ data: rows } = await supabase.from("stats_box_scores").select("technical_fouls").eq("game_id", gameId).eq("team_id", nbaTeamId));
    }
    if (!rows || rows.length === 0) {
      summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour ce match" });
      continue;
    }
    const total = rows.reduce((sum, r) => sum + (r.technical_fouls ?? 0), 0);
    const threshold = bet.structured_threshold;
    const won =
      tfc.count_relation === "EXACTLY" ? total === threshold
      : tfc.count_relation === "AT_LEAST" ? total >= threshold
      : tfc.count_relation === "MORE_THAN" ? total > threshold
      : total < threshold;
    const outcome: "WON" | "LOST" = won ? "WON" : "LOST";

    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: `Résolu automatiquement via les statistiques officielles du match (${total} fautes techniques).`,
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
// Chantier "événements granulaires" (étape 6 du plan de reprise post-audit,
// 25/08/2026, GAPS_OUVERTS.md) -- LAST_BASKET ("X inscrit le dernier panier
// du match") et BLOCK_ON_PLAYER ("X réalise au moins 1 contre SUR Y").
// ============================================================================

type EligibleLastBasketBetRow = {
  id: string;
  match_id: string | null;
  structured_player_id: number | null;
  structured_last_basket: boolean | null;
};

/** Résolution des paris LAST_BASKET -- lit stats_matchs.last_basket_player_id
 *  (personId du dernier "Made Shot" du match, agrégé à la synchro, cf.
 *  refresh_daily.py/backfill_game_events.py) et compare au joueur visé
 *  (structured_player_id, comme SUPERLATIVE/PLAYER classique). MATCH
 *  uniquement, même limite que les autres resolvers. */
export async function resolveCalculableLastBasketBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_player_id, structured_last_basket")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .eq("structured_last_basket", true);
  const bets = (betsData ?? []) as EligibleLastBasketBetRow[];
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
    if (!bet.match_id || bet.structured_player_id === null || !finishedMatchIds.has(bet.match_id)) {
      summary.skipped.push({ betId: bet.id, reason: bet.match_id && finishedMatchIds.has(bet.match_id) ? "dernier panier structuré manquant" : "match pas encore terminé" });
      continue;
    }
    if (contestedBetIds.has(bet.id)) {
      summary.skipped.push({ betId: bet.id, reason: "requête de correction en attente" });
      continue;
    }

    const gameId = await resolveNbaGameId(supabase, bet.match_id);
    if (!gameId) {
      summary.skipped.push({ betId: bet.id, reason: "match NBA correspondant introuvable" });
      continue;
    }

    const { data: match } = await supabase
      .from("stats_matchs")
      .select("last_basket_player_id")
      .eq("game_id", gameId)
      .maybeSingle<{ last_basket_player_id: number | null }>();
    if (!match || match.last_basket_player_id === null) {
      summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour ce match" });
      continue;
    }

    const outcome: "WON" | "LOST" = match.last_basket_player_id === bet.structured_player_id ? "WON" : "LOST";

    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: "Résolu automatiquement via les statistiques officielles du match (dernier panier du match).",
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

type StructuredBlockOnPlayer = { blocker_player_id: number; victim_player_id: number };

type EligibleBlockOnPlayerBetRow = {
  id: string;
  match_id: string | null;
  structured_block_on_player: StructuredBlockOnPlayer | null;
};

/** Résolution des paris BLOCK_ON_PLAYER -- lit stats_block_events (table
 *  d'événements, 1 ligne par contre, agrégée à la synchro depuis le
 *  play-by-play -- cf. refresh_daily.py/backfill_game_events.py), gagné dès
 *  qu'AU MOINS UNE ligne (game_id, blocker_player_id, victim_player_id)
 *  correspond. MATCH uniquement, même limite que les autres resolvers. */
export async function resolveCalculableBlockOnPlayerBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_block_on_player")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .not("structured_block_on_player", "is", null);
  const bets = (betsData ?? []) as EligibleBlockOnPlayerBetRow[];
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
    if (!bet.match_id || !bet.structured_block_on_player || !finishedMatchIds.has(bet.match_id)) {
      summary.skipped.push({ betId: bet.id, reason: bet.match_id && finishedMatchIds.has(bet.match_id) ? "contre structuré manquant" : "match pas encore terminé" });
      continue;
    }
    if (contestedBetIds.has(bet.id)) {
      summary.skipped.push({ betId: bet.id, reason: "requête de correction en attente" });
      continue;
    }

    const gameId = await resolveNbaGameId(supabase, bet.match_id);
    if (!gameId) {
      summary.skipped.push({ betId: bet.id, reason: "match NBA correspondant introuvable" });
      continue;
    }

    // Distingue "aucun événement synchronisé pour ce match" (jamais
    // tranché -- réessayé au prochain lancement) de "synchronisé mais 0
    // contre correspondant" (LOST, une vraie absence d'événement) : vérifie
    // d'abord qu'AU MOINS 1 ligne existe pour ce match, quel que soit le
    // bloqueur/victime (même geste que les autres resolvers -- jamais
    // trancher sur une absence totale de données synchronisées).
    const { count: matchEventCount } = await supabase
      .from("stats_block_events")
      .select("id", { count: "exact", head: true })
      .eq("game_id", gameId);
    if (matchEventCount === null) {
      summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour ce match" });
      continue;
    }

    const { blocker_player_id, victim_player_id } = bet.structured_block_on_player;
    const { count: matchCount } = await supabase
      .from("stats_block_events")
      .select("id", { count: "exact", head: true })
      .eq("game_id", gameId)
      .eq("blocker_player_id", blocker_player_id)
      .eq("victim_player_id", victim_player_id);
    const won = (matchCount ?? 0) > 0;
    const outcome: "WON" | "LOST" = won ? "WON" : "LOST";

    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: won
          ? "Résolu automatiquement -- ce contre a bien eu lieu durant le match."
          : "Résolu automatiquement -- ce contre n'a pas eu lieu durant le match.",
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
