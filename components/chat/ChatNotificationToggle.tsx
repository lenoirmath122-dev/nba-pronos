"use client";

import { useRef, useState } from "react";
import { setChatChannelNotifications } from "@/lib/actions/chat";
import { ensurePushSubscribed } from "@/lib/push/client";
import type { ChatScope } from "@/lib/queries/chat";
import styles from "./ChatNotificationToggle.module.css";

// Menu "..." en bout de ligne d'un canal (addendum SPEC_CHAT_V0_1.md,
// 27/08/2026, demande explicite de l'utilisateur : liste de canaux + réglage
// notif par canal). <details>/<summary> natif plutôt qu'un menu en JS --
// s'ouvre/se ferme sans handler dédié, cohérent avec le reste du dépôt
// (formulaires natifs par défaut). Seule l'ACTIVATION peut exiger la
// permission navigateur + un abonnement Push (ensurePushSubscribed,
// lib/push/client.ts) -- APIs uniquement côté client, d'où ce composant
// "use client" (la désactivation seule aurait pu être un <form> nu comme le
// reste de lib/actions/*). Rendu comme FRÈRE du <Link> de la ligne
// (ChatChannelList.tsx), jamais imbriqué dedans -- <details>/<button> à
// l'intérieur d'un <a> est invalide en HTML et complique inutilement la
// gestion du clic.

type ChatNotificationToggleProps = {
  scope: ChatScope;
  initialEnabled: boolean;
};

export function ChatNotificationToggle({ scope, initialEnabled }: ChatNotificationToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  async function toggle(next: boolean) {
    setPending(true);
    setError(null);
    try {
      if (next) {
        const push = await ensurePushSubscribed();
        if (!push.ok) {
          setError(push.error);
          return;
        }
      }
      const scopeType = scope.type;
      const leagueId = scope.type === "LEAGUE" ? scope.leagueId : null;
      const result = await setChatChannelNotifications(scopeType, leagueId, next);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEnabled(next);
      detailsRef.current?.removeAttribute("open");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue, réessaie.");
    } finally {
      setPending(false);
    }
  }

  return (
    <details ref={detailsRef} className={styles.menu}>
      <summary className={styles.trigger} aria-label="Réglages de notification">
        ⋮
      </summary>
      <div className={styles.panel}>
        <button type="button" className={styles.action} disabled={pending || enabled} onClick={() => void toggle(true)}>
          Activer les notifications
        </button>
        <button type="button" className={styles.action} disabled={pending || !enabled} onClick={() => void toggle(false)}>
          Désactiver les notifications
        </button>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
