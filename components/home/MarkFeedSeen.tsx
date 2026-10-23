"use client";

import { useEffect } from "react";
import { FEED_SEEN_KEY, setSeenValue } from "@/lib/seen/store";

// Marque « Ça vient de tomber » comme vu dès l'affichage de l'Accueil, pour
// éteindre la pastille de l'onglet Accueil (TabBar.tsx) sur tous les appareils
// du compte (user_seen_state). N'affiche rien : simple effet de bord client.
export function MarkFeedSeen({ latestAt }: { latestAt: string | null }) {
  useEffect(() => {
    if (latestAt) setSeenValue(FEED_SEEN_KEY, latestAt);
  }, [latestAt]);

  return null;
}
