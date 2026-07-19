# NBA Pronos — État actuel (V1)

> **Nature** : instantané de l'état RÉEL au moment de la dernière session — réécrit
> entièrement à chaque fois, jamais complété. Pour l'historique, voir
> `JOURNAL_SESSIONS.md`. Pour les points en suspens, voir `GAPS_OUVERTS.md`.
> Ne contient pas les règles fonctionnelles (synthèse + `decisions_0.2.x`).
>
> Dernière mise à jour : session du 19/07/2026 — specs T6a/T6b/T6c
> (architecture Next.js) et T7 (design system) produites et validées. La
> série de specs techniques **T1 → T7 est désormais entièrement bouclée**.
> Ce fichier ne décrit plus l'état du prototype (`nba-pronos-proto`, dépôt
> séparé, intact en référence, D1) mais celui du dépôt V1 (`nba-pronos`).

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
Phase V1 — LA SÉRIE COMPLÈTE DE SPECS TECHNIQUES T1 → T7 EST VALIDÉE. Le
socle de données (modèle + auth + RLS) est posé ET codé (§3). Tout le reste
— synchro API, moteur de scoring, écrans, server actions, Realtime, design
tokens — est intégralement SPÉCIFIÉ mais PAS ENCORE CODÉ. AUCUN écran, AUCUNE
route applicative au-delà du scaffold Next.js par défaut n'existe encore
dans ce dépôt.

Spécifications techniques V1 produites et VALIDÉES, dans `Cadrage/V1/` :
  T1  — SPEC_TECHNIQUE_MODELE_DONNEES_V0.1.md
  T2  — SPEC_TECHNIQUE_AUTH_V0.1.md
  T3  — SPEC_TECHNIQUE_RLS_V0.1.md
  T4  — SPEC_TECHNIQUE_SYNCHRO_V0.1.md (synchro API Highlightly)
  T5  — SPEC_TECHNIQUE_SCORING_V0_1.md (moteur de scoring, barèmes Playoffs +
        NBA Cup)
  T6a — SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_a.md (arbre app/, route
        groups, stratégie de données, frontière d'écriture)
  T6b — SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_b.md (sealDeadlines, server
        actions joueur + garde-fou C2, actions admin, audit_logs)
  T6c — SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_c.md (Realtime en surcouche +
        rendu de tous les états actés)
  T7  — SPEC_DESIGN_SYSTEM_V0_1.md (design tokens : palette, typo,
        espacements, composants)

4 migrations écrites à partir de T1/T2/T3, appliquées et testées (détail §3).
T4, T5, T6a, T6b, T6c et T7 ne produisent AUCUNE migration (tables, colonnes
et policies déjà posées par T1/T3 ; le seul correctif de policy évoqué par
T6b §9.1 — bracket éditable même validé — est déjà porté par la migration #3
existante, vérifié).

Décisions synchro actées par T4 (implémentation à venir) :
  - Secret partagé : routes /api/sync/* et /api/heartbeat authentifiées par
    Bearer + variable d'env SYNC_SECRET.
  - Logos d'équipes téléchargés au sync /teams et hébergés dans un bucket
    Supabase Storage dédié (public en lecture) — pas de hotlink externe.
  - 30 mappings TEAM confirmés automatiquement, aucune revue admin nécessaire.
  - Horizon de la synchro /schedule : 4 jours (3 j de fenêtre de pronos + 1 j
    de marge).
  - Signal de recalcul : appel direct de recomputeMatch depuis lib/sync
    (transactionnel), après sealDeadlines (T6b §2, voir ci-dessous).
  - Attache match → série : BRANCHE B — structure créée par l'admin, matchs
    rattachés par heuristique (paire d'équipes + tour + fenêtre de dates),
    confirmés par l'admin.
  - Publication Realtime : matches ET series (resserré par T6c §14.2, voir
    ci-dessous) — activation DB à faire au déploiement (T8).

Décisions scoring actées par T5 (implémentation à venir) :
  - Moteur pur (lib/scoring/engine.ts, aucune I/O) : dérivation de l'agrégat
    de série depuis ses matchs, barème MATCH (10 + bonus d'écart), barème
    BRACKET Playoffs (vainqueur/score exact/affiche) et NBA Cup (vainqueur/
    affiche), barème PARIS linéaire (5/10/15/20/25) résolu par l'admin.
  - Neutralisation A2 (série annulée) : 0 pour tous sur la série elle-même,
    cascade naturelle sur les tours dépendants.
  - `writeSeriesOutcome` (lib/sync) = point d'écriture UNIQUE de
    series.official_* (C-2 intact) — appelé par la synchro (T4) et par les
    actions admin de résolution de série (T6b §5.5, A2).
  - Convention actée NULL (en attente) vs 0 (scoré-zéro/neutralisé) —
    déclinée en rendu à 3 cas par T6c §3 (« - » / « 0 » / « en attente »).

Décisions architecture Next.js actées par T6a/T6b/T6c (implémentation à venir) :
  - Stratégie de données : chaque écran = composant SERVEUR lisant via la
    session utilisateur ; la RLS (T3) est seule autorité de ce qui est reçu,
    le composant ne choisit que la mise en forme. Realtime en pure surcouche
    de l'état local client (jamais de revalidatePath déclenché par Realtime).
  - 3 clients Supabase (browser / server-session / privilégié service_role,
    ce dernier isolé dans un module server-only) — matérialisation de P2.
  - 3 route groups : (public) nav réduite, (app) 4 onglets (session requise),
    (admin) hub (session + is_admin()). Classement et bracket global
    partagent un seul module de lecture + un seul composant de rendu entre
    (public) et (app) (T6a §8) — aucune duplication.
  - Frontière d'écriture Option A : catégorie A = server action joueur en
    session (RLS garde-fou) ; catégorie B = server action admin-système
    (re-vérifie is_admin(), appelle un module privilégié pour
    recompute/writeSeriesOutcome) ; catégorie C = routes /api/sync/*
    inchangées (T4).
  - `sealDeadlines` (T6b §2) : scellage de deadline idempotent, exécuté en
    tête de /api/sync/results, sans coût API — condition d'entrée du
    scoring/de la visibilité pour les brouillons complets jamais basculés.
  - Garde-fou C2 étendu à la navigation interne App Router (en plus de
    beforeunload).
  - `LOCKED` (pronos match) confirmé état implicite, jamais écrit.
  - Realtime scopé à matches/series uniquement (pas match_predictions/bets/
    brackets/user_scores) — la révélation des pronos d'autrui suit le rendu
    serveur, jamais un poussé en direct (T6c §14.1, acté).
  - Rendu de tous les états UX déjà actés fonctionnellement mais jamais
    implémentés : convention A1 à 3 cas, paris annulés barrés/grisés,
    marquage public de correction, joueurs absents/inactifs, barre « toi »
    (>20 joueurs), bascule bracket résumé/arbre, tendances %/brut par série,
    classement (puces de tri, Total et rang toujours sur Total).

Décisions design system actées par T7 (implémentation à venir) :
  - Token-first, DARK par défaut, CLAIR = override de la même couche
    sémantique, deux registres d'énergie (ARÈNE / LECTURE).
  - Accent = orange broadcast (réversible, confiné aux tokens sémantiques).
  - Typographie : une seule famille open-source à chiffres tabulaires,
    auto-hébergée (extension de B4 « pas de hotlink »).
  - Pastille de logo neutre CONSTANTE hors thème (seule exception à
    l'override de thème).
  - Palette, typo, espacements/rayons/élévation, tokens du flash B7, badges,
    puces de tri, états spéciaux, accessibilité (WCAG AA, cibles ≥44px)
    entièrement posés.

Prochaine étape (ordre acté dans SPEC_TECHNIQUE_V0.1.md, désormais post-cadrage) :
  IMPLÉMENTATION — le 1er écran joueur codé (post-T7, B9/0.2.9 §2), qui
    consommera l'arbre/les server actions/le Realtime de T6a/T6b/T6c et les
    tokens visuels de T7. C'est le premier code applicatif du projet
    au-delà du socle de données (§3). PROCHAINE ÉTAPE.
  T8 — Déploiement (Vercel, variables d'env, secrets, configuration du
    planificateur externe pour /api/sync/* et /api/heartbeat).
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
créé) — normal, aucun écran d'inscription ni d'administration n'existe
encore.
```

## 4. Fichiers du projet — carte rapide

```text
Scaffold par défaut de `create-next-app`, non modifié depuis (app/layout.tsx,
app/page.tsx, app/globals.css, public/, config Next/TS/ESLint standard).

Cadrage/
  V1/     — specs techniques V1 validées : T1 (modèle de données), T2 (auth),
            T3 (RLS), T4 (synchro API), T5 (scoring), T6a/T6b/T6c
            (architecture Next.js : arbre, écritures, Realtime/rendu), T7
            (design system). Série T1→T7 complète, plus rien à écrire côté
            cadrage technique avant le codage des écrans.
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
synchro (client, lib/sync dont sealDeadlines), le moteur de scoring
(lib/scoring), l'arbre app/ (route groups, server actions), le Realtime et
les design tokens sont désormais tous SPÉCIFIÉS (T4/T5/T6a/T6b/T6c/T7) mais
leur code reste entièrement à écrire.
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
  ultérieure ; à surveiller pour les prochaines specs (aucune n'est prévue
  après T7, mais la vigilance vaut aussi pour les commits de CODE à venir).
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

Pièges génériques du prototype (Postgres/Git/PowerShell, toujours valables en
principe) non recopiés ici pour éviter la duplication — voir l'historique du
dépôt `nba-pronos-proto` s'ils resurgissent en V1.
```
