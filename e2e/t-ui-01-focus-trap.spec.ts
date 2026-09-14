import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { SEED_FILE, type E2ESeed } from "./seed";
import { gotoAndWaitReady, matchRow, clickUntilVisible } from "./helpers";

// T-UI-01 (audit/BACKLOG_TESTS.md §7) : navigation clavier complète d'un
// dialogue de confirmation -- Tab/Shift+Tab restent piégés, Échap ferme,
// focus restauré au déclencheur. L'audit citait le dialogue de suppression
// de compte en exemple, mais ce flux n'utilise PAS de <dialog> (juste un
// champ "tape ton pseudo" + bouton, voir app/(app)/profile/page.tsx) --
// substitué par le dialogue de suppression de PARI (DeleteBetButton), un
// des 12 dialogues réels du dépôt corrigés par D1 (components/ui/FocusTrap.tsx),
// même comportement attendu.

let seed: E2ESeed;
test.beforeAll(() => {
  seed = JSON.parse(readFileSync(SEED_FILE, "utf8"));
});

test("le dialogue de suppression de pari piège le focus et se ferme à l'Échap", async ({ page }) => {
  await gotoAndWaitReady(page, "/play");

  const row = matchRow(page, seed.match1.homeTeamName);
  // La carte n'a plus de dépliage (16/09/2026) : le pari DRAFT pré-semé
  // n'apparaît plus automatiquement -- le déclencheur pari (compact, en
  // popup désormais) doit être ouvert explicitement pour révéler le
  // formulaire où vit "Supprimer" (même en mode popup, InlineBetForm ne
  // s'ouvre jamais tout seul au chargement, voir son commentaire de tête).
  await row.getByRole("button", { name: "Modifier le pari" }).click();
  const triggers = page.getByRole("button", { name: "Supprimer", exact: true });
  await expect(triggers).toHaveCount(1, { timeout: 10_000 });
  const trigger = triggers.first();
  const dialog = page.getByRole("alertdialog");
  await clickUntilVisible(trigger, dialog);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Supprimer ce pari ?");

  const cancelButton = dialog.getByRole("button", { name: "Annuler" });
  const confirmButton = dialog.getByRole("button", { name: "Supprimer", exact: true });

  // Focus initial sur le 1er élément focalisable du dialogue.
  await expect(cancelButton).toBeFocused();

  // Tab avance vers le dernier bouton, puis BOUCLE vers le premier --
  // la preuve que le focus reste piégé (sans FocusTrap, un 2e Tab sortirait
  // du dialogue au lieu de revenir sur "Annuler").
  await page.keyboard.press("Tab");
  await expect(confirmButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cancelButton).toBeFocused();

  // Shift+Tab boucle dans l'autre sens.
  await page.keyboard.press("Shift+Tab");
  await expect(confirmButton).toBeFocused();

  // Échap ferme le dialogue et restaure le focus sur le déclencheur.
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Supprimer", exact: true })).toBeFocused();
});
