import "server-only";
import { NO_THRESHOLD_STATS } from "./statCodes";
import type { StatCode } from "./statCodes";
import { TEAM_PERCENTAGE_STATS, type TeamStatCode } from "./teamStatCodes";
import type { PeriodCode, PeriodOutcomeKind } from "./periodStatCodes";

// Appel HTTP au micro-service Python déployé sur Google Cloud Run
// (Cadrage/Stats/service/app.py, projet-data-nba.md §24) -- SEULE
// dépendance externe pour calculer une vraie probabilité, l'appli
// TypeScript ne réimplémente aucune logique de modèle.

// Secret partagé (audit sécurité 29/08/2026, finding "Cloud Run public") --
// le service est déployé --allow-unauthenticated et détient
// SUPABASE_SERVICE_ROLE_KEY ; même principe que SYNC_SECRET côté /api/sync/*,
// vérifié en timing-safe côté service Python (app.py, RequireSharedSecretMiddleware).
function statsServiceHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = process.env.STATS_SERVICE_SECRET;
  if (secret) headers.Authorization = `Bearer ${secret}`;
  return headers;
}

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
      headers: statsServiceHeaders(),
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
      headers: statsServiceHeaders(),
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
      headers: statsServiceHeaders(),
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
 * Pari "prolongation" (24/08/2026, GAPS_OUVERTS.md) -- stat MATCH_TOTAL
 * SANS seuil ni comparaison (probabilité directe que LE match aille en
 * prolongation, même absence que dd/td côté joueur) -- pas de
 * callMatchTotalPredict ici, signature différente (pas de threshold/
 * comparison à transmettre).
 */
export async function predictOvertime(
  homeTeamName: string,
  awayTeamName: string,
  asOfDate: string,
): Promise<{ proba: number } | null> {
  const url = process.env.STATS_SERVICE_URL;
  if (!url) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/predict-overtime`, {
      method: "POST",
      headers: statsServiceHeaders(),
      body: JSON.stringify({
        equipe_domicile: homeTeamName,
        equipe_exterieur: awayTeamName,
        as_of_date: asOfDate,
      }),
      // 3 recalculs possibles côté service (vérification de cohérence,
      // supabase_context.py) -- même délai que callMatchTotalPredict.
      signal: AbortSignal.timeout(40_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.proba !== "number") return null;
    return { proba: data.proba };
  } catch {
    return null;
  }
}

/**
 * Pari "temps morts combinés" (étape 5 du plan de reprise post-audit,
 * 25/08/2026, GAPS_OUVERTS.md) -- MATCH_TOTAL avec seuil, réutilise TEL
 * QUEL callMatchTotalPredict() (même contrat exact que predictTotalPoints).
 */
export async function predictTotalTimeouts(
  homeTeamName: string,
  awayTeamName: string,
  threshold: number,
  comparison: "OVER" | "UNDER",
  asOfDate: string,
): Promise<{ proba: number; label: string } | null> {
  return callMatchTotalPredict("/predict-total-timeouts", homeTeamName, awayTeamName, threshold, comparison, asOfDate);
}

/**
 * Pari "retour en zone" (étape 5, GAPS_OUVERTS.md) -- MATCH_TOTAL SANS
 * seuil (au moins 1 sur le match, les 2 équipes confondues), même absence
 * de threshold/comparison que predictOvertime.
 */
export async function predictBackcourtTurnover(
  homeTeamName: string,
  awayTeamName: string,
  asOfDate: string,
): Promise<{ proba: number } | null> {
  const url = process.env.STATS_SERVICE_URL;
  if (!url) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/predict-backcourt-turnover`, {
      method: "POST",
      headers: statsServiceHeaders(),
      body: JSON.stringify({
        equipe_domicile: homeTeamName,
        equipe_exterieur: awayTeamName,
        as_of_date: asOfDate,
      }),
      signal: AbortSignal.timeout(40_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.proba !== "number") return null;
    return { proba: data.proba };
  } catch {
    return null;
  }
}

/**
 * Pari "buzzer beater" (étape 6 du plan de reprise post-audit, 25/08/2026,
 * GAPS_OUVERTS.md, chantier "événements granulaires") -- MATCH_TOTAL SANS
 * seuil (au moins 1 panier marqué au buzzer durant le match, n'importe
 * quelle période), même contrat EXACT que predictBackcourtTurnover.
 */
export async function predictBuzzerBeater(
  homeTeamName: string,
  awayTeamName: string,
  asOfDate: string,
): Promise<{ proba: number } | null> {
  const url = process.env.STATS_SERVICE_URL;
  if (!url) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/predict-buzzer-beater`, {
      method: "POST",
      headers: statsServiceHeaders(),
      body: JSON.stringify({
        equipe_domicile: homeTeamName,
        equipe_exterieur: awayTeamName,
        as_of_date: asOfDate,
      }),
      signal: AbortSignal.timeout(40_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.proba !== "number") return null;
    return { proba: data.proba };
  } catch {
    return null;
  }
}

/**
 * Pari "dernier panier du match" (étape 6, GAPS_OUVERTS.md, chantier
 * "événements granulaires") -- UN joueur nommé, probabilité DIRECTE (part
 * attendue de paniers parmi tous les joueurs du match), même contrat que
 * predictSuperlative (joueur + les 2 VRAIES équipes du match).
 */
export async function predictLastBasket(
  playerName: string,
  homeTeamName: string,
  awayTeamName: string,
  asOfDate: string,
): Promise<{ proba: number; playerId: number } | null> {
  const url = process.env.STATS_SERVICE_URL;
  if (!url) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/predict-last-basket`, {
      method: "POST",
      headers: statsServiceHeaders(),
      body: JSON.stringify({
        joueur: playerName,
        equipe_domicile: homeTeamName,
        equipe_exterieur: awayTeamName,
        as_of_date: asOfDate,
      }),
      signal: AbortSignal.timeout(40_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.proba !== "number" || typeof data.joueur_id !== "number") return null;
    return { proba: data.proba, playerId: data.joueur_id };
  } catch {
    return null;
  }
}

/**
 * Pari "contre sur un joueur précis" (étape 6, GAPS_OUVERTS.md, chantier
 * "événements granulaires") -- bloqueur + victime (2 joueurs distincts,
 * obligatoirement dans des équipes opposées, vérifié côté service).
 */
export async function predictBlockOnPlayer(
  blockerName: string,
  victimName: string,
  homeTeamName: string,
  awayTeamName: string,
  asOfDate: string,
): Promise<{ proba: number; blockerId: number; victimId: number } | null> {
  const url = process.env.STATS_SERVICE_URL;
  if (!url) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/predict-block-on-player`, {
      method: "POST",
      headers: statsServiceHeaders(),
      body: JSON.stringify({
        bloqueur: blockerName,
        victime: victimName,
        equipe_domicile: homeTeamName,
        equipe_exterieur: awayTeamName,
        as_of_date: asOfDate,
      }),
      signal: AbortSignal.timeout(40_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.proba !== "number" || typeof data.bloqueur_id !== "number" || typeof data.victime_id !== "number") return null;
    return { proba: data.proba, blockerId: data.bloqueur_id, victimId: data.victime_id };
  } catch {
    return null;
  }
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
      headers: statsServiceHeaders(),
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
 * 5 fonctions dédiées. Routé vers /predict-team-pct (24/08/2026, chantier
 * "% tir équipe") pour ft/fg/fg3 -- TEAM_PERCENTAGE_STATS -- même signature
 * pour l'appelant (structureAndScoreBet.ts), le service Python change de
 * mécanisme (rétrécissement bayésien + Binomiale) mais pas le contrat TS.
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

  const endpoint = TEAM_PERCENTAGE_STATS.has(stat) ? "/predict-team-pct" : "/predict-team-stat";
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}${endpoint}`, {
      method: "POST",
      headers: statsServiceHeaders(),
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
  relation: "GT" | "DIFF_LT" | "OR",
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
      headers: statsServiceHeaders(),
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

/** Une condition d'un pari COMBO (24/08/2026, GAPS_OUVERTS.md, chantier
 *  combo -- ET de N conditions). `stats` : 1+ codes -- 1 seul = condition
 *  normale, 2+ = somme de plusieurs stats pour LE MÊME joueur (style PRA).
 *  Même contrat kind/players/team que DuelOperand. */
export type ComboCondition = {
  kind: "PLAYER" | "TEAM";
  players?: string[];
  team?: "domicile" | "exterieur";
  stats: string[];
  threshold: number | null;
  comparison: "OVER" | "UNDER";
};

export type ComboConditionMeta = {
  kind: "PLAYER" | "TEAM";
  playerIds: number[] | null;
  teamId: number | null;
  stats: string[];
};

export type ComboPredictResult = {
  proba: number;
  /** Ids/équipes REELS résolus côté service pour CHAQUE condition de
   *  CHAQUE groupe, même structure imbriquée que `groups` (étape 7 du plan
   *  de reprise post-audit, 25/08/2026, GAPS_OUVERTS.md, "OU imbriqué dans
   *  un ET") -- capturés pour être stockés dans bets.structured_combo,
   *  jamais re-matchés par nom plus tard (même leçon que
   *  structured_player_id/structured_duel). */
  groupsMeta: ComboConditionMeta[][];
};

/**
 * Pari COMBO (24/08/2026, GAPS_OUVERTS.md ; étendu étape 7, 25/08/2026,
 * "OU imbriqué dans un ET") -- ET de N GROUPES INDEPENDANTS (P(combo) =
 * produit des P(groupe_i)) -- chaque groupe est normalement 1 SEULE
 * condition (comportement inchangé depuis le chantier combo d'origine),
 * ou 2+ conditions reliées par un OU (au moins une doit être vraie). Comme
 * predictComparison(), aucune notion OVER/UNDER au niveau du pari entier --
 * chaque condition porte la sienne.
 */
export async function predictCombo(
  groups: ComboCondition[][],
  homeTeamName: string,
  awayTeamName: string,
  asOfDate: string,
): Promise<ComboPredictResult | null> {
  const url = process.env.STATS_SERVICE_URL;
  if (!url) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/predict-combo`, {
      method: "POST",
      headers: statsServiceHeaders(),
      body: JSON.stringify({
        conditions: groups.map((group) =>
          group.map((c) => ({
            kind: c.kind,
            joueurs: c.players,
            equipe: c.team,
            stats: c.stats,
            seuil: c.threshold,
            comparison: c.comparison,
          })),
        ),
        equipe_domicile: homeTeamName,
        equipe_exterieur: awayTeamName,
        as_of_date: asOfDate,
      }),
      signal: AbortSignal.timeout(40_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.proba !== "number" || !Array.isArray(data.conditions_meta)) return null;
    const toMeta = (m: { kind: "PLAYER" | "TEAM"; player_ids?: number[]; team_id?: number; stats: string[] }): ComboConditionMeta => ({
      kind: m.kind,
      playerIds: Array.isArray(m.player_ids) ? m.player_ids : null,
      teamId: typeof m.team_id === "number" ? m.team_id : null,
      stats: m.stats,
    });
    const groupsMeta: ComboConditionMeta[][] = data.conditions_meta.map(
      (group: { kind: "PLAYER" | "TEAM"; player_ids?: number[]; team_id?: number; stats: string[] }[]) => group.map(toMeta),
    );
    return { proba: data.proba, groupsMeta };
  } catch {
    return null;
  }
}

/**
 * Pari PERIOD, forme ÉQUIPE (24/08/2026, GAPS_OUVERTS.md, chantier "pari
 * période") -- vainqueur de quart-temps/mi-temps, écart, total combiné, part
 * de points, ou scénario mi-temps/résultat final. `equipeVisee` : "domicile"/
 * "exterieur" (même convention que predictComparison) -- null pour les
 * outcome_kind symétriques (MARGIN/TOTAL_POINTS, aucune équipe visée).
 * `period` : null uniquement pour QUARTERS_WON_COUNT (porte sur le match
 * entier, pas une période unique).
 */
export async function predictPeriodTeamOutcome(
  outcomeKind: PeriodOutcomeKind,
  period: PeriodCode | null,
  equipeVisee: "domicile" | "exterieur" | null,
  exactCount: boolean | null,
  threshold: number | null,
  comparison: "OVER" | "UNDER" | null,
  homeTeamName: string,
  awayTeamName: string,
  asOfDate: string,
): Promise<{ proba: number; label: string } | null> {
  const url = process.env.STATS_SERVICE_URL;
  if (!url) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/predict-period`, {
      method: "POST",
      headers: statsServiceHeaders(),
      body: JSON.stringify({
        outcome_kind: outcomeKind,
        period,
        equipe_visee: equipeVisee,
        exact_count: exactCount,
        seuil: threshold,
        comparison,
        equipe_domicile: homeTeamName,
        equipe_exterieur: awayTeamName,
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
 * Pari "5 majeur / banc" (24/08/2026, GAPS_OUVERTS.md) -- kind=
 * STARTERS_SUM/BENCH_SUM/STARTERS_SHARE, cf. structureRosterSplitBet.ts.
 */
export async function predictRosterSplit(
  kind: "STARTERS_SUM" | "BENCH_SUM" | "STARTERS_SHARE",
  stat: StatCode,
  equipeVisee: "domicile" | "exterieur",
  threshold: number,
  comparison: "OVER" | "UNDER",
  homeTeamName: string,
  awayTeamName: string,
  asOfDate: string,
): Promise<{ proba: number; label: string } | null> {
  const url = process.env.STATS_SERVICE_URL;
  if (!url) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/predict-roster-split`, {
      method: "POST",
      headers: statsServiceHeaders(),
      body: JSON.stringify({
        kind,
        stat,
        equipe_visee: equipeVisee,
        seuil: threshold,
        comparison,
        equipe_domicile: homeTeamName,
        equipe_exterieur: awayTeamName,
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
 * Pari "comptage roster-wide" (étape 3 du plan de reprise post-audit,
 * 25/08/2026, GAPS_OUVERTS.md) -- "au moins N joueurs remplissent une
 * condition individuelle" (triple-double n'importe qui, DNP, nombre de
 * joueurs utilisés, "8 joueurs marquent 11+"). Contrairement aux autres
 * predict*() : retourne aussi `playerIds`, le bassin RÉEL résolu côté
 * service (via _team_rotation()/_team_starters()) -- persisté tel quel dans
 * bets.structured_roster_count, jamais recalculé à la résolution (même
 * leçon que structured_duel/structured_combo : la résolution doit voir
 * EXACTEMENT le même bassin que celui utilisé pour le calcul de proba).
 */
export async function predictRosterCount(
  scope: "MATCH" | "domicile" | "exterieur",
  pool: "ALL" | "STARTERS",
  stat: StatCode,
  statThreshold: number | null,
  statComparison: "OVER" | "UNDER" | null,
  minPlayers: number,
  countRelation: "AT_LEAST" | "MORE_THAN" | "FEWER_THAN",
  homeTeamName: string,
  awayTeamName: string,
  asOfDate: string,
): Promise<{ proba: number; label: string; playerIds: number[] } | null> {
  const url = process.env.STATS_SERVICE_URL;
  if (!url) return null;
  if (!NO_THRESHOLD_STATS.has(stat) && (statThreshold === null || !statComparison)) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/predict-roster-count`, {
      method: "POST",
      headers: statsServiceHeaders(),
      body: JSON.stringify({
        scope: scope === "MATCH" ? "match" : scope,
        pool,
        stat,
        stat_seuil: statThreshold,
        stat_comparison: statComparison,
        min_joueurs: minPlayers,
        count_relation: countRelation,
        equipe_domicile: homeTeamName,
        equipe_exterieur: awayTeamName,
        as_of_date: asOfDate,
      }),
      signal: AbortSignal.timeout(40_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.proba !== "number" || !Array.isArray(data.player_ids)) return null;
    return { proba: data.proba, label: data.label, playerIds: data.player_ids };
  } catch {
    return null;
  }
}

/**
 * Pari "meilleur marqueur" / superlatif implicite (étape 4 du plan de
 * reprise post-audit, 25/08/2026, GAPS_OUVERTS.md) -- "X marque plus de
 * {stat} que TOUT AUTRE joueur du match", ensemble de comparaison NON
 * BORNÉ (distinct de predictComparison(), toujours contre 1 entité/somme
 * NOMMÉE). AUCUN seuil/comparaison -- probabilité DIRECTE, même principe
 * que dd/td côté predictOverUnder().
 */
export async function predictSuperlative(
  playerName: string,
  stat: StatCode,
  homeTeamName: string,
  awayTeamName: string,
  asOfDate: string,
): Promise<StatsPredictResult | null> {
  const url = process.env.STATS_SERVICE_URL;
  if (!url) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/predict-superlative`, {
      method: "POST",
      headers: statsServiceHeaders(),
      body: JSON.stringify({
        joueur: playerName,
        stat,
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
      label: data.label,
      detail: data.detail,
      playerId: typeof data.joueur_id === "number" ? data.joueur_id : null,
    };
  } catch {
    return null;
  }
}

/**
 * Fautes techniques ÉQUIPE/MATCH, comptage EXACT (étape 5 du plan de
 * reprise post-audit, 25/08/2026, GAPS_OUVERTS.md) -- "Orlando reçoit
 * exactement 2 fautes techniques"/"il y aura exactement 2 fautes
 * techniques dans le match". Distribution EXACTE (classifieur
 * multi-classe côté service), count_relation à 4 valeurs -- même raison
 * que predictRosterCount (étape 3) : l'inclusif/exclusif compte
 * réellement ici, pas une approximation continue.
 */
export async function predictTechnicalFoulsCount(
  scope: "MATCH" | "domicile" | "exterieur",
  countThreshold: number,
  countRelation: "AT_LEAST" | "MORE_THAN" | "FEWER_THAN" | "EXACTLY",
  homeTeamName: string,
  awayTeamName: string,
  asOfDate: string,
): Promise<{ proba: number; label: string } | null> {
  const url = process.env.STATS_SERVICE_URL;
  if (!url) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/predict-technical-fouls-count`, {
      method: "POST",
      headers: statsServiceHeaders(),
      body: JSON.stringify({
        scope: scope === "MATCH" ? "match" : scope,
        count_threshold: countThreshold,
        count_relation: countRelation,
        equipe_domicile: homeTeamName,
        equipe_exterieur: awayTeamName,
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
 * Pari PERIOD, forme JOUEUR (24/08/2026, GAPS_OUVERTS.md, chantier "pari
 * période") -- une stat JOUEUR normale (mêmes codes que predictOverUnder)
 * mais limitée à UNE période (ex. "3 contres en 1ère mi-temps"). Contrat
 * calqué sur predictOverUnder (inversion OVER/UNDER faite ICI, côté TS, pas
 * côté service -- même raison : prédiction à l'échelle d'un seul match).
 */
export async function predictPlayerPeriodStat(
  playerName: string,
  stat: StatCode,
  period: PeriodCode,
  threshold: number | null,
  comparison: "OVER" | "UNDER" | null,
  homeTeamName: string,
  awayTeamName: string,
  asOfDate: string,
): Promise<StatsPredictResult | null> {
  const url = process.env.STATS_SERVICE_URL;
  if (!url) return null;

  const body: Record<string, unknown> = {
    joueur: playerName,
    stat,
    period,
    equipe_domicile: homeTeamName,
    equipe_exterieur: awayTeamName,
    as_of_date: asOfDate,
  };
  if (!NO_THRESHOLD_STATS.has(stat)) {
    if (threshold === null) return null;
    body.seuil = threshold;
    body.comparison = comparison;
  }

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/predict-player-period`, {
      method: "POST",
      headers: statsServiceHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(40_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.proba !== "number") return null;
    const result: StatsPredictResult = {
      proba: data.proba,
      label: data.label,
      detail: data.detail,
      playerId: typeof data.joueur_id === "number" ? data.joueur_id : null,
    };
    if (comparison === "UNDER" && !NO_THRESHOLD_STATS.has(stat)) {
      return { ...result, proba: 1 - result.proba };
    }
    return result;
  } catch {
    return null;
  }
}
