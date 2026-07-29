import styles from "./Spinner.module.css";

type SpinnerProps = {
  size?: "sm" | "md" | "lg";
};

// Petit logo de chargement rotatif (feedback instantané pendant la
// navigation, cf. loading.tsx des segments de route). Figé si
// prefers-reduced-motion (cf. tokens.css).
export function Spinner({ size = "md" }: SpinnerProps) {
  const sizeClass = size === "sm" ? styles.sm : size === "lg" ? styles.lg : "";

  return (
    <div
      className={`${styles.spinner} ${sizeClass}`}
      role="status"
      aria-label="Chargement"
    />
  );
}
