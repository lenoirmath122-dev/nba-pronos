import "server-only";
import { getServerClient } from "@/lib/supabase/server";
import { structureBet } from "./structureBet";
import { structurePeriodBet } from "./structurePeriodBet";
import {
  predictOverUnder,
  predictSeriesStat,
  predictTotalPoints,
  predictTotalTeamStat,
  predictTeamStat,
  predictComparison,
  predictCombo,
  predictOvertime,
  predictPeriodTeamOutcome,
  predictPlayerPeriodStat,
  type DuelOperand,
  type ComboCondition,
} from "./statsService";
import type { TeamStatCode } from "./teamStatCodes";
import { probaToDifficulty } from "./difficultyTiers";
import { NO_THRESHOLD_STATS, type StatCode } from "./statCodes";
import { NO_THRESHOLD_MATCH_STATS, type MatchStatCode } from "./matchStatCodes";
import { NO_THRESHOLD_PERIOD_OUTCOMES, TEAM_TARGETED_PERIOD_OUTCOMES, type PeriodCode, type PeriodOutcomeKind } from "./periodStatCodes";
import type { BetCategory } from "@/lib/labels/bets";
import { COMPARISON_PLAYER_STAT_CODES, COMPARISON_TEAM_STAT_CODES } from "./comparisonCodes";

// Orchestre la structuration IA + le calcul de proba pour UN pari, à la
// soumission (SPEC_TECHNIQUE_PROBA_PARIS_PERSOS_V0_1.md §3/§6, décidé le
// 21/08/2026 : synchrone, figé à la soumission -- jamais recalculé après).
// Appelée depuis submitBet APRÈS que le pari existe déjà en base
// (save_bet a réussi) -- toute panne ici (IA, service Cloud Run, réseau)
// est avalée silencieusement : le pari reste soumis normalement, avec le
// mécanisme manuel existant (difficulté proposée/validée à la main) comme
// seul repli, jamais bloquant pour le joueur.
//
// Champs de structuration lus en objets IMBRIQUÉS (structuration.player/
// team_stat/match_total/comparison_bet/combo_bet) depuis le refactor du
// 24/08/2026 (chantier combo, GAPS_OUVERTS.md) -- cf. structureBet.ts pour
// le POURQUOI (limite API de 16 champs nullable/union par schéma de sortie
// structurée, dépassée à plat).

/** Bug réel corrigé le 21/08/2026 : sans le contexte du match, l'IA validait
 *  des paris sur des joueurs qui ne jouent même pas dans le match visé
 *  (ex. "Jayson Tatum" sur un match Nets-Hornets). Résolu depuis
 *  series.team1_id/team2_id -- null si pas encore connus (série pas
 *  déterminée), structureBet() se rabat alors sur l'ancien comportement
 *  sans vérification d'équipe. */
async function resolveMatchTeamNames(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  seriesId: string,
): Promise<[string, string] | null> {
  const { data: series } = await supabase
    .from("series")
    .select("team1_id, team2_id")
    .eq("id", seriesId)
    .maybeSingle<{ team1_id: string | null; team2_id: string | null }>();
  if (!series?.team1_id || !series?.team2_id) return null;

  const { data: teams } = await supabase.from("teams").select("id, name").in("id", [series.team1_id, series.team2_id]);
  const nameById = new Map((teams ?? []).map((t) => [t.id as string, t.name as string]));
  const name1 = nameById.get(series.team1_id);
  const name2 = nameById.get(series.team2_id);
  return name1 && name2 ? [name1, name2] : null;
}

/** Détecte un texte "de forme" pari période AVANT tout appel Claude
 *  (24/08/2026, GAPS_OUVERTS.md) -- vocabulaire temporel volontairement
 *  large mais peu ambigu (quart-temps/mi-temps sous toutes leurs graphies
 *  courantes) : NE MATCHE PAS "prolongation" seule (ex. "va en
 *  prolongation" reste géré par structureBet.ts/MATCH_TOTAL, comportement
 *  inchangé). Un pari période formulé assez différemment pour échapper à ce
 *  filtre retombe sur structureBet.ts -> calculable=false -> file de
 *  validation manuelle admin -- même filet de sécurité que tout autre cas
 *  non géré aujourd'hui, jamais une réponse fausse. Voir structurePeriodBet.ts
 *  pour le POURQUOI de ce routage (pas un 2e schéma dans structureBet.ts). */
const PERIOD_KEYWORD_REGEX = /quart[s]?[\s-]?temps|mi[\s-]?temps/i;

/** Equipe avec l'avantage du terrain sur la serie (recoit aux matchs
 *  1/2/5/7, convention series_probability.py) -- deduite du match 1 REEL de
 *  la serie (game_number = 1, pas un "seed" explicite, cf. GAPS_OUVERTS.md
 *  piece (d)). null si ce match n'existe pas encore en base (serie pas
 *  encore programmee) -- le pari serie reste alors non-calculable, meme
 *  repli que le reste de ce fichier. */
async function resolveSeriesHomeCourtTeam(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  seriesId: string,
): Promise<{ homeTeamName: string; awayTeamName: string } | null> {
  const { data: game1 } = await supabase
    .from("matches")
    .select("home_team_id, away_team_id")
    .eq("series_id", seriesId)
    .eq("game_number", 1)
    .maybeSingle<{ home_team_id: string | null; away_team_id: string | null }>();
  if (!game1?.home_team_id || !game1?.away_team_id) return null;

  const { data: teams } = await supabase.from("teams").select("id, name").in("id", [game1.home_team_id, game1.away_team_id]);
  const nameById = new Map((teams ?? []).map((t) => [t.id as string, t.name as string]));
  const homeTeamName = nameById.get(game1.home_team_id);
  const awayTeamName = nameById.get(game1.away_team_id);
  return homeTeamName && awayTeamName ? { homeTeamName, awayTeamName } : null;
}

/** Equipe domicile/exterieure REELLES pour un match precis
 *  (matches.home_team_id/away_team_id, deja synchronisees) -- utilise pour
 *  un pari MATCH_TOTAL (piece (a), GAPS_OUVERTS.md) : pas besoin de
 *  player_team ici, juste les 2 vraies equipes du match vise + sa date
 *  reelle (contexte "au moment de CE match", pas "aujourd'hui" comme pour
 *  un pari serie -- un match precis a une vraie date connue). Distinct de
 *  resolveMatchTeamNames() (team1/team2 de la SERIE, ordre arbitraire, sert
 *  seulement au contexte du prompt IA pour verifier un JOUEUR). */
async function resolveMatchTeams(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  matchId: string,
): Promise<
  { homeTeamId: string; awayTeamId: string; homeTeamName: string; awayTeamName: string; scheduledAt: string } | null
> {
  const { data: match } = await supabase
    .from("matches")
    .select("home_team_id, away_team_id, scheduled_at")
    .eq("id", matchId)
    .maybeSingle<{ home_team_id: string | null; away_team_id: string | null; scheduled_at: string | null }>();
  if (!match?.home_team_id || !match?.away_team_id || !match?.scheduled_at) return null;

  const { data: teams } = await supabase.from("teams").select("id, name").in("id", [match.home_team_id, match.away_team_id]);
  const nameById = new Map((teams ?? []).map((t) => [t.id as string, t.name as string]));
  const homeTeamName = nameById.get(match.home_team_id);
  const awayTeamName = nameById.get(match.away_team_id);
  return homeTeamName && awayTeamName
    ? {
        homeTeamId: match.home_team_id,
        awayTeamId: match.away_team_id,
        homeTeamName,
        awayTeamName,
        scheduledAt: match.scheduled_at,
      }
    : null;
}

export async function structureAndScoreBet(
  betId: string,
  description: string,
  seriesId: string,
  scope: "MATCH" | "SERIES" = "MATCH",
  matchId: string | null = null,
): Promise<void> {
  const supabase = await getServerClient();

  /** Écrit is_calculable=false explicitement (jamais laissé NULL) -- bug
   *  réel trouvé le 21/08/2026 : le code s'arrêtait sans rien écrire dès
   *  que l'IA répondait "non calculable", rendant indistinguable "l'IA a
   *  tranché non" de "l'IA n'a jamais tourné" (panne, clé absente...).
   *  Fonctionnellement inoffensif (is_calculable ?? false partout en
   *  lecture) mais rendait tout diagnostic impossible. */
  async function markNotCalculable(): Promise<void> {
    try {
      await supabase.rpc("update_bet_structuration", {
        p_bet_id: betId,
        p_structured_player_name: null,
        p_structured_player_id: null,
        p_structured_team_id: null,
        p_structured_duel: null,
        p_structured_combo: null,
        p_structured_period: null,
        p_stat: null,
        p_threshold: null,
        p_comparison: null,
        p_is_calculable: false,
        p_calculated_proba: null,
        p_suggested_difficulty: null,
      });
    } catch {
      // Best-effort, comme le reste de cette fonction.
    }
  }

  /** Pari PERIOD (24/08/2026, GAPS_OUVERTS.md, chantier "pari période") --
   *  porte sur un quart-temps/mi-temps précis. 2 formes distinguées par
   *  periodBet.player : ÉQUIPE (vainqueur de période, écart, total,
   *  scénario mi-temps/résultat) ou JOUEUR (une stat normale limitée à
   *  cette période). MATCH uniquement, même limite que les autres branches.
   *  Appelée UNIQUEMENT quand PERIOD_KEYWORD_REGEX matche (cf. try
   *  ci-dessous) -- structuration vient de structurePeriodBet(), un schéma
   *  séparé de structureBet.ts (voir sa docstring pour le pourquoi). */
  async function handlePeriodBet(teamNames: [string, string] | null): Promise<void> {
    const structuration = await structurePeriodBet(description, teamNames);
    if (!structuration || !structuration.calculable || structuration.bet_subject !== "PERIOD") {
      await markNotCalculable();
      return;
    }
    const periodBet = structuration.period_bet;
    if (scope !== "MATCH" || !matchId || !periodBet) {
      await markNotCalculable();
      return;
    }
    const matchTeams = await resolveMatchTeams(supabase, matchId);
    if (!matchTeams) {
      await markNotCalculable();
      return;
    }
    const asOfDate = matchTeams.scheduledAt.slice(0, 10);

    // Forme JOUEUR : player rempli -- même garde comparison/threshold que
    // bet_subject=PLAYER classique (dd/td exceptés via NO_THRESHOLD_STATS).
    if (periodBet.player) {
      if (!periodBet.period || !periodBet.player_stat) {
        await markNotCalculable();
        return;
      }
      const stat = periodBet.player_stat as StatCode;
      if (!NO_THRESHOLD_STATS.has(stat) && (periodBet.threshold === null || !periodBet.comparison)) {
        await markNotCalculable();
        return;
      }
      const prediction = await predictPlayerPeriodStat(
        periodBet.player,
        stat,
        periodBet.period as PeriodCode,
        periodBet.threshold,
        periodBet.comparison,
        matchTeams.homeTeamName,
        matchTeams.awayTeamName,
        asOfDate,
      );
      if (!prediction) {
        await markNotCalculable();
        return;
      }
      await supabase.rpc("update_bet_structuration", {
        p_bet_id: betId,
        p_structured_player_name: periodBet.player,
        p_structured_player_id: prediction.playerId,
        p_structured_team_id: null,
        p_structured_duel: null,
        p_structured_combo: null,
        p_structured_period: {
          period: periodBet.period,
          outcome_kind: null,
          team_id: null,
          player_id: prediction.playerId,
          exact_count: null,
        },
        p_stat: periodBet.player_stat,
        p_threshold: periodBet.threshold,
        p_comparison: periodBet.comparison,
        p_is_calculable: true,
        p_calculated_proba: prediction.proba,
        p_suggested_difficulty: probaToDifficulty(prediction.proba),
        p_category: "PERIOD" satisfies BetCategory,
      });
      return;
    }

    // Forme ÉQUIPE. outcome_kind requis ; period requis SAUF pour
    // QUARTERS_WON_COUNT (porte sur le match entier).
    const outcomeKind = periodBet.outcome_kind as PeriodOutcomeKind | null;
    if (!outcomeKind || (outcomeKind !== "QUARTERS_WON_COUNT" && !periodBet.period)) {
      await markNotCalculable();
      return;
    }

    let equipeVisee: "domicile" | "exterieur" | null = null;
    let teamId: string | null = null;
    if (TEAM_TARGETED_PERIOD_OUTCOMES.has(outcomeKind)) {
      const teamName = periodBet.team === "team1" ? teamNames?.[0] : periodBet.team === "team2" ? teamNames?.[1] : null;
      if (!teamName || (teamName !== matchTeams.homeTeamName && teamName !== matchTeams.awayTeamName)) {
        await markNotCalculable();
        return;
      }
      equipeVisee = teamName === matchTeams.homeTeamName ? "domicile" : "exterieur";
      teamId = teamName === matchTeams.homeTeamName ? matchTeams.homeTeamId : matchTeams.awayTeamId;
    }

    // Bug réel trouvé en testant en conditions réelles (24/08/2026) :
    // LEADS_HALF_RESULT n'est PAS dans NO_THRESHOLD_PERIOD_OUTCOMES (il a
    // bien un `comparison` -- OVER/UNDER encode mène-et-gagne vs mène-et-
    // perd) mais n'a PAS de `threshold` numérique non plus (toujours null,
    // cf. periodStatCodes.ts) -- un pari "Cleveland mène à la mi-temps et
    // gagne le match" (correctement classifié par Claude, threshold=null/
    // comparison="OVER") tombait donc à tort sur markNotCalculable() ici.
    // 3 catégories, pas 2 : QUARTER_WINNER/HALF_WINNER (ni l'un ni l'autre),
    // LEADS_HALF_RESULT (comparison seul), le reste (les deux).
    const needsComparison = !NO_THRESHOLD_PERIOD_OUTCOMES.has(outcomeKind);
    const needsThreshold = needsComparison && outcomeKind !== "LEADS_HALF_RESULT";
    if ((needsComparison && !periodBet.comparison) || (needsThreshold && periodBet.threshold === null)) {
      await markNotCalculable();
      return;
    }

    const prediction = await predictPeriodTeamOutcome(
      outcomeKind,
      (periodBet.period as PeriodCode | null) ?? null,
      equipeVisee,
      periodBet.exact_count,
      periodBet.threshold,
      periodBet.comparison,
      matchTeams.homeTeamName,
      matchTeams.awayTeamName,
      asOfDate,
    );
    if (!prediction) {
      await markNotCalculable();
      return;
    }

    await supabase.rpc("update_bet_structuration", {
      p_bet_id: betId,
      p_structured_player_name: null,
      p_structured_player_id: null,
      p_structured_team_id: teamId,
      p_structured_duel: null,
      p_structured_combo: null,
      p_structured_period: {
        period: periodBet.period,
        outcome_kind: outcomeKind,
        team_id: teamId,
        player_id: null,
        exact_count: periodBet.exact_count,
      },
      p_stat: null,
      p_threshold: periodBet.threshold,
      p_comparison: periodBet.comparison,
      p_is_calculable: true,
      p_calculated_proba: prediction.proba,
      p_suggested_difficulty: probaToDifficulty(prediction.proba),
      p_category: "PERIOD" satisfies BetCategory,
    });
  }

  try {
    const teamNames = await resolveMatchTeamNames(supabase, seriesId);

    // Routage PERIOD par mot-clé (24/08/2026, GAPS_OUVERTS.md) -- PAS un 7e
    // bet_subject dans le schéma structureBet.ts : testé en conditions
    // réelles, ce schéma est déjà au plafond de complexité accepté par
    // l'API Claude ("compiled grammar is too large" -- reproduit sur TOUS
    // les paris, pas seulement PERIOD, même après avoir factorisé les enums
    // répétés). Décidé avec l'utilisateur : un texte qui RESSEMBLE à un
    // pari période (vocabulaire temporel, peu ambigu) appelle EXCLUSIVEMENT
    // structurePeriodBet() (son propre petit schéma dédié, testé OK en
    // isolation) -- jamais les deux appels, jamais de repli automatique de
    // l'un vers l'autre (ça recouplerait le coût de PERIOD à toute la
    // population -- déjà grande et croissante -- des paris non calculables
    // pour d'autres raisons, pas mesurable ni borné). Sciemment PAS
    // généralisé aux 5 autres bet_subject : leur distinction est
    // SÉMANTIQUE (comparaison vs seuil fixe vs somme de conditions), pas
    // lexicale -- un mot-clé ne peut pas les séparer de façon fiable.
    if (PERIOD_KEYWORD_REGEX.test(description)) {
      await handlePeriodBet(teamNames);
      return;
    }

    const structuration = await structureBet(description, teamNames);
    if (!structuration || !structuration.calculable || !structuration.bet_subject) {
      await markNotCalculable();
      return;
    }

    // Pari MATCH_TOTAL (pièce (a) du chantier, GAPS_OUVERTS.md) -- 1er pari
    // SANS JOUEUR : score combiné du match. MATCH uniquement pour l'instant
    // (pas SÉRIE -- décidé avec l'utilisateur, viendra dans un 2e temps).
    // Branche entièrement séparée de la suite (spécifique aux paris
    // JOUEUR) : aucun joueur à résoudre, aucune notion d'avantage du
    // terrain sur une série.
    if (structuration.bet_subject === "MATCH_TOTAL") {
      const matchTotal = structuration.match_total;
      if (scope !== "MATCH" || !matchId || !matchTotal) {
        await markNotCalculable();
        return;
      }
      const matchTeams = await resolveMatchTeams(supabase, matchId);
      if (!matchTeams) {
        await markNotCalculable();
        return;
      }
      // went_to_ot n'a ni seuil ni comparaison (probabilité directe, même
      // principe que dd/td côté joueur, ligne ~490 plus bas) -- garde
      // symétrique pour MATCH_TOTAL (24/08/2026, chantier "prolongation",
      // GAPS_OUVERTS.md).
      if (!NO_THRESHOLD_MATCH_STATS.has(matchTotal.stat as MatchStatCode) && (matchTotal.threshold === null || !matchTotal.comparison)) {
        await markNotCalculable();
        return;
      }
      // as_of_date = date RÉELLE du match visé (pas "aujourd'hui" comme pour
      // un pari série) -- un match précis a une vraie date connue, plus
      // fidèle pour le calcul de repos/contexte équipe.
      const asOfDate = matchTeams.scheduledAt.slice(0, 10);
      const prediction =
        matchTotal.stat === "went_to_ot"
          ? await predictOvertime(matchTeams.homeTeamName, matchTeams.awayTeamName, asOfDate)
          : matchTotal.stat === "total_points"
            ? await predictTotalPoints(
                matchTeams.homeTeamName,
                matchTeams.awayTeamName,
                matchTotal.threshold as number,
                matchTotal.comparison as "OVER" | "UNDER",
                asOfDate,
              )
            : await predictTotalTeamStat(
                matchTotal.stat.slice("total_".length) as TeamStatCode,
                matchTeams.homeTeamName,
                matchTeams.awayTeamName,
                matchTotal.threshold as number,
                matchTotal.comparison as "OVER" | "UNDER",
                asOfDate,
              );
      if (!prediction) {
        await markNotCalculable();
        return;
      }
      await supabase.rpc("update_bet_structuration", {
        p_bet_id: betId,
        p_structured_player_name: null,
        p_structured_player_id: null,
        p_structured_team_id: null,
        p_structured_duel: null,
        p_structured_combo: null,
        p_structured_period: null,
        p_stat: matchTotal.stat,
        p_threshold: matchTotal.threshold,
        p_comparison: matchTotal.comparison,
        p_is_calculable: true,
        p_calculated_proba: prediction.proba,
        p_suggested_difficulty: probaToDifficulty(prediction.proba),
        p_category: (matchTotal.stat === "went_to_ot" ? "GAME_EVENT" : "SCORE_TOTAL") satisfies BetCategory,
      });
      return;
    }

    // Pari TEAM_STAT (pièce (a) suite, GAPS_OUVERTS.md) -- stat d'UNE
    // équipe précise sur CE match, perspective "own"/"opp" (pas domicile/
    // extérieur) -- MATCH uniquement, même limite que MATCH_TOTAL ci-dessus.
    if (structuration.bet_subject === "TEAM_STAT") {
      const teamStat = structuration.team_stat;
      if (scope !== "MATCH" || !matchId || !teamStat) {
        await markNotCalculable();
        return;
      }
      const teamName = teamStat.team === "team1" ? teamNames?.[0] : teamNames?.[1];
      const matchTeams = await resolveMatchTeams(supabase, matchId);
      if (!teamName || !matchTeams || (teamName !== matchTeams.homeTeamName && teamName !== matchTeams.awayTeamName)) {
        await markNotCalculable();
        return;
      }
      const isHome = teamName === matchTeams.homeTeamName;
      const opponentName = isHome ? matchTeams.awayTeamName : matchTeams.homeTeamName;
      const teamId = isHome ? matchTeams.homeTeamId : matchTeams.awayTeamId;
      const prediction = await predictTeamStat(
        teamStat.stat as TeamStatCode,
        teamName,
        opponentName,
        isHome,
        teamStat.threshold,
        teamStat.comparison,
        matchTeams.scheduledAt.slice(0, 10),
      );
      if (!prediction) {
        await markNotCalculable();
        return;
      }
      await supabase.rpc("update_bet_structuration", {
        p_bet_id: betId,
        p_structured_player_name: null,
        p_structured_player_id: null,
        p_structured_team_id: teamId,
        p_structured_duel: null,
        p_structured_combo: null,
        p_structured_period: null,
        p_stat: teamStat.stat,
        p_threshold: teamStat.threshold,
        p_comparison: teamStat.comparison,
        p_is_calculable: true,
        p_calculated_proba: prediction.proba,
        p_suggested_difficulty: probaToDifficulty(prediction.proba),
        p_category: "TEAM_PROP" satisfies BetCategory,
      });
      return;
    }

    // Pari COMPARISON (24/08/2026, GAPS_OUVERTS.md, chantier comparaison/
    // duel) -- compare 2 côtés entre eux (jamais contre un seuil fixe, sauf
    // DIFF_LT qui borne un ÉCART). MATCH uniquement, même limite que
    // TEAM_STAT/MATCH_TOTAL ci-dessus.
    if (structuration.bet_subject === "COMPARISON") {
      const comparisonBet = structuration.comparison_bet;
      if (scope !== "MATCH" || !matchId || !comparisonBet) {
        await markNotCalculable();
        return;
      }

      const matchTeams = await resolveMatchTeams(supabase, matchId);
      if (!matchTeams) {
        await markNotCalculable();
        return;
      }

      // "team1"/"team2" -> "domicile"/"exterieur" (contrat statsService.ts,
      // même patron que predictTeamStat) -- résolu depuis les VRAIES
      // équipes du match visé, pas un choix arbitraire.
      const resolveSide = (kind: "team1" | "team2"): "domicile" | "exterieur" | null => {
        const name = kind === "team1" ? teamNames?.[0] : teamNames?.[1];
        if (!name) return null;
        if (name === matchTeams.homeTeamName) return "domicile";
        if (name === matchTeams.awayTeamName) return "exterieur";
        return null;
      };

      const buildOperand = (side: { kind: "PLAYER" | "team1" | "team2"; players: string[]; stat: string }): DuelOperand | null => {
        if (side.kind === "PLAYER") {
          if (side.players.length === 0 || !(COMPARISON_PLAYER_STAT_CODES as string[]).includes(side.stat)) return null;
          return { kind: "PLAYER", players: side.players, stat: side.stat };
        }
        const resolvedSide = resolveSide(side.kind);
        if (!resolvedSide || !(COMPARISON_TEAM_STAT_CODES as string[]).includes(side.stat)) return null;
        return { kind: "TEAM", team: resolvedSide, stat: side.stat };
      };

      const left = buildOperand(comparisonBet.left);
      const right = buildOperand(comparisonBet.right);
      if (!left || !right) {
        await markNotCalculable();
        return;
      }

      const multiplier = comparisonBet.multiplier ?? 1;
      const diffThreshold = comparisonBet.relation === "DIFF_LT" ? comparisonBet.threshold : null;
      if (comparisonBet.relation === "DIFF_LT" && diffThreshold === null) {
        await markNotCalculable();
        return;
      }

      const prediction = await predictComparison(
        left,
        right,
        comparisonBet.relation,
        multiplier,
        diffThreshold,
        matchTeams.homeTeamName,
        matchTeams.awayTeamName,
        matchTeams.scheduledAt.slice(0, 10),
      );
      if (!prediction) {
        await markNotCalculable();
        return;
      }

      // Persiste les ids REELS (joueurs resolus cote service, equipe deja
      // connue cote appelant) -- jamais re-matches par nom plus tard, meme
      // lecon que structured_player_id (migration 20260822130000).
      const operandMeta = (operand: DuelOperand, playerIds: number[] | null) =>
        operand.kind === "PLAYER"
          ? { kind: "PLAYER" as const, player_ids: playerIds, stat: operand.stat }
          : {
              kind: "TEAM" as const,
              team_id: operand.team === "domicile" ? matchTeams.homeTeamId : matchTeams.awayTeamId,
              stat: operand.stat,
            };

      const structuredDuel = {
        left: operandMeta(left, prediction.leftPlayerIds),
        right: operandMeta(right, prediction.rightPlayerIds),
        relation: comparisonBet.relation,
        multiplier,
      };

      await supabase.rpc("update_bet_structuration", {
        p_bet_id: betId,
        p_structured_player_name: null,
        p_structured_player_id: null,
        p_structured_team_id: null,
        p_structured_duel: structuredDuel,
        p_structured_combo: null,
        p_structured_period: null,
        p_stat: null,
        p_threshold: diffThreshold,
        p_comparison: null,
        p_is_calculable: true,
        p_calculated_proba: prediction.proba,
        p_suggested_difficulty: probaToDifficulty(prediction.proba),
        p_category: "HEAD_TO_HEAD" satisfies BetCategory,
      });
      return;
    }

    // Pari COMBO (24/08/2026, GAPS_OUVERTS.md, chantier combo) -- ET de N
    // conditions (TOUTES doivent être vraies), chacune joueur/somme de
    // joueurs/équipe + 1+ stats sommées + seuil + comparaison. MATCH
    // uniquement, même limite que les branches ci-dessus. Portée
    // volontairement limitée à un ET simple -- pas de OU imbriqué, pas de
    // comptage sur tout le roster (cf. GAPS_OUVERTS.md pour ces exclusions
    // et où elles seront reprises).
    if (structuration.bet_subject === "COMBO") {
      const comboBet = structuration.combo_bet;
      if (scope !== "MATCH" || !matchId || !comboBet || comboBet.conditions.length === 0) {
        await markNotCalculable();
        return;
      }

      const matchTeams = await resolveMatchTeams(supabase, matchId);
      if (!matchTeams) {
        await markNotCalculable();
        return;
      }

      const resolveSide = (kind: "team1" | "team2"): "domicile" | "exterieur" | null => {
        const name = kind === "team1" ? teamNames?.[0] : teamNames?.[1];
        if (!name) return null;
        if (name === matchTeams.homeTeamName) return "domicile";
        if (name === matchTeams.awayTeamName) return "exterieur";
        return null;
      };

      // Reconstruit chaque condition en ComboCondition (kind/team résolus
      // en "domicile"/"exterieur"), avec les MÊMES règles de validité que
      // côté service (une condition "somme" -- 2+ joueurs et/ou 2+ stats --
      // est restreinte aux stats comptées ; une condition "simple" accepte
      // toute STAT_CODES, y compris dd/td) -- vérifié ici aussi pour éviter
      // un aller-retour HTTP voué à l'échec.
      const conditions: ComboCondition[] = [];
      for (const c of comboBet.conditions) {
        if (c.stats.length === 0) {
          await markNotCalculable();
          return;
        }
        if (c.kind === "PLAYER") {
          if (c.players.length === 0) {
            await markNotCalculable();
            return;
          }
          const isSimple = c.players.length === 1 && c.stats.length === 1;
          if (!isSimple && c.stats.some((s) => !(COMPARISON_PLAYER_STAT_CODES as string[]).includes(s))) {
            await markNotCalculable();
            return;
          }
          const noThreshold = isSimple && NO_THRESHOLD_STATS.has(c.stats[0] as StatCode);
          if (!noThreshold && c.threshold === null) {
            await markNotCalculable();
            return;
          }
          conditions.push({ kind: "PLAYER", players: c.players, stats: c.stats, threshold: c.threshold, comparison: c.comparison });
        } else {
          const side = resolveSide(c.kind);
          if (!side || c.threshold === null || c.stats.some((s) => !(COMPARISON_TEAM_STAT_CODES as string[]).includes(s))) {
            await markNotCalculable();
            return;
          }
          conditions.push({ kind: "TEAM", team: side, stats: c.stats, threshold: c.threshold, comparison: c.comparison });
        }
      }

      const prediction = await predictCombo(conditions, matchTeams.homeTeamName, matchTeams.awayTeamName, matchTeams.scheduledAt.slice(0, 10));
      if (!prediction || prediction.conditionsMeta.length !== conditions.length) {
        await markNotCalculable();
        return;
      }

      // Persiste les ids/équipes REELS (memes lecon que COMPARISON
      // ci-dessus) -- team_id derive de `conditions` (deja les VRAIES
      // equipes cote appelant), pas de la reponse du service.
      const structuredCombo = {
        conditions: prediction.conditionsMeta.map((meta, i) => ({
          kind: meta.kind,
          player_ids: meta.playerIds,
          team_id: conditions[i].kind === "TEAM"
            ? (conditions[i].team === "domicile" ? matchTeams.homeTeamId : matchTeams.awayTeamId)
            : null,
          stats: meta.stats,
          threshold: comboBet.conditions[i].threshold,
          comparison: comboBet.conditions[i].comparison,
        })),
      };

      await supabase.rpc("update_bet_structuration", {
        p_bet_id: betId,
        p_structured_player_name: null,
        p_structured_player_id: null,
        p_structured_team_id: null,
        p_structured_duel: null,
        p_structured_combo: structuredCombo,
        p_structured_period: null,
        p_stat: null,
        p_threshold: null,
        p_comparison: null,
        p_is_calculable: true,
        p_calculated_proba: prediction.proba,
        p_suggested_difficulty: probaToDifficulty(prediction.proba),
        p_category: "MULTI_PLAYER_COMBO" satisfies BetCategory,
      });
      return;
    }

    // bet_subject === "PLAYER" à partir d'ici (comportement inchangé).
    const player = structuration.player;
    if (!player) {
      await markNotCalculable();
      return;
    }
    // comparison est légitimement null pour dd/td (NO_THRESHOLD_STATS,
    // probabilité directe) -- ne l'exiger que pour les stats à seuil. Bug
    // réel trouvé en testant le 21/08/2026 : la condition d'origine
    // exigeait comparison partout, faisant tomber TOUS les paris dd/td en
    // "non calculable" alors qu'ils le sont bel et bien.
    const stat = player.stat as StatCode;
    if (!NO_THRESHOLD_STATS.has(stat) && (player.threshold === null || !player.comparison)) {
      await markNotCalculable();
      return;
    }

    // Joueur identifié mais absent des 2 équipes du match (bug réel trouvé
    // le 21/08/2026, ex. "LeBron James" sur un match Atlanta-Boston) --
    // proba forcée à 0% SANS appeler le micro-service (celui-ci ne connaît
    // pas le contexte du match, il calculerait une vraie proba à partir des
    // stats du joueur, ignorant qu'il ne joue pas ce soir-là -- exactement
    // le bug d'origine). Reste calculable=true (accepté, auto-validé,
    // perdra simplement à la résolution) plutôt que rejeté -- décidé avec
    // l'utilisateur pour ne jamais bloquer une soumission (même principe
    // que decisions_0.2.4 §4).
    if (player.not_in_match) {
      // p_structured_player_id: null -- le micro-service n'est jamais appelé
      // dans ce cas précis (voir plus bas), donc jamais de vrai player_id
      // résolu ici. Sans conséquence pour la résolution automatique (Phase
      // 6) : ce pari perd de toute façon à coup sûr (joueur absent du
      // match), pas besoin de retrouver sa vraie stat pour le savoir --
      // reste néanmoins non résolu automatiquement pour l'instant, noté
      // dans GAPS_OUVERTS.md comme amélioration possible.
      await supabase.rpc("update_bet_structuration", {
        p_bet_id: betId,
        p_structured_player_name: player.name,
        p_structured_player_id: null,
        p_structured_team_id: null,
        p_structured_duel: null,
        p_structured_combo: null,
        p_structured_period: null,
        p_stat: player.stat,
        p_threshold: player.threshold,
        p_comparison: player.comparison,
        p_is_calculable: true,
        p_calculated_proba: 0,
        p_suggested_difficulty: probaToDifficulty(0),
        p_category: "PLAYER_PROP" satisfies BetCategory,
      });
      return;
    }

    // Pari SERIE (brique (d) du chantier, GAPS_OUVERTS.md) : proba "au moins
    // une fois sur la série" plutôt que "au prochain match", cf.
    // predictSeriesStat()/compute_series_stat_proba(). Nécessite l'équipe du
    // joueur (player.team, résolue par l'IA depuis matchContext) ET le
    // match 1 réel de la série (avantage du terrain) -- repli non-calculable
    // si l'un des deux manque (série pas encore programmée, ou équipe non
    // résolue), jamais bloquant.
    let prediction: Awaited<ReturnType<typeof predictOverUnder>> = null;
    if (scope === "SERIES") {
      const homeCourt = await resolveSeriesHomeCourtTeam(supabase, seriesId);
      const playerTeamName =
        player.team === "team1" ? teamNames?.[0]
        : player.team === "team2" ? teamNames?.[1]
        : null;
      if (homeCourt && playerTeamName) {
        prediction = await predictSeriesStat(
          player.name,
          stat,
          player.threshold,
          player.comparison,
          homeCourt.homeTeamName,
          homeCourt.awayTeamName,
          playerTeamName,
        );
      }
    } else {
      prediction = await predictOverUnder(player.name, stat, player.threshold, player.comparison);
    }
    if (!prediction) {
      await markNotCalculable();
      return;
    }

    const suggestedDifficulty = probaToDifficulty(prediction.proba);

    await supabase.rpc("update_bet_structuration", {
      p_bet_id: betId,
      p_structured_player_name: player.name,
      p_structured_player_id: prediction.playerId,
      p_structured_team_id: null,
      p_structured_duel: null,
      p_structured_combo: null,
      p_structured_period: null,
      p_stat: player.stat,
      p_threshold: player.threshold,
      p_comparison: player.comparison,
      p_is_calculable: true,
      p_calculated_proba: prediction.proba,
      p_suggested_difficulty: suggestedDifficulty,
      p_category: "PLAYER_PROP" satisfies BetCategory,
    });
  } catch {
    // Best-effort : ne jamais faire échouer submitBet à cause de cette
    // étape d'enrichissement -- y compris si structureBet()/predictOverUnder()
    // lèvent une exception avant d'avoir pu répondre (timeout réseau...) :
    // on n'a alors même pas de réponse IA à enregistrer, is_calculable
    // reste NULL dans ce cas précis (panne, pas une décision).
  }
}
