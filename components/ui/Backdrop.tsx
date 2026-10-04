"use client";

import { useRef, type ComponentPropsWithoutRef } from "react";

type BackdropProps = Omit<ComponentPropsWithoutRef<"div">, "onClick" | "onPointerDown"> & {
  onClose: () => void;
};

// Fond assombri des popups (04/10/2026, p3-4 — retour de l'alpha : « fermer
// une popup en touchant à côté, pas seulement la croix »). Toucher le fond
// ferme ; toucher la popup elle-même, non.
//
// Deux gardes, toutes deux nécessaires :
// - `target === currentTarget` : le clic doit viser le fond LUI-MÊME. Les
//   événements React remontent l'arbre des composants à travers les portails,
//   donc un clic dans une popup imbriquée (ex. DeleteBetButton ouvert dans
//   ModalDialog) atteindrait sinon le fond de la popup englobante.
// - pointerdown déjà sur le fond : un geste commencé DANS la popup et relâché
//   sur le fond (sélection de texte, défilement qui déborde) produit un
//   `click` dont la cible est le fond — sans ce repère, il fermerait la popup.
//
// Clavier : non concerné, Échap (FocusTrap) et les boutons couvrent déjà la
// fermeture — le fond reste `role="presentation"`.
export function Backdrop({ onClose, children, ...divProps }: BackdropProps) {
  const pressedOnBackdropRef = useRef(false);

  return (
    <div
      role="presentation"
      {...divProps}
      onPointerDown={(event) => {
        pressedOnBackdropRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        const shouldClose = pressedOnBackdropRef.current && event.target === event.currentTarget;
        pressedOnBackdropRef.current = false;
        if (shouldClose) onClose();
      }}
    >
      {children}
    </div>
  );
}
