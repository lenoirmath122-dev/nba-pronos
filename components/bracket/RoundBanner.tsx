"use client";

import type { ReactNode } from "react";
import type { BracketNode, BracketSeriesStatus } from "@/lib/queries/bracket";
import { useLiveSeriesMap } from "./LiveSeriesSubscriber";
import styles from "./RoundBanner.module.css";

// Bandeau des séries PAS en cours (14/08/2026, demandé par l'utilisateur) :
// seules les séries EN COURS restent visibles par défaut dans une colonne
// (Ouest/Est) — le reste (terminée ou pas commencée) se replie ici, un
// bandeau par colonne et par tour (pas un seul bandeau global pour tout
// l'écran, cf. la maquette validée). Fermé par défaut ; ouvert, chaque série
// repliée se rend comme une carte normale via `renderNode` — fourni par le
// parent (SeriesDrillDown) pour garder le state "une seule série ouverte à
// la fois" (§11) centralisé à un seul endroit.
//
// Statut lu en direct (16/08/2026, même correctif que NodeCard/
// SeriesDrillDown) : `node.status` seul, ici, resterait l'instantané SSR —
// une série qui bascule EN_COURS -> FINISHED pendant que le bandeau est
// replié afficherait encore "à venir"/rien pour l'étiquette de la puce, alors
// que la carte elle-même (une fois dépliée) montre déjà le bon vainqueur.
// `finalScoreFormat` n'est PAS diffusé en direct (seuls le statut et le
// vainqueur le sont, cf. LiveSeriesSubscriber) : une série qui vient de
// passer FINISHED affiche donc "terminé" sans le score tant que la page
// n'est pas rechargée — écart mineur, cohérent avec NodeCard qui n'affiche
// pas non plus de score final en direct.

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "à venir",
  POSTPONED: "reportée",
  CANCELLED: "annulée",
};

function chipLabel(node: BracketNode, status: BracketSeriesStatus): string {
  const teamA = node.teamA?.abbreviation ?? "?";
  const teamB = node.teamB?.abbreviation ?? "?";
  if (status === "FINISHED") {
    return `${teamA} vs ${teamB} · terminé${node.finalScoreFormat ? ` ${node.finalScoreFormat}` : ""}`;
  }
  if (node.teamA === null || node.teamB === null) {
    return `${teamA} vs ${teamB} · affiche pas connue`;
  }
  return `${teamA} vs ${teamB} · ${STATUS_LABEL[status] ?? "à venir"}`;
}

type RoundBannerProps = {
  nodes: BracketNode[];
  isOpen: boolean;
  onToggle: () => void;
  renderNode: (node: BracketNode) => ReactNode;
};

export function RoundBanner({ nodes, isOpen, onToggle, renderNode }: RoundBannerProps) {
  const liveSeriesMap = useLiveSeriesMap();
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
          {nodes.map((node) => {
            const status = liveSeriesMap.get(node.nodeId)?.status ?? node.status;
            return (
              <span key={node.nodeId} className={status === "FINISHED" ? `${styles.chip} ${styles.chipDone}` : styles.chip}>
                {chipLabel(node, status)}
              </span>
            );
          })}
        </div>
      )}

      {isOpen && <div className={styles.expanded}>{nodes.map(renderNode)}</div>}
    </div>
  );
}
