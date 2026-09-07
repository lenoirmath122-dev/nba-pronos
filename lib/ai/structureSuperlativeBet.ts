import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { STAT_LABELS_FR } from "./statCodes";
import { COMPARISON_PLAYER_STAT_CODES } from "./comparisonCodes";
import { recordAnthropicUsage } from "./usageTracking";

// Chantier "meilleur marqueur" / superlatif implicite (étape 4 du plan de
// reprise post-audit, 25/08/2026, GAPS_OUVERTS.md) -- schéma SÉPARÉ de
// structureBet.ts, même patron que structurePeriodBet.ts/
// structureRosterSplitBet.ts/structureRosterCountBet.ts.
//
// Débloque "X marque plus de {stat} que TOUT AUTRE joueur du match"
// (cause racine "superlatif implicite" de l'audit -- AUDIT_TYPES_PARIS_
// 24_08_2026.md, catégorie "Meilleur marqueur", 9 paris) -- un ensemble de
// comparaison NON BORNÉ (tous les autres joueurs du match), distinct de
// bet_subject=COMPARISON (toujours contre 1 entité nommée ou une somme de
// N joueurs nommés, DÉJÀ géré) ou d'un simple seuil fixe (bet_subject=
// PLAYER). AUCUN seuil/comparaison ici -- probabilité DIRECTE, même
// principe que dd/td (NO_THRESHOLD_STATS).
//
// stat restreinte à COMPARISON_PLAYER_STAT_CODES (stats COMPTÉES avec une
// moyenne numérique -- le service ne sait pas comparer des %/dd/td entre
// joueurs, cf. sa docstring) -- même restriction que le chantier duel.
const SuperlativeBetStructurationSchema = z.object({
  calculable: z
    .boolean()
    .describe(
      "true si ce texte affirme qu'UN joueur nommé dépasse TOUS les autres joueurs du match sur une même stat " +
        "(ensemble non borné, jamais un adversaire/groupe nommé ni un seuil fixe), avec tous les champs de " +
        "superlative_bet requis remplis. false sinon -- ne force jamais une extraction incertaine.",
    ),
  bet_subject: z
    .enum(["SUPERLATIVE"])
    .nullable()
    .describe("\"SUPERLATIVE\" si calculable=true, sinon null."),
  superlative_bet: z
    .object({
      player: z.string().describe("Nom du joueur visé, exactement comme écrit dans le texte."),
      stat: z
        .enum(COMPARISON_PLAYER_STAT_CODES as [string, ...string[]])
        .describe("Stat comparée contre tous les autres joueurs du match."),
    })
    .nullable()
    .describe("Rempli seulement si calculable=true, sinon null."),
  reasoning: z
    .string()
    .describe("Explication TRÈS COURTE (10-15 mots), pour trace/debug admin, pas pour le joueur."),
});

export type SuperlativeBetStructuration = z.infer<typeof SuperlativeBetStructurationSchema>;

function buildStaticSystemText(): string {
  const statList = COMPARISON_PLAYER_STAT_CODES.map((code) => `- "${code}" : ${STAT_LABELS_FR[code]}`).join("\n");
  return (
    "Tu structures des paris personnalisés NBA écrits en texte libre par des joueurs d'une ligue entre amis, " +
    "pour un calcul de probabilité automatique. On t'a déjà présélectionné ce texte comme RESSEMBLANT à un " +
    "\"superlatif implicite\" -- un joueur nommé dépasse TOUS les autres joueurs du match sur une stat, SANS " +
    "seuil fixe ni adversaire nommé -- ton rôle est de confirmer et structurer, ou de rejeter (calculable=false) " +
    "si ce n'est finalement pas le cas. TOUJOURS pour UN match précis.\n\n" +
    "Stats valides :\n" + statList + "\n\n" +
    "Exemples calculable=true : \"Jaylen Brown marque plus de points que tout autre joueur du match\" " +
    "(player=\"Jaylen Brown\", stat=pts), \"Nikola Jokic marque plus de points que n'importe quel autre joueur " +
    "du match\" (player=\"Nikola Jokic\", stat=pts), \"De'Aaron Fox marque plus de points que tout autre joueur " +
    "sur le terrain\" (player=\"De'Aaron Fox\", stat=pts), \"Wembanyama prend plus de rebonds que tout autre " +
    "joueur du match\" (player=\"Wembanyama\", stat=reb -- généralisable à toute stat comptée, pas seulement " +
    "les points).\n\n" +
    "Exemples calculable=false : \"Jayson Tatum marque plus de points que Joel Embiid\" (adversaire NOMMÉ, un " +
    "seul -- relève de bet_subject=COMPARISON, pas d'un superlatif) ; \"Shai Gilgeous-Alexander marque plus de " +
    "points que la somme de Booker et Brooks\" (groupe NOMMÉ, pas \"tout le monde\" -- relève de COMPARISON) ; " +
    "\"l'équipe qui gagne aura le meilleur marqueur\" (scénario conditionnel, pas une affirmation directe sur un " +
    "joueur précis)."
  );
}

function buildDynamicSystemText(teamNames: [string, string] | null): string {
  if (!teamNames) return "";
  return `\n\nCe pari concerne un match entre **team1 = ${teamNames[0]}** et **team2 = ${teamNames[1]}**.`;
}

/** Même contrat/patron que structureBet()/structureRosterCountBet() (modèle,
 *  cache de prompt). Appelée UNIQUEMENT quand SUPERLATIVE_KEYWORD_REGEX
 *  (structureAndScoreBet.ts) matche le texte du pari -- jamais en plus des
 *  autres structure*Bet(), toujours à la place. */
export async function structureSuperlativeBet(
  description: string,
  teamNames: [string, string] | null = null,
  model = "claude-sonnet-5",
): Promise<SuperlativeBetStructuration | null> {
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
      output_config: { format: zodOutputFormat(SuperlativeBetStructurationSchema) },
    });
    await recordAnthropicUsage("structureSuperlativeBet", model, response.usage);
    return response.parsed_output;
  } catch {
    return null;
  }
}
