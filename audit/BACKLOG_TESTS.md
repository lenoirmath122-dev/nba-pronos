# Backlog de tests — nba-pronos

*Classé par priorité selon la consigne d'audit. Chaque test précise objectif, préconditions, données, étapes, résultat attendu, niveau conseillé, anomalie couverte, priorité.*

## 1. Sécurité et permissions

### T-SEC-01 — Un joueur non-admin ne peut pas s'auto-promouvoir admin via Server Action forgée
- **Objectif** : confirmer que `setPlayerRole({userId: self, role: "ADMIN"})` appelé directement (hors UI) échoue.
- **Préconditions** : compte joueur `ACTIVE` non-admin.
- **Données** : le compte de test lui-même.
- **Étapes** : appeler `setPlayerRole` avec son propre `userId` et `role: "ADMIN"`.
- **Résultat attendu** : `{success: false}`, `users.role` inchangé en base, aucune entrée `audit_logs` trompeuse.
- **Niveau** : intégration (nécessite une base Supabase de test).
- **Anomalie couverte** : validation du modèle RLS/trigger (`enforce_users_invariants`), `TEST-002`.
- **Priorité** : Haute.

### T-SEC-02 — Un joueur ne peut pas éditer/consulter le pari d'un autre joueur via URL directe
- **Objectif** : confirmer l'absence d'IDOR sur `/play/bets/[id]/edit`.
- **Préconditions** : 2 comptes joueur, un pari `DRAFT` appartenant au compte A.
- **Étapes** : connecté en tant que B, naviguer vers `/play/bets/{id du pari de A}/edit`.
- **Résultat attendu** : état inerte/erreur, aucune donnée du pari de A exposée.
- **Niveau** : intégration.
- **Anomalie couverte** : `TEST-002`.
- **Priorité** : Haute.

### T-SEC-03 — Un non-membre d'une ligue ne peut pas lire les messages de son chat via Realtime brut
- **Objectif** : rejouer le test déjà effectué manuellement (script jetable) sous forme automatisée pérenne.
- **Préconditions** : 2 comptes, une ligue avec un seul membre.
- **Étapes** : le non-membre ouvre une écoute Realtime brute sur le canal de la ligue.
- **Résultat attendu** : aucun événement reçu.
- **Niveau** : intégration.
- **Anomalie couverte** : `TEST-002`.
- **Priorité** : Haute.

### T-SEC-04 — Dernier admin actif protégé contre auto-désactivation
- **Objectif** : confirmer qu'un admin unique ne peut pas se rétrograder/désactiver lui-même.
- **Étapes** : appeler `setPlayerStatus`/`setPlayerRole` sur soi-même en tant que seul admin `ACTIVE`.
- **Résultat attendu** : rejeté par le trigger `enforce_users_invariants`.
- **Niveau** : intégration.
- **Priorité** : Haute.

## 2. Intégrité des données

### T-DATA-01 — Suppression de compte interrompue en cours de route
- **Objectif** : documenter/mesurer le comportement réel si `deleteAccountFormAction` est interrompue après quelques étapes (`DATA-002`).
- **Étapes** : simuler une exception forcée après la nullification des références mais avant la purge des tables possédées ; vérifier l'état résultant.
- **Résultat attendu (à définir)** : soit l'opération est rendue idempotente/rejouable, soit un état d'erreur clair est renvoyé à l'utilisateur avec une trace exploitable par un admin.
- **Niveau** : intégration.
- **Anomalie couverte** : `DATA-002`.
- **Priorité** : Haute.

### T-DATA-02 — Contournement du quota "3 paris MATCH/série" par écriture directe
- **Objectif** : confirmer/infirmer que seule la fonction `save_bet` protège ce quota (`DATA-003`).
- **Étapes** : insérer directement 4 paris MATCH actifs sur la même série via `service_role`, hors `save_bet`.
- **Résultat attendu (à documenter)** : si l'insertion réussit, documenter le trou ; si un `CHECK`/trigger la bloque, le finding peut être fermé.
- **Niveau** : intégration.
- **Anomalie couverte** : `DATA-003`.
- **Priorité** : Moyenne.

### T-DATA-03 — Idempotence du recompute rejoué 2 fois
- **Objectif** : étendre `recompute.test.ts` existant à un scénario avec correction admin entre les deux passes.
- **Niveau** : unitaire (extension de l'existant).
- **Priorité** : Moyenne.

## 3. Règles métier critiques

### T-BIZ-01 — Statut `POSTPONED` d'un match sur le scoring des pronostics déjà saisis (test de non-régression)
- **Objectif** : le comportement a été clarifié par lecture de code le 03/09/2026 (item A5, `03-conformite-fonctionnelle.md`) — ce test fige ce comportement plutôt que de lever une ambiguïté.
- **Étapes** : appeler `scoreMatchPrediction` avec un match `status: "POSTPONED"` et un pronostic complet/figé.
- **Résultat attendu** : `ABSENT_MATCH_PREDICTION` (pronostic en attente, ni perdu ni neutralisé) — même résultat qu'un match `SCHEDULED`/`IN_PROGRESS`, différent de `CANCELLED`.
- **Niveau** : unitaire (extension de `engine.test.ts`).
- **Priorité** : Basse (protection d'un comportement déjà correct).

### T-BIZ-02 — Pari personnalisé avec correction en attente jamais résolu automatiquement
- **Objectif** : confirmer sur un vrai scénario bout-en-bout (actuellement testé uniquement avec un fake Supabase).
- **Niveau** : intégration.
- **Priorité** : Moyenne.

### T-BIZ-03 — Deadline de pari cohérente entre les 4 implémentations
- **Objectif** : test paramétré exécutant les 4 implémentations (`bet-deadline.ts`, `home.ts`, `admin-dashboard.ts`) sur les mêmes données et vérifiant qu'elles renvoient le même résultat.
- **Niveau** : unitaire.
- **Anomalie couverte** : `BUG-002`.
- **Priorité** : Moyenne (utile même avant la migration de factorisation, pour prouver l'équivalence actuelle avant de fusionner).

## 4. API

### T-API-01 — Comportement du micro-service Cloud Run indisponible (test de non-régression)
- **Objectif** : le comportement a été vérifié correct par lecture de code le 03/09/2026 (`08-api-et-integrations.md`) — ce test fige ce comportement plutôt que de lever un inconnu.
- **Résultat attendu** : un `fetch` en échec (timeout, 500, réseau) vers `STATS_SERVICE_URL` fait basculer le pari sur `is_calculable=false` (mécanisme manuel), jamais d'exception qui remonterait.
- **Niveau** : intégration (mock HTTP).
- **Priorité** : Moyenne (protection d'un comportement déjà correct, plus urgent ailleurs).

### T-API-02 — Réponse Highlightly partielle sur plusieurs cycles consécutifs
- **Objectif** : vérifier qu'un match jamais synchronisé après N cycles est détectable par un admin (via `/admin/logs`) plutôt que silencieusement invisible.
- **Niveau** : intégration.
- **Priorité** : Moyenne.

## 5. Cas limites

### T-EDGE-01 — Changement d'heure DST sur `lib/dates/paris.ts`
- **Objectif** : vérifier le calcul de l'offset autour d'un changement d'heure réel (dernier dimanche de mars/octobre).
- **Niveau** : unitaire.
- **Anomalie couverte** : `TEST-003`.
- **Priorité** : Basse.

### T-EDGE-02 — Ex-aequo sur tous les critères de classement
- **Objectif** : vérifier le rang partagé (1,2,2,4) sur un cas à 3+ joueurs strictement égaux sur les 4 critères.
- **Niveau** : unitaire.
- **Priorité** : Basse.

## 6. Erreurs et reprise

### T-ERR-01 — Double résolution concurrente du même pari
- **Objectif** : simuler deux exécutions simultanées de `resolveCalculableBets` sur le même pari, confirmer qu'une seule aboutit et que l'autre détecte "déjà résolu entre-temps".
- **Niveau** : intégration.
- **Anomalie couverte** : `TEST-003`.
- **Priorité** : Moyenne.

### T-ERR-02 — Session expirée pendant la soumission d'un formulaire
- **Objectif** : vérifier le message d'erreur affiché et l'absence de perte de saisie.
- **Niveau** : e2e.
- **Priorité** : Basse.

## 7. Interface

### T-UI-01 — Navigation clavier complète d'un dialogue de confirmation (suppression de compte)
- **Objectif** : vérifier `Tab`/`Shift+Tab` reste dans le dialogue, `Échap` le ferme, le focus revient sur l'élément déclencheur à la fermeture.
- **Niveau** : e2e (Playwright, avec assertions de focus).
- **Anomalie couverte** : `UX-001`.
- **Priorité** : Haute (première pierre d'une suite e2e inexistante).

### T-UI-02 — Parcours critique : connexion → soumission d'un pronostic → déconnexion
- **Objectif** : premier test e2e de bout en bout sur le parcours le plus fréquent.
- **Niveau** : e2e.
- **Anomalie couverte** : `TEST-001`.
- **Priorité** : Haute.

### T-UI-03 — Parcours critique : soumission d'un pari personnalisé texte libre → vérification du statut
- **Niveau** : e2e (avec mock de l'appel Anthropic pour éviter un coût réel en CI).
- **Anomalie couverte** : `TEST-001`.
- **Priorité** : Haute.

## 8. Accessibilité

### T-A11Y-01 — Contraste de `--color-trend` en thème clair
- **Objectif** : mesurer le ratio de contraste réel (outil automatisé type axe) et corriger si &lt;4.5:1.
- **Niveau** : test automatisé (axe-core) ou vérification manuelle outillée.
- **Anomalie couverte** : `A11Y-001`.
- **Priorité** : Moyenne.

### T-A11Y-02 — `eslint-plugin-jsx-a11y` intégré sans nouvelle erreur
- **Objectif** : intégrer l'outil et confirmer/corriger les manquements qu'il détecterait sur le code existant.
- **Niveau** : outillage CI.
- **Anomalie couverte** : `A11Y-002`.
- **Priorité** : Moyenne.

## 9. Performance

### T-PERF-01 — Mesure réelle des Web Vitals (LCP/CLS/TTFB) sur les 3 écrans les plus visités
- **Objectif** : obtenir une première mesure réelle (Lighthouse CI ou équivalent) remplaçant les estimations non revérifiées de la Phase 11.
- **Niveau** : outillage CI ou audit manuel avec navigateur.
- **Priorité** : Basse (pas de problème actif mesuré à ce jour).

## 10. Smoke tests de production

### T-SMOKE-01 — Vérification post-déploiement que les routes cron répondent 401 sans secret
- **Objectif** : confirmer après chaque déploiement qu'aucune route `/api/sync/*`/`/api/resolve-bets`/etc. n'est devenue accessible sans authentification.
- **Niveau** : smoke test automatisé (curl sans header, attendre 401).
- **Priorité** : Moyenne.

### T-SMOKE-02 — Vérification que le build de production ne régresse pas sur le rendu 100% dynamique attendu
- **Objectif** : détecter si une future page bascule accidentellement en statique alors qu'elle dépend de données de session (fuite de données entre utilisateurs si le cache Vercel la sert statique).
- **Niveau** : vérification de la sortie de build en CI (grep `ƒ`/`○` par route attendue).
- **Priorité** : Moyenne.
