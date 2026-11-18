"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NewsIcon, PlayIcon, RankingIcon, ChatIcon, ProfileIcon } from "@/components/icons/nav-icons";
import { useRequireAuth } from "@/components/auth/AuthGateProvider";
import styles from "./TabBar.module.css";

// Barre d'onglets de l'invité : même navigation que le joueur (mêmes onglets,
// même ordre), sans pastilles ni tiroir de réglages. Jouer, Classement et Chat
// se lisent librement ; Actualité et Profil demandent un compte et ouvrent la
// modale (retour sur la page courante après l'inscription).
const OPEN_TABS = [
  { href: "/play", label: "Jouer", Icon: PlayIcon },
  { href: "/leaderboard", label: "Classement", Icon: RankingIcon },
  { href: "/chat", label: "Chat", Icon: ChatIcon },
] as const;

export function GuestTabBar() {
  const pathname = usePathname();
  const requireAuth = useRequireAuth();

  function tabLink({ href, label, Icon }: (typeof OPEN_TABS)[number]) {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link key={href} href={href} className={active ? styles.tabActive : styles.tab} aria-current={active ? "page" : undefined}>
        <span className={active ? styles.iconWrapActive : styles.iconWrap}>
          <Icon size={24} />
        </span>
        <span className={styles.label}>{label}</span>
      </Link>
    );
  }

  function gatedTab(label: string, Icon: typeof NewsIcon) {
    return (
      <button key={label} type="button" className={styles.tab} aria-haspopup="dialog" onClick={() => requireAuth({ type: "follow" })}>
        <span className={styles.iconWrap}>
          <Icon size={24} />
        </span>
        <span className={styles.label}>{label}</span>
      </button>
    );
  }

  return (
    <nav className={styles.bar} aria-label="Navigation principale">
      {tabLink(OPEN_TABS[0])}
      {gatedTab("Actualité", NewsIcon)}
      {tabLink(OPEN_TABS[1])}
      {tabLink(OPEN_TABS[2])}
      {gatedTab("Profil", ProfileIcon)}
    </nav>
  );
}
