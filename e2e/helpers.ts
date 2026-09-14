import type { Page, Locator } from "@playwright/test";

/** Navigue et attend le chargement -- PAS "networkidle" : le dev server
 *  Next.js garde une connexion HMR active en permanence, qui empêche
 *  "networkidle" de jamais se résoudre (piège documenté, cause un
 *  timeout complet sur CHAQUE navigation si utilisé ici). Marge fixe
 *  ensuite : sous Turbopack dev, l'événement `load` arrive avant que
 *  l'hydratation React de la page (souvent volumineuse, ex. /play) n'ait
 *  fini de s'exécuter -- sans cette marge, un premier clic natif peut
 *  atteindre le bouton (focus visible) sans que le gestionnaire onClick de
 *  React ne soit encore attaché à ce sous-arbre. */
export async function gotoAndWaitReady(page: Page, path: string) {
  await page.goto(path, { waitUntil: "load" });
  await page.waitForTimeout(800);
}

/** Ligne d'un match sur /play, ciblée par le nom (unique) de son équipe à
 *  domicile -- /play affiche TOUS les matchs de la compétition active à
 *  tout joueur connecté, pas seulement "ses" matchs (voir e2e/seed.ts). */
export function matchRow(page: Page, homeTeamName: string): Locator {
  // Remonte jusqu'à la carte ENTIÈRE via son id stable (`match-<matchId>`,
  // posé sur le conteneur racine par UpcomingRow.tsx), pas un compte de
  // niveaux XPath relatifs (`../..`) -- ça avait cassé silencieusement le
  // 16/09/2026 quand la carte a perdu son dépliage (UpcomingRowForm fusionné
  // dans UpcomingRow.tsx, structure interne changée) : `../..` pointait vers
  // un conteneur qui n'incluait plus les actions (Valider/Brouillon), en
  // dehors de tout test qui l'aurait immédiatement révélé. `ancestor::` reste
  // correct quelle que soit la profondeur d'imbrication interne du bouton
  // équipe.
  return page.getByRole("button", { name: homeTeamName }).locator('xpath=ancestor::*[starts-with(@id, "match-")]');
}

/** Clique `trigger`, en RÉessayant jusqu'à ce que `until` apparaisse --
 *  filet contre une fenêtre d'hydratation React pas encore terminée (le
 *  clic natif Playwright peut atteindre le bouton et le focaliser AVANT que
 *  React n'ait attaché son gestionnaire onClick sur ce sous-arbre, sous
 *  Turbopack dev où chaque route compile/hydrate à la volée -- Playwright ne
 *  peut pas le détecter lui-même, un simple `.click()` ne réessaie donc pas
 *  dans ce cas précis). */
export async function clickUntilVisible(trigger: Locator, until: Locator, attempts = 6) {
  for (let i = 0; i < attempts; i++) {
    await trigger.click();
    try {
      await until.waitFor({ state: "visible", timeout: 1500 });
      return;
    } catch {
      // Pas encore réagi -- retente.
    }
  }
  await until.waitFor({ state: "visible", timeout: 2000 });
}
