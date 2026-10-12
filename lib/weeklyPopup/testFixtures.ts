// Fixtures partagées des tests de la popup hebdomadaire (jamais importé hors tests).

import type { PopupBetRow, PopupUserRow } from "./types";

export const U1 = "11111111-1111-4111-8111-111111111111";
export const U2 = "22222222-2222-4222-8222-222222222222";
export const U3 = "33333333-3333-4333-8333-333333333333";
export const U4 = "44444444-4444-4444-8444-444444444444";

let seq = 0;

/** Pari LOST « joueur, pts, plus de 25 » par défaut ; `overrides` pour varier. */
export function bet(overrides: Partial<PopupBetRow> = {}): PopupBetRow {
  seq += 1;
  return {
    id: `bet-${String(seq).padStart(4, "0")}`,
    user_id: U1,
    description: "Shai marque plus de 25 points",
    status: "LOST",
    scope: "MATCH",
    match_id: "match-1",
    series_id: null,
    validated_difficulty: 2,
    calculated_proba: 0.6,
    resolved_at: "2026-10-20T12:00:00Z",
    rejected_at: null,
    resolution_reason: "Shai a marqué 24 points.",
    resolved_by_admin_id: null,
    is_admin_corrected: false,
    structured_stat: "pts",
    structured_threshold: 25,
    structured_comparison: "OVER",
    structured_negation: null,
    structured_team_id: null,
    structured_player_id: 1,
    structured_period: null,
    structured_technical_fouls_count: null,
    structured_duel: null,
    structured_combo: null,
    structured_roster_split: null,
    structured_roster_count: null,
    structured_superlative: null,
    structured_last_basket: null,
    structured_block_on_player: null,
    ...overrides,
  };
}

export function user(
  id: string,
  pseudo: string,
  overrides: Partial<PopupUserRow> = {},
): PopupUserRow {
  return { id, pseudo, status: "ACTIVE", popup_mentions_opt_out: false, ...overrides };
}

export function usersMap(...users: PopupUserRow[]): Map<string, PopupUserRow> {
  return new Map(users.map((u) => [u.id, u]));
}
