"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { StatusScreen } from "@/components/ui/StatusScreen";
import styles from "@/components/ui/StatusScreen.module.css";

// Next.js 16.2+ : unstable_retry() remplace reset() comme mécanisme recommandé
// (re-fetch + re-render du segment plutôt qu'un simple clear d'état local) —
// voir node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md.
export default function ErrorBoundary({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <StatusScreen title="Une erreur est survenue" message="Quelque chose s'est mal passé de notre côté. Réessaie, ou reviens à l'accueil.">
      <button type="button" onClick={() => unstable_retry()} className={styles.action}>
        Réessayer
      </button>
      <a href="/home" className={styles.actionSecondary}>
        Retour à l&apos;accueil
      </a>
    </StatusScreen>
  );
}
