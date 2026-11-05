"use client";

import { useState } from "react";
import { track } from "@vercel/analytics";
import type { TeamInsightsResponse } from "@/lib/teamInsights/types";
import { TeamDetailsDialog } from "./TeamDetailsDialog";
import styles from "./TeamDetailsButton.module.css";

// Bouton « Détail des équipes » d'une carte de match : popup à onglets (Face à
// face, Effectif, Joueurs à surveiller). Le dialogue n'est monté que pendant
// l'ouverture (FocusTrap : focus piégé, rendu au bouton à la fermeture), donc
// il rouvre toujours sur Face à face. Un seul appel réseau, au premier clic :
// le résultat reste en mémoire de ce composant.
type Props = { teamIds: [string, string]; subtitle: string };

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: TeamInsightsResponse };

export function TeamDetailsButton({ teamIds, subtitle }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<State>({ status: "idle" });

  async function load() {
    setState({ status: "loading" });
    try {
      const response = await fetch(`/api/teams/insights?ids=${teamIds.join(",")}`);
      if (!response.ok) throw new Error(String(response.status));
      setState({ status: "ready", data: (await response.json()) as TeamInsightsResponse });
    } catch {
      setState({ status: "error" });
    }
  }

  function open() {
    setIsOpen(true);
    // Mesure d'usage : aucune donnée personnelle dans l'événement.
    try {
      track("team_details_open");
    } catch {
      // l'analytics ne doit jamais gêner l'ouverture
    }
    if (state.status === "idle") void load();
  }

  return (
    <>
      <button type="button" className={styles.button} onClick={open}>
        Détail des équipes
      </button>
      {isOpen && (
        <TeamDetailsDialog
          subtitle={subtitle}
          teamIds={teamIds}
          state={state}
          onRetry={() => void load()}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
