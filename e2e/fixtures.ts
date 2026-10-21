import { test as base, expect } from "@playwright/test";

/** `test` partagé par toutes les specs : désactive la popup « nouveau badge »
 *  (NewBadgesWatcher, p3-9) et la popup hebdo (WeeklyPopupWatcher, lot 5) avant
 *  le chargement de chaque page. La première s'ouvre
 *  ~800 ms après le montage de la coquille, à un instant non déterministe, dès
 *  qu'un badge gagné n'a pas été vu sur l'appareil -- or les specs en font
 *  gagner (pari perso, prono validé). Son fond interceptait alors les clics en
 *  plein scénario (CI rouge du 05/10/2026, T-UI-03 puis T-UI-02) ; un
 *  `addLocatorHandler` ne suffit pas, un clic qui part pile pendant son
 *  apparition est perdu sans que rien ne le signale. Aucune spec ne teste la
 *  popup elle-même. */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("badges-popup:disabled", "1");
        // Popup hebdo (lot 5) : même raison, son fond avale les clics.
        window.localStorage.setItem("weekly-popup:disabled", "1");
        // Récap « depuis ta dernière visite » : même raison.
        window.localStorage.setItem("activity-recap:disabled", "1");
        // Guide d'onboarding (notifications + raccourci écran d'accueil) :
        // visible seulement sur mobile, son fond avale les clics.
        window.localStorage.setItem("onboarding-guide:disabled", "1");
      } catch {
        // about:blank et autres origines opaques : pas de stockage, rien à couper.
      }
    });
    await provide(page);
  },
});

export { expect };
