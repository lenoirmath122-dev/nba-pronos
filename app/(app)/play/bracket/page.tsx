import { redirect } from "next/navigation";
import { getBracketFillData } from "@/lib/queries/bracket-fill";
import { EmptyState } from "@/components/home/EmptyState";
import { BracketFillView } from "@/components/bracket-fill/BracketFillView";
import styles from "./page.module.css";

// Écran Bracket personnel — remplissage (SPEC_ECRAN_BRACKET_PERSONNEL_V0_1
// §1/§2). Composant SERVEUR : cadrage (séries, cascade des candidats, pick du
// joueur) lu par lib/queries/bracket-fill.ts, passé en props à
// BracketFillView.tsx (orchestrateur client — bascule flux normal/poster,
// 16/08/2026, chantier « remplissage en poster interactif »).
//
// searchParams est une Promise en Next.js 16 (AGENTS.md) — attendue avant
// lecture. `round` sélectionne le tour affiché du flux normal (§6, sans effet
// sur le poster, qui affiche tous les tours et guide automatiquement).
type SearchParams = { round?: string };

export default async function BracketFillPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const data = await getBracketFillData();

  if (data.competitionId === null) {
    return (
      <div className={`${styles.page} photo-page`}>
        <div className={`${styles.header} glass-card`}>
          <h1 className={styles.title}>Mon bracket</h1>
        </div>
        <EmptyState title="Aucune compétition en cours" subtitle="La prochaine arrive bientôt." />
      </div>
    );
  }

  if (!data.isStructureKnown) {
    const isCup = data.competitionType === "NBA_CUP";
    return (
      <div className={`${styles.page} photo-page`}>
        <div className={`${styles.header} glass-card`}>
          <h1 className={styles.title}>Mon bracket</h1>
        </div>
        <EmptyState
          title={isCup ? "La phase finale n'est pas encore définie" : "Le 1er tour n'est pas encore officiel"}
          subtitle={
            isCup ? "Les 8 qualifiés seront connus fin novembre." : "Le 1er tour n'est pas encore officiel."
          }
        />
      </div>
    );
  }

  // Verrouillé (15/08/2026, demandé par l'utilisateur) : plus de message
  // inerte avec un lien à part — on atterrit directement sur le Bracket
  // global, qui porte déjà (via getBracket()) la mise en avant des paris du
  // joueur sur chaque série, très voyante (NodeCard.tsx).
  //
  // `?round=` reporté en ancre (16/08/2026, bug d'audit corrigé) : un lien/
  // favori vers `/play/bracket?round=X` rebondissait vers `/bracket` en
  // perdant X silencieusement. `/bracket` (vue globale) n'a pas d'onglet par
  // tour comme cet écran — toutes les séries y sont déjà visibles — mais
  // `#round-X` (id posé sur chaque section, SeriesDrillDown.tsx) fait au
  // moins défiler jusqu'au bon tour au lieu d'atterrir en haut de page.
  if (data.isDeadlinePassed) {
    redirect(sp.round ? `/bracket#round-${sp.round}` : "/bracket");
  }

  const activeRoundKey =
    sp.round && data.rounds.some((round) => round.key === sp.round) ? sp.round : data.rounds[0]?.key;

  return <BracketFillView data={data} activeRoundKey={activeRoundKey} />;
}
