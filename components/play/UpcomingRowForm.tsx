"use client";

import { useEffect, useState, useTransition } from "react";
import { useUnsavedGuard } from "@/lib/hooks/useUnsavedGuard";
import { saveMatchPredictionDraft, validateMatchPrediction } from "@/lib/actions/matches";
import { submitBet } from "@/lib/actions/bets";
import type { BetSlotIndicator, UpcomingMatchRow } from "@/lib/queries/play";
import { MarginStepper } from "./MarginStepper";
import { RevealPanelUpcoming } from "./RevealPanelUpcoming";
import { BetBlock } from "./BetBlock";
import { InlineBetForm, type InlineBetFields, type InlineBetOwned } from "@/components/bets/InlineBetForm";
import styles from "./UpcomingRowForm.module.css";

// Ligne dépliée d'un match pas encore verrouillé — ex-components/matches/
// PredictionForm.tsx, fusionné avec le bloc pari (§3.3 SPEC_REFONTE_ONGLET_
// JOUER_V0_1 : le pari devient éditable ICI, plus sur un écran à part).
// `winner` vient du parent (UpcomingRow, 19/08/2026) — le choix du vainqueur
// se fait désormais directement sur les boutons logo de l'en-tête, TOUJOURS
// montés (un tap choisit ET déplie), donc plus de TeamPicker ici (ex-doublon
// signalé par l'utilisateur). `margin` reste un état local propre à ce
// formulaire. Porte le drapeau `dirty` consommé par useUnsavedGuard (C2).
// Ordre imposé par §3.2 de la spec : affrontement (en-tête) → écart →
// panneau "valider = voir" → actions → pari.
//
// Une fois VALIDATED, plus aucune saisie n'est rendue : irréversible, la
// ligne bascule en lecture seule + révélation — toujours dérivé de la prop,
// jamais un état local.

function triggerLabelFor(betSlot: BetSlotIndicator): string {
  return betSlot.mode === "BINARY" ? "Proposer un pari" : `Proposer un pari · ${betSlot.usedSlots}/${betSlot.totalSlots}`;
}

/** Un pari DRAFT/SUBMITTED reste éditable inline (InlineBetForm) ; tout
 *  autre statut existant bascule en lecture seule (BetBlock) — décision 3 de
 *  la spec : même un REJETÉ ou un VALIDÉ doit rester visible ici, pas
 *  seulement les statuts éditables comme avant la fusion. */
function toInlineBetOwned(bet: UpcomingMatchRow["bet"]): InlineBetOwned | null {
  if (!bet || (bet.status !== "DRAFT" && bet.status !== "SUBMITTED")) return null;
  return { betId: bet.betId, status: bet.status, description: bet.description, category: bet.category, difficulty: bet.difficulty };
}

function winnerAbbreviation(match: UpcomingMatchRow): string | null {
  if (match.myWinnerTeamId === match.homeTeam.id) return match.homeTeam.abbreviation;
  if (match.myWinnerTeamId === match.awayTeam.id) return match.awayTeam.abbreviation;
  return null;
}

// `winner` est lu seul (jamais modifié ici) : la sélection se fait sur les
// boutons logo de l'en-tête (UpcomingRow, TOUJOURS montés), pas dans ce
// formulaire qui ne monte qu'une fois la ligne ouverte.
type UpcomingRowFormProps = {
  match: UpcomingMatchRow;
  winner: string | null;
};

export function UpcomingRowForm({ match, winner }: UpcomingRowFormProps) {
  const { markDirty, clearDirty } = useUnsavedGuard(match.matchId);
  const [margin, setMargin] = useState<number | null>(match.myMargin);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showValidateConfirm, setShowValidateConfirm] = useState(false);
  // Miroir live du pari inline — non NULL seulement quand un pari est ouvert
  // ET a un énoncé — permet de synchroniser sa soumission avec la validation
  // du prono : un SEUL bouton quand les deux sont prêts ensemble, sinon
  // comportement inchangé (chacun géré indépendamment).
  const [betFields, setBetFields] = useState<InlineBetFields | null>(null);

  useEffect(() => {
    const dirty = winner !== match.myWinnerTeamId || margin !== match.myMargin;
    if (dirty) markDirty();
    else clearDirty();
  }, [winner, margin, match.myWinnerTeamId, match.myMargin, markDirty, clearDirty]);

  // Ligne repliée (démontage) : la saisie locale non enregistrée disparaît
  // avec elle — rien ne reste à protéger pour cette clé.
  useEffect(() => () => clearDirty(), [clearDirty]);

  const myBet = toInlineBetOwned(match.bet);
  const readOnlyBet = match.bet && !myBet ? match.bet : null;

  if (match.viewStatus === "VALIDATED") {
    return (
      <div className={styles.form}>
        <p className={styles.validatedRecap}>
          {/* "+" pas "−" (22/08/2026, même correctif que UpcomingRow.tsx) :
              myMargin est toujours l'écart de victoire, jamais un déficit. */}
          Ton prono : {winnerAbbreviation(match)} +{match.myMargin}
        </p>
        {/* Le prono et le pari sont deux entités indépendantes — valider le
            prono en premier ne doit pas priver l'accès au pari associé. */}
        {readOnlyBet ? (
          <BetBlock bet={readOnlyBet} returnTo="/play" />
        ) : (
          <InlineBetForm
            scope="MATCH"
            matchId={match.matchId}
            seriesId={match.seriesId}
            hasBet={match.bet !== null}
            triggerLabel={triggerLabelFor(match.betSlot)}
            myBet={myBet}
          />
        )}
        <RevealPanelUpcoming
          isRevealed={match.isRevealed}
          predictedCount={match.predictedCount}
          eligibleCount={match.eligibleCount}
          others={match.others}
          absentees={match.absentees}
        />
      </div>
    );
  }

  const isComplete = winner !== null && margin !== null;
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
  // soumission du pari ne doit pas empêcher ni masquer le succès du prono.
  async function submitBetIfReady(): Promise<{ success: true } | { success: false; error: string }> {
    if (!betFields) return { success: true };
    const result = await submitBet({
      betId: myBet?.betId,
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
      <MarginStepper
        value={margin}
        onChange={setMargin}
        winnerTeamId={winner}
        homeTeamId={match.homeTeam.id}
        awayTeamId={match.awayTeam.id}
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

      {readOnlyBet ? (
        <BetBlock bet={readOnlyBet} returnTo="/play" />
      ) : (
        <InlineBetForm
          scope="MATCH"
          matchId={match.matchId}
          seriesId={match.seriesId}
          hasBet={match.bet !== null}
          triggerLabel={triggerLabelFor(match.betSlot)}
          myBet={myBet}
          hideSubmit={isComplete && betFields !== null}
          onFieldsChange={setBetFields}
        />
      )}

      <RevealPanelUpcoming
        isRevealed={match.isRevealed}
        predictedCount={match.predictedCount}
        eligibleCount={match.eligibleCount}
        others={match.others}
        absentees={match.absentees}
      />

      {/* Dialogue de VALIDATION — distinct du dialogue C2 de perte de saisie :
          wording et déclencheur différents, ne pas fusionner. */}
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
