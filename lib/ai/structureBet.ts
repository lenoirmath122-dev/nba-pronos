import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { STAT_CODES, STAT_LABELS_FR, NO_THRESHOLD_STATS } from "./statCodes";

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
      "true si UN seul joueur + UNE stat listée + seuil clair (même si le joueur ne joue pas dans ce match, " +
        "voir player_not_in_match). false pour pari équipe, combo, score total, fun/hors-terrain, ou formulation " +
        "ambiguë -- ne force jamais une extraction incertaine.",
    ),
  player_not_in_match: z
    .boolean()
    .describe(
      "true si le joueur (vrai joueur NBA) ne joue pour AUCUNE des 2 équipes de ce match (utilise ta connaissance " +
        "des effectifs réels). calculable reste true, remplis quand même les autres champs -- l'appli forcera " +
        "proba=0%. false sinon.",
    ),
  player_name: z
    .string()
    .nullable()
    .describe(
      "Orthographe standard NBA (ex: \"Michael Porter Jr.\" pas \"Junior\") -- corrige les fautes évidentes, " +
        "null si non calculable.",
    ),
  stat: z.enum(STAT_CODES as [string, ...string[]]).nullable().describe("Code de la stat concernée, null si non calculable."),
  threshold: z
    .number()
    .nullable()
    .describe(
      "Seuil numérique. null pour dd/td (proba directe). Pour ft/fg/fg3, une FRACTION 0-1 (0.85 pour \"85%\"), " +
        "jamais 85.",
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
    ? `\n\nCe pari concerne un match entre **${teamNames[0]}** et **${teamNames[1]}**. Vérifie que le joueur nommé ` +
      "joue actuellement pour l'une de ces 2 équipes (utilise ta connaissance des effectifs NBA réels) -- si ce " +
      "n'est pas le cas (joueur d'une autre équipe, joueur retraité, nom inventé...), marque player_not_in_match=true " +
      "(calculable reste true, voir la description du champ) plutôt que calculable=false. Corrige aussi " +
      "l'orthographe du nom vers la convention standard NBA (ex: \"Junior\" -> \"Jr.\") plutôt que de reprendre le " +
      "texte exact du joueur, qui peut contenir des fautes de frappe."
    : "";
  return (
    "Tu structures des paris personnalisés NBA écrits en texte libre par des joueurs d'une ligue entre amis, " +
    "pour un calcul de probabilité automatique. Le service de calcul ne sait gérer QUE les 12 stats suivantes, " +
    "un seul joueur, un seul seuil par pari :\n\n" +
    statList +
    "\n\nTout le reste (paris équipe, score du match, combo plusieurs joueurs, événement de match, paris fun/" +
    "hors-terrain comme \"l'entraîneur criera au moins 3 fois\", scénarios complexes, ou une formulation trop " +
    "vague pour être sûr) doit être marqué calculable=false — ne force jamais une extraction incertaine." +
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
