"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Backdrop } from "@/components/ui/Backdrop";
import { FocusTrap } from "@/components/ui/FocusTrap";
import type { TeamInsights, TeamInsightsResponse } from "@/lib/teamInsights/types";
import { FaceToFaceTab, KeyPlayersTab, RosterTab, TeamSwitch } from "./TeamDetailsTabs";
import styles from "./TeamDetailsDialog.module.css";

// Popup « Stats des équipes » : en-tête et onglets fixes, contenu qui défile.
// Montée seulement pendant l'ouverture → rouvre toujours sur « Face à face ».

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: TeamInsightsResponse };

type Props = {
  subtitle: string;
  teamIds: [string, string];
  state: LoadState;
  onRetry: () => void;
  onClose: () => void;
};

const TABS = [
  { id: "face", label: "Face à face" },
  { id: "roster", label: "Effectif" },
  { id: "key", label: "Joueurs à surveiller" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function TeamDetailsDialog({ subtitle, teamIds, state, onRetry, onClose }: Props) {
  const uid = useId();
  const [tab, setTab] = useState<TabId>("face");
  const [teamIndex, setTeamIndex] = useState<0 | 1>(0);

  // La page derrière ne défile plus tant que la popup est ouverte.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const teams: TeamInsights[] =
    state.status === "ready"
      ? (teamIds.map((id) => state.data.teams.find((t) => t.teamId === id)).filter(Boolean) as TeamInsights[])
      : [];
  const hasAnyData = teams.some((t) => t.form !== null);

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = (index + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
    setTab(TABS[next].id);
    document.getElementById(`${uid}-tab-${TABS[next].id}`)?.focus();
  }

  const selected = teams[teamIndex];

  return createPortal(
    <Backdrop className={styles.backdrop} onClose={onClose}>
      <FocusTrap
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        onClose={onClose}
      >
        <div className={styles.header}>
          <div className={styles.headings}>
            <p id={`${uid}-title`} className={styles.title}>
              Stats des équipes
            </p>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
          <button type="button" className={styles.close} onClick={onClose}>
            <span aria-hidden="true">×</span> Fermer
          </button>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Sections du détail">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              id={`${uid}-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`${uid}-panel`}
              tabIndex={tab === t.id ? 0 : -1}
              className={tab === t.id ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          id={`${uid}-panel`}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-${tab}`}
          className={styles.panel}
        >
          {(state.status === "idle" || state.status === "loading") && <p role="status">Chargement…</p>}
          {state.status === "error" && (
            <div role="alert" className={styles.message}>
              <p>Impossible de charger le détail, réessaie plus tard.</p>
              <button type="button" className={styles.retry} onClick={onRetry}>
                Réessayer
              </button>
            </div>
          )}
          {state.status === "ready" && !hasAnyData && <p>Pas encore de match joué cette saison.</p>}
          {state.status === "ready" && hasAnyData && tab === "face" && (
            <FaceToFaceTab teams={teams} />
          )}
          {state.status === "ready" && hasAnyData && tab !== "face" && selected && (
            <>
              <TeamSwitch teams={teams} index={teamIndex} onChange={setTeamIndex} />
              {tab === "roster" ? <RosterTab team={selected} updatedAt={state.data.updatedAt} /> : <KeyPlayersTab team={selected} />}
            </>
          )}
        </div>
      </FocusTrap>
    </Backdrop>,
    document.body
  );
}
