import { z } from "zod";
import { nyDateString } from "@/lib/dates/newyork";

// Feuille de match statique (box score seul) d'un match NBA terminé : un JSON par
// match, écrit par la VM (Cadrage/Stats/service/box_scores.py) dans le bucket
// Supabase Storage public `box-scores`, lu ici directement sur le CDN de Supabase
// (aucune requête en base, aucun CPU Vercel). Contrat partagé avec Python : la
// fixture Cadrage/Stats/service/tests/fixtures/box_score_reduced.json est lue par
// les deux suites de tests.

export const BOX_SCORES_BUCKET = "box-scores";

const statsShape = {
  pts: z.number().int(),
  reb: z.number().int(),
  oreb: z.number().int(),
  dreb: z.number().int(),
  ast: z.number().int(),
  stl: z.number().int(),
  blk: z.number().int(),
  tov: z.number().int(),
  pf: z.number().int(),
  fgm: z.number().int(),
  fga: z.number().int(),
  tpm: z.number().int(),
  tpa: z.number().int(),
  ftm: z.number().int(),
  fta: z.number().int(),
};

const playerSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  short: z.string(),
  jersey: z.string(),
  pos: z.string(),
  starter: z.boolean(),
  min: z.string(),
  pm: z.number().int(),
  ...statsShape,
});

const teamSchema = z.object({
  side: z.enum(["away", "home"]),
  tricode: z.string().regex(/^[A-Z]{3}$/),
  city: z.string(),
  name: z.string(),
  score: z.number().int(),
  players: z.array(playerSchema),
  dnp: z.array(z.object({ name: z.string(), reason: z.string() })),
  totals: z.object(statsShape),
});

export const boxScoreSheetSchema = z.object({
  v: z.literal(1),
  gameId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.string(),
  updatedAt: z.string(),
  teams: z.tuple([teamSchema, teamSchema]),
});

export type BoxScoreSheet = z.infer<typeof boxScoreSheetSchema>;
export type BoxScoreTeam = BoxScoreSheet["teams"][number];
export type BoxScorePlayer = BoxScoreTeam["players"][number];

/** Chemin dans le bucket : `{jour NY}/{TRI}-{TRI}.json`, tricodes triés (l'ordre
 *  domicile/extérieur peut différer entre les sources). Même règle que
 *  `object_path` dans box_scores.py, et même jour NY que resolveNbaGameId (le
 *  scoreboard NBA range un match sous le jour NY de son coup d'envoi). */
export function boxScorePath(scheduledAtIso: string, abbrA: string, abbrB: string): string {
  const [first, second] = [abbrA, abbrB].sort();
  return `${nyDateString(new Date(scheduledAtIso))}/${first}-${second}.json`;
}

export function boxScoreUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${BOX_SCORES_BUCKET}/${path}`;
}

/** « 12/25 » + pourcentage arrondi (« 48 % »), ou « 0/0 » sans pourcentage. */
export function shootingLine(made: number, attempted: number): { ratio: string; pct: string | null } {
  return {
    ratio: `${made}/${attempted}`,
    pct: attempted > 0 ? `${Math.round((made / attempted) * 100)} %` : null,
  };
}
