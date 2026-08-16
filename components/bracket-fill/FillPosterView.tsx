"use client";

import { useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { validateBracket } from "@/lib/actions/bracket-fill";
import type { BracketFillData, BracketFillSeries } from "@/lib/queries/bracket-fill";
import { buildMirroredPosterColumns, type PosterColumn } from "@/components/bracket/posterColumns";
import { TreeConnectors } from "@/components/bracket/TreeConnectors";
import { FillSeriesCard } from "./FillSeriesCard";
import styles from "./FillPosterView.module.css";

// Mode principal du remplissage sur desktop/paysage (16/08/2026, demandé
// par l'utilisateur — « plus raccord avec ce qui se fait dans le monde du
// basket/NBA », même chantier que la consultation). Reprend la géométrie
// de poster ET les traits de connexion déjà généralisés
// (components/bracket/posterColumns.ts, TreeConnectors.tsx), mais avec des
// cartes INTERACTIVES (FillSeriesCard.tsx, formulaire de pick) plutôt que
// de simple lecture (NodeCard.tsx). Rendu par BracketFillView.tsx, qui
// porte la bascule desktop/paysage (useImmersiveDefault) — ce composant ne
// s'occupe QUE du poster lui-même.
//
// Guidage automatique (choisi par l'utilisateur parmi 3 options — « poster
// comme mode principal, guidage conservé ») : scrolle vers la 1ère série
// SÉLECTIONNABLE pas encore pickée, au montage ET à chaque fois qu'elle
// change. Pas de pont client manuel pour recalculer après un pick :
// `saveBracketPick` (lib/actions/bracket-fill.ts) appelle déjà
// `revalidatePath("/play/bracket")`, qui rafraîchit `data` ici
// naturellement — le recalcul suit le flux normal des props.

type FillPosterViewProps = {
  data: BracketFillData;
  onExit: () => void;
};

// Ordre de rendu du poster (Ouest haut→bas colonne par colonne, puis
// centre, puis Est) — gère naturellement la cascade : une série de tour 2+
// pas encore sélectionnable est simplement ignorée jusqu'à ce qu'elle le
// devienne (candidats connus via computeCandidateTeamIds côté serveur).
function findNextIncomplete(columns: PosterColumn<BracketFillSeries>[]): string | null {
  for (const column of columns) {
    for (const series of column.items) {
      if (series.isSelectable && series.myPick.winnerTeamId === null) {
        return series.seriesId;
      }
    }
  }
  return null;
}

export function FillPosterView({ data, onExit }: FillPosterViewProps) {
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const hasConferences = data.rounds.some((round) => round.series.some((s) => s.conference !== null));
  const columns: PosterColumn<BracketFillSeries>[] = hasConferences
    ? buildMirroredPosterColumns(data.rounds.map((round) => ({ key: round.key, label: round.label, items: round.series })))
    : data.rounds.map((round) => ({ key: round.key, label: round.label, items: round.series, side: "west" as const }));

  const targetSeriesId = useMemo(() => findNextIncomplete(columns), [columns]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRefsMap = useRef<Map<string, HTMLElement>>(new Map());
  function registerCard(seriesId: string, el: HTMLElement | null) {
    if (el) cardRefsMap.current.set(seriesId, el);
    else cardRefsMap.current.delete(seriesId);
  }

  useLayoutEffect(() => {
    if (!targetSeriesId) return;
    cardRefsMap.current.get(targetSeriesId)?.scrollIntoView({ block: "center", inline: "center" });
  }, [targetSeriesId]);

  function handleValidate() {
    setError(null);
    startTransition(async () => {
      const result = await validateBracket();
      setShowConfirm(false);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <div>
          <p className={styles.title}>Mon bracket</p>
          <p className={styles.progress}>
            {data.filledCount}/{data.totalCount} séries
          </p>
        </div>
        <button type="button" className={styles.close} onClick={onExit}>
          × Quitter
        </button>
      </div>

      <div className={styles.roundsB}>
        <div ref={containerRef} className={styles.roundsBInner}>
          {columns.map((column) => (
            <div key={column.key} className={styles.treeColumn}>
              <p className={styles.roundLabel}>{column.label}</p>
              {column.items.map((series) => (
                <div key={series.seriesId} ref={(el) => registerCard(series.seriesId, el)}>
                  <FillSeriesCard
                    series={series}
                    competitionType={data.competitionType}
                    isTarget={series.seriesId === targetSeriesId}
                    onError={setError}
                  />
                </div>
              ))}
            </div>
          ))}
          <TreeConnectors
            columns={columns}
            getId={(series) => series.seriesId}
            getNextId={(series) => series.nextSeriesId}
            containerRef={containerRef}
            cardRefs={cardRefsMap}
          />
        </div>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.validateRow}>
        {data.isValidated ? (
          <p className={styles.validatedNote}>
            Bracket validé{data.isAutoValidated ? " automatiquement" : ""} — reste modifiable jusqu&rsquo;à la deadline.
          </p>
        ) : (
          <button type="button" className={styles.validateButton} onClick={() => setShowConfirm(true)}>
            Valider mon bracket
          </button>
        )}
      </div>

      {showConfirm &&
        createPortal(
          <div className={styles.backdrop} role="presentation">
            <div
              className={styles.dialog}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="validate-bracket-poster-title"
            >
              <p id="validate-bracket-poster-title" className={styles.dialogTitle}>
                Valider ton bracket ?
              </p>
              <p className={styles.dialogBody}>
                Ton bracket reste modifiable jusqu&rsquo;à la deadline, même après validation — tu peux revenir
                corriger un pick à tout moment avant ça.
              </p>
              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className={styles.dialogCancel}
                  onClick={() => setShowConfirm(false)}
                  disabled={isPending}
                >
                  Annuler
                </button>
                <button type="button" className={styles.dialogConfirm} onClick={handleValidate} disabled={isPending}>
                  Valider
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
