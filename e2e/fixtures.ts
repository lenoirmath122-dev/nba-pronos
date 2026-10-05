import { test as base, expect } from "@playwright/test";

/** `test` partagé par toutes les specs : ferme automatiquement la popup
 *  « nouveau badge » (NewBadgesWatcher, p3-9) dès qu'elle bloque une action.
 *  Elle s'ouvre ~800 ms après le montage de la coquille, à un instant non
 *  déterministe, dès qu'un badge gagné n'a pas encore été vu sur l'appareil
 *  -- typiquement pour playerA en mobile-chrome, après que le project
 *  chromium a soumis son pari perso (même compte, localStorage vierge).
 *  Elle n'est l'objet d'aucune spec ici : `addLocatorHandler` la ferme avant
 *  chaque action/assertion qu'elle masquerait, au lieu de laisser son fond
 *  intercepter les clics (CI rouge du 05/10/2026). */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addLocatorHandler(page.locator('[role="dialog"][aria-labelledby="new-badge-title"]'), async (dialog) => {
      await dialog.getByRole("button", { name: /^(OK|Tout passer)$/ }).click();
    });
    await provide(page);
  },
});

export { expect };
