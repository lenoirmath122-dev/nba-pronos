"use client";

import { usePathname } from "next/navigation";
import styles from "./template.module.css";

// Glissement d'entrée à chaque navigation admin. Un template ne se remonte
// que quand le segment ENFANT direct change (rubrique -> écran) : la clé sur
// le chemin complet couvre aussi competitions -> competitions/results.
// Durée neutralisée par --motion-slide-duration sous prefers-reduced-motion
// (tokens.css). Client uniquement pour lire usePathname.

export default function AdminTemplate({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  return (
    <div key={pathname} className={styles.slide}>
      {children}
    </div>
  );
}
