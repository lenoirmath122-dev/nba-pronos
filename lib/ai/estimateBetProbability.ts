import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { recordAnthropicUsage } from "./usageTracking";
import { rosterPromptLines, type KnownRosters } from "./roster";

// Lot 3 de la revue des paris passés par l'admin (28/10/2026) : quand aucun
// script ne sait calculer un pari, Sonnet 5.5 (sans recherche web, décidé
// avec l'utilisateur) estime lui-même une probabilité. INFORMATIVE
// seulement : elle aide l'admin à fixer la difficulté, le pari reste non
// calculable et n'est jamais auto-validé ni auto-résolu sur cette base
// (même garantie que markNotCalculableWithEstimate, migration 20260906110000).
const ProbabilityEstimateSchema = z.object({
  estimable: z
    .boolean()
    .describe(
      "false si le pari est trop flou pour qu'une probabilité ait un sens (aucun sujet identifiable, " +
        "énoncé incompréhensible). true sinon, même si l'estimation est grossière.",
    ),
  proba: z
    .number()
    .nullable()
    .describe("Probabilité que le pari soit GAGNÉ, entre 0 et 1. null si estimable=false."),
  reasoning: z.string().describe("Raisonnement en une phrase (20-30 mots), pour l'admin, pas pour le joueur."),
});

export type ProbabilityEstimate = { proba: number; reasoning: string };

const SYSTEM_TEXT =
  "Tu estimes la probabilité qu'un pari personnalisé NBA, écrit en texte libre par un joueur d'une ligue entre " +
  "amis, soit GAGNÉ. Aucun script de calcul ne sait le traiter : ton estimation aide un admin à fixer sa " +
  "difficulté. Tu n'as pas accès au web : appuie-toi sur ta connaissance générale de la NBA et sur le contexte " +
  "fourni (équipes du match, effectifs récents).\n\n" +
  "Règles : une probabilité honnête, ni 0 ni 1 (borne-la entre 0.02 et 0.98) ; pour un événement rare ou sans " +
  "donnée (blessure en match, présence d'une personne dans le public, dunks précis), donne un ordre de grandeur " +
  "prudent plutôt que de refuser. estimable=false SEULEMENT si on ne comprend pas sur quoi porte le pari.";

/** null = non estimable, IA indisponible ou en erreur : le pari reste dans la
 *  file admin sans proba, comme avant. */
export async function estimateBetProbability(
  description: string,
  context: { teamNames: [string, string] | null; rosters: KnownRosters | null; scope: "MATCH" | "SERIES" },
  model = "claude-sonnet-5-5",
): Promise<ProbabilityEstimate | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }

  const client = new Anthropic({ apiKey });
  const { teamNames, rosters, scope } = context;
  const dynamic = teamNames
    ? `\n\nCe pari concerne ${scope === "SERIES" ? "une série" : "un match"} entre **team1 = ${teamNames[0]}** et ` +
      `**team2 = ${teamNames[1]}**.` +
      rosterPromptLines(rosters)
    : "";

  try {
    const response = await client.messages.parse({
      model,
      max_tokens: 1024,
      system: [
        { type: "text", text: SYSTEM_TEXT, cache_control: { type: "ephemeral" } },
        { type: "text", text: dynamic },
      ],
      messages: [{ role: "user", content: `Pari à estimer : "${description}"` }],
      output_config: { format: zodOutputFormat(ProbabilityEstimateSchema) },
    });
    await recordAnthropicUsage("estimateBetProbability", model, response.usage);
    const parsed = response.parsed_output;
    if (!parsed || !parsed.estimable || parsed.proba === null || !Number.isFinite(parsed.proba)) return null;
    return { proba: Math.min(0.98, Math.max(0.02, parsed.proba)), reasoning: parsed.reasoning.trim() };
  } catch {
    return null;
  }
}
