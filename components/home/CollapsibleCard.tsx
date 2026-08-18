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
   *  sans avoir à l'ouvrir. */
  count: number;
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
export function CollapsibleCard({ id, title, count, children }: CollapsibleCardProps) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
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
            <span className={styles.count}>{count}</span>
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
