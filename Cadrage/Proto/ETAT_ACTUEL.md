# NBA Pronos — État actuel du prototype

> **Nature** : instantané de l'état RÉEL au moment de la dernière session — réécrit
> entièrement à chaque fois, jamais complété. Pour l'historique, voir
> `JOURNAL_SESSIONS.md`. Pour les points en suspens, voir `GAPS_OUVERTS.md`.
> Ne contient pas les règles fonctionnelles (synthèse + `decisions_0.2.x`).
>
> Dernière mise à jour : session du 17/07/2026 (4e de la journée — spec
> technique maître V0.1 produite et validée + 6 décisions actées). Chantier
> multi-compétitions + NBA Cup TERMINÉ et vérifié de bout en bout (voir §7) —
> aucun code touché depuis, cette mise à jour ne concerne que §2 (avancement /
> prochaines étapes).

---

## 1. Contexte technique

```text
Stack   : Next.js 16.2.10 (Turbopack, App Router, TypeScript) + Supabase (Postgres).
Sans src/ : racine du projet utilisée directement (app/, lib/, sql/).
RLS     : volontairement absente (phase prototype, 0.2.10).
Auth    : aucune. Un seul compte HUMAIN (is_primary_human = true dans `users`,
          pseudo "Mathieu") incarne le joueur sur tous les écrans "Mes ...".
          15 bots scriptés (bot_profile non nul) + 1 compte `Admin_Test`
          (role=ADMIN, is_primary_human=false, bot_profile=null) qui existe
          UNIQUEMENT pour traiter les requêtes de correction du compte humain
          (règle : un admin ne traite jamais sa propre requête — il fallait un
          2e admin pour pouvoir tester ce flux).
Dossier local : nba-pronos-proto, Windows, PowerShell.
Dépôt Git     : https://github.com/lenoirmath122-dev/nba-pronos-proto (privé, branche main).
```

## 2. Avancement

```text
La roadmap initiale du prototype (0.2.10) est TERMINÉE — les 7 étapes prévues sont
faites et vérifiées de bout en bout sur au moins une saison complète simulée :
bots + paris (cascade bracket, deadlines, quotas), montée en charge à 17 joueurs,
classement (tri 6 colonnes), tendances bracket public, visibilité des paris
publics, et enfin les requêtes de correction.

Chantier multi-compétitions + historique + mécanique NBA Cup (démarré le
16/07/2026) TERMINÉ le 17/07/2026 — plan technique intégralement implémenté
ET vérifié par un test de bout en bout réel (clôture → création PLAYOFFS →
régression → clôture → création NBA_CUP → régression → clôture → /profil),
voir §7. Plan de référence :
`Cadrage/nba_pronos_plan_technique_multi_competitions_nba_cup.md`.

État des lieux PRÉ-SPEC-TECHNIQUE terminé le 17/07/2026 (session
exclusivement décisionnelle/doc, aucun code touché) : brainstorm de
nouvelles fonctionnalités V1 (voir `BACKLOG_V1.md`) et revue point par point
de tous les points ouverts déjà recensés — 9 points renvoyés à la spec
technique + 9 points non bloquants (`nba_pronos_SPEC_FONCTIONNELLE_V0_2.md`
§14.1/§14.2), 5 points reportés en V1 (anciennement dans
`GAPS_OUVERTS.md`) — tous tranchés sauf les RLS (laissées explicitement
entières à ce stade). Réponses consignées dans
`nba_pronos_PREP_SPEC_TECHNIQUE_V1.md`. Détail complet de la session :
`JOURNAL_SESSIONS.md`.

Test technique de l'API NBA Highlightly mené le 17/07/2026 (session
suivante, exclusivement décisionnelle/API — aucun code applicatif touché) :
CONFIRMÉ et retenu comme fournisseur unique pour la V1 (statuts, couverture
NBA Cup, logos, rate limit tous validés en conditions réelles sur la
finale NBA Cup 2025 réelle). Deux découvertes techniques à respecter dans
la future synchro (`timezone=America/New_York` obligatoire sur les appels
datés ; score renvoyé en tableau par quart-temps, à sommer) — détail complet
dans `nba_pronos_PREP_SPEC_TECHNIQUE_V1.md` bloc A6. B4 (logos) mis à jour
en conséquence : disponibilité confirmée nativement via l'API, sourcing
manuel séparé probablement plus nécessaire.

Session suivante du 17/07/2026 (3e de la journée, exclusivement
décisionnelle/doc, aucun code touché) : préparatoire à la rédaction de la
spec technique V1 elle-même, 3 décisions actées avec l'utilisateur.

1. Découpage du livrable technique acté (conforme méthodo §7, pas de pavé
   unique) : `SPEC_TECHNIQUE_V0.1.md` sera un document maître COURT
   (principes transverses, carte des fichiers, contrats entre modules, ordre
   de construction), qui pointera vers des fichiers thématiques séparés —
   dont `SPEC_TECHNIQUE_RLS_V0.1.md`.

2. RLS — les 4 arbitrages FONDATEURS sont désormais tranchés (le point était
   jusqu'ici entièrement ouvert, cf. `nba_pronos_PREP_SPEC_TECHNIQUE_V1.md`
   bloc C5) : (A) toutes les lectures passent par la session utilisateur (clé
   anon + JWT, RLS réellement appliquée), `service_role` réservé aux routes
   de synchro et au seed — cohérent avec le bloc A9 (Realtime souscrit en clé
   anon) ; (B) la règle temporelle « public seulement après deadline/
   verrouillage » vit dans les policies SQL (`now()` comparé à l'heure du
   match / `bracket_deadline`), pas dans le code applicatif ; (C) détection
   admin dans les policies via une fonction `is_admin()` SECURITY DEFINER
   STABLE lisant `users.role` (pas de claim JWT), pour éviter la récursion de
   policy sur `users` et permettre une promotion effective sans re-login ;
   (D) le profil `users` reprend l'id de `auth.users` comme PK → policies en
   `user_id = auth.uid()` sans jointure, `is_primary_human` disparaît en V1
   (artefact prototype). Les policies elles-mêmes restent ENTIÈREMENT à
   écrire — voir `GAPS_OUVERTS.md`, le point reste ouvert jusqu'à validation
   de la spec.

3. Identité graphique : direction déjà close (0.2.9 §2), il ne manque que les
   design tokens (palette, typo, espacements, composants). Décidé de traiter
   ce point dans une session dédiée, JUSTE AVANT le 1er écran joueur (donc
   après auth + schéma + RLS), livrable `SPEC_DESIGN_SYSTEM_V0.1.md`. Seule
   conséquence sur le modèle de données à ce stade : `users` a besoin d'une
   colonne de préférence de thème (bascule clair/sombre, 0.2.9 §2) — à
   intégrer à la spec technique V0.1.

Plus AUCUN point bloquant avant d'écrire la spec technique proprement dite.
Prochaine étape : rédaction de `SPEC_TECHNIQUE_V0.1.md` (document maître
court + premiers fichiers thématiques, dont `SPEC_TECHNIQUE_RLS_V0.1.md`).

Session suivante du 17/07/2026 (4e de la journée, exclusivement
décisionnelle/doc, aucun code touché) : rédaction et validation de
`SPEC_TECHNIQUE_V0.1.md`, le document maître de la spec technique V1 (court :
principes transverses P1-P15, carte des 8 fichiers thématiques T1-T8,
contrats entre modules C-1 à C-6, ordre de construction en 11 étapes). Ne
contient volontairement ni schéma, ni policy, ni route, ni design token —
chacun vit dans son fichier thématique.

Périmètre acté : la spec couvre la V1 COMPLÈTE (Playoffs + NBA Cup) pour le
modèle de données et les RLS, avec un séquencement d'implémentation orienté
NBA Cup (première compétition réellement jouée). Restreindre le modèle au
seul scope Cup n'économisait rien — les deux compétitions partagent les
mêmes tables — et fermait des portes.

6 décisions actées à la validation (détail et motifs :
`SPEC_TECHNIQUE_V0.1.md` §7, D1-D6) : (D1) la V1 est un dépôt NEUF + un
projet Supabase NEUF, le proto reste intact en référence ; (D2) les données
opérationnelles sont CONSERVÉES via `competition_id` — le modèle proto
"wipeOperationalData() à chaque clôture" est abandonné en V1, la clôture
devient une bascule ACTIVE→ARCHIVED + snapshot, sans aucune suppression ;
(D3) le code du proto est REPRIS (avec droit de vérification et de
modification), pas réécrit ; (D4) les vues de classement sont
`security_invoker = true` pour ne jamais contourner la RLS ; (D5)
conséquence de D4 : `public.users` perd sa colonne `email` (doublon
d'`auth.users`, la RLS filtre des lignes et pas des colonnes) ; (D6) la
synchro NBA Cup ne connaît que les 8 qualifiés, aucun match de poule
ingéré — le référentiel des 30 équipes (GET /teams, logos) reste
indépendant.

Prochaine étape : `SPEC_TECHNIQUE_MODELE_DONNEES_V0.1.md` (T1), seul chemin
vers les RLS. Chantiers connus : re-scoping par `competition_id` (D2),
refonte de `users` (PK = id de `auth.users`, suppression d'`email`, ajout de
la préférence de thème), disparition des artefacts proto
(`simulation_state`, `bot_profile`, `is_primary_human`), ajout de
`sync_logs` et des 9 catégories de paris (C3).
```

## 3. État actuel de la base de données

```text
- 17 utilisateurs, inchangé : 1 humain (Mathieu, is_primary_human=true) + 1
  Admin_Test (dormant, corrections uniquement) + 15 bots (2 ALL_ROUNDER,
  3 BETTOR, 4 REGULAR, 2 VISIONARY, 4 CASUAL).
- `competitions` contient 3 lignes, TOUTES ARCHIVED (état de fin de test de
  bout en bout, volontaire) : "Playoffs (legacy)" (l'originale), "Playoffs
  2026" (créée via le nouvel écran, mêmes matchups que l'origine), "NBA Cup
  Test" (créée via le nouvel écran, 4 matchs de quarts). AUCUNE compétition
  ACTIVE actuellement — normal juste après un test, mais signifie que l'app
  n'est pas "jouable" en l'état : les écrans qui lisent la compétition ACTIVE
  (ex. /paris) affichent une erreur de lecture gérée proprement (pas de
  crash, `.single()` sur 0 ligne renvoie une erreur PostgREST attrapée par le
  code, jamais une exception non gérée) plutôt qu'un contenu utile. Prochaine
  session : créer une nouvelle compétition via /admin/competitions/new pour
  reprendre une saison jouable, si besoin.
- `competition_archives` contient 51 lignes (17 joueurs × 3 compétitions
  archivées), classements figés cohérents avec ce qu'affichait /classement
  juste avant chaque clôture (vérifié).
- Tables opérationnelles (series/matches/brackets/bracket_picks/
  match_predictions/bets/correction_requests) : TOUTES VIDES (dernier
  wipeOperationalData() de la clôture NBA Cup Test, rien resemé depuis).
- `simulation_state` : reste sur la seed/curseur de la dernière compétition
  clôturée (NBA Cup Test) — sans effet tant qu'aucune nouvelle compétition
  n'est créée (seedCompetition() la réinitialise systématiquement).
- Schéma (structure) inchangé depuis la resynchronisation du 16/07/2026 :
  `competitions` (name/type/status/archived_at/bracket_deadline), enum
  `playoff_round` à 7 valeurs, `competition_archives`. Voir
  sql/schema_prototype.sql, à jour.
```

## 4. Fichiers du projet — carte rapide

```text
supabase/
  migrations/       — migrations SQL VERSIONNÉES (convention CLI Supabase,
                      fichiers `<timestamp>_nom.sql`), appliquées via
                      `npx supabase db push` (CLI déjà lié + authentifié sur
                      ce poste, cf. supabase/config.toml). Workflow standard
                      pour toute migration désormais (voir §5).
  config.toml       — supabase link, inchangé.

sql/
  schema_prototype.sql   — schéma complet à jour (voir §3). Source de vérité
                            STRUCTURELLE, resynchronisée à la main après
                            chaque migration.
  reset_simulation.sql   — SUPPRIMÉ le 17/07/2026 (superseded par
                            lib/competitionSetup.ts, vérifié fonctionnel de
                            bout en bout — décision actée, pas de filet de
                            secours gardé).

lib/
  supabaseClient.ts, prng.ts, simulationEngine.ts, deadlineValidation.ts,
  bracketCandidates.ts, botConfig.ts, betQuota.ts, betQueries.ts — cœur du
  moteur, agnostique du type de compétition, inchangé depuis la roadmap
  initiale.
  simulationAdvance.ts, scoringEngine.ts, botScripting.ts — lisent
  `competitions` (plus `competition_settings`), barème NBA Cup inclus
  (scoringEngine), seuil de victoire de série piloté par
  bracketRounds.ts::winsNeededForRound() (4 Playoffs / 1 NBA Cup).
  bracketRounds.ts — source unique de vérité sur les tours de bracket
  (labels, ordre, tour racine, groupement conférence, boutons de score,
  seuil de victoire, ROUND_ORDER_BY_TYPE), consommée par tous les
  écrans/lib listés ci-dessus.
  competitionSetup.ts — wipeOperationalData() + seedCompetition() (arbre de
  séries généré génériquement à partir des matchups fournis par l'admin).
  Exercé et vérifié en conditions réelles (test de bout en bout complet,
  voir §7) : arbre Playoffs identique à l'ancien script hardcodé, arbre NBA
  Cup correct (4→2→1, sans conférence).
  leaderboardSort.ts — SortKey/SortDirection/getSortValue/compareScores,
  extrait de app/classement/page.tsx, consommé par /classement,
  /admin/competitions/close et /profil.
  correctionEligibility.ts, correctionQueries.ts — logique des requêtes de
  correction, inchangés.

app/
  admin/                    — dashboard (indicateurs de progression),
                              résolution des paris, admin/corrections/
                              (traitement des requêtes de correction).
  admin/competitions/new/   — création de compétition (sélecteurs manuels
                              d'équipes, 8 pour PLAYOFFS groupés EST/OUEST,
                              4 pour NBA_CUP, rendu conditionnel via
                              ?type=). Vérifié en conditions réelles à 2
                              reprises (1 PLAYOFFS + 1 NBA_CUP créées avec
                              succès).
  admin/competitions/close/ — clôture + archivage (classement figé
                              prévisualisé, confirmation dédiée). Vérifié en
                              conditions réelles à 3 reprises.
  pronos/                   — écran "Mes pronos match" + création de pari
                              MATCH + "Demander une correction". Agnostique
                              série/tour, inchangé.
  bracket/                  — écran "Mon bracket". Tours dynamiques via
                              bracketRounds.ts, boutons de score masqués
                              pour un tour sans série (vérifié sur NBA Cup :
                              3 tours affichés, aucun bouton de score).
  bracket-global/           — écran public. Détection du champion générique
                              (`next_series_id === null`), valable Playoffs
                              et NBA Cup.
  paris-globaux/            — écran public. Bloc "Paris SÉRIE" déjà
                              conditionné sur une liste vide côté requête
                              publique, automatiquement correct pour NBA Cup.
  paris/                    — écran "Mes paris" + BetCorrectionForm.tsx.
                              Garde-fou "pas de pari SÉRIE en NBA Cup" :
                              actions.ts::assertSeriesBetsAllowed() (garde
                              serveur) + page.tsx (masque <SeriesBetForm>).
  classement/                — écran public. Importe lib/leaderboardSort.ts,
                              lien "→ Historique" vers /profil.
  profil/                   — onglet "Historique" : liste des compétitions
                              ARCHIVED (?competition=<id>), classement figé
                              depuis competition_archives. Vérifié : les 3
                              compétitions archivées du test de bout en bout
                              y apparaissent avec des classements cohérents.

Convention d'identification "qui suis-je" : TOUJOURS
  .eq('is_primary_human', true).single() sur `users` — PAS role='ADMIN' (qui
  peut désormais matcher 2 lignes depuis l'ajout d'Admin_Test). Une seule
  exception légitime : lib/correctionQueries.ts::getAllAdmins(), qui liste
  VOLONTAIREMENT tous les admins pour le sélecteur "j'agis en tant que" côté
  admin/corrections.
```

## 5. Conventions de travail — l'essentiel (détail complet dans JOURNAL_SESSIONS.md)

```text
- Utilisateur DÉBUTANT (jamais utilisé Supabase/Next.js/VS Code/Git avant ce
  projet) : chaque action expliquée (quoi/pourquoi/comment), une à la fois,
  confirmation avant de continuer. Commandes Git une par une.
- Toujours DEMANDER le contenu actuel d'un fichier existant avant d'y toucher,
  jamais deviner son style.
- Toute validation serveur doit recalculer ses propres garde-fous depuis la
  base, jamais supposer que l'affichage client correspond aux données
  officielles (leçon née d'un bug bracket, reproduite une 2e fois dans
  botScripting.ts avant d'être générale).
- Avant toute action DESTRUCTIVE sur les données : expliquer précisément ce
  qui sera perdu, obtenir une confirmation EXPLICITE.
- Distinguer "ajouter un tri/filtre sur des données déjà existantes" (pure UI,
  jamais un souci) de "ajouter un nouveau champ à la saisie" (touche
  potentiellement une section validée et close — signaler avant d'implémenter).
- Deux formes de révélation publique à ne pas confondre pour un nouvel écran :
  garde d'accès GLOBALE ET UNIQUE (bracket, une seule deadline) vs révélation
  ÉLÉMENT PAR ÉLÉMENT selon sa propre deadline (paris).
- Fichiers de suivi (dont celui-ci) : toujours régénérés en entier au moment
  où on les mets à jour, jamais résumés/coupés silencieusement.
- Toute migration SQL passe par supabase/migrations/ (fichier versionné,
  nommage `<timestamp>_nom.sql`) + `npx supabase db push`, PAS par un
  copier-coller manuel dans l'éditeur SQL Supabase. Toujours montrer le
  contenu de la migration et attendre une confirmation EXPLICITE avant de
  lancer `db push`. Toute migration qui touche une table déjà peuplée doit
  gérer le backfill des données existantes dans le même fichier.
- Sans outil navigateur pour cliquer soi-même : Claude vérifie les actions de
  l'utilisateur en interrogeant directement Supabase via son API REST
  (endpoint `NEXT_PUBLIC_SUPABASE_URL/rest/v1/<table>`, anon key — RLS
  absente donc lecture complète possible), avant/après chaque clic. Pattern
  utilisé intensivement pendant le test de bout en bout du 17/07/2026 pour
  vérifier chaque phase sans jamais soumettre un formulaire soi-même.
```

## 6. Pièges techniques déjà rencontrés (généraux, pas liés à un fichier précis)

```text
- Postgres : un CASE WHEN ... THEN 'X' ELSE 'Y' END sur une colonne ENUM
  nécessite un cast explicite (`::nom_du_type_enum`), sinon erreur 42804
  "column is of type X but expression is of type text".
- Postgres : un GROUP BY sur une colonne nullable (ex. match_id pour un pari
  scope=SERIES) regroupe TOUTES les valeurs NULL ensemble — piège classique
  pour une requête de détection de doublons, toujours filtrer le scope/type
  concerné avant de grouper sur une colonne potentiellement NULL.
- Un UUID ou une date/heure dans une requête SQL doit être entre guillemets
  simples ('...'), sinon Postgres essaie de l'interpréter comme une
  expression mathématique (ex. un UUID sans guillemets déclenche une
  soustraction, une erreur de syntaxe).
- React/Next.js : l'attribut cz-shortcut-listen="true" dans les warnings
  d'hydration vient d'une extension de navigateur (type ColorZilla), jamais
  du code — à ignorer systématiquement, ce n'est jamais la vraie erreur.
- À partir d'une quinzaine de bots simulés, une seule grosse Server Action
  séquentielle (ex. 60 jours d'un coup) peut saturer la mémoire du serveur de
  dev et bloquer tous les boutons pendant plus d'une minute, sans perte de
  données mais avec une UX qui semble "plantée" — préférer découper en plus
  petites requêtes successives (pattern AdvanceManyDaysControl) au-delà d'un
  certain volume.
- PowerShell : `<` et `>` sont des opérateurs réservés (redirection) — ne
  jamais les utiliser comme notation générique "remplace par ta valeur" dans
  une commande à coller, ça casse la commande.
- Git (Windows/PowerShell) : commandes à taper UNE PAR UNE, attendre la fin
  de chacune avant la suivante. Un `git commit` sans `-m` ou avec un message
  mal formé peut ouvrir un éditeur de texte inattendu plutôt qu'une erreur.
- Erreurs déjà rencontrées et résolues, pour référence : oublis de
  sauvegarde, confusion de dossier, ordre des inserts SQL vis-à-vis des clés
  étrangères, git add/commit/push collés sur une seule ligne, accents dans
  les messages de commit sous PowerShell, indicateurs Git (M/U dans
  l'explorateur VS Code) confondus avec des erreurs réelles — toujours
  vérifier le panneau "Problems" avant de conclure à un bug.
- lib/simulationAdvance.ts::resolveMatch codait en dur le seuil de victoire
  d'une série à 4 (best-of-7) — trouvé pendant l'implémentation NBA Cup
  (16/07/2026) : une série à 1 seul match (élimination directe, mini-bracket
  Cup) ne se serait JAMAIS résolue sans correctif. Corrigé via
  lib/bracketRounds.ts::winsNeededForRound(), CONFIRMÉ en conditions réelles
  le 17/07/2026 (4 séries NBA Cup Test résolues dès le match 1, aucun match 2
  fantôme créé). Leçon : tout seuil/constante qui semble universel dans un
  moteur à une seule compétition mérite d'être revérifié dès qu'une 2e
  structure de jeu apparaît.
- Un bug latent similaire existait dans lib/scoringEngine.ts : la comparaison
  `predicted_score_format === official_score_format` vaut `true` à tort
  quand les deux valent `null` (JS/TS : `null === null`) — aurait faussé le
  flag `is_score_exact` sur 100% des picks NBA Cup. Corrigé par un garde
  explicite `!= null`, CONFIRMÉ en conditions réelles (is_score_exact
  toujours false sur les picks NBA Cup Test).
- Une compétition ACTIVE est un état "en creux" nécessaire : dès qu'aucune
  ligne `competitions` n'a status='ACTIVE' (juste après une clôture, avant
  toute nouvelle création), les écrans qui en dépendent (ex. /paris) gèrent
  l'erreur PostgREST de `.single()` sur 0 ligne proprement (message affiché,
  pas de crash), mais l'app n'a plus de contenu "jouable" tant qu'une
  nouvelle compétition n'est pas créée. Pas un bug, juste un état à connaître
  en reprenant une session.
```

## 7. Chantier multi-compétitions + NBA Cup — TERMINÉ (17/07/2026)

```text
Plan complet : Cadrage/nba_pronos_plan_technique_multi_competitions_nba_cup.md
(migrations SQL, fichiers touchés, ordre des phases — référence historique,
tout est maintenant implémenté ET vérifié).

Résumé de ce qui a été livré (détail complet dans JOURNAL_SESSIONS.md) :
  [x] Phase 0-1 — Schéma (`competitions`, enum `playoff_round` +3 valeurs,
      `competition_archives`) + refactor Playoffs générique
      (bracketRounds.ts, fix seuil de victoire, fix is_score_exact).
      Vérification bloquante : comportement identique à avant sur la saison
      Playoffs en cours (avancer les jours + bots + /classement).
  [x] Phase 2-3 — lib/competitionSetup.ts (wipeOperationalData +
      seedCompetition) + écrans admin/competitions/{new,close}/.
  [x] Phase 4 — Garde-fous "pas de pari SÉRIE en NBA Cup" (3 points
      d'application : app/paris/actions.ts, app/paris/page.tsx,
      lib/botScripting.ts).
  [x] Phase 5 — lib/leaderboardSort.ts (extraction) + app/profil/page.tsx
      (onglet Historique).
  [x] Phase 6 — Test de bout en bout complet RÉEL (pas seulement lu/vérifié
      en base — l'utilisateur a cliqué chaque écran) :
      1. Clôture de "Playoffs (legacy)" (la compétition d'origine).
      2. Création d'une compétition PLAYOFFS neuve via le nouvel écran,
         mêmes matchups que Données de départ.txt — arbre de 15 séries
         généré identique à l'ancien script hardcodé (vérifié équipe par
         équipe et lien par lien).
      3. Régression rejouée dessus (5 jours avancés, Game 1+2 résolus,
         203 pronos bots validés) — comportement identique à avant.
      4. Clôture, puis création d'une compétition NBA_CUP (4 matchs de
         quarts) — arbre de 7 séries correct (4→2→1, sans conférence).
      5. /bracket confirmé afficher 3 tours (Quarts/Demies/Finale) SANS
         bouton de score de série.
      6. Quarts avancés : les 4 séries résolues dès le MATCH 1 (aucun
         match 2 fantôme — preuve concrète du fix winsNeededForRound en
         conditions réelles), official_score_format resté null, scoring
         bracket conforme au barème (0/20 constatés sur les picks Quarts).
      7. Clôture de la NBA Cup.
      8. /profil confirmé lister les 3 compétitions archivées avec des
         classements figés cohérents (51 lignes dans competition_archives,
         17 × 3).
      Aucune régression, aucun écart par rapport au comportement attendu à
      aucune étape.
  [x] Nettoyage — sql/reset_simulation.sql supprimé (superseded, décision
      actée avant même le début de l'implémentation).

État de fin de chantier : voir §3 (0 compétition ACTIVE actuellement, état
volontaire de fin de test — créer une nouvelle compétition pour reprendre
une saison jouable).
```
