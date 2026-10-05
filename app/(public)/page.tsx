import Image from "next/image";
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
    title: "Ligues entre amis",
    text: "Crée ta ligue privée et suis le classement en direct.",
  },
];

export default function LandingPage() {
  return (
    <main className={`${styles.page} photo-page force-photo`}>
      <section className={styles.hero}>
        <Image src="/brand/logo.svg" alt="" width={73} height={80} unoptimized className={styles.logo} />
        <h1 className={styles.title}>{TAGLINE.replace(/\.$/, "")}</h1>
        <p className={styles.lead}>
          Pronostique les matchs, lance tes paris perso, remplis ton bracket et grimpe au classement face à ta bande. NBA Cup, playoffs :
          chaque soir de match compte.
        </p>
        <div className={styles.actions}>
          <Link href="/signup" className={styles.primary}>
            Créer mon compte
          </Link>
          <Link href="/login" className={styles.secondary}>
            J&apos;ai déjà un compte
          </Link>
        </div>
        <p className={styles.free}>100 % gratuit — aucun argent réel, uniquement des points.</p>
      </section>

      <section className={styles.features}>
        {FEATURES.map((f) => (
          <article key={f.title} className={`${styles.card} glass-card`}>
            <h2 className={styles.cardTitle}>{f.title}</h2>
            <p className={styles.cardText}>{f.text}</p>
          </article>
        ))}
      </section>

      <nav className={styles.discover} aria-label="Découvrir">
        <Link href="/leaderboard">Voir le classement</Link>
        <Link href="/bracket">Voir le bracket</Link>
        <Link href="/regles">Lire les règles</Link>
      </nav>
    </main>
  );
}
