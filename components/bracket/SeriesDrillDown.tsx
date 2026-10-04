"use client";

import { useEffect, useRef, useState } from "react";
import type { BracketNode, BracketRound } from "@/lib/queries/bracket";
import { NodeCard } from "./NodeCard";
import { SeriesGroups } from "./SeriesGroups";
import { BetBlock } from "@/components/play/BetBlock";
import { TreeConnectors } from "./TreeConnectors";
import { buildMirroredPosterColumns, type PosterColumn } from "./posterColumns";
import { FocusTrap } from "@/components/ui/FocusTrap";
import styles from "./SeriesDrillDown.module.css";

// Arbre du bracket de consultation + drill-down d'une série (§11) :
// nominatif, groupé par pronostic, UNE SEULE série ouverte à la fois, dans
// une FEUILLE PAR LE BAS (l'arbre est un poster à géométrie fixe, une
// expansion inline y déplacerait toutes les branches).
//
// Seul rendu depuis le 04/10/2026 (retour de l'alpha, suite de p3-4 :
// « garder seulement l'arbre visuel, supprimer la vue en cartes ») —
// l'ancienne Vue A (liste par tour, 2 colonnes Ouest | Est, bandeaux
// RoundBanner repliés) a été retirée avec le prop `view`.
//
// Pour les Playoffs, les colonnes sont réordonnées en "poster" — Ouest à
// GAUCHE (1er tour → demies → finale de conf.), Finale NBA au CENTRE, Est à
// DROITE (finale de conf. → demies → 1er tour). NBA Cup (aucune conférence) :
// une colonne par tour, de gauche à droite. Traits de connexion entre
// séries : voir TreeConnectors.tsx.
type SeriesDrillDownProps = {
  rounds: BracketRound[];
  isDeadlinePassed: boolean;
  /** Affiche un lien « Parier sur cette série » dans le détail déplié
   *  (04/08/2026, demandé par l'utilisateur) — déjà réduit par l'appelant à
   *  joueur connecté + PLAYOFFS. */
  showBetLink: boolean;
};

export function SeriesDrillDown({ rounds, isDeadlinePassed, showBetLink }: SeriesDrillDownProps) {
  const [openSeriesId, setOpenSeriesId] = useState<string | null>(null);

  // Arbre connecté (16/08/2026) : conteneur de
  // mesure pour TreeConnectors.tsx + Map des nœuds DOM des cartes montées,
  // remplie via `registerCard` ci-dessous au montage/démontage de chaque
  // carte. Map mutable en dehors de React (pas un state) — TreeConnectors
  // la lit directement dans son effet, aucun re-rendu n'est nécessaire ici
  // quand une carte s'enregistre.
  const treeContainerRef = useRef<HTMLDivElement | null>(null);
  const cardRefsMap = useRef<Map<string, HTMLElement>>(new Map());
  function registerCard(nodeId: string, el: HTMLElement | null) {
    if (el) cardRefsMap.current.set(nodeId, el);
    else cardRefsMap.current.delete(nodeId);
  }
  // Nœuds DOM des libellés de tour, keyed par `column.key` — même patron que
  // `registerCard` ci-dessus, pour que TreeConnectors.tsx puisse repositionner
  // chaque libellé au-dessus de sa colonne une fois les cartes alignées
  // (17/08/2026, bug réel corrigé : un libellé pouvait finir affiché SOUS ou
  // À TRAVERS la 1re carte de sa propre colonne).
  const labelRefsMap = useRef<Map<string, HTMLElement>>(new Map());
  function registerLabel(columnKey: string, el: HTMLElement | null) {
    if (el) labelRefsMap.current.set(columnKey, el);
    else labelRefsMap.current.delete(columnKey);
  }

  // Ancre `#series-X` du chargement (liens « pari série » de l'Accueil, posée
  // par NodeCard ; à l'origine `#round-X`, 16/08/2026) : constaté en testant que
  // le scroll natif du navigateur vers la cible n'a PAS lieu après une
  // redirection serveur suivie de l'hydratation Next.js (`window.scrollY`
  // restait à 0 alors que l'élément existait bien) — reconstitué à la main
  // au montage plutôt que de compter sur le comportement natif du fragment.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "center", inline: "center" });
  }, []);

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
        showBetLink={showBetLink}
      />
    );
  }

  // Séries de conférence (Playoffs) vs Cup, qui n'a jamais de conférence
  // (D6/schéma T1) — décide s'il y a quoi que ce soit à scinder/miroiter.
  const hasConferences = rounds.some((round) => round.nodes.some((node) => node.conference !== null));

  const openNode = rounds.flatMap((round) => round.nodes).find((node) => node.nodeId === openSeriesId);
  const columns: PosterColumn<BracketNode>[] = hasConferences
    ? buildMirroredPosterColumns(rounds.map((round) => ({ key: round.key, label: round.label, items: round.nodes })))
    : rounds.map((round) => ({ key: round.key, label: round.label, items: round.nodes, side: "west" as const }));

  return (
    <>
      <div className={styles.roundsB}>
        <div ref={treeContainerRef} className={styles.roundsBInner}>
          {columns.map((column) => (
            <div key={column.key} className={styles.treeColumn}>
              <p className={styles.roundLabel} ref={(el) => registerLabel(column.key, el)}>
                {column.label}
              </p>
              {column.items.map((node) => (
                <div key={node.nodeId} ref={(el) => registerCard(node.nodeId, el)}>
                  {renderNode(node)}
                </div>
              ))}
            </div>
          ))}
          <TreeConnectors
            columns={columns}
            getId={(node) => node.nodeId}
            getNextId={(node) => node.nextSeriesId}
            containerRef={treeContainerRef}
            cardRefs={cardRefsMap}
            labelRefs={labelRefsMap}
          />
        </div>
      </div>

      {openNode && (
        <>
          {/* aria-hidden : scrim mouse-only, Échap (FocusTrap) et le bouton "Fermer" couvrent déjà le clavier. */}
          <div className={styles.sheetBackdrop} aria-hidden="true" onClick={() => setOpenSeriesId(null)} />
          <FocusTrap
            className={styles.sheet}
            role="dialog"
            aria-label="Détail de la série"
            onClose={() => setOpenSeriesId(null)}
          >
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
            {showBetLink && openNode.myBet && <BetBlock bet={openNode.myBet} returnTo="/bracket" />}
            <SeriesGroups groups={openNode.groups} />
          </FocusTrap>
        </>
      )}
    </>
  );
}
