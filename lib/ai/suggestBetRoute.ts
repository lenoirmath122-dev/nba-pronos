import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { recordAnthropicUsage } from "./usageTracking";
import type { BetRoutingDecision } from "./structureAndScoreBet";

// Seconde chance d'aiguillage (28/10/2026, revue des paris passés par
// l'admin) : 6 paris sur 17 étaient partis vers le schéma général alors
// qu'un schéma dédié savait les traiter, faute de mot-clé reconnu (nombre
// en lettres, "aucun joueur", fautes de frappe). Appelée UNIQUEMENT quand
// structureBet() a répondu calculable=false -- jamais sur un pari que le
// schéma général sait traiter, jamais deux fois pour le même pari. Haiku :
// une classification en une étiquette, coût négligeable devant l'appel
// Sonnet qui a déjà échoué.
const SuggestedRouteSchema = z.object({
  route: z
    .enum([
      "PERIOD",
      "ROSTER_COUNT",
      "ROSTER_SPLIT",
      "SUPERLATIVE",
      "TECHNICAL_FOULS_COUNT",
      "LAST_BASKET",
      "BLOCK_ON_PLAYER",
      "COMBO_NESTED_OR",
      "GENERAL",
    ])
    .describe("Famille du pari, GENERAL si aucune autre ne correspond clairement."),
  clarification: z
    .string()
    .nullable()
    .describe(
      "Question COURTE au joueur, en le tutoyant, quand le pari est trop vague pour être tranché (ex. aucun " +
        "joueur ni équipe nommé alors que la statistique l'exige). null sinon.",
    ),
});

export type SuggestedRoute = { route: BetRoutingDecision; clarification: string | null };

const SYSTEM_TEXT =
  "Tu classes des paris personnalisés NBA écrits en texte libre (fautes de frappe fréquentes) dans UNE famille :\n" +
  "- PERIOD : porte sur une période précise du match (quart-temps, mi-temps) : vainqueur, écart, points sur la période.\n" +
  "- ROSTER_COUNT : un NOMBRE de joueurs (ou aucun joueur) remplit une condition individuelle " +
  "(\"trois joueurs en double-double\", \"aucun joueur à 30 points\", \"2 joueurs des Suns à 15 points\").\n" +
  "- ROSTER_SPLIT : total ou statistique du 5 majeur (titulaires) ou du banc (remplaçants).\n" +
  "- SUPERLATIVE : un joueur fait mieux que tous les autres (meilleur marqueur, passeur, rebondeur...).\n" +
  "- TECHNICAL_FOULS_COUNT : nombre exact de fautes techniques d'une équipe ou du match.\n" +
  "- LAST_BASKET : un joueur inscrit le dernier panier du match.\n" +
  "- BLOCK_ON_PLAYER : un joueur contre un autre joueur nommé.\n" +
  "- COMBO_NESTED_OR : plusieurs conditions mêlant \"et\" et \"ou\".\n" +
  "- GENERAL : tout le reste (un joueur nommé, une équipe sur le match entier, le score total, une " +
  "comparaison simple, ou un pari hors statistiques comme une blessure).\n" +
  "En cas de doute, réponds GENERAL.\n\n" +
  "clarification : remplis-la SEULEMENT si on ne peut pas savoir sur quoi porte le pari, par exemple " +
  "\"Plus de 10 rebonds\" (quel joueur ou quelle équipe ?) -> \"Qui doit prendre plus de 10 rebonds : un " +
  "joueur ou une équipe ?\". Jamais pour un pari clair mais hors statistiques (blessure, spectateur, homme du " +
  "match) : celui-là est traité à la main, null.";

/** `clarification` non nul = pari trop vague, à faire préciser au joueur
 *  avant tout envoi en file admin (lot 2 de la revue du 28/10/2026).
 *  null = IA indisponible ou en erreur : l'appelant garde le non-calcul déjà
 *  décidé, comme pour toute autre panne IA. */
export async function suggestBetRoute(
  description: string,
  model = "claude-haiku-5-5",
): Promise<SuggestedRoute | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.parse({
      model,
      max_tokens: 256,
      system: [{ type: "text", text: SYSTEM_TEXT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `Pari à classer : "${description}"` }],
      output_config: { format: zodOutputFormat(SuggestedRouteSchema) },
    });
    await recordAnthropicUsage("suggestBetRoute", model, response.usage);
    const parsed = response.parsed_output;
    if (!parsed) return null;
    const clarification = parsed.clarification?.trim() || null;
    return { route: parsed.route, clarification };
  } catch {
    return null;
  }
}
