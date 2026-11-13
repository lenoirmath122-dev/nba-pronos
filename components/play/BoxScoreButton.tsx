"use client";

import { useState } from "react";
import { track } from "@vercel/analytics";
import { boxScorePath, boxScoreSheetSchema, boxScoreUrl } from "@/lib/boxScores/schema";
import { BoxScoreDialog, type BoxScoreLoadState } from "./BoxScoreDialog";
import styles from "./TeamDetailsButton.module.css";

// Bouton « Feuille de match » d'un match terminé (onglet Résultats). Le JSON est
// lu directement sur le CDN de Supabase Storage (bucket public box-scores, écrit
// par la VM quelques minutes après le buzzer) : aucune route Next, aucune requête
// en base. Un seul appel au premier clic, gardé en mémoire ; « pas encore
// disponible » (404) est redemandé à la réouverture suivante.
type Props = {
  scheduledAt: string;
  homeAbbr: string;
  awayAbbr: string;
  subtitle: string;
};

export function BoxScoreButton({ scheduledAt, homeAbbr, awayAbbr, subtitle }: Props) {
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

  return (
    <>
      <button type="button" className={styles.button} onClick={open}>
        Feuille de match
      </button>
      {isOpen && (
        <BoxScoreDialog
          subtitle={subtitle}
          firstTricode={homeAbbr}
          state={state ?? { status: "loading" }}
          onRetry={() => void load()}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
