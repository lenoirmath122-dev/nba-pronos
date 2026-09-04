import { readFileSync } from "node:fs";
import { test as setup, expect } from "@playwright/test";
import { SEED_FILE, type E2ESeed } from "./seed";

const STORAGE_STATE_PATH = `${__dirname}/.auth/player-a.json`;

// Connexion RÉELLE via le formulaire /login (une fois), état de session
// sauvegardé pour T-UI-01/T-UI-03 -- ces deux specs testent autre chose que
// la connexion elle-même, T-UI-02 la teste en direct séparément et ne
// réutilise pas cet état.
setup("authenticate as playerA", async ({ page }) => {
  const seed: E2ESeed = JSON.parse(readFileSync(SEED_FILE, "utf8"));

  await page.goto("/login");
  await page.getByLabel("Email").fill(seed.playerA.email);
  await page.getByLabel("Mot de passe").fill(seed.playerA.password);
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page).toHaveURL(/\/home$/);
  await page.context().storageState({ path: STORAGE_STATE_PATH });
});
