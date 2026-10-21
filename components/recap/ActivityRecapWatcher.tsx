"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ModalDialog } from "@/components/ui/ModalDialog";
import { useIsValidatedDialogOpen } from "@/components/ui/ValidatedDialog";
import { useIsWeeklyPopupOpen, useSetRecapOpen } from "@/components/weeklyPopup/WeeklyPopupProvider";
import { getActivityRecap, type ActivityRecap } from "@/lib/actions/activity-recap";
import { summarizeRecap } from "@/lib/recap/summary";
import { ActivityRecapCard } from "./ActivityRecapCard";
import styles from "./ActivityRecapCard.module.css";

// Popup « depuis ta dernière visite » : résultats de pronos et de paris tombés
// depuis la dernière ouverture sur cet appareil. S'ajoute à la notification et
// à « Ça vient de tomber » de l'Accueil, ne les remplace pas.
//
// « Vu » = état purement client (localStorage, par appareil), même patron que
// la pastille Accueil (lib/nav/feedSeen.ts) et ValidatedBetsWatcher. Le repère
// avancé est l'instant de LECTURE renvoyé par le serveur, pas l'heure de
// fermeture : un résultat tombé entre les deux ne serait jamais montré.
//
// Premier passage (clé absente) : on retient l'instant présent sans rien
// montrer, sinon tout l'historique récent sauterait au visage d'un coup.
// Ordre des popups : « Pari validé », popup hebdo, ce récap, puis badges
// (WeeklyPopupProvider).

const SEEN_STORAGE_KEY = "activity-recap-seen-at";
// Coupe-circuit posé par les tests e2e (e2e/fixtures.ts) : le fond d'une popup
// avale les clics.
const DISABLED_STORAGE_KEY = "activity-recap:disabled";
const INITIAL_DELAY_MS = 800;
const RECHECK_INTERVAL_MS = 5 * 60 * 1000;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSeen(value: string) {
  try {
    window.localStorage.setItem(SEEN_STORAGE_KEY, value);
  } catch {
    // Stockage indisponible (navigation privée) : le récap reviendra, sans gravité.
  }
}

export function ActivityRecapWatcher() {
  const [pending, setPending] = useState<ActivityRecap | null>(null);
  const validatedDialogOpen = useIsValidatedDialogOpen();
  const weeklyPopupOpen = useIsWeeklyPopupOpen();
  const setRecapOpen = useSetRecapOpen();
  const openRef = useRef(false);
  const lastCheckRef = useRef(0);
  const inFlightRef = useRef(false);

  const check = useCallback(async () => {
    if (openRef.current || inFlightRef.current) return;
    if (readStorage(DISABLED_STORAGE_KEY) === "1") {
      setRecapOpen(false);
      return;
    }
    const seenAt = readStorage(SEEN_STORAGE_KEY);
    if (seenAt === null) {
      writeSeen(new Date().toISOString());
      setRecapOpen(false);
      return;
    }

    inFlightRef.current = true;
    lastCheckRef.current = Date.now();
    try {
      let result: ActivityRecap | null = null;
      try {
        result = await getActivityRecap(seenAt);
      } catch {
        result = null;
      }
      if (openRef.current) return;
      if (result && result.items.length > 0) {
        openRef.current = true;
        setPending(result);
        return;
      }
      if (result) writeSeen(result.asOf);
      setRecapOpen(false);
    } finally {
      inFlightRef.current = false;
    }
  }, [setRecapOpen]);

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

  // Toute sortie (bouton, × Fermer, fond, Échap) marque le récap comme vu.
  const finish = useCallback(() => {
    if (pending) writeSeen(pending.asOf);
    openRef.current = false;
    setPending(null);
    setRecapOpen(false);
  }, [pending, setRecapOpen]);

  if (!pending || validatedDialogOpen || weeklyPopupOpen) return null;

  return (
    <ModalDialog title="Depuis ta dernière visite" onClose={finish}>
      <ActivityRecapCard summary={summarizeRecap(pending.items)}>
        <div className={styles.actions}>
          <Link href="/play/results" className={styles.primary} onClick={finish}>
            Voir mes résultats
          </Link>
        </div>
      </ActivityRecapCard>
    </ModalDialog>
  );
}
