"use client";

import { useRouter } from "next/navigation";
import { ModalDialog } from "@/components/ui/ModalDialog";

// Fenêtre centrée pour Nouveau pari / Modifier un pari (17/08/2026, demandé
// par l'utilisateur — ces 2 écrans étaient des navigations pleine page,
// jamais des pop-up). `/play/bets/new` et `/play/bets/[id]/edit` restent de
// VRAIES routes (raccourcis Matchs/Bracket/Mes paris déjà en place, tous de
// simples <Link>, inchangés) — seul le RENDU change : la page entière est
// maintenant ce dialogue. Fermer/Enregistrer/Soumettre ramènent via
// `router.back()` (BetForm.tsx) plutôt qu'une redirection fixe vers /play —
// l'utilisateur retrouve exactement l'écran d'où il vient (Mes paris,
// Bracket, Matchs). Coquille visuelle partagée avec InlineBetForm.tsx en
// mode "modal" via components/ui/ModalDialog.tsx — seul `onClose` diffère
// (ici `router.back()`, une vraie page ; là un simple `setIsOpen(false)`).

type BetFormModalProps = {
  title: string;
  children: React.ReactNode;
};

export function BetFormModal({ title, children }: BetFormModalProps) {
  const router = useRouter();
  return (
    <ModalDialog title={title} onClose={() => router.back()}>
      {children}
    </ModalDialog>
  );
}
