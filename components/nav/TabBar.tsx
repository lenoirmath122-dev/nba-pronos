"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  PlayIcon,
  RankingIcon,
  ChatIcon,
  ProfileIcon,
} from "@/components/icons/nav-icons";
import { useGuardedNavigation } from "@/lib/hooks/useUnsavedGuard";
import styles from "./TabBar.module.css";

// Barre 5 onglets (Accueil · Jouer · Classement · Chat · Profil) — Chat
// ajouté le 27/08/2026 (SPEC_CHAT_V0_1.md, confirmé avec l'utilisateur :
// 5e onglet plutôt qu'un lien depuis Accueil, malgré la densité mobile
// supplémentaire). Ex-barre à 4 onglets, T6a §3.1 / SPEC_ECRAN_ACCUEIL §1.
// Seule l'état "onglet actif" (chemin courant) exige un composant client ;
// le reste de l'écran reste serveur.
const TABS = [
  { href: "/home", label: "Accueil", Icon: HomeIcon },
  { href: "/play", label: "Jouer", Icon: PlayIcon },
  { href: "/leaderboard", label: "Classement", Icon: RankingIcon },
  { href: "/chat", label: "Chat", Icon: ChatIcon },
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
