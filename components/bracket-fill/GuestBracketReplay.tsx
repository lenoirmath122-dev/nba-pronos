"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveBracketPick } from "@/lib/actions/bracket-fill";
import type { BracketFillData } from "@/lib/queries/bracket-fill";
import { picksInSaveOrder, type GuestPicks } from "@/lib/bracketFill/guestDraft";
import { useBracketDraft } from "./useBracketDraft";
import styles from "./FillPosterView.module.css";

// Reprise du bracket invité après inscription (28/11/2026,
// CHANTIER_BRACKET_INVITE.md), sur /play/bracket?reprise=bracket. Enregistre
// les choix du navigateur dans l'ordre des tours (saveBracketPick refuse une
// demie tant que ses quarts ne sont pas en base), puis laisse le joueur
// valider LUI-MÊME : jamais de validateBracket ici.
// Compte qui a déjà des choix en base (décision de l'utilisateur, 28/11/2026) :
// on garde le bracket en base, on efface le brouillon et on le dit au joueur.

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

  async function run() {
    startedRef.current = true;
    setStatus("saving");
    const ok = await savePicks(data, picks);
    clear();
    setStatus(ok ? "saved" : "failed");
    router.refresh();
  }

  // Une seule fois : bracket vide en base → enregistrement automatique ;
  // bracket déjà commencé → on le garde et on efface le brouillon.
  useEffect(() => {
    if (!hasDraft) return;
    // Garde dans le minuteur (pas dans l'effet) : en mode strict, le 1er
    // minuteur est annulé et c'est le 2e qui doit partir.
    const timer = window.setTimeout(() => {
      if (startedRef.current) return;
      if (data.filledCount > 0) {
        startedRef.current = true;
        clear();
        setStatus("kept");
      } else {
        void run();
      }
    }, 0);
    return () => window.clearTimeout(timer);
    // run lit les props du rendu courant ; seul le premier passage compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDraft, data.filledCount]);

  if (status === "kept") {
    return (
      <p className={styles.notice} role="status">
        Tu avais déjà un bracket sur ce compte : on garde celui-ci. Tes choix faits sans compte ne sont pas repris.
      </p>
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
