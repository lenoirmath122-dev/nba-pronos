"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { GUEST_PHOTO_THEME_SCRIPT, applyGuestPhotoTheme } from "./guestPhotoThemeScript";

const noopSubscribe = () => () => {};

// Fond photo de l'invité. Chargement complet : le script en ligne (HTML
// serveur) le pose avant le premier affichage, sans éclair du fond sombre.
// Navigation cliente : React n'exécute pas un <script> créé côté client (et
// avertit), donc on ne le rend qu'à l'hydratation et l'effet prend le relais.
export function GuestPhotoTheme() {
  const hydrating = useSyncExternalStore(noopSubscribe, () => false, () => true);
  useLayoutEffect(() => {
    applyGuestPhotoTheme();
  }, []);
  return hydrating ? <script dangerouslySetInnerHTML={{ __html: GUEST_PHOTO_THEME_SCRIPT }} /> : null;
}
