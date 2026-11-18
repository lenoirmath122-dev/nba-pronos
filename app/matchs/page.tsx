import { ScreenShell } from "@/components/nav/ScreenShell";
import { GuestMatchCard } from "@/components/guest/GuestMatchCard";
import { getGuestMatchList } from "@/lib/guest/query";
import { pageMetadata } from "@/lib/seo";
import styles from "@/components/guest/guest.module.css";

// Liste des matchs en lecture pour un visiteur (mode invité, lot A). Route
// hors groupes, nav réduite (patron /leaderboard) ; lecture anonyme sans
// cookie, donc cache de 60 s. Un connecté est renvoyé vers /play par proxy.ts.
export const revalidate = 60;

export const metadata = pageMetadata({
  title: "Matchs NBA",
  description: "Les prochains matchs NBA et les derniers résultats. Pronostique gratuitement, sans argent réel.",
  path: "/matchs",
});

export default async function MatchsPage() {
  const { upcoming, recent, nowMs } = await getGuestMatchList();
  return (
    <ScreenShell authenticated={false}>
      <div className={`${styles.page} photo-page`}>
        <div className={`${styles.header} glass-card`}>
          <h1 className={styles.title}>Matchs</h1>
        </div>
        <h2 className={styles.sectionTitle}>À venir</h2>
        {upcoming.length > 0 ? (
          <ul className={styles.list}>
            {upcoming.map((m) => (
              <GuestMatchCard key={m.id} match={m} nowMs={nowMs} />
            ))}
          </ul>
        ) : (
          <p className={styles.text}>Aucun match à venir pour le moment.</p>
        )}
        {recent.length > 0 ? (
          <>
            <h2 className={styles.sectionTitle}>Derniers résultats</h2>
            <ul className={styles.list}>
              {recent.map((m) => (
                <GuestMatchCard key={m.id} match={m} nowMs={nowMs} />
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </ScreenShell>
  );
}
