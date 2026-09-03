# 12 — Tests et stratégie QA

## 1. Inventaire réel (mesuré)

Commande exécutée : `npx vitest run --reporter=dot`
```
Test Files  18 passed (18)
     Tests  224 passed (224)
  Duration  7.78s
```

**18 fichiers de test, exclusivement `*.test.ts` (aucun `.tsx`)** :
- `lib/scoring/engine.test.ts` — fonctions pures de scoring (dérivation de statut de série, barème pronostic match, barème bracket).
- `lib/scoring/recompute.test.ts` — idempotence du recalcul en cascade (2 exécutions successives = état identique, jamais de score négatif, `CANCELLED` jamais écrasé).
- `lib/ai/resolveCalculableBets.test.ts` + 12 fichiers `resolveCalculableXxxBets.test.ts` (combo, comparaison, roster split/count, superlatif, fautes techniques, dernier panier, blocage sur joueur, événement de jeu, période, stat d'équipe, séries) — cas nominal WON/LOST + garde-fous d'éligibilité (données manquantes, match non terminé, correction en attente).
- `lib/ai/resolveCalculableBets.orchestration.test.ts` — orchestration bout-en-bout avec stats simulées.
- `lib/ai/structureAndScoreBet.test.ts` — routage par mots-clés vers les schémas dédiés.

**Types de tests absents (confirmés par grep/absence de dépendance)** :
- Tests de composants React (Testing Library) : 0 — aucune dépendance `@testing-library/*` dans `package.json`, aucun fichier `*.test.tsx`.
- Tests end-to-end (Playwright/Cypress) : 0 — aucune dépendance, bien que des scripts de vérification Playwright ponctuels soient mentionnés dans le journal interne comme utilisés "en séance" puis **supprimés après usage** (jamais committés, donc jamais reproductibles).
- Tests d'intégration frappant réellement les routes `app/api/*` : 0.
- Tests de policies RLS/permissions : 0 (`TEST-002`).
- Tests de fuseau horaire ou de concurrence réelle : 0 (`TEST-003`).

## 2. Qualité des tests existants

**Points forts** :
- Portent sur la logique la plus critique et la plus à risque de régression silencieuse (scoring, résolution automatique de paris IA) — bon choix de priorisation, pas une couverture arbitraire.
- Le patron "donnée manquante → `null`/`skipped`, jamais un résultat deviné" est vérifié explicitement par les tests des resolvers — protège contre le risque le plus grave de cette fonctionnalité (créditer/débiter un joueur à tort).
- Tests d'idempotence explicites sur le recompute — vérifient une propriété précisément identifiée comme un choix d'architecture compensatoire (Phase 6, absence de transaction SQL).

**Limites** :
- Aucune assertion de type "faux positif" identifiée dans l'échantillon exploré (tests structurés autour de scénarios réalistes, pas de sur-mocking apparent) — **non vérifié exhaustivement** sur les 224 tests un par un.
- Isolation : les tests d'orchestration utilisent un "fake Supabase" en mémoire plutôt qu'une vraie base — bon choix pour la vitesse (7.78s pour 224 tests) et l'absence de dépendance à l'ordre, mais signifie qu'aucun test ne vérifie l'interaction réelle avec les policies RLS/contraintes SQL (recoupé avec `TEST-002`).
- Pas de test intermittent identifié (224/224 verts de façon reproductible dans cette session).

## 3. Matrice des scénarios critiques

| Scénario | Risque | Test existant | Qualité | Test manquant | Priorité |
|---|---|---|---|---|---|
| Permissions par rôle (joueur vs admin) | Élevé | Aucun test automatisé — vérification manuelle documentée uniquement | N/A | Test d'intégration RLS + Server Action forgée par un non-admin | **Haute** |
| Accès à la ressource d'un autre utilisateur (IDOR) | Élevé | Aucun test automatisé — vérifié manuellement "en conditions réelles" au moment du développement de chaque fonctionnalité (ex. ligues) | N/A | Test d'intégration ciblé (édition de pari d'un tiers, accès à un canal de ligue non membre) | **Haute** |
| Scoring des pronostics/bracket | Élevé | `engine.test.ts` | Bonne | Cas `POSTPONED` clarifié le 03/09 (comportement correct) mais toujours sans test dédié explicite | Basse |
| Résolution automatique de paris IA | Élevé | 13 fichiers dédiés | Bonne | Test d'intégration bout-en-bout avec vraie base (actuellement fake) | Moyenne |
| Double soumission / concurrence sur écriture | Moyen | Aucun test automatisé (garde-fou vérifié par lecture de code uniquement) | N/A | Test simulant deux résolutions concurrentes du même pari | Moyenne |
| Erreur réseau / service externe indisponible (Anthropic, Cloud Run, Highlightly) | Moyen | Partiellement — le repli `null` de la structuration IA est couvert indirectement par les tests de resolvers (donnée manquante), pas un test dédié de panne réseau | Faible | Test simulant un timeout/erreur HTTP explicite | Moyenne |
| Session expirée en cours de parcours | Faible-Moyen | Aucun | N/A | Test e2e (session invalidée pendant une soumission de formulaire) | Basse |
| Suppression de compte (cascade, garde-fous) | Élevé | Aucun test automatisé | N/A | Test d'intégration complet du parcours de suppression (garde-fous admin/ligue, cascade, non-transactionnalité — `DATA-002`) | **Haute** |
| Action administrateur (validation, résolution manuelle) | Moyen | Aucun test automatisé | N/A | Test d'intégration du panneau admin critique | Moyenne |
| Fuseau horaire / changement DST | Faible | Aucun | N/A | Test unitaire sur `lib/dates/paris.ts` autour d'un changement d'heure | Basse |
| Rollback / échec partiel (crash en cours de suppression de compte) | Moyen | Aucun | N/A | Lié à `DATA-002` — nécessite d'abord une décision d'architecture (transaction ou reprise) avant de tester | Moyenne |

## 4. CI et garde-fou de merge

- `ci.yml` : lint → typecheck → test → build, séquentiel, bloque sur la première étape en échec.
- Protection de branche `main` documentée comme activée sur GitHub (statut requis = `checks`) — **non vérifiable directement dans le code versionné** (réglage GitHub, pas un fichier du dépôt), attestée uniquement par le journal interne. Un accroc réel a été documenté (protection "Not enforced" sur un dépôt privé en plan gratuit — limite connue de GitHub, résolue par passage à GitHub Pro).
- Résultats réels de cette session : `tsc` propre, `eslint` propre (0 erreur, 5 avertissements dans des scripts hors périmètre applicatif), 224/224 tests verts, build de production réussi.

## Anomalies de cette phase

`TEST-001`, `TEST-002`, `TEST-003` (détaillées dans `ANOMALIES.md`). Le diagnostic global rejoint celui déjà posé par l'équipe elle-même (`BILAN_GLOBAL_01_09_2026.md`) : la fiabilité/QA reste, structurellement, le plus grand écart entre le niveau d'ingénierie du reste du projet et sa robustesse mesurable — même si la situation s'est significativement améliorée depuis le 01/09/2026 (2 fichiers de test à l'époque, 18 aujourd'hui, avec une vraie couverture du pipeline IA qui n'existait pas).

## Limites de cette phase

Le contenu exact et la robustesse individuelle de chacun des 224 tests n'ont pas été relus un par un ligne à ligne dans cette session (volume trop important) — l'évaluation de qualité s'appuie sur un échantillon représentatif (fichiers `engine.test.ts`, `recompute.test.ts`, `resolveCalculableBets.test.ts`, `resolveCalculableBets.orchestration.test.ts` explorés en détail par l'agent dédié) et sur le résultat global d'exécution (224/224 verts, reproductible).
