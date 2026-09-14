import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { SEED_FILE, type E2ESeed } from "./seed";
import { gotoAndWaitReady, clickUntilVisible, matchRow } from "./helpers";
import type { E2EBrowserProject } from "./projects";

// T-UI-02 (audit/BACKLOG_TESTS.md §7) : parcours critique de bout en bout
// -- connexion → soumission d'un pronostic → déconnexion. Contrairement à
// T-UI-01/T-UI-03, la connexion elle-même EST ce qui est testé ici, donc
// pas de storageState réutilisé (voir e2e/auth.setup.ts) -- état de
// session repartant de zéro pour ce fichier.
test.use({ storageState: { cookies: [], origins: [] } });

let seed: E2ESeed;
test.beforeAll(() => {
  seed = JSON.parse(readFileSync(SEED_FILE, "utf8"));
});

test("connexion -> soumission d'un pronostic -> déconnexion", async ({ page }, testInfo) => {
  // match2 est DISTINCT par project (voir seed.ts) : ce test valide un
  // pari, une mutation serveur permanente, pas rejouable à l'identique
  // contre le même match par 2 projects qui partagent le même serveur/DB.
  const match2 = seed.match2[testInfo.project.name as E2EBrowserProject];

  await gotoAndWaitReady(page, "/login");
  await page.getByLabel("Email").fill(seed.playerB.email);
  await page.getByLabel("Mot de passe").fill(seed.playerB.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/home$/);

  await gotoAndWaitReady(page, "/play");

  // Tap sur le logo du vainqueur (nom unique à ce match) : choisit le
  // vainqueur -- la carte n'a plus de dépliage (16/09/2026), son contenu est
  // toujours affiché. Le stepper "Augmenter l'écart" et les actions
  // "Valider le prono"/"Enregistrer le brouillon" n'apparaissent qu'une fois
  // ce choix fait, mais chaque carte porte les siens : locators scopés à
  // `row`, pas page-level (plusieurs matchs sont visibles simultanément).
  const row = matchRow(page, match2.homeTeamName);
  const increaseMargin = row.getByRole("button", { name: "Augmenter l'écart" });
  await clickUntilVisible(row.getByRole("button", { name: match2.homeTeamName }), increaseMargin);

  // 3 taps sur "Augmenter l'écart" -> écart de 3 (part de null).
  await increaseMargin.click();
  await increaseMargin.click();
  await increaseMargin.click();

  const dialog = page.getByRole("alertdialog");
  await clickUntilVisible(row.getByRole("button", { name: "Valider le prono" }), dialog);
  await expect(dialog).toContainText("Valider ce prono ?");
  await dialog.getByRole("button", { name: "Valider définitivement" }).click();

  await expect(dialog).not.toBeVisible();
  // La ligne se replie après validation -- récap compact dans le bouton
  // "Détails du match" ("✓ E2H +3", abréviation qui varie par project
  // depuis que match2 est distinct -- voir seed.ts), pas le texte "Ton
  // prono : ..." de la vue dépliée (UpcomingRowForm, jamais réaffichée ici).
  const recapRegex = new RegExp(`✓\\s*${match2.homeTeamAbbreviation}\\s*\\+3`);
  await expect(page.getByText(recapRegex)).toBeVisible();

  await gotoAndWaitReady(page, "/profile");
  await page.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
