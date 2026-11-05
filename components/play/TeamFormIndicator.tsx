import type { TeamFormSummary } from "@/lib/teamInsights/types";
import { FORM_LABEL_TEXT, formAriaLabel } from "@/lib/teamInsights/display";
import styles from "./TeamFormIndicator.module.css";

// Forme récente d'une équipe sur la carte d'un match (aide aux débutants,
// CHANTIER_AIDE_DEBUTANTS.md §7.4). Habillage minimal, rendu final décidé en
// session « visuel ». Chaque résultat est une lettre (V/D) : aucune
// information portée par la couleur seule.
type Props = { teamName: string; abbreviation: string; form: TeamFormSummary | null };

export function TeamFormIndicator({ teamName, abbreviation, form }: Props) {
  if (!form) return null;
  return (
    <div className={styles.root} role="group" aria-label={formAriaLabel(teamName, form)}>
      <span className={styles.record} aria-hidden="true">
        {abbreviation} {form.record.wins}-{form.record.losses}
      </span>
      <span className={styles.last5} aria-hidden="true">
        {form.last5.map((r, i) => (
          <span key={i} className={r === "V" ? styles.win : styles.loss}>
            {r}
          </span>
        ))}
      </span>
      <span className={styles.label} aria-hidden="true">
        {FORM_LABEL_TEXT[form.label]}
      </span>
    </div>
  );
}
