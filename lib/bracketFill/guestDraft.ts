import type { CompetitionType } from "@/lib/competitions/types";
import type { BracketFillData, GuestBracketStructure } from "@/lib/queries/bracket-fill";
import { computeCandidateTeamIds, type CascadeSeriesRow } from "./cascade";

// Bracket NBA Cup rempli en invité (chantier du 28/11/2026,
// Cadrage/Suivi/chantiers/CHANTIER_BRACKET_INVITE.md) : les choix du visiteur
// vivent dans SON navigateur (localStorage), rien en base. À la validation, la
// modale de compte s'ouvre ; après inscription, la reprise
// (components/bracket-fill/GuestBracketReplay.tsx) les enregistre dans l'ordre
// des tours, puis le joueur valide LUI-MÊME (jamais de validateBracket auto).
// Module PUR : stockage, cascade et ordre d'enregistrement testés sans navigateur.

export const BRACKET_DRAFT_PREFIX = "pb.bracketDraft.v1:";
export const BRACKET_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** seriesId → équipe choisie comme vainqueur. */
export type GuestPicks = Record<string, string>;

/** Clé par compétition : un brouillon d'une autre Cup ne fuit jamais. */
export function bracketDraftKey(competitionId: string): string {
  return BRACKET_DRAFT_PREFIX + competitionId;
}

export function serializeBracketDraft(competitionId: string, picks: GuestPicks, nowMs: number): string {
  return JSON.stringify({ competitionId, picks, updatedAt: nowMs });
}

export function parseBracketDraft(raw: string | null, competitionId: string, nowMs: number): GuestPicks {
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof data !== "object" || data === null) return {};
  const { competitionId: id, picks, updatedAt } = data as Record<string, unknown>;
  if (id !== competitionId) return {};
  if (typeof updatedAt !== "number" || nowMs - updatedAt > BRACKET_DRAFT_MAX_AGE_MS) return {};
  if (typeof picks !== "object" || picks === null) return {};
  const clean: GuestPicks = {};
  for (const [seriesId, teamId] of Object.entries(picks)) {
    if (typeof teamId === "string" && teamId.length > 0 && teamId.length <= 64 && seriesId.length <= 64) {
      clean[seriesId] = teamId;
    }
  }
  return clean;
}

function picksMap(picks: GuestPicks): Map<string, string | null> {
  return new Map(Object.entries(picks));
}

/** Retire les choix devenus impossibles (série inconnue, ou vainqueur qui
 *  n'est plus candidat après un changement en amont), jusqu'à stabilité. */
export function prunePicks(series: CascadeSeriesRow[], picks: GuestPicks, type: CompetitionType): GuestPicks {
  const known = new Set(series.map((s) => s.id));
  let current: GuestPicks = Object.fromEntries(Object.entries(picks).filter(([id]) => known.has(id)));
  for (let i = 0; i <= series.length; i++) {
    const candidates = computeCandidateTeamIds(series, picksMap(current), type);
    const next: GuestPicks = {};
    let changed = false;
    for (const [seriesId, teamId] of Object.entries(current)) {
      const c = candidates.get(seriesId);
      if (c && c.teamAId && c.teamBId && (teamId === c.teamAId || teamId === c.teamBId)) next[seriesId] = teamId;
      else changed = true;
    }
    current = next;
    if (!changed) break;
  }
  return current;
}

/** Un tap sur une équipe : pose le choix puis fait tomber l'aval incompatible. */
export function applyGuestPick(
  series: CascadeSeriesRow[],
  picks: GuestPicks,
  seriesId: string,
  teamId: string,
  type: CompetitionType
): GuestPicks {
  return prunePicks(series, { ...picks, [seriesId]: teamId }, type);
}

/** Choix dans l'ordre où le serveur les accepte : tours dans l'ordre de
 *  `rounds` (quarts, demies, finale, déjà triés par getBracketFillData), car
 *  saveBracketPick refuse une série dont les candidats ne sont pas encore
 *  connus en base. Séries inconnues ignorées. */
export function picksInSaveOrder(
  rounds: { series: { seriesId: string }[] }[],
  picks: GuestPicks
): { seriesId: string; winnerTeamId: string }[] {
  const ordered: { seriesId: string; winnerTeamId: string }[] = [];
  for (const round of rounds) {
    for (const { seriesId } of round.series) {
      const winnerTeamId = picks[seriesId];
      if (winnerTeamId) ordered.push({ seriesId, winnerTeamId });
    }
  }
  return ordered;
}

/** Données de l'arbre recalculées avec les choix du navigateur (même forme
 *  que pour un connecté, rendue par FillPosterView). */
export function withGuestPicks(
  data: BracketFillData,
  structure: GuestBracketStructure,
  picks: GuestPicks
): BracketFillData {
  const candidates = computeCandidateTeamIds(structure.series, picksMap(picks), data.competitionType);
  const team = (id: string | null) => {
    const t = id ? structure.teams[id] : undefined;
    return id && t ? { teamId: id, abbreviation: t.abbreviation, name: t.name } : null;
  };
  const rounds = data.rounds.map((round) => ({
    ...round,
    series: round.series.map((s) => {
      const c = candidates.get(s.seriesId) ?? { teamAId: null, teamBId: null };
      const teamA = team(c.teamAId);
      const teamB = team(c.teamBId);
      return {
        ...s,
        teamA,
        teamB,
        isSelectable: teamA !== null && teamB !== null,
        myPick: { winnerTeamId: picks[s.seriesId] ?? null, scoreFormat: null },
      };
    }),
  }));
  return { ...data, rounds, filledCount: Object.keys(picks).length };
}
