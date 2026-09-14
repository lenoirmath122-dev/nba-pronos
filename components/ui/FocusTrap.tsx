"use client";

import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type FocusTrapProps = ComponentPropsWithoutRef<"div"> & {
  onClose: () => void;
};

// Piège de focus clavier (UX-001) : focus initial sur le 1er élément
// focalisable à l'ouverture, Tab/Shift+Tab bouclent à l'intérieur, Échap
// ferme, et le focus revient à l'élément qui l'avait avant ouverture à la
// fermeture. Un composant (pas juste un hook) exprès : sa propre durée de
// vie EST celle du dialogue -- les 12 dialogues du dépôt le montent/
// démontent via `{isOpen && (...)}` plutôt que de le garder monté caché --
// donc l'effet ci-dessous tourne exactement une fois par ouverture, sans
// jonglage de dépendances sur un ref dont la mutation ne re-render jamais.
//
// Pile de pièges actifs (16/09/2026) : depuis que le pari peut s'ouvrir en
// popup (InlineBetForm presentation="modal", carte pronostic), le dialogue
// de suppression de pari (DeleteBetButton) peut désormais s'ouvrir DANS
// cette popup -- 2 FocusTrap montés en même temps pour la première fois.
// Sans cette pile, chacun écoutait "keydown" sur `document` indépendamment
// et se disputait le Tab/Échap (le englobant, monté en premier, gagnait
// et éjectait le focus hors du dialogue imbriqué -- bug réel attrapé par
// e2e/t-ui-01-focus-trap.spec.ts). Seul le plus RÉCEMMENT monté (top de
// pile) réagit désormais ; les pièges englobants restent inertes tant qu'il
// est ouvert, et redeviennent actifs dès qu'il se ferme (retiré de la pile).
const activeTraps: symbol[] = [];

export function FocusTrap({ onClose, children, ...divProps }: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  // Identité stable par instance, jamais recréée entre rendus (init paresseuse
  // useState, pas une mutation de ref pendant le rendu).
  const [id] = useState(() => Symbol("focus-trap"));

  // Synchronise la ref à CHAQUE rendu (pas de tableau de dépendances) --
  // mais dans un effet, jamais pendant le rendu lui-même (react-hooks/refs).
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    activeTraps.push(id);

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    (focusables()[0] ?? container).focus();

    function handleKeyDown(event: KeyboardEvent) {
      // Pas le piège le plus imbriqué actuellement ouvert : on laisse faire.
      if (activeTraps[activeTraps.length - 1] !== id) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const index = activeTraps.indexOf(id);
      if (index !== -1) activeTraps.splice(index, 1);
      previouslyFocused?.focus();
    };
    // `id` est stable (useState paresseux, jamais réassigné) : l'ajouter aux
    // dépendances ne change rien au "une fois par montage" voulu ci-dessus.
  }, [id]);

  return (
    <div ref={containerRef} {...divProps}>
      {children}
    </div>
  );
}
