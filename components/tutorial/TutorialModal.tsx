"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./TutorialModal.module.css";

// Wizard du tutoriel joueur (SPEC_TUTORIEL_JOUEUR_V0_1 §2/§3), contenu 100%
// statique (aucune donnée de compétition) — même patron de dialogue que
// components/my-predictions/OtherBetsModal.tsx (backdrop + role="dialog").
// Composant purement présentationnel : contrôlé par `open`/`onClose`, la
// décision "faut-il l'afficher au chargement" reste au parent (bannière
// Accueil ou lien Profil).

type Step = {
  title: string;
  body: string;
  image?: { src: string; width: number; height: number };
};

// Copie ajustable librement (contenu statique, pas une donnée figée en
// base) — voir §9 de la spec pour une future 8ème étape "Badges permanents".
// Captures réelles (§3 de la spec, ajout du 30/07/2026) : étapes 1/2
// conceptuelles, PAS de capture ; étapes 3→7 liées à un vrai écran, avec
// capture. Risque de péremption (DA non stabilisée) accepté explicitement.
const STEPS: Step[] = [
  {
    title: "Bienvenue",
    body: "Pronostique les matchs NBA de la saison avec tes potes, compare vos scores, et découvre qui est le vrai prophète du groupe.",
  },
  {
    title: "Le point clé : ça repart à zéro",
    body: "Chaque nouvelle compétition (Playoffs, NBA Cup...) remet les compteurs à zéro : pronos, paris et classement recommencent à 0 point. Seuls ton historique (superlatifs passés) et tes ligues d'amis restent d'une compétition à l'autre.",
  },
  {
    title: "Matchs & paris",
    body: "Avant chaque match, pronostique le vainqueur et l'écart de points. Tu peux aussi proposer un pari libre — sur ce match précis ou sur toute une série.",
    image: { src: "/tutorial/matches.png", width: 480, height: 180 },
  },
  {
    title: "Mes pronos",
    body: "Retrouve tous tes pronostics et paris au même endroit, avec leur statut (en attente, validé, gagné...).",
    image: { src: "/tutorial/my-predictions.png", width: 480, height: 460 },
  },
  {
    title: "Bracket personnel",
    body: "Avant le début des Playoffs, remplis ton bracket complet : qui ira jusqu'où, série par série.",
    image: { src: "/tutorial/bracket.png", width: 480, height: 570 },
  },
  {
    title: "Classement & Ligues",
    body: "Compare ton score à tous les joueurs, ou filtre sur une ligue privée entre amis (code à partager pour les faire rejoindre).",
    image: { src: "/tutorial/leaderboard.png", width: 480, height: 240 },
  },
  {
    title: "Rappels",
    body: "On te prévient avant chaque deadline importante (match, bracket) pour ne rien rater.",
    image: { src: "/tutorial/reminders.png", width: 480, height: 220 },
  },
];

type TutorialModalProps = {
  open: boolean;
  onClose: () => void;
};

export function TutorialModal({ open, onClose }: TutorialModalProps) {
  const [stepIndex, setStepIndex] = useState(0);

  if (!open) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;
  const step = STEPS[stepIndex];

  function handleClose() {
    setStepIndex(0); // prêt pour une prochaine ouverture (lien Profil, §1)
    onClose();
  }

  return (
    <div className={styles.backdrop} role="presentation" onClick={handleClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <span className={styles.progress}>
            Étape {stepIndex + 1}/{STEPS.length}
          </span>
          <button type="button" className={styles.skip} onClick={handleClose}>
            Passer
          </button>
        </div>

        <p id="tutorial-title" className={styles.title}>
          {step.title}
        </p>
        <p className={styles.body}>{step.body}</p>

        {step.image && (
          <Image
            src={step.image.src}
            alt={step.title}
            width={step.image.width}
            height={step.image.height}
            className={styles.image}
          />
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setStepIndex((i) => i - 1)}
            disabled={isFirst}
          >
            Précédent
          </button>
          {isLast ? (
            <button type="button" className={styles.primaryButton} onClick={handleClose}>
              Terminé
            </button>
          ) : (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => setStepIndex((i) => i + 1)}
            >
              Suivant
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
