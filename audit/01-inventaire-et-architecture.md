# 01 — Inventaire général et architecture

*Audit nba-pronos — généré le 03/09/2026. Périmètre : dépôt `c:\dev\nba-pronos` en l'état de la branche `main` (commit `cf65483`), lecture seule.*

## 0. Sources de vérité utilisées

Ce dépôt tient une documentation de suivi interne inhabituellement riche et à jour, tenue en continu par l'équipe (utilisateur + sessions Claude Code précédentes) :

- `security-audit-report.md` (racine) — audit de sécurité complet du 29/08/2026, 15 findings, déjà en grande partie corrigé depuis (vérifié dans cet audit, voir `07-securite.md`).
- `Cadrage/Suivi/ETAT_ACTUEL.md` (7828 lignes), `JOURNAL_SESSIONS.md` (12617 lignes), `GAPS_OUVERTS.md` (4505 lignes), `BACKLOG_V1.md` — journal chronologique inversé (plus récent en tête) de chaque lot livré, ses décisions actées avec l'utilisateur, ses bugs réels trouvés et corrigés, et ses écarts assumés par rapport aux specs.
- `Cadrage/Fonctionnel/*`, `Cadrage/V1/SPEC_TECHNIQUE_*` — spécifications fonctionnelles et techniques, certaines closes/figées, d'autres dépassées par l'implémentation réelle (le journal le signale explicitement au cas par cas).
- `Cadrage/Suivi/AUDIT_UX_16_08_2026.md`, `AVIS_EXPERT_16_08_2026.md`, `AUDIT_TYPES_PARIS_24_08_2026.md`, `BILAN_GLOBAL_01_09_2026.md` — audits ponctuels antérieurs, dont plusieurs constats sont repris/vérifiés dans le présent audit plutôt que redémontrés à froid.

**Conséquence méthodologique** : cet audit ne part pas d'une page blanche. Il vérifie, actualise et met en forme standardisée (registre d'anomalies, scorecard, plan d'action) un état déjà largement documenté, et concentre l'effort indépendant sur les zones les moins couvertes par l'auto-documentation existante (profondeur sécurité transverse, intégrité des données, accessibilité formelle, performance, exploitation/observabilité).

Ces documents de suivi sont volumineux (jusqu'à 466 Ko) et n'ont pas été lus intégralement ligne à ligne — échantillonnage ciblé (derniers événements du journal, table des matières des gaps). **Élément non vérifiable exhaustivement**, signalé comme tel.

## 1. Vue d'ensemble

**Nature du produit** : application web de pronostics NBA à jouer entre amis (cercle fermé, alpha en cours) — pronostics match par match, remplissage de bracket de playoffs, paris personnalisés en texte libre structurés et résolus automatiquement par IA, classement avec ligues privées, badges/gamification, chat temps réel, panneau d'administration complet.

**Échelle** (confirmée par `BILAN_GLOBAL_01_09_2026.md`, à recouper avec l'état actuel légèrement postérieur) : ~32 000 lignes TypeScript au 01/09/2026, 359 commits, 62 migrations SQL à cette date (**85 migrations** au 03/09/2026 d'après le décompte direct de ce jour — croissance rapide et continue), micro-service Python séparé (Cloud Run) pour le calcul de probabilités. Développé en ~6-7 semaines (18/07 → 03/09/2026), très largement au-delà du "prototype jetable" envisagé au cadrage initial.

## 2. Stack technique

| Aspect | Valeur | Preuve |
|---|---|---|
| Framework | Next.js **16.2.12**, App Router | `package.json:17` |
| UI | React 19.2.4 / react-dom 19.2.4, Tailwind CSS 4 | `package.json:18-19,32` |
| Langage | TypeScript ^5 | `package.json:33` |
| Base de données / BaaS | Supabase (Postgres + Auth/GoTrue + Realtime + Storage non utilisé) via `@supabase/supabase-js` 2.110.7 et `@supabase/ssr` 0.12.3 | `package.json:14-15` |
| IA | `@anthropic-ai/sdk` 0.120.0 (Claude, structuration des paris persos) | `package.json:13` |
| Notifications push | `web-push` 3.6.7 (VAPID) | `package.json:21` |
| Validation | `zod` ^4.4.3 (usage partiel, voir `05-qualite-du-code.md`/`07-securite.md`) | `package.json:22` |
| Icônes | `lucide-react` | `package.json:16` |
| Tests | `vitest` ^4.1.10 | `package.json:34` |
| Lint | ESLint 9 + `eslint-config-next` | `package.json:30-31` |
| Hébergement | Vercel (région `dub1` unique, `vercel.json`), micro-service ML sur Google Cloud Run (`europe-west1`) | `vercel.json`, `Cadrage/Stats/service/` |
| Gestionnaire de paquets | npm (`package-lock.json` présent, pas de `pnpm-lock`/`yarn.lock`) | racine du dépôt |

Ce projet **n'est pas** un Next.js standard : `AGENTS.md` signale explicitement des breaking changes propres à cette version et un fichier `middleware.ts` renommé `proxy.ts` (export nommé `proxy`) — confirmé dans le code (`proxy.ts:9-11`). Toute recommandation de ce rapport tient compte de cette convention plutôt que de la convention Next.js standard.

## 3. Architecture applicative

### 3.1 Frontend (App Router, groupes de routes)

```
app/
├── (public)/   login, signup, reset-password, verify-email, email-confirmed
├── (app)/      home, play (+ bets, bracket, results), profile, chat
├── (admin)/    admin (+ bug-reports, chat-reports, competitions, logs, missing, players, requests, resolution, validation)
├── api/        account/export, heartbeat, nba-cup-alpha/auto-reveal, reminders/*, resolve-bets, snapshots/leaderboard, sync/*
└── (pages hors groupe, publiques) leaderboard, bracket, players/[userId], cgu, confidentialite, mentions-legales, regles
```

Garde d'accès à deux niveaux (confirmé par exploration dédiée) :
1. `proxy.ts` (équivalent middleware Next.js 16) — authentification uniquement (session valide/non via `getUser()` revalidé serveur, jamais `getSession()`), protège les préfixes `/home`, `/play`, `/profile`, `/admin` ; redirige un utilisateur déjà connecté hors de `/login`/`/signup`.
2. Layouts serveur (`app/(app)/layout.tsx`, `app/(admin)/admin/layout.tsx`) — défense en profondeur, revérifient respectivement la session et `is_admin()` (RPC) à chaque navigation.

Point à noter (pas un trou de sécurité, une observation d'architecture) : `/chat` fait partie du groupe `(app)` mais n'est pas listé dans `APP_ZONE_PREFIXES` de `proxy.ts` — c'est le layout, pas le proxy, qui protège effectivement cette route. Voir `ARCH-001` dans le registre d'anomalies.

### 3.2 Backend / logique métier

Pas d'API REST/GraphQL séparée : la logique métier vit dans des **Server Actions** Next.js (`lib/actions/*.ts`, 21 fichiers) appelées directement depuis les formulaires/composants React, et dans des **routes API** dédiées (`app/api/*`) réservées aux tâches planifiées (cron GitHub Actions) et à l'export de compte. Les lectures passent par des fonctions dédiées `lib/queries/*.ts` (25 fichiers), séparées des écritures (`lib/actions/*.ts`) — séparation lecture/écriture cohérente à travers tout le code.

Modules `lib/` principaux :
- `lib/ai/*` — pipeline de structuration des paris personnalisés par IA (le plus volumineux, ~4000 lignes d'après `BILAN_GLOBAL_01_09_2026.md`) : `structureBet.ts` + 8 variantes `structureXxxBet.ts` par forme de pari, `resolveCalculableBets.ts` + 13 fichiers `resolveCalculableXxxBets.ts` (résolution automatique post-match).
- `lib/scoring/*` — moteur de scoring (bracket, pronostics, paris), classement, superlatifs, recompute.
- `lib/sync/*` — synchronisation avec l'API NBA externe (Highlightly) : résultats, calendrier, équipes.
- `lib/nbaCupAlpha/*` — cycle de vie automatique du format "NBA Cup" (création de round suivant, reveal automatique).
- `lib/supabase/{browser,server,service}.ts` — trois clients Supabase distincts (anon côté navigateur, session côté serveur, `service_role` isolé derrière `import "server-only"`).
- `lib/push/*` — notifications Web Push (VAPID).
- `lib/badges/*`, `lib/snapshots/*`, `lib/reminders/*`, `lib/dates/{newyork,paris}.ts` (deux fuseaux distincts, voir `06-donnees-et-integrite.md`).

### 3.3 Données

Supabase Postgres, 85 migrations SQL (`supabase/migrations/`), modèle détaillé dans `06-donnees-et-integrite.md`. Autorisation fine portée exclusivement en base : Row Level Security + fonctions `SECURITY DEFINER` + triggers d'invariants (jamais un contrôle applicatif isolé) — modèle confirmé "très solide" par l'audit du 29/08/2026 et revérifié dans cet audit (`07-securite.md`).

### 3.4 Services externes

| Service | Usage | Où | Donnée/clé exposée |
|---|---|---|---|
| Supabase (Auth, Postgres, Realtime) | Cœur de l'app | partout | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publiques), `SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement, `import "server-only"`) |
| Anthropic (Claude) | Structuration des paris texte libre | `lib/ai/structureBet.ts` et fichiers associés | `ANTHROPIC_API_KEY` (serveur uniquement) |
| Micro-service Python (Google Cloud Run) | Calcul de probabilités (modèles ML) pour les paris structurés | `lib/ai/statsService.ts`, `STATS_SERVICE_URL` | `STATS_SERVICE_SECRET` (voir `07-securite.md` pour l'état de protection) |
| Highlightly (API NBA tierce) | Synchronisation calendrier/résultats/équipes | `lib/nba/client.ts` | `HIGHLIGHTLY_API_KEY` (serveur uniquement) |
| Cloudflare Turnstile | CAPTCHA login/signup | `components/auth/TurnstileWidget.tsx` | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (publique par design) |
| Web Push (VAPID) | Notifications navigateur | `lib/push/*` | `VAPID_PRIVATE_KEY` (serveur), `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (publique par design) |
| GitHub Actions | 8 workflows planifiés (cron) | `.github/workflows/*.yml` | `SYNC_SECRET` (Bearer partagé vers les routes `/api/sync/*` etc.) |
| Vercel | Hébergement + build + OIDC | — | `VERCEL_OIDC_TOKEN` (généré localement par la CLI, dans `.env.local`) |

### 3.5 Tâches planifiées / automatisation

8 workflows GitHub Actions (`.github/workflows/`) : `ci.yml`, `heartbeat.yml`, `nba-cup-alpha-reveal.yml`, `refresh-stats-supabase.yml`, `reminder-bracket.yml`, `reminder-matches.yml`, `snapshot-leaderboard.yml`, `sync-results.yml`, `sync-schedule.yml`, `sync-teams.yml` (soit 9 fichiers listés, `ci.yml` étant le seul non planifié à confirmer — détail dans `13-production-et-exploitation.md`).

## 4. Données sensibles manipulées

- Comptes utilisateurs (email/mot de passe délégués entièrement à `auth.users` Supabase — la table applicative `users` ne stocke ni l'un ni l'autre).
- Déclaration d'âge (migration récente `20260903120000_users_age_declaration.sql`) — donnée à caractère personnel sensible au sens RGPD (mineur potentiel).
- Texte libre utilisateur : bio de profil, description de pari, messages de chat, signalements de bug, justifications de correction — surface de données personnelles incidentes (un utilisateur peut y coller ce qu'il veut).
- Codes d'invitation de compétition/ligue (`competition_secrets`, `league_secrets`).
- Abonnements push (`push_subscriptions`) — endpoints de notification, donnée d'identification d'appareil.
- Aucune donnée de paiement (confirmé par l'audit du 29/08/2026, aucune contradiction trouvée).

## 5. Dépendances critiques

- **Supabase** : point de défaillance unique de fait — auth, données, RLS, Realtime tout en dépendent. Aucun fallback documenté en cas d'indisponibilité.
- **Anthropic Claude** : la fonctionnalité différenciante du produit (paris persos structurés) en dépend entièrement ; comportement en cas d'échec/latence de l'API à vérifier (`08-api-et-integrations.md`).
- **Micro-service Cloud Run** : dépendance externe au déploiement Vercel, gérée manuellement (pas d'IaC constatée), avec un historique documenté de configuration délicate (`Cadrage/Stats/service/DEPLOIEMENT_CLOUD_RUN.md`).
- **Highlightly (API NBA tierce)** : source de vérité du calendrier/résultats réels ; aucune donnée de match n'existe sans elle.
- **GitHub Actions** : seul mécanisme d'exécution planifiée (pas de queue/worker dédié) — un run manqué ou en doublon a un impact direct sur le jeu (voir `13-production-et-exploitation.md`).

## 6. Zones encore inconnues / non vérifiées à ce stade

- Configuration **réelle** du dashboard Supabase de production (rate-limiting, CAPTCHA serveur, cookies) — non accessible depuis ce dépôt, uniquement `supabase/config.toml` (config CLI locale, pas garantie identique à la prod), déjà signalé comme limite par l'audit du 29/08/2026.
- Comportement effectif en production du service Cloud Run (accessible uniquement par lecture de sa documentation de déploiement, aucun appel réseau réalisé).
- Couverture réelle des tests et résultat d'exécution (`vitest`, `tsc`, `eslint`, `npm audit`) — en cours de vérification, détail dans `05-qualite-du-code.md` et `12-tests-et-strategie-qa.md`.
- Contenu exact et à jour de `Cadrage/Suivi/ETAT_ACTUEL.md`/`JOURNAL_SESSIONS.md` au-delà des sections échantillonnées (fichiers de plusieurs centaines de Ko, non lus intégralement).
