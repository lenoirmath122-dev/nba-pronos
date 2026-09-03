# 05 — Qualité du code

## 1. Outils exécutés (lecture seule, aucune modification)

| Commande | Résultat | Interprétation |
|---|---|---|
| `npx tsc --noEmit` | Aucune erreur (sortie vide hors bruit npm) | Le typage TypeScript compile intégralement sans erreur sur tout le dépôt. |
| `npx eslint .` | 0 erreur, 5 avertissements — tous dans `scripts/*.mjs` (`hoursFromNow` non utilisé, 4 constantes assignées mais non utilisées dans `seed-playoffs-simulation.mjs`) | Aucun avertissement dans `app/`, `components/`, ou `lib/` — le code applicatif est propre selon la config ESLint actuelle. Les scripts utilitaires ponctuels (seed/simulation) sont moins soignés, cohérent avec leur usage jetable. |
| `npx vitest run --reporter=dot` | 224 tests passés / 224, 18 fichiers, 0 échec, 7.78s | Voir `12-tests-et-strategie-qa.md` pour l'analyse de couverture — tous les tests existants sont au vert. |
| `npm run build` (production) | Build réussi en ~30s (compilation 14s + typecheck 15.9s + génération 46 pages statiques), 0 erreur | Voir `11-performances.md`. |
| `npm audit` / `npm audit --omit=dev` | 1 vulnérabilité "high" (dev-only, `browserslist`) / 0 vulnérabilité en production | Voir `SEC-002`. |

**Aucun outil d'analyse statique supplémentaire** (SonarQube, `madge` pour dépendances circulaires, `depcheck` pour dépendances inutilisées, `knip` pour code mort) n'est configuré dans le projet — non exécuté dans cet audit (non installé, installation d'un nouvel outil jugée hors périmètre d'un audit read-only sans accord préalable).

## 2. Bugs logiques / conditions incorrectes

Aucun bug logique actif de cette catégorie identifié par lecture directe dans les modules explorés en profondeur (`lib/scoring/*`, `lib/ai/resolveCalculable*`, fonctions SQL `SECURITY DEFINER`). `BUG-001` (désynchronisation d'état live sur le Bracket), initialement noté "non revérifié", s'est avéré déjà corrigé le 16/08/2026 lors d'une vérification directe du code le 03/09/2026 — voir `ANOMALIES.md`.

## 3. Valeurs nulles / promesses non attendues / erreurs asynchrones

- **Gestion de `null`/absence de donnée** : patron systématiquement rigoureux dans `lib/ai/resolveCalculable*.ts` — "donnée manquante → résultat `null`/`skipped`, jamais une résolution devinée par défaut" (vérifié sur plusieurs resolvers, cohérent avec les tests correspondants).
- **Promesses non attendues** : non identifiées dans les fichiers explorés en détail ; **non vérifié exhaustivement** sur l'ensemble des ~150 fichiers `.ts`/`.tsx` du dépôt (limite de cet audit — un outil type `eslint-plugin-promise` avec la règle `no-floating-promises` n'est pas configuré, ce qui aurait permis une vérification automatique complète).
- **Erreurs asynchrones dans le pipeline IA** : capturées explicitement par des `try/catch` à chaque étage (`structureBet.ts`, `structureAndScoreBet.ts`), avec repli documenté (`null`/mécanisme manuel) plutôt qu'une exception non gérée qui remonterait jusqu'à l'utilisateur.

## 4. Race conditions / doubles soumissions

- **Doubles soumissions UI** : vérifié systématiquement empêchées sur les formulaires audités (bouton `disabled` piloté par `pending`/`isPending` de React 19, sur `LoginForm`, `SignupForm`, `BetForm`, `ChatComposer`, `BugReportButton`, `DeleteBetButton`).
- **Race conditions serveur** : traitées explicitement dans les fonctions `SECURITY DEFINER` (re-scoping `WHERE`, `pg_advisory_xact_lock`) et dans la résolution automatique de paris (condition `.eq("status","VALIDATED")` + vérification de ligne affectée). Le point faible identifié est la suppression de compte (`DATA-002`), non protégée par ces mêmes garanties.

## 5. Dates et fuseaux horaires

Bonne pratique générale : toutes les colonnes DB en `timestamptz` (vérifié exhaustivement, Phase 6), deux modules dédiés et cloisonnés par usage (`lib/dates/newyork.ts` pour l'API externe, `lib/dates/paris.ts` pour l'UI), calcul dynamique de l'offset DST plutôt qu'une constante codée en dur. Aucune confusion identifiée entre les deux usages. Un risque documenté en commentaire mais non testé automatiquement : le décalage entre l'heure UTC du cron `sync-schedule` (8h00 UTC) et l'heure française réelle selon la saison DST (`TEST-003`).

## 6. Erreurs d'arrondi / comparaisons fragiles

Non identifié comme un risque dans les modules de scoring explorés (arithmétique entière sur des points, pas de calcul flottant sensible constaté dans `engine.ts`). Le calcul de probabilités (micro-service Python, hors périmètre TypeScript de cet audit) n'a pas été vérifié pour ce risque — **hors périmètre direct** (service séparé, code Python non audité en détail dans cette session).

## 7. Parsing non sécurisé / exceptions silencieuses / blocs catch vides

- **Aucun bloc `catch` vide** identifié dans les modules explorés — chaque `catch` rencontré journalise a minima côté serveur (`console.error`) avant de décider du repli.
- **Parsing JSON de la sortie IA** : contraint par schéma Zod strict (`zodOutputFormat`), pas un `JSON.parse` non validé — un JSON malformé ou hors schéma est rejeté proprement (repli `null`), pas une exception qui remonterait.
- **Logs contenant des informations sensibles** : confirmé absent par l'audit de sécurité du 29/08 (grep exhaustif `console.log/error/warn`, aucune trace de token/mot de passe/secret) — non contredit par l'exploration de cette session.

## 8. Code inaccessible / code mort / imports inutilisés

- ESLint (`no-unused-vars`) ne rapporte aucun avertissement dans `app/`, `components/`, `lib/` — seulement dans 2 scripts utilitaires jetables (`scripts/*.mjs`), cohérent avec leur nature ponctuelle.
- Code mort résiduel mineur signalé par un audit interne antérieur (classes CSS orphelines, wrapper `trendLine()` — voir `04-architecture-et-maintenance.md` §6), non revérifié dans cette session.

## 9. Duplication

Cataloguée en détail dans `ANOMALIES.md` : `ARCH-002`, `ARCH-003` (barèmes dupliqués en affichage), `BUG-002` (logique de deadline dupliquée en 4 endroits). Point positif : plusieurs duplications antérieures ont déjà été résolues au fil du projet (ex. `RELEASED_BET_STATUSES`, factorisé dans `lib/labels/bets.ts` après avoir été dupliqué 6 fois selon le journal interne).

## 10. Fonctions trop longues / complexité excessive

- `lib/ai/resolveCalculableBets.ts` : 2561 lignes — fichier le plus long identifié dans le dépôt. Structuré en fonctions séparées par type de pari (pas une seule fonction monolithique), donc la longueur du fichier ne traduit pas nécessairement une complexité cyclomatique excessive par fonction, mais reste un candidat à un découpage en plusieurs fichiers pour la lisibilité (non mesuré par un outil de complexité cyclomatique dans cette session).
- `lib/actions/account.ts` (`deleteAccountFormAction`) : fonction longue (~130 lignes) orchestrant une vingtaine d'opérations séquentielles — candidate à un découpage en sous-fonctions nommées par étape (nullification, cascade, suppression Auth), ce qui faciliterait aussi l'ajout d'une transaction ou d'un mécanisme de reprise (`DATA-002`).

## 11. Constantes magiques / TODO-FIXME

- **Aucun marqueur `TODO`/`FIXME`/`HACK`/`XXX` de dette technique** trouvé dans `lib/` (vérifié par grep dédié) — les seules occurrences de "TODO" sont une valeur d'enum métier (`PredictionViewStatus`), sans rapport avec une dette de code.
- **Valeurs codées en dur assumées et documentées** : `NEXT_ROUND_MATCHES` (UUID de séries, `game_id` NBA réel, horaires codés en dur dans `lib/nbaCupAlpha/autoCreateNextRound.ts`) — explicitement commenté "mécanisme temporaire alpha, ne pas réutiliser en bêta". Seuils de calibrage proba→difficulté (`lib/ai/difficultyTiers.ts`) — issus d'une calibration empirique documentée, pas un oubli.

## 12. Mauvais usages spécifiques au framework

- Bon respect des conventions Next.js 16/React 19 propres à ce projet (`proxy.ts` au lieu de `middleware.ts`, `useActionState` pour les formulaires, Server Components par défaut).
- Aucun usage de `getSession()` côté serveur pour une décision de sécurité (vérifié exhaustivement) — seule utilisation client, sans impact sécurité.
- `dangerouslySetInnerHTML` absent de tout le dépôt (confirmé par l'audit de sécurité du 29/08, non contredit).

## Synthèse

Le code applicatif (`app/`, `components/`, `lib/`) est propre au sens des outils automatisés disponibles (0 erreur TypeScript, 0 erreur/avertissement ESLint, 224/224 tests verts). La qualité perçue en lecture directe (dans les modules explorés en profondeur par les 5 agents de cet audit) est cohérente avec ce résultat : gestion rigoureuse des cas `null`/absence de données, protection systématique contre la concurrence sur les écritures sensibles, peu de code mort. Les points d'attention réels (duplication de barèmes, fonctions longues, suppression de compte non transactionnelle) sont documentés comme anomalies dans `ANOMALIES.md`, aucun ne remettant en cause la solidité générale du code.
