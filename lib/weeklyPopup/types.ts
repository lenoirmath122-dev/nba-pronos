// Formes de données de la popup hebdomadaire (lot 5). Miroir des colonnes de
// `weekly_popups` (migration 20261013090000_weekly_popup.sql) : la base ne
// porte que du jsonb, ces types sont la seule description côté code.
// Plan : Cadrage/Fonctionnel/nba_pronos_plan_technique_popup_hebdo.md §1.3.

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
  | "stale";

export type WeeklyPopupBlock = "top" | "flop" | "refuse" | "champion";

/** Une entrée de `weekly_popups.candidates`. Le pseudo n'est jamais stocké. */
export interface WeeklyPopupCandidate {
  /** Identifiant court vu par le LLM : t1.., f1.., r1.. (+ champion). */
  short_id: string;
  bloc: WeeklyPopupBlock;
  bet_id: string | null;
  user_id: string;
  texte: string;
  match?: string | null;
  statut?: string | null;
  chance_pct?: number | null;
  raison?: string | null;
  seuil?: number | null;
  sens?: string | null;
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
