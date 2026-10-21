import { getHomeData } from "@/lib/queries/home";
import { getPlayUpcoming } from "@/lib/queries/play";
import { HomeHeader } from "@/components/home/HomeHeader";
import { TodoList } from "@/components/home/TodoList";
import { NextPronoCard } from "@/components/home/NextPronoCard";
import { BetsAccordionList } from "@/components/home/BetsAccordionList";
import { Feed } from "@/components/home/Feed";
import { RecapBlock } from "@/components/home/RecapBlock";
import { EmptyState } from "@/components/home/EmptyState";
import { CollapsibleCard } from "@/components/home/CollapsibleCard";
import { MarkFeedSeen } from "@/components/home/MarkFeedSeen";
import { PushPrompt } from "@/components/home/PushPrompt";
import styles from "./page.module.css";

// Message d'attente avant la saison : affiché tant qu'aucun pari n'est ouvert.
function SeasonNotice() {
  return (
    <div className={`${styles.header} glass-card`}>
      <p className={styles.title}>
        Les premiers matchs apparaîtront quelques jours avant le début de la saison
      </p>
    </div>
  );
}

// Écran Accueil (SPEC_ECRAN_ACCUEIL) : compose en-tête + carte « Prochain prono » (ex-« Reste à faire »)
// (+ bloc admin, renommé « À traiter (admin) » sans lien avec le nom joueur)
// + « Proposer un pari » (ex-« Paris disponibles », accordéon Séries/Matchs, 15/08/2026 — remplace
// l'ancienne section « Paris séries non remplis ») + « Ça vient de tomber ».
// Les 4 cartes sont dépliables (18/08/2026, voir CollapsibleCard.tsx).
// Aucun fetch client, aucune logique métier ici — tout est déjà calculé par
// lib/queries/home.ts.
export default async function HomePage() {
  // Même source que /play pour les pronos à faire : la carte « Prochain
  // prono » réutilise tel quel le formulaire de /play, qui attend ses lignes.
  const [
    { competitionId, header, todo, adminTodo, seriesBets, matchBets, feed, recap, notificationPreference },
    play,
  ] = await Promise.all([getHomeData(), getPlayUpcoming()]);

  const upcoming = [...(play?.days ?? []), ...(play?.daysBeyondWindow ?? [])].flatMap((day) => day.matches);
  const pendingPronos = upcoming
    .filter((match) => match.viewStatus !== "VALIDATED")
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
  // Le prochain match à pronostiquer est déjà la carte du dessus : on garde
  // le reste (bracket, paris à finaliser) pour « À faire aussi ».
  const otherTodo = todo.filter((item) => item.kind !== "matches");
  const adminCount = adminTodo.reduce((sum, item) => sum + item.count, 0);

  if (competitionId === null || header === null) {
    return (
      <div className={`${styles.page} photo-page photo-page-dim`}>
        <div className={`${styles.header} glass-card`}>
          <p className={styles.title}>Accueil</p>
        </div>
        <PushPrompt preference={notificationPreference} />
        <SeasonNotice />
        <EmptyState title="Aucune compétition en cours" subtitle="La prochaine arrive bientôt." />
      </div>
    );
  }

  return (
    <div className={`${styles.page} photo-page photo-page-dim`}>
      <MarkFeedSeen latestAt={feed[0]?.occurredAt ?? null} />
      <HomeHeader header={header} />
      {/* Activation des notifications (p3-13) — ne rend rien une fois
          l'appareil abonné, voir PushPrompt.tsx. */}
      <PushPrompt preference={notificationPreference} />

      {seriesBets.length === 0 && matchBets.length === 0 && <SeasonNotice />}

      {upcoming.length > 0 ? (
        <NextPronoCard matches={pendingPronos} />
      ) : (
        <section className={`${styles.section} glass-card`} aria-label="Prochain prono">
          <EmptyState title="Tout est à jour" subtitle="Aucun prono à faire pour le moment." />
        </section>
      )}

      {otherTodo.length > 0 && (
        <section className={`${styles.section} glass-card`} aria-label="À faire aussi">
          <CollapsibleCard id="todo" title="À faire aussi" collapsible={false}>
            <TodoList items={otherTodo} />
          </CollapsibleCard>
        </section>
      )}

      {adminTodo.length > 0 && (
        <section className={`${styles.section} glass-card`} aria-label="À traiter (admin)">
          <CollapsibleCard id="admin" title="À traiter (admin)" count={adminCount} highlight collapsible={false}>
            <TodoList items={adminTodo} />
          </CollapsibleCard>
        </section>
      )}

      {/* Retirée entièrement dès que rien ne reste (demandé par l'utilisateur
          28/07/2026, généralisé aux matchs le 15/08/2026) — jamais d'état
          vide affiché ici, contrairement aux 2 sections ci-dessus. */}
      {(seriesBets.length > 0 || matchBets.length > 0) && (
        <section className={`${styles.section} glass-card`} aria-label="Proposer un pari">
          <CollapsibleCard id="bets" title="Proposer un pari" count={seriesBets.length + matchBets.length} neutralCount>
            <BetsAccordionList seriesBets={seriesBets} matchBets={matchBets} />
          </CollapsibleCard>
        </section>
      )}

      {/* id="recap" : cible du push des récaps (p3-10, /home#recap). Les
          récaps « Ta semaine » / « Ta nuit » passent avant la liste des
          évènements, fusion choisie par l'utilisateur (05/10/2026). */}
      <section id="recap" className={`${styles.section} glass-card`} aria-label="Résultats de la nuit">
        {/* Non dépliable (22/10/2026) : pas de compteur non plus, il n'aurait plus
            de chevron à accompagner. */}
        <CollapsibleCard id="feed" title="Résultats de la nuit" collapsible={false}>
          {recap?.weekly && <RecapBlock view={recap.weekly} />}
          {recap?.daily && <RecapBlock view={recap.daily} />}
          {feed.length > 0 ? (
            <Feed items={feed} />
          ) : (
            !recap?.weekly &&
            !recap?.daily && (
              <EmptyState
                title="Rien de neuf depuis 2 jours"
                subtitle="Les résultats s'afficheront ici."
              />
            )
          )}
        </CollapsibleCard>
      </section>
    </div>
  );
}
