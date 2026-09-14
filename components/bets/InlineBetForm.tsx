"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useUnsavedGuard } from "@/lib/hooks/useUnsavedGuard";
import { saveDraftBet, submitBet, withdrawBet } from "@/lib/actions/bets";
import {
  BET_CATEGORY_OPTIONS,
  BET_DIFFICULTY_LABELS,
  DEFAULT_BET_CATEGORY,
  DEFAULT_BET_DIFFICULTY,
} from "@/lib/labels/bets";
import type { BetCategory, BetDifficulty } from "@/lib/labels/bets";
import { ModalDialog } from "@/components/ui/ModalDialog";
import { Spinner } from "@/components/ui/Spinner";
import { BetsIcon } from "@/components/icons/home-icons";
import { RuleHelpButton } from "@/components/regles/RuleHelpButton";
import { BetWritingTips } from "@/components/regles/BetWritingTips";
import { BetDifficulteGrid } from "@/components/regles/BetDifficulteGrid";
import { DeleteBetButton } from "./DeleteBetButton";
import styles from "./InlineBetForm.module.css";

// Saisie de pari partagée, générique sur le scope (MATCH ou SERIES) —
// GÉNÉRALISÉ le 28/07/2026 depuis components/matches/InlineBetForm.tsx
// (posé le 27/07/2026 pour les paris MATCH dans l'écran Matchs) pour être
// réutilisé aussi par le Bracket personnel (paris SÉRIE, demandé par
// l'utilisateur — « tout centraliser dans Matchs et Bracket »). Volontairement
// DÉCOUPLÉ des contrats de types figés de chaque écran appelant
// (MatchCard.betSlot, BracketFillSeries...) : le parent traduit son propre
// indicateur de slot en `hasBet`/`triggerLabel` avant d'appeler ce composant,
// plutôt que d'imposer une forme unique aux deux écrans.

export type InlineBetFields = { description: string; category: BetCategory; difficulty: BetDifficulty };
export type InlineBetOwned = InlineBetFields & { betId: string; status: "DRAFT" | "SUBMITTED" };

type InlineBetFormProps = {
  scope: "MATCH" | "SERIES";
  matchId: string | null; // null si scope === "SERIES"
  seriesId: string;
  /** Un pari (tout statut confondu) occupe déjà le slot pour cette cible. */
  hasBet: boolean;
  /** Libellé du bouton d'ouverture — construit par l'appelant (ex. "Proposer
   *  un pari" ou "Proposer un pari · 2/3"), ce composant ne connaît pas la
   *  mécanique de quota de chaque écran. */
  triggerLabel: string;
  /** Non NULL seulement si un pari existe ET reste éditable ICI (DRAFT/SUBMITTED). */
  myBet: InlineBetOwned | null;
  /** Masque le bouton de soumission propre — le parent gère alors la
   *  soumission (validation synchronisée, écran Matchs uniquement à ce jour). */
  hideSubmit?: boolean;
  /** Miroir live des champs, NULL tant que rien n'est prêt à soumettre. */
  onFieldsChange?: (fields: InlineBetFields | null) => void;
  /** "modal" (17/08/2026, demandé par l'utilisateur — « ne pas surcharger le
   *  bracket ») : le formulaire ouvert s'affiche en fenêtre centrée
   *  (ModalDialog, même coquille que BetFormModal.tsx) au lieu de se déplier
   *  dans la carte. Défaut "inline" : comportement historique (Matchs),
   *  inchangé. Le bouton déclencheur reste identique dans les 2 cas — seul
   *  le rendu une fois ouvert diffère. */
  presentation?: "inline" | "modal";
  /** Déclencheur en icône compacte plutôt qu'en bouton texte pleine largeur
   *  (14/09/2026, carte pronostic — le libellé devient le nom accessible du
   *  bouton au lieu de son contenu visible). Sans effet sur le Bracket, qui
   *  ne passe pas cette prop. */
  compactTrigger?: boolean;
  /** Sous-titre affiché dans la popup à l'ouverture, ex. "2 restants"
   *  (16/09/2026 — retiré du bouton compact lui-même pour l'agrandir, mais
   *  l'utilisateur veut que l'info reste visible une fois le bouton cliqué).
   *  Ignoré hors présentation "modal" et si un pari existe déjà (myBet). */
  remainingHint?: string;
};

export function InlineBetForm({
  scope,
  matchId,
  seriesId,
  hasBet,
  triggerLabel,
  myBet,
  hideSubmit,
  onFieldsChange,
  presentation = "inline",
  compactTrigger = false,
  remainingHint,
}: InlineBetFormProps) {
  // En mode "modal" (17/08/2026), jamais ouvert par défaut même s'il existe
  // déjà un pari : contrairement à l'inline (où afficher direct le
  // formulaire pré-rempli est voulu), une pop-up ne doit s'ouvrir que sur
  // action explicite — sinon elle apparaîtrait toute seule au chargement de
  // la carte dès qu'un pari existe déjà.
  const [isOpen, setIsOpen] = useState(presentation === "modal" ? false : myBet !== null);
  const [description, setDescription] = useState(myBet?.description ?? "");
  const [category, setCategory] = useState<BetCategory>(myBet?.category ?? DEFAULT_BET_CATEGORY);
  const [difficulty, setDifficulty] = useState<BetDifficulty>(myBet?.difficulty ?? DEFAULT_BET_DIFFICULTY);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Garde C2 (18/08/2026, vérification de dépôt §13.2 de
  // SPEC_REFONTE_ONGLET_JOUER_V0_1 : ce formulaire n'avait JAMAIS porté cette
  // garde, contrairement au formulaire de prono — un oubli sans conséquence
  // tant que le pari vivait sur son propre écran, redevenu risqué maintenant
  // qu'il coexiste avec le prono sur la même ligne (Mes pronos). Clé
  // DISTINCTE de celle du prono du même match (`bet:` en préfixe) : les deux
  // formulaires ne doivent jamais partager le même verrou.
  const { markDirty, clearDirty } = useUnsavedGuard(`bet:${matchId ?? seriesId}`);
  const descriptionId = useId();

  useEffect(() => {
    if (!onFieldsChange) return;
    const ready = isOpen && description.trim().length > 0;
    onFieldsChange(ready ? { description, category, difficulty } : null);
  }, [isOpen, description, category, difficulty, onFieldsChange]);

  useEffect(() => {
    const dirty =
      isOpen &&
      (description !== (myBet?.description ?? "") ||
        category !== (myBet?.category ?? DEFAULT_BET_CATEGORY) ||
        difficulty !== (myBet?.difficulty ?? DEFAULT_BET_DIFFICULTY));
    if (dirty) markDirty();
    else clearDirty();
  }, [isOpen, description, category, difficulty, myBet, markDirty, clearDirty]);

  // Démontage (ligne repliée, formulaire fermé) : rien ne reste à protéger.
  useEffect(() => () => clearDirty(), [clearDirty]);

  // Pari déjà posé mais dans un statut non éditable ici (VALIDATED/WON/LOST) :
  // lecture seule, pas de ré-ouverture inline.
  if (hasBet && !myBet) {
    const disabledLabel = `Pari déjà posé sur cette ${scope === "SERIES" ? "série" : "match"}`;
    if (compactTrigger) {
      return (
        <span className={styles.triggerIconDisabled} aria-label={disabledLabel}>
          <BetsIcon size={14} aria-hidden="true" />
        </span>
      );
    }
    return (
      <span className={styles.disabled} aria-disabled="true">
        {disabledLabel}
      </span>
    );
  }

  if (!isOpen) {
    const openLabel = myBet ? "Modifier le pari" : triggerLabel;
    if (compactTrigger) {
      return (
        <button type="button" className={styles.triggerIcon} onClick={() => setIsOpen(true)} aria-label={openLabel}>
          <BetsIcon size={14} aria-hidden="true" />
        </button>
      );
    }
    return (
      <button type="button" className={styles.trigger} onClick={() => setIsOpen(true)}>
        {openLabel}
      </button>
    );
  }

  const isSubmittedBet = myBet?.status === "SUBMITTED";
  const descriptionEmpty = description.trim().length === 0;

  function targetPayload() {
    return {
      betId: myBet?.betId,
      scope,
      seriesId,
      matchId,
      description,
      category,
      difficulty,
    };
  }

  function handleSaveDraft() {
    setError(null);
    startTransition(async () => {
      const result = await saveDraftBet(targetPayload());
      if (result.success) clearDirty();
      else setError(result.error);
    });
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitBet(targetPayload());
      if (result.success) {
        clearDirty();
        // Repli automatique demandé par l'utilisateur le 21/08/2026 (libérer
        // la vue après soumission) -- dans les deux présentations : en modal
        // aussi, rien d'autre ne referme la pop-up toute seule après un
        // succès (ModalDialog ne fait que porter le bouton de fermeture
        // manuelle, onClose).
        setIsOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  function handleWithdraw() {
    if (!myBet) return;
    setError(null);
    startTransition(async () => {
      const result = await withdrawBet(myBet.betId);
      if (!result.success) setError(result.error);
    });
  }

  const fields = (
    <>
      <div className={styles.field}>
        <div className={styles.fieldLabelRow}>
          <label htmlFor={descriptionId} className={styles.fieldLabel}>
            Énoncé
          </label>
          <RuleHelpButton title="Bien rédiger un pari" label="Aide pour rédiger un pari">
            <BetWritingTips />
            <p className={styles.helpSubLabel}>Barème par difficulté</p>
            <BetDifficulteGrid />
          </RuleHelpButton>
        </div>
        <textarea
          id={descriptionId}
          className={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex. Un joueur des Knicks marque 30+"
          rows={2}
          maxLength={2000}
        />
      </div>

      <div className={styles.selectRow}>
        <select
          className={styles.select}
          value={category}
          onChange={(e) => setCategory(e.target.value as BetCategory)}
        >
          {BET_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={difficulty}
          onChange={(e) => setDifficulty(Number(e.target.value) as BetDifficulty)}
        >
          {([1, 2, 3, 4, 5] as BetDifficulty[]).map((level) => (
            <option key={level} value={level}>
              {level} — {BET_DIFFICULTY_LABELS[level]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        {!isSubmittedBet && (
          <button type="button" className={styles.secondary} onClick={handleSaveDraft} disabled={isPending}>
            Enregistrer le brouillon
          </button>
        )}
        {!hideSubmit && (
          <button
            type="button"
            className={styles.primary}
            onClick={handleSubmit}
            disabled={isPending || descriptionEmpty}
          >
            {isPending ? (
              <span className={styles.primaryPending}>
                <Spinner size="sm" />
                Envoi…
              </span>
            ) : isSubmittedBet ? (
              "Soumettre les modifications"
            ) : (
              "Soumettre à validation"
            )}
          </button>
        )}
        {isSubmittedBet && (
          <button type="button" className={styles.withdraw} onClick={handleWithdraw} disabled={isPending}>
            Revenir en brouillon
          </button>
        )}
        {/* Suppression (18/08/2026) : vivait UNIQUEMENT sur l'ex-écran "Mes
            paris" (DeleteBetButton via MyBetRow), disparu avec la fusion
            (SPEC_REFONTE_ONGLET_JOUER_V0_1) — reconduite ici pour ne pas
            perdre la fonctionnalité, et étendue au passage aux paris SÉRIE du
            Bracket (2e appelant de ce composant), qui n'en avaient jamais
            bénéficié. Même garde-fou DRAFT/SUBMITTED que delete_bet
            (migration 20260818090000), déjà assuré par myBet !== null ici. */}
        {myBet && <DeleteBetButton betId={myBet.betId} />}
      </div>
    </>
  );

  if (presentation === "modal") {
    return (
      <ModalDialog title={myBet ? "Modifier le pari" : "Proposer un pari"} onClose={() => setIsOpen(false)}>
        <div className={styles.formModal}>
          {remainingHint && !myBet && <p className={styles.remainingHint}>{remainingHint}</p>}
          {fields}
        </div>
      </ModalDialog>
    );
  }

  return <div className={styles.form}>{fields}</div>;
}
