import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ScreenShell } from "@/components/nav/ScreenShell";
import { getGuestMatch } from "@/lib/guest/query";
import { dayTimeLabel } from "@/lib/publicHome/labels";
import { pageMetadata } from "@/lib/seo";
import styles from "@/components/guest/guest.module.css";

// Page publique d'un match (mode invité, lot A) : lecture anonyme sans cookie,
// cache de 60 s. Les pronos individuels ne sont jamais lus ici (règle « valider
// = voir » inchangée) : seulement la répartition agrégée, au-delà d'un seuil.
// Un connecté est renvoyé vers /play par proxy.ts. Image OG : lot D.
export const revalidate = 60;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const detail = await getGuestMatch(id);
  if (!detail) return pageMetadata({ title: "Match", path: `/match/${id}`, noindex: true });
  const { home, away } = detail.match;
  return pageMetadata({
    title: `${home.name} – ${away.name}`,
    description: `Pronostique ${home.name} – ${away.name} gratuitement, sans argent réel.`,
    path: `/match/${id}`,
  });
}

export default async function MatchPage({ params }: Props) {
  const { id } = await params;
  const detail = await getGuestMatch(id);
  if (!detail) notFound();
  const { match, split, resultStats, nowMs } = detail;
  const finished = match.status === "FINISHED" && match.homeScore !== null && match.awayScore !== null;

  return (
    <ScreenShell authenticated={false}>
      <div className={`${styles.page} photo-page`}>
        <div className={`${styles.header} glass-card`}>
          <Link href="/matchs" className={styles.when}>
            ← Tous les matchs
          </Link>
          <h1 className={styles.title}>
            {match.home.name} – {match.away.name}
          </h1>
          <p className={styles.when}>
            {match.status === "IN_PROGRESS" ? "En cours" : dayTimeLabel(match.scheduledAt, nowMs)}
          </p>
        </div>
        {finished ? (
          <p className={`${styles.card} glass-card ${styles.score}`}>
            {match.home.name} {match.homeScore} – {match.awayScore} {match.away.name}
          </p>
        ) : null}
        {split ? (
          <p className={`${styles.card} glass-card`}>
            {split.total} joueurs ont pronostiqué : {split.homePercent} % pour {match.home.name}, {split.awayPercent} %
            pour {match.away.name}.
          </p>
        ) : null}
        {resultStats ? (
          <p className={`${styles.card} glass-card`}>
            {resultStats.correctWinners} joueurs sur {resultStats.total} avaient le bon vainqueur
            {resultStats.exactPseudo ? `, ${resultStats.exactPseudo} a trouvé l'écart exact` : ""}.
          </p>
        ) : null}
        <Link href="/signup" className={styles.cta}>
          Créer un compte pour pronostiquer
        </Link>
      </div>
    </ScreenShell>
  );
}
