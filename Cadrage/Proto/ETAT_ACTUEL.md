# NBA Pronos — État actuel (V1)

> **Nature** : instantané de l'état RÉEL au moment de la dernière session — réécrit
> entièrement à chaque fois, jamais complété. Pour l'historique, voir
> `JOURNAL_SESSIONS.md`. Pour les points en suspens, voir `GAPS_OUVERTS.md`.
> Ne contient pas les règles fonctionnelles (synthèse + `decisions_0.2.x`).
>
> Dernière mise à jour : session du 21/07/2026 (suite — premier écran joueur
> codé). Trois lots enchaînés dans la même session : consolidation design
> (icônes de nav, logos, bandeau) → consolidation des tokens de production
> (`app/tokens.css`) → **implémentation de l'écran Accueil** (`app/(app)/home`,
> layout 4 onglets, `lib/queries/home.ts`, `components/home/*`). C'est le
> **premier écran joueur codé et stylé aux tokens** de la V1 — détail en §2.4.
> Base toujours vide (aucune compétition créée) → l'Accueil s'affiche
> actuellement en **état vide global** (« Aucune compétition en cours ») :
> c'est le rendu correct pour cet état, pas un bug.

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
              + connexion CODÉS et vérifiés (§2.1).
RLS         : ACTIVE sur les 15 tables publiques, testée de bout en bout (T3).
Styles      : CSS Modules colocalisés par composant (`*.module.css`), lisant
              exclusivement les tokens sémantiques de `app/tokens.css` (aucune
              valeur en dur) — convention posée par l'écran Accueil (§2.4),
              à reconduire sur les écrans suivants. Tailwind (présent au
              projet) reste utilisé tel quel pour les écrans PAS ENCORE
              stylés selon T7 (login/signup, non retouchés).
```

## 2. Avancement

```text
Phase V1 — la série de specs techniques T1 → T7 est VALIDÉE. Le socle de
données (modèle + auth + RLS) est posé et codé (§3). L'IMPLÉMENTATION DES
ÉCRANS EST EN COURS (§2.1/§2.4) : plomberie Supabase + auth fonctionnelle,
ET DÉSORMAIS le premier écran joueur (Accueil) sont codés et vérifiés.
Restent à coder : hub Jouer (matchs/bracket/paris/mes pronos), classement +
bracket partagés, écrans admin.
```

### 2.1 Ce qui est CODÉ et VÉRIFIÉ (session du 19/07/2026, inchangé depuis)

```text
.env.local (hors dépôt, déjà couvert par .gitignore) : URL + anon key +
  service_role key du projet Supabase V1 (saisies par l'utilisateur
  directement dans l'éditeur, jamais collées dans le chat) ; SYNC_SECRET
  généré côté Claude (crypto.randomBytes(32), 64 caractères hex).

Paquets installés : @supabase/ssr, @supabase/supabase-js, server-only.
AUCUNE nouvelle dépendance ajoutée depuis (écran Accueil compris, §2.4).

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
  tokens visuels T7 — non retouchés par le lot Accueil, §2.4).

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

### 2.2 Correctif de conception trouvé et tranché (T6a §3, session du 19/07/2026)

```text
L'arbre app/ validé par T6a plaçait leaderboard/page.tsx (et bracket/page.tsx)
à la fois dans (public)/ et dans (app)/ — les route groups étant invisibles
dans l'URL, les deux fichiers auraient résolu la MÊME route /leaderboard :
erreur de build Next.js documentée (« Conflicting paths »), jamais testée
avant le codage puisque T6a n'avait produit aucun code. Tranché avec
l'utilisateur (AskUserQuestion) : route physique UNIQUE, hors des deux route
groups (app/leaderboard/page.tsx, app/bracket/page.tsx). app/leaderboard/
page.tsx est désormais CRÉÉE (stub, §2.4) ; app/bracket/page.tsx reste à
créer (pas un onglet de nav, non nécessaire pour éviter un 404 sur la barre).
SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_a.md corrigé en conséquence (§3, §3.2,
§4.1, §7 — correctifs marqués explicitement « post-validation »). 2 autres
correctifs mineurs du même ordre : middleware.ts → proxy.ts (Next.js 16),
getServerClient() rendu async (cookies() asynchrone).
```

### 2.3 Consolidation design + tokens (session du 20-21/07/2026, inchangé depuis)

```text
Passe maquettes (20/07/2026) : T7 éprouvée sur des maquettes HTML jetables,
hors dépôt. Amendement V0.2 de SPEC_DESIGN_SYSTEM_V0_1.md (§15 : accent figé,
rayons « niveau C / net », nouveau token --color-trend).

Consolidation (21/07/2026, avant le lot Accueil) :
- Logos de franchise → SVG bundlés dans public/logos/teams/ (déposés par
  l'utilisateur, pas par Claude). Fallback réel = abréviation en texte.
- Icônes de nav CRÉÉES (components/icons/nav-icons.tsx, variante B « nette » :
  HomeIcon/PlayIcon/RankingIcon/ProfileIcon, currentColor, server component) —
  CÂBLÉES pour la première fois par le lot Accueil (§2.4, components/nav/TabBar.tsx).
- app/tokens.css ÉCRIT (premier fichier de tokens de production, P-DS7, dark
  sur :root + override [data-theme="light"]), importé par app/globals.css —
  CONSOMMÉ pour la première fois par le lot Accueil (§2.4).
- public/brand/ : convention posée pour hero-parquet.webp, aucun binaire
  ajouté (pas utilisé par l'écran Accueil).
```

### 2.4 Écran Accueil — CODÉ cette session (21/07/2026, nouveau)

```text
Périmètre : app/(app)/layout.tsx (nav 4 onglets + garde session) et
app/(app)/home/page.tsx (SPEC_ECRAN_ACCUEIL_V0.1.md, Cadrage/V1/Spec visuelle/).
Premier écran joueur qui coud ensemble données + layout + tokens de
production — voir aussi §7 (pièges/déductions de cette session).

Fichiers créés :
- app/(app)/layout.tsx + layout.module.css : garde de session (redirect
  /login), coquille de page (fond/texte pilotés par les tokens quel que
  soit globals.css), rend <TabBar/>.
- components/nav/TabBar.tsx ("use client", + TabBar.module.css) : barre 4
  onglets Accueil/Jouer/Classement/Profil, onglet actif via usePathname()
  (--color-accent + pastille --color-accent-soft), inactif --color-text-muted,
  icônes en currentColor (aucune couleur passée en prop), cible tactile
  --tap-target-min. SEULE raison d'un "use client" en dehors de Countdown
  (état "onglet actif" = chemin courant, autorisé explicitly par la spec §1).
- lib/queries/home.ts : getHomeData() — toute la lecture de l'écran via
  getServerClient() (RLS seule autorité). Types figés HomeHeader/TodoItem/
  FeedItem/HomeData conformes au contrat de la spec §7. Constantes
  FEED_WINDOW_HOURS=48, FEED_MAX_ITEMS=5.
- components/home/Countdown.tsx ("use client", + .module.css) : SEULE
  feuille client de l'écran home/. Bascule libellé large (>1h, figé) /
  décompte vivant (≤1h, mm:ss) / verrouillé (=0, action désactivée sur
  place). Aucun Date.now() pendant le rendu initial (état null jusqu'au
  montage) → zéro décalage d'hydratation possible par construction. Ré-arme
  son propre minuteur (bascule automatique sous 1h), jamais de
  revalidatePath.
- components/home/{HomeHeader,TodoList,TodoRow,Feed,FeedRow,EmptyState}.tsx
  (+ .module.css chacun) : composants serveur, purement présentationnels
  (props uniquement, aucun accès donnée).
- app/(app)/home/page.tsx + page.module.css : compose en-tête → À traiter
  (+ bloc admin si non vide) → Ça vient de tomber ; état vide global si
  competitionId === null.
- Stubs minimaux (pour que les 4 onglets ne 404 pas, PAS stylés, lot
  suivant) : app/(app)/play/page.tsx, app/(app)/profile/page.tsx,
  app/leaderboard/page.tsx (route physique unique, hors route groups —
  cohérent avec §2.2 ; pas de nav dupliquée à ce stade, lot Classement).

Vérifié : `npx tsc --noEmit`, `npx eslint .`, `npx next build` tous propres
(build de prod réussi, /home et /play et /profile en rendu dynamique —
attendu, dépendent de la session ; /leaderboard statique pour l'instant,
stub sans lecture).

Non testé en conditions réelles (base vide, §3) : le rendu avec une
compétition ACTIVE réelle (en-tête chiffré, items « À traiter », feed) — à
vérifier dès qu'une compétition + des données de test existeront. Le rendu
actuellement observable est l'état vide global, correct pour une base sans
compétition.
```

### 2.5 Prochaine étape

```text
Dans l'ordre déjà acté : app/leaderboard (classement, lecture+rendu partagés
visiteur/joueur, T6a §3.2) puis app/bracket (bracket global), puis le reste
du hub Jouer (matchs, bracket personnel, paris, mes pronos, stylés aux
tokens sur le même patron que l'écran Accueil), puis les écrans admin, puis
T8 (déploiement).
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
   publiques ; policies SELECT/INSERT/UPDATE ; triggers d'invariants.
4. 20260718120000_fix_users_trigger_system_context.sql — correctif de
   enforce_users_invariants() : contexte système (auth.uid() NULL) désormais
   laissé passer sans garde.

RLS vérifiée de bout en bout via le plan de test T3 §7. Tout conforme.

Base VIDE de données opérationnelles (aucune compétition, aucun utilisateur
créé) — l'écran Accueil (§2.4) n'a donc encore été observé qu'en état vide
global ; c'est le rendu correct pour cet état, pas un signe d'anomalie.

Aucune migration touchée cette session (21/07/2026, lot Accueil compris) :
aucun nom de colonne ni valeur de statut inventé — tout lu dans le schéma
réel (détail des déductions faites en §7).
```

## 4. Fichiers du projet — carte rapide

```text
app/
  layout.tsx, favicon.ico, page.tsx — scaffold create-next-app, non modifiés.
  tokens.css — tokens de production (P-DS7), CONSOMMÉ par l'écran Accueil.
  globals.css — @import "./tokens.css" en tête ; contenu existant inchangé.
  (public)/
    layout.tsx, login/page.tsx, signup/page.tsx — CODÉS (T2 §4), pas encore
      stylés selon T7 (non retouchés par le lot Accueil).
    reset-password/ — dossier créé, PAGE PAS ENCORE ÉCRITE (T2 §8).
  (app)/                — NOUVEAU (session du 21/07/2026).
    layout.tsx + layout.module.css — garde session + nav 4 onglets. CODÉ.
    home/
      page.tsx + page.module.css — écran Accueil. CODÉ.
    play/page.tsx         — stub « à venir », PAS stylé.
    profile/page.tsx      — stub « à venir », PAS stylé.
  leaderboard/page.tsx  — NOUVEAU. Route physique unique hors route groups
    (§2.2). Stub « à venir », PAS stylé, pas de nav dupliquée (lot suivant).
  (admin)/               — PAS ENCORE CRÉÉ.

proxy.ts               — garde d'authentification (T6a §4.1, corrigé §2.2). CODÉ.

lib/
  supabase/{browser,server,service}.ts — les 3 clients (T6a §2.4). CODÉ.
  auth/actions.ts                      — login/signup/logout (T2 §4). CODÉ.
  queries/
    home.ts — NOUVEAU (session du 21/07/2026). getHomeData() + types
      HomeHeader/TodoItem/FeedItem/HomeData. CODÉ.
  scoring/, sync/ — PAS ENCORE CRÉÉS.

components/
  auth/{LoginForm,SignupForm}.tsx — pas encore stylés selon T7.
  icons/nav-icons.tsx — 4 icônes de nav (T7), CÂBLÉES pour la première fois
    par components/nav/TabBar.tsx cette session.
  nav/
    TabBar.tsx + TabBar.module.css — NOUVEAU. Barre 4 onglets, "use client"
      (état "onglet actif" uniquement). CODÉ.
  home/ — NOUVEAU (session du 21/07/2026), tous CODÉS :
    Countdown.tsx (+ .module.css)     — SEULE feuille "use client" de home/.
    HomeHeader.tsx (+ .module.css)    — en-tête rang/points.
    TodoList.tsx / TodoRow.tsx (+ .module.css chacun) — bloc « À traiter »
      (et « À traiter (admin) », même composants, item.kind distingue).
    Feed.tsx / FeedRow.tsx (+ .module.css chacun) — bloc « Ça vient de tomber ».
    EmptyState.tsx (+ .module.css)    — états vides génériques (libellés en props).

public/
  logos/teams/, brand/ — arborescence posée (session du 21/07/2026), fichiers
    binaires réels toujours à la charge de l'utilisateur.

Cadrage/
  V1/     — specs techniques V1 validées (T1→T7) + Spec visuelle/
            SPEC_ECRAN_ACCUEIL_V0_1.md (close, appliquée cette session).
  Proto/  — fichiers de suivi (ce fichier, JOURNAL_SESSIONS.md,
            GAPS_OUVERTS.md) + cadrage fonctionnel hérité du prototype.
  OLD/    — cadrage antérieur, non consulté activement.

supabase/
  migrations/  — 4 migrations versionnées, voir §3. Aucune ajoutée cette
    session (aucune migration nécessaire pour l'écran Accueil).
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
  pas seulement écrite sur disque. Vaut aussi pour le CODE : Claude ne
  committe jamais automatiquement (l'utilisateur committe lui-même, une
  commande à la fois), mais rappelle explicitement en fin de session la
  commande à lancer.
- Clés/secrets API : jamais collés en clair dans le chat — l'utilisateur les
  saisit directement dans les fichiers (.env.local) via l'éditeur.
- Avant d'écrire du code Next.js, vérifier node_modules/next/dist/docs/ pour
  les ruptures de convention propres à cette version (AGENTS.md).
- Aucun asset binaire (logo, image de maquette) n'est ajouté par Claude au
  dépôt : seule l'arborescence (dossiers, .gitkeep, README de convention) est
  créée ; l'utilisateur dépose lui-même les fichiers réels.
- Écrans de lecture (Accueil et suivants) : AUCUNE valeur visuelle en dur
  (couleur/rayon/espacement/typo/ombre) — uniquement via les tokens de
  app/tokens.css, via CSS Modules colocalisés par composant (acté au lot
  Accueil, §1/§2.4). Composants serveur par défaut ; un "use client" doit
  être justifié explicitement (interaction ou horloge locale uniquement).
- Noms de colonnes/valeurs de statut absents d'une spec produit : LIRE le
  schéma réel (migrations/RLS) avant d'écrire la moindre requête, jamais
  deviner. En cas d'ambiguïté réelle entre deux lectures possibles d'une
  spec (ex. libellé vs colonne citée), s'arrêter et demander plutôt que
  choisir en silence (cf. §7, décision du feed « pari statué »).
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
- Déposer les vrais fichiers : les 30 SVG de public/logos/teams/ (nommés par
  abréviation) et l'image réelle de public/brand/hero-parquet.webp — tous
  deux à la charge de l'utilisateur, pas de Claude.
```

## 7. Pièges techniques déjà rencontrés (V1)

```text
- Un trigger BEFORE UPDATE en SECURITY DEFINER qui vérifie is_admin() via
  auth.uid() est bloquant en contexte SYSTÈME (auth.uid() NULL) — la garde
  doit explicitement laisser passer ce cas. Trouvé au test RLS T3 §7
  (migration #4).

- Next.js 16 renomme middleware.ts en proxy.ts (export nommé `proxy`) —
  comportement identique, mais middleware.ts serait aujourd'hui
  silencieusement ignoré. Toujours vérifier node_modules/next/dist/docs/
  avant d'écrire un fichier dont le nom fait partie des conventions Next.js.

- cookies() de next/headers est asynchrone depuis Next.js 15/16 : toute
  fonction qui l'utilise (dont getServerClient()) doit être async.

- Route groups Next.js : deux fichiers page.tsx dans des groupes différents
  qui résolvent à la MÊME URL font planter le build (« Conflicting paths »).
  Corrigé §2.2.

- Compte à rebours hydraté (Countdown.tsx, session du 21/07/2026) : un
  composant "use client" est quand même rendu côté SERVEUR pour le HTML
  initial (SSR), puis réexécuté côté client à l'hydratation — appeler
  Date.now() directement dans le corps du rendu produirait donc deux valeurs
  différentes (heure serveur vs heure client, écart réseau) et un décalage
  d'hydratation, surtout visible en mode « décompte vivant » (secondes).
  Résolu en ne lisant JAMAIS l'horloge pendant le rendu : l'état est `null`
  jusqu'au montage, la vraie valeur n'arrive que via un effet (`useEffect`) —
  premier rendu serveur et premier rendu client sont donc TEXTUELLEMENT
  identiques par construction, pas seulement « proches ».

- Déduction de schéma — deadline du bracket absente : `competitions.
  bracket_deadline` est nullable (date pas encore connue). Aucune règle
  produit ne précise ce cas pour l'item « À traiter » du bracket : décision
  d'implémentation prise (pas dans une spec) — tant que bracket_deadline est
  NULL, l'item bracket n'apparaît PAS (rien à compter à rebours). À
  confirmer si ce cas se présente réellement en usage (item ouvert dans
  GAPS_OUVERTS.md).

- Ambiguïté de spec résolue avec l'utilisateur (AskUserQuestion, session du
  21/07/2026) : SPEC_ECRAN_ACCUEIL §6 nomme la source `bets.resolved_at`
  pour l'item de feed « Pari statué par l'admin » mais illustre le rendu par
  le texte « validé / ajusté », qui correspond en réalité au workflow de
  VALIDATION (`validated_at`, différent de `resolved_at`). Tranché : lecture
  littérale de la colonne citée dans le tableau (`resolved_at`) → l'item
  correspond aux paris ANNULÉS (CANCELLED), cohérente avec la règle
  « neutralisé, jamais rouge » déjà actée ailleurs (0.2.4 §4, 0.2.9 §7,
  T6c §4). Libellé rendu : « Neutralisé » (pas « validé/ajusté », qui ne
  correspond à aucun état atteint par cette colonne).

Pièges génériques du prototype (Postgres/Git/PowerShell, toujours valables en
principe) non recopiés ici pour éviter la duplication — voir l'historique du
dépôt `nba-pronos-proto` s'ils resurgissent en V1.
```
