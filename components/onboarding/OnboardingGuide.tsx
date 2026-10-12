"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Backdrop } from "@/components/ui/Backdrop";
import { FocusTrap } from "@/components/ui/FocusTrap";
import { useIsValidatedDialogOpen } from "@/components/ui/ValidatedDialog";
import { detectInstallPlatform, ensurePushSubscribed, isStandalone, pushSupported } from "@/lib/push/client";
import { resolveOnboarding, type InstallPlatform, type OnboardingState } from "@/lib/push/onboarding";
import styles from "./OnboardingGuide.module.css";

// Guide d'arrivée (12/10/2026, demandé par l'utilisateur : « hyper important »)
// : à l'ouverture de la zone joueur, explique comment activer les
// notifications ET comment ajouter Panier Ballon à l'écran d'accueil. La
// carte PushPrompt de l'Accueil existe déjà mais se replie 7 jours et se
// perd dans la page — ici c'est une popup, qui revient chaque jour tant que
// les deux étapes ne sont pas faites (« Plus tard » = 24 h, cet appareil).
//
// Même contrainte qu'à PushPrompt : la demande d'autorisation ne part QUE d'un
// tap sur le bouton (iOS l'exige, un refus réflexe d'une popup surprise est
// définitif). Tout ce qui lit le navigateur est résolu APRÈS montage, jamais
// au rendu serveur (erreur d'hydratation sinon). Règle de décision pure :
// lib/push/onboarding.ts.

const SNOOZE_KEY = "onboarding-guide-snoozed-until";
const INSTALL_CONFIRMED_KEY = "onboarding-install-confirmed";
const SNOOZE_MS = 24 * 60 * 60 * 1000;

// Événement Chrome/Android non typé par lib.dom : propose l'installation
// native en un tap, quand le navigateur la juge possible.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function readFlag(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeFlag(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible (navigation privée) : le guide reviendra au
    // prochain chargement, sans gravité.
  }
}

function isSnoozed(): boolean {
  const until = Number(readFlag(SNOOZE_KEY));
  return Number.isFinite(until) && until > Date.now();
}

type Resolved = { state: OnboardingState; platform: InstallPlatform };

async function resolve(): Promise<Resolved | null> {
  if (isSnoozed()) return null;

  const platform = detectInstallPlatform();
  const supported = pushSupported() && "Notification" in window;

  let subscribedHere = false;
  if (supported) {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    subscribedHere = Boolean(await registration?.pushManager.getSubscription());
  }

  const state = resolveOnboarding({
    platform,
    standalone: isStandalone(),
    pushSupported: supported,
    permission: supported ? Notification.permission : "unsupported",
    subscribedHere,
    installConfirmed: readFlag(INSTALL_CONFIRMED_KEY) === "1",
  });
  return state.show ? { state, platform } : null;
}

export function OnboardingGuide() {
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const validatedDialogOpen = useIsValidatedDialogOpen();

  useEffect(() => {
    // setState uniquement dans les callbacks (règle react-hooks/set-state-in-effect).
    let cancelled = false;
    resolve()
      .then((next) => {
        if (!cancelled) setResolved(next);
      })
      .catch(() => {
        if (!cancelled) setResolved(null);
      });

    function onBeforeInstall(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  if (!resolved || closed || validatedDialogOpen) return null;
  const { state, platform } = resolved;

  function close() {
    writeFlag(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    setClosed(true);
  }

  async function enableNotifications() {
    setPending(true);
    setError(null);
    try {
      const result = await ensurePushSubscribed();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setResolved((current) =>
        current ? { ...current, state: { ...current.state, notif: "done" } } : current
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue, réessaie.");
    } finally {
      setPending(false);
    }
  }

  async function installNatively() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    setInstallEvent(null);
    if (outcome === "accepted") confirmInstalled();
  }

  function confirmInstalled() {
    writeFlag(INSTALL_CONFIRMED_KEY, "1");
    setResolved((current) =>
      current ? { ...current, state: { ...current.state, install: "done" } } : current
    );
  }

  // Tout est fait (le joueur vient d'activer les notifs et l'installation
  // est confirmée ou sans objet) : on ferme sans insister.
  const allDone = state.notif !== "enable" && state.notif !== "needs-install" && state.install !== "todo";

  return createPortal(
    <Backdrop className={styles.backdrop} onClose={close}>
      <FocusTrap
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-guide-title"
        onClose={close}
      >
        <p id="onboarding-guide-title" className={styles.title}>
          {allDone ? "Tout est prêt !" : "Bienvenue sur Panier Ballon"}
        </p>
        <p className={styles.lead}>
          {allDone
            ? "Tu seras prévenu avant la fin des pronos et des paris."
            : "Deux réglages à faire une fois pour ne rien rater."}
        </p>

        <section className={styles.step} aria-labelledby="onboarding-notif">
          <h2 id="onboarding-notif" className={styles.stepTitle}>
            <span className={`${styles.badge} ${state.notif === "done" ? styles.badgeDone : ""}`} aria-hidden="true">
              {state.notif === "done" ? "✓" : "1"}
            </span>
            Active les notifications
          </h2>
          {state.notif === "done" && <p className={styles.text}>Activées sur cet appareil.</p>}
          {state.notif === "enable" && (
            <>
              <p className={styles.text}>
                Rappels avant la fin des pronos et des paris, résultats de tes paris : c&apos;est le seul moyen de
                ne pas passer à côté.
              </p>
              <button type="button" className={styles.primary} disabled={pending} onClick={() => void enableNotifications()}>
                {pending ? "Activation…" : "Activer les notifications"}
              </button>
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
            </>
          )}
          {state.notif === "needs-install" && (
            <p className={styles.text}>
              Sur iPhone, les notifications ne marchent que depuis l&apos;app ajoutée à l&apos;écran d&apos;accueil.
              Fais d&apos;abord l&apos;étape 2, puis rouvre Panier Ballon depuis son icône : ce guide te proposera
              le bouton d&apos;activation.
            </p>
          )}
          {state.notif === "blocked" && (
            <p className={styles.text}>
              Les notifications sont bloquées pour Panier Ballon. Réactive-les dans les réglages de ton téléphone
              (ou de ton navigateur), puis rouvre l&apos;app.
            </p>
          )}
          {state.notif === "unsupported" && (
            <p className={styles.text}>Ce navigateur ne prend pas en charge les notifications.</p>
          )}
        </section>

        {state.install !== "na" && (
          <section className={styles.step} aria-labelledby="onboarding-install">
            <h2 id="onboarding-install" className={styles.stepTitle}>
              <span
                className={`${styles.badge} ${state.install === "done" ? styles.badgeDone : ""}`}
                aria-hidden="true"
              >
                {state.install === "done" ? "✓" : "2"}
              </span>
              Ajoute l&apos;app à ton écran d&apos;accueil
            </h2>
            {state.install === "done" && <p className={styles.text}>Raccourci ajouté.</p>}
            {state.install === "todo" && (
              <>
                {platform === "ios" ? (
                  <ol className={styles.list}>
                    <li>
                      Touche le bouton <strong>Partager</strong> (le carré avec une flèche vers le haut, en bas de
                      Safari ; en haut à droite dans Chrome).
                    </li>
                    <li>
                      Fais défiler et choisis <strong>« Sur l&apos;écran d&apos;accueil »</strong>.
                    </li>
                    <li>
                      Valide avec <strong>Ajouter</strong>, puis ouvre Panier Ballon depuis sa nouvelle icône.
                    </li>
                  </ol>
                ) : (
                  <>
                    {installEvent ? (
                      <button type="button" className={styles.primary} onClick={() => void installNatively()}>
                        Ajouter à l&apos;écran d&apos;accueil
                      </button>
                    ) : (
                      <ol className={styles.list}>
                        <li>
                          Ouvre le menu du navigateur (<strong>⋮</strong>, en haut à droite).
                        </li>
                        <li>
                          Choisis <strong>« Installer l&apos;application »</strong> ou{" "}
                          <strong>« Ajouter à l&apos;écran d&apos;accueil »</strong>.
                        </li>
                        <li>Confirme, puis ouvre Panier Ballon depuis sa nouvelle icône.</li>
                      </ol>
                    )}
                  </>
                )}
                <button type="button" className={styles.link} onClick={confirmInstalled}>
                  C&apos;est fait, je l&apos;ai déjà
                </button>
              </>
            )}
          </section>
        )}

        <button type="button" className={allDone ? styles.primary : styles.secondary} onClick={close}>
          {allDone ? "OK" : "Plus tard"}
        </button>
      </FocusTrap>
    </Backdrop>,
    document.body
  );
}
