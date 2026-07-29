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

export function NodeCard({ node, isOpen, disabled, onToggle }: NodeCardProps) {
  const actualWinnerAbbreviation = useLiveWinnerAbbreviation(node.nodeId, node.actualWinnerAbbreviation);
  const isFinal = FINAL_ROUNDS.has(node.round);
  const hasChampion = isFinal && actualWinnerAbbreviation !== null;

  return (
    <button
      type="button"
      className={
        disabled ? `${styles.card} ${styles.cardDisabled}` : isOpen ? `${styles.card} ${styles.cardOpen}` : styles.card
      }
      onClick={disabled ? undefined : onToggle}
      aria-expanded={isOpen}
      aria-disabled={disabled || undefined}
    >
      {node.conference && <span className={styles.conference}>{CONFERENCE_LABEL[node.conference]}</span>}
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
      {node.filledBracketsCount > 0 && (
        <span className={styles.filled}>
          {node.filledBracketsCount} bracket{node.filledBracketsCount > 1 ? "s" : ""} rempli
          {node.filledBracketsCount > 1 ? "s" : ""}
        </span>
      )}
    </button>
  );
}
