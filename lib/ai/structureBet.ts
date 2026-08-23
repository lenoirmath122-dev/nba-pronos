import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { STAT_CODES, STAT_LABELS_FR, NO_THRESHOLD_STATS } from "./statCodes";
import { MATCH_STAT_CODES, MATCH_STAT_LABELS_FR } from "./matchStatCodes";
import { TEAM_STAT_CODES, TEAM_STAT_LABELS_FR } from "./teamStatCodes";
import { COMPARISON_PLAYER_STAT_CODES, COMPARISON_TEAM_STAT_CODES } from "./comparisonCodes";

// Union des 2 listes de codes valides dans un duel (joueur OU équipe,
// cf. comparisonCodes.ts) -- un seul champ Zod pour les 2 côtés, la
// cohérence kind/stat (joueur -> code joueur, équipe -> code équipe) est
// vérifiée à l'exécution (structureAndScoreBet.ts), pas dans le schéma :
// Zod ne sait pas exprimer "cet enum dépend de la valeur d'un autre champ".
const COMPARISON_STAT_CODES = [...new Set([...COMPARISON_PLAYER_STAT_CODES, ...COMPARISON_TEAM_STAT_CODES])];

// Structuration IA d'un pari perso en texte libre (SPEC_TECHNIQUE_PROBA_
// PARIS_PERSOS_V0_1.md §3, décidé le 21/08/2026 : Claude Opus 5, appel
// synchrone à la soumission du pari). Extrait joueur/stat/seuil/comparaison
// UNIQUEMENT pour les paris que le micro-service de proba sait calculer
// (§4 de la spec — ~1/3 des paris historiques n'entrent pas dans ce cadre,
// `calculable: false` fait retomber sur le mécanisme manuel existant,
// inchangé).

// Descriptions condensées le 22/08/2026 (optimisation coût, §35) -- même
// instruction qu'avant, moins de tokens : le schéma entier (pas seulement
// system+message) est renvoyé à chaque appel pour contraindre la sortie,
// ~2000 tokens mesurés sur l'ancienne version verbeuse. Revalidé sur les
// mêmes 5 cas réels (LeBron/MPJ hors match, Tatum, Curry, pari fun) sans
// aucun changement de résultat avant de commit.
const BetStructurationSchema = z.object({
  calculable: z
    .boolean()
    .describe(
      "true si (UN joueur + UNE stat joueur listée + seuil clair) OU (une équipe précise + UNE stat équipe " +
        "listée + seuil clair) OU (score/stat COMBINÉ du match + seuil clair) -- voir bet_subject. false pour " +
        "combo, fun/hors-terrain, ou formulation ambiguë -- ne force jamais une extraction incertaine.",
    ),
  bet_subject: z
    .enum(["PLAYER", "TEAM_STAT", "MATCH_TOTAL", "COMPARISON"])
    .nullable()
    .describe(
      "PLAYER si le pari porte sur UN joueur (remplis player_*). TEAM_STAT si le pari vise UNE équipe précise " +
        "(ex. \"Boston aura 45+ rebonds\" -- remplis team_stat_team/team_stat). MATCH_TOTAL si le pari porte sur " +
        "une stat COMBINÉE du match, sans viser une équipe (ex. \"90+ rebonds au total\" -- remplis match_stat). " +
        "COMPARISON si le pari COMPARE 2 côtés entre eux (joueur vs joueur, joueur vs somme de joueurs, équipe vs " +
        "équipe -- ex. \"Holmgren marque plus que Brooks\", \"SGA marque plus que Booker+Brooks cumulés\" -- " +
        "remplis comparison_*). null si non calculable.",
    ),
  player_not_in_match: z
    .boolean()
    .describe(
      "Uniquement pour bet_subject=PLAYER. true si le joueur (vrai joueur NBA) ne joue pour AUCUNE des 2 équipes " +
        "de ce match (utilise ta connaissance des effectifs réels). calculable reste true, remplis quand même les " +
        "autres champs -- l'appli forcera proba=0%. false sinon (y compris pour MATCH_TOTAL, sans objet).",
    ),
  player_name: z
    .string()
    .nullable()
    .describe(
      "Uniquement pour bet_subject=PLAYER. Orthographe standard NBA (ex: \"Michael Porter Jr.\" pas \"Junior\") -- " +
        "corrige les fautes évidentes. null pour MATCH_TOTAL, ou si non calculable.",
    ),
  player_team: z
    .enum(["team1", "team2"])
    .nullable()
    .describe(
      "Uniquement pour bet_subject=PLAYER. team1 ou team2 selon l'ordre du contexte de match/série ci-dessous -- " +
        "laquelle des 2 équipes le joueur représente. null si player_not_in_match=true, MATCH_TOTAL, ou non " +
        "calculable.",
    ),
  player_stat: z
    .enum(STAT_CODES as [string, ...string[]])
    .nullable()
    .describe("Uniquement pour bet_subject=PLAYER. Code de la stat JOUEUR concernée, null sinon."),
  match_stat: z
    .enum(MATCH_STAT_CODES as [string, ...string[]])
    .nullable()
    .describe(
      "Uniquement pour bet_subject=MATCH_TOTAL. Stat COMBINÉE des 2 équipes, POUR CE MATCH PRÉCIS (jamais une " +
        "somme sur plusieurs matchs d'une série -- marque calculable=false dans ce cas, voir note plus bas). " +
        "null sinon.",
    ),
  team_stat_team: z
    .enum(["team1", "team2"])
    .nullable()
    .describe(
      "Uniquement pour bet_subject=TEAM_STAT. team1 ou team2 selon l'ordre du contexte de match/série ci-dessous " +
        "-- laquelle des 2 équipes est visée par le pari. null sinon.",
    ),
  team_stat: z
    .enum(TEAM_STAT_CODES as [string, ...string[]])
    .nullable()
    .describe("Uniquement pour bet_subject=TEAM_STAT. Code de la stat ÉQUIPE concernée, null sinon."),
  // Champs COMPARISON compressés (limite API : max 16 champs nullable/union
  // par schéma de sortie structurée, dépassée à 19 lors d'un 1er essai réel
  // -- erreur "too many parameters with union types" -- réduit à 13 en
  // fusionnant kind+team (comparison_*_kind vaut directement "team1"/
  // "team2" plutôt qu'un champ TEAM séparé), en réutilisant `comparison`
  // pour la relation GT/DIFF_LT (au lieu d'un champ comparison_relation à
  // part) et `threshold` pour le multiplicateur GT, et en rendant les
  // tableaux de joueurs non-nullable (tableau vide plutôt que null).
  comparison_left_kind: z
    .enum(["PLAYER", "team1", "team2"])
    .nullable()
    .describe(
      "Uniquement pour bet_subject=COMPARISON. PLAYER si le côté GAUCHE est un joueur (ou une somme de joueurs, " +
        "remplis comparison_left_players) -- team1/team2 si c'est UNE équipe. null sinon.",
    ),
  comparison_left_players: z
    .array(z.string())
    .describe(
      "Uniquement si comparison_left_kind=PLAYER. 1 nom = joueur seul, 2+ noms = leur somme cumulée (ex. " +
        "\"Booker+Brooks\" -> 2 noms). Même convention d'orthographe que player_name. Tableau vide sinon.",
    ),
  comparison_left_stat: z
    .enum(COMPARISON_STAT_CODES as [string, ...string[]])
    .nullable()
    .describe(
      "Uniquement pour bet_subject=COMPARISON. Code de stat pour le côté GAUCHE (JOUEUR si " +
        "comparison_left_kind=PLAYER, ÉQUIPE si team1/team2 -- voir les 2 listes plus bas). null sinon.",
    ),
  comparison_right_kind: z
    .enum(["PLAYER", "team1", "team2"])
    .nullable()
    .describe("Uniquement pour bet_subject=COMPARISON. Même règle que comparison_left_kind, pour le côté DROIT."),
  comparison_right_players: z
    .array(z.string())
    .describe("Uniquement si comparison_right_kind=PLAYER. Même convention que comparison_left_players. Tableau vide sinon."),
  comparison_right_stat: z
    .enum(COMPARISON_STAT_CODES as [string, ...string[]])
    .nullable()
    .describe("Uniquement pour bet_subject=COMPARISON. Code de stat pour le côté DROIT, même règle que gauche. null sinon."),
  threshold: z
    .number()
    .nullable()
    .describe(
      "Seuil numérique. null pour dd/td (proba directe). Pour ft/fg/fg3, une FRACTION 0-1 (0.85 pour \"85%\"), " +
        "jamais 85. Pour total_points, un nombre de points brut (ex: 220). Pour comparison=\"DIFF_LT\", la borne " +
        "de l'écart (ex: 20 pour \"différence inférieure à 20\"). Pour comparison=\"GT\", le facteur " +
        "multiplicatif SEULEMENT si un facteur est mentionné (ex: 2 pour \"au moins deux fois plus\"), sinon null " +
        "(comparaison simple \"plus que\", facteur 1 implicite).",
    ),
  comparison: z
    .enum(["OVER", "UNDER", "GT", "DIFF_LT"])
    .nullable()
    .describe(
      "Pour bet_subject PLAYER/TEAM_STAT/MATCH_TOTAL : OVER (\"plus de\"/\"au moins\") ou UNDER (\"moins de\"). " +
        "Pour bet_subject=COMPARISON : GT si le pari dit \"plus que\"/\"au moins X fois plus\" (remplis threshold " +
        "avec le facteur X si mentionné). DIFF_LT si le pari porte sur un ÉCART borné (\"la différence est " +
        "inférieure à X\", remplis threshold avec X). null pour dd/td, ou pour les paris d'ÉGALITÉ EXACTE type " +
        "\"le même nombre de minutes\" (pas encore gérés -- calculable=false), ou non calculable.",
    ),
  reasoning: z
    .string()
    .describe("Explication TRÈS COURTE (10-15 mots), pour trace/debug admin, pas pour le joueur."),
});

export type BetStructuration = z.infer<typeof BetStructurationSchema>;

function buildSystemPrompt(teamNames: [string, string] | null): string {
  const statList = STAT_CODES.map((code) => `- "${code}" : ${STAT_LABELS_FR[code]}${NO_THRESHOLD_STATS.has(code) ? " (pas de seuil, probabilité directe)" : ""}`).join("\n");
  const matchContext = teamNames
    ? `\n\nCe pari concerne un match/une série entre **team1 = ${teamNames[0]}** et **team2 = ${teamNames[1]}**. ` +
      "Vérifie que le joueur nommé joue actuellement pour l'une de ces 2 équipes (utilise ta connaissance des " +
      "effectifs NBA réels) -- si ce n'est pas le cas (joueur d'une autre équipe, joueur retraité, nom inventé...), " +
      "marque player_not_in_match=true (calculable reste true, voir la description du champ) plutôt que " +
      "calculable=false. Sinon, remplis player_team (team1 ou team2) selon l'équipe réelle du joueur. Corrige aussi " +
      "l'orthographe du nom vers la convention standard NBA (ex: \"Junior\" -> \"Jr.\") plutôt que de reprendre le " +
      "texte exact du joueur, qui peut contenir des fautes de frappe."
    : "";
  const matchStatList = MATCH_STAT_CODES.map((code) => `- "${code}" : ${MATCH_STAT_LABELS_FR[code]}`).join("\n");
  const teamStatList = TEAM_STAT_CODES.map((code) => `- "${code}" : ${TEAM_STAT_LABELS_FR[code]}`).join("\n");
  const comparisonPlayerStatList = COMPARISON_PLAYER_STAT_CODES.map((code) => `"${code}"`).join(", ");
  const comparisonTeamStatList = COMPARISON_TEAM_STAT_CODES.map((code) => `"${code}"`).join(", ");
  return (
    "Tu structures des paris personnalisés NBA écrits en texte libre par des joueurs d'une ligue entre amis, " +
    "pour un calcul de probabilité automatique. Le service de calcul sait gérer 4 types de paris, chacun avec un " +
    "seul seuil par pari, TOUJOURS pour UN match précis (jamais une somme sur plusieurs matchs d'une série -- si " +
    "le pari cumule explicitement sur \"la série\"/\"les matchs\", marque calculable=false, ce cas n'est pas " +
    "encore géré) :\n\n" +
    "1. bet_subject=PLAYER -- UN seul joueur + UNE des 12 stats suivantes :\n" +
    statList +
    "\n\n2. bet_subject=TEAM_STAT -- UNE équipe précise (ex. \"Boston aura 45+ rebonds\") + UNE des stats " +
    "suivantes :\n" +
    teamStatList +
    "\n\n3. bet_subject=MATCH_TOTAL -- une stat COMBINÉE des 2 équipes, SANS viser une équipe en particulier " +
    "(ex. \"90+ rebonds au total\") :\n" +
    matchStatList +
    "\n\n4. bet_subject=COMPARISON -- COMPARE 2 côtés entre eux (jamais contre un seuil fixe). Chaque côté est " +
    "soit UN joueur (comparison_*_kind=PLAYER, comparison_*_players=[1 nom]), soit une SOMME de plusieurs joueurs " +
    "(comparison_*_kind=PLAYER, comparison_*_players=[2+ noms], même stat pour tous), soit UNE équipe " +
    "(comparison_*_kind=team1 ou team2 directement, comparison_*_players=[]). Stats valides côté joueur : " +
    comparisonPlayerStatList + ". Stats valides côté équipe : " + comparisonTeamStatList + ". " +
    "comparison=\"GT\" pour \"plus que\"/\"au moins X fois plus\" (threshold=X si un facteur est mentionné, " +
    "sinon null). comparison=\"DIFF_LT\" pour un écart borné (\"différence inférieure à X\" -- threshold=X). " +
    "Exemples : \"Holmgren marque plus de points que Brooks\" (2 joueurs, GT, threshold=null), \"SGA marque " +
    "plus que Booker+Brooks cumulés\" (joueur vs somme de 2, GT), \"Boston prend plus de rebonds que " +
    "Philadelphie\" (2 équipes, GT), \"écart de points entre LeBron et Bronny inférieur à 20\" (2 joueurs, " +
    "DIFF_LT, threshold=20), \"les Spurs ont au moins 2 fois plus d'interceptions que les Knicks\" (2 équipes, " +
    "GT, threshold=2). Une ÉGALITÉ EXACTE (\"le même nombre de minutes\") n'est PAS gérée -- calculable=false.\n\n" +
    "Tout le reste (combo de plusieurs conditions sur un même pari, contre/action visant un joueur adverse " +
    "précis, événement de match, paris fun/hors-terrain comme \"l'entraîneur criera au moins 3 fois\", " +
    "scénarios complexes, formulation trop vague, ou total cumulé sur une série) doit être marqué " +
    "calculable=false — ne force jamais une extraction incertaine." +
    matchContext
  );
}

/** teamNames : les 2 équipes du match/de la série concernée par ce pari
 *  (bet réel corrigé le 21/08/2026 -- sans ce contexte, l'IA validait des
 *  paris sur des joueurs qui ne jouent même pas dans le match visé). Passé
 *  par structureAndScoreBet.ts, résolu depuis series/matches/teams.
 *
 *  model : Claude Sonnet 5 par défaut (changé depuis Opus 5 le 22/08/2026,
 *  optimisation coût) -- comparé sur 5 vrais appels API face à Opus 5,
 *  RÉSULTATS STRUCTURÉS IDENTIQUES sur les 2 cas les plus à risque de cette
 *  session (joueur hors match, faute d'orthographe/suffixe), pour ~2.6x
 *  moins cher par appel (Cadrage/Stats/projet-data-nba.md §35). */
export async function structureBet(
  description: string,
  teamNames: [string, string] | null = null,
  model = "claude-sonnet-5",
): Promise<BetStructuration | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Pas de clé configurée : traité comme un échec silencieux, pas une
    // erreur qui casserait la soumission du pari — même repli que toute
    // autre panne de cette étape (voir structureAndScoreBet.ts).
    return null;
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.parse({
      model,
      max_tokens: 1024,
      system: buildSystemPrompt(teamNames),
      messages: [{ role: "user", content: `Pari à structurer : "${description}"` }],
      output_config: { format: zodOutputFormat(BetStructurationSchema) },
    });
    return response.parsed_output;
  } catch {
    // Panne réseau/API/parsing : traité comme "non calculable cette fois",
    // jamais remonté à l'appelant comme une erreur bloquante.
    return null;
  }
}
