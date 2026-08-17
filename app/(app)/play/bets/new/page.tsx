import { getNewBetFormData } from "@/lib/queries/bets";
import { EmptyState } from "@/components/home/EmptyState";
import { BetForm } from "@/components/bets/BetForm";
import { BetFormModal } from "@/components/bets/BetFormModal";

// Écran Nouveau pari — création (SPEC_ECRAN_NOUVEAU_PARI_V0_1 §1/§2). Composant
// SERVEUR : le cadrage (séries/matchs ouverts, quotas) est lu par
// lib/queries/bets.ts et passé en props à la SEULE feuille cliente (BetForm).
// Rendu en fenêtre centrée (BetFormModal, 17/08/2026) — cette route reste
// une VRAIE navigation (tous les raccourcis qui y mènent restent de simples
// <Link>, inchangés), seul le RENDU devient un pop-up plutôt qu'une page
// pleine largeur.
//
// searchParams est une Promise en Next.js 16 (AGENTS.md) — attendue avant
// lecture. `matchId` = raccourci depuis Matchs (§2, contexte A) ; `seriesId`
// = raccourci depuis le Bracket global (04/08/2026, demandé par
// l'utilisateur, même patron) ; aucun des deux = hub Mes paris (§2,
// contexte B).
type SearchParams = { matchId?: string; seriesId?: string };

export default async function NewBetPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const data = await getNewBetFormData(sp.matchId ?? null, sp.seriesId ?? null);

  if (data.competitionId === null || data.bootstrap === null) {
    return (
      <BetFormModal title="Nouveau pari">
        <EmptyState title="Aucune compétition en cours" subtitle="La prochaine arrive bientôt." />
      </BetFormModal>
    );
  }

  return (
    <BetFormModal title="Nouveau pari">
      <BetForm mode="CREATE" bootstrap={data.bootstrap} context={data.context} shortcutClosed={data.shortcutClosed} />
    </BetFormModal>
  );
}
