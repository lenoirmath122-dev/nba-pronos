"use client";

import { useCallback, useEffect, useState } from "react";

// Animation de validation sur l'élément concerné (04/10/2026, p3-5) —
// complète le toast (components/ui/Toast.tsx) : le toast dit CE qui a été
// enregistré, l'éclat sur la carte dit OÙ. `flashing` reste vrai le temps
// d'une animation, l'appelant pose alors la classe qui la joue
// (components/ui/SuccessFlash.module.css).
//
// Un nouvel appel pendant l'animation la prolonge sans la rejouer : deux
// enregistrements rapprochés sur la même carte n'ont pas à clignoter deux fois.

const FLASH_DURATION_MS = 1100;

export function useSuccessFlash(): [flashing: boolean, flash: () => void] {
  const [flashCount, setFlashCount] = useState(0);
  const [flashing, setFlashing] = useState(false);

  const flash = useCallback(() => {
    setFlashing(true);
    setFlashCount((count) => count + 1);
  }, []);

  useEffect(() => {
    if (flashCount === 0) return;
    const timeoutId = setTimeout(() => setFlashing(false), FLASH_DURATION_MS);
    return () => clearTimeout(timeoutId);
  }, [flashCount]);

  return [flashing, flash];
}
