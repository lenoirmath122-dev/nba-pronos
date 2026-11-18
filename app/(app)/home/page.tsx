import Link from "next/link";
import { getHomeData } from "@/lib/queries/home";
import { addDays } from "@/lib/recaps/period";
import { HomeHeader } from "@/components/home/HomeHeader";
import { RecapBlock } from "@/components/home/RecapBlock";
import { EmptyState } from "@/components/home/EmptyState";
import { MarkFeedSeen } from "@/components/home/MarkFeedSeen";
import { PushPrompt } from "@/components/home/PushPrompt";
import { NightCard } from "@/components/news/NightCard";
import { ChatPreview } from "@/components/news/ChatPreview";
import styles from "./page.module.css";

// Écran Actualité (ex-Accueil, 13/11/2026, maquette validée avec
// l'utilisateur) : la vie de la ligue. L'app s'ouvre désormais sur Jouer, qui
// porte déjà tout ce qui se joue — d'où le retrait de « Prochain prono »,
// « À faire aussi », « À traiter (admin) » et « Proposer un pari ».
// Ordre : en-tête rang/points, récap de la semaine (le lundi), la nuit (tes
// points, highlights avec réactions, scores, tes paris au tap), l'aperçu du
// chat, puis les nuits précédentes chargées à la demande (?nuits=N).
// Aucun fetch client, aucune logique métier ici — tout est déjà calculé par
// lib/queries/home.ts.

type HomePageProps = { searchParams: Promise<{ nuits?: string | string[] }> };

export default async function HomePage({ searchParams }: HomePageProps) {
  const { nuits } = await searchParams;
  const requested = Number(Array.isArray(nuits) ? nuits[0] : nuits);
  const data = await getHomeData({ nights: Number.isFinite(requested) ? requested : 1 });
  const { competitionId, header, weeklyRecap, nights, canLoadMoreNights, latestFeedAt, chatPreview, notificationPreference } =
    data;

  if (competitionId === null || header === null) {
    return (
      <div className={`${styles.page} photo-page photo-page-dim`}>
        <div className={`${styles.header} glass-card`}>
          <h1 className={styles.title}>Actualité</h1>
        </div>
        <PushPrompt preference={notificationPreference} />
        <EmptyState title="Aucune compétition en cours" subtitle="La prochaine arrive bientôt." />
        <ChatPreview messages={chatPreview} />
      </div>
    );
  }

  const [currentNight, ...pastNights] = nights;
  const lastNight = nights[nights.length - 1];
  const nextDate = lastNight ? addDays(lastNight.recapDate, -1) : null;

  return (
    <div className={`${styles.page} photo-page photo-page-dim`}>
      <h1 className={styles.srOnly}>Actualité</h1>
      <MarkFeedSeen latestAt={latestFeedAt} />
      <HomeHeader header={header} />
      {/* Activation des notifications (p3-13) — ne rend rien une fois
          l'appareil abonné, voir PushPrompt.tsx. */}
      <PushPrompt preference={notificationPreference} />

      {weeklyRecap && (
        <section className={`${styles.section} glass-card`} aria-label="Ta semaine">
          <RecapBlock view={weeklyRecap} />
        </section>
      )}

      {/* id="recap" : cible du push des récaps (p3-10, /home#recap). */}
      {currentNight && <NightCard night={currentNight} competitionId={competitionId} anchorId="recap" />}

      <ChatPreview messages={chatPreview} />

      {pastNights.map((night) => (
        <NightCard key={night.recapDate} night={night} competitionId={competitionId} anchorId={`nuit-${night.recapDate}`} />
      ))}

      {canLoadMoreNights && nextDate && (
        <Link href={`/home?nuits=${nights.length + 1}#nuit-${nextDate}`} className={`${styles.moreNights} glass-card`}>
          Nuit précédente
        </Link>
      )}
    </div>
  );
}
