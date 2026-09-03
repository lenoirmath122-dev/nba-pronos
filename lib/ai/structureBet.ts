import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { STAT_CODES, STAT_LABELS_FR, NO_THRESHOLD_STATS } from "./statCodes";
import { MATCH_STAT_CODES, MATCH_STAT_LABELS_FR, NO_THRESHOLD_MATCH_STATS } from "./matchStatCodes";
import { TEAM_STAT_CODES, TEAM_STAT_LABELS_FR } from "./teamStatCodes";
import { COMPARISON_PLAYER_STAT_CODES, COMPARISON_TEAM_STAT_CODES } from "./comparisonCodes";
import type { KnownRosters } from "./roster";

// Union des 2 listes de codes valides dans un duel (joueur OU équipe,
// cf. comparisonCodes.ts) -- un seul champ Zod pour les 2 côtés, la
// cohérence kind/stat (joueur -> code joueur, équipe -> code équipe) est
// vérifiée à l'exécution (structureAndScoreBet.ts), pas dans le schéma :
// Zod ne sait pas exprimer "cet enum dépend de la valeur d'un autre champ".
const COMPARISON_STAT_CODES = [...new Set([...COMPARISON_PLAYER_STAT_CODES, ...COMPARISON_TEAM_STAT_CODES])];

// Union LARGE (STAT_CODES ENTIER + TEAM_STAT_CODES) pour les conditions
// combo (24/08/2026, chantier combo) -- contrairement au duel, une
// condition combo "simple" (1 entité, 1 stat) accepte TOUTES les stats
// joueur y compris dd/td/pourcentages (réutilise compute_proba() tel quel
// côté service, cf. supabase_context.py::_condition_proba) -- seule une
// condition "somme" (plusieurs entités/stats) est restreinte aux stats
// comptées, vérifié à l'exécution, pas dans le schéma.
const COMBO_STAT_CODES = [...new Set([...STAT_CODES, ...TEAM_STAT_CODES])];

// Structuration IA d'un pari perso en texte libre (SPEC_TECHNIQUE_PROBA_
// PARIS_PERSOS_V0_1.md §3, décidé le 21/08/2026 : Claude Sonnet 5, appel
// synchrone à la soumission du pari). Extrait joueur/stat/seuil/comparaison
// UNIQUEMENT pour les paris que le micro-service de proba sait calculer
// -- `calculable: false` fait retomber sur le mécanisme manuel existant,
// inchangé.
//
// Schéma réorganisé en objets IMBRIQUÉS par bet_subject (24/08/2026,
// chantier combo, GAPS_OUVERTS.md) -- AVANT ce refactor, les champs de
// chaque bet_subject vivaient à plat à la racine (ex. comparison_left_kind,
// comparison_left_players...) : ajouter COMPARISON avait déjà fait passer
// le nombre de champs nullable/union RACINE de 9 à 19, rejeté par l'API
// Claude ("too many parameters with union types... limit: 16"), compressé
// dans l'urgence à 13 champs plats. En ajoutant COMBO (qui a besoin d'un
// TABLEAU de conditions, inexprimable proprement en champs plats), le même
// mur allait revenir. Vérifié empiriquement (vrais appels API) : un objet
// NULLABLE à la racine ne compte que pour 1, quel que soit le nombre de
// champs NON-nullable à l'intérieur -- donc regrouper chaque bet_subject
// dans son propre objet nullable (`player`/`team_stat`/`match_total`/
// `comparison_bet`/`combo_bet`) ramène le total à 6 champs racine au lieu
// de 13+, avec de la marge pour les chantiers futurs (période, etc.).
// Bénéfice collatéral : les champs qui étaient réutilisés/surchargés faute
// de place (`threshold` servant à la fois de seuil ET de multiplicateur
// GT ET de borne DIFF_LT, `comparison` portant OVER/UNDER ET GT/DIFF_LT)
// retrouvent chacun leur propre champ clairement nommé à l'intérieur de
// leur objet, plus besoin de les surcharger.
const BetStructurationSchema = z.object({
  calculable: z
    .boolean()
    .describe(
      "true si un des bet_subject ci-dessous s'applique clairement avec tous ses champs requis remplis. false " +
        "pour combo hors périmètre (OU imbriqué, comptage sur le roster), fun/hors-terrain, ou formulation " +
        "ambiguë -- ne force jamais une extraction incertaine.",
    ),
  bet_subject: z
    .enum(["PLAYER", "TEAM_STAT", "MATCH_TOTAL", "COMPARISON", "COMBO"])
    .nullable()
    .describe(
      "PLAYER (remplis `player`) : UN joueur + UNE stat. TEAM_STAT (remplis `team_stat`) : UNE équipe précise + " +
        "UNE stat. MATCH_TOTAL (remplis `match_total`) : stat COMBINÉE des 2 équipes, sans viser une équipe. " +
        "COMPARISON (remplis `comparison_bet`) : compare 2 côtés entre eux (jamais contre un seuil fixe). COMBO " +
        "(remplis `combo_bet`) : plusieurs conditions reliées par un ET, toutes doivent être vraies. null si non " +
        "calculable.",
    ),
  player: z
    .object({
      not_in_match: z
        .boolean()
        .describe(
          "true si ce joueur (vrai joueur NBA) ne joue pour AUCUNE des 2 équipes de ce match (utilise ta " +
            "connaissance des effectifs réels). calculable reste true, remplis quand même les autres champs -- " +
            "l'appli forcera proba=0%.",
        ),
      name: z.string().describe("Orthographe standard NBA (ex: \"Michael Porter Jr.\" pas \"Junior\")."),
      team: z.enum(["team1", "team2"]).nullable().describe("null si not_in_match=true."),
      stat: z.enum(STAT_CODES as [string, ...string[]]).describe("Code de la stat JOUEUR concernée."),
      threshold: z.number().nullable().describe("null pour dd/td/tech (probabilité directe, pas de seuil)."),
      comparison: z.enum(["OVER", "UNDER"]).nullable().describe("null pour dd/td/tech."),
    })
    .nullable()
    .describe("Rempli seulement si bet_subject=PLAYER, sinon null."),
  team_stat: z
    .object({
      team: z.enum(["team1", "team2"]),
      stat: z.enum(TEAM_STAT_CODES as [string, ...string[]]),
      threshold: z.number(),
      comparison: z.enum(["OVER", "UNDER"]),
    })
    .nullable()
    .describe("Rempli seulement si bet_subject=TEAM_STAT, sinon null."),
  match_total: z
    .object({
      stat: z.enum(MATCH_STAT_CODES as [string, ...string[]]),
      threshold: z.number().nullable().describe("null pour went_to_ot/had_backcourt_turnover/had_buzzer_beater (probabilité directe, pas de seuil)."),
      comparison: z.enum(["OVER", "UNDER"]).nullable().describe("null pour went_to_ot/had_backcourt_turnover/had_buzzer_beater."),
      negation: z
        .boolean()
        .describe(
          "UNIQUEMENT pertinent pour went_to_ot/had_backcourt_turnover/had_buzzer_beater (les 3 stats SANS seuil) " +
            "-- true si le texte affirme l'ABSENCE de l'événement (ex: \"aucun panier marqué au buzzer\", \"pas de " +
            "retour en zone\", \"le match n'ira pas en prolongation\"), false si le texte affirme l'événement " +
            "positivement (ex: \"au moins un retour en zone\", \"le match ira en prolongation\"). Toujours false " +
            "pour les stats À SEUIL (la négation s'y exprime déjà via comparison=UNDER).",
        ),
    })
    .nullable()
    .describe("Rempli seulement si bet_subject=MATCH_TOTAL, sinon null."),
  comparison_bet: z
    .object({
      left: z.object({
        kind: z
          .enum(["PLAYER", "team1", "team2"])
          .describe("PLAYER si ce côté est un joueur (ou une somme de joueurs) -- team1/team2 si c'est UNE équipe."),
        players: z
          .array(z.string())
          .describe("Uniquement si kind=PLAYER : 1 nom = joueur seul, 2+ noms = leur somme cumulée. Tableau vide sinon."),
        stat: z
          .enum(COMPARISON_STAT_CODES as [string, ...string[]])
          .describe("Code de stat JOUEUR si kind=PLAYER, ÉQUIPE si team1/team2."),
      }),
      right: z.object({
        kind: z.enum(["PLAYER", "team1", "team2"]),
        players: z.array(z.string()),
        stat: z.enum(COMPARISON_STAT_CODES as [string, ...string[]]),
      }),
      relation: z
        .enum(["GT", "DIFF_LT", "OR"])
        .describe(
          "GT si \"plus que\"/\"au moins X fois plus\". DIFF_LT pour un ÉCART borné (\"la différence est " +
            "inférieure à X\"). OR si \"A OU B\" atteint CHACUN indépendamment un même seuil (ex. \"Hauser OU " +
            "Pritchard marque au moins 3 paniers à 3 points\") -- gagné si au moins un des deux dépasse threshold. " +
            "Une ÉGALITÉ EXACTE (\"le même nombre de minutes\") n'est PAS gérée -- calculable=false dans ce cas.",
        ),
      multiplier: z
        .number()
        .nullable()
        .describe("Uniquement pour relation=GT. Facteur multiplicatif du côté droit (ex. \"deux fois plus\" -> 2). null si aucun facteur mentionné."),
      threshold: z
        .number()
        .nullable()
        .describe("DIFF_LT : la borne de l'écart. OR : le seuil comparé indépendamment aux 2 côtés. null pour GT."),
    })
    .nullable()
    .describe("Rempli seulement si bet_subject=COMPARISON, sinon null."),
  combo_bet: z
    .object({
      conditions: z
        .array(
          z.object({
            kind: z.enum(["PLAYER", "team1", "team2"]).describe("PLAYER pour un/des joueur(s), team1/team2 pour une équipe."),
            players: z.array(z.string()).describe("Uniquement si kind=PLAYER : 1 nom, ou 2+ noms si leurs stats se cumulent. Tableau vide sinon."),
            stats: z
              .array(z.enum(COMBO_STAT_CODES as [string, ...string[]]))
              .describe(
                "1 code = condition normale. 2+ codes = SOMME de plusieurs stats pour LE MÊME joueur (style PRA, " +
                  "ex. \"25pts+12reb+8pas cumulés\" -> [\"pts\",\"reb\",\"ast\"]). Si players a 2+ noms, stats doit " +
                  "rester à 1 seul code (cumul entre joueurs, pas de croisement joueurs×stats).",
              ),
            threshold: z.number().nullable().describe("null uniquement si stats=[\"dd\"] ou [\"td\"] (probabilité directe)."),
            comparison: z.enum(["OVER", "UNDER"]),
          }),
        )
        .describe(
          "2 conditions ou plus, reliées par un ET implicite (TOUTES doivent être vraies). Ne PAS utiliser pour un " +
            "OU entre conditions, ni pour \"au moins N joueurs remplissent X\" (comptage sur tout le roster) -- " +
            "marque calculable=false dans ces 2 cas, pas encore géré.",
        ),
    })
    .nullable()
    .describe("Rempli seulement si bet_subject=COMBO, sinon null."),
  reasoning: z
    .string()
    .describe("Explication TRÈS COURTE (10-15 mots), pour trace/debug admin, pas pour le joueur."),
});

export type BetStructuration = z.infer<typeof BetStructurationSchema>;

/** Partie STATIQUE du prompt (identique à CHAQUE appel, quel que soit le
 *  match) -- séparée de buildDynamicSystemText() pour permettre le cache
 *  de prompt (24/08/2026, GAPS_OUVERTS.md) : marquée cache_control côté
 *  structureBet() ci-dessous. Contient les instructions + les listes de
 *  stats (le plus gros du contenu, et LE SCHÉMA de sortie structurée
 *  s'y trouve automatiquement inclus par l'API -- vérifié empiriquement,
 *  aucun cache_control séparé nécessaire sur output_config). */
function buildStaticSystemText(): string {
  const statList = STAT_CODES.map((code) => `- "${code}" : ${STAT_LABELS_FR[code]}${NO_THRESHOLD_STATS.has(code) ? " (pas de seuil, probabilité directe)" : ""}`).join("\n");
  const matchStatList = MATCH_STAT_CODES.map((code) => `- "${code}" : ${MATCH_STAT_LABELS_FR[code]}${NO_THRESHOLD_MATCH_STATS.has(code) ? " (pas de seuil, probabilité directe)" : ""}`).join("\n");
  const teamStatList = TEAM_STAT_CODES.map((code) => `- "${code}" : ${TEAM_STAT_LABELS_FR[code]}`).join("\n");
  const comparisonPlayerStatList = COMPARISON_PLAYER_STAT_CODES.map((code) => `"${code}"`).join(", ");
  const comparisonTeamStatList = COMPARISON_TEAM_STAT_CODES.map((code) => `"${code}"`).join(", ");
  return (
    "Tu structures des paris personnalisés NBA écrits en texte libre par des joueurs d'une ligue entre amis, " +
    "pour un calcul de probabilité automatique. Le service de calcul sait gérer 5 types de paris, TOUJOURS pour " +
    "UN match précis (jamais une somme sur plusieurs matchs d'une série -- si le pari cumule explicitement sur " +
    "\"la série\"/\"les matchs\", marque calculable=false, ce cas n'est pas encore géré) :\n\n" +
    "1. bet_subject=PLAYER -- UN seul joueur + UNE des 12 stats suivantes :\n" +
    statList +
    "\n\n2. bet_subject=TEAM_STAT -- UNE équipe précise (ex. \"Boston aura 45+ rebonds\") + UNE des stats " +
    "suivantes :\n" +
    teamStatList +
    "\n\n3. bet_subject=MATCH_TOTAL -- une stat COMBINÉE des 2 équipes, SANS viser une équipe en particulier " +
    "(ex. \"90+ rebonds au total\") :\n" +
    matchStatList +
    "\nPour went_to_ot/had_backcourt_turnover/had_buzzer_beater (sans seuil), le texte peut affirmer l'événement " +
    "(\"le match ira en prolongation\") OU son ABSENCE (\"aucun panier marqué au buzzer durant le match\", " +
    "\"pas de retour en zone\") -- remplis `negation` en conséquence dans les 2 cas, ne l'ignore jamais." +
    "\n\n4. bet_subject=COMPARISON -- COMPARE 2 côtés entre eux (GT/DIFF_LT) OU chacun contre un même seuil fixe " +
    "(OR). Chaque côté est soit UN joueur, soit une SOMME de plusieurs joueurs (même stat pour tous), soit UNE " +
    "équipe. Stats valides côté joueur : " + comparisonPlayerStatList + ". Stats valides côté équipe : " +
    comparisonTeamStatList + ". Exemples : \"Holmgren marque plus de points que Brooks\" (2 joueurs, GT), \"SGA " +
    "marque plus que Booker+Brooks cumulés\" (joueur vs somme de 2, GT), \"Boston prend plus de rebonds que " +
    "Philadelphie\" (2 équipes, GT), \"écart de points entre LeBron et Bronny inférieur à 20\" (2 joueurs, " +
    "DIFF_LT), \"les Spurs ont au moins 2 fois plus d'interceptions que les Knicks\" (2 équipes, GT, " +
    "multiplicateur), \"Hauser ou Pritchard marque au moins 3 paniers à 3 points\" (2 joueurs, OR, threshold=3).\n\n" +
    "5. bet_subject=COMBO -- PLUSIEURS conditions reliées par un ET (TOUTES doivent être vraies). Chaque " +
    "condition vise UN joueur, une SOMME de plusieurs joueurs (même stat), ou UNE équipe, avec sa propre stat/" +
    "seuil/comparaison. Une condition peut aussi sommer PLUSIEURS stats pour UN MÊME joueur (style PRA). " +
    "Exemples : \"Cunningham marque plus de 25 points et réalise plus de 5 passes\" (2 conditions, même joueur, " +
    "stats différentes), \"Wembanyama réalise au moins 25 points, 12 rebonds et 8 passes\" (1 condition, 3 stats " +
    "sommées pour Wembanyama), \"le cumul des points de Castle et Harper est supérieur à 40\" (1 condition, 2 " +
    "joueurs, 1 stat sommée), \"Sengun marque au moins 23 points et prend au moins 13 rebonds\" (2 conditions), " +
    "\"Minnesota marque entre 101 et 110 points inclus\" (2 conditions SUR LA MÊME équipe/stat : pts>=101 OVER et " +
    "pts<=110 UNDER -- une fourchette est toujours 2 conditions, jamais un seul seuil). " +
    "PAS géré (calculable=false) : un OU entre conditions (ex. \"triple-double AVEC 40+points ET (20+rebonds OU " +
    "20+passes)\"), et \"au moins N joueurs remplissent une condition\" (ex. \"8 joueurs marquent 11+ points\" -- " +
    "nécessite de compter sur tout le roster, pas encore géré).\n\n" +
    "Tout le reste (contre/action visant un joueur adverse précis, événement de match, paris fun/hors-terrain " +
    "comme \"l'entraîneur criera au moins 3 fois\", scénarios complexes, formulation trop vague, égalité exacte, " +
    "ou total cumulé sur une série) doit être marqué calculable=false — ne force jamais une extraction incertaine." +
    // Règle de vérification de présence déplacée ici (03/09/2026, optimisation
    // coût suite à un retour utilisateur -- BUG-003) : texte IDENTIQUE à
    // chaque appel (ne dépend d'aucune donnée du match), donc mis en cache
    // avec le reste du bloc statique plutôt que payé en clair à chaque appel
    // dans buildDynamicSystemText(), qui ne garde plus que les FAITS
    // variables (noms d'équipes, listes ROSTER). Contenu inchangé, juste
    // déplacé -- aucune régression de comportement attendue.
    "\n\nVérification de présence au match : chaque pari précise plus bas les 2 équipes concernées (team1/team2), " +
    "éventuellement accompagnées d'un ROSTER réel (joueurs ayant joué pour cette équipe dans les 30 derniers " +
    "jours -- lib/ai/roster.ts). Vérifie que le(s) joueur(s) nommé(s) jouent actuellement pour l'une des 2 " +
    "équipes. Si un ROSTER est fourni, traite-le comme un signal FORT mais pas absolu : un joueur qui y figure " +
    "clairement (même avec une légère variante d'orthographe) est PRÉSENT, même si ta connaissance générale " +
    "suggère le contraire (cas d'un transfert récent) -- à l'inverse, un joueur absent des 2 ROSTER n'est pas " +
    "automatiquement écarté s'il te semble par ailleurs clairement être un coéquipier actuel (liste possiblement " +
    "incomplète : blessure longue durée, transfert très récent). Si aucun ROSTER n'est fourni, base-toi " +
    "uniquement sur ta connaissance des effectifs NBA réels, comme d'habitude. Dans tous les cas, si le joueur " +
    "ne joue pour aucune des 2 équipes (joueur d'une autre équipe, retraité, nom inventé...), marque " +
    "not_in_match=true (pour PLAYER -- calculable reste true) plutôt que calculable=false. Corrige aussi " +
    "l'orthographe du nom vers la convention standard NBA (ex: \"Junior\" -> \"Jr.\") plutôt que de reprendre le " +
    "texte exact du joueur, qui peut contenir des fautes de frappe."
  );
}

/** Partie DYNAMIQUE du prompt (varie selon le match) -- volontairement
 *  SÉPARÉE de buildStaticSystemText() pour rester hors du bloc mis en
 *  cache (cf. structureBet() ci-dessous). Ne porte QUE des faits qui varient
 *  d'un appel à l'autre (noms d'équipes, listes ROSTER) -- toute
 *  l'explication de comment les utiliser vit dans le bloc statique
 *  (identique à chaque appel, donc mis en cache) depuis le 03/09/2026.
 *
 *  `rosters` (BUG-003 de l'audit du 03/09/2026, GAPS_OUVERTS.md) : effectifs
 *  réels des 2 équipes dérivés des stats des 30 derniers jours
 *  (lib/ai/roster.ts), en complément -- jamais en remplacement -- de la
 *  connaissance générale de Claude, qui s'est révélée fautive sur des
 *  joueurs récemment échangés (traités comme absents alors qu'ils avaient
 *  rejoint leur nouvelle équipe). `null` si non résolu (équipe hors
 *  pipeline stats, ex. NBA Cup Alpha) -- comportement inchangé dans ce cas. */
function buildDynamicSystemText(teamNames: [string, string] | null, rosters: KnownRosters | null): string {
  if (!teamNames) return "";
  let text = `\n\nCe pari concerne un match/une série entre **team1 = ${teamNames[0]}** et **team2 = ${teamNames[1]}**.`;
  if (rosters) {
    const team1List = rosters.team1.join(", ") || "aucun trouvé";
    const team2List = rosters.team2.join(", ") || "aucun trouvé";
    text += `\nROSTER team1 : ${team1List}.\nROSTER team2 : ${team2List}.`;
  }
  return text;
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
 *  moins cher par appel (Cadrage/Stats/projet-data-nba.md §35).
 *
 *  Cache de prompt (24/08/2026, GAPS_OUVERTS.md) : `system` scindé en 2
 *  blocs, le statique (instructions + listes de stats + schéma, identique
 *  à chaque appel) marqué cache_control ephemeral (TTL 5 min par défaut du
 *  SDK -- choisi explicitement avec l'utilisateur malgré des horaires de
 *  paris étalés sur la journée, "on part sur le cache 5 min et on verra
 *  après", à revoir vers 1h si le taux de succès observé en prod est
 *  faible). Vérifié empiriquement (3 vrais appels) : ~80% de réduction du
 *  coût d'entrée effectif dès le 2e appel dans la fenêtre, quel que soit
 *  le match/pari (le bloc statique est bit-identique). */
export async function structureBet(
  description: string,
  teamNames: [string, string] | null = null,
  model = "claude-sonnet-5",
  rosters: KnownRosters | null = null,
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
    // 2048 plutôt que 1024 (03/09/2026, GAPS_OUVERTS.md, chantier
    // "optimisation tokens paris persos") -- trouvé en testant 30 vrais
    // paris perso de l'archive playoffs 2026 : 1/30 a rempli les 1024
    // tokens sans terminer sa réponse JSON (parsing échoué, résultat
    // silencieusement traité comme "non calculable" par l'appelant), alors
    // que le pari était un cas simple (COMPARISON basique). Le 2e plus gros
    // cas observé faisait 715 tokens -- 2048 garde une marge confortable.
    // Même correctif appliqué aux 8 schémas dédiés (structurePeriodBet.ts
    // et consorts, mêmes tailles de sortie potentielles), pas testé
    // individuellement mais même risque structurel.
    const response = await client.messages.parse({
      model,
      max_tokens: 2048,
      system: [
        { type: "text", text: buildStaticSystemText(), cache_control: { type: "ephemeral" } },
        { type: "text", text: buildDynamicSystemText(teamNames, rosters) },
      ],
      messages: [{ role: "user", content: `Pari à structurer : "${description}"` }],
      output_config: { format: zodOutputFormat(BetStructurationSchema) },
    });
    // Mesure de conso réelle (02-03/09/2026, GAPS_OUVERTS.md, chantier
    // "optimisation tokens paris persos") -- gratuit, lit un champ déjà
    // présent dans la réponse. Objectif : avoir de vraies données pour
    // trancher le TTL de cache (5 min vs 1h, cf. commentaire ci-dessus) et
    // la piste "classifier puis structurer" plutôt que deviner. Grep sur
    // "structureBet usage" dans les logs Vercel pour les récupérer.
    console.log(
      `structureBet usage : model=${model} input=${response.usage.input_tokens} ` +
        `output=${response.usage.output_tokens} cache_read=${response.usage.cache_read_input_tokens ?? 0} ` +
        `cache_creation=${response.usage.cache_creation_input_tokens ?? 0}`,
    );
    return response.parsed_output;
  } catch {
    // Panne réseau/API/parsing : traité comme "non calculable cette fois",
    // jamais remonté à l'appelant comme une erreur bloquante.
    return null;
  }
}
