# Journal des sessions — NBA Pronos

> Couvre le prototype ET la V1 (bascule au commit `3e0315c`, session du
> 18/07/2026) — un seul journal continu, pas un fichier par phase (acté
> 19/07/2026 : on continue avec les 3 fichiers actifs plutôt que d'ouvrir un
> journal dédié à l'implémentation).

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

---

## Session du 19/07/2026 (suite — T6a : squelette Next.js)

Suite directe de la session T5. Objectif : produire T6a, première des trois
sous-specs actées pour découper T6 (architecture Next.js) — arbre `app/`,
route groups, stratégie de données, frontière d'écriture.

**Spec T6a rédigée et VALIDÉE par l'utilisateur**, dans `Cadrage/V1/` :
- **T6a** — `SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_a.md` (arbre, route
  groups, données).

**Découpage de T6 acté** : T6a (squelette : arbre, route groups, stratégie
de données, frontière d'écriture) ; T6b (server actions joueur + garde-fou
C2, puis actions admin) ; T6c (Realtime + rendu des états actés). T7 (design
system) reste après, juste avant le 1er écran joueur (déjà acté le
17/07/2026).

**Stratégie de données actée (reco 1)** : chaque écran est un composant
SERVEUR qui lit via la session utilisateur — la RLS (T3) est seule arbitre
de ce qui arrive au composant, qui ne choisit que la MISE EN FORME. Realtime
en surcouche uniquement (état local client, jamais de `revalidatePath`
déclenché par un événement Realtime). Trois clients Supabase distincts
(navigateur / serveur en session / serveur privilégié `service_role`), le
client privilégié isolé dans un module `server-only` (garde de build
empêchant toute fuite de `service_role` côté navigateur).

**Frontière d'écriture actée (Option A, reco 2)** : trois catégories — A)
écriture joueur sur ses propres données (server action en session, RLS
garde-fou) ; B) écriture admin-système (recompute, résolution de série) via
server action qui re-vérifie `is_admin()` puis appelle un module privilégié ;
C) écriture système externe (synchro, heartbeat) via routes `/api/sync/*` +
secret (T4, inchangé). `writeSeriesOutcome` confirmé point d'écriture unique
de `series.official_*` (C-2/T5 §12), appelé aussi bien par la synchro (T4)
que par une résolution admin (catégorie B).

**Décision actée à la validation (T6a §8)** : classement et bracket global
public/connecté partagent UN SEUL module de lecture et UN SEUL composant de
rendu ; les `page.tsx` de `(public)` et `(app)` ne sont que des enveloppes
fines sous leur layout — aucune duplication, aucune divergence possible
entre vue visiteur et vue joueur (seule la RLS change le contenu).

**Aucune migration produite par T6a** — squelette applicatif seul, code
écrit après feu vert.

**État en fin de session** : T6a validé et figé. Prochaine étape : T6b
(corps des server actions).

---

## Session du 19/07/2026 (suite — T6b : couche d'écriture)

Suite directe. Objectif : T6b, deuxième sous-spec de T6 — server actions
joueur (catégorie A) + garde-fou anti-perte de saisie C2, puis actions admin
(catégorie B) et journalisation.

**Spec T6b rédigée et VALIDÉE par l'utilisateur**, dans `Cadrage/V1/` :
- **T6b** — `SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_b.md` (server actions,
  C2, admin, audit).

**`sealDeadlines` acté (décision d'entrée)** : l'auto-validation
(bracket/prono/pari) ne peut pas rester un calcul paresseux — deux
mécanismes déjà figés (visibilité T3, scoring T5) lisent le STATUT STOCKÉ,
pas `now()`. Solution : un scellage explicite, idempotent,
`lib/sync/sealDeadlines.ts`, exécuté en tête du job de résultats existant
(`/api/sync/results`, T4) — zéro infra supplémentaire, zéro quota API
consommé (lecture DB seule). Scellages prono/pari qualifiés de PORTEURS
(statut requis pour visibilité + scoring) ; scellage bracket qualifié de
COSMÉTIQUE (le bracket est déjà gardé par le temps et par la présence d'un
pick, `is_auto_validated` n'y est qu'un libellé de traçabilité).

**Server actions joueur (catégorie A)** posées pour les 4 familles
d'écriture (pronos match, bracket, paris, requêtes de correction), toutes en
session utilisateur, RLS garde-fou, aucun DELETE joueur (rétention D2).

**Garde-fou C2 étendu** : en plus de `beforeunload` (déjà géré au
prototype), interception de la navigation INTERNE à l'app (App Router) tant
que la saisie est « sale » — nouveauté par rapport au prototype.

**Actions admin (catégorie B)** posées pour les 3 files (validation/
résolution paris, requêtes de correction), la gestion des joueurs, la
résolution/override de série (A2), le bouton « Recalculer », et la création
de compétition — chacune re-vérifiant `is_admin()` côté serveur et
journalisée dans `audit_logs` (helper transverse commun).

**2 décisions actées à la validation (T6b §9)** :
1. **Remontée vers T3** — la garde `not is_validated` est retirée de la
   policy d'UPDATE de `brackets`/`bracket_picks` (elle contredisait 0.2.2
   §3, « modifiable jusqu'à la deadline même après validation »). Vérifié
   dans `supabase/migrations/20260718110000_rls.sql` (lignes 213-219) : la
   policy actuelle ne porte déjà aucune garde `is_validated` — le correctif
   est déjà en place, rien à rejouer.
2. **`LOCKED`** (pronos match) confirmé état IMPLICITE (calculé via
   `match_is_locked`), jamais écrit ; `VALIDATED` reste le seul état
   terminal stocké.

**Aucune migration propre à T6b** — le seul SQL concerné (policy bracket,
point 1 ci-dessus) est déjà porté par la migration #3 existante.

**État en fin de session** : T6b validé et figé. Prochaine étape : T6c
(Realtime + rendu).

---

## Session du 19/07/2026 (suite — T6c : Realtime + rendu des états actés)

Suite directe. Objectif : T6c, troisième et dernière sous-spec de T6 —
souscriptions Supabase Realtime en surcouche du SSR et rendu de tous les
états déjà actés mais encore non rendus (A1, paris annulés, marquage de
correction, absents/inactifs, barre « toi », bracket, classement, live,
dialogue C2, états vides).

**Spec T6c rédigée et VALIDÉE par l'utilisateur**, dans `Cadrage/V1/` :
- **T6c** — `SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_c.md` (Realtime, rendu).

**Périmètre Realtime scopé** : souscriptions sur `matches` et `series`
uniquement (score/statut/agrégat officiel) — PAS sur `match_predictions`/
`bets`/`brackets`/`bracket_picks`/`user_scores`. La révélation des pronos
d'autrui et les mouvements de classement suivent donc le rythme du rendu
serveur (navigation, `revalidatePath` ciblé), jamais un poussé en direct.

**Convention d'affichage A1 précisée à 3 cas** (déclinaison du pivot NULL/0
de T5 §12.3 au grain cellule) : ABSENCE (« - », aucune ligne de
participation), SCORÉ-ZÉRO (« 0 », ligne scorée à zéro), EN ATTENTE
(marqueur neutre, ligne existante mais pas encore scorée) — les trois se
somment à 0 au total, la distinction ne vit qu'au détail.

**Rendu des états déjà actés fonctionnellement mais jamais implémentés** :
paris annulés (barré + grisé + « neutralisé », visuellement distinct d'un
perdu, dans la liste) ; marquage public de correction (« corrigé par X sur
requête de Y », attribut de ligne, distinct du log d'audit privé) ; joueurs
absents (compteur neutre + liste nominative au clic) ; joueur inactif
(grisé + tag, conservé au classement) ; barre « toi » collante (active
seulement au-delà de 20 joueurs classés) ; bascule bracket résumé/arbre
(mobile = invitation à tourner l'écran, aucune rotation forcée par API) ;
classement (puces de tri, Total et rang toujours sur Total, lignes
dépliables).

**2 décisions actées à la validation (T6c §14)** :
1. **Révélation des pronos NON temps réel** (option a) — le scope Realtime
   reste `matches`/`series` ; étendre à `match_predictions` (option b) est
   explicitement écartée pour la V1, réserve documentée si un besoin réel
   émerge.
2. **`series` confirmé utile dans la publication Realtime** — resserrement
   de l'option « si utile » laissée ouverte par T4 §9 (drill-down série +
   résumé bracket live en dépendent), pas une réouverture ; à refléter dans
   l'activation DB au déploiement (T8), aucune migration T6c.

**Aucune migration produite par T6c.**

**État en fin de session** : T6 est désormais COMPLET (T6a + T6b + T6c, les
3 validées et figées). Prochaine étape : T7 (design system), dernière spec
avant le 1er écran joueur codé.

---

## Session du 19/07/2026 (suite — T7 : design system)

Suite directe, dernière spec technique de la série T1→T7. Objectif : T7,
design tokens (palette, typo, espacements, composants) — direction visuelle
déjà close (0.2.9 §2), acté le 17/07/2026 comme livrable juste avant le 1er
écran joueur.

**Spec T7 rédigée et VALIDÉE par l'utilisateur**, dans `Cadrage/V1/` :
- **T7** — `SPEC_DESIGN_SYSTEM_V0_1.md` (design tokens + règles d'usage).

**Principes actés** : token-first (aucun littéral en dur dans les écrans) ;
thème = jeu de tokens (DARK par défaut, CLAIR un simple override de la même
couche sémantique, jamais lu de couleur brute par un écran) ; deux registres
d'énergie ARÈNE (carte de match, bracket, champion, live) et LECTURE
(classement, admin) ; séparation stricte primitifs/sémantiques ; mobile
d'abord ; accessibilité WCAG AA non négociable.

**Contenu posé** : palette complète (primitifs + tokens sémantiques
dark/clair) ; typographie (une seule famille, chiffres tabulaires pour tout
ce qui est comparé en colonne) ; échelle d'espacement/rayons/élévation
(registre arène plus élevé que le registre lecture) ; tokens du flash B7
(couleur, durée ~1.2s, easing, désactivé sous `prefers-reduced-motion` —
comportement figé par T6c, seule l'apparence est nouvelle ici) ; badges EN
DIRECT et correction admin ; puces de tri du classement ; états spéciaux
(pari annulé, joueur inactif, marqueur « en attente ») ; pastille de logo +
fallback abréviation ; règles d'accessibilité et de responsive (cibles
tactiles ≥44px, focus clavier visible).

**3 décisions actées à la validation (T7 §14)** :
1. **Accent arène = orange broadcast** (`--c-orange-500`), retenu « pour le
   moment » — réversible sans refonte car confiné à la couche de tokens
   sémantiques.
2. **Typographie** : une famille unique open-source à chiffres tabulaires,
   auto-hébergée (extension du principe B4 « pas de hotlink externe » déjà
   appliqué aux logos) — pas de 2e fichier de police en V1.
3. **Pastille de logo neutre CONSTANTE** hors thème
   (`--color-logo-pastille`, identique dark/clair) — seule exception
   assumée au mécanisme d'override de thème, pour garantir la lisibilité
   des logos dans les deux modes.

**Aucune migration produite par T7** — aucun écran, aucun composant, aucune
CSS de production : ce sont des jetons et leurs règles.

**Note de synchronisation documentaire.** T6a, T6b, T6c et T7 avaient été
rédigées et validées au fil de cette même journée mais leurs fichiers
n'avaient pas encore été committés (même situation que T4 lors de la session
précédente) — rattrapé dans le même commit que cette resynchronisation de
`ETAT_ACTUEL.md`/`GAPS_OUVERTS.md`/`JOURNAL_SESSIONS.md`. Les frontières
entre les 4 sous-sessions ci-dessus sont reconstruites depuis l'horodatage
de rédaction des fichiers (11h42 → 15h45 le 19/07/2026), pas depuis
`git log` (aucun commit n'existait encore pour ces fichiers) — à traiter
comme approximatives, dans le même esprit que les sessions antérieures au
16/07/2026 reconstruites a posteriori.

**État en fin de session** : la série de specs techniques **T1 → T7 est
entièrement bouclée et validée**. Aucun code applicatif n'existe encore dans
le dépôt au-delà du scaffold `create-next-app` — toute l'implémentation
(synchro T4, scoring T5, écrans/server actions/Realtime T6, tokens T7) reste
à écrire. Prochaine étape : le 1er écran joueur codé (post-T7, B9/0.2.9 §2).
Voir `ETAT_ACTUEL.md` pour l'état détaillé ; `GAPS_OUVERTS.md` mis à jour
(gaps T6/T7 retirés — désormais couverts par les specs — remplacés par la
phase de CODE post-T7 et par T8/déploiement).

---

## Session du 19/07/2026 (suite — démarrage de l'implémentation post-T7)

Suite directe. Objectif : premier code applicatif du projet, conformément à
la prochaine étape actée (1er écran joueur, post-T7).

**`.env.local` créé** (hors dépôt, déjà couvert par `.gitignore`) : URL +
`anon key` + `service_role key` du projet Supabase V1 (remplies par
l'utilisateur directement dans l'éditeur, pas collées dans le chat — leçon
retenue des 2 incidents de clé API précédents, cf. sessions du 17/07/2026 et
18/07/2026) ; `SYNC_SECRET` généré côté Claude (`crypto.randomBytes(32)`,
64 caractères hex).

**Paquets installés** : `@supabase/ssr`, `@supabase/supabase-js`,
`server-only`.

**3 clients Supabase créés** (`lib/supabase/{browser,server,service}.ts`,
T6a §2.4) : `getBrowserClient` (anon, navigateur), `getServerClient` (anon +
JWT cookies, session utilisateur), `getServiceClient` (`service_role`,
module `server-only`).

**Bug de conception trouvé dans T6a §3 avant d'écrire la moindre route,
corrigé avec l'utilisateur** : l'arbre validé plaçait `leaderboard/page.tsx`
et `bracket/page.tsx` à la fois dans `(public)/` et dans `(app)/`. Comme les
route groups n'apparaissent pas dans l'URL, les deux fichiers auraient
résolu la **même route `/leaderboard`** — erreur de build Next.js
documentée (« Conflicting paths », jamais testée avant le codage puisque
T6a n'avait produit aucun code). **Corrigé** : route physique **unique**,
hors des deux groupes (`app/leaderboard/page.tsx`, `app/bracket/page.tsx`),
qui choisit elle-même la nav (réduite vs 4 onglets) selon la présence d'une
session — aucune règle de lecture/RLS/rendu déjà actée n'est touchée, seul
l'emplacement physique des 2 fichiers change. `SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_a.md`
mis à jour en conséquence (§3, §3.2, §7 — correctifs marqués explicitement
« post-validation », pas une réouverture des décisions de fond).

**2 autres correctifs post-validation, mineurs, mêmes principes** (AGENTS.md :
cette version de Next.js a des ruptures par rapport aux conventions connues,
vérifiées dans `node_modules/next/dist/docs/` avant d'écrire du code) :
- `middleware.ts` renommé `proxy.ts` en Next.js 16 (export nommé `proxy` au
  lieu de `middleware`) — comportement strictement identique, seul le nom
  change. T6a §4.1 mis à jour.
- `cookies()` de `next/headers` est asynchrone depuis Next.js 15/16 → la
  signature de `getServerClient()` posée par T6a §2.4 (synchrone) est
  corrigée en `async`.

**Prochaine étape immédiate** : `proxy.ts` (racine du repo) puis les pages
`(public)/login` et `(public)/signup` (T2) — indispensables avant de pouvoir
tester le moindre écran `(app)`.

Aucune régression sur les décisions fonctionnelles ou de sécurité déjà
actées — uniquement des corrections de forme découvertes au premier contact
avec le code réel.

---

## Session du 20/07/2026 (passe design maquettes V1)

Objectif : éprouver **T7** (design system) sur des écrans réels via des
maquettes HTML jetables (hors dépôt de production, pas intégrées), avant de
coder le 1er écran joueur. Session exclusivement décisionnelle/documentaire
côté cadrage (aucun écran de production codé, aucune CSS de production
écrite) — voir consolidation ci-dessous.

**Écrans maquettés** : Classement (cartes mobile + tableau desktop), Matchs
(cartes + vue repliée), Raccourci pari depuis la carte de match, Nouveau
pari, Accueil, Bracket (Cup). Détail écran par écran, retours et retours des
potes (à venir) : `Cadrage/V1/JOURNAL_DESIGN_passe_maquettes.md` — nouveau
fichier, **source de cette consolidation**.

**Décisions actées cette passe** (consolidées dans les fichiers de cadrage
concernés, détail dans les diffs de la session) :
- Amendement design system T7 → V0.2 (`SPEC_DESIGN_SYSTEM_V0_1.md` §15) :
  accent orange **figé** (réserve « réversible » de §14.1 levée) ; barème de
  rayons « niveau C / net » (`--radius-lg` 4px / `--radius-md` 3px /
  `--radius-sm` 2px / puces 4px / badges 3px, `--radius-full` inchangé) ;
  option biseau **écartée** ; nouveau token `--color-trend` (bleu-froid
  neutre `#9FC6E0`) pour la tendance de forme, jamais vert/rouge (réservés
  aux résultats).
- Raccourci pari depuis la carte de match (`nba_pronos_decisions_0_2_9_ux_ui.md`
  §12) : point d'entrée secondaire « Proposer un pari sur ce match »,
  additif au hub Jouer (structure inchangée), distinct du CTA « Valider le
  prono ».
- Quota des paris personnalisés en NBA Cup précisé
  (`nba_pronos_decisions_nba_cup_mecanique_scoring.md` §6) : 1 pari par
  match, pas de cap « par série » (aucune série en Cup), jusqu'à 7 paris sur
  la phase finale — note de contexte ajoutée en miroir dans
  `nba_pronos_decisions_0_2_4_paris_personnalises.md` §2 pour éviter toute
  lecture erronée du cap Playoffs (« 3 par série ») comme applicable en Cup.
- Clarification (sans modification de règle) : la colonne « Bracket » du
  classement (0.2.6 §5) vaut **aussi** pour la Cup — elle pointe sur le
  **mini-bracket** de phase finale (`nba_cup_mecanique_scoring.md` §2-4).
  Pas de renommage.

**Points laissés ouverts par cette passe** (non tranchés, consignés dans
`GAPS_OUVERTS.md`) : réconciliation des couleurs de statut de prono (0.2.9
§4 vs réservation vert/or de T7 — proposée, non validée) ; forme de saisie
de l'écart (stepper seul vs stepper + pavé numérique) ; vue par défaut de
l'écran Matchs replié ; détail UI de l'indicateur binaire du raccourci pari ;
gains des paris par niveau et forme de progression ; wording/placement du
marqueur « corrigé » au classement ; séparateur visuel du Total (tableau
desktop) ; vue B « arbre » du bracket en plein écran paysage.

**Correction d'un point de contexte** : à toutes fins utiles, les **RLS** et
l'ensemble des **specs techniques T1 → T7** étaient déjà **faites et
validées** avant cette passe design (RLS active et testée de bout en bout
depuis la session du 18/07/2026, T7 validée le 19/07/2026 — voir les entrées
de journal correspondantes ci-dessus et `ETAT_ACTUEL.md`) — au cas où une
note de cadrage antérieure périmée laisserait penser le contraire, ce n'est
plus le cas depuis ces sessions.

**Aucun code de production touché cette session** : les fichiers HTML de
maquette sont des références visuelles jetables, non intégrées au dépôt
applicatif ; T7 reste au statut « aucun token de production écrit », les
valeurs ci-dessus s'appliquent au premier fichier de tokens qui sera créé.

---

## Session du 21/07/2026 (consolidation design — logos, icônes de nav, bandeau)

Reprise du design après la passe maquettes du 20/07/2026 : direction
« décision de consolidation » plutôt que ré-ouverture — objectif de figer les
derniers points mécaniques avant d'écrire le fichier de tokens de production.

**Logos de franchise → SVG bundlés dans le dépôt** (amende
`SPEC_TECHNIQUE_SYNCHRO_V0.1.md` §4, note d'amendement datée ajoutée sans
supprimer le texte acté d'origine) : un SVG par franchise dans
`public/logos/teams/`, nommé `teams.abbreviation` (MAJUSCULES), devient la
**source unique** de l'affichage. Abandon du couple téléchargement au sync +
bucket Supabase Storage : `/api/sync/teams` n'implémente pas cette étape ;
`teams.logo_url` reste en base (commentaire de colonne mis à jour dans
`SPEC_TECHNIQUE_MODELE_DONNEES_V0.1.md`) mais n'est plus lu pour l'affichage
(fallback théorique) ; fallback réel = abréviation en texte. Motif : 30
franchises stables, rendu net, pas de round-trip bucket — le *sourcing des
logos* était un point d'itération ouvert de la synthèse, pas une décision
figée qu'on rouvre.

**Refus de la watermark sur le bandeau + convention d'asset** : le bandeau de
section « parquet » (§15.7) doit utiliser une image **licenciée ou possédée**,
**sans watermark**, hébergée en interne — jamais le base64 des maquettes de
visualisation. Convention posée : `public/brand/hero-parquet.webp` (câblé par
le futur token unique `--hero-image`), placeholder de dev nommé `*.dev.*`
ignoré par git.

**Icônes de nav custom** créées dans `components/icons/nav-icons.tsx` —
variante B « nette » retenue (trait 1.8, coins droits, cohérente avec les
rayons « niveau C » de T7) : maison (Accueil), ballon (Jouer), podium
(Classement — volontairement pas un trophée, pour ne pas entrer en collision
avec la réservation or/champion), silhouette (Profil). Composants server par
défaut, `currentColor` piloté par le parent, décoratifs (`aria-hidden`) sauf
`aria-label` explicite.

**Suivi mis à jour en miroir** : `JOURNAL_DESIGN_passe_maquettes.md` (§1 et
§3), `ETAT_ACTUEL.md` régénéré en entier.

**Points de forme restant à valider avant la consolidation** (fichier de
tokens de production, prochaine session) : nommage `P-DS7` (ou autre) des
tokens, structure du thème (clair/sombre — variables CSS vs objet JS), et
emplacement du fichier (`app/tokens.css` ou autre). Rien de ceci n'est encore
tranché.

### Suite de la même session — consolidation des tokens de production

Les 3 points de forme laissés ouverts ci-dessus ont été tranchés à l'écran
avec l'utilisateur, puis appliqués dans la foulée :

- **Nommage** : convention **P-DS7** (préfixe par famille — `--color-*`,
  `--font-*`, `--space-*`, `--radius-*`, `--elevation-*`, `--motion-*`),
  conforme au principe déjà posé par `SPEC_DESIGN_SYSTEM_V0_1.md` §2.
- **Structure du thème** : **variables CSS**, dark posé sur `:root` (défaut,
  P-DS2) et clair en **override** `[data-theme="light"]` — pas d'objet JS, pas
  de bascule câblée (la bascule elle-même reste un lot séparé).
- **Emplacement du fichier** : `app/tokens.css`, importé en tête de
  `app/globals.css` (`@import "./tokens.css";`, juste après `@import
  "tailwindcss";`).

**Fichier de tokens de production écrit et validé à l'écran** :
`app/tokens.css` implémente la couche primitifs (`--c-*`, jamais lue par un
écran, P-DS5) puis la couche sémantique (`--color-*` et consorts) pour les
deux thèmes, en réconciliant les noms courts des maquettes de la passe du
20/07 avec P-DS7 (`--surface-*` → `--color-surface-*`, `--shadow-*` →
`--elevation-*`, etc. — table consignée en §15.9 de
`SPEC_DESIGN_SYSTEM_V0_1.md`). Là où l'amendement V0.2 (§15 : rayons « niveau
C », surfaces/bordures/texte/accent/élévation « Voie A », tendance
`--color-trend`) redonnait une valeur différente de §3/§5 d'origine, c'est
la valeur V0.2 qui a été retenue. Aucun `@font-face` ajouté (Inter pas encore
auto-hébergée, fallback `system-ui`), aucun asset binaire ajouté
(`--hero-image` pointe vers un asset pas encore fourni, comportement
attendu).

**Suivi mis à jour en miroir (2e passe)** : note d'amendement §15.9 ajoutée à
`SPEC_DESIGN_SYSTEM_V0_1.md`, `JOURNAL_DESIGN_passe_maquettes.md` (section
« Consolidation des tokens »), `GAPS_OUVERTS.md` (point d'implémentation T7 +
petits points d'intégration restants), `ETAT_ACTUEL.md` régénéré en entier.

**État en fin de sous-session (tokens)** : cadrage fonctionnel et design
toujours cohérents avec T1→T7 ; amendements consolidés dans les fichiers de
décision concernés (diffs listés ci-dessus) ; `GAPS_OUVERTS.md` et
`ETAT_ACTUEL.md` mis à jour en conséquence. Le fichier de tokens de
production existe désormais et est importé par `globals.css` ; aucun écran
n'est encore stylé avec. Rappel laissé à l'utilisateur : rien n'est committé
automatiquement, y compris ce lot de tokens — à committer manuellement une
fois vérifié.

### Suite de la même session — écran Accueil : layout 4 onglets + Accueil (T6a §3.1 / SPEC_ECRAN_ACCUEIL_V0.1)

Spec produit `SPEC_ECRAN_ACCUEIL_V0.1.md` (`Cadrage/V1/Spec visuelle/`,
statut **close**, aucun point produit ouvert §10) appliquée telle quelle,
sans rediscussion. Six décisions actées à sa rédaction, reprises telles
quelles au code : **pas de mouvement de rang en V1** (slot `rankMovement`
réservé, toujours `null`) ; **compte à rebours à bascule automatique sous
1h** (composant client autonome, §4.1) ; **feed 48h / 5 items** (constantes
nommées) ; **joueur non participant = même écran** que participant (remplir
un champ vaut inscription, sauf le bracket qui a sa propre deadline unique) ;
**libellés d'états vides fixés** (§8) ; **libellé bracket différencié**
Playoffs (« · N séries ») vs NBA Cup (« · N matchs de phase finale »).

**Layout 4 onglets** (`app/(app)/layout.tsx`) : garde de session (`redirect
/login`) en défense en profondeur du proxy, rend `<TabBar/>`
(`components/nav/TabBar.tsx`, seul autre `"use client"` de l'écran en dehors
de `Countdown`, justifié par l'état "onglet actif" = chemin courant via
`usePathname()`, autorisé explicitement par la spec §1). Câble pour la
première fois les icônes de nav et les tokens de production sur un vrai
écran.

**Lecture** (`lib/queries/home.ts`, `getHomeData()`) : un seul module, RLS
seule autorité (`getServerClient()`), types `HomeHeader`/`TodoItem`/
`FeedItem`/`HomeData` figés à l'identique du contrat de spec. Aucune
migration nécessaire ; noms de colonnes et valeurs de statut lus dans le
schéma réel (migrations #1/#3), pas devinés — voir le détail des déductions
dans `ETAT_ACTUEL.md` §7 et `GAPS_OUVERTS.md`.

**Ambiguïté de spec trouvée et tranchée AVEC l'utilisateur** (pas en
silence, conforme à la méthode habituelle) : §6 de la spec nomme la colonne
`bets.resolved_at` comme source de l'item de feed « Pari statué par
l'admin », mais illustre son rendu par le texte « validé / ajusté », qui
correspond en réalité au workflow de VALIDATION (`validated_at`), une
colonne et une transition différentes. Question posée via
`AskUserQuestion` avec une recommandation motivée ; réponse utilisateur
orientée produit (le feed doit surtout remonter les paris gagnés et les
écarts exacts) qui ne contredisait pas la lecture recommandée. Tranché :
lecture littérale de la colonne citée dans le tableau (`resolved_at`) →
l'item correspond aux paris **ANNULÉS** (`CANCELLED`), cohérent avec la
règle « neutralisé, jamais rouge » déjà actée ailleurs et non-rouvrable
(0.2.4 §4, 0.2.9 §7, T6c §4). Libellé rendu : « Neutralisé » (pas « validé /
ajusté »).

**Countdown.tsx** : seule feuille "use client" de `home/`. Bascule libellé
large (>1h, figé) / décompte vivant (≤1h, mm:ss, `tabular-nums`) /
verrouillé (=0, action désactivée sur place, pas de `revalidatePath`).
Aucun décalage d'hydratation POSSIBLE (pas seulement évité) : l'état est
`null` jusqu'au montage (aucun `Date.now()` lu pendant le rendu), la vraie
valeur n'arrive que par `useEffect` — premier rendu serveur et premier
rendu client pré-hydratation sont donc textuellement identiques par
construction. Ré-arme lui-même son minuteur pour la bascule automatique
sous 1h (délai calculé jusqu'au franchissement du seuil, plafonné à 60s en
mode large, 1s en mode vivant).

**Composants présentationnels** (`components/home/*`, tous serveur sauf
Countdown) : `HomeHeader`, `TodoList`/`TodoRow` (bloc joueur ET bloc admin,
distingués par `item.kind`, teinte `--color-trend` + tag « admin » pour ce
dernier), `Feed`/`FeedRow` (pari annulé = barré + grisé + neutre, jamais
rouge — T6c §4), `EmptyState` (libellés en props, fournis par `page.tsx`).
Aucune valeur visuelle en dur : CSS Modules colocalisés par composant,
lisant exclusivement les tokens sémantiques de `app/tokens.css` — nouvelle
convention de style posée par ce lot (n'existait pas encore dans le dépôt,
les écrans auth restant en Tailwind non stylé T7).

**`app/(app)/home/page.tsx`** : compose en-tête → À traiter (+ bloc admin
si non vide) → Ça vient de tomber ; état vide global si
`competitionId === null` — c'est le rendu actuellement observable, la base
étant toujours vide (§3 `ETAT_ACTUEL.md`).

**Stubs de routes** (pour que les 4 onglets ne 404 pas, non stylés, hors
périmètre de ce lot) : `app/(app)/play/page.tsx`, `app/(app)/profile/
page.tsx`, `app/leaderboard/page.tsx` (route physique unique hors route
groups, cohérente avec le correctif T6a §3.2 de la session du 19/07 —
§2.2 `ETAT_ACTUEL.md`).

**Vérifications finales** : `npx tsc --noEmit`, `npx eslint .`,
`npx next build` tous propres. Pas de Realtime sur cet écran (l'Accueil est
un digest, spec §9 — hors périmètre assumé). Pas de nouvelle dépendance.
Jamais `service_role` dans une lecture d'écran.

**Suivi mis à jour en miroir** : `GAPS_OUVERTS.md` (implémentation Accueil
sortie de « à coder », interprétations d'implémentation ajoutées),
`ETAT_ACTUEL.md` régénéré en entier.

**État en fin de session** : premier écran joueur codé ET stylé aux tokens
de production. `Cadrage/V1/Spec visuelle/SPEC_ECRAN_ACCUEIL_V0.1.md`
entièrement appliquée. Rien n'est committé automatiquement — rappel laissé
à l'utilisateur (commande de commit unique proposée en fin de tâche pour le
lot Accueil : layout 4 onglets, `lib/queries/home.ts`, `components/home/*`,
`components/nav/TabBar.tsx`, stubs de route). Prochaine étape : classement +
bracket partagés (`app/leaderboard`, `app/bracket`, T6a §3.2), premiers
écrans à réutiliser le patron CSS Modules + tokens posé ici.

---

## Session du 22/07/2026 (Classement + Bracket : écrans partagés visiteur/joueur)

Suite directe. Spec produit `SPEC_ECRAN_CLASSEMENT_BRACKET_V0_1.md`
(`Cadrage/V1/Spec visuelle/`, statut **complète**, aucun point produit
ouvert §18, 11 décisions actées à sa rédaction le jour même — récapitulatif
§19) appliquée telle quelle, sans rediscussion.

**Constat de départ** : le prompt de session signalait un stub
`app/(app)/leaderboard/` en conflit avec `app/leaderboard/page.tsx`. Vérifié
en tout premier : ce stub n'existait pas — le correctif de routage (T6a
§3.2, session du 19/07/2026) avait déjà été appliqué en amont, seul
`app/leaderboard/page.tsx` (route physique unique, hors route groups)
existait, en stub minimal. Rien à supprimer ; juste confirmé avant de
coder, conformément à la méthode habituelle (vérifier plutôt que supposer).

**Countdown déplacé** : `components/home/Countdown.tsx` (+ `.module.css`)
→ `components/ui/Countdown.tsx`, désormais partagé Accueil + Bracket avant
deadline (spec §1). Comportement strictement inchangé ; seul import mis à
jour (`components/home/TodoRow.tsx`).

**Nav des routes partagées câblée** (T6a §3.2/§8.1, pas explicitement
détaillé par le prompt mais prescrit par l'archi validée) : ces deux pages
vivent hors `(public)`/`(app)`, donc hors de leurs layouts et de leur nav.
Ajouté `components/nav/PublicNav.tsx` (nav réduite, extraite de l'inline
Tailwind de `(public)/layout.tsx` et re-stylée aux tokens — elle ne l'était
pas encore) et `components/nav/ScreenShell.tsx` (choisit TabBar 4 onglets ou
PublicNav selon la présence d'une session, lue une fois par chaque page).
`(public)/layout.tsx` réutilise désormais `PublicNav` (plus de duplication
de balisage).

**`lib/queries/leaderboard.ts`** : types figés recopiés à l'identique
(§15.1). Lit `user_scores`/`user_recent_form` (vues `security_invoker`,
donc RLS des tables sous-jacentes déjà appliquée — « jamais joué » absent
par construction, sans avoir à le filtrer). Rang calculé sur Total,
départage 1.Total/2.bons vainqueurs/3.écarts exacts/4.bracket (même ordre
que `lib/queries/home.ts`), ex-aequo 1,2,2,4 implémenté par comparaison de
la clé de départage complète entre lignes consécutives d'un tableau déjà
trié. `adminCorrectionsCount` agrégé sur `match_predictions` ET `bets`
(`is_admin_corrected = true`), par joueur.

**`lib/queries/bracket.ts`** : types figés recopiés à l'identique (§15.2).
**Confidentialité pré-deadline implémentée en ne lançant même pas les
requêtes `bracket_picks`/`brackets`** tant que `isDeadlinePassed` est faux
(pas un `if` de rendu — la RLS bloquerait de toute façon ces tables avant
`bracket_deadline_passed()`, mais le code ne s'y fie pas seul). Seuil de
tendance `≥ 11` calculé par série (dénominateur = brackets effectivement
remplis sur CETTE série). `isStructureKnown` dérivé de `series.length > 0`
(même heuristique que `getBracketTodo` de l'écran Accueil pour la Cup avant
qualification). 3 interprétations documentées dans `GAPS_OUVERTS.md`
(non tranchées par la spec, pas des inventions de données) : sémantique de
`filledCount`/`totalCount` (progression du tournoi, pas d'un bracket
individuel — le contrat n'a pas de `userId`), absence du score de série
réel dans le contrat `BracketNode` (vainqueur seul affiché), et le
libellé « or = champion » réservé strictement à la finale (vainqueur de
série normale rendu en vert, jamais en or).

**Composants** — feuilles client EXACTEMENT celles listées par la spec §3
(+ le cas conditionnel `RotateInvite` tranché en NON-client, comme
autorisé) : `components/ui/Countdown.tsx` (inchangé), `components/
leaderboard/{LeaderboardRow,StickyMeBar}.tsx`, `components/bracket/
{SeriesDrillDown,TreeView}.tsx`. `components/bracket/RotateInvite.tsx` et
`components/bracket/NodeCard.tsx` sont des composants SANS "use client"
rendus exclusivement par un parent client (même mécanisme) — zéro
sixième feuille.

**Puces de tri** (`?tri=`) et **bascule vue arbre** (`?arbre=1`) : paramètres
d'URL lus par les `page.tsx` serveur, puces en `<Link>`. Rotation
automatique de la vue B implémentée en écoutant UNIQUEMENT l'événement
`matchMedia("(orientation: landscape)").addEventListener("change", ...)`,
jamais l'état constaté au montage (sinon tout visiteur desktop atterrirait
dans l'arbre). Historique : entrée par rotation → `router.replace`, entrée
par bouton/« voir quand même » → `router.push` ; sortie automatique
(rotation → portrait) seulement si l'entrée était elle-même par rotation,
via une `ref` (pas un state, pour éviter une fermeture périmée dans le
listener). « Voir quand même » mémorisé en `sessionStorage`, lu uniquement
dans les gestionnaires d'événements (jamais pendant le rendu, donc aucune
garde SSR nécessaire au-delà de ça).

**Vérifications finales** : `npx tsc --noEmit`, `npx eslint .` (1 warning
de directive `eslint-disable` inutile trouvé et retiré),
`npx next build` tous propres — **aucun conflit de route** (`/leaderboard`
et `/bracket` résolvent chacun à une seule route dynamique). Testé en
conditions réelles sur le serveur dev déjà lancé par l'utilisateur (port
3001, non redémarré) : `/leaderboard` et `/bracket` rendent 200, affichent
« Aucune compétition en cours » (base toujours vide, comportement attendu),
nav réduite confirmée pour un visiteur anonyme (`Se connecter` présent,
pas la barre 4 onglets) ; `/home` et `/login` non régressés par le
déplacement de `Countdown` et la refonte de `(public)/layout.tsx`.

Confirmé dans le résumé de fin de tâche : confidentialité pré-deadline
gérée dans la requête (pas au rendu) ; feuilles client limitées aux 4
fichiers listés (+ Countdown déjà existant) ; aucune valeur visuelle en
dur ; vert/rouge réservés au résultat, or réservé au champion de la
finale ; rang calculé sur Total quelle que soit la puce ; aucun `if (role)`
de sécurité (la nav visiteur/connecté est un choix d'affichage, la RLS
reste seule autorité de contenu).

**Suivi mis à jour en miroir** : `GAPS_OUVERTS.md` (3 points fermés —
marqueur corrigé, séparateur du Total, vue B arbre — remplacés par les
interprétations d'implémentation ci-dessus), `ETAT_ACTUEL.md` régénéré en
entier.

**État en fin de session** : Classement et Bracket codés et stylés aux
tokens, aucune Realtime sur ces deux écrans (hors périmètre §18, comme
l'Accueil). Rien n'est committé automatiquement. Prochaine étape : hub
Jouer (`app/(app)/play/*` — matchs, bracket personnel/remplissage, paris,
mes pronos).

---

## Session du 23/07/2026 (données de test, correctif RLS Classement, écran Matchs)

Quatre temps dans la même journée : vérification de l'état du dépôt (rien
d'inattendu — le lot du 22/07 était déjà committé, contrairement à
l'hypothèse de départ), correctif post-validation T6b §3.1 déjà appliqué
(vérifié avant de le refaire — rien à faire), un jeu de données de test, et
l'écran Matchs.

**Jeu de données de test** (`scripts/seed-playoffs-test-data.mjs`). Constat :
les 3 écrans de lecture codés n'avaient jamais été observés qu'en état vide
global — aucune preuve que le rendu « rempli » fonctionne. Décision de
méthode discutée AVEC l'utilisateur avant d'écrire quoi que ce soit :
migration SQL ou script séparé ? Tranché pour un script HORS
`supabase/migrations/`, pour deux raisons vérifiées, pas supposées : (a)
`public.users` est alimentée par un trigger depuis `auth.users`, pas par un
INSERT direct — la création de comptes de test passe forcément par l'API
Admin (`auth.admin.createUser`), non exprimable en SQL portable ; (b) ce
dépôt n'a qu'un seul projet Supabase lié, un jeu de données jetable ne doit
pas vivre dans l'historique de migrations rejouable. Contenu : 30 équipes
NBA, 1 compétition Playoffs de TEST (bracket complet 15 séries, 8 réelles au
1er tour), 9 matchs, 7 comptes couvrant les cas produit (brouillon
complet/partiel — ce dernier étant exactement le cas que permet le correctif
T6b §3.1 —, validé, corrigé par un admin avec le workflow rejoué en entier
donc le trigger `enforce_prediction_correction` réellement exercé, joueur
désactivé conservé, joueur n'ayant jamais joué). Aucun résultat ni score nulle
part — ce serait la sortie du moteur T5/de la synchro T4, ni l'un ni l'autre
codé. Appliqué après montre du contenu intégral et accord explicite,
`npx supabase db push` bloqué une première fois par le classificateur de
permissions d'auto mode, relancé après autorisation explicite.

**Correctif RLS — visibilité universelle du Classement** (migration #5,
demandé explicitement par l'utilisateur après avoir testé avec le jeu de
données : « il faut que le classement soit visible tout le temps, par
n'importe qui »). Cause trouvée en testant, pas en lisant la spec : un
joueur normal ne voyait que lui-même au Classement, un admin voyait tout —
`user_scores`/`user_recent_form` étaient en `security_invoker=true` (D4/T3
§7), qui garantissait la VALEUR juste mais pas le ROSTER complet avant tout
verrouillage de match. Corrigé en passant les deux vues en
`security_invoker=false` (leur propriétaire contourne déjà la RLS des
tables qu'il possède, aucune `FORCE ROW LEVEL SECURITY` posée) — elles ne
renvoient que des agrégats, aucune ligne individuelle, la confidentialité
par match/pari/pick reste entièrement inchangée. `admin_corrections_count`
intégré à `user_scores` au passage (2 requêtes séparées en moins dans
`lib/queries/leaderboard.ts`). Documenté comme correctif post-validation
dans `SPEC_TECHNIQUE_RLS_V0.1.md` §11, même traitement que les correctifs
déjà tracés sur T6a/T6b.

**Écran Matchs** (`SPEC_ECRAN_MATCHS_V0_1.md`, close, 16 décisions §19).
Lecture complète de la spec, des conventions Next.js 16 (rien de nouveau —
le patron `useActionState`/Server Actions de `lib/auth/actions.ts`
convenait déjà, mais Next.js documente aussi officiellement le blocage de
navigation via `onNavigate` sur `<Link>`, utilisé pour C2), du schéma et du
code existant AVANT d'écrire une ligne — comme pour les lots précédents.

Deux points bloquants trouvés et tranchés AVEC l'utilisateur avant de coder
(pas de décision seule) :
- le compteur « X/N ont pronostiqué » (§8, censé être visible EN PERMANENCE)
  a le MÊME défaut que le Classement avant correctif, mais PAR MATCH — un
  `count()` en session joueur sous-compte tant que l'appelant n'a pas
  lui-même validé sur CE match précis. Corrigé par une nouvelle fonction
  `SECURITY DEFINER` dédiée (migration #6,
  `count_committed_predictions(p_match)`, même principe que
  `has_committed_prediction()` déjà en base) — ne renvoie qu'un entier,
  jamais une ligne ;
- la règle « pari REJECTED avant/après sa deadline » (0.2.4 §6, raccourci
  pari §10) n'est pas calculable : aucune colonne `rejected_at` en base, et
  `rejectBet` n'existe pas encore (lot « Paris »). Tranché : toujours
  considéré libéré (cas normal — `sealDeadlines` auto-valide tout
  `SUBMITTED` restant à la deadline, un rejet après coup est un cas limite
  hors fonctionnement normal).

Une troisième décision d'architecture demandée en cours de route : étendre
le garde-fou C2 (`lib/hooks/useUnsavedGuard.tsx`, transverse — premier des
trois écrans à saisie perdable) à `components/nav/TabBar.tsx` (fichier
PARTAGÉ par tous les écrans) pour intercepter aussi un clic d'onglet pendant
une saisie en cours, pas seulement la fermeture d'onglet et les liens
internes à l'écran Matchs. Accepté par l'utilisateur avant modification.
Piège trouvé en le câblant : `TabBar` est AUSSI rendu par
`components/nav/ScreenShell.tsx` (Classement, Bracket — hors de
`app/(app)/layout.tsx`, donc sans le nouveau `UnsavedGuardProvider`) —
`useGuardedNavigation()` se dégrade en no-op si le contexte est absent
plutôt que de lever, sinon ces deux écrans auraient cassé pour un visiteur
connecté. Trouvé en traçant les usages AVANT de tester, pas en cassant puis
réparant.

Trois feuilles client exactement (`MatchRow`, `PredictionForm`,
`ValidateAllBanner`), le reste sans `"use client"` propre (rendu par un
parent client, même mécanisme que `NodeCard`/`SeriesGroups` du bracket).
Confidentialité dans la requête, pas le rendu : même patron que
`getBracket()`, `others`/`absentees` vides côté serveur tant que
`isRevealed` est faux — qui se simplifie ici à `isAdmin OR VALIDATED`
puisque cet écran ne montre structurellement jamais un match verrouillé.
Stepper d'écart : case vide au départ, jamais de pré-remplissage, `−`
inactif tant que vide, pavé numérique implémenté via un `<input
type="number" inputMode="numeric">` (clavier système, pas une grille
maison). Fenêtre filtrée sur `scheduled_at`, jamais sur `status`.
Regroupement par jour en fuseau Europe/Paris, choix explicite documenté
(aucune convention de fuseau n'existait ailleurs dans le code).

Deux pièges techniques trouvés en cours de route, hors du périmètre produit :
- ESLint `react-hooks/set-state-in-effect` refuse un `setState` directement
  au premier niveau d'un `useEffect` — y compris pour relire l'horloge
  seulement après montage (patron déjà utilisé par `Countdown.tsx`, qui y
  échappait parce que son `setState` vit dans une fonction nommée `tick`
  appelée depuis l'effet). Résolu en enveloppant chaque `setState` d'effet
  dans une petite fonction nommée ;
- en testant les mécaniques d'écriture (upsert partiel, RLS post-validation)
  directement en session réelle (pas de navigateur disponible pour cliquer
  les vrais boutons), une tentative de ré-écriture d'un prono déjà
  `VALIDATED` a semblé « acceptée » (`error: null`) — en réalité 0 ligne
  affectée (RLS `mp_update_self` qui exige `status='DRAFT'`, un `UPDATE`
  matchant 0 ligne n'est PAS une erreur PostgREST). Revérifié avec
  `.select()` + comptage : bien 0 ligne, la garde fonctionne. Leçon
  générale : ne jamais conclure d'un test RLS sur la seule absence
  d'erreur.

**Vérifications finales** : `npx tsc --noEmit`, `npx eslint .`,
`npx next build` tous propres, aucun conflit de route. Testé avec de VRAIES
sessions authentifiées, cookies SSR générés via `@supabase/ssr` (le même
paquet que l'app, pas des cookies reconstruits à la main) faute de
navigateur disponible : fenêtre 3 jours correcte (5 matchs sur 9, le
`scheduled_at` NULL et les 3 hors fenêtre absents), regroupement par jour
correct, 4 statuts observés sur des joueurs réels différents, brouillon
partiel confirmé persistant après relecture, confidentialité confirmée des
deux côtés (Amine92 : seulement ses 3 matchs révélés, rien qui fuite sur les
2 autres ; Sofia_Admin : tout révélé), bandeau « Tout valider » apparaît
uniquement quand `readyCount > 0` (Chloe_B), `/home`/`/leaderboard`/`/bracket`
non régressés par l'extension de `TabBar`/`layout.tsx`. Non testé : le clic
réel sur les boutons et le dialogue C2 dans un vrai navigateur (aucun outil
de navigateur disponible cette session) — laissé explicitement comme limite,
pas caché.

**Suivi mis à jour en miroir** : `GAPS_OUVERTS.md` (Matchs sorti de « spec
close, pas codé », interprétations d'implémentation ajoutées, destination du
raccourci pari et règle REJECTED précisées, nettoyage du jeu de test ajouté
au périmètre T8), `ETAT_ACTUEL.md` régénéré en entier,
`SPEC_TECHNIQUE_RLS_V0.1.md` complétée §11.

**État en fin de session** : Accueil, Classement, Bracket et Matchs — les
quatre premiers écrans du hub joueur — sont codés, stylés aux tokens, et
pour la première fois testés avec un vrai jeu de données plutôt qu'en état
vide global. Deux correctifs RLS post-validation (migrations #5 et #6), tous
deux documentés et tous deux trouvés en testant réellement, pas en relisant
le code. Rien n'est committé automatiquement, sauf le correctif RLS du
Classement (migration #5 + code + doc), committé par Claude à la demande
explicite de l'utilisateur après un « ok go » — écart ponctuel à la
convention « l'utilisateur committe lui-même », signalé comme tel sur le
moment. Prochaine étape : « Mes pronos » (ancré sur les matchs, porte le
live), puis Paris, puis Bracket personnel.

---

## Session du 24/07/2026 (retours du premier test utilisateur réel : logos, déconnexion)

Courte session de compléments. L'utilisateur a testé l'écran Matchs lui-même
dans un vrai navigateur (premier test au clavier/souris de toute la V1,
jusque-là tout avait été vérifié par Claude via cookies SSR reconstitués) et
a remonté deux points, plus une vérification de suivi en fin de session.

**Logos de franchise absents — erreur commise puis corrigée.** Première
réponse de Claude à la question de l'utilisateur : « les fichiers ne sont
pas déposés » — **fausse**, tirée d'une note de `ETAT_ACTUEL.md` sans
vérifier le disque. L'utilisateur a repoussé (« il me semble que j'ai déjà
déposé les logos »), Claude a vérifié `public/logos/teams/` : les 30 SVG
existent bel et bien et sont déjà committés depuis le 21/07/2026. La vraie
cause, cette fois vérifiée par recherche dans le code (0 occurrence de
`logos/teams` ou `logo_url` avant ce jour) : aucun écran ne les référence,
jamais. Leçon retenue et écrite dans `ETAT_ACTUEL.md` §5 : une note de suivi
décrit un état passé, pas une preuve présente — vérifier le disque avant
d'affirmer qu'un fichier n'existe pas.

Décision de périmètre discutée avant de coder : câbler les logos partout
(4 écrans) ou seulement où c'est structurellement possible ? Réponse de
Claude, demandée explicitement (« tu en penses quoi ? ») : seuls Bracket et
Matchs ont un objet équipe structuré (`TeamRef`/`BracketNode.teamA/teamB`) ;
Accueil ne porte les équipes que dans du texte déjà formaté et Classement
n'affiche aucune équipe — les étendre aurait demandé de restructurer des
contrats de types déjà livrés. L'utilisateur a suivi la recommandation, en
demandant explicitement que le point Accueil/Classement soit noté en gap
ouvert plutôt qu'oublié.

`components/ui/TeamLogo.tsx` (nouveau, partagé) : chemin déduit de
`teams.abbreviation` (`/logos/teams/{ABBRÉVIATION}.svg`) — aucun champ
ajouté aux contrats de types figés des specs, aucune colonne base consommée
(`teams.logo_url` reste vide). `next/image` avec la prop `unoptimized`
(Next.js bloque l'optimisation SVG par défaut, aurait demandé
`dangerouslyAllowSVG` + CSP dans `next.config` — évité, documenté par
Next.js pour ce cas précis). Repli sur l'abréviation texte via `onError` si
un fichier venait à manquer. Câblé dans `NodeCard.tsx` (Bracket) et
`TeamPicker.tsx`/`MatchRow.tsx` (Matchs). Vérifié avec de vraies sessions
authentifiées : chemins corrects dans le HTML rendu, fichier réellement
servi par le serveur (200, `image/svg+xml`).

**Aucun moyen de se déconnecter.** Deuxième remontée de l'utilisateur, avec
sa propre hypothèse (« c'est peut-être une fonctionnalité de Profil, pas
codé »). Vérifié : `logout()` existe dans `lib/auth/actions.ts` depuis le
tout début de la V1 mais n'a jamais été câblée sur aucun bouton, aucun
écran — l'hypothèse de l'utilisateur était juste. Sur sa demande explicite
(« ajoute-le de manière temporaire, toujours en traçant »), ajout d'un
bouton dans `app/(app)/layout.tsx` (coin haut-droit, bordure pointillée,
texte muted — volontairement pas fini pour signaler visuellement son
caractère temporaire, pas seulement dans le code). Testé de bout en bout
SANS JavaScript ni navigateur : un `<form action={logout}>` sans JS poste en
réel vers l'URL courante avec un champ caché `<input type="hidden"
name="$ACTION_ID_...">` dont le NOM (pas la valeur) identifie l'action —
rejoué avec `curl -F "$ACTION_ID_...=" ...` + les cookies de session,
confirmé : `303 → /login`, cookie de session effacé (`Max-Age=0`). Ne
couvre que la zone `(app)` (Accueil/Jouer/Matchs/Profil), pas
`/leaderboard`/`/bracket` (`ScreenShell`, hors de ce layout) — signalé,
pas étendu sans le demander.

**Vérification de suivi demandée par l'utilisateur** (« tu as bien mis à
jour tous les fichiers de suivi ? ») : réponse honnête après vérification
réelle (`git show --stat` sur les deux derniers commits) — non. Les deux
compléments (logos, déconnexion) avaient chacun mis à jour
`GAPS_OUVERTS.md` seul, ni `ETAT_ACTUEL.md` ni ce journal n'avaient bougé
depuis le lot Matchs du 23/07/2026. Corrigé dans la foulée : `ETAT_ACTUEL.md`
régénéré en entier (nouveau §2.9, mentions ajoutées dans §1/§2.3/§2.5/§2.8/
§4/§5/§6/§7), cette entrée de journal ajoutée.

**Vérifications finales** : `npx tsc --noEmit`, `npx eslint .`,
`npx next build` propres après chaque changement (logos, puis déconnexion).
Aucune migration, aucun changement de schéma. Committé par Claude
(confirmé par l'utilisateur à chaque fois, pattern désormais établi depuis
le « ok go » du 23/07) : un commit pour les logos, un commit pour le bouton
de déconnexion temporaire + sa note de suivi.

**État en fin de session** : les 4 écrans du hub joueur sont maintenant
visuellement plus proches de leur cible (logos réels au lieu du texte seul),
et testables en continu par l'utilisateur (déconnexion possible, même
temporairement). Un point de méthode retenu pour la suite : vérifier le
disque avant d'affirmer un état de fichier, et mettre à jour LES TROIS
fichiers de suivi à chaque lot, même les petits — pas seulement
`GAPS_OUVERTS.md`. Prochaine étape inchangée : « Mes pronos ».

---

## Session du 24/07/2026 (suite — hub Jouer temporaire)

Suite directe. Constat : l'écran Matchs est codé et vérifié (§2.8/§2.9) mais
inaccessible depuis l'UI — l'onglet « Jouer » pointait sur
`app/(app)/play/page.tsx`, resté stub « à venir » depuis le début. Lot court
et explicitement TEMPORAIRE, demandé pour pouvoir naviguer et tester, en
attendant le vrai hub Jouer (spec d'écran dédiée, non écrite, hors périmètre
de ce lot).

**Fait** : `app/(app)/play/page.tsx` remplacé — composant SERVEUR (aucun
`"use client"`, rien ici n'en a besoin), liste de 4 entrées reprises de
l'arbre `app/` de `SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_a.md` : « Matchs »
en `<Link>` actif vers `/play/matches` ; « Mes pronos », « Mon bracket »,
« Paris » rendues INERTES (pas de `<Link>`, pour éviter un 404 — leurs routes
`/play/my-predictions`, `/play/bracket`, `/play/bets` n'existent pas encore),
libellé « à venir ». `page.module.css` colocalisé, lisant exclusivement les
tokens sémantiques de `app/tokens.css` (aucune valeur en dur).

Marqué TEMPORAIRE aux trois endroits, même patron que le bouton de
déconnexion (§2.9) : commentaire dans le code (`page.tsx`,
`page.module.css`), mention visible dans le rendu (« Hub temporaire — sera
remplacé »), entrée dans `GAPS_OUVERTS.md`. Aucune pastille « à faire »
calculée — hors périmètre, rôle du vrai hub. Aucun autre fichier touché
(TabBar, layout, migrations, dépendances inchangés).

**Vérifications finales** : `npx tsc --noEmit`, `npx eslint .`,
`npx next build` tous propres, aucun conflit de route (`/play` toujours
listé seul dans la carte des routes générée par le build). Aucune migration,
aucun changement de schéma.

**État en fin de session** : les 4 onglets de la nav mènent désormais quelque
part de cohérent — plus de cul-de-sac sur « Jouer ». `ETAT_ACTUEL.md` et
`GAPS_OUVERTS.md` mis à jour en conséquence. Prochaine étape inchangée :
« Mes pronos » (le vrai hub Jouer reste, lui, à spécifier avant d'être codé).

---

## Session du 24/07/2026 (suite — lot « Mes pronos », 5 étapes)

Suite directe. Objectif : coder l'écran « Mes pronos », cinquième écran du
hub joueur, deuxième écran qui écrit, premier qui porte le live — conduit en
5 étapes actées d'avance (lecture seule → labels → migrations → lecture/
écriture → écran/composants), avec arrêt et validation explicite après
chacune.

**ÉTAPE 0 (lecture seule, vérifications de dépôt §18)** : les 3 points
étaient déjà corrects — `TeamRef` importable tel quel ; la policy SELECT sur
`correction_requests` existait déjà (contrairement à ce que la spec
envisageait comme probable) ; les triggers T-b/T-c acceptent un UPDATE admin
sur une ligne vide (aucune garde de complétude dans leur code) ;
`count_committed_predictions` filtre bien `status <> 'DRAFT'`. Une requête
réelle en base a en revanche montré 0 match verrouillé (`scheduled_at <=
now()`) — l'écran aurait été invérifiable. Signalé sans coder, décidé AVEC
l'utilisateur (« 1. Oui ») d'étendre le seed plutôt que d'inventer un
contournement. `scripts/seed-playoffs-test-data.mjs` étendu : 3 matchs
existants (déjà porteurs de pronos significatifs — Yanis44 corrigé,
Marco_D désactivé) passés dans le passé plutôt que d'en créer de nouveaux,
un seul prono ajouté (Nina_R, partiel, pour couvrir le cas INCOMPLETE
verrouillé). Le script ET la base déjà seedée ont été alignés (3 UPDATE +
1 INSERT ciblés, non destructifs) — un wipe/reseed complet aurait exigé de
supprimer et recréer les 7 comptes auth, jugé disproportionné pour 3 lignes.

**ÉTAPE 1** : `lib/labels/rounds.ts` créé (extraction pure de `ROUND_LABELS`
depuis `lib/queries/bracket.ts`, qui le portait en dur), importé par les deux
écrans. Refactor isolé, aucun libellé changé, revérifié seul avant de
poursuivre.

**ÉTAPE 2** : 2 migrations montrées intégralement, confirmées avant push.
#7 (`request_prediction_correction`, SECURITY DEFINER, voie A du §10.2 —
crée une ligne `match_predictions` vide + sa requête de correction en une
transaction si aucune ligne n'existe, sinon réutilise l'existante ; tous les
garde-fous du §10.3 dans la fonction, justification du contournement RLS en
commentaire dans le fichier). #8 (`alter publication supabase_realtime add
table matches`, uniquement `matches`, `series` reporté au lot Bracket
personnel). Les deux vérifiées après push par un appel direct (garde
d'authentification confirmée en aveugle avant le test en conditions réelles
de fin de session).

**ÉTAPE 3** : `lib/queries/my-predictions.ts` (types §13 recopiés à
l'identique) + `lib/actions/corrections.ts`. **Ambiguïté réelle trouvée en
codant, hors du tableau fermé §8, tranchée AVEC l'utilisateur avant
d'écrire la fonction de dérivation** : `sealDeadlines` (l'auto-validation
DRAFT complet → VALIDATED décrite par T6b §2) n'est invoquée nulle part
dans le code de ce dépôt (vérifié par recherche — aucun cron, aucune
fonction de ce nom, seulement des commentaires qui la mentionnent comme
hypothèse). Une ligne DRAFT aux deux champs remplis (joueur qui a rempli son
prono sans avoir cliqué « Valider » avant le verrouillage) est donc un 4e cas
réel, non prévu par les 3 états du tableau. Tranché : la complétude prime
sur le statut brut → rendu FROZEN, appliqué symétriquement à mon prono et à
ceux des autres joueurs.

**ÉTAPE 4** : `app/(app)/play/my-predictions/page.tsx` +
`components/my-predictions/*`. **Second point d'ambiguïté, également
signalé et tranché AVEC l'utilisateur avant de continuer** : `TeamLogo.tsx`
(partagé Bracket/Matchs depuis le 24/07 précédent) n'avait jamais sa PROPRE
directive `"use client"` — il ne fonctionnait que parce que ses 2 points
d'appel existants sont TOUJOURS atteints via un ancêtre client, une
coïncidence jamais vérifiée explicitement. `MatchRowStatic` (serveur, sans
ancêtre client) l'utilise directement pour la première fois. Recommandation
de Claude (corriger le composant partagé à la source plutôt que vérifier
empiriquement d'abord) suivie par l'utilisateur : `"use client"` ajouté
directement à `TeamLogo.tsx`, sans changement de rendu pour Bracket/Matchs
(confirmé par `next build`). Un seul fichier client pour l'écran :
`LiveSubscriber.tsx`, qui exporte à la fois le Provider (souscription
Realtime unique, Context React) et un consommateur (`LiveBadgeAndScore`) —
patron nécessaire pour qu'un canal unique mette à jour le contenu de lignes
par ailleurs entièrement serveur, jamais rencontré avant sur ce projet.
Formulaire de correction natif, erreur portée par l'URL de redirection
(un formulaire sans JS ne peut pas lire une valeur de retour).

**Vérifications ÉTAPES 1-4** : `npx tsc --noEmit`, `npx eslint .`,
`npx next build` tous propres après chaque étape, aucun conflit de route.

**ÉTAPE 5 — test en conditions réelles, demandé explicitement par
l'utilisateur avant le suivi/remise** : serveur local (`next start`) +
sessions authentifiées réelles, obtenues en rejouant le vrai POST sans JS du
formulaire de connexion. Trouvaille technique en cours de route : React
19/Next 16 encodent le repli sans JS d'un `useActionState` (login, signup)
DIFFÉREMMENT d'un simple `<form action={fn}>` sans état lié (logout,
requête de correction) — 4 champs cachés distincts au lieu d'un seul,
jamais rencontrés jusqu'ici. Deux mots de passe temporaires posés via l'API
Admin (Amine92, Marco_D), jamais affichés dans le chat, re-randomisés en fin
de session.

Résultats, tous conformes à la spec : fenêtre Récent correcte, badge EN
DIRECT + score et score final rendus correctement, prono FROZEN de Marco_D
(désactivé) bien conservé, panneau des autres joueurs avec le rendu
nominatif exact du §7.1. **Écriture réelle testée** : dépôt d'une requête de
correction par Amine92 sur un match sans prono → ligne vide + requête
PENDING créées exactement selon la voie A, rechargement affichant bien
« Requête en attente. ». **Cas négatif testé** : la même tentative par
Marco_D (désactivé) bloquée par la garde `is_active()` de la fonction SQL,
erreur affichée dans la bonne ligne au rechargement — le mécanisme complet
(garde-fou base + remontée d'erreur sans JS) vérifié dans les deux sens.
Aucune régression sur les écrans déjà codés.

**Trouvaille distincte, demandée explicitement par l'utilisateur en fin de
test** (« tu vas me dire si oui ou non la création de compte fonctionne ») :
le vrai flux d'inscription (`/signup`) a été testé pour la première fois de
bout en bout sur ce projet — jusqu'ici les 7 comptes de seed avaient tous
été créés via l'API Admin, qui ne passe jamais par l'envoi d'email. Le code
est correct (vérifié en isolant l'appel `signUp()` seul) mais échoue avec
« 429 — email rate limit exceeded » : conséquence directe d'un point déjà
connu et déjà tracé (« désactiver Confirm email », `GAPS_OUVERTS.md`/
`ETAT_ACTUEL.md` §6, jamais fait) — ce n'était simplement jamais apparu
puisque personne n'avait encore essayé le vrai formulaire public. Rapporté
honnêtement comme un gap PRÉEXISTANT et déjà documenté, pas une régression
introduite ce jour. Aucun compte orphelin créé (vérifié via l'API Admin).

**Suivi mis à jour en miroir** : `ETAT_ACTUEL.md` régénéré en entier (nouveau
§2.11, §1/§3/§4/§6/§7 mis à jour), `GAPS_OUVERTS.md` (« Mes pronos » sorti des
points ouverts, gap ajouté sur l'alignement du badge de correction de
l'écran Matchs, gap ajouté sur la publication Realtime de `series`, section
des interprétations d'implémentation complétée), cette entrée de journal.
`SPEC_ECRAN_MES_PRONOS_V0_1.md` marquée CLOSE (les 3 vérifications de §18
levées en ÉTAPE 0).

**État en fin de session** : cinq écrans du hub joueur codés et vérifiés
(Accueil, Classement, Bracket, Matchs, Mes pronos), le premier avec Realtime
et une écriture testée en conditions réelles dans les deux sens (succès et
échec de garde-fou). Rien n'est committé automatiquement — les commandes
sont montrées à l'utilisateur, qui committe lui-même. Reste en base, artefact
de test légitime non nettoyé : 1 requête PENDING (Amine92/DEN-SAC) + sa ligne
vide associée. Prochaine étape : « Paris » (fixera la destination du
raccourci pari) ; le point « désactiver Confirm email » a gagné en urgence
pratique (rate limit désormais rencontré, pas seulement théorique).

---

## Session du 25/07/2026 (correctif pastille de logo)

Suite directe. L'utilisateur a remonté, en testant l'écran Mes pronos, que la
pastille neutre censée être posée derrière chaque logo (`SPEC_DESIGN_SYSTEM_
V0_1.md` §10.1, acté §14.3) ne s'affichait pas — le logo apparaissait nu.
D'abord noté dans `GAPS_OUVERTS.md` sur demande explicite (sans corriger),
vérifié contre la spec pour confirmer que le gap était réel et pas juste une
impression : `components/ui/TeamLogo.tsx`/`.module.css` (créé §2.9 le
24/07/2026) n'avait effectivement jamais porté de fond — un oubli depuis sa
création, jamais rattrapé pendant le lot « Mes pronos » qui réutilisait le
même composant.

**Correctif demandé et conduit en 3 étapes précises fournies par
l'utilisateur** (fichiers exacts, contenu exact, ordre exact — Claude a
vérifié chaque prérequis avant d'exécuter, montré chaque diff, attendu
confirmation avant l'étape suivante) :
1. `app/tokens.css` : un token ajouté, `--color-logo-pastille-text`
   (texte du repli abréviation, sombre CONSTANT sur la pastille claire
   constante).
2. `components/ui/TeamLogo.module.css`/`.tsx` réécrits : nouveau conteneur
   `.pastille` (fond + cercle + padding, `size` = diamètre), logo et repli
   abréviation désormais inscrits DEDANS plutôt que de porter leur propre
   fond. Empreinte visuelle inchangée (`box-sizing: border-box`).

**Vérifications** : `npx tsc --noEmit`, `npx eslint .`, `npx next build`
tous propres. Aucun autre fichier touché (aucun appelant de `TeamLogo`
modifié). Committé par Claude à la demande explicite de l'utilisateur
(« tu peux le faire »).

**Suivi mis à jour en miroir** : `GAPS_OUVERTS.md` (gap retiré, désormais
traité), `ETAT_ACTUEL.md` (nouveau §2.12, renumérotation de « Prochaine
étape » en §2.13, mention ajoutée sur la fiche `TeamLogo.tsx` du §4), cette
entrée de journal.

**État en fin de session** : la pastille neutre s'affiche désormais derrière
tous les logos, sur les 3 écrans qui utilisent `TeamLogo` (Bracket, Matchs,
Mes pronos) — un seul composant partagé corrigé une seule fois. Prochaine
étape inchangée : « Paris ».

---

## Session du 25/07/2026 (suite — entête Matchs + correctif des 30 logos)

Suite directe. Série de petites retouches demandées par l'utilisateur en
testant l'écran Matchs dans un vrai navigateur, chacune conduite séparément
(JSX/CSS montrés en diff, vérifiée `tsc`/`eslint`/`build`, attente de
confirmation avant la suivante).

**Refonte de l'entête replié de `MatchRow.tsx`** (variante A « split
neutre ») : les deux `<TeamLogo>` disparaissent du bandeau replié, remplacés
par un split 2 colonnes (grosse abréviation par équipe + séparateur
vertical) ; l'heure/le verrou et le statut/chevron passent d'une grille à 4
colonnes sur une ligne à deux zones empilées (`.split` puis `.metaRow`
séparée par une bordure). Comportement d'ouverture, `PredictionForm` et
`TeamPicker` non touchés. Avant d'écrire quoi que ce soit, Claude a affiché
le JSX/CSS existants et attendu confirmation — puis, avant de coder, est allé
lire `TeamPicker.module.css` pour reprendre EXACTEMENT le même token de
taille d'abréviation (`--font-size-lg`) plutôt que d'en inventer un.

**`TeamPicker.tsx`** (carte dépliée) : logo agrandi 32 → 48px puis, sur
demande suivante, abréviation retirée de cette carte (ne restent que le logo
et le nom complet) — l'abréviation ne vit plus que dans l'entête replié,
la répéter aux deux endroits n'avait plus de sens une fois le split en place.

**Correctif des 30 logos de franchise — trouvaille la plus substantielle de
cette session.** L'utilisateur a remonté que les logos paraissaient
décentrés dans leur pastille (certains trop hauts, d'autres trop à gauche),
de façon variable selon l'équipe. Claude a d'abord répondu avec une
explication INCOMPLÈTE (proportions différentes entre logos) sans avoir lu
le contenu réel des fichiers — l'utilisateur a explicitement poussé
(« prends l'exemple des Spurs, la boîte est toute petite en hauteur, non ? »),
ce qui a mené à ouvrir vraiment le fichier SAS.svg : ses tracés ne dépassent
jamais y≈180 alors que son `viewBox` déclare une hauteur de 399.5 — plus de
la moitié du canevas est un vide jamais dessiné, ce qui pousse mécaniquement
le logo visible vers le haut de sa pastille malgré un CSS de centrage par
ailleurs correct (`object-fit: contain`).

Correctif proposé et validé AVANT d'être écrit : un script Node jetable
(aucune dépendance ajoutée, aucun navigateur) qui parse les commandes de
tracé SVG (M/L/H/V/C/S/Q/Z — vérifié par recherche qu'aucun arc n'apparaît
dans les 30 fichiers avant d'écrire le parseur, pour ne pas avoir à le
supporter), échantillonne les courbes de Bézier à 32 points pour approximer
leurs extrêmes, calcule la boîte englobante RÉELLE du dessin de chaque logo
(tracés + polygones + rects + cercles), puis réécrit son `viewBox` pour
coller au dessin (marge uniforme 4 %). Exécuté d'abord en dry-run (tableau
des 30 `viewBox` avant/après montré intégralement), écriture réelle
seulement après confirmation explicite. Neuf fichiers (ATL/DEN/DET/IND/LAC/
MIN/PHI/TOR/WAS) partageaient un `viewBox` identique au chiffre près — signe
d'un gabarit d'export commun, cohérent avec le diagnostic. Chaque fichier
n'a eu qu'UNE seule ligne modifiée (l'attribut `viewBox`), confirmé par
`git diff --stat`. **Confirmé visuellement par l'utilisateur** après coup :
logos bien centrés.

**Vérifications** : `npx tsc --noEmit`, `npx eslint .`, `npx next build`
tous propres après chaque étape. Aucun fichier touché en dehors de
`MatchRow.tsx`/`.module.css`, `TeamPicker.tsx`/`.module.css` et les 30 SVG.
Rien committé — laissé à l'utilisateur.

**Suivi mis à jour en miroir** : `ETAT_ACTUEL.md` (nouveau §2.13, « Prochaine
étape » renumérotée §2.14, fiches `MatchRow.tsx`/`TeamPicker.tsx`/`logos/
teams/` du §4 mises à jour, nouveau piège technique en §7 sur le décentrage
logo/viewBox). `GAPS_OUVERTS.md` : rien à modifier, aucun point resté ouvert
sur ce lot. Cette entrée de journal.

**État en fin de session** : entête Matchs conforme à la variante demandée,
carte dépliée simplifiée (logo + nom, sans redite d'abréviation), les 30
logos de franchise correctement centrés dans leur pastille sur les 3 écrans
qui les utilisent. Prochaine étape inchangée : « Paris ».

---

## Session du 25/07/2026 (suite — commit/push + amendements de specs)

Suite directe, session courte et exclusivement documentaire (aucun code
touché). L'utilisateur a demandé de committer et pousser le lot précédent,
puis de mettre à jour les fichiers de suivi ET les deux specs amendées.

**Commit/push** : le lot « entête Matchs + correctif des 30 logos » (§2.13
de `ETAT_ACTUEL.md`) committé (`5956966`) et poussé sur `main`, à la suite de
`483a9fb` (pastille) et `d73498b` (Mes pronos). Seul `Cadrage/nba-pronos.lnk`
(raccourci Windows) reste volontairement de côté, comme à chaque fois.

**Point bloquant trouvé en relisant le delta demandé, signalé AVANT
d'écrire quoi que ce soit** : la demande fournissait un point à ajouter dans
`GAPS_OUVERTS.md` comme « ouvert » — « normalisation des 30 SVG… tâche asset
côté utilisateur » — décrit comme la cause du décentrage. Or ce décentrage
avait déjà été corrigé (script de bounding box) ET confirmé visuellement par
l'utilisateur lui-même dans la session précédente. L'écrire tel quel aurait
effacé, dans le fichier qui fait autorité, un travail fait et confirmé.
Claude s'est arrêté et a posé la question (AskUserQuestion) plutôt que de
choisir en silence entre « exécuter tel quel » et « ignorer la demande » :
confirmé qu'il s'agissait en réalité d'un point DIFFÉRENT et réel — les 30
`viewBox` sont désormais bien centrés sur leur propre dessin, mais pas
uniformément CARRÉS entre eux, donc les logos très larges (SAS) apparaissent
plus petits/plus fins dans leur pastille que les logos plus carrés (LAL).
Reformulé en conséquence avant d'écrire.

**Amendements consignés DANS les specs elles-mêmes** (pas seulement dans
`ETAT_ACTUEL.md`), demandé explicitement par l'utilisateur :
- `SPEC_DESIGN_SYSTEM_V0_1.md` §16 (nouveau, après §15) : §10.2 précisé — le
  tier `--logo-size-lg` (48px, « moment fort ») se déplace de l'entête de
  match (qui n'a plus de logo du tout) vers la carte-sélecteur `TeamPicker` ;
  provenance réelle des logos clarifiée (déposés à la main par l'utilisateur,
  indépendants de Highlightly/B4 cité au préambule de §10, jamais implémenté
  côté synchro) ; le test de pastille à 50 % (essayé puis abandonné avant
  tout commit) explicitement noté comme NE constituant PAS un amendement de
  §10.1/§14.3.
- `SPEC_ECRAN_MATCHS_V0_1.md` §20 (nouveau, après §19) : le mockup de §3.1
  (`[logo] BOS – MIA …`) annoté inline (même patron que l'amendement V0.2 de
  T7 — annotation sous l'original, rien réécrit en place) puis détaillé dans
  une section dédiée ; ligne 17 ajoutée au récapitulatif §19.

**Fichiers de suivi régénérés en entier** (pas résumés, pas coupés) :
`ETAT_ACTUEL.md` (§2.13 corrigé — n'était plus « non committé » depuis le
push —, nouveau §2.14 recensant commit/push + amendements + clarification du
gap, « Prochaine étape » renumérotée §2.15, listing `Cadrage/V1/` mis à
jour) ; `GAPS_OUVERTS.md` (3 points ajoutés : tailles inégales entre logos,
cohérence des tailles entre écrans, piste « logo encore plus grand » non
tranchée) ; cette entrée de journal.

**État en fin de session** : les 3 fichiers de suivi et les 2 specs
amendées reflètent fidèlement l'état réel du code ET des décisions prises,
sans qu'aucun travail déjà confirmé n'ait été rouvert par erreur. Prochaine
étape inchangée : « Paris ».

---

## Session du 26/07/2026 — Écran Nouveau pari (« Paris »), spec close + migrations + code

Premier écran du lot « Paris » (ferme la destination du raccourci pari,
`GAPS_OUVERTS.md`). `SPEC_ECRAN_NOUVEAU_PARI_V0_1.md` était marquée
**BROUILLON** en tête de fichier au moment du prompt de lancement — Claude
s'est arrêté avant toute ligne de code (règle du dépôt : spec validée avant
code), a signalé le blocage, et a proposé 3 options. L'utilisateur a choisi
de trancher les points ouverts plutôt que de reporter.

**Clôture de la spec** (AskUserQuestion, 3 points de son §16) : défauts de
brouillon = `PLAYER_PROP` / difficulté 3 (§5.4) ; cible figée en édition —
`scope`/`series_id`/`match_id` non modifiables une fois le pari créé, un
nouveau pari pour viser autre chose (§9.2) ; libellés d'états vides/erreurs
du §12 actés tels quels. Statut de l'en-tête corrigé BROUILLON → VALIDÉ, les
3 sous-sections mises à jour en conséquence.

**Pré-vol §15 (avant la 1re ligne de code)** :
- **Bloquant trouvé** : le trigger `enforce_bet_transitions` (migration #3)
  n'autorisait pas `SUBMITTED → DRAFT` (le geste « retirer » du §9) —
  seulement `DRAFT→{SUBMITTED,CANCELLED}`, `SUBMITTED→{VALIDATED,REJECTED,
  CANCELLED}`, `VALIDATED→{WON,LOST,CANCELLED}`, `*→CANCELLED`. Migration
  dédiée proposée, contenu montré intégralement, confirmée avant push (voir
  plus bas, migration #9) — jamais ajoutée en éditeur SQL.
- `bet_deadline_open` (migration #3, `SECURITY DEFINER STABLE`) confirmée
  réutilisable telle quelle ; sa réplique TypeScript existait déjà dans
  `lib/queries/home.ts` (§2.4) — même formule reprise pour le bootstrap de
  cet écran, pas une 3e implémentation.
- Routes `/play/bets/new` et `/play/bets/[id]/edit` confirmées ABSENTES sur
  le disque (`find`, pas une relecture de doc) — seules entrées inertes du
  hub temporaire (§2.10).
- `TeamLogo` confirmé réutilisable tel quel ; tiers déjà en usage relevés
  (18/20/48px selon l'écran) — 20px retenu pour les sélecteurs de cet écran,
  cohérent avec les lignes de liste existantes.

**Décision structurante confirmée AVEC l'utilisateur** (pas tranchée seule) :
les 3 server actions (`saveDraft`/`submitBet`/`withdrawBet`) suivent le
patron `request_prediction_correction` (fonction SQL `SECURITY DEFINER`,
migration #7) plutôt qu'une logique TypeScript pure (patron
`lib/actions/matches.ts`) — motif : la garde de quota « 3 paris MATCH par
série » (0.2.4 §6) n'a AUCUN backstop d'index unique (contrairement aux deux
quotas « 1 actif », `uniq_active_series_bet`/`uniq_active_match_bet`) ; un
`SELECT count` puis `INSERT` en deux allers-retours TypeScript laisserait une
fenêtre de course entre deux soumissions quasi simultanées du même joueur.

**Migration #9** (`20260726120000_bet_withdraw_transition.sql`) : ajoute
`SUBMITTED → DRAFT` à `enforce_bet_transitions` (`create or replace
function`, le trigger existant s'y raccroche sans recréation). Montrée
intégralement, confirmée, poussée par l'utilisateur lui-même (`npx supabase
db push` bloqué pour Claude par le classificateur de permissions de
l'environnement — pas un refus de Claude ; l'utilisateur a lancé la commande
et confirmé via `npx supabase migration list`, `remote` alignée sur `local`).

**Migration #10** (`20260726130000_bet_write_functions.sql`) : deux fonctions
`SECURITY DEFINER` — `save_bet(p_bet_id, p_scope, p_series_id, p_match_id,
p_description, p_category, p_difficulty, p_submit)` (création OU édition,
DRAFT/SUBMITTED selon `p_submit` ; cible figée en édition, §9.2 ; refuse un
`p_submit=false` sur un pari déjà SUBMITTED — le retrait passe exclusivement
par l'autre fonction) et `withdraw_bet(p_bet_id)` (SUBMITTED→DRAFT, aucun
champ touché). Chaque garde du §11 recalculée dans la fonction (propriétaire,
statut, `bet_deadline_open`, cible identifiée, quota, scope interdit en NBA
Cup) — ces fonctions CONTOURNENT la RLS (rôle propriétaire), donc ne
délèguent RIEN à elle, exactement comme migration #7. Messages d'erreur des
cas produits repris MOT POUR MOT du §12. **Verrou de concurrence ajouté par
Claude, pas demandé explicitement mais nécessaire pour que le choix
SECURITY DEFINER tienne sa promesse** : `pg_advisory_xact_lock` (clé = user ×
série) avant le comptage du cap « 3 MATCH/série », qui sérialise les
créations concurrentes sur la même série — sans lui, deux appels simultanés
auraient pu chacun lire « 2 existants » et produire 4 paris actifs. Montrée
intégralement, confirmée, poussée par l'utilisateur.

**Code** :
- `lib/labels/bets.ts` (nouveau) : catégories/difficultés/défauts/cap de
  quota — module SANS dépendance serveur (pas de `getServerClient`), pour
  rester importable à la fois par la lecture serveur ET par le futur
  composant `"use client"` sans faire fuiter `next/headers` dans le bundle
  client (piège identifié EN ÉCRIVANT le formulaire, corrigé avant qu'il ne
  casse le build — voir §7).
- `lib/queries/bets.ts` : `getNewBetFormData(matchIdParam)` (résout le
  contexte §2 — raccourci/libre/fermé — et le bootstrap complet) et
  `getEditBetFormData(betId)` (vérifie propriété + statut éditable EN PLUS
  de la RLS, qui pourrait sinon révéler un pari public d'un autre joueur à sa
  deadline). `seriesBetOpen`/`matchBetOpen`/`matchSlotsUsed` recalculés
  serveur en reproduisant `bet_deadline_open`, jamais lus du client.
- `lib/actions/bets.ts` : `saveDraftBet`/`submitBet`/`withdrawBet`, relais
  fins vers `.rpc()`, messages d'erreur remontés tels quels (même patron que
  `corrections.ts`).
- Routes `app/(app)/play/bets/new/page.tsx` et `.../[id]/edit/page.tsx`
  (`searchParams`/`params` en `Promise`, Next.js 16) + `components/bets/
  BetForm.tsx` (SEULE feuille `"use client"`, §1.1) — sélecteurs série/match
  en listes de boutons avec logos (`<select>` natif ne peut pas afficher
  d'image), catégorie/difficulté en `<select>` natifs.
- `app/(app)/play/page.tsx` (hub temporaire) et `components/matches/
  BetShortcut.tsx` mis à jour : l'entrée « Paris » et le raccourci pointent
  désormais vers `/play/bets/new` (+`?matchId=`) au lieu de `/play` — ferme
  le gap `SPEC_ECRAN_MATCHS_V0_1.md` §18.3.

**Vérifié** : `npx tsc --noEmit`, `npx eslint .`, `npx next build` tous
propres après chaque étape.

**Test en session authentifiée réelle** (script Node jetable, service_role
pour la préparation + `signInWithPassword` pour la vraie session testée,
hors dépôt puis supprimé) : 26 vérifications, toutes passées — cycle de vie
complet (créer DRAFT, soumettre, ré-écrire un SUBMITTED sans toucher
`submitted_at`, retirer, re-soumettre avec `submitted_at` renouvelé) et 5 cas
négatifs (retrait d'un DRAFT, brouillon d'un SUBMITTED, pari d'un AUTRE
joueur, cible déjà commencée, doublon sur un match, cap 3 MATCH/série — 2e/3e
acceptés, 4e refusé avec le libellé exact §12). Fixtures ajustées en route :
le seed datant de plusieurs jours, ses matchs « ouverts » étaient repassés
dans le passé — date de `NYK-ATL#1` temporairement avancée puis restaurée ;
3 matchs jetables ajoutés à cette série pour exercer le cap, supprimés après
(un oubli de tracking d'un pari créé pendant un test a bloqué un premier
nettoyage par contrainte FK — corrigé, nettoyage rendu résilient étape par
étape). Base vérifiée identique à l'état seedé après coup.

**Suivi mis à jour en miroir** : `SPEC_ECRAN_NOUVEAU_PARI_V0_1.md` (statut
VALIDÉ, §5.4/§9.2/§12 actés) ; `ETAT_ACTUEL.md` (nouveau §2.15) ;
`GAPS_OUVERTS.md` (destination du raccourci pari retirée — résolue) ; cette
entrée de journal.

**État en fin de session** : écran Nouveau pari codé, testé en session
réelle (SQL/RPC direct, pas encore de navigateur). Prochaine étape : test
manuel dans un vrai navigateur, puis fichiers de suivi (fait dans la
session suivante).

---

## Session du 27/07/2026 (suite) — Test manuel navigateur, bandeau sticky, saisie inline dans Matchs

Suite directe. Trois volets : test manuel du lot précédent dans un vrai
navigateur, puis deux évolutions demandées par l'utilisateur après avoir vu
le résultat.

**Test manuel navigateur** : aucun skill projet pour lancer l'app (cherché
d'abord, absent). `chromium-cli` indisponible dans l'environnement —
`playwright` installé temporairement (`npm install --no-save`, retiré en fin
de session, `package.json`/`package-lock.json` jamais touchés). Un serveur de
dev `next dev` tournait déjà (port 3001, lancé lors d'une session
précédente) — réutilisé tel quel plutôt que d'en lancer un second (un
premier essai de lancement a d'ailleurs échoué silencieusement, Next.js
refusant deux instances dev concurrentes sur le même dossier ; le port 3000
observé servait un projet SANS RAPPORT, un léger doute levé en confirmant que
le HTML servi référençait bien des assets `nba-pronos` — `Geist`/`Geist_Mono`
sont d'ailleurs les polices RÉELLES du scaffold `create-next-app`, jamais
retirées, pas un signe de mauvais projet).

Session réelle obtenue en posant un mot de passe temporaire sur un compte de
seed (`Nina_R`, via l'API Admin) puis connexion normale par le formulaire.
Scénarios rejoués avec captures d'écran à chaque étape : entrée libre (série
déjà prise correctement grisée), création d'un brouillon, édition d'un DRAFT
existant → soumission, ré-édition d'un SUBMITTED (bon jeu de boutons : pas de
« Enregistrer le brouillon », « Revenir en brouillon » présent) → retrait,
raccourci réel depuis Matchs (navigation + pré-remplissage corrects), et
raccourci vers un match fermé (repli sur le contexte libre + message discret
§2). Un faux résultat rencontré en cours de route : après avoir enchaîné une
navigation par clic (`<Link>`) puis une navigation directe (`page.goto`) dans
LE MÊME onglet, l'état d'un test précédent semblait subsister (une série
apparaissait sélectionnée alors qu'elle n'aurait pas dû l'être) — vérifié en
isolant la navigation dans un contexte navigateur neuf : le HTML servi était
en réalité intégralement correct (aucune présélection, notice affichée), le
faux résultat venait bien du chaînage de navigations dans le même onglet,
pas du code. Toutes les fixtures de test (mots de passe, dates de matchs
avancées, paris créés) nettoyées/restaurées après coup, dépendance
`playwright` retirée.

**Demande 1 — bandeau sticky** : l'utilisateur veut que la zone de saisie du
pari (énoncé, catégorie, difficulté, boutons — pas seulement les boutons)
reste TOUJOURS visible, plutôt qu'à atteindre en scrollant sous le
sélecteur série/match. Implémenté en `position: fixed` (pas `sticky` — le
sélecteur au-dessus peut être court ou long, `fixed` garantit une position
identique dans tous les cas) dans `BetForm.module.css`, avec `padding-bottom`
généreux sur le conteneur du formulaire pour que le sélecteur reste
défilable jusqu'au bout. **Bug trouvé en mesurant, pas en devinant** :
l'offset copié du patron `StickyMeBar` (`components/leaderboard`,
`calc(var(--tap-target-min) + var(--space-3))` = 56px) chevauchait de ~11px
la barre d'onglets (`TabBar`, hauteur RÉELLE mesurée ~67px avec son padding +
bordure — supérieure à ce que le calcul supposait). Corrigé par
`getBoundingClientRect()` des deux éléments (pas une capture d'écran, biaisée
en mode plein-page à cause du repositionnement temporaire du viewport par
l'outil de capture) : offset porté à `calc(var(--tap-target-min) +
var(--space-6) + env(safe-area-inset-bottom, 0px))`, marge de ~9px confirmée
après coup, contenu tenant désormais dans son `max-height` sans scroll
interne.

**Demande 2 — saisie inline dans Matchs** : l'utilisateur veut pouvoir saisir
un pari DIRECTEMENT dans la ligne Match dépliée (l'onglet Matchs devient
l'entrée PRINCIPALE, « Mes paris » restant pour le suivi) plutôt que de
naviguer vers l'écran dédié. Confirmé comme un élargissement RÉEL du
périmètre acté par `SPEC_ECRAN_NOUVEAU_PARI_V0_1.md` §1 (deux points d'entrée
vers UN écran dédié, pas de saisie inline) — les routes `/play/bets/new` et
`/play/bets/[id]/edit` restent en place pour les paris SÉRIE et l'entrée
libre, l'intégration inline ne couvre QUE les paris MATCH depuis Matchs.
`components/matches/BetShortcut.tsx` (lien simple) remplacé par
`components/matches/InlineBetForm.tsx` (formulaire complet, cible scope=MATCH
figée sur CE match — pas de sélecteur série/match, déjà connu du contexte) ;
s'ouvre pré-rempli si un pari DRAFT/SUBMITTED existe déjà sur ce match (même
jeu de boutons que l'écran dédié), reste un simple texte désactivé si le pari
existant n'est plus éditable ici (VALIDATED/WON/LOST, §9). `lib/queries/
matches.ts` étendu : nouveau type `MyMatchBet` (id/statut/énoncé/catégorie/
difficulté du pari actif du joueur sur ce match), la requête `bets` du fichier
élargie pour porter ces colonnes (elle ne sélectionnait avant que scope/
statut). Testé en navigateur réel : création inline sans pari existant,
pré-remplissage correct d'un DRAFT existant, soumission, retrait — tous
confirmés visuellement.

**Point laissé ouvert, signalé explicitement** : le bandeau sticky n'a PAS
été reproduit pour la version inline — si deux lignes de match étaient
dépliées simultanément, deux bandeaux fixes en bas de viewport entreraient
en conflit (un seul écran/formulaire à la fois pour l'écran dédié, plusieurs
lignes possibles ici). Consigné dans `GAPS_OUVERTS.md`, pas tranché.

Une alerte d'hydratation React (`caret-color: transparent` ajouté côté
client sur un `<textarea>`, une seule fois) n'a pu être reliée à aucun code
du dépôt (recherche globale négative) — probable artefact du Chromium
headless de test, signalé à l'utilisateur, pas creusé davantage faute de
piste concrète.

**Vérifié** : `npx tsc --noEmit`, `npx eslint .`, `npx next build` tous
propres après chaque changement. Aucune migration. Dépendance `playwright`
réinstallée puis re-retirée pour ce second round de test ; toutes les
fixtures (mots de passe, dates de matchs, paris de test) nettoyées et
vérifiées restaurées à l'identique.

**Suivi mis à jour en miroir** : `ETAT_ACTUEL.md` (§2.15 complété, nouvelle
« Prochaine étape ») ; `GAPS_OUVERTS.md` (destination du raccourci pari
retirée pour de bon — remplacée par l'intégration inline ; nouveau point sur
le bandeau sticky inline non traité) ; cette entrée de journal.

**État en fin de session** : écran Nouveau pari CODÉ et VÉRIFIÉ (SQL/RPC réel
+ navigateur réel), plus saisie inline MATCH depuis l'écran Matchs. Prochaine
étape : écran « Mes paris » (consultation/quotas, hors périmètre de ce lot,
spec à écrire) ou Bracket personnel — à confirmer avec l'utilisateur.

---

## Session du 27/07/2026 (suite) — Écran Bracket personnel (remplissage), spec rédigée en séance + code + tests

Suite directe. L'utilisateur choisit « Bracket personnel » comme prochain
lot. Différence de taille avec les lots précédents : **aucune spec d'écran
n'existait** pour ce nom, même en brouillon — seulement une mention comme
« prochaine étape » dans les fichiers de suivi. Claude vérifie (recherche
sur le disque, pas une supposition) et le signale avant d'avancer.
L'utilisateur choisit de la rédiger avec Claude, en séance.

**Question annexe posée par l'utilisateur en tout début de session** : rester
dans Claude Code ou basculer sur claude.ai (chat). Réponse directe (question
d'outillage, pas de cadrage) : rester ici, Claude Code a un accès direct au
dépôt/Supabase/terminal/navigateur qu'une interface de chat web n'a pas.

**Rédaction de la spec** (`SPEC_ECRAN_BRACKET_PERSONNEL_V0_1.md`, nouveau
fichier) : appuyée sur des décisions déjà actées et jamais rouvertes —
`nba_pronos_decisions_0_2_2_bracket_initial.md` (ouverture, deadline,
contenu du bracket, score de série, validation non irréversible, cas
limites) et `nba_pronos_decisions_0_2_9_ux_ui.md` §5 (remplissage tour par
tour, cascade, champion déduit, groupement conférence) — et sur un
enseignement retenu du PROTOTYPE (`Cadrage/OLD/ETAT_DEVELOPPEMENT_
PROTOTYPE.md` §7.2/§7.4, hors dépôt V1 mais lu explicitement pour cette
raison) : un bug réel y avait fait primer le résultat OFFICIEL sur le
pronostic du joueur pour dériver les équipes candidates des tours 2+, et
validait un pick contre les colonnes officielles (toujours NULL avant le
vrai résultat) au lieu des candidats dérivés — corrigé à l'époque, repris
ici comme garde-fou explicite à ne pas perdre en réécrivant l'écran pour la
V1. Vérification du schéma en cours de rédaction : les policies RLS
`brackets_insert/update`/`bracket_picks_insert/update` (migration #3, lue
directement dans le fichier de migration) couvrent DÉJÀ propriétaire/actif/
deadline — repéré AVANT de proposer quoi que ce soit à coder, ce qui a
permis d'annoncer dès le brouillon qu'aucune migration ne serait nécessaire
pour ce lot (à l'inverse de « Nouveau pari »).

**4 points fermés avec l'utilisateur** (AskUserQuestion, §12 de la spec) :
publication Realtime de `series` (reportée — aucun besoin live identifié
sur CET écran précis, remplissage personnel sans contenu d'autre joueur à
rafraîchir) ; libellés des états vides actés tels quels ; contenu du popup
de confirmation « Valider mon bracket » rédigé et validé (pas un
avertissement « définitif », puisque le bracket reste modifiable après
validation, 0.2.2 §3) ; structure de fichiers confirmée SÉPARÉE de
`lib/queries/bracket.ts` (vue globale, lecture seule) plutôt que fusionnée.

**Pré-vol §11** (avant tout code, comme pour « Nouveau pari ») : RLS
confirmée suffisante (relue une 2e fois sur le disque, pas seulement la
spec) ; `bracket_deadline_passed()` confirmée réutilisable ; route
`/play/bracket` confirmée absente (`find`) ; jeu de données de test — le
bracket d'Amine92 (11/15, volontairement incomplet, seed du 23/07/2026)
confirmé intact et exploitable pour tester la cascade sans y toucher.

**Code** :
- `lib/queries/bracket-fill.ts` : `computeCandidateTeamIds(series,
  myWinnerBySeriesId, competitionType)`, fonction PURE — dérive les 2
  équipes candidates de chaque série (officielles pour le tour racine,
  dérivées du PICK du joueur sur les séries feeder pour les tours suivants,
  JAMAIS du résultat officiel) — et `getBracketFillData()` (bootstrap
  complet : séries groupées par tour/conférence, pick du joueur, statut
  validé/auto-validé). Réutilise `ROUND_LABELS` (`lib/labels/rounds.ts`,
  déjà partagé) et le même ordre de tri Cup-par-coup-d'envoi que
  `lib/queries/bracket.ts` (vue globale) — cohérence entre les deux écrans,
  pas une 2e convention.
- `lib/actions/bracket-fill.ts` : `saveBracketPick`/`validateBracket` —
  AUCUNE garde de propriétaire/statut/deadline réécrite (déjà portée par la
  RLS, contrairement à « Nouveau pari » qui contournait la RLS via SECURITY
  DEFINER) ; seule garde applicative ajoutée = validité du vainqueur soumis,
  recalculée avec EXACTEMENT la même fonction pure que la lecture — jamais
  une 2e implémentation qui pourrait diverger (le bug retenu du prototype).
- Route `app/(app)/play/bracket/` (`?round=` pour la navigation, Next.js 16
  Promise) + `components/bracket-fill/{RoundTabs, BracketFillBoard}` —
  BracketFillBoard = SEULE feuille `"use client"` de l'écran (tap vainqueur
  + boutons de score sauvegardent IMMÉDIATEMENT, lecture littérale de 0.2.9
  §5, pas de brouillon local à confirmer séparément) ; réutilise
  `components/bracket/ProgressBar.tsx` (vue globale) tel quel, déjà pur.
- Hub temporaire (`app/(app)/play/page.tsx`) : dernière entrée inerte
  (« Mon bracket ») activée → les 4 entrées sont désormais toutes des liens
  réels. Le changement a révélé du code mort (branche `entryInert`/`.soon`,
  plus jamais atteinte) — supprimé au passage plutôt que laissé traîner.

**Vérifié** : `npx tsc --noEmit`, `npx eslint .`, `npx next build` propres
après chaque étape.

**Test de la cascade en isolation** (script jetable, exécuté via `npx tsx`
— AUCUNE base de données touchée) : 5 vérifications, dont la plus
significative construit une situation où un résultat "officiel" simulé
diffère du pick du joueur pour une série ROUND_1, et confirme que la série
CONF_SEMIS suivante dérive bien du PICK, jamais du résultat officiel — la
preuve directe que le bug du prototype ne peut pas se reproduire ici.

**Test en session authentifiée réelle** (navigateur, `playwright` installé
temporairement comme au lot précédent — dev server déjà en cours réutilisé) :
compte Tariq_M (aucun bracket existant, jeu de données propre). La deadline
du bracket, datant du seed, était déjà passée (même piège rencontré au lot
« Nouveau pari » avec les dates de matchs) — avancée temporairement,
restaurée après. Un premier script de test a produit un faux résultat
(l'onglet « Demi-finales de conférence » semblait afficher encore le
contenu du 1er tour) — diagnostiqué comme une course dans le script de test
lui-même (le sélecteur CSS utilisé pour attendre le chargement matchait déjà
l'ANCIENNE page, avant que la vraie navigation ne soit terminée), pas un bug
de l'app : confirmé en vérifiant l'URL réelle après clic
(`?round=CONF_SEMIS`) et le contenu réel de la page, qui étaient corrects
dès le début. Séquence confirmée : round 1 rendu (8 séries, logos, boutons
de score) ; pick d'un vainqueur + score sauvegardé et vérifié directement en
base ; cascade vers les demi-finales EXACTE (les 2 équipes picked
apparaissent comme candidates de la bonne série, « Équipe à définir » pour
les 3 autres qui n'ont pas encore leurs 2 feeders pickés) ; validation du
bracket à 2/15 réussie (aucune garde de complétude), confirmée en base
(`is_validated=true`, `validated_at` posé). Toutes les fixtures nettoyées
après coup (picks, bracket, deadline restaurée, mot de passe réinitialisé),
dépendance `playwright` retirée — base vérifiée identique à l'état seedé, le
bracket d'Amine92 jamais touché.

**Suivi mis à jour en miroir** : `SPEC_ECRAN_BRACKET_PERSONNEL_V0_1.md`
(rédigée et close en séance) ; `ETAT_ACTUEL.md` (nouveau §2.16, « Prochaine
étape » renumérotée §2.17, fiche migrations/§4/§7 mises à jour) ;
`GAPS_OUVERTS.md` (Bracket personnel retiré de la liste à coder ; Realtime
`series` réévaluée et confirmée toujours reportée ; interprétations
d'implémentation actées ajoutées) ; cette entrée de journal.

**État en fin de session** : écran Bracket personnel CODÉ et VÉRIFIÉ (test
pur de la cascade + session authentifiée réelle en navigateur). Prochaine
étape à confirmer avec l'utilisateur : « Mes paris » (consultation/quotas
globaux, hors périmètre du lot Nouveau pari §2.15) ou les écrans admin —
choix laissé ouvert, aucune date arrêtée.

---

## Session du 27/07/2026 (suite) — Déploiement Vercel, activation de l'inscription, 1er admin réel

Suite directe. L'utilisateur demande la prochaine étape du projet, puis
décide d'attaquer le déploiement d'une démo Vercel pour ses amis plutôt que
de continuer le codage d'écran — « Mes paris »/admin restent en attente.

**Commit/push du travail en attente** : les lots « Nouveau pari » (§2.15) et
« Bracket personnel » (§2.16) étaient codés et testés mais jamais poussés
sur GitHub. `npx tsc --noEmit`/`npx eslint .`/`npx next build` revérifiés
propres avant tout push. Le fichier `Cadrage/nba-pronos.lnk` (raccourci
Windows accidentel vers le dossier du dépôt, pas du contenu projet) exclu du
commit. Un seul commit groupé pour les deux lots (`d051097`), confirmé
explicitement par l'utilisateur après qu'un premier « ok » ambigu — arrivé
noyé dans une notification système de tâche en arrière-plan, donc NON traité
comme une confirmation réelle — a été signalé et écarté par prudence
(risque d'injection). Un 2e commit (`6ff2a68`) suit juste après (voir plus
bas, correctif de la route racine).

**Déploiement Vercel** : CLI connectée (`npx vercel login`, flow OAuth par
appareil, navigateur). Projet lié à un NOUVEAU projet Vercel
(`lenoir-nba/nba-pronos`), connecté automatiquement au dépôt GitHub
`lenoirmath122-dev/nba-pronos`. Les 4 variables d'environnement de
`.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SYNC_SECRET`) poussées sur les 3 environnements
Vercel (Production/Preview/Development) via une commande shell qui lit
`.env.local` directement — jamais les valeurs elles-mêmes dans la commande
visible, pour ne pas les exposer dans la transcription. Déployé en
production (`npx vercel --prod`) → **https://nba-pronos.vercel.app**, aliasé
automatiquement.

**Bug trouvé au premier chargement réel** (signalé par l'utilisateur) : la
racine du site (`/`) affichait le scaffold par défaut de `create-next-app`
(« To get started, edit the page.tsx file ») au lieu de rediriger vers
l'app. Cause : `app/page.tsx` n'avait jamais été retouché depuis la création
du projet (18/07/2026) — invisible jusqu'ici car tous les tests précédents
visitaient des routes précises (`/login`, `/home`, etc.), jamais la racine
nue. Corrigé (`app/page.tsx` → `redirect("/login")`, qui renvoie lui-même
vers `/home` si une session est déjà active, logique déjà portée par
`proxy.ts`) ; `tsc`/`eslint` revérifiés propres, commit `6ff2a68`, poussé,
re-déployé et vérifié (`curl` → 307 vers `/login`).

**Activation de l'inscription réelle** : au moment de désactiver « Confirm
email » dans le dashboard Supabase, l'utilisateur s'est d'abord trompé de
réglage (ou ne l'a pas sauvegardé) — un premier compte réel (le sien,
`lenoir.math122@gmail.com`, pseudo **Rillettes-31**) a bien reçu un email de
confirmation avant de pouvoir se connecter (vérifié via les métadonnées
`auth.users` : `confirmation_sent_at` quasi simultané à `created_at`,
`email_confirmed_at` ~43s plus tard, `last_sign_in_at` seulement après ce
clic). Après capture d'écran, le réglage **Sign In / Providers → Supabase
Auth → Confirm email** était bien décoché et sauvegardé — mais un 2e test
(compte jetable créé via l'anon key, immédiatement supprimé après) a de
nouveau buté sur `over_email_send_rate_limit`, ET une vraie tentative de
l'utilisateur via `/signup` a échoué avec le message générique « Impossible
de créer le compte. Réessaie. » (branche catch-all de `signup()`,
`lib/auth/actions.ts`). **Piège reconnu mais PAS définitivement tranché** :
soit le quota minuscule du mailer par défaut (souvent ~2 emails/heure,
partagé par TOUS les types d'email — pas seulement la confirmation) était
encore épuisé par le tout premier envoi, soit Supabase tente quand même un
email de courtoisie à l'inscription indépendamment du fait que la
confirmation soit *obligatoire* ou non. Non revérifié après un délai
suffisant pour trancher — voir `GAPS_OUVERTS.md`.

**Contournement retenu pour la démo** : au lieu d'attendre/investiguer
davantage, création directe d'un compte via l'API Admin (`email_confirm:
true`, même mécanisme que les 7 comptes de seed, AUCUN envoi d'email
possible par construction) — décision explicite de l'utilisateur : **UN
SEUL compte PARTAGÉ** pour tous ses amis pour cette démo (`Demo_Amis` /
`demo-amis@nba-pronos.test`, rôle PLAYER), pas un compte par personne.
Compromis signalé explicitement AVANT de créer le compte (un seul bracket/
jeu de pronos partagé, pas de vraie compétition entre amis) — accepté en
connaissance de cause, un compte par personne prévu après la fin de la V1.

**1er admin réel** : le compte de l'utilisateur (Rillettes-31) promu ADMIN
par `UPDATE public.users SET role='ADMIN'` direct via service_role — PAS via
une migration dédiée (contrairement à ce qu'anticipait §6 `ETAT_ACTUEL.md`,
« écrire la migration du 1er admin réel »), et pas via un écran admin de
promotion (aucun n'existe encore). Répond à l'esprit du point ouvert mais de
façon ad hoc, pas par le mécanisme prévu à l'origine.

**Suivi mis à jour en miroir** : `ETAT_ACTUEL.md` (nouveau §2.18, §1/§6/§7
mis à jour) ; `GAPS_OUVERTS.md` (T8 partiellement clos — Vercel/variables
d'env FAITS — nouveaux points ouverts : comportement Confirm email pas
tranché, compte démo partagé à traiter avant le passage aux comptes
individuels) ; cette entrée de journal.

**État en fin de session** : démo accessible publiquement
(https://nba-pronos.vercel.app), inscription au code `EBC67AAD` fonctionnelle
pour un compte individuel mais avec le comportement email non totalement
élucidé, admin réel en place, compte de démo partagé communiqué à
l'utilisateur pour ses amis. Prochaine étape toujours ouverte, inchangée par
ce lot : « Mes paris » (consultation/quotas globaux) ou les écrans admin.

---

## Session du 27/07/2026 (suite) — Écran Profil, spec rédigée en séance + code + tests, thème clair/sombre câblé

Suite directe. L'utilisateur demande où vivra « Mes paris » et se souvient
qu'un écran Profil reste à faire — Claude confirme : Profil est un 4ème
onglet à part (préférences/thème/admin), distinct de « Mes paris »
(consultation de paris, hub Jouer). L'utilisateur choisit Profil, avec la
recommandation de Claude (petit, débloque le retrait du bouton de
déconnexion temporaire, pas de dépendance au moteur de synchro contrairement
aux écrans admin).

**Aucune spec détaillée n'existait** (même situation que Bracket personnel,
§2.16) — seulement quelques lignes dans `nba_pronos_decisions_0_2_9_ux_ui.md`
§3 et l'arbre T6a. Rédigée en séance (`SPEC_ECRAN_PROFIL_V0_1.md`, nouveau
fichier), appuyée sur le schéma réel de `users` (pseudo, avatar_url,
favorite_team_id, bio, role, status, theme_preference) plutôt que deviné.
3 points fermés avec l'utilisateur (AskUserQuestion) : pseudo NON
modifiable (identité publique déjà affichée nominativement ailleurs — un
changement rétroactif n'a jamais été traité par aucune spec) ; avatar HORS
PÉRIMÈTRE (le projet n'a jamais utilisé Supabase Storage, pas justifié pour
ce seul champ) ; thème clair/sombre INCLUS (l'utilisateur a explicitement
demandé une spec COMPLÈTE, pas une mini-spec, sur ce point précis).

**Pré-vol** (avant tout code, lecture des migrations RÉELLES, pas seulement
des specs) : policy `users_update_self` (migration #3) confirmée SANS
restriction de colonne — couvre nativement favorite_team_id/bio/
theme_preference ; trigger `enforce_users_invariants` (T-a) confirmé NE
PORTANT QUE sur role/status (relu dans le fichier de migration, pas supposé)
— aucun risque de blocage pour ce lot ; `is_admin()` et les 30 lignes de
`teams` confirmées réutilisables telles quelles. Aucune migration
nécessaire.

**Code** :
- `lib/queries/profile.ts` (`getProfileData`/`getTeamOptions`) et
  `lib/actions/profile.ts` (`updateThemePreference`/`updateProfile`) —
  même patron que `requestPredictionCorrectionFormAction`
  (`lib/actions/corrections.ts`) : FormData brut, redirect après écriture,
  aucun `useActionState`.
- `components/profile/TeamPicker.tsx` : sélecteur d'équipe favorite en
  VRAIS `<input type="radio">` natifs (pas un `<select>`, ne peut pas
  afficher de logo ; mais PAS non plus le patron `role="radio"` sur des
  `<button>` de `BetForm.tsx`, qui nécessite du client-side state pour des
  champs interdépendants — ce picker n'en a aucun). Résultat : ZÉRO
  `"use client"` sur tout l'écran, surlignage de la ligne sélectionnée en
  CSS pur (`:has(.radio:checked)`). Interprétation trouvée EN CODANT, la
  spec laissait le mécanisme exact ouvert (§10).
- `app/(app)/profile/page.tsx` (+ page.module.css) : pseudo lecture seule,
  badge Admin conditionnel, 3 formulaires natifs indépendants (thème,
  préférences, déconnexion).
- `app/layout.tsx` (RACINE, hors des deux route groups) : câblage du thème
  clair/sombre laissé en attente depuis la consolidation des tokens
  (21/07/2026, `app/tokens.css` : « la bascule est un lot séparé »). Lit
  `theme_preference` si une session existe, DARK par défaut sinon (visiteur
  non connecté) ; pose `data-theme="light"` sur `<html>` seulement si LIGHT.
- `app/(app)/layout.tsx` + `layout.module.css` : bouton de déconnexion
  temporaire RETIRÉ (code + CSS mort), Profil reprend l'action pour de bon.

**Vérifié** : `npx tsc --noEmit`, `npx eslint .`, `npx next build` propres.
Toutes les routes deviennent DYNAMIQUES après ce lot (y compris `/`,
`/login`, `/signup`, auparavant statiques) — conséquence ATTENDUE de la
lecture de session dans `app/layout.tsx`, pas une régression.

**Test en session authentifiée réelle** (serveur `next dev` déjà en cours
sur le port 3001 — détecté et réutilisé plutôt que d'en relancer un
second, même piège que §2.15) : login réel sans JS pour le compte
`Demo_Amis` (replay des 4 champs `$ACTION_*` d'un formulaire lié à
`useActionState`, même technique que §2.11) ; toggle thème réellement posé
et vérifié PROPAGÉ à `/home` sans reconnexion ; visiteur déconnecté
vérifié TOUJOURS en dark (aucun `data-theme`) ; sélection d'équipe
favorite persistée en base ET re-rendue avec le bon radio `checked` au
rechargement ; déconnexion réelle testée (cookie effacé, 303 → `/login`) ;
tentative d'escalade `role` par la même session confirmée BLOQUÉE par le
trigger existant. Aucune régression sur `/`, `/login`, `/signup`,
`/leaderboard`, `/bracket`. Toutes les valeurs de test restaurées après
coup (compte `Demo_Amis` identique à son état d'avant test).

**Suivi mis à jour en miroir** : `ETAT_ACTUEL.md` (nouveau §2.18, header,
§6 mis à jour) ; `GAPS_OUVERTS.md` (gap « déconnexion temporaire » retiré —
résolu ; entrée « Implémentation code de la V1 » étendue à Profil) ; cette
entrée de journal.

**État en fin de session** : écran Profil CODÉ, VÉRIFIÉ et DÉPLOYÉ en
production (`vercel --prod`, re-vérifié en ligne). Bouton de déconnexion
temporaire définitivement retiré. Thème clair/sombre fonctionnel sur tout
le site. Prochaine étape toujours ouverte, inchangée par ce lot : « Mes
paris » (consultation/quotas globaux) ou les écrans admin.

---

## Session du 27/07/2026 (suite) — Écran Mes paris, spec rédigée en séance + code + tests, correctif migration

Suite directe. L'utilisateur choisit « Mes paris » comme prochain lot, en
demandant explicitement une vraie spec écrite (pas une mini-spec) — même
niveau d'exigence que les lots précédents sans brouillon préalable.

**Recherche avant rédaction** (pas seulement les fichiers déjà connus) :
préambule de `SPEC_ECRAN_NOUVEAU_PARI_V0_1.md` (périmètre déjà identifié,
jamais détaillé) ; `nba_pronos_decisions_0_2_4_paris_personnalises.md`
(règles fonctionnelles de référence, quota/deadline/statuts/visibilité) ;
schéma réel de `bets`/`correction_requests` ; `Cadrage/OLD/
ETAT_DEVELOPPEMENT_PROTOTYPE.md` §9 (l'écran équivalent du prototype,
volontairement PERSONNEL, un écran public séparé jamais repris en V1) ;
code réel d'`AssociatedBetCard` (Mes pronos) pour vérifier si la
révélation publique des paris (0.2.4 §9) était déjà construite quelque
part — CONFIRMÉ QUE NON (ne lit que `user_id = auth.uid()`), malgré la
décision fonctionnelle actée.

**2 points fermés AVANT rédaction** (AskUserQuestion) : révélation
publique des autres joueurs — REPORTÉE (reste personnel, comme le
prototype) ; demande de correction sur un pari — INCLUSE (la table
`correction_requests` supporte déjà `target_type='BET'`, mais aucune
fonction SQL ne l'utilisait).

**Rédaction de la spec** (`SPEC_ECRAN_MES_PARIS_V0_1.md`, nouveau fichier,
statut BROUILLON puis VALIDÉ) : le mécanisme de correction proposé
(« pari oublié » — VALIDATED dont la cible est FINISHED mais jamais
résolu) a été choisi délibérément plus restreint que ce qu'aurait permis
le schéma, après avoir vérifié `enforce_bet_transitions` : REJECTED/WON/
LOST sont des états TERMINAUX aujourd'hui, contester un refus ou une
résolution déjà posée aurait nécessité d'étendre ce trigger — jugé hors
périmètre, signalé explicitement plutôt que fait en silence ou deviné.
4 points fermés avec l'utilisateur (AskUserQuestion, §14) : portée de la
correction confirmée telle quelle ; bandeau de quota GLOBAL unique (pas
dépliable) ; libellé « Signaler à un admin » ; tri par défaut accepté.

**Pré-vol** (lecture des migrations RÉELLES) : `bets_select` confirmée
suffisante côté propriétaire ; `enforce_bet_transitions` confirmé laissant
VALIDATED→WON/LOST ouvert ; découverte notable — l'index unique partiel
`uniq_pending_correction_per_bet` (garde « une seule requête PENDING »)
EXISTAIT DÉJÀ depuis la toute première migration (#1), anticipé avant même
que cette fonctionnalité ne soit spécifiée.

**Code** : `lib/queries/my-bets.ts` (`getMyBets`, réutilise `MATCH_SLOT_CAP`
tel quel) ; `lib/actions/bet-corrections.ts` (FormData + redirect, même
patron que `requestPredictionCorrectionFormAction`) ; `app/(app)/play/
bets/page.tsx` (l'INDEX du dossier existant) ; `components/my-bets/*` —
statuts/couleurs REPRIS À L'IDENTIQUE d'`AssociatedBetCard` (Mes pronos),
pas une 2e convention. Migration #11 (`request_bet_correction`, SECURITY
DEFINER, SANS voie A). Hub Jouer temporaire mis à jour : « Paris » pointe
désormais vers `/play/bets` plutôt que directement vers `/play/bets/new`.

**Bug trouvé en testant, corrigé par migration #12** : la migration #11
lisait `series.status` (colonne INEXISTANTE, vérifié après coup dans le
schéma réel — la vraie colonne est `official_status`, contrairement à
`matches.status`). Trouvé en appelant la fonction en session réelle sur
un pari SÉRIE, pas en relisant le code. Corrigé par un NOUVEAU fichier de
migration (`CREATE OR REPLACE`), même patron que la migration #4
historique — jamais de réécriture d'une migration déjà appliquée.

**Vérifié** : `npx tsc --noEmit`, `npx eslint .`, `npx next build` propres
(un warning ESLint intermédiaire — `RELEASED_BET_STATUSES` déclaré mais
jamais utilisé — corrigé en le retirant, le filtre `ONGOING_STATUSES`
suffisait pour ce calcul de quota précis).

**Test en session authentifiée réelle** (compte Demo_Amis, serveur `next
dev` déjà en cours réutilisé) : 7 paris de test créés via service_role
couvrant les 7 statuts (dont un VALIDATED ciblant un match déjà FINISHED,
cas « oublié ») — tous rendus dans le bon segment, bandeau de quota
vérifié (« 1/1 série · 1/3 match ») ; formulaire « Signaler à un admin »
réellement soumis sans JS, ligne `correction_requests` vérifiée en base,
rechargement affichant bien « Requête en attente » ; 3 cas négatifs testés
(2e requête sur le même pari, tentative sur un DRAFT, tentative sur un
SUBMITTED — tous bloqués avec le bon message). Toutes les données de test
supprimées après coup, compte `Demo_Amis` vérifié identique à son état
d'avant test. Aucune régression sur 10 autres routes testées.

**Suivi mis à jour en miroir** : `ETAT_ACTUEL.md` (nouveau §2.19, header,
§3 migrations, §7 nouveau piège) ; `GAPS_OUVERTS.md` (« Mes paris » retiré
de la liste à coder ; 2 nouveaux points ouverts distincts — révélation
publique des autres joueurs, contester un refus/résultat déjà posé ;
référence à l'ancien état inerte marquée SUPERSEDÉE) ; cette entrée de
journal.

**État en fin de session** : écran Mes paris CODÉ, VÉRIFIÉ et DÉPLOYÉ en
production (`vercel --prod`, re-vérifié en ligne). Prochaine étape
toujours ouverte : les écrans admin (aucune spec n'existe à ce jour).

---

## Session du 27/07/2026 (suite) — Tableau de bord admin (premier écran du lot Admin)

**Découpage du lot Admin décidé AVEC l'utilisateur** (AskUserQuestion) :
plutôt que d'attaquer les 6-7 pages admin d'un coup ou une file précise en
premier, priorité au **tableau de bord** (hub d'entrée), une page à la fois,
comme les lots joueur précédents.

**Bonne surprise au pré-vol** : contrairement à Bracket personnel (aucune
décision, tout à inventer en séance), la zone admin était déjà entièrement
architecturée dans `SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_a.md`/`_b.md`
(T6a/T6b, validées le 19/07/2026 mais jamais relues depuis) : arbre complet
`app/(admin)/admin/{page,validation,resolution,requests,players,logs}`,
garde `is_admin()` côté layout (pas le proxy), signatures des actions
(`validateBet`, `resolveBet`, `processCorrectionRequest`, `setPlayerRole`,
`setPlayerStatus`, `recalculateCompetition`, `logAdminAction`). Le lot n'a
donc consisté qu'à ASSEMBLER l'existant (0.2.7 + 0.2.9 §8 + T6a/T6b) au
format écran — nouveau fichier `SPEC_ECRAN_ADMIN_DASHBOARD_V0_1.md`.

**2 points fermés avec l'utilisateur avant rédaction finale** (AskUserQuestion) :
sans compétition active, Gestion des joueurs et Historique des logs restent
ACCESSIBLES (seuls les compteurs de file retombent à 0) ; bouton Recalculer
sans compétition active — DÉSACTIVÉ mais VISIBLE, jamais masqué.

**2ᵉ vérification de dépôt (avant code), 2 réalités trouvées et signalées
AVANT d'écrire quoi que ce soit** (pas devinées, tranchées avec
l'utilisateur, AskUserQuestion) :
- **`recomputeCompetition` (T5 §10.1) n'existe NULLE PART** — ni migration,
  ni `lib/` : le moteur de scoring T5 est intégralement spécifié mais jamais
  codé. Le bouton « Recalculer » est donc OMIS de ce lot (design conservé
  dans la spec pour référence, ajouté quand T5 sera codé) plutôt que de
  construire un bout du moteur de scoring en douce dans un lot « tableau de
  bord ».
- **Aucune des 5 pages filles n'existe** : les 3 cartes de file + les 2
  entrées (joueurs/logs) sont rendues INERTES (pas de `<Link>`, libellé
  « à venir »), même patron que le hub Jouer temporaire (§2.10) — retirées
  une à une au fur et à mesure que chaque page fille est codée.

**Code** : `app/(admin)/admin/layout.tsx` (garde is_admin(), redirect /home
si non-admin — défense en profondeur, le proxy ne garde que la session) +
`layout.module.css` ; `app/(admin)/admin/page.tsx` (100% composant serveur,
aucun `"use client"` dans ce lot) + `page.module.css` ; `lib/queries/
admin-dashboard.ts` (`getAdminDashboardData`, 3 compteurs — validation :
`bets` SUBMITTED ; résolution : `bets` VALIDATED dont l'échéance est
passée, `bet_deadline_open()` reproduit en TypeScript, même patron que
`lib/queries/{bets,home}.ts` ; requêtes : `correction_requests` PENDING,
TOUTES compétitions confondues — pas de délai limite en V1, 0.2.7 §6).
Lien « Tableau de bord admin » câblé sur l'écran Profil (remplace l'entrée
inerte posée le 27/07/2026 lors du lot Profil).

**Vérifié** : `npx tsc --noEmit`, `npx eslint .`, `npx next build` tous
propres (un premier `tsc` a échoué sur un fichier de types Next.js généré
avant le build — `next build` régénère ces types, résolu après). Aucun
conflit de route (`/admin` seul dans la carte des routes).

**Test en conditions réelles, technique NOUVELLE cette session** : la
technique habituelle (rejouer le POST `useActionState` du formulaire de
login sans JS, champs `$ACTION_*`) a échoué de façon répétée
(`Failed to find Server Action`) malgré une extraction correcte des champs
— cause non élucidée avec certitude (dev server très sollicité pendant la
session). Contournée en produisant directement un cookie de session
compatible via `@supabase/ssr` (`createServerClient` + `signInWithPassword`,
MÊME librairie que `lib/supabase/server.ts`/`proxy.ts`) plutôt que de
rejouer le formulaire — teste directement la garde, sans dépendre du flux
de login (déjà éprouvé par ailleurs). Résultat : Amine92 (PLAYER) sur
`/admin` → `307 /home` (gate refuse) ; Sofia_Admin (ADMIN) → `200`,
« Administration » rendu, 3 cartes affichées (0 à valider, 0 à résoudre,
**1 requête en attente** — correspond exactement à la requête PENDING
laissée en base depuis la session Mes pronos, §2.11, confirmation forte que
le compteur est juste) ; bandeau « Aucune compétition en cours » absent à
raison (une compétition ACTIVE existe). Mots de passe temporaires posés via
l'API Admin sur Sofia_Admin/Amine92 (jamais affichés dans le chat),
re-randomisés en fin de vérification. Scripts jetables utilisés puis
supprimés (non committés).

**Suivi mis à jour en miroir** : `ETAT_ACTUEL.md` (nouveau §2.20) ;
`GAPS_OUVERTS.md` (tableau de bord admin retiré de « à coder », nouvelles
entrées : bouton Recalculer + 5 pages filles admin, bloquées sur T5 pour la
première) ; cette entrée de journal.

**État en fin de session** : tableau de bord admin CODÉ, VÉRIFIÉ, COMMITTÉ
(2 commits, même patron que les lots précédents — code+spec puis suivi) et
POUSSÉ sur `main`. Prochaine étape : choisir la 1ʳᵉ page fille (validation,
résolution, requêtes, joueurs ou logs) — chacune sa propre spec, comme ce
lot.

---

## Session du 27/07/2026 (suite) — Correctif ponctuel : dates du jeu de données de test

**Demande utilisateur** : ses amis testeurs (compte `Demo_Amis`, §2.17) ne
voyaient plus aucun match à pronostiquer ni de bracket ouvert. Diagnostic
(lecture seule, service_role) : `bracket_deadline` de « Playoffs NBA (test) »
et les dates de tous les matchs sont des timestamps ABSOLUS posés
relativement au moment du seed (23/07/2026, `hoursFromNow(...)`) — 4 jours
plus tard (aujourd'hui), tout était mécaniquement passé : bracket verrouillé,
0 match dans la fenêtre 3 jours de l'écran Matchs.

**3 matchs identifiés comme À NE PAS toucher** (rôle de test documenté,
§2.11) : CLE-ORL#1 FINISHED (teste Mes pronos verrouillé + une correction
admin déjà rejouée), DEN-SAC#1 IN_PROGRESS (teste le badge EN DIRECT),
MIN-GSW#1 resté SCHEDULED malgré une date passée (teste la latence).
Confirmé AVEC l'utilisateur (AskUserQuestion) avant toute écriture.

**Correctif** : script jetable service_role — décale les 5 AUTRES séries
round 1 (sans rôle particulier) + `bracket_deadline`, en conservant les
MÊMES offsets relatifs qu'à l'origine (même patron temporel que le seed :
bracket_deadline = 1er match, les 4 autres séries étalées sur ~34h après).
Script non committé (patch ponctuel de données, pas un changement du seed
lui-même). Vérifié après coup : bracket_deadline dans le futur (28/07),
5/9 matchs désormais dans la fenêtre 3 jours de l'écran Matchs.

**Point noté pour la suite** (`GAPS_OUVERTS.md`) : ce correctif devra être
rejoué à chaque fois que la démo redevient active après plusieurs jours
d'inactivité, tant que le seed reste sur des dates absolues plutôt que
relatives à `now()` au moment du lancement de la démo.

---

## Session du 27/07/2026 (suite) — File de validation des paris (2e écran du lot Admin)

**Choix du 2e écran** : validation plutôt que résolution/requêtes/joueurs/
logs, car SEULE avec « Gestion des joueurs » à ne pas dépendre du moteur de
scoring T5 manquant (`validateBet`/`rejectBet` catégorie B SANS recompute,
T6a §5.3 — vérifié dans `SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_b.md` §5.1
AVANT de choisir, pas après coup).

**Spec** (`SPEC_ECRAN_ADMIN_VALIDATION_V0_1.md`, nouveau fichier, assemblage
comme pour le tableau de bord — décisions déjà validées par 0.2.7/0.2.9/T6b).
**Trouvaille au pré-vol** : la prose 0.2.9 §8 ne mentionne que la réglette
de difficulté, mais le schéma ET la signature `validateBet` (T6b) exigent
AUSSI une catégorie validée — sélecteur de catégorie ajouté à la carte,
cohérent avec l'interprétation déjà actée en Mes pronos (§2.11).

**Code** : `lib/queries/admin-validation.ts` (tous les joueurs, pas
`auth.uid()` seul) ; `lib/actions/admin-validation.ts` (`validateBet`/
`rejectBet`, session admin, RLS `bets_update_admin`, AUCUNE migration) ;
`lib/actions/audit.ts` NOUVEAU — `logAdminAction`, PARTAGÉ, réutilisable par
les 4 lots admin restants (prévu explicitement par T6b §6, pas une
abstraction inventée) ; `components/admin/ValidationBetCard.tsx` — 2
formulaires natifs indépendants (Valider/Refuser) par carte, `<select>`
natifs, 100% composant serveur. Carte « à valider » du tableau de bord
rendue `<Link>` actif.

**Garde-fou repris** (piège déjà connu, `ETAT_ACTUEL.md` §7) : re-garde le
statut `SUBMITTED` dans le `WHERE` de l'`UPDATE`, `.select().maybeSingle()`
pour détecter une course entre deux admins (0 ligne affectée), jamais
seulement l'absence d'erreur.

**Vérifié** : `tsc`/`eslint`/`next build` propres, aucun conflit de route.

**Test en conditions réelles** (même technique `@supabase/ssr` que le lot
précédent) : 2 paris de test `SUBMITTED` créés (service_role), les 2 cartes
rendues avec le bon contexte, formulaire Valider soumis réellement (POST
sans JS) → `VALIDATED` + `audit_logs` correct ; formulaire Refuser soumis
→ `REJECTED` + `audit_logs` correct. **Piège de TEST rencontré** (pas un
bug du code) : les 2 formulaires d'une carte partagent le même hidden
`betId` — un script d'extraction naïf de l'`$ACTION_ID_` récupère le
mauvais formulaire ; corrigé en désambiguïsant par un champ propre à
chaque formulaire. Données de test + logs supprimés après coup, mot de
passe temporaire re-randomisé.

**Suivi mis à jour en miroir** : `ETAT_ACTUEL.md` (nouveau §2.21) ;
`GAPS_OUVERTS.md` (5 pages filles → 4 restantes) ; cette entrée de journal.

**État en fin de session** : file de validation CODÉE, VÉRIFIÉE, COMMITTÉE
et POUSSÉE. Prochaine étape : choisir la page fille suivante (résolution,
requêtes, joueurs ou logs).

---

## Session du 27/07/2026 (suite) — Gestion des joueurs (3e écran du lot Admin)

**Choix du 3e écran** : joueurs plutôt que résolution/requêtes/logs — même
raison que la validation, `setPlayerRole`/`setPlayerStatus` sont catégorie B
SANS recompute (T6a §5.3), pas de dépendance sur T5.

**Bonne surprise au pré-vol** (comme pour le tableau de bord) : les
garde-fous fins (pas d'auto-rétrogradation, dernier admin actif protégé)
étaient DÉJÀ posés par un trigger (`enforce_users_invariants`, migration #3
corrigée #4) — écriture réduite à une UPDATE directe sur `users`, aucune
fonction SQL, aucune migration pour ce lot.

**Spec** (`SPEC_ECRAN_ADMIN_PLAYERS_V0_1.md`, assemblage comme les 2 lots
précédents). Décision d'implémentation actée : l'auto-désactivation (rester
ADMIN mais se désactiver soi-même) n'est pas bloquée sauf pour le dernier
admin actif — reflété tel quel, pas de garde supplémentaire inventée.

**Code** : `lib/queries/admin-players.ts` (tri ADMIN puis PLAYER, calcule
`isSelf`/`isLastActiveAdmin` en lecture pour griser AVANT le clic) ;
`lib/actions/admin-players.ts` (`setPlayerRole`/`setPlayerStatus`,
messages d'erreur du trigger remontés tels quels) ; `components/admin/
PlayerRow.tsx` — boutons `disabled` HTML natifs, fonctionnent sans JS.
Carte « Gestion des joueurs » du tableau de bord rendue `<Link>` actif.

**Vérifié** : `tsc`/`eslint`/`next build` propres, aucun conflit de route.

**Test en conditions réelles**, avec un **vrai cas négatif** cette fois :
promotion puis rétrogradation de `Tariq_M` (aller-retour réel, sans effet
résiduel) ; surtout — tentative de **forcer** l'auto-rétrogradation de
`Sofia_Admin` en construisant le POST directement, contournant le bouton
désactivé côté UI (qui n'est qu'un confort) : bloquée CÔTÉ SERVEUR par le
trigger, message d'erreur exact remonté. Confirme que la vraie garde vit en
base, pas seulement dans l'UI. Logs de test supprimés, mot de passe
temporaire re-randomisé.

**Suivi mis à jour en miroir** : `ETAT_ACTUEL.md` (nouveau §2.22) ;
`GAPS_OUVERTS.md` (4 pages filles → 3 restantes) ; cette entrée de journal.

**État en fin de session** : Gestion des joueurs CODÉE, VÉRIFIÉE, COMMITTÉE
et POUSSÉE. Prochaine étape : résolution des paris, requêtes de correction,
ou logs — les deux premières resteront partiellement bloquées par
l'absence du moteur de scoring T5.

---

## Session du 27/07/2026 (suite) — Historique des logs (4e écran, dernier sans dépendance T5)

**Choix** : logs, dernière page fille SANS AUCUNE dépendance sur T5 (écran
de lecture pure, 0.2.7 §8) — après ce lot, les 2 pages restantes
(résolution, requêtes) sont TOUTES DEUX partiellement bloquées.

**Trouvaille au pré-vol** : le détail des filtres/tri, que 0.2.9 §11
semblait lister comme un point encore ouvert, était en réalité DÉJÀ tranché
— retrouvé dans `nba_pronos_PREP_SPEC_TECHNIQUE_V1.md` §B5 (validé le
17/07/2026) : tri plus récent d'abord, filtres action/admin/date. Trouvé en
cherchant la source, pas deviné.

**Spec** (`SPEC_ECRAN_ADMIN_LOGS_V0_1.md`). **Code** :
`lib/labels/audit.ts` NOUVEAU (vocabulaire fermé des actions, à étendre par
chaque futur lot admin) ; `lib/queries/admin-logs.ts` (options de filtre
dérivées des valeurs réellement présentes en base) ; `components/admin/
AuditLogRow.tsx` ; `app/(admin)/admin/logs/page.tsx` (filtres `<form
method="get">` natif, aucun JS). Carte « logs » du tableau de bord rendue
cliquable.

**Refactor mineur en cours de route** : `parisDayBoundsUtc` (écrite pour
Mes pronos, §2.11) déménagée vers un nouveau module neutre
`lib/dates/paris.ts`, 2e utilisateur (filtre date des logs) — évite une 3e
implémentation divergente, même logique que le piège déjà noté pour
`bet_deadline_open`. Mes pronos re-vérifié après coup, aucun changement de
comportement.

**Vérifié** : `tsc`/`eslint`/`next build` propres (Mes pronos y compris),
aucun conflit de route.

**Test en conditions réelles** : 2 vraies entrées de log générées via
Gestion des joueurs (promotion/rétrogradation de Tariq_M) ; rendu sans
filtre correct (acteur, libellé, cible résolue) ; filtres action/admin/date
tous vérifiés, y compris l'état vide filtré. Nettoyé après coup.

**Suivi mis à jour en miroir** : `ETAT_ACTUEL.md` (nouveau §2.23) ;
`GAPS_OUVERTS.md` (2 pages filles restantes, TOUTES DEUX partiellement
bloquées par T5 désormais — reformulé pour le signaler clairement) ; cette
entrée de journal.

**État en fin de session** : Historique des logs CODÉ, VÉRIFIÉ, COMMITTÉ et
POUSSÉ. Le lot Admin est à 4/6 écrans. Prochaine étape naturelle : soit le
moteur de scoring T5, soit la partie non bloquée de « requêtes ».

---

## Session du 27/07/2026 (suite) — Correctif de latence : région Vercel

**Deux questions posées par l'utilisateur avant d'enchaîner sur T5** :
l'Historique des logs est-il bien en ligne sur Vercel, et une latence
perceptible après chaque clic est-elle normale ?

**Vérification déploiement** : `vercel ls` + `vercel inspect` confirment
un déploiement récent (< 1h) aliasé sur `nba-pronos.vercel.app`, incluant
`/admin/logs`, `/admin/validation`, `/admin/players` — les 3 répondent
`307 → /login` en production comme en local. Auto-deploy sur push
fonctionne bien.

**Diagnostic latence** : les fonctions Vercel tournaient en `iad1`
(Washington D.C., région PAR DÉFAUT de tout nouveau projet Vercel, jamais
changée depuis le déploiement initial du 27/07). L'utilisateur a confirmé
via son dashboard Supabase que la base est en `eu-west-1` (Dublin) — pas
Paris comme supposé au départ. Recherche web faite AVANT de conclure
(`WebSearch`/`WebFetch` sur la doc Vercel officielle) : le plan Hobby
permet de choisir UNE région (`vercel.json` → `regions`), et Vercel
recommande explicitement de coller la région à la BASE DE DONNÉES plutôt
qu'à l'utilisateur final (une page fait souvent plusieurs allers-retours
fonction↔base par requête, contre un seul aller-retour navigateur↔fonction).
`dub1` (Dublin) = `eu-west-1`, correspondance exacte confirmée par la
table de régions Vercel.

**Correctif** : `vercel.json` (`regions: ["dub1"]`), committé, poussé,
redéployé. Vérifié après coup : `vercel inspect` du nouveau déploiement
confirme `[dub1]` sur toutes les fonctions ; site toujours fonctionnel
(`/leaderboard` 200 après le redéploiement).

**Suivi mis à jour** : `ETAT_ACTUEL.md` (nouvelle sous-section, §1 non
touché car ce n'est pas un écran). Pas d'entrée `GAPS_OUVERTS.md` (point
clos, rien à rouvrir).

---

## Session du 27/07/2026 (suite) — Chantier T5, lot 1/4 : moteur pur

**Découpage en 4 lots proposé et confirmé AVEC l'utilisateur**
(AskUserQuestion), même discipline « un lot à la fois » que le lot Admin :
moteur pur → writer `series.official_*` minimal (pas tout T4) →
orchestration `recompute*` → câblage admin. **2e question posée en même
temps** : ajouter `vitest` (aucun framework de test dans le projet à ce
jour) pour tester le moteur pur en cas de table, comme le prévoit
explicitement `SPEC_TECHNIQUE_SCORING_V0_1.md` §11 (32 cas déjà listés) —
confirmé.

**Code** : `lib/scoring/engine.ts` — les 4 fonctions PURES du §3
(`deriveSeriesOutcome`, `scoreMatchPrediction`, `scoreBracketPick`,
`scoreBet`), aucune I/O. `lib/scoring/engine.test.ts` — 26 tests couvrant
les cas 1-4/6-27 du §11 (32 cas au total, 6 restants — 28-32, orchestration
— renvoyés au lot 3 ; cas 5 renvoyé au lot 3 aussi, voir ci-dessous).

**2 points trouvés en écrivant le code, documentés en commentaire, PAS de
nouvelle décision produit** :
- Le §4 de T5 dit que `deriveSeriesOutcome` « renvoie tel quel » un statut
  CANCELLED/POSTPONED déjà présent, mais sa signature figée (§3) ne prend
  QUE `matches`+`competitionType`, pas de statut existant en entrée — les
  deux phrases sont littéralement incompatibles. Tranché : la signature du
  §3 fait autorité (fonction strictement pure), le respect d'un statut déjà
  posé par un admin est un garde-fou d'ORCHESTRATION (lot 3), pas de cette
  fonction.
- La composante AFFICHE d'un pick de bracket se score dès que la PAIRE
  OFFICIELLE de la série est connue, INDÉPENDAMMENT du fait que la série
  soit FINISHED — confirmé par les cas de test #26/#27 de la spec elle-même
  (« sera scorée quand la paire officielle sera connue »).

**Vérifié** : `npm test` → 26/26 ; `tsc`/`eslint`/`next build` propres,
aucune route impactée.

**Suivi mis à jour en miroir** : `ETAT_ACTUEL.md` (nouveau §2.24 + note sur
le découpage des 4 lots + `vitest`) ; cette entrée de journal.

**État en fin de session** : moteur pur CODÉ, TESTÉ, COMMITTÉ et POUSSÉ.
Prochaine étape : lot 2/4, le writer `series.official_*`.

---

## Session du 27/07/2026 (suite) — Chantier T5, lot 2/4 : writer `series.official_*`

**Code** : `lib/sync/writeSeriesOutcome.ts` — UNIQUEMENT le writer (T5
§12.1/§12.2), pas le reste de T4 (pas de route API, pas de client
Highlightly, pas de cron, comme annoncé au découpage du lot 1). Fonction
fine (un UPDATE service_role sur les 3 colonnes `series.official_*`), sans
garde de « changement » — c'est à l'appelant (orchestration, lot 3) de
décider s'il faut écrire.

**Vérifié** : `tsc`/`eslint`/`next build` propres. Test en conditions
réelles (service_role, sur une série sans rôle particulier du jeu de
test) : écriture des 3 colonnes vérifiée puis revert vérifié. Pas de test
`vitest` pour ce module — touche une vraie base, vérifié en conditions
réelles comme le reste du projet plutôt que mocké.

**Suivi mis à jour en miroir** : `ETAT_ACTUEL.md` (nouveau §2.25, header,
§2 avancement) ; cette entrée de journal.

**État en fin de session** : writer CODÉ, VÉRIFIÉ, COMMITTÉ et POUSSÉ.
Prochaine étape : lot 3/4, l'orchestration.

---

## Session du 27/07/2026 (suite) — Chantier T5, lot 3/4 : orchestration (`recompute*`)

**Code** : `lib/scoring/recompute.ts` — `recomputeMatch`/`recomputeSeries`/
`recomputeBet`/`recomputeCompetition` (T5 §10), adaptateur impur autour du
moteur pur (lot 1) + du writer (lot 2). Le garde-fou d'orchestration décidé
au lot 1 (ne jamais écraser un CANCELLED/POSTPONED déjà posé par un admin)
est implémenté ici, avant tout appel à `deriveSeriesOutcome`/
`writeSeriesOutcome`. `vitest.config.ts` ajouté (alias `@/*` + `server-only`
→ vide, nécessaire pour que les modules `lib/` s'importent entre eux sous
vitest comme dans l'app Next).

**Décision d'implémentation notée** (transaction, §10.3) : la spec demande
une transaction unique par passe ; `supabase-js` (REST) ne le permet pas
sans écrire une fonction RPC dédiée pour chaque `recompute*` — jugé hors
périmètre, compensé par l'idempotence (P5). Assumé et documenté, pas
silencieux.

**Test d'intégration en conditions réelles, le plus poussé de la session**
(fichier vitest JETABLE, supprimé après coup — crée/détruit sa PROPRE
compétition ARCHIVED isolée, jamais "Playoffs NBA (test)") : bracket à 3
séries (2 ROUND_1 → 1 CONF_SEMIS), 2 joueurs réutilisés (Amine92/Chloe_B),
4 matchs joués 4-0. **5 vérifications, toutes passent**, dont la plus
importante : une fois la paire officielle de la série avale renseignée
(simulant un avancement réel), son affiche se score correctement **sans
aucun code spécial** — confirme en conditions réelles l'interprétation
actée au lot 1 (affiche indépendante de FINISHED). Et l'idempotence P5
vérifiée en rejouant `recomputeCompetition` deux fois de suite sur la
compétition de test entière : résultat rigoureusement identique. Deux
frictions techniques résolues en cours de route (pas des bugs du moteur,
des surprises d'outillage) : `server-only` lève une erreur sous vitest par
défaut (condition de résolution `react-server` absente, corrigé par alias
vitest) ; colonne `series.slot_index` NOT NULL découverte en testant (pas
dans mes notes de schéma), corrigée. Compétition de test entièrement
supprimée après vérification (confirmé : 0 ligne restante).

**Suivi mis à jour en miroir** : `ETAT_ACTUEL.md` (nouveau §2.26, header,
§2 avancement — "le moteur de scoring est désormais fonctionnellement
complet") ; `GAPS_OUVERTS.md` (reformulé : résolution/requêtes/Recalculer
ne sont plus bloqués par l'ABSENCE de T5, reste juste à les câbler) ; cette
entrée de journal.

**État en fin de session** : orchestration CODÉE, VÉRIFIÉE en conditions
réelles, COMMITTÉE et POUSSÉE. Prochaine étape : lot 4/4, le câblage
admin — DERNIER lot du chantier T5, scindé en 3 morceaux (bouton,
résolution, requêtes) sur demande de l'utilisateur.

---

## Session du 27/07/2026 (suite) — Lot 4a : bouton « Recalculer »

**Code** : `lib/actions/admin.ts` (`recalculateCompetition`) ;
`components/admin/RecalculateButton.tsx` — SEULE feuille "use client" du
tableau de bord, dialogue de confirmation copié du patron déjà utilisé par
`BracketFillBoard.tsx` (Bracket personnel), comme la spec le prescrivait.
Bouton câblé dans `app/(admin)/admin/page.tsx`, désactivé si aucune
compétition active.

**Vérifié** : `tsc`/`eslint`/`next build`/`npm test` tous propres.

**Limite de vérification signalée EXPLICITEMENT à l'utilisateur** (rupture
avec le patron de tous les lots précédents, où chaque écriture avait été
réellement cliquée/soumise) : `recalculateCompetition` est appelée par le
client (`useTransition`) et non par un formulaire natif — rejouer ce
mécanisme à la main (sans navigateur) est nettement plus complexe que la
technique `$ACTION_ID_` déjà maîtrisée pour les formulaires natifs
progressive-enhancement. Compensé par : la fonction appelée
(`recomputeCompetition`) est déjà prouvée par 5 tests d'intégration réels
(lot 3) ; le MÉCANISME d'appel (client + `useTransition` + server action
directe) est déjà prouvé fonctionnel dans ce dépôt sur un cas analogue
(`validateBracket`, Bracket personnel, §2.16). Reste non vérifié en vrai :
la composition propre à cette action (is_admin + compétition active +
logAdminAction, chacun individuellement déjà prouvé ailleurs). Proposé à
l'utilisateur de cliquer lui-même avant de committer, plutôt que de
prétendre une vérification qui n'a pas eu lieu.

**Suivi mis à jour en miroir** : `ETAT_ACTUEL.md` (nouveau §2.27, header,
§2 avancement) ; cette entrée de journal.

**Bug réel trouvé par l'utilisateur en testant** (capture d'écran) :
`/admin` s'affichait quasi illisible — texte clair sur fond quasi blanc.
Diagnostic : `app/(admin)/admin/layout.module.css` `.shell` ne fixait ni
fond ni couleur via les tokens, retombait sur `--background` de
`globals.css` (blanc par défaut). EXACT même correctif déjà appliqué à
`app/(app)/layout.module.css` (commentaire déjà présent là-bas :
« quel que soit ce que définit globals.css par ailleurs ») — pas répliqué
en créant la coquille admin (§2.20). Une seule coquille partagée par les 4
écrans admin → corrigé d'un coup pour les 4. Confirmé lisible par
l'utilisateur après coup sur les 4 pages. Premier vrai test navigateur de
la zone admin (les lots précédents n'avaient été vérifiés que par fetch
HTML, jamais visuellement) — leçon : le HTML correct n'implique pas un
rendu visuel correct, un test navigateur réel reste irremplaçable.

**Suivi mis à jour en miroir** : `ETAT_ACTUEL.md` (§2.27 complétée avec le
correctif, header) ; cette entrée de journal.

**État en fin de session** : bouton Recalculer + correctif de fond/texte
CODÉS, VÉRIFIÉS PAR L'UTILISATEUR EN VRAI (les 4 écrans admin), COMMITTÉS
et POUSSÉS.

---

## Session du 27/07/2026 (suite) — Lot 4b : file de résolution des paris

**Factorisation faite** (annoncée depuis §7 ETAT_ACTUEL, jamais faite avant
faute d'un 4e utilisateur réel) : `lib/scoring/bet-deadline.ts` —
`computeBetDeadlinesPassed`, extrait de la logique déjà dupliquée 3 fois.
Les 3 sites existants NON retouchés (zéro risque pour du code déjà
testé/committé).

**Code** : `lib/queries/admin-resolution.ts` (bets VALIDATED + échéance
dépassée, flag `isContested` si une requête de correction PENDING existe
déjà sur ce pari) ; `lib/actions/admin-resolution.ts` (`resolveBet` —
motif OBLIGATOIRE côté serveur si contesté) ; `components/admin/
ResolutionBetCard.tsx` — UN SEUL formulaire à 2 boutons submit
(`name="outcome"`), plus simple que la validation ici. `lib/labels/
bets.ts` étendu (`BET_DIFFICULTY_POINTS`, affichage seulement).

**Vérifié** : `tsc`/`eslint`/`next build`/`npm test` propres.

**Test en conditions réelles**, avec un **cas négatif réel** : 2 paris de
test créés sur une série déjà passée (CLE-ORL, sans toucher aux données
réelles déjà rattachées) + 1 requête de correction PENDING sur le second.
Tentative de résoudre le pari contesté SANS motif → refusée côté serveur ;
avec motif → acceptée. Résultats en base vérifiés exacts : pari normal →
WON, `points_awarded=20` (calculé par `recomputeBet`, pas deviné) ; pari
contesté → LOST, `points_awarded=0`, motif enregistré. Tout nettoyé après
coup.

**Suivi mis à jour en miroir** : `ETAT_ACTUEL.md` (nouveau §2.28, header,
§2 avancement) ; `GAPS_OUVERTS.md` (réduit à 1 seule page fille restante —
requêtes) ; cette entrée de journal.

**État en fin de session** : file de résolution CODÉE, VÉRIFIÉE, COMMITTÉE
et POUSSÉE. Dernier morceau du chantier T5 : le traitement des requêtes de
correction (`/admin/requests`).

---

## Session du 27/07/2026 (suite) — Lot 4c : file des requêtes — CHANTIER T5 CLOS

**Asymétrie trouvée au pré-vol, documentée avant de coder** : les requêtes
MATCH_PREDICTION (migration #7) peuvent porter une proposition du joueur
(vainqueur+écart) que l'admin confirme/ajuste — correction réelle de
contenu. Les requêtes BET (migration #11, « pari oublié ») n'en portent
JAMAIS — la vraie correction est de résoudre le pari (déjà fait via
/admin/resolution, lot 4b) ; « traiter » une requête BET ici marque juste
`is_admin_corrected` (transparence) et clôt la requête. Deux comportements
de traitement réels, pas un oubli.

**Code** : `lib/queries/admin-requests.ts` (une seule file, les deux
cibles) ; `lib/actions/admin-requests.ts` (`processCorrectionRequest`
branché par type, `recomputeMatch` UNIQUEMENT pour MATCH_PREDICTION ;
`rejectCorrectionRequest`) ; `components/admin/RequestCard.tsx` — rendu
différent selon le type, aucun "use client".

**Vérifié** : `tsc`/`eslint`/`next build`/`npm test` propres, 6 routes
`/admin/*` sans conflit.

**Test en conditions réelles le plus complet du lot Admin**, 4 scénarios :
(1) MATCH_PREDICTION « voie A » avec proposition du joueur, traitée →
recomputeMatch a réellement scoré le prono corrigé, vérifié en base ; (2)
**cas négatif réel avec un garde-fou PRÉEXISTANT** — Sofia_Admin tente de
traiter SA PROPRE requête → bloquée par le TRIGGER
`enforce_prediction_correction` (déjà en base, pas codé par ce lot),
message exact remonté, rien modifié ; (3) BET traité → marquage
transparence appliqué, statut du pari inchangé (résolution reste séparée,
comme voulu) ; (4) BET refusé avec motif → rien touché sur le pari.
Nettoyage : cycle de FK circulaire rencontré (match_predictions ↔
correction_requests), résolu en vidant les FK avant suppression — artefact
du script jetable, pas un bug de l'écran. Tout confirmé supprimé.

**Suivi mis à jour en miroir** : `ETAT_ACTUEL.md` (nouveau §2.29, header,
§2 avancement réécrit — lot Admin ET chantier T5 tous deux ENTIÈREMENT
clos) ; `GAPS_OUVERTS.md` (les 2 entrées « implémentation V1 » devenues
obsolètes fusionnées en une seule, à jour) ; cette entrée de journal.

**État en fin de session** : file des requêtes CODÉE, VÉRIFIÉE (pas encore
committée — à confirmer avec l'utilisateur). **CHANTIER T5 (4/4 lots) ET
LOT ADMIN (6/6 écrans) ENTIÈREMENT CLOS.** Prochaine étape à discuter avec
l'utilisateur : moteur de synchro T4, Realtime T6c, ou le vrai hub Jouer.

---

## Session du 27/07/2026 (suite) — Ordre de reprise fixé + vulnérabilités npm consignées

**Demande utilisateur** : mettre à jour le suivi pour que la prochaine
session reprenne dans cet ordre : (1) les 12 vulnérabilités npm remontées
en fin de session précédente (jusqu'ici seulement mentionnées dans le
chat, jamais consignées dans le suivi du dépôt) ; (2) le vrai hub Jouer ;
(3) le reste (T4, Realtime T6c).

**`npm audit` rejoué** pour consigner le détail exact plutôt qu'un vague
« 12 vulnérabilités » : 2 chaînes indépendantes — `next` figé à `16.2.10`
exact (pas une plage, donc `npm audit fix` seul ne le touche pas) : 9 CVE
HIGH + `postcss`/`sharp` transitifs, corrigés en passant à `16.2.12` ;
`eslint` en v9, corrigé par `eslint@10.8.0` (breaking change annoncé).

**Suivi mis à jour** : `GAPS_OUVERTS.md` (nouveau bandeau d'ordre en tête
de fichier, nouvelle entrée détaillée sur les 12 vulnérabilités, entrée
« Implémentation V1 » reformulée pour refléter l'ordre) ; `ETAT_ACTUEL.md`
(note de fin remplacée par l'ordre de reprise en 3 points) ; cette entrée
de journal. Aucun code touché — uniquement de la documentation.

---

## Session du 27/07/2026 (suite) — Chantier Gestion des compétitions, lot 1/3 : création

**Question de l'utilisateur** : « on n'a pas travaillé sur les choix de
compétitions ? On est par défaut en Playoffs mais on doit pouvoir switcher
en NBA Cup, c'est prévu ? »

**Investigation, pas d'implémentation immédiate** (question exploratoire) :
retracé `decisions_multi_competitions_historique.md`. Trouvaille : le plan
d'origine (16/07/2026) visait la NBA Cup EN PREMIER pour la V1 (lancement
réel visé 30/10/2026), Playoffs explicitement reporté « sans urgence,
saison 2027 » — la mécanique Cup était même entièrement décidée le même
jour. Le 17/07, le périmètre technique (modèle de données/RLS) a été
élargi à Playoffs+Cup, mais le texte réaffirme un « séquencement
d'implémentation orienté Cup ». Le 23/07, la création du 1er jeu de
données de test a silencieusement choisi Playoffs (`seed-playoffs-test-
data.mjs`) — AUCUNE discussion retrouvée recroisant ce choix avec la
décision du 17/07. Tous les écrans codés depuis ont été testés contre ce
jeu Playoffs, renforçant la dérive sans jamais la questionner. Le moteur
de scoring (T5), lui, n'a jamais dérivé : les deux barèmes sont pleinement
codés depuis le début.

Présenté clairement à l'utilisateur (formulation factuelle, pas
d'implémentation en douce). Réponse : peu importe pour les données de
TEST, mais construire l'écran de gestion des compétitions pour être prêt
le moment venu.

**2e trouvaille, en creusant le besoin** : même une fois une compétition
créée, RIEN ne fait aujourd'hui avancer une équipe vers le tour suivant ni
ne pose un résultat officiel — ni T4 (synchro, non codée), ni aucune
action admin (le writer `series.official_*` de T5 existe mais aucun écran
ne l'appelle jamais pour un usage normal). Signalé avant de choisir quoi
que ce soit.

**Découpage en 3 lots proposé et confirmé** (AskUserQuestion) : 1. création
(CE lot) — 2. saisie manuelle des résultats (remplace T4, dure toute la
compétition, LE PLUS IMPORTANT avant le 30/10) — 3. clôture/archivage.
Confirmé aussi : saisie manuelle des équipes par l'admin à la création,
pas d'attente du mapping automatique A7 (dépend de T4).

**Spec** (`SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1.md`, nouveau fichier, close
en séance). **Trouvaille au pré-vol** : AUCUNE policy RLS d'INSERT
n'existe sur `series` — la création du bracket Playoffs (15 lignes) passe
donc par `getServiceClient()` (catégorie B, écriture admin-système, même
famille que `recomputeCompetition`), après re-vérification de `is_admin()`
en session, plutôt qu'une nouvelle migration RLS pour un cas d'usage rare.

**Code** : `lib/queries/admin-competitions.ts` ; `lib/actions/
admin-competitions.ts` (`createCompetition` — topologie du bracket
Playoffs FIXE codée en dur, bottom-up NBA_FINALS→...→ROUND_1 pour toujours
connaître l'id de la série aval avant l'amont ; validations serveur :
16 équipes distinctes, conférences cohérentes) ; `app/(admin)/admin/
competitions/{page,new}.tsx` (formulaires natifs, 100% composant serveur).
Carte « Compétitions » ajoutée au tableau de bord.

**Vérifié** : `tsc`/`eslint`/`next build`/`npm test` propres, 24 routes
sans conflit.

**Test en conditions réelles avec précaution particulière** (touche la
VRAIE compétition active de la démo) : cas négatif sans risque (tentative
de création alors qu'une compétition est active → refusée) ; cas de
succès en ARCHIVANT TEMPORAIREMENT la vraie compétition (bloc try/finally
garantissant la restauration même en cas d'échec), créant une compétition
de test avec 16 vraies équipes, vérifiant les 15 séries (topologie
correcte, ROUND_1 rempli, tours suivants vides), PUIS supprimant le test
ET restaurant la vraie compétition en ACTIVE. Confirmé après coup :
compétition réelle intacte, `/leaderboard`/`/bracket` répondent
normalement, aucune trace de test résiduelle.

**Suivi mis à jour en miroir** : `ETAT_ACTUEL.md` (nouveau §2.30, header
resserré — la chaîne « après X, après Y » avait grossi sur plusieurs
sessions, réécrite de façon concise conformément à la nature du fichier) ;
`GAPS_OUVERTS.md` (nouvelle entrée détaillée, ordre de reprise noté comme
à re-discuter) ; cette entrée de journal.

**État en fin de session** : lot 1/3 (création) CODÉ, VÉRIFIÉ (pas encore
committé — à confirmer avec l'utilisateur). Prochaine étape à re-discuter
avec l'utilisateur : ordre entre vulnérabilités npm, vrai hub Jouer, et
lot 2/3 des compétitions (saisie manuelle de résultats).

---

## Correctif — dialogue de validation Matchs (27/07/2026, suite)

Après le commit du lot 1/3 Compétitions, question hors-chantier de
l'utilisateur : capture d'écran de `/play/matches` (test mobile réel sur
Vercel), LAL–HOU, Lakers sélectionnés + écart posé à 6, mais message
d'erreur rouge « Choisis un vainqueur et un écart avant de valider. »
affiché malgré une saisie visiblement complète. « Normal ? »

**Diagnostic** (lecture de code, pas de reproduction en environnement
réel) : `PredictionForm.tsx` active `Valider le prono` dès que la saisie
LOCALE (state React) est complète, mais `validateMatchPrediction`
(`lib/actions/matches.ts`) relit le brouillon PERSISTÉ en base, jamais la
saisie locale. Cliquer directement sur `Valider` sans être passé par
`Enregistrer le brouillon` échoue donc systématiquement — exactement le
cas de la capture. Confirmé comme vrai bug, pas une fausse manip.

Proposition initiale (désactiver `Valider` tant que non enregistré) —
**refusée par l'utilisateur** : le bouton doit rester accessible. Contre-
proposition de l'utilisateur, actée telle quelle : dialogue de
confirmation à deux variantes selon `isUnsaved` — brouillon à jour :
inchangé (Annuler/Valider) ; brouillon non enregistré : avertissement
explicite + 3 actions (Retour / Enregistrer le brouillon / Valider
définitivement — enregistre puis valide en un seul clic).

**Code** : `components/matches/PredictionForm.tsx` (+`.module.css`,
nouvelle classe `.dialogSecondary`). Spec amendée en miroir
(`SPEC_ECRAN_MATCHS_V0_1.md` §21, décision consignée au §19).

**Vérifié** : `tsc`/`eslint`/`next build` propres. Action `useTransition`
(même famille que `RecalculateButton`) — pas rejouable en headless comme
noté précédemment ; test réel laissé à l'utilisateur sur le déploiement,
comme convenu avant de committer.

---

## Correctif des 12 vulnérabilités npm (27/07/2026, suite)

Reprise de session : l'utilisateur choisit de traiter le point 1 de
l'ordre de reprise (12 vulnérabilités `npm audit`, fixées la session
précédente) plutôt que le lot 2/3 compétitions ou le vrai hub Jouer.

`next` 16.2.10 → 16.2.12 (+ `eslint-config-next` assorti) : corrige les 9
CVE directes de Next.js. Vérifié par `npm audit --json` : l'entrée `next`
ne référence plus que `postcss`/`sharp`, embarqués par `next` en version
figée dans son propre `package.json`.

`eslint` 9 → 10 tenté, **abandonné après une vraie trouvaille bloquante** :
`eslint-plugin-react@7.37.5` (embarqué par `eslint-config-next@16.2.12`)
plante sous eslint 10 (`TypeError: contextOrFilename.getFilename is not a
function` — API supprimée par ESLint 10, aucune version stable compatible
publiée à ce jour, vérifié sur le registre npm). Flagué explicitement
avec l'utilisateur (AskUserQuestion) avant de trancher, comme convenu pour
ce projet quand un plan se heurte à une réalité technique imprévue —
choix confirmé : rester sur eslint 9.

Les 6 vulnérabilités restantes (chaîne `eslint-plugin-*` →
`minimatch@3.1.5` → `brace-expansion`) neutralisées par deux `overrides`
npm ciblés (`minimatch@^10.2.6` + `brace-expansion@^5.0.8` — un override
de `brace-expansion` seul cassait `minimatch@3.1.5`, découvert en testant,
pas deviné) + deux autres pour la chaîne `next`/`postcss`/`sharp`
(`postcss@^8.5.18`, `sharp@^0.35.0`).

**Résultat** : `npm audit` → 0 vulnérabilité (contre 12). `tsc`/`eslint`/
`npm test` (26 tests)/`next build` tous propres, 24 routes sans conflit,
aucune régression.

**Suivi mis à jour en miroir** : `ETAT_ACTUEL.md` (nouveau §2.32, header
réécrit) ; `GAPS_OUVERTS.md` (gap npm retiré/marqué résolu, nouveau gap
« eslint bloqué en v9 » ajouté, ordre de reprise pointé sur le point 1
traité) ; cette entrée de journal.

**État en fin de session** : committé et poussé sur `main` (2 commits :
dépendances, puis doc). Prochaine étape choisie par l'utilisateur : lot
2/3 compétitions (saisie manuelle de résultats).

---

## Gestion des compétitions — lots 2/3 et 3/3 (27-28/07/2026, suite)

L'utilisateur choisit le lot 2/3 (saisie des résultats). Aucune spec
n'existait — rédigée en séance, même patron que Bracket personnel. Deux
points structurants tranchés AVEC l'utilisateur (AskUserQuestion) avant de
coder : avancement du vainqueur vers le tour suivant **automatique** (pas
de bouton séparé) ; résolution manuelle A2 (série annulée/vainqueur désigné
à la main) **hors périmètre**, reportée en gap.

**Trouvaille au pré-vol** : la création d'une compétition (lot 1) ne crée
que les `series`, aucun `matches` — le lot doit donc aussi permettre de
CRÉER les matchs d'une série au fur et à mesure, pas seulement en saisir
le score.

**Code** : `lib/scoring/advancement.ts` (`advanceWinnerIfDecided`, NOUVELLE
fonction, volontairement séparée de `recompute.ts` — T5 reste clos, cette
frontière n'est pas rouverte) ; `lib/queries/admin-results.ts` ;
`lib/actions/admin-results.ts` (`createMatch` en service_role — aucune RLS
INSERT sur `matches`, même trouvaille que `series` au lot 1 —
`saveMatchResult` enchaîne UPDATE → `recomputeMatch` → `advanceWinnerIfDecided`
avec une seule entrée d'audit) ; `app/(admin)/admin/competitions/results/`
+ `components/admin/SeriesResultsCard.tsx`, formulaires natifs uniquement.

**Bug remonté par l'utilisateur en testant, corrigé dans la foulée** :
champs de score illisibles (placeholder minuscule qui disparaît au clic,
largeur 5 caractères) — corrigé avec un vrai `<label>` visible (abréviation
d'équipe) et une largeur plus confortable.

**Débloqué en cours de route, pas prévu à ce stade** : en testant la
création d'une 2e compétition (pour préparer le branchement de T4), la
contrainte `uniq_one_active_competition` a bloqué l'utilisateur — sans
clôture, aucune nouvelle compétition. Décidé AVEC l'utilisateur (au lieu
d'un contournement jetable) : construire le lot 3/3 pour de bon.
`decisions_multi_competitions_historique.md` §3 (« clôture = snapshot puis
reset ») interprété comme : en V1, RIEN n'est supprimé (contrairement au
prototype), chaque ligne reste rattachée à son `competition_id` pour
toujours ; « reset » = juste `competitions.status` → `ARCHIVED`, ce qui
libère le slot. **Code** : `closeCompetition`
(`lib/actions/admin-competitions.ts`, session admin normale, RLS déjà
ouvertes, aucun service_role) ; `CloseCompetitionButton.tsx` (dialogue de
confirmation, action irréversible) ; nouveau module partagé
`lib/scoring/ranking.ts` (`assignRanks`, extrait de `leaderboard.ts` pour
que l'archive fige EXACTEMENT le même départage de rang que le classement
live — `leaderboard.ts` migré dessus au passage, aucun changement de
comportement).

**Question de l'utilisateur en testant, qui a mené à un vrai point non
tranché** : « l'API peut détecter les matchs Cup automatiquement ? » —
non tranché : la spec T4 confirme l'API match-centrique (jamais série-
centrique), donc détecter des matchs est plausible mais construire les 7
séries du mini-bracket à partir de ça n'a jamais été sondé empiriquement.
Reporté à une fois la clé API en main (gap reformulé, `GAPS_OUVERTS.md`).

**Test en conditions réelles, par l'utilisateur directement dans son
navigateur** (connecté en `Rillettes-31`, 2e compte ADMIN du jeu de
données — Claude n'a pas pu se connecter lui-même, changer un mot de passe
de test a été refusé par le classifieur du mode auto) : création NBA_CUP
tentée d'abord → aucune série (comportement documenté, pas un bug) ;
clôturée puis recréée en PLAYOFFS (« TEST playoff 28/07/2026 »,
code `78D0EE7C`) ; série ATL–BOS jouée à 4 matchs réels (ATL 4-0) —
vérifié directement en base par Claude (lecture seule, service_role) :
série `FINISHED`, vainqueur ATL, propagé correctement dans la bonne série
CONF_SEMIS (`team2` toujours NULL, attendu — l'autre série qui l'alimente
n'est pas encore jouée).

**Suivi mis à jour en miroir** : `ETAT_ACTUEL.md` (nouveau §2.33, header
réécrit) ; `GAPS_OUVERTS.md` (chantier compétitions marqué clos 3/3, gap
mini-bracket Cup reformulé, ordre de reprise pointé sur T4) ;
`SPEC_ECRAN_ADMIN_RESULTATS_V0_1.md` (nouveau) ;
`SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1.md` (§9 ajouté) ; cette entrée de
journal.

**État en fin de session** : PAS committé à ce stade (à confirmer avec
l'utilisateur). Prochaine étape actée AVEC l'utilisateur : T4 (vraie
synchro API Highlightly), bloquant = clé API Highlightly à obtenir et
posée par l'utilisateur dans `.env.local`.

---

## T4 — implémentation (28/07/2026)

Clé Highlightly posée par l'utilisateur dans `.env.local`
(`HIGHLIGHTLY_API_KEY`). Avant de coder, deux points soulevés par
l'utilisateur ont mené à des vérifications empiriques et des correctifs
post-validation de `SPEC_TECHNIQUE_SYNCHRO_V0.1.md` — aucun ne rouvre une
décision de fond de T4, tous découlent de payloads réels jamais inspectés
au 18/07/2026 (pas de clé API à l'époque).

**Point de départ soulevé par l'utilisateur** : le calendrier réel (28/07,
intersaison) ne colle pas aux dates visées par le pipeline (`schedule`/
`results` sont pensés `now()`-relatif). Décidé (AskUserQuestion) : les deux
routes acceptent un `?date=YYYY-MM-DD` optionnel (`lib/sync/
devDateOverride.ts`), DEV/TEST UNIQUEMENT, jamais envoyé par le vrai
planificateur externe, toujours derrière le Bearer `SYNC_SECRET`.

**Avant de coder les types du client** : 2 appels réels effectués (`GET
/teams`, `GET /matches?date=2025-06-08&timezone=America/New_York` — vrai
jour de Finals 2025) plutôt que de deviner la forme des payloads au-delà de
ce que le repérage §5.1 avait sondé (enveloppe/statut/score). Révèle :
- `/teams` = tableau nu en racine (pas d'enveloppe `data`, contrairement à
  `/matches`) ;
- `league="NBA"` (53 entrées) mélange les 30 vraies franchises avec des
  entités hors référentiel (équipes All-Star, une internationale, "World")
  — même en filtrant sur "logo présent", 37 passent au lieu de 30 ;
- 6 abréviations Highlightly diffèrent des nôtres déjà committées (NY/GS/
  NO/SA/UTAH/WSH vs NYK/GSW/NOP/SAS/UTA/WAS).
Flagué explicitement à l'utilisateur (AskUserQuestion) avant de coder :
**table d'alias figée** (`lib/nba/teamAliases.ts`, construite à la main
depuis le payload réel) choisie plutôt qu'un filtre heuristique — `/api/
sync/teams` n'écrit donc plus jamais `teams` (nos 30 lignes existantes
restent la source de vérité), seulement `entity_mappings`.

**Avant de coder l'attache match→série** : le flux PENDING de 0.2.8 §5 ne
peut pas s'appliquer littéralement (`entity_mappings.internal_id` est `NOT
NULL` — un match jamais vu n'a aucune ligne interne à pointer), et aucun
écran de revue de mapping n'a jamais été spécifié. Flagué et tranché AVEC
l'utilisateur : l'attache est en réalité déterministe (le bracket est déjà
entièrement construit par l'admin, `team1_id`/`team2_id` toujours connus
avant qu'un match soit joué) ; le cas résiduel (0 ou 2+ séries candidates)
est ignoré + journalisé dans `sync_logs`, **volontairement passif** (pas de
badge d'alerte — confirmé explicitement, resterait un simple `count` à
ajouter si besoin un jour) ; rattrapage via le bouton « Ajouter un match »
déjà existant.

**Code** : `lib/nba/client.ts` (C-1, `getTeams`/`getMatchesByDate`/
`sumQuarters`/`normalizeMatchStatus`) ; `lib/nba/teamAliases.ts` ;
`lib/dates/newyork.ts` (même patron que `lib/dates/paris.ts`, jour
calendaire America/New_York via `Intl.DateTimeFormat("en-CA", ...)`) ;
`lib/sync/{teams,schedule,results,auth,logging,devDateOverride}.ts` ;
`app/api/sync/{teams,schedule,results}/route.ts` + `app/api/heartbeat/
route.ts` (Bearer `SYNC_SECRET`, `sync_logs`, runtime Node). `results.ts`
réutilise le patron déjà établi par `admin-results.ts::saveMatchResult` :
update `matches` → `recomputeMatch` → `advanceWinnerIfDecided`. Aucune
migration (T4 n'en produit pas, schéma déjà posé par la migration #1).

**Vérifié** : `tsc --noEmit`, `eslint`, `next build` (les 4 routes
apparaissent, aucun conflit), `vitest run` (26/26, aucune régression).
**Pas encore testé en conditions réelles** — prochaine étape : rejouer le
Plan de test §11 via `?date=` sur une vraie fenêtre de playoffs passée.

**Suivi mis à jour en miroir** : `SPEC_TECHNIQUE_SYNCHRO_V0.1.md` (4
amendements post-validation, §3/§4/§5.2/§6/§12) ; cette entrée de journal.
`ETAT_ACTUEL.md`/`GAPS_OUVERTS.md` à mettre à jour après le test réel.

**État en fin de session** : pas committé à ce stade. Prochaine étape :
poser directement dans `.env.local`.

---

## Suite du dry-run T4 : simulation étendue, test manuel utilisateur, 2 gaps trouvés (28/07/2026, suite)

L'utilisateur a demandé de pousser la simulation "comme si on était en
plein milieu des Playoffs 2026" pour voir plus de contenu. Flagué :
simuler les Playoffs en entier consommerait ~120-150 requêtes API (aucun
endpoint de plage de dates, 1 requête/jour scanné), contre ~77 restantes
sur le quota 100/jour (déjà ~23 consommées cette session). Décidé AVEC
l'utilisateur (AskUserQuestion, réponse libre) : ne pas pousser la
simulation plus loin, mais rendre visibles les prochains vrais matchs déjà
synchronisés en décalant artificiellement leur `scheduled_at` vers
"maintenant + quelques jours" (même patron déjà utilisé pour les dates du
jeu de données de seed, `GAPS_OUVERTS.md`).

Un appel `/api/sync/schedule?date=2026-04-22` de plus a découvert 12
matchs réels non résolus (Game 2/3/4 de 6 séries). Script jetable
(scratchpad) : décalage linéaire de leur `scheduled_at` vers la fenêtre
réelle des 3 prochains jours (statut repassé à `SCHEDULED`, scores non
touchés — déjà NULL). Serveur de test laissé tournant sur le port 3100
pour que l'utilisateur aille vérifier lui-même dans son navigateur.

**Demande de l'utilisateur, bloquée par le classifieur** : voir les
identifiants de Sofia_Admin pour vérifier quelque chose sur les paris
soumis. Réinitialisation du mot de passe via l'API Admin refusée par le
classifieur du mode auto — même restriction déjà rencontrée §2.33
(changer un mot de passe de compte de test). Pas contourné ; deux options
proposées (reset via le dashboard Supabase directement, ou autoriser
l'action explicitement) ; l'utilisateur n'en a finalement pas eu besoin
(a réussi à vérifier ce qu'il cherchait autrement).

**2 points trouvés par l'utilisateur en testant la saisie d'un pari sur la
compétition de dry-run** (documentés `GAPS_OUVERTS.md`, PAS corrigés —
« on verra ça à un autre moment ») :
- Admin capable de valider son PROPRE pari (`validateBet`/`rejectBet` ne
  vérifient que `is_admin()` + statut `SUBMITTED`, aucune garde
  `validated_by_admin_id != user_id`) — seul précédent connu (interdiction
  similaire pour les requêtes de correction, 0.2.3) jamais étendu ni
  discuté pour la validation normale des paris.
- Valider le prono AVANT le pari démonte `<InlineBetForm>` de l'écran
  Matchs (`PredictionForm.tsx` : early-return dès `viewStatus ===
  "VALIDATED"`) — oblige à repasser par l'onglet Paris dédié, pas pratique
  si les deux étaient prévus dans la même session.

Serveur de test toujours actif en fin de session (port 3100). Rien de
committé à ce stade — code T4 + les 2 gaps trouvés restent à traiter à une
prochaine session.

---

## Commit T4 + correction des 2 gaps + clôture du dry-run (28/07/2026, suite)

L'utilisateur choisit de committer T4 d'abord (AskUserQuestion). `tsc`/
`eslint`/`next build`/`vitest` (26/26) tous propres. Commit `3f228d5` (17
fichiers, +1209/-48) : client, `lib/sync/*`, 4 routes, + les 4 amendements
de spec et le suivi (`ETAT_ACTUEL.md`/`GAPS_OUVERTS.md`/`JOURNAL_
SESSIONS.md`). `Cadrage/nba-pronos.lnk` (raccourci Windows, non lié à ce
lot) volontairement exclu du commit. Pas poussé — en attente du feu vert
explicite de l'utilisateur.

Puis, sur demande explicite : correction des 2 gaps trouvés à la session
précédente.
- **Auto-validation admin** : `assertNotOwnBet()` (nouveau helper partagé,
  `lib/actions/admin-validation.ts`) lit `bets.user_id` AVANT toute
  écriture et bloque `validateBet`/`rejectBet` si `user_id === auth.uid()`
  de l'admin appelant, avec un message dédié (« Tu ne peux pas traiter ton
  propre pari — demande à un autre admin. ») — distinct du message
  générique « déjà traité » pour ne pas confondre les deux cas. RLS
  `bets_select` autorise déjà l'admin à lire n'importe quel pari (pas de
  nouvelle policy nécessaire). Extension par symétrie de la règle déjà
  actée pour les requêtes de correction (0.2.3), jamais discutée pour la
  validation normale des paris — pas une nouvelle règle produit inventée.
- **`InlineBetForm` inaccessible une fois le prono validé** :
  `PredictionForm.tsx`, branche `viewStatus === "VALIDATED"` — ajout du
  rendu de `<InlineBetForm>` (déjà importé, self-sufficient sur ses props,
  aucune dépendance au statut du prono) à côté du récap + `RevealPanel`.
  Un seul fichier touché.

Vérifié après les deux correctifs : `tsc --noEmit`, `eslint`, `next build`
(29 routes, aucun conflit), `vitest run` (26/26, aucune régression).

Compétition de dry-run T4 (« TEST T4 sync — Playoffs 2026 (réel) »)
archivée (script service_role reproduisant `closeCompetition()`, même
patron que la clôture précédente §2.33/§2.34 — cette fois avec un vrai
snapshot `competition_archives`, contrairement à la précédente qui n'avait
aucun participant : l'activité de test de l'utilisateur sur les paris a
généré des scores). Serveur de test arrêté.

Les 2 entrées correspondantes retirées de `GAPS_OUVERTS.md` (résolues,
trace ici — convention du fichier : un point retiré = un point traité).
`ETAT_ACTUEL.md` mis à jour en miroir.

**État en fin de session** : commit `3f228d5` (T4) fait, PAS poussé.
Correctifs des 2 gaps PAS encore committés à ce stade. Compétition de
dry-run archivée, aucune compétition active. Prochaine étape à confirmer :
committer/pousser les 2 correctifs, puis reprendre l'ordre habituel (vrai
hub Jouer, T6c, mini-bracket Cup, planificateur externe).

---

## Vrai hub Jouer — spec rédigée en séance et codée (28/07/2026, suite)

Poussé `3f228d5` + `ace0d46` sur `main` (demande explicite). L'utilisateur
choisit d'attaquer le vrai hub Jouer ; demande d'abord un rappel de ce que
recouvre le reste de T6c (lu directement dans
`SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_c.md`, croisé avec le code réel) :
l'essentiel des 13 points du chantier T6c était déjà construit au fil des
écrans (barre « toi », bascule bracket, tri classement, absents/inactif,
dialogue C2, marquage correction nominatif) — le morceau réellement manquant
est la publication Realtime sur `series` (jamais activée, T4 §9/T6c §14.2)
et son câblage sur le Bracket global (résumé + drill-down en direct).

**Hub Jouer** : aucune spec n'existait (`nba_pronos_decisions_0_2_9_ux_ui.md`
§3 posait déjà la règle fonctionnelle non rouvrable — « HUB regroupant
Matchs, Bracket, Paris, Mes pronos, avec pastilles "à faire" par univers » —
mais aucune spec d'écran visuelle). Rédigée EN SÉANCE
(`SPEC_ECRAN_HUB_JOUER_V0_1.md`, même patron que Bracket personnel) après un
aller-retour avec l'utilisateur : proposition de contenu par carte, mockup
texte, puis 2 décisions actées directement par l'utilisateur — ordre des 2
lignes (Matchs/Mes pronos en haut, Bracket/Paris en bas) et état vide = titre
seul (jamais de libellé de substitution du type « Rien à faire »).

**Code** : `lib/queries/play-hub.ts` (nouveau, lectures LÉGÈRES dédiées par
carte — sauf la carte Bracket, qui réutilise directement
`getBracketFillData()` par choix assumé : dupliquer la cascade de candidats
de tour 2+ pour économiser quelques colonnes aurait été un vrai risque de
divergence pour un gain négligeable) ; `components/play/PlayHubCard.tsx` (+
`.module.css`, carte générique serveur, badge + jusqu'à 2 lignes) ;
`app/(app)/play/page.tsx` + `page.module.css` réécrits (grille 2×2 fixe,
2 colonnes même en mobile). Le hub temporaire (§2.10) est remplacé
entièrement — l'entrée correspondante retirée de `GAPS_OUVERTS.md`.

Vérifié : `tsc --noEmit`, `eslint`, `next build` (29 routes, `/play` toujours
seul, aucun conflit), `vitest run` (26/26, aucune régression). Pas de
compétition active à ce stade (dry-run archivée juste avant) — pas de test
visuel en conditions réelles avec des données peuplées cette fois, mais la
logique de chaque état vide/actionnable a été relue ligne à ligne contre la
spec.

L'utilisateur a annoncé vouloir détailler chaque écran cible un peu plus à
une prochaine session (pas un gap, juste une suite explicitement annoncée).

**État en fin de session** : hub Jouer codé et vérifié, PAS encore committé.

---

## Commit du hub Jouer, revue des gaps, centralisation prono/pari (28/07/2026, suite)

Push du hub Jouer (`277313e`). L'utilisateur enchaîne sur « détailler chaque
écran » — demande d'abord une liste des corrections possibles issues de
`GAPS_OUVERTS.md` (hors décisions de scope/déploiement) : badge de correction
générique sur Matchs, tailles de logos inégales, bandeau sticky non traité en
double ouverture, tailles de logo différentes entre écrans. **Reformulation
de l'utilisateur** : ce n'est pas ça qu'il visait — il veut en réalité
centraliser la saisie des pronos/paris dans Matchs et Bracket. Reformulé et
confirmé avec lui avant de coder :
1. Pari SÉRIE saisissable directement sur la carte de série dans Bracket
   (même principe que le pari MATCH inline dans Matchs, posé le 27/07) —
   écran « Nouveau pari » gardé tel quel comme option secondaire (pas retiré).
2. Validation SYNCHRONISÉE prono+pari sur Matchs : un seul bouton quand les
   deux sont prêts en même temps, sinon comportement inchangé (confirmé :
   si le pari n'est pas rempli au moment de valider le prono, rien de
   spécial, il reste à saisir plus tard).

**Code (validation synchronisée, `components/matches/PredictionForm.tsx`)** :
`InlineBetForm` généralisé et déplacé vers `components/bets/InlineBetForm.tsx`
(scope MATCH/SERIES, `matchId` nullable, `hasBet`/`triggerLabel` calculés par
l'appelant plutôt qu'imposés par un contrat de type unique — découplé de
`MatchCard.betSlot`, figé par la spec Matchs). Nouvelles props
`hideSubmit`/`onFieldsChange` : `PredictionForm` lit en direct les champs du
pari via un miroir d'état (`betFields`), et n'affiche qu'UN bouton "Valider"
quand prono ET pari sont prêts ensemble — `handleValidate`/
`handleValidateDefinitively` enchaînent alors `validateMatchPrediction` PUIS
`submitBet`, avec un message d'erreur dédié si le prono passe mais pas le
pari (jamais l'inverse caché). Dialogue de confirmation étendu en
conséquence (mention du pari si `betFields` non NULL).

**Code (paris SÉRIE dans Bracket, `lib/queries/bracket-fill.ts`,
`components/bracket-fill/BracketFillBoard.tsx`)** : `BracketFillSeries` étendu
de `hasBet`/`myBet` (paris SÉRIE actifs, 0 ou 1 par série,
`uniq_active_series_bet`) — même patron que `betSlot`/`myBet` de Matchs, mais
type dédié (`MySeriesBet`) pour rester découplé du contrat Matchs. Nouveau
`<InlineBetForm scope="SERIES">` sur chaque carte de série SÉLECTIONNABLE,
**PLAYOFFS uniquement** (NBA Cup exclue — une série y est 1 seul match,
`save_bet` refuse déjà le scope SÉRIE en Cup, pas la peine d'offrir une
action vouée à l'échec).

**Test en conditions réelles** : compétition minimale créée (« Test UI
Matchs », script jetable service_role, scratchpad) — 1 série ROUND_1
LAL-BOS + 1 match dans ~5h. Serveur `next start` relancé sur le port 3100.
**Confirmé par l'utilisateur lui-même dans son navigateur** : la validation
synchronisée « fonctionne nickel ».

**Suite immédiate demandée par l'utilisateur** : ajouter le nombre de paris
séries RESTANTS sur la carte Bracket du hub Jouer, et une section dédiée sur
Accueil listant les paris séries pas encore posés, qui disparaît entièrement
une fois tout rempli (jamais un état vide affiché, contrairement aux 2
sections existantes).

**Code** : `bracket-fill.ts` — nouveau champ `isBetDeadlinePassed` par série
(reproduit `public.bet_deadline_open(SERIES, ...)`, T3 §2 : coup d'envoi du
1er match de la série ; calcul du plus proche coup d'envoi par série
généralisé aux Playoffs, plus seulement calculé pour l'ordre d'affichage
NBA Cup comme avant) ; nouvelle fonction PURE exportée
`getRemainingSeriesBets(data)` (séries sélectionnables, sans pari, deadline
pas passée, PLAYOFFS uniquement) — réutilisée par `lib/queries/play-hub.ts`
(carte Bracket : ligne "N paris séries restants", indépendante de
`isActionable` — un pari série reste possible même après la deadline du
bracket lui-même, pour les tours qui n'ont pas encore commencé) ET
`lib/queries/home.ts` (nouvelle section, `SeriesBetTodoItem` dédié — PAS un
`TodoItem` détourné, celui-ci agrège alors qu'ici chaque série est listée
individuellement). Nouveau composant `components/home/SeriesBetList.tsx`.
Ancre `#series-<id>` posée sur chaque carte de `BracketFillBoard.tsx`
(+ `scroll-margin-top`) pour que le lien Accueil→Bracket pointe directement
sur la bonne carte.

Libellé de la section Accueil ajusté sur demande explicite de l'utilisateur
après un premier essai : **« Paris séries non remplis »** (pas juste « Paris
séries »).

Vérifié à chaque étape : `tsc --noEmit`, `eslint`, `next build` (29 routes,
aucun conflit), `vitest run` (26/26, aucune régression). Confirmé
visuellement par l'utilisateur dans son navigateur (serveur relancé après
chaque changement de build).

**Trouvaille distincte, sans rapport avec ce lot** : `components/home/
TodoRow.module.css` porte une modification non committée déjà présente AVANT
cette session (un commentaire vide `/*  */` remplaçant une ligne blanche) —
Claude ne l'a pas produite, aucune trace dans ce lot de travail. Laissée TELLE
QUELLE (ni committée avec ce lot, ni annulée) — à statuer avec l'utilisateur
une prochaine fois.

**État en fin de session** : validation synchronisée + paris séries
centralisés + décomptes hub/Accueil, TOUS codés et vérifiés. **PAS encore
committés.** Compétition de test (« Test UI Matchs ») toujours ACTIVE en
base — pas archivée.

---

## Commit du lot centralisation, vérif Vercel, largeur d'écran (28/07/2026, suite)

Commit (`b1cd597`) et push du lot centralisation prono/pari. Vérifié sur
Vercel (`npx vercel ls`, projet déjà lié) : déploiement de production déclenché
automatiquement par le push, passé de "Building" à "● Ready" en ~35s —
confirmé en ligne sur https://nba-pronos.vercel.app.

**Demande de l'utilisateur, capture d'écran à l'appui** : réduire la largeur
de l'écran sur desktop, « à mi-chemin entre mobile et desktop », plutôt que
d'étirer l'appli bord à bord. Nouveau token `--layout-max-width: 640px`
(`app/tokens.css`) ; `body` contraint + centré (`app/globals.css`). Les
barres en `position: fixed` ignorant le flux normal (elles ne suivent PAS
automatiquement le max-width du body) ont dû être alignées une par une —
distinguées des fonds de dialogue (`position: fixed; inset: 0` + overlay
semi-transparent, laissés intacts, correctement plein viewport) :
`TabBar.module.css`, `StickyMeBar.module.css` (leaderboard, "barre toi"),
`BetForm.module.css` (bandeau collant du formulaire de pari) — même token,
même traitement (`max-width` + `margin-inline: auto`).

**Remontée immédiate de l'utilisateur en testant** (capture d'écran) : les
bandes latérales apparues de part et d'autre de la colonne centrée étaient
dans la couleur de fond PAR DÉFAUT du navigateur (le `<html>` n'avait jamais
de fond posé explicitement — seul `.shell` de chaque layout, contenu DANS le
body désormais rétréci, portait `--color-surface-base`). Corrigé : `html {
background: var(--color-surface-base); }` dans `app/globals.css` — respecte
`data-theme` comme le reste de l'app (attribut posé sur `<html>` par
`app/layout.tsx`), pas une couleur figée.

Vérifié à chaque étape : `next build` propre, confirmé visuellement par
l'utilisateur dans son navigateur (serveur `next start` relancé 3 fois,
port 3100) — validé "parfait" après le correctif de fond.

**Question restée ouverte, reposée à l'utilisateur** : que faire de
`components/home/TodoRow.module.css` (modification préexistante, pas
produite par Claude). Réponse : « je ne sais pas trop, tu en penses quoi ? »
— recommandation de Claude : l'annuler (commentaire vide sans aucun effet
visuel/fonctionnel, ressemble à un artefact accidentel plutôt qu'un travail
en cours) plutôt que de le committer sans savoir ce que c'est, ni le laisser
traîner indéfiniment. Voir le fichier lui-même pour l'issue retenue.

**État en fin de session** : compétition de test (« Test UI Matchs »)
délibérément LAISSÉE ACTIVE (décision explicite de l'utilisateur, « on
laisse pour le moment »).