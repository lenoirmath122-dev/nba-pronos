"use client";

import { useLayoutEffect, useState, type RefObject } from "react";
import type { PosterColumn } from "./posterColumns";
import { useLiveSeriesMap } from "./LiveSeriesSubscriber";
import styles from "./TreeConnectors.module.css";

// Traits reliant chaque série à celle qu'elle alimente, poster uniquement
// (16/08/2026, chantier « bracket en arbre visuel connecté » — jusqu'ici
// scope réduit, aucun trait, décision du 30/07/2026). La hauteur des cartes
// n'est PAS fixe (NodeCard.module.css : en cours/terminé/pronostic/bouton
// Parier font varier la hauteur) — positionnement en CSS pur impossible,
// d'où une mesure DOM réelle (`getBoundingClientRect`) plutôt qu'un calcul
// géométrique a priori. Pas de librairie de graphes (aucune dans ce projet,
// même choix que RankEvolutionChart.tsx) : SVG à la main, coordonnées en
// pixels réels (pas de viewBox — le SVG occupe exactement la même boîte que
// son conteneur `position: relative`, donc 1 unité SVG = 1px CSS).
//
// Généralisé sur le TYPE de nœud le 16/08/2026 (chantier « remplissage en
// poster interactif ») via `getId`/`getNextId` plutôt qu'un nom de champ
// fixe : BracketNode (lib/queries/bracket.ts) utilise `nodeId`,
// BracketFillSeries (lib/queries/bracket-fill.ts) utilise `seriesId` — pas
// de nom commun aux 2 domaines, donc un extracteur plutôt qu'une forme
// structurelle imposée.

type TreeConnectorsProps<T> = {
  columns: PosterColumn<T>[];
  getId: (item: T) => string;
  getNextId: (item: T) => string | null;
  containerRef: RefObject<HTMLDivElement | null>;
  // RefObject, jamais la Map déréférencée (`.current`) au niveau du parent
  // (règle react-hooks/refs — lire `.current` pendant le rendu est interdit,
  // seulement dans un effet/handler) : déréférencée ICI, dans l'effet.
  cardRefs: RefObject<Map<string, HTMLElement>>;
  /** Nœuds DOM des libellés de tour (`<p>` au-dessus de chaque colonne),
   *  keyed par `column.key` — repositionnés (17/08/2026, bug réel signalé
   *  par l'utilisateur) pour suivre la carte la plus haute de leur colonne
   *  APRÈS l'alignement ci-dessous : sans ça, un libellé garde sa position
   *  flex naturelle pendant que ses cartes se déplacent, et peut finir
   *  affiché SOUS ou À TRAVERS la 1re carte de sa propre colonne. */
  labelRefs: RefObject<Map<string, HTMLElement>>;
};

type ConnectorPath = { id: string; d: string };

export function TreeConnectors<T>({ columns, getId, getNextId, containerRef, cardRefs, labelRefs }: TreeConnectorsProps<T>) {
  const [paths, setPaths] = useState<ConnectorPath[]>([]);
  // Une carte peut changer de HAUTEUR sans que le conteneur ne change de
  // taille (ex. une série qui bascule EN_COURS -> TERMINÉ en direct, cf. le
  // correctif LiveSeriesSubscriber de cette session) — le ResizeObserver
  // posé sur les cartes couvre ce cas, `liveSeriesMap` en dépendance déclenche
  // un recalcul dès l'événement Realtime, avant même que le DOM n'ait fini
  // de se redimensionner au prochain tick.
  const liveSeriesMap = useLiveSeriesMap();

  useLayoutEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    // `containerRef.current` peut être encore `null` au tout 1er passage de
    // cet effet, malgré la garantie habituelle "le ref est posé avant que
    // les effets ne s'exécutent" — constaté en conditions réelles sur cet
    // écran précis (hydratation Next.js d'un arbre profond avec beaucoup de
    // cartes/refs). Plutôt que d'abandonner, on réessaie au prochain repaint
    // (`requestAnimationFrame`) jusqu'à ce que le conteneur soit disponible.
    function setup() {
      if (cancelled) return;
      const container = containerRef.current;
      if (!container) {
        requestAnimationFrame(setup);
        return;
      }
      const cardsById = cardRefs.current;

      // Aligne chaque carte "fusion" (2 séries qui en alimentent 1 seule
      // suivante) sur le milieu vertical de ses 2 séries d'origine
      // (17/08/2026, demandé par l'utilisateur : « la carte demi-finale
      // pile entre les 2 1er tours qui en sont à l'origine » — même
      // principe étendu à toute fusion 2->1, pas seulement les demies,
      // sinon la finale de conf./Finale NBA resteraient visuellement
      // désalignées). Tri topologique simple par passes successives : un
      // nœud SANS parent (1er tour, "racine") garde sa position naturelle
      // du flex layout ; chaque nœud suivant s'aligne une fois ses 2
      // parents eux-mêmes réglés — fonctionne sans connaître l'ordre des
      // tours à l'avance (Playoffs miroité ET NBA Cup linéaire, même code).
      // `transform: translateY()` plutôt qu'un repositionnement CSS : ne
      // déclenche aucun reflow, la mesure suivante (traits de connexion)
      // voit déjà la position finale via `getBoundingClientRect`.
      function alignMergedCards() {
        const allNodes = columns.flatMap((column) => column.items);
        const feedersOf = new Map<string, string[]>();
        for (const node of allNodes) {
          const nextId = getNextId(node);
          if (!nextId) continue;
          const list = feedersOf.get(nextId) ?? [];
          list.push(getId(node));
          feedersOf.set(nextId, list);
        }

        const settled = new Set<string>();
        const pendingIds = new Set(allNodes.map((node) => getId(node)));
        let progressed = true;
        while (progressed) {
          progressed = false;
          for (const id of pendingIds) {
            const feederIds = feedersOf.get(id) ?? [];
            if (!feederIds.every((f) => settled.has(f))) continue;

            const targetEl = cardsById.get(id);
            const feederEls =
              feederIds.length === 2
                ? feederIds.map((f) => cardsById.get(f)).filter((el): el is HTMLElement => el !== undefined)
                : [];

            if (targetEl && feederEls.length === 2) {
              const centers = feederEls.map((el) => {
                const rect = el.getBoundingClientRect();
                return rect.top + rect.height / 2;
              });
              const desiredCenter = (centers[0] + centers[1]) / 2;
              targetEl.style.transform = ""; // mesure la position NATURELLE avant de la corriger
              const currentRect = targetEl.getBoundingClientRect();
              const currentCenter = currentRect.top + currentRect.height / 2;
              targetEl.style.transform = `translateY(${desiredCenter - currentCenter}px)`;
            } else if (targetEl) {
              targetEl.style.transform = ""; // racine, ou fusion incomplète (dormant) : position naturelle
            }

            settled.add(id);
            pendingIds.delete(id);
            progressed = true;
          }
        }

        // Le nœud FINAL (sans suivant — Finale NBA/finale de Cup) et ses 2
        // parents directs (les 2 finales de conférence, ou les 2 demies de
        // Cup) restent TOUJOURS sur la MÊME ligne horizontale (17/08/2026,
        // demandé par l'utilisateur) — contrairement aux fusions
        // précédentes (demi-finales), qui s'alignent chacune indépendamment
        // sur SES propres parents et peuvent donc diverger d'un côté à
        // l'autre. Calculé en dernier, sur les positions déjà réglées par
        // la passe ci-dessus : la ligne partagée est la MOYENNE des 3
        // positions déjà indépendamment calculées, pas la position d'un
        // des 3 imposée aux 2 autres.
        const finalNode = allNodes.find((node) => getNextId(node) === null);
        if (finalNode) {
          const finalId = getId(finalNode);
          const feederIds = feedersOf.get(finalId) ?? [];
          if (feederIds.length === 2) {
            const rowIds = [finalId, ...feederIds];
            const rowEls = rowIds.map((id) => cardsById.get(id)).filter((el): el is HTMLElement => el !== undefined);
            if (rowEls.length === rowIds.length) {
              const centers = rowEls.map((el) => {
                const rect = el.getBoundingClientRect();
                return rect.top + rect.height / 2;
              });
              const sharedCenter = centers.reduce((sum, c) => sum + c, 0) / centers.length;
              rowEls.forEach((el, index) => {
                const existingOffset = parseFloat(/translateY\(([-\d.]+)px\)/.exec(el.style.transform)?.[1] ?? "0");
                el.style.transform = `translateY(${existingOffset + (sharedCenter - centers[index])}px)`;
              });
            }
          }
        }
      }

      // Repositionne chaque libellé de tour juste au-dessus de la carte la
      // plus haute de sa colonne — DOIT s'exécuter après `alignMergedCards`
      // (dépend des positions déjà corrigées des cartes). Une colonne peut
      // contenir plusieurs cartes désormais réparties à des hauteurs très
      // différentes (chacune alignée sur SES propres parents) : le libellé
      // suit la plus haute des deux plutôt qu'une position centrée statique.
      function alignColumnLabels() {
        const labelsByKey = labelRefs.current;
        const GAP = 8; // var(--space-2)

        for (const column of columns) {
          const labelEl = labelsByKey.get(column.key);
          if (!labelEl) continue;

          const cardTops = column.items
            .map((item) => cardsById.get(getId(item)))
            .filter((el): el is HTMLElement => el !== undefined)
            .map((el) => el.getBoundingClientRect().top);

          labelEl.style.transform = ""; // mesure la position NATURELLE avant de la corriger
          if (cardTops.length === 0) continue;

          const minCardTop = Math.min(...cardTops);
          const labelRect = labelEl.getBoundingClientRect();
          const offset = minCardTop - GAP - labelRect.bottom;
          if (offset < 0) {
            labelEl.style.transform = `translateY(${offset}px)`;
          }
        }
      }

      function recompute() {
        alignMergedCards();
        alignColumnLabels();

        const containerRect = container!.getBoundingClientRect();
        const nextPaths: ConnectorPath[] = [];

        for (const column of columns) {
          for (const node of column.items) {
            const nodeId = getId(node);
            const nextId = getNextId(node);
            if (!nextId) continue;
            const sourceEl = cardsById.get(nodeId);
            const targetEl = cardsById.get(nextId);
            if (!sourceEl || !targetEl) continue;

            const sourceRect = sourceEl.getBoundingClientRect();
            const targetRect = targetEl.getBoundingClientRect();
            // Colonnes Ouest (et NBA Cup, toujours "west") : le trait part du
            // bord DROIT vers la colonne suivante à droite. Colonnes Est
            // (miroir du poster) : direction inversée, bord GAUCHE vers la
            // colonne suivante à gauche — jusqu'à converger vers la Finale
            // NBA centrale des 2 côtés.
            const goingRight = column.side === "west";
            const sourceX = (goingRight ? sourceRect.right : sourceRect.left) - containerRect.left;
            const sourceY = sourceRect.top + sourceRect.height / 2 - containerRect.top;
            const targetX = (goingRight ? targetRect.left : targetRect.right) - containerRect.left;
            const targetY = targetRect.top + targetRect.height / 2 - containerRect.top;
            const midX = (sourceX + targetX) / 2;

            // Coude à 3 segments (horizontal/vertical/horizontal) — un merge
            // 2->1 (2 séries alimentant la même suivante) dessine 2 traits
            // indépendants plutôt qu'une jonction en Y fusionnée (plus
            // simple, toujours lisible comme un arbre connecté).
            nextPaths.push({
              id: `${nodeId}->${nextId}`,
              d: `M ${sourceX} ${sourceY} H ${midX} V ${targetY} H ${targetX}`,
            });
          }
        }

        setPaths(nextPaths);
      }

      recompute();

      observer = new ResizeObserver(recompute);
      observer.observe(container);
      for (const el of cardsById.values()) observer.observe(el);
    }

    setup();

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [columns, containerRef, cardRefs, labelRefs, liveSeriesMap, getId, getNextId]);

  return (
    <svg className={styles.connectors} aria-hidden="true">
      {paths.map((path) => (
        <path key={path.id} d={path.d} className={styles.connectorPath} />
      ))}
    </svg>
  );
}
