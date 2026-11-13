"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./Disclosure.module.css";

// Bouton « Voir mes N paris » de la carte « Ta nuit » (Actualité,
// 13/11/2026) : le contenu est rendu côté serveur et passé en enfant, ce
// composant ne porte que l'état ouvert/fermé.

type DisclosureProps = {
  openLabel: string;
  closeLabel: string;
  children: React.ReactNode;
};

export function Disclosure({ openLabel, closeLabel, children }: DisclosureProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className={styles.wrap}>
      <div id={panelId} className={styles.panel} hidden={!open}>
        {children}
      </div>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? closeLabel : openLabel}
        <ChevronDown size={16} aria-hidden="true" className={open ? styles.chevronOpen : styles.chevron} />
      </button>
    </div>
  );
}
