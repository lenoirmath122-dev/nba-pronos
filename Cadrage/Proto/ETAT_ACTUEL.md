# NBA Pronos — État actuel (V1)

> **Nature** : instantané de l'état RÉEL au moment de la dernière session — réécrit
> entièrement à chaque fois, jamais complété. Pour l'historique, voir
> `JOURNAL_SESSIONS.md`. Pour les points en suspens, voir `GAPS_OUVERTS.md`.
> Ne contient pas les règles fonctionnelles (synthèse + `decisions_0.2.x`).
>
> Dernière mise à jour : session du 28/07/2026 (suite — **T4 (synchro API
> Highlightly) est CODÉE et TESTÉE EN CONDITIONS RÉELLES**, §2.34 : client
> (`lib/nba/client.ts`), `lib/sync/{teams,schedule,results}.ts`, 4 routes
> (`/api/sync/*`, `/api/heartbeat`). Clé API posée par l'utilisateur dans
> `.env.local`. Dry-run complet sur les VRAIES affiches et VRAIS résultats
> du 1er tour des Playoffs NBA 2026 (8 séries, 14 matchs réels, scores
> exacts) : création automatique des matchs, synchro des scores, recalcul
> du scoring (moteur T5 inchangé), idempotence — TOUT vérifié en conditions
> réelles. Quatre correctifs post-validation actés avec l'utilisateur en
> cours de route (référentiel équipes par table d'alias plutôt que filtre
> API, attache match→série déterministe avec secours passif par
> `sync_logs`, formes réelles du client, paramètre `?date=` dev/test) —
> voir `SPEC_TECHNIQUE_SYNCHRO_V0.1.md` (amendements §3/§4/§5.2/§6/§12).
> **Suite (même session)** : T4 committé (`3f228d5`, pas encore poussé). En
> testant la saisie d'un pari sur la compétition de dry-run, l'utilisateur a
> trouvé 2 points, TOUS DEUX CORRIGÉS dans la foulée (§2.34) : un admin
> pouvait valider son PROPRE pari (`assertNotOwnBet()`, nouveau) ; le pari
> associé à un match devenait inaccessible depuis Matchs une fois le prono
> validé (`InlineBetForm` désormais rendu dans les deux branches). Ces 2
> correctifs ne sont PAS encore committés. La compétition de dry-run a
> ensuite été ARCHIVÉE (avec snapshot cette fois, contrairement à la
> précédente) — **aucune compétition active actuellement**. Prochaine étape
> à confirmer avec l'utilisateur : committer/pousser les 2 correctifs, puis
> reprendre l'ordre habituel (vrai hub Jouer, T6c, mini-bracket Cup,
> planificateur externe) — voir `GAPS_OUVERTS.md`. Détail complet dans
> `JOURNAL_SESSIONS.md`.

---

## 1. Contexte technique

```text
Stack       : Next.js 16.2.10 (Turbopack, App Router, TypeScript) + Supabase
              (Postgres). Next.js 16 a des ruptures par rapport aux
              conventions plus anciennes (AGENTS.md) — vérifié dans
              node_modules/next/dist/docs/ avant chaque brique de code
              nouvelle (ex. middleware.ts renommé proxy.ts, cookies()
              asynchrone, searchParams désormais une Promise, onNavigate sur
              <Link> pour bloquer une navigation interne — §2.8, next/image
              qui refuse d'optimiser un SVG sans dangerouslyAllowSVG — §2.9).
Dépôt local : C:\dev\nba-pronos (sorti de OneDrive) — dépôt Git NEUF, projet
              Supabase NEUF (D1, session du 17/07/2026), distinct du
              prototype (`nba-pronos-proto`), qui reste intact et inchangé en
              référence.
Auth        : Supabase Auth (email + mot de passe), pont École A vers
              public.users via trigger SQL (T2) — voir §3. Flux d'inscription
              + connexion CODÉS et vérifiés (§2.1). Comptes de TEST créés via
              l'API Admin (auth.admin.createUser), seule voie propre puisque
              public.users n'accepte aucun INSERT direct (§2.6). Déconnexion :
              voir §2.9 (bouton TEMPORAIRE, aucun écran ne la portait avant).
RLS         : ACTIVE sur les 15 tables publiques, testée de bout en bout (T3).
              Consommée directement par les écrans de lecture (Accueil,
              Classement, Bracket, Matchs, Mes pronos) via getServerClient()
              — JAMAIS service_role. Deux vues (`user_scores`/
              `user_recent_form`) et deux fonctions (`count_committed_
              predictions`, `request_prediction_correction`) sont
              volontairement en dehors du régime « invoker » (§2.7/§2.8/
              §2.11) : `request_prediction_correction` (migration #7) est la
              SEULE écriture qui contourne une policy (`mp_insert`, pour la
              voie A du §2.11) — elle n'écrit jamais de contenu de
              pronostic, seulement une ligne vide + sa requête liée. Les
              deux vues/fonctions restantes n'exposent QUE des agrégats
              (points, compteurs), jamais une ligne individuelle — la
              confidentialité par match/pari/pick, elle, reste entièrement
              portée par la RLS des tables sources, inchangée.
Realtime    : publication `supabase_realtime` activée sur `matches`
              UNIQUEMENT (migration #8, §2.11) — `series` reste à activer au
              lot Bracket personnel (GAPS_OUVERTS.md). Souscription unique
              côté client dans `LiveSubscriber.tsx` (Mes pronos), RLS native
              (matches_select = `using (true)`, rien de privé n'y transite).
Styles      : CSS Modules colocalisés par composant (`*.module.css`), lisant
              exclusivement les tokens sémantiques de `app/tokens.css` (aucune
              valeur en dur) — convention posée par l'écran Accueil,
              reconduite sur Classement/Bracket/Matchs puis le hub Jouer
              temporaire (§2.10). Tailwind (présent au projet) reste utilisé
              tel quel pour les écrans PAS ENCORE stylés selon T7
              (login/signup, non retouchés).
```

## 2. Avancement

```text
Phase V1 — la série de specs techniques T1 → T7 est VALIDÉE. Le socle de
données (modèle + auth + RLS) est posé et codé (§3). CODÉS ET VÉRIFIÉS avec
un vrai jeu de données : les HUIT écrans du hub joueur (Accueil, Classement,
Bracket vue globale, Matchs §2.8, Mes pronos §2.11, Nouveau pari §2.15,
Bracket personnel §2.16, Mes paris §2.19), logos de franchise câblés sur
Bracket/Matchs/Mes pronos/Bracket personnel. Le hub Jouer TEMPORAIRE
(§2.10) relie l'onglet « Jouer » aux QUATRE écrans du hub — reste à
remplacer par le vrai hub (spec pas encore écrite, GAPS_OUVERTS.md).

**Le lot ADMIN est ENTIÈREMENT CLOS (6/6 écrans)** : tableau de bord
(§2.20, `/admin`), validation des paris (§2.21), Gestion des joueurs
(§2.22), Historique des logs (§2.23), résolution des paris (§2.28),
requêtes de correction (§2.29, DERNIER écran fermé) — tous CODÉS et
VÉRIFIÉS en conditions réelles.

**Le CHANTIER T5 (moteur de scoring) est ENTIÈREMENT CLOS (4/4 lots)** :
moteur pur (§2.24, `lib/scoring/engine.ts`, 26 tests `vitest`), writer
`series.official_*` (§2.25, `lib/sync/writeSeriesOutcome.ts`),
orchestration (§2.26, `lib/scoring/recompute.ts` — `recomputeMatch`/
`recomputeSeries`/`recomputeBet`/`recomputeCompetition`), câblage admin
(§2.27/§2.28/§2.29 — bouton Recalculer, résolution, requêtes). Le moteur
de scoring est FONCTIONNELLEMENT COMPLET ET UTILISABLE de bout en bout
depuis l'UI admin.

**Gestion des compétitions — chantier ENTIÈREMENT CLOS (3/3 lots)** (§2.30,
§2.33) : création, saisie des résultats + avancement automatique du
bracket, clôture/archivage — tous codés, vérifiés, testés en conditions
réelles par l'utilisateur.

**T4 (synchro API Highlightly) — CODÉE ET TESTÉE EN CONDITIONS RÉELLES**
(§2.34) : client, `lib/sync/*`, 4 routes. Dry-run complet sur de vraies
données NBA 2026 (création de matchs, scores, recalcul, idempotence) —
voir §2.34 pour le détail.

**Ordre de reprise, PROCHAINE SESSION** (voir GAPS_OUVERTS.md) :
1. **Décider avec l'utilisateur du sort de la compétition de dry-run**
   (laissée ACTIVE à sa demande) et committer/pousser le lot T4.
2. **Vrai hub Jouer** — remplace le hub temporaire (§2.10), aucune spec
   d'écran encore écrite.
3. **Le reste** : Realtime + rendu des états au-delà de ce qui existe déjà
   (T6c) ; mini-bracket NBA Cup (reporté, voir GAPS_OUVERTS.md) ;
   planificateur externe réel (cron-job.org/GitHub Actions) à configurer
   au déploiement pour que T4 tourne en continu.
```

### 2.1 Ce qui est CODÉ et VÉRIFIÉ (session du 19/07/2026, inchangé depuis)

```text
.env.local (hors dépôt, déjà couvert par .gitignore) : URL + anon key +
  service_role key du projet Supabase V1 (saisies par l'utilisateur
  directement dans l'éditeur, jamais collées dans le chat) ; SYNC_SECRET
  généré côté Claude (crypto.randomBytes(32), 64 caractères hex).

Paquets installés : @supabase/ssr, @supabase/supabase-js, server-only.
AUCUNE nouvelle dépendance ajoutée depuis (écrans Accueil, Classement/
Bracket, Matchs compris, hub Jouer temporaire §2.10) — le seed et les scripts
de vérification jetables utilisent les mêmes paquets, rien de plus.

lib/supabase/{browser,server,service}.ts (T6a §2.4) : les 3 clients —
  getBrowserClient (anon, navigateur), getServerClient (anon + JWT cookies,
  ASYNC — correctif post-validation, cookies() est asynchrone en Next.js
  15/16), getServiceClient (service_role, module server-only, garde de build
  contre toute fuite côté navigateur). getServiceClient n'est utilisé QUE par
  le script de seed (§2.6) — jamais par un écran ni une server action.

proxy.ts (racine du repo) : garde d'AUTHENTIFICATION (T6a §4.1) — zones
  protégées /home, /play, /profile (app), /admin (admin) → redirigées vers
  /login sans session ; /login et /signup → redirigées vers /home AVEC
  session. Utilise supabase.auth.getUser() (revalidé serveur, pas
  getSession()). Nommé proxy.ts et pas middleware.ts : renommage Next.js 16
  (AGENTS.md), comportement strictement identique. Ne garde PAS
  /leaderboard ni /bracket (routes physiques hors des groupes (public)/(app),
  T6a §3.2/§8.1) — ces deux écrans lisent la session eux-mêmes pour choisir
  leur nav, jamais pour filtrer leurs données (la RLS s'en charge).

lib/auth/actions.ts + components/auth/{LoginForm,SignupForm}.tsx +
  app/(public)/{layout,login/page,signup/page}.tsx : flux complet de
  connexion et d'inscription (T2 §4). Formulaires minimalistes (pas encore
  les tokens visuels T7 — non retouchés). `logout()` existe dans ce fichier
  depuis le début mais n'était câblé sur AUCUN écran avant §2.9.
```

### 2.2 Correctif de conception trouvé et tranché (T6a §3, session du 19/07/2026)

```text
L'arbre app/ validé par T6a plaçait leaderboard/page.tsx (et bracket/page.tsx)
à la fois dans (public)/ et dans (app)/ — conflit de route Next.js. Tranché :
route physique UNIQUE, hors des deux route groups (app/leaderboard/page.tsx,
app/bracket/page.tsx). SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_a.md corrigé en
conséquence, correctifs marqués explicitement « post-validation ». 2 autres
correctifs mineurs du même ordre : middleware.ts → proxy.ts (Next.js 16),
getServerClient() rendu async (cookies() asynchrone).
```

### 2.3 Consolidation design + tokens (session du 20-21/07/2026)

```text
Passe maquettes (20/07/2026) : T7 éprouvée sur des maquettes HTML jetables,
hors dépôt. Amendement V0.2 de SPEC_DESIGN_SYSTEM_V0_1.md (§15 : accent figé,
rayons « niveau C / net », nouveau token --color-trend).

Consolidation (21/07/2026, avant le lot Accueil) :
- Logos de franchise → 30 SVG déposés par l'utilisateur dans
  public/logos/teams/ (nommés par abréviation), déjà committés depuis cette
  session-là. RESTÉS NON CÂBLÉS par aucun écran jusqu'au 24/07/2026 (§2.9) —
  fallback texte utilisé partout entre-temps, pas parce que les fichiers
  manquaient mais parce qu'aucun composant ne les référençait encore.
- Icônes de nav CRÉÉES (components/icons/nav-icons.tsx), câblées par
  components/nav/TabBar.tsx, toujours utilisées telles quelles depuis.
- app/tokens.css ÉCRIT (P-DS7, dark sur :root + override [data-theme="light"]),
  importé par app/globals.css — consommé par tous les écrans codés depuis
  (Accueil, Classement, Bracket, Matchs, hub Jouer temporaire §2.10).
- public/brand/ : convention posée pour hero-parquet.webp, aucun binaire
  ajouté (pas utilisé par les écrans codés à ce jour).
```

### 2.4 Écran Accueil (session du 21/07/2026, inchangé depuis)

```text
Périmètre : app/(app)/layout.tsx (nav 4 onglets + garde session) et
app/(app)/home/page.tsx (SPEC_ECRAN_ACCUEIL_V0.1.md, Cadrage/V1/Spec visuelle/).

Fichiers : app/(app)/layout.tsx + layout.module.css (étendu §2.8/§2.9) ;
components/nav/TabBar.tsx (+ .module.css, étendu §2.8) ; lib/queries/home.ts
(getHomeData(), types HomeHeader/TodoItem/FeedItem/HomeData) ;
components/home/{HomeHeader,TodoList,TodoRow,Feed,FeedRow,EmptyState}.tsx
(+ .module.css chacun, tous serveur) ; app/(app)/home/page.tsx + page.module.css.

Countdown : components/ui/Countdown.tsx (déplacé depuis components/home/ le
22/07/2026), partagé Accueil + Bracket avant deadline.

Pas de logo ici (§2.9) : les équipes n'apparaissent que dans du texte déjà
formaté (TodoItem.subtitle, FeedItem.label), pas d'objet équipe structuré —
décision explicite de ne pas restructurer ce contrat pour l'instant, voir
GAPS_OUVERTS.md.

Vérifié en conditions réelles avec le jeu de données de test (session du
23/07/2026) : en-tête chiffré, items « À traiter » et feed rendus
correctement pour un joueur réel — non testé auparavant (base vide).
```

### 2.5 Écrans Classement + Bracket (session du 22/07/2026, complété §2.9)

```text
Périmètre : SPEC_ECRAN_CLASSEMENT_BRACKET_V0_1.md (close, 11 décisions actées
§19) appliquée telle quelle. Écrans PARTAGÉS visiteur/joueur connecté : même
lecture, même rendu, seule la RLS filtre le contenu.

Nav des routes partagées (T6a §3.2/§8.1) : /leaderboard et /bracket vivent
hors des groupes (public)/(app). components/nav/PublicNav.tsx (nav réduite,
visiteur) + components/nav/ScreenShell.tsx (choisit TabBar ou PublicNav selon
la session) — TabBar étendu §2.8, sans effet ici tant que rien ne déclare de
saisie sale (ces deux écrans n'écrivent rien).

lib/queries/leaderboard.ts : getLeaderboard(sortKey), types figés à
l'identique de la spec §15.1. Lit `user_scores`/`user_recent_form` — CORRIGÉ
en security_invoker=false le 23/07/2026 (§2.7). `adminCorrectionsCount`
désormais directement porté par `user_scores` (colonne
`admin_corrections_count`, migration #5) — les 2 requêtes séparées sur
match_predictions/bets qui existaient ont disparu. Pas de logo ici non plus
(le Classement n'affiche aucune équipe).

lib/queries/bracket.ts : getBracket(), types figés à l'identique de la spec
§15.2. CONFIDENTIALITÉ PRÉ-DEADLINE : bracket_picks/brackets pas interrogées
tant que isDeadlinePassed est faux — patron repris tel quel pour l'écran
Matchs (§2.8, others/absentees). `components/bracket/NodeCard.tsx` affiche
désormais le logo de chaque équipe (§2.9, `components/ui/TeamLogo.tsx`),
avant l'abréviation.

Composants — feuilles client EXACTEMENT celles listées par la spec §3 :
components/ui/Countdown.tsx ; components/leaderboard/{LeaderboardRow,
StickyMeBar}.tsx ; components/bracket/{SeriesDrillDown,TreeView}.tsx. Le
reste (SortChips, LeaderboardTable, ProgressBar, SeriesGroups, NodeCard,
RotateInvite, BracketSummary, les 2 page.tsx) est serveur — NodeCard reste
sans "use client" malgré l'ajout du logo (TeamLogo porte son propre état
d'erreur, transitivement bundlé client, même mécanisme que MarginStepper §2.8).

Vérifié en conditions réelles avec le jeu de données de test (session du
23/07/2026) : tableau de classement rempli (6 joueurs, avant ET après le
correctif §2.7), les deux vues du bracket, drill-down nominatif avec picks
réels, bascule pré/post-deadline. Logos vérifiés le 24/07/2026 (§2.9) :
présents dans le HTML rendu pour un vrai visiteur authentifié, fichier SVG
effectivement servi (200, image/svg+xml).
```

### 2.6 Jeu de données de TEST (seed, session du 23/07/2026, inchangé depuis)

```text
Constat de départ : les 3 écrans de lecture codés n'avaient jamais été
observés qu'en état vide global — aucune preuve que le rendu « rempli »
fonctionne. Script `scripts/seed-playoffs-test-data.mjs`, HORS
supabase/migrations/ (décision explicite, deux raisons) :
(a) la création de comptes passe par l'API Admin Supabase
    (auth.admin.createUser), non exprimable en SQL portable — public.users
    est alimentée par un TRIGGER depuis auth.users, pas par un INSERT direct ;
(b) ce dépôt n'a qu'UN SEUL projet Supabase lié (`npx supabase db push`
    cible potentiellement la future prod) — un jeu de données jetable ne doit
    pas vivre dans l'historique de migrations rejouable.

Contenu : 30 équipes NBA (référentiel complet) ; 1 compétition PLAYOFFS
ACTIVE de TEST (« Playoffs NBA (test) ») ; bracket complet 15 séries (8
réelles au 1er tour, squelette non résolu pour la suite — aucun résultat
officiel nulle part, aucun score, RIEN qui relève du moteur de scoring T5 ou
de la synchro T4, non codés) ; 9 matchs de 1er tour (fenêtre 3 jours +
au-delà + un `scheduled_at` NULL) ; 7 comptes de test (`seed-*@nba-pronos.test`,
mot de passe posé ponctuellement pour vérification, jamais commité) dont
Sofia_Admin (promue ADMIN après coup, service_role + migration #4), Marco_D
(désactivé APRÈS son prono validé, teste la conservation au classement),
Tariq_M (aucune participation, teste l'absence « jamais joué »). États
couverts : brouillon complet/partiel (le cas exact du correctif T6b §3.1),
prono validé, prono corrigé par un admin (workflow complet rejoué : requête
PENDING → correction → PROCESSED, trigger enforce_prediction_correction
réellement exercé), pari CANCELLED/REJECTED/DRAFT.

Découverte en testant (pas en lisant la spec) : le Classement était quasi
vide pour un joueur normal — corrigé en §2.7, le MÊME défaut existait sur le
compteur X/N de l'écran Matchs, anticipé cette fois AVANT de coder (§2.8).

Réversibilité : script non idempotent (garde anti double-exécution), aucun
script de nettoyage écrit à ce jour — à faire avant tout lancement réel
(§6). Les comptes de test ont un mot de passe temporaire posé à la demande
pour vérification manuelle (jamais affiché dans le chat qu'à titre de
test jetable) ; supprimer via auth.admin.deleteUser le moment venu, pas par
un simple DELETE SQL.
```

### 2.7 Correctif RLS — visibilité universelle du Classement (migration #5, 23/07/2026)

```text
Trouvé en testant le Classement avec le jeu de données de test (§2.6) : un
joueur normal n'y voyait QUE lui-même, alors qu'un admin voyait les 6
joueurs. Cause : `user_scores`/`user_recent_form` étaient en
security_invoker=true (D4/T3 §7) — l'agrégation hérite donc de la RLS des
tables sources, qui ne révèle la ligne d'un AUTRE joueur qu'après
verrouillage du match ou commitment mutuel sur ce MÊME match (« valider =
voir », par match). L'invariant D4/C-5 garantissait que la VALEUR affichée
est toujours juste, pas que le ROSTER complet apparaisse avant tout
verrouillage.

Décision (demandée explicitement par l'utilisateur, pas trouvée seule) : le
Classement doit être visible de tous, tout le temps, indépendamment de la
confidentialité par match/pari/pick — qui reste, elle, INCHANGÉE. Mécanisme :
`user_scores`/`user_recent_form` passent en security_invoker=false
(migration #5, `supabase/migrations/20260723130000_leaderboard_universal_
visibility.sql`) — leur propriétaire contourne déjà la RLS des tables qu'il
possède (pas de FORCE ROW LEVEL SECURITY), une vue non-invoker en hérite,
quel que soit l'appelant. Les deux vues ne renvoient que des agrégats
(points, compteurs), jamais une ligne individuelle — aucune fuite de détail.
`admin_corrections_count` intégré à `user_scores` au passage (§2.5).

Documenté comme correctif post-validation dans
`Cadrage/V1/SPEC_TECHNIQUE_RLS_V0.1.md` §11 (même traitement que les
correctifs T6a/T6b déjà tracés).
```

### 2.8 Écran Matchs (session du 23/07/2026, complété §2.9)

```text
Périmètre : SPEC_ECRAN_MATCHS_V0_1.md (Cadrage/V1/Spec visuelle/, close, 16
décisions actées §19) appliquée telle quelle. Quatrième écran du hub Jouer,
premier écran qui ÉCRIT (brouillon, validation irréversible, garde C2).

Fichiers : app/(app)/play/matches/page.tsx (+ .module.css) ;
lib/queries/matches.ts (getMatches(), types figés à l'identique de la spec
§13) ; lib/actions/matches.ts (saveMatchPredictionDraft/
validateMatchPrediction/validateAllCompleteMatchPredictions, T6b §3.1
corrigé §18.1 — les 2 champs sont optionnels) ; lib/hooks/useUnsavedGuard.tsx
(garde C2, TRANSVERSE — voir plus bas) ; components/matches/* (8 fichiers).
`components/matches/{TeamPicker,MatchRow}.tsx` affichent désormais le logo
de chaque équipe (§2.9).

Fenêtre : `scheduled_at IS NOT NULL AND scheduled_at > now() AND <= now() +
3 jours`, JAMAIS sur `matches.status` (§2/§18.2 — le planificateur, 30-60
min, laisserait un match commencé en SCHEDULED près d'une heure). Groupement
par jour en fuseau Europe/Paris (aucune convention de fuseau n'existait
ailleurs dans le code — choix explicite et documenté, pas deviné).

Trois feuilles client EXACTEMENT (MatchRow, PredictionForm,
ValidateAllBanner) ; TeamPicker/MarginStepper/RevealPanel/BetShortcut/
MatchDayGroup SANS "use client" propre (rendus par un parent client, même
mécanisme que NodeCard/SeriesGroups du bracket — MarginStepper et RevealPanel
portent quand même leur propre useState local, ce que permet ce mécanisme).

Deux points BLOQUANTS trouvés et tranchés AVEC l'utilisateur avant de coder
(pas en silence) :
- Compteur « X/N ont pronostiqué » (§8) : même défaut que §2.7, mais PAR
  MATCH — un simple count() en session joueur sous-compte tant que
  l'appelant n'a pas lui-même validé sur CE match précis. Corrigé par une
  fonction SECURITY DEFINER dédiée (migration #6,
  `count_committed_predictions(p_match)`, même principe que
  `has_committed_prediction()` déjà en base) — ne renvoie qu'un entier.
- Raccourci pari (§10), règle « REJECTED avant/après sa deadline » :
  aucune colonne ne capture le moment d'un rejet (pas de `rejected_at`, et
  `rejectBet` n'existe pas encore, lot « Paris »). Tranché : un pari REJECTED
  est TOUJOURS considéré libéré (cas normal — sealDeadlines auto-valide tout
  SUBMITTED à la deadline, donc un rejet après coup est un cas limite hors
  fonctionnement normal). Documenté dans le code, pas deviné en silence.

Confidentialité — même patron que getBracket() : `others`/`absentees` sont
VIDES côté serveur tant que `isRevealed` est faux (la requête n'est pas
lancée). Sur cet écran, `isRevealed` se simplifie à `isAdmin OR statut ===
VALIDATED` — le verrouillage temporel (autre branche RLS) ne peut
structurellement jamais se produire ICI (l'écran ne montre que des matchs à
venir, jamais verrouillés, §2/§18.2).

Garde C2 (`lib/hooks/useUnsavedGuard.tsx`, extension acceptée avec
l'utilisateur AVANT de coder, pas décidée seule) : Context + Provider,
drapeau `dirty` AGRÉGÉ au niveau de l'écran (plusieurs MatchRow peuvent être
ouvertes et sales simultanément, §3/§12). Utilise `onNavigate` sur <Link>
(API officielle Next.js 16, pas un hack) pour intercepter une navigation
interne. Étend DEUX fichiers partagés par tous les écrans, changement inerte
tant que rien ne déclare de saisie sale :
- components/nav/TabBar.tsx : `onNavigate` sur les 4 onglets.
- app/(app)/layout.tsx : monte `UnsavedGuardProvider` autour de {children} +
  <TabBar/>.
ATTENTION trouvée en cours de route : TabBar est AUSSI rendu par ScreenShell
(/leaderboard, /bracket — hors de app/(app)/layout.tsx, donc sans provider).
`useGuardedNavigation()` se dégrade en no-op si le contexte est absent,
plutôt que de lever une erreur — sinon ces deux écrans auraient cassé pour
un visiteur connecté. Vérifié après coup : /home, /leaderboard, /bracket
répondent toujours 200 avec du contenu réel (pas de page d'erreur).

Interprétations d'implémentation (pas des choix produit — la spec ne
précisait pas l'exact mécanisme) :
- Stepper d'écart : le « pavé numérique » (§6) est un `<input type="number"
  inputMode="numeric">` — déclenche le clavier numérique natif du système
  sur mobile, pas une grille de touches maison.
- Statuts de prono (§4) : rendus en CSS pur (bordures/fonds tokens), coche
  ✓ et flèche → en caractères, aucune icône SVG créée — la spec elle-même
  écrit « ✓ LAL −8 » en toutes lettres.
- Badge « corrigé par un admin » : le contrat de types figé (§13) ne porte
  qu'un booléen `isAdminCorrected` (pas de nom d'admin ni de requérant, que
  la prose §8 mentionne) — le type fait autorité, badge générique.
- Destination du raccourci pari (§10, non fixée par la spec, §18.3) :
  pointe vers `/play` (hub existant) en attendant que `/play/bets/new`
  existe — inchangé par le hub temporaire §2.10 (toujours `/play`, la vraie
  route de création de pari n'existe pas plus qu'avant).

Vérifié : `npx tsc --noEmit`, `npx eslint .`, `npx next build` tous propres,
aucun conflit de route. Testé en conditions réelles avec de VRAIES sessions
authentifiées (cookies SSR générés via @supabase/ssr — pas de navigateur
disponible, donc pas de clic réel sur les boutons ; les mécaniques d'écriture
— upsert partiel, RLS post-validation — ont été rejouées directement en
session RLS réelle, hors des boutons de l'UI, résultat identique) : fenêtre
3 jours correcte (5 des 9 matchs, le NULL et les 3 hors fenêtre absents) ;
regroupement par jour correct (« Demain », « Samedi 25 », « Dimanche 26 ») ;
4 statuts distincts observés (à faire / incomplet / prêt / validé) sur des
joueurs réels différents ; brouillon partiel confirmé persistant (le cas
T6b §3.1) ; confidentialité confirmée des deux côtés (Amine92 : 3 matchs
révélés seulement, absents corrects, aucune fuite sur les 2 non révélés ;
Sofia_Admin : tout révélé) ; bandeau « Tout valider » apparaît bien
uniquement quand readyCount > 0 (Chloe_B) ; RLS confirmée bloquant une
ré-écriture après validation (0 ligne affectée — piège trouvé en testant,
voir §7) ; /home, /leaderboard, /bracket non régressés.

Confirmé par l'utilisateur en testant lui-même dans un vrai navigateur
(24/07/2026) : rendu visuel « top », clics et saisie fonctionnels. Deux
remontées traitées en §2.9 (logos absents, pas de déconnexion possible).
```

### 2.9 Compléments post-test utilisateur (session du 24/07/2026)

```text
L'utilisateur a testé l'écran Matchs lui-même (premier vrai test au clavier/
souris de toute la V1) et a remonté deux points.

Logos de franchise absents partout — d'abord mal diagnostiqué : la première
réponse (« les fichiers ne sont pas déposés ») était FAUSSE, basée sur une
note de suivi obsolète plutôt que sur une vérification du disque. Corrigé
après relecture directe de public/logos/teams/ : les 30 SVG existent bien
et sont déjà committés depuis le 21/07/2026 — la vraie cause est qu'aucun
écran ne les référence jamais dans son code (0 occurrence de `logos/teams`
ou `logo_url` avant ce jour, vérifié par recherche globale). Décision avec
l'utilisateur : câbler UNIQUEMENT Bracket et Matchs maintenant (les 2 seuls
écrans avec un objet équipe structuré, `TeamRef`/`BracketNode.teamA/teamB`).
Accueil et Classement laissés de côté et documentés dans GAPS_OUVERTS.md —
Accueil ne porte les équipes que dans du texte déjà formaté, Classement n'en
affiche aucune. `components/ui/TeamLogo.tsx` (NOUVEAU, partagé) : chemin
déduit de `{abbreviation}.svg`, AUCUN champ ajouté aux contrats de types
figés, AUCUNE colonne base consommée (`teams.logo_url` reste vide, non
utilisée). `next/image` avec `unoptimized` (Next.js bloque l'optimisation
SVG par défaut, nécessiterait `dangerouslyAllowSVG` + CSP dans next.config —
évité) ; repli sur l'abréviation texte via `onError` si un fichier venait à
manquer pour une équipe. Câblé dans `NodeCard.tsx` (Bracket) et
`TeamPicker.tsx`/`MatchRow.tsx` (Matchs). Vérifié avec de vraies sessions
authentifiées : chemins corrects dans le HTML rendu, fichier réellement
servi (200, image/svg+xml).

Aucun moyen de se déconnecter — remonté par l'utilisateur en testant.
Vérifié : `logout()` existe dans `lib/auth/actions.ts` depuis le tout début
mais n'était câblée sur AUCUN bouton, AUCUN écran. Ajout d'un bouton
TEMPORAIRE dans `app/(app)/layout.tsx` (coin haut-droit, hors design system
— bordure pointillée, texte muted, volontairement pas fini), demandé
explicitement par l'utilisateur en attendant l'écran Profil. Couvre
uniquement la zone `(app)` (Accueil/Jouer/Matchs/Profil), pas
`/leaderboard`/`/bracket` (ScreenShell). Testé de bout en bout SANS
JavaScript, en rejouant le vrai POST de formulaire (multipart, champ caché
`$ACTION_ID_...` extrait du HTML rendu — voir §7 pour la technique) : 303 →
/login, cookie de session effacé (Max-Age=0). Tracé dans GAPS_OUVERTS.md
comme « à retirer » — ne doit pas survivre jusqu'à la V1 finale.

Aucune migration, aucun changement de schéma dans ce lot. `npx tsc --noEmit`,
`npx eslint .`, `npx next build` propres après chaque changement.
```

### 2.10 Hub Jouer temporaire (session du 24/07/2026, nouveau)

```text
Problème posé : l'écran Matchs (§2.8/§2.9) est codé et vérifié, mais
l'onglet « Jouer » de la nav pointait sur app/(app)/play/page.tsx, resté un
stub « à venir » depuis le tout début — cul-de-sac, aucun moyen d'y accéder
depuis l'UI.

Fait : app/(app)/play/page.tsx remplacé par un hub MINIMAL et
VOLONTAIREMENT TEMPORAIRE, en attendant le vrai hub Jouer (spec d'écran
dédiée, non écrite, hors périmètre de ce lot). Composant SERVEUR (aucun
"use client", rien ici n'en a besoin) : liste de 4 entrées reprises de
l'arbre app/ de SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_a.md — « Matchs » en
<Link> actif vers /play/matches ; « Mes pronos » (/play/my-predictions),
« Mon bracket » (/play/bracket), « Paris » (/play/bets) rendues INERTES
(PAS de <Link>, pour éviter un 404 puisque ces 3 routes n'existent pas
encore), libellé « à venir ». app/(app)/play/page.module.css colocalisé,
lisant exclusivement les tokens sémantiques de app/tokens.css (aucune valeur
en dur) — même convention que tous les écrans codés depuis Accueil (§2.3).

Marqué TEMPORAIRE aux trois endroits, même patron que le bouton de
déconnexion (§2.9) : commentaire dans le code (page.tsx, page.module.css),
mention visible dans le rendu (« Hub temporaire — sera remplacé »), entrée
dans GAPS_OUVERTS.md. Aucune pastille « à faire » calculée (hors périmètre,
rôle du vrai hub, qui devra probablement l'afficher). Aucun autre fichier
touché : TabBar, layout, migrations et dépendances inchangés.

Vérifié : npx tsc --noEmit, npx eslint ., npx next build tous propres,
aucun conflit de route (/play toujours listé seul dans la carte des routes
générée par le build, à côté de /play/matches). Aucune migration, aucun
changement de schéma.

À RETIRER dès que le vrai hub Jouer existe (voir GAPS_OUVERTS.md et §6
ci-dessous) — ne doit pas survivre jusqu'à la V1 finale, même remarque que
le bouton de déconnexion temporaire (§2.9).
```

### 2.11 Écran Mes pronos (session du 24/07/2026, CLOSE)

```text
Périmètre : SPEC_ECRAN_MES_PRONOS_V0_1.md (Cadrage/V1/Spec visuelle/, close,
31 décisions actées §19) appliquée telle quelle. Cinquième écran du hub
joueur, DEUXIÈME écran qui ÉCRIT (une seule écriture : la requête de
correction), PREMIER écran qui porte le LIVE (badge EN DIRECT, retiré de
l'écran Matchs). Ancré sur les MATCHS VERROUILLÉS (scheduled_at <= now()),
jamais sur matches.status — aucun recouvrement avec Matchs (scheduled_at >
now()), même horloge, deux sens.

ÉTAPE 0 (vérification de dépôt, §18, lecture seule) : les 3 points étaient
tous déjà corrects, rien à corriger dans la migration #7 —
`TeamRef` (lib/queries/matches.ts) importable tel quel ; la policy SELECT
sur correction_requests EXISTAIT DÉJÀ (migration #3, `correction_requests_
select`) ; les triggers T-b/T-c (migration #3) acceptent bien un UPDATE admin
sur une ligne vide (aucun contrôle de complétude dans leur code, seulement
la machine à états DRAFT/VALIDATED et la cohérence requête↔admin) ;
`count_committed_predictions` (migration #6) filtre bien `status <> 'DRAFT'`.
Requête réelle en base : 0 match avec scheduled_at <= now() — écran
invérifiable en l'état. Décidé AVEC l'utilisateur : étendre le seed plutôt
que ne rien coder. `scripts/seed-playoffs-test-data.mjs` étendu (3 matchs
existants passés dans le passé plutôt que d'en inventer : CLE-ORL#1 FINISHED
101-97, prono Yanis44 corrigé — teste le rendu nominatif §7.1 ; DEN-SAC#1
IN_PROGRESS 58-52, prono Marco_D (désactivé) — teste le badge EN DIRECT + la
conservation ; MIN-GSW#1 laissé SCHEDULED malgré une date passée — teste le
MatchLiveState 'STARTED', latence assumée §5.4 — + 1 prono partiel Nina_R
ajouté dessus, seul cas INCOMPLETE du lot). Le script a été mis à jour ET la
base déjà seedée a été alignée directement (3 UPDATE + 1 INSERT ciblés,
non destructifs — pas de wipe/reseed complet, qui aurait exigé de supprimer
et recréer les 7 comptes auth).

ÉTAPE 1 : `lib/labels/rounds.ts` créé (extraction PURE de `ROUND_LABELS`,
portée en dur jusque-là par `lib/queries/bracket.ts`), importé par Bracket ET
Mes pronos (§16.5). Aucun libellé changé.

ÉTAPE 2 — 2 migrations, montrées intégralement et confirmées avant push :
- **migration #7** (`20260724100000_request_prediction_correction.sql`) :
  fonction `request_prediction_correction()` SECURITY DEFINER, voie A (§10.2)
  — si aucune ligne (user_id, match_id) n'existe, en crée une VIDE (DRAFT,
  les deux champs NULL) puis pose la `correction_requests` liée, dans une
  seule transaction. Garde-fous (§10.3) : auth.uid() uniquement, joueur
  ACTIVE, match effectivement verrouillé, réutilisation si une ligne existe
  déjà (jamais de doublon), justification obligatoire, une seule requête
  PENDING à la fois (déjà imposé par un index unique partiel du schéma,
  contrôle applicatif redondant pour un message clair). Justification du
  contournement RLS documentée EN COMMENTAIRE dans le fichier de migration.
- **migration #8** (`20260724110000_realtime_matches.sql`) :
  `alter publication supabase_realtime add table matches;` — UNIQUEMENT
  `matches`, jamais `series` (reporté au lot Bracket personnel, chaque table
  publiée quand un écran en a besoin).
Les deux vérifiées après push par appel direct (garde d'authentification
confirmée en aveugle) — voir aussi le test en conditions réelles plus bas.

ÉTAPE 3 : `lib/queries/my-predictions.ts` (`getMyPredictions()`, types §13
recopiés à l'identique, `TeamRef` réimporté) + `lib/actions/corrections.ts`
(`requestPredictionCorrection()`, appel `.rpc()` uniquement). Dérivation
d'état (§8) PAR COMPLÉTUDE UNIQUEMENT (§10.4), jamais par présence ni statut
brut. **Décision tranchée AVEC l'utilisateur** (ambiguïté trouvée en codant,
non couverte par le tableau §8 fermé) : `sealDeadlines` (l'auto-validation
DRAFT complet → VALIDATED décrite par T6b §2) n'est INVOQUÉE NULLE PART dans
le code — aucun cron, aucune fonction de ce nom n'existe, seulement des
commentaires qui la mentionnent. Une ligne DRAFT aux DEUX champs remplis
(joueur qui a rempli son prono sans cliquer « Valider » avant le
verrouillage) est donc un 4e cas non prévu par le tableau. Tranché : la
complétude prime sur le statut brut → rendu FROZEN, appliqué symétriquement
à MON prono et à ceux des AUTRES joueurs (RevealPanel). Filtres date/série
(§4.2) calculés en Europe/Paris sans librairie externe (offset recalculé à
midi UTC du jour visé, même contrainte que `lib/queries/matches.ts`).

ÉTAPE 4 : `app/(app)/play/my-predictions/page.tsx` + `components/my-
predictions/*` (MatchRowStatic, PredictionSummary, RevealPanel,
AssociatedBetCard, SeriesBetHeader, FilterBar, SegmentTabs,
CorrectionRequestForm — tous SERVEUR ; `urls.ts`, utilitaire pur sans JSX).
**Un seul fichier `"use client"` : `LiveSubscriber.tsx`**, qui exporte à la
fois le Provider (souscription Realtime unique, Context React) ET un
consommateur (`LiveBadgeAndScore`, lu depuis les lignes SERVEUR) — toujours
dans le même fichier, donc une seule frontière client pour l'écran (§1.1).

**Point touché hors périmètre strict de la spec, décidé AVEC l'utilisateur
en cours de route** : `components/ui/TeamLogo.tsx` (partagé Bracket/Matchs
depuis §2.9) n'avait jamais sa PROPRE directive `"use client"` — il ne
fonctionnait que parce que ses 2 points d'appel existants sont TOUJOURS
atteints via un ancêtre client (`NodeCard` rendu exclusivement par
`SeriesDrillDown`/`TreeView`, `MatchRow` lui-même client). Sur Mes pronos,
`MatchRowStatic` (serveur, sans ancêtre client) l'utilise directement pour
la première fois — cas jamais rencontré. Choix (recommandé, validé par
l'utilisateur plutôt que de vérifier empiriquement d'abord) : ajouter
`"use client"` directement à `TeamLogo.tsx`. Aucun changement de rendu pour
Bracket/Matchs (déjà dans ce cas en pratique), confirmé par `next build`
sans régression.

Formulaire de correction (`CorrectionRequestForm`) : `<form action={...}>`
natif (§1.1 point 3), wrapper `requestPredictionCorrectionFormAction`
(`lib/actions/corrections.ts`) qui reçoit un `FormData` brut et REDIRIGE
(succès ou échec) — un formulaire sans JS ne peut pas lire une valeur de
retour, l'erreur est donc portée par l'URL de redirection
(`?correctionError=...&correctionMatchId=...`) et rendue par la page au
rechargement, dans la bonne ligne (`<details open>` forcé).

**Vérifications ÉTAPES 1-4** : `npx tsc --noEmit`, `npx eslint .`,
`npx next build` tous propres après chaque étape, aucun conflit de route
(`/play/my-predictions` listé seul).

**Test en conditions réelles (ÉTAPE 5, même session)** : serveur local
(`next start`) + sessions authentifiées réelles obtenues en rejouant le vrai
POST sans JS du formulaire de connexion (React 19/Next 16 encode désormais
ce cas avec 3 champs cachés `$ACTION_REF_N` / `$ACTION_N:0` / `$ACTION_N:1` /
`$ACTION_KEY`, PAS le champ unique `$ACTION_ID_...` observé jusqu'ici sur
`logout()` — la différence tient au fait que `login`/`signup` sont liées via
`useActionState`, avec un état lié en argument, contrairement à `logout()` ou
`requestPredictionCorrectionFormAction`, actions SANS état lié). Deux mots de
passe temporaires posés via l'API Admin sur Amine92/Marco_D (jamais affichés
dans le chat), re-randomisés en fin de session.

Résultats, tous conformes : fenêtre Récent correcte (2 des 3 matchs
verrouillés, le plus ancien exclu mais présent dans les filtres) ; badge EN
DIRECT + score et score final rendus correctement ; prono FROZEN de Marco_D
(désactivé) bien conservé et affiché ; panneau des autres joueurs avec le
rendu NOMINATIF exact du §7.1 (« Saisi par Sofia_Admin à la demande de
Yanis44 — … ») ; **écriture réelle testée** : dépôt d'une requête de
correction par Amine92 sur un match MISSING → ligne `match_predictions` vide
créée + `correction_requests` PENDING créée exactement selon la voie A,
rechargement affichant bien « Requête en attente. » ; **cas négatif testé** :
la même tentative par Marco_D (désactivé) bloquée par la garde `is_active()`
de la fonction SQL, erreur affichée dans la bonne ligne au rechargement.
Aucune régression sur `/home`, `/leaderboard`, `/bracket`, `/play`,
`/play/matches`.

**Trouvaille distincte, hors périmètre du lot mais vérifiée à la demande de
l'utilisateur** : le vrai flux d'INSCRIPTION (`/signup`) a été testé pour la
première fois de bout en bout sur ce projet (les 7 comptes de seed avaient
tous été créés via l'API Admin, qui ne passe jamais par l'envoi d'email). Le
code est correct (code compétition vérifié, unicité du pseudo vérifiée,
appel `signUp()` dans le bon ordre) mais échoue avec `429 — email rate limit
exceeded` côté Supabase : conséquence DIRECTE du point déjà connu §6
ci-dessous (« Confirm email » toujours actif) — tant qu'il ne l'est pas
désactivé, chaque inscription réelle tente d'envoyer un email de
confirmation et sature vite le mailer par défaut. Aucun compte orphelin
créé (vérifié via l'API Admin). Non corrigible par le code, action dashboard
seule.

Reste en base, artefact de test légitime non nettoyé : 1 requête PENDING
(Amine92/DEN-SAC) + sa ligne `match_predictions` vide associée.
```

### 2.12 Correctif pastille de logo (session du 25/07/2026)

```text
Remonté par l'utilisateur en testant l'écran Mes pronos (visible aussi sur
Bracket/Matchs, même composant partagé) : SPEC_DESIGN_SYSTEM_V0_1.md §10.1
(acté §14.3) exige une pastille neutre CONSTANTE (`--color-logo-pastille`,
#EDF1F7, cercle `--radius-full`, identique dark/clair) DERRIÈRE chaque logo
— jamais implémentée depuis la création de `TeamLogo.tsx` (§2.9) : le logo
(et son repli abréviation) s'affichait nu, sans fond.

Corrigé en 2 étapes montrées et validées séparément :
1. `app/tokens.css` : nouveau token `--color-logo-pastille-text` (texte du
   repli, `var(--c-navy-900)` — sombre CONSTANT sur la pastille claire
   constante, jamais un token qui suit le thème, §10.3).
2. `components/ui/TeamLogo.module.css`/`.tsx` réécrits : nouveau conteneur
   `.pastille` (fond + `border-radius: var(--radius-full)` + padding
   `--space-1`, `size` = diamètre de la pastille, `box-sizing: border-box`
   pour ne pas changer l'empreinte visuelle) enveloppant le logo OU le
   repli abréviation, qui remplissent désormais 100% du conteneur au lieu
   de porter leur propre fond/couleur.

Aucun autre fichier touché (aucun appelant de `TeamLogo` modifié — le
changement est interne au composant). Vérifié : `npx tsc --noEmit`,
`npx eslint .`, `npx next build` tous propres. Gap retiré de
`GAPS_OUVERTS.md`.
```

### 2.13 Refonte de l'entête Matchs + correctif des 30 logos (session du 25/07/2026, suite)

```text
Suite de petites retouches demandées par l'utilisateur en testant l'écran
Matchs, conduites une par une, chacune montrée en diff et vérifiée
(tsc/eslint/build) avant la suivante. Rien de committé à ce stade.

TeamPicker.tsx (carte dépliée, PredictionForm) :
- Logo agrandi 32 → 48px (seule cette carte ; MatchRow replié et NodeCard du
  bracket gardent leurs tailles).
- Abréviation retirée de l'affichage (ne restent QUE le logo et le nom
  complet en petit) — l'abréviation vit désormais uniquement dans l'entête
  replié (ci-dessous), plus besoin de la répéter ici. Classe .abbrev, devenue
  inutilisée, retirée de TeamPicker.module.css.

MatchRow.tsx (+ .module.css) — refonte de l'entête REPLIÉ, variante A « split
neutre » (demandée explicitement, comportement d'ouverture inchangé) :
- Les 2 <TeamLogo> disparaissent de l'entête replié (recentrés ailleurs, cf.
  ci-dessous) ; remplacés par un split 2 colonnes (grosse abréviation par
  équipe, séparateur vertical 1px) — import TeamLogo retiré de MatchRow.tsx
  (plus utilisé dans ce fichier après ce changement).
- Nouvelle structure : .split (grille 3 colonnes équipe/séparateur/équipe) au-
  dessus, .metaRow (heure+verrou à gauche, statut+chevron à droite, séparée
  par une bordure horizontale) en dessous — remplace l'ancienne grille à 4
  colonnes sur une seule ligne.
- Token de taille de l'abréviation repris À L'IDENTIQUE de TeamPicker
  (--font-size-lg), pas réinventé.
- .status/.status*/.chevron/.chevron Open/.time/.lock/.row inchangés (mêmes
  règles, juste redistribués dans la nouvelle disposition).

Correctif des 30 logos de franchise (public/logos/teams/*.svg) — remonté par
l'utilisateur en testant Mes pronos : les logos paraissaient décentrés dans
leur pastille (certains « trop hauts », d'autres « trop à gauche »), variable
selon l'équipe. Diagnostic (pas supposé, vérifié fichier par fichier) : ce
n'était PAS un bug de TeamLogo.tsx/.module.css (le centrage CSS via
object-fit:contain + flex était déjà correct), mais un défaut des fichiers
SVG eux-mêmes — chaque `viewBox` réservait un canevas plus grand que le
dessin réel (ex. SAS.svg : viewBox déclaré 420×399.5, mais tous les tracés du
fichier restent sous y≈180 — plus de la moitié du canevas est du vide jamais
dessiné, poussant visuellement le logo en haut de sa pastille). Neuf fichiers
(ATL/DEN/DET/IND/LAC/MIN/PHI/TOR/WAS) partagent un viewBox absolument
identique (`420 514.7`) — signe d'un gabarit d'export commun, pas d'un
défaut isolé.

Corrigé par un script Node jetable (aucune dépendance ajoutée, aucun
navigateur) : parseur de tracés SVG maison (commandes M/L/H/V/C/S/Q + Z,
échantillonnage à 32 points par courbe de Bézier pour l'approximation —
aucune commande d'arc rencontrée dans ces 30 fichiers, vérifié par recherche
avant d'écrire le parseur) + polygones/rects/cercles, calcule la boîte
englobante RÉELLE du dessin de chaque logo, puis réécrit son `viewBox` pour
qu'il colle au dessin (marge uniforme de 4 % de la plus grande dimension).
Diff complet (30 lignes, une par équipe) montré et confirmé par l'utilisateur
AVANT toute écriture — passe dry-run puis passe d'écriture séparées. Chaque
fichier n'a qu'UNE seule ligne changée (l'attribut viewBox), rien d'autre
dans le XML. Confirmé visuellement par l'utilisateur après coup : logos bien
centrés.

Vérifié après chaque étape : `npx tsc --noEmit`, `npx eslint .`,
`npx next build` tous propres. Aucun autre fichier touché (TeamPicker/
MatchRow restent les 2 seuls fichiers de code modifiés ; les 30 SVG sont les
seuls assets modifiés). Committé et poussé sur `main` sur demande explicite
de l'utilisateur (« Commit tout et push ») — voir §2.14.
```

### 2.14 Commit/push du lot logos + amendements de specs (session du 25/07/2026, suite)

```text
Le lot §2.13 (entête Matchs + correctif des 30 logos) a été committé
(`5956966`) et poussé sur `main` sur demande explicite de l'utilisateur
(« Commit tout et push »), à la suite du commit du correctif de pastille
(`483a9fb`, §2.12) et du lot « Mes pronos » (`d73498b`, §2.11).

Une expérimentation intermédiaire, demandée puis explicitement ABANDONNÉE
dans la foulée, n'a laissé AUCUNE trace dans le code committé : un fond de
pastille à 50 % d'opacité (`color-mix(in srgb, var(--color-logo-pastille)
50%, transparent)` dans `TeamLogo.module.css`) a été essayé, montré en diff,
puis retiré sur demande avant tout commit — retour au fond plein d'origine.
Consigné ici pour mémoire, mais ce n'est PAS un amendement de §10.1/§14.3 de
`SPEC_DESIGN_SYSTEM_V0_1.md` : rien n'a changé sur ce point.

**Amendements consignés dans les specs elles-mêmes** (pas seulement ici —
demandé explicitement par l'utilisateur, pour que les fichiers de cadrage
restent la source de vérité au-delà de ce fichier d'état) :
- `SPEC_DESIGN_SYSTEM_V0_1.md` §16 (nouveau) : le tier `--logo-size-lg`
  (48px, « moment fort », §10.2) se déplace de l'entête de match (qui perd
  son logo) vers la carte-sélecteur `TeamPicker` ; provenance réelle des
  logos clarifiée (déposés à la main par l'utilisateur, indépendants de
  Highlightly/B4 cité au préambule de §10) ; test de pastille à 50 %
  documenté comme abandonné, pas comme amendement.
- `SPEC_ECRAN_MATCHS_V0_1.md` §20 (nouveau) : l'entête replié (§3.1) passe du
  mockup `[logo] BOS – MIA …` à un split neutre deux abréviations sans logo ;
  annotation inline ajoutée directement sous le mockup d'origine (même
  patron que l'amendement V0.2 de T7) ; ligne 17 ajoutée au récapitulatif
  §19.

Clarification demandée par l'utilisateur avant d'écrire quoi que ce soit dans
`GAPS_OUVERTS.md` (AskUserQuestion) : le décentrage des logos (§2.13) est
bien réglé et confirmé — le point resté réellement ouvert est différent
(tailles inégales entre logos faute de viewBox uniformément carré, cf.
`GAPS_OUVERTS.md`), pas le décentrage lui-même. Une reformulation naïve
aurait rouvert à tort un point déjà fermé et confirmé par l'utilisateur.
```

### 2.15 Écran Nouveau pari + saisie inline dans Matchs (sessions du 26-27/07/2026)

```text
Périmètre : SPEC_ECRAN_NOUVEAU_PARI_V0_1.md (Cadrage/V1/Spec visuelle/,
CLOSE) — premier écran du lot « Paris », ferme la destination du raccourci
pari (SPEC_ECRAN_MATCHS_V0_1.md §18.3, GAPS_OUVERTS.md). Sixième écran du
hub joueur, TROISIÈME écran qui ÉCRIT.

Spec livrée en statut BROUILLON : Claude s'est arrêté avant tout code (règle
du dépôt) et a signalé le blocage plutôt que de deviner. Close en clarifiant
3 points de son §16 (AskUserQuestion, pas tranchés seul) : défauts de
brouillon (catégorie PLAYER_PROP, difficulté 3, §5.4) ; cible figée en
édition — scope/série/match non modifiables une fois le pari créé, un
nouveau pari pour viser ailleurs (§9.2) ; libellés d'états vides/erreurs du
§12 actés tels quels.

Pré-vol §15 (avant la 1re ligne de code) : trigger `enforce_bet_transitions`
(migration #3) ne whitelistait pas `SUBMITTED → DRAFT` (le geste « retirer »,
§9) — BLOQUANT, migration dédiée requise (voir plus bas). `bet_deadline_open`
(migration #3) confirmée réutilisable, sa réplique TypeScript existait déjà
dans `lib/queries/home.ts` — pas une 3e implémentation. Routes `/play/bets/*`
confirmées absentes du disque. `TeamLogo` confirmé réutilisable, tier 20px
retenu pour les sélecteurs de cet écran.

**Décision structurante confirmée AVEC l'utilisateur** : les 3 server actions
suivent le patron `request_prediction_correction` (fonction SQL `SECURITY
DEFINER`, migration #7) plutôt qu'une logique TypeScript pure
(`lib/actions/matches.ts`) — la garde de quota « 3 paris MATCH/série » (0.2.4
§6) n'a aucun backstop d'index unique, contrairement aux deux quotas « 1
actif » ; un `SELECT count` puis `INSERT` en deux allers-retours TypeScript
laisserait une fenêtre de course entre deux soumissions quasi simultanées.

Migration #9 (`20260726120000_bet_withdraw_transition.sql`) : ajoute
`SUBMITTED → DRAFT` à `enforce_bet_transitions` (`create or replace
function`, trigger existant inchangé). Migration #10
(`20260726130000_bet_write_functions.sql`) : `save_bet(...)` (création OU
édition, DRAFT/SUBMITTED selon `p_submit` ; refuse `p_submit=false` sur un
SUBMITTED — le retrait passe exclusivement par l'autre fonction) et
`withdraw_bet(p_bet_id)`, toutes deux `SECURITY DEFINER`, reproduisant
ELLES-MÊMES chaque garde du §11 (propriétaire, statut, deadline, cible
identifiée, quota, scope interdit en NBA Cup — RLS contournée par le rôle
propriétaire, rien ne lui est délégué, comme migration #7). Messages
d'erreur des cas produits repris mot pour mot du §12.
**`pg_advisory_xact_lock`** (clé = user × série) ajouté par Claude AVANT le
comptage du cap « 3 MATCH/série » (pas demandé explicitement, nécessaire
pour que le choix SECURITY DEFINER tienne sa promesse d'atomicité — sans
lui, deux créations concurrentes sur la même série auraient pu chacune lire
« 2 existants » et produire 4 paris actifs). Les deux migrations montrées
intégralement, confirmées, poussées par l'utilisateur lui-même (`npx
supabase db push` bloqué pour Claude par le classificateur de permissions de
l'environnement — pas un refus de Claude).

Code : `lib/labels/bets.ts` (catégories/difficultés/défauts/cap de quota,
SANS dépendance serveur — importable par le composant `"use client"` sans
faire fuiter `next/headers` dans son bundle, piège trouvé EN écrivant le
formulaire, corrigé avant qu'il ne casse le build) ; `lib/queries/bets.ts`
(`getNewBetFormData`/`getEditBetFormData`, dispos recalculées serveur en
reproduisant `bet_deadline_open`) ; `lib/actions/bets.ts`
(`saveDraftBet`/`submitBet`/`withdrawBet`, relais fins vers `.rpc()`) ;
routes `app/(app)/play/bets/new/` et `.../[id]/edit/` + `components/bets/
BetForm.tsx` (SEULE feuille `"use client"`, sélecteurs série/match en listes
de boutons + logos, catégorie/difficulté en `<select>` natifs). Hub
temporaire (§2.10) et `BetShortcut` (écran Matchs) mis à jour pour pointer
vers la vraie route — gap fermé.

Vérifié : `npx tsc --noEmit`, `npx eslint .`, `npx next build` propres à
chaque étape. **Test en session authentifiée réelle** (script Node jetable,
service_role pour la préparation + `signInWithPassword` pour la vraie
session testée) : 26 vérifications passées — cycle de vie complet (créer,
soumettre, ré-écrire un SUBMITTED sans toucher `submitted_at`, retirer,
re-soumettre avec `submitted_at` renouvelé) + 5 cas négatifs (retrait d'un
DRAFT, brouillon d'un SUBMITTED, pari d'un AUTRE joueur, cible déjà
commencée, doublon sur un match, cap 3 MATCH/série). Fixtures de test
(dates de matchs, paris jetables) nettoyées, base vérifiée identique à
l'état seedé après coup.

**Test manuel navigateur** (session du 27/07/2026, suite) : aucun skill
projet pour lancer l'app, `chromium-cli` indisponible — `playwright`
installé temporairement (`--no-save`, retiré après, `package.json` jamais
touché), pilotant le serveur `next dev` DÉJÀ EN COURS (réutilisé plutôt que
d'en relancer un second). 6 scénarios rejoués avec captures : entrée libre,
création, édition→soumission, ré-édition→retrait, raccourci réel depuis
Matchs, raccourci vers un match fermé (repli + message discret §2) — tous
conformes. Un faux résultat (état d'un test précédent semblant subsister
après un chaînage de navigations dans le même onglet) écarté en isolant la
navigation dans un contexte navigateur neuf — le rendu serveur était en
réalité correct.

**Deux évolutions demandées après le test, mêmes conventions** :
- **Bandeau sticky** : la zone de saisie (énoncé/catégorie/difficulté/
  boutons, pas seulement les boutons) reste `position: fixed` en bas du
  viewport dans `BetForm.module.css`, plutôt qu'à atteindre en scrollant.
  Bug trouvé en MESURANT (`getBoundingClientRect`, pas une capture d'écran —
  biaisée en plein-page à cause du repositionnement temporaire du viewport
  par l'outil de capture) : l'offset copié du patron `StickyMeBar`
  (56px) chevauchait de ~11px la barre d'onglets (hauteur RÉELLE ~67px,
  supérieure à ce que le calcul supposait) — corrigé (`+var(--space-6) +
  env(safe-area-inset-bottom, 0px)`, ~76px), marge confirmée après coup.
- **Saisie inline dans Matchs** : élargissement RÉEL du périmètre acté par
  la spec §1 (confirmé explicitement avec l'utilisateur avant de coder,
  pas deviné) — `BetShortcut.tsx` remplacé par `components/matches/
  InlineBetForm.tsx`, formulaire complet ciblé sur CE match (scope MATCH
  figé, pas de sélecteur série/match), pré-rempli si un DRAFT/SUBMITTED
  existe déjà. `lib/queries/matches.ts` étendu : nouveau type `MyMatchBet`
  (contenu du pari actif du joueur sur ce match), requête `bets` élargie
  (portait avant seulement scope/statut). Les routes dédiées restent en
  place pour les paris SÉRIE et l'entrée libre. Testé en navigateur réel :
  création inline, pré-remplissage, soumission, retrait — confirmés.

**Point laissé ouvert, signalé explicitement, pas tranché** : le bandeau
sticky n'a pas été reproduit pour la version inline (collision possible si
plusieurs lignes de match sont dépliées simultanément) — voir
`GAPS_OUVERTS.md`.

Vérifié à nouveau après les 2 évolutions : `npx tsc --noEmit`, `npx eslint .`,
`npx next build` propres. Toutes les fixtures de test (mots de passe, dates
de matchs, paris jetables) nettoyées et vérifiées restaurées à l'identique ;
dépendance `playwright` retirée. Aucune migration pour ce complément.
```

### 2.16 Écran Bracket personnel (remplissage) (session du 27/07/2026)

```text
Périmètre : SPEC_ECRAN_BRACKET_PERSONNEL_V0_1.md (Cadrage/V1/Spec visuelle/,
CLOSE) — écran de remplissage du bracket, laissé HORS PÉRIMÈTRE par
SPEC_ECRAN_CLASSEMENT_BRACKET_V0_1.md §18 (« lot ultérieur »). Septième écran
du hub joueur, DISTINCT de /bracket (vue globale de consultation partagée,
déjà codée, INCHANGÉE) : ici, saisie PERSONNELLE d'un joueur connecté.

Aucune spec n'existait pour cet écran (contrairement à Nouveau pari, qui
avait au moins un brouillon) — rédigée EN SÉANCE avec l'utilisateur, appuyée
sur des décisions déjà actées (nba_pronos_decisions_0_2_2_bracket_initial.md,
nba_pronos_decisions_0_2_9_ux_ui.md §5) et sur un enseignement retenu du
PROTOTYPE (Cadrage/OLD/ETAT_DEVELOPPEMENT_PROTOTYPE.md §7.2/§7.4) : un bug
réel y avait fait primer le résultat OFFICIEL sur le pronostic du joueur pour
dériver les équipes candidates des tours 2+, et validait un pick contre les
colonnes officielles (`series.team1_id/team2_id`, toujours NULL avant le vrai
résultat) au lieu des candidats dérivés — corrigé à l'époque, explicitement
consigné comme garde-fou à ne pas perdre pour cette réécriture V1.

Close en confirmant 4 points (AskUserQuestion) : Realtime `series` REPORTÉE
(aucun besoin live sur cet écran précis) ; libellés des états vides actés
tels quels ; contenu du popup de validation rédigé et validé ; structure de
fichiers séparée de lib/queries/bracket.ts (vue globale, pas d'écriture).

Pré-vol (avant tout code) : RLS `brackets_insert/update` et
`bracket_picks_insert/update` (migration #3) confirmées EXISTANTES et
SUFFISANTES (propriétaire + `is_active()` + `not bracket_deadline_passed()`)
— **aucune migration nécessaire pour ce lot**, contrairement à « Nouveau
pari ». `bracket_deadline_passed(competition_id)` confirmée réutilisable.
Route `/play/bracket` confirmée absente (seule `/bracket`, vue globale,
existait). Jeu de données de test : bracket d'Amine92 (11/15, volontairement
incomplet) confirmé intact, exploitable pour tester la cascade sans y
toucher.

Code : `lib/queries/bracket-fill.ts` — `computeCandidateTeamIds(series,
myWinnerBySeriesId, competitionType)`, fonction PURE qui dérive les 2 équipes
CANDIDATES de chaque série (officielles pour le tour racine — ROUND_1 en
Playoffs, CUP_QUARTERS en Cup — dérivées du PICK du joueur sur les séries
`next_series_id`/`next_series_slot` pour les tours suivants, JAMAIS du
résultat officiel) + `getBracketFillData()` (bootstrap complet : séries
groupées par tour/conférence, pick du joueur, statut validé/auto-validé).
`lib/actions/bracket-fill.ts` — `saveBracketPick`/`validateBracket` :
AUCUNE garde de propriétaire/deadline réécrite (déjà portée par la RLS) ;
seule garde applicative ajoutée = validité du vainqueur soumis contre les
candidats, recalculée avec EXACTEMENT la même fonction pure que la lecture
— jamais une 2e implémentation qui pourrait diverger (le bug retenu
ci-dessus). Route `app/(app)/play/bracket/` (`?round=` pour la navigation
par tour, Next.js 16 Promise) + `components/bracket-fill/{RoundTabs,
BracketFillBoard}` (BracketFillBoard = SEULE feuille `"use client"`, tap
vainqueur + boutons de score sauvegardent IMMÉDIATEMENT, pas de brouillon à
confirmer séparément — 0.2.9 §5). `ProgressBar` réutilisé tel quel depuis
components/bracket/ (vue globale) — composant déjà pur, sans changement.
Hub temporaire (`app/(app)/play/page.tsx`) mis à jour : les 4 entrées sont
désormais TOUTES actives (plus aucune entrée inerte) — code CSS mort
(`.entryInert`/`.soon`) retiré au passage.

Vérifié : `npx tsc --noEmit`, `npx eslint .`, `npx next build` propres.
**Test de la cascade en isolation** (script jetable, `npx tsx`, AUCUNE base
de données) : 5/5 vérifications passées, dont la plus significative —
un résultat officiel simulé DIFFÉRENT du pick du joueur pour une série
ROUND_1, confirmant que la série CONF_SEMIS dérive bien du PICK, jamais du
résultat officiel. **Test en session authentifiée réelle** (navigateur,
compte Tariq_M — aucun bracket existant, jeu de données propre) : la
deadline du bracket, datant du seed, était déjà passée (même piège que les
matchs testés au lot précédent) — avancée temporairement, restaurée après.
Round 1 rendu correctement (8 séries, logos, 4 boutons de score) ; pick
d'un vainqueur + score sauvegardé et vérifié en base ; navigation vers
« Demi-finales de conférence » confirmant la cascade EXACTE (les 2 équipes
picked apparaissent comme candidates de la bonne série, « Équipe à définir »
pour les 3 autres) ; validation du bracket à 2/15 réussie (aucune garde de
complétude, conforme à §4) — confirmée en base (`is_validated=true`,
`validated_at` posé). Toutes les fixtures nettoyées après coup (picks,
bracket, deadline restaurée, mot de passe réinitialisé) — base vérifiée
identique à l'état seedé.
```

### 2.17 Déploiement Vercel + activation de l'inscription (session du 27/07/2026, suite)

```text
Périmètre : premier déploiement public du projet, hors périmètre de tout
lot d'écran — décidé par l'utilisateur pour montrer une démo à ses amis,
avant de reprendre le codage (« Mes paris »/admin, §2.19).

Commit/push : les lots « Nouveau pari » (§2.15) et « Bracket personnel »
(§2.16), codés/testés mais jamais poussés, groupés en UN commit (`d051097`,
tsc/eslint/build revérifiés propres avant push) — `Cadrage/nba-pronos.lnk`
(raccourci Windows accidentel, pas du contenu projet) exclu. Confirmation
explicite requise avant ce push : un premier « ok » était arrivé noyé dans
une notification système de tâche en arrière-plan (donc NON un message
utilisateur réel) — signalé comme suspect plutôt que traité comme une
autorisation, l'utilisateur a reconfirmé directement ensuite.

Vercel : CLI connectée (`vercel login`, OAuth par appareil). Nouveau projet
`lenoir-nba/nba-pronos` lié et connecté au dépôt GitHub existant
(`lenoirmath122-dev/nba-pronos`, remote déjà en place). Les 4 variables de
`.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SYNC_SECRET`) poussées sur Production/Preview/
Development via une commande qui les lit directement depuis le fichier —
jamais exposées en clair dans une commande visible. Déployé en production
(`vercel --prod`) → **https://nba-pronos.vercel.app**.

Bug trouvé au premier chargement réel (signalé par l'utilisateur) :
`app/page.tsx` était resté le scaffold `create-next-app` par défaut depuis
la création du projet (18/07/2026) — jamais retouché, jamais remarqué car
tous les tests précédents visitaient des routes précises, jamais la racine
nue. Corrigé (`redirect("/login")`, qui renvoie lui-même vers `/home` si une
session est active, logique déjà portée par `proxy.ts`) — commit `6ff2a68`,
re-déployé, vérifié (`curl` → 307 vers `/login`).

Activation de l'inscription réelle — épisode PAS totalement élucidé (voir
GAPS_OUVERTS.md) : dans le dashboard Supabase (Sign In / Providers →
Supabase Auth → Confirm email), un premier essai de désactivation n'a
apparemment pas pris effet à temps — le tout premier compte réel (celui de
l'utilisateur, `lenoir.math122@gmail.com`, pseudo **Rillettes-31**) a reçu un
email de confirmation avant de pouvoir se connecter (vérifié via les
métadonnées `auth.users` : `confirmation_sent_at` quasi simultané à
`created_at`, connexion seulement après le clic sur le lien). Capture
d'écran ensuite : le toggle était bien décoché et sauvegardé (bouton Save
grisé, rien à enregistrer) — mais un test contrôlé (compte jetable via l'anon
key, supprimé aussitôt après) a de nouveau buté sur
`over_email_send_rate_limit`, et une vraie tentative `/signup` de
l'utilisateur a échoué avec le message générique catch-all de `signup()`
(`lib/auth/actions.ts`). Hypothèse retenue mais NON confirmée : le quota du
mailer par défaut Supabase (partagé entre tous les types d'email, pas
seulement la confirmation) était encore épuisé par le tout premier envoi —
alternative non exclue : un envoi de courtoisie indépendant du caractère
« obligatoire » ou non de la confirmation. Resend évoqué comme solution
durable (SMTP personnalisé) mais écarté pour l'instant : nécessite un nom de
domaine vérifié que l'utilisateur ne possède pas, sans quoi Resend ne permet
d'envoyer qu'à l'adresse du compte Resend lui-même.

Contournement retenu pour la démo : compte créé directement via l'API Admin
(`email_confirm: true`, même mécanisme que les 7 comptes de seed, AUCUN envoi
d'email possible par construction) — **UN SEUL compte PARTAGÉ**, décision
explicite de l'utilisateur après qu'on lui a signalé le compromis (un seul
bracket/jeu de pronos pour tout le monde, pas de vraie compétition entre
amis tant que ce compte est partagé) : `Demo_Amis` /
`demo-amis@nba-pronos.test`, rôle PLAYER. Passage à un compte par ami prévu
explicitement APRÈS la fin de la V1.

1er admin réel : le compte de l'utilisateur (Rillettes-31) promu ADMIN par
`UPDATE public.users SET role='ADMIN'` direct via service_role — PAS par une
migration dédiée (contrairement à ce qu'anticipait le point ouvert du §6
ci-dessous), et PAS par un écran admin de promotion (aucun n'existe encore,
« écrans admin » reste un lot à coder, §2.19). Le compte cumule donc les
deux rôles (joueur Rillettes-31 + admin) pour l'instant.

Code de compétition communiqué (pour une inscription individuelle
ultérieure, hors du compte partagé) : `EBC67AAD` — compétition « Playoffs
NBA (test) », seule ACTIVE en base à ce jour.

Aucun changement de schéma, aucune migration dans ce lot (2 commits
applicatifs seulement : logique app/, pas de fichier `supabase/migrations/`).
```

### 2.18 Écran Profil (session du 27/07/2026, suite, CLOSE)

```text
Périmètre : SPEC_ECRAN_PROFIL_V0_1.md (Cadrage/V1/Spec visuelle/, CLOSE) —
4ème onglet de la nav, remplace le stub « à venir » (22/07/2026) ET le
bouton de déconnexion temporaire (§2.9). AUCUNE spec détaillée n'existait
avant cette session (même situation que Bracket personnel, §2.16) —
rédigée en séance, close après 3 points tranchés (AskUserQuestion) : pseudo
NON modifiable (identité publique déjà affichée ailleurs) ; avatar HORS
PÉRIMÈTRE (pas de Supabase Storage introduit) ; thème clair/sombre INCLUS
dans ce lot (câblage explicitement laissé en attente par app/tokens.css
depuis la consolidation des tokens, §2.3).

Pré-vol (avant tout code) : RLS `users_update_self` (migration #3)
confirmée SANS restriction de colonne (`id = auth.uid()`, aucune liste de
colonnes) — couvre favorite_team_id/bio/theme_preference sans y toucher ;
trigger `enforce_users_invariants` (T-a) confirmé NE PORTANT QUE sur
role/status, aucun risque de blocage sur les 3 colonnes de ce lot ;
`is_admin()` confirmée réutilisable pour le lien Admin conditionnel ; 30
lignes dans `teams` confirmées (référentiel global D6, stable).

Code : `lib/queries/profile.ts` (getProfileData/getTeamOptions) ;
`lib/actions/profile.ts` (updateThemePreference/updateProfile, FormData
brut + redirect("/profile"), même patron que
requestPredictionCorrectionFormAction) ; `app/(app)/profile/page.tsx` (+
page.module.css) ; `components/profile/TeamPicker.tsx` (+ .module.css).

Sélecteur d'équipe favorite : PAS un `<select>` natif (ne peut pas afficher
de logo, piège déjà rencontré §2.15) mais, contrairement aux sélecteurs de
BetForm.tsx (`role="radio"` sur des `<button>`, nécessitant du client-side
state), de VRAIS `<input type="radio">` natifs — ce picker n'a AUCUNE
dépendance entre champs à gérer en direct, donc zéro `"use client"` pour
tout l'écran (surlignage de la ligne sélectionnée en CSS pur, `:has()`).
Interprétation trouvée en codant, pas fixée par la spec (qui laissait le
point ouvert, §10).

Thème clair/sombre : lu et posé dans `app/layout.tsx` (racine, hors des
deux route groups (app)/(public) — s'applique à TOUT le site, visiteur
non connecté inclus). Pas de session → défaut DARK (aucune préférence à
lire). `<html data-theme="light">` posé seulement si LIGHT — sinon
l'attribut est omis (cohérent avec le CSS, dark par défaut sur :root).
Écriture suivie d'un `redirect("/profile")` (pattern déjà utilisé PARTOUT
dans ce projet, jamais dévié pour ce lot) : la redirection retraverse
`app/layout.tsx`, qui relit la préférence fraîche — bascule effective dès
la page suivante, sans JS supplémentaire, sans `router.refresh()`.

Vérifié : `npx tsc --noEmit`, `npx eslint .`, `npx next build` propres.
Toutes les routes deviennent DYNAMIQUES (`ƒ`) après ce lot — y compris `/`,
`/login`, `/signup`, auparavant statiques (`○`) — conséquence ATTENDUE de
la lecture de session dans `app/layout.tsx` (cookies), pas une régression.

**Test en session authentifiée réelle** (serveur `next dev` déjà en cours
sur le port 3001, réutilisé — piège déjà rencontré §2.15, toujours vérifier
qui sert quoi avant de relancer quoi que ce soit) : login réel sans JS
(compte Demo_Amis, replay du POST avec les 4 champs `$ACTION_*` d'un
formulaire lié à `useActionState`, même technique que §2.11) ; toggle
thème réellement posé (POST du formulaire théorique sans JS, champ
`$ACTION_ID_...` unique comme pour `logout()`) et vérifié PROPAGÉ à
`/home` sans reconnexion ; visiteur déconnecté vérifié TOUJOURS en dark
(aucun attribut `data-theme`) ; sélection d'équipe favorite persistée en
base ET re-rendue avec le bon radio `checked` au rechargement ;
déconnexion réelle testée (cookie effacé, 303 → `/login`) ; tentative
d'escalade `role` par la même session confirmée BLOQUÉE par le trigger
existant (message inchangé). Aucune régression sur `/`, `/login`,
`/signup`, `/leaderboard`, `/bracket`. Toutes les valeurs de test
restaurées après coup (compte Demo_Amis identique à son état d'avant test).

Déployé en production (`vercel --prod`) juste après, vérifié en ligne
(`curl` → 307 sur `/` et `/profile`).
```

### 2.19 Écran Mes paris (session du 27/07/2026, suite, CLOSE)

```text
Périmètre : SPEC_ECRAN_MES_PARIS_V0_1.md (Cadrage/V1/Spec visuelle/, CLOSE)
— consultation PERSONNELLE de tous les paris du joueur (tous statuts) +
quotas, ferme le 8ème écran du hub joueur. Aucune spec détaillée
n'existait avant cette session (seulement identifié comme « hors
périmètre » dans le préambule de SPEC_ECRAN_NOUVEAU_PARI_V0_1.md). Deux
points fermés AVANT rédaction (AskUserQuestion) : révélation publique des
AUTRES joueurs (0.2.4 §9, jamais construite nulle part malgré la décision
actée — vérifié dans le code réel d'AssociatedBetCard, qui ne lit que
`user_id = auth.uid()`) — REPORTÉE, reste un point ouvert distinct
(GAPS_OUVERTS.md) ; demande de correction sur un pari — INCLUSE mais
restreinte au cas « pari VALIDATED dont la cible est déjà terminée et
jamais résolu » (contester un REFUS ou un résultat déjà posé nécessiterait
d'étendre `enforce_bet_transitions`, REJECTED/WON/LOST étant des états
TERMINAUX aujourd'hui — hors périmètre de ce lot).

Pré-vol : `bets_select` (migration #3) confirmée suffisante côté
propriétaire ; `enforce_bet_transitions` confirmé laissant déjà
VALIDATED→WON/LOST ouvert (aucune modification nécessaire pour la
correction) ; `correction_requests` confirmée déjà prête pour
`target_type='BET'` — et l'index unique partiel `uniq_pending_correction_
per_bet` (garde « une seule requête PENDING ») EXISTAIT DÉJÀ depuis la
toute première migration (#1), anticipé avant même que la fonctionnalité
ne soit spécifiée.

Code : `lib/queries/my-bets.ts` (`getMyBets`, réutilise `MATCH_SLOT_CAP`
de lib/labels/bets.ts pour l'affichage du quota, aucune 2e implémentation
du calcul) ; `lib/actions/bet-corrections.ts`
(`requestBetCorrectionFormAction`, même patron FormData + redirect que
`requestPredictionCorrectionFormAction`) ; `app/(app)/play/bets/page.tsx`
(l'INDEX du dossier existant, `new/` et `[id]/edit/` inchangés) ;
`components/my-bets/{SegmentTabs,QuotaBanner,MyBetRow}.tsx` — statuts/
couleurs REPRIS À L'IDENTIQUE d'`AssociatedBetCard` (Mes pronos), pas une
2e convention divergente pour le même statut. Migration #11
(`request_bet_correction`, SECURITY DEFINER, SANS « voie A » — un pari
existe TOUJOURS complet dès sa création, contrairement à un prono).

**Bug trouvé en testant, corrigé par migration #12** (même patron que la
migration #4 historique — patch via un NOUVEAU fichier, jamais une
réécriture de la migration déjà appliquée) : la migration #11 lisait
`series.status`, colonne qui N'EXISTE PAS — la vraie colonne est
`series.official_status` (`matches`, elle, porte bien `status`). Aurait
fait échouer TOUTE requête de correction sur un pari SÉRIE. Trouvé en
appelant la fonction en conditions réelles, pas en relisant le code.

Hub Jouer temporaire : l'entrée « Paris » pointait vers `/play/bets/new`
depuis le lot Nouveau pari — corrigée pour pointer vers `/play/bets` (ce
nouvel écran), qui porte lui-même le lien vers `/play/bets/new`, même
patron que les autres entrées du hub.

Vérifié : `npx tsc --noEmit`, `npx eslint .`, `npx next build` propres.
**Test en session authentifiée réelle** (compte Demo_Amis, serveur `next
dev` déjà en cours réutilisé) : 7 paris de test créés via service_role
couvrant les 7 statuts (dont un VALIDATED ciblant un match déjà FINISHED
— cas « oublié »), tous rendus correctement dans le bon segment (En
cours/Terminés), bandeau de quota vérifié (« 1/1 série · 1/3 match ») ;
formulaire « Signaler à un admin » réellement soumis sans JS, ligne
`correction_requests` vérifiée en base, page rechargée affichant bien
« Requête en attente » ; 3 cas négatifs testés en session réelle (2e
requête sur le même pari, tentative sur un DRAFT, tentative sur un
SUBMITTED — tous bloqués avec le bon message). Toutes les données de test
supprimées après coup (7 paris + 1 requête de correction), compte
Demo_Amis vérifié identique à son état d'avant test. Aucune régression
sur les 10 autres routes de l'app. Déployé en production (`vercel
--prod`), vérifié en ligne.
```

### 2.20 Prochaine étape

```text
Restent à confirmer avec l'utilisateur : les écrans admin (aucune spec
n'existe). « Mes paris » (§2.19) et Profil (§2.18) sont désormais CODÉS,
retirés de cette liste — Bracket personnel (§2.16) l'était déjà. Deux
points ouverts distincts identifiés en codant « Mes paris », toujours non
traités : révélation publique des paris des autres joueurs (0.2.4 §9) ;
contester un pari REJETÉ ou déjà résolu GAGNÉ/PERDU (nécessiterait
d'étendre enforce_bet_transitions) — voir GAPS_OUVERTS.md pour le détail.
Publication Realtime de `series` (T4 §9) : reste REPORTÉE (§2.16) faute
de besoin live identifié sur un écran codé à ce jour. Même conventions
reconduites (composants serveur par défaut, CSS Modules + tokens, RLS/
fonctions dédiées comme seule autorité de lecture ; vérifier D'ABORD si
la RLS existante suffit avant d'ajouter une fonction SECURITY DEFINER).
Le vrai hub Jouer (§2.10) reste à SPÉCIFIER (spec d'écran dédiée) avant
d'être codé — aucune date arrêtée. Puis T8 (déploiement — §6 à faire
avant, dont l'effacement du jeu de données de test ET du compte de démo
partagé §2.17, ET le retrait du hub Jouer temporaire §2.10).
```

## 3. État actuel de la base de données

```text
12 migrations appliquées (supabase/migrations/, via `npx supabase db push`,
chacune montrée intégralement et confirmée par l'utilisateur avant
application) — les 6 premières inchangées depuis le 23/07/2026 (les lots
logos/déconnexion/hub temporaire du 24/07, §2.9/§2.10, étaient purement
applicatifs) ; #7 et #8 ajoutées par le lot « Mes pronos » (§2.11) ; #9 et
#10 ajoutées par le lot « Nouveau pari » (§2.15, poussées par l'utilisateur
lui-même — `db push` bloqué pour Claude par le classificateur de permissions
de l'environnement) ; #11 et #12 ajoutées par le lot « Mes paris » (§2.19,
`db push` NON bloqué cette fois, poussées directement) :

1. 20260718090000_initial_schema.sql — schéma complet.
2. 20260718100000_auth_join_code_and_profile.sql — code compétition,
   verify_join_code(), trigger handle_new_user.
3. 20260718110000_rls.sql — competition_secrets, fonctions SECURITY DEFINER,
   RLS activée + policies, triggers d'invariants.
4. 20260718120000_fix_users_trigger_system_context.sql — correctif contexte
   système (auth.uid() NULL laissé passer).
5. 20260723130000_leaderboard_universal_visibility.sql — user_scores/
   user_recent_form en security_invoker=false + admin_corrections_count
   intégré à user_scores (§2.7).
6. 20260724090000_match_predictions_committed_count.sql —
   count_committed_predictions(p_match), SECURITY DEFINER, un entier
   uniquement (§2.8).
7. 20260724100000_request_prediction_correction.sql —
   request_prediction_correction(p_match, p_justification, p_proposed_*),
   SECURITY DEFINER, voie A (§2.11/§10.2 de la spec) : crée une ligne
   match_predictions VIDE si aucune n'existe puis la correction_requests
   liée, dans une seule transaction. Garde-fous complets §10.3. N'écrit
   JAMAIS de contenu de pronostic.
8. 20260724110000_realtime_matches.sql — publication supabase_realtime
   étendue à `matches` UNIQUEMENT (§2.11) ; `series` toujours PAS activée —
   le lot Bracket personnel (§2.16) n'en avait finalement pas besoin
   (aucun contenu live sur cet écran précis), reportée encore une fois.
9. 20260726120000_bet_withdraw_transition.sql — ajoute `SUBMITTED → DRAFT`
   au trigger `enforce_bet_transitions` (le geste « retirer » d'un pari
   soumis, §2.15 / SPEC_ECRAN_NOUVEAU_PARI_V0_1 §9).
10. 20260726130000_bet_write_functions.sql — `save_bet(p_bet_id, p_scope,
   p_series_id, p_match_id, p_description, p_category, p_difficulty,
   p_submit)` et `withdraw_bet(p_bet_id)`, SECURITY DEFINER (§2.15) :
   reproduisent ELLES-MÊMES toutes les gardes §11 (propriétaire, statut,
   deadline, cible identifiée, quota, scope interdit en NBA Cup) — RLS
   contournée par le rôle propriétaire, comme #7. `pg_advisory_xact_lock`
   (clé user × série) avant le comptage du cap 3 MATCH/série, qui n'a aucun
   backstop d'index unique — ferme une fenêtre de course entre deux
   créations concurrentes.
11. 20260727100000_request_bet_correction.sql — `request_bet_correction(
   p_bet, p_justification)`, SECURITY DEFINER (§2.19) : SANS voie A
   (contrairement à #7, un pari existe toujours complet dès sa création) —
   crée une correction_requests (target_type='BET') sur une ligne bets DÉJÀ
   existante, restreint aux paris VALIDATED dont la cible est FINISHED.
12. 20260727110000_fix_request_bet_correction_series_column.sql — correctif
   trouvé en testant #11 en conditions réelles : lisait `series.status`
   (colonne inexistante) au lieu de `series.official_status`. Même patron
   que la migration #4 (patch via un nouveau fichier, #11 jamais réécrite).

**Toujours 10 migrations après le lot Bracket personnel (§2.16)** : la RLS
`brackets_insert/update`/`bracket_picks_insert/update` (migration #3)
couvrait déjà tout le nécessaire pour ce lot — aucune migration ajoutée,
contrairement aux deux lots précédents.

RLS vérifiée de bout en bout via le plan de test T3 §7, puis re-testée avec
un vrai jeu de données (§2.6) — un piège trouvé à cette occasion (§7).
Consommée directement (sans service_role) par tous les écrans joueur via
getServerClient(). Les fonctions #7, #10 et #11/#12 sont les seules à
opérer en SECURITY DEFINER (contournent une policy/la RLS) — chacune
justifiée en commentaire dans son fichier de migration et testée en
conditions réelles (§2.11/§2.15/§2.19). #9 modifie seulement la whitelist
du trigger existant
(`enforce_bet_transitions`, PAS security definer, inchangé sur ce point).

Données : compétition Playoffs de TEST active (§2.6) — 30 équipes, 15
séries, 9 matchs, 7 comptes. JETABLE, pas une vraie compétition — à
distinguer et à effacer avant tout lancement réel (§6). Étendue le
24/07/2026 (§2.11) : 3 des 9 matchs sont désormais VERROUILLÉS
(scheduled_at passé) — CLE-ORL#1 (FINISHED, prono Yanis44 corrigé),
DEN-SAC#1 (IN_PROGRESS, prono Marco_D désactivé), MIN-GSW#1 (SCHEDULED
malgré une date passée, latence délibérée + prono partiel Nina_R) —
nécessaire pour que l'écran Mes pronos, ancré sur les matchs verrouillés,
soit vérifiable. Porte aussi, depuis le test en conditions réelles du
24/07/2026 : 1 requête de correction PENDING (Amine92 sur DEN-SAC#1) + sa
ligne match_predictions vide associée — artefact de test légitime, non
nettoyé.

Tests du 26-27/07/2026 (§2.15, écran Nouveau pari) : mots de passe
temporaires posés sur Tariq_M puis Nina_R (API Admin, jamais affichés dans
le chat, re-randomisés en fin de session) ; dates `scheduled_at` de
NYK-ATL#1/BOS-MIA#1/MIL-CHI#1 temporairement avancées pour les tests puis
RESTAURÉES à leur valeur seedée d'origine ; matchs jetables (games 2/3/4 de
la série NYK-ATL) et paris créés pendant les tests, tous supprimés après
coup. Base vérifiée par requête directe : identique à l'état seedé, aucun
résidu de ces deux sessions de test.

Test du 27/07/2026 (§2.16, écran Bracket personnel) : `competitions.
bracket_deadline` (datant du seed, déjà passée) temporairement avancée puis
RESTAURÉE à sa valeur d'origine ; mot de passe temporaire posé sur Tariq_M
(aucun bracket existant avant le test, re-randomisé après) ; bracket +
2 bracket_picks créés pendant le test (BOS-MIA, NYK-ATL), tous supprimés
après coup. Le bracket d'Amine92 (11/15, volontairement incomplet, §2.6)
n'a jamais été touché. Base vérifiée par requête directe : identique à
l'état seedé.

`teams.logo_url` : colonne existante, TOUJOURS VIDE (jamais remplie par le
seed) — les logos affichés (§2.9) ne dépendent pas de cette colonne, le
chemin est déduit de `teams.abbreviation` côté rendu.
```

## 4. Fichiers du projet — carte rapide

```text
app/
  layout.tsx, favicon.ico, page.tsx — scaffold create-next-app, non modifiés.
  tokens.css, globals.css — inchangés depuis §2.3.
  (public)/ — inchangé depuis §2.1 (login/signup pas encore stylés T7).
  (app)/
    layout.tsx + layout.module.css — garde session + nav 4 onglets + monte
      UnsavedGuardProvider (§2.8) + bouton de déconnexion TEMPORAIRE (§2.9,
      à retirer, voir GAPS_OUVERTS.md).
    home/page.tsx + page.module.css — écran Accueil. CODÉ.
    play/
      page.tsx + page.module.css — hub Jouer TEMPORAIRE (§2.10, à retirer,
        voir GAPS_OUVERTS.md) : liste 4 entrées, TOUTES actives depuis
        §2.16 (Matchs, Mes pronos, Paris → /play/bets/new, Mon bracket →
        /play/bracket) — plus aucune entrée inerte, code CSS mort retiré.
        PAS l'écran hub définitif (spec dédiée à écrire).
      matches/
        page.tsx + page.module.css — écran Matchs. CODÉ (§2.8).
      my-predictions/
        page.tsx + page.module.css — écran Mes pronos. CODÉ (§2.11).
      bets/
        new/page.tsx + page.module.css — écran Nouveau pari, création
          (contexte libre ou ?matchId=). CODÉ (§2.15).
        [id]/edit/page.tsx + page.module.css — écran Nouveau pari, édition
          d'un DRAFT/SUBMITTED du joueur. CODÉ (§2.15). Si le pari n'existe
          pas / n'appartient pas au joueur / n'est plus éditable ici : état
          inerte (pas de redirection vers « Mes paris », qui n'existe pas
          encore).
      bracket/
        page.tsx + page.module.css — écran Bracket personnel (remplissage).
          CODÉ (§2.16). `?round=` sélectionne le tour affiché. Deadline
          passée → bandeau lecture seule + lien vers /bracket (vue globale),
          pas de formulaire figé affiché pour rien.
    profile/page.tsx  — stub « à venir », PAS stylé. Portera la vraie
      déconnexion un jour (§2.9).
  leaderboard/page.tsx  — Classement. CODÉ (§2.5), lib mise à jour §2.7.
  bracket/page.tsx      — Bracket. CODÉ (§2.5), logos §2.9.
  (admin)/               — PAS ENCORE CRÉÉ.

proxy.ts               — garde d'authentification (T6a §4.1). CODÉ.

lib/
  supabase/{browser,server,service}.ts — les 3 clients. CODÉ.
  auth/actions.ts                      — login/signup/logout. CODÉ ; logout
    câblée pour la 1re fois §2.9 (bouton temporaire).
  actions/
    matches.ts — saveMatchPredictionDraft/validateMatchPrediction/
      validateAllCompleteMatchPredictions + type ActionResult (local à ce
      fichier — pas encore partagé). CODÉ §2.8.
    corrections.ts — requestPredictionCorrection() (appel .rpc() vers la
      migration #7) + requestPredictionCorrectionFormAction() (wrapper
      FormData → redirection, pour le <form> natif sans JS). CODÉ §2.11.
    bets.ts — saveDraftBet/submitBet/withdrawBet, relais fins vers
      .rpc('save_bet'|'withdraw_bet') (migration #10) — aucune écriture
      directe sur `bets`. CODÉ §2.15.
    bracket-fill.ts — saveBracketPick/validateBracket, écriture DIRECTE sur
      brackets/bracket_picks (RLS migration #3 suffit, aucun .rpc()) — seule
      garde applicative ajoutée : validité du vainqueur contre les candidats
      de la cascade, recalculée avec computeCandidateTeamIds
      (lib/queries/bracket-fill.ts), jamais une 2e implémentation. CODÉ §2.16.
  hooks/
    useUnsavedGuard.tsx (+ .module.css) — Garde C2 TRANSVERSE :
      UnsavedGuardProvider, useUnsavedGuard(key), useGuardedNavigation().
      CODÉ §2.8. Non étendu par Mes pronos NI par Nouveau pari (aucune garde
      de saisie sale demandée sur ces deux écrans).
  labels/
    rounds.ts — ROUND_LABELS, PARTAGÉ Bracket + Mes pronos (§16.5). NOUVEAU
      §2.11, extrait de lib/queries/bracket.ts qui le portait en dur.
    bets.ts — BET_CATEGORY_OPTIONS/BET_DIFFICULTY_LABELS/DEFAULT_BET_*/
      MATCH_SLOT_CAP + types BetCategory/BetDifficulty. NOUVEAU §2.15,
      SANS dépendance serveur (contrairement à lib/queries/bets.ts) — seul
      moyen pour components/bets/BetForm.tsx ("use client") d'importer ces
      constantes sans faire fuiter next/headers dans le bundle client.
  queries/
    home.ts        — getHomeData(). CODÉ.
    leaderboard.ts — getLeaderboard(). CODÉ §2.5, MODIFIÉ §2.7 (lit
      admin_corrections_count depuis user_scores, 2 requêtes en moins).
    bracket.ts     — getBracket(). CODÉ, MODIFIÉ §2.11 (importe ROUND_LABELS
      depuis lib/labels/rounds.ts au lieu de le porter en dur). Vue GLOBALE
      de consultation uniquement, pas d'écriture — DISTINCT de
      bracket-fill.ts (§2.16), volontairement pas fusionnés (contrats de
      types différents : groupes/pourcentages ici, pick personnel là-bas).
    matches.ts     — getMatches() + types figés MatchCard/MatchDay/
      MatchesData/TeamRef/OtherPrediction/BetSlotIndicator/
      PredictionViewStatus (spec §13, recopiés à l'identique). CODÉ §2.8.
      MODIFIÉ §2.15 : nouveau type MyMatchBet (contenu du pari MATCH actif
      du joueur sur ce match, DRAFT/SUBMITTED uniquement) + champ MatchCard.
      myBet — alimente la saisie inline InlineBetForm ; requête `bets` du
      fichier élargie (portait avant seulement scope/statut).
    my-predictions.ts — getMyPredictions() + types figés MyPredictionsMode/
      MatchLiveState/MyPredictionState/AdminCorrection/MyPrediction/
      RevealedPrediction/CorrectionRequestState/AssociatedBet/
      MyPredictionRow/SeriesBetHeader/MyPredictionsData (spec §13, recopiés
      à l'identique ; TeamRef réimporté depuis matches.ts, jamais redéfini).
      Dérivation d'état PAR COMPLÉTUDE uniquement (§10.4), y compris pour le
      4e cas DRAFT-complet tranché avec l'utilisateur (§2.11). CODÉ §2.11.
    bets.ts — getNewBetFormData(matchIdParam)/getEditBetFormData(betId) +
      types figés BetFormBootstrap/SeriesOption/MatchOption/NewBetContext/
      EditableBet/NewBetFormData/EditBetFormData (spec §10). Dispos
      (seriesBetOpen/matchBetOpen/matchSlotsUsed/*SlotTaken) recalculées
      serveur en reproduisant bet_deadline_open — jamais lues du client.
      CODÉ §2.15.
    bracket-fill.ts — getBracketFillData() + computeCandidateTeamIds
      (fonction PURE, exportée et réutilisée à l'identique par
      lib/actions/bracket-fill.ts — jamais une 2e implémentation de la
      cascade) + types figés BracketFillCandidate/BracketFillSeries/
      BracketFillRound/BracketFillData (spec §7). CODÉ §2.16.
  scoring/, sync/ — PAS ENCORE CRÉÉS.

components/
  auth/{LoginForm,SignupForm}.tsx — pas encore stylés selon T7.
  icons/nav-icons.tsx — 4 icônes de nav.
  ui/
    Countdown.tsx (+ .module.css) — partagé Accueil + Bracket.
    TeamLogo.tsx (+ .module.css) — NOUVEAU (§2.9). Logo déduit de
      l'abréviation, repli texte via onError. Partagé Bracket + Matchs +
      Mes pronos. Directive "use client" PROPRE ajoutée §2.11 (jusque-là
      transitivement bundlé client via ses 2 seuls appelants, tous deux
      atteints depuis un ancêtre client — devenu insuffisant sur Mes pronos,
      qui l'utilise depuis un composant serveur sans ancêtre client). Pastille
      neutre constante (`--color-logo-pastille`) implémentée §2.12 — absente
      depuis la création du composant, remontée par l'utilisateur en testant
      Mes pronos.
  nav/
    TabBar.tsx + .module.css — onNavigate (useGuardedNavigation) sur les 4
      onglets, inerte par défaut. CODÉ §2.8. Non modifié par le hub Jouer
      temporaire (§2.10) — le lien « Jouer » continue de pointer sur /play.
    PublicNav.tsx / ScreenShell.tsx (+ .module.css chacun) — inchangés.
  home/ — inchangé depuis §2.4 (EmptyState réutilisé par Classement,
    Bracket ET Matchs). Pas de logo ici (§2.9, GAPS_OUVERTS.md).
  leaderboard/ — inchangé depuis §2.5. Pas de logo ici (aucune équipe affichée).
  bracket/ — NodeCard.tsx affiche désormais TeamLogo (§2.9). Vue GLOBALE
    uniquement (lecture, consultation partagée) — ProgressBar.tsx RÉUTILISÉ
    tel quel par l'écran Bracket personnel (§2.16, aucun changement, déjà
    pur/générique filledCount/totalCount).
  bracket-fill/ — NOUVEAU §2.16, 2 fichiers + leurs .module.css :
    RoundTabs.tsx              — serveur, liens ?round= (même patron que
      SegmentTabs de Mes pronos, pas de client nécessaire pour changer d'onglet).
    BracketFillBoard.tsx       — SEULE feuille "use client" de l'écran :
      tap vainqueur + boutons de score (SeriesPickCard, sous-composant
      interne) sauvegardent IMMÉDIATEMENT (saveBracketPick), pas de
      brouillon local à confirmer séparément (0.2.9 §5). Porte aussi le
      bouton + dialogue de confirmation « Valider mon bracket »
      (validateBracket) — même patron de dialogue que PredictionForm
      (écran Matchs), backdrop + alertdialog.
  matches/ — 8 fichiers + leurs .module.css (BetShortcut REMPLACÉ par
    InlineBetForm §2.15, décompte inchangé) :
    MatchDayGroup.tsx        — serveur, regroupement par jour.
    MatchRow.tsx              — "use client" (1/3) : ouverture de la ligne,
      repère de verrouillage + décompte animé. Entête replié refondu §2.13
      (variante « split neutre » : grosses abréviations + séparateur, plus
      de logos ici — TeamLogo retiré de ce fichier, recentré sur la carte
      dépliée uniquement).
    PredictionForm.tsx        — "use client" (2/3) : saisie, drapeau C2,
      2 CTA, dialogue de validation (distinct du dialogue C2). MODIFIÉ §2.15 :
      rend désormais InlineBetForm (matchId/seriesId/betSlot/myBet) au lieu
      de BetShortcut.
    TeamPicker.tsx             — sans "use client", tap direct sur l'équipe,
      logo agrandi à 48px §2.13 (abréviation retirée de cette carte, ne reste
      que logo + nom complet — l'abréviation vit désormais dans l'entête
      replié de MatchRow).
    MarginStepper.tsx          — sans "use client" (porte son propre
      useState local — permis, transitivement bundlé client).
    RevealPanel.tsx            — sans "use client" : compteur X/N toujours
      affiché, contenu seulement si isRevealed.
    InlineBetForm.tsx (+ .module.css) — NOUVEAU §2.15, REMPLACE
      BetShortcut.tsx (supprimé) : sans "use client" propre (rendu par
      PredictionForm, qui porte déjà la frontière cliente de l'écran) —
      formulaire complet de saisie/édition d'un pari MATCH ciblé
      automatiquement sur CE match (pas de sélecteur série/match), appelle
      saveDraftBet/submitBet/withdrawBet (lib/actions/bets.ts). Pré-rempli
      si MatchCard.myBet n'est pas null ; simple texte désactivé si un pari
      existe mais n'est plus éditable ici.
    ValidateAllBanner.tsx      — "use client" (3/3) : bandeau + confirmation
      « Tout valider », état local (pas remonté à la page serveur).
  bets/ — NOUVEAU §2.15, 2 fichiers :
    BetForm.tsx (+ .module.css) — SEULE feuille "use client" de l'écran
      Nouveau pari (§1.1 de la spec). Gère les 3 contextes (création libre,
      création via raccourci ?matchId=, édition à cible figée) et les 3
      gestes (saveDraftBet/submitBet/withdrawBet). Sélecteurs série/match en
      listes de boutons internes (SeriesPicker/MatchPicker, mêmes fichier,
      logos via TeamLogo) — pas de <select> natif pour eux (ne peut pas
      afficher d'image). Zone de saisie (énoncé/catégorie/difficulté/
      actions) en `position: fixed` (bandeau sticky, §2.15 suite 27/07),
      offset vérifié contre la hauteur RÉELLE de TabBar (mesurée, pas
      supposée).
  my-predictions/ — NOUVEAU §2.11, 9 fichiers + leurs .module.css :
    urls.ts                   — utilitaire pur (aucun JSX), construction des
      URL de vue (segment/filtre/pagination), partagé par plusieurs
      composants serveur.
    SegmentTabs.tsx            — serveur, liens Récent/Historique.
    FilterBar.tsx              — serveur, formulaire GET natif (date/série)
      + puce de filtre actif.
    SeriesBetHeader.tsx        — serveur, en-tête de pari SERIES (§11.2,
      uniquement en mode filtré sur une série).
    MatchRowStatic.tsx         — serveur, ligne de match (logos, prono,
      pari, requête de correction, panneau des autres).
    PredictionSummary.tsx      — serveur, rendu de MON prono (3 états +
      marquage de correction nominatif "à ta demande").
    RevealPanel.tsx            — serveur, <details> natif, TOUJOURS rendu
      avec son contenu (aucune confidentialité pré-verrouillage ici, §12) —
      marquage de correction nominatif complet ("à la demande de <pseudo>").
    AssociatedBetCard.tsx      — serveur, rappel de pari en lecture seule,
      tous statuts affichés (§11.3).
    CorrectionRequestForm.tsx  — serveur, <form action={...}> natif, seule
      écriture de l'écran ; erreur rendue au rechargement (portée par l'URL).
    LiveSubscriber.tsx         — "use client" (1/1, SEUL fichier client de
      l'écran) : exporte le Provider (souscription Realtime unique sur
      `matches`, Context React) ET un consommateur (LiveBadgeAndScore, lu
      depuis les lignes serveur).

public/
  logos/teams/ — 30 SVG (+ 30 PNG), déposés et committés depuis le
    21/07/2026, câblés depuis le 24/07/2026 (§2.9). `viewBox` des 30 SVG
    recalculé §2.13 (chaque fichier réservait un canevas plus grand que son
    dessin réel, logos décentrés dans leur pastille — corrigé par un script
    de bounding box, confirmé visuellement par l'utilisateur). brand/ :
    convention posée, hero-parquet.webp toujours pas déposé.

scripts/
  seed-playoffs-test-data.mjs — Script de seed, HORS migrations, usage :
    `node --env-file=.env.local scripts/seed-playoffs-test-data.mjs`. Non
    idempotent, pas de script de nettoyage écrit à ce jour.

Cadrage/
  V1/     — specs techniques V1 validées (T1→T7) + Spec visuelle/
            SPEC_ECRAN_ACCUEIL, SPEC_ECRAN_CLASSEMENT_BRACKET (close ; vue
            globale, §2.5 — distincte du remplissage §2.16),
            SPEC_ECRAN_MATCHS (close, §2.8 ; amendée §20 le 25/07/2026,
            §2.14 — entête replié sans logo), SPEC_ECRAN_MES_PRONOS (close,
            §2.11), SPEC_ECRAN_NOUVEAU_PARI (close §2.15, 26/07/2026 —
            livrée BROUILLON, close en séance en clarifiant ses 3 points
            §16 avant tout code), SPEC_ECRAN_BRACKET_PERSONNEL (close §2.16,
            27/07/2026 — AUCUNE spec n'existait, rédigée ET close en séance
            avec l'utilisateur, appuyée sur 0.2.2/0.2.9 §5 + le prototype).
            SPEC_TECHNIQUE_RLS_V0.1.md complétée §11 (correctif §2.7).
            SPEC_DESIGN_SYSTEM_V0_1.md amendée §16 le 25/07/2026 (§2.14 —
            tailles/provenance des logos). Aucune spec pour le hub Jouer
            définitif (§2.10) ni pour « Mes paris » (consultation/quotas) à
            ce jour — à écrire avant de les coder.
  Proto/  — fichiers de suivi (ce fichier, JOURNAL_SESSIONS.md,
            GAPS_OUVERTS.md) + cadrage fonctionnel hérité du prototype.
  OLD/    — cadrage antérieur, non consulté activement.

supabase/
  migrations/  — 10 migrations versionnées, voir §3.
  config.toml  — supabase link vers le projet Supabase NEUF de la V1.
```

## 5. Conventions de travail — l'essentiel (détail complet dans JOURNAL_SESSIONS.md)

```text
- Utilisateur DÉBUTANT (découvre Supabase/Next.js/VS Code/Git au fil du
  prototype) : chaque action expliquée (quoi/pourquoi/comment), une à la
  fois, confirmation avant de continuer. Commandes Git une par une — sauf
  accord explicite ponctuel pour que Claude committe lui-même (posé le
  23/07/2026, reconduit depuis, toujours rappelé comme un écart à la norme).
- Toute migration SQL passe par supabase/migrations/ (fichier versionné,
  nommage `<timestamp>_nom.sql`) + `npx supabase db push`, jamais par un
  copier-coller manuel dans l'éditeur SQL Supabase. Toujours montrer le
  contenu intégral de la migration et attendre une confirmation EXPLICITE
  avant `db push` — y compris pour une fonction SECURITY DEFINER minuscule,
  pas seulement pour un chantier RLS complet.
- Toute validation serveur doit recalculer ses propres garde-fous depuis la
  base, jamais supposer que l'affichage client correspond aux données
  officielles.
- Fichiers de suivi (dont celui-ci) : toujours régénérés en entier au moment
  où on les met à jour, jamais résumés/coupés silencieusement — y compris
  pour un lot « petit » (§2.9, §2.10) : la mise à jour de GAPS_OUVERTS.md
  seul, sans toucher à celui-ci ni au journal, a été un oubli réel lors du
  lot §2.9, corrigé seulement quand l'utilisateur a demandé de vérifier.
- Une note de suivi (« pas encore déposé », etc.) est un ÉTAT PASSÉ, pas une
  preuve présente : avant d'affirmer qu'un fichier n'existe pas, VÉRIFIER LE
  DISQUE (`ls`/`find`), pas seulement relire `ETAT_ACTUEL.md`. Erreur commise
  et corrigée le 24/07/2026 (§2.9, logos de franchise) — la doc peut devenir
  obsolète plus vite qu'on ne le pense.
- Claude ne committe jamais automatiquement (sauf accord explicite ponctuel)
  — l'utilisateur committe lui-même, une commande à la fois, rappelée en fin
  de session.
- Clés/secrets API : jamais collés en clair dans le chat. Un mot de passe de
  test posé sur un compte JETABLE (seed-*@nba-pronos.test) n'est pas un
  secret de production — nuance à garder.
- Avant d'écrire du code Next.js, vérifier node_modules/next/dist/docs/ pour
  les ruptures de convention propres à cette version.
- Aucun asset binaire n'est ajouté par Claude au dépôt.
- Écrans de lecture ET d'écriture : AUCUNE valeur visuelle en dur — tokens
  de app/tokens.css uniquement, via CSS Modules colocalisés. Composants
  serveur par défaut ; un "use client" doit être justifié explicitement — un
  fetch de données n'est jamais une justification.
- Noms de colonnes/valeurs de statut absents d'une spec produit : LIRE le
  schéma réel avant d'écrire la moindre requête, jamais deviner.
- En cas d'ambiguïté réelle (spec contradictoire, RLS qui ne couvre pas un
  cas d'usage qu'un TEST révèle, périmètre qui déborde d'un écran vers un
  fichier partagé) : s'ARRÊTER et demander plutôt que choisir en silence —
  même en plein codage.
- Un jeu de données de TEST révèle des défauts qu'une lecture de spec seule
  ne révèle pas : tester avec de vraies données, pas seulement
  `tsc`/`eslint`/`next build`, fait partie du travail.
- Un changement volontairement TEMPORAIRE (§2.9 bouton de déconnexion, §2.10
  hub Jouer) doit être marqué comme tel dans le CODE (commentaire), dans le
  RENDU (libellé visible « temporaire », style volontairement pas fini) ET
  dans le SUIVI (`GAPS_OUVERTS.md`) — les trois, pas seulement un des trois.
```

## 6. Config à faire au déploiement — PARTIELLEMENT FAITE (§2.17, 27/07/2026)

```text
- Vercel : FAIT (§2.17, 27/07/2026). Projet `lenoir-nba/nba-pronos` lié au
  dépôt GitHub, 4 variables d'env poussées (Production/Preview/Development),
  déployé en production → https://nba-pronos.vercel.app.
  **Correctif de région (27/07/2026, suite)** : latence perceptible après
  chaque clic remontée par l'utilisateur — diagnostiquée comme les fonctions
  Vercel tournant en `iad1` (Washington D.C., région par défaut de tout
  nouveau projet Vercel), alors que la base Supabase est en `eu-west-1`
  (Dublin) et l'utilisateur en France. `vercel.json` ajouté
  (`regions: ["dub1"]`, Dublin — même région que Supabase, recommandation
  officielle Vercel : « les fonctions doivent s'exécuter dans la même
  région que la base de données »), pas Paris malgré la localisation de
  l'utilisateur — une page fait souvent plusieurs allers-retours vers la
  base PAR requête (fonction↔base), contre un seul aller-retour
  navigateur↔fonction.
- Dashboard Supabase : désactiver « Confirm email » (accès immédiat au
  compte après inscription, C4 — rappel laissé dans la migration #2).
  DEVENU CONCRET le 24/07/2026 (§2.11) : le vrai flux /signup, testé pour la
  première fois de bout en bout, échoue avec « 429 — email rate limit
  exceeded » tant que ce réglage n'est pas désactivé (chaque inscription
  réelle tente d'envoyer un email de confirmation). Les comptes de seed y
  échappent (créés via l'API Admin, email_confirm:true, aucun email envoyé)
  — ce n'est donc apparu qu'en testant la vraie inscription publique.
  TENTÉ le 27/07/2026 (§2.17) : réglage décoché et sauvegardé (confirmé par
  capture d'écran), mais comportement PAS totalement élucidé — un test
  contrôlé et une vraie tentative ont quand même buté sur le même mur
  après coup. Toujours listé ici tant que non confirmé fiable — voir
  GAPS_OUVERTS.md pour le détail et la piste retenue (SMTP personnalisé,
  ex. Resend, nécessite un nom de domaine vérifié — non disponible à ce
  jour).
- Écrire la migration de seed du 1er admin RÉEL (A4), une fois le 1er
  pseudo réel connu — DISTINCT du compte Sofia_Admin du jeu de test (§2.6),
  qui n'est qu'un admin de test jetable. FAIT DE FAÇON AD HOC le 27/07/2026
  (§2.17) : compte Rillettes-31 promu ADMIN par UPDATE SQL direct, PAS par
  une migration ni un écran dédié (aucun n'existe encore) — cumule les deux
  rôles (joueur + admin) en attendant un vrai mécanisme.
- NOUVEAU (27/07/2026, §2.17) : compte de démo PARTAGÉ créé pour la
  démonstration aux amis de l'utilisateur (`Demo_Amis` /
  `demo-amis@nba-pronos.test`, rôle PLAYER, via API Admin) — à supprimer ou
  reconvertir quand le passage à un compte par ami sera fait (prévu
  explicitement après la fin de la V1), et à ne pas oublier lors du
  nettoyage du jeu de données de test (ne correspond PAS au motif
  `seed-*@nba-pronos.test` des 7 comptes de test originels, donc pas couvert
  par le même script de nettoyage sans ajustement).
- EFFACER le jeu de données de test (§2.6) avant tout lancement réel :
  compétition « Playoffs NBA (test) » + ses séries/matchs/pronos/paris (DELETE
  SQL, en respectant l'ordre des FK composites — séries du 1er tour avant les
  tours suivants), et les 7 comptes seed-*@nba-pronos.test via
  auth.admin.deleteUser (jamais un DELETE direct sur auth.users). Aucun
  script de nettoyage écrit à ce jour.
- Bouton de déconnexion temporaire : RETIRÉ (§2.18, 27/07/2026) — l'écran
  Profil porte désormais la vraie déconnexion.
- RETIRER le hub Jouer temporaire (§2.10, app/(app)/play/page.tsx +
  page.module.css) dès que le vrai hub Jouer (spec d'écran dédiée à écrire)
  existe.
- Activer la publication Realtime côté base sur `series` (T4 §9, resserré
  par T6c §14.2) — `matches` est FAIT (migration #8, §2.11) ; `series`
  reporté au lot Bracket personnel (drill-down/résumé live), chaque table
  publiée quand un écran en a réellement besoin.
- Configurer le planificateur externe gratuit (cron-job.org / GitHub
  Actions) pour appeler /api/sync/teams, /api/sync/schedule,
  /api/sync/results et /api/heartbeat aux fréquences actées par T4/T8.
- Déposer l'image réelle de public/brand/hero-parquet.webp (les logos
  d'équipe, eux, sont déjà déposés — §2.3/§2.9).
```

## 7. Pièges techniques déjà rencontrés (V1)

```text
- Un trigger BEFORE UPDATE en SECURITY DEFINER qui vérifie is_admin() via
  auth.uid() est bloquant en contexte SYSTÈME (auth.uid() NULL) — la garde
  doit explicitement laisser passer ce cas. Trouvé au test RLS T3 §7
  (migration #4).

- Next.js 16 renomme middleware.ts en proxy.ts (export nommé `proxy`).
  Toujours vérifier node_modules/next/dist/docs/ avant d'écrire un fichier
  dont le nom fait partie des conventions Next.js.

- cookies() de next/headers est asynchrone depuis Next.js 15/16 : toute
  fonction qui l'utilise doit être async. Idem pour `searchParams`.

- Route groups Next.js : deux fichiers page.tsx dans des groupes différents
  qui résolvent à la MÊME URL font planter le build (« Conflicting paths »).

- Compte à rebours hydraté (Countdown.tsx, session du 21/07/2026, reconduit
  sur MatchRow §2.8) : ne JAMAIS lire l'horloge pendant le rendu (état
  `null` jusqu'au montage, vraie valeur via useEffect) — sinon décalage
  d'hydratation serveur/client.

- ESLint `react-hooks/set-state-in-effect` (trouvé en écrivant MatchRow,
  session du 23/07/2026) : un appel `setState(...)` DIRECTEMENT dans le
  corps d'un `useEffect` (même dans un simple `if`) est une ERREUR de lint,
  y compris pour le patron « lire l'horloge seulement après montage » déjà
  utilisé par Countdown.tsx. Countdown.tsx y échappait car son setState vit
  dans une fonction NOMMÉE (`tick`) appelée depuis l'effet, pas au premier
  niveau du corps de l'effet — la règle ne remonte pas dans les fonctions
  imbriquées. Solution reconduite partout : envelopper tout setState d'effet
  dans une petite fonction nommée, même pour un calcul qui ne s'exécute
  qu'une fois.

- RLS qui bloque une écriture ne renvoie PAS toujours une erreur PostgREST
  (trouvé en testant les mécaniques d'écriture de l'écran Matchs, session du
  23/07/2026) : un `UPDATE` dont la clause `USING` de la policy ne matche
  AUCUNE ligne (ex. tentative de modifier un prono déjà `VALIDATED`, policy
  `mp_update_self` qui exige `status='DRAFT'`) réussit silencieusement avec
  ZÉRO ligne affectée — `error` reste `null`. Un test qui ne vérifie que
  `error` peut donc croire à tort qu'une écriture interdite est passée.
  Toujours vérifier le nombre de lignes réellement affectées (`.select()` +
  compter, ou `count: 'exact'`), jamais seulement l'absence d'erreur.

- Agrégat RLS confidentiel par construction (Classement §2.7, compteur X/N
  de l'écran Matchs §2.8) : une vue/fonction en `security_invoker` (ou un
  simple `count()` en session joueur) hérite silencieusement de la RLS des
  tables sources, MÊME quand l'intention produit est un chiffre PUBLIC
  (rang, total, "X ont pronostiqué"). Symptôme : correct pour un admin (qui
  contourne la RLS), sous-compté pour un joueur normal — invisible sans un
  VRAI jeu de données multi-joueurs, indétectable en lisant juste le code ou
  la spec. Solution reconduite deux fois : une fonction/vue SECURITY
  DEFINER dédiée qui n'expose QUE l'agrégat (jamais les lignes sources) —
  jamais désactiver la RLS des tables elles-mêmes.

- Next.js 16 documente officiellement le blocage de navigation interne via
  la prop `onNavigate` de `<Link>` + un contexte React partagé (pas un hack
  ad hoc) — utilisé pour la garde C2 (§2.8). Piège trouvé en le câblant : un
  composant partagé par PLUSIEURS points de montage (TabBar, rendu à la fois
  sous app/(app)/layout.tsx ET sous ScreenShell) peut se retrouver SANS le
  contexte selon la route — le hook consommateur doit se dégrader en no-op,
  jamais lever, sous peine de casser les écrans qui n'ont pas ce contexte.

- `next/image` refuse d'optimiser un SVG par défaut (trouvé en câblant les
  logos, session du 24/07/2026) : nécessiterait `dangerouslyAllowSVG` +
  `contentSecurityPolicy` dans next.config (config partagée, surface de
  sécurité en plus). Contourné avec la prop `unoptimized` (documentée par
  Next.js pour ce cas précis, `<Image src="....svg" unoptimized />`) — zéro
  changement de config, l'image est juste servie telle quelle.

- Tester une Server Action réellement, sans navigateur ni JS (trouvé en
  vérifiant le bouton de déconnexion temporaire, session du 24/07/2026) :
  un `<form action={monAction}>` sans amélioration progressive JS poste en
  RÉEL vers l'URL courante (`action=""`), `method="POST"`,
  `encType="multipart/form-data"`, et porte un `<input type="hidden"
  name="$ACTION_ID_...">` dont la VALEUR est vide — c'est le NOM du champ
  qui identifie l'action à exécuter. Technique reproductible avec curl :
  récupérer le HTML rendu authentifié, extraire ce nom de champ exact, puis
  `curl -F "$ACTION_ID_...=" URL` avec les cookies de session. Confirme que
  la déconnexion fonctionne réellement (cookie effacé, 303 vers /login) sans
  jamais ouvrir de navigateur.

- Déduction de schéma — deadline du bracket absente : `competitions.
  bracket_deadline` est nullable. Tant que NULL, l'item bracket de l'Accueil
  n'apparaît pas. Décision d'implémentation, pas une spec (item ouvert dans
  GAPS_OUVERTS.md).

- Ambiguïté de spec résolue avec l'utilisateur (AskUserQuestion, 21/07/2026) :
  SPEC_ECRAN_ACCUEIL §6 nomme `bets.resolved_at` pour l'item « Pari statué »
  mais illustre par « validé/ajusté » (workflow de VALIDATION, colonne
  différente). Tranché : lecture littérale de la colonne citée → paris
  ANNULÉS (CANCELLED), libellé « Neutralisé ».

- Rotation d'écran ET routage client (TreeView.tsx, 22/07/2026) : agir
  seulement sur l'ÉVÉNEMENT de changement d'orientation, jamais sur l'état
  constaté au montage ; une `ref` (pas un `useState`) pour éviter une
  fermeture périmée dans le listener.

- Colonne absente pour une règle de spec (raccourci pari, écran Matchs,
  §2.8) : `bets` n'a aucune colonne `rejected_at` — la règle « REJECTED
  avant/après sa deadline » (0.2.4 §6) n'est donc pas calculable telle
  quelle. Signalé et tranché AVEC l'utilisateur (toujours considéré
  « libéré », cas normal compte tenu de sealDeadlines) plutôt que de deviner
  une colonne de repli (`updated_at`) ou d'élargir le schéma pour un lot pas
  encore codé (Paris).

- Composant client SANS sa propre directive (`TeamLogo.tsx`, trouvé en
  codant Mes pronos, §2.11) : un composant qui utilise un hook (`useState`)
  mais n'a pas sa PROPRE `"use client"` ne fonctionne que « transitivement
  bundlé » — c'est-à-dire uniquement si TOUS ses points d'appel sont déjà
  atteints via un ancêtre `"use client"` (ce qui était vrai par coïncidence
  pour `NodeCard`/`MatchRow`, jamais vérifié explicitement). Dès qu'un
  composant SERVEUR sans ancêtre client veut le rendre directement (`Match
  RowStatic` sur Mes pronos), il faut lui donner sa propre directive —
  sans changement de rendu pour les appelants existants, qui étaient déjà
  dans ce cas en pratique.

- Un canal Realtime unique pour toute une liste rendue par des composants
  SERVEUR (`LiveSubscriber.tsx`, Mes pronos, §2.11) : un seul composant
  client peut porter la souscription ET rester la seule frontière
  `"use client"` de l'écran, à condition d'exporter DEUX éléments du MÊME
  fichier — un Provider (Context React, souscription unique) qui ENVELOPPE
  la liste des lignes serveur (passées en `children`, patron RSC officiel :
  un Server Component peut être passé en enfant d'un Client Component sans
  jamais s'exécuter côté client), et un petit consommateur (`useContext`)
  que CES lignes serveur peuvent instancier directement à l'endroit précis
  où le badge/score doit se mettre à jour.

- Tester un formulaire natif `useActionState` (login/signup) SANS JS, VS un
  simple `<form action={fn}>` sans état lié (logout, requête de correction) :
  React 19/Next 16 encodent les deux cas DIFFÉREMMENT en repli
  progressive-enhancement. Le 2e cas porte un unique champ caché `<input
  name="$ACTION_ID_...">` (technique déjà connue, §7 plus haut, logout). Le
  1er cas (état précédent lié en argument via `useActionState`) porte 4
  champs cachés distincts — `$ACTION_REF_N` (vide), `$ACTION_N:0` (JSON
  `{id, bound}`), `$ACTION_N:1` (JSON du/des argument(s) lié(s)),
  `$ACTION_KEY` — les 4 doivent être renvoyés tels quels dans le POST
  multipart pour que l'action s'exécute. Trouvé et vérifié en rejouant un
  vrai login sans navigateur (§2.11), même esprit que la technique déjà
  utilisée pour la déconnexion.

- Rate limit d'email Supabase sur l'inscription réelle (`/signup`, trouvé en
  testant Mes pronos en conditions réelles, §2.11) : tant que « Confirm
  email » n'est pas désactivé côté dashboard (§6, point déjà connu mais
  jamais concrètement rencontré), CHAQUE appel réel à `supabase.auth.signUp()`
  tente d'envoyer un email de confirmation — le mailer par défaut sature vite
  (`429, over_email_send_rate_limit`). Invisible tant que les comptes de test
  sont créés via l'API Admin (`email_confirm:true`, aucun envoi) : ce n'est
  apparu qu'en testant pour la première fois le vrai formulaire public.
  SUITE le 27/07/2026 (§2.17) : même en décochant « Confirm email » (vérifié
  décoché ET sauvegardé), un test contrôlé et une vraie tentative ont quand
  même re-buté sur le même mur peu après. PAS élucidé : soit le quota
  minuscule du mailer par défaut (souvent ~2 emails/heure, partagé entre
  TOUS les types d'email, pas seulement la confirmation) était encore
  épuisé par un envoi précédent, soit Supabase tente un email de courtoisie
  indépendamment du caractère obligatoire ou non de la confirmation. Seule
  solution de contournement fiable trouvée : créer les comptes via l'API
  Admin (`email_confirm:true`), qui ne déclenche structurellement aucun
  envoi — pas une vraie résolution du mystère, un contournement.

- Route racine jamais câblée (`app/page.tsx`, trouvé au premier déploiement
  Vercel réel, §2.17, 27/07/2026) : le fichier était resté le scaffold
  `create-next-app` par défaut depuis la création du projet (18/07/2026) —
  jamais retouché, jamais remarqué en dev/test car TOUS les tests précédents
  visitaient des routes précises (`/login`, `/home`, etc.), jamais la racine
  nue (`/`). Un site tout juste déployé mérite un tour rapide de sa racine
  avant de le considérer vérifié, pas seulement des routes déjà connues.
  Corrigé par un simple `redirect("/login")`, qui délègue à `proxy.ts`
  (déjà testé) le renvoi vers `/home` si une session est active.

- Logo décentré dans sa pastille malgré un CSS correct (trouvé en testant Mes
  pronos, §2.13) : `object-fit: contain` centre fidèlement la boîte du
  `viewBox` déclaré — mais si ce `viewBox` réserve un canevas plus grand que
  le dessin réel (marge non désirée laissée par l'export du fichier), le
  logo VISIBLE se retrouve décalé même si le CSS, lui, est irréprochable. Pas
  détectable en lisant le composant : il faut ouvrir le SVG et regarder où se
  trouvent réellement les tracés par rapport au `viewBox` déclaré. Corrigé en
  recalculant la boîte englobante réelle de chaque fichier (tokenizer de
  commandes de tracé SVG écrit à la main — M/L/H/V/C/S/Q/Z, échantillonnage
  des courbes de Bézier — aucune dépendance, aucun navigateur nécessaire) et
  en réécrivant le `viewBox` en conséquence. Diagnostic AVANT correctif :
  toujours vérifier l'hypothèse (ouvrir le fichier réel) avant de proposer un
  correctif CSS qui n'aurait rien changé.

- Constante partagée serveur+client qui casse le build (`lib/queries/bets.ts`
  → `components/bets/BetForm.tsx`, écran Nouveau pari, §2.15) : un module qui
  importe `getServerClient()` (donc `next/headers`) ne peut pas être importé
  au RUNTIME (valeurs, pas seulement des types) par un composant `"use
  client"` — Next.js refuse le build (« next/headers dans un composant
  client »), même si le composant client n'utilise en pratique que 2-3
  constantes du fichier. Solution reconduite : extraire les constantes SANS
  dépendance serveur dans un module neutre (`lib/labels/bets.ts`, même rôle
  que `lib/labels/rounds.ts`), consommé par la lecture serveur ET le
  composant client. Les imports `import type {...}` restent sûrs dans les
  deux sens (effacés à la compilation), seuls les imports de VALEURS posent
  problème.

- Garde de quota SANS backstop d'index unique, dans une fonction SECURITY
  DEFINER (`save_bet`, migration #10, §2.15) : un simple `SELECT count(*)`
  suivi d'un `INSERT`, même regroupés dans une seule fonction/transaction,
  ne ferme PAS une course entre deux appels CONCURRENTS (deux transactions
  peuvent chacune lire le même count avant que l'une des deux ne committe).
  Contrairement aux quotas « 1 pari actif » (protégés par un vrai index
  unique partiel, backstop atomique quel que soit le code applicatif), le
  cap « 3 paris MATCH/série » n'a aucun équivalent en base (T1 le note
  explicitement) — sans mesure supplémentaire, le choix même d'une fonction
  SECURITY DEFINER n'aurait fermé cette course qu'en apparence. Fermé par un
  `pg_advisory_xact_lock` (clé = user × série, portée à la transaction)
  AVANT le comptage, qui sérialise les créations concurrentes visant la même
  série pour le même joueur.

- Bandeau `position: fixed` : l'offset ne se COPIE pas d'un autre composant
  sans vérifier (trouvé en réutilisant le calcul de `StickyMeBar`, §2.15
  suite 27/07/2026) — la hauteur réelle rendue de `TabBar` (padding + bordure
  inclus) ne correspondait pas à ce que l'autre composant supposait,
  provoquant un chevauchement de quelques pixels invisible à l'œil nu sur une
  capture d'écran ordinaire. Mesuré via `getBoundingClientRect()` des deux
  éléments en conditions réelles (pas une capture d'écran) pour trouver la
  vraie valeur. Piège annexe : une capture d'écran PLEINE PAGE (`fullPage`)
  fausse le rendu d'un élément `position: fixed` — l'outil de capture
  redimensionne temporairement le viewport à la hauteur totale du document,
  et l'élément fixe s'ancre alors à CE viewport élargi, pas à la fenêtre
  réelle. Toujours vérifier un `position: fixed`/`sticky` avec une capture
  VIEWPORT (non pleine page) avant/après un scroll réel, ou par mesure directe.

- `<select>` natif ne peut pas afficher de logo (écran Nouveau pari, §2.15) :
  la spec demandait des logos de franchise sur les sélecteurs série/match
  (T7 §15.8-style) — un `<option>` HTML ne rend que du texte. Les
  sélecteurs concernés (`SeriesPicker`/`MatchPicker`, `components/bets/
  BetForm.tsx`) sont donc des listes de boutons (`role="radio"`), pas des
  `<select>` — réservés aux listes fermées SANS logo (catégorie, difficulté).

- Serveur de dev déjà lancé (trouvé en testant l'écran Nouveau pari en
  navigateur, §2.15 suite 27/07/2026) : `npm run dev` a échoué silencieusement
  en détectant un verrou d'instance existant pour le même dossier (Next.js 16
  refuse deux serveurs dev concurrents sur un même projet) — un port
  totalement différent (3000) répondait par ailleurs pour un projet SANS
  RAPPORT, source de confusion transitoire. Toujours vérifier QUEL processus
  sert réellement le contenu attendu (`curl` + inspection du HTML rendu, pas
  seulement un code 200) avant de tuer/relancer quoi que ce soit ; réutiliser
  un serveur déjà actif plutôt que d'en imposer un second.

- Cascade dérivée du résultat OFFICIEL au lieu du pick du joueur (leçon du
  PROTOTYPE, réappliquée en écrivant l'écran Bracket personnel, §2.16) :
  pour un tour 2+ d'un bracket, les équipes "candidates" doivent être
  dérivées UNIQUEMENT du pronostic du joueur sur les séries qui alimentent
  la série courante — jamais du résultat officiel de ces séries, même si ce
  résultat est déjà connu en base au moment du calcul. Une 1ère version (hors
  V1, dans le prototype) faisait l'inverse et ne remplissait donc JAMAIS
  correctement les tours 2+. Techniquement, le cas "résultat officiel connu
  alors que le bracket est encore modifiable" ne peut de toute façon jamais
  survenir (le bracket se verrouille au 1er match, avant tout résultat de
  tour 2+) — mais le CODE ne doit pas dépendre de cette impossibilité pour
  être correct : `computeCandidateTeamIds` (lib/queries/bracket-fill.ts) ne
  lit même pas les colonnes de résultat officiel, structurellement incapable
  de reproduire le bug. Corollaire retenu du même endroit : la validation
  serveur d'un pick soumis (lib/actions/bracket-fill.ts) doit recalculer les
  candidats avec la MÊME fonction que la lecture, jamais les revérifier
  contre `series.team1_id/team2_id` (toujours NULL pour les tours 2+ avant
  le vrai résultat) — sinon toute écriture sur ces tours échoue à coup sûr.

- Ne pas supposer qu'une migration/fonction SECURITY DEFINER est nécessaire
  sans vérifier la RLS existante d'abord (comparaison entre les lots §2.15 et
  §2.16) : « Nouveau pari » a eu besoin d'une migration (trigger) + de deux
  fonctions SECURITY DEFINER (quota non exprimable en index) ; « Bracket
  personnel », lu au pré-vol AVANT de coder, n'en a eu besoin d'AUCUNE — la
  RLS `brackets_insert/update`/`bracket_picks_insert/update` (migration #3)
  couvrait déjà tout le nécessaire (propriétaire, actif, deadline). Deux
  lots voisins, deux besoins différents : le pré-vol (lire les policies
  RÉELLES avant d'écrire une seule ligne de garde applicative) est ce qui
  a évité soit une migration inutile, soit — pire — une garde dupliquée qui
  aurait pu diverger de la RLS.

- Nom de colonne supposé par analogie, jamais vérifié (migration #11, §2.19,
  27/07/2026) : `matches` porte une colonne `status`, mais `series` porte
  `official_status` — deux tables voisines, deux noms différents pour un
  concept similaire. Une fonction SQL écrite par analogie (« matches.status
  existe, donc series.status doit exister aussi ») a fait planter TOUTE
  requête de correction sur un pari SÉRIE (« column series.status does not
  exist »), trouvé seulement en appelant la fonction en conditions réelles,
  jamais en relisant le code. Corrigé par la migration #12 (même patron que
  #4). Leçon reconduite : même quand une colonne « doit sûrement exister »
  par cohérence avec une table voisine, vérifier le VRAI schéma (fichier de
  migration réel) avant de l'utiliser dans du SQL — l'analogie n'est pas une
  preuve.

- Rejouer le formulaire de login (`useActionState`, sans JS) échoue parfois
  avec « Failed to find Server Action » même en réextrayant les 4 champs
  `$ACTION_*` juste avant de poster (trouvé en testant le tableau de bord
  admin, §2.20, 27/07/2026) — cause non élucidée avec certitude (dev server
  très sollicité par de nombreuses recompilations pendant la session,
  suspecté mais pas prouvé). Contournement plus ROBUSTE pour tester une
  garde d'accès sans dépendre du flux de login lui-même (déjà éprouvé par
  ailleurs) : produire directement un cookie de session compatible via
  `@supabase/ssr` — `createServerClient()` avec un cookie store maison +
  `signInWithPassword()`, MÊME librairie que `lib/supabase/server.ts`/
  `proxy.ts`, donc byte-compatible avec ce que le vrai serveur attend, sans
  reproduire à la main l'encodage React 19 des server actions. À préférer
  à la technique `$ACTION_*` quand ce n'est PAS le formulaire de login
  lui-même qui est testé.

Pièges génériques du prototype (Postgres/Git/PowerShell, toujours valables en
principe) non recopiés ici pour éviter la duplication — voir l'historique du
dépôt `nba-pronos-proto` s'ils resurgissent en V1.
```

### 2.20 Tableau de bord admin (session du 27/07/2026, premier écran du lot Admin)

```text
Périmètre : SPEC_ECRAN_ADMIN_DASHBOARD_V0_1.md (Cadrage/V1/Spec visuelle/,
nouveau fichier, close en séance) — STRICTEMENT app/(admin)/admin/{layout,
page}.tsx (garde de rôle + compteurs), PAS les 5 pages filles (lots
séparés). Premier écran de la zone (admin), distincte de (app) — pas un 5e
onglet, atteint depuis Profil (lien câblé, remplace l'entrée inerte posée
le même jour lors du lot Profil, §2.18).

Contrairement à Bracket personnel (§2.16, aucune décision n'existait), la
zone admin était déjà entièrement architecturée par T6a/T6b (validées le
19/07/2026, jamais relues depuis) : arbre app/(admin)/admin/* complet,
garde is_admin() côté layout, signatures des actions admin. Ce lot n'a donc
fait qu'ASSEMBLER l'existant (0.2.7 + 0.2.9 §8 + T6a/T6b) au format écran.

Découpage du lot Admin décidé AVEC l'utilisateur (AskUserQuestion) :
tableau de bord d'abord, une page fille à la fois ensuite — pas tout
spécifié d'un coup, pas une file précise en premier.

2 points fermés avec l'utilisateur avant rédaction (AskUserQuestion) : sans
compétition active, Gestion des joueurs et Historique des logs restent
ACCESSIBLES (seuls les 3 compteurs de file retombent à 0) ; bouton
Recalculer sans compétition active — DÉSACTIVÉ mais VISIBLE, jamais masqué.

**Vérification de dépôt AVANT code, 2 réalités trouvées et signalées avant
d'écrire quoi que ce soit** (AskUserQuestion, pas devinées) :
- `recomputeCompetition` (T5 §10.1) N'EXISTE NULLE PART (ni migration, ni
  lib/) — le moteur de scoring T5 est spécifié mais jamais codé. Bouton
  Recalculer OMIS de ce lot (design conservé dans la spec §4, à coder avec
  T5) plutôt que de construire un bout du moteur de scoring en douce.
- Aucune des 5 pages filles n'existe : les 3 cartes de file + les 2
  entrées (joueurs/logs) sont INERTES (pas de <Link>, libellé « à venir »),
  même patron que le hub Jouer temporaire (§2.10) — retirées une à une au
  fur et à mesure que chaque page fille est codée.

Fichiers : app/(admin)/admin/layout.tsx (+ .module.css, garde is_admin(),
redirect /home si non-admin — défense en profondeur, le proxy ne garde que
la SESSION, pas le RÔLE, T6a §4.2) ; app/(admin)/admin/page.tsx (+
.module.css, 100% composant serveur, AUCUN "use client" dans ce lot) ;
lib/queries/admin-dashboard.ts (getAdminDashboardData — 3 compteurs :
validation = bets SUBMITTED ; résolution = bets VALIDATED dont l'échéance
est passée, bet_deadline_open() reproduit en TypeScript, même patron que
lib/queries/{bets,home}.ts, pas une 3e implémentation divergente ;
requêtes = correction_requests PENDING, TOUTES compétitions confondues —
pas de délai limite en V1, 0.2.7 §6). AUCUNE migration.

Vérifié : npx tsc --noEmit, npx eslint ., npx next build tous propres
(un premier tsc a achoppé sur des types de routes Next.js pas encore
régénérés — résolu après un next build). Aucun conflit de route.

Test en conditions réelles — TECHNIQUE NOUVELLE cette session (voir §7) :
la technique habituelle (rejouer le POST useActionState de /login sans JS)
a échoué de façon répétée (« Failed to find Server Action ») malgré une
extraction correcte des champs $ACTION_*, cause non élucidée avec
certitude. Contournée en produisant un cookie de session directement via
@supabase/ssr (createServerClient + signInWithPassword, MÊME librairie que
lib/supabase/server.ts/proxy.ts) plutôt que de rejouer le formulaire —
teste directement la garde is_admin(), sans dépendre du flux de login
(déjà éprouvé par ailleurs). Résultats : Amine92 (PLAYER) sur /admin →
307 /home (garde refuse bien) ; Sofia_Admin (ADMIN) → 200, « Administration »
rendu, compteurs 0/0/1 — le 1 correspond EXACTEMENT à la requête de
correction PENDING laissée en base depuis la session Mes pronos (§2.11),
confirmation forte que le compteur est juste ; bandeau « Aucune compétition
en cours » absent à raison (compétition ACTIVE présente). Mots de passe
temporaires posés via l'API Admin sur Sofia_Admin/Amine92 (jamais affichés
dans le chat), re-randomisés en fin de vérification. Scripts jetables de
test créés puis supprimés, non committés.

PAS committé ni déployé à ce stade (à confirmer avec l'utilisateur).
```

### 2.21 File de validation des paris (session du 27/07/2026, suite)

```text
Périmètre : SPEC_ECRAN_ADMIN_VALIDATION_V0_1.md (Cadrage/V1/Spec visuelle/,
nouveau fichier, close en séance) — app/(admin)/admin/validation/page.tsx.
Deuxième écran du lot Admin, choisi en premier parmi les 5 pages filles :
SEULE avec « Gestion des joueurs » à ne PAS dépendre du moteur de scoring
T5 manquant (validateBet/rejectBet sont catégorie B SANS recompute, T6a
§5.3 — contrairement à resolveBet, qui appelle recomputeBet).

Trouvaille au pré-vol (pas dans la prose 0.2.9, mais dans le schéma ET la
signature T6b) : validateBet exige AUSSI une catégorie validée, pas
seulement la difficulté — sélecteur de catégorie ajouté à la carte en plus
de la réglette, cohérent avec l'interprétation déjà actée en Mes pronos
(§2.11 : « catégorie suit la même règle que la difficulté »).

Fichiers : lib/queries/admin-validation.ts (getPendingValidationBets — TOUS
les joueurs de la compétition active, pas seulement auth.uid(), même
construction de libellés que lib/queries/my-bets.ts) ; lib/actions/
admin-validation.ts (validateBet/rejectBet + variantes FormData, session
admin via getServerClient, RLS bets_update_admin — AUCUNE fonction SQL
SECURITY DEFINER, AUCUNE migration) ; lib/actions/audit.ts (NOUVEAU,
PARTAGÉ — logAdminAction, écrit audit_logs, réutilisable par les 4 lots
admin restants) ; components/admin/ValidationBetCard.tsx (+ .module.css,
100% composant serveur — 2 formulaires natifs indépendants par carte,
Valider/Refuser, <select> natifs pour catégorie/difficulté, aucun JS
requis). Carte « à valider » du tableau de bord rendue <Link> actif vers
/admin/validation (les 2 autres cartes + les 2 entrées restent inertes).

Garde-fou repris (piège déjà rencontré, §7) : validateBet/rejectBet
re-vérifient le statut SUBMITTED dans le WHERE de l'UPDATE (pas seulement
en lecture avant), puis .select().maybeSingle() pour détecter 0 ligne
affectée (pari déjà traité par un autre admin) — jamais seulement l'absence
d'erreur.

logAdminAction (lib/actions/audit.ts) : appelée APRÈS la transition,
best-effort (pas de transaction cross-appel PostgREST possible ici,
catégorie SANS recompute donc pas de fonction SQL unique) — un échec de log
ne fait PAS échouer l'action déjà posée, juste signalé en console serveur.

Vérifié : npx tsc --noEmit, npx eslint ., npx next build tous propres,
aucun conflit de route (/admin/validation listé).

Test en conditions réelles (même technique @supabase/ssr que §2.20) : 2
paris de test SUBMITTED créés via service_role (un à valider, un à
refuser) ; carte rendue avec le bon contexte (joueur, cible, énoncé,
catégorie/difficulté proposées) ; formulaire Valider soumis réellement
(POST sans JS, technique $ACTION_ID_ déjà connue) → bets.status=VALIDATED,
validated_category/validated_difficulty/validated_by_admin_id posés
correctement, ligne audit_logs "VALIDATE_BET" créée ; formulaire Refuser
soumis → status=REJECTED, refusal_reason posé, ligne audit_logs
"REJECT_BET" créée. Piège rencontré en testant (pas un bug du code, un bug
du script de test) : les 2 formulaires d'une même carte partagent le même
hidden betId — un script de test qui n'extrait l'ACTION_ID qu'en cherchant
ce betId récupère le MAUVAIS formulaire ; corrigé en désambiguïsant par un
2e champ propre à chaque formulaire (validatedCategory vs refusalReason).
2 paris de test + leurs lignes audit_logs supprimés après vérification,
mot de passe temporaire re-randomisé.

PAS committé ni déployé à ce stade (à confirmer avec l'utilisateur).
```

### 2.22 Gestion des joueurs (session du 27/07/2026, suite)

```text
Périmètre : SPEC_ECRAN_ADMIN_PLAYERS_V0_1.md (Cadrage/V1/Spec visuelle/,
nouveau fichier, close en séance) — app/(admin)/admin/players/page.tsx.
Troisième écran du lot Admin, choisi (comme la validation) car
setPlayerRole/setPlayerStatus sont catégorie B SANS recompute (T6a §5.3) —
aucune dépendance sur le moteur de scoring T5 manquant.

Bonne surprise au pré-vol : les garde-fous fins (pas d'auto-rétrogradation,
dernier admin actif non rétrogradable/désactivable) étaient DÉJÀ posés en
base par un trigger (`enforce_users_invariants`, migration #3 corrigée #4)
— la couche d'écriture de ce lot est une simple UPDATE directe sur `users`
via la RLS `users_update_admin`, AUCUNE fonction SQL, AUCUNE migration. Les
messages d'erreur du trigger, déjà rédigés pour un lecteur humain (ex.
« Un admin ne peut pas se retrograder lui-meme »), sont remontés tels
quels, même patron que `requestBetCorrection`.

Fichiers : lib/queries/admin-players.ts (getPlayers — tous les joueurs,
ADMIN d'abord puis PLAYER alphabétique, calcule isSelf/isLastActiveAdmin en
lecture pour griser les actions AVANT le clic) ; lib/actions/
admin-players.ts (setPlayerRole/setPlayerStatus + variantes FormData,
journalisées via lib/actions/audit.ts déjà partagé) ; components/admin/
PlayerRow.tsx (+ .module.css, 2 formulaires natifs indépendants par ligne,
boutons `disabled` natifs HTML — fonctionnent sans JS). Carte « Gestion des
joueurs » du tableau de bord rendue `<Link>` actif.

Décision d'implémentation actée dans la spec (§2, pas une invention) :
l'auto-désactivation (rester ADMIN mais se désactiver soi-même, PAS une
rétrogradation) n'est PAS bloquée par le trigger sauf si c'est le dernier
admin actif — reflété tel quel dans l'UI plutôt que d'inventer une garde
supplémentaire que ni 0.2.7 ni le trigger n'exigent.

Vérifié : npx tsc --noEmit, npx eslint ., npx next build tous propres,
aucun conflit de route (/admin/players listé).

Test en conditions réelles (même technique @supabase/ssr) : ligne de
Sofia_Admin (soi-même) confirmée avec boutons `disabled` dans le HTML rendu ;
promotion de Tariq_M en ADMIN puis rétrogradation en PLAYER — les deux
soumises réellement (POST sans JS) et vérifiées, aller-retour sans effet
résiduel (état final identique à l'état initial) ; **cas négatif réel** :
tentative de forcer l'auto-rétrogradation de Sofia_Admin en construisant le
POST directement (contournant le bouton désactivé côté UI, qui n'est qu'un
confort, pas la vraie frontière de sécurité) — bloquée CÔTÉ SERVEUR par le
trigger, message d'erreur exact remonté par l'URL de redirection. Confirme
que la garde réelle est bien en base, pas seulement cosmétique dans l'UI.
2 lignes audit_logs de test (promotion/rétrogradation de Tariq_M)
supprimées après vérification, mot de passe temporaire re-randomisé.

PAS committé ni déployé à ce stade (à confirmer avec l'utilisateur).
```

### 2.23 Historique des logs (session du 27/07/2026, suite — DERNIÈRE page sans dépendance T5)

```text
Périmètre : SPEC_ECRAN_ADMIN_LOGS_V0_1.md (Cadrage/V1/Spec visuelle/,
nouveau fichier, close en séance) — app/(admin)/admin/logs/page.tsx.
Quatrième écran du lot Admin, écran de LECTURE PURE (0.2.7 §8) — aucune
dépendance sur T5, ferme la liste des pages filles « faciles ».

Trouvaille au pré-vol : le détail des filtres/tri (0.2.9 §11 le listait
comme « à préciser ») était en réalité DÉJÀ tranché — retrouvé dans
`nba_pronos_PREP_SPEC_TECHNIQUE_V1.md` §B5 (validé le 17/07/2026, jamais
réouvert dans GAPS_OUVERTS.md depuis) : tri = plus récent d'abord, filtres
= type d'action, admin, date. Trouvé en CHERCHANT la source avant d'inventer
un design de filtres.

Fichiers : lib/labels/audit.ts (NOUVEAU — vocabulaire fermé des actions
journalisées, à étendre par chaque futur lot admin, même rôle que
lib/labels/bets.ts) ; lib/queries/admin-logs.ts (getAuditLogs +
getAuditLogFilterOptions — options de filtre DÉRIVÉES des valeurs
RÉELLEMENT présentes en base, pas une liste figée) ; components/admin/
AuditLogRow.tsx (+ .module.css, consultation pure, aucun formulaire) ;
app/(admin)/admin/logs/page.tsx (filtres en `<form method="get">` natif,
querystring, aucun "use client"). Carte « Historique des logs » du tableau
de bord rendue `<Link>` actif.

Refactor mineur SANS changement de comportement, en cours de route :
`parisDayBoundsUtc` (calcul de bornes UTC d'un jour calendaire Europe/Paris,
écrit pour Mes pronos §2.11) déménagée de lib/queries/my-predictions.ts vers
un nouveau module neutre lib/dates/paris.ts (aucune dépendance next/headers)
— 2e utilisateur (le filtre date des logs), pour éviter une 3e
implémentation divergente de la même fonction (piège déjà noté pour
bet_deadline_open, §7). Mes pronos re-vérifié après coup (tsc/eslint/build +
next build listant toujours /play/my-predictions sans erreur) — aucun
changement de comportement, juste un déplacement de fonction pure.

Vérifié : npx tsc --noEmit, npx eslint ., npx next build tous propres,
aucun conflit de route (/admin/logs listé).

Test en conditions réelles (même technique @supabase/ssr) : 2 vraies
entrées de log générées via Gestion des joueurs (promotion/rétrogradation
réelle de Tariq_M, déjà le cas de test du lot précédent) ; écran /admin/logs
sans filtre : acteur (Sofia_Admin), libellé d'action (« Rôle modifié »),
cible (Tariq_M, pseudo résolu) tous corrects ; filtre par action
(SET_PLAYER_ROLE) : n'affiche QUE les bonnes entrées ; filtre par admin :
correct ; filtre par date (aujourd'hui vs une date sans log) : les deux
comportements corrects, y compris l'état vide filtré (« Aucun résultat pour
ces filtres. ») ; contenu avant/après (before_value/after_value JSON)
vérifié directement en base, cohérent avec ce que le rendu affiche. 2 lignes
de test supprimées après vérification, mot de passe temporaire
re-randomisé.

COMMITTÉ et POUSSÉ sur `main`.
```

### Correctif région Vercel (session du 27/07/2026, entre §2.23 et le chantier T5)

```text
Latence après chaque clic remontée par l'utilisateur. Diagnostiquée :
fonctions Vercel en iad1 (Washington D.C., région par défaut de tout
nouveau projet Vercel), base Supabase en eu-west-1 (Dublin). `vercel.json`
ajouté (`regions: ["dub1"]`, Dublin — même région que Supabase, pas Paris
malgré la localisation de l'utilisateur : une page fait souvent plusieurs
allers-retours fonction↔base PAR requête, contre un seul aller-retour
navigateur↔fonction — recommandation officielle Vercel confirmée par
recherche web avant d'agir). Committé, poussé, redéployé et vérifié
(`vercel inspect` confirme `[dub1]` sur toutes les fonctions).
```

### Chantier T5 — Moteur de scoring (session du 27/07/2026, suite)

```text
Découpage en 4 lots confirmé AVEC l'utilisateur (AskUserQuestion), un lot à
la fois avec vérification entre chaque, même discipline que le lot Admin :
  1. Moteur pur (lib/scoring/engine.ts) — CE lot.
  2. Writer minimal series.official_* (lib/sync/writeSeriesOutcome.ts) —
     SEULE la fonction d'écriture, PAS le reste de T4 (pas de route API,
     pas de client Highlightly, pas de cron).
  3. Orchestration (lib/scoring/recompute.ts) — recomputeMatch/Series/
     Bet/Competition.
  4. Câblage admin — bouton Recalculer, résolution des paris, traitement
     des requêtes de correction.

**Framework de test ajouté** : `vitest` (devDependency NOUVELLE — la
première du projet ; jusqu'ici tout vérifié par scripts jetables/tests
manuels). Confirmé AVEC l'utilisateur (AskUserQuestion) : la spec T5 §11
décrit elle-même le moteur pur comme testable « sans base, sur cas de
table » — 32 cas déjà listés, dont 26 relevant du moteur pur (lot 1).
`npm test` (`vitest run`) ajouté aux scripts.
```

### 2.24 Lot 1/4 T5 — Moteur pur (`lib/scoring/engine.ts`)

```text
Périmètre : SPEC_TECHNIQUE_SCORING_V0_1.md §3-§9 — les 4 fonctions PURES
(deriveSeriesOutcome, scoreMatchPrediction, scoreBracketPick, scoreBet).
AUCUNE I/O, AUCUNE dépendance getServerClient/next-headers (C-3). Spec déjà
VALIDÉE et figée (19/07/2026) — aucune nouvelle décision produit, portage
fidèle des signatures et barèmes du §3.

**Point d'interprétation trouvé et documenté dans le code** (pas une
nouvelle décision, une clarification de lecture) : le §4 de T5 dit que
`deriveSeriesOutcome` "renvoie tel quel" un statut CANCELLED/POSTPONED déjà
présent — mais la signature figée du §3 ne prend QUE `matches` +
`competitionType`, aucun statut existant en entrée. Ces deux phrases sont
incompatibles littéralement. Tranché : la signature du §3 (le contrat
figé) fait autorité — `deriveSeriesOutcome` reste STRICTEMENT pure et
calcule toujours depuis les matchs ; le respect d'un CANCELLED/POSTPONED
déjà posé par un admin est un garde-fou de l'ORCHESTRATION (lot 2/3, avant
d'appeler deriveSeriesOutcome + writeSeriesOutcome), pas de cette fonction.
Documenté en commentaire dans engine.ts ; le cas de test #5 de la spec (qui
testait ce point) est donc déplacé au lot 3 (orchestration) plutôt que
testé ici.

**Clarification trouvée en écrivant le code** (pas un point produit, une
lecture précise du §6.3) : la composante AFFICHE d'un pick de bracket se
score dès que la PAIRE OFFICIELLE de la série est connue — INDÉPENDAMMENT
du fait que la série elle-même soit FINISHED. Un joueur peut donc voir son
affiche scorée (bonne ou mauvaise) avant même que la série ne soit jouée,
pendant que vainqueur/score-exact restent encore NULL (en attente). Les
cas de test #26/#27 de la spec confirment cette lecture (« sera scorée
quand la paire officielle sera connue »).

Fichiers : lib/scoring/engine.ts (4 fonctions + types + helpers internes
non exportés) ; lib/scoring/engine.test.ts (26 tests, cas 1-4/6-27 du §11 —
tous PASSENT).

Vérifié : npx tsc --noEmit, npx eslint ., npx next build tous propres
(aucune route impactée, engine.ts/.test.ts hors app/) ; npm test → 26/26.

COMMITTÉ et POUSSÉ sur `main`.
```

### 2.25 Lot 2/4 T5 — Writer `series.official_*` (`lib/sync/writeSeriesOutcome.ts`)

```text
Périmètre : SPEC_TECHNIQUE_SCORING_V0_1.md §12.1/§12.2 (C-2) — UNIQUEMENT
la fonction d'écriture, PAS le reste de T4 (aucune route /api/sync/*, aucun
client Highlightly, aucun cron — ces pièces restent à construire
séparément le jour où la vraie synchro API est câblée).

Fonction fine (un seul UPDATE service_role sur `series.official_status/
official_winner_team_id/official_score_format`), SANS garde de
"changement" — réécrit toujours ce qu'on lui donne (idempotent) ; la
décision d'appeler ou non revient à L'APPELANT (recomputeMatch, lot 3 —
"on ne rejoue pas pour rien", §10.3). Ne re-vérifie PAS is_admin()
elle-même (contexte système, service_role) — c'est la responsabilité de
l'appelant (action admin re-vérifiée AVANT d'appeler, T6a §5.1).

Vérifié : npx tsc --noEmit, npx eslint ., npx next build tous propres.
Test en conditions réelles (service_role, sur une série "sans rôle
particulier" du jeu de test) : écriture des 3 colonnes vérifiée, puis
revert vérifié (état final identique à l'état initial). PAS de test
`vitest` pour ce module (touche une vraie base, pas une fonction pure —
vérifié en conditions réelles comme le reste du projet, pas mockée).

COMMITTÉ et POUSSÉ sur `main`.
```

### 2.26 Lot 3/4 T5 — Orchestration (`lib/scoring/recompute.ts`)

```text
Périmètre : SPEC_TECHNIQUE_SCORING_V0_1.md §10 — recomputeMatch/
recomputeSeries/recomputeBet/recomputeCompetition, adaptateur IMPUR autour
du moteur pur (lot 1) + du writer (lot 2). Contexte système (service_role),
jamais appelée par une action joueur (P2). PAS l'avancement des équipes
vers la série suivante (écrire series.team1_id/team2_id) : donnée
OFFICIELLE réelle, fournie par la synchro T4 (hors périmètre) ou une
résolution admin A2 (lot 4) — jamais dérivée en interne ici.

**vitest.config.ts créé** (alias `@/*` requis pour que les modules
lib/ s'importent entre eux sous vitest comme dans l'app ; alias
`server-only` → module vide, car ce garde-fou choisit son export via la
condition de résolution `react-server` posée par le bundler Next.js,
absente sous vitest — neutralisé UNIQUEMENT pour les tests, intact dans le
vrai build).

**Garde-fou d'orchestration implémenté** (interprétation actée au lot 1,
§2.24) : `recomputeMatch` ne réécrit JAMAIS `series.official_*` si le
statut actuellement stocké est déjà CANCELLED/POSTPONED (posé par un
admin) — appelle directement `recomputeSeries` sur l'état existant dans ce
cas, sans re-dériver.

**Décision d'implémentation** (transaction, §10.3) : la spec demande une
seule transaction Postgres par passe. `supabase-js` (REST, pas de
transaction multi-requêtes côté client) ne le permet pas nativement sans
écrire une fonction RPC dédiée pour CHAQUE recompute — jugé hors périmètre
de ce lot. Accepté comme simplification, compensée par l'IDEMPOTENCE (P5) :
une passe interrompue est rejouable sans risque, le pire cas est un état
transitoirement incomplet entre deux requêtes, jamais un état FAUX ou
doublé.

**Décision d'implémentation** (scored_at) : posé dès qu'AU MOINS une
composante d'un pick de bracket est déterminée (l'affiche peut se scorer
avant le vainqueur, cf. lot 1) — NULL seulement si les 3 composantes
restent en attente. Pas fixé littéralement par la spec, cohérent avec la
convention NULL/0 actée (§12.3).

Vérifié : npx tsc --noEmit, npx eslint ., npx next build, npm test (26/26)
tous propres.

**Test d'intégration en conditions réelles** (fichier JETABLE, supprimé
après vérification — pas un test vitest permanent, car il crée/détruit une
VRAIE compétition ARCHIVED isolée, nécessite service_role) : bracket à 3
séries (2× ROUND_1 alimentant 1× CONF_SEMIS), 2 joueurs de test
(Amine92/Chloe_B réutilisés), 4 matchs joués 4-0. 5 vérifications, TOUTES
PASSENT :
1. recomputeMatch score correctement les pronos de match (10+5 pour un bon
   vainqueur + écart exact, 0 pour un mauvais vainqueur).
2. La série ROUND_1 est correctement dérivée FINISHED/4-0/bon vainqueur,
   ET la cascade vers recomputeSeries score bien les picks de bracket
   (vainqueur 25 pts pour ROUND_1, affiche 0 car ROUND_1 sans matchup).
3. La série CONF_SEMIS avale (paire officielle pas encore connue) laisse
   bien l'affiche EN ATTENTE (NULL), aucun point fantôme.
4. Une fois la paire officielle de la série avale renseignée (simulation
   d'une résolution admin/avancement réel), l'affiche se score
   correctement SANS AUCUN code spécial — confirme littéralement
   l'interprétation actée au lot 1 (affiche indépendante de FINISHED).
5. recomputeBet : WON niveau 4 → 20 pts, LOST → 0.
6. recomputeCompetition rejouée DEUX FOIS de suite sur toute la
   compétition de test → résultat rigoureusement identique (idempotence
   P5, vérifiée en conditions réelles, pas seulement sur le moteur pur).

Compétition de test + toutes ses données enfants supprimées après
vérification (confirmé : 0 ligne restante). Aucune trace laissée.

**LE MOTEUR DE SCORING EST DÉSORMAIS FONCTIONNELLEMENT COMPLET** — reste
uniquement le câblage admin (lot 4/4) pour le rendre utilisable depuis
l'UI (bouton Recalculer, résolution des paris, traitement des requêtes).

COMMITTÉ et POUSSÉ sur `main`.
```

### 2.27 Lot 4a T5 — Bouton « Recalculer » (premier morceau du câblage admin)

```text
Périmètre : SPEC_ECRAN_ADMIN_DASHBOARD_V0_1.md §4/§7 (design cible déjà
figé au lot 1 du lot Admin, §2.20 — enfin codable maintenant que
recomputeCompetition existe, T5 lot 3). Lot 4/4 de T5 scindé en 3
morceaux (bouton, résolution, requêtes) — CE morceau : le bouton seul.

Fichiers : lib/actions/admin.ts (recalculateCompetition — re-vérifie
is_admin() en session, PUIS délègue à recomputeCompetition, PUIS
logAdminAction "RECALCULATE_COMPETITION") ; components/admin/
RecalculateButton.tsx (+ .module.css, SEULE feuille "use client" du
tableau de bord — dialogue de confirmation, MÊME patron que
components/bracket-fill/BracketFillBoard.tsx, déjà le patron cité par la
spec) ; app/(admin)/admin/page.tsx (bouton câblé, désactivé si aucune
compétition active, `.footnote` devenue orpheline retirée du CSS).

Vérifié : npx tsc --noEmit, npx eslint ., npx next build, npm test
(26/26) tous propres.

**Limite de vérification assumée et signalée** (pas de conditions réelles
complètes pour CE morceau précis, contrairement à tous les lots
précédents) : `recalculateCompetition` est appelée par le client (JS,
`startTransition`) et non par un `<form action>` natif — le mécanisme
Next.js sous-jacent (Server Reference résolue via le bundle client) est
plus complexe à rejouer à la main que la technique `$ACTION_ID_` utilisée
jusqu'ici pour les formulaires natifs. La fonction APPELÉE
(`recomputeCompetition`) est déjà prouvée par 5 tests d'intégration réels
(lot 3, §2.26) ; le MÉCANISME d'appel (composant client + `useTransition`
+ appel direct d'une server action) est déjà prouvé ANALOGUE et
fonctionnel dans ce même dépôt (`validateBracket`, Bracket personnel,
§2.16). Seule la COMPOSITION propre à ce lot (is_admin + recherche de la
compétition active + logAdminAction, tous individuellement déjà prouvés
ailleurs) n'a pas été cliquée en vrai. Signalé explicitement plutôt que
prétendu vérifié — à confirmer par l'utilisateur en cliquant lui-même
(`/profile` → « Tableau de bord admin » → bouton « Recalculer » en bas).

**Bug RÉEL trouvé par l'utilisateur en testant** (premier vrai regard
navigateur sur la zone admin — les lots précédents, §2.20-§2.23, n'avaient
été vérifiés que par fetch HTML, jamais visuellement) : `app/(admin)/
admin/layout.module.css` `.shell` ne fixait NI fond NI couleur de texte via
les tokens — retombait sur `--background` de `globals.css` (blanc, sauf
`prefers-color-scheme` OS sombre), rendant le texte clair du thème sombre
de l'app quasi invisible. Corrigé en ajoutant `background: var(--color-
surface-base); color: var(--color-text-primary); font-family: var(--font-
ui);` — EXACT même correctif que `app/(app)/layout.module.css` avait déjà
dû appliquer (commentaire déjà présent là-bas : « quel que soit ce que
définit globals.css par ailleurs »), que je n'avais pas répliqué en créant
la coquille admin (§2.20). Une SEULE coquille partagée par les 4 écrans
admin → corrige les 4 d'un coup. Confirmé lisible par l'utilisateur après
coup, sur les 4 pages.

Bouton Recalculer ET ce correctif : COMMITTÉS et POUSSÉS sur `main`.
```

### 2.28 Lot 4b T5 — File de résolution des paris (`/admin/resolution`)

```text
Périmètre : SPEC_ECRAN_ADMIN_RESOLUTION_V0_1.md (Cadrage/V1/Spec visuelle/,
nouveau fichier, close en séance) — deuxième morceau du câblage admin,
après le bouton Recalculer (lot 4a).

Factorisation faite (annoncée depuis §7 ETAT_ACTUEL, jamais faite avant
faute d'un 4e utilisateur réel) : `lib/scoring/bet-deadline.ts` —
`computeBetDeadlinesPassed`, extrait de la logique dupliquée 3 fois
(`lib/queries/{bets,home,admin-dashboard}.ts`) — ces 3 sites NE SONT PAS
retouchés (code déjà testé/committé, zéro risque pris pour un lot qui n'en
avait pas besoin).

Fichiers : lib/queries/admin-resolution.ts (bets VALIDATED + échéance
dépassée de TOUS les joueurs, enrichi d'un flag `isContested` — requête de
correction PENDING déjà déposée sur ce pari précis) ; lib/actions/
admin-resolution.ts (resolveBet — motif OBLIGATOIRE côté SERVEUR si
contesté, re-garde le statut VALIDATED dans le WHERE, appelle
recomputeBet ENSUITE) ; components/admin/ResolutionBetCard.tsx (+
.module.css, UN SEUL formulaire natif à 2 boutons submit `name="outcome"
value="WON"/"LOST"` — pas 2 formulaires séparés comme la validation,
plus simple ici car le motif est partagé). lib/labels/bets.ts étendu
(`BET_DIFFICULTY_POINTS`, affichage seulement — l'autorité du calcul
reste `scoreBet`). Carte « à résoudre » du tableau de bord rendue `<Link>`
actif.

Vérifié : npx tsc --noEmit, npx eslint ., npx next build, npm test
(26/26) tous propres, aucun conflit de route.

Test en conditions réelles (même technique @supabase/ssr) : 2 paris de
test VALIDATED créés sur une série déjà passée (CLE-ORL, sans toucher aux
pronos/paris réels qui y sont déjà rattachés — nouveaux paris ajoutés,
rien modifié) + 1 requête de correction PENDING sur le second (pour tester
« contesté »). Rendu vérifié (badge Contesté, description, catégorie/
difficulté) ; **cas négatif réel** : tentative de résoudre le pari
contesté SANS motif → refusée côté serveur (« Un motif est obligatoire
pour un pari contesté. ») ; résolution avec motif → acceptée. Résultats en
base 100% corrects : pari normal → WON, points_awarded=20 (barème
difficulté 4, calculé par recomputeBet, pas deviné) ; pari contesté →
LOST, points_awarded=0, resolution_reason enregistré. Données de test +
requête de correction + logs supprimés après vérification, mot de passe
temporaire re-randomisé.

COMMITTÉ et POUSSÉ sur `main`.
```

### 2.29 Lot 4c T5 — File des requêtes de correction (`/admin/requests`) — DERNIER LOT DE T5

```text
Périmètre : SPEC_ECRAN_ADMIN_REQUESTS_V0_1.md (Cadrage/V1/Spec visuelle/,
nouveau fichier, close en séance) — DERNIER morceau du câblage admin
(lot 4c) ET du chantier T5 tout entier. Après le bouton Recalculer (4a) et
la file de résolution (4b).

**Asymétrie RÉELLE trouvée au pré-vol, documentée dans la spec (§0), pas
une invention** : les requêtes MATCH_PREDICTION (migration #7, voie A)
peuvent porter une proposition du joueur (proposed_winner_team_id/
proposed_margin) que l'admin confirme ou ajuste — correction RÉELLE de
contenu. Les requêtes BET (migration #11, « pari oublié ») ne portent
JAMAIS de valeur proposée — la vraie correction est de RÉSOUDRE le pari
(déjà fait ailleurs, /admin/resolution, lot 4b) ; « traiter » une requête
BET ici se contente de marquer is_admin_corrected/corrected_by_admin_id/
correction_reason sur `bets` (marquage public de transparence, 0.2.3 §7,
colonnes symétriques à match_predictions jamais utilisées jusqu'ici) et de
clore la requête — DEUX comportements de traitement bien réels, pas un
oubli de symétrie.

Garde-fous DÉJÀ EN BASE (pré-vol, AUCUNE migration pour ce lot) :
RLS cr_update_admin (admin ≠ requérant, bloque déjà l'auto-traitement au
niveau de correction_requests) ; RLS mp_update_admin + bets_update_admin
(is_admin() peut modifier n'importe quelle ligne) ; trigger
enforce_prediction_correction (T-c, migration #3) — re-vérifie EN BASE
qu'un admin ne corrige jamais son propre prono, INDÉPENDAMMENT de la
garde côté correction_requests.

Fichiers : lib/queries/admin-requests.ts (TOUTES les correction_requests
PENDING, MATCH_PREDICTION et BET dans une seule file — 0.2.7 §6) ;
lib/actions/admin-requests.ts (processCorrectionRequest — branche
MATCH_PREDICTION/BET, recomputeMatch UNIQUEMENT pour MATCH_PREDICTION,
aucun recompute pour BET — rien de scorable n'y change ; rejectCorrection
Request — motif obligatoire, aucune écriture sur la cible) ;
components/admin/RequestCard.tsx (+ .module.css, rendu DIFFÉRENT selon
targetType, 2 formulaires natifs indépendants — Traiter/Refuser — AUCUN
"use client", même un <select> d'équipe fonctionne nativement). Carte
« requêtes » du tableau de bord rendue `<Link>` actif — LES 5 PAGES
FILLES SONT DÉSORMAIS TOUTES CÂBLÉES, page.tsx simplifié (plus aucune
branche « inerte »).

Vérifié : npx tsc --noEmit, npx eslint ., npx next build, npm test
(26/26) tous propres, aucun conflit de route (6 routes /admin/* au total).

**Test en conditions réelles le plus complet de tout le lot Admin** (même
technique @supabase/ssr), 4 scénarios :
1. MATCH_PREDICTION « voie A » (Tariq_M, jamais pronostiqué) avec
   proposition du joueur — traité par Sofia_Admin avec vainqueur+écart
   corrigés → match_predictions bien écrit, is_admin_corrected=true,
   ET recomputeMatch a réellement scoré le prono corrigé
   (is_winner_correct=true, winner_points=10, vérifié en base).
2. **Cas négatif réel, garde-fou EXISTANT (pas codé par ce lot)** :
   Sofia_Admin tente de traiter SA PROPRE requête MATCH_PREDICTION → le
   TRIGGER enforce_prediction_correction (pas la RLS de
   correction_requests, contrairement à l'hypothèse de départ — le
   trigger sur match_predictions a tranché en premier) bloque avec le
   message exact « Un admin ne peut pas corriger son propre prono »,
   remonté tel quel ; le prono de Sofia reste vide, sa requête reste
   PENDING — confirmé en base.
3. BET (Chloe_B, « pari oublié ») traité → bets marqué is_admin_corrected/
   corrected_by_admin_id/correction_reason, statut du PARI inchangé
   (VALIDATED, la résolution reste une action séparée, comme voulu) ;
   requête → PROCESSED.
4. BET (Amine92) refusé avec motif → requête REJECTED, admin_reason
   enregistré, AUCUNE écriture sur le pari (statut/is_admin_corrected
   inchangés) — confirmé en base.
Nettoyage : cycle de FK circulaire rencontré en supprimant les données de
test (match_predictions.correction_request_id ↔ correction_requests.
target_match_prediction_id) — résolu en vidant les FK avant suppression,
pas un bug de l'écran, un artefact du script de nettoyage jetable. Tout
confirmé supprimé après coup, mot de passe temporaire re-randomisé.

**CHANTIER T5 ENTIÈREMENT CLOS** (moteur pur, writer, orchestration,
câblage admin — les 4 lots) **ET LOT ADMIN ENTIÈREMENT CLOS** (6 écrans :
tableau de bord, validation, résolution, requêtes, joueurs, logs).

COMMITTÉ et POUSSÉ sur `main`.
```

### 2.30 Gestion des compétitions — lot 1/3 : création (session du 27/07/2026, suite)

```text
Périmètre : SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1.md (nouveau fichier, close
en séance) — nouveau chantier, DISTINCT du lot Admin et de T5, ouvert
suite à une question directe de l'utilisateur (« on doit pouvoir switcher
Playoffs/Cup, c'est prévu ? »). `app/(admin)/admin/competitions/{page,
new}.tsx` — CE lot ne couvre QUE la création. Découpé en 3 avec
l'utilisateur : 1. création (CE lot) — 2. saisie manuelle des résultats
(remplace T4 tant qu'elle n'existe pas, dure toute la compétition,
PROCHAIN morceau) — 3. clôture/archivage.

**Trouvaille structurante, changé le cadrage de la conversation** : en
retraçant `decisions_multi_competitions_historique.md`, le plan d'origine
(16/07/2026) visait la NBA Cup EN PREMIER pour la V1 (lancement réel visé
30/10/2026), Playoffs reporté « sans urgence, saison 2027 » — mais le jeu
de données de test créé le 23/07/2026 a silencieusement dérivé vers
Playoffs, jamais recroisé avec cette décision. Le moteur de scoring (T5)
n'a lui jamais dérivé : les deux barèmes sont pleinement codés. Décision
de l'utilisateur suite à cette découverte : laisser le jeu de TEST tel
quel, mais construire l'écran de gestion des compétitions pour être prêt
en vrai le moment venu — d'où ce chantier.

**Trouvaille au pré-vol, avant tout code** : même une fois une compétition
créée, RIEN ne fait aujourd'hui avancer une équipe vers le tour suivant ni
ne pose un résultat officiel — ni T4 (non codée), ni aucune action admin
(le writer `series.official_*` de T5 existe mais aucun écran ne l'appelle
pour un usage normal). C'est ce qui a motivé le lot 2 (saisie manuelle)
comme le morceau le plus important pour le 30 octobre, séparé de celui-ci.

**Décision actée AVEC l'utilisateur** : saisie manuelle des équipes par
l'admin à la création (pas d'attente de T4/du mapping automatique A7).

**2e trouvaille au pré-vol** : AUCUNE policy RLS d'INSERT n'existe sur
`series` (seules `series_select`/`series_update` existent) — la création
du bracket Playoffs (15 lignes) passe donc par `getServiceClient()`
(catégorie B, écriture admin-système, même famille que `recomputeCompetition`
/`writeSeriesOutcome`), après re-vérification explicite de `is_admin()` en
session, PLUTÔT qu'une nouvelle migration RLS pour un cas d'usage rare
(quelques fois par saison). `competitions`/`competition_secrets` restent en
session admin (RLS `competitions_insert`/`secrets_all`, déjà en place).

Fichiers : lib/queries/admin-competitions.ts (compétition active + code de
compétition ; liste des équipes) ; lib/actions/admin-competitions.ts
(`createCompetition` — topologie du bracket Playoffs FIXE et codée en dur,
bottom-up NBA_FINALS→CONF_FINALS→CONF_SEMIS→ROUND_1 pour toujours connaître
l'id de la série aval avant de créer la série amont ; validations
serveur : 16 équipes distinctes, conférences cohérentes par affiche) ;
app/(admin)/admin/competitions/page.tsx (statut + code de compétition,
bouton Clôturer VISIBLE mais DÉSACTIVÉ, lot 3) ; app/(admin)/admin/
competitions/new/page.tsx (formulaire natif, 100% composant serveur — les
2 jeux de champs Playoffs/Cup cohabitent dans UN SEUL formulaire, celui
non pertinent est ignoré côté serveur). Carte « Compétitions » ajoutée au
tableau de bord.

Vérifié : npx tsc --noEmit, npx eslint ., npx next build, npm test
(26/26) tous propres, 24 routes sans conflit.

**Test en conditions réelles avec une précaution particulière** (touche la
VRAIE compétition active utilisée par les amis de l'utilisateur) : cas
négatif testé SANS aucun risque (tentative de création alors qu'une
compétition est déjà active → refusée avec le bon message, rien touché) ;
cas de succès testé en ARCHIVANT TEMPORAIREMENT la vraie compétition
(service_role), créant une compétition de test isolée avec 16 vraies
équipes (8 affiches), vérifiant les 15 séries (8 ROUND_1 remplies +
7 vides des tours suivants, cascade next_series_id/slot correcte,
NBA_FINALS sans next_series_id ni conférence), PUIS supprimant la
compétition de test ET restaurant IMMÉDIATEMENT la vraie compétition en
ACTIVE (bloc try/finally, restauration garantie même en cas d'échec d'une
assertion). Confirmé après coup : compétition réelle intacte (ACTIVE,
mêmes données), `/leaderboard` et `/bracket` répondent normalement, aucune
compétition de test résiduelle.

PAS committé ni déployé à ce stade (à confirmer avec l'utilisateur).
```

### 2.31 Correctif — dialogue de validation Matchs (session du 27/07/2026, suite)

```text
Remonté par l'utilisateur en test réel mobile sur le déploiement Vercel
(écran /play/matches, LAL–HOU) : sélection complète à l'écran (Lakers +
écart 6) mais clic sur « Valider le prono » rejeté avec « Choisis un
vainqueur et un écart avant de valider. ». Diagnostic : le bouton s'active
sur la saisie LOCALE (React state), mais `validateMatchPrediction`
(lib/actions/matches.ts) relit le brouillon PERSISTÉ en base — jamais la
saisie locale. Cliquer « Valider » sans être passé par « Enregistrer le
brouillon » échouait donc systématiquement, alors que l'écran semblait
prêt. Vrai bug, pas une fausse manip.

Correctif décidé avec l'utilisateur (pas de disable supplémentaire sur le
bouton) : `components/matches/PredictionForm.tsx`, dialogue de
confirmation à deux variantes selon que la saisie locale diffère du
brouillon enregistré (`isUnsaved`) — brouillon à jour : dialogue inchangé
(Annuler/Valider) ; brouillon non enregistré : corps de dialogue explicite
+ 3 actions (Retour / Enregistrer le brouillon / Valider définitivement,
qui enregistre puis valide en un seul clic explicite). Spec amendée en
miroir : SPEC_ECRAN_MATCHS_V0_1.md §21.

Vérifié : npx tsc --noEmit, npx eslint, npx next build tous propres.
Action `useTransition` (comme RecalculateButton) : pas rejouable en
headless, test réel laissé à l'utilisateur sur le déploiement.

PAS committé ni déployé à ce stade (à confirmer avec l'utilisateur).
```

### 2.32 Correctif des 12 vulnérabilités npm (session du 27/07/2026, suite — PRIORITÉ 1 de l'ordre de reprise)

```text
Objet : les 12 vulnérabilités `npm audit` trouvées en fin de session
précédente (§2 ci-dessus, `GAPS_OUVERTS.md`) — deux chaînes indépendantes,
`next` figé à 16.2.10 et `eslint` en v9.

`next` 16.2.10 → **16.2.12** (`eslint-config-next` assorti à l'identique,
16.2.12 — convention du projet, même version que `next`) : corrige les 9
CVE directes de Next.js (Middleware/Proxy bypass, DoS/SSRF Server
Actions, SSRF rewrites, disclosure endpoints). Vérifié après coup dans
`npm audit --json` : l'entrée `next` ne référence plus aucune CVE propre,
seulement un héritage transitif via `postcss`/`sharp` (ci-dessous).

`eslint` 9 → 10 **TENTÉ PUIS ABANDONNÉ, trouvaille bloquante** (pas une
simple histoire de règles à réajuster, contrairement à l'hypothèse posée
dans `GAPS_OUVERTS.md`) : `eslint-plugin-react@7.37.5` (embarqué par
`eslint-config-next@16.2.12`, aucune version stable publiée à ce jour ne
déclare de compatibilité eslint 10 dans son `peerDependencies`, vérifié
sur le registre npm) plante avec `TypeError: contextOrFilename.getFilename
is not a function` — API supprimée par ESLint 10, pas contournable par la
config. **Flag explicite fait AVANT de continuer** (AskUserQuestion) :
l'utilisateur a choisi de rester sur eslint 9 plutôt que de casser le lint
en attendant qu'`eslint-config-next` mette à jour ses plugins embarqués.
Point réouvert ci-dessous (`GAPS_OUVERTS.md`) pour reprise quand ce sera
possible en amont.

Les 6 vulnérabilités restantes après le bump `next` seul (toutes dans
l'arbre de dépendances embarqué par `eslint-config-next` — outillage dev,
jamais exécuté en production) tracent TOUTES à un seul nœud :
`brace-expansion <=5.0.7` (DoS, `GHSA-mh99-v99m-4gvg`) remonté via
`minimatch@3.1.5`. Un override direct de `brace-expansion` seul CASSE
`minimatch@3.1.5` (`TypeError: expand is not a function` — `brace-expansion`
5.x a changé la forme de son export, incompatible avec l'API attendue par
les `minimatch` anciens). Corrigé par `overrides` npm ciblant les DEUX
niveaux ensemble (`package.json`) : `minimatch: ^10.2.6` (dernière version,
construite pour la nouvelle forme) + `brace-expansion: ^5.0.8` — cohérent
entre eux, vérifié par relecture des `peerDependencies`/`dependencies`
publiés avant d'appliquer. Overrides ajoutés au passage pour la chaîne
`next`/`postcss`/`sharp`, embarqués par `next` en version FIGÉE dans son
propre `package.json` (pas résolue par le bump de version de `next` seul) :
`postcss: ^8.5.18` (3 CVE : XSS stringify, lecture arbitraire de fichier
via sourceMappingURL, path traversal du même ordre) et `sharp: ^0.35.0`
(CVE libvips héritées).

Résultat final : `npm audit` → **0 vulnérabilité** (contre 12). `npx tsc
--noEmit`, `npx eslint .`, `npm test` (26 tests `vitest`), `npx next build`
tous propres après le dernier `npm install` — 24 routes toujours sans
conflit, aucune régression.

Committé et poussé sur `main` (2 commits : dépendances, puis doc).
```

### 2.33 Gestion des compétitions — lots 2/3 (résultats) ET 3/3 (clôture) CODÉS ET VÉRIFIÉS EN CONDITIONS RÉELLES (session du 27-28/07/2026, suite)

```text
Objet : PRIORITÉ 2 de l'ordre de reprise (§2.32) — le morceau signalé « le
plus important avant le 30/10 » (§2.30). Spec écrite EN SÉANCE (aucune
n'existait, même patron que Bracket personnel), deux points structurants
tranchés AVEC l'utilisateur (AskUserQuestion) AVANT de coder : avancement
AUTOMATIQUE du vainqueur vers le tour suivant (pas de bouton séparé) ; A2
(série annulée/vainqueur désigné à la main sans match) HORS périmètre,
reporté en gap.

**Trouvaille structurante au pré-vol** (documentée
`SPEC_ECRAN_ADMIN_RESULTATS_V0_1.md` §0) : la création d'une compétition
(lot 1) ne crée QUE les 15 lignes `series` — AUCUN `matches`. Ce lot doit
donc aussi permettre de CRÉER les matchs d'une série au fur et à mesure
(1 à 7, jamais connu à l'avance), pas seulement en saisir le score.

**Code (lot 2/3)** : `lib/scoring/advancement.ts` (`advanceWinnerIfDecided`,
NOUVELLE fonction, volontairement SÉPARÉE de `lib/scoring/recompute.ts` —
T5 est VALIDÉ et clos, cette frontière n'est pas rouverte — propage le
vainqueur d'une série `FINISHED` vers `team1_id`/`team2_id` de la série
aval, SEULEMENT si ce slot est encore NULL, non destructif) ;
`lib/queries/admin-results.ts` (lecture groupée par tour, sans la
confidentialité du Bracket joueur — un admin voit tout) ;
`lib/actions/admin-results.ts` (`createMatch` en service_role — AUCUNE
policy RLS `matches_insert` n'existe, même trouvaille que `series` au lot
1 — et `saveMatchResult` en service_role, qui enchaîne UPDATE →
`recomputeMatch` → `advanceWinnerIfDecided`, une seule entrée
`logAdminAction` pour les deux) ; `app/(admin)/admin/competitions/
results/page.tsx` + `components/admin/SeriesResultsCard.tsx` — formulaires
natifs uniquement, aucun `"use client"`.

**Bug trouvé par l'utilisateur en testant, corrigé dans la foulée** : les
champs de score n'avaient qu'un `placeholder` (abréviation d'équipe,
disparaît au clic) comme seule indication, largeur 5 caractères — illisible.
Corrigé : vrai `<label>` visible au-dessus de chaque champ (abréviation
persistante), largeur portée à 3.5rem.

**Débloqué en cours de route : lot 3/3 (clôture/archivage), pas prévu à ce
stade** — l'utilisateur, en testant la création d'une 2e compétition
(avant de brancher T4), a buté sur `uniq_one_active_competition` : sans
clôture, impossible d'en créer une nouvelle. Décidé AVEC l'utilisateur de
construire le lot pour de bon plutôt qu'un contournement jetable. Lecture
actée du « reset » (`decisions_multi_competitions_historique.md` §3, pas
précisée au-delà) : contrairement au prototype (`reset_simulation.sql`),
RIEN n'est supprimé en V1 — chaque ligne reste rattachée à son
`competition_id` pour toujours (nécessaire à un futur historique joueur).
« Reset » = `competitions.status` → `ARCHIVED`, ce qui SEUL libère le slot
de l'index partiel. **Code** : `lib/actions/admin-competitions.ts`
(`closeCompetition`, session admin normale — RLS `archives_insert`/
`competitions_update` déjà ouvertes, AUCUN service_role nécessaire —
snapshot `competition_archives` puis `ARCHIVED`, gardé contre une double
clôture) ; `components/admin/CloseCompetitionButton.tsx` (dialogue de
confirmation, même patron que `RecalculateButton`, action IRRÉVERSIBLE).
**Nouveau module partagé** `lib/scoring/ranking.ts` (`assignRanks`,
extrait de `lib/queries/leaderboard.ts`) : le départage de rang (Total,
bons vainqueurs, écarts exacts, points bracket ; ex-aequo = même rang)
doit produire EXACTEMENT le même résultat au classement live et dans
l'archive figée — `leaderboard.ts` a été migré dessus au passage (aucun
changement de comportement, juste la même règle à un seul endroit).

**Point réel non tranché, remonté par l'utilisateur en testant** (« l'API
peut détecter les matchs Cup automatiquement ? ») : la spec T4 dit
l'API match-centrique, jamais série-centrique (branche B, empiriquement
confirmée) — détecter les matchs de quarts Cup est plausible, mais
construire les 7 séries du mini-bracket à partir de ça n'a jamais été
sondé empiriquement (contrairement à la branche A/B des Playoffs). Reporté
à une fois la clé API Highlightly en main, sur la fenêtre Cup réelle de
décembre 2025 — voir `GAPS_OUVERTS.md`.

**Test en conditions réelles, PAR L'UTILISATEUR lui-même** (pas de session
HTTP rejouée par Claude cette fois — bloqué par le mode auto, changer un
mot de passe de compte de test a été refusé par le classifieur ;
l'utilisateur a testé directement dans son navigateur, connecté en
`Rillettes-31`, 2e compte ADMIN du jeu de données, distinct de
`Sofia_Admin`) : création d'une compétition NBA_CUP bloquée en pratique
(AUCUNE série créée pour ce type, comme documenté §3 de
`SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1.md` — pas un bug, jamais construit) ;
clôturée puis recréée en PLAYOFFS (« TEST playoff 28/07/2026 », code
`78D0EE7C`) ; série ATL–BOS jouée à 4 matchs réels, ATL gagnant les 4 →
vérifié directement en base par Claude (service_role, lecture seule) :
série passée à `FINISHED`, vainqueur ATL, ET propagé correctement dans
`team1_id` de la bonne série CONF_SEMIS (ES1) — `team2` de cette série
reste NULL, attendu, l'autre série qui l'alimente (BKN–CHA) n'est pas
encore jouée.

Vérifié : `npx tsc --noEmit`, `npx eslint .`, `npm test` (26 tests),
`npx next build` tous propres après chaque étape (lot 2/3, lot 3/3,
correctif score) — 25 routes (`/admin/competitions/results` nouvelle),
aucun conflit.

Committé et poussé sur `main` (3 commits : lot 2/3, lot 3/3, doc).
Prochaine étape actée AVEC l'utilisateur : T4 (vraie
synchro API Highlightly) — déjà entièrement spécifié et validé le
18/07/2026, aucune réserve ouverte, jamais codé. Remplace « vrai hub
Jouer » comme priorité suivante (`GAPS_OUVERTS.md`). Bloquant : clé API
Highlightly, à obtenir et poser par l'utilisateur directement dans
`.env.local` (jamais dans le chat).
```

### 2.34 T4 — synchro API Highlightly, CODÉE et testée en conditions réelles (session du 28/07/2026)

```text
Clé Highlightly posée par l'utilisateur dans `.env.local`
(`HIGHLIGHTLY_API_KEY`). Avant de coder, l'utilisateur a soulevé un vrai
problème : on est le 28/07/2026, en pleine intersaison NBA, aucun match
réel dans l'horizon "aujourd'hui" pendant plusieurs mois — le pipeline
`schedule`/`results` est pensé `now()`-relatif (§6 de la spec). Décidé
(AskUserQuestion) : les deux routes acceptent un `?date=YYYY-MM-DD`
optionnel (`lib/sync/devDateOverride.ts`), DEV/TEST UNIQUEMENT, jamais
envoyé par le vrai planificateur externe, toujours derrière le Bearer
`SYNC_SECRET`.

**Avant de coder les types du client**, 2 appels réels effectués (`GET
/teams`, `GET /matches?date=2025-06-08&timezone=America/New_York` — vrai
jour de Finals 2025) plutôt que de deviner au-delà de ce que le repérage
§5.1 de la spec avait sondé. Révèle 3 trouvailles non anticipées,
flaguées à l'utilisateur AVANT de coder (AskUserQuestion) :
- `/teams` = tableau nu en racine (pas d'enveloppe `data`, contrairement à
  `/matches`) ;
- `league="NBA"` (53 entrées) mélange les 30 vraies franchises avec des
  entités hors référentiel (équipes All-Star, une internationale, "World")
  — même en filtrant sur "logo présent", 37 passent au lieu de 30 ;
- 6 abréviations Highlightly diffèrent des nôtres déjà committées (NY/GS/
  NO/SA/UTAH/WSH vs NYK/GSW/NOP/SAS/UTA/WAS).
**Décision actée** : table d'alias figée (`lib/nba/teamAliases.ts`,
construite à la main depuis le payload réel) plutôt qu'un filtre
heuristique — `/api/sync/teams` n'écrit donc plus jamais `teams` (nos 30
lignes existantes, câblées aux SVG et à tous les FK de l'app, restent la
source de vérité), seulement `entity_mappings`.

**Avant de coder l'attache match→série**, flagué et tranché AVEC
l'utilisateur : le flux PENDING de 0.2.8 §5 ne peut pas s'appliquer
littéralement (`entity_mappings.internal_id` est `NOT NULL` — un match
jamais vu n'a aucune ligne interne à pointer), et aucun écran de revue de
mapping n'a jamais été spécifié (A7 concerne le pré-remplissage à la
CRÉATION d'une compétition, pas l'attache des matchs individuels
ensuite). L'attache est en réalité déterministe (le bracket est déjà
entièrement construit par l'admin, `team1_id`/`team2_id` toujours connus
avant qu'un match soit joué — une paire d'équipes ne peut être active que
dans UNE série à la fois). Le cas résiduel (0 ou 2+ séries candidates, ne
devrait structurellement jamais arriver) est ignoré + journalisé dans
`sync_logs`, **volontairement passif** (pas de badge d'alerte — confirmé
explicitement avec l'utilisateur) ; rattrapage via le bouton « Ajouter un
match » déjà existant.

**Code** : `lib/nba/client.ts` (C-1, `getTeams`/`getMatchesByDate`/
`sumQuarters`/`normalizeMatchStatus` — ce dernier ne repose que sur
"Finished" comme statut réellement confirmé, les autres sont des
hypothèses de vocabulaire, marquées `recognized:false` si non reconnues) ;
`lib/nba/teamAliases.ts` ; `lib/dates/newyork.ts` (même patron que
`lib/dates/paris.ts`, jour calendaire America/New_York via
`Intl.DateTimeFormat("en-CA", ...)`, nécessaire car `schedule.ts`/
`results.ts` calculaient d'abord la date du jour en UTC — corrigé avant
tout bug réel) ; `lib/sync/{teams,schedule,results,auth,logging,
devDateOverride}.ts` ; `app/api/sync/{teams,schedule,results}/route.ts` +
`app/api/heartbeat/route.ts` (Bearer `SYNC_SECRET`, `sync_logs`, runtime
Node). `results.ts` réutilise le patron déjà établi par
`admin-results.ts::saveMatchResult` : update `matches` → `recomputeMatch`
→ `advanceWinnerIfDecided` (T5 inchangé). Aucune migration (T4 n'en
produit pas, schéma déjà posé par la migration #1).

Vérifié : `tsc --noEmit`, `eslint`, `next build` (4 routes, aucun
conflit), `vitest run` (26/26, aucune régression).

**Test en conditions réelles (dry-run complet)** : la compétition de test
précédente (« TEST playoff 28/07/2026 », ATL-BOS, testée par l'utilisateur
au lot compétitions) a été clôturée POUR DE VRAI (script service_role
reproduisant exactement `closeCompetition()` — même `assignRanks`, même
snapshot `competition_archives` — décidé avec l'utilisateur en l'absence
de session navigateur disponible pour Claude) pour libérer le slot
`uniq_one_active_competition`. Une nouvelle compétition PLAYOFFS créée
(« TEST T4 sync — Playoffs 2026 (réel) ») avec les 8 VRAIES affiches du
1er tour des Playoffs NBA 2026 (Est : NYK-ATL, CLE-TOR, BOS-PHI, DET-ORL ;
Ouest : LAL-HOU, DEN-MIN, OKC-PHX, SAS-POR), trouvées via 2 appels réels
à l'API (dates 2026-04-18/19). Serveur `next start` lancé localement,
routes appelées avec le Bearer `SYNC_SECRET` réel :
- `/api/sync/teams` : 30/30 équipes mappées.
- `/api/sync/schedule?date=2026-04-18` (horizon 4 jours) : **14 matchs
  créés automatiquement** (8 Game 1 + 6 Game 2 tombant dans la fenêtre),
  attachés à la bonne série par la recherche déterministe — 0 ignoré.
- `/api/sync/results` sur les 4 dates concernées : **14/14 scores réels
  synchronisés** (ex. NYK 113-102 ATL, score exact), séries passées à
  `IN_PROGRESS` via `recomputeMatch` (moteur T5 non modifié).
- **Idempotence vérifiée** : rejouer les deux jobs → 0 création/changement
  en trop (juste des mises à jour/inchangés).
- **Cas ignoré passif vérifié en vrai** : un appel hors fenêtre a
  rencontré 2 vrais matchs sans rapport → ignorés proprement, tracés dans
  `sync_logs`, rien cassé.
- Garde d'auth : 401 sans secret / avec mauvais secret, confirmé.
  `/api/heartbeat` : `{"ok":true}`, ping DB, 0 requête API.
- Quota API consommé pendant toute la session (repérage + implémentation
  + dry-run) : environ 20 requêtes sur 100/jour.

Serveur de test arrêté, scripts jetables de mise en place (clôture,
création de la compétition de dry-run, inspection) écrits UNIQUEMENT dans
le scratchpad de session, jamais committés au dépôt.

**Décidé avec l'utilisateur** : la compétition de dry-run reste ACTIVE
(pas archivée) pour qu'il aille la consulter lui-même dans son navigateur
avant qu'on décide de la clôturer. Un appel `schedule` de plus (ancré
2026-04-22) a découvert 12 matchs réels non résolus (Game 2/3/4 de 6
séries) — décalés artificiellement vers "maintenant + 3 jours" (statut
repassé `SCHEDULED`) pour apparaître comme pronostiquables dans Jouer >
Matchs, sans consommer le quota d'une simulation complète (~120-150
requêtes pour tout le tournoi, hors budget). Serveur de test laissé actif
sur le port 3100 pour consultation navigateur.

**2 points trouvés par l'utilisateur en testant la saisie d'un pari sur
cette compétition, TOUS DEUX CORRIGÉS** (détail complet
`JOURNAL_SESSIONS.md`) : `assertNotOwnBet()` bloque désormais un admin qui
tenterait de valider/rejeter son PROPRE pari
(`lib/actions/admin-validation.ts`, par symétrie avec la règle déjà actée
pour les requêtes de correction 0.2.3) ; `<InlineBetForm>` est désormais
rendu même une fois le prono validé (`PredictionForm.tsx`) — plus besoin
de repasser par l'onglet Paris dédié.

**Compétition de dry-run ARCHIVÉE** (script service_role reproduisant
`closeCompetition()`, avec cette fois un vrai snapshot
`competition_archives` — l'activité de test sur les paris avait généré
des scores). Serveur de test arrêté. **Aucune compétition active
actuellement.**

**Suivi mis à jour en miroir** : `SPEC_TECHNIQUE_SYNCHRO_V0.1.md` (4
amendements post-validation §3/§4/§5.2/§6/§12) ; `JOURNAL_SESSIONS.md` ;
les 2 gaps retirés de `GAPS_OUVERTS.md` (résolus).

**Commit `3f228d5` (T4) fait, PAS poussé. Les 2 correctifs de gaps PAS
encore committés à ce stade.**
```
