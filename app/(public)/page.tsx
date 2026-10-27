import Link from "next/link";
import type { Metadata } from "next";
import { HOME_TITLE, pageMetadata } from "@/lib/seo";
import { HomePlay } from "@/components/publicHome/HomePlay";
import { getPublicHomeData, type LastResult } from "@/lib/publicHome/query";
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

// Version compacte (3 lignes) : le bloc remonte juste sous le match de la nuit.
const STEPS = [
  "Choisis le vainqueur et l'écart.",
  "Gagne des points, sans argent réel.",
  "Grimpe au classement, chambre tes potes.",
];

const MORE = [
  { title: "Paris perso", text: "Invente tes propres paris sur un match ou une série." },
  { title: "Ligues entre amis", text: "Crée ta ligue privée et défie ta bande." },
  { title: "NBA Cup", text: "La coupe en décembre : bracket et pronos de groupes." },
];

function LastResultBlock({ result }: { result: LastResult }) {
  const { match, stats } = result;
  const winnerFirst = (match.homeScore ?? 0) >= (match.awayScore ?? 0);
  const [w, l] = winnerFirst ? [match.home, match.away] : [match.away, match.home];
  const [ws, ls] = winnerFirst ? [match.homeScore, match.awayScore] : [match.awayScore, match.homeScore];
  return (
    <section className={`${styles.block} ${styles.result} glass-card`} aria-labelledby="result-title">
      <h2 id="result-title" className={styles.stepsTitle}>
        Le résultat de la nuit
      </h2>
      <p className={styles.resultScore}>
        {w.name} {ws} – {ls} {l.name}
      </p>
      {stats ? (
        <p className={styles.cardText}>
          {stats.correctWinners} joueurs sur {stats.total} avaient le bon vainqueur
          {stats.exactPseudo ? (
            <>
              , <strong>{stats.exactPseudo}</strong> a trouvé l&apos;écart exact
            </>
          ) : null}
          .
        </p>
      ) : null}
    </section>
  );
}

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
        afterFeatured={
          <section className={`${styles.steps} glass-card`} aria-labelledby="how-title">
            <h2 id="how-title" className={styles.stepsTitle}>
              Comment ça marche
            </h2>
            <ol className={styles.stepList}>
              {STEPS.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ol>
          </section>
        }
      />

      {data.lastResult ? <LastResultBlock result={data.lastResult} /> : null}

      {data.top.length > 0 ? (
        <section className={styles.block} aria-labelledby="top-title">
          <h2 id="top-title" className={styles.stepsTitle}>
            Le classement
          </h2>
          <ol className={`${styles.top} glass-card`}>
            {data.top.map((p, i) => (
              <li key={p.userId} className={styles.topRow}>
                <span className={styles.topRank}>{i + 1}</span>
                <span className={styles.topPseudo}>{p.pseudo}</span>
                <span className={styles.topPoints}>{p.points} pts</span>
              </li>
            ))}
          </ol>
          <Link href="/leaderboard" className={styles.more}>
            Voir tout le classement
          </Link>
        </section>
      ) : null}

      <section className={styles.features}>
        {MORE.map((f) => (
          <article key={f.title} className={`${styles.card} glass-card`}>
            <h2 className={styles.cardTitle}>{f.title}</h2>
            <p className={styles.cardText}>{f.text}</p>
          </article>
        ))}
      </section>

      <nav className={styles.discover} aria-label="Découvrir">
        <Link href="/leaderboard">Voir le classement</Link>
        <Link href="/regles">Lire les règles</Link>
      </nav>
    </main>
  );
}
