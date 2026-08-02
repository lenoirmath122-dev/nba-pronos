"use client";

import { useEffect, useState, useTransition } from "react";
import { useUnsavedGuard } from "@/lib/hooks/useUnsavedGuard";
import { saveMatchPredictionDraft, validateMatchPrediction } from "@/lib/actions/matches";
import { submitBet } from "@/lib/actions/bets";
import type { BetSlotIndicator, MatchCard } from "@/lib/queries/matches";
import { TeamPicker } from "./TeamPicker";
import { MarginStepper } from "./MarginStepper";
import { RevealPanel } from "./RevealPanel";
import { InlineBetForm, type InlineBetFields } from "@/components/bets/InlineBetForm";
import styles from "./PredictionForm.module.css";

function triggerLabelFor(betSlot: BetSlotIndicator): string {
  return betSlot.mode === "BINARY" ? "Proposer un pari" : `Proposer un pari · ${betSlot.usedSlots}/${betSlot.totalSlots}`;
}

// Ligne dépliée — feuille client n°2/3 (§1) : porte l'état de saisie local
// (winner/margin) et le drapeau `dirty` consommé par useUnsavedGuard (C2).
// Ordre imposé par §3.2 : affrontement → écart → panneau « valider = voir »
// → actions → raccourci pari.
//
// Une fois VALIDATED (donnée serveur, via `match.viewStatus`), plus aucune
// saisie n'est rendue : irréversible, la ligne bascule en lecture seule +
// révélation. Ce n'est jamais un état local — toujours dérivé de la prop.

function winnerAbbreviation(match: MatchCard): string | null {
  if (match.myWinnerTeamId === match.homeTeam.id) return match.homeTeam.abbreviation;
  if (match.myWinnerTeamId === match.awayTeam.id) return match.awayTeam.abbreviation;
  return null;
}

type PredictionFormProps = { match: MatchCard };

export function PredictionForm({ match }: PredictionFormProps) {
  const { markDirty, clearDirty } = useUnsavedGuard(match.matchId);
  const [winner, setWinner] = useState<string | null>(match.myWinnerTeamId);
  const [margin, setMargin] = useState<number | null>(match.myMargin);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showValidateConfirm, setShowValidateConfirm] = useState(false);
  // Miroir live du pari inline (InlineBetForm), non NULL seulement quand un
  // pari est ouvert ET a un énoncé — permet de synchroniser sa soumission
  // avec la validation du prono (demandé par l'utilisateur le 28/07/2026) :
  // un SEUL bouton quand les deux sont prêts ensemble, sinon comportement
  // inchangé (chacun géré indépendamment).
  const [betFields, setBetFields] = useState<InlineBetFields | null>(null);

  useEffect(() => {
    const dirty = winner !== match.myWinnerTeamId || margin !== match.myMargin;
    if (dirty) markDirty();
    else clearDirty();
  }, [winner, margin, match.myWinnerTeamId, match.myMargin, markDirty, clearDirty]);

  // Ligne repliée (démontage) : la saisie locale non enregistrée disparaît
  // avec elle — rien ne reste à protéger pour cette clé.
  useEffect(() => () => clearDirty(), [clearDirty]);

  if (match.viewStatus === "VALIDATED") {
    return (
      <div className={styles.form}>
        <p className={styles.validatedRecap}>
          Ton prono : {winnerAbbreviation(match)} −{match.myMargin}
        </p>
        <RevealPanel
          isRevealed={match.isRevealed}
          predictedCount={match.predictedCount}
          eligibleCount={match.eligibleCount}
          others={match.others}
          absentees={match.absentees}
        />
        {/* Le prono et le pari sont deux entités indépendantes (match_predictions
            vs bets) — valider le prono en premier ne doit pas priver l'accès au
            pari associé, sans quoi seul l'écran Paris dédié reste utilisable
            (GAPS_OUVERTS.md, trouvé 28/07/2026). */}
        <InlineBetForm
          scope="MATCH"
          matchId={match.matchId}
          seriesId={match.seriesId}
          hasBet={match.betSlot.hasBetOnThisMatch}
          triggerLabel={triggerLabelFor(match.betSlot)}
          myBet={match.myBet}
        />
      </div>
    );
  }

  const isComplete = winner !== null && margin !== null;
  // Brouillon local non encore persisté — distinct de `dirty` (guard C2) :
  // relu ici pour choisir le contenu du dialogue de validation (§21).
  const isUnsaved = winner !== match.myWinnerTeamId || margin !== match.myMargin;

  function handleSaveDraft() {
    setError(null);
    startTransition(async () => {
      const result = await saveMatchPredictionDraft({
        matchId: match.matchId,
        predictedWinnerTeamId: winner,
        predictedMargin: margin,
      });
      if (result.success) {
        clearDirty();
        setShowValidateConfirm(false);
      } else {
        setError(result.error);
      }
    });
  }

  // Soumet le pari inline SI il est prêt (betFields non NULL) — no-op sinon.
  // Appelée APRÈS une validation de prono réussie, jamais avant : un échec de
  // soumission du pari ne doit pas empêcher ni masquer le succès du prono
  // (déjà acquis, irréversible) — l'erreur, s'il y en a une, le dit clairement.
  async function submitBetIfReady(): Promise<{ success: true } | { success: false; error: string }> {
    if (!betFields) return { success: true };
    const result = await submitBet({
      betId: match.myBet?.betId,
      scope: "MATCH",
      seriesId: match.seriesId,
      matchId: match.matchId,
      description: betFields.description,
      category: betFields.category,
      difficulty: betFields.difficulty,
    });
    return result.success ? { success: true } : { success: false, error: result.error };
  }

  function handleValidate() {
    setError(null);
    startTransition(async () => {
      const result = await validateMatchPrediction(match.matchId);
      setShowValidateConfirm(false);
      if (!result.success) {
        setError(result.error);
        return;
      }
      clearDirty();
      const betResult = await submitBetIfReady();
      if (!betResult.success) setError(`Prono validé — le pari n'a pas pu être soumis : ${betResult.error}`);
    });
  }

  // « Valider définitivement » depuis un brouillon non enregistré (§21,
  // acté 27/07/2026) : enregistre puis valide dans la foulée, en un seul
  // clic explicite — ce n'est pas de l'auto-save silencieux (§7), le joueur
  // a choisi ce bouton précisément pour ça.
  function handleValidateDefinitively() {
    setError(null);
    startTransition(async () => {
      const saveResult = await saveMatchPredictionDraft({
        matchId: match.matchId,
        predictedWinnerTeamId: winner,
        predictedMargin: margin,
      });
      if (!saveResult.success) {
        setError(saveResult.error);
        return;
      }
      const result = await validateMatchPrediction(match.matchId);
      setShowValidateConfirm(false);
      if (!result.success) {
        setError(result.error);
        return;
      }
      clearDirty();
      const betResult = await submitBetIfReady();
      if (!betResult.success) setError(`Prono validé — le pari n'a pas pu être soumis : ${betResult.error}`);
    });
  }

  return (
    <div className={styles.form}>
      <TeamPicker homeTeam={match.homeTeam} awayTeam={match.awayTeam} selectedTeamId={winner} onSelect={setWinner} />

      <MarginStepper
        value={margin}
        onChange={setMargin}
        winnerTeamId={winner}
        homeTeamId={match.homeTeam.id}
        awayTeamId={match.awayTeam.id}
      />

      <RevealPanel
        isRevealed={match.isRevealed}
        predictedCount={match.predictedCount}
        eligibleCount={match.eligibleCount}
        others={match.others}
        absentees={match.absentees}
      />

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={handleSaveDraft} disabled={isPending}>
          Enregistrer le brouillon
        </button>
        <button
          type="button"
          className={styles.primary}
          onClick={() => setShowValidateConfirm(true)}
          disabled={isPending || !isComplete}
        >
          {betFields ? "Valider" : "Valider le prono"}
        </button>
      </div>

      {/* hideSubmit/onFieldsChange : synchronisation de la validation quand
          prono ET pari sont prêts ensemble (voir submitBetIfReady ci-dessus)
          — sinon, comportement inchangé (chacun soumis indépendamment). */}
      <InlineBetForm
        scope="MATCH"
        matchId={match.matchId}
        seriesId={match.seriesId}
        hasBet={match.betSlot.hasBetOnThisMatch}
        triggerLabel={triggerLabelFor(match.betSlot)}
        myBet={match.myBet}
        hideSubmit={isComplete && betFields !== null}
        onFieldsChange={setBetFields}
      />

      {/* Dialogue de VALIDATION — distinct du dialogue C2 de perte de saisie
          (§7) : wording et déclencheur différents, ne pas fusionner. Contenu
          à deux variantes selon `isUnsaved` (§21, acté 27/07/2026). */}
      {showValidateConfirm && (
        <div className={styles.backdrop} role="presentation">
          <div
            className={styles.dialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`validate-title-${match.matchId}`}
          >
            <p id={`validate-title-${match.matchId}`} className={styles.dialogTitle}>
              Valider ce prono ?
            </p>
            {isUnsaved ? (
              <>
                <p className={styles.dialogBody}>
                  Attention, ton brouillon n&rsquo;est pas encore enregistré. Une fois validé, le prono
                  n&rsquo;est plus modifiable — enregistre-le d&rsquo;abord si tu veux pouvoir revenir dessus.
                  {betFields && " Ton pari sera aussi soumis à un admin pour validation."}
                </p>
                <div className={styles.dialogActions}>
                  <button
                    type="button"
                    className={styles.dialogCancel}
                    onClick={() => setShowValidateConfirm(false)}
                    disabled={isPending}
                  >
                    Retour
                  </button>
                  <button
                    type="button"
                    className={styles.dialogSecondary}
                    onClick={handleSaveDraft}
                    disabled={isPending}
                  >
                    Enregistrer le brouillon
                  </button>
                  <button
                    type="button"
                    className={styles.dialogConfirm}
                    onClick={handleValidateDefinitively}
                    disabled={isPending}
                  >
                    Valider définitivement
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.dialogBody}>
                  Une fois validé, il n&rsquo;est plus modifiable — et tu verras (comme les autres joueurs) les
                  pronos déjà déposés sur ce match.
                  {betFields && " Ton pari sera aussi soumis à un admin pour validation."}
                </p>
                <div className={styles.dialogActions}>
                  <button
                    type="button"
                    className={styles.dialogCancel}
                    onClick={() => setShowValidateConfirm(false)}
                    disabled={isPending}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className={styles.dialogConfirm}
                    onClick={handleValidate}
                    disabled={isPending}
                  >
                    Valider
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
