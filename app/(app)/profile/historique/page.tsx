import { redirect } from "next/navigation";

// Absorbée par l'onglet Historique de « Mon profil » (Lot 3a).
export default function HistoryPage() {
  redirect("/profile?tab=historique");
}
