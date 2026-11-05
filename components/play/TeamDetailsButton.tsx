"use client";

import { useState } from "react";
import { track } from "@vercel/analytics";
import { ModalDialog } from "@/components/ui/ModalDialog";
import type { TeamInsightsResponse } from "@/lib/teamInsights/types";
import { TeamDetailsContent } from "./TeamDetailsContent";
import styles from "./TeamDetailsButton.module.css";

// Bouton « Détail des équipes » d'une carte de match : popup avec résumé de
// saison et effectif des deux équipes. Même patron que
// components/regles/RuleHelpButton.tsx (ModalDialog portée vers document.body,
// focus piégé et rendu au bouton à la fermeture par FocusTrap). Un seul
// appel réseau, au premier clic : le résultat reste en mémoire du composant.
type Props = { teamIds: [string, string] };

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: TeamInsightsResponse };

export function TeamDetailsButton({ teamIds }: Props) {
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
        <ModalDialog title="Détail des équipes" onClose={() => setIsOpen(false)}>
          <div className={styles.content}>
            {(state.status === "idle" || state.status === "loading") && <p role="status">Chargement…</p>}
            {state.status === "error" && (
              <div role="alert">
                <p>Impossible de charger le détail, réessaie plus tard.</p>
                <button type="button" className={styles.retry} onClick={() => void load()}>
                  Réessayer
                </button>
              </div>
            )}
            {state.status === "ready" && <TeamDetailsContent data={state.data} />}
          </div>
        </ModalDialog>
      )}
    </>
  );
}
