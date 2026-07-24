# NBA Pronos — État actuel (V1)

> **Nature** : instantané de l'état RÉEL au moment de la dernière session — réécrit
> entièrement à chaque fois, jamais complété. Pour l'historique, voir
> `JOURNAL_SESSIONS.md`. Pour les points en suspens, voir `GAPS_OUVERTS.md`.
> Ne contient pas les règles fonctionnelles (synthèse + `decisions_0.2.x`).
>
> Dernière mise à jour : session du 24/07/2026. Suite directe du lot du
> 23/07/2026 (seed de test, correctif RLS Classement, écran Matchs) : deux
> petits compléments demandés en testant l'appli réelle — les logos de
> franchise (déjà déposés par l'utilisateur, jamais câblés par aucun écran)
> affichés sur Bracket et Matchs, et un bouton de déconnexion TEMPORAIRE (§2.9)
> en attendant l'écran Profil.

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
              Classement, Bracket, Matchs) via getServerClient() — JAMAIS
              service_role. Deux vues (`user_scores`/`user_recent_form`) et
              une fonction (`count_committed_predictions`) sont volontairement
              en dehors du régime « invoker » (§2.7/§2.8) : elles n'exposent
              QUE des agrégats (points, compteurs), jamais une ligne
              individuelle — la confidentialité par match/pari/pick, elle,
              reste entièrement portée par la RLS des tables sources,
              inchangée.
Styles      : CSS Modules colocalisés par composant (`*.module.css`), lisant
              exclusivement les tokens sémantiques de `app/tokens.css` (aucune
              valeur en dur) — convention posée par l'écran Accueil,
              reconduite sur Classement/Bracket puis Matchs. Tailwind
              (présent au projet) reste utilisé tel quel pour les écrans PAS
              ENCORE stylés selon T7 (login/signup, non retouchés).
```

## 2. Avancement

```text
Phase V1 — la série de specs techniques T1 → T7 est VALIDÉE. Le socle de
données (modèle + auth + RLS) est posé et codé (§3). CODÉS ET VÉRIFIÉS avec
un vrai jeu de données : Accueil, Classement, Bracket, et désormais Matchs
(§2.8) — les quatre premiers écrans du hub joueur, logos de franchise câblés
sur Bracket/Matchs (§2.9). Restent à coder : « Mes pronos », Paris, Bracket
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
Bracket, Matchs compris) — le seed et les scripts de vérification jetables
utilisent les mêmes paquets, rien de plus.

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
  (Accueil, Classement, Bracket, Matchs).
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
  existe.

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

### 2.9 Compléments post-test utilisateur (session du 24/07/2026, nouveau)

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

### 2.10 Prochaine étape

```text
Dans l'ordre déjà acté : « Mes pronos » (ancré sur les MATCHS, pas sur les
pronos — contrainte transmise §17/§18.2 de la spec Matchs ; porte le live,
badge EN DIRECT + souscription Realtime `matches`, absent de l'écran
Matchs) ; puis Paris (fixera la destination du raccourci, §18.3) ; puis
Bracket personnel. Même conventions reconduites (composants serveur par
défaut, CSS Modules + tokens, RLS/fonctions dédiées comme seule autorité de
lecture). Puis les écrans admin, puis T8 (déploiement — §6 à faire avant,
dont l'effacement du jeu de données de test ET le retrait du bouton de
déconnexion temporaire §2.9).
```

## 3. État actuel de la base de données

```text
6 migrations appliquées (supabase/migrations/, via `npx supabase db push`,
chacune montrée intégralement et confirmée par l'utilisateur avant
application) — inchangé depuis le 23/07/2026, aucune migration dans le lot
du 24/07 (logos + déconnexion temporaire, §2.9, purement applicatif) :

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

RLS vérifiée de bout en bout via le plan de test T3 §7, puis re-testée avec
un vrai jeu de données (§2.6) — un piège trouvé à cette occasion (§7).
Consommée directement (sans service_role) par tous les écrans joueur via
getServerClient().

Données : compétition Playoffs de TEST active (§2.6) — 30 équipes, 15
séries, 9 matchs, 7 comptes. JETABLE, pas une vraie compétition — à
distinguer et à effacer avant tout lancement réel (§6).

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
      page.tsx         — stub « à venir », PAS stylé (hub, pas un écran).
      matches/
        page.tsx + page.module.css — écran Matchs. CODÉ (§2.8).
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
  hooks/
    useUnsavedGuard.tsx (+ .module.css) — Garde C2 TRANSVERSE :
      UnsavedGuardProvider, useUnsavedGuard(key), useGuardedNavigation().
      CODÉ §2.8.
  queries/
    home.ts        — getHomeData(). CODÉ.
    leaderboard.ts — getLeaderboard(). CODÉ §2.5, MODIFIÉ §2.7 (lit
      admin_corrections_count depuis user_scores, 2 requêtes en moins).
    bracket.ts     — getBracket(). CODÉ.
    matches.ts     — getMatches() + types figés MatchCard/MatchDay/
      MatchesData/TeamRef/OtherPrediction/BetSlotIndicator/
      PredictionViewStatus (spec §13, recopiés à l'identique). CODÉ §2.8.
  scoring/, sync/ — PAS ENCORE CRÉÉS.

components/
  auth/{LoginForm,SignupForm}.tsx — pas encore stylés selon T7.
  icons/nav-icons.tsx — 4 icônes de nav.
  ui/
    Countdown.tsx (+ .module.css) — partagé Accueil + Bracket.
    TeamLogo.tsx (+ .module.css) — NOUVEAU (§2.9). Logo déduit de
      l'abréviation, repli texte via onError. Partagé Bracket + Matchs.
  nav/
    TabBar.tsx + .module.css — onNavigate (useGuardedNavigation) sur les 4
      onglets, inerte par défaut. CODÉ §2.8.
    PublicNav.tsx / ScreenShell.tsx (+ .module.css chacun) — inchangés.
  home/ — inchangé depuis §2.4 (EmptyState réutilisé par Classement,
    Bracket ET Matchs). Pas de logo ici (§2.9, GAPS_OUVERTS.md).
  leaderboard/ — inchangé depuis §2.5. Pas de logo ici (aucune équipe affichée).
  bracket/ — NodeCard.tsx affiche désormais TeamLogo (§2.9).
  matches/ — 8 fichiers + leurs .module.css :
    MatchDayGroup.tsx        — serveur, regroupement par jour.
    MatchRow.tsx              — "use client" (1/3) : ouverture de la ligne,
      repère de verrouillage + décompte animé, logos §2.9.
    PredictionForm.tsx        — "use client" (2/3) : saisie, drapeau C2,
      2 CTA, dialogue de validation (distinct du dialogue C2).
    TeamPicker.tsx             — sans "use client", tap direct sur l'équipe,
      logos §2.9.
    MarginStepper.tsx          — sans "use client" (porte son propre
      useState local — permis, transitivement bundlé client).
    RevealPanel.tsx            — sans "use client" : compteur X/N toujours
      affiché, contenu seulement si isRevealed.
    BetShortcut.tsx            — sans "use client", raccourci pari.
    ValidateAllBanner.tsx      — "use client" (3/3) : bandeau + confirmation
      « Tout valider », état local (pas remonté à la page serveur).

public/
  logos/teams/ — 30 SVG (+ 30 PNG), déposés et committés depuis le
    21/07/2026, câblés depuis le 24/07/2026 (§2.9). brand/ : convention
    posée, hero-parquet.webp toujours pas déposé.

scripts/
  seed-playoffs-test-data.mjs — Script de seed, HORS migrations, usage :
    `node --env-file=.env.local scripts/seed-playoffs-test-data.mjs`. Non
    idempotent, pas de script de nettoyage écrit à ce jour.

Cadrage/
  V1/     — specs techniques V1 validées (T1→T7) + Spec visuelle/
            SPEC_ECRAN_ACCUEIL, SPEC_ECRAN_CLASSEMENT_BRACKET,
            SPEC_ECRAN_MATCHS (close, §2.8). SPEC_TECHNIQUE_RLS_V0.1.md
            complétée §11 (correctif §2.7).
  Proto/  — fichiers de suivi (ce fichier, JOURNAL_SESSIONS.md,
            GAPS_OUVERTS.md) + cadrage fonctionnel hérité du prototype.
  OLD/    — cadrage antérieur, non consulté activement.

supabase/
  migrations/  — 6 migrations versionnées, voir §3.
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
  pour un lot « petit » (§2.9) : la mise à jour de GAPS_OUVERTS.md seul,
  sans toucher à celui-ci ni au journal, a été un oubli réel cette session,
  corrigé seulement quand l'utilisateur a demandé de vérifier.
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
- Un changement volontairement TEMPORAIRE (§2.9, bouton de déconnexion) doit
  être marqué comme tel dans le CODE (commentaire), dans le RENDU (libellé
  visible « temporaire », style volontairement pas fini) ET dans le SUIVI
  (`GAPS_OUVERTS.md`) — les trois, pas seulement un des trois.
```

## 6. Config à faire au déploiement — pas encore faite

```text
- Dashboard Supabase : désactiver « Confirm email » (accès immédiat au
  compte après inscription, C4 — rappel laissé dans la migration #2).
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
- Activer la publication Realtime côté base sur matches ET series (T4 §9,
  resserré par T6c §14.2) — nécessaire pour « Mes pronos » (§2.10), pas pour
  Matchs (aucun live ici, §2.8/§18.2 de sa spec).
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

Pièges génériques du prototype (Postgres/Git/PowerShell, toujours valables en
principe) non recopiés ici pour éviter la duplication — voir l'historique du
dépôt `nba-pronos-proto` s'ils resurgissent en V1.
```
