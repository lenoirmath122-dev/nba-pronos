"use client";

import { useState } from "react";

// Bascule poster/flux normal — simplifié le 17/08/2026 (demandé par
// l'utilisateur : « peu importe le device, on arrive sur l'arbre ») depuis
// useImmersiveDefault.ts, qui ne montrait le poster par défaut que sur
// desktop/paysage (16/08/2026). Le poster est désormais TOUJOURS l'écran
// d'arrivée, sur tout device — plus de détection de viewport, plus
// d'invitation à tourner (RotateInvite, supprimé) : juste un état
// visible/masqué avec un point de sortie explicite (« Quitter »).
//
// Partagé entre components/bracket/TreeView.tsx (consultation) et
// components/bracket-fill/BracketFillView.tsx (remplissage), qui adoptent
// la même règle. Le ROUTING (quelle URL viser en sortant, le cas échéant)
// reste du ressort de l'appelant via `onExit` — `/bracket` a un flux
// "résumé" de repli avec sa propre URL, `/play/bracket` n'en a pas.

type UsePosterToggleOptions = {
  onExit?: () => void;
};

export function usePosterToggle({ onExit }: UsePosterToggleOptions = {}) {
  const [visible, setVisible] = useState(true);

  function enter() {
    setVisible(true);
  }

  function exit() {
    setVisible(false);
    onExit?.();
  }

  return { visible, enter, exit };
}
