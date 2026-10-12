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

export function WeeklyPopupProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <SetOpenContext.Provider value={setOpen}>
      <OpenContext.Provider value={open}>{children}</OpenContext.Provider>
    </SetOpenContext.Provider>
  );
}

export function useIsWeeklyPopupOpen(): boolean {
  return useContext(OpenContext);
}

export function useSetWeeklyPopupOpen(): (open: boolean) => void {
  return useContext(SetOpenContext);
}
