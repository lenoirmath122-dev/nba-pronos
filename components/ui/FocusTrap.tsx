"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";

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
export function FocusTrap({ onClose, children, ...divProps }: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  // Synchronise la ref à CHAQUE rendu (pas de tableau de dépendances) --
  // mais dans un effet, jamais pendant le rendu lui-même (react-hooks/refs).
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    (focusables()[0] ?? container).focus();

    function handleKeyDown(event: KeyboardEvent) {
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
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div ref={containerRef} {...divProps}>
      {children}
    </div>
  );
}
