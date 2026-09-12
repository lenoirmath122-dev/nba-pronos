"use client";

import { useState, useSyncExternalStore } from "react";
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
 * n'existe). PAS de lien target="_blank" ici : contrairement à une idée
 * répandue, ce n'est PAS un moyen fiable d'échapper au mode standalone iOS
 * (confirmé en conditions réelles, 12/09/2026 — reste sur la même page dans
 * le même contexte fermé selon la version d'iOS). Les schémas d'URL type
 * x-safari-https:// sont également non documentés et inconsistants d'une
 * version à l'autre. Seule méthode garantie : afficher le lien en clair et
 * laisser l'utilisateur le copier/coller lui-même dans un vrai onglet Safari.
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
  const [copied, setCopied] = useState(false);

  if (!isStandalone) return <>{children}</>;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      // API Clipboard indisponible/refusée : le lien reste affiché en clair
      // ci-dessous, copiable à la main (appui long) en dernier recours.
    }
  }

  return (
    <div className={`${styles.card} glass-card`}>
      <p className={styles.success}>
        La vérification de sécurité ne fonctionne pas dans l&apos;application
        installée sur ton iPhone. Copie ce lien et colle-le dans un nouvel
        onglet Safari pour continuer.
      </p>
      <p className={styles.standaloneUrl}>{window.location.href}</p>
      <button type="button" onClick={handleCopy} className={styles.submit}>
        {copied ? "Lien copié !" : "Copier le lien"}
      </button>
    </div>
  );
}
