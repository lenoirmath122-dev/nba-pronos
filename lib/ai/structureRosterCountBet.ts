import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { STAT_CODES, STAT_LABELS_FR } from "./statCodes";
import { recordAnthropicUsage } from "./usageTracking";

// Chantier "comptage roster-wide" (étape 3 du plan de reprise post-audit,
// 25/08/2026, GAPS_OUVERTS.md) -- schéma SÉPARÉ de structureBet.ts, même
// patron que structurePeriodBet.ts/structureRosterSplitBet.ts (voir leur
// docstring pour le POURQUOI : le schéma partagé est au plafond de
// complexité accepté par l'API Claude).
//
// Débloque "au moins N joueurs remplissent une condition individuelle" --
// explicitement exclu de structureBet.ts/COMBO depuis leur conception (cf.
// leur docstring : "au moins N joueurs remplissent X" -> calculable=false).
// Exemples réels couverts (types_de_paris_playoffs_2026.md) : triple-double
// n'importe qui, "8 joueurs marquent 11+ points", DNP ("2 joueurs ne jouent
// aucune minute"), "les 10 titulaires marquent chacun 8+".
//
// PAS géré en v1 (reste calculable=false, différé -- GAPS_OUVERTS.md) : la
// comparaison de 2 COMPTAGES entre équipes ("les Knicks utilisent 3 joueurs
// de plus que les 76ers") -- ce n'est pas "au moins N contre un seuil fixe"
// mais 2 distributions de Poisson-binomiale comparées entre elles, mécanisme
// différent, pas encore construit. Idem pour une égalité exacte entre 2
// comptages.
const RosterCountBetStructurationSchema = z.object({
  calculable: z
    .boolean()
    .describe(
      "true si ce texte porte sur \"au moins/plus de/moins de N joueurs\" qui remplissent CHACUN une même " +
        "condition individuelle (jamais nommés un par un), avec tous les champs de roster_count_bet requis " +
        "remplis. false sinon -- ne force jamais une extraction incertaine.",
    ),
  bet_subject: z
    .enum(["ROSTER_COUNT"])
    .nullable()
    .describe("\"ROSTER_COUNT\" si calculable=true, sinon null."),
  roster_count_bet: z
    .object({
      scope: z
        .enum(["MATCH", "team1", "team2"])
        .describe(
          "MATCH : les 2 équipes combinées (\"un joueur du match\", \"8 joueurs\", sans viser une équipe précise " +
            "-- de LOIN le cas le plus fréquent). team1/team2 : UNE seule équipe visée explicitement (rare).",
        ),
      pool: z
        .enum(["ALL", "STARTERS"])
        .describe(
          "ALL : tous les joueurs qui jouent habituellement (\"8 joueurs\", \"un joueur\", \"28 joueurs\", DNP -- " +
            "le cas par défaut). STARTERS : UNIQUEMENT les titulaires/5 majeur de la ou des équipe(s) visée(s) " +
            "(ex. \"les 10 joueurs titulaires marquent chacun...\").",
        ),
      stat: z
        .enum(STAT_CODES as [string, ...string[]])
        .describe("Stat CONDITION vérifiée sur CHAQUE joueur du bassin individuellement."),
      stat_threshold: z.number().nullable().describe("Seuil de la condition par joueur. null uniquement pour dd/td."),
      stat_comparison: z
        .enum(["OVER", "UNDER"])
        .nullable()
        .describe(
          "Comparaison de la condition par joueur (ex. \"marque 11+ points\" -> OVER, threshold=11 ; \"ne joue " +
            "aucune minute\"/DNP -> UNDER, threshold=1). null uniquement pour dd/td.",
        ),
      min_players: z
        .number()
        .int()
        .describe(
          "N, le nombre de joueurs visé -- valeur LITTÉRALE du texte, ne JAMAIS l'ajuster de +/-1 (c'est " +
            "count_relation qui encode \"au moins\"/\"plus de\"/\"moins de\", pas ce champ).",
        ),
      count_relation: z
        .enum(["AT_LEAST", "MORE_THAN", "FEWER_THAN"])
        .describe(
          "AT_LEAST : \"au moins N\"/\"N ou plus\" (INCLUT N). MORE_THAN : \"plus de N\"/\"strictement plus de N\" " +
            "(EXCLUT N). FEWER_THAN : \"moins de N\"/\"strictement moins de N\" (EXCLUT N). Distinction importante " +
            "ici (contrairement au reste de l'appli) : ce comptage est une distribution EXACTE, pas une " +
            "approximation continue -- l'écart entre \"au moins 8\" et \"plus de 8\" change vraiment le résultat.",
        ),
    })
    .nullable()
    .describe("Rempli seulement si calculable=true, sinon null."),
  reasoning: z
    .string()
    .describe("Explication TRÈS COURTE (10-15 mots), pour trace/debug admin, pas pour le joueur."),
});

export type RosterCountBetStructuration = z.infer<typeof RosterCountBetStructurationSchema>;

function buildStaticSystemText(): string {
  const statList = STAT_CODES.map((code) => `- "${code}" : ${STAT_LABELS_FR[code]}`).join("\n");
  return (
    "Tu structures des paris personnalisés NBA écrits en texte libre par des joueurs d'une ligue entre amis, " +
    "pour un calcul de probabilité automatique. On t'a déjà présélectionné ce texte comme RESSEMBLANT à un pari " +
    "\"au moins N joueurs remplissent une condition\" (comptage sur tout le roster, joueurs JAMAIS nommés " +
    "individuellement) -- ton rôle est de confirmer et structurer, ou de rejeter (calculable=false) si ce n'est " +
    "finalement pas le cas. TOUJOURS pour UN match précis.\n\n" +
    "Stats valides pour la condition par joueur :\n" + statList + "\n\n" +
    "Exemples calculable=true : \"Au moins un joueur réalise un triple-double durant le match\" " +
    "(scope=MATCH, pool=ALL, stat=td, stat_threshold=null, stat_comparison=null, min_players=1, " +
    "count_relation=AT_LEAST), \"Au moins 8 joueurs marquent 11 points ou plus dans le match\" (scope=MATCH, " +
    "pool=ALL, stat=pts, stat_threshold=11, stat_comparison=OVER, min_players=8, count_relation=AT_LEAST), " +
    "\"Au moins 5 joueurs terminent le match avec un +/- supérieur ou égal à 20\" (scope=MATCH, pool=ALL, " +
    "stat=plus_minus, stat_threshold=20, stat_comparison=OVER, min_players=5, count_relation=AT_LEAST), " +
    "\"Les 10 joueurs titulaires marquent chacun plus de 8 points\" (scope=MATCH, pool=STARTERS, stat=pts, " +
    "stat_threshold=8, stat_comparison=OVER, min_players=10, count_relation=AT_LEAST -- 10 = 5 titulaires des " +
    "2 équipes), \"Plus de 28 joueurs ont joué au moins 1 minute dans le match\" (scope=MATCH, pool=ALL, " +
    "stat=min, stat_threshold=1, stat_comparison=OVER, min_players=28, count_relation=MORE_THAN), \"Au moins " +
    "deux joueurs du match ne joueront aucune minute (DNP)\" (scope=MATCH, pool=ALL, stat=min, " +
    "stat_threshold=1, stat_comparison=UNDER, min_players=2, count_relation=AT_LEAST).\n\n" +
    "Exemples calculable=false : \"Les Knicks utilisent au moins 3 joueurs de plus que les 76ers\" (compare 2 " +
    "COMPTAGES entre équipes, pas un comptage contre un seuil fixe -- non géré) ; \"le même nombre de joueurs " +
    "des 2 équipes dépassent 15 points\" (égalité exacte entre 2 comptages -- non géré) ; tout pari qui nomme " +
    "les joueurs individuellement (relève d'un pari joueur/combo classique, pas d'un comptage roster-wide)."
  );
}

function buildDynamicSystemText(teamNames: [string, string] | null): string {
  if (!teamNames) return "";
  return `\n\nCe pari concerne un match entre **team1 = ${teamNames[0]}** et **team2 = ${teamNames[1]}**.`;
}

/** Même contrat/patron que structureBet()/structureRosterSplitBet() (modèle,
 *  cache de prompt). Appelée UNIQUEMENT quand ROSTER_COUNT_KEYWORD_REGEX
 *  (structureAndScoreBet.ts) matche le texte du pari -- jamais en plus des
 *  autres structure*Bet(), toujours à la place. */
export async function structureRosterCountBet(
  description: string,
  teamNames: [string, string] | null = null,
  model = "claude-sonnet-5",
): Promise<RosterCountBetStructuration | null> {
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
      output_config: { format: zodOutputFormat(RosterCountBetStructurationSchema) },
    });
    await recordAnthropicUsage("structureRosterCountBet", model, response.usage);
    return response.parsed_output;
  } catch {
    return null;
  }
}
