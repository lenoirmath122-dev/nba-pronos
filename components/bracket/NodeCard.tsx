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

// Mise en avant du pronostic de bracket du joueur (15/08/2026, demandé par
// l'utilisateur — « très voyante » directement sur la carte ; distinct du
// PARI personnalisé, qui reste sur Mes pronos, pas ici). Filet d'accent
// additif, jamais une teinte de carte (§17 : vert/or réservés au résultat
// RÉEL de la série). Correct = vert (même registre que TeamLabel.isWinner
// ci-dessous) ; sinon neutre — jamais de rouge pour un pronostic manqué,
// même règle que "jamais de rouge pour l'équipe battue".

type NodeCardProps = {
  node: BracketNode;
  isOpen: boolean;
  disabled: boolean;
  onToggle: () => void;
  /** Affiche le petit bouton Parier/Modifier (15/08/2026, demandé par
   *  l'utilisateur — Mes paris devient consultation seule) — déjà réduit par
   *  l'appelant à joueur connecté + PLAYOFFS (même garde que l'ancien
   *  BetLink qu'il remplace). */
  showBetLink: boolean;
};

// Contenu partagé entre les 2 emplacements du pronostic (15/08/2026) : sur la
// même ligne que « En cours » pour une série live (demandé par l'utilisateur,
// aligné à droite), sur sa propre ligne sinon (aucun texte d'état à côté
// duquel s'aligner pour une série programmée/décidée non finale).
function MyPickContent({
  myPick,
  isCorrect,
}: {
  myPick: NonNullable<BracketNode["myPick"]>;
  isCorrect: boolean;
}) {
  return (
    <>
      <span className={styles.myPickTag}>— Ton prono</span>
      <span className={isCorrect ? styles.myPickCorrect : styles.myPickNeutral}>
        {myPick.teamAbbreviation}
        {myPick.seriesFormat && ` en ${myPick.seriesFormat}`}
      </span>
    </>
  );
}

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

export function NodeCard({ node, isOpen, disabled, onToggle, showBetLink }: NodeCardProps) {
  const actualWinnerAbbreviation = useLiveWinnerAbbreviation(node.nodeId, node.actualWinnerAbbreviation);
  const isFinal = FINAL_ROUNDS.has(node.round);
  const hasChampion = isFinal && actualWinnerAbbreviation !== null;
  // Surbrillance de carte demandée par l'utilisateur (30/07/2026) : série
  // terminée = bordure/fond teintés, en plus du texte déjà coloré du
  // vainqueur (§17 — vert pour un résultat gagné, or réservé au champion,
  // jamais de rouge pour l'équipe battue).
  const isDecided = !isFinal && actualWinnerAbbreviation !== null;
  const isLive = node.status === "IN_PROGRESS";
  const isMyPickCorrect =
    node.myPick !== null && actualWinnerAbbreviation !== null && node.myPick.teamAbbreviation === actualWinnerAbbreviation;

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
    node.myPick && styles.cardHasPick,
  ]
    .filter(Boolean)
    .join(" ");

  // Racine passée de <button> à <div role="button"> (15/08/2026) : un pari
  // imbrique maintenant un vrai <a> (bouton Parier/Modifier) dans la carte —
  // un <a> dans un <button> est invalide en HTML, même raison déjà rencontrée
  // sur LeaderboardRow.tsx (§ pseudo cliquable). Comportement clavier
  // Entrée/Espace reconstitué à la main, aria-disabled inchangé (jamais
  // l'attribut natif disabled — déjà le cas avant, la carte reste focusable
  // même "désactivée").
  const canBet = showBetLink && node.teamA !== null && node.teamB !== null && node.myBetAction !== null;

  return (
    <div
      role="button"
      tabIndex={0}
      className={cardClassName}
      onClick={disabled ? undefined : onToggle}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
      aria-expanded={isOpen}
      aria-disabled={disabled || undefined}
    >
      {node.conference && <span className={styles.conference}>{CONFERENCE_LABEL[node.conference]}</span>}

      {isLive ? (
        <div className={styles.liveMatchup}>
          <span className={styles.liveHeader}>
            <span className={styles.liveTag}>
              <span className={styles.liveDot} aria-hidden="true" />
              En cours
            </span>
            {node.myPick && (
              <span className={styles.myPickLine}>
                <MyPickContent myPick={node.myPick} isCorrect={isMyPickCorrect} />
              </span>
            )}
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

      {!isLive && node.myPick && (
        <span className={styles.myPickLine}>
          <MyPickContent myPick={node.myPick} isCorrect={isMyPickCorrect} />
        </span>
      )}

      {node.filledBracketsCount > 0 && (
        <span className={styles.filled}>
          {node.filledBracketsCount} bracket{node.filledBracketsCount > 1 ? "s" : ""} rempli
          {node.filledBracketsCount > 1 ? "s" : ""}
        </span>
      )}

      {canBet && node.myBetAction && (
        <a
          href={
            node.myBetAction.kind === "EDIT"
              ? `/play/bets/${node.myBetAction.betId}/edit`
              : `/play/bets/new?seriesId=${node.nodeId}`
          }
          className={styles.betButton}
          onClick={(event) => event.stopPropagation()}
        >
          {node.myBetAction.kind === "EDIT" ? "Modifier le pari" : "Parier"}
        </a>
      )}
    </div>
  );
}
