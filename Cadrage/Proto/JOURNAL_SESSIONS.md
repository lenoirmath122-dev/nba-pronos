# Journal des sessions — NBA Pronos (prototype)

> Append-only. Chaque session ajoute une entrée à la fin, les entrées
> précédentes ne sont jamais réécrites. Le détail fichier-par-fichier vit dans
> `git log` (commits propres depuis la session du 16/07/2026) — ce journal se
> concentre sur les DÉCISIONS et bugs marquants, pas la liste exhaustive des
> fichiers touchés.

---

## Sessions antérieures au 16/07/2026 (reconstruites a posteriori depuis `git log`
## et l'ancien `ETAT_DEVELOPPEMENT_PROTOTYPE.md` — frontières exactes entre
## sessions non fiables au-delà de ce qui est explicitement noté ci-dessous)

**Bootstrap** (commit `c1f16d6`) : schéma initial complet, moteur de
simulation, moteur de scoring, dashboard admin, classement — socle du
prototype.

**Puis** (commits `e0d83fc`, `472f78f`, `eb7583f`) : sous-total bonus d'écart
au classement ; auto-validation des pronos match à la deadline ; auto-validation
du bracket à la deadline (`lib/deadlineValidation.ts`).

**Puis** (commits `519abdd`, `c490377`, `4f5da38`) : écran "Mes pronos match"
complet ; écran "Mon bracket" complet (6 briques — lecture, fonction pure de
candidats, saisie, cascade, validation, barre de progression). Bug détecté
**par l'utilisateur** (pas par Claude) : la 1ère version de la fonction de
candidats de tour 2+ faisait primer le résultat RÉEL sur le pronostic du
joueur — faux, corrigé (le bracket du joueur reste bâti sur SES pronostics
jusqu'au bout). Puis écran "Mes paris" + soumission groupée.

**Deux sessions non commitées** (travail accumulé, committé seulement en tout
début de la session du 16/07/2026 sous 4 commits groupés — `fdb5b91`,
`49073d0`, `6242ea4`, `26a1f4a`) :
- `lib/botScripting.ts` réécrit, 4 bugs corrigés : cascade du bracket jamais
  fonctionnelle pour les tours 2+ côté bots (même bug que côté joueur, jamais
  reporté) ; paris MATCH possibles sur des matchs déjà commencés ; paris
  SÉRIE possibles sans vérifier la deadline de la série ; bracket_deadline
  globale jamais vérifiée côté bots (créé `Bot_Test_Deadline` pour le
  prouver).
- `app/admin/paris/page.tsx` : gestion d'erreur Supabase ajoutée, affichage
  enrichi.
- Dashboard admin : boutons remplacés par `SubmitButton`/
  `AdvanceManyDaysControl` (indicateurs de progression), suite à un incident
  mémoire réel (RAM ~90%, admin bloqué ~84s avec N=60 jours d'un coup).
- 3 nouveaux écrans publics : classement enrichi (tri 6 colonnes), bracket
  public (tendances, seuil dynamique PAR SÉRIE), paris publics (révélation
  pari par pari selon SA propre deadline).
- Saison complète simulée jusqu'au champion, scoring vérifié par cross-check
  manuel.

---

## Session du 16/07/2026

**Point de départ** : 9 fichiers non commités depuis 2 sessions (liste
ci-dessus) — committés en tout premier (4 commits logiques), poussés.

**Travail réalisé** :
- Construction complète des **requêtes de correction** (0.2.3 §7 / 0.2.7 §6,
  dernière étape de la roadmap initiale) : migration de schéma (colonnes
  `proposed_*` sur `correction_requests`, colonnes de correction sur `bets`),
  fonctions pures + lecture Supabase, formulaires joueur (pronos + paris),
  écran admin de traitement. Décisions clarifiées avec l'utilisateur en cours
  de route : le joueur ne propose une valeur que s'il veut la changer (repli
  sur la valeur actuelle sinon, bug corrigé après un 1er oubli côté pronos) ;
  l'admin peut appliquer tel quel ou reformuler avant de valider.
- **Refactor `is_primary_human`** : création d'un 2e compte admin
  (`Admin_Test`, nécessaire pour tester qu'un admin ne peut pas traiter sa
  propre requête) a cassé toutes les requêtes `.eq('role','ADMIN').single()`
  utilisées partout dans l'app pour "qui suis-je" — nouvelle colonne
  dédiée, 11 occurrences corrigées via Claude Code (VS Code) sur 9 fichiers.
- **Fix `sql/reset_simulation.sql`** : dépendance circulaire découverte entre
  `correction_requests` et `match_predictions`/`bets` (FK entrantes) —
  le script cassait dès qu'une correction avait été traitée. Corrigé, testé,
  et pour la première fois sauvegardé en fichier local versionné (il ne
  vivait auparavant que dans le SQL Editor Supabase).
- **Suppression de `Bot_Test_Deadline`** (16e bot, résidu depuis 2 sessions,
  son test ayant réussi et n'ayant plus de raison de rester) — 0 ligne liée
  dans aucune table, suppression directe.
- **Fix `app/bracket/actions.ts`** : gap ouvert depuis 2 sessions — le code
  du joueur humain (`saveBracketPick`, `validateBracket`) ne vérifiait jamais
  `bracket_deadline`, contrairement au code des bots. Corrigé en miroir exact
  de `fillBracketPicks()`, testé en forçant une deadline dans le passé (erreur
  bloquante confirmée sur les 2 fonctions).
- **Resynchronisation de `sql/schema_prototype.sql`** avec l'état réel de la
  base (plusieurs migrations faites en SQL Editor sans mise à jour du fichier
  depuis des sessions : `is_primary_human`, colonnes de correction, split
  `winner_points`/`margin_bonus_points` sur `match_predictions` — ce dernier
  découvert seulement en comparant `information_schema` au fichier).
- **Restructuration de la documentation de suivi** : l'ancien
  `ETAT_DEVELOPPEMENT_PROTOTYPE.md` (938 lignes, mélange instantané +
  historique + points ouverts) remplacé par 3 fichiers séparés
  (`ETAT_ACTUEL.md`, `GAPS_OUVERTS.md`, `JOURNAL_SESSIONS.md` — celui-ci).

**Décision actée avec l'utilisateur** : la création de compte / vraie
authentification reste en V1 (cohérent avec la règle de phase — liée à
RLS/sécurité). Pas une nouvelle règle produit, un choix de séquencement.

**État en fin de session** : voir `ETAT_ACTUEL.md`. Roadmap initiale du
prototype entièrement terminée.

**Session du 16/07/2026** : brainstorm multi-compétitions + mécanique
NBA Cup. Deux fichiers de décision créés (voir `GAPS_OUVERTS.md`
ci-dessus). Correction d'une référence fantôme dans la synthèse (fichier
`0.2.11` jamais réellement créé, ligne retirée de la section 15).

**Session du 16/07/2026 (suite — audit + numérotation 0.2.11)** : audit de
cohérence documentaire du cadrage (étape 1 demandée par l'utilisateur) :
vérifié la présence réelle des 2 fichiers de décision multi-compétitions/
NBA Cup, confirmé l'absence de `decisions_0_2_11_points_ouverts_resolus.md`
(jamais créé séparément, mais son contenu — 5 points : code compétition,
bracket partiellement rempli, drill-down, borne écart, colonnes mobile
classement — est bien intégré directement dans `SPEC_FONCTIONNELLE_V0_2.md`,
juste jamais isolé dans un fichier dédié). Sur décision explicite de
l'utilisateur, la numérotation fantôme "0.2.11" a été retirée de
`SYNTHESE_CLAUDE_PROJECT_1_3.md` et `SPEC_FONCTIONNELLE_V0_2.md` (tags
`[VALIDÉ — 0.2.11]` → `[VALIDÉ]`, comptage "11 fichiers 0.2.x" → "10",
"0.1 → 0.2.11" → "0.1 → 0.2.10") — le contenu fonctionnel lui-même n'a pas
bougé, seule l'attribution à un fichier inexistant a été supprimée.

**Session du 16/07/2026 (suite — plan technique)** : plan technique pour
la brique multi-compétitions + NBA Cup conçu (exploration complète du code
bracket/scoring existant via agents dédiés, design validé par un agent Plan,
relecture directe des fichiers critiques), 3 décisions de conception
tranchées avec l'utilisateur (sélecteurs manuels d'équipes plutôt que tirage
aléatoire, suppression des colonnes mortes `competition_code`/
`current_round`, suppression prévue de `sql/reset_simulation.sql` une fois
le nouvel écran vérifié). Plan validé et sauvegardé dans
`Cadrage/nba_pronos_plan_technique_multi_competitions_nba_cup.md` (à la
demande de l'utilisateur, pour rester accessible dans le dépôt au-delà du
fichier de plan hors-repo).

**Session du 16/07/2026 (suite — début d'implémentation)** : démarrage de
l'implémentation du plan ci-dessus (phases 0-1). Changement de workflow en
cours de route, sur demande explicite de l'utilisateur : les migrations SQL
de ce chantier passent désormais par des fichiers versionnés dans
`supabase/migrations/` appliqués via `npx supabase db push` (CLI Supabase
déjà lié et authentifié sur ce poste, découvert en cours de session — voir
`ETAT_ACTUEL.md` §5), plutôt que par un copier-coller manuel dans l'éditeur
SQL Supabase (ancien workflow). Chaque migration montrée intégralement à
l'utilisateur avant application, feu vert explicite obtenu avant le premier
`db push`. 3 migrations appliquées avec succès (renommage
`competition_settings` → `competitions` + backfill de la ligne existante,
extension de l'enum `playoff_round`, création de `competition_archives`).
`lib/bracketRounds.ts` créé, `lib/scoringEngine.ts` et
`lib/simulationAdvance.ts` corrigés — un vrai bug pré-existant trouvé au
passage (seuil de victoire de série codé en dur à 4, aurait empêché toute
série NBA Cup à 1 seul match de se résoudre) et corrigé. Écrans
bracket/bracket-global/paris-globaux + botScripting.ts basculés sur la
nouvelle config de tours centralisée et la table `competitions`.
Vérification : `tsc --noEmit` propre, 66 erreurs ESLint confirmées
préexistantes (touchent aussi des fichiers non modifiés cette session),
8 pages testées OK (200, données réelles) sur le serveur dev déjà lancé par
l'utilisateur — reste à confirmer manuellement par l'utilisateur que
"Avancer d'un jour"/"Faire jouer les bots" fonctionnent toujours à
l'identique (pas d'outil navigateur disponible pour le faire soi-même).
Suite détaillée : `ETAT_ACTUEL.md` §7 (checklist de reprise).

**Session du 17/07/2026 (suite — vérification phase 1 + reste de l'implémentation)** :
reprise exactement où la session précédente s'est arrêtée (`ETAT_ACTUEL.md`
§7). Vérification bloquante de la phase 1 confirmée : l'utilisateur a cliqué
"Avancer d'un jour"/"Faire jouer les bots" sur la saison Playoffs en cours
pendant que Claude contrôlait l'état avant/après directement en base (API
REST Supabase, anon key, RLS absente — technique utilisée tout le reste de
la session en l'absence d'outil navigateur) : comportement strictement
identique à avant, aucune régression.

Reste de l'implémentation du plan technique (phases 2-5) enchaîné dans la
foulée : `lib/competitionSetup.ts` créé (`wipeOperationalData` +
`seedCompetition`, arbre de séries généralisé vérifié contre l'arbre
Playoffs réel en base avant écriture — pas de génération "au hasard", chaque
règle de pairage/fusion de conférence rejouée à la main) ; écrans
`app/admin/competitions/new/` et `close/` créés (sélecteurs manuels
d'équipes, classement figé prévisualisé avant clôture) ; garde-fous "pas de
pari SÉRIE en NBA Cup" complétés sur les 2 points restants
(`app/paris/actions.ts` + `page.tsx`, le 3e — `lib/botScripting.ts` — étant
déjà fait) ; `lib/leaderboardSort.ts` extrait de `app/classement/page.tsx`
(2e appelant : `app/profil/page.tsx`, nouvel onglet Historique, créé dans la
foulée) — `/classement` revérifié rendre à l'identique après ce refactor.

**Test de bout en bout complet** (dernière case du plan, la seule à exercer
réellement le code écrit ci-dessus) : clôture de "Playoffs (legacy)" →
création d'une compétition PLAYOFFS neuve via le nouvel écran (mêmes
matchups que `Données de départ.txt`, arbre de séries généré identique à
l'ancien script hardcodé, vérifié équipe par équipe) → régression rejouée
dessus (5 jours avancés, Game 1 et 2 résolus, 203 pronos bots validés) →
clôture → création d'une compétition NBA_CUP → `/bracket` confirmé afficher
3 tours sans bouton de score → quarts avancés : chaque série résolue dès le
match 1 (aucun match 2 fantôme — preuve concrète du fix `winsNeededForRound`
en conditions réelles), `official_score_format` resté `null`, scoring
bracket conforme (0/20 constatés sur les picks Quarts) → clôture → `/profil`
confirmé lister les 3 compétitions archivées avec classements figés
cohérents (51 lignes dans `competition_archives`, 17 × 3). Tout validé sans
aucune régression ni écart par rapport au comportement attendu.

`sql/reset_simulation.sql` supprimé en conséquence (décision actée
précédemment : plus de filet de secours une fois le nouvel écran vérifié
fonctionnel de bout en bout).

**État en fin de session** : chantier multi-compétitions + NBA Cup
entièrement terminé et vérifié. Voir `ETAT_ACTUEL.md` pour l'état détaillé.

**Session du 17/07/2026 (suite — état des lieux pré-spec-technique)** :
session exclusivement décisionnelle/documentaire (aucun code touché),
objectif mettre à l'épreuve ce qui était déjà validé et faire émerger les
améliorations voulues pour la V1, avant d'écrire la spec technique.

Déroulé : (1) brainstorm de nouvelles fonctionnalités V1, enrichi par un
fichier réel de paris personnalisés de la saison passée fourni par
l'utilisateur (taxonomie dérivée de l'usage réel plutôt qu'inventée) ;
(2) revue point par point de tous les points ouverts déjà recensés — 9
points renvoyés à la spec technique (`nba_pronos_SPEC_FONCTIONNELLE_V0_2.md`
§14.1), 9 points non bloquants (§14.2), 5 points explicitement reportés en
V1 (anciennement dans `GAPS_OUVERTS.md`).

Décisions notables : fournisseur d'API NBA à valider techniquement avant de
coder (Highlightly en priorité) ; découverte d'une incompatibilité entre
Vercel Cron (Hobby = 1x/jour max) et le besoin fonctionnel de synchro
plusieurs fois par jour, résolue par un planificateur externe gratuit ;
découverte du risque de pause Supabase après 7 jours d'inactivité,
particulièrement pertinent vu l'usage saisonnier de l'app, mitigé par un
heartbeat sur le même planificateur externe ; passage à Supabase Realtime
plutôt que du polling pour l'affichage live ; taxonomie des paris
personnalisés dérivée de données réelles (9 catégories) ; tentative de
retirer le code compétition au profit d'un système de ligues ouvertes,
explicitement écartée après clarification (le code compétition reste tel
que validé en 0.2.1).

Documentation mise à jour en conséquence : nouveau fichier
`nba_pronos_PREP_SPEC_TECHNIQUE_V1.md` (réponses détaillées aux blocs A/B
renvoyés à la spec technique + points anciennement « reportés en V1 »,
sans rouvrir les documents de cadrage clos) ; nouveau `BACKLOG_V1.md`
(brainstorm de fonctionnalités, ajouts purs sans impact sur le scoring/
statuts/workflows déjà validés) ; `GAPS_OUVERTS.md` nettoyé des 5 points
« reporté en V1 » désormais tranchés (le point RLS, non creusé cette
session, y reste explicitement entier) ; `ETAT_ACTUEL.md` §2 mis à jour
(prochaine étape : test technique des fournisseurs d'API NBA candidats).

Aucun code touché cette session — travail exclusivement décisionnel/doc.

**Session du 17/07/2026 (suite — test technique de l'API NBA Highlightly)** :
test technique de l'API NBA Highlightly, avant d'écrire la spec technique
V1. Déroulé : création de compte direct sur highlightly.net (pas
RapidAPI), tests réels via PowerShell (Invoke-RestMethod/
Invoke-WebRequest, l'utilisateur découvrant PowerShell pour la première
fois — commandes expliquées une par une) sur la finale NBA Cup 2025 réelle
(16/12/2025, Knicks-Spurs, résultat réel vérifiable) et l'endpoint
/teams. Tous les critères de la checklist de vérification validés :
statuts, couverture NBA Cup, logos, rate limit (100/jour confirmé pile).
Deux pièges techniques découverts et résolus en cours de test : (1) le
filtrage par date des matchs est en UTC par défaut — un match joué en
soirée US peut apparaître sous le jour calendaire UTC suivant, nécessite
de toujours passer `timezone=America/New_York` ; (2) le score renvoyé par
l'API est un tableau par quart-temps, pas un total, à sommer côté app
plutôt que lu directement. Highlightly confirmé et retenu comme
fournisseur unique pour la V1 — balldontlie et The Odds API non testés,
plus nécessaire. Note opérationnelle : la clé API de test a transité dans
le chat par erreur de l'utilisateur, régénérée par précaution
immédiatement après les tests (clé gratuite, faible enjeu, mais hygiène
de sécurité respectée).

Documentation mise à jour en conséquence : `nba_pronos_PREP_SPEC_TECHNIQUE_V1.md`
(bloc A6 passé de "à tester" à "confirmé" + 2 découvertes techniques
ajoutées ; B4 mis à jour sur la disponibilité des logos) ; `ETAT_ACTUEL.md`
§2 (test API terminé et concluant, plus aucun point bloquant avant
d'écrire la spec technique elle-même, hormis les RLS qui restent
entièrement ouvertes).

Aucun code applicatif touché cette session (uniquement des appels API de
test depuis PowerShell, hors du dépôt).

**Session du 17/07/2026 (suite — découpage du livrable + 4 arbitrages RLS
fondateurs)** : 3e session de la journée, exclusivement décisionnelle/
documentaire (aucun code touché), préparatoire à la rédaction de la spec
technique V1 elle-même.

Décisions actées avec l'utilisateur :

1. **Découpage du livrable technique** (conforme méthodo §7, pas de pavé
   unique) : `SPEC_TECHNIQUE_V0.1.md` sera un document maître COURT
   (principes transverses, carte des fichiers, contrats entre modules, ordre
   de construction), qui pointera vers des fichiers thématiques séparés —
   dont `SPEC_TECHNIQUE_RLS_V0.1.md`.

2. **RLS — les 4 arbitrages fondateurs tranchés** (le point était jusqu'ici
   entièrement ouvert, cf. `nba_pronos_PREP_SPEC_TECHNIQUE_V1.md` bloc C5) :
   - **A.** Toutes les lectures passent par la session utilisateur (clé anon
     + JWT, RLS réellement appliquée) ; `service_role` réservé aux routes de
     synchro et au seed. Cohérent avec le bloc A9 (Supabase Realtime souscrit
     en clé anon, donc les policies doivent être vraies de toute façon).
   - **B.** La règle temporelle « public seulement après deadline/
     verrouillage » vit dans les policies SQL (`now()` comparé à l'heure du
     match / `bracket_deadline`), PAS dans le code applicatif.
   - **C.** Détection admin dans les policies via une fonction `is_admin()`
     `SECURITY DEFINER STABLE` lisant `users.role` (pas de claim JWT) : évite
     la récursion de policy sur `users`, promotion effective sans re-login.
   - **D.** Le profil `users` reprend l'id de `auth.users` comme PK →
     policies en `user_id = auth.uid()` sans jointure. `is_primary_human`
     disparaît en V1 (artefact prototype).
   Les policies elles-mêmes restent ENTIÈREMENT à écrire — seuls les 4
   arbitrages de conception sont actés à ce stade.

3. **Identité graphique** : la direction est déjà close (0.2.9 §2), il
   manque les design tokens (palette, typo, espacements, composants). Décidé
   de traiter ce point dans une session dédiée, JUSTE AVANT le 1er écran
   joueur (donc après auth + schéma + RLS), livrable
   `SPEC_DESIGN_SYSTEM_V0.1.md`. Seule conséquence sur le modèle de données à
   ce stade : `users` a besoin d'une colonne de préférence de thème (la
   bascule clair/sombre est une préférence utilisateur, 0.2.9 §2) — à
   intégrer à la spec technique V0.1.

Documentation mise à jour en conséquence : `JOURNAL_SESSIONS.md` (cette
entrée) ; `ETAT_ACTUEL.md` §2 (prochaine étape : rédaction de
`SPEC_TECHNIQUE_V0.1.md`) ; `GAPS_OUVERTS.md` (la ligne « RLS complètes »
reste ouverte tant que la spec n'est pas validée — précisée : les 4
arbitrages fondateurs ci-dessus sont tranchés, les policies restent à
écrire).

Aucun code touché cette session — travail exclusivement décisionnel/doc.

**Session du 17/07/2026 (suite — spec technique maître V0.1)** : 4e session de
la journée, exclusivement décisionnelle/documentaire (aucun code touché).
Objectif : produire le document maître de la spec technique V1, conformément
au découpage acté à la session précédente.

Déroulé : relecture de l'état réel (ETAT_ACTUEL/GAPS_OUVERTS/JOURNAL), de la
synthèse produit, de `nba_pronos_PREP_SPEC_TECHNIQUE_V1.md`, de
`BACKLOG_V1.md`, de la mécanique NBA Cup et de `schema_prototype.sql` ;
rédaction de `SPEC_TECHNIQUE_V0.1.md` ; puis arbitrage des 5 questions
ouvertes que le document posait explicitement plutôt que de les trancher
seul.

Décisions actées (motifs complets dans `SPEC_TECHNIQUE_V0.1.md` §7) :

1. **Périmètre** : spec = V1 complète (Playoffs + Cup) pour le modèle de
   données et les RLS, séquencement d'implémentation orienté Cup.
2. **D1 — dépôt et base neufs** : le code proto qui ne doit pas survivre
   (simulation, botScripting, is_primary_human, écrans de debug) n'arrive
   dans la V1 que s'il est copié volontairement ; `users.id` doit devenir
   l'id de `auth.users`, ce qui est une refonte de clé primaire et pas une
   migration. Contrainte vérifiée : le plan gratuit Supabase autorise 2
   projets ACTIFS, les projets en pause ne comptent pas — proto + V1
   tiennent, et le proto se mettra en pause seul (aucun heartbeat dessus).
3. **D2 — rétention des données opérationnelles** : contredit
   VOLONTAIREMENT la décision technique du plan proto du 16/07 ("pas de
   `competition_id`, on vide tout à la clôture"). Cette décision était juste
   pour un proto jetable rejoué en boucle ; en V1 il s'agit de vraies
   saisons avec de vrais joueurs. Motif principal : asymétrie des risques —
   conserver sans s'en servir coûte quelques colonnes et quelques filtres,
   effacer et le regretter est irrécupérable (pas de backup sur le plan
   gratuit). Débloque 2 items de `BACKLOG_V1.md` (courbe d'évolution, page
   perso) sans les construire. Aucun changement fonctionnel côté joueur :
   l'app "se reset" toujours à chaque compétition, c'est un filtre au lieu
   d'un effacement. `plan_technique_multi_competitions_nba_cup.md` reste
   inchangé : document historique du proto, pas une règle V1.
4. **D3 — portage du code proto** plutôt que réécriture, chaque fichier
   repris étant vérifiable et modifiable. Le moteur de scoring a été validé
   de bout en bout sur une saison complète : le jeter par principe coûterait
   cher.
5. **D4/D5 — vues et RLS** : découverte que par défaut une vue Postgres
   s'exécute avec les droits de son créateur et CONTOURNE donc la RLS des
   tables sous-jacentes — des policies impeccables sur `match_predictions`
   auraient été rendues inopérantes par `user_scores`. Retenu :
   `security_invoker = true`. Ça ne fausse aucun total grâce à un invariant
   du produit à tester explicitement en T3 — « tout point n'existe que sur
   une ligne déjà publique » (un prono ne marque qu'après la fin du match,
   donc après le verrouillage ; un pick de bracket qu'à la résolution de la
   série, donc après la deadline ; un pari qu'à sa résolution admin, donc
   après sa deadline ; les lignes encore secrètes valent 0). Conséquence en
   cascade (D5) : en mode invoker la vue joint `users`, donc les visiteurs
   doivent pouvoir lire cette table ; or la RLS filtre des lignes et pas des
   colonnes, ce qui exposerait `email`. Comme l'email est déjà l'identifiant
   Supabase Auth (bloc C4), `public.users` n'a aucune raison de le dupliquer
   — la colonne disparaît et le problème avec elle.
6. **D6 — synchro NBA Cup** : la compétition n'existe en base qu'à partir
   des 8 qualifiés (~27-30 nov), aucun match de poule ingéré (aucun prono
   n'y est possible, et le quota de 100 requêtes/jour est mieux dépensé sur
   la phase finale). L'admin saisit les 8 qualifiés à la main via l'écran de
   création existant — pas de pré-remplissage automatique (A7 le mentionnait
   comme confort, jugé non rentable). La synchro du référentiel des 30
   équipes (GET /teams, logos) reste indépendante et hors compétition.

Documentation mise à jour en conséquence : `SPEC_TECHNIQUE_V0.1.md`
(nouveau) ; `ETAT_ACTUEL.md` §2 (prochaine étape : T1, modèle de données) ;
`GAPS_OUVERTS.md` (ligne RLS toujours ouverte, enrichie de D4/D5 — les
policies restent entièrement à écrire).

Aucun code touché cette session — travail exclusivement décisionnel/doc.

---

## Session du 18/07/2026 (dépôt neuf + T1/T2/T3 + migrations 1-4)

Bascule effective de la phase de cadrage vers la V1 elle-même. Dépôt Git NEUF
et projet Supabase NEUF créés (sortie de OneDrive, projet local désormais
`C:\dev\nba-pronos`), conformément à D1 (session du 17/07/2026, 4e de la
journée) — le prototype (`nba-pronos-proto`) reste intact et inchangé, en
simple référence.

**Spécifications techniques V1 rédigées et VALIDÉES par l'utilisateur**, dans
`Cadrage/V1/` :
- **T1** — `SPEC_TECHNIQUE_MODELE_DONNEES_V0.1.md` (modèle de données complet).
- **T2** — `SPEC_TECHNIQUE_AUTH_V0.1.md` (authentification, code compétition,
  pont auth.users → public.users).
- **T3** — `SPEC_TECHNIQUE_RLS_V0.1.md` (Row Level Security complète).

**4 migrations** écrites à partir de T1/T2/T3, chacune montrée intégralement
et confirmée par l'utilisateur avant `db push` (workflow déjà acté,
reconduit sans exception), appliquées avec succès :

1. `20260718090000_initial_schema.sql` (commit `3e0315c`) — schéma initial
   complet : types énumérés, tables (`teams`, `users`, `competitions`,
   `series`, `matches`, `entity_mappings`, `brackets`, `bracket_picks`,
   `match_predictions`, `bets`, `correction_requests`, `audit_logs`,
   `sync_logs`, `competition_archives`), vues de classement `user_scores` /
   `user_recent_form` en `security_invoker = true` — transcription fidèle de
   T1.
2. `20260718100000_auth_join_code_and_profile.sql` (commit `aaceff3`) — code
   compétition (`join_code` sur `competitions`), fonction
   `verify_join_code()`, trigger `handle_new_user` (pont auth.users →
   public.users, École A retenue en T2).
3. `20260718110000_rls.sql` (commit `aaf5b4e`) — RLS complète : fonctions
   `SECURITY DEFINER` (`is_admin`, `is_active`, `match_is_locked`,
   `has_committed_prediction`, `bracket_deadline_passed`, `bet_is_public`,
   `bet_deadline_open`) ; RLS activée sur les 15 tables publiques ; policies
   de lecture/écriture ; triggers d'invariants (`enforce_users_invariants`,
   `enforce_match_prediction_transitions`, `enforce_bet_transitions`,
   `enforce_prediction_correction`).
4. `20260718120000_fix_users_trigger_system_context.sql` (commit `5e7a820`)
   — correctif de `enforce_users_invariants()` : un contexte système (SQL
   Editor super-utilisateur, `service_role`, seed de migration) n'a pas de
   session utilisateur, donc `auth.uid()` y est NULL et `is_admin()` y vaut
   faux — le trigger bloquait alors TOUTE modification de `role`/`status`,
   ce qui aurait empêché le seed du 1er admin (A4). Bug trouvé pendant le
   test RLS (plan T3 §7), pas anticipé à l'écriture de la migration #3.
   Correction : `auth.uid() IS NULL` laisse désormais passer sans garde
   (aucun trou ouvert, la RLS bloque déjà toute écriture anon/non
   authentifiée sur `users`) — seules les vraies sessions utilisateur
   restent bridées.

**RLS vérifiée de bout en bout** via le plan de test de T3 §7 (anon, joueur
A, joueur B, admin) : lectures publiques correctes, règle « valider = voir »
sur les pronos match respectée, verrouillage à l'heure du match respecté,
écritures illégales (hors propriétaire, hors deadline, hors admin) toutes
refusées. Tout conforme au comportement attendu.

**Décisions actées notables**, au fil de l'implémentation et dans le respect
des arbitrages déjà tranchés (D2/D4/D5, sessions du 17/07/2026) :
- `competition_id` dénormalisé sur les tables opérationnelles
  (`series`/`matches`/`brackets`/`bracket_picks`/`match_predictions`/`bets`),
  avec cohérence garantie par des **FK composites**
  (`unique (id, competition_id)` côté parent, FK `(fk_id, competition_id)`
  côté enfant) plutôt que par un simple contrôle applicatif — conforme D2.
- `join_code` **sorti de `competitions` vers une nouvelle table
  `competition_secrets`** (secret admin-only, lu uniquement par
  `verify_join_code()` en `SECURITY DEFINER`, jamais exposé par une policy
  `SELECT`) : corrigé dès la migration #3, avant toute mise en production.
- Vues de classement `user_scores`/`user_recent_form` confirmées en
  `security_invoker = true`, une ligne par **(compétition, joueur)** — jamais
  de total toutes compétitions confondues — conforme D4/D5.

**État en fin de session** : socle de données V1 (schéma + auth + RLS) posé
et vérifié. Voir `ETAT_ACTUEL.md` pour l'état détaillé et les prochaines
étapes (T4-T8) ; `GAPS_OUVERTS.md` mis à jour (RLS retirée des points
ouverts, points ouverts pour les phases suivantes précisés).

---

## Session du 18/07/2026 (suite — T4 : spec technique synchro API)

Suite directe de la session précédente. Objectif : produire la spec technique
T4 (synchro avec l'API NBA réelle), conformément à l'ordre acté dans
`SPEC_TECHNIQUE_V0.1.md`.

**Spec T4 rédigée et VALIDÉE par l'utilisateur**, dans `Cadrage/V1/` :
- **T4** — `SPEC_TECHNIQUE_SYNCHRO_V0.1.md` (synchro API Highlightly).

Fournisseur retenu : Highlightly, accès **direct** (pas RapidAPI). Règles
client actées : `timezone=America/New_York` sur tout appel daté (la réponse
garde `date` en UTC) ; score = **somme du tableau par quart-temps** (jamais une
valeur unique lue directement).

**Architecture actée** : `lib/nba/client.ts` (C-1) seul module autorisé à
appeler l'API ; `lib/sync/*` (C-2) seul écrivain des tables de jeu
(teams/series/matches) ; routes `/api/sync/*` + `/api/heartbeat` en
`service_role` (contournent volontairement la RLS, réservé à la synchro) ;
planificateur externe gratuit (cron-job.org / GitHub Actions) appelant ces
routes en HTTP — pas de Cron Vercel (Hobby = 1×/jour max, insuffisant) ;
Supabase Realtime pour l'affichage live des scores (respecte nativement la
RLS, pas de polling).

**Repérage API effectué (1 requête, sur la source réelle)** : sondage de
`GET /matches` sur une date de playoffs passée — le payload d'un match ne
contient **aucun id de série/tour/game number exploitable**. **BRANCHE B
retenue** : la structure des séries reste créée par l'admin (écran
`admin/competitions/new`, 8 affiches du 1er tour), les matchs synchronisés y
sont rattachés par **heuristique** (paire d'équipes non ordonnée + tour +
fenêtre de dates), confirmée par l'admin — rien de PENDING n'entre dans le
scoring ou le verrouillage (0.2.8 §5, règle de sûreté déjà actée).

**Trouvailles client complémentaires du même repérage** : la réponse de l'API
est enveloppée dans un champ `"data"` ; `/matches?date` renvoie **toutes les
ligues confondues**, pas seulement la NBA — filtre `league="NBA"`
**obligatoire** côté client, sinon des matchs d'autres ligues (ex. NCAA)
seraient ingérés par erreur ; le statut d'un match se lit dans
`state.description`, pas un champ plat dédié.

**Aucune migration produite par T4** — les tables nécessaires existent déjà
depuis T1. L'implémentation (client, `lib/sync`, routes) est prévue **après
T5** (scoring), une fois le moteur de recalcul disponible pour la couture.

**Note sécurité** : la clé API Highlightly a transité en clair pendant cette
session de test — **nouvel incident, distinct de celui déjà régénéré lors de
la session du 17/07/2026** (test technique initial). Action utilisateur : à
régénérer côté Highlightly.

**État en fin de session** : T4 validé et figé, aucune réserve restante (le
repérage §5.1 a tranché la branche B). Voir `ETAT_ACTUEL.md` pour l'état
détaillé et la prochaine étape (T5, scoring) ; `GAPS_OUVERTS.md` mis à jour
(choix fournisseur/synchro et attache match→série retirés des points ouverts,
traités par T4).

---

## Session du 19/07/2026 (T5 : spec technique scoring)

Suite directe de la session précédente. Objectif : produire la spec technique
T5 (moteur de scoring), conformément à l'ordre acté dans
`SPEC_TECHNIQUE_V0.1.md`.

**Spec T5 rédigée et VALIDÉE par l'utilisateur**, dans `Cadrage/V1/` :
- **T5** — `SPEC_TECHNIQUE_SCORING_V0_1.md` (moteur de scoring, barèmes
  Playoffs + NBA Cup).

**Moteur pur acté** (`lib/scoring/engine.ts`, aucune I/O) : dérivation de
l'agrégat de série depuis ses matchs (best-of-7 Playoffs / série dégénérée à
1 match Cup) ; barème MATCH identique Playoffs/Cup (vainqueur 10 + bonus
d'écart 0-5) ; barème BRACKET Playoffs (vainqueur/score exact/affiche,
finale parfaite 340 points) et NBA Cup (vainqueur/affiche, pas de score
exact, bracket parfait 385 points) ; barème PARIS linéaire (5/10/15/20/25)
résolu manuellement par l'admin. Idempotence garantie (P5, colonnes
réécrites en entier à chaque passe) et aucun point négatif (P6).

**Neutralisation A2** (série annulée) traitée en cascade naturelle : la
série annulée elle-même passe à 0 pour tous (sans pénalité) ; sur les tours
dépendants, le moteur ne score que contre des données officielles présentes
— tant que l'admin n'a pas résolu la série amont, l'affiche aval reste EN
ATTENTE (NULL) et non un faux 0, sans logique de cascade spéciale à écrire.

**Déclencheurs de recalcul actés** (`lib/scoring/recompute.ts`, T5 §10.1) :
granularité `recomputeMatch` / `recomputeSeries` / `recomputeBet` /
`recomputeCompetition`, couturée avec T4 (`/api/sync/results` appelle
directement `recomputeMatch` dans la même transaction sur un résultat
changé).

**4 décisions actées à la validation (T5 §12)** :
1. **§12.1** — `series.official_*` reste écrit uniquement par
   `lib/sync.writeSeriesOutcome` (C-2 intact) ; l'orchestration T5 n'écrit
   que les colonnes de scoring des tables de prédiction
   (`bracket_picks`/`match_predictions`/`bets`), jamais `series`.
2. **§12.2** — la résolution admin d'une série (A2 : `CANCELLED`, ou
   désignation manuelle de l'équipe qui avance) passe par ce même
   `writeSeriesOutcome`, pas d'exception à C-2 ; toujours journalisée
   (0.2.7).
3. **§12.3** — convention actée NULL (non scoré / en attente) vs 0
   (scoré-zéro ou neutralisé) : aucun impact sur les totaux (coalesce à 0),
   mais pivot de l'affichage A1 renvoyé à T6.
4. **§12.4** — contrat T6 : l'auto-validation d'un pari pose
   `validated_difficulty = proposed_difficulty` ; le moteur lit
   `validated_difficulty` sans retomber sur `proposed_difficulty`, un `WON`
   sans `validated_difficulty` étant une anomalie journalisée.

**Aucune migration produite par T5** — les colonnes de scoring existent déjà
depuis T1.

**État en fin de session** : T5 validé et figé. Voir `ETAT_ACTUEL.md` pour
l'état détaillé et la prochaine étape (T6, écrans + server actions) ;
`GAPS_OUVERTS.md` mis à jour (les 3 points renvoyés à T5 retirés des points
ouverts).