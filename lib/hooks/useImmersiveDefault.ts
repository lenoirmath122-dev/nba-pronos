"use client";

import { useLayoutEffect, useRef, useState } from "react";

// État "vue immersive par défaut sur desktop/paysage" — extrait le
// 16/08/2026 (chantier « remplissage en poster interactif ») de
// components/bracket/TreeView.tsx, qui l'utilisait pour la bascule Vue A/
// Vue B de l'écran Bracket (consultation). Généralisé ici pour être
// partagé avec l'écran de remplissage (`/play/bracket`), qui adopte la
// même règle : desktop/paysage → mode immersif par défaut ; mobile
// PORTRAIT → flux normal (seule vue sans scroll horizontal, règle
// appliquée partout ailleurs dans ce projet).
//
// Le hook gère UNIQUEMENT l'état (visible/showInvite) et la mécanique de
// détection (media query fusionnée, réessai au changement, invitation à
// tourner) — le ROUTING (quelle URL viser en entrant/sortant, le cas
// échéant) reste du ressort de l'appelant via `onEnter`/`onExit`, chaque
// écran ayant son propre contrat d'URL (`/bracket?arbre=1` ; `/play/
// bracket` n'en a pas).

// Virgule = OU en media queries : desktop (largeur) ET paysage
// (orientation), une seule liste écoutée au montage ET à tout changement
// ultérieur (redimensionnement de fenêtre, rotation).
const IMMERSIVE_DEFAULT_QUERY = "(min-width: 1024px), (orientation: landscape)";

// "auto" = entré parce que le viewport correspond déjà ; "explicit" =
// bouton/lien explicite. Seule une entrée "auto" ressort automatiquement
// quand le viewport cesse de correspondre — un choix explicite n'est
// jamais annulé par un simple redimensionnement.
type EnteredBy = "auto" | "explicit" | null;

type UseImmersiveDefaultOptions = {
  initialVisible: boolean;
  /** Clé sessionStorage dédiée à CET écran — pas de clé partagée par
   *  défaut : chaque appelant est explicite sur son propre stockage
   *  (« vu l'invitation à tourner sur cet écran précis »). */
  seenInviteKey: string;
  /** Appelé quand le mode immersif s'active (montage/changement de
   *  viewport, ou action explicite) — l'appelant y fait son propre routing
   *  éventuel (`replace` pour "auto", `push` pour "explicit", même
   *  convention que TreeView.tsx). */
  onEnter?: (reason: "auto" | "explicit") => void;
  /** Appelé quand le mode immersif se quitte (viewport ne correspond plus
   *  ET l'entrée était "auto", ou fermeture explicite via `exit()`). */
  onExit?: () => void;
};

export function useImmersiveDefault({ initialVisible, seenInviteKey, onEnter, onExit }: UseImmersiveDefaultOptions) {
  const [visible, setVisible] = useState(initialVisible);
  const [showInvite, setShowInvite] = useState(false);
  // Ref (pas un state) : lue depuis un handler d'événement DOM qui ne doit
  // jamais capturer une valeur périmée.
  const enteredByRef = useRef<EnteredBy>(initialVisible ? "explicit" : null);

  function enter(reason: EnteredBy) {
    enteredByRef.current = reason;
    setVisible(true);
    setShowInvite(false);
    if (reason) onEnter?.(reason);
  }

  function exit() {
    enteredByRef.current = null;
    setVisible(false);
    onExit?.();
  }

  // `useLayoutEffect` (pas `useEffect`) : bascule avant le 1er paint côté
  // client, pour limiter au strict minimum le flash "mode normal -> mode
  // immersif" sur desktop/paysage au chargement — inévitable au tout 1er
  // rendu SERVEUR (qui ignore toujours le viewport réel), même limite déjà
  // acceptée ailleurs dans ce projet (ex. NotificationSettings.tsx).
  useLayoutEffect(() => {
    const query = window.matchMedia(IMMERSIVE_DEFAULT_QUERY);

    function sync(matches: boolean) {
      if (matches && enteredByRef.current === null) {
        enter("auto");
      } else if (!matches && enteredByRef.current === "auto") {
        exit();
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
      enter("explicit");
      return;
    }

    let alreadySeen = false;
    try {
      alreadySeen = sessionStorage.getItem(seenInviteKey) === "1";
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
      sessionStorage.setItem(seenInviteKey, "1");
    } catch {
      // Idem : simplement pas mémorisé.
    }
    enter("explicit");
  }

  function dismissInvite() {
    setShowInvite(false);
  }

  return { visible, showInvite, handleTriggerClick, handleSeeAnyway, dismissInvite, exit };
}
