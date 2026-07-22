"use client";

import { useState } from "react";
import type { BracketRound } from "@/lib/queries/bracket";
import { NodeCard } from "./NodeCard";
import { SeriesGroups } from "./SeriesGroups";
import styles from "./SeriesDrillDown.module.css";

// Drill-down d'une série (§11) : nominatif, groupé par pronostic, UNE SEULE
// série ouverte à la fois. Contenant selon la vue : expansion INLINE en vue A
// (accordéon), FEUILLE PAR LE BAS en vue B (l'arbre est un poster à géométrie
// fixe, une expansion inline y déplacerait toutes les branches). Même état,
// deux rendus — pas de duplication de la règle "une seule ouverte".
type SeriesDrillDownProps = {
  rounds: BracketRound[];
  isDeadlinePassed: boolean;
  view: "A" | "B";
};

export function SeriesDrillDown({ rounds, isDeadlinePassed, view }: SeriesDrillDownProps) {
  const [openSeriesId, setOpenSeriesId] = useState<string | null>(null);

  function handleToggle(nodeId: string) {
    setOpenSeriesId((current) => (current === nodeId ? null : nodeId));
  }

  if (view === "B") {
    const openNode = rounds.flatMap((round) => round.nodes).find((node) => node.nodeId === openSeriesId);

    return (
      <>
        <div className={styles.roundsB}>
          {rounds.map((round) => (
            <div key={round.key} className={styles.treeColumn}>
              <p className={styles.roundLabel}>{round.label}</p>
              {round.nodes.map((node) => (
                <NodeCard
                  key={node.nodeId}
                  node={node}
                  isOpen={node.nodeId === openSeriesId}
                  disabled={!isDeadlinePassed && node.groups.length === 0}
                  onToggle={() => handleToggle(node.nodeId)}
                />
              ))}
            </div>
          ))}
        </div>

        {openNode && (
          <>
            <div className={styles.sheetBackdrop} onClick={() => setOpenSeriesId(null)} />
            <div className={styles.sheet} role="dialog" aria-label="Détail de la série">
              <div className={styles.sheetHeader}>
                <p className={styles.sheetTitle}>
                  {openNode.teamA?.abbreviation ?? "—"} – {openNode.teamB?.abbreviation ?? "—"}
                </p>
                <button
                  type="button"
                  className={styles.sheetClose}
                  onClick={() => setOpenSeriesId(null)}
                  aria-label="Fermer"
                >
                  ×
                </button>
              </div>
              <SeriesGroups groups={openNode.groups} />
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <div className={styles.roundsA}>
      {rounds.map((round) => (
        <div key={round.key} className={styles.roundSection}>
          <p className={styles.roundLabel}>{round.label}</p>
          <div className={styles.nodeList}>
            {round.nodes.map((node) => (
              <div key={node.nodeId}>
                <NodeCard
                  node={node}
                  isOpen={node.nodeId === openSeriesId}
                  disabled={!isDeadlinePassed && node.groups.length === 0}
                  onToggle={() => handleToggle(node.nodeId)}
                />
                {node.nodeId === openSeriesId && (
                  <div className={styles.inlineDetail}>
                    <SeriesGroups groups={node.groups} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
