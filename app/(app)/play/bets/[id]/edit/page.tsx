import { getEditBetFormData } from "@/lib/queries/bets";
import { EmptyState } from "@/components/home/EmptyState";
import { BetForm } from "@/components/bets/BetForm";
import { BetFormModal } from "@/components/bets/BetFormModal";

// Écran Nouveau pari — édition (SPEC_ECRAN_NOUVEAU_PARI_V0_1 §1/§9). Charge un
// pari DRAFT/SUBMITTED du joueur ; les autres statuts (VALIDATED/REJECTED/WON/
// LOST/CANCELLED) sont "non éditables ici" (§9) et devraient rediriger vers
// l'écran "Mes paris" — HORS PÉRIMÈTRE de ce lot (spec distincte, §14), donc
// pas encore codé. En attendant, cet écran affiche un état inerte plutôt que
// de rediriger vers une route qui n'existe pas. Rendu en fenêtre centrée
// (BetFormModal, 17/08/2026), même traitement que new/page.tsx.
//
// `params` est une Promise en Next.js 16 (AGENTS.md) — attendue avant lecture.
type PageParams = { id: string };

export default async function EditBetPage({ params }: { params: Promise<PageParams> }) {
  const { id } = await params;
  const data = await getEditBetFormData(id);

  if (!data) {
    return (
      <BetFormModal title="Modifier le pari">
        <EmptyState
          title="Ce pari n'est plus modifiable ici"
          subtitle="Il a peut-être déjà été traité, ou ne t'appartient pas."
        />
      </BetFormModal>
    );
  }

  return (
    <BetFormModal title="Modifier le pari">
      <BetForm mode="EDIT" bootstrap={data.bootstrap} bet={data.bet} />
    </BetFormModal>
  );
}
