"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  HomeIcon,
  PlayIcon,
  RankingIcon,
  ChatIcon,
  ProfileIcon,
} from "@/components/icons/nav-icons";
import { useGuardedNavigation } from "@/lib/hooks/useUnsavedGuard";
import { FEED_SEEN_KEY, useSeenStateSync, useSeenValue } from "@/lib/seen/store";
import { useChatReadSync, useUnreadChatCounts, type SeenMap } from "@/lib/nav/chatSeen";
import type { NavBadgeData } from "@/lib/queries/home";
import { SettingsDrawer } from "@/components/profile/SettingsDrawer";
import {
  markInternalNavigation,
  OPEN_PROFILE_MENU_EVENT,
  PROFILE_MENU_PARAM,
  PROFILE_MENU_PARAM_VALUE,
} from "@/lib/nav/profileMenu";
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

// Référence stable : un `{}` recréé à chaque rendu relancerait l'effet de synchro.
const EMPTY_SEEN: SeenMap = {};

type TabBarProps = {
  /** Pastilles « action à faire » / « nouveau résultat » (18/09/2026,
   *  demandé par l'utilisateur) — calculées une fois par app/(app)/layout.tsx,
   *  pas rafraîchies à chaque navigation cliente (voir commentaire du layout). */
  navBadges: NavBadgeData;
};

export function TabBar({ navBadges }: TabBarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Mémorise qu'on a navigué dans l'app : le bouton retour des sous-pages ne
  // fait `router.back()` que dans ce cas (lib/nav/profileMenu.ts).
  const initialPathname = useRef(pathname);
  useEffect(() => {
    if (pathname !== initialPathname.current) markInternalNavigation();
  }, [pathname]);
  // Onglet « Profil » : ouvre un panneau par-dessus l'écran en cours au lieu
  // de naviguer vers /profile. Ouvrir ajoute une entrée d'historique (même
  // URL) : le bouton retour du navigateur/Android ferme le panneau, et
  // revenir sur cette entrée depuis une page ouverte via le panneau le rouvre.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = useCallback(() => {
    if (!window.history.state?.profileMenu) {
      window.history.pushState({ ...window.history.state, profileMenu: true }, "");
    }
    setSettingsOpen(true);
  }, []);
  // Fermeture voulue (✕, Échap, voile) : on dépile l'entrée d'historique.
  const closeSettings = useCallback(() => {
    if (window.history.state?.profileMenu) window.history.back();
    else setSettingsOpen(false);
  }, []);
  // Fermeture suite à un clic sur un lien du panneau : la navigation suit.
  const dismissSettings = useCallback(() => setSettingsOpen(false), []);
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => setSettingsOpen(Boolean(event.state?.profileMenu));
    window.addEventListener("popstate", onPopState);
    window.addEventListener(OPEN_PROFILE_MENU_EVENT, openSettings);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener(OPEN_PROFILE_MENU_EVENT, openSettings);
    };
  }, [openSettings]);
  // /home?menu=profil (repli du bouton retour des sous-pages, ancienne URL
  // /profile) : ouvre le panneau puis retire le paramètre de l'URL.
  const wantsMenu = searchParams.get(PROFILE_MENU_PARAM) === PROFILE_MENU_PARAM_VALUE;
  useEffect(() => {
    if (!wantsMenu) return;
    window.history.replaceState(window.history.state, "", pathname);
    window.dispatchEvent(new Event(OPEN_PROFILE_MENU_EVENT));
  }, [wantsMenu, pathname]);
  // Intercepte le changement d'onglet pendant une saisie non enregistrée
  // (C2, écrans pronos/paris/bracket personnel) — inerte tant qu'aucun écran
  // ne déclare de saisie sale (lib/hooks/useUnsavedGuard.tsx).
  const guardNavigation = useGuardedNavigation();

  // « Nouveaux résultats » : point d'alerte tant que le feed n'a pas été vu
  // par le COMPTE (user_seen_state, synchronisé entre appareils). `undefined` =
  // pas encore chargé : pas de point, pour éviter un flash à l'hydratation.
  useSeenStateSync(navBadges.chatReadStatus?.userId ?? "", navBadges.seenState);
  const lastFeedSeenAt = useSeenValue(FEED_SEEN_KEY);
  const hasNewFeed =
    navBadges.latestFeedAt !== null &&
    lastFeedSeenAt !== undefined &&
    (lastFeedSeenAt === null || Date.parse(navBadges.latestFeedAt) > Date.parse(lastFeedSeenAt));

  // Messages de chat non lus (p3-7) : somme de tous les canaux, se met à
  // jour dès qu'un canal est ouvert, sur cet appareil comme sur les autres du
  // compte (état en base + Realtime, lib/nav/chatSeen.ts).
  useChatReadSync(navBadges.chatReadStatus?.userId ?? "", navBadges.chatReadStatus?.seen ?? EMPTY_SEEN);
  const unreadChat = useUnreadChatCounts(navBadges.chatActivity);
  let chatUnreadCount = 0;
  for (const count of unreadChat?.values() ?? []) chatUnreadCount += count;

  return (
    <>
    <nav className={styles.bar} aria-label="Navigation principale">
      {TABS.map(({ href, label, Icon }) => {
        if (href === "/profile") {
          const settingsActive = settingsOpen || pathname === href || pathname.startsWith(`${href}/`) || pathname === "/stats";
          return (
            <button
              key={href}
              type="button"
              className={settingsActive ? styles.tabActive : styles.tab}
              aria-haspopup="dialog"
              aria-expanded={settingsOpen}
              onClick={openSettings}
            >
              <span className={settingsActive ? styles.iconWrapActive : styles.iconWrap}>
                <Icon size={24} />
              </span>
              <span className={styles.label}>{label}</span>
            </button>
          );
        }
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const count = href === "/play" ? navBadges.playPendingCount : href === "/chat" ? chatUnreadCount : 0;
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
                  {count > 0
                    ? href === "/chat"
                      ? ` (${count} message${count > 1 ? "s" : ""} non lu${count > 1 ? "s" : ""})`
                      : ` (${count} action${count > 1 ? "s" : ""} à faire)`
                    : " (nouveau)"}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </nav>
    <SettingsDrawer
      open={settingsOpen}
      onClose={closeSettings}
      onNavigate={dismissSettings}
      isAdmin={navBadges.isAdmin}
    />
    </>
  );
}
