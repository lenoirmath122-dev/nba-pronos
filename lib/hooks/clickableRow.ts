import type { KeyboardEvent } from "react";

// Motif "ligne cliquable" accessible (`<div role="button">` + clavier
// Entrée/Espace) — extrait le 16/08/2026 (bug d'audit corrigé,
// réutilisation) : dupliqué à l'identique dans NodeCard.tsx,
// LeaderboardRow.tsx et BetGroupRow.tsx, toujours pour la même raison
// (`<a>`/`<button>` imbriqué dans un `<button>` natif invalide en HTML —
// bouton Parier/Modifier, PlayerLink, lien de liste), d'où ce
// `<div role="button">` qui reconstitue le comportement clavier standard à
// la main.
export function clickableRowProps(onActivate: () => void, options?: { disabled?: boolean }) {
  const disabled = options?.disabled ?? false;
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: disabled ? undefined : onActivate,
    onKeyDown: (event: KeyboardEvent) => {
      if (disabled) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate();
      }
    },
  };
}
