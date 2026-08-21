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

const BetStructurationSchema = z.object({
  calculable: z
    .boolean()
    .describe(
      "true UNIQUEMENT si le pari porte sur UN SEUL joueur, UNE SEULE des stats listées, avec un seuil " +
        "numérique clair (\"plus de\"/\"moins de\" un nombre). false pour tout pari équipe, combo multi-joueurs, " +
        "score total, événement de match, fun/hors-terrain, scénario, ou formulation trop ambiguë pour être sûr.",
    ),
  player_name: z.string().nullable().describe("Nom du joueur tel qu'écrit dans le pari, null si non calculable."),
  stat: z.enum(STAT_CODES as [string, ...string[]]).nullable().describe("Code de la stat concernée, null si non calculable."),
  threshold: z
    .number()
    .nullable()
    .describe(
      "Seuil numérique. Pour dd/td (double-double/triple-double) toujours null (probabilité directe, pas de seuil). " +
        "Pour ft/fg/fg3 (pourcentages), une FRACTION entre 0 et 1 (ex. 0.85 pour \"85%\"), jamais 85.",
    ),
  comparison: z
    .enum(["OVER", "UNDER"])
    .nullable()
    .describe("OVER (\"plus de\"/\"au moins\") ou UNDER (\"moins de\"), null pour dd/td ou non calculable."),
  reasoning: z.string().describe("Une phrase expliquant la décision, pour trace/debug côté admin."),
});

export type BetStructuration = z.infer<typeof BetStructurationSchema>;

function buildSystemPrompt(): string {
  const statList = STAT_CODES.map((code) => `- "${code}" : ${STAT_LABELS_FR[code]}${NO_THRESHOLD_STATS.has(code) ? " (pas de seuil, probabilité directe)" : ""}`).join("\n");
  return (
    "Tu structures des paris personnalisés NBA écrits en texte libre par des joueurs d'une ligue entre amis, " +
    "pour un calcul de probabilité automatique. Le service de calcul ne sait gérer QUE les 12 stats suivantes, " +
    "un seul joueur, un seul seuil par pari :\n\n" +
    statList +
    "\n\nTout le reste (paris équipe, score du match, combo plusieurs joueurs, événement de match, paris fun/" +
    "hors-terrain comme \"l'entraîneur criera au moins 3 fois\", scénarios complexes, ou une formulation trop " +
    "vague pour être sûr) doit être marqué calculable=false — ne force jamais une extraction incertaine."
  );
}

export async function structureBet(description: string): Promise<BetStructuration | null> {
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
      model: "claude-opus-5",
      max_tokens: 1024,
      system: buildSystemPrompt(),
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
