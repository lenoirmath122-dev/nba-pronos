"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { trackFunnel } from "@/lib/funnel/track";
import { PENDING_ACTION_KEY, funnelActionType, parsePendingAction, resumeUrl } from "@/lib/auth/pendingAction";

// Sur /bienvenue (compte validé) : si le visiteur avait une action en attente
// dans ce navigateur, on le ramène à l'endroit où il l'avait déclenchée.
export function PendingActionReplay() {
  const router = useRouter();
  useEffect(() => {
    try {
      const action = parsePendingAction(window.localStorage.getItem(PENDING_ACTION_KEY), Date.now());
      window.localStorage.removeItem(PENDING_ACTION_KEY);
      if (action) {
        trackFunnel("action_completed", undefined, funnelActionType(action.type));
        router.replace(resumeUrl(action));
      }
    } catch {
      // Stockage indisponible : on reste sur /bienvenue.
    }
  }, [router]);
  return null;
}
