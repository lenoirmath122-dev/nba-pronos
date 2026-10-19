"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completeProfile } from "@/lib/auth/guest";
import { PSEUDO_MAX_LENGTH } from "@/lib/pseudo/rules";
import styles from "./AuthScreen.module.css";

// Retour de Google (plan d'attractivité, §1.6 d) : pseudo + case 15 ans, puis le
// compte devient ACTIVE et /bienvenue enregistre les pronos du panier.
export function ChoosePseudoForm() {
  const router = useRouter();
  const [pseudo, setPseudo] = useState("");
  const [age, setAge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await completeProfile({ pseudo, ageConfirmed: age });
      if (result.ok) router.push("/bienvenue");
      else setError(result.error);
    });
  }

  return (
    <div className={`${styles.card} glass-card`}>
      <h1 className={styles.cardTitle}>Choisis ton pseudo</h1>
      <form onSubmit={submit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="pseudo" className={styles.fieldLabel}>
            Pseudo
          </label>
          <input
            id="pseudo"
            type="text"
            required
            maxLength={PSEUDO_MAX_LENGTH}
            autoComplete="nickname"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            className={styles.input}
          />
          <span className={styles.hint}>C&apos;est ton nom au classement</span>
        </div>
        <div className={styles.checkboxField}>
          <input id="age" type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} className={styles.checkbox} />
          <label htmlFor="age" className={styles.checkboxLabel}>
            J&apos;ai 15 ans ou plus
          </label>
        </div>
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className={styles.submit}>
          {pending ? "Enregistrement…" : "Continuer"}
        </button>
      </form>
    </div>
  );
}
