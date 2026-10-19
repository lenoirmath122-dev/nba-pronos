"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { registerPronos, requestLoginLink } from "@/lib/auth/guest";
import { BASKET_KEY, parseBasket, type BasketItem } from "@/lib/publicHome/basket";
import { PSEUDO_MAX_LENGTH } from "@/lib/pseudo/rules";
import { GoogleButton } from "@/components/auth/GoogleButton";
import styles from "@/components/auth/AuthScreen.module.css";

// Écran ② « Enregistre tes pronos » (plan d'attractivité, §1.3 et §1.11). Le
// panier vient de localStorage ; tout part en base à l'envoi. Après l'envoi, le
// panier local est conservé : /bienvenue le vide une fois connecté (et, pour un
// compte déjà existant, y enregistre les pronos encore ouverts).

function readBasket(): BasketItem[] {
  try {
    return parseBasket(window.localStorage.getItem(BASKET_KEY));
  } catch {
    return [];
  }
}

export function RegisterForm() {
  const [count, setCount] = useState<number | null>(null);
  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const load = () => setCount(readBasket().length);
    load();
  }, []);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await registerPronos({ pseudo, email, ageConfirmed: age, items: readBasket() });
      if (result.ok) setSentTo(email.trim());
      else setError(result.error);
    });
  }

  function resend() {
    if (!sentTo) return;
    startTransition(async () => {
      const result = await requestLoginLink(sentTo);
      if (result.ok) setResent(true);
      else setError(result.error);
    });
  }

  if (sentTo) {
    return (
      <div className={`${styles.card} glass-card`}>
        <h1 className={styles.cardTitle}>C&apos;est noté !</h1>
        <p className={styles.hint}>Ouvre le mail qu&apos;on vient de t&apos;envoyer pour valider tes pronos.</p>
        <p className={styles.hint}>Je n&apos;ai rien reçu ? Vérifie tes spams.</p>
        {resent ? <p className={styles.success}>Mail renvoyé.</p> : null}
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
        <button type="button" onClick={resend} disabled={pending} className={styles.secondary}>
          Renvoyer le mail
        </button>
      </div>
    );
  }

  return (
    <div className={`${styles.card} glass-card`}>
      <h1 className={styles.cardTitle}>Enregistre tes pronos 🏀</h1>
      {count === 0 ? (
        <p className={styles.hint}>
          Ton panier est vide. <Link href="/" className={styles.link}>Choisis un match</Link> d&apos;abord, ou crée simplement ton compte.
        </p>
      ) : null}
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
        <div className={styles.field}>
          <label htmlFor="email" className={styles.fieldLabel}>
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
          />
          <span className={styles.hint}>On t&apos;envoie tes résultats par email</span>
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
          {pending ? "Envoi…" : "Enregistrer mes pronos"}
        </button>
      </form>
      <p className={styles.separator}>ou</p>
      <GoogleButton />
      <div className={styles.links}>
        <p className={styles.linkLine}>
          Déjà un compte ?{" "}
          <Link href="/login" className={styles.link}>
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
