import "server-only";
import { getServerClient } from "@/lib/supabase/server";
import { structureBet } from "./structureBet";
import {
  predictOverUnder,
  predictSeriesStat,
  predictTotalPoints,
  predictTotalTeamStat,
  predictTeamStat,
  predictComparison,
  type DuelOperand,
} from "./statsService";
import type { TeamStatCode } from "./teamStatCodes";
import { probaToDifficulty } from "./difficultyTiers";
import { NO_THRESHOLD_STATS, type StatCode } from "./statCodes";
import { COMPARISON_PLAYER_STAT_CODES, COMPARISON_TEAM_STAT_CODES } from "./comparisonCodes";

// Orchestre la structuration IA + le calcul de proba pour UN pari, à la
// soumission (SPEC_TECHNIQUE_PROBA_PARIS_PERSOS_V0_1.md §3/§6, décidé le
// 21/08/2026 : synchrone, figé à la soumission -- jamais recalculé après).
// Appelée depuis submitBet APRÈS que le pari existe déjà en base
// (save_bet a réussi) -- toute panne ici (IA, service Cloud Run, réseau)
// est avalée silencieusement : le pari reste soumis normalement, avec le
// mécanisme manuel existant (difficulté proposée/validée à la main) comme
// seul repli, jamais bloquant pour le joueur.

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

  try {
    const teamNames = await resolveMatchTeamNames(supabase, seriesId);
    const structuration = await structureBet(description, teamNames);
    if (!structuration || !structuration.calculable || !structuration.bet_subject) {
      await markNotCalculable();
      return;
    }

    // Pari MATCH_TOTAL (pièce (a) du chantier, GAPS_OUVERTS.md) -- 1er pari
    // SANS JOUEUR : score combiné du match. MATCH uniquement pour l'instant
    // (pas SÉRIE -- décidé avec l'utilisateur, viendra dans un 2e temps,
    // même schéma de reprise que a0 -> pièces c/d/e). Branche entièrement
    // séparée de la suite (spécifique aux paris JOUEUR) : aucun joueur à
    // résoudre, aucune notion d'avantage du terrain sur une série.
    if (structuration.bet_subject === "MATCH_TOTAL") {
      if (
        scope !== "MATCH" ||
        !matchId ||
        !structuration.match_stat ||
        structuration.threshold === null ||
        (structuration.comparison !== "OVER" && structuration.comparison !== "UNDER")
      ) {
        await markNotCalculable();
        return;
      }
      const matchTeams = await resolveMatchTeams(supabase, matchId);
      if (!matchTeams) {
        await markNotCalculable();
        return;
      }
      // as_of_date = date RÉELLE du match visé (pas "aujourd'hui" comme pour
      // un pari série) -- un match précis a une vraie date connue, plus
      // fidèle pour le calcul de repos/contexte équipe.
      const prediction =
        structuration.match_stat === "total_points"
          ? await predictTotalPoints(
              matchTeams.homeTeamName,
              matchTeams.awayTeamName,
              structuration.threshold,
              structuration.comparison,
              matchTeams.scheduledAt.slice(0, 10),
            )
          : await predictTotalTeamStat(
              structuration.match_stat.slice("total_".length) as TeamStatCode,
              matchTeams.homeTeamName,
              matchTeams.awayTeamName,
              structuration.threshold,
              structuration.comparison,
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
        p_structured_team_id: null,
        p_structured_duel: null,
        p_stat: structuration.match_stat,
        p_threshold: structuration.threshold,
        p_comparison: structuration.comparison,
        p_is_calculable: true,
        p_calculated_proba: prediction.proba,
        p_suggested_difficulty: probaToDifficulty(prediction.proba),
      });
      return;
    }

    // Pari TEAM_STAT (pièce (a) suite, GAPS_OUVERTS.md) -- stat d'UNE
    // équipe précise sur CE match, perspective "own"/"opp" (pas domicile/
    // extérieur) -- MATCH uniquement, même limite que MATCH_TOTAL ci-dessus.
    if (structuration.bet_subject === "TEAM_STAT") {
      if (
        scope !== "MATCH" ||
        !matchId ||
        !structuration.team_stat ||
        !structuration.team_stat_team ||
        structuration.threshold === null ||
        (structuration.comparison !== "OVER" && structuration.comparison !== "UNDER")
      ) {
        await markNotCalculable();
        return;
      }
      const teamName =
        structuration.team_stat_team === "team1" ? teamNames?.[0]
        : structuration.team_stat_team === "team2" ? teamNames?.[1]
        : null;
      const matchTeams = await resolveMatchTeams(supabase, matchId);
      if (!teamName || !matchTeams || (teamName !== matchTeams.homeTeamName && teamName !== matchTeams.awayTeamName)) {
        await markNotCalculable();
        return;
      }
      const isHome = teamName === matchTeams.homeTeamName;
      const opponentName = isHome ? matchTeams.awayTeamName : matchTeams.homeTeamName;
      const teamId = isHome ? matchTeams.homeTeamId : matchTeams.awayTeamId;
      const prediction = await predictTeamStat(
        structuration.team_stat as TeamStatCode,
        teamName,
        opponentName,
        isHome,
        structuration.threshold,
        structuration.comparison,
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
        p_stat: structuration.team_stat,
        p_threshold: structuration.threshold,
        p_comparison: structuration.comparison,
        p_is_calculable: true,
        p_calculated_proba: prediction.proba,
        p_suggested_difficulty: probaToDifficulty(prediction.proba),
      });
      return;
    }

    // Pari COMPARISON (24/08/2026, GAPS_OUVERTS.md, chantier comparaison/
    // duel) -- compare 2 côtés entre eux (jamais contre un seuil fixe, sauf
    // DIFF_LT qui borne un ÉCART). MATCH uniquement, même limite que
    // TEAM_STAT/MATCH_TOTAL ci-dessus. relation/multiplicateur portés par
    // comparison/threshold (PAS des champs dédiés -- limite API de 16
    // champs nullable/union par schéma de sortie structurée, dépassée à 19
    // avec des champs séparés, cf. structureBet.ts).
    if (structuration.bet_subject === "COMPARISON") {
      const relation = structuration.comparison === "GT" || structuration.comparison === "DIFF_LT"
        ? structuration.comparison
        : null;
      if (
        scope !== "MATCH" ||
        !matchId ||
        !structuration.comparison_left_kind ||
        !structuration.comparison_left_stat ||
        !structuration.comparison_right_kind ||
        !structuration.comparison_right_stat ||
        !relation ||
        (relation === "DIFF_LT" && structuration.threshold === null)
      ) {
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

      const buildOperand = (
        kind: "PLAYER" | "team1" | "team2" | null,
        players: string[],
        stat: string | null,
      ): DuelOperand | null => {
        if (!kind || !stat) return null;
        if (kind === "PLAYER") {
          if (players.length === 0 || !(COMPARISON_PLAYER_STAT_CODES as string[]).includes(stat)) return null;
          return { kind: "PLAYER", players, stat };
        }
        const side = resolveSide(kind);
        if (!side || !(COMPARISON_TEAM_STAT_CODES as string[]).includes(stat)) return null;
        return { kind: "TEAM", team: side, stat };
      };

      const left = buildOperand(
        structuration.comparison_left_kind,
        structuration.comparison_left_players,
        structuration.comparison_left_stat,
      );
      const right = buildOperand(
        structuration.comparison_right_kind,
        structuration.comparison_right_players,
        structuration.comparison_right_stat,
      );
      if (!left || !right) {
        await markNotCalculable();
        return;
      }

      // threshold est overloadé selon la relation (cf. structureBet.ts) :
      // multiplicateur pour GT (1 par défaut si absent), borne d'écart pour
      // DIFF_LT (déjà validé non-null par le garde plus haut).
      const multiplier = relation === "GT" ? (structuration.threshold ?? 1) : 1;
      const diffThreshold = relation === "DIFF_LT" ? structuration.threshold : null;

      const prediction = await predictComparison(
        left,
        right,
        relation,
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
        relation,
        multiplier,
      };

      await supabase.rpc("update_bet_structuration", {
        p_bet_id: betId,
        p_structured_player_name: null,
        p_structured_player_id: null,
        p_structured_team_id: null,
        p_structured_duel: structuredDuel,
        p_stat: null,
        p_threshold: diffThreshold,
        p_comparison: null,
        p_is_calculable: true,
        p_calculated_proba: prediction.proba,
        p_suggested_difficulty: probaToDifficulty(prediction.proba),
      });
      return;
    }

    // bet_subject === "PLAYER" à partir d'ici (comportement inchangé,
    // seul le nom du champ change : stat -> player_stat, cf. structureBet.ts).
    if (!structuration.player_name || !structuration.player_stat) {
      await markNotCalculable();
      return;
    }
    // comparison est légitimement null pour dd/td (NO_THRESHOLD_STATS,
    // probabilité directe) -- ne l'exiger que pour les stats à seuil. Bug
    // réel trouvé en testant le 21/08/2026 : la condition d'origine
    // exigeait comparison partout, faisant tomber TOUS les paris dd/td en
    // "non calculable" alors qu'ils le sont bel et bien.
    // overUnder (pas structuration.comparison directement) : le champ porte
    // aussi GT/DIFF_LT depuis le chantier COMPARISON (24/08/2026) -- narrows
    // vers OVER/UNDER|null uniquement, seules valeurs valides pour un pari
    // PLAYER (bet_subject discrimine déjà, mais le type Zod du champ ne le
    // sait pas).
    const stat = structuration.player_stat as StatCode;
    const overUnder = structuration.comparison === "OVER" || structuration.comparison === "UNDER"
      ? structuration.comparison
      : null;
    if (!NO_THRESHOLD_STATS.has(stat) && !overUnder) {
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
    if (structuration.player_not_in_match) {
      // p_structured_player_id: null -- le micro-service n'est jamais appelé
      // dans ce cas précis (voir plus bas), donc jamais de vrai player_id
      // résolu ici. Sans conséquence pour la résolution automatique (Phase
      // 6) : ce pari perd de toute façon à coup sûr (joueur absent du
      // match), pas besoin de retrouver sa vraie stat pour le savoir --
      // reste néanmoins non résolu automatiquement pour l'instant, noté
      // dans GAPS_OUVERTS.md comme amélioration possible.
      await supabase.rpc("update_bet_structuration", {
        p_bet_id: betId,
        p_structured_player_name: structuration.player_name,
        p_structured_player_id: null,
        p_structured_team_id: null,
        p_structured_duel: null,
        p_stat: structuration.player_stat,
        p_threshold: structuration.threshold,
        p_comparison: overUnder,
        p_is_calculable: true,
        p_calculated_proba: 0,
        p_suggested_difficulty: probaToDifficulty(0),
      });
      return;
    }

    // Pari SERIE (brique (d) du chantier, GAPS_OUVERTS.md) : proba "au moins
    // une fois sur la série" plutôt que "au prochain match", cf.
    // predictSeriesStat()/compute_series_stat_proba(). Nécessite l'équipe du
    // joueur (structuration.player_team, résolue par l'IA depuis
    // matchContext) ET le match 1 réel de la série (avantage du terrain) --
    // repli non-calculable si l'un des deux manque (série pas encore
    // programmée, ou équipe non résolue), jamais bloquant.
    let prediction: Awaited<ReturnType<typeof predictOverUnder>> = null;
    if (scope === "SERIES") {
      const homeCourt = await resolveSeriesHomeCourtTeam(supabase, seriesId);
      const playerTeamName =
        structuration.player_team === "team1" ? teamNames?.[0]
        : structuration.player_team === "team2" ? teamNames?.[1]
        : null;
      if (homeCourt && playerTeamName) {
        prediction = await predictSeriesStat(
          structuration.player_name,
          stat,
          structuration.threshold,
          overUnder,
          homeCourt.homeTeamName,
          homeCourt.awayTeamName,
          playerTeamName,
        );
      }
    } else {
      prediction = await predictOverUnder(
        structuration.player_name,
        stat,
        structuration.threshold,
        overUnder,
      );
    }
    if (!prediction) {
      await markNotCalculable();
      return;
    }

    const suggestedDifficulty = probaToDifficulty(prediction.proba);

    await supabase.rpc("update_bet_structuration", {
      p_bet_id: betId,
      p_structured_player_name: structuration.player_name,
      p_structured_player_id: prediction.playerId,
      p_structured_team_id: null,
      p_structured_duel: null,
      p_stat: structuration.player_stat,
      p_threshold: structuration.threshold,
      p_comparison: overUnder,
      p_is_calculable: true,
      p_calculated_proba: prediction.proba,
      p_suggested_difficulty: suggestedDifficulty,
    });
  } catch {
    // Best-effort : ne jamais faire échouer submitBet à cause de cette
    // étape d'enrichissement -- y compris si structureBet()/predictOverUnder()
    // lèvent une exception avant d'avoir pu répondre (timeout réseau...) :
    // on n'a alors même pas de réponse IA à enregistrer, is_calculable
    // reste NULL dans ce cas précis (panne, pas une décision).
  }
}
