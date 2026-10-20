import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { STAT_CODES } from "./statCodes";
import { TEAM_STAT_CODES, COMBO_WIN_STAT, COMBO_MARGIN_STAT, COMBO_STARTER_STAT, COMBO_PERIOD_STATS } from "./teamStatCodes";
import { recordAnthropicUsage } from "./usageTracking";
import { applyInclusiveThreshold, INCLUSIVE_DESCRIPTION } from "./inclusiveThreshold";

// Combo mêlant match entier et période (S4 fin, 20/10/2026) : « tirent à plus
// de 32 % à 3 points ET remportent les 4 quarts-temps ». Schéma SÉPARÉ, pour
// la même raison que structureComboBet.ts (le schéma partagé est au plafond de
// grammaire de l'API : pas de nouveau champ, et même un enum élargi y est
// risqué). Appelé UNIQUEMENT quand structurePeriodBet() a répondu
// mixed_combo=true -- jamais en plus, jamais pour le reste des paris.
//
// Même forme que le schéma OU imbriqué (groupes reliés par un ET, chaque
// groupe = 1+ conditions reliées par un OU), donc même stockage
// (structured_combo) et même résolution. Les conditions de période sont des
// pseudo-stats d'équipe (cf. teamStatCodes.ts) : pas de champ « période ».
const COMBO_PERIOD_STAT_CODES = [...new Set([...STAT_CODES, ...TEAM_STAT_CODES, COMBO_WIN_STAT, COMBO_MARGIN_STAT, COMBO_STARTER_STAT, ...COMBO_PERIOD_STATS])];

const ComboPeriodConditionSchema = z.object({
  kind: z.enum(["PLAYER", "team1", "team2"]).describe("PLAYER pour un/des joueur(s), team1/team2 pour une équipe."),
  players: z.array(z.string()).describe("Uniquement si kind=PLAYER : 1 nom, ou 2+ noms si leurs stats se cumulent. Tableau vide sinon."),
  stats: z
    .array(z.enum(COMBO_PERIOD_STAT_CODES as [string, ...string[]]))
    .describe(
      "1 code = condition normale (stat sur le MATCH ENTIER). 2+ codes = SOMME de stats pour LE MÊME joueur. Codes " +
        "d'équipe spéciaux, seuls dans stats, kind=team1/team2 : \"win\" = vainqueur du match ; \"margin\" = écart final signé de l'équipe (avec threshold) ; \"starter\" = joueur titulaire (OVER) / remplaçant (UNDER), kind=PLAYER, un seul joueur, threshold=null ; \"qwon\" = nombre de " +
        "quarts-temps remportés (0 à 4, avec threshold) ; \"win_q1\"..\"win_q4\", \"win_h1\", \"win_h2\" = remporte ce " +
        "quart-temps / cette mi-temps (threshold=null).",
    ),
  threshold: z.number().nullable().describe("null uniquement si stats=[\"dd\"], [\"td\"], [\"win\"] ou [\"win_q1\"...\"win_h2\"]."),
  comparison: z.enum(["OVER", "UNDER"]).describe("OVER = remporte/réalise, UNDER = ne remporte pas/reste sous le seuil."),
  inclusive: z.boolean().describe(INCLUSIVE_DESCRIPTION),
});

const ComboPeriodBetStructurationSchema = z.object({
  calculable: z
    .boolean()
    .describe(
      "true si ce texte est un ET de plusieurs conditions dont AU MOINS UNE porte sur une période (quarts-temps " +
        "remportés ou remporte un quart/une mi-temps) et une autre sur le match entier. false sinon -- ne force " +
        "jamais une extraction incertaine.",
    ),
  bet_subject: z.enum(["COMBO"]).nullable().describe("\"COMBO\" si calculable=true, sinon null."),
  conditions: z
    .array(z.object({ or: z.array(ComboPeriodConditionSchema) }))
    .describe(
      "Groupes reliés par un ET implicite (TOUS doivent être vrais). Normalement 1 SEULE condition par groupe ; " +
        "2+ dans le même groupe (`or`) uniquement pour un OU explicite. Tableau vide si calculable=false.",
    ),
  reasoning: z.string().describe("Explication TRÈS COURTE (10-15 mots), pour trace/debug admin, pas pour le joueur."),
});

export type ComboPeriodBetStructuration = z.infer<typeof ComboPeriodBetStructurationSchema>;

function buildStaticSystemText(): string {
  return (
    "Tu structures des paris personnalisés NBA écrits en texte libre par des joueurs d'une ligue entre amis, " +
    "pour un calcul de probabilité automatique. On t'a déjà présélectionné ce texte comme un pari COMBO (ET de " +
    "plusieurs conditions) mêlant une condition de PÉRIODE (quarts-temps remportés, ou remporte un quart-temps/" +
    "une mi-temps) et au moins une autre condition (stat d'équipe ou de joueur sur le match entier, vainqueur du " +
    "match). TOUJOURS pour UN match précis. Confirme et structure, ou rejette (calculable=false).\n\n" +
    "Exemples calculable=true : \"Les Knicks tirent à plus de 32% à 3 points et remportent les 4 quarts-temps\" -> " +
    "2 groupes : [team Knicks, stats=[\"fg3\"], threshold=0.32, OVER, inclusive=false], [team Knicks, " +
    "stats=[\"qwon\"], threshold=4, OVER, inclusive=true] (« les 4 » = au moins 4). \"Boston remporte le 1er " +
    "quart-temps et le match\" -> [team Boston stats=[\"win_q1\"] threshold=null OVER], [team Boston " +
    "stats=[\"win\"] threshold=null OVER]. \"Denver gagne au moins 2 quarts-temps et Jokic fait un triple-double\" " +
    "-> [qwon threshold=2 OVER inclusive=true], [PLAYER Jokic stats=[\"td\"] threshold=null].\n\n" +
    "Exemples calculable=false : un pari sans aucune condition de période ; \"Minnesota mène à la mi-temps et " +
    "Denver gagne le match\" (un seul résultat « mène puis perd », traité ailleurs) ; une formulation vague. " +
    "N'invente jamais une condition absente du texte ; ne structure jamais seulement une moitié du pari."
  );
}

function buildDynamicSystemText(teamNames: [string, string] | null): string {
  if (!teamNames) return "";
  return `\n\nCe pari concerne un match entre **team1 = ${teamNames[0]}** et **team2 = ${teamNames[1]}**.`;
}

/** Même contrat/patron que structureComboNestedBet(). Appelée UNIQUEMENT
 *  quand structurePeriodBet() a signalé mixed_combo=true. */
export async function structureComboPeriodBet(
  description: string,
  teamNames: [string, string] | null = null,
  model = "claude-sonnet-5",
): Promise<ComboPeriodBetStructuration | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

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
      output_config: { format: zodOutputFormat(ComboPeriodBetStructurationSchema) },
    });
    await recordAnthropicUsage("structureComboPeriodBet", model, response.usage);
    const parsed = response.parsed_output;
    if (!parsed) return null;
    return {
      ...parsed,
      conditions: parsed.conditions.map((g) => ({
        or: g.or.map((c) => ({ ...c, threshold: applyInclusiveThreshold(c.threshold, c.comparison, c.inclusive, c.stats) })),
      })),
    };
  } catch {
    return null;
  }
}
