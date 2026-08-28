"use client";

import { useState } from "react";
import { setChatChannelNotifications } from "@/lib/actions/chat";
import { ensurePushSubscribed } from "@/lib/push/client";
import type { ChatScope } from "@/lib/queries/chat";
import styles from "./ChatNotificationToggle.module.css";

// Bouton unique en bout de ligne d'un canal (addendum SPEC_CHAT_V0_1.md,
// 27/08/2026 -- simplifié le 28/08/2026 : plus de menu "..." à ouvrir, un
// seul bouton dont le libellé bascule selon l'état, demande explicite de
// l'utilisateur). Seule l'ACTIVATION peut exiger la permission navigateur +
// un abonnement Push (ensurePushSubscribed, lib/push/client.ts) -- APIs
// uniquement côté client, d'où ce composant "use client". Rendu comme FRÈRE
// du <Link> de la ligne (ChatChannelList.tsx), jamais imbriqué dedans.

type ChatNotificationToggleProps = {
  scope: ChatScope;
  initialEnabled: boolean;
};

export function ChatNotificationToggle({ scope, initialEnabled }: ChatNotificationToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !enabled;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue, réessaie.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <button type="button" className={styles.action} disabled={pending} onClick={() => void toggle()}>
        {enabled ? "Désactiver les notifications" : "Activer les notifications"}
      </button>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
