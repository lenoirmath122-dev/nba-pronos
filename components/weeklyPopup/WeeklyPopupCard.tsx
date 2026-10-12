import type { DisplayedPopup } from "@/lib/weeklyPopup/display";
import styles from "./WeeklyPopupCard.module.css";

// Contenu de la popup hebdomadaire (lot 5, PR 5), partagé entre la popup
// joueur (WeeklyPopupWatcher) et l'aperçu admin (PR 4). Ne porte ni le titre
// (celui de la coquille `ModalDialog`) ni les actions (`children`). Sous-titres
// fixes : le LLM n'en produit aucun (plan §5.2). Texte rendu en nœuds React,
// jamais en HTML : un pseudo ou un texte de pari reste du texte.

type WeeklyPopupCardProps = {
  popup: DisplayedPopup;
  children?: React.ReactNode;
};

export function WeeklyPopupCard({ popup, children }: WeeklyPopupCardProps) {
  return (
    <div className={styles.card}>
      {popup.repli && <p className={styles.repli}>{popup.repli}</p>}
      {popup.sections.map((section) => (
        <section key={section.key} className={styles.section}>
          <h3 className={styles.heading}>{section.heading}</h3>
          <p className={styles.text}>{section.text}</p>
        </section>
      ))}
      {popup.cta && <p className={styles.cta}>{popup.cta}</p>}
      {children}
    </div>
  );
}
