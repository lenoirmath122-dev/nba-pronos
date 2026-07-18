# NBA Pronos — État actuel (V1)

> **Nature** : instantané de l'état RÉEL au moment de la dernière session — réécrit
> entièrement à chaque fois, jamais complété. Pour l'historique, voir
> `JOURNAL_SESSIONS.md`. Pour les points en suspens, voir `GAPS_OUVERTS.md`.
> Ne contient pas les règles fonctionnelles (synthèse + `decisions_0.2.x`).
>
> Dernière mise à jour : session du 18/07/2026 (suite) — spec T4 (synchro API)
> produite et validée. Ce fichier ne décrit plus l'état du prototype
> (`nba-pronos-proto`, dépôt séparé, intact en référence, D1) mais celui du
> dépôt V1 (`nba-pronos`).

---

## 1. Contexte technique

```text
Stack       : Next.js 16.2.10 (Turbopack, App Router, TypeScript) + Supabase
              (Postgres).
Dépôt local : C:\dev\nba-pronos (sorti de OneDrive) — dépôt Git NEUF, projet
              Supabase NEUF (D1, session du 17/07/2026), distinct du
              prototype (`nba-pronos-proto`), qui reste intact et inchangé en
              référence.
Auth        : Supabase Auth (email + mot de passe), pont École A vers
              public.users via trigger SQL (T2) — voir §3.
RLS         : ACTIVE sur les 15 tables publiques, testée de bout en bout (T3).
```

## 2. Avancement

```text
Phase V1 — socle de données posé (modèle + auth + RLS) ; couche de synchro
API SPÉCIFIÉE mais PAS ENCORE CODÉE. AUCUN écran, AUCUNE route applicative,
AUCUN moteur de synchro ni de scoring n'existe encore dans ce dépôt — seul le
scaffold Next.js par défaut (créé par `create-next-app`) est présent dans
`app/`. Le client API (lib/nba/client.ts), lib/sync/* et les routes
/api/sync/*+/api/heartbeat restent À ÉCRIRE, prévu après T5 (voir T4 ci-dessous).

Spécifications techniques V1 produites et VALIDÉES, dans `Cadrage/V1/` :
  T1 — SPEC_TECHNIQUE_MODELE_DONNEES_V0.1.md
  T2 — SPEC_TECHNIQUE_AUTH_V0.1.md
  T3 — SPEC_TECHNIQUE_RLS_V0.1.md
  T4 — SPEC_TECHNIQUE_SYNCHRO_V0.1.md (synchro API Highlightly)

4 migrations écrites à partir de T1/T2/T3, appliquées et testées (détail §3).
T4 ne produit aucune migration (tables déjà posées par T1).

Décisions synchro actées par T4 (implémentation à venir, après T5) :
  - Secret partagé : routes /api/sync/* et /api/heartbeat authentifiées par
    Bearer + variable d'env SYNC_SECRET.
  - Logos d'équipes téléchargés au sync /teams et hébergés dans un bucket
    Supabase Storage dédié (public en lecture) — pas de hotlink externe.
  - 30 mappings TEAM confirmés automatiquement (référentiel NBA déterministe),
    aucune revue admin nécessaire.
  - Horizon de la synchro /schedule : 4 jours (3 j de fenêtre de pronos + 1 j
    de marge).
  - Signal de recalcul : appel direct de la fonction de recalcul depuis
    lib/sync (transactionnel) ; forme exacte de la fonction laissée à T5.
  - Attache match → série : BRANCHE B (API match-centrique, aucun id de série
    exploitable) — structure des séries créée par l'admin, matchs rattachés
    par heuristique (paire d'équipes + tour + fenêtre de dates), confirmés par
    l'admin.

Prochaines étapes (ordre acté dans SPEC_TECHNIQUE_V0.1.md) :
  T5 — Moteur de scoring (portage du moteur du prototype, idempotent,
       barèmes Playoffs + Cup). PROCHAINE ÉTAPE.
  T6 — Architecture Next.js (arborescence app/, routes, server actions,
       Realtime) + implémentation de la synchro spécifiée par T4 — 1er
       écran/route applicatif du projet.
  T7 — Design system (design tokens), juste avant le 1er écran joueur.
  T8 — Déploiement (Vercel, variables d'env, secrets, planificateur externe).
```

## 3. État actuel de la base de données

```text
4 migrations appliquées (supabase/migrations/, via `npx supabase db push`,
chacune montrée intégralement et confirmée par l'utilisateur avant
application) :

1. 20260718090000_initial_schema.sql — schéma complet : types énumérés,
   teams/users/competitions/series/matches/entity_mappings/brackets/
   bracket_picks/match_predictions/bets/correction_requests/audit_logs/
   sync_logs/competition_archives, + vues user_scores/user_recent_form
   (security_invoker = true, une ligne par compétition/joueur).
2. 20260718100000_auth_join_code_and_profile.sql — code compétition
   (join_code), fonction verify_join_code(), trigger handle_new_user (pont
   auth.users -> public.users, École A).
3. 20260718110000_rls.sql — join_code sorti vers competition_secrets (secret
   admin-only) ; fonctions SECURITY DEFINER (is_admin, is_active,
   match_is_locked, has_committed_prediction, bracket_deadline_passed,
   bet_is_public, bet_deadline_open) ; RLS activée sur les 15 tables
   publiques ; policies SELECT/INSERT/UPDATE ; triggers d'invariants
   (enforce_users_invariants, enforce_match_prediction_transitions,
   enforce_bet_transitions, enforce_prediction_correction).
4. 20260718120000_fix_users_trigger_system_context.sql — correctif de
   enforce_users_invariants() : contexte système (auth.uid() NULL) désormais
   laissé passer sans garde, sinon le seed du 1er admin (A4) aurait été
   bloqué. Bug trouvé au test RLS (T3 §7).

RLS vérifiée de bout en bout via le plan de test T3 §7 (anon / joueur A /
joueur B / admin) : lectures publiques correctes, règle « valider = voir »
sur les pronos match, verrouillage à l'heure du match, écritures illégales
toutes refusées. Tout conforme.

Base VIDE de données opérationnelles (aucune compétition, aucun utilisateur
créé) — normal, aucun écran d'inscription ni d'administration n'existe
encore.
```

## 4. Fichiers du projet — carte rapide

```text
Scaffold par défaut de `create-next-app`, non modifié depuis (app/layout.tsx,
app/page.tsx, app/globals.css, public/, config Next/TS/ESLint standard).

Cadrage/
  V1/     — specs techniques V1 validées : T1 (modèle de données), T2 (auth),
            T3 (RLS), T4 (synchro API). T5-T8 restent à écrire (voir §2).
  Proto/  — fichiers de suivi (ce fichier, JOURNAL_SESSIONS.md,
            GAPS_OUVERTS.md) + tout le cadrage fonctionnel hérité du
            prototype (synthèse, decisions_0.2.x, BACKLOG_V1.md,
            PREP_SPEC_TECHNIQUE_V1.md) — toujours la référence
            fonctionnelle pour la V1, malgré le nom du dossier.
  OLD/    — cadrage antérieur, non consulté activement.

supabase/
  migrations/  — 4 migrations versionnées, voir §3.
  config.toml  — supabase link vers le projet Supabase NEUF de la V1.

Aucun dossier lib/ ni aucune route applicative au-delà du scaffold — la
synchro (client, lib/sync, routes) est spécifiée par T4 mais son code arrive
avec T6, après le moteur de scoring T5.
```

## 5. Conventions de travail — l'essentiel (détail complet dans JOURNAL_SESSIONS.md)

```text
- Utilisateur DÉBUTANT (découvre Supabase/Next.js/VS Code/Git au fil du
  prototype) : chaque action expliquée (quoi/pourquoi/comment), une à la
  fois, confirmation avant de continuer. Commandes Git une par une.
- Toute migration SQL passe par supabase/migrations/ (fichier versionné,
  nommage `<timestamp>_nom.sql`) + `npx supabase db push`, jamais par un
  copier-coller manuel dans l'éditeur SQL Supabase. Toujours montrer le
  contenu intégral de la migration et attendre une confirmation EXPLICITE
  avant `db push` — suivi sans exception sur les 4 migrations de cette
  session.
- Toute validation serveur doit recalculer ses propres garde-fous depuis la
  base, jamais supposer que l'affichage client correspond aux données
  officielles (leçon du prototype, reconduite en V1).
- Fichiers de suivi (dont celui-ci) : toujours régénérés en entier au moment
  où on les met à jour, jamais résumés/coupés silencieusement.
```

## 6. Config à faire au déploiement — pas encore faite

```text
- Dashboard Supabase : désactiver « Confirm email » (accès immédiat au
  compte après inscription, C4 — rappel laissé dans la migration #2).
- Écrire la migration de seed du 1er admin (A4), une fois le 1er pseudo réel
  connu (update users set role='ADMIN' where pseudo=... — désormais possible
  sans blocage grâce à la migration #4).
```

## 7. Pièges techniques déjà rencontrés (V1)

```text
- Un trigger BEFORE UPDATE en SECURITY DEFINER qui vérifie is_admin() via
  auth.uid() est bloquant en contexte SYSTÈME (SQL Editor super-utilisateur,
  service_role, seed de migration) : auth.uid() y est NULL, donc toute garde
  fondée dessus échoue par défaut. Une garde de ce type doit explicitement
  laisser passer le cas auth.uid() IS NULL (la RLS bloque déjà les écritures
  anon/non authentifiées en amont) — sinon des opérations légitimes
  d'administration système (comme le seed du 1er admin) sont bloquées à
  tort. Trouvé en jouant le plan de test RLS T3 §7 (migration #4).

Pièges génériques du prototype (Postgres/Git/PowerShell, toujours valables en
principe) non recopiés ici pour éviter la duplication — voir l'historique du
dépôt `nba-pronos-proto` s'ils resurgissent en V1.
```
