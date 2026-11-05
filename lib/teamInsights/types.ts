// Types partagés de l'aide aux débutants (CHANTIER_AIDE_DEBUTANTS.md §7).
// Aucun import serveur : utilisables côté client (popup).

export type FormLabel = "DEBUT" | "EN_FEU" | "EN_FORME" | "IRREGULIERE" | "EN_DIFFICULTE";
export type PlayerTrend = "EN_HAUSSE" | "EN_BAISSE" | "STABLE";

export type TeamFormSummary = {
  record: { wins: number; losses: number };
  /** Plus récent en premier. */
  last5: ("V" | "D")[];
  streak: { type: "V" | "D"; length: number };
  /** Écart moyen sur les 5 derniers matchs. */
  pointDiffLast5: number;
  label: FormLabel;
  conferenceRank: number | null;
  conference: "EAST" | "WEST" | null;
};

export type PlayerSeasonLine = {
  playerId: number;
  name: string;
  gamesPlayed: number;
  gamesWithTeam: number;
  isUsualStarter: boolean;
  minutes: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fg3m: number;
  fgPct: number | null;
  fg3Pct: number | null;
  ftPct: number | null;
  tsPct: number | null;
  trend: PlayerTrend | null;
  /** Transfert en cours de saison (D2) : gamesWithTeam < gamesPlayed. */
  joinedMidSeason: boolean;
};

export type TeamInsights = {
  teamId: string;
  tricode: string;
  form: TeamFormSummary | null;
  home: { wins: number; losses: number } | null;
  away: { wins: number; losses: number } | null;
  ptsForAvg: number | null;
  ptsAgainstAvg: number | null;
  pointDiffAvg: number | null;
  /** games_played < 10 (D3). */
  earlySeason: boolean;
  keyPlayers: PlayerSeasonLine[];
  roster: PlayerSeasonLine[];
};

export type TeamInsightsResponse = {
  season: string | null;
  updatedAt: string | null;
  teams: TeamInsights[];
};
