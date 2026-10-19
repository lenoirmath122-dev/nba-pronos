"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { saveBasketForCurrentUser, updateEmailPreferences } from "@/lib/auth/guest";
import { updateNotificationPreference } from "@/lib/actions/notifications";
import { BASKET_KEY, parseBasket } from "@/lib/publicHome/basket";
import { ensurePushSubscribed, isStandalone } from "@/lib/push/client";
import styles from "@/components/auth/AuthScreen.module.css";

// Page « Bienvenue » (plan d'attractivité, §1.3 étape ⑤). Au montage, enregistre
// les pronos du panier encore absents de la base (compte existant qui se
// connecte sur le même appareil, retour de Google), puis vide le panier local.

function subscribeToNothing() {
  return () => {};
}

type Props = {
  pseudo: string;
  pronos: string[];
  initialResults: boolean;
  initialReminders: boolean;
};

export function WelcomePanel({ pseudo, pronos, initialResults, initialReminders }: Props) {
  const router = useRouter();
  const [results, setResults] = useState(initialResults);
  const [reminders, setReminders] = useState(initialReminders);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Le bouton push n'a de sens que dans l'app installée (§1.3).
  const standalone = useSyncExternalStore(subscribeToNothing, isStandalone, () => false);

  useEffect(() => {
    const flush = async () => {
      let items;
      try {
        items = parseBasket(window.localStorage.getItem(BASKET_KEY));
      } catch {
        return;
      }
      if (items.length === 0) return;
      const { saved } = await saveBasketForCurrentUser(items);
      if (!saved) return;
      try {
        window.localStorage.removeItem(BASKET_KEY);
      } catch {
        // Stockage indisponible : le panier se videra tout seul (matchs commencés).
      }
      router.refresh();
    };
    void flush();
  }, [router]);

  function save(nextResults: boolean, nextReminders: boolean) {
    setResults(nextResults);
    setReminders(nextReminders);
    startTransition(async () => {
      const result = await updateEmailPreferences({ results: nextResults, reminders: nextReminders });
      setMessage(result.ok ? null : result.error);
    });
  }

  function preferPush() {
    startTransition(async () => {
      const push = await ensurePushSubscribed();
      if (!push.ok) {
        setMessage(push.error);
        return;
      }
      await updateNotificationPreference("PUSH");
      const result = await updateEmailPreferences({ results: false, reminders: false });
      setResults(false);
      setReminders(false);
      setMessage(result.ok ? "Notifications push activées." : result.error);
    });
  }

  return (
    <div className={`${styles.card} glass-card`}>
      <h1 className={styles.cardTitle}>Bienvenue {pseudo}</h1>
      {pronos.length > 0 ? (
        <>
          <p className={styles.hint}>Tes pronos sont validés ✅ Résultat demain matin dans ta boîte mail.</p>
          <ul className={styles.pronoList}>
            {pronos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className={styles.hint}>Ton compte est validé. Choisis un match pour faire ton premier prono.</p>
      )}

      <div className={styles.form}>
        <div className={styles.checkboxField}>
          <input
            id="pref-results"
            type="checkbox"
            checked={results}
            disabled={pending}
            onChange={(e) => save(e.target.checked, reminders)}
            className={styles.checkbox}
          />
          <label htmlFor="pref-results" className={styles.checkboxLabel}>
            Recevoir mes résultats par email
          </label>
        </div>
        <div className={styles.checkboxField}>
          <input
            id="pref-reminders"
            type="checkbox"
            checked={reminders}
            disabled={pending}
            onChange={(e) => save(results, e.target.checked)}
            className={styles.checkbox}
          />
          <label htmlFor="pref-reminders" className={styles.checkboxLabel}>
            Recevoir un rappel avant les matchs
          </label>
        </div>
        {standalone ? (
          <button type="button" onClick={preferPush} disabled={pending} className={styles.secondary}>
            Je préfère en push
          </button>
        ) : null}
        {message ? (
          <p role="status" className={styles.hint}>
            {message}
          </p>
        ) : null}
      </div>

      <Link href="/play" className={styles.submit} style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>
        Voir les matchs
      </Link>
      <p className={styles.linkLine}>
        <Link href="/profile" className={styles.link}>
          Créer un mot de passe (facultatif)
        </Link>
      </p>
    </div>
  );
}
