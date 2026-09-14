import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { SEED_FILE, type E2ESeed } from "./seed";
import { gotoAndWaitReady, matchRow } from "./helpers";
import type { E2EBrowserProject } from "./projects";

// T-ERR-02 (audit/BACKLOG_TESTS.md §6, feuille de route p1-4) : session
// expirée pendant la soumission d'un formulaire -- vérifier le message
// d'erreur affiché et l'absence de perte de saisie. Simulée en vidant les
// cookies du contexte juste avant de soumettre (jamais d'attente réelle
// d'expiration JWT) : la Server Action (submitBet -> callSaveBet,
// lib/actions/bets.ts) voit alors `supabase.auth.getUser()` renvoyer
// `null`, exactement comme une session réellement expirée/invalidée, et
// retombe sur le même message ("Tu dois être connecté.") que tout autre
// appelant non authentifié de ce fichier -- pas une simulation exhaustive du
// cycle de vie JWT, mais le même point de sortie côté serveur.
// InlineBetForm (components/bets/InlineBetForm.tsx) ne vide `description`
// QUE sur succès (`setIsOpen(false)` seulement dans la branche `success`) --
// une erreur se contente d'un `setError(result.error)`, la saisie reste donc
// intacte par construction ; ce test fige ce comportement plutôt que de le
// découvrir par lecture de code.

let seed: E2ESeed;
test.beforeAll(() => {
  seed = JSON.parse(readFileSync(SEED_FILE, "utf8"));
});

test("session expirée pendant la soumission d'un pari -> message d'erreur, saisie conservée", async ({
  page,
}, testInfo) => {
  const match4 = seed.match4[testInfo.project.name as E2EBrowserProject];
  const description = "Pari e2e -- saisie qui ne doit pas se perdre";

  await gotoAndWaitReady(page, "/play");

  // La carte n'a plus de dépliage (16/09/2026) : le déclencheur pari est
  // TOUJOURS monté, mais désormais un par carte -- scopé à `row`, plutôt que
  // page-level, puisque chaque match affiche le sien simultanément.
  const row = matchRow(page, match4.homeTeamName);
  const trigger = row.getByRole("button", { name: /Proposer un pari/ });
  await expect(trigger).toBeVisible({ timeout: 10_000 });
  await trigger.click();

  const textarea = page.getByLabel("Énoncé");
  await textarea.fill(description);

  // Simule la session qui a expiré/a été invalidée entre le chargement de la
  // page et ce clic -- le prochain appel serveur (Server Action) partira
  // sans aucun cookie de session.
  await page.context().clearCookies();

  await page.getByRole("button", { name: "Soumettre à validation" }).click();

  // getByRole("alert") seul matcherait aussi le route-announcer interne de
  // Next.js (`#__next-route-announcer__`, toujours présent et role="alert")
  // -- filtré ici sur le texte réel du message d'erreur d'InlineBetForm.
  const alert = page.getByRole("alert").filter({ hasText: "Tu dois être connecté." });
  await expect(alert).toBeVisible();

  // La saisie n'a pas disparu -- ni vidée, ni le formulaire refermé (repli
  // automatique réservé au succès dans InlineBetForm).
  await expect(textarea).toHaveValue(description);
  await expect(page.getByRole("button", { name: "Soumettre à validation" })).toBeVisible();
});
