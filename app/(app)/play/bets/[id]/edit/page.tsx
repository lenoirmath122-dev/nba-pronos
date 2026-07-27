import { getEditBetFormData } from "@/lib/queries/bets";
import { EmptyState } from "@/components/home/EmptyState";
import { BetForm } from "@/components/bets/BetForm";
import styles from "./page.module.css";

// Écran Nouveau pari — édition (SPEC_ECRAN_NOUVEAU_PARI_V0_1 §1/§9). Charge un
// pari DRAFT/SUBMITTED du joueur ; les autres statuts (VALIDATED/REJECTED/WON/
// LOST/CANCELLED) sont "non éditables ici" (§9) et devraient rediriger vers
// l'écran "Mes paris" — HORS PÉRIMÈTRE de ce lot (spec distincte, §14), donc
// pas encore codé. En attendant, cet écran affiche un état inerte plutôt que
// de rediriger vers une route qui n'existe pas.
//
// `params` est une Promise en Next.js 16 (AGENTS.md) — attendue avant lecture.
type PageParams = { id: string };

export default async function EditBetPage({ params }: { params: Promise<PageParams> }) {
  const { id } = await params;
  const data = await getEditBetFormData(id);

  if (!data) {
    return (
      <div className={styles.page}>
        <EmptyState
          title="Ce pari n'est plus modifiable ici"
          subtitle="Il a peut-être déjà été traité, ou ne t'appartient pas."
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <BetForm mode="EDIT" bootstrap={data.bootstrap} bet={data.bet} />
    </div>
  );
}
