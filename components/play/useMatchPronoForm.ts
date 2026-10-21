"use client";

import { useEffect, useState, useTransition } from "react";
import { useUnsavedGuard } from "@/lib/hooks/useUnsavedGuard";
import { saveMatchPredictionDraft, validateMatchPrediction, type ActionResult } from "@/lib/actions/matches";
import type { UpcomingMatchRow } from "@/lib/queries/play";
import { useToast } from "@/components/ui/Toast";
import { requestBadgeCheck } from "@/lib/badges/checkRequest";

// État + actions du formulaire de prono d'un match à venir (vainqueur, écart,
// brouillon, validation), extraits d'UpcomingRow le 22/10/2026 pour que
// l'Accueil (components/home/NextPronoCard.tsx) réutilise exactement les mêmes
// server actions, validations et messages d'erreur que /play. Le RETOUR visuel
// après validation reste à la charge de l'appelant (`onValidated`) : popup
// « Prono validé » + flash sur /play, message court + passage au match
// suivant sur l'Accueil.

export type ValidatedPick = { winnerTeamId: string; margin: number };

type PendingAction = "draft" | "validate" | null;

/** Un échec réseau/serveur imprévu remonte comme une exception : on le ramène
 *  au même message que l'échec « normal » de l'action plutôt que de laisser
 *  l'erreur partir vers la frontière d'erreur de la page. */
async function safely(call: () => Promise<ActionResult>, fallbackError: string): Promise<ActionResult> {
  try {
    return await call();
  } catch {
    return { success: false, error: fallbackError };
  }
}

export function useMatchPronoForm(match: UpcomingMatchRow, onValidated: (pick: ValidatedPick) => void) {
  const { markDirty, clearDirty } = useUnsavedGuard(match.matchId);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showValidateConfirm, setShowValidateConfirm] = useState(false);
  // Bouton à l'origine de l'appel en cours, pour poser le spinner sur LUI
  // seul (p3-5) — `isPending` ne dit pas lequel a été touché.
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const showToast = useToast();

  const [winner, setWinner] = useState<string | null>(match.myWinnerTeamId);
  const [margin, setMargin] = useState<number | null>(match.myMargin);

  const isReadOnly = match.viewStatus === "VALIDATED";
  const isComplete = winner !== null && margin !== null;
  const isUnsaved = winner !== match.myWinnerTeamId || margin !== match.myMargin;

  useEffect(() => {
    const dirty = winner !== match.myWinnerTeamId || margin !== match.myMargin;
    if (dirty) markDirty();
    else clearDirty();
  }, [winner, margin, match.myWinnerTeamId, match.myMargin, markDirty, clearDirty]);

  function selectTeam(teamId: string) {
    if (isReadOnly) return;
    setWinner(teamId);
  }

  function finishValidation() {
    clearDirty();
    if (winner !== null && margin !== null) onValidated({ winnerTeamId: winner, margin });
    requestBadgeCheck();
  }

  function saveDraft() {
    setError(null);
    setPendingAction("draft");
    startTransition(async () => {
      const result = await safely(
        () => saveMatchPredictionDraft({ matchId: match.matchId, predictedWinnerTeamId: winner, predictedMargin: margin }),
        "Impossible d'enregistrer le brouillon."
      );
      if (result.success) {
        clearDirty();
        setShowValidateConfirm(false);
        showToast("Brouillon enregistré");
      } else {
        setError(result.error);
      }
    });
  }

  function validate() {
    setError(null);
    setPendingAction("validate");
    startTransition(async () => {
      const result = await safely(() => validateMatchPrediction(match.matchId), "Impossible de valider ce prono.");
      setShowValidateConfirm(false);
      if (!result.success) {
        setError(result.error);
        return;
      }
      finishValidation();
    });
  }

  function validateDefinitively() {
    setError(null);
    setPendingAction("validate");
    startTransition(async () => {
      const saveResult = await safely(
        () => saveMatchPredictionDraft({ matchId: match.matchId, predictedWinnerTeamId: winner, predictedMargin: margin }),
        "Impossible d'enregistrer le brouillon."
      );
      if (!saveResult.success) {
        setError(saveResult.error);
        return;
      }
      const result = await safely(() => validateMatchPrediction(match.matchId), "Impossible de valider ce prono.");
      setShowValidateConfirm(false);
      if (!result.success) {
        setError(result.error);
        return;
      }
      finishValidation();
    });
  }

  return {
    winner,
    margin,
    setMargin,
    selectTeam,
    isReadOnly,
    isComplete,
    isUnsaved,
    isPending,
    pendingAction,
    error,
    showValidateConfirm,
    setShowValidateConfirm,
    saveDraft,
    validate,
    validateDefinitively,
  };
}
