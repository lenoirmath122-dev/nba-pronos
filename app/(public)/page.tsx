import Link from "next/link";
import type { Metadata } from "next";
import { HOME_TITLE, pageMetadata } from "@/lib/seo";
import { HomePlay } from "@/components/publicHome/HomePlay";
import { getPublicHomeData } from "@/lib/publicHome/query";
import styles from "./home.module.css";

// Données de l'accueil lues avec un client anonyme, sans cookie : cache de 60 s.
export const revalidate = 60;

// Page d'accueil publique (socle SEO, étape C du 05/10/2026) -- remplace la
// redirection vers /login. Un visiteur connecté est renvoyé vers /home par
// proxy.ts avant d'arriver ici. Depuis le 19/10/2026 (plan d'attractivité,
// tâche 4), le haut de page est jouable sans compte : voir HomePlay. Vocabulaire : le mot
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

export default async function LandingPage() {
  const data = await getPublicHomeData();
  return (
    <main className={`${styles.page} photo-page force-photo`}>
      <HomePlay
        live={data.live}
        featured={data.featured}
        next={data.next}
        splits={data.splits}
        featuredKicker={data.featuredKicker}
      />

      <p className={styles.free}>
        La saison NBA a démarré. <Link href="/login">J&apos;ai déjà un compte</Link>
      </p>

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
