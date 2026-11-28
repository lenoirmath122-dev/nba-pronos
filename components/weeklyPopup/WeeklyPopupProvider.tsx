"use client";

import { createContext, useContext, useState } from "react";

// État « la popup hebdo occupe l'écran » (lot 5, PR 5), lu par
// NewBadgesWatcher pour passer APRÈS elle (ordre : « Pari validé », popup
// hebdo, badges). Vrai dès le montage et pendant le chargement : sans cela, si
// les badges répondent avant la popup hebdo, leur popup s'afficherait puis
// serait masquée (scintillement). Le watcher le repasse à faux dès qu'il sait
// qu'il n'y a rien à montrer, ou à la fermeture.

const OpenContext = createContext(false);
const SetOpenContext = createContext<(open: boolean) => void>(() => {});
// Même mécanique pour la popup « depuis ta dernière visite » (récap), qui
// passe juste après la popup hebdo et avant les badges.
const RecapOpenContext = createContext(false);
const SetRecapOpenContext = createContext<(open: boolean) => void>(() => {});
// Popup NBA Cup (chantier du 28/11/2026) : passe AVANT la popup hebdo, et
// APRÈS le guide d'arrivée (choix de l'utilisateur pour un compte neuf).
// Mêmes conventions : vrai dès le montage, repassé à faux quand il n'y a rien
// à montrer ou à la fermeture. Hors provider (invité, accueil public), les
// valeurs par défaut (faux, setter vide) laissent la popup NBA Cup seule.
const NbaCupOpenContext = createContext(false);
const SetNbaCupOpenContext = createContext<(open: boolean) => void>(() => {});
const OnboardingOpenContext = createContext(false);
const SetOnboardingOpenContext = createContext<(open: boolean) => void>(() => {});

export function WeeklyPopupProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const [recapOpen, setRecapOpen] = useState(true);
  const [nbaCupOpen, setNbaCupOpen] = useState(true);
  const [onboardingOpen, setOnboardingOpen] = useState(true);
  return (
    <SetOnboardingOpenContext.Provider value={setOnboardingOpen}>
      <OnboardingOpenContext.Provider value={onboardingOpen}>
        <SetNbaCupOpenContext.Provider value={setNbaCupOpen}>
          <NbaCupOpenContext.Provider value={nbaCupOpen}>
            <SetOpenContext.Provider value={setOpen}>
              {/* Récap et badges lisent ce drapeau : ils attendent donc aussi la popup NBA Cup. */}
              <OpenContext.Provider value={open || nbaCupOpen}>
                <SetRecapOpenContext.Provider value={setRecapOpen}>
                  <RecapOpenContext.Provider value={recapOpen}>{children}</RecapOpenContext.Provider>
                </SetRecapOpenContext.Provider>
              </OpenContext.Provider>
            </SetOpenContext.Provider>
          </NbaCupOpenContext.Provider>
        </SetNbaCupOpenContext.Provider>
      </OnboardingOpenContext.Provider>
    </SetOnboardingOpenContext.Provider>
  );
}

export function useIsWeeklyPopupOpen(): boolean {
  return useContext(OpenContext);
}

export function useSetWeeklyPopupOpen(): (open: boolean) => void {
  return useContext(SetOpenContext);
}

export function useIsRecapOpen(): boolean {
  return useContext(RecapOpenContext);
}

export function useSetRecapOpen(): (open: boolean) => void {
  return useContext(SetRecapOpenContext);
}

/** Popup NBA Cup à l'écran (ou pas encore résolue) : la popup hebdo attend. */
export function useIsNbaCupPopupOpen(): boolean {
  return useContext(NbaCupOpenContext);
}

export function useSetNbaCupPopupOpen(): (open: boolean) => void {
  return useContext(SetNbaCupOpenContext);
}

/** Guide d'arrivée à l'écran (ou pas encore résolu) : la popup NBA Cup attend. */
export function useIsOnboardingGuideOpen(): boolean {
  return useContext(OnboardingOpenContext);
}

export function useSetOnboardingGuideOpen(): (open: boolean) => void {
  return useContext(SetOnboardingOpenContext);
}
