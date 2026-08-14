"use client";

import { useState } from "react";
import type { BracketNode, BracketRound } from "@/lib/queries/bracket";
import { NodeCard } from "./NodeCard";
import { SeriesGroups } from "./SeriesGroups";
import { RoundBanner } from "./RoundBanner";
import styles from "./SeriesDrillDown.module.css";

// Drill-down d'une série (§11) : nominatif, groupé par pronostic, UNE SEULE
// série ouverte à la fois. Contenant selon la vue : expansion INLINE en vue A
// (accordéon), FEUILLE PAR LE BAS en vue B (l'arbre est un poster à géométrie
// fixe, une expansion inline y déplacerait toutes les branches). Même état,
// deux rendus — pas de duplication de la règle "une seule ouverte".
//
// REFONTE du 14/08/2026 (demandée par l'utilisateur — layout 2 colonnes,
// séries EN COURS mises en avant) : Vue A uniquement, pour les compétitions
// PLAYOFFS. Chaque tour à conférence (1er tour/demies/finales de conf.)
// s'affiche en 2 COLONNES Ouest | Est côte à côte (plus une liste
// Ouest-puis-Est empilée comme avant) ; la Finale NBA (conférence NULL)
// reste centrée, une seule colonne. Dans CHAQUE colonne : les séries EN
// COURS (status IN_PROGRESS) s'affichent normalement, les autres (pas
// commencées OU terminées) se replient dans un RoundBanner — un bandeau PAR
// COLONNE PAR TOUR, pas un seul bandeau global (maquette validée).
// NBA Cup NON concernée (ses séries n'ont pas de conférence, D6/schéma) :
// garde l'ancien rendu (liste simple, toutes les séries visibles, jamais de
// bandeau) — d'où le nouveau prop `competitionType`.
//
// Vue B (inchangée depuis le 30/07/2026) : pour les Playoffs UNIQUEMENT, les
// colonnes sont réordonnées en "poster" — Ouest à GAUCHE (1er tour → demies
// → finale de conf.), Finale NBA au CENTRE, Est à DROITE (finale de conf. →
// demies → 1er tour). Aucun trait de connexion entre les séries (scope
// réduit, acté avec l'utilisateur) : uniquement un réordonnancement + des
// libellés de colonne explicites.
type SeriesDrillDownProps = {
  rounds: BracketRound[];
  isDeadlinePassed: boolean;
  view: "A" | "B";
  competitionType: "PLAYOFFS" | "NBA_CUP";
  /** Affiche un lien « Parier sur cette série » dans le détail déplié
   *  (04/08/2026, demandé par l'utilisateur) — déjà réduit par l'appelant à
   *  joueur connecté + PLAYOFFS. */
  showBetLink: boolean;
};

function BetLink({ node }: { node: BracketNode }) {
  if (node.teamA === null || node.teamB === null) return null;
  return (
    <a className={styles.betLink} href={`/play/bets/new?seriesId=${node.nodeId}`}>
      Parier sur cette série
    </a>
  );
}

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

export function SeriesDrillDown({ rounds, isDeadlinePassed, view, competitionType, showBetLink }: SeriesDrillDownProps) {
  const [openSeriesId, setOpenSeriesId] = useState<string | null>(null);
  // Bandeaux repliés (14/08/2026) : plusieurs peuvent être ouverts en même
  // temps (contrairement au drill-down ci-dessus) — ce sont des replis de
  // mise en page, pas le détail nominatif d'une série (§11 ne s'applique
  // qu'à openSeriesId).
  const [openBanners, setOpenBanners] = useState<Set<string>>(new Set());

  function handleToggle(nodeId: string) {
    setOpenSeriesId((current) => (current === nodeId ? null : nodeId));
  }

  function toggleBanner(key: string) {
    setOpenBanners((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
            {showBetLink && <BetLink node={node} />}
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
              {showBetLink && <BetLink node={openNode} />}
            </div>
          </>
        )}
      </>
    );
  }

  // NBA Cup : pas concernée par la refonte 2 colonnes / bandeau (ses séries
  // n'ont jamais de conférence) — ancien rendu inchangé, toutes les séries
  // toujours visibles.
  if (competitionType === "NBA_CUP") {
    return (
      <div className={styles.roundsA}>
        {rounds.map((round) => (
          <div key={round.key} className={styles.roundSection}>
            <p className={styles.roundLabel}>{round.label}</p>
            <div className={styles.nodeList}>{round.nodes.map(renderNodeWithInlineDetail)}</div>
          </div>
        ))}
      </div>
    );
  }

  // Playoffs, Vue A : 2 colonnes Ouest | Est par tour à conférence, Finale
  // NBA centrée. Dans chaque colonne, les séries EN COURS restent visibles,
  // le reste se replie dans un RoundBanner dédié à CETTE colonne CE tour.
  // Pas d'en-tête "Ouest"/"Est" par colonne (14/08/2026, retiré — demandé
  // par l'utilisateur) : redondant avec l'étiquette de conférence déjà
  // posée sur CHAQUE carte (NodeCard.tsx, `.conference`), qui reste la
  // seule source de cette info.
  function renderColumn(key: string, nodes: BracketNode[]) {
    const live = nodes.filter((n) => n.status === "IN_PROGRESS");
    const rest = nodes.filter((n) => n.status !== "IN_PROGRESS");
    return (
      <div key={key} className={styles.column}>
        <div className={styles.nodeList}>
          {live.map(renderNodeWithInlineDetail)}
          <RoundBanner
            nodes={rest}
            isOpen={openBanners.has(key)}
            onToggle={() => toggleBanner(key)}
            renderNode={renderNodeWithInlineDetail}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.roundsA}>
      {rounds.map((round) => {
        const roundHasConference = round.nodes.some((n) => n.conference !== null);

        if (roundHasConference) {
          const west = round.nodes.filter((n) => n.conference === "WEST");
          const east = round.nodes.filter((n) => n.conference === "EAST");
          return (
            <div key={round.key} className={styles.roundSection}>
              <p className={styles.roundLabel}>{round.label}</p>
              <div className={styles.cols}>
                {renderColumn(`${round.key}-WEST`, west)}
                {renderColumn(`${round.key}-EAST`, east)}
              </div>
            </div>
          );
        }

        // Finale NBA (conférence NULL) : centrée, une seule colonne.
        return (
          <div key={round.key} className={styles.roundSection}>
            <p className={styles.roundLabel}>{round.label}</p>
            <div className={styles.centerWrap}>
              <div className={styles.centerCol}>{renderColumn(`${round.key}-ALL`, round.nodes)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
