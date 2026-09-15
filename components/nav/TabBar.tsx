"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  HomeIcon,
  PlayIcon,
  RankingIcon,
  ChatIcon,
  ProfileIcon,
} from "@/components/icons/nav-icons";
import { useGuardedNavigation } from "@/lib/hooks/useUnsavedGuard";
import { HOME_FEED_SEEN_STORAGE_KEY } from "@/lib/nav/feedSeen";
import type { NavBadgeData } from "@/lib/queries/home";
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

function noopSubscribe() {
  return () => {};
}

function getServerSnapshot() {
  return null;
}

type TabBarProps = {
  /** Pastilles « action à faire » / « nouveau résultat » (18/09/2026,
   *  demandé par l'utilisateur) — calculées une fois par app/(app)/layout.tsx,
   *  pas rafraîchies à chaque navigation cliente (voir commentaire du layout). */
  navBadges: NavBadgeData;
};

export function TabBar({ navBadges }: TabBarProps) {
  const pathname = usePathname();
  // Intercepte le changement d'onglet pendant une saisie non enregistrée
  // (C2, écrans pronos/paris/bracket personnel) — inerte tant qu'aucun écran
  // ne déclare de saisie sale (lib/hooks/useUnsavedGuard.tsx).
  const guardNavigation = useGuardedNavigation();

  // « Nouveaux résultats » : point d'alerte tant que le feed n'a pas été vu
  // sur CET appareil (même patron que CollapsibleCard.tsx) — le serveur ne
  // connaît aucun état « vu », d'où la comparaison client-only ici.
  const lastFeedSeenAt = useSyncExternalStore(
    noopSubscribe,
    () => window.localStorage.getItem(HOME_FEED_SEEN_STORAGE_KEY),
    getServerSnapshot
  );
  const hasNewFeed =
    navBadges.latestFeedAt !== null &&
    (lastFeedSeenAt === null || Date.parse(navBadges.latestFeedAt) > Date.parse(lastFeedSeenAt));

  return (
    <nav className={styles.bar} aria-label="Navigation principale">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const count = href === "/play" ? navBadges.playPendingCount : 0;
        const dot = href === "/home" && hasNewFeed;
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
              {count > 0 && (
                <span className={styles.badgeCount} aria-hidden="true">
                  {count > 9 ? "9+" : count}
                </span>
              )}
              {dot && <span className={styles.badgeDot} aria-hidden="true" />}
            </span>
            <span className={styles.label}>
              {label}
              {(count > 0 || dot) && (
                <span className={styles.srOnly}>
                  {count > 0 ? ` (${count} action${count > 1 ? "s" : ""} à faire)` : " (nouveau)"}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
