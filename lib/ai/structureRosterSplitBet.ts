import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { STAT_CODES, STAT_LABELS_FR } from "./statCodes";
import { recordAnthropicUsage } from "./usageTracking";

// Chantier "5 majeur / banc" (24/08/2026, GAPS_OUVERTS.md) -- schéma
// SÉPARÉ de structureBet.ts, même patron que structurePeriodBet.ts (voir
// sa docstring pour le POURQUOI : le schéma partagé est au plafond de
// complexité accepté par l'API Claude, tout nouveau type de pari passe
// désormais par un schéma dédié routé en amont par mot-clé, jamais par un
// 8e/9e bet_subject dans le schéma existant).
//
// Portée v1 : STARTERS_SUM (somme des titulaires vs seuil), BENCH_SUM
// (total équipe moins titulaires vs seuil), STARTERS_SHARE (part du total
// équipe marquée par les titulaires). PAS "10 titulaires marquent chacun
// 8+" (ET individuel sur 10 joueurs -- relève du comptage roster-wide,
// chantier séparé, GAPS_OUVERTS.md).
const RosterSplitBetStructurationSchema = z.object({
  calculable: z
    .boolean()
    .describe(
      "true si ce texte porte sur le 5 majeur (titulaires) OU le banc (remplaçants) d'UNE équipe précise, avec " +
        "tous les champs de roster_split_bet requis remplis. false sinon -- ne force jamais une extraction incertaine.",
    ),
  bet_subject: z
    .enum(["ROSTER_SPLIT"])
    .nullable()
    .describe("\"ROSTER_SPLIT\" si calculable=true, sinon null."),
  roster_split_bet: z
    .object({
      kind: z
        .enum(["STARTERS_SUM", "BENCH_SUM", "STARTERS_SHARE"])
        .describe(
          "STARTERS_SUM : somme d'une stat pour les 5 titulaires (\"le 5 majeur marque au moins 85 points\"). " +
            "BENCH_SUM : somme d'une stat pour le banc/les remplaçants (\"le banc marque moins de 10 points\"). " +
            "STARTERS_SHARE : part du total de l'équipe marquée par les titulaires (\"le 5 majeur marque plus de " +
            "68% des points totaux de l'équipe\") -- threshold est alors une FRACTION 0-1, pas une valeur brute.",
        ),
      team: z.enum(["team1", "team2"]).describe("Équipe dont le 5 majeur/banc est visé."),
      stat: z
        .enum(STAT_CODES as [string, ...string[]])
        .describe("Stat comptée concernée (pts le plus courant, mais reb/ast/etc valides aussi)."),
      threshold: z
        .number()
        .describe("Seuil. Pour STARTERS_SHARE : fraction 0-1 (ex. 68% -> 0.68), pas 68."),
      comparison: z.enum(["OVER", "UNDER"]),
    })
    .nullable()
    .describe("Rempli seulement si calculable=true, sinon null."),
  reasoning: z
    .string()
    .describe("Explication TRÈS COURTE (10-15 mots), pour trace/debug admin, pas pour le joueur."),
});

export type RosterSplitBetStructuration = z.infer<typeof RosterSplitBetStructurationSchema>;

function buildStaticSystemText(): string {
  const statList = STAT_CODES.map((code) => `- "${code}" : ${STAT_LABELS_FR[code]}`).join("\n");
  return (
    "Tu structures des paris personnalisés NBA écrits en texte libre par des joueurs d'une ligue entre amis, " +
    "pour un calcul de probabilité automatique. On t'a déjà présélectionné ce texte comme RESSEMBLANT à un pari " +
    "sur le 5 majeur (titulaires) ou le banc (remplaçants) d'UNE équipe -- ton rôle est de confirmer et " +
    "structurer, ou de rejeter (calculable=false) si ce n'est finalement pas le cas. TOUJOURS pour UN match " +
    "précis, TOUJOURS une seule équipe visée (jamais \"les titulaires des deux équipes\" -- calculable=false " +
    "dans ce cas, non géré).\n\n" +
    "Stats valides :\n" + statList + "\n\n" +
    "Exemples calculable=true : \"Le cinq majeur des Knicks marque plus de 68% des points totaux de l'équipe\" " +
    "(kind=STARTERS_SHARE, team=Knicks, stat=pts, threshold=0.68, comparison=OVER), \"Le banc de Detroit marque " +
    "strictement moins de 10 points\" (kind=BENCH_SUM, team=Detroit, stat=pts, threshold=10, comparison=UNDER), " +
    "\"Le 5 majeur des Lakers marque plus de 85 points au total\" (kind=STARTERS_SUM, team=Lakers, stat=pts, " +
    "threshold=85, comparison=OVER).\n\n" +
    "Exemples calculable=false : \"les titulaires des deux équipes marquent plus de 70% du total du match\" " +
    "(2 équipes à la fois, non géré) ; \"les 10 joueurs titulaires marquent chacun plus de 8 points\" (condition " +
    "INDIVIDUELLE sur chaque titulaire, pas une somme -- non géré) ; toute formulation qui ne nomme pas " +
    "clairement \"le 5 majeur\"/\"les titulaires\"/\"le banc\"/\"les remplaçants\" d'une équipe précise."
  );
}

function buildDynamicSystemText(teamNames: [string, string] | null): string {
  if (!teamNames) return "";
  return `\n\nCe pari concerne un match entre **team1 = ${teamNames[0]}** et **team2 = ${teamNames[1]}**.`;
}

/** Même contrat/patron que structureBet()/structurePeriodBet() (modèle,
 *  cache de prompt). Appelée UNIQUEMENT quand ROSTER_SPLIT_KEYWORD_REGEX
 *  (structureAndScoreBet.ts) matche le texte du pari -- jamais en plus de
 *  structureBet(), toujours à la place. */
export async function structureRosterSplitBet(
  description: string,
  teamNames: [string, string] | null = null,
  model = "claude-sonnet-5",
): Promise<RosterSplitBetStructuration | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.parse({
      model,
      max_tokens: 2048,
      system: [
        { type: "text", text: buildStaticSystemText(), cache_control: { type: "ephemeral" } },
        { type: "text", text: buildDynamicSystemText(teamNames) },
      ],
      messages: [{ role: "user", content: `Pari à structurer : "${description}"` }],
      output_config: { format: zodOutputFormat(RosterSplitBetStructurationSchema) },
    });
    await recordAnthropicUsage("structureRosterSplitBet", model, response.usage);
    return response.parsed_output;
  } catch {
    return null;
  }
}
