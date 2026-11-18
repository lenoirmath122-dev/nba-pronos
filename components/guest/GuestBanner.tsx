"use client";

import { useSyncExternalStore } from "react";
import styles from "./guest.module.css";

// Bandeau invité (mode invité, lot E) : en bas de page, dans le flux (il ne
// recouvre rien), fermable, et la fermeture est mémorisée sur ce navigateur.
export const GUEST_BANNER_KEY = "pb.guestBannerClosed.v1";

const listeners = new Set<() => void>();
let closedInMemory = false;

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function isClosed(): boolean {
  if (closedInMemory) return true;
  try {
    return window.localStorage.getItem(GUEST_BANNER_KEY) === "1";
  } catch {
    return false;
  }
}

export function GuestBanner({ onCreate }: { onCreate: () => void }) {
  // Côté serveur le bandeau est caché (snapshot « fermé ») : pas de flash pour qui l'a déjà fermé.
  const closed = useSyncExternalStore(subscribe, isClosed, () => true);
  if (closed) return null;

  function close() {
    closedInMemory = true;
    try {
      window.localStorage.setItem(GUEST_BANNER_KEY, "1");
    } catch {
      // Navigation privée : fermé pour cette session de page seulement.
    }
    listeners.forEach((cb) => cb());
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
