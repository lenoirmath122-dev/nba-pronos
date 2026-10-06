import { redirect } from "next/navigation";
import { hasBracket } from "@/lib/competitions/types";
import { getBracketFillData } from "@/lib/queries/bracket-fill";
import { EmptyState } from "@/components/home/EmptyState";
import { BracketFillView } from "@/components/bracket-fill/BracketFillView";
import styles from "./page.module.css";

// Écran Bracket personnel — remplissage (SPEC_ECRAN_BRACKET_PERSONNEL_V0_1
// §1/§2). Composant SERVEUR : cadrage (séries, cascade des candidats, pick du
// joueur) lu par lib/queries/bracket-fill.ts, passé en props à
// BracketFillView.tsx (enveloppe client de l'arbre — seul rendu depuis le
// 04/10/2026, p3-4).

export default async function BracketFillPage() {
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

  // Match du jour : pas de bracket (cadrage §5), retour direct sur Jouer.
  if (!hasBracket(data.competitionType)) redirect("/play");

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
  // (`?round=` n'est plus reporté en ancre `#round-X` depuis le 04/10/2026 :
  // l'arbre, seul rendu de /bracket, affiche tous les tours côte à côte.)
  if (data.isDeadlinePassed) {
    redirect("/bracket");
  }

  return <BracketFillView data={data} />;
}
