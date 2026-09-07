import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { SEED_FILE, type E2ESeed } from "./seed";
import { gotoAndWaitReady, clickUntilVisible } from "./helpers";
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

  // Tap sur le logo du vainqueur (nom unique à ce match) : choisit ET
  // déplie la ligne (même tap, comportement voulu -- voir
  // components/play/UpcomingRow.tsx). Une fois dépliée, ses contrôles
  // (écart, "Valider le prono"...) sont les SEULS de leur genre visibles
  // sur la page -- aucune autre ligne n'est ouverte en parallèle.
  const increaseMargin = page.getByRole("button", { name: "Augmenter l'écart" });
  await clickUntilVisible(page.getByRole("button", { name: match2.homeTeamName }), increaseMargin);

  // 3 taps sur "Augmenter l'écart" -> écart de 3 (part de null).
  await increaseMargin.click();
  await increaseMargin.click();
  await increaseMargin.click();

  const dialog = page.getByRole("alertdialog");
  await clickUntilVisible(page.getByRole("button", { name: "Valider le prono" }), dialog);
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
