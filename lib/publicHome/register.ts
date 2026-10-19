import { pseudoLengthError, normalizePseudo } from "@/lib/pseudo/rules";
import { isValidMargin, type BasketItem } from "./basket";

// Contrôles de l'écran « Enregistre tes pronos » (plan d'attractivité, §1.6 b) :
// logique pure, rejouée côté serveur par la Server Action.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type RegistrationInput = { pseudo: string; email: string; ageConfirmed: boolean };

/** Premier message d'erreur à afficher, ou null si la saisie est valide. */
export function registrationError(input: RegistrationInput): string | null {
  if (!EMAIL_RE.test(input.email.trim()) || input.email.length > 254) return "Cette adresse e-mail n'a pas l'air valide.";
  const pseudoError = pseudoLengthError(normalizePseudo(input.pseudo));
  if (pseudoError) return pseudoError;
  if (!input.ageConfirmed) return "Panier Ballon est réservé aux 15 ans et plus. Coche la case pour confirmer ton âge.";
  return null;
}

export type MatchForBasket = {
  id: string;
  competition_id: string;
  scheduled_at: string | null;
  status: string;
  home_team_id: string;
  away_team_id: string;
};

export type PredictionRow = {
  user_id: string;
  competition_id: string;
  match_id: string;
  predicted_winner_team_id: string;
  predicted_margin: number;
  status: "VALIDATED";
  validated_at: string;
};

/** Plafond défensif : le panier ne montre jamais plus de quelques matchs. */
export const MAX_BASKET_ITEMS = 10;

/**
 * Ne garde que les pronos acceptables : match programmé et pas commencé, équipe
 * du match, écart entre 1 et 50, un seul prono par match. Le competition_id vient
 * de la base, jamais du navigateur.
 */
export function buildPredictionRows(
  userId: string,
  items: BasketItem[],
  matches: MatchForBasket[],
  nowMs: number,
): PredictionRow[] {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const seen = new Set<string>();
  const rows: PredictionRow[] = [];
  for (const i of items.slice(0, MAX_BASKET_ITEMS)) {
    const m = byId.get(i.matchId);
    if (!m || seen.has(m.id)) continue;
    if (m.status !== "SCHEDULED" || !m.scheduled_at || Date.parse(m.scheduled_at) <= nowMs) continue;
    if (i.winnerTeamId !== m.home_team_id && i.winnerTeamId !== m.away_team_id) continue;
    if (!isValidMargin(i.margin)) continue;
    seen.add(m.id);
    rows.push({
      user_id: userId,
      competition_id: m.competition_id,
      match_id: m.id,
      predicted_winner_team_id: i.winnerTeamId,
      predicted_margin: i.margin,
      status: "VALIDATED",
      validated_at: new Date(nowMs).toISOString(),
    });
  }
  return rows;
}
