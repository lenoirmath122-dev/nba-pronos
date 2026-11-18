"use client";

import { useRequireAuth } from "@/components/auth/AuthGateProvider";
import type { PendingActionType } from "@/lib/auth/pendingAction";
import styles from "./guest.module.css";

/** Bouton d'action d'une page invité : ouvre la modale de compte et garde l'action en attente. */
export function GuestGateButton({
  type,
  label,
  payload,
}: {
  type: PendingActionType;
  label: string;
  payload?: Record<string, string | number | boolean>;
}) {
  const requireAuth = useRequireAuth();
  return (
    <button type="button" className={styles.cta} onClick={() => requireAuth({ type, payload })}>
      {label}
    </button>
  );
}
