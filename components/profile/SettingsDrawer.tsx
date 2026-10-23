"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { logout } from "@/lib/auth/actions";
import { useGuardedNavigation } from "@/lib/hooks/useUnsavedGuard";
import { FocusTrap } from "@/components/ui/FocusTrap";
import { getProfileMenuSummary, type ProfileMenuSummary } from "@/lib/actions/profileMenu";
import { AdminFlagIcon } from "@/components/icons/home-icons";
import { PeopleIcon } from "@/components/icons/play-icons";
import {
  BadgeMedalIcon,
  BellIcon,
  ChevronRightIcon,
  DangerIcon,
  DownloadIcon,
  HelpIcon,
  HistoryIcon,
  KeyIcon,
  LegalIcon,
  LogoutIcon,
  SlidersIcon,
  StatsIcon,
  ThemeIcon,
} from "@/components/icons/menu-icons";
import styles from "./SettingsDrawer.module.css";

// Panneau « Profil » (ex-Réglages), ouvert par le 5e onglet de la TabBar PAR-
// DESSUS l'écran en cours : plein écran sur mobile, tiroir de 380 px à droite
// au-delà de 768 px. Liste à plat par sections, sans accordéon. Chaque ligne
// mène à sa page dédiée (/stats, /profile/<section>).
type Row = {
  key: string;
  label: string;
  href: string;
  Icon: (p: { size?: number }) => ReactNode;
  tone?: "danger" | "admin";
};
type Section = { key: string; title: string; rows: Row[] };

const SECTIONS: Section[] = [
  {
    key: "jeu",
    title: "Mon jeu",
    rows: [
      { key: "stats", label: "Stats", href: "/stats", Icon: StatsIcon },
      { key: "badges", label: "Badges", href: "/stats?tab=badges", Icon: BadgeMedalIcon },
      { key: "historique", label: "Historique", href: "/profile/historique", Icon: HistoryIcon },
      { key: "ligues", label: "Ligues", href: "/profile/ligues", Icon: PeopleIcon },
    ],
  },
  {
    key: "compte",
    title: "Compte",
    rows: [
      { key: "identifiants", label: "Identifiants", href: "/profile/identifiants", Icon: KeyIcon },
      { key: "donnees", label: "Mes données", href: "/profile/donnees", Icon: DownloadIcon },
    ],
  },
  {
    key: "application",
    title: "Application",
    rows: [
      { key: "notifications", label: "Notifications", href: "/profile/notifications", Icon: BellIcon },
      { key: "theme", label: "Thème", href: "/profile/theme", Icon: ThemeIcon },
      { key: "preferences", label: "Préférences", href: "/profile/preferences", Icon: SlidersIcon },
    ],
  },
  {
    key: "aide",
    title: "Aide",
    rows: [
      { key: "aide", label: "Aide", href: "/profile/aide", Icon: HelpIcon },
      { key: "legal", label: "Informations légales", href: "/profile/legal", Icon: LegalIcon },
    ],
  },
];

const ADMIN_SECTION: Section = {
  key: "admin",
  title: "Admin",
  rows: [{ key: "admin", label: "Admin", href: "/admin", Icon: AdminFlagIcon, tone: "admin" }],
};

const DANGER_ROW: Row = {
  key: "danger",
  label: "Zone de danger",
  href: "/profile/danger",
  Icon: DangerIcon,
  tone: "danger",
};

const IDENTITY_HREF = "/profile/pseudo";

function formatRank(rank: number | null): string {
  if (rank === null) return "—";
  return rank === 1 ? "1er" : `${rank}e`;
}

// Valeur d'une stat : barre de chargement tant que le résumé n'est pas arrivé,
// puis la valeur (ou « — » quand la donnée n'existe pas).
function statText(summary: ProfileMenuSummary | null, value: string | number): ReactNode {
  return summary ? value : <span className={`${styles.skeleton} ${styles.skeletonStat}`} aria-hidden="true" />;
}

function initials(pseudo: string): string {
  return pseudo.trim().slice(0, 2).toUpperCase() || "?";
}

type SettingsDrawerProps = {
  open: boolean;
  /** Fermeture demandée (✕, Échap, voile). */
  onClose: () => void;
  /** Fermeture suite à un clic sur un lien : la navigation suit son cours. */
  onNavigate: () => void;
  isAdmin: boolean;
};

export function SettingsDrawer({ open, onClose, onNavigate, isAdmin }: SettingsDrawerProps) {
  const guardNavigation = useGuardedNavigation();
  const [summary, setSummary] = useState<ProfileMenuSummary | null>(null);

  // Données de l'en-tête et de la carte Stats : préchargées peu après le
  // montage (la TabBar persiste), pour que la 1re ouverture soit déjà remplie,
  // puis relues à chaque ouverture (l'ancienne valeur reste affichée le temps
  // du rechargement).
  const preloaded = useRef(false);
  useEffect(() => {
    if (!open && preloaded.current) return;
    let cancelled = false;
    const load = () =>
      getProfileMenuSummary()
        .then((s) => {
          if (cancelled || !s) return;
          preloaded.current = true;
          setSummary(s);
        })
        .catch(() => {});
    if (open) {
      load();
      return () => {
        cancelled = true;
      };
    }
    const timer = setTimeout(load, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open]);

  // Bloque le défilement de la page derrière le panneau.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  function renderRow(row: Row) {
    const className = row.tone === "danger" ? `${styles.row} ${styles.rowDanger}` : styles.row;
    return (
      <Link
        key={row.key}
        href={row.href}
        className={className}
        onNavigate={(event) => guardNavigation(event, row.href)}
        onClick={onNavigate}
      >
        <span className={styles.rowIcon}>
          <row.Icon size={20} />
        </span>
        <span className={styles.rowLabel}>{row.label}</span>
        {row.tone === "admin" && <span className={styles.adminTag}>Admin</span>}
        <span className={styles.chevron}>
          <ChevronRightIcon />
        </span>
      </Link>
    );
  }

  const sections = isAdmin ? [...SECTIONS, ADMIN_SECTION] : SECTIONS;

  return (
    <div className={styles.root}>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <FocusTrap
        onClose={onClose}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-menu-title"
      >
        <div className={styles.panelHeader}>
          <h2 id="profile-menu-title" className={styles.panelTitle}>
            Profil
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Fermer le menu">
            ✕
          </button>
        </div>

        <Link
          href={IDENTITY_HREF}
          className={styles.identity}
          onNavigate={(event) => guardNavigation(event, IDENTITY_HREF)}
          onClick={onNavigate}
        >
          <span className={styles.avatar} aria-hidden="true">
            {summary ? initials(summary.pseudo) : null}
          </span>
          <span className={styles.identityText}>
            {summary ? (
              <>
                <span className={styles.pseudo}>{summary.pseudo}</span>
                <span className={styles.identityMeta}>
                  {formatRank(summary.rank)} · {summary.points ?? "—"} pts
                </span>
              </>
            ) : (
              <>
                <span className={`${styles.skeleton} ${styles.skeletonPseudo}`} aria-hidden="true" />
                <span className={`${styles.skeleton} ${styles.skeletonMeta}`} aria-hidden="true" />
              </>
            )}
          </span>
          <span className={styles.chevron}>
            <ChevronRightIcon />
          </span>
        </Link>

        <Link
          href="/stats"
          className={styles.statsCard}
          aria-label="Voir mes stats"
          onNavigate={(event) => guardNavigation(event, "/stats")}
          onClick={onNavigate}
        >
          <span className={styles.statBlock}>
            <span className={styles.statValue}>{statText(summary, summary?.accuracyPct != null ? `${summary.accuracyPct}%` : "—")}</span>
            <span className={styles.statLabel}>Précision</span>
          </span>
          <span className={styles.statBlock}>
            <span className={styles.statValue}>{statText(summary, summary?.bestRank != null ? `#${summary.bestRank}` : "—")}</span>
            <span className={styles.statLabel}>Meilleur rang</span>
          </span>
          <span className={styles.statBlock}>
            <span className={styles.statValue}>{statText(summary, summary?.badgeCount != null && summary.badgeTotal != null ? `${summary.badgeCount}/${summary.badgeTotal}` : "—")}</span>
            <span className={styles.statLabel}>Badges</span>
          </span>
        </Link>

        {/* TODO : pastille orange sur « Badges » quand un badge est non vu. Le
            « vu » est aujourd'hui un repère localStorage propre à
            NewBadgesWatcher (popup), pas une donnée exposée au panneau. */}
        {sections.map((section) => (
          <section key={section.key} className={styles.section} aria-labelledby={`profile-menu-${section.key}`}>
            <h3 id={`profile-menu-${section.key}`} className={styles.sectionTitle}>
              {section.title}
            </h3>
            <div className={styles.rows}>{section.rows.map(renderRow)}</div>
          </section>
        ))}

        <div className={styles.footer}>
          <form action={logout}>
            <button type="submit" className={`${styles.row} ${styles.logoutRow}`}>
              <span className={styles.rowIcon}>
                <LogoutIcon size={20} />
              </span>
              <span className={styles.rowLabel}>Déconnexion</span>
            </button>
          </form>
          <div className={styles.rows}>{renderRow(DANGER_ROW)}</div>
        </div>
      </FocusTrap>
    </div>
  );
}
