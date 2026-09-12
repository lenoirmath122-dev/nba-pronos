"use client";

import { useSyncExternalStore } from "react";
import styles from "./AuthScreen.module.css";

// Même patron que resetSuccess/accountDeleted dans LoginForm.tsx : lit une
// donnée EXTERNE (mode d'affichage standalone) sans le risque de désynchro
// hydratation d'un useEffect + setState classique (pas de valeur côté
// serveur, jamais "standalone" au 1er rendu SSR).
function subscribeToNothing() {
  return () => {};
}

// Le site n'a pas la balise historique apple-mobile-web-app-capable (seul
// app/manifest.ts déclare display:"standalone") : navigator.standalone
// (mécanisme Apple pré-manifest) reste donc toujours undefined ici, même
// une fois réellement lancé en standalone — il faut aussi vérifier la
// media query display-mode, la détection moderne basée sur le manifest.
// Restreint à iOS : les PWA Android tournent sur le moteur Chrome complet,
// pas concernées par la restriction Turnstile visée par ce composant.
function isIOSDevice(): boolean {
  const nav = window.navigator;
  return (
    /iPad|iPhone|iPod/.test(nav.userAgent) ||
    // iPadOS 13+ se présente comme "MacIntel" en desktop mode — seul le
    // support tactile le distingue d'un vrai Mac.
    (nav.platform === "MacIntel" && nav.maxTouchPoints > 1)
  );
}

function getIsStandalone(): boolean {
  if (!isIOSDevice()) return false;
  const legacyAppleFlag = (
    window.navigator as Navigator & { standalone?: boolean }
  ).standalone;
  return (
    legacyAppleFlag === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}
function getIsStandaloneServerSnapshot(): boolean {
  return false;
}

/**
 * Le captcha Cloudflare Turnstile ne fonctionne jamais dans le WKWebView
 * restreint d'une PWA iOS installée sur l'écran d'accueil (limitation
 * connue, non résolue côté Cloudflare/WebKit — aucun fix applicatif fiable
 * n'existe). Un lien target="_blank" depuis ce mode standalone est traité
 * par iOS comme une ouverture dans Safari, qui échappe à la restriction :
 * seule issue fiable ici, donc on remplace le formulaire (voué à échouer)
 * par ce lien plutôt que de laisser l'utilisateur buter sur le captcha.
 */
export function StandaloneAuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const isStandalone = useSyncExternalStore(
    subscribeToNothing,
    getIsStandalone,
    getIsStandaloneServerSnapshot,
  );

  if (!isStandalone) return <>{children}</>;

  return (
    <div className={`${styles.card} glass-card`}>
      <p className={styles.success}>
        La vérification de sécurité ne fonctionne pas dans l&apos;application
        installée sur ton iPhone. Ouvre ce lien dans Safari pour continuer.
      </p>
      <a
        href={window.location.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${styles.submit} ${styles.standaloneLink}`}
      >
        Ouvrir dans Safari
      </a>
    </div>
  );
}
