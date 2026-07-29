import { getHomeData } from "@/lib/queries/home";
import { HomeHeader } from "@/components/home/HomeHeader";
import { TodoList } from "@/components/home/TodoList";
import { SeriesBetList } from "@/components/home/SeriesBetList";
import { Feed } from "@/components/home/Feed";
import { EmptyState } from "@/components/home/EmptyState";
import styles from "./page.module.css";

// Écran Accueil (SPEC_ECRAN_ACCUEIL) : compose en-tête + « À traiter »
// (+ bloc admin) + « Paris séries non remplis » + « Ça vient de tomber ».
// Aucun fetch client, aucune logique métier ici — tout est déjà calculé par
// lib/queries/home.ts.
export default async function HomePage() {
  const { competitionId, header, todo, adminTodo, seriesBets, feed } = await getHomeData();

  if (competitionId === null || header === null) {
    return (
      <div className={styles.page}>
        <div className={`${styles.header} hero-banner`}>
          <p className={`${styles.title} hero-banner-title`}>Accueil</p>
        </div>
        <EmptyState title="Aucune compétition en cours" subtitle="La prochaine arrive bientôt." />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <HomeHeader header={header} />

      <section className={styles.section} aria-label="À traiter">
        <h2 className={styles.sectionTitle}>À traiter</h2>
        {todo.length > 0 ? (
          <TodoList items={todo} />
        ) : (
          <EmptyState title="Tout est à jour" subtitle="Rien à pronostiquer pour le moment." />
        )}
      </section>

      {adminTodo.length > 0 && (
        <section className={styles.section} aria-label="À traiter (admin)">
          <h2 className={styles.sectionTitle}>À traiter (admin)</h2>
          <TodoList items={adminTodo} />
        </section>
      )}

      {/* Retirée entièrement dès que rien ne reste (demandé par l'utilisateur
          28/07/2026) — jamais d'état vide affiché ici, contrairement aux 2
          sections ci-dessus. */}
      {seriesBets.length > 0 && (
        <section className={styles.section} aria-label="Paris séries non remplis">
          <h2 className={styles.sectionTitle}>Paris séries non remplis</h2>
          <SeriesBetList items={seriesBets} />
        </section>
      )}

      <section className={styles.section} aria-label="Ça vient de tomber">
        <h2 className={styles.sectionTitle}>Ça vient de tomber</h2>
        {feed.length > 0 ? (
          <Feed items={feed} />
        ) : (
          <EmptyState
            title="Rien de neuf depuis 2 jours"
            subtitle="Les résultats s'afficheront ici."
          />
        )}
      </section>
    </div>
  );
}
