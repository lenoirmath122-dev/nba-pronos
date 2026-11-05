"use client";

import { useSyncExternalStore } from "react";
import { FOCUS_COPY, focusFromSearch } from "@/lib/publicHome/focus";
import styles from "./HomePlay.module.css";

// Prolonge la promesse du reel d'où vient le visiteur. Lu dans l'URL côté
// navigateur : le rendu serveur (et le cache de la page) reste identique pour
// tout le monde, le bloc apparaît après l'hydratation.

const subscribe = () => () => {};
const readSearch = () => window.location.search;
const serverSearch = () => "";

export function HomeFocus({ hasMatch }: { hasMatch: boolean }) {
  const search = useSyncExternalStore(subscribe, readSearch, serverSearch);
  const focus = focusFromSearch(search);
  if (!focus) return null;
  const { title, text } = FOCUS_COPY[focus];
  const lines = (
    <>
      <span className={styles.focusTitle}>{title}</span>
      <span className={styles.focusText}>
        {text}
        {hasMatch ? <span aria-hidden="true"> ↓</span> : null}
      </span>
    </>
  );
  return hasMatch ? (
    <a href="#prono-du-soir" className={`${styles.focus} glass-card`}>
      {lines}
    </a>
  ) : (
    <p className={`${styles.focus} glass-card`}>{lines}</p>
  );
}
