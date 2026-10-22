"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAdminBackTarget } from "@/lib/admin/navigation";
import styles from "./AdminBackLink.module.css";

// Lien retour de l'en-tête admin : « ← <parent> » d'après le registre
// lib/admin/navigation.ts, masqué sur le tableau de bord (/admin).

export function AdminBackLink() {
  const pathname = usePathname();
  const target = getAdminBackTarget(pathname);
  if (!target) return null;

  return (
    <Link href={target.href} className={styles.backLink}>
      <span aria-hidden="true">←</span> {target.label}
    </Link>
  );
}
