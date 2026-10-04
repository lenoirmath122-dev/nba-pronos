"use client";

import { useEffect, useState } from "react";
import { ensurePushSubscribed, iosNeedsInstall, pushSupported } from "@/lib/push/client";
import type { NotificationPreference } from "@/lib/queries/home";
import styles from "./PushPrompt.module.css";

// Carte d'activation des notifications en haut de l'Accueil (p3-13, retours
// de l'alpha NBA Cup) : seuls 3 joueurs sur 9 avaient activé le push, le
// réglage n'existant qu'au fond du Profil. Impossible de le proposer pendant
// l'inscription elle-même (pas de session avant la confirmation de l'email,
// cf. lib/auth/actions.ts → /verify-email), d'où la 1ʳᵉ arrivée sur
// l'Accueil comme point d'entrée. La demande d'autorisation part TOUJOURS
// d'un tap sur le bouton, jamais au chargement : iOS l'exige, et un refus
// réflexe d'une popup surprise est définitif côté navigateur.
//
// Quatre variantes, déterminées APRÈS montage (navigator/Notification/
// localStorage absents côté serveur — même raison que deviceSubscribed dans
// NotificationSettings.tsx, éviter une erreur d'hydratation) :
// - "enable"  : compte jamais passé en push.
// - "device"  : compte en push, mais pas CET appareil (changement de
//               téléphone constaté au test de p3-3 : l'ancien abonnement
//               Apple restait seul en base, rien n'arrivait sur le nouveau).
// - "install" : iPhone/iPad dans Safari — le push n'y existe pas, il faut
//               d'abord ajouter l'app à l'écran d'accueil.
// - "hidden"  : déjà abonné ici, autorisation bloquée (plus redemandable,
//               le Profil explique quoi faire), navigateur non compatible,
//               ou « Plus tard » récent.
//
// « Plus tard » = repli 7 jours sur cet appareil (localStorage, comme les
// autres états « vu » de l'app — pas de colonne serveur pour ça).

type Variant = "hidden" | "enable" | "device" | "install";

const SNOOZE_STORAGE_KEY = "push-prompt-snoozed-until";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function isSnoozed(): boolean {
  try {
    const until = Number(window.localStorage.getItem(SNOOZE_STORAGE_KEY));
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

async function resolveVariant(preference: NotificationPreference): Promise<Variant> {
  if (isSnoozed()) return "hidden";
  if (iosNeedsInstall()) return "install";
  if (!pushSupported() || !("Notification" in window)) return "hidden";
  if (Notification.permission === "denied") return "hidden";

  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) return "hidden";

  if (preference === "PUSH") return "device";
  // EMAIL : canal pas encore ouvert (option désactivée dans le Profil) —
  // jamais choisi en pratique, traité comme NONE.
  return "enable";
}

type PushPromptProps = {
  preference: NotificationPreference;
};

export function PushPrompt({ preference }: PushPromptProps) {
  const [variant, setVariant] = useState<Variant>("hidden");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // setState uniquement dans les callbacks de promesse (règle
    // react-hooks/set-state-in-effect), même patron que NotificationSettings.
    let cancelled = false;
    resolveVariant(preference)
      .then((next) => {
        if (!cancelled) setVariant(next);
      })
      .catch(() => {
        if (!cancelled) setVariant("hidden");
      });
    return () => {
      cancelled = true;
    };
  }, [preference]);

  async function enable() {
    setPending(true);
    setError(null);
    try {
      const result = await ensurePushSubscribed();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setVariant("hidden");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue, réessaie.");
    } finally {
      setPending(false);
    }
  }

  function snooze() {
    try {
      window.localStorage.setItem(SNOOZE_STORAGE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      // Stockage indisponible (navigation privée) : la carte reviendra au
      // prochain chargement, sans gravité.
    }
    setVariant("hidden");
  }

  if (variant === "hidden") return null;

  const title =
    variant === "device" ? "Notifications inactives sur ce téléphone" : "Ne rate plus un match";
  const text =
    variant === "enable"
      ? "Active les rappels pour être prévenu avant la fin des pronos et des paris."
      : variant === "device"
        ? "Elles sont activées sur ton compte, mais pas encore sur cet appareil."
        : "Pour recevoir les rappels sur iPhone, ajoute Panier Ballon à ton écran d'accueil (bouton Partager, puis « Sur l'écran d'accueil ») et ouvre l'app depuis là.";

  return (
    <section className={`${styles.card} glass-card`} aria-label="Notifications">
      <p className={styles.title}>{title}</p>
      <p className={styles.text}>{text}</p>
      <div className={styles.actions}>
        {variant !== "install" && (
          <button type="button" className={styles.primary} disabled={pending} onClick={() => void enable()}>
            {pending ? "Activation…" : variant === "device" ? "Activer ici" : "Activer les notifications"}
          </button>
        )}
        <button type="button" className={styles.secondary} disabled={pending} onClick={snooze}>
          {variant === "install" ? "OK, plus tard" : "Plus tard"}
        </button>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
