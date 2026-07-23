"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  PlayIcon,
  RankingIcon,
  ProfileIcon,
} from "@/components/icons/nav-icons";
import { useGuardedNavigation } from "@/lib/hooks/useUnsavedGuard";
import styles from "./TabBar.module.css";

// Barre 4 onglets (Accueil · Jouer · Classement · Profil), T6a §3.1 /
// SPEC_ECRAN_ACCUEIL §1. Seule l'état "onglet actif" (chemin courant) exige
// un composant client ; le reste de l'écran reste serveur.
const TABS = [
  { href: "/home", label: "Accueil", Icon: HomeIcon },
  { href: "/play", label: "Jouer", Icon: PlayIcon },
  { href: "/leaderboard", label: "Classement", Icon: RankingIcon },
  { href: "/profile", label: "Profil", Icon: ProfileIcon },
] as const;

export function TabBar() {
  const pathname = usePathname();
  // Intercepte le changement d'onglet pendant une saisie non enregistrée
  // (C2, écrans pronos/paris/bracket personnel) — inerte tant qu'aucun écran
  // ne déclare de saisie sale (lib/hooks/useUnsavedGuard.tsx).
  const guardNavigation = useGuardedNavigation();

  return (
    <nav className={styles.bar} aria-label="Navigation principale">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={active ? styles.tabActive : styles.tab}
            aria-current={active ? "page" : undefined}
            onNavigate={(event) => guardNavigation(event, href)}
          >
            <span className={active ? styles.iconWrapActive : styles.iconWrap}>
              <Icon size={24} />
            </span>
            <span className={styles.label}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
