import type { ReactNode } from "react";
import { SubPageHeader } from "@/components/ui/SubPageHeader";
import styles from "./SubPageShell.module.css";

// Cadre commun des sous-pages du menu Profil : fond photo, marges de 16 px,
// en-tête (retour + titre), puis le contenu.
export function SubPageShell({ title, tone, children }: { title: string; tone?: "danger"; children: ReactNode }) {
  return (
    <div className={`${styles.page} photo-page`}>
      <SubPageHeader title={title} tone={tone} />
      {children}
    </div>
  );
}
