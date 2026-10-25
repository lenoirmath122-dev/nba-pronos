// Formes de données de la popup hebdomadaire (lot 5). Miroir des colonnes de
// `weekly_popups` (migration 20261013090000_weekly_popup.sql) : la base ne
// porte que du jsonb, ces types sont la seule description côté code.
// Plan : Cadrage/Fonctionnel/nba_pronos_plan_technique_popup_hebdo.md §1.3.

import type { LlmStatus } from "@/lib/ai/claudeJson";

export type WeeklyPopupKind = "LLM" | "FALLBACK";

export type WeeklyPopupStatus =
  | "GENERATING"
  | "READY"
  | "DOUBTFUL"
  | "PUBLISHED"
  | "SKIPPED"
  | "RETRACTED";

/** `doubt_code` : pourquoi un brouillon est douteux (jamais de donnée perso). */
export type WeeklyPopupDoubtCode =
  | "invalid_output"
  | "max_tokens"
  | "api_error"
  | "timeout"
  | "cap_reached"
  | "refusal"
  | "structure"
  | "budget"
  | "stale"
  | "internal";

/** Ce qui a déclenché une génération (la notification admin ne suit que CRON). */
export type GenerationTrigger = "CRON" | "ADMIN_FREEZE" | "ADMIN_GENERATE" | "ADMIN_REGENERATE";

/**
 * Sens d'un seuil de flop. « au plus » n'existe pas en production : la
 * structuration ne produit que OVER/UNDER (stricts) hors fautes techniques.
 */
export type Sens = "plus de" | "au moins" | "moins de" | "au plus" | "exactement";

export type WeeklyPopupBlock = "top" | "flop" | "refuse" | "champion" | "classement";

/** Une entrée de `weekly_popups.candidates`. Le pseudo n'est jamais stocké. */
export interface WeeklyPopupCandidate {
  /** Identifiant court vu par le LLM : t1.., f1.., r1.. (+ c1.. champion, k1.. classement). */
  short_id: string;
  bloc: WeeklyPopupBlock;
  bet_id: string | null;
  user_id: string;
  texte: string;
  match?: string | null;
  statut?: string | null;
  chance_pct?: number | null;
  raison?: string | null;
  /** Valeur stockée en base (`structured_threshold`), jamais transformée. */
  seuil?: number | null;
  /**
   * `plus de` / `moins de` (OVER / UNDER, stricts) ; `au moins` / `exactement`
   * pour les fautes techniques (`count_relation`) ou `QUARTERS_WON_COUNT` avec
   * `exact_count` ; `null` si inconnu ou ambigu (texte inclusif, voir sens.ts).
   */
  sens?: Sens | null;
  cite_recemment?: boolean;
  /** Points de la semaine, pour le champion. */
  points?: number;
  verdict?: "ok" | "bloque";
  categorie?: string | null;
  verdict_source?: "lot" | "unitaire" | "reutilise";
  /** sha256(pseudo + texte) au moment du classement. */
  input_hash?: string;
}

/**
 * Contenu éditable puis publié (`content` / `generated_content`). Les mentions
 * de joueurs y sont des jetons `{{u:<uuid>}}`, résolus à l'affichage ;
 * `{{u:supprime}}` pour un compte supprimé.
 */
export interface WeeklyPopupContent {
  titre: string;
  champion: string | null;
  /** Prompt v6 : analyse du classement. Absent des contenus v5. */
  classement?: string | null;
  top: string | null;
  flop: string | null;
  refuse: string | null;
  cta: string;
  /** Présent seulement pour un texte de repli (kind FALLBACK). */
  repli?: string;
}

export interface WeeklyPopupWarning {
  code: string;
  bloc?: WeeklyPopupBlock | "titre" | "cta" | "total";
  detail?: string;
}

/** Ce que `current_weekly_popup()` renvoie à un joueur : rien d'autre. */
export interface CurrentWeeklyPopup {
  id: string;
  week_end_date: string;
  kind: WeeklyPopupKind;
  content: WeeklyPopupContent;
}

/**
 * Une entrée de `weekly_popups.attempts`. Aucun texte libre (ni `errorMessage`,
 * ni `issues`, ni sortie brute) : des codes et des compteurs seulement.
 */
export interface WeeklyPopupAttempt {
  role: "classifier" | "classifier_unit" | "redacteur";
  attempt: number;
  status: LlmStatus | "structure";
  short_id?: string;
  stop_reason?: string | null;
  http_status?: number;
  request_id?: string | null;
  latency_ms: number;
  cost_usd: number;
  input_tokens?: number;
  output_tokens?: number;
  thinking_tokens?: number;
  issues_count?: number;
  error_codes?: string[];
  at: string;
}

/** Ligne complète de `weekly_popups` (service_role seulement). */
export interface WeeklyPopupRow {
  id: string;
  competition_id: string;
  week_end_date: string;
  kind: WeeklyPopupKind;
  status: WeeklyPopupStatus;
  doubt_code: WeeklyPopupDoubtCode | null;
  doubt_detail: string | null;
  generation_id: string | null;
  generation_started_at: string | null;
  generation_count: number;
  prompt_version: string | null;
  candidates: WeeklyPopupCandidate[];
  generated_content: WeeklyPopupContent | null;
  raw_output: string | null;
  content: WeeklyPopupContent | null;
  warnings: WeeklyPopupWarning[];
  attempts: WeeklyPopupAttempt[];
  featured_user_ids: string[];
  admin_notified_at: string | null;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
}

/** `structured_period` réduit aux champs lus par la présélection. */
export interface StructuredPeriodLite {
  period?: string | null;
  outcome_kind?: string | null;
  team_id?: string | null;
  player_id?: number | null;
  exact_count?: boolean | null;
}

/** Un pari chargé pour la semaine (colonnes lues par `load.ts`). */
export interface PopupBetRow {
  id: string;
  user_id: string;
  description: string;
  status: "WON" | "LOST" | "REJECTED" | "CANCELLED";
  scope: "MATCH" | "SERIES";
  match_id: string | null;
  series_id: string | null;
  validated_difficulty: number | null;
  calculated_proba: number | null;
  resolved_at: string | null;
  rejected_at: string | null;
  resolution_reason: string | null;
  resolved_by_admin_id: string | null;
  is_admin_corrected: boolean;
  structured_stat: string | null;
  structured_threshold: number | null;
  structured_comparison: "OVER" | "UNDER" | null;
  structured_negation: boolean | null;
  structured_team_id: string | null;
  structured_player_id: number | null;
  structured_period: StructuredPeriodLite | null;
  structured_technical_fouls_count: {
    scope?: string;
    count_relation?: "AT_LEAST" | "MORE_THAN" | "FEWER_THAN" | "EXACTLY";
  } | null;
  structured_duel: unknown;
  structured_combo: unknown;
  structured_roster_split: unknown;
  structured_roster_count: unknown;
  structured_superlative: unknown;
  structured_last_basket: unknown;
  structured_block_on_player: unknown;
}

export interface PopupUserRow {
  id: string;
  pseudo: string;
  status: string;
  popup_mentions_opt_out: boolean;
}

/** Tout ce que la génération lit pour une semaine. */
export interface WeekData {
  competitionId: string;
  weekEnd: string;
  startIso: string;
  endIso: string;
  /** WON + LOST + REJECTED de la fenêtre, avant toute exclusion. */
  rawCount: number;
  bets: PopupBetRow[];
  users: ReadonlyMap<string, PopupUserRow>;
  /** `bet.match_id` -> « BOS - NYK ». */
  matchLabels: ReadonlyMap<string, string>;
  champions: { userId: string; points: number }[];
  recentlyFeaturedIds: ReadonlySet<string>;
  publishedFallbackCount: number;
  /** Plafond de lecture atteint : la liste des paris est incomplète. */
  truncated: boolean;
}
