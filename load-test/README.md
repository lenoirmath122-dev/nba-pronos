# Test de charge — estimation de la capacité max

Option 1 de la discussion "capacité max" du 11/09/2026, **révisée** le
même jour après échec réel du plan initial (local + Docker Desktop —
RAM tombée à 0,7 Go sur la machine principale, disque système saturé sur la
secondaire, cf. mémoire projet). Mesure la capacité du backend
**Supabase** (Postgres + PostgREST + GoTrue) sur un **projet cloud dédié**
(`nba-pronos-loadtest`, ref `kolbvdobcheedswsufgv`), séparé de la prod —
plus besoin de Docker du tout. Le pipeline Next.js/Vercel (cold starts
serverless, limites du plan Hobby) reste hors périmètre ici — c'est
précisément ce que couvrira le test en production (option 2), prévu après
l'alpha.

**Ne jamais lancer sans avoir demandé d'abord** (cf. mémoire projet).

## Prérequis

- Le projet Supabase cloud dédié existe et a le même schéma que la prod
  (`npx supabase link --project-ref kolbvdobcheedswsufgv` puis
  `npx supabase db push` — voir `audit/RUNBOOK_MIGRATIONS.md` pour le
  fonctionnement général des migrations). Penser à relier ensuite la CLI à
  la prod (`npx supabase link --project-ref lcldekiwinggyqgbmlwc`) avant
  tout futur travail sur les migrations normales.
- [k6](https://k6.io/docs/get-started/installation/) (`winget install k6.k6`
  ou `choco install k6`)
- Node.js (déjà utilisé par le projet)

## Étape 0 — augmenter temporairement le rate-limit auth

Dashboard Supabase du projet load-test → **Authentication → Rate Limits** :
monter temporairement la limite de connexions/inscriptions (par défaut assez
basse pour bloquer un test k6 lancé depuis une seule machine bien avant la
vraie limite applicative). **Remettre la valeur d'origine une fois le test
terminé.**

## Étape 1 — récupérer les clés du projet cloud

Dashboard Supabase du projet load-test → **Settings → API** :

- **Project URL** (`https://kolbvdobcheedswsufgv.supabase.co`)
- **anon / publishable key** (`sb_publishable_...`)
- **service_role / secret key** (`sb_secret_...` — à garder secrète, ne
  jamais commit)

## Étape 2 — provisionner les fixtures (utilisateurs + série/match de test)

```
LOAD_TEST_SERVICE_ROLE_KEY=sb_secret_... node load-test/setup.mjs
```

Crée 200 utilisateurs de test (`loadtest-0001@test.local`, mot de passe
`LoadTest!2026`) et, si aucune compétition n'est déjà active, une
compétition/série/match PLAYOFFS dédiés au test. Idempotent : relançable sans
dupliquer. Refuse de tourner si l'URL cible pointe vers le projet de prod.

Variables optionnelles : `LOAD_TEST_USER_COUNT` (défaut 200),
`LOAD_TEST_SUPABASE_URL` (défaut le projet cloud load-test).

## Étape 3 — lancer le test de charge

```
k6 run -e ANON_KEY=sb_publishable_... load-test/k6-scenario.js
```

Montée en charge progressive par paliers : 10 → 25 → 50 → 100 → 200
utilisateurs simulés, chacun faisant en boucle une lecture (classement + mes
paris) et, une fois, un pari brouillon.

## Lecture des résultats

k6 affiche en fin d'exécution `http_req_duration` (latence, avec p95/p99) et
`http_req_failed` (taux d'erreur) **par palier implicite** — regarde à partir
de quel palier la latence s'envole ou les erreurs apparaissent : c'est là
qu'est la limite. Les seuils définis dans le script (`p95 < 1000ms`,
erreurs `< 1%`) font échouer le run s'ils sont dépassés, ce qui donne déjà un
verdict global.

## Nettoyage

Le projet cloud est dédié au load test — pas d'impact sur la prod. Pour
repartir propre entre deux runs, soit relancer `setup.mjs` (idempotent), soit
vider les tables `bets`/`auth.users` de test via le dashboard (SQL Editor).
Une fois les campagnes de test terminées, mettre le projet en pause depuis le
dashboard (libère le slot du quota gratuit).
