"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ModalDialog } from "@/components/ui/ModalDialog";
import { useIsValidatedDialogOpen } from "@/components/ui/ValidatedDialog";
import { getMyWeeklyPopup, markWeeklyPopupSeen, type MyWeeklyPopup } from "@/lib/actions/weekly-popup";
import { WeeklyPopupCard } from "./WeeklyPopupCard";
import { useSetWeeklyPopupOpen } from "./WeeklyPopupProvider";
import styles from "./WeeklyPopupCard.module.css";

// Popup hebdomadaire du classement (lot 5, PR 5) : texte humoristique publié le
// lundi par un admin. Même cycle que NewBadgesWatcher : lecture après le
// montage (800 ms), nouvelle lecture au retour au premier plan (au plus toutes
// les 5 min : une PWA ouverte depuis le dimanche voit celle du lundi). Passe
// après « Pari validé » ; la popup « nouveau badge » passe après elle
// (WeeklyPopupProvider).
//
// « Vu » est écrit en base à la fermeture, quelle qu'en soit la voie (par
// joueur, pas par appareil : plan §1.4). Le drapeau sessionStorage évite un
// second affichage dans la session si l'écriture a échoué.

const INITIAL_DELAY_MS = 800;
const RECHECK_INTERVAL_MS = 5 * 60 * 1000;
// Coupe-circuit posé par les tests e2e (e2e/fixtures.ts), comme celui des
// badges : le fond d'une popup avale les clics.
const DISABLED_STORAGE_KEY = "weekly-popup:disabled";
const SEEN_SESSION_PREFIX = "weekly-popup:seen:";

function isDisabled(): boolean {
  try {
    return window.localStorage.getItem(DISABLED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function seenThisSession(popupId: string): boolean {
  try {
    return window.sessionStorage.getItem(SEEN_SESSION_PREFIX + popupId) === "1";
  } catch {
    return false;
  }
}

function rememberSeenThisSession(popupId: string) {
  try {
    window.sessionStorage.setItem(SEEN_SESSION_PREFIX + popupId, "1");
  } catch {
    // Stockage indisponible : au pire la popup revient, sans gravité.
  }
}

export function WeeklyPopupWatcher() {
  const [pending, setPending] = useState<MyWeeklyPopup | null>(null);
  const validatedDialogOpen = useIsValidatedDialogOpen();
  const setProviderOpen = useSetWeeklyPopupOpen();
  const openRef = useRef(false);
  const lastCheckRef = useRef(0);
  const inFlightRef = useRef(false);

  const check = useCallback(async () => {
    if (openRef.current || inFlightRef.current) return;
    if (isDisabled()) {
      setProviderOpen(false);
      return;
    }
    inFlightRef.current = true;
    lastCheckRef.current = Date.now();
    try {
      let result: MyWeeklyPopup | null = null;
      try {
        result = await getMyWeeklyPopup();
      } catch {
        result = null;
      }
      if (openRef.current) return;
      if (result && !seenThisSession(result.popupId)) {
        openRef.current = true;
        setPending(result);
        return;
      }
      setProviderOpen(false);
    } finally {
      inFlightRef.current = false;
    }
  }, [setProviderOpen]);

  useEffect(() => {
    const initial = window.setTimeout(() => void check(), INITIAL_DELAY_MS);
    function handleVisibility() {
      if (document.visibilityState === "visible" && Date.now() - lastCheckRef.current > RECHECK_INTERVAL_MS) {
        void check();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearTimeout(initial);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [check]);

  // Toute sortie (« À mes pronos », × Fermer, fond, Échap) marque comme vue.
  const finish = useCallback(() => {
    if (pending) {
      rememberSeenThisSession(pending.popupId);
      void markWeeklyPopupSeen(pending.popupId).catch(() => {});
    }
    openRef.current = false;
    setPending(null);
    setProviderOpen(false);
  }, [pending, setProviderOpen]);

  if (!pending || validatedDialogOpen) return null;

  return (
    <ModalDialog title={pending.popup.titre} onClose={finish}>
      <WeeklyPopupCard popup={pending.popup}>
        <div className={styles.actions}>
          <Link href="/play" className={styles.play} onClick={finish}>
            À mes pronos
          </Link>
        </div>
      </WeeklyPopupCard>
    </ModalDialog>
  );
}
