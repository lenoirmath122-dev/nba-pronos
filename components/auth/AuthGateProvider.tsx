"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  PENDING_ACTION_KEY,
  serializePendingAction,
  type PendingActionType,
} from "@/lib/auth/pendingAction";
import { trackFunnel } from "@/lib/funnel/track";
import { GuestBanner } from "@/components/guest/GuestBanner";

// Porte d'authentification (mode invité, lot B). `requireAuth(action)` : un
// connecté exécute `run` tout de suite ; un invité voit la modale, et l'action
// est gardée en localStorage pour être reprise après la connexion. Le blocage
// réel reste côté serveur (RLS + auth.getUser()) : ceci n'est que l'accueil.

// La modale (et le client Supabase de GoogleButton, ~225 Ko) n'est importée qu'à
// la première ouverture : next/dynamic la préchargeait dans le HTML de chaque
// page invité (mesuré au build, lot G).
type ModalComponent = ComponentType<{ onClose: () => void }>;

export type RequireAuthInput = {
  type: PendingActionType;
  /** Chemin interne de retour ; par défaut la page courante. */
  returnUrl?: string;
  payload?: Record<string, string | number | boolean>;
  /** Exécutée seulement si le visiteur est connecté. */
  run?: () => void;
};

type Gate = { requireAuth: (input: RequireAuthInput) => void };

const GateContext = createContext<Gate | null>(null);

export function useRequireAuth(): Gate["requireAuth"] {
  const gate = useContext(GateContext);
  if (!gate) throw new Error("useRequireAuth doit être utilisé sous <AuthGateProvider>.");
  return gate.requireAuth;
}

export function AuthGateProvider({ authenticated, children }: { authenticated: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [Modal, setModal] = useState<ModalComponent | null>(null);

  const openModal = useCallback(() => {
    setOpen(true);
    void import("./AuthGateModal").then((m) => setModal(() => m.AuthGateModal));
  }, []);

  const requireAuth = useCallback(
    (input: RequireAuthInput) => {
      if (authenticated) {
        input.run?.();
        return;
      }
      try {
        window.localStorage.setItem(
          PENDING_ACTION_KEY,
          serializePendingAction({
            type: input.type,
            returnUrl: input.returnUrl ?? `${window.location.pathname}${window.location.search}`,
            payload: input.payload,
            createdAt: Date.now(),
          }),
        );
      } catch {
        // Stockage indisponible (navigation privée) : la modale marche, sans reprise.
      }
      trackFunnel("guest_action_attempted", undefined, input.type);
      trackFunnel("auth_modal_opened", undefined, input.type);
      openModal();
    },
    [authenticated, openModal],
  );

  const value = useMemo(() => ({ requireAuth }), [requireAuth]);

  return (
    <GateContext.Provider value={value}>
      {children}
      {authenticated ? null : <GuestBanner
          onCreate={() => {
            trackFunnel("auth_modal_opened");
            openModal();
          }}
        />}
      {open && Modal ? <Modal onClose={() => setOpen(false)} /> : null}
    </GateContext.Provider>
  );
}
