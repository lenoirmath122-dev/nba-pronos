"use client";

import { usePathname } from "next/navigation";
import { PublicLegalBar } from "./PublicLegalBar";

// Sur /enregistrer (27/10/2026), la rangée légale passe sous le formulaire :
// en haut, elle repoussait le bouton d'envoi hors de la hauteur utile du
// navigateur d'Instagram (≈ 520 px). Les liens restent sur la page.
export function PublicLegalSlot({ placement }: { placement: "top" | "bottom" }) {
  const atBottom = usePathname() === "/enregistrer";
  return (placement === "bottom") === atBottom ? <PublicLegalBar /> : null;
}
