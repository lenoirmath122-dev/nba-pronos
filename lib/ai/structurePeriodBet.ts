import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { STAT_CODES, STAT_LABELS_FR, NO_THRESHOLD_STATS } from "./statCodes";
import { PERIOD_CODES, PERIOD_LABELS_FR, PERIOD_OUTCOME_KINDS, PERIOD_OUTCOME_LABELS_FR, NO_THRESHOLD_PERIOD_OUTCOMES } from "./periodStatCodes";

// Chantier "pari période" (24/08/2026, GAPS_OUVERTS.md) -- schéma SÉPARÉ de
// structureBet.ts, pas un 7e bet_subject dans le schéma existant. Découvert
// en testant en conditions réelles : le schéma principal (PLAYER/TEAM_STAT/
// MATCH_TOTAL/COMPARISON/COMBO) est déjà au plafond de complexité accepté
// par l'API Claude pour les sorties structurées -- y ajouter `period_bet`
// (même après avoir factorisé les enums répétés en instances Zod partagées,
// $ref-dédupliquées) fait échouer TOUS les paris avec "compiled grammar is
// too large", pas seulement PERIOD (reproduit avec de vrais appels API,
// y compris sur un pari overtime n'ayant rien à voir avec PERIOD/period_bet).
//
// Décidé avec l'utilisateur (24/08/2026) : PAS de 2e appel en repli quand le
// 1er échoue (ça coupleraait le coût de PERIOD à TOUTE la population de
// paris déjà/futurs non calculables, pas mesurable ni borné) -- à la place,
// routage EN AMONT par mot-clé (cf. PERIOD_KEYWORD_REGEX dans
// structureAndScoreBet.ts) : un texte qui ressemble à un pari période
// n'appelle QUE ce schéma-ci (jamais les deux), un texte qui n'y ressemble
// pas n'appelle QUE structureBet.ts (comportement byte-for-byte inchangé,
// AUCUNE régression possible sur les 5 types déjà en prod). Un pari période
// mal détecté par le mot-clé retombe sur structureBet.ts -> calculable=false
// -> file de validation manuelle admin, même filet de sécurité que tout
// autre cas non géré aujourd'hui, pas une réponse fausse.
//
// Généralisation explicitement écartée pour les 5 autres bet_subject : leur
// distinction est SÉMANTIQUE (comparaison vs seuil fixe vs somme de
// conditions), pas lexicale -- un mot-clé ne peut pas les séparer de façon
// fiable ("Tatum marque plus de points que Booker" vs "Tatum marque plus de
// 25 points" partagent les mêmes mots), contrairement au vocabulaire
// temporel de PERIOD (quart-temps/mi-temps), nettement moins ambigu.
const PeriodBetStructurationSchema = z.object({
  calculable: z
    .boolean()
    .describe(
      "true si ce texte est bien un pari sur un quart-temps/une mi-temps précis (équipe ou joueur), avec tous " +
        "les champs de period_bet requis remplis. false pour tout le reste (y compris \"va en prolongation\", qui " +
        "n'est PAS un pari période) -- ne force jamais une extraction incertaine.",
    ),
  bet_subject: z
    .enum(["PERIOD"])
    .nullable()
    .describe("\"PERIOD\" si calculable=true, sinon null."),
  period_bet: z
    .object({
      period: z
        .enum(PERIOD_CODES as [string, ...string[]])
        .nullable()
        .describe(
          "Q1-Q4 = un quart-temps précis. H1/H2 = une mi-temps (2 quarts-temps combinés). null uniquement pour " +
            "outcome_kind=QUARTERS_WON_COUNT (porte sur les 4 quarts-temps du match entier, aucune période unique).",
        ),
      outcome_kind: z
        .enum(PERIOD_OUTCOME_KINDS as [string, ...string[]])
        .nullable()
        .describe(
          "null si `player` est rempli (pari joueur+période -- toujours un seuil simple sur player_stat, pas de " +
            "outcome_kind). Sinon un des 7 types équipe listés plus haut dans les instructions.",
        ),
      team: z
        .enum(["team1", "team2"])
        .nullable()
        .describe("Équipe visée par le pari. null pour MARGIN/TOTAL_POINTS (résultat symétrique) ou si `player` est rempli."),
      player: z
        .string()
        .nullable()
        .describe(
          "Nom du joueur si ce pari porte sur UN joueur précis pendant cette période plutôt que sur une équipe " +
            "(ex. \"3 contres en 1ère mi-temps pour Untel\") -- alors team et outcome_kind restent null, et " +
            "player_stat/threshold/comparison portent la condition. Orthographe standard NBA.",
        ),
      player_stat: z
        .enum(STAT_CODES as [string, ...string[]])
        .nullable()
        .describe("Stat JOUEUR concernée, uniquement si `player` est rempli, sinon null."),
      exact_count: z
        .boolean()
        .nullable()
        .describe("QUARTERS_WON_COUNT uniquement : true si \"exactement N\" quarts-temps, sinon null (seuil normal via threshold/comparison, \"au moins N\")."),
      threshold: z.number().nullable().describe("null pour QUARTER_WINNER/HALF_WINNER (probabilité directe)."),
      comparison: z
        .enum(["OVER", "UNDER"])
        .nullable()
        .describe(
          "null pour QUARTER_WINNER/HALF_WINNER. Pour LEADS_HALF_RESULT : OVER = l'équipe qui mène à la mi-temps " +
            "gagne le match, UNDER = elle perd.",
        ),
    })
    .nullable()
    .describe("Rempli seulement si calculable=true, sinon null."),
  reasoning: z
    .string()
    .describe("Explication TRÈS COURTE (10-15 mots), pour trace/debug admin, pas pour le joueur."),
});

export type PeriodBetStructuration = z.infer<typeof PeriodBetStructurationSchema>;

function buildStaticSystemText(): string {
  const statList = STAT_CODES.map((code) => `- "${code}" : ${STAT_LABELS_FR[code]}${NO_THRESHOLD_STATS.has(code) ? " (pas de seuil, probabilité directe)" : ""}`).join("\n");
  const periodOutcomeList = PERIOD_OUTCOME_KINDS.map((code) => `"${code}" (${PERIOD_OUTCOME_LABELS_FR[code]}${NO_THRESHOLD_PERIOD_OUTCOMES.has(code) ? ", pas de seuil, probabilité directe" : ""})`).join(", ");
  const periodList = PERIOD_CODES.map((code) => `"${code}" (${PERIOD_LABELS_FR[code]})`).join(", ");
  return (
    "Tu structures des paris personnalisés NBA écrits en texte libre par des joueurs d'une ligue entre amis, " +
    "pour un calcul de probabilité automatique. On t'a déjà présélectionné ce texte comme RESSEMBLANT à un pari " +
    "sur un quart-temps ou une mi-temps précis -- ton rôle est de confirmer et structurer, ou de rejeter " +
    "(calculable=false) si ce n'est finalement pas le cas. TOUJOURS pour UN match précis (jamais une somme sur " +
    "plusieurs matchs d'une série).\n\n" +
    "Deux formes : (a) ÉQUIPE -- un des types de résultat suivants, avec `team` rempli sauf pour MARGIN/" +
    "TOTAL_POINTS (symétriques) : " + periodOutcomeList + ". Périodes valides : " + periodList + ". (b) JOUEUR -- " +
    "une stat JOUEUR normale limitée à cette période (remplis `player`+`player_stat`, laisse `team`/`outcome_kind` " +
    "à null), une des stats suivantes :\n" + statList + "\n\n" +
    "Exemples calculable=true : \"Minnesota mène à la mi-temps et Denver gagne le match\" (LEADS_HALF_RESULT, " +
    "period=H1, team=Minnesota, comparison=UNDER -- Minnesota mène mais perd), \"les Knicks gagnent au moins 2 " +
    "quarts-temps\" (QUARTERS_WON_COUNT, period=null -- match entier, team=Knicks, threshold=1, comparison=OVER), " +
    "\"Orlando perd le 3e quart-temps\" (QUARTER_WINNER, period=Q3, team=Orlando adversaire -- décris la proba " +
    "que l'AUTRE équipe gagne ce quart), \"l'écart à la mi-temps est de 5 points ou moins\" (MARGIN, period=H1, " +
    "team=null, threshold=5, comparison=UNDER), \"moins de 45 points combinés au 4e quart-temps\" (TOTAL_POINTS, " +
    "period=Q4, threshold=45, comparison=UNDER), \"San Antonio marque plus de 60% de ses points totaux en 2ème " +
    "mi-temps\" (POINT_SHARE_PCT, period=H2, team=San Antonio, threshold=0.6, comparison=OVER), \"3 contres en " +
    "1ère mi-temps pour Wembanyama\" (period=H1, player=\"Victor Wembanyama\", player_stat=\"blk\", threshold=3, " +
    "comparison=OVER).\n\n" +
    "Exemples calculable=false : un pari sur la prolongation (\"le match ira en prolongation\") -- pas un pari " +
    "période, un autre service s'en charge, ne l'accepte JAMAIS ici même s'il mentionne un quart-temps en " +
    "passant ; un pourcentage des points totaux d'un JOUEUR (pas d'une équipe) sur une période (ex. \"Wembanyama " +
    "marque plus de 40% de ses points totaux au 4e quart-temps\") -- non géré, différent d'un seuil simple sur " +
    "une stat ; un total cumulé sur plusieurs matchs d'une série ; une formulation trop vague ou hors-terrain."
  );
}

function buildDynamicSystemText(teamNames: [string, string] | null): string {
  if (!teamNames) return "";
  return (
    `\n\nCe pari concerne un match/une série entre **team1 = ${teamNames[0]}** et **team2 = ${teamNames[1]}**. ` +
    "Vérifie que le(s) joueur(s) nommé(s) jouent actuellement pour l'une de ces 2 équipes (utilise ta " +
    "connaissance des effectifs NBA réels) -- si ce n'est pas le cas, marque calculable=false. Corrige aussi " +
    "l'orthographe du nom vers la convention standard NBA (ex: \"Junior\" -> \"Jr.\")."
  );
}

/** Même contrat/patron que structureBet() (modèle, cache de prompt) -- cf.
 *  sa docstring pour le détail des choix (Sonnet 5, cache_control ephemeral
 *  sur le bloc statique). Appelée UNIQUEMENT quand PERIOD_KEYWORD_REGEX
 *  (structureAndScoreBet.ts) matche le texte du pari -- jamais en plus de
 *  structureBet(), toujours à la place. */
export async function structurePeriodBet(
  description: string,
  teamNames: [string, string] | null = null,
  model = "claude-sonnet-5",
): Promise<PeriodBetStructuration | null> {
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
      output_config: { format: zodOutputFormat(PeriodBetStructurationSchema) },
    });
    return response.parsed_output;
  } catch {
    return null;
  }
}
