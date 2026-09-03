import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { STAT_CODES } from "./statCodes";
import { TEAM_STAT_CODES } from "./teamStatCodes";

// Chantier "OU imbriqué dans un ET" (étape 7 du plan de reprise post-audit,
// 25/08/2026, GAPS_OUVERTS.md) -- schéma SÉPARÉ de structureBet.ts, même
// patron que structurePeriodBet.ts/structureSuperlativeBet.ts/etc (schéma
// partagé déjà au plafond de complexité accepté par l'API Claude -- VÉRIFIÉ
// à nouveau en essayant d'ajouter directement `or` dans combo_bet du
// schéma partagé : "compiled grammar is too large", reproduit sur TOUS les
// paris, même échec exact que la leçon PERIOD du 24/08/2026).
//
// bet_subject=COMBO (schéma partagé) reste INCHANGÉ -- gère toujours le ET
// simple de N conditions, cas de LOIN le plus fréquent. Ce schéma dédié
// prend le relais UNIQUEMENT pour le cas "ET avec un OU imbriqué" (1 seul
// exemple réel trouvé dans le corpus, types_de_paris_playoffs_2026.md :
// "Nikola Jokic réalise un triple-double avec au moins 40 points et au
// moins 20 rebonds ou passes.") -- routé en amont par mot-clé (texte
// contenant À LA FOIS "et" et "ou", signature du corpus réel), jamais un
// repli automatique depuis calculable=false du schéma partagé (même
// raisonnement que PERIOD : ne pas recoupler ce coût à toute la
// population des paris non calculables pour d'autres raisons).
//
// Structure : conditions = liste de GROUPES reliés par un ET (comme
// avant), chaque groupe est une liste de 1+ conditions reliées par un OU
// (1 seule = condition normale, comportement identique à bet_subject=
// COMBO ; 2+ = au moins une doit être vraie). Mêmes règles de validité
// pour chaque condition individuelle que le schéma partagé (stats
// comptées uniquement pour une condition "somme").
const COMBO_STAT_CODES = [...new Set([...STAT_CODES, ...TEAM_STAT_CODES])];

const ComboNestedConditionSchema = z.object({
  kind: z.enum(["PLAYER", "team1", "team2"]).describe("PLAYER pour un/des joueur(s), team1/team2 pour une équipe."),
  players: z.array(z.string()).describe("Uniquement si kind=PLAYER : 1 nom, ou 2+ noms si leurs stats se cumulent. Tableau vide sinon."),
  stats: z
    .array(z.enum(COMBO_STAT_CODES as [string, ...string[]]))
    .describe(
      "1 code = condition normale. 2+ codes = SOMME de plusieurs stats pour LE MÊME joueur (style PRA, ex. " +
        "\"25pts+12reb+8pas cumulés\" -> [\"pts\",\"reb\",\"ast\"]). Si players a 2+ noms, stats doit rester à 1 " +
        "seul code (cumul entre joueurs, pas de croisement joueurs×stats).",
    ),
  threshold: z.number().nullable().describe("null uniquement si stats=[\"dd\"] ou [\"td\"] (probabilité directe)."),
  comparison: z.enum(["OVER", "UNDER"]),
});

const ComboNestedBetStructurationSchema = z.object({
  calculable: z
    .boolean()
    .describe(
      "true si ce texte est un ET de plusieurs groupes dont AU MOINS UN contient un OU explicite (2+ conditions " +
        "alternatives), avec conditions rempli. false sinon (repli sur le schéma combo simple/autre) -- ne force " +
        "jamais une extraction incertaine.",
    ),
  bet_subject: z
    .enum(["COMBO"])
    .nullable()
    .describe("\"COMBO\" si calculable=true, sinon null."),
  conditions: z
    .array(z.object({ or: z.array(ComboNestedConditionSchema) }))
    .describe(
      "2 groupes ou plus, reliés par un ET implicite (TOUS les groupes doivent être vrais). Chaque groupe est " +
        "normalement 1 SEULE condition -- 2+ conditions dans le MÊME groupe (`or`) UNIQUEMENT pour un OU explicite " +
        "(AU MOINS UNE des conditions du groupe doit être vraie). Rempli seulement si calculable=true, sinon " +
        "tableau vide.",
    ),
  reasoning: z
    .string()
    .describe("Explication TRÈS COURTE (10-15 mots), pour trace/debug admin, pas pour le joueur."),
});

export type ComboNestedBetStructuration = z.infer<typeof ComboNestedBetStructurationSchema>;

function buildStaticSystemText(): string {
  return (
    "Tu structures des paris personnalisés NBA écrits en texte libre par des joueurs d'une ligue entre amis, " +
    "pour un calcul de probabilité automatique. On t'a déjà présélectionné ce texte comme RESSEMBLANT à un pari " +
    "combo (ET de plusieurs conditions) contenant un OU EXPLICITE IMBRIQUÉ dans l'une des conditions -- ton rôle " +
    "est de confirmer et structurer en groupes, ou de rejeter (calculable=false) si ce n'est finalement pas le " +
    "cas. TOUJOURS pour UN match précis.\n\n" +
    "Exemple calculable=true (cas réel) : \"Nikola Jokic réalise un triple-double avec au moins 40 points et au " +
    "moins 20 rebonds ou passes.\" -> 3 groupes : [triple-double (dd/td selon le nombre de catégories visées -- " +
    "ici \"triple-double\" -> td)], [pts>=40], [reb>=20 OU ast>=20] (ce dernier groupe a 2 conditions reliées par " +
    "OU, les 2 autres groupes n'en ont qu'une seule).\n\n" +
    "Exemples calculable=false : \"Cunningham marque plus de 25 points et réalise plus de 5 passes\" (ET simple, " +
    "AUCUN OU imbriqué -- relève du schéma combo simple, pas celui-ci) ; \"Hauser ou Pritchard marque au moins 3 " +
    "paniers à 3 points\" (OU seul, entre 2 JOUEURS différents pour la MÊME condition -- relève de " +
    "bet_subject=COMPARISON, pas d'un groupe combo)."
  );
}

function buildDynamicSystemText(teamNames: [string, string] | null): string {
  if (!teamNames) return "";
  return `\n\nCe pari concerne un match entre **team1 = ${teamNames[0]}** et **team2 = ${teamNames[1]}**.`;
}

/** Même contrat/patron que structureSuperlativeBet() (modèle, cache de
 *  prompt). Appelée UNIQUEMENT quand COMBO_NESTED_OR_KEYWORD_REGEX
 *  (structureAndScoreBet.ts) matche le texte du pari -- jamais en plus du
 *  schéma combo simple (structureBet.ts), toujours à la place. */
export async function structureComboNestedBet(
  description: string,
  teamNames: [string, string] | null = null,
  model = "claude-sonnet-5",
): Promise<ComboNestedBetStructuration | null> {
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
      output_config: { format: zodOutputFormat(ComboNestedBetStructurationSchema) },
    });
    return response.parsed_output;
  } catch {
    return null;
  }
}
