import type { BracketNode } from "@/lib/queries/bracket";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { useLiveWinnerAbbreviation } from "./LiveSeriesSubscriber";
import styles from "./NodeCard.module.css";

// Carte résumé d'une série. Présentiel pur (pas de "use client") : rendu
// exclusivement par SeriesDrillDown, qui porte le clic (même mécanisme que
// RotateInvite, §3 — un composant sans état propre peut être rendu par un
// parent client sans porter la directive lui-même).

const CONFERENCE_LABEL: Record<string, string> = { EAST: "Est", WEST: "Ouest" };
// Champion déduit du bracket ENTIER (finale uniquement) : or réservé à ce cas
// (§17) — un vainqueur de série normale reste un résultat vert, pas un or.
const FINAL_ROUNDS = new Set(["NBA_FINALS", "CUP_FINAL"]);

type NodeCardProps = {
  node: BracketNode;
  isOpen: boolean;
  disabled: boolean;
  onToggle: () => void;
};

function TeamLabel({
  team,
  isChampion,
  isWinner,
}: {
  team: { abbreviation: string; name: string } | null;
  isChampion: boolean;
  isWinner: boolean;
}) {
  if (!team) {
    // Pivot A1 : « en attente » → marqueur neutre (pas encore déterminé).
    return <span className={styles.team}>—</span>;
  }
  const className = isChampion ? styles.teamChampion : isWinner ? styles.teamWinner : styles.team;
  return (
    <span className={className}>
      <TeamLogo abbreviation={team.abbreviation} alt={team.name} size={24} />
      {team.abbreviation}
    </span>
  );
}

// Ligne d'équipe EN DIRECT (14/08/2026) : logo + nom + score de série à
// droite. L'équipe qui MÈNE (pas "qui a gagné") ressort en --color-trend,
// JAMAIS --color-win (§17 : vert réservé au résultat FINAL). Score à égalité
// -> aucune des deux équipes mise en avant.
function LiveTeamRow({
  team,
  wins,
  isLeading,
}: {
  team: { abbreviation: string; name: string } | null;
  wins: number | null;
  isLeading: boolean;
}) {
  return (
    <span className={styles.liveTeamRow}>
      <TeamLabel team={team} isChampion={false} isWinner={false} />
      {wins !== null && (
        <span className={isLeading ? `${styles.liveScore} ${styles.liveScoreLeading}` : styles.liveScore}>
          {wins}
        </span>
      )}
    </span>
  );
}

export function NodeCard({ node, isOpen, disabled, onToggle }: NodeCardProps) {
  const actualWinnerAbbreviation = useLiveWinnerAbbreviation(node.nodeId, node.actualWinnerAbbreviation);
  const isFinal = FINAL_ROUNDS.has(node.round);
  const hasChampion = isFinal && actualWinnerAbbreviation !== null;
  // Surbrillance de carte demandée par l'utilisateur (30/07/2026) : série
  // terminée = bordure/fond teintés, en plus du texte déjà coloré du
  // vainqueur (§17 — vert pour un résultat gagné, or réservé au champion,
  // jamais de rouge pour l'équipe battue).
  const isDecided = !isFinal && actualWinnerAbbreviation !== null;
  const isLive = node.status === "IN_PROGRESS";

  const leadingSide: "A" | "B" | null =
    node.liveScore && node.liveScore.teamAWins !== node.liveScore.teamBWins
      ? node.liveScore.teamAWins > node.liveScore.teamBWins
        ? "A"
        : "B"
      : null;

  const cardClassName = [
    styles.card,
    isLive && styles.cardLive,
    isDecided && styles.cardDecided,
    hasChampion && styles.cardChampion,
    isOpen && styles.cardOpen,
    disabled && styles.cardDisabled,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={cardClassName}
      onClick={disabled ? undefined : onToggle}
      aria-expanded={isOpen}
      aria-disabled={disabled || undefined}
    >
      {node.conference && <span className={styles.conference}>{CONFERENCE_LABEL[node.conference]}</span>}

      {isLive ? (
        <div className={styles.liveMatchup}>
          <span className={styles.liveTag}>
            <span className={styles.liveDot} aria-hidden="true" />
            En cours
          </span>
          <LiveTeamRow team={node.teamA} wins={node.liveScore?.teamAWins ?? null} isLeading={leadingSide === "A"} />
          <LiveTeamRow team={node.teamB} wins={node.liveScore?.teamBWins ?? null} isLeading={leadingSide === "B"} />
        </div>
      ) : (
        <div className={styles.matchup}>
          <span className={styles.teams}>
            <TeamLabel
              team={node.teamA}
              isChampion={hasChampion && node.teamA?.abbreviation === actualWinnerAbbreviation}
              isWinner={!isFinal && node.teamA?.abbreviation === actualWinnerAbbreviation}
            />
            <span className={styles.versus}>–</span>
            <TeamLabel
              team={node.teamB}
              isChampion={hasChampion && node.teamB?.abbreviation === actualWinnerAbbreviation}
              isWinner={!isFinal && node.teamB?.abbreviation === actualWinnerAbbreviation}
            />
          </span>
          {hasChampion && <span className={styles.championTag}>Champion</span>}
        </div>
      )}

      {node.filledBracketsCount > 0 && (
        <span className={styles.filled}>
          {node.filledBracketsCount} bracket{node.filledBracketsCount > 1 ? "s" : ""} rempli
          {node.filledBracketsCount > 1 ? "s" : ""}
        </span>
      )}
    </button>
  );
}
