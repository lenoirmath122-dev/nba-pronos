"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BracketData } from "@/lib/queries/bracket";
import { SeriesDrillDown } from "./SeriesDrillDown";
import { RotateInvite } from "./RotateInvite";
import styles from "./TreeView.module.css";

// Vue B « arbre » + bascule (§10). SEULE feuille responsable de : le
// déclencheur « plein écran ↗ », l'overlay plein viewport, l'écoute de
// rotation, et l'invitation à tourner (rendue via RotateInvite, sans état
// propre — §3). Toujours montée (même en vue A) pour pouvoir écouter la
// rotation sans jamais lire l'orientation au chargement (§10.2).

// --breakpoint-lg / test d'orientation : littéraux, une media query JS ne
// lit pas var() (cf. tokens.css §11.2, une media query CSS non plus).
const DESKTOP_QUERY = "(min-width: 1024px)";
const LANDSCAPE_QUERY = "(orientation: landscape)";
const SEEN_INVITE_KEY = "bracket-tree-seen-anyway";

type EnteredBy = "rotation" | "explicit" | null;

type TreeViewProps = {
  data: BracketData;
  /** `?arbre=1` déjà lu côté serveur par app/bracket/page.tsx. */
  initialShow: boolean;
};

export function TreeView({ data, initialShow }: TreeViewProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(initialShow);
  const [showInvite, setShowInvite] = useState(false);
  // Ref (pas un state) : lue depuis un handler d'événement DOM qui ne doit
  // jamais capturer une valeur périmée.
  const enteredByRef = useRef<EnteredBy>(initialShow ? "explicit" : null);

  function enter(reason: EnteredBy) {
    enteredByRef.current = reason;
    setVisible(true);
    setShowInvite(false);
    // Historique (§10.2) : entrée par rotation REMPLACE, entrée par bouton
    // (ou « voir quand même ») AJOUTE — sinon 3 rotations créent 3 retours.
    if (reason === "rotation") {
      router.replace("/bracket?arbre=1");
    } else {
      router.push("/bracket?arbre=1");
    }
  }

  function exitToSummary() {
    enteredByRef.current = null;
    setVisible(false);
    router.replace("/bracket");
  }

  useEffect(() => {
    const orientationQuery = window.matchMedia(LANDSCAPE_QUERY);

    function handleOrientationChange(event: MediaQueryListEvent) {
      // Uniquement sous le point de rupture mobile (§10.2).
      if (window.matchMedia(DESKTOP_QUERY).matches) return;

      if (event.matches) {
        // Portrait -> paysage : entre en vue B.
        enter("rotation");
      } else if (enteredByRef.current === "rotation") {
        // Paysage -> portrait : sort SEULEMENT si entré par rotation — un
        // choix explicite (bouton / « voir quand même ») prime (§10.2).
        exitToSummary();
      }
    }

    // Écoute d'un ÉVÉNEMENT de rotation seulement — jamais l'état constaté
    // au montage, sinon tout visiteur desktop atterrirait dans l'arbre.
    orientationQuery.addEventListener("change", handleOrientationChange);
    return () => orientationQuery.removeEventListener("change", handleOrientationChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTriggerClick() {
    const isDesktop = window.matchMedia(DESKTOP_QUERY).matches;
    const isLandscape = window.matchMedia(LANDSCAPE_QUERY).matches;
    if (isDesktop || isLandscape) {
      enter("explicit");
      return;
    }

    let alreadySeen = false;
    try {
      alreadySeen = sessionStorage.getItem(SEEN_INVITE_KEY) === "1";
    } catch {
      // Stockage indisponible (navigation privée) : pas bloquant.
    }
    if (alreadySeen) {
      enter("explicit");
      return;
    }
    setShowInvite(true);
  }

  function handleSeeAnyway() {
    try {
      sessionStorage.setItem(SEEN_INVITE_KEY, "1");
    } catch {
      // Idem : simplement pas mémorisé.
    }
    enter("explicit");
  }

  if (visible) {
    return (
      <div className={styles.overlay}>
        <div className={styles.header}>
          <p className={styles.title}>Arbre complet</p>
          <button type="button" className={styles.close} onClick={exitToSummary}>
            × Quitter
          </button>
        </div>
        <SeriesDrillDown rounds={data.rounds} isDeadlinePassed={data.isDeadlinePassed} view="B" />
      </div>
    );
  }

  return (
    <>
      <button type="button" className={styles.trigger} onClick={handleTriggerClick}>
        Plein écran ↗
      </button>
      {showInvite && <RotateInvite onDismiss={() => setShowInvite(false)} onSeeAnyway={handleSeeAnyway} />}
    </>
  );
}
