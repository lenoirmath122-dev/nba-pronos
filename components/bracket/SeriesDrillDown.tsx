"use client";

import { useEffect, useRef, useState } from "react";
import type { BracketNode, BracketRound } from "@/lib/queries/bracket";
import { NodeCard } from "./NodeCard";
import { useLiveSeriesMap } from "./LiveSeriesSubscriber";
import { SeriesGroups } from "./SeriesGroups";
import { BetBlock } from "@/components/play/BetBlock";
import { RoundBanner } from "./RoundBanner";
import { TreeConnectors } from "./TreeConnectors";
import { buildMirroredPosterColumns, type PosterColumn } from "./posterColumns";
import { FocusTrap } from "@/components/ui/FocusTrap";
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
// Vue B (poster depuis le 30/07/2026) : pour les Playoffs UNIQUEMENT, les
// colonnes sont réordonnées en "poster" — Ouest à GAUCHE (1er tour → demies
// → finale de conf.), Finale NBA au CENTRE, Est à DROITE (finale de conf. →
// demies → 1er tour). Traits de connexion entre séries (16/08/2026, chantier
// « bracket en arbre visuel connecté » — le réordonnancement seul, sans
// trait, était un scope réduit acté le 30/07/2026, revu depuis) : voir
// TreeConnectors.tsx.
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

export function SeriesDrillDown({ rounds, isDeadlinePassed, view, competitionType, showBetLink }: SeriesDrillDownProps) {
  const [openSeriesId, setOpenSeriesId] = useState<string | null>(null);
  // Même correctif que NodeCard (16/08/2026) : le regroupement "en cours" vs
  // "replié" doit suivre le statut live, pas l'instantané SSR `node.status`,
  // sinon une série qui se termine en direct reste coincée dans la colonne
  // "en cours" jusqu'au rechargement.
  const liveSeriesMap = useLiveSeriesMap();
  const liveNodeStatus = (node: BracketNode) => liveSeriesMap.get(node.nodeId)?.status ?? node.status;
  // Bandeaux repliés (14/08/2026) : plusieurs peuvent être ouverts en même
  // temps (contrairement au drill-down ci-dessus) — ce sont des replis de
  // mise en page, pas le détail nominatif d'une série (§11 ne s'applique
  // qu'à openSeriesId).
  const [openBanners, setOpenBanners] = useState<Set<string>>(new Set());

  // Vue B uniquement (16/08/2026, chantier arbre connecté) : conteneur de
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

  // Ancre `#round-X` du chargement (16/08/2026, correctif de la redirection
  // `/play/bracket?round=X` -> `/bracket#round-X`) : constaté en testant que
  // le scroll natif du navigateur vers la cible n'a PAS lieu après une
  // redirection serveur suivie de l'hydratation Next.js (`window.scrollY`
  // restait à 0 alors que l'élément existait bien) — reconstitué à la main
  // au montage plutôt que de compter sur le comportement natif du fragment.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, []);

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
        showBetLink={showBetLink}
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
            {/* Pari SÉRIE déjà engagé (VALIDATED/WON/LOST), lecture seule --
                bug réel corrigé le 23/08/2026 : ce contenu n'avait aucun
                affichage nulle part depuis la suppression de l'ancien écran
                "Mes paris" (cf. commentaire de BracketNode::myBet). Affiché
                seulement au clic (comme SeriesGroups), pas en permanence sur
                la carte, sur demande explicite de l'utilisateur. */}
            {showBetLink && node.myBet && <BetBlock bet={node.myBet} returnTo="/bracket" />}
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
            <div className={styles.sheetBackdrop} onClick={() => setOpenSeriesId(null)} />
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

  // NBA Cup : pas concernée par la refonte 2 colonnes / bandeau (ses séries
  // n'ont jamais de conférence) — ancien rendu inchangé, toutes les séries
  // toujours visibles.
  // `id={round-${round.key}}` sur chaque section (16/08/2026, bug d'audit
  // corrigé) : ancre de scroll pour `/play/bracket?round=X` → `/bracket
  // #round-X` après la deadline (app/(app)/play/bracket/page.tsx), qui
  // redirigeait auparavant vers `/bracket` en perdant `round` en route.
  if (competitionType === "NBA_CUP") {
    return (
      <div className={styles.roundsA}>
        {rounds.map((round) => (
          <div key={round.key} id={`round-${round.key}`} className={styles.roundSection}>
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
    const live = nodes.filter((n) => liveNodeStatus(n) === "IN_PROGRESS");
    const rest = nodes.filter((n) => liveNodeStatus(n) !== "IN_PROGRESS");
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
          // Garde-fou (16/08/2026, bug d'audit corrigé) : un nœud SANS
          // conférence dans un tour qui en contient par ailleurs (aucun cas
          // réel aujourd'hui, mais rien ne le garantit côté type/requête)
          // disparaissait silencieusement — ni dans Ouest ni dans Est.
          // Rendu à part, centré (même style que la Finale NBA plus bas),
          // plutôt que perdu.
          const rest = round.nodes.filter((n) => n.conference === null);
          return (
            <div key={round.key} id={`round-${round.key}`} className={styles.roundSection}>
              <p className={styles.roundLabel}>{round.label}</p>
              <div className={styles.cols}>
                {renderColumn(`${round.key}-WEST`, west)}
                {renderColumn(`${round.key}-EAST`, east)}
              </div>
              {rest.length > 0 && (
                <div className={styles.centerWrap}>
                  <div className={styles.centerCol}>{renderColumn(`${round.key}-REST`, rest)}</div>
                </div>
              )}
            </div>
          );
        }

        // Finale NBA (conférence NULL) : centrée, une seule colonne.
        return (
          <div key={round.key} id={`round-${round.key}`} className={styles.roundSection}>
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
