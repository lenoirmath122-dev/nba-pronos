import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { recordAnthropicUsage } from "./usageTracking";

// Chantier "événements granulaires" (étape 6 du plan de reprise post-audit,
// 25/08/2026, GAPS_OUVERTS.md) -- schéma SÉPARÉ de structureBet.ts, même
// patron que structurePeriodBet.ts/structureSuperlativeBet.ts/etc (schéma
// partagé déjà au plafond de complexité accepté par l'API Claude, cf.
// docstring de structureBet.ts).
//
// "X inscrit le dernier panier du match" -- UN joueur nommé, probabilité
// DIRECTE (pas de seuil/comparaison), même principe que dd/td/SUPERLATIVE.
// Mécanisme le plus faible de cette étape (approximation par part attendue
// de paniers, pas la vraie dynamique du money-time) -- accepté avec
// l'utilisateur (25/08/2026) dans le même esprit que plus_minus/
// total_timeouts déjà en prod.
const LastBasketBetStructurationSchema = z.object({
  calculable: z
    .boolean()
    .describe(
      "true si ce texte affirme qu'UN joueur nommé inscrira le DERNIER panier (tir au panier, pas un lancer " +
        "franc) du match, avec player rempli. false sinon -- ne force jamais une extraction incertaine.",
    ),
  bet_subject: z
    .enum(["LAST_BASKET"])
    .nullable()
    .describe("\"LAST_BASKET\" si calculable=true, sinon null."),
  player: z.string().nullable().describe("Nom du joueur visé, exactement comme écrit dans le texte. Rempli seulement si calculable=true."),
  reasoning: z
    .string()
    .describe("Explication TRÈS COURTE (10-15 mots), pour trace/debug admin, pas pour le joueur."),
});

export type LastBasketBetStructuration = z.infer<typeof LastBasketBetStructurationSchema>;

function buildStaticSystemText(): string {
  return (
    "Tu structures des paris personnalisés NBA écrits en texte libre par des joueurs d'une ligue entre amis, " +
    "pour un calcul de probabilité automatique. On t'a déjà présélectionné ce texte comme RESSEMBLANT à un pari " +
    "\"dernier panier du match\" -- UN joueur nommé inscrit le DERNIER panier (tir au panier réussi, 2 ou " +
    "3 points -- PAS un lancer franc) du match -- ton rôle est de confirmer et structurer, ou de rejeter " +
    "(calculable=false) si ce n'est finalement pas le cas. TOUJOURS pour UN match précis.\n\n" +
    "Exemples calculable=true : \"Devin Vassell inscrit le dernier panier du match\" (player=\"Devin Vassell\"), " +
    "\"le dernier panier sera marqué par Jalen Brunson\" (player=\"Jalen Brunson\").\n\n" +
    "Exemples calculable=false : \"aucun panier marqué au buzzer durant le match\" (pas un joueur PRÉCIS, relève " +
    "d'un autre mécanisme) ; \"Devin Vassell marque plus de 20 points\" (pari joueur classique, pas le dernier " +
    "panier) ; \"le dernier panier de la série\" (porte sur PLUSIEURS matchs, pas géré)."
  );
}

function buildDynamicSystemText(teamNames: [string, string] | null): string {
  if (!teamNames) return "";
  return `\n\nCe pari concerne un match entre **team1 = ${teamNames[0]}** et **team2 = ${teamNames[1]}**.`;
}

/** Même contrat/patron que structureSuperlativeBet() (modèle, cache de
 *  prompt). Appelée UNIQUEMENT quand LAST_BASKET_KEYWORD_REGEX
 *  (structureAndScoreBet.ts) matche le texte du pari -- jamais en plus des
 *  autres structure*Bet(), toujours à la place. */
export async function structureLastBasketBet(
  description: string,
  teamNames: [string, string] | null = null,
  model = "claude-sonnet-5",
): Promise<LastBasketBetStructuration | null> {
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
      output_config: { format: zodOutputFormat(LastBasketBetStructurationSchema) },
    });
    await recordAnthropicUsage("structureLastBasketBet", model, response.usage);
    return response.parsed_output;
  } catch {
    return null;
  }
}
