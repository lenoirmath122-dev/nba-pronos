import type { BracketNode } from "@/lib/queries/bracket";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { useLiveSeriesStatus, useLiveWinnerAbbreviation } from "./LiveSeriesSubscriber";
import { clickableRowProps } from "@/lib/hooks/clickableRow";
import styles from "./NodeCard.module.css";

// Carte résumé d'une série. Présentiel pur (pas de "use client") : rendu
// exclusivement par SeriesDrillDown, qui porte le clic (§3 — un composant
// sans état propre peut être rendu par un parent client sans porter la
// directive lui-même).

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
  showPoints,
}: {
  myPick: NonNullable<BracketNode["myPick"]>;
  isCorrect: boolean;
  /** Points affichés entre parenthèses UNIQUEMENT série FINISHED (18/08/2026,
   *  demandé par l'utilisateur) — jamais avant, même si un composant
   *  "affiche" a pu être scoré plus tôt (§ BracketMyPick.points). */
  showPoints: boolean;
}) {
  return (
    <>
      <span className={styles.myPickTag}>— Ton prono</span>
      <span className={isCorrect ? styles.myPickCorrect : styles.myPickNeutral}>
        {myPick.teamAbbreviation}
        {myPick.seriesFormat && ` en ${myPick.seriesFormat}`}
        {showPoints && myPick.points !== null && ` (${myPick.points} pt${myPick.points > 1 ? "s" : ""})`}
      </span>
    </>
  );
}

// Petite indication "Ton pari" sur la carte repliée (23/08/2026, demandé
// par l'utilisateur juste après l'affichage au clic ci-dessous) -- même
// patron que MyPickContent (tag + libellé court), mais ne révèle JAMAIS le
// contenu du pari (description/proba) ici : ça reste réservé au clic
// (BetBlock, SeriesDrillDown.tsx) pour ne pas rendre la carte trop chargée.
function MyBetContent({ myBet }: { myBet: NonNullable<BracketNode["myBet"]> }) {
  const label = myBet.status === "WON" ? "gagné" : myBet.status === "LOST" ? "perdu" : "en jeu";
  const className =
    myBet.status === "WON" ? styles.myBetWon : myBet.status === "LOST" ? styles.myBetLost : styles.myBetNeutral;
  return (
    <>
      <span className={styles.myBetTag}>— Ton pari</span>
      <span className={className}>
        {label}
        {myBet.pointsAwarded !== null && ` (${myBet.pointsAwarded} pt${myBet.pointsAwarded > 1 ? "s" : ""})`}
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

// Ligne d'équipe avec score de série à droite — partagée entre EN COURS et
// TERMINÉE (18/08/2026, demandé par l'utilisateur : « laisser le score
// comme il apparaît sur les séries en cours », plutôt que de le masquer une
// fois la série décidée). Seule la mise en avant change selon `highlight` :
// "trend" (--color-trend) pour l'équipe qui MÈNE une série encore EN COURS
// (pas "qui a gagné"), "win" (--color-win, même registre que TeamLabel) pour
// le VAINQUEUR réel d'une série TERMINÉE — jamais les deux en même temps, et
// jamais --color-win avant que le résultat soit officiellement acquis (§17).
// Score à égalité (série en cours) -> aucune des deux équipes mise en avant.
function SeriesTeamRow({
  team,
  wins,
  highlight,
  isChampion,
}: {
  team: { abbreviation: string; name: string } | null;
  wins: number | null;
  highlight: "trend" | "win" | null;
  isChampion: boolean;
}) {
  const scoreClassName =
    highlight === "trend"
      ? `${styles.liveScore} ${styles.liveScoreLeading}`
      : highlight === "win"
        ? `${styles.liveScore} ${styles.liveScoreWinner}`
        : styles.liveScore;
  return (
    <span className={styles.liveTeamRow}>
      <TeamLabel team={team} isChampion={isChampion} isWinner={highlight === "win"} />
      {wins !== null && <span className={scoreClassName}>{wins}</span>}
    </span>
  );
}

export function NodeCard({ node, isOpen, disabled, onToggle, showBetLink }: NodeCardProps) {
  const actualWinnerAbbreviation = useLiveWinnerAbbreviation(node.nodeId, node.actualWinnerAbbreviation);
  // Statut suivi en direct (16/08/2026, correctif) : avant, `node.status`
  // restait l'instantané SSR alors que le vainqueur, lui, était déjà mis à
  // jour en direct — une série qui passait IN_PROGRESS -> FINISHED pendant
  // que la page était ouverte restait affichée "En cours" indéfiniment.
  const liveStatus = useLiveSeriesStatus(node.nodeId, node.status);
  const isFinal = FINAL_ROUNDS.has(node.round);
  const hasChampion = isFinal && actualWinnerAbbreviation !== null;
  // Surbrillance de carte demandée par l'utilisateur (30/07/2026) : série
  // terminée = bordure/fond teintés, en plus du texte déjà coloré du
  // vainqueur (§17 — vert pour un résultat gagné, or réservé au champion,
  // jamais de rouge pour l'équipe battue).
  const isDecided = !isFinal && actualWinnerAbbreviation !== null;
  const isLive = liveStatus === "IN_PROGRESS";
  const isMyPickCorrect =
    node.myPick !== null && actualWinnerAbbreviation !== null && node.myPick.teamAbbreviation === actualWinnerAbbreviation;

  // "En tête" (trend) uniquement pour une série ENCORE en cours ; "vainqueur"
  // (win, vert) uniquement une fois réellement décidée — jamais les deux à
  // la fois, jamais l'un à la place de l'autre (§17).
  const leadingSide: "A" | "B" | null =
    isLive && node.liveScore && node.liveScore.teamAWins !== node.liveScore.teamBWins
      ? node.liveScore.teamAWins > node.liveScore.teamBWins
        ? "A"
        : "B"
      : null;
  const winnerSide: "A" | "B" | null =
    !isLive && actualWinnerAbbreviation !== null
      ? node.teamA?.abbreviation === actualWinnerAbbreviation
        ? "A"
        : node.teamB?.abbreviation === actualWinnerAbbreviation
          ? "B"
          : null
      : null;
  // Score affiché dès que la série a au moins commencé (EN COURS ou
  // TERMINÉE) — cf. lib/queries/bracket.ts, liveScore n'est plus réservé à
  // IN_PROGRESS (18/08/2026, demandé par l'utilisateur).
  const showScoreRow = node.liveScore !== null;

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
  // sur LeaderboardRow.tsx (§ pseudo cliquable). aria-disabled inchangé
  // (jamais l'attribut natif disabled — déjà le cas avant, la carte reste
  // focusable même "désactivée").
  const canBet = showBetLink && node.teamA !== null && node.teamB !== null && node.myBetAction !== null;

  return (
    <div
      id={`series-${node.nodeId}`}
      {...clickableRowProps(onToggle, { disabled })}
      className={cardClassName}
      aria-expanded={isOpen}
      aria-disabled={disabled || undefined}
    >
      {node.conference && <span className={styles.conference}>{CONFERENCE_LABEL[node.conference]}</span>}

      {showScoreRow ? (
        <div className={styles.liveMatchup}>
          {isLive && (
            <span className={styles.liveHeader}>
              <span className={styles.liveTag}>
                <span className={styles.liveDot} aria-hidden="true" />
                En cours
              </span>
              {node.myPick && (
                <span className={styles.myPickLine}>
                  {/* Emplacement EN COURS uniquement (isLive) : jamais FINISHED ici
                      par construction — pas de points à montrer. */}
                  <MyPickContent myPick={node.myPick} isCorrect={isMyPickCorrect} showPoints={false} />
                </span>
              )}
            </span>
          )}
          <SeriesTeamRow
            team={node.teamA}
            wins={node.liveScore?.teamAWins ?? null}
            highlight={leadingSide === "A" ? "trend" : winnerSide === "A" ? "win" : null}
            isChampion={hasChampion && node.teamA?.abbreviation === actualWinnerAbbreviation}
          />
          <SeriesTeamRow
            team={node.teamB}
            wins={node.liveScore?.teamBWins ?? null}
            highlight={leadingSide === "B" ? "trend" : winnerSide === "B" ? "win" : null}
            isChampion={hasChampion && node.teamB?.abbreviation === actualWinnerAbbreviation}
          />
          {hasChampion && <span className={styles.championTag}>Champion</span>}
        </div>
      ) : (
        <div className={styles.matchup}>
          <span className={styles.teams}>
            <TeamLabel team={node.teamA} isChampion={false} isWinner={false} />
            <span className={styles.versus}>–</span>
            <TeamLabel team={node.teamB} isChampion={false} isWinner={false} />
          </span>
        </div>
      )}

      {!isLive && node.myPick && (
        <span className={styles.myPickLine}>
          <MyPickContent myPick={node.myPick} isCorrect={isMyPickCorrect} showPoints={liveStatus === "FINISHED"} />
        </span>
      )}

      {node.myBet && (
        <span className={styles.myPickLine}>
          <MyBetContent myBet={node.myBet} />
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
