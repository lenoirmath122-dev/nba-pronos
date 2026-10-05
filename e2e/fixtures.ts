import { test as base, expect } from "@playwright/test";

/** `test` partagé par toutes les specs : désactive la popup « nouveau badge »
 *  (NewBadgesWatcher, p3-9) avant le chargement de chaque page. Elle s'ouvre
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
      } catch {
        // about:blank et autres origines opaques : pas de stockage, rien à couper.
      }
    });
    await provide(page);
  },
});

export { expect };
