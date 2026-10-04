"use client";

import { useRouter } from "next/navigation";
import type { BracketFillData } from "@/lib/queries/bracket-fill";
import { FillPosterView } from "./FillPosterView";

type BracketFillViewProps = {
  data: BracketFillData;
};

// Enveloppe client du remplissage : l'arbre (FillPosterView.tsx) est le SEUL
// rendu depuis le 04/10/2026 (p3-4, retour de l'alpha : « garder seulement
// l'arbre visuel, supprimer la vue en cartes »). L'ancien flux normal
// (onglets par tour + cartes, BracketFillBoard.tsx/RoundTabs.tsx) et la
// bascule usePosterToggle ont été retirés : « Quitter » ramène désormais à
// l'onglet Jouer, d'où part l'entrée Bracket (BracketEntry.tsx).
export function BracketFillView({ data }: BracketFillViewProps) {
  const router = useRouter();
  return <FillPosterView data={data} onExit={() => router.push("/play")} />;
}
