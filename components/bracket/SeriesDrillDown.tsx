"use client";

import { useState } from "react";
import type { BracketNode, BracketRound } from "@/lib/queries/bracket";
import { NodeCard } from "./NodeCard";
import { SeriesGroups } from "./SeriesGroups";
import styles from "./SeriesDrillDown.module.css";

// Drill-down d'une série (§11) : nominatif, groupé par pronostic, UNE SEULE
// série ouverte à la fois. Contenant selon la vue : expansion INLINE en vue A
// (accordéon), FEUILLE PAR LE BAS en vue B (l'arbre est un poster à géométrie
// fixe, une expansion inline y déplacerait toutes les branches). Même état,
// deux rendus — pas de duplication de la règle "une seule ouverte".
//
// REFONTE du 30/07/2026 (demandée par l'utilisateur : Est/Ouest mélangés
// dans une même liste, pas assez lisible) :
// - Vue A : chaque tour à conférence (1er tour/demies/finales de conf.) se
//   scinde en 2 sous-groupes "Ouest" puis "Est" — la Finale NBA (conférence
//   NULL) et les tours NBA Cup (jamais de conférence, D6/schéma) restent une
//   liste simple, inchangés.
// - Vue B : pour les Playoffs UNIQUEMENT (la NBA Cup n'a pas de conférence,
//   rien à faire miroir), les colonnes sont réordonnées en "poster" —
//   Ouest à GAUCHE (1er tour → demies → finale de conf.), Finale NBA au
//   CENTRE, Est à DROITE (finale de conf. → demies → 1er tour), demandé
//   explicitement par l'utilisateur. Aucun trait de connexion entre les
//   séries (scope réduit, acté avec l'utilisateur — un chantier à part si
//   besoin plus tard) : uniquement un réordonnancement + des libellés de
//   colonne explicites.
type SeriesDrillDownProps = {
  rounds: BracketRound[];
  isDeadlinePassed: boolean;
  view: "A" | "B";
};

type Column = { key: string; label: string; nodes: BracketNode[] };

const PLAYOFF_ROUND_ORDER = ["ROUND_1", "CONF_SEMIS", "CONF_FINALS"] as const;

function buildMirroredColumns(rounds: BracketRound[]): Column[] {
  const byKey = new Map(rounds.map((r) => [r.key, r]));
  const finals = byKey.get("NBA_FINALS");

  const west: Column[] = PLAYOFF_ROUND_ORDER.map((key) => {
    const round = byKey.get(key);
    return {
      key: `${key}-WEST`,
      label: round ? `${round.label} — Ouest` : "Ouest",
      nodes: round?.nodes.filter((n) => n.conference === "WEST") ?? [],
    };
  });

  const east: Column[] = [...PLAYOFF_ROUND_ORDER]
    .reverse()
    .map((key) => {
      const round = byKey.get(key);
      return {
        key: `${key}-EAST`,
        label: round ? `${round.label} — Est` : "Est",
        nodes: round?.nodes.filter((n) => n.conference === "EAST") ?? [],
      };
    });

  const center: Column = { key: "NBA_FINALS", label: finals?.label ?? "Finale NBA", nodes: finals?.nodes ?? [] };

  return [...west, center, ...east];
}

export function SeriesDrillDown({ rounds, isDeadlinePassed, view }: SeriesDrillDownProps) {
  const [openSeriesId, setOpenSeriesId] = useState<string | null>(null);

  function handleToggle(nodeId: string) {
    setOpenSeriesId((current) => (current === nodeId ? null : nodeId));
  }

  function renderNode(node: BracketNode) {
    return (
      <NodeCard
        key={node.nodeId}
        node={node}
        isOpen={node.nodeId === openSeriesId}
        disabled={!isDeadlinePassed && node.groups.length === 0}
        onToggle={() => handleToggle(node.nodeId)}
      />
    );
  }

  // Vue A uniquement : carte + détail déplié inline, juste en dessous
  // (§11 — la même règle "une seule série ouverte" que la vue B, rendue
  // différemment).
  function renderNodeWithInlineDetail(node: BracketNode) {
    return (
      <div key={node.nodeId}>
        {renderNode(node)}
        {node.nodeId === openSeriesId && (
          <div className={styles.inlineDetail}>
            <SeriesGroups groups={node.groups} />
          </div>
        )}
      </div>
    );
  }

  // Séries de conférence (Playoffs) vs Cup, qui n'a jamais de conférence
  // (D6/schéma T1) — décide s'il y a quoi que ce soit à scinder/miroiter.
  const hasConferences = rounds.some((round) => round.nodes.some((node) => node.conference !== null));

  if (view === "B") {
    const openNode = rounds.flatMap((round) => round.nodes).find((node) => node.nodeId === openSeriesId);
    const columns: Column[] = hasConferences
      ? buildMirroredColumns(rounds)
      : rounds.map((round) => ({ key: round.key, label: round.label, nodes: round.nodes }));

    return (
      <>
        <div className={styles.roundsB}>
          {columns.map((column) => (
            <div key={column.key} className={styles.treeColumn}>
              <p className={styles.roundLabel}>{column.label}</p>
              {column.nodes.map(renderNode)}
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
      {rounds.map((round) => {
        const west = round.nodes.filter((n) => n.conference === "WEST");
        const east = round.nodes.filter((n) => n.conference === "EAST");
        const rest = round.nodes.filter((n) => n.conference === null);

        return (
          <div key={round.key} className={styles.roundSection}>
            <p className={styles.roundLabel}>{round.label}</p>

            {west.length > 0 && (
              <>
                <p className={styles.confLabel}>Ouest</p>
                <div className={styles.nodeList}>{west.map(renderNodeWithInlineDetail)}</div>
              </>
            )}

            {east.length > 0 && (
              <>
                <p className={styles.confLabel}>Est</p>
                <div className={styles.nodeList}>{east.map(renderNodeWithInlineDetail)}</div>
              </>
            )}

            {rest.length > 0 && <div className={styles.nodeList}>{rest.map(renderNodeWithInlineDetail)}</div>}
          </div>
        );
      })}
    </div>
  );
}
