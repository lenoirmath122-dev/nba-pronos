"use client";

import { useEffect } from "react";
import { HOME_FEED_SEEN_STORAGE_KEY } from "@/lib/nav/feedSeen";

// Marque « Ça vient de tomber » comme vu dès l'affichage de l'Accueil, pour
// éteindre la pastille de l'onglet Accueil (TabBar.tsx) sur cet appareil.
// N'affiche rien : simple effet de bord côté client (localStorage n'existe
// pas côté serveur).
export function MarkFeedSeen({ latestAt }: { latestAt: string | null }) {
  useEffect(() => {
    if (latestAt) window.localStorage.setItem(HOME_FEED_SEEN_STORAGE_KEY, latestAt);
  }, [latestAt]);

  return null;
}
