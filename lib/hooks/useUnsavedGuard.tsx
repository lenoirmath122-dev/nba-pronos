"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import styles from "./useUnsavedGuard.module.css";

// Garde-fou anti-perte de saisie (C2, 0.2.9) — TRANSVERSE : premier des trois
// écrans à saisie perdable (pronos, paris, bracket personnel), écrit comme une
// brique réutilisable, pas comme un détail de l'écran Matchs.
//
// Avec la multi-ouverture (SPEC_ECRAN_MATCHS §3), plusieurs lignes peuvent
// être "sales" en même temps : chaque formulaire s'enregistre sous sa PROPRE
// clé (ex. matchId) ; le drapeau exposé au reste de l'app est AGRÉGÉ (au moins
// une clé sale = dirty), jamais par ligne (§12).
//
// C2 est une garde d'ERGONOMIE, jamais de sécurité (§12) : la RLS et le
// verrouillage temporel restent l'autorité — perdre ce garde-fou ne permettrait
// aucune écriture que le serveur n'accepterait pas déjà.
//
// Extension nécessaire hors de cet écran (validée avec l'utilisateur) :
// components/nav/TabBar.tsx (partagé par tous les écrans) consomme
// useGuardedNavigation() pour intercepter un clic d'onglet pendant une saisie
// en cours ; app/(app)/layout.tsx monte UnsavedGuardProvider autour de
// {children} + <TabBar/>. Inerte tant qu'aucun écran ne déclare de saisie sale.

type UnsavedGuardContextValue = {
  isDirty: boolean;
  setDirty: (key: string, dirty: boolean) => void;
  guardNavigation: (event: { preventDefault: () => void }, href: string) => void;
};

const UnsavedGuardContext = createContext<UnsavedGuardContextValue | null>(null);

export function UnsavedGuardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dirtyKeysRef = useRef<Set<string>>(new Set());
  const [isDirty, setIsDirty] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const setDirty = useCallback((key: string, dirty: boolean) => {
    const keys = dirtyKeysRef.current;
    if (dirty) keys.add(key);
    else keys.delete(key);
    setIsDirty(keys.size > 0);
  }, []);

  const guardNavigation = useCallback((event: { preventDefault: () => void }, href: string) => {
    if (dirtyKeysRef.current.size === 0) return; // rien à protéger, on laisse filer
    event.preventDefault();
    setPendingHref(href);
  }, []);

  // Fermeture d'onglet / rechargement : natif, tant que dirty (§12).
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const value = useMemo<UnsavedGuardContextValue>(
    () => ({ isDirty, setDirty, guardNavigation }),
    [isDirty, setDirty, guardNavigation]
  );

  function stay() {
    setPendingHref(null);
  }

  function leaveAnyway() {
    const href = pendingHref;
    dirtyKeysRef.current.clear();
    setIsDirty(false);
    setPendingHref(null);
    if (href) router.push(href);
  }

  return (
    <UnsavedGuardContext.Provider value={value}>
      {children}
      {pendingHref !== null && (
        <div className={styles.backdrop} role="presentation">
          <div
            className={styles.dialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="unsaved-guard-title"
          >
            <p id="unsaved-guard-title" className={styles.title}>
              Tu as des changements non enregistrés
            </p>
            <p className={styles.body}>
              Si tu quittes maintenant, ce que tu viens de saisir ne sera pas gardé.
            </p>
            <div className={styles.actions}>
              {/* autoFocus intentionnel : "Rester" est le choix par défaut (§12). */}
              <button type="button" className={styles.stay} onClick={stay} autoFocus>
                Rester
              </button>
              <button type="button" className={styles.leave} onClick={leaveAnyway}>
                Quitter quand même
              </button>
            </div>
          </div>
        </div>
      )}
    </UnsavedGuardContext.Provider>
  );
}

/**
 * Consommé par CHAQUE formulaire à saisie perdable (une ligne = une clé
 * unique, ex. matchId). markDirty/clearDirty agrègent au niveau de l'écran.
 */
export function useUnsavedGuard(key: string) {
  const ctx = useContext(UnsavedGuardContext);
  if (!ctx) {
    throw new Error(
      "useUnsavedGuard doit être utilisé sous UnsavedGuardProvider (app/(app)/layout.tsx)"
    );
  }
  const markDirty = useCallback(() => ctx.setDirty(key, true), [ctx, key]);
  const clearDirty = useCallback(() => ctx.setDirty(key, false), [ctx, key]);
  return { markDirty, clearDirty };
}

const NOOP_GUARD: UnsavedGuardContextValue["guardNavigation"] = () => {};

/**
 * Consommé par un <Link> à intercepter pendant une saisie sale (TabBar,
 * raccourci pari). TabBar est aussi rendu par ScreenShell (Classement,
 * Bracket) HORS de app/(app)/layout.tsx, donc SANS provider — se dégrade en
 * no-op plutôt que de lever, sinon ces deux écrans casseraient pour un
 * visiteur connecté (rien à garder n'y déclare jamais de saisie sale).
 */
export function useGuardedNavigation() {
  const ctx = useContext(UnsavedGuardContext);
  return ctx?.guardNavigation ?? NOOP_GUARD;
}
