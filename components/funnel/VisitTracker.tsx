"use client";

import { useEffect } from "react";
import { captureUtm, trackDailyVisit } from "@/lib/funnel/track";

// Sur toutes les pages : garde les UTM dès l'arrivée (avant le premier
// événement) et envoie la « visit » du jour, y compris quand l'appli installée
// revient au premier plan le lendemain sans avoir été rechargée.
export function VisitTracker() {
  useEffect(() => {
    captureUtm();
    trackDailyVisit();
    const onVisible = () => {
      if (document.visibilityState === "visible") trackDailyVisit();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return null;
}
