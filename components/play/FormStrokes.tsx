import { last5AriaLabel } from "@/lib/teamInsights/display";
import styles from "./FormStrokes.module.css";

// 5 derniers matchs en traits (vert = victoire, rouge = défaite), le plus
// récent à gauche. Moins de 5 matchs joués : seuls les traits disponibles sont
// affichés (option la plus simple). La couleur ne porte pas seule l'info :
// libellé complet en aria-label.
type Props = { last5: ("V" | "D")[] };

export function FormStrokes({ last5 }: Props) {
  if (last5.length === 0) return null;
  return (
    <span className={styles.root} role="img" aria-label={last5AriaLabel(last5)}>
      {last5.map((r, i) => (
        <span key={i} className={`${styles.stroke} ${r === "V" ? styles.win : styles.loss}`} />
      ))}
    </span>
  );
}
