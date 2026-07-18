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