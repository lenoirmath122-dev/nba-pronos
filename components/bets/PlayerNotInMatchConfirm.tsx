"use client";

import { useEffect, useRef } from "react";
import { Spinner } from "@/components/ui/Spinner";
import styles from "./PlayerNotInMatchConfirm.module.css";

// p3-14 (04/10/2026) : avertissement affiché à la place des boutons du
// formulaire quand submitBet() renvoie `playerNotInMatch` -- l'IA juge que
// le joueur visé ne joue pour aucune des 2 équipes, le pari est déjà
// repassé en brouillon côté serveur. Partagé par InlineBetForm et BetForm.
// Confirmation plutôt que refus : l'IA peut se tromper (transfert récent).

type PlayerNotInMatchConfirmProps = {
  playerName: string;
  isPending: boolean;
  onEdit: () => void;
  onConfirm: () => void;
};

export function PlayerNotInMatchConfirm({ playerName, isPending, onEdit, onConfirm }: PlayerNotInMatchConfirmProps) {
  const titleRef = useRef<HTMLParagraphElement>(null);

  // Focus sur l'avertissement à son apparition : le bouton « Soumettre »
  // qui avait le focus vient de disparaître.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <div className={styles.box} role="alertdialog" aria-labelledby="not-in-match-title" aria-describedby="not-in-match-desc">
      <p id="not-in-match-title" ref={titleRef} tabIndex={-1} className={styles.title}>
        {playerName} ne joue pas ce match&nbsp;?
      </p>
      <p id="not-in-match-desc" className={styles.text}>
        D&rsquo;après notre analyse, il ne joue pour aucune des deux équipes. Ton pari est resté en brouillon.
        Envoyé tel quel, il sera perdu si {playerName} n&rsquo;est pas sur la feuille de match.
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={onEdit} disabled={isPending}>
          Corriger le pari
        </button>
        <button type="button" className={styles.secondary} onClick={onConfirm} disabled={isPending}>
          {isPending ? (
            <span className={styles.pending}>
              <Spinner size="sm" />
              Envoi…
            </span>
          ) : (
            "Envoyer quand même"
          )}
        </button>
      </div>
    </div>
  );
}
