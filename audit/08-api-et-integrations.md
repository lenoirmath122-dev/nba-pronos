# 08 — API et intégrations

## 1. Vue d'ensemble des intégrations

| Intégration | Sens | Authentification | Isolation |
|---|---|---|---|
| Supabase (Auth/Postgres/Realtime) | Bidirectionnel | Session utilisateur / `service_role` | Cœur de l'app, pas d'abstraction supplémentaire (couplage direct assumé) |
| Anthropic Claude (structuration IA) | Sortant (Next.js → Anthropic) | `ANTHROPIC_API_KEY`, serveur uniquement | Isolée dans `lib/ai/structureBet.ts` et fichiers associés |
| Micro-service Cloud Run (proba ML) | Sortant (Next.js → Cloud Run) | `STATS_SERVICE_SECRET` (Bearer) | Isolée dans `lib/ai/statsService.ts`, 18 sites d'appel |
| Highlightly (API NBA tierce) | Sortant (cron → Highlightly) | Clé API dédiée | Isolée dans `lib/nba/client.ts` |
| Cloudflare Turnstile | Sortant (navigateur → Cloudflare, puis Supabase Auth → Cloudflare) | Site key publique / vérification serveur par Supabase | Standard, pas de logique maison |
| Web Push (VAPID) | Sortant (Next.js → navigateurs) | Paire de clés VAPID | Isolée dans `lib/push/*` |
| GitHub Actions → routes internes | Entrant (cron → app) | Bearer `SYNC_SECRET` | 9 routes dédiées, patron uniforme |

**Aucune API externe n'est appelée directement depuis le navigateur** avec une clé secrète : tous les appels à Anthropic, Highlightly, et au micro-service Cloud Run sont serveur-à-serveur (modules `server-only`). Le seul appel navigateur→tiers est le widget Turnstile (clé publique par design) et Supabase (clé anon publique par design, protégée par RLS côté base).

## 2. Contrat, validation et gestion d'erreur par intégration

### 2.1 Anthropic Claude (`lib/ai/structureBet.ts` et 8 fichiers dédiés)

- **Contrat** : sortie contrainte par schéma Zod strict (`zodOutputFormat`) — la réponse du modèle ne peut pas produire un objet hors schéma.
- **Gestion de panne** : absence de clé, timeout, erreur réseau, JSON invalide → capturé par `catch` générique, retourne `null`, jamais remonté comme erreur bloquante à l'utilisateur. Le pari retombe sur le mécanisme manuel de validation admin.
- **Codes HTTP / retries** : non vérifiés explicitement dans cette session (le SDK `@anthropic-ai/sdk` gère probablement des retries par défaut sur erreurs transitoires — **à vérifier** si un comportement spécifique est attendu au-delà du défaut du SDK).
- **Cache** : bloc de prompt statique marqué `cache_control: ephemeral` (TTL 5 min) — optimisation de coût, pas un cache de réponse.
- **Coût / quotas** : suivi manuel documenté (coût mesuré à l'appel, ex. "$0,169" pour 30 tests) plutôt qu'un monitoring automatisé — la décision de persister l'usage dans une table dédiée a été explicitement **reportée** faute de données suffisantes (`Cadrage/Suivi/GAPS_OUVERTS.md`, entrée du 03/09/2026 sur la "décision TTL cache").
- **Idempotence** : chaque appel de structuration correspond à une soumission de pari distincte — pas de risque de double-traitement identifié à ce niveau.

### 2.2 Micro-service Cloud Run (proba ML)

- **Authentification** : Bearer `STATS_SERVICE_SECRET`, vérifié fail-closed côté service (voir `07-securite.md`).
- **Comportement si indisponible** : **vérifié le 03/09/2026 (item A3 du plan d'action) — correct et déjà robuste, aucune correction nécessaire.** Les 18 fonctions `predict*()` de `lib/ai/statsService.ts` partagent le même patron strict : URL absente → `null` immédiat sans tenter l'appel ; `fetch` sous `AbortSignal.timeout` (20s pour `/predict`, 40s pour les 17 autres endpoints, marge pour un cold start Cloud Run) ; `!res.ok` (tout code HTTP non-2xx) → `null` ; tout le bloc est en `try/catch` → une exception réseau (DNS, timeout, connexion refusée) retombe aussi sur `null`. Côté appelant (`structureAndScoreBet.ts`), **chaque** site de consommation d'un résultat de prédiction suit `if (!prediction) { await markNotCalculable(); return; }` — vérifié sur les branches PLAYER, MATCH_TOTAL, PERIOD, COMPARISON, COMBO, ROSTER_SPLIT/COUNT, SUPERLATIVE, TECHNICAL_FOULS_COUNT, LAST_BASKET, BLOCK_ON_PLAYER. En complément, l'intégralité du corps de la fonction est enveloppée dans un `try/catch` global (dernière ligne du fichier) qui avale toute exception imprévue en laissant `is_calculable` à `NULL` (signal "panne", distinct de `false` = décision explicite) — jamais de pari cassé, jamais d'exception qui remonterait à `submitBet`. Une panne du micro-service fait donc systématiquement retomber le pari sur le mécanisme manuel de validation admin existant, exactement comme documenté pour une panne Anthropic.
- **Données envoyées** : noms de joueurs/équipes et paramètres du pari structuré, pas de donnée personnelle utilisateur identifiée dans les appels (à confirmer).
- **Réponse jamais garantie complète** : non vérifié explicitement — risque théorique si le service renvoie une proba partielle ou malformée sans validation de schéma côté TypeScript (contrairement à la sortie Claude, contrainte par Zod).

### 2.3 Highlightly (sync NBA)

- **Rattachement déterministe** : 0 ou 2+ séries candidates pour un match = abandonné et journalisé, jamais de résolution heuristique automatique.
- **Réponse vide** : traitée sans effet, pas d'erreur.
- **Réponse partielle** (un match manquant sur une date par ailleurs non vide) : simplement ignorée ce cycle, retentée au cycle suivant — **aucune alerte dédiée si un match manque de façon persistante sur plusieurs cycles** (risque : un problème de mapping non détecté pourrait passer inaperçu plusieurs jours si personne ne consulte `/admin/logs`).
- **Statuts non reconnus** : repli sur `IN_PROGRESS` avec flag `recognized:false` journalisé — correctif d'un bug antérieur où ce signal était perdu.
- **Pas de retries explicites visibles** dans le code exploré — chaque cron relance simplement au prochain créneau (30 min à 24h selon la route), ce qui fait office de retry naturel mais sans backoff ni alerte en cas d'échecs répétés.

### 2.4 GitHub Actions → routes internes

- **Authentification uniforme** : Bearer `SYNC_SECRET`, comparaison timing-safe.
- **Idempotence par route** :
  - `sync-results`/`sync-schedule`/`sync-teams` : upsert sur contrainte unique — rejouable sans doublon.
  - `nba-cup-alpha-reveal` : filtre sur `status='SCHEDULED'` — un match déjà révélé ne re-matche plus, rejouable sans effet.
  - `reminder-bracket`/`reminder-matches` : déduplication via table `reminder_log` (documentée en commentaire, non vérifiée par un test automatisé — `TEST-003`).
  - `snapshot-leaderboard` : upsert par jour — rejouable sans doublon.
  - `resolve-bets` : condition d'état + vérification de ligne affectée — rejouable sans double résolution.
- **Risque de double exécution simultanée** (deux runs du même cron qui se chevauchent, ex. si un run précédent traîne) : les mécanismes ci-dessus (upsert, condition d'état) couvrent ce cas par construction pour la plupart des routes — pas un simple "espoir que ça n'arrive pas".

## 3. Points de risque identifiés

| Risque | Fichier | Gravité perçue | Statut |
|---|---|---|---|
| ~~Comportement du pipeline IA en cas de panne du micro-service Cloud Run~~ | `lib/ai/statsService.ts` | Nul (déjà robuste) | **Vérifié le 03/09/2026 — correct, aucune action requise** |
| Absence d'alerte sur un mapping match↔série qui échoue de façon persistante (Highlightly) | `lib/sync/schedule.ts` | Faible-Moyen | Vérifié comme silencieux, pas d'alerte |
| Décision de monitoring du coût/usage Anthropic reportée | `lib/ai/structureBet.ts` | Faible (produit à faible volume actuellement) | Reporté consciemment (`GAPS_OUVERTS.md`) |
| Pas de retries/backoff explicites sur les appels Highlightly | `lib/sync/*.ts` | Faible (cron fréquent fait office de retry naturel) | Non vérifié comme un problème actif |

## 4. Ce qui n'a pas pu être vérifié dans cette phase

- Le code Python du micro-service lui-même (hors périmètre TypeScript principal de cette session) — seule sa documentation de déploiement et son middleware d'authentification ont été vérifiés (Phase 7).
- Le comportement réel de l'API Highlightly en cas d'erreur HTTP 5xx (timeout, 500) — seuls les cas "réponse vide"/"réponse partielle" ont été vérifiés dans le code, pas un test d'erreur HTTP explicite.
