# NBA Pronos — État actuel (V1)

> **Nature** : instantané de l'état RÉEL au moment de la dernière session — réécrit
> entièrement à chaque fois, jamais complété. Pour l'historique, voir
> `JOURNAL_SESSIONS.md`. Pour les points en suspens, voir `GAPS_OUVERTS.md`.
> Ne contient pas les règles fonctionnelles (synthèse + `decisions_0.2.x`).
>
> Dernière mise à jour : session du 27/07/2026 (suite — écran Bracket
> personnel codé et testé, §2.16, spec rédigée et close en séance), après le
> bandeau sticky + saisie inline dans Matchs (§2.15 suite), l'écran Nouveau
> pari codé et testé le 26/07/2026 (SPEC_ECRAN_NOUVEAU_PARI_V0_1.md, CLOSE,
> §2.15), lui-même après le commit/push du lot logos + amendements de specs
> (25/07/2026, §2.14), la refonte de l'entête Matchs + correctif des 30 logos
> (§2.13), le correctif de pastille (§2.12) et le lot « Mes pronos »
> (24/07/2026, SPEC_ECRAN_MES_PRONOS_V0_1.md, CLOSE, §2.11).

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
un vrai jeu de données : Accueil, Classement, Bracket (vue globale), Matchs
(§2.8), « Mes pronos » (§2.11), « Nouveau pari » (§2.15) et désormais
**Bracket personnel** (remplissage, §2.16) — les sept premiers écrans du hub
joueur, logos de franchise câblés sur Bracket/Matchs/Mes pronos/Bracket
personnel (§2.9/§2.11/§2.16). Le hub Jouer TEMPORAIRE (§2.10) relie
désormais l'onglet « Jouer » aux QUATRE écrans du hub joueur (Matchs, Mes
pronos, Paris, Mon bracket) — plus aucune entrée inerte — en attendant le
vrai hub, dont la spec d'écran reste à écrire. Reste à coder : « Mes paris »
(consultation/quotas globaux, hors périmètre du lot Nouveau pari, spec
distincte à écrire), puis les écrans admin.
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

### 2.17 Prochaine étape

```text
Dans l'ordre à confirmer avec l'utilisateur : « Mes paris » (consultation/
quotas globaux — hors périmètre du lot Nouveau pari §2.15, spec distincte à
écrire) ; ou les écrans admin. Bracket personnel (§2.16) est désormais CODÉ,
retiré de cette liste. Publication Realtime de `series` (T4 §9) : reste
REPORTÉE (§2.16) faute de besoin live identifié sur un écran codé à ce jour
— à réévaluer si un futur écran (drill-down live, résumé) en a explicitement
besoin. Même conventions reconduites (composants serveur par défaut, CSS
Modules + tokens, RLS/fonctions dédiées comme seule autorité de lecture ;
vérifier D'ABORD si la RLS existante suffit avant d'ajouter une fonction
SECURITY DEFINER, §2.15 vs §2.16 — les deux lots n'avaient PAS le même
besoin). Le vrai hub Jouer (§2.10) reste, lui, à SPÉCIFIER (spec d'écran
dédiée) avant d'être codé — aucune date arrêtée. Puis T8 (déploiement — §6 à
faire avant, dont l'effacement du jeu de données de test, le retrait du
bouton de déconnexion temporaire §2.9, ET le retrait du hub Jouer temporaire
§2.10).
```

## 3. État actuel de la base de données

```text
10 migrations appliquées (supabase/migrations/, via `npx supabase db push`,
chacune montrée intégralement et confirmée par l'utilisateur avant
application) — les 6 premières inchangées depuis le 23/07/2026 (les lots
logos/déconnexion/hub temporaire du 24/07, §2.9/§2.10, étaient purement
applicatifs) ; #7 et #8 ajoutées par le lot « Mes pronos » (§2.11) ; #9 et
#10 ajoutées par le lot « Nouveau pari » (§2.15, poussées par l'utilisateur
lui-même — `db push` bloqué pour Claude par le classificateur de permissions
de l'environnement) :

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

**Toujours 10 migrations après le lot Bracket personnel (§2.16)** : la RLS
`brackets_insert/update`/`bracket_picks_insert/update` (migration #3)
couvrait déjà tout le nécessaire pour ce lot — aucune migration ajoutée,
contrairement aux deux lots précédents.

RLS vérifiée de bout en bout via le plan de test T3 §7, puis re-testée avec
un vrai jeu de données (§2.6) — un piège trouvé à cette occasion (§7).
Consommée directement (sans service_role) par tous les écrans joueur via
getServerClient(). Les fonctions #7 et #10 sont les seules à opérer en
SECURITY DEFINER (contournent une policy/la RLS) — chacune justifiée en
commentaire dans son fichier de migration et testée en conditions réelles
(§2.11/§2.15). #9 modifie seulement la whitelist du trigger existant
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

Pièges génériques du prototype (Postgres/Git/PowerShell, toujours valables en
principe) non recopiés ici pour éviter la duplication — voir l'historique du
dépôt `nba-pronos-proto` s'ils resurgissent en V1.
```
