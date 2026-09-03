import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

// Chantier "événements granulaires" (étape 6 du plan de reprise post-audit,
// 25/08/2026, GAPS_OUVERTS.md) -- schéma SÉPARÉ de structureBet.ts, même
// patron que structurePeriodBet.ts/structureSuperlativeBet.ts/etc.
//
// "X réalise au moins 1 contre SUR Y" -- contre attribué à un joueur
// PRÉCIS, pas juste un total de contres (déjà géré par bet_subject=PLAYER,
// stat="blk", ex. "Wembanyama réalise plus de 3 contres"). Distinct aussi
// de COMPARISON ("Aaron Gordon réalise plus de contres que Rudy Gobert" --
// compare 2 TOTAUX de contres entre eux, ne dit rien sur QUI est bloqué).
// Probabilité DIRECTE (pas de seuil/comparaison) -- même principe que dd/td.
const BlockOnPlayerBetStructurationSchema = z.object({
  calculable: z
    .boolean()
    .describe(
      "true si ce texte affirme qu'UN joueur nommé (le bloqueur) contre AU MOINS UNE FOIS un AUTRE joueur nommé " +
        "(la victime) précisément, avec blocker/victim remplis. false sinon -- ne force jamais une extraction " +
        "incertaine.",
    ),
  bet_subject: z
    .enum(["BLOCK_ON_PLAYER"])
    .nullable()
    .describe("\"BLOCK_ON_PLAYER\" si calculable=true, sinon null."),
  blocker: z.string().nullable().describe("Nom du joueur qui contre, exactement comme écrit dans le texte. Rempli seulement si calculable=true."),
  victim: z.string().nullable().describe("Nom du joueur visé par le contre, exactement comme écrit dans le texte. Rempli seulement si calculable=true."),
  reasoning: z
    .string()
    .describe("Explication TRÈS COURTE (10-15 mots), pour trace/debug admin, pas pour le joueur."),
});

export type BlockOnPlayerBetStructuration = z.infer<typeof BlockOnPlayerBetStructurationSchema>;

function buildStaticSystemText(): string {
  return (
    "Tu structures des paris personnalisés NBA écrits en texte libre par des joueurs d'une ligue entre amis, " +
    "pour un calcul de probabilité automatique. On t'a déjà présélectionné ce texte comme RESSEMBLANT à un pari " +
    "\"contre sur un joueur précis\" -- UN joueur nommé (bloqueur) contre AU MOINS UNE FOIS un AUTRE joueur " +
    "nommé (victime) précisément -- ton rôle est de confirmer et structurer, ou de rejeter (calculable=false) si " +
    "ce n'est finalement pas le cas. TOUJOURS pour UN match précis.\n\n" +
    "Exemple calculable=true : \"Victor Wembanyama réalise au moins 1 contre sur Chet Holmgren\" " +
    "(blocker=\"Victor Wembanyama\", victim=\"Chet Holmgren\").\n\n" +
    "Exemples calculable=false : \"Wembanyama réalise plus de 3 contres\" (total de contres, PAS un adversaire " +
    "précis -- relève de bet_subject=PLAYER) ; \"Aaron Gordon réalise plus de contres que Rudy Gobert\" (compare " +
    "2 TOTAUX de contres entre eux, ne dit rien sur QUI est bloqué -- relève de COMPARISON) ; \"le total cumulé " +
    "des contres des deux équipes est supérieur à 25\" (stat de match, aucun joueur précis)."
  );
}

function buildDynamicSystemText(teamNames: [string, string] | null): string {
  if (!teamNames) return "";
  return `\n\nCe pari concerne un match entre **team1 = ${teamNames[0]}** et **team2 = ${teamNames[1]}**.`;
}

/** Même contrat/patron que structureSuperlativeBet() (modèle, cache de
 *  prompt). Appelée UNIQUEMENT quand BLOCK_ON_PLAYER_KEYWORD_REGEX
 *  (structureAndScoreBet.ts) matche le texte du pari -- jamais en plus des
 *  autres structure*Bet(), toujours à la place. */
export async function structureBlockOnPlayerBet(
  description: string,
  teamNames: [string, string] | null = null,
  model = "claude-sonnet-5",
): Promise<BlockOnPlayerBetStructuration | null> {
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
      output_config: { format: zodOutputFormat(BlockOnPlayerBetStructurationSchema) },
    });
    return response.parsed_output;
  } catch {
    return null;
  }
}
