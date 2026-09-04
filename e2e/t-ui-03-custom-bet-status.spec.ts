import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { SEED_FILE, type E2ESeed } from "./seed";
import { gotoAndWaitReady, matchRow } from "./helpers";

// T-UI-03 (audit/BACKLOG_TESTS.md §7) : soumission d'un pari personnalisé
// texte libre -> vérification du statut. "Avec mock de l'appel Anthropic"
// (spec) -- ici obtenu en lançant le serveur SANS ANTHROPIC_API_KEY
// (playwright.config.ts) : structureBet() retourne alors null IMMÉDIATEMENT
// (aucun appel réseau, voir lib/ai/structureBet.ts) -- c'est le chemin de
// repli "panne" déjà voulu par le code (structureAndScoreBet.ts : "jamais
// bloquant pour la soumission"), pas une simulation du protocole de sortie
// structurée du SDK -- reproduire fidèlement ce protocole aurait ajouté une
// fragilité de test disproportionnée pour un chemin déjà couvert par
// construction. Le pari reste donc SOUMIS (pas auto-validé), ce que ce test
// vérifie -- pas le succès de l'IA elle-même (hors scope ici).

let seed: E2ESeed;
test.beforeAll(() => {
  seed = JSON.parse(readFileSync(SEED_FILE, "utf8"));
});

test("soumission d'un pari personnalisé -> statut SOUMIS", async ({ page }) => {
  await gotoAndWaitReady(page, "/play");

  const row = matchRow(page, seed.match3.homeTeamName);
  // Un seul clic (pas clickUntilVisible) : ce bouton BASCULE (pas
  // idempotent), un retry le refermerait.
  await row.getByRole("button", { name: "Détails du match" }).click();

  // Une fois dépliée, ses contrôles sont les seuls de leur genre visibles
  // (aucune autre ligne ouverte en parallèle) -- locators page-level.
  const trigger = page.getByRole("button", { name: /Proposer un pari/ });
  await expect(trigger).toBeVisible({ timeout: 10_000 });
  await trigger.click();

  await page.getByLabel("Énoncé").fill("Pari e2e -- un joueur marque 20+ points");
  await page.getByRole("button", { name: "Soumettre à validation" }).click();

  // Repli automatique après succès (InlineBetForm) -> le déclencheur redevient
  // visible, changé de "Proposer un pari" à "Modifier le pari" (myBet existe).
  const editTrigger = page.getByRole("button", { name: "Modifier le pari" });
  await expect(editTrigger).toBeVisible();

  // Statut réel : rouvrir montre "Soumettre les modifications" (SUBMITTED),
  // jamais "Soumettre à validation" (qui redeviendrait affiché pour un DRAFT).
  await editTrigger.click();
  await expect(page.getByRole("button", { name: "Soumettre les modifications" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Soumettre à validation" })).toHaveCount(0);
});
