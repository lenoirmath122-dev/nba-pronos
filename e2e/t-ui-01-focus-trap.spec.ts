import { readFileSync } from "node:fs";
import { test, expect } from "./fixtures";
import { SEED_FILE, type E2ESeed } from "./seed";
import { gotoAndWaitReady, matchRow, clickUntilVisible } from "./helpers";

// T-UI-01 (audit/BACKLOG_TESTS.md §7) : navigation clavier complète d'un
// dialogue de confirmation -- Tab/Shift+Tab restent piégés, Échap ferme,
// focus restauré au déclencheur. L'audit citait le dialogue de suppression
// de compte en exemple, mais ce flux n'utilise PAS de <dialog> (juste un
// champ "tape ton pseudo" + bouton, voir app/(app)/profile/page.tsx) --
// substitué par un des dialogues réels du dépôt corrigés par D1
// (components/ui/FocusTrap.tsx), même comportement attendu. D'abord celui de
// suppression de PARI (DeleteBetButton), disparu de /play avec la zone
// « Mon pari » (22/10/2026) ; désormais la confirmation « Valider ce prono ? »
// (ValidateConfirmDialog) de la carte match1. Jamais confirmée par le test :
// rien n'est enregistré, rejouable par plusieurs projects sans conflit.

let seed: E2ESeed;
test.beforeAll(() => {
  seed = JSON.parse(readFileSync(SEED_FILE, "utf8"));
});

test("le dialogue de validation de prono piège le focus et se ferme à l'Échap", async ({ page }) => {
  await gotoAndWaitReady(page, "/play");

  // Prono complet (vainqueur + écart) pour que "Valider le prono" soit actif
  // -- même saisie que T-UI-02.
  const row = matchRow(page, seed.match1.homeTeamName);
  const increaseMargin = row.getByRole("button", { name: "Augmenter l'écart" });
  await clickUntilVisible(row.getByRole("button", { name: seed.match1.homeTeamName }), increaseMargin);
  await increaseMargin.click();

  const trigger = row.getByRole("button", { name: "Valider le prono" });
  const dialog = page.getByRole("alertdialog");
  await clickUntilVisible(trigger, dialog);
  await expect(dialog).toContainText("Valider ce prono ?");

  // Brouillon jamais enregistré -> variante à 3 boutons.
  const backButton = dialog.getByRole("button", { name: "Retour" });
  const draftButton = dialog.getByRole("button", { name: "Enregistrer le brouillon" });
  const confirmButton = dialog.getByRole("button", { name: "Valider définitivement" });

  // Focus initial sur le 1er élément focalisable du dialogue.
  await expect(backButton).toBeFocused();

  // Tab avance jusqu'au dernier bouton, puis BOUCLE vers le premier --
  // la preuve que le focus reste piégé (sans FocusTrap, le Tab suivant
  // sortirait du dialogue au lieu de revenir sur "Retour").
  await page.keyboard.press("Tab");
  await expect(draftButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(confirmButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(backButton).toBeFocused();

  // Shift+Tab boucle dans l'autre sens.
  await page.keyboard.press("Shift+Tab");
  await expect(confirmButton).toBeFocused();

  // Échap ferme le dialogue et restaure le focus sur le déclencheur.
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
