import { z } from "zod";
import { sumQuarters, type NormalizedMatchStatus } from "@/lib/nba/client";
import type { MatchResultFields, QuarterScores } from "@/lib/sync/results";

// Source "résultats NBA" (scoreboard live cdn.nba.com, repli ScoreboardV3 de
// stats.nba.com) poussée par la VM vers /api/sync/results-nba. La VM envoie un
// sous-ensemble quasi brut du JSON NBA : TOUTE la normalisation vit ici, à un
// seul endroit, pour ne pas dupliquer de logique en Python.

const teamSchema = z.object({
  teamTricode: z.string().regex(/^[A-Z]{3}$/),
  score: z.number().int().min(0),
  periods: z
    .array(z.object({ period: z.number().int().min(1).max(20), periodType: z.string().max(32).optional(), score: z.number().int().min(0) }))
    .max(20),
});

export const nbaLiveGameSchema = z.object({
  gameId: z.string().regex(/^\d{10}$/),
  gameCode: z.string().max(64).optional(),
  // Enum fermé : une valeur inattendue est rejetée plutôt que devinée.
  gameStatus: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  gameStatusText: z.string().max(64),
  period: z.number().int().min(0).max(20),
  gameTimeUTC: z.string().datetime({ offset: true }),
  homeTeam: teamSchema,
  awayTeam: teamSchema,
});

export const nbaLivePayloadSchema = z.object({
  source: z.enum(["NBA_CDN_SCOREBOARD", "NBA_STATS_SCOREBOARDV3"]),
  dryRun: z.boolean().optional(),
  games: z.array(nbaLiveGameSchema).max(30),
});

export type NbaLiveGame = z.infer<typeof nbaLiveGameSchema>;
export type NbaLivePayload = z.infer<typeof nbaLivePayloadSchema>;

export type NormalizedNbaGame = {
  gameId: string;
  gameTimeUTC: string;
  homeTricode: string;
  awayTricode: string;
  result: MatchResultFields;
};

export type NormalizeNbaGameOutcome =
  | { ok: true; game: NormalizedNbaGame }
  | { ok: false; gameId: string; reason: string };

function nbaStatus(game: NbaLiveGame): NormalizedMatchStatus {
  if (game.gameStatus === 3) return "FINISHED";
  if (game.gameStatus === 2) return "IN_PROGRESS";
  if (/ppd|postponed/i.test(game.gameStatusText)) return "POSTPONED";
  if (/cancel/i.test(game.gameStatusText)) return "CANCELLED";
  return "SCHEDULED";
}

const sortedScores = (periods: NbaLiveGame["homeTeam"]["periods"]) =>
  [...periods].sort((a, b) => a.period - b.period).map((p) => p.score);

/** Normalise un match NBA vers les champs de résultat de l'app, dans le sens
 *  NBA (domicile/extérieur NBA) : l'inversion éventuelle vers le sens de
 *  l'app se fait ensuite, une fois le match rapproché (orientToApp). */
export function normalizeNbaGame(game: NbaLiveGame): NormalizeNbaGameOutcome {
  const status = nbaStatus(game);
  const base = { gameId: game.gameId, gameTimeUTC: game.gameTimeUTC, homeTricode: game.homeTeam.teamTricode, awayTricode: game.awayTeam.teamTricode };

  // Pas de score tant que le match n'a pas commencé (ou s'il est reporté/annulé) :
  // évite un recalcul inutile à chaque passage (sumQuarters([]) = 0 écraserait null).
  if (status === "SCHEDULED" || status === "POSTPONED" || status === "CANCELLED") {
    return { ok: true, game: { ...base, result: { status, home_score: null, away_score: null, went_to_ot: null, quarter_scores: null } } };
  }

  let home = sortedScores(game.homeTeam.periods);
  let away = sortedScores(game.awayTeam.periods);
  // En cours, la NBA pré-remplit les quarts futurs à 0 : on tronque à la période courante.
  // period 0 en tout début de match : on garde au moins le 1er quart-temps.
  if (status === "IN_PROGRESS") {
    const played = Math.max(game.period, 1);
    home = home.slice(0, played);
    away = away.slice(0, played);
  }
  if (home.length === 0 || away.length === 0 || home.length !== away.length) {
    return { ok: false, gameId: game.gameId, reason: "périodes absentes ou incohérentes" };
  }
  // Terminé : la somme des périodes doit égaler le score officiel, sinon on
  // attend le prochain passage plutôt que d'écrire un résultat douteux.
  if (status === "FINISHED" && (sumQuarters(home) !== game.homeTeam.score || sumQuarters(away) !== game.awayTeam.score)) {
    return { ok: false, gameId: game.gameId, reason: "incohérence score/périodes" };
  }

  return {
    ok: true,
    game: {
      ...base,
      result: {
        status,
        home_score: sumQuarters(home),
        away_score: sumQuarters(away),
        went_to_ot: home.length > 4,
        quarter_scores: { homeTeam: home, awayTeam: away },
      },
    },
  };
}

/** Remet un résultat dans le sens de l'app : sur un site neutre (Coupe à Las
 *  Vegas, matchs à l'étranger) domicile/extérieur NBA peuvent être inversés par
 *  rapport à matches.home_team_id. quarter_scores.homeTeam est lu par rapport à
 *  l'équipe domicile de l'APP (resolvePeriodBets) — sans inversion, les paris
 *  quart-temps/mi-temps se résoudraient à l'envers. */
export function orientToApp(game: NormalizedNbaGame, appHomeTricode: string): MatchResultFields {
  const r = game.result;
  if (game.homeTricode === appHomeTricode) return r;
  const swapped: QuarterScores | null = r.quarter_scores
    ? { homeTeam: r.quarter_scores.awayTeam, awayTeam: r.quarter_scores.homeTeam }
    : null;
  return { ...r, home_score: r.away_score, away_score: r.home_score, quarter_scores: swapped };
}
