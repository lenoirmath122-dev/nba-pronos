// Noms des projects Playwright qui exécutent RÉELLEMENT des specs (donc PAS
// "setup", qui n'a aucun test) -- source unique partagée par
// playwright.config.ts (les noms doivent y matcher exactement) et seed.ts
// (un match2/match3 DISTINCT par project, voir seed.ts pour le pourquoi).
export const E2E_BROWSER_PROJECTS = ["chromium", "mobile-chrome"] as const;
export type E2EBrowserProject = (typeof E2E_BROWSER_PROJECTS)[number];
