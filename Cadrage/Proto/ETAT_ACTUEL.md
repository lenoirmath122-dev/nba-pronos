# NBA Pronos — État actuel (V1)

> **Nature** : instantané de l'état RÉEL au moment de la dernière session — réécrit
> entièrement à chaque fois, jamais complété. Pour l'historique, voir
> `JOURNAL_SESSIONS.md`. Pour les points en suspens, voir `GAPS_OUVERTS.md`.
> Ne contient pas les règles fonctionnelles (synthèse + `decisions_0.2.x`).
>
> Dernière mise à jour : session du 22/07/2026 (Classement + Bracket, écrans
> partagés visiteur/joueur). Suite directe du lot Accueil (21/07/2026) :
> mêmes conventions (composants serveur par défaut, CSS Modules + tokens,
> RLS seule autorité de lecture) reconduites sur deux nouveaux écrans, plus
> une bascule bracket vue A/vue B (résumé ↔ arbre plein viewport). Base
> toujours vide (aucune compétition créée) → les deux écrans s'affichent
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
              asynchrone, searchParams désormais une Promise).
Dépôt local : C:\dev\nba-pronos (sorti de OneDrive) — dépôt Git NEUF, projet
              Supabase NEUF (D1, session du 17/07/2026), distinct du
              prototype (`nba-pronos-proto`), qui reste intact et inchangé en
              référence.
Auth        : Supabase Auth (email + mot de passe), pont École A vers
              public.users via trigger SQL (T2) — voir §3. Flux d'inscription
              + connexion CODÉS et vérifiés (§2.1).
RLS         : ACTIVE sur les 15 tables publiques, testée de bout en bout (T3).
              Consommée directement par les écrans de lecture (Accueil,
              Classement, Bracket) via les vues `security_invoker`
              `user_scores`/`user_recent_form` : la confidentialité
              pré-deadline du bracket et la visibilité « valider = voir »
              des pronos/paris viennent de la RLS elle-même, pas d'un filtre
              applicatif (§2.5).
Styles      : CSS Modules colocalisés par composant (`*.module.css`), lisant
              exclusivement les tokens sémantiques de `app/tokens.css` (aucune
              valeur en dur) — convention posée par l'écran Accueil (§2.4),
              reconduite sur Classement/Bracket (§2.5) et sur la nav partagée
              (`components/nav/{PublicNav,ScreenShell}.tsx`, §2.5). Tailwind
              (présent au projet) reste utilisé tel quel pour les écrans PAS
              ENCORE stylés selon T7 (login/signup, non retouchés).
```

## 2. Avancement

```text
Phase V1 — la série de specs techniques T1 → T7 est VALIDÉE. Le socle de
données (modèle + auth + RLS) est posé et codé (§3). L'IMPLÉMENTATION DES
ÉCRANS EST EN COURS : plomberie Supabase + auth fonctionnelle, l'écran
Accueil, ET DÉSORMAIS les écrans partagés Classement et Bracket sont codés
et vérifiés. Restent à coder : hub Jouer (matchs/bracket personnel/paris/
mes pronos), écrans admin.
```

### 2.1 Ce qui est CODÉ et VÉRIFIÉ (session du 19/07/2026, inchangé depuis)

```text
.env.local (hors dépôt, déjà couvert par .gitignore) : URL + anon key +
  service_role key du projet Supabase V1 (saisies par l'utilisateur
  directement dans l'éditeur, jamais collées dans le chat) ; SYNC_SECRET
  généré côté Claude (crypto.randomBytes(32), 64 caractères hex).

Paquets installés : @supabase/ssr, @supabase/supabase-js, server-only.
AUCUNE nouvelle dépendance ajoutée depuis (écrans Accueil et
Classement/Bracket compris, §2.4/§2.5).

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
  (AGENTS.md), comportement strictement identique. Ne garde PAS
  /leaderboard ni /bracket (routes physiques hors des groupes (public)/(app),
  T6a §3.2/§8.1) — ces deux écrans lisent la session eux-mêmes (§2.5) pour
  choisir leur nav, jamais pour filtrer leurs données (la RLS s'en charge).

lib/auth/actions.ts + components/auth/{LoginForm,SignupForm}.tsx +
  app/(public)/{layout,login/page,signup/page}.tsx : flux complet de
  connexion et d'inscription (T2 §4) — vérif serveur du code compétition
  (verify_join_code RPC) puis du pseudo libre AVANT tout signUp, création de
  session, redirection /home. Formulaires minimalistes (pas encore les
  tokens visuels T7 — non retouchés par les lots Accueil/Classement/Bracket).
  `app/(public)/layout.tsx` rend désormais `<PublicNav/>` (§2.5) au lieu
  d'un bloc de nav inline en Tailwind.

Vérifié en conditions réelles (build de prod + serveur dev déjà lancé par
  l'utilisateur, requêtes HTTP réelles) : /login et /signup rendent 200 avec
  les bons champs de formulaire ; /home, /play, /admin redirigent 307 vers
  /login sans session (garde proxy fonctionnelle) ; /leaderboard et /bracket
  rendent 200 pour un visiteur anonyme, affichent la nav réduite (« Se
  connecter » présent, pas la barre 4 onglets) et l'état vide global (base
  sans compétition) ; les assets statiques (favicon, etc.) ne sont pas
  bloqués par le matcher du proxy. `tsc --noEmit` et `eslint .` propres,
  `next build` réussi, aucun conflit de route.

Pas encore vérifié : le flux d'inscription/connexion RÉEL contre la base
  Supabase (code compétition existant, création de compte bout en bout), et
  le rendu de tous les écrans de lecture (Accueil/Classement/Bracket) AVEC
  une compétition ACTIVE réelle et des joueurs — aucune compétition n'existe
  encore en base (§3). À tester dès qu'une compétition + des données de test
  existeront.
```

### 2.2 Correctif de conception trouvé et tranché (T6a §3, session du 19/07/2026)

```text
L'arbre app/ validé par T6a plaçait leaderboard/page.tsx (et bracket/page.tsx)
à la fois dans (public)/ et dans (app)/ — les route groups étant invisibles
dans l'URL, les deux fichiers auraient résolu la MÊME route /leaderboard :
erreur de build Next.js documentée (« Conflicting paths »), jamais testée
avant le codage puisque T6a n'avait produit aucun code. Tranché avec
l'utilisateur (AskUserQuestion) : route physique UNIQUE, hors des deux route
groups (app/leaderboard/page.tsx, app/bracket/page.tsx) — les DEUX fichiers
sont désormais CRÉÉS et codés (§2.5). SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_a.md
corrigé en conséquence (§3, §3.2, §4.1, §7 — correctifs marqués explicitement
« post-validation »). 2 autres correctifs mineurs du même ordre : middleware.ts
→ proxy.ts (Next.js 16), getServerClient() rendu async (cookies() asynchrone).
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
  câblées par le lot Accueil (components/nav/TabBar.tsx), toujours utilisées
  telles quelles par Classement/Bracket (même TabBar, §2.5).
- app/tokens.css ÉCRIT (premier fichier de tokens de production, P-DS7, dark
  sur :root + override [data-theme="light"]), importé par app/globals.css —
  consommé par l'écran Accueil puis par Classement/Bracket et la nav
  partagée (§2.5).
- public/brand/ : convention posée pour hero-parquet.webp, aucun binaire
  ajouté (pas utilisé par les écrans codés à ce jour).
```

### 2.4 Écran Accueil (session du 21/07/2026, inchangé depuis)

```text
Périmètre : app/(app)/layout.tsx (nav 4 onglets + garde session) et
app/(app)/home/page.tsx (SPEC_ECRAN_ACCUEIL_V0.1.md, Cadrage/V1/Spec visuelle/).
Premier écran joueur qui coud ensemble données + layout + tokens de
production.

Fichiers : app/(app)/layout.tsx + layout.module.css ; components/nav/
TabBar.tsx ("use client", seule raison hors Countdown : état "onglet actif")
+ TabBar.module.css ; lib/queries/home.ts (getHomeData(), types HomeHeader/
TodoItem/FeedItem/HomeData) ; components/home/{HomeHeader,TodoList,TodoRow,
Feed,FeedRow,EmptyState}.tsx (+ .module.css chacun, tous serveur) ;
app/(app)/home/page.tsx + page.module.css.

Countdown : à l'origine components/home/Countdown.tsx, DÉPLACÉ cette
session (22/07/2026) vers components/ui/Countdown.tsx — désormais partagé
Accueil + Bracket avant deadline (§2.5). Comportement strictement inchangé,
seul l'import de components/home/TodoRow.tsx a été mis à jour.

Vérifié : `npx tsc --noEmit`, `npx eslint .`, `npx next build` tous propres.
Non testé en conditions réelles (base vide, §3) : le rendu avec une
compétition ACTIVE réelle (en-tête chiffré, items « À traiter », feed).
```

### 2.5 Écrans Classement + Bracket — CODÉS cette session (22/07/2026, nouveau)

```text
Périmètre : SPEC_ECRAN_CLASSEMENT_BRACKET_V0_1.md (Cadrage/V1/Spec visuelle/,
statut close, aucun point produit ouvert §18, 11 décisions actées le jour
même de sa rédaction — §19 de la spec) appliquée telle quelle. Écrans
PARTAGÉS visiteur/joueur connecté : même lecture, même rendu, seule la RLS
filtre le contenu — jamais un `if (role)` dans le code des écrans.

Nav des routes partagées (T6a §3.2/§8.1) : /leaderboard et /bracket vivent
hors des groupes (public)/(app), donc hors de leurs layouts. NOUVEAU :
- components/nav/PublicNav.tsx (+ .module.css) : nav réduite (Classement,
  Bracket, « Se connecter »), extraite de l'inline Tailwind de
  app/(public)/layout.tsx (qui l'utilise désormais aussi) et re-stylée aux
  tokens (elle ne l'était pas).
- components/nav/ScreenShell.tsx (+ .module.css) : rend TabBar (4 onglets)
  si une session existe, PublicNav sinon — un seul appel `auth.getUser()`
  par page, décision affichée seulement (jamais de filtrage de données ici).

lib/queries/leaderboard.ts : getLeaderboard(sortKey), types SortKey/
LeaderboardRow/LeaderboardData figés à l'identique de la spec §15.1. Lit
`user_scores`/`user_recent_form` (vues security_invoker — la RLS des tables
sous-jacentes s'applique donc déjà : « jamais joué » absent par
construction, sans filtre applicatif). Rang TOUJOURS calculé sur Total,
départage 1.Total/2.bons vainqueurs de match/3.écarts exacts/4.points
bracket (même ordre que lib/queries/home.ts), ex-aequo 1,2,2,4.
`adminCorrectionsCount` agrégé sur match_predictions ET bets
(`is_admin_corrected = true`), par joueur et par compétition.

lib/queries/bracket.ts : getBracket(), types SeriesPickGroup/BracketNode/
BracketRound/BracketData figés à l'identique de la spec §15.2.
CONFIDENTIALITÉ PRÉ-DEADLINE : les requêtes bracket_picks/brackets ne sont
même pas lancées tant que isDeadlinePassed est faux (pas un `if` de rendu —
la RLS bloquerait de toute façon ces tables avant bracket_deadline_passed(),
le code ne s'y fie pas seul). Seuil de tendance ≥ 11 calculé PAR SÉRIE.
isStructureKnown dérivé de `series.length > 0` (même heuristique que
getBracketTodo de l'Accueil pour la Cup avant qualification des 8).
3 interprétations documentées dans GAPS_OUVERTS.md (non tranchées par la
spec, aucune donnée inventée) : sémantique de filledCount/totalCount
(progression du TOURNOI puisque le contrat n'a pas de userId), absence du
score de série réel dans BracketNode (vainqueur seul affiché, le type fixé
par la spec ne porte pas ce champ), « or = champion » réservé strictement à
la finale (vainqueur de série normale rendu en vert, jamais en or).

Composants — feuilles client EXACTEMENT celles listées par la spec §3 :
components/ui/Countdown.tsx (déplacé, inchangé) ; components/leaderboard/
{LeaderboardRow,StickyMeBar}.tsx ; components/bracket/{SeriesDrillDown,
TreeView}.tsx. components/bracket/{RotateInvite,NodeCard}.tsx sont SANS
"use client" (rendus exclusivement par un parent client, même mécanisme) —
zéro sixième feuille. Tout le reste (SortChips, LeaderboardTable,
ProgressBar, SeriesGroups, BracketSummary, les 2 page.tsx) est serveur.

Puces de tri (`?tri=`) et bascule vue arbre (`?arbre=1`) : paramètres d'URL
lus par les page.tsx serveur, puces en <Link>. Rotation automatique de la
vue B (TreeView) : SEULEMENT sur l'événement
matchMedia("(orientation: landscape)").addEventListener("change", ...),
jamais sur l'état constaté au montage. Historique : entrée par rotation →
router.replace, entrée par bouton/« voir quand même » → router.push ;
sortie automatique seulement si l'entrée était elle-même par rotation
(trackée via une ref, pas un state, pour éviter une fermeture périmée dans
le listener). « Voir quand même » mémorisé en sessionStorage, lu uniquement
dans des gestionnaires d'événements (jamais pendant le rendu).

Vérifié : `npx tsc --noEmit`, `npx eslint .`, `npx next build` tous propres,
AUCUN conflit de route (/leaderboard et /bracket résolvent chacun à une
seule route dynamique). Testé en conditions réelles sur le serveur dev déjà
lancé par l'utilisateur (port 3001, non redémarré par Claude) : les deux
routes rendent 200, affichent l'état vide global (base sans compétition,
comportement attendu), nav réduite confirmée pour un visiteur anonyme ;
/home et /login non régressés par le déplacement de Countdown et la refonte
de (public)/layout.tsx.

Non testé en conditions réelles (base vide, §3) : le rendu du tableau de
classement rempli, des deux vues du bracket (résumé/arbre) et du drill-down
nominatif avec des joueurs et des picks réels — à vérifier dès qu'une
compétition + des données de test existeront.
```

### 2.6 Prochaine étape

```text
Dans l'ordre déjà acté : hub Jouer (app/(app)/play/*) — matchs (fenêtre 3
jours, saisie vainqueur+écart), bracket personnel (remplissage tour par
tour, distinct du bracket global déjà codé), paris personnalisés, « Mes
pronos » — stylés aux tokens sur le même patron que les écrans déjà codés.
Puis les écrans admin, puis T8 (déploiement).
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
Consommée directement (sans contournement) par les écrans Accueil,
Classement et Bracket via getServerClient() (§2.4/§2.5) : `user_scores`/
`user_recent_form` en security_invoker, `bracket_picks`/`brackets` gardés
par bracket_deadline_passed().

Base VIDE de données opérationnelles (aucune compétition, aucun utilisateur
créé) — les trois écrans de lecture codés à ce jour (Accueil, Classement,
Bracket) n'ont donc encore été observés qu'en état vide global ; c'est le
rendu correct pour cet état, pas un signe d'anomalie.

Aucune migration touchée cette session (22/07/2026, lot Classement/Bracket
compris) : aucun nom de colonne ni valeur de statut inventé — tout lu dans
le schéma réel. Colonnes/vues consommées par les nouvelles requêtes :
`competitions(id, name, type, status, bracket_deadline)`,
`user_scores(user_id, total_points, matches_points, bracket_points,
bets_points, correct_match_winners, exact_margins)`,
`user_recent_form(user_id, recent_form_points)`,
`users(id, pseudo, status)`, `match_predictions(user_id, is_admin_corrected)`,
`bets(user_id, is_admin_corrected)` pour le classement ;
`series(id, round, conference, slot_index, team1_id, team2_id,
official_winner_team_id)`, `teams(id, name, abbreviation)`,
`matches(series_id, scheduled_at)`, `bracket_picks(series_id, bracket_id,
predicted_winner_team_id, predicted_score_format)`,
`brackets(id, user_id)` pour le bracket. Valeurs de statut lues :
`competitions.status = 'ACTIVE'`, `users.status = 'DISABLED'`,
`competitions.type IN ('PLAYOFFS','NBA_CUP')`,
`series.round IN ('ROUND_1','CONF_SEMIS','CONF_FINALS','NBA_FINALS',
'CUP_QUARTERS','CUP_SEMIS','CUP_FINAL')`.
```

## 4. Fichiers du projet — carte rapide

```text
app/
  layout.tsx, favicon.ico, page.tsx — scaffold create-next-app, non modifiés.
  tokens.css — tokens de production (P-DS7), CONSOMMÉ par tous les écrans codés.
  globals.css — @import "./tokens.css" en tête ; contenu existant inchangé.
  (public)/
    layout.tsx — CODÉ (T2 §4), rend désormais <PublicNav/> (NOUVEAU, §2.5).
    login/page.tsx, signup/page.tsx — CODÉS, pas encore stylés selon T7.
    reset-password/ — dossier créé, PAGE PAS ENCORE ÉCRITE (T2 §8).
  (app)/
    layout.tsx + layout.module.css — garde session + nav 4 onglets. CODÉ.
    home/
      page.tsx + page.module.css — écran Accueil. CODÉ.
    play/page.tsx         — stub « à venir », PAS stylé. Prochaine étape.
    profile/page.tsx      — stub « à venir », PAS stylé.
  leaderboard/page.tsx  — Classement. Route physique unique hors route
    groups (§2.2). CODÉ cette session (§2.5) : lecture + rendu complets.
  bracket/page.tsx      — Bracket (vue globale). NOUVEAU. Route physique
    unique hors route groups. CODÉ cette session (§2.5).
  (admin)/               — PAS ENCORE CRÉÉ.

proxy.ts               — garde d'authentification (T6a §4.1, corrigé §2.2). CODÉ.

lib/
  supabase/{browser,server,service}.ts — les 3 clients (T6a §2.4). CODÉ.
  auth/actions.ts                      — login/signup/logout (T2 §4). CODÉ.
  queries/
    home.ts        — getHomeData() + types HomeHeader/TodoItem/FeedItem/
      HomeData. CODÉ.
    leaderboard.ts — NOUVEAU (22/07/2026). getLeaderboard() + types
      SortKey/LeaderboardRow/LeaderboardData. CODÉ.
    bracket.ts     — NOUVEAU (22/07/2026). getBracket() + types
      SeriesPickGroup/BracketNode/BracketRound/BracketData. CODÉ.
  scoring/, sync/ — PAS ENCORE CRÉÉS.

components/
  auth/{LoginForm,SignupForm}.tsx — pas encore stylés selon T7.
  icons/nav-icons.tsx — 4 icônes de nav (T7), câblées par TabBar.
  ui/
    Countdown.tsx (+ .module.css) — DÉPLACÉ depuis components/home/ cette
      session (22/07/2026), désormais partagé Accueil + Bracket. Seule
      feuille "use client" en dehors des 4 listées ci-dessous, comportement
      inchangé.
  nav/
    TabBar.tsx + TabBar.module.css — barre 4 onglets, "use client" (état
      "onglet actif" uniquement). CODÉ (session du 21/07/2026).
    PublicNav.tsx + .module.css — NOUVEAU (22/07/2026). Nav réduite
      (visiteur), serveur, partagée (public)/layout.tsx + ScreenShell.
    ScreenShell.tsx + .module.css — NOUVEAU (22/07/2026). Choisit TabBar ou
      PublicNav selon la session, pour /leaderboard et /bracket.
  home/ — tous CODÉS (session du 21/07/2026) :
    HomeHeader.tsx (+ .module.css)    — en-tête rang/points.
    TodoList.tsx / TodoRow.tsx (+ .module.css chacun) — bloc « À traiter »
      (et « À traiter (admin) », même composants, item.kind distingue).
    Feed.tsx / FeedRow.tsx (+ .module.css chacun) — bloc « Ça vient de tomber ».
    EmptyState.tsx (+ .module.css)    — état vide générique, réutilisé tel
      quel par Classement et Bracket (§2.5).
  leaderboard/ — NOUVEAU (22/07/2026), tous CODÉS :
    SortChips.tsx (+ .module.css)       — puces de tri, <Link> serveur.
    LeaderboardTable.tsx (+ .module.css) — en-tête + composition des lignes.
    LeaderboardRow.tsx (+ .module.css)  — "use client" : expansion/repli.
    StickyMeBar.tsx (+ .module.css)     — "use client" : IntersectionObserver.
  bracket/ — NOUVEAU (22/07/2026), tous CODÉS :
    ProgressBar.tsx (+ .module.css)    — progression X/15 ou X/7.
    NodeCard.tsx (+ .module.css)       — carte résumé d'une série, SANS
      "use client" (rendue par SeriesDrillDown).
    SeriesGroups.tsx (+ .module.css)   — contenu du drill-down (groupes de
      picks), SANS "use client".
    SeriesDrillDown.tsx (+ .module.css) — "use client" : accordéon (vue A) /
      feuille par le bas (vue B), une série ouverte à la fois.
    RotateInvite.tsx (+ .module.css)   — invitation à tourner, SANS
      "use client" (rendue par TreeView).
    TreeView.tsx (+ .module.css)       — "use client" : déclencheur plein
      écran, overlay vue B, écoute de rotation.
    BracketSummary.tsx (+ .module.css) — vue A « résumé par tour », serveur.

public/
  logos/teams/, brand/ — arborescence posée (session du 21/07/2026), fichiers
    binaires réels toujours à la charge de l'utilisateur.

Cadrage/
  V1/     — specs techniques V1 validées (T1→T7) + Spec visuelle/
            SPEC_ECRAN_ACCUEIL_V0_1.md et
            SPEC_ECRAN_CLASSEMENT_BRACKET_V0_1.md (close, appliquée cette
            session).
  Proto/  — fichiers de suivi (ce fichier, JOURNAL_SESSIONS.md,
            GAPS_OUVERTS.md) + cadrage fonctionnel hérité du prototype.
  OLD/    — cadrage antérieur, non consulté activement.

supabase/
  migrations/  — 4 migrations versionnées, voir §3. Aucune ajoutée cette
    session (aucune migration nécessaire pour Classement/Bracket).
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
  Accueil, reconduit sur Classement/Bracket). Composants serveur par défaut ;
  un "use client" doit être justifié explicitement (interaction, horloge
  locale, ou écoute d'un événement navigateur — jamais un fetch de données).
- Noms de colonnes/valeurs de statut absents d'une spec produit : LIRE le
  schéma réel (migrations/RLS) avant d'écrire la moindre requête, jamais
  deviner. En cas d'ambiguïté réelle entre deux lectures possibles d'une
  spec (ex. libellé vs colonne citée), s'arrêter et demander plutôt que
  choisir en silence (cf. §7, décision du feed « pari statué »).
- Quand une spec/archi déjà validée (ex. T6a) impose une contrainte que le
  prompt de session ne détaille pas explicitement (ex. « la page choisit sa
  nav selon la session »), l'appliquer directement plutôt que la considérer
  hors périmètre — ce n'est pas une nouvelle décision produit, juste
  l'exécution d'une décision déjà actée (cf. §2.5, ScreenShell/PublicNav).
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
  fonction qui l'utilise (dont getServerClient()) doit être async. Idem
  pour `searchParams` dans les pages (désormais une Promise, confirmé dans
  node_modules/next/dist/docs/ à l'écriture de app/leaderboard/page.tsx et
  app/bracket/page.tsx cette session).

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

- Rotation d'écran ET routage client (TreeView.tsx, session du 22/07/2026) :
  un listener sur `matchMedia("(orientation: landscape)").matches` lu au
  montage (plutôt qu'un événement `change`) aurait fait atterrir tout
  visiteur mobile CHARGEANT LA PAGE en paysage directement dans la vue
  arbre, y compris un premier chargement fortuit — contraire à la spec
  (vue A = défaut). Résolu en n'agissant JAMAIS sur l'état constaté,
  seulement sur l'événement de changement. Deuxième piège lié : utiliser un
  `useState` pour savoir si l'entrée en vue B venait d'une rotation aurait
  capturé une valeur périmée dans le gestionnaire d'événement (fermeture au
  moment du montage de l'effet) — remplacé par une `ref`, lue à l'exécution
  du handler plutôt qu'à sa création.

Pièges génériques du prototype (Postgres/Git/PowerShell, toujours valables en
principe) non recopiés ici pour éviter la duplication — voir l'historique du
dépôt `nba-pronos-proto` s'ils resurgissent en V1.
```
