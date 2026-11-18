"use client";

import { useState } from "react";
import { track } from "@vercel/analytics";
import { boxScorePath, boxScoreSheetSchema, boxScoreUrl } from "@/lib/boxScores/schema";
import type { BoxScoreLoadState } from "./BoxScoreDialog";
import broadcast from "./BroadcastButton.module.css";
import styles from "./BoxScoreButton.module.css";

// Feuille de match d'un match terminé (onglet Résultats). Le JSON est lu
// directement sur le CDN de Supabase Storage (bucket public box-scores, écrit
// par la VM quelques minutes après le buzzer) : aucune route Next, aucune requête
// en base. Un seul appel à la première ouverture, gardé en mémoire ; « pas encore
// disponible » (404) est redemandé à la réouverture suivante.
//
// Bouton et popup séparés : le bouton vit dans la bande du prono, DANS la carte
// cliquable de LockedRow, alors que la popup est montée à côté (comme
// OthersOnMatch) -- les événements d'un portail React remontent l'arbre des
// composants, une popup montée sous le bouton replierait la carte à chaque clic.

export function useBoxScore(scheduledAt: string, homeAbbr: string, awayAbbr: string) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<BoxScoreLoadState | null>(null);

  async function load() {
    setState({ status: "loading" });
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) {
      setState({ status: "error" });
      return;
    }
    try {
      const response = await fetch(boxScoreUrl(base, boxScorePath(scheduledAt, homeAbbr, awayAbbr)));
      // Supabase Storage répond 400 ou 404 selon les versions pour un objet absent.
      if (response.status === 404 || response.status === 400) {
        setState({ status: "missing" });
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      const parsed = boxScoreSheetSchema.safeParse(await response.json());
      setState(parsed.success ? { status: "ready", sheet: parsed.data } : { status: "error" });
    } catch {
      setState({ status: "error" });
    }
  }

  function open() {
    setIsOpen(true);
    try {
      track("box_score_open");
    } catch {
      // l'analytics ne doit jamais gêner l'ouverture
    }
    if (state === null || state.status === "missing" || state.status === "error") void load();
  }

  return {
    isOpen,
    state: state ?? ({ status: "loading" } as const),
    open,
    close: () => setIsOpen(false),
    retry: () => void load(),
  };
}

/** Bouton de la bande du prono : stopPropagation, il est dans la carte cliquable. */
export function BoxScoreBandButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className={broadcast.button}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      onKeyDown={(e) => e.stopPropagation()}
      aria-label="Feuille de match"
    >
      <span className={styles.full} aria-hidden="true">
        Feuille de match
      </span>
      {/* Pas « Stats » : se confondrait avec « Stats des équipes ». */}
      <span className={styles.short} aria-hidden="true">
        Feuille
      </span>
    </button>
  );
}
