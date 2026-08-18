import { getHomeData } from "@/lib/queries/home";
import { getProfileData } from "@/lib/queries/profile";
import { HomeHeader } from "@/components/home/HomeHeader";
import { TodoList } from "@/components/home/TodoList";
import { BetsAccordionList } from "@/components/home/BetsAccordionList";
import { Feed } from "@/components/home/Feed";
import { EmptyState } from "@/components/home/EmptyState";
import { CollapsibleCard } from "@/components/home/CollapsibleCard";
import { TutorialBanner } from "@/components/tutorial/TutorialBanner";
import styles from "./page.module.css";

// Écran Accueil (SPEC_ECRAN_ACCUEIL) : compose en-tête + « Reste à faire »
// (+ bloc admin, renommé « À traiter (admin) » sans lien avec le nom joueur)
// + « Paris disponibles » (accordéon Séries/Matchs, 15/08/2026 — remplace
// l'ancienne section « Paris séries non remplis ») + « Ça vient de tomber ».
// Les 4 cartes sont dépliables (18/08/2026, voir CollapsibleCard.tsx).
// Aucun fetch client, aucune logique métier ici — tout est déjà calculé par
// lib/queries/home.ts.
//
// Bannière du tutoriel joueur (SPEC_TUTORIEL_JOUEUR_V0_1 §1) : affichée
// indépendamment de la compétition active (un joueur peut s'inscrire alors
// qu'aucune compétition n'est en cours) — c'est pour ça qu'elle est montée
// AVANT le early-return "aucune compétition", pas seulement dans la branche
// pleine ci-dessous.
export default async function HomePage() {
  const [{ competitionId, header, todo, adminTodo, seriesBets, matchBets, feed }, profile] =
    await Promise.all([getHomeData(), getProfileData()]);

  const showTutorialBanner = profile !== null && profile.tutorialSeenAt === null;

  if (competitionId === null || header === null) {
    return (
      <div className={`${styles.page} photo-page`}>
        {showTutorialBanner && <TutorialBanner />}
        <div className={`${styles.header} glass-card`}>
          <p className={styles.title}>Accueil</p>
        </div>
        <EmptyState title="Aucune compétition en cours" subtitle="La prochaine arrive bientôt." />
      </div>
    );
  }

  return (
    <div className={`${styles.page} photo-page`}>
      {showTutorialBanner && <TutorialBanner />}
      <HomeHeader header={header} />

      <section className={`${styles.section} glass-card`} aria-label="Reste à faire">
        <CollapsibleCard id="todo" title="Reste à faire" count={todo.length}>
          {todo.length > 0 ? (
            <TodoList items={todo} />
          ) : (
            <EmptyState title="Tout est à jour" subtitle="Rien à pronostiquer pour le moment." />
          )}
        </CollapsibleCard>
      </section>

      {adminTodo.length > 0 && (
        <section className={`${styles.section} glass-card`} aria-label="À traiter (admin)">
          <CollapsibleCard id="admin" title="À traiter (admin)" count={adminTodo.length}>
            <TodoList items={adminTodo} />
          </CollapsibleCard>
        </section>
      )}

      {/* Retirée entièrement dès que rien ne reste (demandé par l'utilisateur
          28/07/2026, généralisé aux matchs le 15/08/2026) — jamais d'état
          vide affiché ici, contrairement aux 2 sections ci-dessus. */}
      {(seriesBets.length > 0 || matchBets.length > 0) && (
        <section className={`${styles.section} glass-card`} aria-label="Paris disponibles">
          <CollapsibleCard id="bets" title="Paris disponibles" count={seriesBets.length + matchBets.length}>
            <BetsAccordionList seriesBets={seriesBets} matchBets={matchBets} />
          </CollapsibleCard>
        </section>
      )}

      <section className={`${styles.section} glass-card`} aria-label="Ça vient de tomber">
        <CollapsibleCard id="feed" title="Ça vient de tomber" count={feed.length}>
          {feed.length > 0 ? (
            <Feed items={feed} />
          ) : (
            <EmptyState
              title="Rien de neuf depuis 2 jours"
              subtitle="Les résultats s'afficheront ici."
            />
          )}
        </CollapsibleCard>
      </section>
    </div>
  );
}
