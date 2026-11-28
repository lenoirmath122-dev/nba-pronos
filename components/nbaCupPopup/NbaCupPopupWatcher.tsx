"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ModalDialog } from "@/components/ui/ModalDialog";
import { useIsValidatedDialogOpen } from "@/components/ui/ValidatedDialog";
import {
  useIsOnboardingGuideOpen,
  useSetNbaCupPopupOpen,
} from "@/components/weeklyPopup/WeeklyPopupProvider";
import { getMyNbaCupPopup } from "@/lib/actions/nba-cup-popup";
import type { NbaCupPopupAudience, NbaCupPopupState } from "@/lib/nbaCupPopup/eligibility";
import {
  NBA_CUP_POPUP_DISABLED_KEY,
  closedStorageKey,
  formatTimeLeft,
  isNbaCupPopupHidden,
  nextParisMidnightMs,
  snoozeStorageKey,
} from "@/lib/nbaCupPopup/dismissal";
import styles from "./NbaCupPopup.module.css";

// Popup « Remplis ton bracket NBA Cup » (chantier du 28/11/2026,
// Cadrage/Suivi/chantiers/CHANTIER_POPUP_NBA_CUP.md). Montée dans la zone
// joueur (connecté et invité) et sur l'accueil public. À chaque ouverture de
// l'appli tant que le bracket n'est pas complet, jusqu'à la date limite.
//
// Même cycle que WeeklyPopupWatcher : lecture par action serveur 800 ms après
// le montage (ni la coquille ni le rendu SEO de l'accueil ne l'attendent).
// Ordre : « Pari validé » → guide d'arrivée → NBA Cup → popup hebdo → récap →
// badges (WeeklyPopupProvider). « Vu » côté client seulement (dismissal.ts).

const INITIAL_DELAY_MS = 800;
const TICK_MS = 30_000;
const BRACKET_HREF = "/play/bracket";

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function hiddenFor(audience: NbaCupPopupAudience): boolean {
  return isNbaCupPopupHidden({
    disabled: readLocal(NBA_CUP_POPUP_DISABLED_KEY) === "1",
    snoozedUntil: readLocal(snoozeStorageKey(audience)),
    closedThisSession: readSession(closedStorageKey(audience)) === "1",
    nowMs: Date.now(),
  });
}

function rememberClosedThisSession(audience: NbaCupPopupAudience) {
  try {
    window.sessionStorage.setItem(closedStorageKey(audience), "1");
  } catch {
    // Stockage indisponible : au pire la popup revient, sans gravité.
  }
}

function snoozeUntilTomorrow(audience: NbaCupPopupAudience) {
  try {
    window.localStorage.setItem(snoozeStorageKey(audience), String(nextParisMidnightMs(Date.now())));
  } catch {
    // Idem.
  }
}

export function NbaCupPopupWatcher() {
  const [pending, setPending] = useState<NbaCupPopupState | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const validatedDialogOpen = useIsValidatedDialogOpen();
  const onboardingOpen = useIsOnboardingGuideOpen();
  const setProviderOpen = useSetNbaCupPopupOpen();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const check = useCallback(async () => {
    if (readLocal(NBA_CUP_POPUP_DISABLED_KEY) === "1") {
      setProviderOpen(false);
      return;
    }
    let result: NbaCupPopupState | null = null;
    try {
      result = await getMyNbaCupPopup();
    } catch {
      result = null;
    }
    // Déjà sur l'écran du bracket : inutile de l'y inviter.
    const onBracket = pathnameRef.current?.startsWith(BRACKET_HREF) ?? false;
    if (!result || onBracket || hiddenFor(result.audience)) {
      setProviderOpen(false);
      return;
    }
    setNowMs(Date.now());
    setPending(result);
  }, [setProviderOpen]);

  useEffect(() => {
    const initial = window.setTimeout(() => void check(), INITIAL_DELAY_MS);
    return () => window.clearTimeout(initial);
  }, [check]);

  // Compte à rebours : une mise à jour toutes les 30 s suffit (minutes).
  useEffect(() => {
    if (!pending) return;
    const id = window.setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [pending]);

  const close = useCallback(
    (mode: "session" | "tomorrow") => {
      if (pending) {
        rememberClosedThisSession(pending.audience);
        if (mode === "tomorrow") snoozeUntilTomorrow(pending.audience);
      }
      setPending(null);
      setProviderOpen(false);
    },
    [pending, setProviderOpen]
  );

  if (!pending || validatedDialogOpen || onboardingOpen) return null;
  const remainingMs = Date.parse(pending.deadline) - nowMs;
  if (remainingMs <= 0) return null;

  const isUser = pending.audience === "user";
  const started = isUser && pending.filled > 0;

  return (
    <ModalDialog title="NBA Cup : le bracket est ouvert" onClose={() => close("session")}>
      <div className={styles.card}>
        <div className={styles.hero}>
          <CupVisual />
          <div className={styles.heroText}>
            <p className={styles.kicker}>NBA Cup 2026</p>
            <p className={styles.headline}>
              {started ? "Termine ton bracket" : isUser ? "Remplis ton bracket" : "Joue le bracket de la Cup"}
            </p>
            <p className={styles.countdown}>
              Fermeture dans <strong>{formatTimeLeft(remainingMs)}</strong>
            </p>
          </div>
        </div>

        {started ? (
          <div className={styles.progress}>
            <p className={styles.text}>
              <strong>
                {pending.filled}/{pending.total} séries remplies
              </strong>
              , termine-le avant le premier coup d&apos;envoi.
            </p>
            <div
              className={styles.bar}
              role="progressbar"
              aria-label="Avancement du bracket"
              aria-valuemin={0}
              aria-valuemax={pending.total}
              aria-valuenow={pending.filled}
            >
              <span style={{ width: `${(pending.filled / pending.total) * 100}%` }} />
            </div>
          </div>
        ) : (
          <p className={styles.text}>
            {isUser
              ? `Pronostique les ${pending.total} matchs de la phase finale, des quarts à la finale, avant le premier coup d'envoi.`
              : `Crée ton compte gratuit et pronostique les ${pending.total} matchs de la phase finale, des quarts à la finale.`}
          </p>
        )}

        <div className={styles.prize}>
          {/* Pas de montant sur la popup (demande de l'utilisateur, 28/11/2026) : il est dans le règlement. */}
          <p className={styles.prizeTitle}>À gagner : deux cartes cadeaux</p>
          <p className={styles.prizeText}>
            Une pour le meilleur bracket, une pour le meilleur pronostiqueur des matchs de la Cup. Gratuit, sans
            achat.
          </p>
          <Link href="/reglement-nba-cup" className={styles.prizeLink} onClick={() => close("session")}>
            Lire le règlement
          </Link>
        </div>

        <div className={styles.actions}>
          <Link href={isUser ? BRACKET_HREF : "/signup"} className={styles.primary} onClick={() => close("session")}>
            {isUser ? (started ? "Terminer mon bracket" : "Remplir mon bracket") : "Créer mon compte"}
          </Link>
          <button type="button" className={styles.secondary} onClick={() => close("tomorrow")}>
            Me rappeler plus tard
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}

// Visuel maison (pas de logo officiel) : coupe stylisée sur un mini-bracket.
function CupVisual() {
  return (
    <svg className={styles.visual} viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <g className={styles.bracketLines} fill="none" strokeWidth="3" strokeLinecap="round">
        <path d="M6 22h12v18h8M6 58h12V40M90 22H78v18h-8M90 58H78V40" />
        <path d="M6 74h10M90 74H80" opacity="0.5" />
      </g>
      <g className={styles.cup}>
        <path d="M32 18h32v14c0 11-7 20-16 20s-16-9-16-20z" />
        <path
          d="M32 22h-6c0 9 4 14 9 15M64 22h6c0 9-4 14-9 15"
          fill="none"
          strokeWidth="3.5"
          strokeLinecap="round"
          className={styles.cupHandles}
        />
        <rect x="44" y="51" width="8" height="12" rx="2" />
        <rect x="35" y="63" width="26" height="7" rx="2" />
        <rect x="31" y="70" width="34" height="8" rx="2.5" />
      </g>
      <path className={styles.shine} d="M38 23c0 9 3 15 7 19" fill="none" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
