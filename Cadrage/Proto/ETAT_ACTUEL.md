# NBA Pronos — État actuel (V1)

> **Nature** : instantané de l'état RÉEL au moment de la dernière session — réécrit
> entièrement à chaque fois, jamais complété. Pour l'historique, voir
> `JOURNAL_SESSIONS.md`. Pour les points en suspens, voir `GAPS_OUVERTS.md`.
> Ne contient pas les règles fonctionnelles (synthèse + `decisions_0.2.x`).
>
> Dernière mise à jour : session du 25/07/2026 (suite — refonte de l'entête
> replié de l'écran Matchs + correctif des 30 logos de franchise, §2.13),
> après le correctif de pastille de logo (§2.12) et le lot « Mes pronos »
> (24/07/2026, SPEC_ECRAN_MES_PRONOS_V0_1.md, désormais CLOSE, §2.11).

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
un vrai jeu de données : Accueil, Classement, Bracket, Matchs (§2.8) et
désormais « Mes pronos » (§2.11) — les cinq premiers écrans du hub joueur,
logos de franchise câblés sur Bracket/Matchs/Mes pronos (§2.9/§2.11). Un hub
Jouer TEMPORAIRE (§2.10) relie l'onglet « Jouer » à Matchs ET Mes pronos
désormais — en attendant le vrai hub, dont la spec d'écran reste à écrire.
Restent à coder : Paris (fixera la destination du raccourci pari), Bracket
personnel (mêmes conventions, un écran à la fois), puis les écrans admin.
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
seuls assets modifiés). Rien committé à ce stade — à committer par
l'utilisateur ou sur sa demande explicite.
```

### 2.14 Prochaine étape

```text
Dans l'ordre déjà acté : Paris (fixera la destination du raccourci pari,
§18.3 de la spec Matchs) ; puis Bracket personnel (activera la publication
Realtime de `series`, reportée depuis §2.11). Même conventions reconduites
(composants serveur par défaut, CSS Modules + tokens, RLS/fonctions dédiées
comme seule autorité de lecture). Le vrai hub Jouer (§2.10) reste, lui, à
SPÉCIFIER (spec d'écran dédiée) avant d'être codé — aucune date arrêtée.
Puis les écrans admin, puis T8 (déploiement — §6 à faire avant, dont
l'effacement du jeu de données de test, le retrait du bouton de déconnexion
temporaire §2.9, ET le retrait du hub Jouer temporaire §2.10).
```

## 3. État actuel de la base de données

```text
8 migrations appliquées (supabase/migrations/, via `npx supabase db push`,
chacune montrée intégralement et confirmée par l'utilisateur avant
application) — les 6 premières inchangées depuis le 23/07/2026 (les lots
logos/déconnexion/hub temporaire du 24/07, §2.9/§2.10, étaient purement
applicatifs) ; #7 et #8 ajoutées par le lot « Mes pronos » (§2.11) :

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
   étendue à `matches` UNIQUEMENT (§2.11) ; `series` reste à activer au lot
   Bracket personnel.

RLS vérifiée de bout en bout via le plan de test T3 §7, puis re-testée avec
un vrai jeu de données (§2.6) — un piège trouvé à cette occasion (§7).
Consommée directement (sans service_role) par tous les écrans joueur via
getServerClient(). La fonction #7 est la seule à contourner une policy
(mp_insert) — justifiée en commentaire dans son fichier de migration et
testée en conditions réelles (§2.11).

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
        voir GAPS_OUVERTS.md) : liste 4 entrées, « Matchs » ET « Mes pronos »
        en <Link> actifs (§2.11), les 2 autres inertes (« à venir »). PAS
        l'écran hub définitif (spec dédiée à écrire).
      matches/
        page.tsx + page.module.css — écran Matchs. CODÉ (§2.8).
      my-predictions/
        page.tsx + page.module.css — écran Mes pronos. CODÉ (§2.11).
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
  hooks/
    useUnsavedGuard.tsx (+ .module.css) — Garde C2 TRANSVERSE :
      UnsavedGuardProvider, useUnsavedGuard(key), useGuardedNavigation().
      CODÉ §2.8. Non étendu par Mes pronos (aucune saisie de prono à
      protéger sur cet écran, §17 de sa spec).
  labels/
    rounds.ts — ROUND_LABELS, PARTAGÉ Bracket + Mes pronos (§16.5). NOUVEAU
      §2.11, extrait de lib/queries/bracket.ts qui le portait en dur.
  queries/
    home.ts        — getHomeData(). CODÉ.
    leaderboard.ts — getLeaderboard(). CODÉ §2.5, MODIFIÉ §2.7 (lit
      admin_corrections_count depuis user_scores, 2 requêtes en moins).
    bracket.ts     — getBracket(). CODÉ, MODIFIÉ §2.11 (importe ROUND_LABELS
      depuis lib/labels/rounds.ts au lieu de le porter en dur).
    matches.ts     — getMatches() + types figés MatchCard/MatchDay/
      MatchesData/TeamRef/OtherPrediction/BetSlotIndicator/
      PredictionViewStatus (spec §13, recopiés à l'identique). CODÉ §2.8.
    my-predictions.ts — getMyPredictions() + types figés MyPredictionsMode/
      MatchLiveState/MyPredictionState/AdminCorrection/MyPrediction/
      RevealedPrediction/CorrectionRequestState/AssociatedBet/
      MyPredictionRow/SeriesBetHeader/MyPredictionsData (spec §13, recopiés
      à l'identique ; TeamRef réimporté depuis matches.ts, jamais redéfini).
      Dérivation d'état PAR COMPLÉTUDE uniquement (§10.4), y compris pour le
      4e cas DRAFT-complet tranché avec l'utilisateur (§2.11). CODÉ §2.11.
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
  bracket/ — NodeCard.tsx affiche désormais TeamLogo (§2.9).
  matches/ — 8 fichiers + leurs .module.css :
    MatchDayGroup.tsx        — serveur, regroupement par jour.
    MatchRow.tsx              — "use client" (1/3) : ouverture de la ligne,
      repère de verrouillage + décompte animé. Entête replié refondu §2.13
      (variante « split neutre » : grosses abréviations + séparateur, plus
      de logos ici — TeamLogo retiré de ce fichier, recentré sur la carte
      dépliée uniquement).
    PredictionForm.tsx        — "use client" (2/3) : saisie, drapeau C2,
      2 CTA, dialogue de validation (distinct du dialogue C2).
    TeamPicker.tsx             — sans "use client", tap direct sur l'équipe,
      logo agrandi à 48px §2.13 (abréviation retirée de cette carte, ne reste
      que logo + nom complet — l'abréviation vit désormais dans l'entête
      replié de MatchRow).
    MarginStepper.tsx          — sans "use client" (porte son propre
      useState local — permis, transitivement bundlé client).
    RevealPanel.tsx            — sans "use client" : compteur X/N toujours
      affiché, contenu seulement si isRevealed.
    BetShortcut.tsx            — sans "use client", raccourci pari, pointe
      toujours vers /play (§2.8/§18.3), désormais le hub temporaire §2.10.
    ValidateAllBanner.tsx      — "use client" (3/3) : bandeau + confirmation
      « Tout valider », état local (pas remonté à la page serveur).
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
            SPEC_ECRAN_ACCUEIL, SPEC_ECRAN_CLASSEMENT_BRACKET,
            SPEC_ECRAN_MATCHS (close, §2.8), SPEC_ECRAN_MES_PRONOS (close,
            §2.11). SPEC_TECHNIQUE_RLS_V0.1.md complétée §11 (correctif
            §2.7). Aucune spec pour le hub Jouer définitif à ce jour (§2.10)
            — à écrire avant de le coder.
  Proto/  — fichiers de suivi (ce fichier, JOURNAL_SESSIONS.md,
            GAPS_OUVERTS.md) + cadrage fonctionnel hérité du prototype.
  OLD/    — cadrage antérieur, non consulté activement.

supabase/
  migrations/  — 8 migrations versionnées, voir §3.
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

## 6. Config à faire au déploiement — pas encore faite

```text
- Dashboard Supabase : désactiver « Confirm email » (accès immédiat au
  compte après inscription, C4 — rappel laissé dans la migration #2).
  DEVENU CONCRET le 24/07/2026 (§2.11) : le vrai flux /signup, testé pour la
  première fois de bout en bout, échoue avec « 429 — email rate limit
  exceeded » tant que ce réglage n'est pas désactivé (chaque inscription
  réelle tente d'envoyer un email de confirmation). Les comptes de seed y
  échappent (créés via l'API Admin, email_confirm:true, aucun email envoyé)
  — ce n'est donc apparu qu'en testant la vraie inscription publique.
- Écrire la migration de seed du 1er admin RÉEL (A4), une fois le 1er
  pseudo réel connu — DISTINCT du compte Sofia_Admin du jeu de test (§2.6),
  qui n'est qu'un admin de test jetable.
- EFFACER le jeu de données de test (§2.6) avant tout lancement réel :
  compétition « Playoffs NBA (test) » + ses séries/matchs/pronos/paris (DELETE
  SQL, en respectant l'ordre des FK composites — séries du 1er tour avant les
  tours suivants), et les 7 comptes seed-*@nba-pronos.test via
  auth.admin.deleteUser (jamais un DELETE direct sur auth.users). Aucun
  script de nettoyage écrit à ce jour.
- RETIRER le bouton de déconnexion temporaire (§2.9) dès que l'écran Profil
  porte cette action pour de bon.
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

Pièges génériques du prototype (Postgres/Git/PowerShell, toujours valables en
principe) non recopiés ici pour éviter la duplication — voir l'historique du
dépôt `nba-pronos-proto` s'ils resurgissent en V1.
```
