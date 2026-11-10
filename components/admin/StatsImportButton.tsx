"use client";

import { useState, useTransition } from "react";
import { triggerStatsImport } from "@/lib/actions/admin-stats-import";
import styles from "./RecalculateButton.module.css";

// Lance l'import des box scores (workflow GitHub -> VM). Même style que le
// bouton « Recalculer ». Le mode « présaison » ne sert qu'aux tests.

export function StatsImportButton() {
  const [preseason, setPreseason] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm("Lancer l'import des box scores sur la VM ?")) return;
    setMessage(null);
    startTransition(async () => {
      const result = await triggerStatsImport(preseason ? "presaison" : "manuel");
      setMessage(
        result.success
          ? { ok: true, text: "Import lancé. Suivi dans l'onglet Actions de GitHub (compte quelques minutes)." }
          : { ok: false, text: result.error },
      );
    });
  }

  return (
    <div className={styles.wrapper}>
      <label>
        <input type="checkbox" checked={preseason} onChange={(e) => setPreseason(e.target.checked)} /> Inclure la
        présaison (test)
      </label>
      <button type="button" className={styles.recalculateButton} disabled={isPending} onClick={handleClick}>
        {isPending ? "Lancement…" : "Lancer l'import des box scores"}
      </button>
      {message && (
        <p className={message.ok ? undefined : styles.error} role={message.ok ? "status" : "alert"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
