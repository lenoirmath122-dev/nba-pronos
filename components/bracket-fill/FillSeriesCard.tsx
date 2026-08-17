"use client";

import { useRef, useState } from "react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { saveBracketPick } from "@/lib/actions/bracket-fill";
import type { BetSeriesFormat, BracketFillSeries } from "@/lib/queries/bracket-fill";
import { InlineBetForm } from "@/components/bets/InlineBetForm";
import styles from "./FillSeriesCard.module.css";

// Carte de remplissage adaptée à une colonne de poster (16/08/2026,
// chantier « remplissage en poster interactif ») — extraite de
// BracketFillBoard.tsx::SeriesPickCard, MÊME logique de saisie (tap
// vainqueur, boutons de score, pari série intégré), mais mise en page
// resserrée pour tenir dans une colonne de poster (13rem,
// SeriesDrillDown.module.css::treeColumn) : équipes empilées verticalement
// au lieu d'une grille 2 colonnes (SeriesPickCard), trop large ici.
//
// `isTarget` (nouveau) : mise en avant visuelle de LA carte ciblée par le
// guidage automatique (FillPosterView.tsx) — même registre que .cardOpen/
// .cardHasPick de NodeCard.module.css (accent additif, jamais une couleur
// de résultat). Pas de callback "pick réussi" à remonter : `saveBracketPick`
// appelle déjà `revalidatePath("/play/bracket")`, qui rafraîchit
// naturellement `data` chez le parent (donc la cible du guidage) sans
// pont client manuel.

const SCORE_FORMATS: BetSeriesFormat[] = ["4-0", "4-1", "4-2", "4-3"];

// ROUND_1 : realTeamA/realTeamB toujours connues dès que la série existe
// (tour racine, colonnes officielles). Tour 2+ : le pari série n'est proposé
// qu'une fois les 2 VRAIES équipes connues, sauf pari déjà posé avant ce
// correctif (04/08/2026) — celui-là reste affiché tel quel plutôt que masqué.
function canOfferSeriesBet(series: BracketFillSeries): boolean {
  return series.round === "ROUND_1" || (series.realTeamA !== null && series.realTeamB !== null) || series.hasBet;
}

type FillSeriesCardProps = {
  series: BracketFillSeries;
  competitionType: "PLAYOFFS" | "NBA_CUP";
  isTarget: boolean;
  onError: (message: string | null) => void;
  /** Côté de colonne dans le poster (posterColumns.ts) — décide de quel
   *  côté du nom d'équipe le menu déroulant du score apparaît, VERS le
   *  centre du poster (17/08/2026, demandé par l'utilisateur : « à gauche
   *  ou à droite » ; ré-ajouté le même jour après le passage au menu
   *  déroulant en face de l'équipe — sans ce prop il apparaissait toujours
   *  à droite, y compris côté Est où le centre du poster est à gauche) :
   *  à droite pour l'Ouest, à gauche pour l'Est. */
  side: "west" | "east";
  /** Ref de mesure pour TreeConnectors.tsx (traits de connexion) — posée
   *  sur `.card`, la SEULE boîte bordée de ce composant. */
  cardRef: (el: HTMLElement | null) => void;
};

export function FillSeriesCard({ series, competitionType, isTarget, onError, side, cardRef }: FillSeriesCardProps) {
  // Resynchronise l'état local sur la valeur serveur pendant le rendu, PAS
  // dans un effet (17/08/2026, bug réel corrigé : useState(initialValue) ne
  // se réinitialise qu'au 1er montage — sans ça, une remise à zéro du
  // bracket, ResetBracketButton, ne se reflétait pas ici tant que le poster
  // n'était pas démonté/remonté). Patron "adjusting state when a prop
  // changes" recommandé par React (évite le cascading-render d'un effet,
  // react-hooks/set-state-in-effect l'interdit ici).
  const pickSignature = `${series.myPick.winnerTeamId ?? ""}|${series.myPick.scoreFormat ?? ""}`;
  const [syncedSignature, setSyncedSignature] = useState(pickSignature);
  const [winnerTeamId, setWinnerTeamId] = useState(series.myPick.winnerTeamId);
  const [scoreFormat, setScoreFormat] = useState(series.myPick.scoreFormat);
  if (pickSignature !== syncedSignature) {
    setSyncedSignature(pickSignature);
    setWinnerTeamId(series.myPick.winnerTeamId);
    setScoreFormat(series.myPick.scoreFormat);
  }
  // File d'attente des sauvegardes (17/08/2026, latence signalée par
  // l'utilisateur entre le tap vainqueur et le tap score) : les 2 taps
  // déclenchent chacun un appel réseau distinct (« vainqueur en 1 tap »,
  // 0.2.9 §5) ; les boutons ne sont plus désactivés pendant l'aller-retour
  // (l'état local optimiste ci-dessus est déjà correct), mais les appels à
  // saveBracketPick DOIVENT rester en série, sinon une réponse en retard du
  // 1er tap (vainqueur seul) pourrait écraser le score du 2e tap si les
  // réponses arrivent dans le désordre.
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  if (!series.isSelectable) {
    return (
      <div id={`series-${series.seriesId}`} ref={cardRef} className={`${styles.card} glass-card`}>
        <p className={styles.pending}>Équipe à définir — complète les séries précédentes.</p>
      </div>
    );
  }

  function pick(nextWinnerTeamId: string, nextScoreFormat: BetSeriesFormat | null) {
    setWinnerTeamId(nextWinnerTeamId);
    setScoreFormat(nextScoreFormat);
    onError(null);
    saveChainRef.current = saveChainRef.current.catch(() => {}).then(async () => {
      const result = await saveBracketPick({
        seriesId: series.seriesId,
        winnerTeamId: nextWinnerTeamId,
        scoreFormat: nextScoreFormat,
      });
      if (!result.success) onError(result.error);
    });
  }

  const cardClassName = [styles.card, "glass-card", isTarget && styles.cardTarget].filter(Boolean).join(" ");

  return (
    <div id={`series-${series.seriesId}`} ref={cardRef} className={cardClassName}>
      <div className={styles.teams}>
        {[series.teamA, series.teamB].map((team) => {
          if (!team) return null;
          const isSelected = winnerTeamId === team.teamId;
          const teamButton = (
            <button
              type="button"
              className={isSelected ? `${styles.team} ${styles.teamSelected}` : styles.team}
              onClick={() => pick(team.teamId, scoreFormat)}
              aria-pressed={isSelected}
            >
              <TeamLogo abbreviation={team.abbreviation} alt={team.name} size={28} />
              <span className={styles.teamName}>{team.name}</span>
            </button>
          );

          // Menu déroulant du score (17/08/2026, demandé par l'utilisateur
          // — avant : 4 boutons empilés à côté de toute la carte) :
          // seulement en face de l'équipe désignée vainqueur, jamais
          // l'autre — VERS le centre du poster, donc à droite du nom pour
          // l'Ouest, à gauche pour l'Est (voir le commentaire sur `side`).
          const scoreSelect =
            competitionType === "PLAYOFFS" && isSelected ? (
              <select
                className={styles.scoreSelect}
                value={scoreFormat ?? ""}
                onChange={(e) => pick(team.teamId, e.target.value as BetSeriesFormat)}
                aria-label={`Score de la série pour ${team.name}`}
              >
                <option value="" disabled>
                  Score
                </option>
                {SCORE_FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </select>
            ) : null;

          return (
            <div key={team.teamId} className={styles.teamRow}>
              {side === "east" ? (
                <>
                  {scoreSelect}
                  {teamButton}
                </>
              ) : (
                <>
                  {teamButton}
                  {scoreSelect}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Pari SÉRIE centralisé ici (demandé par l'utilisateur 28/07/2026 —
          « tout centraliser dans Matchs et Bracket »), même règle que
          SeriesPickCard : porte sur la VRAIE série, jamais sur le
          pronostic du joueur ci-dessus. */}
      {competitionType === "PLAYOFFS" &&
        (canOfferSeriesBet(series) ? (
          <div className={styles.seriesBet}>
            {series.round !== "ROUND_1" && series.realTeamA && series.realTeamB && (
              <p className={styles.seriesBetLabel}>
                Pari : {series.realTeamA.abbreviation} vs {series.realTeamB.abbreviation}
              </p>
            )}
            <InlineBetForm
              scope="SERIES"
              matchId={null}
              seriesId={series.seriesId}
              hasBet={series.hasBet}
              triggerLabel="Proposer un pari"
              myBet={series.myBet}
              presentation="modal"
            />
          </div>
        ) : (
          <p className={styles.pending}>Pari série : équipes réelles pas encore connues.</p>
        ))}
    </div>
  );
}
