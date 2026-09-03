import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

// Chantier "événements de match" (étape 5 du plan de reprise post-audit,
// 25/08/2026, GAPS_OUVERTS.md) -- schéma SÉPARÉ de structureBet.ts, même
// patron que structurePeriodBet.ts/structureRosterCountBet.ts/etc.
//
// Fautes techniques EQUIPE/MATCH avec un COMPTAGE EXACT ("Orlando reçoit
// exactement 2 fautes techniques dans le match", "il y aura exactement 2
// fautes techniques dans le match") -- DISTINCT du cas JOUEUR ("Jokic
// reçoit au moins une faute technique"), qui reste géré par le schéma
// PARTAGÉ structureBet.ts/bet_subject=PLAYER (stat="tech", probabilité
// directe, aucun comptage -- cf. statCodes.ts). Ce schéma-ci ne sert QUE
// pour un comptage EQUIPE/MATCH (plusieurs fautes possibles, seuil
// numérique explicite), jamais pour un joueur nommé.
const TechnicalFoulsCountBetStructurationSchema = z.object({
  calculable: z
    .boolean()
    .describe(
      "true si ce texte porte sur un NOMBRE de fautes techniques pour UNE équipe ou pour LE MATCH entier (les 2 " +
        "équipes combinées) -- jamais pour un joueur nommé (ça relève d'un pari joueur classique, stat=tech). " +
        "false sinon -- ne force jamais une extraction incertaine.",
    ),
  bet_subject: z
    .enum(["TECHNICAL_FOULS_COUNT"])
    .nullable()
    .describe("\"TECHNICAL_FOULS_COUNT\" si calculable=true, sinon null."),
  technical_fouls_count_bet: z
    .object({
      scope: z
        .enum(["MATCH", "team1", "team2"])
        .describe("MATCH : les 2 équipes combinées. team1/team2 : UNE équipe précise nommée."),
      count_threshold: z.number().int().describe("N, le nombre de fautes techniques visé -- valeur LITTÉRALE du texte."),
      count_relation: z
        .enum(["AT_LEAST", "MORE_THAN", "FEWER_THAN", "EXACTLY"])
        .describe(
          "EXACTLY : \"exactement N\" (le cas le plus courant pour ce type de pari). AT_LEAST : \"au moins N\"/\"N " +
            "ou plus\". MORE_THAN : \"plus de N\" (strict). FEWER_THAN : \"moins de N\" (strict).",
        ),
    })
    .nullable()
    .describe("Rempli seulement si calculable=true, sinon null."),
  reasoning: z
    .string()
    .describe("Explication TRÈS COURTE (10-15 mots), pour trace/debug admin, pas pour le joueur."),
});

export type TechnicalFoulsCountBetStructuration = z.infer<typeof TechnicalFoulsCountBetStructurationSchema>;

function buildStaticSystemText(): string {
  return (
    "Tu structures des paris personnalisés NBA écrits en texte libre par des joueurs d'une ligue entre amis, " +
    "pour un calcul de probabilité automatique. On t'a déjà présélectionné ce texte comme RESSEMBLANT à un pari " +
    "sur un NOMBRE de fautes techniques (équipe ou match entier, PAS un joueur nommé) -- ton rôle est de " +
    "confirmer et structurer, ou de rejeter (calculable=false) si ce n'est finalement pas le cas. TOUJOURS pour " +
    "UN match précis.\n\n" +
    "Exemples calculable=true : \"Orlando Magic reçoit exactement 2 fautes techniques dans le match\" " +
    "(scope=team1 ou team2 selon l'équipe visée, count_threshold=2, count_relation=EXACTLY), \"Il y aura " +
    "exactement 2 fautes techniques dans le match\" (scope=MATCH, count_threshold=2, count_relation=EXACTLY).\n\n" +
    "Exemples calculable=false : \"Nikola Jokic reçoit au moins une faute technique pendant le match\" (un JOUEUR " +
    "précis est nommé -- relève d'un pari joueur classique, stat=tech, pas de ce mécanisme de comptage " +
    "équipe/match) ; tout texte qui ne porte pas sur un nombre précis de fautes techniques."
  );
}

function buildDynamicSystemText(teamNames: [string, string] | null): string {
  if (!teamNames) return "";
  return `\n\nCe pari concerne un match entre **team1 = ${teamNames[0]}** et **team2 = ${teamNames[1]}**.`;
}

/** Même contrat/patron que structureBet()/structureRosterCountBet() (modèle,
 *  cache de prompt). Appelée UNIQUEMENT quand TECHNICAL_FOULS_COUNT_KEYWORD_REGEX
 *  (structureAndScoreBet.ts) matche le texte du pari -- jamais en plus des
 *  autres structure*Bet(), toujours à la place. */
export async function structureTechnicalFoulsCountBet(
  description: string,
  teamNames: [string, string] | null = null,
  model = "claude-sonnet-5",
): Promise<TechnicalFoulsCountBetStructuration | null> {
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
      output_config: { format: zodOutputFormat(TechnicalFoulsCountBetStructurationSchema) },
    });
    return response.parsed_output;
  } catch {
    return null;
  }
}
