"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import styles from "@/app/(app)/stats/page.module.css";

// Lot Q (23/10/2026) : les onglets de /stats défilent horizontalement, l'onglet
// actif (ex. « Badges ») pouvait être hors écran à 375 px. On le recentre au
// chargement, sans faire défiler la page (block: "nearest").

export function StatsTabsNav({
  tabs,
  active,
}: {
  tabs: readonly { key: string; label: string }[];
  active: string;
}) {
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [active]);

  return (
    <nav className={styles.tabs} aria-label="Sections des stats">
      {tabs.map((t) => (
        <Link
          key={t.key}
          ref={t.key === active ? activeRef : undefined}
          href={`/stats?tab=${t.key}`}
          replace
          className={t.key === active ? styles.tabActive : styles.tab}
          aria-current={t.key === active ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
