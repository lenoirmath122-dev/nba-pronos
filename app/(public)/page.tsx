import Link from "next/link";
import type { Metadata } from "next";
import { HOME_TITLE, TAGLINE, pageMetadata } from "@/lib/seo";
import styles from "./home.module.css";

// Page d'accueil publique (socle SEO, étape C du 05/10/2026) -- remplace la
// redirection vers /login. Aucune requête Supabase : un visiteur connecté est
// renvoyé vers /home par proxy.ts avant d'arriver ici. Vocabulaire : le mot
// « paris » est voulu (référencement, décision du 05/10/2026), toujours
// accompagné de « sans argent réel » (point de vigilance ANJ).
const base = pageMetadata({ title: "Accueil", path: "/" });
export const metadata: Metadata = {
  ...base,
  title: { absolute: HOME_TITLE },
  openGraph: { ...base.openGraph, title: HOME_TITLE },
  twitter: { ...base.twitter, title: HOME_TITLE },
};

const FEATURES = [
  {
    title: "Pronostics de matchs",
    text: "Choisis le vainqueur et l'écart de points avant le coup d'envoi.",
  },
  {
    title: "Paris perso",
    text: "Invente tes propres paris sur une série ou un match, sans un euro en jeu.",
  },
  {
    title: "Bracket",
    text: "Prédis le parcours de chaque série jusqu'au titre.",
  },
  {
    title: "Classement et ligues",
    text: "Grimpe au classement général, ou crée ta ligue privée avec ta bande.",
  },
];

const STEPS = [
  "Crée ton compte en 30 secondes.",
  "Chaque jour, pronostique le match : vainqueur et écart.",
  "Grimpe au classement, gagne des badges, chambre tes potes.",
];

export default function LandingPage() {
  return (
    <main className={`${styles.page} photo-page force-photo`}>
      <section className={styles.hero}>
        <h1 className={styles.title}>La saison NBA démarre le 20/10. Pronostique chaque match, grimpe au classement.</h1>
        <p className={styles.lead}>
          Choisis le vainqueur et l&apos;écart de points, remplis ton bracket des playoffs et défie ta bande. 100 % gratuit : que des
          points, aucun argent réel.
        </p>
        <div className={styles.actions}>
          <Link href="/signup" className={styles.primary}>
            Je rejoins la saison
          </Link>
        </div>
        <p className={styles.free}>Inscription en 30 secondes · Classement général ouvert à tous</p>
        <Link href="/login" className={styles.loginLink}>
          J&apos;ai déjà un compte
        </Link>
      </section>

      <section className={styles.features}>
        {FEATURES.map((f) => (
          <article key={f.title} className={`${styles.card} glass-card`}>
            <h2 className={styles.cardTitle}>{f.title}</h2>
            <p className={styles.cardText}>{f.text}</p>
          </article>
        ))}
      </section>

      <section className={styles.steps} aria-labelledby="how-title">
        <h2 id="how-title" className={styles.stepsTitle}>
          Comment ça marche
        </h2>
        <ol className={styles.stepList}>
          {STEPS.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ol>
      </section>

      <nav className={styles.discover} aria-label="Découvrir">
        <Link href="/leaderboard">Voir le classement</Link>
        <Link href="/bracket">Voir le bracket</Link>
        <Link href="/regles">Lire les règles</Link>
      </nav>
    </main>
  );
}
