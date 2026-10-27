"use client";

import { useEffect } from "react";
import { captureUtm } from "@/lib/funnel/track";

// Garde les UTM dès l'arrivée sur n'importe quelle page, avant le premier événement.
export function UtmCapture() {
  useEffect(() => {
    captureUtm();
  }, []);
  return null;
}
