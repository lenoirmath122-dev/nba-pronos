import { PublicNav } from "@/components/nav/PublicNav";
import { PublicLegalSlot } from "@/components/nav/PublicLegalSlot";

// Nav RÉDUITE (0.2.9 §3, T6a §3.1) : Classement · Bracket · Se connecter.
// La rangée légale est posée ici (et non dans PublicNav) pour pouvoir descendre
// sous le formulaire sur /enregistrer.
export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <PublicNav legal={false} />
      <PublicLegalSlot placement="top" />
      {children}
      <PublicLegalSlot placement="bottom" />
    </>
  );
}
