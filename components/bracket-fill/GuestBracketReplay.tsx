"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resetBracket, saveBracketPick } from "@/lib/actions/bracket-fill";
import type { BracketFillData } from "@/lib/queries/bracket-fill";
import { picksInSaveOrder, type GuestPicks } from "@/lib/bracketFill/guestDraft";
import { useBracketDraft } from "./useBracketDraft";
import styles from "./FillPosterView.module.css";

// Reprise du bracket invité après inscription (28/11/2026,
// CHANTIER_BRACKET_INVITE.md), sur /play/bracket?reprise=bracket. Enregistre
// les choix du navigateur dans l'ordre des tours (saveBracketPick refuse une
// demie tant que ses quarts ne sont pas en base), puis laisse le joueur
// valider LUI-MÊME : jamais de validateBracket ici.
// Compte qui a déjà des choix en base : on ne les écrase pas sans son accord.

type Status = "idle" | "saving" | "saved" | "failed" | "kept";

async function savePicks(data: BracketFillData, picks: GuestPicks): Promise<boolean> {
  for (const { seriesId, winnerTeamId } of picksInSaveOrder(data.rounds, picks)) {
    const result = await saveBracketPick({ seriesId, winnerTeamId, scoreFormat: null });
    if (!result.success) return false;
  }
  return true;
}

export function GuestBracketReplay({ data, competitionId }: { data: BracketFillData; competitionId: string }) {
  const router = useRouter();
  const { picks, clear } = useBracketDraft(competitionId);
  const [status, setStatus] = useState<Status>("idle");
  const startedRef = useRef(false);

  const hasDraft = Object.keys(picks).length > 0;
  const conflict = hasDraft && data.filledCount > 0 && status === "idle";

  async function run(replace: boolean) {
    startedRef.current = true;
    setStatus("saving");
    let ok = true;
    if (replace) ok = (await resetBracket()).success;
    if (ok) ok = await savePicks(data, picks);
    clear();
    setStatus(ok ? "saved" : "failed");
    router.refresh();
  }

  // Bracket vide en base : enregistrement automatique, une seule fois.
  useEffect(() => {
    if (!hasDraft || data.filledCount > 0) return;
    // Garde dans le minuteur (pas dans l'effet) : en mode strict, le 1er
    // minuteur est annulé et c'est le 2e qui doit partir.
    const timer = window.setTimeout(() => {
      if (!startedRef.current) void run(false);
    }, 0);
    return () => window.clearTimeout(timer);
    // run lit les props du rendu courant ; seul le premier passage compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDraft, data.filledCount]);

  if (conflict) {
    return (
      <div className={styles.notice} role="status">
        <span>Tu avais déjà commencé un bracket avec ce compte : on l&rsquo;a gardé.</span>
        <button type="button" className={styles.noticeButton} onClick={() => void run(true)}>
          Remplacer par mes choix d&rsquo;avant
        </button>
        <button
          type="button"
          className={styles.noticeButton}
          onClick={() => {
            clear();
            setStatus("kept");
          }}
        >
          Garder celui-ci
        </button>
      </div>
    );
  }
  if (status === "saving") {
    return (
      <p className={styles.notice} role="status">
        Enregistrement de tes choix…
      </p>
    );
  }
  if (status === "saved") {
    return (
      <p className={styles.notice} role="status">
        Tes choix sont enregistrés. Vérifie-les, puis valide ton bracket.
      </p>
    );
  }
  if (status === "failed") {
    return (
      <p className={styles.notice} role="alert">
        Une partie de tes choix n&rsquo;a pas pu être enregistrée : complète ton bracket avant de le valider.
      </p>
    );
  }
  return null;
}
