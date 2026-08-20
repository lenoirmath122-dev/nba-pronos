"use client";

import { useState, useSyncExternalStore } from "react";
import { clickableRowProps } from "@/lib/hooks/clickableRow";
import styles from "./CollapsibleCard.module.css";

type CollapsibleCardProps = {
  /** Clé stable de la carte, utilisée pour la mémorisation « déjà ouverte »
   *  (localStorage, par appareil — pas de colonne serveur pour une simple
   *  préférence d'affichage). */
  id: string;
  title: string;
  /** Nombre de lignes contenues (18/08/2026, demandé par l'utilisateur) —
   *  visible même carte repliée, pour savoir si elle contient quelque chose
   *  sans avoir à l'ouvrir. Omis pour les cartes qui n'enveloppent pas une
   *  liste (Profil / onglet Stats, AJUSTEMENTS_VISUELS_20_08_2026 §14) —
   *  pas de nombre de lignes honnête à afficher pour un résumé de stats. */
  count?: number;
  /** Ouverte par défaut au lieu de repliée (Profil / onglet Stats §14 :
   *  Précision/Comparaison restent ouvertes, « ça amène un peu de couleur »
   *  face à un écran sinon très neutre au 1er coup d'œil). Le point d'alerte
   *  "jamais ouverte" est désactivé pour ces cartes : leur contenu est déjà
   *  visible au chargement, rien à signaler. */
  defaultOpen?: boolean;
  children: React.ReactNode;
};

const STORAGE_PREFIX = "home-card-seen:";

function noopSubscribe() {
  return () => {};
}

function getServerSnapshot() {
  return false;
}

// Carte dépliable de l'Accueil (18/08/2026, demandé par l'utilisateur) :
// fermée par défaut, avec un point d'alerte tant que la carte n'a jamais
// été ouverte sur cet appareil. Patron d'en-tête cliquable identique à
// BetGroupRow.tsx (clickableRowProps, chevron ⌃/⌄) ; le titre en <h2> englobe
// la zone cliquable plutôt que l'inverse, pour rester un disclosure widget
// standard (WAI-ARIA) — un <div role="button"> ne doit pas définir sa propre
// sémantique de titre.
//
// useSyncExternalStore plutôt qu'un useEffect+setState pour lire
// localStorage : lint react-hooks/set-state-in-effect interdit le setState
// synchrone dans un effet, et localStorage EST un store externe — son cas
// d'usage exact. Snapshot serveur toujours `false` (jamais de point tant
// que l'hydratation n'a pas eu lieu, aucun flash de contenu différent).
export function CollapsibleCard({ id, title, count, defaultOpen = false, children }: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  // Initialisé à `defaultOpen` : une carte déjà ouverte au chargement n'a
  // rien de "jamais consulté" à signaler, pas besoin d'attendre un clic pour
  // faire taire le point d'alerte.
  const [dismissed, setDismissed] = useState(defaultOpen);
  const neverSeen = useSyncExternalStore(
    noopSubscribe,
    () => window.localStorage.getItem(`${STORAGE_PREFIX}${id}`) === null,
    getServerSnapshot
  );
  const unseen = neverSeen && !dismissed;

  function toggle() {
    setOpen((current) => !current);
    if (unseen) {
      window.localStorage.setItem(`${STORAGE_PREFIX}${id}`, "1");
      setDismissed(true);
    }
  }

  return (
    <>
      <h2 className={styles.title}>
        <div
          {...clickableRowProps(toggle)}
          className={open ? styles.headerOpen : styles.header}
          aria-expanded={open}
        >
          <span>{title}</span>
          <span className={styles.right}>
            {count !== undefined && <span className={styles.count}>{count}</span>}
            {unseen && <span className={styles.dot} aria-hidden="true" />}
            <span className={styles.chevron} aria-hidden="true">
              {open ? "⌃" : "⌄"}
            </span>
          </span>
        </div>
      </h2>
      {open && children}
    </>
  );
}
