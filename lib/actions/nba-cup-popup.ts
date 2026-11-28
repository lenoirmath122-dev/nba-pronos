"use server";

import { getNbaCupPopupState } from "@/lib/queries/nbaCupPopup";
import type { NbaCupPopupState } from "@/lib/nbaCupPopup/eligibility";

// Lue par NbaCupPopupWatcher après le montage (même cycle que la popup
// hebdo) : la coquille et l'accueil public ne l'attendent jamais. Lecture
// seule ; la session (ou son absence) est relue côté serveur.
export async function getMyNbaCupPopup(): Promise<NbaCupPopupState | null> {
  try {
    return await getNbaCupPopupState();
  } catch {
    return null;
  }
}
