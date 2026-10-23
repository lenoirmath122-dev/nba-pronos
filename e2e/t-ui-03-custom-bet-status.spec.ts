import { readFileSync } from "node:fs";
import { test, expect } from "./fixtures";
import { SEED_FILE, type E2ESeed } from "./seed";
import { gotoAndWaitReady, matchRow } from "./helpers";
import type { E2EBrowserProject } from "./projects";

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

test("soumission d'un pari personnalisé -> statut SOUMIS", async ({ page }, testInfo) => {
  // match3 est DISTINCT par project (voir seed.ts) : ce test soumet un
  // pari, une mutation serveur permanente, pas rejouable à l'identique
  // contre le même match par 2 projects qui partagent le même serveur/DB.
  const match3 = seed.match3[testInfo.project.name as E2EBrowserProject];

  await gotoAndWaitReady(page, "/play");

  const row = matchRow(page, match3.homeTeamName);
  // Zone « Mon pari » (MatchBetZone, 22/10/2026) : la saisie se fait
  // directement sur la carte, plus de popup -- tout reste scopé à `row`.
  const description = "Pari e2e -- un joueur marque 20+ points";
  const textarea = row.getByLabel("Mon pari");
  await expect(textarea).toBeVisible({ timeout: 10_000 });
  await textarea.fill(description);
  await row.getByRole("button", { name: "Soumettre", exact: true }).click();

  // Succès -> la zone passe en lecture : énoncé affiché, plus de champ de
  // saisie, accès aux paris des autres.
  await expect(row.getByText(description, { exact: true })).toBeVisible();
  await expect(row.getByLabel("Mon pari")).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Voir les paris des autres" })).toBeVisible();

  // Statut réel : "En attente" (SUBMITTED, en attente d'un admin), jamais
  // "Validé" -- sans ANTHROPIC_API_KEY le pari n'est pas auto-validé.
  await expect(row.getByText("En attente", { exact: true })).toBeVisible();
  await expect(row.getByText("Validé", { exact: true })).toHaveCount(0);
});
