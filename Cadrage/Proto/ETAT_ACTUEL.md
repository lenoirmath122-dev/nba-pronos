# NBA Pronos — État actuel (V1)

> **Nature** : instantané de l'état RÉEL au moment de la dernière session — réécrit
> entièrement à chaque fois, jamais complété. Pour l'historique, voir
> `JOURNAL_SESSIONS.md`. Pour les points en suspens, voir `GAPS_OUVERTS.md`.
> Ne contient pas les règles fonctionnelles (synthèse + `decisions_0.2.x`).
>
> Dernière mise à jour : session du 19/07/2026 (suite) — démarrage réel du CODE,
> post-T7. La série de specs T1 → T7 reste entièrement bouclée et validée
> (inchangée depuis la mise à jour précédente). Premier code applicatif écrit :
> les 3 clients Supabase, le proxy (garde d'authentification), et l'auth
> fonctionnelle (login + signup), vérifiés en conditions réelles (build +
> serveur dev). Un bug de conception a été trouvé dans T6a §3 au premier
> contact avec le code réel (conflit de route `/leaderboard`) et corrigé avec
> l'utilisateur — détail en §2 et dans `JOURNAL_SESSIONS.md`.

---

## 1. Contexte technique

```text
Stack       : Next.js 16.2.10 (Turbopack, App Router, TypeScript) + Supabase
              (Postgres). Next.js 16 a des ruptures par rapport aux
              conventions plus anciennes (AGENTS.md) — vérifié dans
              node_modules/next/dist/docs/ avant chaque brique de code
              nouvelle (ex. middleware.ts renommé proxy.ts, cookies()
              asynchrone).
Dépôt local : C:\dev\nba-pronos (sorti de OneDrive) — dépôt Git NEUF, projet
              Supabase NEUF (D1, session du 17/07/2026), distinct du
              prototype (`nba-pronos-proto`), qui reste intact et inchangé en
              référence.
Auth        : Supabase Auth (email + mot de passe), pont École A vers
              public.users via trigger SQL (T2) — voir §3. Flux d'inscription
              + connexion désormais CODÉS et vérifiés (§2).
RLS         : ACTIVE sur les 15 tables publiques, testée de bout en bout (T3).
```

## 2. Avancement

```text
Phase V1 — la série de specs techniques T1 → T7 est VALIDÉE (inchangée cette
session, hormis un correctif de forme sur T6a — voir plus bas). Le socle de
données (modèle + auth + RLS) est posé et codé (§3). L'IMPLÉMENTATION DES
ÉCRANS A COMMENCÉ (§2.1) : plomberie Supabase + auth fonctionnelle en place et
vérifiées ; aucun écran joueur (Accueil, Jouer, Classement, Profil, Admin)
n'existe encore.
```

**Passe design maquettes (session du 20/07/2026)** : T7 a été éprouvée sur des
écrans réels via des maquettes HTML jetables, hors dépôt de production.
Journal dédié : `Cadrage/V1/JOURNAL_DESIGN_passe_maquettes.md`. Cette passe a
produit un **amendement V0.2** de `SPEC_DESIGN_SYSTEM_V0_1.md` (§15 : accent
figé, barème de rayons « niveau C / net », biseau écarté, nouveau token
`--color-trend`) — amendements **en attente d'application au code** : aucun
token de production n'existe encore, aucun écran n'a été codé ou modifié par
cette passe. Le seul code applicatif reste celui décrit ci-dessous
(inchangé). Le prochain écran codé (§2.3) devra partir des tokens amendés.

### 2.1 Ce qui est CODÉ et VÉRIFIÉ cette session

```text
.env.local (hors dépôt, déjà couvert par .gitignore) : URL + anon key +
  service_role key du projet Supabase V1 (saisies par l'utilisateur
  directement dans l'éditeur, jamais collées dans le chat) ; SYNC_SECRET
  généré côté Claude (crypto.randomBytes(32), 64 caractères hex).

Paquets installés : @supabase/ssr, @supabase/supabase-js, server-only.

lib/supabase/{browser,server,service}.ts (T6a §2.4) : les 3 clients —
  getBrowserClient (anon, navigateur), getServerClient (anon + JWT cookies,
  ASYNC — correctif post-validation, cookies() est asynchrone en Next.js
  15/16), getServiceClient (service_role, module server-only, garde de build
  contre toute fuite côté navigateur).

proxy.ts (racine du repo) : garde d'AUTHENTIFICATION (T6a §4.1) — zones
  protégées /home, /play, /profile (app), /admin (admin) → redirigées vers
  /login sans session ; /login et /signup → redirigées vers /home AVEC
  session. Utilise supabase.auth.getUser() (revalidé serveur, pas
  getSession()). Nommé proxy.ts et pas middleware.ts : renommage Next.js 16
  (AGENTS.md), comportement strictement identique.

lib/auth/actions.ts + components/auth/{LoginForm,SignupForm}.tsx +
  app/(public)/{layout,login/page,signup/page}.tsx : flux complet de
  connexion et d'inscription (T2 §4) — vérif serveur du code compétition
  (verify_join_code RPC) puis du pseudo libre AVANT tout signUp, création de
  session, redirection /home. Formulaires minimalistes (pas encore les
  tokens visuels T7 — aucun écran n'est encore stylé selon le design system).

Vérifié en conditions réelles (build de prod + serveur dev, requêtes HTTP
  réelles) : /login et /signup rendent 200 avec les bons champs de
  formulaire ; /home, /play, /admin redirigent 307 vers /login sans session
  (garde proxy fonctionnelle) ; les assets statiques (favicon, etc.) ne sont
  pas bloqués par le matcher du proxy. `tsc --noEmit` et `eslint .` propres,
  `next build` réussi.

Pas encore vérifié : le flux d'inscription/connexion RÉEL contre la base
  Supabase (code compétition existant, création de compte bout en bout) —
  aucune compétition n'existe encore en base (§3), donc verify_join_code
  renverrait NULL pour l'instant. À tester dès qu'une compétition + son
  join_code existeront.
```

### 2.2 Correctif de conception trouvé et tranché cette session (T6a §3)

```text
L'arbre app/ validé par T6a plaçait leaderboard/page.tsx (et bracket/page.tsx)
à la fois dans (public)/ et dans (app)/ — les route groups étant invisibles
dans l'URL, les deux fichiers auraient résolu la MÊME route /leaderboard :
erreur de build Next.js documentée (« Conflicting paths »), jamais testée
avant le codage puisque T6a n'avait produit aucun code. Tranché avec
l'utilisateur (AskUserQuestion) : route physique UNIQUE, hors des deux route
groups (app/leaderboard/page.tsx, app/bracket/page.tsx — PAS ENCORE CODÉES),
qui choisira elle-même la nav (réduite vs 4 onglets) selon la présence d'une
session. Aucune règle de lecture/RLS/rendu déjà actée n'est modifiée.
SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_a.md corrigé en conséquence (§3, §3.2,
§4.1, §7 — correctifs marqués explicitement « post-validation »). 2 autres
correctifs mineurs du même ordre : middleware.ts → proxy.ts (Next.js 16),
getServerClient() rendu async (cookies() asynchrone).
```

### 2.3 Prochaine étape

```text
IMPLÉMENTATION — l'écran Accueil (app/(app)/home/page.tsx, 0.2.9 §3 : bloc
  « À traiter » trié par urgence + « Ça vient de tomber ») : le premier VRAI
  écran joueur, celui visé depuis le départ par « 1er écran joueur codé »
  (post-T7, B9/0.2.9 §2). Nécessite au passage app/(app)/layout.tsx (nav 4
  onglets, T6a §3.1).
Ensuite, dans l'ordre déjà acté : app/leaderboard + app/bracket (route
  unique corrigée §2.2), puis le reste du hub Jouer (matchs, bracket
  personnel, paris, mes pronos), puis les écrans admin, puis T8
  (déploiement).
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
   publiques ; policies SELECT/INSERT/UPDATE (dont brackets/bracket_picks
   éditables tant que la deadline n'est pas passée, validé ou non — conforme
   à la remontée actée par T6b §9.1, déjà en place dans cette migration) ;
   triggers d'invariants (enforce_users_invariants,
   enforce_match_prediction_transitions, enforce_bet_transitions,
   enforce_prediction_correction).
4. 20260718120000_fix_users_trigger_system_context.sql — correctif de
   enforce_users_invariants() : contexte système (auth.uid() NULL) désormais
   laissé passer sans garde, sinon le seed du 1er admin (A4) aurait été
   bloqué. Bug trouvé au test RLS (T3 §7).

RLS vérifiée de bout en bout via le plan de test T3 §7 (anon / joueur A /
joueur B / admin) : lectures publiques correctes, règle « valider = voir »
sur les pronos match, verrouillage à l'heure du match, écritures illégales
toutes refusées. Tout conforme.

Base VIDE de données opérationnelles (aucune compétition, aucun utilisateur
créé) — normal, aucun écran d'inscription ni d'administration n'existait
avant cette session ; l'inscription est maintenant CODÉE (§2.1) mais ne peut
pas encore être testée bout en bout faute de compétition existante.
```

## 4. Fichiers du projet — carte rapide

```text
app/
  layout.tsx, globals.css, favicon.ico, page.tsx — scaffold create-next-app,
    non modifiés (page.tsx reste la page par défaut, hors périmètre de cette
    session).
  (public)/
    layout.tsx        — nav réduite (Classement · Bracket · Se connecter).
    login/page.tsx     — connexion, CODÉ + vérifié.
    signup/page.tsx    — inscription, CODÉ + vérifié.
    reset-password/    — dossier créé, PAGE PAS ENCORE ÉCRITE (T2 §8).
  (app)/ et (admin)/   — PAS ENCORE CRÉÉS (prochaine étape : (app)/home, §2.3).

proxy.ts               — garde d'authentification (T6a §4.1, corrigé §2.2). CODÉ.

lib/
  supabase/{browser,server,service}.ts — les 3 clients (T6a §2.4). CODÉ.
  auth/actions.ts                      — login/signup/logout (T2 §4). CODÉ.
  queries/, scoring/, sync/            — PAS ENCORE CRÉÉS.

components/
  auth/{LoginForm,SignupForm}.tsx — formulaires minimalistes, PAS ENCORE
    stylés selon T7 (aucun token visuel appliqué nulle part dans le code
    pour l'instant).

Cadrage/
  V1/     — specs techniques V1 validées : T1 (modèle de données), T2 (auth),
            T3 (RLS), T4 (synchro API), T5 (scoring), T6a/T6b/T6c
            (architecture Next.js : arbre, écritures, Realtime/rendu — T6a
            corrigée cette session, §2.2), T7 (design system). Série T1→T7
            complète, plus rien à écrire côté cadrage technique avant le
            codage des écrans (les correctifs de §2.2 sont des corrections de
            forme post-validation, pas une réouverture de décisions de fond).
  Proto/  — fichiers de suivi (ce fichier, JOURNAL_SESSIONS.md,
            GAPS_OUVERTS.md) + tout le cadrage fonctionnel hérité du
            prototype (synthèse, decisions_0.2.x, BACKLOG_V1.md,
            PREP_SPEC_TECHNIQUE_V1.md) — toujours la référence
            fonctionnelle pour la V1, malgré le nom du dossier.
  OLD/    — cadrage antérieur, non consulté activement.

supabase/
  migrations/  — 4 migrations versionnées, voir §3.
  config.toml  — supabase link vers le projet Supabase NEUF de la V1.
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
  avant `db push`.
- Toute validation serveur doit recalculer ses propres garde-fous depuis la
  base, jamais supposer que l'affichage client correspond aux données
  officielles (leçon du prototype, reconduite en V1).
- Fichiers de suivi (dont celui-ci) : toujours régénérés en entier au moment
  où on les met à jour, jamais résumés/coupés silencieusement.
- Une spec technique validée doit être committée AU MOMENT de sa validation,
  pas seulement écrite sur disque — un oubli s'est produit deux fois (T4,
  puis T6a/T6b/T6c/T7) et rattrapé lors d'une resynchronisation de suivi
  ultérieure ; vaut aussi pour les commits de CODE désormais en cours — à
  vérifier avant de considérer une session terminée.
- Clés/secrets API : jamais collés en clair dans le chat (2 incidents avant
  cette session, cf. JOURNAL_SESSIONS.md 17/07 et 18/07) — l'utilisateur les
  saisit directement dans les fichiers (.env.local) via l'éditeur ; suivi
  cette session sans incident.
- Avant d'écrire du code Next.js, vérifier node_modules/next/dist/docs/ pour
  les ruptures de convention propres à cette version (AGENTS.md) — a permis
  de détecter le renommage middleware→proxy et l'asynchronicité de cookies()
  avant qu'ils ne cassent le build, plutôt qu'après.
```

## 6. Config à faire au déploiement — pas encore faite

```text
- Dashboard Supabase : désactiver « Confirm email » (accès immédiat au
  compte après inscription, C4 — rappel laissé dans la migration #2).
- Écrire la migration de seed du 1er admin (A4), une fois le 1er pseudo réel
  connu (update users set role='ADMIN' where pseudo=... — désormais possible
  sans blocage grâce à la migration #4).
- Activer la publication Realtime côté base sur matches ET series (T4 §9,
  resserré par T6c §14.2).
- Configurer le planificateur externe gratuit (cron-job.org / GitHub
  Actions) pour appeler /api/sync/teams, /api/sync/schedule,
  /api/sync/results et /api/heartbeat aux fréquences actées par T4/T8.
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

- Next.js 16 renomme middleware.ts en proxy.ts (export nommé `proxy` au lieu
  de `middleware`) — comportement identique, mais un fichier middleware.ts
  serait aujourd'hui silencieusement ignoré (pas d'erreur, juste aucune
  garde appliquée). Toujours vérifier node_modules/next/dist/docs/ avant
  d'écrire un fichier dont le nom fait partie des conventions Next.js.

- cookies() de next/headers est asynchrone depuis Next.js 15/16 : toute
  fonction qui l'utilise (dont getServerClient()) doit être async, contraire
  à une signature synchrone qui semblerait naturelle en lisant seulement T6a.

- Route groups Next.js : deux fichiers page.tsx dans des groupes différents
  qui résolvent à la MÊME URL (ex. (public)/leaderboard et (app)/leaderboard)
  font planter le build (« Conflicting paths »). Un arbre de routes avec
  route groups doit être vérifié URL par URL, pas juste par chemin de
  fichier — piège trouvé dans T6a §3, corrigé (§2.2 ci-dessus).

Pièges génériques du prototype (Postgres/Git/PowerShell, toujours valables en
principe) non recopiés ici pour éviter la duplication — voir l'historique du
dépôt `nba-pronos-proto` s'ils resurgissent en V1.
```
