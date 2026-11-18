"use client";

import { useEffect, useState } from "react";
import styles from "./guest.module.css";

// Bandeau invité (mode invité, lot E) : en bas de page, dans le flux (il ne
// recouvre rien), fermable, et la fermeture est mémorisée sur ce navigateur.
export const GUEST_BANNER_KEY = "pb.guestBannerClosed.v1";

export function GuestBanner({ onCreate }: { onCreate: () => void }) {
  // Caché tant que le stockage n'est pas lu : pas de flash pour qui l'a déjà fermé.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(GUEST_BANNER_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function close() {
    setVisible(false);
    try {
      window.localStorage.setItem(GUEST_BANNER_KEY, "1");
    } catch {
      // Navigation privée : fermé pour cette page seulement.
    }
  }

  return (
    <aside className={`${styles.banner} glass-card`} aria-label="Créer un compte">
      <p className={styles.bannerText}>Tu regardes en invité. Crée un compte pour pronostiquer et écrire dans le chat.</p>
      <div className={styles.bannerActions}>
        <button type="button" className={styles.cta} onClick={onCreate}>
          Créer un compte
        </button>
        <button type="button" className={styles.bannerClose} onClick={close} aria-label="Fermer le bandeau">
          ×
        </button>
      </div>
    </aside>
  );
}
