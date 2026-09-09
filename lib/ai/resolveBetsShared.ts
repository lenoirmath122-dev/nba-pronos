import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { nyDateString } from "@/lib/dates/newyork";
import { PERCENTAGE_STATS, type StatCode } from "./statCodes";

// Types et helpers PARTAGÉS par les 14 resolvers de lib/ai/resolve*Bets.ts.
// Extrait le 09/09/2026 (p1-31, feuille de route Phase 1) de
// resolveCalculableBets.ts (2589 lignes à l'origine) -- un fichier par
// catégorie de pari suit maintenant le même découpage que
// lib/ai/structure*Bet.ts côté structuration. resolveCalculableBets.ts
// reste le point d'entrée stable (barrel) pour les imports existants.

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

export type SupabaseServiceClient = ReturnType<typeof getServiceClient>;

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
export const COUNTING_STAT_COLUMN: Partial<Record<StatCode, "pts" | "reb" | "ast" | "fg3m" | "stl" | "blk" | "fga" | "fg3a" | "oreb" | "plus_minus" | "tov">> = {
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
  // "tov" ajoutee le 06/09/2026 (GAPS_OUVERTS.md, "pertes de balle") -- meme
  // patron mecanique que oreb, meme piege deja documente ci-dessus pour
  // plus_minus (ne JAMAIS oublier cette entree en ajoutant une stat comptee).
  tov: "tov",
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
  tov: number | null;
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
  // null (pas juste absent) = donnée structurellement indisponible plutôt
  // qu'un vrai 0 -- signal explicitement posé par l'appelant PERIOD
  // (plus_minus/technical_fouls/tov n'existent pas dans
  // stats_box_scores_by_period, cf. resolveCalculableBets.ts plus bas) mais
  // vrai aussi côté MATCH pour une ligne stats_box_scores pas encore
  // backfillée sur une colonne ajoutée après coup (technical_fouls/tov,
  // migrations du 25/08 et du 06/09). Bug réel (p1-25, feuille de route
  // Phase 1) : le `?? 0` d'origine confondait les deux, résolvant TOUJOURS
  // "perdu" pour ce cas plutôt que de laisser le pari non résolu (skip côté
  // appelant sur un retour null, même contrat que threshold/comparison
  // manquants ci-dessous).
  if (stat === "tech") {
    if (box.technical_fouls === null) return null;
    return box.technical_fouls >= 1;
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
  if (stat === "min") {
    const actual = minutesToFloat(box.minutes);
    return comparison === "UNDER" ? actual < threshold : actual > threshold;
  }
  const rawValue = box[COUNTING_STAT_COLUMN[stat]!];
  if (rawValue === null) return null;
  return comparison === "UNDER" ? rawValue < threshold : rawValue > threshold;
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
export async function resolveNbaGameId(supabase: SupabaseServiceClient, matchId: string): Promise<string | null> {
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

export async function resolveNbaTeamId(supabase: SupabaseServiceClient, appTeamId: string): Promise<number | null> {
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
export const ZERO_BOX_ROW: BoxScoreRow = {
  minutes: null, pts: 0, reb: 0, ast: 0, fg3m: 0, stl: 0, blk: 0,
  ftm: 0, fta: 0, fgm: 0, fga: 0, fg3a: 0, oreb: 0, plus_minus: 0, technical_fouls: 0, tov: 0,
};
