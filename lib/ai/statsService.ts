import "server-only";
import { NO_THRESHOLD_STATS } from "./statCodes";
import type { StatCode } from "./statCodes";
import type { TeamStatCode } from "./teamStatCodes";

// Appel HTTP au micro-service Python déployé sur Google Cloud Run
// (Cadrage/Stats/service/app.py, projet-data-nba.md §24) -- SEULE
// dépendance externe pour calculer une vraie probabilité, l'appli
// TypeScript ne réimplémente aucune logique de modèle.

export type StatsPredictResult = {
  proba: number; // toujours "P(stat > seuil)" côté service -- OVER/UNDER résolu par l'appelant (voir predictOverUnder)
  label: string;
  detail: string;
  /** Identifiant NBA réel du joueur résolu côté service (22/08/2026, Phase 6
   *  -- résolution automatique des paris) -- capturé ici pour ne plus jamais
   *  re-matcher structured_player_name par nom plus tard (source de bugs
   *  réels cette session). null seulement si le service ne le renvoie pas
   *  encore (pas redéployé) -- traité comme "pas d'identifiant fiable",
   *  jamais une erreur bloquante. */
  playerId: number | null;
};

async function callPredict(body: Record<string, unknown>): Promise<StatsPredictResult | null> {
  const url = process.env.STATS_SERVICE_URL;
  if (!url) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Cloud Run peut se réveiller depuis zéro (scale à zéro, §23) -- laisse
      // le temps d'un cold start plutôt que d'abandonner trop tôt.
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.proba !== "number") return null;
    return {
      proba: data.proba,
      label: data.label,
      detail: data.detail,
      playerId: typeof data.joueur_id === "number" ? data.joueur_id : null,
    };
  } catch {
    return null;
  }
}

/**
 * Résout la proba d'un pari OVER ou UNDER. Le service ne sait calculer que
 * P(stat > seuil) -- pour UNDER, approximation 1 - P(stat > seuil) (ignore
 * P(stat == seuil) pile sur le seuil, écart mineur assumé pour ce 1er jet,
 * cf. seuils de palier provisoires décidés le 21/08/2026).
 */
export async function predictOverUnder(
  playerName: string,
  stat: StatCode,
  threshold: number | null,
  comparison: "OVER" | "UNDER" | null, // null pour dd/td (NO_THRESHOLD_STATS) -- pas de sens OVER/UNDER, ignoré ci-dessous
): Promise<StatsPredictResult | null> {
  const body: Record<string, unknown> = { joueur: playerName, stat };
  if (!NO_THRESHOLD_STATS.has(stat)) {
    if (threshold === null) return null;
    body.seuil = threshold;
  }

  const result = await callPredict(body);
  if (!result) return null;
  if (comparison === "UNDER" && !NO_THRESHOLD_STATS.has(stat)) {
    return { ...result, proba: 1 - result.proba };
  }
  return result;
}

/**
 * Pari SÉRIE (brique (c) du chantier, GAPS_OUVERTS.md) -- proba qu'un
 * événement se produise AU MOINS UNE FOIS sur la série (semantique retenue
 * avec l'utilisateur le 23/08/2026). Contrairement à predictOverUnder(),
 * l'inversion OVER/UNDER se fait CÔTÉ SERVICE (avant la simulation de série,
 * pas 1-proba après coup -- voir supabase_context.py::compute_series_stat_proba
 * pour le pourquoi) : `comparison` est transmis tel quel dans le body,
 * jamais retraité ici.
 *
 * homeCourtTeamName/otherTeamName : l'équipe avec l'avantage du terrain sur
 * la série (reçoit aux matchs 1/2/5/7) et l'autre -- déterminées par
 * l'appelant depuis le match 1 réel de la série (structureAndScoreBet.ts).
 * playerTeamName doit correspondre à l'une des 2.
 */
export async function predictSeriesStat(
  playerName: string,
  stat: StatCode,
  threshold: number | null,
  comparison: "OVER" | "UNDER" | null,
  homeCourtTeamName: string,
  otherTeamName: string,
  playerTeamName: string,
): Promise<StatsPredictResult | null> {
  const url = process.env.STATS_SERVICE_URL;
  if (!url) return null;

  const body: Record<string, unknown> = {
    joueur: playerName,
    stat,
    comparison,
    equipe_domicile_serie: homeCourtTeamName,
    equipe_exterieur_serie: otherTeamName,
    equipe_joueur: playerTeamName,
    as_of_date: new Date().toISOString().slice(0, 10),
  };
  if (!NO_THRESHOLD_STATS.has(stat)) {
    if (threshold === null) return null;
    body.seuil = threshold;
  }

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/predict-series`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // 3 recalculs possibles côté service (verification de coherence,
      // supabase_context.py::compute_series_stat_proba) -- delai plus large
      // que /predict, en plus du cold start Cloud Run possible.
      signal: AbortSignal.timeout(40_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.proba !== "number") return null;
    return {
      proba: data.proba,
      label: data.label,
      detail: "", // pas de detail textuel cote service pour /predict-series
      playerId: typeof data.joueur_id === "number" ? data.joueur_id : null,
    };
  } catch {
    return null;
  }
}

/**
 * Pari MATCH_TOTAL (pièce (a) du chantier, GAPS_OUVERTS.md) -- pari SANS
 * JOUEUR, total_points : la seule stat combinée qui n'est PAS un
 * TEAM_STAT_CODE (reb/ast/fg3m/stl/blk passent par predictTotalTeamStat()
 * ci-dessous, endpoint générique). Contrairement à
 * predictSeriesStat(), l'inversion OVER/UNDER (1-proba) est SÛRE côté
 * service ici (voir supabase_context.py::compute_total_points_proba pour le
 * pourquoi -- une prédiction à l'échelle d'un seul match, pas une
 * agrégation sur une série), mais reste faite CÔTÉ SERVICE (pas ici) pour
 * rester cohérent avec le contrat HTTP déjà établi par predictSeriesStat
 * (comparison transmis tel quel, jamais retraité côté TypeScript).
 *
 * asOfDate : date RÉELLE du match visé (pas "aujourd'hui") -- résolue par
 * l'appelant (structureAndScoreBet.ts) depuis matches.scheduled_at.
 */
async function callMatchTotalPredict(
  endpoint: string,
  homeTeamName: string,
  awayTeamName: string,
  threshold: number,
  comparison: "OVER" | "UNDER",
  asOfDate: string,
): Promise<{ proba: number; label: string } | null> {
  const url = process.env.STATS_SERVICE_URL;
  if (!url) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        equipe_domicile: homeTeamName,
        equipe_exterieur: awayTeamName,
        seuil: threshold,
        comparison,
        as_of_date: asOfDate,
      }),
      // 3 recalculs possibles côté service (verification de coherence,
      // supabase_context.py) -- meme delai que predictSeriesStat.
      signal: AbortSignal.timeout(40_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.proba !== "number") return null;
    return { proba: data.proba, label: data.label };
  } catch {
    return null;
  }
}

export async function predictTotalPoints(
  homeTeamName: string,
  awayTeamName: string,
  threshold: number,
  comparison: "OVER" | "UNDER",
  asOfDate: string,
): Promise<{ proba: number; label: string } | null> {
  return callMatchTotalPredict("/predict-total-points", homeTeamName, awayTeamName, threshold, comparison, asOfDate);
}

/**
 * Pari MATCH_TOTAL pour une stat de TEAM_STAT_CODES (reb/ast/fg3m/stl/blk --
 * pièce (a) suite, GAPS_OUVERTS.md, 23/08/2026 : reb fait 1er via un endpoint
 * dédié /predict-total-rebounds, généralisé côté Python (app.py) le jour même
 * pour appeler la même fonction générique -- côté TS, un seul appelant pour
 * les 5 stats via l'endpoint générique /predict-total-team-stat plutôt que
 * 5 fonctions dédiées ; total_points n'est PAS un TEAM_STAT_CODE, reste séparé
 * (predictTotalPoints ci-dessus).
 */
export async function predictTotalTeamStat(
  stat: TeamStatCode,
  homeTeamName: string,
  awayTeamName: string,
  threshold: number,
  comparison: "OVER" | "UNDER",
  asOfDate: string,
): Promise<{ proba: number; label: string } | null> {
  const url = process.env.STATS_SERVICE_URL;
  if (!url) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/predict-total-team-stat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stat,
        equipe_domicile: homeTeamName,
        equipe_exterieur: awayTeamName,
        seuil: threshold,
        comparison,
        as_of_date: asOfDate,
      }),
      signal: AbortSignal.timeout(40_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.proba !== "number") return null;
    return { proba: data.proba, label: data.label };
  } catch {
    return null;
  }
}

/**
 * Pari TEAM_STAT (pièce (a) suite, GAPS_OUVERTS.md, 23/08/2026) -- stat
 * d'UNE équipe précise sur CE match (perspective "own"/"opp", pas
 * domicile/extérieur -- contrairement à predictTotalPoints/predictTotalTeamStat).
 * isHome : contexte RÉEL du match visé (pas un choix
 * arbitraire) -- résolu par l'appelant depuis matches.home_team_id/away_team_id.
 *
 * Généralisé (23/08/2026) via l'endpoint générique /predict-team-stat
 * (app.py, `stat` transmis tel quel) pour couvrir reb/ast/fg3m/stl/blk sans
 * 5 fonctions dédiées.
 */
export async function predictTeamStat(
  stat: TeamStatCode,
  teamName: string,
  opponentName: string,
  isHome: boolean,
  threshold: number,
  comparison: "OVER" | "UNDER",
  asOfDate: string,
): Promise<{ proba: number; label: string } | null> {
  const url = process.env.STATS_SERVICE_URL;
  if (!url) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/predict-team-stat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stat,
        equipe: teamName,
        adversaire: opponentName,
        equipe_domicile: isHome,
        seuil: threshold,
        comparison,
        as_of_date: asOfDate,
      }),
      signal: AbortSignal.timeout(40_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.proba !== "number") return null;
    return { proba: data.proba, label: data.label };
  } catch {
    return null;
  }
}

/** Un côté d'un duel (24/08/2026, GAPS_OUVERTS.md, chantier comparaison/
 *  duel) -- kind=PLAYER : `players` (1 nom = joueur seul, 2+ = somme
 *  cumulée, même stat pour tous). kind=TEAM : `team` ("domicile"/
 *  "exterieur" -- PAS team1/team2, résolu par l'appelant depuis le match
 *  réel, même contrat que predictTeamStat). */
export type DuelOperand = {
  kind: "PLAYER" | "TEAM";
  players?: string[];
  team?: "domicile" | "exterieur";
  stat: string;
};

export type ComparisonPredictResult = {
  proba: number;
  /** Ids NBA réels résolus côté service (find_player()) -- capturés ici
   *  pour être stockés dans bets.structured_duel, jamais re-matchés par nom
   *  plus tard (même leçon que structured_player_id, migration
   *  20260822130000). null pour un côté kind=TEAM. */
  leftPlayerIds: number[] | null;
  rightPlayerIds: number[] | null;
};

/**
 * Pari COMPARISON (24/08/2026, GAPS_OUVERTS.md) -- P(gauche > multiplier×
 * droite) [relation=GT] ou P(|gauche-droite| < threshold) [relation=
 * DIFF_LT]. Contrairement aux autres fonctions de ce fichier, aucune
 * inversion OVER/UNDER : un duel n'a pas de notion OVER/UNDER, juste 2
 * côtés comparés directement (comparison_relation, pas comparison, dans le
 * schéma structureBet.ts).
 */
export async function predictComparison(
  left: DuelOperand,
  right: DuelOperand,
  relation: "GT" | "DIFF_LT",
  multiplier: number,
  threshold: number | null,
  homeTeamName: string,
  awayTeamName: string,
  asOfDate: string,
): Promise<ComparisonPredictResult | null> {
  const url = process.env.STATS_SERVICE_URL;
  if (!url) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/predict-comparison`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        left: { kind: left.kind, joueurs: left.players, equipe: left.team, stat: left.stat },
        right: { kind: right.kind, joueurs: right.players, equipe: right.team, stat: right.stat },
        relation,
        multiplier,
        threshold,
        equipe_domicile: homeTeamName,
        equipe_exterieur: awayTeamName,
        as_of_date: asOfDate,
      }),
      signal: AbortSignal.timeout(40_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.proba !== "number") return null;
    return {
      proba: data.proba,
      leftPlayerIds: Array.isArray(data.left_meta?.player_ids) ? data.left_meta.player_ids : null,
      rightPlayerIds: Array.isArray(data.right_meta?.player_ids) ? data.right_meta.player_ids : null,
    };
  } catch {
    return null;
  }
}
