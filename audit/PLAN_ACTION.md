# Plan d'action — nba-pronos

*Organisé par vagues, dans l'ordre de dépendance. Aucune action de Vague 0 n'est nécessaire — aucun risque P0 identifié dans cet audit.*

## Vague 0 — Mesures immédiates

**Aucune action requise.** Aucune anomalie de gravité P0 (bloquant) n'a été identifiée. Les deux findings critique/élevé de l'audit sécurité antérieur (clé `service_role` fuitée, service Cloud Run non protégé) sont déjà corrigés et vérifiés indépendamment dans cette session (Phase 7).

---

## Vague 1 — Blocants avant production (sécurité, données, autorisations, fiabilité)

*À traiter avant toute ouverture au-delà du cercle fermé actuel.*

### A1 — Rendre la suppression de compte sûre en cas d'interruption
- **Objectif** : éliminer le risque d'état partiellement supprimé (`DATA-002`).
- **Anomalies traitées** : `DATA-002`.
- **Fichiers probablement concernés** : `lib/actions/account.ts`.
- **Prérequis** : T-DATA-01 (backlog de tests) pour caractériser le comportement actuel avant de corriger.
- **Ordre recommandé** : 1er de la vague (risque de perte de données le plus concret).
- **Effort estimé** : M.
- **Risque** : moyen — toucher un flux de suppression irréversible demande une vérification manuelle soignée avant merge.
- **Stratégie de test** : rejouer T-DATA-01 après correction ; ajouter un test d'intégration qui interrompt le flux à chaque étape et vérifie la cohérence.
- **Critère d'acceptation** : soit l'opération devient rejouable sans effet de bord après une interruption, soit elle est enveloppée dans une fonction SQL `SECURITY DEFINER` atomique (patron déjà utilisé ailleurs dans le projet).
- **Rollback** : réversible (changement de code applicatif uniquement, pas de migration destructive).

### A2 — Rate limiting applicatif de base
- **Objectif** : combler `SEC-001` avant toute ouverture à plus d'utilisateurs.
- **Anomalies traitées** : `SEC-001`.
- **Fichiers concernés** : `lib/actions/chat.ts`, `lib/actions/bets.ts`, `lib/actions/bug-reports.ts`.
- **Prérequis** : aucun.
- **Effort estimé** : S.
- **Risque** : faible.
- **Stratégie de test** : test d'intégration simulant une rafale de requêtes.
- **Critère d'acceptation** : une limite de fréquence raisonnable bloque l'abus sans gêner l'usage normal.
- **Rollback** : trivial (retrait du rate limiter).

### A3 — ~~Vérifier le comportement du micro-service Cloud Run en cas de panne~~ FAIT — vérifié le 03/09/2026, déjà correct
- **Statut** : clos sans code à écrire. Lecture complète de `lib/ai/statsService.ts` (18 fonctions `predict*()`) : URL absente → `null` immédiat, `fetch` sous timeout (20-40s), `!res.ok` → `null`, tout en `try/catch` → exception réseau also `null`. Côté `structureAndScoreBet.ts` : chaque site de consommation vérifie `if (!prediction) { markNotCalculable(); return; }` (vérifié sur les 10 branches), plus un `try/catch` global sur toute la fonction en filet de sécurité (`is_calculable` reste `NULL`, jamais d'exception qui casserait `submitBet`). Détail dans `08-api-et-integrations.md`.
- **Anomalies traitées** : point auparavant ouvert de `08-api-et-integrations.md`, refermé.
- **Reste optionnel** : T-API-01 (`BACKLOG_TESTS.md`) peut être ajouté comme test de non-régression pour figer ce comportement déjà correct, mais n'est plus urgent (rien à découvrir, juste à protéger).
- **Rollback** : N/A (vérification, pas nécessairement un changement de code).

### A4 — Tests d'intégration RLS/permissions minimaux
- **Objectif** : combler `TEST-002`, le point le plus critique de l'audit de tests (le mécanisme de sécurité le plus important du projet n'a aucun filet automatisé).
- **Anomalies traitées** : `TEST-002`.
- **Prérequis** : environnement Supabase local (`supabase start`) disponible en CI.
- **Ordre recommandé** : après A1-A3 (établir d'abord les correctifs, puis les protéger par test).
- **Effort estimé** : L (mise en place de l'infrastructure de test d'intégration, premier investissement).
- **Risque** : faible (ajout de tests, pas de changement de comportement).
- **Stratégie de test** : T-SEC-01 à T-SEC-04.
- **Critère d'acceptation** : les 4 scénarios IDOR/élévation de privilège du backlog de tests sont automatisés et passent en CI.
- **Rollback** : N/A.

### A5 — Résoudre l'ambiguïté du statut `POSTPONED`
- **Objectif** : clarifier le comportement du scoring pour un match reporté (Phase 3).
- **Anomalies traitées** : point ouvert de `03-conformite-fonctionnelle.md`.
- **Fichiers concernés** : `lib/nba/client.ts` (`normalizeMatchStatus`), `lib/scoring/engine.ts`.
- **Effort estimé** : S.
- **Risque** : faible si le comportement actuel s'avère déjà correct après vérification ; moyen si un correctif de scoring est nécessaire (touche une logique déjà en production).
- **Stratégie de test** : T-BIZ-01.
- **Critère d'acceptation** : comportement documenté et testé explicitement.
- **Rollback** : réversible.

---

## Vague 2 — Stabilisation fonctionnelle

### B1 — ~~Revérifier et corriger `BUG-001`~~ FAIT — déjà corrigé le 16/08/2026 (vérifié 03/09/2026)
- **Statut** : clos sans action. Lecture directe de `components/bracket/NodeCard.tsx:143-155` et `SeriesDrillDown.tsx:53-58,240-241` : les deux fichiers portent un commentaire daté du 16/08/2026 décrivant ce bug exact et son correctif (`useLiveSeriesStatus`/`useLiveSeriesMap`, `LiveSeriesSubscriber.tsx` poussant désormais `official_status` en Realtime, pas seulement le vainqueur). Le correctif est antérieur à l'audit du 03/09, qui l'avait recatalogué par erreur comme "non revérifié" faute d'avoir lu ces fichiers en détail.
- **Nuance résiduelle non corrigée** (distincte, gravité mineure) : le score chiffré (nombre de victoires par équipe) reste un instantané SSR non poussé en direct — voir `ANOMALIES.md` (BUG-001) pour le détail. Pas traitée ici, à cadrer séparément si jugé utile.
- **Anomalies traitées** : `BUG-001` (reclassé P4/corrigé dans `ANOMALIES.md`).

### B2 — Injecter une source de roster réelle dans le prompt de structuration IA
- **Objectif** : réduire le taux d'erreur documenté de `BUG-003` (2 erreurs sur 30 testés).
- **Anomalies traitées** : `BUG-003`.
- **Fichiers concernés** : `lib/ai/structureBet.ts` (`buildDynamicSystemText`), 8 schémas dédiés.
- **Prérequis** : identifier la source de données de roster déjà disponible (stats box-score/synchro Highlightly) et sa fraîcheur.
- **Effort estimé** : L (chantier non trivial, déjà signalé comme tel par l'équipe).
- **Risque** : moyen (touche le cœur du pipeline différenciant du produit).
- **Stratégie de test** : rejouer l'échantillon de 30 paris déjà utilisé en interne, vérifier que les 2 erreurs connues sont résolues sans en introduire de nouvelles.
- **Critère d'acceptation** : taux d'erreur de vérification de présence au roster mesuré et réduit.
- **Rollback** : réversible (retour au prompt sans injection de roster).

### B3 — Migrer les 3 implémentations non factorisées de la deadline de pari
- **Objectif** : éliminer `BUG-002`.
- **Fichiers concernés** : `lib/queries/home.ts`, `lib/queries/admin-dashboard.ts` → `lib/scoring/bet-deadline.ts`.
- **Prérequis** : T-BIZ-03 (prouver l'équivalence actuelle avant de fusionner).
- **Effort estimé** : S.
- **Risque** : faible-moyen (touche l'écran d'Accueil, à fort trafic).
- **Critère d'acceptation** : une seule implémentation, les 2 écrans concernés inchangés visuellement.
- **Rollback** : trivial.

### B4 — Alerte externe minimale sur la disponibilité (`OPS-001`)
- **Objectif** : détecter une panne du heartbeat/de l'application avant qu'un utilisateur ne la signale.
- **Anomalies traitées** : `OPS-001`.
- **Effort estimé** : S (service externe gratuit type UptimeRobot sur une route de santé).
- **Risque** : nul.
- **Critère d'acceptation** : une alerte (email) est envoyée si l'application ou le heartbeat est indisponible plus de N minutes.

### B5 — Garde-fou de séquencement migration/déploiement (`OPS-004`)
- **Objectif** : éviter qu'un code déployé suppose un schéma pas encore migré.
- **Effort estimé** : M.
- **Risque** : faible.
- **Critère d'acceptation** : une étape de CI ou une checklist documentée empêche ce scénario.

---

## Vague 3 — Qualité et maintenabilité

### C1 — Suite de tests e2e minimale (parcours critiques)
- **Objectif** : combler `TEST-001`.
- **Fichiers concernés** : nouveau dossier `e2e/` (Playwright).
- **Effort estimé** : L (mise en place initiale), puis S par parcours ajouté.
- **Critère d'acceptation** : T-UI-01, T-UI-02, T-UI-03 automatisés et intégrés en CI.

### C2 — README réel + `.env.example`
- **Objectif** : combler `DOC-001`.
- **Effort estimé** : XS.
- **Critère d'acceptation** : un nouveau contributeur peut cloner et lancer le projet en suivant uniquement le README.

### C3 — Synchroniser les barèmes dupliqués (`ARCH-002`, `ARCH-003`)
- **Objectif** : source de vérité unique pour les barèmes de points.
- **Effort estimé** : S.
- **Critère d'acceptation** : `lib/labels/bets.ts` et `MatchBaremeGrid.tsx` importent les constantes depuis `engine.ts` plutôt que de les recopier.

### C4 — `npm audit` en CI + résolution de `SEC-002`
- **Objectif** : combler `OPS-003` et corriger la dérive `browserslist`.
- **Effort estimé** : XS.
- **Critère d'acceptation** : `npm audit --omit=dev` intégré à `ci.yml`, 0 vulnérabilité "high"/"critical".

### C5 — Bandeau de mise à jour sur `security-audit-report.md` (`DOC-003`)
- **Effort estimé** : XS.

---

## Vague 4 — UX, accessibilité et performance

### D1 — Focus-trap sur `ModalDialog.tsx`
- **Objectif** : combler `UX-001`/contribue à l'accessibilité.
- **Effort estimé** : S.
- **Critère d'acceptation** : `Tab`/`Shift+Tab` reste dans la modale, `Échap` la ferme, focus restauré à la fermeture. Bénéficie automatiquement à tous les dialogues qui réutilisent ce composant.

### D2 — Décision produit sur le responsive desktop (`UX-002`)
- **Objectif** : trancher consciemment plutôt que de laisser un état non choisi.
- **Effort estimé** : décision (pas de code tant que non tranché).

### D3 — `eslint-plugin-jsx-a11y` + correction du contraste `--color-trend`
- **Anomalies traitées** : `A11Y-001`, `A11Y-002`.
- **Effort estimé** : S.

### D4 — Mesure réelle des Web Vitals
- **Effort estimé** : S (outillage), suivi de correctifs si un problème réel est mesuré.

---

## Dépendances entre vagues

- A4 (tests RLS) dépend logiquement d'avoir d'abord stabilisé A1 (suppression de compte) pour ne pas tester un comportement qu'on s'apprête à changer.
- C1 (e2e) bénéficie d'être fait après D1 (focus-trap) pour que T-UI-01 teste un comportement déjà correct plutôt que de documenter un échec connu.
- B3 (factorisation deadline) dépend de T-BIZ-03 (Vague 1 backlog de tests, à exécuter avant le refactor).

Aucune vague ne bloque techniquement la suivante — l'ordre proposé reflète une priorisation par risque, pas une dépendance stricte d'implémentation.
