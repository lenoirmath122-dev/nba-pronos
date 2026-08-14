"use client";

import type { ReactNode } from "react";
import type { BracketNode } from "@/lib/queries/bracket";
import styles from "./RoundBanner.module.css";

// Bandeau des séries PAS en cours (14/08/2026, demandé par l'utilisateur) :
// seules les séries EN COURS restent visibles par défaut dans une colonne
// (Ouest/Est) — le reste (terminée ou pas commencée) se replie ici, un
// bandeau par colonne et par tour (pas un seul bandeau global pour tout
// l'écran, cf. la maquette validée). Fermé par défaut ; ouvert, chaque série
// repliée se rend comme une carte normale via `renderNode` — fourni par le
// parent (SeriesDrillDown) pour garder le state "une seule série ouverte à
// la fois" (§11) centralisé à un seul endroit.

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "à venir",
  POSTPONED: "reportée",
  CANCELLED: "annulée",
};

function chipLabel(node: BracketNode): string {
  const teamA = node.teamA?.abbreviation ?? "?";
  const teamB = node.teamB?.abbreviation ?? "?";
  if (node.status === "FINISHED") {
    return `${teamA} vs ${teamB} · terminé${node.finalScoreFormat ? ` ${node.finalScoreFormat}` : ""}`;
  }
  if (node.teamA === null || node.teamB === null) {
    return `${teamA} vs ${teamB} · affiche pas connue`;
  }
  return `${teamA} vs ${teamB} · ${STATUS_LABEL[node.status] ?? "à venir"}`;
}

type RoundBannerProps = {
  nodes: BracketNode[];
  isOpen: boolean;
  onToggle: () => void;
  renderNode: (node: BracketNode) => ReactNode;
};

export function RoundBanner({ nodes, isOpen, onToggle, renderNode }: RoundBannerProps) {
  if (nodes.length === 0) return null;

  return (
    <div className={styles.banner}>
      <button type="button" className={styles.head} onClick={onToggle} aria-expanded={isOpen}>
        <span>
          {nodes.length} série{nodes.length > 1 ? "s" : ""} repliée{nodes.length > 1 ? "s" : ""}
        </span>
        <span className={isOpen ? styles.chevOpen : styles.chev} aria-hidden="true">
          ▾
        </span>
      </button>

      {!isOpen && (
        <div className={styles.chips}>
          {nodes.map((node) => (
            <span
              key={node.nodeId}
              className={node.status === "FINISHED" ? `${styles.chip} ${styles.chipDone}` : styles.chip}
            >
              {chipLabel(node)}
            </span>
          ))}
        </div>
      )}

      {isOpen && <div className={styles.expanded}>{nodes.map(renderNode)}</div>}
    </div>
  );
}
