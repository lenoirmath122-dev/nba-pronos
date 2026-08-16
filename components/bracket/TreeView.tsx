"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BracketData } from "@/lib/queries/bracket";
import { SeriesDrillDown } from "./SeriesDrillDown";
import { RotateInvite } from "./RotateInvite";
import styles from "./TreeView.module.css";

// Vue B « arbre » + bascule (§10). SEULE feuille responsable de : le
// déclencheur « plein écran ↗ », l'overlay plein viewport, l'écoute de
// rotation/redimensionnement, et l'invitation à tourner (rendue via
// RotateInvite, sans état propre — §3). Toujours montée (même en vue A)
// pour pouvoir écouter les changements de viewport sans jamais lire l'état
// au tout 1er rendu SERVEUR (qui ignore toujours le viewport réel).
//
// Vue B DEFAULT sur desktop/paysage (16/08/2026, demandé par l'utilisateur
// après le correctif de scroll du 1er tour — « plus raccord avec ce qui se
// fait dans le monde du basket/NBA ») : jusqu'ici réservée à un
// événement de rotation ou au bouton explicite, jamais montrée au
// chargement même sur un viewport qui la supporterait déjà — le
// commentaire d'origine disait explicitement l'inverse (« jamais l'état
// constaté au montage, sinon tout visiteur desktop atterrirait dans
// l'arbre »). Décision inversée ici, sur demande explicite : mobile
// PORTRAIT reste sur la Vue A (accordéon) — la Vue B suppose un scroll
// horizontal assumé, jamais permis ailleurs dans ce projet.

// Virgule = OU en media queries : une SEULE liste couvre desktop (largeur)
// ET paysage (orientation), au montage ET à tout changement ultérieur
// (redimensionnement de fenêtre, rotation) — remplace les 2 requêtes
// séparées d'avant (DESKTOP_QUERY/LANDSCAPE_QUERY), fusionnées car
// traitées identiquement partout dans ce fichier désormais.
const IMMERSIVE_DEFAULT_QUERY = "(min-width: 1024px), (orientation: landscape)";
const SEEN_INVITE_KEY = "bracket-tree-seen-anyway";

// "auto" = entré parce que le viewport correspond déjà (nouveau, cf.
// ci-dessus) ; "explicit" = bouton "Plein écran"/lien `?arbre=1` partagé ou
// mis en favori. Seule une entrée "auto" ressort automatiquement quand le
// viewport cesse de correspondre — un choix explicite n'est jamais annulé
// par un simple redimensionnement.
type EnteredBy = "auto" | "explicit" | null;

type TreeViewProps = {
  data: BracketData;
  /** `?arbre=1` déjà lu côté serveur par app/bracket/page.tsx. */
  initialShow: boolean;
  /** Cf. BracketSummary — raccourci « Parier sur cette série » (04/08/2026). */
  showBetLink: boolean;
};

export function TreeView({ data, initialShow, showBetLink }: TreeViewProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(initialShow);
  const [showInvite, setShowInvite] = useState(false);
  // Ref (pas un state) : lue depuis un handler d'événement DOM qui ne doit
  // jamais capturer une valeur périmée.
  const enteredByRef = useRef<EnteredBy>(initialShow ? "explicit" : null);

  function enter(reason: EnteredBy, options: { replace: boolean }) {
    enteredByRef.current = reason;
    setVisible(true);
    setShowInvite(false);
    // Historique (§10.2) : entrée automatique (viewport déjà conforme, ou
    // rotation) REMPLACE, entrée explicite (bouton, ou « voir quand
    // même ») AJOUTE — sinon 3 rotations créent 3 retours.
    if (options.replace) {
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

  // `useLayoutEffect` (pas `useEffect`) : bascule avant le 1er paint côté
  // client, pour limiter au strict minimum le flash Vue A -> Vue B sur
  // desktop/paysage au chargement — inévitable au tout 1er rendu SERVEUR
  // (qui ignore toujours le viewport réel), même limite déjà acceptée
  // ailleurs dans ce projet (ex. NotificationSettings.tsx, hydratation).
  useLayoutEffect(() => {
    const query = window.matchMedia(IMMERSIVE_DEFAULT_QUERY);

    function sync(matches: boolean) {
      if (matches && enteredByRef.current === null) {
        enter("auto", { replace: true });
      } else if (!matches && enteredByRef.current === "auto") {
        exitToSummary();
      }
    }

    sync(query.matches);

    function handleChange(event: MediaQueryListEvent) {
      sync(event.matches);
    }
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTriggerClick() {
    if (window.matchMedia(IMMERSIVE_DEFAULT_QUERY).matches) {
      enter("explicit", { replace: false });
      return;
    }

    let alreadySeen = false;
    try {
      alreadySeen = sessionStorage.getItem(SEEN_INVITE_KEY) === "1";
    } catch {
      // Stockage indisponible (navigation privée) : pas bloquant.
    }
    if (alreadySeen) {
      enter("explicit", { replace: false });
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
    enter("explicit", { replace: false });
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
        <SeriesDrillDown
          rounds={data.rounds}
          isDeadlinePassed={data.isDeadlinePassed}
          view="B"
          competitionType={data.competitionType}
          showBetLink={showBetLink}
        />
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
