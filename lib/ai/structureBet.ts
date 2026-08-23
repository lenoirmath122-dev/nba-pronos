import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { STAT_CODES, STAT_LABELS_FR, NO_THRESHOLD_STATS } from "./statCodes";
import { MATCH_STAT_CODES, MATCH_STAT_LABELS_FR } from "./matchStatCodes";

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
      "true si (UN joueur + UNE stat joueur listée + seuil clair) OU (score combiné du match + seuil clair) -- " +
        "voir bet_subject. false pour pari équipe (hors score combiné), combo, fun/hors-terrain, ou formulation " +
        "ambiguë -- ne force jamais une extraction incertaine.",
    ),
  bet_subject: z
    .enum(["PLAYER", "MATCH_TOTAL"])
    .nullable()
    .describe(
      "PLAYER si le pari porte sur UN joueur (remplis player_*), MATCH_TOTAL si le pari porte sur le score " +
        "COMBINÉ du match (remplis match_stat, jamais de joueur). null si non calculable.",
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
      "Uniquement pour bet_subject=MATCH_TOTAL. \"total_points\" = les 2 équipes additionnées, POUR CE MATCH " +
        "PRÉCIS (jamais une somme sur plusieurs matchs d'une série -- marque calculable=false dans ce cas, voir " +
        "note plus bas). null sinon.",
    ),
  threshold: z
    .number()
    .nullable()
    .describe(
      "Seuil numérique. null pour dd/td (proba directe). Pour ft/fg/fg3, une FRACTION 0-1 (0.85 pour \"85%\"), " +
        "jamais 85. Pour total_points, un nombre de points brut (ex: 220).",
    ),
  comparison: z
    .enum(["OVER", "UNDER"])
    .nullable()
    .describe("OVER (\"plus de\"/\"au moins\") ou UNDER (\"moins de\"), null pour dd/td ou non calculable."),
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
  return (
    "Tu structures des paris personnalisés NBA écrits en texte libre par des joueurs d'une ligue entre amis, " +
    "pour un calcul de probabilité automatique. Le service de calcul sait gérer 2 types de paris, chacun avec un " +
    "seul seuil par pari :\n\n" +
    "1. bet_subject=PLAYER -- UN seul joueur + UNE des 12 stats suivantes :\n" +
    statList +
    "\n\n2. bet_subject=MATCH_TOTAL -- le score COMBINÉ d'UN match précis (jamais une somme sur plusieurs matchs " +
    "d'une série -- si le pari cumule explicitement sur \"la série\"/\"les matchs\", marque calculable=false, ce " +
    "cas n'est pas encore géré) :\n" +
    matchStatList +
    "\n\nTout le reste (paris équipe autre que le score combiné, combo plusieurs joueurs, événement de match, " +
    "paris fun/hors-terrain comme \"l'entraîneur criera au moins 3 fois\", scénarios complexes, formulation trop " +
    "vague, ou total cumulé sur une série) doit être marqué calculable=false — ne force jamais une extraction " +
    "incertaine." +
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
