import "server-only";
import { getServerClient } from "@/lib/supabase/server";
import { structureBet } from "./structureBet";
import { structurePeriodBet } from "./structurePeriodBet";
import { structureRosterSplitBet } from "./structureRosterSplitBet";
import { structureRosterCountBet } from "./structureRosterCountBet";
import { structureSuperlativeBet } from "./structureSuperlativeBet";
import { structureTechnicalFoulsCountBet } from "./structureTechnicalFoulsCountBet";
import { structureLastBasketBet } from "./structureLastBasketBet";
import { structureBlockOnPlayerBet } from "./structureBlockOnPlayerBet";
import { structureComboNestedBet } from "./structureComboBet";
import {
  predictOverUnder,
  predictSeriesStat,
  predictTotalPoints,
  predictTotalTeamStat,
  predictTeamStat,
  predictComparison,
  predictCombo,
  predictOvertime,
  predictTotalTimeouts,
  predictBackcourtTurnover,
  predictBuzzerBeater,
  predictPeriodTeamOutcome,
  predictPlayerPeriodStat,
  predictRosterSplit,
  predictRosterCount,
  predictSuperlative,
  predictTechnicalFoulsCount,
  predictLastBasket,
  predictBlockOnPlayer,
  type DuelOperand,
  type ComboCondition,
} from "./statsService";
import type { TeamStatCode } from "./teamStatCodes";
import { probaToDifficulty } from "./difficultyTiers";
import { NO_THRESHOLD_STATS, type StatCode } from "./statCodes";
import { NO_THRESHOLD_MATCH_STATS, type MatchStatCode } from "./matchStatCodes";
import {
  NO_THRESHOLD_PERIOD_OUTCOMES,
  TEAM_TARGETED_PERIOD_OUTCOMES,
  estimateLeadsPeriodResultProba,
  type PeriodCode,
  type PeriodOutcomeKind,
} from "./periodStatCodes";
import type { BetCategory } from "@/lib/labels/bets";
import { COMPARISON_PLAYER_STAT_CODES, COMPARISON_TEAM_STAT_CODES } from "./comparisonCodes";
import { resolveKnownRosters, type KnownRosters } from "./roster";
import { DAILY_COST_CAP_USD, getTodaySpendUsd } from "./usageTracking";

// Orchestre la structuration IA + le calcul de proba pour UN pari, à la
// soumission (SPEC_TECHNIQUE_PROBA_PARIS_PERSOS_V0_1.md §3/§6, décidé le
// 21/08/2026 : synchrone, figé à la soumission -- jamais recalculé après).
// Appelée depuis submitBet APRÈS que le pari existe déjà en base
// (save_bet a réussi) -- toute panne ici (IA, service Cloud Run, réseau)
// est avalée silencieusement : le pari reste soumis normalement, avec le
// mécanisme manuel existant (difficulté proposée/validée à la main) comme
// seul repli, jamais bloquant pour le joueur.
//
// Champs de structuration lus en objets IMBRIQUÉS (structuration.player/
// team_stat/match_total/comparison_bet/combo_bet) depuis le refactor du
// 24/08/2026 (chantier combo, GAPS_OUVERTS.md) -- cf. structureBet.ts pour
// le POURQUOI (limite API de 16 champs nullable/union par schéma de sortie
// structurée, dépassée à plat).

/** Bug réel corrigé le 21/08/2026 : sans le contexte du match, l'IA validait
 *  des paris sur des joueurs qui ne jouent même pas dans le match visé
 *  (ex. "Jayson Tatum" sur un match Nets-Hornets). Résolu depuis
 *  series.team1_id/team2_id -- null si pas encore connus (série pas
 *  déterminée), structureBet() se rabat alors sur l'ancien comportement
 *  sans vérification d'équipe. */
async function resolveMatchTeamNames(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  seriesId: string,
): Promise<[string, string] | null> {
  const { data: series } = await supabase
    .from("series")
    .select("team1_id, team2_id")
    .eq("id", seriesId)
    .maybeSingle<{ team1_id: string | null; team2_id: string | null }>();
  if (!series?.team1_id || !series?.team2_id) return null;

  const { data: teams } = await supabase.from("teams").select("id, name").in("id", [series.team1_id, series.team2_id]);
  const nameById = new Map((teams ?? []).map((t) => [t.id as string, t.name as string]));
  const name1 = nameById.get(series.team1_id);
  const name2 = nameById.get(series.team2_id);
  return name1 && name2 ? [name1, name2] : null;
}

/** Effectifs réels des 2 équipes (BUG-003 de l'audit du 03/09/2026,
 *  GAPS_OUVERTS.md) -- même source (series.team1_id/team2_id) que
 *  resolveMatchTeamNames() ci-dessus, requête séparée plutôt que d'étendre
 *  son type de retour (déjà utilisé tel quel dans une quinzaine
 *  d'emplacements de ce fichier). `null` si la série n'a pas encore ses 2
 *  équipes déterminées OU si l'une d'elles n'est pas mappée côté pipeline
 *  stats (ex. équipe fictive NBA Cup Alpha) -- structureBet()/
 *  structurePeriodBet() retombent alors sur leur comportement précédent
 *  (aucun roster injecté, jugement de Claude seul, AUCUNE régression). */
async function resolveKnownRostersForSeries(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  seriesId: string,
): Promise<KnownRosters | null> {
  const { data: series } = await supabase
    .from("series")
    .select("team1_id, team2_id")
    .eq("id", seriesId)
    .maybeSingle<{ team1_id: string | null; team2_id: string | null }>();
  if (!series?.team1_id || !series?.team2_id) return null;
  return resolveKnownRosters(series.team1_id, series.team2_id);
}

/** Détecte un texte "de forme" pari période AVANT tout appel Claude
 *  (24/08/2026, GAPS_OUVERTS.md) -- vocabulaire temporel volontairement
 *  large mais peu ambigu (quart-temps/mi-temps sous toutes leurs graphies
 *  courantes, + les abréviations "QT"/"QT4"/"MT"/"MT1" trouvées en
 *  testant en conditions réelles -- \b...\b évite les faux positifs du
 *  type "qualité"/"métro") : NE MATCHE PAS "prolongation" seule (ex. "va
 *  en prolongation" reste géré par structureBet.ts/MATCH_TOTAL,
 *  comportement inchangé). Un pari période formulé assez différemment
 *  pour échapper à ce filtre retombe sur structureBet.ts ->
 *  calculable=false -> file de validation manuelle admin -- même filet de
 *  sécurité que tout autre cas non géré aujourd'hui, jamais une réponse
 *  fausse. Voir structurePeriodBet.ts pour le POURQUOI de ce routage (pas
 *  un 2e schéma dans structureBet.ts).
 *
 *  "quart" SANS "temps" ajouté le 06/09/2026 (GAPS_OUVERTS.md) -- ex.
 *  "l'équipe qui mène au début du 4e quart perd le match", jamais routé
 *  jusqu'ici. Exige un ordinal/nombre juste avant "quart(s)" (jamais bare
 *  "quart" seul, trop ambigu -- cf. "quart de ses points", gap distinct
 *  volontairement laissé de côté) et exclut explicitement "quart de
 *  finale" (vocabulaire NBA Cup, aucun rapport avec un quart-temps) --
 *  validé sans régression sur les 167 paris réels de
 *  types_de_paris_playoffs_2026.md avant d'être élargi. */
const PERIOD_KEYWORD_REGEX =
  /quart[s]?[\s-]?temps|mi[\s-]?temps|\bqt\d*\b|\bmt\d*\b|\b(?:\d{1,2}\s*(?:e|è|er|ère|ème|eme|éme)?|premier|première|deuxi[eè]me|troisi[eè]me|quatri[eè]me|dernier|derni[eè]re)\s+quarts?\b(?!\s+de\s+finale)/i;

/** Détecte un texte "de forme" pari 5 majeur/banc AVANT tout appel Claude
 *  (24/08/2026, GAPS_OUVERTS.md, chantier "5 majeur/banc") -- même
 *  patron/mêmes raisons que PERIOD_KEYWORD_REGEX ci-dessus (schéma
 *  partagé au plafond, routage dédié plutôt qu'un bet_subject de plus).
 *  Vocabulaire volontairement spécifique au sous-ensemble de roster visé
 *  (titulaires/5 majeur/banc/remplaçants), peu de risque de faux positif
 *  dans un contexte de paris NBA. */
const ROSTER_SPLIT_KEYWORD_REGEX = /cinq\s*majeur|5\s*majeur|titulaires?|\bbancs?\b|rempla[cç]ants?/i;

/** Détecte un texte "de forme" comptage roster-wide AVANT tout appel Claude
 *  (étape 3 du plan de reprise post-audit, 25/08/2026, GAPS_OUVERTS.md) --
 *  même patron que PERIOD_KEYWORD_REGEX/ROSTER_SPLIT_KEYWORD_REGEX ci-dessus.
 *  Signature lexicale : un quantificateur (au moins/plus de/moins de/
 *  exactement) suivi d'un nombre puis de "joueur(s)", OU "joueur(s)...
 *  chacun" (ex. "les 10 titulaires marquent CHACUN 8+"), OU "DNP" en toutes
 *  lettres. Testée AVANT ROSTER_SPLIT_KEYWORD_REGEX dans le routage
 *  ci-dessous (pas après) : "les 10 joueurs titulaires marquent CHACUN
 *  plus de 8 points" contient "titulaires" (matcherait ROSTER_SPLIT) ET
 *  "chacun" (comptage individuel, pas une somme) -- la 2e lecture est la
 *  bonne, ROSTER_SPLIT rejette déjà explicitement ce cas dans son propre
 *  prompt ("condition INDIVIDUELLE sur chaque titulaire, pas une somme --
 *  non géré"), confirmant que ce n'est jamais le bon schéma pour ce texte. */
const ROSTER_COUNT_KEYWORD_REGEX =
  /(?:au moins|plus de|moins de|exactement)\s+\S+\s+joueurs?\b|\bjoueurs?\b[^.!?]{0,40}\bchacune?\b|\bDNP\b/i;

/** Détecte un texte "de forme" superlatif implicite ("meilleur marqueur")
 *  AVANT tout appel Claude (étape 4 du plan de reprise post-audit,
 *  25/08/2026, GAPS_OUVERTS.md) -- même patron que les regex ci-dessus.
 *  Signature lexicale : "tout autre joueur"/"n'importe quel autre joueur"
 *  (ensemble non borné, cause racine "superlatif implicite" de l'audit),
 *  ou "meilleur marqueur/passeur/rebondeur/contreur/intercepteur" en toutes
 *  lettres. Vérifié ne PAS collisionner avec ROSTER_COUNT_KEYWORD_REGEX
 *  ("plus de points que tout autre joueur" ne matche PAS son alternative
 *  quantificateur+nombre+joueurs, qui exige un SEUL mot entre les deux) ni
 *  avec ROSTER_SPLIT/PERIOD (aucun vocabulaire commun). */
const SUPERLATIVE_KEYWORD_REGEX =
  /tout autre joueur|n['’]importe quel autre joueur|meilleur (?:marqueur|passeur|rebondeur|contreur|intercepteur)/i;

/** Détecte un texte "de forme" fautes techniques ÉQUIPE/MATCH avec un
 *  comptage EXACT AVANT tout appel Claude (étape 5 du plan de reprise
 *  post-audit, 25/08/2026, GAPS_OUVERTS.md) -- même patron que les regex
 *  ci-dessus. Signature lexicale ÉTROITE (délibérément) : "exactement" à
 *  proximité de "faute(s) technique(s)" -- seule la phrasing vue dans le
 *  corpus réel ("Orlando reçoit EXACTEMENT 2 fautes techniques", "il y
 *  aura EXACTEMENT 2 fautes techniques dans le match"). NE MATCHE PAS "au
 *  moins une faute technique" (cas JOUEUR, ex. "Jokic reçoit au moins une
 *  faute technique") -- ce cas reste dans structureBet.ts/bet_subject=
 *  PLAYER (stat="tech"), volontairement PAS routé ici : distinction
 *  SÉMANTIQUE (joueur nommé vs comptage équipe/match) que ce mot-clé étroit
 *  suffit à séparer sans ambiguïté sur les exemples réels connus -- un
 *  texte qui compte des fautes techniques équipe/match SANS "exactement"
 *  échappe à ce filtre et retombe sur structureBet.ts -> calculable=false
 *  -> file de validation manuelle, même filet de sécurité que tout autre
 *  cas non couvert. */
const TECHNICAL_FOULS_COUNT_KEYWORD_REGEX = /(?:fautes? techniques?[^.!?]{0,30}exactement|exactement[^.!?]{0,30}fautes? techniques?)/i;

/** Détecte un texte "de forme" "dernier panier du match" AVANT tout appel
 *  Claude (étape 6 du plan de reprise post-audit, 25/08/2026,
 *  GAPS_OUVERTS.md, chantier "événements granulaires") -- même patron que
 *  les regex ci-dessus. Signature lexicale étroite ("dernier panier"),
 *  aucun chevauchement connu avec les autres regex de ce fichier (aucune ne
 *  contient "panier"). */
const LAST_BASKET_KEYWORD_REGEX = /dernier\s+panier/i;

/** Détecte un texte "de forme" "contre sur un joueur précis" AVANT tout
 *  appel Claude (étape 6, GAPS_OUVERTS.md) -- même patron que les regex
 *  ci-dessus. Signature lexicale étroite ("contre(s) sur") : ne matche PAS
 *  "Wembanyama réalise plus de 3 contres" (bet_subject=PLAYER, stat=blk) ni
 *  "Aaron Gordon réalise plus de contres que Rudy Gobert" (COMPARISON,
 *  aucun "sur" adjacent à "contre(s)") -- vérifié sans collision avec
 *  ROSTER_COUNT_KEYWORD_REGEX ci-dessus (exige littéralement "joueurs",
 *  jamais présent dans "au moins 1 contre sur Chet Holmgren"). */
const BLOCK_ON_PLAYER_KEYWORD_REGEX = /\bcontres?\s+sur\b/i;

/** Détecte un texte "de forme" combo AVEC un OU imbriqué AVANT tout appel
 *  Claude (étape 7 du plan de reprise post-audit, 25/08/2026,
 *  GAPS_OUVERTS.md, "OU imbriqué dans un ET") -- même patron que les regex
 *  ci-dessus, MÊME raison que PERIOD (schéma combo_bet partagé déjà au
 *  plafond -- vérifié à nouveau en essayant d'ajouter `or` directement
 *  dedans, "compiled grammar too large" reproduit sur TOUS les paris).
 *  Signature lexicale : "et" ET "ou" présents tous les deux dans la même
 *  phrase (peu importe l'ordre) -- signature du SEUL exemple réel du
 *  corpus ("triple-double avec au moins 40 points et au moins 20 rebonds
 *  ou passes"), vérifié sans collision sur le reste du corpus
 *  (types_de_paris_playoffs_2026.md, aucune autre phrase ne combine les
 *  2) : le combo simple ("Cunningham marque plus de 25 points et réalise
 *  plus de 5 passes") n'a jamais de "ou", et le cas OR de COMPARISON
 *  ("Hauser ou Pritchard...") n'a jamais de "et". Un combo avec OU
 *  imbriqué formulé assez différemment pour échapper à ce filtre retombe
 *  sur le schéma combo simple -> rejet propre (OU pas capturé) ->
 *  validation manuelle, même filet de sécurité que tout autre cas non
 *  couvert. */
const COMBO_NESTED_OR_KEYWORD_REGEX = /\bet\b[^.!?]*\bou\b|\bou\b[^.!?]*\bet\b/i;

export type BetRoutingDecision =
  | "PERIOD"
  | "ROSTER_COUNT"
  | "ROSTER_SPLIT"
  | "SUPERLATIVE"
  | "TECHNICAL_FOULS_COUNT"
  | "LAST_BASKET"
  | "BLOCK_ON_PLAYER"
  | "COMBO_NESTED_OR"
  | "GENERAL";

/** Décision de routage par mot-clé, extraite de structureAndScoreBet() pour
 *  être testable directement (Cadrage/Suivi/BILAN_GLOBAL_01_09_2026.md,
 *  chantier fiabilité & QA, 01/09/2026) -- zéro changement de comportement,
 *  structureAndScoreBet() appelle désormais CETTE fonction au lieu de
 *  réévaluer les 8 `if` en ligne. L'ORDRE est significatif (documenté
 *  regex par regex plus haut, ex. ROSTER_COUNT avant ROSTER_SPLIT pour la
 *  collision "titulaires"+"chacun") -- premier match gagne, jamais deux
 *  routes à la fois. "GENERAL" = aucun mot-clé reconnu, retombe sur
 *  structureBet() (schéma partagé, PLAYER/TEAM_STAT/MATCH_TOTAL/
 *  COMPARISON/COMBO simple). */
export function routeBetDescription(description: string): BetRoutingDecision {
  if (PERIOD_KEYWORD_REGEX.test(description)) return "PERIOD";
  if (ROSTER_COUNT_KEYWORD_REGEX.test(description)) return "ROSTER_COUNT";
  if (ROSTER_SPLIT_KEYWORD_REGEX.test(description)) return "ROSTER_SPLIT";
  if (SUPERLATIVE_KEYWORD_REGEX.test(description)) return "SUPERLATIVE";
  if (TECHNICAL_FOULS_COUNT_KEYWORD_REGEX.test(description)) return "TECHNICAL_FOULS_COUNT";
  if (LAST_BASKET_KEYWORD_REGEX.test(description)) return "LAST_BASKET";
  if (BLOCK_ON_PLAYER_KEYWORD_REGEX.test(description)) return "BLOCK_ON_PLAYER";
  if (COMBO_NESTED_OR_KEYWORD_REGEX.test(description)) return "COMBO_NESTED_OR";
  return "GENERAL";
}

/** Equipe avec l'avantage du terrain sur la serie (recoit aux matchs
 *  1/2/5/7, convention series_probability.py) -- deduite du match 1 REEL de
 *  la serie (game_number = 1, pas un "seed" explicite, cf. GAPS_OUVERTS.md
 *  piece (d)). null si ce match n'existe pas encore en base (serie pas
 *  encore programmee) -- le pari serie reste alors non-calculable, meme
 *  repli que le reste de ce fichier. */
async function resolveSeriesHomeCourtTeam(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  seriesId: string,
): Promise<{ homeTeamName: string; awayTeamName: string } | null> {
  const { data: game1 } = await supabase
    .from("matches")
    .select("home_team_id, away_team_id")
    .eq("series_id", seriesId)
    .eq("game_number", 1)
    .maybeSingle<{ home_team_id: string | null; away_team_id: string | null }>();
  if (!game1?.home_team_id || !game1?.away_team_id) return null;

  const { data: teams } = await supabase.from("teams").select("id, name").in("id", [game1.home_team_id, game1.away_team_id]);
  const nameById = new Map((teams ?? []).map((t) => [t.id as string, t.name as string]));
  const homeTeamName = nameById.get(game1.home_team_id);
  const awayTeamName = nameById.get(game1.away_team_id);
  return homeTeamName && awayTeamName ? { homeTeamName, awayTeamName } : null;
}

/** Equipe domicile/exterieure REELLES pour un match precis
 *  (matches.home_team_id/away_team_id, deja synchronisees) -- utilise pour
 *  un pari MATCH_TOTAL (piece (a), GAPS_OUVERTS.md) : pas besoin de
 *  player_team ici, juste les 2 vraies equipes du match vise + sa date
 *  reelle (contexte "au moment de CE match", pas "aujourd'hui" comme pour
 *  un pari serie -- un match precis a une vraie date connue). Distinct de
 *  resolveMatchTeamNames() (team1/team2 de la SERIE, ordre arbitraire, sert
 *  seulement au contexte du prompt IA pour verifier un JOUEUR). */
async function resolveMatchTeams(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  matchId: string,
): Promise<
  { homeTeamId: string; awayTeamId: string; homeTeamName: string; awayTeamName: string; scheduledAt: string } | null
> {
  const { data: match } = await supabase
    .from("matches")
    .select("home_team_id, away_team_id, scheduled_at")
    .eq("id", matchId)
    .maybeSingle<{ home_team_id: string | null; away_team_id: string | null; scheduled_at: string | null }>();
  if (!match?.home_team_id || !match?.away_team_id || !match?.scheduled_at) return null;

  const { data: teams } = await supabase.from("teams").select("id, name").in("id", [match.home_team_id, match.away_team_id]);
  const nameById = new Map((teams ?? []).map((t) => [t.id as string, t.name as string]));
  const homeTeamName = nameById.get(match.home_team_id);
  const awayTeamName = nameById.get(match.away_team_id);
  return homeTeamName && awayTeamName
    ? {
        homeTeamId: match.home_team_id,
        awayTeamId: match.away_team_id,
        homeTeamName,
        awayTeamName,
        scheduledAt: match.scheduled_at,
      }
    : null;
}

export async function structureAndScoreBet(
  betId: string,
  description: string,
  seriesId: string,
  scope: "MATCH" | "SERIES" = "MATCH",
  matchId: string | null = null,
): Promise<void> {
  const supabase = await getServerClient();

  /** Écrit is_calculable=false explicitement (jamais laissé NULL) -- bug
   *  réel trouvé le 21/08/2026 : le code s'arrêtait sans rien écrire dès
   *  que l'IA répondait "non calculable", rendant indistinguable "l'IA a
   *  tranché non" de "l'IA n'a jamais tourné" (panne, clé absente...).
   *  Fonctionnellement inoffensif (is_calculable ?? false partout en
   *  lecture) mais rendait tout diagnostic impossible. */
  async function markNotCalculable(): Promise<void> {
    try {
      await supabase.rpc("update_bet_structuration", {
        p_bet_id: betId,
        p_structured_player_name: null,
        p_structured_player_id: null,
        p_structured_team_id: null,
        p_structured_duel: null,
        p_structured_combo: null,
        p_structured_period: null,
        p_structured_roster_split: null,
        p_structured_roster_count: null,
        p_structured_superlative: null,
        p_structured_technical_fouls_count: null,
        p_structured_last_basket: null,
        p_structured_block_on_player: null,
        p_structured_negation: false,
        p_stat: null,
        p_threshold: null,
        p_comparison: null,
        p_is_calculable: false,
        p_calculated_proba: null,
        p_suggested_difficulty: null,
      });
    } catch {
      // Best-effort, comme le reste de cette fonction.
    }
  }

  /** Même effet que markNotCalculable() (is_calculable=false, reste dans
   *  la file de validation admin pour validation ET résolution manuelles)
   *  SAUF que calculated_proba/suggested_difficulty portent une estimation
   *  -- taux de base HISTORIQUE (periodStatCodes.ts::
   *  GENERIC_LEADS_PERIOD_RESULT_RATES), pas un calcul par match. Ajouté
   *  le 06/09/2026 (GAPS_OUVERTS.md, "formulation période sans le mot
   *  'temps'") pour "mène après un quart hors mi-temps puis résultat" --
   *  aucun modèle dédié pour ces périodes (le seul modèle,
   *  period_leads_half_result.joblib, est entraîné DIRECTEMENT sur la
   *  mi-temps, pas généralisable sans nouvel entraînement). Usage
   *  INFORMATIF SEULEMENT (aide l'admin à fixer un barème cohérent) --
   *  JAMAIS auto-validé/auto-résolu sur cette estimation, jugée trop
   *  grossière pour ça. Nécessite la branche `else` de
   *  update_bet_structuration étendue (migration 20260906110000). */
  async function markNotCalculableWithEstimate(proba: number): Promise<void> {
    try {
      await supabase.rpc("update_bet_structuration", {
        p_bet_id: betId,
        p_structured_player_name: null,
        p_structured_player_id: null,
        p_structured_team_id: null,
        p_structured_duel: null,
        p_structured_combo: null,
        p_structured_period: null,
        p_structured_roster_split: null,
        p_structured_roster_count: null,
        p_structured_superlative: null,
        p_structured_technical_fouls_count: null,
        p_structured_last_basket: null,
        p_structured_block_on_player: null,
        p_structured_negation: false,
        p_stat: null,
        p_threshold: null,
        p_comparison: null,
        p_is_calculable: false,
        p_calculated_proba: proba,
        p_suggested_difficulty: probaToDifficulty(proba),
      });
    } catch {
      // Best-effort, comme le reste de cette fonction.
    }
  }

  /** Pari PERIOD (24/08/2026, GAPS_OUVERTS.md, chantier "pari période") --
   *  porte sur un quart-temps/mi-temps précis. 2 formes distinguées par
   *  periodBet.player : ÉQUIPE (vainqueur de période, écart, total,
   *  scénario mi-temps/résultat) ou JOUEUR (une stat normale limitée à
   *  cette période). MATCH uniquement, même limite que les autres branches.
   *  Appelée UNIQUEMENT quand PERIOD_KEYWORD_REGEX matche (cf. try
   *  ci-dessous) -- structuration vient de structurePeriodBet(), un schéma
   *  séparé de structureBet.ts (voir sa docstring pour le pourquoi). */
  async function handlePeriodBet(teamNames: [string, string] | null, rosters: KnownRosters | null): Promise<void> {
    const structuration = await structurePeriodBet(description, teamNames, undefined, rosters);
    if (!structuration || !structuration.calculable || structuration.bet_subject !== "PERIOD") {
      await markNotCalculable();
      return;
    }
    const periodBet = structuration.period_bet;
    if (scope !== "MATCH" || !matchId || !periodBet) {
      await markNotCalculable();
      return;
    }
    const matchTeams = await resolveMatchTeams(supabase, matchId);
    if (!matchTeams) {
      await markNotCalculable();
      return;
    }
    const asOfDate = matchTeams.scheduledAt.slice(0, 10);

    // Forme JOUEUR : player rempli -- même garde comparison/threshold que
    // bet_subject=PLAYER classique (dd/td exceptés via NO_THRESHOLD_STATS).
    if (periodBet.player) {
      if (!periodBet.period || !periodBet.player_stat) {
        await markNotCalculable();
        return;
      }
      const stat = periodBet.player_stat as StatCode;
      if (!NO_THRESHOLD_STATS.has(stat) && (periodBet.threshold === null || !periodBet.comparison)) {
        await markNotCalculable();
        return;
      }
      const prediction = await predictPlayerPeriodStat(
        periodBet.player,
        stat,
        periodBet.period as PeriodCode,
        periodBet.threshold,
        periodBet.comparison,
        matchTeams.homeTeamName,
        matchTeams.awayTeamName,
        asOfDate,
      );
      if (!prediction) {
        await markNotCalculable();
        return;
      }
      await supabase.rpc("update_bet_structuration", {
        p_bet_id: betId,
        p_structured_player_name: periodBet.player,
        p_structured_player_id: prediction.playerId,
        p_structured_team_id: null,
        p_structured_duel: null,
        p_structured_combo: null,
        p_structured_period: {
          period: periodBet.period,
          outcome_kind: null,
          team_id: null,
          player_id: prediction.playerId,
          exact_count: null,
        },
        p_structured_roster_split: null,
        p_structured_roster_count: null,
        p_structured_superlative: null,
        p_structured_technical_fouls_count: null,
        p_structured_last_basket: null,
        p_structured_block_on_player: null,
        p_structured_negation: false,
        p_stat: periodBet.player_stat,
        p_threshold: periodBet.threshold,
        p_comparison: periodBet.comparison,
        p_is_calculable: true,
        p_calculated_proba: prediction.proba,
        p_suggested_difficulty: probaToDifficulty(prediction.proba),
        p_category: "PERIOD" satisfies BetCategory,
      });
      return;
    }

    // Forme ÉQUIPE. outcome_kind requis ; period requis SAUF pour
    // QUARTERS_WON_COUNT (porte sur le match entier).
    const outcomeKind = periodBet.outcome_kind as PeriodOutcomeKind | null;
    if (!outcomeKind || (outcomeKind !== "QUARTERS_WON_COUNT" && !periodBet.period)) {
      await markNotCalculable();
      return;
    }

    let equipeVisee: "domicile" | "exterieur" | null = null;
    let teamId: string | null = null;
    if (TEAM_TARGETED_PERIOD_OUTCOMES.has(outcomeKind)) {
      const teamName = periodBet.team === "team1" ? teamNames?.[0] : periodBet.team === "team2" ? teamNames?.[1] : null;
      if (!teamName || (teamName !== matchTeams.homeTeamName && teamName !== matchTeams.awayTeamName)) {
        await markNotCalculable();
        return;
      }
      equipeVisee = teamName === matchTeams.homeTeamName ? "domicile" : "exterieur";
      teamId = teamName === matchTeams.homeTeamName ? matchTeams.homeTeamId : matchTeams.awayTeamId;
    }

    // Bug réel trouvé en testant en conditions réelles (24/08/2026) :
    // LEADS_HALF_RESULT n'est PAS dans NO_THRESHOLD_PERIOD_OUTCOMES (il a
    // bien un `comparison` -- OVER/UNDER encode mène-et-gagne vs mène-et-
    // perd) mais n'a PAS de `threshold` numérique non plus (toujours null,
    // cf. periodStatCodes.ts) -- un pari "Cleveland mène à la mi-temps et
    // gagne le match" (correctement classifié par Claude, threshold=null/
    // comparison="OVER") tombait donc à tort sur markNotCalculable() ici.
    // 3 catégories, pas 2 : QUARTER_WINNER/HALF_WINNER (ni l'un ni l'autre),
    // LEADS_HALF_RESULT (comparison seul), le reste (les deux).
    const needsComparison = !NO_THRESHOLD_PERIOD_OUTCOMES.has(outcomeKind);
    const needsThreshold = needsComparison && outcomeKind !== "LEADS_HALF_RESULT";
    if ((needsComparison && !periodBet.comparison) || (needsThreshold && periodBet.threshold === null)) {
      await markNotCalculable();
      return;
    }

    // "mène après un quart hors mi-temps puis résultat" (06/09/2026,
    // GAPS_OUVERTS.md) -- period_leads_half_result.joblib est entraîné
    // DIRECTEMENT sur la mi-temps (H1/Q2), jamais généralisable à Q1/Q3/Q4/
    // H2 sans le réentraîner : l'appeler tel quel pour period=Q3 donnerait
    // une proba fausse (le modèle ignore period, hardcodé sur H1 des 2
    // côtés TS/Python). Repli sur un taux de base historique, informatif
    // seulement -- voir markNotCalculableWithEstimate().
    if (outcomeKind === "LEADS_HALF_RESULT" && periodBet.period !== "H1" && periodBet.period !== "Q2") {
      const estimate = estimateLeadsPeriodResultProba(periodBet.period as PeriodCode, periodBet.comparison as "OVER" | "UNDER");
      if (estimate !== null) {
        await markNotCalculableWithEstimate(estimate);
      } else {
        await markNotCalculable();
      }
      return;
    }

    const prediction = await predictPeriodTeamOutcome(
      outcomeKind,
      (periodBet.period as PeriodCode | null) ?? null,
      equipeVisee,
      periodBet.exact_count,
      periodBet.threshold,
      periodBet.comparison,
      matchTeams.homeTeamName,
      matchTeams.awayTeamName,
      asOfDate,
    );
    if (!prediction) {
      await markNotCalculable();
      return;
    }

    await supabase.rpc("update_bet_structuration", {
      p_bet_id: betId,
      p_structured_player_name: null,
      p_structured_player_id: null,
      p_structured_team_id: teamId,
      p_structured_duel: null,
      p_structured_combo: null,
      p_structured_period: {
        period: periodBet.period,
        outcome_kind: outcomeKind,
        team_id: teamId,
        player_id: null,
        exact_count: periodBet.exact_count,
      },
      p_structured_roster_split: null,
      p_structured_roster_count: null,
      p_structured_superlative: null,
      p_structured_technical_fouls_count: null,
      p_structured_last_basket: null,
      p_structured_block_on_player: null,
      p_structured_negation: false,
      p_stat: null,
      p_threshold: periodBet.threshold,
      p_comparison: periodBet.comparison,
      p_is_calculable: true,
      p_calculated_proba: prediction.proba,
      p_suggested_difficulty: probaToDifficulty(prediction.proba),
      p_category: "PERIOD" satisfies BetCategory,
    });
  }

  /** Pari "5 majeur / banc" (24/08/2026, GAPS_OUVERTS.md, chantier "5
   *  majeur/banc") -- kind=STARTERS_SUM/BENCH_SUM/STARTERS_SHARE, cf.
   *  structureRosterSplitBet.ts. MATCH uniquement, même limite que les
   *  autres branches. Appelée UNIQUEMENT quand ROSTER_SPLIT_KEYWORD_REGEX
   *  matche (cf. try ci-dessous) -- structuration vient de
   *  structureRosterSplitBet(), un schéma séparé de structureBet.ts (voir
   *  sa docstring pour le pourquoi). */
  async function handleRosterSplitBet(teamNames: [string, string] | null): Promise<void> {
    const structuration = await structureRosterSplitBet(description, teamNames);
    if (!structuration || !structuration.calculable || structuration.bet_subject !== "ROSTER_SPLIT") {
      await markNotCalculable();
      return;
    }
    const rosterSplitBet = structuration.roster_split_bet;
    if (scope !== "MATCH" || !matchId || !rosterSplitBet) {
      await markNotCalculable();
      return;
    }
    const matchTeams = await resolveMatchTeams(supabase, matchId);
    if (!matchTeams) {
      await markNotCalculable();
      return;
    }
    const asOfDate = matchTeams.scheduledAt.slice(0, 10);

    const teamName = rosterSplitBet.team === "team1" ? teamNames?.[0] : teamNames?.[1];
    if (!teamName || (teamName !== matchTeams.homeTeamName && teamName !== matchTeams.awayTeamName)) {
      await markNotCalculable();
      return;
    }
    const equipeVisee: "domicile" | "exterieur" = teamName === matchTeams.homeTeamName ? "domicile" : "exterieur";
    const teamId = teamName === matchTeams.homeTeamName ? matchTeams.homeTeamId : matchTeams.awayTeamId;

    const prediction = await predictRosterSplit(
      rosterSplitBet.kind,
      rosterSplitBet.stat as StatCode,
      equipeVisee,
      rosterSplitBet.threshold,
      rosterSplitBet.comparison,
      matchTeams.homeTeamName,
      matchTeams.awayTeamName,
      asOfDate,
    );
    if (!prediction) {
      await markNotCalculable();
      return;
    }

    await supabase.rpc("update_bet_structuration", {
      p_bet_id: betId,
      p_structured_player_name: null,
      p_structured_player_id: null,
      p_structured_team_id: teamId,
      p_structured_duel: null,
      p_structured_combo: null,
      p_structured_period: null,
      p_structured_roster_split: {
        kind: rosterSplitBet.kind,
        team_id: teamId,
        stat: rosterSplitBet.stat,
      },
      p_structured_roster_count: null,
      p_structured_superlative: null,
      p_structured_technical_fouls_count: null,
      p_structured_last_basket: null,
      p_structured_block_on_player: null,
      p_structured_negation: false,
      p_stat: rosterSplitBet.stat,
      p_threshold: rosterSplitBet.threshold,
      p_comparison: rosterSplitBet.comparison,
      p_is_calculable: true,
      p_calculated_proba: prediction.proba,
      p_suggested_difficulty: probaToDifficulty(prediction.proba),
      p_category: "TEAM_PROP" satisfies BetCategory,
    });
  }

  /** Pari "comptage roster-wide" (étape 3 du plan de reprise post-audit,
   *  25/08/2026, GAPS_OUVERTS.md) -- "au moins N joueurs remplissent une
   *  condition", cf. structureRosterCountBet.ts. MATCH uniquement, même
   *  limite que les autres branches. Appelée UNIQUEMENT quand
   *  ROSTER_COUNT_KEYWORD_REGEX matche (cf. try ci-dessous, testé AVANT
   *  ROSTER_SPLIT_KEYWORD_REGEX -- voir sa docstring pour le pourquoi). */
  async function handleRosterCountBet(teamNames: [string, string] | null): Promise<void> {
    const structuration = await structureRosterCountBet(description, teamNames);
    if (!structuration || !structuration.calculable || structuration.bet_subject !== "ROSTER_COUNT") {
      await markNotCalculable();
      return;
    }
    const rosterCountBet = structuration.roster_count_bet;
    if (scope !== "MATCH" || !matchId || !rosterCountBet) {
      await markNotCalculable();
      return;
    }
    const matchTeams = await resolveMatchTeams(supabase, matchId);
    if (!matchTeams) {
      await markNotCalculable();
      return;
    }
    const asOfDate = matchTeams.scheduledAt.slice(0, 10);

    const stat = rosterCountBet.stat as StatCode;
    if (!NO_THRESHOLD_STATS.has(stat) && (rosterCountBet.stat_threshold === null || !rosterCountBet.stat_comparison)) {
      await markNotCalculable();
      return;
    }

    // scope=MATCH -> "MATCH" (les 2 équipes, cas de LOIN le plus fréquent) ;
    // team1/team2 -> résolu en "domicile"/"exterieur" depuis les VRAIES
    // équipes du match visé (même geste que resolveSide() dans les branches
    // COMPARISON/COMBO plus bas).
    let resolvedScope: "MATCH" | "domicile" | "exterieur";
    if (rosterCountBet.scope === "MATCH") {
      resolvedScope = "MATCH";
    } else {
      const teamName = rosterCountBet.scope === "team1" ? teamNames?.[0] : teamNames?.[1];
      if (!teamName || (teamName !== matchTeams.homeTeamName && teamName !== matchTeams.awayTeamName)) {
        await markNotCalculable();
        return;
      }
      resolvedScope = teamName === matchTeams.homeTeamName ? "domicile" : "exterieur";
    }

    const prediction = await predictRosterCount(
      resolvedScope,
      rosterCountBet.pool,
      stat,
      rosterCountBet.stat_threshold,
      rosterCountBet.stat_comparison,
      rosterCountBet.min_players,
      rosterCountBet.count_relation,
      matchTeams.homeTeamName,
      matchTeams.awayTeamName,
      asOfDate,
    );
    if (!prediction) {
      await markNotCalculable();
      return;
    }

    // Catégorie déduite de la stat CONDITION (même geste que went_to_ot ->
    // GAME_EVENT plus bas) : min = rotation/temps de jeu (nombre de joueurs
    // utilisés, DNP), dd/td = événement de match (triple-double n'importe
    // qui), le reste = combo multi-joueurs (comptage à seuil, ex. "8
    // joueurs marquent 11+").
    const category: BetCategory =
      stat === "min" ? "PLAYING_TIME" : stat === "dd" || stat === "td" ? "GAME_EVENT" : "MULTI_PLAYER_COMBO";

    await supabase.rpc("update_bet_structuration", {
      p_bet_id: betId,
      p_structured_player_name: null,
      p_structured_player_id: null,
      p_structured_team_id: null,
      p_structured_duel: null,
      p_structured_combo: null,
      p_structured_period: null,
      p_structured_roster_split: null,
      p_structured_roster_count: {
        scope: rosterCountBet.scope,
        pool: rosterCountBet.pool,
        count_relation: rosterCountBet.count_relation,
        min_players: rosterCountBet.min_players,
        player_ids: prediction.playerIds,
      },
      p_structured_superlative: null,
      p_structured_technical_fouls_count: null,
      p_structured_last_basket: null,
      p_structured_block_on_player: null,
      p_structured_negation: false,
      p_stat: rosterCountBet.stat,
      p_threshold: rosterCountBet.stat_threshold,
      p_comparison: rosterCountBet.stat_comparison,
      p_is_calculable: true,
      p_calculated_proba: prediction.proba,
      p_suggested_difficulty: probaToDifficulty(prediction.proba),
      p_category: category,
    });
  }

  /** Pari "meilleur marqueur" / superlatif implicite (étape 4 du plan de
   *  reprise post-audit, 25/08/2026, GAPS_OUVERTS.md) -- cf.
   *  structureSuperlativeBet.ts. MATCH uniquement, même limite que les
   *  autres branches. Appelée UNIQUEMENT quand SUPERLATIVE_KEYWORD_REGEX
   *  matche (cf. try ci-dessous). */
  async function handleSuperlativeBet(teamNames: [string, string] | null): Promise<void> {
    const structuration = await structureSuperlativeBet(description, teamNames);
    if (!structuration || !structuration.calculable || structuration.bet_subject !== "SUPERLATIVE") {
      await markNotCalculable();
      return;
    }
    const superlativeBet = structuration.superlative_bet;
    if (scope !== "MATCH" || !matchId || !superlativeBet) {
      await markNotCalculable();
      return;
    }
    const matchTeams = await resolveMatchTeams(supabase, matchId);
    if (!matchTeams) {
      await markNotCalculable();
      return;
    }
    const asOfDate = matchTeams.scheduledAt.slice(0, 10);

    const prediction = await predictSuperlative(
      superlativeBet.player,
      superlativeBet.stat as StatCode,
      matchTeams.homeTeamName,
      matchTeams.awayTeamName,
      asOfDate,
    );
    if (!prediction) {
      await markNotCalculable();
      return;
    }

    await supabase.rpc("update_bet_structuration", {
      p_bet_id: betId,
      p_structured_player_name: superlativeBet.player,
      p_structured_player_id: prediction.playerId,
      p_structured_team_id: null,
      p_structured_duel: null,
      p_structured_combo: null,
      p_structured_period: null,
      p_structured_roster_split: null,
      p_structured_roster_count: null,
      p_structured_superlative: { stat: superlativeBet.stat },
      p_structured_technical_fouls_count: null,
      p_structured_last_basket: null,
      p_structured_block_on_player: null,
      p_structured_negation: false,
      p_stat: superlativeBet.stat,
      // threshold/comparison volontairement null -- probabilité DIRECTE
      // (même principe que dd/td), et surtout ça empêche
      // resolveCalculableBets() (le résolveur PLAYER de base, qui ne
      // filtre QUE sur structured_player_id non-null) de trancher ce pari
      // à tort avec la mauvaise formule -- voir la migration
      // 20260825140000 pour le détail de ce choix.
      p_threshold: null,
      p_comparison: null,
      p_is_calculable: true,
      p_calculated_proba: prediction.proba,
      p_suggested_difficulty: probaToDifficulty(prediction.proba),
      p_category: "PLAYER_PROP" satisfies BetCategory,
    });
  }

  /** Pari "fautes techniques équipe/match" (étape 5 du plan de reprise
   *  post-audit, 25/08/2026, GAPS_OUVERTS.md) -- cf.
   *  structureTechnicalFoulsCountBet.ts. MATCH uniquement, même limite que
   *  les autres branches. Appelée UNIQUEMENT quand
   *  TECHNICAL_FOULS_COUNT_KEYWORD_REGEX matche (cf. try ci-dessous). */
  async function handleTechnicalFoulsCountBet(teamNames: [string, string] | null): Promise<void> {
    const structuration = await structureTechnicalFoulsCountBet(description, teamNames);
    if (!structuration || !structuration.calculable || structuration.bet_subject !== "TECHNICAL_FOULS_COUNT") {
      await markNotCalculable();
      return;
    }
    const countBet = structuration.technical_fouls_count_bet;
    if (scope !== "MATCH" || !matchId || !countBet) {
      await markNotCalculable();
      return;
    }
    const matchTeams = await resolveMatchTeams(supabase, matchId);
    if (!matchTeams) {
      await markNotCalculable();
      return;
    }
    const asOfDate = matchTeams.scheduledAt.slice(0, 10);

    let resolvedScope: "MATCH" | "domicile" | "exterieur";
    let teamId: string | null = null;
    if (countBet.scope === "MATCH") {
      resolvedScope = "MATCH";
    } else {
      const teamName = countBet.scope === "team1" ? teamNames?.[0] : teamNames?.[1];
      if (!teamName || (teamName !== matchTeams.homeTeamName && teamName !== matchTeams.awayTeamName)) {
        await markNotCalculable();
        return;
      }
      resolvedScope = teamName === matchTeams.homeTeamName ? "domicile" : "exterieur";
      teamId = teamName === matchTeams.homeTeamName ? matchTeams.homeTeamId : matchTeams.awayTeamId;
    }

    const prediction = await predictTechnicalFoulsCount(
      resolvedScope,
      countBet.count_threshold,
      countBet.count_relation,
      matchTeams.homeTeamName,
      matchTeams.awayTeamName,
      asOfDate,
    );
    if (!prediction) {
      await markNotCalculable();
      return;
    }

    await supabase.rpc("update_bet_structuration", {
      p_bet_id: betId,
      p_structured_player_name: null,
      p_structured_player_id: null,
      p_structured_team_id: teamId,
      p_structured_duel: null,
      p_structured_combo: null,
      p_structured_period: null,
      p_structured_roster_split: null,
      p_structured_roster_count: null,
      p_structured_superlative: null,
      p_structured_technical_fouls_count: { scope: countBet.scope, count_relation: countBet.count_relation },
      p_structured_last_basket: null,
      p_structured_block_on_player: null,
      p_structured_negation: false,
      p_stat: null,
      p_threshold: countBet.count_threshold,
      p_comparison: null,
      p_is_calculable: true,
      p_calculated_proba: prediction.proba,
      p_suggested_difficulty: probaToDifficulty(prediction.proba),
      p_category: "GAME_EVENT" satisfies BetCategory,
    });
  }

  /** Pari "dernier panier du match" (étape 6 du plan de reprise post-audit,
   *  25/08/2026, GAPS_OUVERTS.md) -- cf. structureLastBasketBet.ts. MATCH
   *  uniquement, même limite que les autres branches. Appelée UNIQUEMENT
   *  quand LAST_BASKET_KEYWORD_REGEX matche (cf. try ci-dessous). */
  async function handleLastBasketBet(teamNames: [string, string] | null): Promise<void> {
    const structuration = await structureLastBasketBet(description, teamNames);
    if (!structuration || !structuration.calculable || structuration.bet_subject !== "LAST_BASKET" || !structuration.player) {
      await markNotCalculable();
      return;
    }
    if (scope !== "MATCH" || !matchId) {
      await markNotCalculable();
      return;
    }
    const matchTeams = await resolveMatchTeams(supabase, matchId);
    if (!matchTeams) {
      await markNotCalculable();
      return;
    }
    const asOfDate = matchTeams.scheduledAt.slice(0, 10);

    const prediction = await predictLastBasket(structuration.player, matchTeams.homeTeamName, matchTeams.awayTeamName, asOfDate);
    if (!prediction) {
      await markNotCalculable();
      return;
    }

    await supabase.rpc("update_bet_structuration", {
      p_bet_id: betId,
      p_structured_player_name: structuration.player,
      p_structured_player_id: prediction.playerId,
      p_structured_team_id: null,
      p_structured_duel: null,
      p_structured_combo: null,
      p_structured_period: null,
      p_structured_roster_split: null,
      p_structured_roster_count: null,
      p_structured_superlative: null,
      p_structured_technical_fouls_count: null,
      p_structured_last_basket: true,
      p_structured_block_on_player: null,
      p_structured_negation: false,
      p_stat: null,
      // threshold/comparison volontairement null -- probabilité DIRECTE,
      // même garde que SUPERLATIVE (empêche resolveCalculableBets(), le
      // résolveur PLAYER de base, de trancher ce pari à tort).
      p_threshold: null,
      p_comparison: null,
      p_is_calculable: true,
      p_calculated_proba: prediction.proba,
      p_suggested_difficulty: probaToDifficulty(prediction.proba),
      p_category: "GAME_EVENT" satisfies BetCategory,
    });
  }

  /** Pari "contre sur un joueur précis" (étape 6, GAPS_OUVERTS.md) -- cf.
   *  structureBlockOnPlayerBet.ts. MATCH uniquement, même limite que les
   *  autres branches. Appelée UNIQUEMENT quand BLOCK_ON_PLAYER_KEYWORD_REGEX
   *  matche (cf. try ci-dessous). */
  async function handleBlockOnPlayerBet(teamNames: [string, string] | null): Promise<void> {
    const structuration = await structureBlockOnPlayerBet(description, teamNames);
    if (
      !structuration ||
      !structuration.calculable ||
      structuration.bet_subject !== "BLOCK_ON_PLAYER" ||
      !structuration.blocker ||
      !structuration.victim
    ) {
      await markNotCalculable();
      return;
    }
    if (scope !== "MATCH" || !matchId) {
      await markNotCalculable();
      return;
    }
    const matchTeams = await resolveMatchTeams(supabase, matchId);
    if (!matchTeams) {
      await markNotCalculable();
      return;
    }
    const asOfDate = matchTeams.scheduledAt.slice(0, 10);

    const prediction = await predictBlockOnPlayer(
      structuration.blocker,
      structuration.victim,
      matchTeams.homeTeamName,
      matchTeams.awayTeamName,
      asOfDate,
    );
    if (!prediction) {
      await markNotCalculable();
      return;
    }

    await supabase.rpc("update_bet_structuration", {
      p_bet_id: betId,
      // Pas de joueur "principal" unique pour ce bet_subject (2 joueurs
      // distincts, ni l'un ni l'autre "LE" sujet du pari comme pour PLAYER/
      // SUPERLATIVE/LAST_BASKET) -- les 2 ids réels vivent dans
      // structured_block_on_player, structured_player_id/name restent null
      // (évite aussi tout risque que resolveCalculableBets(), le résolveur
      // PLAYER de base, ne croise ce pari -- il filtre sur
      // structured_player_id non-null).
      p_structured_player_name: null,
      p_structured_player_id: null,
      p_structured_team_id: null,
      p_structured_duel: null,
      p_structured_combo: null,
      p_structured_period: null,
      p_structured_roster_split: null,
      p_structured_roster_count: null,
      p_structured_superlative: null,
      p_structured_technical_fouls_count: null,
      p_structured_last_basket: null,
      p_structured_block_on_player: { blocker_player_id: prediction.blockerId, victim_player_id: prediction.victimId },
      p_structured_negation: false,
      p_stat: null,
      p_threshold: null,
      p_comparison: null,
      p_is_calculable: true,
      p_calculated_proba: prediction.proba,
      p_suggested_difficulty: probaToDifficulty(prediction.proba),
      p_category: "GAME_EVENT" satisfies BetCategory,
    });
  }

  /** Valide UNE condition combo brute (kind/players/stats/threshold/
   *  comparison, forme partagée par le schéma combo simple ET le schéma
   *  dédié OU imbriqué -- étape 7, GAPS_OUVERTS.md) en ComboCondition
   *  (kind/team résolus en "domicile"/"exterieur"), avec les MÊMES règles
   *  de validité que côté service (une condition "somme" -- 2+ joueurs
   *  et/ou 2+ stats -- est restreinte aux stats comptées ; une condition
   *  "simple" accepte toute STAT_CODES, y compris dd/td) -- vérifié ici
   *  aussi pour éviter un aller-retour HTTP voué à l'échec. null si
   *  invalide (appelant doit alors markNotCalculable()). Factorisée le
   *  25/08/2026 (étape 7) -- AVANT cette étape, dupliquée telle quelle
   *  dans la seule branche combo simple ; désormais partagée avec
   *  handleComboNestedBet() ci-dessous. */
  function validateComboCondition(
    c: { kind: "PLAYER" | "team1" | "team2"; players: string[]; stats: string[]; threshold: number | null; comparison: "OVER" | "UNDER" },
    teamNames: [string, string] | null,
    matchTeams: NonNullable<Awaited<ReturnType<typeof resolveMatchTeams>>>,
  ): ComboCondition | null {
    if (c.stats.length === 0) return null;
    if (c.kind === "PLAYER") {
      if (c.players.length === 0) return null;
      const isSimple = c.players.length === 1 && c.stats.length === 1;
      if (!isSimple && c.stats.some((s) => !(COMPARISON_PLAYER_STAT_CODES as string[]).includes(s))) return null;
      const noThreshold = isSimple && NO_THRESHOLD_STATS.has(c.stats[0] as StatCode);
      if (!noThreshold && c.threshold === null) return null;
      return { kind: "PLAYER", players: c.players, stats: c.stats, threshold: c.threshold, comparison: c.comparison };
    }
    const name = c.kind === "team1" ? teamNames?.[0] : teamNames?.[1];
    const side = !name ? null : name === matchTeams.homeTeamName ? "domicile" : name === matchTeams.awayTeamName ? "exterieur" : null;
    if (!side || c.threshold === null || c.stats.some((s) => !(COMPARISON_TEAM_STAT_CODES as string[]).includes(s))) return null;
    return { kind: "TEAM", team: side, stats: c.stats, threshold: c.threshold, comparison: c.comparison };
  }

  /** Appelle predictCombo() sur des GROUPES déjà validés (ComboCondition[][],
   *  1 item = condition normale, 2+ = OU imbriqué -- étape 7,
   *  GAPS_OUVERTS.md) et écrit le résultat -- partagée par la branche
   *  combo simple (schéma partagé, groupes à 1 item chacun) ET
   *  handleComboNestedBet() (schéma dédié, groupes à 1+ items) : MÊME
   *  stockage/résolution pour les deux (structured_combo.conditions =
   *  { or: [...] }[] uniformément, cf. resolveCalculableComboBets(),
   *  resolveCalculableBets.ts). */
  async function writeComboResult(
    groups: ComboCondition[][],
    rawThresholds: { threshold: number | null; comparison: "OVER" | "UNDER" }[][],
    matchTeams: NonNullable<Awaited<ReturnType<typeof resolveMatchTeams>>>,
  ): Promise<void> {
    const prediction = await predictCombo(groups, matchTeams.homeTeamName, matchTeams.awayTeamName, matchTeams.scheduledAt.slice(0, 10));
    if (!prediction || prediction.groupsMeta.length !== groups.length) {
      await markNotCalculable();
      return;
    }

    const structuredCombo = {
      conditions: prediction.groupsMeta.map((groupMeta, i) => ({
        or: groupMeta.map((meta, j) => ({
          kind: meta.kind,
          player_ids: meta.playerIds,
          team_id: groups[i][j].kind === "TEAM"
            ? (groups[i][j].team === "domicile" ? matchTeams.homeTeamId : matchTeams.awayTeamId)
            : null,
          stats: meta.stats,
          threshold: rawThresholds[i][j].threshold,
          comparison: rawThresholds[i][j].comparison,
        })),
      })),
    };

    await supabase.rpc("update_bet_structuration", {
      p_bet_id: betId,
      p_structured_player_name: null,
      p_structured_player_id: null,
      p_structured_team_id: null,
      p_structured_duel: null,
      p_structured_combo: structuredCombo,
      p_structured_period: null,
      p_structured_roster_split: null,
      p_structured_roster_count: null,
      p_structured_superlative: null,
      p_structured_technical_fouls_count: null,
      p_structured_last_basket: null,
      p_structured_block_on_player: null,
      p_structured_negation: false,
      p_stat: null,
      p_threshold: null,
      p_comparison: null,
      p_is_calculable: true,
      p_calculated_proba: prediction.proba,
      p_suggested_difficulty: probaToDifficulty(prediction.proba),
      p_category: "MULTI_PLAYER_COMBO" satisfies BetCategory,
    });
  }

  /** Pari COMBO avec OU imbriqué (étape 7 du plan de reprise post-audit,
   *  25/08/2026, GAPS_OUVERTS.md) -- cf. structureComboBet.ts. MATCH
   *  uniquement, même limite que les autres branches. Appelée UNIQUEMENT
   *  quand COMBO_NESTED_OR_KEYWORD_REGEX matche (cf. try ci-dessous) --
   *  structuration vient de structureComboNestedBet(), un schéma séparé de
   *  structureBet.ts (voir sa docstring pour le pourquoi). */
  async function handleComboNestedBet(teamNames: [string, string] | null): Promise<void> {
    const structuration = await structureComboNestedBet(description, teamNames);
    if (!structuration || !structuration.calculable || structuration.bet_subject !== "COMBO" || structuration.conditions.length === 0) {
      await markNotCalculable();
      return;
    }
    if (scope !== "MATCH" || !matchId) {
      await markNotCalculable();
      return;
    }
    const matchTeams = await resolveMatchTeams(supabase, matchId);
    if (!matchTeams) {
      await markNotCalculable();
      return;
    }

    const groups: ComboCondition[][] = [];
    const rawThresholds: { threshold: number | null; comparison: "OVER" | "UNDER" }[][] = [];
    for (const group of structuration.conditions) {
      if (group.or.length === 0) {
        await markNotCalculable();
        return;
      }
      const groupConditions: ComboCondition[] = [];
      const groupRaw: { threshold: number | null; comparison: "OVER" | "UNDER" }[] = [];
      for (const c of group.or) {
        const validated = validateComboCondition(c, teamNames, matchTeams);
        if (!validated) {
          await markNotCalculable();
          return;
        }
        groupConditions.push(validated);
        groupRaw.push({ threshold: c.threshold, comparison: c.comparison });
      }
      groups.push(groupConditions);
      rawThresholds.push(groupRaw);
    }

    await writeComboResult(groups, rawThresholds, matchTeams);
  }

  try {
    // Plafond de dépense IA (p1-8, feuille de route Phase 1) -- vérifié EN
    // PREMIER, avant tout appel Claude (les 9 structure*Bet() ci-dessous
    // partagent tous ce point d'entrée unique). Dépassé : même repli que
    // toute autre panne de cette étape, jamais bloquant pour le joueur --
    // le pari reste soumis, avec le mécanisme manuel existant comme seul
    // recours (voir markNotCalculable() plus haut).
    if ((await getTodaySpendUsd()) >= DAILY_COST_CAP_USD) {
      console.warn(`structureAndScoreBet : plafond de dépense IA quotidien atteint (${DAILY_COST_CAP_USD}$), pari ${betId} non structuré.`);
      await markNotCalculable();
      return;
    }

    const teamNames = await resolveMatchTeamNames(supabase, seriesId);
    // BUG-003 de l'audit du 03/09/2026 (GAPS_OUVERTS.md) : effectifs réels
    // injectés en complément de la connaissance générale de Claude pour
    // les 2 seuls chemins qui vérifient l'appartenance d'un joueur à une
    // équipe (structureBet.ts/PLAYER et structurePeriodBet.ts) -- les
    // autres formes (roster-count/split, superlatif, dernier panier,
    // fautes techniques, contre-sur-joueur, combo) ne font aujourd'hui
    // aucune vérification de ce type, rien à y brancher pour l'instant.
    const rosters = await resolveKnownRostersForSeries(supabase, seriesId);

    // Routage PERIOD par mot-clé (24/08/2026, GAPS_OUVERTS.md) -- PAS un 7e
    // bet_subject dans le schéma structureBet.ts : testé en conditions
    // réelles, ce schéma est déjà au plafond de complexité accepté par
    // l'API Claude ("compiled grammar is too large" -- reproduit sur TOUS
    // les paris, pas seulement PERIOD, même après avoir factorisé les enums
    // répétés). Décidé avec l'utilisateur : un texte qui RESSEMBLE à un
    // pari période (vocabulaire temporel, peu ambigu) appelle EXCLUSIVEMENT
    // structurePeriodBet() (son propre petit schéma dédié, testé OK en
    // isolation) -- jamais les deux appels, jamais de repli automatique de
    // l'un vers l'autre (ça recouplerait le coût de PERIOD à toute la
    // population -- déjà grande et croissante -- des paris non calculables
    // pour d'autres raisons, pas mesurable ni borné). Sciemment PAS
    // généralisé aux 5 autres bet_subject : leur distinction est
    // SÉMANTIQUE (comparaison vs seuil fixe vs somme de conditions), pas
    // lexicale -- un mot-clé ne peut pas les séparer de façon fiable.
    // Routage par mot-clé (24/08→25/08/2026, GAPS_OUVERTS.md) -- décision
    // extraite dans routeBetDescription() ci-dessus (testable directement,
    // même raisonnement par regex documenté à côté de chaque const). Un
    // texte qui RESSEMBLE à l'une de ces formes appelle EXCLUSIVEMENT son
    // handler dédié (schéma structureBet.ts déjà au plafond de complexité
    // API, "compiled grammar is too large" sinon) -- jamais deux appels,
    // jamais de repli automatique de l'un vers l'autre.
    const routing = routeBetDescription(description);
    if (routing === "PERIOD") {
      await handlePeriodBet(teamNames, rosters);
      return;
    }
    if (routing === "ROSTER_COUNT") {
      await handleRosterCountBet(teamNames);
      return;
    }
    if (routing === "ROSTER_SPLIT") {
      await handleRosterSplitBet(teamNames);
      return;
    }
    if (routing === "SUPERLATIVE") {
      await handleSuperlativeBet(teamNames);
      return;
    }
    if (routing === "TECHNICAL_FOULS_COUNT") {
      await handleTechnicalFoulsCountBet(teamNames);
      return;
    }
    if (routing === "LAST_BASKET") {
      await handleLastBasketBet(teamNames);
      return;
    }
    if (routing === "BLOCK_ON_PLAYER") {
      await handleBlockOnPlayerBet(teamNames);
      return;
    }
    if (routing === "COMBO_NESTED_OR") {
      await handleComboNestedBet(teamNames);
      return;
    }

    const structuration = await structureBet(description, teamNames, undefined, rosters);
    if (!structuration || !structuration.calculable || !structuration.bet_subject) {
      await markNotCalculable();
      return;
    }

    // Pari MATCH_TOTAL (pièce (a) du chantier, GAPS_OUVERTS.md) -- 1er pari
    // SANS JOUEUR : score combiné du match. MATCH uniquement pour l'instant
    // (pas SÉRIE -- décidé avec l'utilisateur, viendra dans un 2e temps).
    // Branche entièrement séparée de la suite (spécifique aux paris
    // JOUEUR) : aucun joueur à résoudre, aucune notion d'avantage du
    // terrain sur une série.
    if (structuration.bet_subject === "MATCH_TOTAL") {
      const matchTotal = structuration.match_total;
      if (scope !== "MATCH" || !matchId || !matchTotal) {
        await markNotCalculable();
        return;
      }
      const matchTeams = await resolveMatchTeams(supabase, matchId);
      if (!matchTeams) {
        await markNotCalculable();
        return;
      }
      // went_to_ot n'a ni seuil ni comparaison (probabilité directe, même
      // principe que dd/td côté joueur, ligne ~490 plus bas) -- garde
      // symétrique pour MATCH_TOTAL (24/08/2026, chantier "prolongation",
      // GAPS_OUVERTS.md).
      if (!NO_THRESHOLD_MATCH_STATS.has(matchTotal.stat as MatchStatCode) && (matchTotal.threshold === null || !matchTotal.comparison)) {
        await markNotCalculable();
        return;
      }
      // as_of_date = date RÉELLE du match visé (pas "aujourd'hui" comme pour
      // un pari série) -- un match précis a une vraie date connue, plus
      // fidèle pour le calcul de repos/contexte équipe.
      const asOfDate = matchTeams.scheduledAt.slice(0, 10);
      const prediction =
        matchTotal.stat === "went_to_ot"
          ? await predictOvertime(matchTeams.homeTeamName, matchTeams.awayTeamName, asOfDate)
          : matchTotal.stat === "had_backcourt_turnover"
            ? await predictBackcourtTurnover(matchTeams.homeTeamName, matchTeams.awayTeamName, asOfDate)
            : matchTotal.stat === "had_buzzer_beater"
              ? await predictBuzzerBeater(matchTeams.homeTeamName, matchTeams.awayTeamName, asOfDate)
              : matchTotal.stat === "total_points"
                ? await predictTotalPoints(
                    matchTeams.homeTeamName,
                    matchTeams.awayTeamName,
                    matchTotal.threshold as number,
                    matchTotal.comparison as "OVER" | "UNDER",
                    asOfDate,
                  )
                : matchTotal.stat === "total_timeouts"
                  ? await predictTotalTimeouts(
                      matchTeams.homeTeamName,
                      matchTeams.awayTeamName,
                      matchTotal.threshold as number,
                      matchTotal.comparison as "OVER" | "UNDER",
                      asOfDate,
                    )
                  : await predictTotalTeamStat(
                      matchTotal.stat.slice("total_".length) as TeamStatCode,
                      matchTeams.homeTeamName,
                      matchTeams.awayTeamName,
                      matchTotal.threshold as number,
                      matchTotal.comparison as "OVER" | "UNDER",
                      asOfDate,
                    );
      if (!prediction) {
        await markNotCalculable();
        return;
      }
      // Bug réel trouvé en testant en conditions réelles (25/08/2026,
      // GAPS_OUVERTS.md) : le pari réel du corpus "Aucun panier marqué au
      // buzzer durant le match" est une NÉGATION de had_buzzer_beater --
      // sans ceci, la proba stockée/affichée était TOUJOURS celle de
      // l'événement positif, jamais de son absence (Claude comprenait bien
      // la négation dans son reasoning, mais rien ne la capturait). Ne
      // s'applique qu'aux 3 stats SANS seuil (`negated`) -- jamais aux
      // stats à seuil, où la négation s'exprime déjà via comparison=UNDER.
      const negated = NO_THRESHOLD_MATCH_STATS.has(matchTotal.stat as MatchStatCode) && matchTotal.negation;
      const finalProba = negated ? 1 - prediction.proba : prediction.proba;
      await supabase.rpc("update_bet_structuration", {
        p_bet_id: betId,
        p_structured_player_name: null,
        p_structured_player_id: null,
        p_structured_team_id: null,
        p_structured_duel: null,
        p_structured_combo: null,
        p_structured_period: null,
        p_structured_roster_split: null,
        p_structured_roster_count: null,
        p_structured_superlative: null,
        p_structured_technical_fouls_count: null,
        p_structured_last_basket: null,
        p_structured_block_on_player: null,
        p_structured_negation: negated,
        p_stat: matchTotal.stat,
        p_threshold: matchTotal.threshold,
        p_comparison: matchTotal.comparison,
        p_is_calculable: true,
        p_calculated_proba: finalProba,
        p_suggested_difficulty: probaToDifficulty(finalProba),
        p_category: (
          matchTotal.stat === "went_to_ot" || matchTotal.stat === "had_backcourt_turnover" ||
          matchTotal.stat === "had_buzzer_beater" || matchTotal.stat === "total_timeouts"
            ? "GAME_EVENT"
            : "SCORE_TOTAL"
        ) satisfies BetCategory,
      });
      return;
    }

    // Pari TEAM_STAT (pièce (a) suite, GAPS_OUVERTS.md) -- stat d'UNE
    // équipe précise sur CE match, perspective "own"/"opp" (pas domicile/
    // extérieur) -- MATCH uniquement, même limite que MATCH_TOTAL ci-dessus.
    if (structuration.bet_subject === "TEAM_STAT") {
      const teamStat = structuration.team_stat;
      if (scope !== "MATCH" || !matchId || !teamStat) {
        await markNotCalculable();
        return;
      }
      const teamName = teamStat.team === "team1" ? teamNames?.[0] : teamNames?.[1];
      const matchTeams = await resolveMatchTeams(supabase, matchId);
      if (!teamName || !matchTeams || (teamName !== matchTeams.homeTeamName && teamName !== matchTeams.awayTeamName)) {
        await markNotCalculable();
        return;
      }
      const isHome = teamName === matchTeams.homeTeamName;
      const opponentName = isHome ? matchTeams.awayTeamName : matchTeams.homeTeamName;
      const teamId = isHome ? matchTeams.homeTeamId : matchTeams.awayTeamId;
      const prediction = await predictTeamStat(
        teamStat.stat as TeamStatCode,
        teamName,
        opponentName,
        isHome,
        teamStat.threshold,
        teamStat.comparison,
        matchTeams.scheduledAt.slice(0, 10),
      );
      if (!prediction) {
        await markNotCalculable();
        return;
      }
      await supabase.rpc("update_bet_structuration", {
        p_bet_id: betId,
        p_structured_player_name: null,
        p_structured_player_id: null,
        p_structured_team_id: teamId,
        p_structured_duel: null,
        p_structured_combo: null,
        p_structured_period: null,
        p_structured_roster_split: null,
        p_structured_roster_count: null,
        p_structured_superlative: null,
        p_structured_technical_fouls_count: null,
        p_structured_last_basket: null,
        p_structured_block_on_player: null,
        p_structured_negation: false,
        p_stat: teamStat.stat,
        p_threshold: teamStat.threshold,
        p_comparison: teamStat.comparison,
        p_is_calculable: true,
        p_calculated_proba: prediction.proba,
        p_suggested_difficulty: probaToDifficulty(prediction.proba),
        p_category: "TEAM_PROP" satisfies BetCategory,
      });
      return;
    }

    // Pari COMPARISON (24/08/2026, GAPS_OUVERTS.md, chantier comparaison/
    // duel) -- compare 2 côtés entre eux (jamais contre un seuil fixe, sauf
    // DIFF_LT qui borne un ÉCART). MATCH uniquement, même limite que
    // TEAM_STAT/MATCH_TOTAL ci-dessus.
    if (structuration.bet_subject === "COMPARISON") {
      const comparisonBet = structuration.comparison_bet;
      if (scope !== "MATCH" || !matchId || !comparisonBet) {
        await markNotCalculable();
        return;
      }

      const matchTeams = await resolveMatchTeams(supabase, matchId);
      if (!matchTeams) {
        await markNotCalculable();
        return;
      }

      // "team1"/"team2" -> "domicile"/"exterieur" (contrat statsService.ts,
      // même patron que predictTeamStat) -- résolu depuis les VRAIES
      // équipes du match visé, pas un choix arbitraire.
      const resolveSide = (kind: "team1" | "team2"): "domicile" | "exterieur" | null => {
        const name = kind === "team1" ? teamNames?.[0] : teamNames?.[1];
        if (!name) return null;
        if (name === matchTeams.homeTeamName) return "domicile";
        if (name === matchTeams.awayTeamName) return "exterieur";
        return null;
      };

      const buildOperand = (side: { kind: "PLAYER" | "team1" | "team2"; players: string[]; stat: string }): DuelOperand | null => {
        if (side.kind === "PLAYER") {
          if (side.players.length === 0 || !(COMPARISON_PLAYER_STAT_CODES as string[]).includes(side.stat)) return null;
          return { kind: "PLAYER", players: side.players, stat: side.stat };
        }
        const resolvedSide = resolveSide(side.kind);
        if (!resolvedSide || !(COMPARISON_TEAM_STAT_CODES as string[]).includes(side.stat)) return null;
        return { kind: "TEAM", team: resolvedSide, stat: side.stat };
      };

      const left = buildOperand(comparisonBet.left);
      const right = buildOperand(comparisonBet.right);
      if (!left || !right) {
        await markNotCalculable();
        return;
      }

      const multiplier = comparisonBet.multiplier ?? 1;
      const needsThreshold = comparisonBet.relation === "DIFF_LT" || comparisonBet.relation === "OR";
      const relationThreshold = needsThreshold ? comparisonBet.threshold : null;
      if (needsThreshold && relationThreshold === null) {
        await markNotCalculable();
        return;
      }

      const prediction = await predictComparison(
        left,
        right,
        comparisonBet.relation,
        multiplier,
        relationThreshold,
        matchTeams.homeTeamName,
        matchTeams.awayTeamName,
        matchTeams.scheduledAt.slice(0, 10),
      );
      if (!prediction) {
        await markNotCalculable();
        return;
      }

      // Persiste les ids REELS (joueurs resolus cote service, equipe deja
      // connue cote appelant) -- jamais re-matches par nom plus tard, meme
      // lecon que structured_player_id (migration 20260822130000).
      const operandMeta = (operand: DuelOperand, playerIds: number[] | null) =>
        operand.kind === "PLAYER"
          ? { kind: "PLAYER" as const, player_ids: playerIds, stat: operand.stat }
          : {
              kind: "TEAM" as const,
              team_id: operand.team === "domicile" ? matchTeams.homeTeamId : matchTeams.awayTeamId,
              stat: operand.stat,
            };

      const structuredDuel = {
        left: operandMeta(left, prediction.leftPlayerIds),
        right: operandMeta(right, prediction.rightPlayerIds),
        relation: comparisonBet.relation,
        multiplier,
      };

      await supabase.rpc("update_bet_structuration", {
        p_bet_id: betId,
        p_structured_player_name: null,
        p_structured_player_id: null,
        p_structured_team_id: null,
        p_structured_duel: structuredDuel,
        p_structured_combo: null,
        p_structured_period: null,
        p_structured_roster_split: null,
        p_structured_roster_count: null,
        p_structured_superlative: null,
        p_structured_technical_fouls_count: null,
        p_structured_last_basket: null,
        p_structured_block_on_player: null,
        p_structured_negation: false,
        p_stat: null,
        p_threshold: relationThreshold,
        p_comparison: null,
        p_is_calculable: true,
        p_calculated_proba: prediction.proba,
        p_suggested_difficulty: probaToDifficulty(prediction.proba),
        p_category: "HEAD_TO_HEAD" satisfies BetCategory,
      });
      return;
    }

    // Pari COMBO (24/08/2026, GAPS_OUVERTS.md, chantier combo) -- ET de N
    // conditions (TOUTES doivent être vraies), chacune joueur/somme de
    // joueurs/équipe + 1+ stats sommées + seuil + comparaison. MATCH
    // uniquement, même limite que les branches ci-dessus. Portée
    // volontairement limitée à un ET simple -- pas de comptage sur tout le
    // roster (cf. GAPS_OUVERTS.md pour cette exclusion et où elle sera
    // reprise). Le OU imbriqué (étape 7, 25/08/2026) est routé EN AMONT
    // vers handleComboNestedBet() par mot-clé (COMBO_NESTED_OR_KEYWORD_REGEX,
    // cf. try ci-dessous) -- cette branche ne voit donc QUE des conditions
    // simples (jamais de OU), chacune enveloppée dans un groupe à 1 item
    // avant d'être écrite via writeComboResult() (même stockage/résolution
    // que le cas OU imbriqué, cf. sa docstring).
    if (structuration.bet_subject === "COMBO") {
      const comboBet = structuration.combo_bet;
      if (scope !== "MATCH" || !matchId || !comboBet || comboBet.conditions.length === 0) {
        await markNotCalculable();
        return;
      }

      const matchTeams = await resolveMatchTeams(supabase, matchId);
      if (!matchTeams) {
        await markNotCalculable();
        return;
      }

      const groups: ComboCondition[][] = [];
      const rawThresholds: { threshold: number | null; comparison: "OVER" | "UNDER" }[][] = [];
      for (const c of comboBet.conditions) {
        const validated = validateComboCondition(c, teamNames, matchTeams);
        if (!validated) {
          await markNotCalculable();
          return;
        }
        groups.push([validated]);
        rawThresholds.push([{ threshold: c.threshold, comparison: c.comparison }]);
      }

      await writeComboResult(groups, rawThresholds, matchTeams);
      return;
    }

    // bet_subject === "PLAYER" à partir d'ici (comportement inchangé).
    const player = structuration.player;
    if (!player) {
      await markNotCalculable();
      return;
    }
    // comparison est légitimement null pour dd/td (NO_THRESHOLD_STATS,
    // probabilité directe) -- ne l'exiger que pour les stats à seuil. Bug
    // réel trouvé en testant le 21/08/2026 : la condition d'origine
    // exigeait comparison partout, faisant tomber TOUS les paris dd/td en
    // "non calculable" alors qu'ils le sont bel et bien.
    const stat = player.stat as StatCode;
    if (!NO_THRESHOLD_STATS.has(stat) && (player.threshold === null || !player.comparison)) {
      await markNotCalculable();
      return;
    }

    // Joueur identifié mais absent des 2 équipes du match (bug réel trouvé
    // le 21/08/2026, ex. "LeBron James" sur un match Atlanta-Boston) --
    // proba forcée à 0% SANS appeler le micro-service (celui-ci ne connaît
    // pas le contexte du match, il calculerait une vraie proba à partir des
    // stats du joueur, ignorant qu'il ne joue pas ce soir-là -- exactement
    // le bug d'origine). Reste calculable=true (accepté, auto-validé,
    // perdra simplement à la résolution) plutôt que rejeté -- décidé avec
    // l'utilisateur pour ne jamais bloquer une soumission (même principe
    // que decisions_0.2.4 §4).
    if (player.not_in_match) {
      // p_structured_player_id: null -- le micro-service n'est jamais appelé
      // dans ce cas précis (voir plus bas), donc jamais de vrai player_id
      // résolu ici. Sans conséquence pour la résolution automatique (Phase
      // 6) : ce pari perd de toute façon à coup sûr (joueur absent du
      // match), pas besoin de retrouver sa vraie stat pour le savoir --
      // reste néanmoins non résolu automatiquement pour l'instant, noté
      // dans GAPS_OUVERTS.md comme amélioration possible.
      await supabase.rpc("update_bet_structuration", {
        p_bet_id: betId,
        p_structured_player_name: player.name,
        p_structured_player_id: null,
        p_structured_team_id: null,
        p_structured_duel: null,
        p_structured_combo: null,
        p_structured_period: null,
        p_structured_roster_split: null,
        p_structured_roster_count: null,
        p_structured_superlative: null,
        p_structured_technical_fouls_count: null,
        p_structured_last_basket: null,
        p_structured_block_on_player: null,
        p_structured_negation: false,
        p_stat: player.stat,
        p_threshold: player.threshold,
        p_comparison: player.comparison,
        p_is_calculable: true,
        p_calculated_proba: 0,
        p_suggested_difficulty: probaToDifficulty(0),
        p_category: "PLAYER_PROP" satisfies BetCategory,
      });
      return;
    }

    // Pari SERIE (brique (d) du chantier, GAPS_OUVERTS.md) : proba "au moins
    // une fois sur la série" plutôt que "au prochain match", cf.
    // predictSeriesStat()/compute_series_stat_proba(). Nécessite l'équipe du
    // joueur (player.team, résolue par l'IA depuis matchContext) ET le
    // match 1 réel de la série (avantage du terrain) -- repli non-calculable
    // si l'un des deux manque (série pas encore programmée, ou équipe non
    // résolue), jamais bloquant.
    let prediction: Awaited<ReturnType<typeof predictOverUnder>> = null;
    if (scope === "SERIES") {
      const homeCourt = await resolveSeriesHomeCourtTeam(supabase, seriesId);
      const playerTeamName =
        player.team === "team1" ? teamNames?.[0]
        : player.team === "team2" ? teamNames?.[1]
        : null;
      if (homeCourt && playerTeamName) {
        prediction = await predictSeriesStat(
          player.name,
          stat,
          player.threshold,
          player.comparison,
          homeCourt.homeTeamName,
          homeCourt.awayTeamName,
          playerTeamName,
        );
      }
    } else {
      prediction = await predictOverUnder(player.name, stat, player.threshold, player.comparison);
    }
    if (!prediction) {
      await markNotCalculable();
      return;
    }

    const suggestedDifficulty = probaToDifficulty(prediction.proba);

    await supabase.rpc("update_bet_structuration", {
      p_bet_id: betId,
      p_structured_player_name: player.name,
      p_structured_player_id: prediction.playerId,
      p_structured_team_id: null,
      p_structured_duel: null,
      p_structured_combo: null,
      p_structured_period: null,
        p_structured_roster_split: null,
        p_structured_roster_count: null,
        p_structured_superlative: null,
        p_structured_technical_fouls_count: null,
      p_structured_last_basket: null,
      p_structured_block_on_player: null,
      p_structured_negation: false,
      p_stat: player.stat,
      p_threshold: player.threshold,
      p_comparison: player.comparison,
      p_is_calculable: true,
      p_calculated_proba: prediction.proba,
      p_suggested_difficulty: suggestedDifficulty,
      p_category: "PLAYER_PROP" satisfies BetCategory,
    });
  } catch {
    // Best-effort : ne jamais faire échouer submitBet à cause de cette
    // étape d'enrichissement -- y compris si structureBet()/predictOverUnder()
    // lèvent une exception avant d'avoir pu répondre (timeout réseau...) :
    // on n'a alors même pas de réponse IA à enregistrer, is_calculable
    // reste NULL dans ce cas précis (panne, pas une décision).
  }
}
