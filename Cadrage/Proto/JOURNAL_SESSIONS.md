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

---

## Audit structurel T1→T8 / D1-D6 (28/07/2026, suite)

Demande de l'utilisateur, avant de continuer à détailler les écrans un par
un : une passe de vérification structurelle croisant le document maître
(T1→T8 §4/§6, contrats §5, décisions D1-D6 §7) avec le VRAI code — schéma
réel, migrations réelles, lib/ et components/ réels, pas seulement les docs
de suivi. Lecture seule, consigne explicite « ne corrige rien, signale ».

**Méthode** : 5 agents lancés en parallèle (T1+D2/D5/D6 ; T2+T3+D4 ; T4,
chantier prioritaire avec ses 4 amendements §3/§4/§5.2/§6 ; T5+D3 ; T6a/b/c+
T7), chacun briefé avec des chemins de fichiers exacts et consigne « aucune
modification ». T8 et D1 vérifiés directement (vercel.json,
.vercel/project.json, absence de .github/workflows, absence de script de
nettoyage, grep des artefacts du prototype, git remote/premier commit).

**Verdict** : aucune des 6 décisions structurantes D1-D6 violée
silencieusement. T1, T2, T3, T5, T6b, T6c, T7 confirmés cohérents (T3/T5
avec réserves mineures) ; T4, T6a, T8 avec un écart réel chacun. Confirmation
explicite obtenue : Realtime sur `series` jamais activée reste bien le SEUL
écart T6c.

**Le plus significatif des 7 écarts trouvés** : dans T4, le flag
`recognized: false` que `normalizeMatchStatus()` (lib/nba/client.ts) promet
de remonter pour tout statut Highlightly non reconnu n'est en réalité jamais
consommé ni journalisé (lib/sync/schedule.ts, lib/sync/results.ts) — un
statut imprévu de l'API basculerait donc silencieusement en IN_PROGRESS sans
trace. C'est un écart SILENCIEUX entre ce que le code promet en commentaire
et ce qu'il fait réellement, le seul de ce type trouvé par l'audit.

Les 6 autres écarts (route `/reset-password` manquante et jamais tracée ;
trou de couverture vitest sur l'idempotence en base ; aucune spec
`SPEC_TECHNIQUE_DEPLOIEMENT_V0.1.md` n'a jamais été écrite pour T8 ;
fonctions SECURITY DEFINER post-18/07 non rétro-documentées dans la spec
RLS ; garde CANCELLED/POSTPONED dans l'orchestration plutôt que la fonction
pure ; pas d'avertissement sur quota API bas) sont détaillés avec preuve
fichier:ligne dans `GAPS_OUVERTS.md` (nouvelle section dédiée) et
`ETAT_ACTUEL.md` §2.38.

**Aucune modification de fichier de code pendant cet audit.** Prochaine
étape : trancher avec l'utilisateur l'ordre de résolution de ces 7 points.

---

## Résolution de 5 des 7 écarts trouvés par l'audit (28/07/2026, suite)

Demande de l'utilisateur juste après le rapport d'audit : « on commence à
résoudre ces points si ça te paraît cohérent ». Vu l'hétérogénéité des 7
points, proposition d'un découpage par risque/effort (AskUserQuestion) :
les 4 correctifs sûrs tout de suite, reset-password (T6a) et la spec T8
ensuite — chacun touchant une vraie décision (config Supabase Auth,
rédaction d'un document dédié) plutôt qu'un simple correctif. Choix de
l'utilisateur : la 1ère option (correctifs sûrs d'abord).

**5 écarts corrigés** :
1. T4 — `recognized` (statut Highlightly non reconnu) propagé jusqu'à
   `sync_logs` (`lib/sync/schedule.ts`, `lib/sync/results.ts`, les 2 routes
   `/api/sync/{schedule,results}`) — l'écart silencieux prioritaire de
   l'audit est fermé.
2. T4 — avertissement quota API bas ajouté (`lib/sync/logging.ts`, seuil
   10% du quota journalier, choisi et documenté — la spec ne le chiffrait
   pas).
3. T5 — `lib/scoring/recompute.test.ts` écrit (11 tests, fake Supabase en
   mémoire via `vi.mock`, horloge figée pour éviter le flake sur
   `scored_at`) : couvre l'idempotence de `recomputeMatch`/`recomputeSeries`/
   `recomputeBet`/`recomputeCompetition` (P5), une vérification transverse
   « jamais de valeur négative » (P6), et le cas 5 du plan de test §11
   (garde CANCELLED) que `engine.test.ts` annonçait sans jamais l'écrire.
   37/37 tests au total.
4. T3 — 4 fonctions SECURITY DEFINER ajoutées après le 18/07/2026
   rétro-actées dans `SPEC_TECHNIQUE_RLS_V0.1.md` §12 (nouveau).
5. T5 — garde CANCELLED/POSTPONED (vivant dans `recomputeMatch`, pas dans
   `deriveSeriesOutcome` comme la lettre du §4 le suggérait) clarifiée dans
   `SPEC_TECHNIQUE_SCORING_V0_1.md` §13 (nouveau) comme choix
   d'implémentation assumé, cohérent avec C-3 — pas une correction de code.

**2 écarts restent ouverts**, chacun nécessitant une décision avant de
coder (voir `GAPS_OUVERTS.md`) : route `/reset-password` manquante (T6a) ;
aucune spec `SPEC_TECHNIQUE_DEPLOIEMENT_V0.1.md` n'a jamais été écrite (T8).

Vérifié après chaque étape : `tsc --noEmit`, `eslint .` (0 warning),
`vitest run` (37/37), `next build` (29 routes, aucun conflit) — tous
propres. Aucune migration. **Pas encore committé.**

---

## T6a — écran reset-password (28/07/2026, suite)

Demande de l'utilisateur : « on avance T6a en premier » (des 2 écarts
restants). Conception : une seule route (`/reset-password`, prescrite par
l'arbre T6a), 2 modes distingués par la présence d'une session de
récupération détectée CÔTÉ CLIENT (`onAuthStateChange`
`PASSWORD_RECOVERY`), jamais par un paramètre lu côté serveur — le lien
email dépose le jeton dans le fragment d'URL, qui n'atteint jamais le
serveur, donc pas besoin d'une route de callback supplémentaire.
Confirmation directe (pas de server action) : `resetPasswordForEmail()` et
`updateUser({password})` appelés directement depuis le client, seule
logique métier restante côté nous étant l'absence de toute donnée
applicative à valider (contrairement à signup).

Testé en conditions réelles : serveur local, route vérifiée 200, lien
ajouté sur `/login`, aucune régression sur les autres écrans. Appel réel
`resetPasswordForEmail()` exécuté contre le vrai Supabase : rejeté pour un
email de seed (`@nba-pronos.test`, TLD non valide selon Supabase — trouvaille
distincte, tracée séparément) puis accepté sans erreur pour l'email
personnel de l'utilisateur — email de réinitialisation réellement envoyé, à
confirmer par l'utilisateur. `tsc`/`eslint`/`vitest` (37/37)/`next build`
tous propres.

**GAPS_OUVERTS.md** : le bullet T6a retiré (résolu) ; 1 seul écart de
l'audit reste ouvert (T8, spec déploiement jamais écrite) ; nouvelle entrée
ajoutée pour la trouvaille `.test`/emails de seed.

**Pas encore committé.**

---

## T8 — spec Déploiement + planificateur + nettoyage (28/07/2026, suite, dernier écart de l'audit)

3 décisions tranchées avec l'utilisateur (AskUserQuestion) avant tout code :
GitHub Actions (pas cron-job.org) ; fréquence fixe toute l'année pour
`/api/sync/results` (pas de plage bornée aux horaires de matchs) ;
nettoyage des données de test dans le même lot que la config du
planificateur.

`SPEC_TECHNIQUE_DEPLOIEMENT_V0.1.md` rédigée et validée. En vérifiant
l'état réel de Vercel avant de l'écrire (`vercel env ls`) : `HIGHLIGHTLY_API_
KEY` confirmée MANQUANTE — signalé à l'utilisateur avec la commande exacte
à taper lui-même, jamais la valeur en chat.

4 workflows GitHub Actions écrits (`.github/workflows/`) : sync-teams
(déclenchement manuel seul), sync-schedule (1x/jour), sync-results (1x/30
min), heartbeat (1x/jour) — chacun appelle sa route via `curl --fail` avec
le secret GitHub `SYNC_SECRET` (à ajouter par l'utilisateur, pas encore
fait). Limite connue documentée : GitHub désactive un workflow planifié
après 60 jours sans commit sur le dépôt, ce qui peut arriver en creux de
saison NBA — pas de parade automatisée, juste tracée.

`scripts/cleanup-test-data.mjs` écrit (dry-run par défaut, `--confirm`
requis pour exécuter) : cible « Playoffs NBA (test) » + « Test UI Matchs »
(cette 2e compétition trouvée en écrivant le script, ajoutée au périmètre)
et les 7 comptes `seed-*@nba-pronos.test` — exclut explicitement
`demo-amis@nba-pronos.test` (encore utilisé par les amis de l'utilisateur)
et le compte réel. Bug trouvé EN TESTANT (pas en relisant) : mauvaise
destructuration du retour de `ok()`, corrigé immédiatement (contradiction
visible entre 2 lignes de log consécutives du premier dry-run). Dry-run
final cohérent avec les décomptes déjà connus par ailleurs. **Pas exécuté
en vrai** — laissé à la décision de l'utilisateur.

`tsc`/`eslint` propres. Aucune migration. **Pas encore committé.**

**Les 7 écarts de l'audit du 28/07/2026 sont désormais tous traités.**
Restent 3 actions externes à la charge de l'utilisateur (voir
`GAPS_OUVERTS.md`, entrée T8) : pousser `HIGHLIGHTLY_API_KEY` sur Vercel,
ajouter `SYNC_SECRET` comme secret GitHub, exécuter le nettoyage pour de
vrai.

---

## Commit/push du lot audit + les 3 actions externes T8 (28/07/2026, fin de l'arc)

Commit unique `9caee5f` (20 fichiers) pour tout le lot de la session
(audit, 7 correctifs, reset-password, spec+code T8), poussé sur `main`.
Déploiement Vercel automatique vérifié sans régression.

Les 3 actions externes de T8 faites par l'utilisateur, guidées pas à pas :
1. `HIGHLIGHTLY_API_KEY` sur Vercel (3 environnements) — la valeur est
   apparue en clair dans le terminal lors de l'ajout "development"
   (production/preview l'avaient masquée en "Sensitive"), donc visible
   dans cette session. Signalé (3e incident du genre sur ce projet) ;
   l'utilisateur a choisi de NE PAS régénérer la clé cette fois.
2. `SYNC_SECRET` comme secret GitHub Actions. 2 échecs diagnostiqués en
   conditions réelles (pas en devinant) : rejouer l'appel exact du workflow
   depuis un terminal local avec la vraie valeur a réussi, écartant
   Vercel/la clé Highlightly ; puis `curl: (43)` a pointé vers un header
   HTTP contenant un retour à la ligne. Cause réelle (confirmée par
   l'utilisateur après coup) : tout le contenu de `.env.local` avait été
   collé au lieu de la seule valeur de `SYNC_SECRET`. Corrigé, reconfirmé
   vert — un seul secret partagé par les 4 workflows, corrigé pour les 4
   d'un coup.
3. `scripts/cleanup-test-data.mjs --confirm` exécuté pour de vrai par
   l'utilisateur. Vérifié en base après coup (script jetable, lecture
   seule) plutôt que de se fier à la description : « Playoffs NBA (test) »
   et « Test UI Matchs » absentes, `Demo_Amis`/`Rillettes-31` intacts, les
   7 comptes de seed absents — conforme au dry-run.

**Trouvaille en vérifiant le résultat** : 3 compétitions ARCHIVÉES jamais
documentées avant (« TEST NBA CUP », « TEST playoff 28/07/2026 », « TEST T4
sync — Playoffs 2026 (réel) »), hors du périmètre connu du script,
laissant des matchs/séries/picks en base (sans impact, jamais ACTIVE).
Signalé explicitement plutôt que nettoyé en silence. **Décision de
l'utilisateur : gardées comme historique de test.**

**T8 est désormais réellement opérationnel**, pas seulement codé — les 4
workflows peuvent authentifier leurs appels, les 5 secrets sont alignés
partout, la base ne porte plus que des données réelles + les 3 archives
conservées à dessein.

**L'arc complet de la session — audit structurel T1-T8/D1-D6, ses 7
écarts, et leur mise en production réelle — est clos.**

---

## Révélation publique des paris + contestation d'un pari refusé/résolu (28/07/2026, suite)

Demande de l'utilisateur : traiter 2 points du backlog "confort/reporté"
plutôt que de les laisser pour plus tard — révélation publique des paris
(0.2.4 §9) et contestation d'un pari REJETÉ/déjà résolu (0.2.7 §6).

**Révélation publique** : option confirmée AVANT de coder — un déclencheur
"Voir les paris des autres joueurs" ouvrant une popup à 2 colonnes
(Joueur/Pari), pas une extension du RevealPanel des pronos. Raffinement
décidé par Claude en cours de route, signalé explicitement : implémenté
UNIQUEMENT sur Mes pronos (pas Matchs comme évoqué au départ) — un pari
MATCH ne peut structurellement jamais être public sur l'écran Matchs
(matchs à venir uniquement, deadline = coup d'envoi jamais atteint). Testé
en session réelle de 2 comptes jetables (signInWithPassword, pas
service_role) : RLS `bet_is_public()` confirmée pour les paris MATCH et
SÉRIE.

**Contestation d'un pari refusé/résolu** : trouvaille en relisant le
cadrage AVANT de coder — 0.2.7 §6 n'exclut aucun statut, l'exclusion de
REJECTED/WON/LOST (migration #11) était un raccourci technique, pas une
décision produit. Migration #13 poussée : trigger `enforce_bet_transitions`
étendu (réouverture encadrée, admin ≠ auteur, correction liée obligatoire) ;
`request_bet_correction` élargie aux 3 statuts. L'admin tranche directement
dans `/admin/requests` (décision explicite de l'utilisateur), pas de détour
par `/admin/resolution`. Testé en conditions réelles avec 2 vrais comptes
(joueur + admin) : contestation, garde admin≠auteur, résolution directe, et
un test e2e séparé confirmant que `recomputeBet` pose bien les bons points
après coup — 2 bugs de SCRIPT DE TEST trouvés et corrigés en cours de route
(aucun bug du code produit lui-même).

`tsc`/`eslint`/`vitest` (37/37)/`next build` tous propres. Migration #13
déjà poussée sur la vraie base. Code applicatif **pas encore committé**.

---

## Commit/push du lot otherBets + contestation (28/07/2026, fin)

Commit `dc1e991` (12 fichiers), poussé sur `main`. Déploiement Vercel
automatique vérifié sans régression (`/login`, `/leaderboard`,
`/admin/requests` répondent comme attendu). Rien en attente de commit à ce
stade sur ce projet.

---

## T6c — Realtime sur `series` (29/07/2026)

Dernier écart connu de T6c (§14.2) : `series` restait non publiée, faute
d'écran qui en avait besoin (migration #8, 24/07/2026, avait délibérément
laissé `series` de côté). L'écran Bracket (vue globale) en a désormais le
besoin : résultat officiel d'une série reflété sans reload.

Point structurant flagué et tranché AVEC l'utilisateur avant de coder
(AskUserQuestion) : résoudre un UPDATE Realtime brut en abréviation
d'équipe demande l'id de chaque équipe, que `BracketNode`/`BracketData`
(contrat figé, spec écran §15.2) ne portent jamais. Choix retenu (plutôt
que d'étendre le contrat figé) : fonction séparée `getSeriesLiveSeed()`
(lib/queries/bracket.ts), qui refait une petite requête dédiée — cohérent
avec T6c §2.3, qui anticipait déjà un type `SeriesLive` séparé.

Migration #14 (`20260729090000_realtime_series.sql`) : `alter publication
supabase_realtime add table series;`, RLS déjà `using(true)`, aucune
policy touchée. `components/bracket/LiveSeriesSubscriber.tsx` (nouveau,
seul fichier client de ce lot) : même patron que `LiveSubscriber.tsx`
(my-predictions). `NodeCard.tsx` consomme le contexte SANS directive
`"use client"` propre (toujours rendu sous un ancêtre client, même
mécanisme que MarginStepper/TeamLogo). `BracketSummary.tsx`/`page.tsx`
câblent le seed.

`tsc`/`eslint`/`next build` tous propres. Migration poussée sur la vraie
base (`db push`, dry-run puis réel). Testé de bout en bout : aucune
compétition ACTIVE en base au moment du test (nettoyage T8) — flagué à
l'utilisateur, qui a choisi de réactiver TEMPORAIREMENT « TEST T4 sync —
Playoffs 2026 (réel) ». Script jetable : client anon souscrit, écriture
`official_winner_team_id` via service_role, payload reçu avec la bonne
valeur en < 1s (confirme la publication de bout en bout, indépendamment du
rendu visuel — pas de navigateur disponible dans cet environnement). État
restauré immédiatement après (winner à `null`, compétition à `ARCHIVED`),
vérifié après coup, script de vérification supprimé.

Code applicatif committé (`c453d84`) et poussé, déployé sans régression
(`/leaderboard`, `/bracket`, `/login` revérifiés 200).

---

## 4 points UI mineurs (29/07/2026, suite)

État des lieux général demandé par l'utilisateur (GAPS_OUVERTS.md +
BACKLOG_V1.md), puis choix de nettoyer 4 points UI ouverts depuis plusieurs
sessions, chacun confirmé avec AskUserQuestion avant de coder.

**Tailles de logo** : les tokens `--logo-size-sm/md/lg` (spec §10.2)
n'existaient jamais en CSS — créés dans `app/tokens.css`. 4 écrans qui ne
respectaient aucun palier (NodeCard=18, MatchRowStatic/BetForm=20,
Profil=28) alignés sur `sm`=24px. Écart doc↔code trouvé au passage :
`GAPS_OUVERTS.md` affirmait à tort que NodeCard était "tier lg" (48px).

**Aspect ratio des 30 logos** : testé visuellement (harnais Playwright,
`object-fit: contain` vs `cover`) — `cover` coupe le texte du wordmark sur
les logos larges (SAS/LAL/ORL/NOP/HOU). Laissé tel quel, décision explicite
de l'utilisateur après avoir vu la capture.

**Badge de correction Matchs** : `OtherPrediction.isAdminCorrected`
remplacé par `adminCorrection: AdminCorrection | null` (même type que Mes
pronos), extrait dans `lib/queries/adminCorrection.ts` (nouveau, partagé)
pour éviter un import circulaire matches.ts↔my-predictions.ts. Rendu
nominatif identique aux deux écrans désormais.

**Bandeau parquet** (§15.7) : portée confirmée (9 écrans joueur, pas admin),
thème clair déjà tranché par la spec (pas un vrai gap). Classes globales
`.hero-banner`/`.hero-banner-title`/`.hero-banner-subtitle`
(`app/globals.css`) + token `--color-hero-text`. 4 écrans sans aucun titre
de page (Matchs, Mes pronos, Nouveau pari, Bracket personnel) en ont reçu un
minimal, décidé avec l'utilisateur en cours de route. Mécanique vérifiée
visuellement (harnais Playwright, image placeholder).

`tsc`/`eslint`/`next build` tous propres. Committé (`ef5b305`) et poussé,
build Vercel confirmé `Ready` (`vercel ls`), routes publiques revérifiées
sans régression.

**Correctif immédiat** : l'utilisateur a remarqué que le bandeau restait
masqué dans les états vides (Classement/Bracket/Accueil/Mes paris quand
aucune compétition n'est active) — corrigé en ajoutant un bandeau
titre-seul à ces 4 états vides (Accueil garde `HomeHeader` inchangé pour le
cas normal, juste un bandeau générique en repli côté état vide). Bracket
n'avait jamais eu son propre `page.module.css` — créé pour l'occasion.
`tsc`/`eslint`/`next build` propres, committé et poussé dans la foulée.

**Asset réel déposé dans la foulée** : `public/brand/hero-parquet.jpg`
(format réel `.jpg`, fichier initialement nommé `images.jpg` — renommé,
`--hero-image`/README ajustés). Rendu vérifié visuellement avec le vrai
fichier (harnais Playwright) : image + voile dégradé + texte lisibles,
conforme à l'intention §15.7. `tsc`/`eslint`/`next build` propres. Plus
aucun point bloquant sur ce lot.

Point focal réajusté ensuite (`center 75%` au lieu de `center`) suite à un
retour de l'utilisateur : le cadrage montrait trop le ballon, pas assez le
parquet/la ligne — plusieurs valeurs comparées visuellement avant de
choisir.

Enfin, l'utilisateur a remonté un 10ᵉ écran oublié du périmètre initial :
le hub Jouer (`/play`, grille 2×2). Titre « Jouer » + bandeau ajoutés, même
patron que les 4 écrans qui n'avaient aucun titre — nouvelles classes
`.header`/`.title` créées dans `app/(app)/play/page.module.css`. `tsc`/
`eslint`/`next build` propres. Détail complet dans `ETAT_ACTUEL.md` §2.45.

---

## Rappels ciblés — canal Push (29/07/2026, fin de journée)

1er point du backlog codé (marqué PRIORITÉ par l'utilisateur). Aucune spec
n'existait — canal et architecture tranchés AVEC l'utilisateur avant de
coder : Push d'abord (aucun prérequis externe), Email plus tard (bloqué sur
un nom de domaine vérifié pour un SMTP personnalisé, gap "Confirm email").
Le modèle de préférence (`users.notification_preference`, migration #15)
couvre déjà les deux canaux pour ne pas le refaire.

Infra Web Push entièrement nouvelle : `push_subscriptions` +
`reminder_log` (dédoublonnage, RLS sans policy — verrouillée par défaut) ;
clés VAPID générées localement (`web-push.generateVAPIDKeys()`), écrites
directement dans `.env.local` (jamais affichées en clair) ; `public/sw.js`
(service worker) ; `components/profile/NotificationSettings.tsx` (premier
et seul composant client de l'écran Profil) ; `lib/actions/notifications.ts` ;
`lib/push/send.ts` (`server-only`).

2 déclencheurs : `lib/reminders/matchesReminder.ts` (fenêtre 4h avant coup
d'envoi, choix d'implémentation) et `lib/reminders/bracketReminder.ts`
(fenêtre 24h avant `bracket_deadline`), exposés via `/api/reminders/matches`
et `/api/reminders/bracket` (même garde Bearer `SYNC_SECRET` que
`/api/sync/*`, aucun nouveau secret), appelés par 2 nouveaux workflows
GitHub Actions.

Testé de bout en bout en conditions RÉELLES : compte de test jetable,
connexion via un VRAI navigateur Chromium (Playwright, contexte persistant
— Chrome désactive la Push API en incognito, trouvé en cours de route),
activation Push → vrai abonnement FCM créé et sauvegardé en base, envoi
réel testé séparément et accepté par FCM (201), désactivation testée
(abonnement supprimé, préférence repassée à NONE, confirmé par un reload
complet). Routes `/api/reminders/*` vérifiées contre la vraie base (garde
d'authentification + exécution sans erreur). Compte de test et scripts
jetables supprimés après coup.

`tsc`/`eslint`/`next build` propres. Paquets ajoutés : `web-push`,
`@types/web-push`. Migration #15 poussée sur la vraie base. Committé
(`b7061ae`) et poussé après que l'utilisateur a ajouté les clés VAPID sur
Vercel.

---

## Validation en conditions réelles des rappels ciblés + 3 correctifs (29/07/2026, fin de journée)

L'utilisateur a testé le push sur son VRAI compte (`Rillettes-31`), PC et
iPhone — pas un compte jetable. 3 bugs réels trouvés et corrigés,
chacun revérifié avant de passer au suivant :

1. **Notifications Chrome désactivées côté Windows** (Paramètres système,
   pas un bug du code) — une fois réactivées, réception confirmée sur PC.
2. **iOS ne permet le push que depuis une app à l'écran d'accueil**
   (restriction Apple). Ajouté `app/manifest.ts` + `app/apple-icon.png` +
   `public/icons/*` (icône placeholder "NP", générée via `sharp`).
   Committé (`d712012`).
3. **Multi-appareils sur un même compte** : `notification_preference` est
   un champ du COMPTE — un 2e appareil (iPhone) voyait le radio "Push" déjà
   coché (compte déjà en Push depuis le PC) et cliquer dessus ne
   déclenchait rien (un radio déjà sélectionné ne fait jamais de
   `onChange`). Corrigé : détection de l'état RÉEL de l'appareil courant +
   bouton dédié "Activer sur cet appareil" quand le compte est en Push mais
   pas cet appareil. Ajouté au passage les `catch` manquants (aucune
   gestion d'erreur avant) + un nouvel essai automatique sur `subscribe()`.
   Committé (`4124e27`).
4. **Apple rejette le sujet VAPID factice** (`403 BadJwtToken`) — le vrai
   abonnement iPhone créé (sous le compte `Demo_Amis`, confusion de compte
   de l'utilisateur, pas un bug) a été refusé par `web.push.apple.com` :
   `mailto:contact@nba-pronos.invalid` (domaine factice, même famille que
   `.test` déjà rejeté par Supabase Auth ailleurs) n'est pas accepté par
   Apple, contrairement à Google/FCM qui ne validait pas ce point. Trouvé
   via une recherche web ciblée. Corrigé : sujet remplacé par l'URL réelle
   du site. Revérifié : notification reçue sur l'iPhone, confirmé par
   l'utilisateur. Committé (`18ffe7c`).

`tsc`/`eslint`/`next build` propres après chaque correctif, chaque
déploiement Vercel revérifié sans régression. Résidu mineur non bloquant :
3 abonnements Apple dupliqués sur `Demo_Amis` (Safari en recrée un à
chaque tentative, sans conséquence fonctionnelle) — voir `GAPS_OUVERTS.md`.

---

## Système de ligue (30/07/2026)

2ᵉ point du backlog codé (après les rappels ciblés). Aucune spec n'existait
— 3 choix structurants cadrés AVEC l'utilisateur avant de coder (même
patron que le Bracket personnel, 27/07/2026) : ligue PERMANENTE
(indépendante des compétitions, contrairement aux brackets/pronos) ;
appartenance à PLUSIEURS ligues simultanément ; création ouverte à
n'importe quel joueur ACTIVE, depuis Profil (un futur onglet "Autre" est
évoqué mais hors périmètre). Adhésion par CODE généré aléatoirement à la
création (pas un mot de passe choisi) ; rang dans la vue filtrée
RECALCULÉ dans le groupe, pas le rang général conservé. Bien distinct du
code compétition (qui a le droit de JOUER), écarté d'y toucher — voir
`nba_pronos_PREP_SPEC_TECHNIQUE_V1.md` §C4.

Migration #16 (`leagues` / `league_secrets` / `league_memberships`) : le
code de ligue est sorti de `leagues` dès la conception (même correctif que
`competition_secrets`, T3 §3, mais posé du premier coup ici). RLS : visible
des seuls membres. Écriture via 2 fonctions SECURITY DEFINER
(`create_league`/`join_league`, même patron que
`request_prediction_correction`) — seule façon d'écrire le code sans jamais
l'exposer par un INSERT ouvert. Quitter une ligue reste un DELETE direct
(RLS suffit).

**Bug réel trouvé en testant en conditions réelles, PAS en relisant le
code** (script jetable, 2 comptes créés/supprimés à la volée, jamais le
compte réel de l'utilisateur) : récursion infinie sur la policy
`league_memberships_select` — sa propre sous-requête sur `league_memberships`
se re-déclenchait à l'infini, cassant du même coup toute lecture de
`leagues`/`league_secrets` (elles l'interrogent via `EXISTS`). Corrigé par
migration #17 : fonction `my_league_ids()` (SECURITY DEFINER, même patron
que `is_admin()`/`is_active()`) qui contourne la RLS pour SA PROPRE lecture
interne, cassant la boucle. Rejoué après coup : 10/10 assertions passent
(création, confidentialité du code pour un non-membre, adhésion,
idempotence, code invalide, départ).

`lib/queries/leagues.ts` (`getMyLeagues`) + `lib/queries/leaderboard.ts`
étendu (`getLeaderboard(sortKey, leagueId?)`, filtre + rang recalculé,
retombe silencieusement sur Général si l'id est invalide ou non-membre).
`lib/actions/leagues.ts` (créer/rejoindre/quitter, formulaires natifs sans
JS, même patron que `lib/actions/profile.ts`). UI : section "Mes ligues"
dans Profil ; sélecteur de portée sur Classement
(`components/leaderboard/LeagueScopeChips.tsx`, même patron que
`SortChips`).

**Remontée utilisateur en testant** (pas un bug, un choix UX) : le
sélecteur de ligue héritait de l'état vide global existant (aucune
compétition active = rien affiché sur Classement) — invisible alors que
les ligues existaient déjà. Tranché AVEC l'utilisateur (AskUserQuestion) :
affiché quand même au-dessus de l'état vide (avec l'option "Général"),
`SortChips` seul reste absent (rien à trier sans classement).

`tsc`/`eslint`/`next build` propres à chaque étape. Committé et poussé en 3
temps : migration + requêtes/actions/UI (`95edf7e`), correctif recherche/
récursion déjà inclus dedans (poussé en base avant le commit de code),
correctif affichage sans compétition active (`d1fde4f`). Confirmé
fonctionnel par l'utilisateur en conditions réelles (création + adhésion
depuis un autre compte, sélecteur visible).

---

## Vue admin "Qui manque à l'appel" (30/07/2026)

3e point du backlog codé, même session (« Confort au quotidien »). 2 choix
cadrés AVEC l'utilisateur avant de coder : périmètre = matchs (même fenêtre
3 jours que l'écran Matchs) ET bracket, dans la même vue ; granularité = PAR
MATCH (un bloc par échéance, liste nominative), pas une liste agrégée par
joueur.

Nouvel écran `/admin/missing` (lien ajouté au tableau de bord admin),
lecture seule — aucune relance manuelle câblée, en complément des rappels
push automatiques déjà existants (§2.46/§2.47). `lib/queries/admin-
missing.ts` : l'admin bypasse déjà la RLS sur `match_predictions`/`brackets`
(policies `using (user_id = auth.uid() or is_admin())`, migration #3) —
aucune confidentialité à recalculer contrairement à l'écran joueur Matchs
(§8, `isRevealed`). "Manquant" = joueur ACTIVE sans ligne committed
(`status <> DRAFT`) sur ce match précis, ou sans bracket validé
(`is_validated` ou `is_auto_validated`) tant que la deadline n'est pas
passée.

**Vérifié en conditions réelles, avec une précaution particulière** : aucune
compétition n'étant active en ce moment, un test end-to-end classique était
impossible sans en créer une — or les crons GitHub Actions de rappels
(fenêtre 4h pour les matchs, 24h pour le bracket) tournent en continu et
ignorent le statut de la compétition pour les matchs (`runMatchesReminder`
interroge TOUS les matchs par date, toutes compétitions confondues).
Confirmé AVEC l'utilisateur avant de procéder : compétition ACTIVE
TEMPORAIRE créée (script jetable), mais matchs et deadline de bracket
planifiés à J+2 — largement hors des deux fenêtres de rappel, aucun risque
de notification réelle déclenchée pendant le test. Un seul compte ADMIN
JETABLE créé pour la lecture (jamais le vrai compte `Rillettes-31`, jamais
de mot de passe touché sur un compte réel). 6/6 assertions passent :
reconnaissance ADMIN, lecture RLS-bypass des pronos/brackets, un joueur avec
prono validé absent de la liste manquante de CE match mais présent sur
l'autre, un joueur sans aucun prono présent sur les deux. Nettoyage complet
en fin de script (compétition/série/matchs/prono/compte de test) ; état de
la base revérifié identique à l'avant-test (3 compétitions archivées
inchangées, seuls `Rillettes-31`/`Demo_Amis` restants, aucune compétition
active).

`tsc`/`eslint`/`next build` propres. Committé et poussé (`e934085`). Test au
clic dans un vrai navigateur reporté à la prochaine compétition réellement
active (l'état vide "Aucune compétition en cours." est, lui, déjà le
rendu actuel réel du site).

---

## Petit correctif — lien de sortie du panneau admin (30/07/2026)

Remonté par l'utilisateur en testant : aucun moyen de sortir du panneau
admin vers `/home`/`/profile` depuis sa création (§2.20) — le layout admin
n'avait qu'un en-tête "Administration", jamais de nav de sortie. Ajouté un
lien "← Retour à l'app" dans `app/(admin)/admin/layout.tsx`, partagé par
toutes les pages admin (un seul fichier à changer). `tsc`/`eslint`/`next
build` propres. Committé et poussé (`0e7c233`).

---

## Superlatifs de fin de compétition + écran Historique (30/07/2026)

4e point du backlog codé, même session (« Fun / esprit ligue entre
potes »). Plus gros que prévu au départ : "plus grosse remontée au
classement" s'est révélé INCALCULABLE sans historique de classement dans
le temps (l'app ne gardait que l'état figé final, `competition_archives`).
Décidé AVEC l'utilisateur (2 questions posées avant de coder) : construire
d'abord ce socle plutôt que d'abandonner ce titre ; afficher les titres
dans une section "Historique" de Profil pour l'instant (confirmé
explicitement réorganisable plus tard en sous-onglets, sans verrou
structurel — les couches requêtes/actions restent indépendantes de
l'emplacement d'affichage, même remarque que pour les ligues).

**Migration #18** (`leaderboard_snapshots` + `competition_superlatives`,
2 tables neuves) : snapshots RLS `using (true)` (même classe d'info que
`user_scores`/`competition_archives`, aucune ligne individuelle privée),
écrits UNIQUEMENT par le cron (aucune policy insert joueur). Superlatifs :
même patron que `competition_archives` (`insert with check (is_admin())`,
écrit par `closeCompetition()` en session admin normale, jamais
service_role). Fréquence du snapshot confirmée AVEC l'utilisateur : 1x/jour
(`lib/snapshots/leaderboardSnapshot.ts`, `/api/snapshots/leaderboard`,
`.github/workflows/snapshot-leaderboard.yml` — 12h UTC, même patron Bearer
`SYNC_SECRET` que les rappels/sync, AUCUN nouveau secret GitHub requis).

**Correctif trouvé en construisant, pas un bug de ce lot** :
`competitions.archived_at` posée dès le schéma initial (T1) mais jamais
écrite nulle part — l'écran Historique en a besoin pour trier/dater les
compétitions closes. Corrigé dans `closeCompetition()` au passage.

`lib/scoring/superlatives.ts` (`computeSuperlatives`) : 5 titres — NOSTRADAMUS
(bons vainqueurs), SNIPER (écarts exacts), BRACKET_KING (points bracket),
BEST_ROUND1 (points gagnés sur les matchs du 1er tour uniquement, requête
dédiée — pas une colonne de `user_scores`, qui agrège tous les tours),
BIGGEST_CLIMB (delta entre le rang du 1er snapshot disponible et le rang
final déjà calculé par `closeCompetition`). TOUS les ex-aequo crédités
(aucun tie-break arbitraire) ; un titre à valeur nulle n'est JAMAIS décerné
(ex. personne n'a de points bracket -> pas de "Meilleur bracket" cette
saison-là) ; `BIGGEST_CLIMB` ignoré si aucun snapshot n'existe encore
(compétition close le jour même de sa création). Appelé UNE SEULE FOIS dans
`closeCompetition`, jamais recalculé après coup.

**Vérifié en conditions réelles** : même précaution que le lot précédent
(compétition ACTIVE temporaire, compte admin jetable, jamais le vrai
compte). Scores construits à la main pour couvrir délibérément les 3 cas
limites : ex-aequo réel (Sniper, 1 écart exact chacun), absence de titre
(Bracket, 0 partout), et une VRAIE inversion de classement entre un
snapshot "d'hier" et le rang final (Demo_Amis 1er hier, Rillettes-31 1er
aujourd'hui → climb de Rillettes-31 confirmé, climb négatif de Demo_Amis
bien exclu). RLS confirmée : un admin peut insérer des superlatifs, un
appelant non-admin est bloqué, la lecture reste publique. Upsert du
snapshot rejoué deux fois le même jour : pas de doublon (contrainte unique
`competition_id, user_id, snapshot_date`). 12/12 assertions passent,
nettoyage complet, base revérifiée identique après coup.

`tsc`/`eslint`/`next build` propres. Committé et poussé (`7bdffc7`). Comme
pour la vue admin "Qui manque à l'appel", le rendu réel de la section
Historique (avec de vrais titres, pas juste la liste vide des 3
compétitions test déjà archivées) reste à observer à la prochaine vraie
clôture de compétition.

---

## Test au clic en conditions réelles — missing + superlatifs/Historique (30/07/2026, fin de session)

Demandé par l'utilisateur avant de passer à la suite : construire une VRAIE
compétition de test (pas un script jetable nettoyé après coup) pour cliquer
lui-même sur `/admin/missing` puis sur la clôture. Répartition des rôles
actée avec l'utilisateur : lui crée la compétition (`/admin/competitions/new`)
et saisit les résultats (`/admin/competitions/results`, vrai moteur de
scoring) ; moi je prépare les matchs/comptes de test entre les deux.

8 matchs créés (1 par série ROUND_1, service_role — aucune UI n'existe pour
ça), échéances étalées sur J+0 à J+3 (le 1er dans <4h, risque de rappel push
réel accepté explicitement par l'utilisateur) ; 4 comptes de test jetables
(TestJoueur1-4) avec des pronostics volontairement variés (certains matchs
complets, d'autres partiels, 4 laissés totalement vides pour peupler
`/admin/missing`). L'utilisateur a saisi 4 résultats réels via l'écran
Résultats — `recomputeMatch` a tourné pour de vrai (TestJoueur1 : 43 pts,
3 bons vainqueurs, 2 écarts exacts ; TestJoueur3 : 26 pts, 2 bons vainqueurs).

**Trouvaille en cours de route, pas un bug** : l'utilisateur a lui-même
déposé un vrai pronostic sur son compte réel (`Rillettes-31`) sur le match
qui approchait — `/admin/missing` l'a correctement exclu de la liste des
manquants pour CE match précis en temps réel, confirmant le calcul par
match plutôt qu'un état mis en cache.

`/admin/missing` vérifié au clic : les 4 blocs à pronostics partiels/vides
correspondent exactement aux prédictions déposées (BKN-CHA : 4 manquants ;
CHI-CLE : 3 manquants ; DET-IND : 2 manquants ; les 4 matchs vides : tout le
monde manquant). Clôture réelle ensuite (bouton admin, irréversible) : les
3 superlatifs attendus générés (Nostradamus/Sniper/Meilleur 1er tour, tous
à TestJoueur1) ; les 2 cas limites anticipés confirmés en conditions
RÉELLES cette fois (Meilleur bracket absent — aucun bracket rempli ; Plus
grosse remontée absente — compétition créée et close le même jour, avant
le premier passage du cron quotidien de snapshot).

Décision de l'utilisateur : compétition "Test 30 juillet 2026" gardée
archivée (même choix que les 3 autres compétitions TEST), 4 comptes
TestJoueur1-4 gardés également (au cas où un test similaire soit rejoué).
Aucun nettoyage nécessaire — rien de committé côté code, uniquement des
données en base.

---

## Discussion navigation + 2 bugs réels trouvés en creusant (30/07/2026, suite)

Discussion ouverte par l'utilisateur (explicitement PAS une consigne) sur
une possible réorganisation de la nav : séparer un hub Jouer "pur jeu" d'un
onglet Classement transformé en visibilité générale (paris/pronos/bracket
de tout le monde). Recommandation donnée : version légère plutôt que la
fusion — nav INCHANGÉE (toujours 4 onglets), juste une page "profil joueur"
dédiée (`/players/[userId]`, choisie par l'utilisateur parmi 3 options
proposées — popup / page dédiée / accordéon en place) reliée depuis chaque
pseudo déjà affiché en lecture seule. Confirmé au passage : "Mes pronos"
gère DÉJÀ l'état MISSING (match verrouillé jamais pronostiqué) sans rien
coder — juste à mieux le mettre en avant. Direction actée, spec pas encore
écrite (l'utilisateur a bifurqué sur un point bloquant avant, ci-dessous).

**Bug réel #1 — `bracket_deadline` jamais posée.** L'utilisateur voulait
tester la comparaison de brackets entre joueurs ("aujourd'hui on n'a rien
pour comparer") — le mécanisme existe pourtant déjà dans
`lib/queries/bracket.ts` (drill-down nominatif par série, groupé par pick).
Trouvé en creusant : `competitions.bracket_deadline` est posée à `NULL` à
la création (`createCompetition`) et n'est JAMAIS mise à jour nulle part
dans le code réel (ni `createMatch`, ni la synchro T4, jamais exercée en
réel) — alors que TOUT en dépend : le drill-down du Bracket
(`isDeadlinePassed` toujours faux), le rappel push bracket, le bloc bracket
de `/admin/missing`, l'item Accueil. La spec elle-même dit "inconnu tant
qu'aucun match n'est saisi", sous-entendant un calcul automatique jamais
câblé.

Définition retenue AVEC l'utilisateur (plus simple que ma proposition
initiale "1er tour uniquement", et strictement équivalente en pratique —
un tour ultérieur ne peut pas être créé avant que le tour précédent y ait
avancé les 2 équipes, garde déjà existante dans `createMatch`) : le début
du premier match de la compétition, tous tours confondus. Recalculé en
ENTIER à chaque création de match (`recomputeBracketDeadline`,
`lib/actions/admin-results.ts`), jamais "si plus tôt que l'actuel" — un
admin peut saisir les matchs dans le désordre chronologique. Vérifié en
isolation (script jetable, ordre de saisie inversé) : le minimum reste
toujours exact. Committé et poussé (`e9a4829`).

**Bug réel #2 — décalage horaire à la création d'un match, trouvé en
voulant backfiller la compétition réelle "Test" de l'utilisateur.**
`<input type="datetime-local">` (écran Résultats, "Ajouter un match")
renvoie une heure SANS fuseau — l'admin la saisit en heure de Paris, mais
`new Date(str).toISOString()` l'interprétait selon le fuseau du SERVEUR
(Vercel, UTC), pas celui de l'admin : chaque match saisi se retrouvait
décalé de 1h (hiver) ou 2h (été) par rapport à l'heure réellement voulue.
Même défaut à l'affichage (`toLocaleString` sans `timeZone` explicite).
Repéré concrètement : l'utilisateur avait saisi 13h13 (heure de Paris,
été) pensant le match déjà passé, mais `bracket_deadline` backfillée à la
main affichait encore ce match dans le FUTUR — l'utilisateur a lui-même
fait le lien avec le fuseau horaire.

Corrigé sans librairie externe (même convention que
`lib/queries/matches.ts`) : `parisLocalToUtcIso()` déduit le décalage
Paris/UTC RÉEL à la date saisie via `Intl.DateTimeFormat`, jamais +1/+2
codé en dur (reste correct été comme hiver, y compris à la transition
DST). Affichage corrigé symétriquement (`timeZone: "Europe/Paris"`
explicite). Vérifié en isolation : été (+2h), hiver (+1h), minuit
(changement de jour) — les 3 cas passent. Committé et poussé (`8bf74d8`).

**Correction rétroactive des données réelles** : la compétition "Test" de
l'utilisateur (bien réelle, pas un script jetable) avait 2 matchs déjà
saisis avec l'ancien bug — décalés de -2h chacun (script ponctuel,
service_role), puis `bracket_deadline` recalculée avec les bonnes heures :
passe désormais dans le passé, le bracket est verrouillé pour de vrai.

`tsc`/`eslint`/`next build` propres après chaque correctif.

---

## Page "profil joueur" + pseudo cliquable partout (30/07/2026, fin de session)

Suite de la discussion nav : direction actée précédemment (page dédiée
`/players/[userId]`, nav à 4 onglets inchangée). Construite en 2 temps.

**La page elle-même** (`app/players/[userId]/page.tsx`, `lib/queries/
player-profile.ts`) : même patron que `/leaderboard`/`/bracket` (route
physique hors des groupes, visiteur ou joueur connecté). Agrège 4 blocs déjà
visibles ailleurs par la RLS existante — classement (rang + points),
bracket complet (après `bracket_deadline_passed`), pronostics de matchs
verrouillés (« valider = voir »), paris publics (`bet_is_public` : statut
VALIDATED/WON/LOST ET deadline passée). Filtré dans la requête, pas
seulement par la RLS, pour que la page reste identique quel que soit le
visiteur — même le propriétaire du profil cliquant sur son propre pseudo ne
doit pas voir plus que n'importe qui d'autre (ses propres brouillons par
exemple). Périmètre V1 : compétition ACTIVE uniquement, pas d'historique
multi-compétitions (noté dans GAPS_OUVERTS.md).

**Câblage sur TOUTES les pages du site** (demandé explicitement par
l'utilisateur, pas juste 2-3 écrans) : composant partagé `components/ui/
PlayerLink.tsx`, posé sur chaque pseudo déjà affiché en lecture seule.
Obstacle trouvé et traité au cas par cas :
- **Classement** (`LeaderboardRow.tsx`) : toute la ligne était un seul
  `<button>` (déplier/replier) — un `<Link>` imbriqué dans un `<button>`
  est invalide en HTML. Restructuré en `<div role="button" tabIndex={0}>`
  + gestion clavier manuelle (Entrée/Espace), pseudo en `<Link>` séparé
  avec `stopPropagation` pour ne pas déclencher le dépli au clic.
- **Bracket** (`SeriesPickGroup.players`) : type marqué "contrat figé"
  (§15.2) ne portait que des pseudos (`string[]`), aucun id joueur. Étendu
  de façon ADDITIVE (nouveau type `SeriesPickPlayer = {userId, pseudo}`,
  rien retiré) plutôt que de casser le contrat.
- **Mes pronos**, **écrans admin** (Gestion des joueurs, Résolution,
  Validation) : l'id joueur était déjà disponible dans les types existants
  — lien direct, aucune extension nécessaire.
- **Matchs** (`OtherPrediction`), **Historique des logs** (acteur
  seulement, pas la cible composite « type · pseudo », jugé pas assez de
  valeur pour la restructuration que ça demanderait), **Requêtes**,
  **Historique/superlatifs** (Profil) : id ajouté de façon additive à des
  types qui n'en portaient pas.
- Volontairement PAS câblé : `StickyMeBar` (bandeau "toi", lien vers son
  propre profil sans intérêt) ; les listes d'absents (Matchs/Admin missing
  restent, elles, câblées — seule la liste "absentees" de Matchs, simple
  string[], laissée telle quelle, valeur jugée faible).

Vérifié en conditions réelles PAR L'UTILISATEUR : clic sur un pseudo depuis
plusieurs écrans, page `/players/[userId]` de `Rillettes-31` (bracket
15/15 réellement rempli sur la compétition "Test", pronostic scoré)
confirmée fonctionnelle. `tsc`/`eslint`/`next build` propres sur
l'ensemble du projet (23 fichiers touchés). Committé et poussé (`57cd191`).

---

## Réorganisation de Profil en sous-onglets (30/07/2026, fin de session)

Demandé par l'utilisateur juste après : l'écran Profil avait grossi toute
cette session (Thème, Préférences, Rappels, Mes ligues, Historique,
Administration, Déconnexion) — plus assez lisible en une seule page.
Découpage cadré en une question : 3 sous-onglets (Compte/Ligues/
Historique) proposés, l'utilisateur a demandé un 4e en plus, **Admin**,
visible seulement pour un admin.

`components/profile/ProfileTabs.tsx` : même patron que `SortChips`/
`LeagueScopeChips` (Classement) — paramètre d'URL `?tab=`, `<Link>` côté
serveur, aucun état client, aucune nouvelle dépendance. Repli silencieux
sur "Compte" si `?tab=admin` est demandé par un non-admin (lien copié,
statut changé entre-temps) — jamais une page d'erreur, même patron que le
repli sur le classement Général pour un id de ligue invalide (§2.48).
**Déconnexion reste volontairement EN DEHORS des onglets**, toujours
rendue quel que soit l'onglet actif — jamais à chercher.

Chaque requête de données (`getTeamOptions`/`getMyLeagues`/
`getCompetitionHistory`) n'est désormais lancée QUE si son onglet est
actif — gain marginal mais gratuit, cohérent avec le reste du projet
(aucune requête inutile).

Redirections des 3 actions de ligues (`lib/actions/leagues.ts`) mises à
jour pour inclure `?tab=ligues` — sans ça, après créer/rejoindre/quitter,
l'utilisateur aurait atterri sur l'onglet "Compte" par défaut sans voir la
confirmation/erreur qui vient d'être posée sur l'onglet Ligues.

Vérifié en conditions réelles PAR L'UTILISATEUR : les 4 onglets confirmés
fonctionnels. `tsc`/`eslint`/`next build` propres. Committé et poussé
(`74de402`).

---

## Couleurs d'équipe sur Profil — essayée puis abandonnée (30/07/2026, fin de session)

Backlog « Personnalisation du profil ». Construite en 2 passes : d'abord
des accents doux uniquement (`--color-accent-soft`/`--color-accent-line`
recalculés depuis la couleur de l'équipe favorite, migration #19
`users.use_team_colors`, couleurs des 30 équipes en constante de code
`lib/labels/teamColors.ts`) — jugée par l'utilisateur trop discrète.
Renforcée ensuite (fonds `surface-base/raised/inset` teintés + voile du
bandeau d'en-tête paramétré via une nouvelle variable
`--hero-overlay-rgb` dans le composant `hero-banner` partagé, défaut
inchangé pour les autres écrans) — toujours sans toucher `--color-accent`
ni le texte, pour rester sans risque de contraste quelle que soit
l'équipe.

**Abandonnée par l'utilisateur le jour même** ("je ne pense pas que ça
ait d'importance") : revert complet du code (`git revert`, commits
`bea23e0`/`b694bbc`, historique jamais réécrit) + migration #20
(`DROP COLUMN use_team_colors`). Point d'attention retenu : la migration
#19, déjà appliquée en base réelle au moment du revert, avait été
supprimée du dépôt par erreur (le fichier avait été ajouté par le commit
annulé) — restaurée avant de pousser, une migration déjà appliquée ne
doit JAMAIS disparaître du dépôt (Supabase CLI perd sinon la
correspondance avec l'historique distant, erreur
`LegacyDbPushMissingLocalError` rencontrée puis corrigée). État final :
aucune trace de la feature dans le code, colonne retirée en base,
`tsc`/`eslint`/`next build` propres. Committé et poussé (`33c9574`).

---

## Sélecteur d'équipe favorite en menu déroulant (30/07/2026, fin de session)

Backlog « Personnalisation du profil », 2e point. Demandé par
l'utilisateur : la liste fixe des 30 boutons radio (`TeamPicker.tsx`)
prenait trop de place sur la page. Transformée en menu déroulant fermé
par défaut — déclencheur affichant logo + nom de l'équipe choisie, liste
flottante (`position: absolute`, ne repousse pas le reste du formulaire)
ouverte au clic. Toujours pas de `<select>` natif (ne peut pas afficher
de logo, §2.15 ETAT_ACTUEL.md) : la liste ouverte reste de vrais
`<input type="radio">`. `"use client"` posé directement sur le composant
(même patron que `TeamLogo.tsx`, §2.9) puisque son parent reste serveur.

**Bug réel trouvé en testant** : fermer le menu retirait la liste (donc
le radio coché) du DOM AVANT la soumission du formulaire — le champ
`favoriteTeamId` était alors absent du `FormData`, systématiquement
traité comme "Aucune" côté serveur (sélection perdue à chaque
enregistrement). Corrigé : la liste reste TOUJOURS montée dans le DOM,
seule sa visibilité (classe CSS `.hidden`, jamais un retrait React) suit
l'état ouvert/fermé — les radios restent donc dans le formulaire en
permanence, cochés ou non.

`tsc`/`eslint`/`next build` propres. Committé et poussé en 2 temps :
menu déroulant (`917d324`), correctif de perte de sélection (`6a1e7a8`).
Confirmé fonctionnel par l'utilisateur après le correctif.

---

## Reclassement du backlog + refonte lisibilité du Bracket (30/07/2026, fin de session)

L'utilisateur a reclassé ce qui reste du backlog : 3 chantiers retenus, dans
cet ordre — 1. refonte visuelle du Bracket (ce lot) ; 2. Tutoriel joueur ;
3. "Fun/esprit ligue" REDÉFINI en badges PERMANENTS (visibles en continu
pendant la compétition, pas seulement à la clôture comme les superlatifs
déjà faits — emplacement et liste pas encore tranchés). Le reste (export
.ics, courbe d'évolution, classement all-time, Hall of shame) reporté après
ces 3. Documenté dans `BACKLOG_V1.md`.

**Refonte du Bracket** — demande initiale : "Est et Ouest mélangés, pas
lisible". Trouvé en lisant le code : la distinction existait déjà dans les
DONNÉES (tri Est-puis-Ouest à l'intérieur de chaque tour, `lib/queries/
bracket.ts`, jamais touché) mais rien ne la montrait visuellement — les
deux conférences étaient listées à la suite, sans titre ni séparation.
2 questions posées avant de coder (profondeur de la Vue B, avec ou sans
traits de connexion) : l'utilisateur a choisi le "poster classique en
miroir" SANS traits de connexion (scope réduit explicitement, un chantier
à part si besoin plus tard) — et a corrigé le sens : **Ouest à GAUCHE, Est
à DROITE** (pas l'inverse proposé initialement).

`components/bracket/SeriesDrillDown.tsx` réécrit :
- Vue A (résumé) : chaque tour à conférence se scinde en 2 sous-groupes
  "Ouest" puis "Est" — Finale NBA et tours NBA Cup (jamais de conférence,
  D6/schéma) restent une liste simple, inchangés.
- Vue B (arbre plein écran) : colonnes réordonnées en miroir pour les
  PLAYOFFS uniquement (`hasConferences`, la Cup n'a pas de conférence,
  rien à miroiter) — Ouest (1er tour → demies → finale de conf.), Finale
  NBA au centre, Est (finale de conf. → demies → 1er tour) en ordre
  inversé côté droit. Aucun trait de connexion, juste un réordonnancement
  + des libellés de colonne explicites.

**2 ajustements demandés par l'utilisateur après avoir testé** (les 2
confirmés fonctionnels) :
- Colonnes de la Vue B centrées en hauteur (`justify-content: center` sur
  `.treeColumn`) — les colonnes courtes (finale de conférence, finale NBA,
  1 carte) restaient collées en haut au lieu d'être alignées sur le centre
  des colonnes plus longues (1er tour, 4 cartes).
- Carte entière mise en surbrillance quand une série est terminée
  (`NodeCard.tsx`/`.module.css`, nouvelles classes `.cardDecided`/
  `.cardChampion`) — auparavant seul le TEXTE du nom d'équipe vainqueur
  changeait de couleur, pas assez visible. Vert = série gagnée, or =
  champion (finale), jamais de rouge pour l'équipe battue (§17, déjà en
  place, non rouvert).

`tsc`/`eslint`/`next build` propres à chaque étape. Committé et poussé en
3 temps : réordonnancement Est/Ouest (`ac36ce8`), centrage vertical
(`3a43455`), surbrillance du vainqueur (`95381ce`). Les 3 confirmés
fonctionnels par l'utilisateur en conditions réelles (compétition "Test").

---

## Filtre par ligue sur Mes pronos + Bracket, replis "Plus d'options" (30/07/2026, fin de session)

Demandé par l'utilisateur : "Mes pronos" et le Bracket global montraient
toujours TOUS les joueurs, sans façon de se limiter à sa ligue (contrairement
à Classement, §2.48). Même patron partout : chips "Général"/une par ligue,
`?ligue=` dans l'URL.

**Extrait `resolveLeagueScope()`** dans `lib/queries/leagues.ts` — jusque-là
dupliqué en dur dans `lib/queries/leaderboard.ts`, refactoré pour l'utiliser,
même leçon que `lib/dates/paris.ts` (éviter une 3e implémentation
divergente). Réutilisé par les 3 écrans (Classement, Mes pronos, Bracket).

- **Mes pronos** (`lib/queries/my-predictions.ts`) : `others`/`absenteeCount`/
  `otherBets` (pronos ET paris des autres, par match ET par série via
  `getSeriesBetHeader`) filtrés sur les membres de la ligue. Portée
  préservée à travers segments/filtres date-série via `buildViewPath`
  (`components/my-predictions/urls.ts` étendu) — nécessite de threader
  `leagueId` dans `SegmentTabs`/`FilterBar` (dont un `<input type="hidden">`
  dans le formulaire natif GET, qui sinon remplace toute la query string).
- **Bracket** (`lib/queries/bracket.ts`) : `groups`/`players` filtrés, ET
  le %/dénominateur (`filledBySeriesId`) recalculé sur la ligue — confirmé
  AVEC l'utilisateur avant de coder (sinon un "80%" à côté de 2 noms
  paraîtrait faux). Portée préservée avec l'état vue A/B (`?arbre=`).

Dans les deux cas : mon propre prono/pari n'est JAMAIS filtré ; un id de
ligue invalide ou dont je ne suis pas membre retombe silencieusement sur
"Général" (RLS `league_memberships_select`, même garde que Classement).
`tsc`/`eslint`/`next build` propres. Committé et poussé (`fc06837`).

**Replis "Plus d'options" (Mes pronos)** : demandé juste après par
l'utilisateur — "Voir les paris des autres joueurs", "Demander une
correction" et "Voir les pronos des autres" prenaient chacun une ligne
visible en PERMANENCE sur CHAQUE match, même si leur propre contenu était
déjà replié (popup pour le premier, `<details>` pour les 2 autres).
Regroupés sous un `<details>` "Plus d'options" unique par ligne
(`MatchRowStatic.tsx`), fermé par défaut — forcé ouvert uniquement en
retour d'une requête de correction en erreur sur CE match précis (sinon le
message d'erreur resterait invisible). `tsc`/`eslint`/`next build` propres.
Committé et poussé (`ec698e9`). Les 2 lots confirmés fonctionnels par
l'utilisateur en conditions réelles.

---

## Tutoriel joueur (31/07/2026)

2e des 3 chantiers prioritaires retenus la veille (après la refonte du
Bracket), avant les badges permanents. L'utilisateur a ouvert la session en
demandant explicitement de « beaucoup réfléchir avant de coder » — contexte
inhabituel par rapport aux lots précédents sans spec (Bracket personnel,
Ligues), où le cadrage se faisait plus vite. Note de cadrage rédigée EN
SÉANCE (`SPEC_TUTORIEL_JOUEUR_V0_1.md`, `Cadrage/V1/Spec visuelle/`) avant
toute ligne de code, 3 tours d'`AskUserQuestion` :

1. Déclenchement (proposition unique à la 1re connexion + lien permanent
   Profil), format (wizard modal pas-à-pas), contenu (tour d'horizon complet
   des 7 axes du jeu, pas seulement le point « reset » demandé par le
   backlog).
2. Contenu affiné après relecture de la 1re proposition : l'étape 3
   (« Matchs ») devait aussi couvrir les paris MATCH ET SÉRIE, pas
   uniquement le pronostic vainqueur/écart.
3. Avant de coder : note de cadrage écrite d'abord (comme Bracket personnel/
   Ligues) plutôt que code direct — confirmé par l'utilisateur.

**Codé** : migration #21 (`users.tutorial_seen_at`, écriture directe via
`users_update_self`, aucune fonction dédiée nécessaire) ; `TutorialModal.tsx`
(wizard, état local, pas d'URL) ; `TutorialBanner.tsx` (Accueil, montée
uniquement si jamais vu, y compris sans compétition active) ;
`TutorialLink.tsx` (Profil > Compte). Écart signalé à l'utilisateur : la
bannière utilise une carte simple plutôt que le style `hero-banner` prévu
par la note de cadrage, pour éviter deux bandeaux photo empilés sous celui
d'Accueil — pas encore retranché.

**Test manuel par l'utilisateur** : tout fonctionnel. Demande faite APRÈS ce
test, hors cadrage initial : illustrer chaque étape d'une vraie capture
d'écran de l'interface. Nouveau tour d'`AskUserQuestion` pour cadrer ça
aussi (vraies captures vs illustrations ; risque de péremption accepté vu
que la DA n'est pas stabilisée ; étapes 1/2 conceptuelles laissées en texte
seul).

**Captures d'écran — chaîne complexe, plusieurs blocages successifs** :
- Claude ne peut muter aucun compte (classificateur de permissions bloque
  `auth.admin.updateUserById` même sur un compte de test jetable,
  automatiquement, sans même remonter à l'utilisateur). Contournement :
  l'utilisateur a lui-même lancé un script jetable posant un mot de passe
  connu (`TutoTest2026!`) sur `TestJoueur1` — ensuite, une simple soumission
  du vrai formulaire /login par Playwright n'est plus une action privilégiée.
- Playwright absent du projet : installé temporairement en dev dependency,
  désinstallé juste après (`package.json`/`package-lock.json` revérifiés
  identiques par `git status`).
- 1re série de captures : Matchs et Bracket vides/verrouillés (aucun match
  dans la fenêtre 3 jours, `bracket_deadline` passée). Diagnostic initial
  erroné (« aucune compétition active », d'après un souvenir de fin de
  session précédente) — en réalité une compétition ACTIVE existait bien
  (« Test », créée par l'utilisateur le matin même), la contrainte DB « une
  seule compétition ACTIVE à la fois » a fait échouer la tentative de créer
  une compétition jetable à côté. Décidé AVEC l'utilisateur : ajustement
  RÉVERSIBLE de sa vraie compétition « Test » (1 match SCHEDULED ajouté sur
  une série existante, `bracket_deadline` reculée à +72h), recapture, PUIS
  suppression du match ajouté et restauration EXACTE de la deadline
  d'origine — revérifié par une lecture séparée après coup, aucune trace
  résiduelle.
- Recadrage final : 5 PNG recadrés serré (`sharp`, ~480px de large) dans
  `public/tutorial/`, intégrés au wizard via `next/image`.

`tsc`/`eslint`/`next build` propres à chaque étape. Committé et poussé sur
`main` (`34e179a`) ; déploiement Vercel automatique (intégration GitHub)
suivi via `vercel inspect` jusqu'à `Ready`, `nba-pronos.vercel.app/login`
revérifiée `200` en production. Tous les scripts jetables supprimés en fin
de session (aucun résidu dans le dépôt).

Résidu signalé, pas bloquant : les captures se périmeront si la DA change
(non stabilisée) — l'utilisateur prévoit de les refaire lui-même plus tard,
mêmes noms de fichiers, aucun changement de code requis.

## Création de compétition NBA Cup + dry-run réel de la synchro (31/07/2026, suite)

Demande directe de l'utilisateur : « retravailler sur la création de
compétition et importation des matchs ». Clarifié par `AskUserQuestion`
avant de coder (le périmètre était ambigu — plusieurs pistes possibles
d'après l'état du projet) : construire la création NBA Cup ET vérifier en
conditions réelles que la synchro capture les matchs/scores automatiquement.

**Création NBA Cup** — réouverture assumée d'un point validé le 27/07/2026
(`SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1.md` §3 excluait explicitement la Cup).
Flaguée et confirmée AVANT de coder (AskUserQuestion) : topologie identique
aux Playoffs (bottom-up, 4 quarts → 2 demies → finale) mais SANS conférence
(le schéma T1 ne la modélise pas pour la Cup — trouvaille en relisant le
schéma plutôt qu'une supposition). `createCupBracket` (`lib/actions/
admin-competitions.ts`) + 2e fieldset sur le formulaire de création. Aucun
autre code nécessaire : la synchro T4 et le moteur de scoring T5 géraient
déjà la Cup de façon générique, jamais exercés bout-en-bout avant ce jour.
`tsc`/`eslint`/`vitest` (37/37)/`next build` propres.

**Dry-run réel** — Claude ne peut pas écrire en production (classificateur
de permissions bloque toute mutation, même sur une compétition de test
isolée). Script préparé par Claude (`scripts/dryrun-cup-sync-test.mjs`),
EXÉCUTÉ PAR L'UTILISATEUR étape par étape dans son terminal, Claude guidant
et vérifiant en base en lecture seule (jamais bloquée) :
1. `setup` : « Test » (vraie compétition ACTIVE) archivée temporairement ;
   compétition Cup de test créée, 2 vrais matchs (NYK-TOR, MIA-ORL, réels du
   09/12/2025, repérés via 3 appels API) + 2 placeholders.
2. Passe 1 (`?date=2025-12-09`, PowerShell — plusieurs allers-retours sur la
   syntaxe `Invoke-WebRequest` vs `curl` natif) : 2 matchs capturés et
   scorés, séries `FINISHED`, vainqueurs propagés AUTOMATIQUEMENT dans la
   demi-finale — jamais vérifié avant ce jour pour une série Cup à 1 seul
   match (mécanique distincte du format 4-victoires Playoffs déjà éprouvé).
3. Passe 2 (`?date=2025-12-13`), ajoutée à la demande explicite de
   l'utilisateur après avoir vu la passe 1 (« on n'a pas pu tester que les
   matchs se remplissaient au fur et à mesure ») : un vrai match NYK-ORL de
   cette date, repéré dès le 1er sondage, correspond exactement à la
   demi-finale déjà propagée — capturé seul parmi 15 vrais matchs du jour,
   scoré, vainqueur propagé dans la finale. Prouve la capture incrémentale
   jour par jour, pas seulement une résolution rétroactive en un coup.

Piste explorée puis abandonnée avec l'utilisateur : trouver un vrai match
Cup encore `SCHEDULED` (pas joué) pour vérifier le rendu « à pronostiquer »
côté Hub Jouer/Accueil. 0 match trouvé sur 5 dates d'octobre 2026 sondées —
calendrier 2026-27 pas encore publié côté API. Reporté (voir
`GAPS_OUVERTS.md`), pas remplacé par un match fabriqué (l'utilisateur l'a
explicitement écarté malgré la commande `simulate-upcoming` déjà prête).

**Bug trouvé et corrigé en testant** : le 1er `teardown` a supprimé la
compétition de test mais échoué SILENCIEUSEMENT à restaurer « Test » en
ACTIVE (`.delete()` sans vérification d'erreur dans le script) — un vrai
bracket joueur (7 `bracket_picks` + 1 `brackets`) créé pendant le test
(consultation de `/play/bracket` pendant que la compétition de test était
active) bloquait la suppression de `series` par FK. Diagnostiqué en lecture
seule, nettoyé manuellement dans le bon ordre, « Test » restaurée et
revérifiée intacte. Script corrigé : chaque étape de `teardown` lève
désormais une erreur explicite, nettoyage étendu à `bets`/`bracket_picks`/
`brackets`.

**Incident sécurité, sans lien avec le code** : le `SYNC_SECRET` réel est
apparu plusieurs fois en clair dans le chat (l'utilisateur l'a collé dans
des commandes PowerShell, une fois via une sélection IDE) — même famille que
2 incidents précédents sur des mots de passe de test. Régénération
recommandée, pas encore confirmée faite.

Documentation mise à jour en miroir : `SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1.md`
§10 (correctif) ; `ETAT_ACTUEL.md` §2.52 ; `GAPS_OUVERTS.md` (mini-bracket
Cup retiré des gaps, 2 nouveaux gaps ajoutés : rendu « à venir » Cup, et
régénération `SYNC_SECRET`).

---

## Commit/push du chantier NBA Cup (02/08/2026)

Confirmé par l'utilisateur en tout début de session — le chantier du
31/07/2026 (création NBA Cup, dry-run réel) était resté en attente de
confirmation avant commit (`ETAT_ACTUEL.md` §2.52). Aucun changement de code
depuis le dry-run. Committé et poussé (`6f591b0`).

Rappel explicite fait à l'utilisateur : régénération du `SYNC_SECRET`
toujours pas confirmée faite (exposé en clair pendant le dry-run,
31/07/2026) — mis de côté à sa demande (« oublie sync_secret pour le
moment »), toujours listé dans `GAPS_OUVERTS.md`.

---

## Stepper d'écart repensé sous l'équipe vainqueur, écran Matchs (02/08/2026, suite)

Demande directe de l'utilisateur sur l'écran Matchs : « gérer l'écart
pronostiqué par un bouton + disponible sous chaque équipe [...] pour
incrémenter de 1 pour une des équipes ». Phrase ambiguë entre 2 lectures
structurelles — clarifiée par `AskUserQuestion` avant de coder plutôt que
devinée (même réflexe que les chantiers précédents) :
1. un compteur indépendant par équipe (score à la volée : chaque équipe part
   de 0, le vainqueur/écart se déduisent de la différence) — changement
   profond, fusionne `TeamPicker` et `MarginStepper` ;
2. le `TeamPicker` existant inchangé (sélection du vainqueur par tap sur le
   logo), seul le `+` du stepper d'écart se déplace sous la colonne de
   l'équipe déjà choisie.

L'utilisateur a choisi la 2e lecture, plus proche de l'écran actuel.

**Code** : `MarginStepper.tsx` prend 3 nouvelles props (`winnerTeamId`,
`homeTeamId`, `awayTeamId`), retourne `null` tant qu'aucun vainqueur n'est
choisi, puis rend un grid 2 colonnes (même patron que
`TeamPicker.module.css`) où les contrôles n'apparaissent que dans la colonne
du vainqueur. `PredictionForm.tsx` lui passe le `winner` déjà en state local
plus les 2 ids d'équipe du match. Aucun changement de contrat serveur ni de
migration — `predicted_margin` reste un entier unique.

**2e question `AskUserQuestion`**, posée dans la foulée de la 1re : fallait-il
garder un bouton `−` à côté du `+` ? L'utilisateur a choisi de le retirer
(« seulement le + »). Committé/poussé (`939f3f9`).

**Testé au clic en conditions réelles** (compte `TestJoueur1`, mot de passe
`TutoTest2026!` déjà connu depuis le tutoriel joueur §2.51) : Playwright
réinstallé temporairement en dev dependency (même patron que §2.51),
script jetable écrit, exécuté, supprimé ; désinstallation de Playwright
revérifiée par `git diff package.json package-lock.json` (aucune trace).
Vérifié : sélection domicile ET visiteur, aucune erreur console.

**Trouvaille en testant, sans lien avec le code applicatif** : au lancement
de `npm run dev`, 2 serveurs Next.js tournaient déjà en local sans avoir été
démarrés par Claude — un `next dev --port 3001` et un `next start` (build de
PRODUCTION) sur le port 3000, tous deux répondants. Le 1er essai a tapé par
erreur sur le port 3000 et a montré l'ANCIEN rendu malgré le code déjà
corrigé — diagnostiqué en lisant les lignes de commande des process
(`Get-CimInstance Win32_Process`, PowerShell), pas en supposant. Basculé sur
le port 3001 (vrai dev server) pour la suite. Les 2 process pré-existants
n'ont jamais été arrêtés (origine inconnue, risque de couper une session de
l'utilisateur — signalé explicitement).

**Retour utilisateur après un tour d'usage réel** : « j'aime bien comment
c'est actuellement, il manque juste le bouton − ». Réintroduit à l'identique
des règles de §6 (mêmes gardes de désactivation vide/1/50), sous la même
colonne que le `+`. Re-testé au clic (même compte, Playwright réinstallé
puis re-désinstallé une 2e fois). Committé/poussé séparément (`139de16`),
pas un amendement du 1er commit.

Documentation mise à jour en miroir : `SPEC_ECRAN_MATCHS_V0_1.md` §22
(amendement post-implémentation, §6 non rouvert) ; `ETAT_ACTUEL.md` §2.53 ;
`GAPS_OUVERTS.md` (aucun gap ouvert par ce chantier).

---

## Bug « Paris séries » Accueil/hub Jouer : affiches du bracket personnel au lieu des vraies affiches (04/08/2026)

**Signalé par l'utilisateur** : la section « Paris séries non remplis » de
l'Accueil (ajoutée le 28/07/2026) proposait des paris sur les affiches issues
de SON propre bracket rempli, pas sur les vraies affiches qualifiées pour les
demies/finales de conférence/finale NBA.

**Cause racine** : `getSeriesBetsTodo` (`lib/queries/home.ts`) et
`getBracketCard` (`lib/queries/play-hub.ts`) réutilisaient
`getRemainingSeriesBets(data)`/`getBracketFillData()`
(`lib/queries/bracket-fill.ts`), dont `computeCandidateTeamIds` dérive
TOUJOURS les candidats de tour 2+ des PICKS du joueur, jamais du résultat
officiel — une RÈGLE NON NÉGOCIABLE, correcte et volontaire pour l'écran de
remplissage `/play/bracket` (verrouillé avant le 1er match des playoffs,
donc avant tout résultat réel de tour 2+, cf. §0/§3 de
`SPEC_ECRAN_BRACKET_PERSONNEL_V0_1.md`). Mais un pari SÉRIE, lui, reste
ouvert jusqu'au coup d'envoi RÉEL de la série — donc potentiellement après
que le tour précédent soit réellement terminé. La réutilisation (actée le
28/07/2026, `play-hub.ts` §« EXCEPTION assumée ») n'avait pas anticipé ce
cas, jamais rencontré avant que les playoffs avancent réellement à un tour
2+.

Vérifié avant de coder : bug purement d'AFFICHAGE, pas d'intégrité — un pari
SÉRIE n'est rattaché qu'à `series_id` en base (`bets`, `save_bet`,
`bets_insert` RLS), jamais à une paire d'équipes figée ; aucune colonne
team1/team2 sur `bets`.

**Confirmé avec l'utilisateur avant de coder** (`AskUserQuestion`, conflit
entre un garde-fou déjà validé et un usage différent qui s'en trouve faux) :
corriger Accueil ET la carte Bracket du hub Jouer, sans toucher à l'écran
`/play/bracket` (remplissage) lui-même, dont la règle reste correcte pour son
propre usage.

**Code** : nouveau module `lib/queries/series-bets.ts`, `getRemainingSeriesBets()`
(sans argument, DISTINCT de l'ancienne fonction pure du même nom dans
`bracket-fill.ts`, supprimée) — lit DIRECTEMENT `series.team1_id/team2_id`
(mêmes colonnes que `lib/queries/bracket.ts`, tenues à jour par le cascade
admin `lib/scoring/advancement.ts` au fur et à mesure des résultats réels),
jamais les picks. `home.ts::getSeriesBetsTodo` et
`play-hub.ts::getBracketCard` branchés dessus. Nettoyage en miroir dans
`bracket-fill.ts` : champ `isBetDeadlinePassed` retiré (devenu mort, ne
servait qu'à l'ancienne fonction supprimée) ; `earliestKickoffBySeries`
revenu à son calcul conditionnel NBA Cup uniquement (comme avant l'ajout des
paris séries) puisque plus rien en Playoffs n'en dépend dans ce fichier.

Vérifié : `tsc --noEmit`, `eslint`, `next build` (36 routes, aucun conflit),
`vitest run` (37/37, aucune régression).

**Point ouvert signalé à l'utilisateur, PAS corrigé dans ce lot** : le même
souci d'affichage existe potentiellement sur `/play/bracket` lui-même — la
carte de série y affiche `series.teamA/teamB` (picks) juste au-dessus de
l'`<InlineBetForm scope="SERIES">` qui sert à poser le VRAI pari série
(`BracketFillBoard.tsx`). Une fois le tour précédent réellement terminé, ces
noms d'équipe peuvent diverger des vraies affiques alors que le pari, lui,
porte bien sur la vraie série. Distinct du bug corrigé ici (scope confirmé :
Accueil + hub Jouer seulement) — nécessiterait une décision produit propre
(afficher les 2 affiches — pick ET réelle — sur la même carte, ou autre) avant
de coder. Ajouté à `GAPS_OUVERTS.md`.

**Suite immédiate demandée par l'utilisateur** : « Oui je veux bien » — corriger
aussi `/play/bracket`. Décision de conception prise (pas reposée à
l'utilisateur, décision d'implémentation directe) : la carte de série garde
SA cascade de picks INCHANGÉE pour la partie pronostic (teamA/teamB,
score) — c'est ce que protège la RÈGLE NON NÉGOCIABLE (§0/§3 de
`SPEC_ECRAN_BRACKET_PERSONNEL_V0_1.md`), pas rouverte. Seule la partie PARI
(`InlineBetForm`) change :

**Code** : `BracketFillSeries` (`bracket-fill.ts`) gagne 2 champs
`realTeamA`/`realTeamB` — lus DIRECTEMENT sur `row.team1_id`/`team2_id` (déjà
en mémoire, aucune requête supplémentaire), jamais dérivés de la cascade de
picks, gardés bien séparés de `teamA`/`teamB` par un commentaire explicite.
`BracketFillBoard.tsx` : nouvelle fonction `canOfferSeriesBet(series)` — le
pari série n'est proposé que si (a) ROUND_1 (les vraies équipes y sont
TOUJOURS connues, tour racine = colonnes officielles), OU (b) les 2 vraies
équipes de tour 2+ sont connues, OU (c) un pari existe déjà sur cette série
(posé AVANT ce correctif, sous l'ancienne règle moins stricte — affiché tel
quel, jamais masqué rétroactivement). Sinon : placeholder « Pari série : les
2 équipes réelles ne sont pas encore connues. », pas de bouton d'action.
Quand le pari est proposable sur un tour 2+, un label dédié apparaît
au-dessus du formulaire : « Pari sur la vraie série : X vs Y » (vraies
équipes), visuellement distinct des boutons de pronostic juste au-dessus
(picks, inchangés) — pas de label redondant en ROUND_1 (les 2 informations y
sont toujours identiques).

**Effet de bord positif, pas cherché mais constaté en concevant le
correctif** : avant ce lot, un pari série de tour 2+ pouvait être proposé dès
que le joueur avait rempli SES PROPRES picks des 2 séries qui alimentent
celle-ci — potentiellement bien avant que les vraies équipes soient connues
(aucun match réel encore synchronisé pour cette série ⇒
`bet_deadline_open` toujours "ouvert"). `canOfferSeriesBet` ferme cette
fenêtre pour tout NOUVEAU pari (un pari SÉRIE de tour 2+ n'est plus proposable
tant que les 2 vraies équipes ne sont pas connues) — les paris déjà posés sous
l'ancien comportement restent valides et affichés (cas (c) ci-dessus).

Vérifié : `tsc --noEmit`, `eslint`, `next build` (36 routes, aucun conflit),
`vitest run` (37/37, aucune régression). Point retiré de `GAPS_OUVERTS.md`.

---

## Écran Nouveau pari : carte de saisie masquée tant qu'aucune cible n'est choisie (04/08/2026)

**Demandé par l'utilisateur** : la carte de saisie (énoncé/catégorie/
difficulté), fixée en bas du viewport depuis le 27/07/2026 pour rester
visible pendant le défilement du sélecteur série/match, restait affichée en
PERMANENCE dès l'arrivée sur l'écran — même avant tout choix de série/match —
« gênant qu'elle reste tout le temps ».

**Code** : `BetForm.tsx` — le bloc `.stickyContent` (énoncé, catégorie,
difficulté, actions) n'est désormais rendu que si `hasTarget` (variable déjà
existante, calculée : série choisie en scope SÉRIE, série ET match choisis en
scope MATCH). Les gardes `!hasTarget` des boutons Enregistrer/Soumettre
retirées (devenues inutiles : le bloc entier est déjà gardé par `hasTarget`).
`BetForm.module.css` — la marge basse réservée (`padding-bottom: 45vh`, pour
que le sélecteur reste défilable au-dessus du bandeau fixe) déplacée dans une
classe séparée `.formReserveBottom`, appliquée seulement quand le bandeau est
affiché (sinon le sélecteur laissait un grand vide en bas avant tout choix).

Aucun changement pour l'édition (`mode="EDIT"`) ni pour le raccourci depuis
Matchs (`FROM_MATCH`, match déjà présélectionné) : dans les 2 cas `hasTarget`
est déjà vrai dès le montage, la carte reste visible immédiatement comme
avant.

Vérifié : `tsc --noEmit`, `eslint`, `next build` (36 routes, aucun conflit),
`vitest run` (37/37, aucune régression). Pas encore confirmé visuellement par
l'utilisateur dans son navigateur.

**Retour utilisateur après test réel** : « ça marche mais une fois qu'on a
cliqué sur un match il reste affiché le panneau ». Ambigu — clarifié par
`AskUserQuestion` avant de recoder plutôt que deviné : gêne = le panneau
complet, une fois affiché, prend trop de place et cache le sélecteur,
empêchant de choisir facilement un AUTRE match/série sans le refermer
d'abord.

**Code (2e passe)** : `BetForm.tsx` — nouvel état `isExpanded` (toujours vrai
en édition, faux par défaut en création). Une fois une cible choisie
(`hasTarget`) mais le panneau replié, une BARRE COMPACTE apparaît (libellé de
la cible + bouton « Rédiger le pari », `.selectionBar`) au lieu du panneau
complet ; celui-ci (`.stickyContent`) ne s'affiche qu'au tap sur cette barre
(`showFullPanel = hasTarget && isExpanded`), avec un bouton « Réduire » en
en-tête pour revenir à la barre compacte sans perdre la saisie déjà tapée
(state conservé, juste masqué). Changer de série/scope/match (`handleScopeChange`,
`handleSeriesSelect`, nouveau `handleMatchSelect`) replie automatiquement le
panneau (`setIsExpanded(false)`) pour toujours redonner la vue complète du
sélecteur après un nouveau choix. `BetForm.module.css` : marge basse réservée
sur `.form` désormais à 3 états (aucune/`.formReserveBottomCompact`/
`.formReserveBottom`) au lieu de 2, pour ne réserver que la hauteur réellement
occupée par la barre ou le panneau.

Vérifié : `tsc --noEmit`, `eslint`, `next build` (36 routes, aucun conflit),
`vitest run` (37/37, aucune régression).

---

## Projet Supabase mis en pause après 7 jours : cause racine trouvée et corrigée (04/08/2026)

**Signalé par l'utilisateur** : le projet Supabase avait été mis en pause
(plan gratuit, 7 jours d'inactivité), alors qu'un heartbeat anti-pause
(`app/api/heartbeat`, `.github/workflows/heartbeat.yml`, 1x/jour) existait
déjà depuis le chantier T8 (28/07/2026).

**Diagnostic** : `vercel ls`/`vercel inspect` montraient le déploiement
Vercel sain ; `supabase projects list` (CLI, déjà authentifié) montrait le
projet en statut `ACTIVE_HEALTHY` — donc déjà ressorti de pause tout seul (un
appel Management API suffit à réveiller un projet en pause), rien à
« réparer » côté Supabase lui-même. Cause racine trouvée en comparant
`heartbeat.yml` aux 6 autres workflows planifiés (`sync-teams`,
`sync-schedule`, `sync-results`, `reminder-bracket`, `reminder-matches`,
`snapshot-leaderboard`) : TOUS appellent leur route en `curl -X POST`, et
leurs routes exportent bien `GET`/`POST` (`export const GET = handle; export
const POST = handle;`) — SAUF `app/api/heartbeat/route.ts`, qui n'exportait
QUE `GET`. Confirmé en clair : `curl -X POST .../api/heartbeat` → `405`,
`curl -X GET` (sans token) → `401` (attendu, juste pour distinguer 405 de «
route existe mais refuse la méthode »). Le heartbeat échouait donc en 405 à
CHAQUE exécution quotidienne depuis sa création, jamais remarqué (personne
ne consultait l'onglet Actions du dépôt) — jusqu'à la pause réelle.

**Incident annexe, signalé immédiatement** : en diagnostiquant, une commande
`supabase projects api-keys` (inutile — `projects list` avait déjà répondu
sur le statut) a affiché en clair les clés `anon` et `service_role` (legacy)
dans le terminal, donc dans cette conversation. Rotation proposée via
`AskUserQuestion` ; **déclinée par l'utilisateur** (« pas nécessaire cette
fois »). Mémoire de collaboration mise à jour en conséquence : la réaction
« toujours régénérer après exposition » des 2 incidents précédents (juillet)
n'est pas une règle absolue, à reproposer sans forcer la main la prochaine
fois.

**Code** : `app/api/heartbeat/route.ts` — passage de `export async function
GET(...)` à `async function handle(...)` + `export const GET = handle;
export const POST = handle;`, même patron que les 6 autres routes. Aucun
changement fonctionnel du ping lui-même (toujours `SELECT count` léger sur
`teams`, toujours un simple log `HEARTBEAT`).

Vérifié : `tsc --noEmit`, `eslint`, `next build` (36 routes, aucun conflit),
`vitest run` (37/37, aucune régression). Committé (`db7731d`), poussé,
déployé sur Vercel (auto, GitHub → Vercel), **testé en conditions réelles en
production** : `curl -X POST` avec le vrai `SYNC_SECRET` (jamais affiché,
lu dans une variable shell locale) → `200 {"ok":true}`. Le prochain passage
planifié (`0 6 * * *`, cron GitHub Actions) confirmera le fonctionnement
sans intervention.

**Limite connue, déjà documentée dans `heartbeat.yml` lui-même, pas reprise
ici en détail** : GitHub désactive un workflow planifié après 60 jours SANS
AUCUNE activité sur le dépôt (pas le déclenchement du workflow) — un creux de
saison NBA (juin→novembre) pourrait dépasser ce seuil. Aucune automatisation
prévue pour ce cas à ce stade (cf. commentaire du fichier).

---

## Raccourci « Parier sur cette série » depuis le Bracket global (04/08/2026)

**Demandé par l'utilisateur** dans la foulée : pouvoir saisir un pari
directement en cliquant sur une série dans le Bracket global (`/bracket`,
vue de consultation partagée visiteur/joueur, `lib/queries/bracket.ts`),
même principe que le raccourci déjà existant depuis Matchs (`?matchId=`).

**Code** : `lib/queries/bets.ts` — `NewBetContext` gagne un 3e mode
`FROM_SERIES` (à côté de `FROM_MATCH`/`FREE`) ; `getNewBetFormData` accepte
un 2e paramètre `seriesIdParam`, résolu avec la MÊME garde que
`isSeriesSelectable` de `BetForm.tsx` (`seriesBetOpen && !seriesSlotTaken`) —
sinon retombe sur `FREE` avec `shortcutClosed: "SERIES"` (jamais une erreur
bloquante, même patron que le raccourci match). `shortcutClosed` généralisé
de `boolean` à `"MATCH" | "SERIES" | null` pour distinguer le message adapté
au raccourci concerné. `app/(app)/play/bets/new/page.tsx` lit `?seriesId=` en
plus de `?matchId=`. `BetForm.tsx::resolveInitialTarget` gère `FROM_SERIES`
(scope SÉRIE, série préremplie).

Affichage du lien : `/bracket` est un écran PARTAGÉ visiteur/joueur — le
lien « Parier sur cette série » n'apparaît QUE pour un joueur connecté ET en
compétition PLAYOFFS (paris séries absents en NBA Cup, même garde que
`BracketFillBoard.tsx`), calculé UNE FOIS dans `BracketSummary.tsx`
(`showBetLink`) et redescendu à `TreeView`/`SeriesDrillDown` (vue A ET vue
B). Rendu dans le détail DÉPLIÉ d'une série (à côté de `SeriesGroups`, pas
sur la carte elle-même — la carte entière est déjà un `<button>` qui bascule
le drill-down, imbriquer un 2e bouton aurait été invalide) : cliquer une
série ouvre son détail comme avant (comportement existant inchangé), un lien
« Parier sur cette série » y apparaît en plus si les 2 équipes réelles sont
connues.

Vérifié : `tsc --noEmit`, `eslint`, `next build` (36 routes, aucun conflit),
`vitest run` (37/37, aucune régression). Pas encore confirmé visuellement par
l'utilisateur dans son navigateur.

---

## Couleurs d'équipe sur Profil — reprise cadrée par maquettes, cette fois codée (04/08/2026)

**Demandé par l'utilisateur** : « On peut repartir sur une spec plus solide
pour les couleurs qui personnalisent les profils ? » — reprise explicite du
point `BACKLOG_V1.md` § Personnalisation du profil, essayé puis abandonné le
30/07/2026 ("je ne pense pas que ça ait d'importance"), avec la consigne
« ne pas retenter sans qu'il le demande explicitement » (`GAPS_OUVERTS.md`,
[[nba-pronos-collab-style]]). Cette fois la consigne du 30/07 était de
cadrer AVANT de coder, pas de redeviner.

**Cadrage (`AskUserQuestion`, avant tout code)** :
- Portée : Profil uniquement (pas étendu au Classement/carte joueur), comme
  la 1re fois.
- Intensité : « à définir ensemble en revoyant des maquettes » — pas
  tranchée à l'avance.

**Itérations de maquette (artifact HTML, reconstruit via un script Node
`build-mockup.js` qui injecte les VRAIS blasons SVG (5 équipes,
`public/logos/teams/*.svg`, classes `cls-N` namespacées par équipe pour
éviter les collisions) et la vraie photo de bandeau en base64 — jamais de
placeholder générique, jamais de lorem)** :
1. 3 pistes (A accents doux / B bandeau signature / C immersion complète),
   reprenant les 2 intensités du 1er essai + 1 nouvelle — **B choisie**
   (bandeau seul teinté, reste de l'écran neutre).
2. Bandeau B jugé « trop conventionnel » (voile dégradé sur photo) →
   2 nouvelles pistes plus tranchées : **duotone** (photo désaturée
   recolorée en 2 tons via `mix-blend-mode: color`, PAS un calque
   transparent) et **bloc diagonal** (aplats coupés net, esprit maillot) —
   **duotone choisi**.
3. Affinages successifs du bandeau duotone, chacun redéployé sur le MÊME
   artifact (même URL) : retrait du petit badge rond + pseudo agrandi aligné
   à droite ; réintroduction d'un grand blason en filigrane (repris du bloc
   diagonal) derrière le pseudo ; blason déplacé à gauche, plein (sans
   transparence), liseré blanc autour de la silhouette (filtre SVG
   `feMorphology`/`feComposite`/`feMerge`, PAS un `border`) ; liseré affiné,
   blason agrandi pleine hauteur ; blason+pseudo groupés à gauche puis
   RETRANSFORMÉS en 2 extrémités opposées du bandeau (blason tout à gauche,
   pseudo tout à droite) sur demande finale.

**Bug trouvé PENDANT le maquettage, pas dans le code réel** : après avoir
calé le blason au bord gauche (marge négative annulant le padding), un écart
persistait — signalé par l'utilisateur avec une capture d'écran. Cause :
le `<svg>` conteneur (technique `<use>` + sprite `<symbol>`, propre à
l'artifact pour éviter de dupliquer les gros SVG) n'avait pas de `viewBox`
propre → ratio par défaut 2:1 du navigateur, `<use>` centré/réduit en
préservant SES propres proportions → vide interne à l'image, invisible à
tout réglage de marge CSS. Corrigé en injectant le VRAI `viewBox` de chaque
équipe via le script de build. **Ce bug n'existe pas dans l'implémentation
réelle** (`next/image`/`<img>` utilise nativement le bon ratio intrinsèque
d'un fichier SVG externe — le problème était spécifique à la technique
`<use>` de l'artifact, pas au mécanisme CSS lui-même).

**Décisions actées pour la spec** (pas un fichier `SPEC_ECRAN_*` séparé —
le cadrage par maquettes validées tient lieu de spec ici, proportionné à la
taille du changement) :
- Source des couleurs : nouvelle constante de code `lib/labels/teamColors.ts`
  (primaire + secondaire des 30 franchises, mêmes clés `abbreviation` que
  `TeamRef`) — PAS une colonne base, même choix que `lib/labels/rounds.ts`.
- Déclenchement : automatique dès que `favorite_team_id` est renseigné
  (déjà existant) — **aucune migration, aucun toggle opt-in/opt-out**
  (le 1er essai avait `users.use_team_colors`, retiré avec tout le reste).
  Rien n'est modifié pour un joueur sans équipe favorite.
- Portée : uniquement le bandeau d'en-tête du Profil (`app/(app)/profile/
  page.tsx`) — fonds, onglets, boutons, texte restent 100% inchangés.

**Code** : `lib/queries/profile.ts` — `ProfileData` gagne `favoriteTeam:
TeamRef | null`, résolu par un `fetchTeam` local (même patron que
`lib/queries/player-profile.ts`). `app/(app)/profile/page.tsx` — le
`<header>` compose une classe `.headerTeam` + variables CSS
`--team-primary`/`--team-secondary` UNIQUEMENT si `teamColors` est résolu ;
un filtre SVG caché (`#profile-crest-outline`, `feMorphology` dilate +
`feComposite` + `feMerge`) rendu conditionnellement fournit le liseré blanc
fin, réutilisé par `next/image` (le blason, `unoptimized` comme
`TeamLogo.tsx`) via `filter: url(#profile-crest-outline)` en CSS.
`app/(app)/profile/page.module.css` — `.headerTeam::before`/`::after`
écrasent LOCALEMENT les pseudo-éléments partagés de `.hero-banner`
(`app/globals.css`) par spécificité (2 classes du module > 1 classe globale)
— AUCUN autre écran composant `.hero-banner` (Accueil, Bracket, Matchs, hub
Jouer) n'est affecté. Un voile de lisibilité additionnel (`.textScrim`) est
un VRAI enfant du bandeau (pas un 3e pseudo-élément, `.hero-banner` n'en a
que 2), promu par la règle globale `.hero-banner > * { z-index: 1 }`.

**Vérifié en conditions RÉELLES** (compte `TestJoueur1`, mot de passe déjà
connu `TutoTest2026!` — email retrouvé via `supabase.auth.admin.getUserById`,
JAMAIS affiché en clair dans le terminal cette fois, contrairement à
l'incident du 04/08/2026 plus tôt cette session ; Playwright réinstallé
temporairement en dev dependency puis retiré, même patron que les sessions
précédentes) : équipe favorite réglée sur Lakers via la vraie action serveur
`updateProfile`, bandeau duotone violet/or + blason avec liseré + pseudo
agrandi confirmés à l'écran, EXACTEMENT conforme à la dernière maquette
validée, en thème sombre ET clair (bandeau toujours sombre dans les 2 cas,
conforme à la règle déjà actée du design system, `tokens.css` §15.7). Compte
de test restauré à son état d'origine après coup (`favorite_team_id: null`,
`theme_preference: DARK`).

**Trouvaille distincte, sans rapport avec ce lot, PAS corrigée** : après
« Enregistrer » (équipe favorite) OU après bascule de thème, l'écran ne
reflète pas immédiatement le changement sans un rechargement complet de la
page (`revalidatePath` + `redirect`, pourtant déjà en place sur les 2
actions) — observé en testant, reproductible sur les 2 actions à l'identique
(donc probablement un comportement Next.js App Router déjà présent AVANT ce
lot, pas une régression introduite ici). Hors périmètre de ce chantier, pas
d'investigation plus poussée à ce stade — à garder en tête si un utilisateur
réel signale la même chose.

Vérifié : `tsc --noEmit`, `eslint`, `next build` (36 routes, aucun conflit),
`vitest run` (37/37, aucune régression), test en conditions réelles ci-dessus.
Pas encore committé.

---

## Nouvel onglet Stats — Profil (04/08/2026)

**Demandé par l'utilisateur** : « prochain chantier, l'onglet stats et les
badges » — reprise de 2 points du backlog (`BACKLOG_V1.md` § "Historique &
stats" / "Fun / esprit ligue entre potes") : la courbe d'évolution n'avait
qu'un socle de données posé le 30/07/2026 (`leaderboard_snapshots`), aucun
écran ; les "badges permanents" étaient explicitement "pas encore tranchés,
à spécifier".

**Cadrage avant le code** (même discipline que les couleurs d'équipe plus
tôt cette session) :
- `AskUserQuestion` : emplacement (nouvel onglet Profil, confirmé) et
  contenu (choix multiple parmi 4 propositions — les 4 ont été choisies :
  courbe d'évolution, précision des pronos, bilan des paris, comparaison
  aux autres joueurs). Badges : juste une catégorie placeholder, "on verra
  après" — aucune liste à concevoir maintenant.
- **Mode Plan** utilisé pour la 1re fois cette session (chantier data/
  requêtes plus que design pur) : 1 agent Explore (queries existantes,
  aucune librairie de graphes dans le projet, tokens couleur disponibles) +
  1 agent Plan (validation du schéma de requêtes, types, géométrie SVG),
  puis plan écrit et détaillé à la demande explicite de l'utilisateur
  (« détailles moi le plan, fais moi une maquette »).
- **Maquette artifact** (comme les couleurs d'équipe) demandée en plus du
  plan écrit — chiffres d'exemple, réplique de l'en-tête/onglets réels,
  ordre des 5 blocs (Précision → Comparaison → Évolution → Paris → Badges)
  et géométrie du graphe SVG déjà conforme au plan. Validée avec un seul
  ajustement demandé : **filtre Général/Ligue sur la Comparaison**
  (rang + moyenne), même mécanisme que Classement/Bracket
  (`resolveLeagueScope`) — ajouté au plan ET à la maquette avant validation
  finale, puis plan approuvé via `ExitPlanMode`.

**Code** :
- `lib/queries/stats.ts` (nouveau) — `getProfileStats(leagueId?)`, union
  discriminée sur `hasActiveCompetition` (même esprit que `emptyData()` de
  `leaderboard.ts`/`bracket.ts`). 6 requêtes (1 compétition active + 5 en
  parallèle) : `user_scores` (UNE fois pour ma ligne/rang/nombre de joueurs/
  moyenne des autres — simplification par rapport à `player-profile.ts`, qui
  refait 2 requêtes `user_scores` redondantes, PAS reproduit ici),
  dénominateur de précision via l'idiome `count: "exact", head: true` déjà
  établi ailleurs (`lib/queries/admin-dashboard.ts` etc.), 1re lecture de
  `leaderboard_snapshots` PAR UTILISATEUR (jusqu'ici seul lecteur :
  `computeBiggestClimb`, `lib/scoring/superlatives.ts`, qui agrège TOUS les
  joueurs pour ne garder que le 1er rang de chacun — logique différente,
  pas réutilisable telle quelle), mes paris résolus, et
  `resolveLeagueScope` (déjà factorisé dans `lib/queries/leagues.ts`,
  commentaire de tête : conçu pour être réutilisé par tout écran filtrant
  par ligue — rien à écrire de neuf pour le filtre lui-même).
- `components/profile/RankEvolutionChart.tsx` (nouveau) — SVG fait main,
  composant SERVEUR, aucune librairie de graphes (aucune dans le projet,
  une seule courbe ne le justifie pas). Rang projeté DIRECTEMENT sur l'axe y
  (rang 1 = haut de l'écran) — pas d'inversion à coder, juste un domaine
  `[min-1, max+1]` pour respirer. Seul le dernier point est étiqueté
  (rang actuel), 2 dates en repère, `stroke: var(--color-trend)` (token
  déjà réservé "tendance", jamais win/loss, règle R-COL7 du design system —
  pas `--color-accent`).
- `components/profile/LeagueScopeChips.tsx` (nouveau) — même patron que
  `components/bracket/LeagueScopeChips.tsx`/`components/leaderboard/
  LeagueScopeChips.tsx` : une copie dédiée par écran (`href` en dur vers
  `/profile?tab=stats&ligue=X`), convention déjà établie dans ce projet
  plutôt qu'un composant générique partagé.
- `components/bracket/ProgressBar.tsx` — nouveau prop optionnel `label?`
  (défaut inchangé) pour réutiliser le composant sur "Précision" sans lui
  faire annoncer le mauvais texte en lecteur d'écran ("Progression : X sur
  Y" ne convenait pas à un contexte de précision de pronos).
- `components/profile/ProfileTabs.tsx` / `app/(app)/profile/page.tsx` /
  `page.module.css` — 5e onglet "Stats" (après "Compte"), branché sur le
  même patron que les 4 onglets existants (`?tab=`, fetch conditionnel,
  bloc JSX sibling). Filtre ligue scope UNIQUEMENT `rank`/`comparison` — la
  courbe d'évolution reste le classement GÉNÉRAL quel que soit le filtre
  actif (recalculer un rang par ligue jour par jour aurait demandé de
  ré-agréger tous les snapshots de tous les joueurs, hors de proportion
  pour ce lot — décision actée dans le plan, précisée dans la légende du
  graphe pour ne pas laisser croire le contraire). Delta de comparaison en
  texte NEUTRE, jamais vert/rouge (`--color-win`/`--color-loss` réservés
  aux résultats de jeu réels, pas à un écart de classement — évite une
  collision sémantique non couverte par les règles de couleur déjà actées).
  Aucune migration.

**Vérifié en conditions RÉELLES** (compte `TestJoueur1`, Playwright
réinstallé temporairement puis retiré, même patron que les lots
précédents) : onglet visible dark ET clair, tous les états vides corrects
(aucun match scoré, aucun pari résolu, "reviens dans quelques jours" quand
moins de 2 snapshots — le cas réel de la compétition de test). Pour vérifier
le graphe lui-même (code neuf, le plus à risque de ce lot), 4 lignes
`leaderboard_snapshots` insérées TEMPORAIREMENT via script jetable
(service_role) pour `TestJoueur1` sur la compétition de test — courbe
rendue correctement (montées/descentes, dernier point étiqueté `#3`, dates
aux 2 extrémités) en dark ET clair, **puis les 4 lignes supprimées** après
vérification (aucune trace laissée en base).

Vérifié : `tsc --noEmit`, `eslint`, `next build` (36 routes, aucun conflit),
`vitest run` (37/37, aucune régression). Pas encore committé.

---

## Stats : total de points en grand (05/08/2026)

**Demandé par l'utilisateur**, ajustement sur l'onglet Stats posé la veille
(entrée précédente) : le total de points apparaissait deux fois — une fois
noyé dans la grille de répartition « Points pronos / Points paris / Total »,
sans mise en avant. Sorti de la grille (qui passe de 4 à 3 colonnes) et
affiché en grand tout en premier (`.totalHero`/`.totalHeroValue`/
`.totalHeroLabel`, `app/(app)/profile/page.tsx` + `page.module.css`).
Changement d'affichage pur, aucune requête ni migration touchée.

Committé (`de24964`).

---

## DA : fond photo plein écran + cartes en verre, fond personnalisable (05-06/08/2026)

**Rattrapage de suivi (06/08/2026)** — cette entrée est écrite APRÈS coup,
en tout début de la session du 06/08/2026 où l'utilisateur a demandé « où en
est-on dans le projet ? ». `git log` a révélé 2 commits (celui ci-dessus et
celui-ci) postérieurs à la dernière entrée de ce journal, jamais documentés
ici ni dans `ETAT_ACTUEL.md`/`GAPS_OUVERTS.md` au moment où ils ont été
faits. **Le déroulé réel de la session qui a produit ce chantier (cadrage,
itérations, allers-retours avec l'utilisateur) n'est pas connu** — cette
entrée est reconstruite à partir du code, de ses commentaires (`app/
globals.css`, `app/tokens.css`) et de `public/brand/README.md`, pas d'une
mémoire de session. Signalé explicitement à l'utilisateur avant d'écrire
quoi que ce soit ; confirmation reçue de documenter a posteriori sur cette
base.

**Constat (commit `fc6fc43`, 06/08/2026 02:08)** : remplace le bandeau photo
étroit (`.hero-banner`) par un fond de page fixe plein écran (`.photo-page`)
derrière des cartes translucides (`.glass-card`) — d'après les commentaires
de code, essayé sur Accueil le 05/08/2026 puis généralisé le 06/08/2026 aux
écrans validés : Accueil, hub Jouer, Matchs, Mes paris, Nouveau pari, Mes
pronos, Bracket personnel, Classement, Profil (Profil garde son `<header>`
en `.hero-banner`, bandeau équipe/badges de la session du 04/08 — seul le
reste de l'écran migre). Bracket global `/bracket` non migré (format
horizontal, image dédiée envisagée mais pas faite selon le commentaire).

**Fond personnalisable** : sélecteur « Fond d'écran » ajouté dans Profil >
Compte, 3 choix (« Fresque streetball » MURAL par défaut, « Panier vu du
dessus » HOOP, « Terrain à Hong Kong » HK) — 3 photos Unsplash fournies par
l'utilisateur (licence Unsplash, `Cadrage/DA/*.zip`, recompressées 1080px/q68
plein écran + 220px/q62 vignette, `public/brand/hero-{mural,hoop,hk}
(-thumb).jpg`). Persisté via nouvelle colonne `users.background_theme`
(migration `20260806090000_background_theme.sql`, enum `MURAL|HOOP|HK`,
défaut `MURAL` — aucune policy RLS dédiée, `users_update_self` + le trigger
`enforce_users_invariants` couvrent déjà toute nouvelle colonne). Action
`updateBackgroundTheme` (`lib/actions/profile.ts`), même patron que
`updateThemePreference` déjà en place. Lu à la racine dans `app/layout.tsx`
(`getSitePreferences`, thème + fond fusionnés en 1 seule requête au lieu de
2) et posé comme attribut `data-bg` sur `<html>` (absent pour MURAL, déjà la
valeur de `:root`) ; `--photo-page-image` (`app/tokens.css`) redéfini par
`[data-bg="hoop"|"hk"]`.

**Détail technique notable** (d'après les commentaires de `app/globals.css`) :
`.photo-page` pose `isolation: isolate` pour que le fond reste contenu dans
son propre contexte d'empilement (sinon le `z-index` négatif du fond
s'échappe jusqu'à la racine, sous `.shell`) ; le fond est en `position:
fixed` plutôt que `background-attachment: fixed`, jugé peu fiable en scroll
sur iOS Safari. Conséquence directe sur du code existant :
`components/tutorial/TutorialModal.tsx` doit désormais se rendre via
`createPortal(..., document.body)` pour continuer à couvrir toute la page
depuis un écran migré (sans le portail, son backdrop resterait piégé dans le
contexte d'empilement du `.photo-page` parent).

**Vérifié PAR CE RATTRAPAGE (06/08/2026), pas par la session d'origine** :
`npx tsc --noEmit`, `npx eslint`, `npx vitest run` (37/37), `npx next build`
(36 routes, aucun conflit) — tous propres sur l'état actuel du dépôt.
**Aucune trace de vérification « en conditions réelles » dans un navigateur**
pour ce lot n'a été trouvée (ni commit, ni fichier de suivi, ni script
jetable) — contrairement à la quasi-totalité des autres chantiers de ce
journal. Reporté comme gap ouvert dans `GAPS_OUVERTS.md`.

Committé (`fc6fc43`). Documenté ici et dans `ETAT_ACTUEL.md` §2.57 le
06/08/2026.

---

## Thème à 3 choix : Sombre / Clair / Photo (06/08/2026, suite)

**Demandé par l'utilisateur**, testé juste après le rattrapage de suivi
ci-dessus : « le thème clair ne fonctionne pas car on ne voit pas grand
chose ». Cause déjà identifiée pendant le rattrapage (`GAPS_OUVERTS.md`) :
`.glass-card`/`.photo-page::after` n'ont aucun override
`[data-theme="light"]`. Question ouverte à l'utilisateur : proposer un
thème sombre / clair / photo plutôt que de patcher le clair — retenu.

**Cadrage (`AskUserQuestion`)** : (1) un seul sélecteur à 3 choix
mutuellement exclusifs, qui remplace le toggle Clair/Sombre existant
(retenu) plutôt que garder 2 sélecteurs séparés avec un rendu sombre forcé
sous photo ; (2) les joueurs ayant déjà choisi HOOP/HK (pas le défaut
MURAL) sont basculés automatiquement en thème Photo à la migration (retenu)
plutôt que remis sur Sombre par défaut. **Mode Plan** utilisé pour cadrer
l'implémentation technique (exploration directe du code, pas d'agent Explore
— fichiers déjà connus du rattrapage précédent) : plan écrit et approuvé
via `ExitPlanMode` avant de coder.

**Trouvaille de conception (avant de coder, en relisant `fc6fc43`)** :
`.photo-page`/`.glass-card` sont des classes GLOBALES posées de façon
identique et inconditionnelle dans les 9 écrans migrés — et ce même commit
avait RETIRÉ le fond/bordure solide que chaque `.section` avait avant lui.
Conséquence : tout le correctif tient dans `app/globals.css` (rendre ces 2
classes sensibles à `[data-theme="photo"]`, avec un repli solide par
défaut reprenant EXACTEMENT l'ancien rendu retiré), **zéro changement
nécessaire dans les 9 écrans/composants** qui posent déjà ces classes, ni
dans `tokens.css` (le mode Photo réutilise la palette sombre de `:root`
telle quelle, même choix déjà acté pour le duotone d'équipe, §2.54).

**Migrations** — `supabase/migrations/20260806100000_theme_photo_enum.sql`
(`alter type theme_preference add value 'PHOTO';`, SEUL contenu du
fichier) puis `20260806110000_migrate_photo_theme.sql`
(`update users set theme_preference = 'PHOTO' where background_theme <>
'MURAL';`) : séparées en 2 fichiers parce que PostgreSQL interdit d'utiliser
une valeur d'enum dans la transaction qui l'ajoute — même prudence que
l'incident de migration #19/#20 déjà rencontré sur ce projet. Poussées via
`npx supabase db push` sur la base réelle après confirmation explicite de
l'utilisateur (`AskUserQuestion`).

**Code** :
- `app/globals.css` : `[data-theme="photo"] .photo-page::before/::after`
  et `[data-theme="photo"] .glass-card` portent désormais l'image/le
  dégradé/le verre flouté (identiques à avant) ; `.glass-card` par défaut
  (Sombre, ou `[data-theme="light"]`) retrouve
  `background: var(--color-surface-raised); border: 1px solid
  var(--color-border-subtle);` — mêmes tokens que le reste du site, déjà
  dotés de leurs 2 variantes dark/light.
- `app/layout.tsx` : `SitePreferences.theme` → `"LIGHT" | "DARK" | "PHOTO"`,
  `data-theme` gagne la valeur `"photo"`, `data-bg` ne se pose plus que si
  `theme === "PHOTO"`.
- `lib/queries/profile.ts` / `lib/actions/profile.ts` : types et validation
  élargis à `"PHOTO"`.
- `app/(app)/profile/page.tsx` / `page.module.css` : le toggle à 1 bouton
  remplacé par 3 boutons Sombre/Clair/Photo (`.themePicker`/`.themeOption`,
  même patron de petit formulaire par choix que `.bgPicker`) ; le
  sous-sélecteur de 3 photos (inchangé) nesté dans la même section
  « Thème », affiché seulement si `profile.theme === "PHOTO"`.

**BUG RÉEL trouvé en testant au clic — 1er test en conditions réelles du
chantier photo depuis sa création le matin même (`fc6fc43`)** : les
pseudo-éléments `.photo-page::before`/`::after` (décoratifs, `position:
fixed`, plein viewport, z-index négatif, sous `isolation: isolate`)
interceptaient les clics sur TOUS les boutons des 9 écrans migrés — reproduit
identiquement sur les 3 thèmes (Sombre, Clair, Photo), donc pas une
régression de ce lot mais un bug déjà présent depuis `fc6fc43`, jamais
détecté faute de test réel (gap ouvert la veille dans `GAPS_OUVERTS.md`).
Diagnostiqué avec `document.elementFromPoint` (script Playwright jetable) :
au point exact du bouton « Clair », l'élément résolu était le DIV
`.page.photo-page` lui-même, pas le bouton. Corrigé par `pointer-events:
none` sur les 2 pseudo-éléments — fix standard pour un calque décoratif
plein écran, qui ne doit jamais capter d'événement pointeur. Reconfirmé par
un 2e passage du même test, sans `force: true` cette fois : les 3 clics
natifs passent normalement.

**Vérifié en conditions RÉELLES** (compte `TestJoueur1`, Playwright
réinstallé temporairement en dev dependency puis retiré, script jetable
supprimé après usage — même patron que les sessions précédentes) : email du
compte récupéré via `supabase.auth.admin.getUserById` sans l'afficher en
clair (même précaution que la session du 04/08). Les 3 boutons de thème
cliqués un par un via formulaires natifs réels ; captures d'écran Profil +
Accueil pour chacun : Sombre et Clair affichent des cartes SOLIDES
lisibles, Photo réaffiche le rendu existant (image + verre flouté) et fait
apparaître le sous-sélecteur, changement de photo (HOOP) pendant que Photo
est actif confirmé fonctionnel. Compte de test restauré à son état
d'origine après coup (`theme_preference: DARK`, `background_theme: MURAL`).

**Incident, sans lien avec le code** : une commande de diagnostic a affiché
un `VERCEL_OIDC_TOKEN` en clair dans le terminal (filtre `grep` incomplet,
ne couvrait pas "TOKEN"). Signalé immédiatement à l'utilisateur. Risque jugé
faible (token Vercel CLI de courte durée, 12h entre `iat` et `exp` du JWT,
pas une clé longue durée) — pas la même famille que les incidents
précédents sur des clés Supabase/mots de passe.

`tsc --noEmit`, `eslint`, `vitest run` (37/37), `next build` (36 routes,
aucun conflit) tous propres, revérifiés après le correctif pointer-events.

Pas encore committé. Documenté ici et dans `ETAT_ACTUEL.md` §2.58.

PAS committé ni déployé à ce stade (à confirmer avec l'utilisateur).

## Badges permanents — cadrage complet + code phase 1 (08-09/08/2026)

```text
3e et dernier chantier prioritaire du reclassement du 30/07/2026 (après
Bracket personnel et Tutoriel joueur), jusque-là non cadré. Ouvert par la
question directe de l'utilisateur en tout début de session du 08/08 :
« on va faire la liste complète de toutes les catégories qui peuvent
donner lieu à la création d'un badge ».

**Matière première** : l'utilisateur a fourni un tableur manuel pré-appli
(`Cadrage/DA/🏀 NBA Pronos - 22_04_2026 (réponses) (1).xlsx`, personnel,
non commité) — suivi manuel des pronos entre amis avant que l'appli
existe, avec une taxonomie de paris perso construite par classification
IA a posteriori et des recaps humoristiques par soirée ("Tableau
d'honneur"/"Salle des brancards"/"Zone Maïno"/"Bilan des points bonus").
Converti en CSV via un script Node jetable (paquet `xlsx` installé
temporairement dans le scratchpad, jamais dans le dépôt). Trouvaille
utile : le `bet_category` réel de l'app (9 valeurs, migration initiale)
recoupe quasi mot pour mot cette taxonomie — les badges par catégorie de
pari sont donc calculables sur de la vraie donnée structurée, pas une
reconstruction a posteriori.

**Cadrage fonctionnel, par étapes successives avec l'utilisateur** :
1. Inventaire EXHAUSTIF des axes (pas encore les noms) — 6 catégories (I.
   Pronostics de match, II. Bracket personnel, III. Paris perso, IV.
   Classement global, V. Fidélité/régularité, VI. Ligues), repris/ajusté
   par l'utilisateur point par point (ajouts : volume de matchs
   pronostiqués, volume de scores de série exacts ; clarification écart
   proche vs exact).
2. Axe "fan de tel joueur" proposé par l'utilisateur en cours de séance —
   écarté après avoir signalé qu'aucun référentiel joueurs NBA n'existe
   dans le schéma (contrairement à `teams`, synchronisée) : nécessiterait
   un chantier structurel à part (référentiel + formulaire de pari
   retouché), reporté à plus tard.
3. Question "badge réversible ou permanent" tranchée AVANT les paliers,
   à la demande de l'utilisateur : tous les badges restent acquis pour
   toujours (aucune régression), y compris les 2 axes streak (bons
   vainqueurs d'affilée, participation sans absence), dont le palier se
   base sur le RECORD personnel jamais atteint. Choisi pour un mécanisme
   unique et pour rester cohérent avec le ton bienveillant du tableur
   (personne ne se fait reprendre un trophée déjà gagné). Nuance ajoutée
   par l'utilisateur : la série EN COURS doit quand même s'afficher
   quelque part si elle égale/dépasse le record — détail d'affichage
   resté ouvert.
4. Paliers Bronze/Argent/Or/Platine/Diamant proposés par Claude (grille
   générique ×2.5/×2/×2/×1.7) puis chiffrés axe par axe, validés en bloc
   (« tout est bon pour moi pour le moment »). Badge Grimpeur (progression
   de rang) mis de côté par l'utilisateur après avoir buté sur comment
   l'ajuster à la taille variable du groupe — mécanisme en % du
   classement traversé proposé et noté pour une reprise future, jamais
   codé.
5. Noms des badges : demande explicite de l'utilisateur de d'abord finir
   l'inventaire des catégories avant de nommer quoi que ce soit («on ne
   va pas tout de suite donner des noms aux badges »). Une fois les
   paliers validés, 1er jet de noms proposé par Claude (ton "Tableau
   d'honneur"), repris et ajusté par l'utilisateur badge par badge
   (simplification en un seul mot la plupart du temps — Chirurgien,
   Horloger, Duelliste, Maïno (hommage direct au joueur du tableur)...).
   Axe "scope MATCH vs SERIES des paris perso" retiré à ce stade — pas
   assez parlant pour l'utilisateur une fois expliqué, aucun nom ne
   convenait.

**Spec dédiée écrite** (`Cadrage/V1/Spec visuelle/SPEC_BADGES_PERMANENTS
_V0_1.md`, même patron que le Tutoriel joueur ou Bracket personnel en
leur temps) plutôt que de laisser le cadrage éparpillé dans
`GAPS_OUVERTS.md`, qui grossissait trop pour son rôle de "points
ouverts". Catalogue complet ~30 badges, principe de permanence, axes
écartés/reportés, fichiers prévus pour le code. Committé/poussé
(`08aa817` doc suivi, `fa48beb` spec).

**Cadrage technique (mode Plan, 08/08/2026 suite)** : 2 agents Explore en
parallèle (câblage de l'onglet Stats/placeholder Badges ; schéma exact
nécessaire aux vues d'agrégation à vie) puis 1 agent Plan pour concevoir
l'implémentation. 3 questions structurantes tranchées AVEC l'utilisateur
avant le plan final (`AskUserQuestion`) : Sans-faute = vainqueurs de
série du tour uniquement (pas les 3 composantes) ; statuts "posé/tenté" =
tout sauf DRAFT et CANCELLED, précision de l'utilisateur au passage — un
DRAFT auto-validé à la deadline doit quand même compter (déjà couvert
par la lecture du statut ACTUEL, pas de logique supplémentaire
nécessaire). Plan approuvé (`ExitPlanMode`) : vue SQL en lecture pure
(`user_badges_lifetime`, même patron non matérialisé que `user_scores`,
scopée user_id seul au lieu de competition_id), seuils en constantes
TypeScript, découpage en 3 phases (25 badges non-streak d'abord — 1er
usage de gaps-and-islands SQL dans ce dépôt jamais tenté avant, reporté
aux 2 badges streak calculables sans ambiguïté ; Fidèle isolé en phase 3
distincte, sa définition du "sans absence combiné" restant un problème de
design produit non résolu, signalé par la spec elle-même).

**Code — phase 1 (09/08/2026)** : migration #25
(`20260809090000_badges_lifetime_view.sql`), `lib/badges/thresholds.ts`,
`lib/badges/labels.ts`, `lib/queries/badges.ts` (`getProfileBadges`,
sans paramètre de scope ligue — aucune comparaison entre joueurs sur un
accomplissement personnel), `components/profile/BadgesSection.tsx`/
`BadgeCard.tsx` (+ CSS, réutilise `ProgressBar` existant). **Correctif
structurel trouvé en lisant `page.tsx` avant de coder** (pas un bug
préexistant signalé par l'utilisateur, repéré par Claude pendant
l'exploration) : le placeholder Badges était niché à l'intérieur de la
branche `!stats.hasActiveCompetition`, ce qui aurait fait disparaître
l'onglet Badges hors saison — contradiction avec le principe même de
badges PERMANENTS. Sorti en section sœur avant même d'écrire le premier
composant.

**Vérifié en conditions RÉELLES** : vue vérifiée par script jetable
service_role (décompte manuel `match_correct_winners` comparé à la vue
sur les 6 comptes actifs, tous concordants). Rendu vérifié au clic
(Playwright réinstallé temporairement en dev dependency, retiré après
usage, même patron que les sessions précédentes) : compte `TestJoueur1`,
6 catégories affichées, valeurs cohérentes avec la vue, aucune erreur
console. **Incident mineur sans lien avec les données réelles** : le mot
de passe connu de `TestJoueur1` (posé lors du tutoriel joueur, §2.51 de
l'époque) ne fonctionnait plus — réinitialisé via l'API Admin
(`auth.admin.updateUserById`) plutôt que redemandé à l'utilisateur en
chat, compte de test jetable sans conséquence.

`tsc --noEmit`, `eslint`, `vitest run` (37/37), `next build` (36 routes)
tous propres. Committé et poussé (`2a76d8c`).

**Reste à faire** : phase 2 (Métronome, Pilier) ; phase 3 (Fidèle,
définition encore ouverte) ; rendu visuel par palier (couleurs/bandes
selon Bronze→Diamant — demandé par l'utilisateur juste après ce lot,
chantier suivant).
```

## Badges permanents — couleurs par palier (09/08/2026, suite immédiate)

```text
Demandé par l'utilisateur juste après la phase 1 : que la carte change de
couleur (ou de bandes) selon le palier Bronze/Argent/Or/Platine/Diamant
où en est le badge, plutôt que le rendu neutre livré en phase 1.

5 tokens sémantiques ajoutés à `app/tokens.css` (`--color-tier-bronze/
argent/or/platine/diamant`, dark ET clair, même patron d'assombrissement/
saturation que `--color-accent`/`--color-champion` déjà en place) — Or
réutilise `--color-champion`, Diamant réutilise `--c-blue-300`, tous deux
déjà existants dans la palette, seuls Bronze et Platine sont de nouveaux
tons de raw palette (`--c-bronze-*`, `--c-platinum-*`). `BadgeCard` porte
un attribut `data-tier` (le palier atteint, absent si aucun palier) lu en
CSS pur : bande de gauche 3px + fond légèrement teinté (`color-mix`,
même patron que `--color-accent-soft`) + libellé de palier coloré, en
plus du style `.unlocked`/`.locked` générique déjà en place (toujours le
seul repli pour les badges binaires/ladderStep sans palier).

Vérifié au clic (Playwright réinstallé temporairement, retiré après
usage) : compte `TestJoueur1`, carte Vétéran (seul badge Bronze de ce
compte à ce jour) affiche bien la bande/teinte cuivrée attendue, aucune
erreur console. `tsc`/`eslint`/`vitest` (37/37)/`next build` (36 routes)
propres. Committé et poussé (`59570e6`).

**Icônes/visuels dédiés par badge évoqués par l'utilisateur dans la
foulée, REPORTÉS explicitement** : aucun asset graphique par badge
n'existe à ce jour (contrairement aux logos d'équipe déjà en place) — à
reprendre une fois les visuels fournis, pas avant.
```

## Badges permanents — phase 2 : Métronome + Pilier (09/08/2026, suite)

```text
L'utilisateur relance la séance en demandant un rappel de ce que
recouvraient les phases 2 et 3 (question directe, pas de mémoire
implicite supposée). Claude recommande d'attaquer la phase 2 seule
(Métronome/Pilier techniquement prêts) plutôt que de tout regrouper avec
Fidèle (question produit non tranchée) — recommandation suivie sans
discussion. Au lancement, l'utilisateur ajoute une demande distincte :
noter (pas coder) une interaction "carte retournée au clic" pour afficher
la description au dos du badge — ajoutée à `GAPS_OUVERTS.md`/
`ETAT_ACTUEL.md`, non cadrée en détail, même famille que les icônes.

**Migration #26** (`20260809100000_badges_streaks_view.sql`) : vue
`user_competition_streaks`, grain `(user_id, competition_id)` — 1er
usage de gaps-and-islands SQL dans ce dépôt (confirmé par grep : aucune
migration précédente n'utilise `row_number()`/`partition by`). Métronome
: technique gaps-and-islands classique sur les pronostics figés, ordonnés
par `matches.scheduled_at`. Pilier : plus dur, une absence est un match
du calendrier SANS pronostic figé — il faut donc croiser TOUS les matchs
éligibles de la compétition (`matches`) avec chaque joueur ayant
participé, pas seulement grouper les lignes `match_predictions`
existantes.

**Point flagué à l'utilisateur avant de pousser (AskUserQuestion
implicite en texte, pas l'outil)** : quels matchs comptent comme
"exigibles" pour Pilier ? Proposé et confirmé sans changement : coup
d'envoi déjà passé (un match futur n'est pas encore une absence) et ni
CANCELLED ni POSTPONED (même neutralisation que le moteur de scoring,
`lib/scoring/engine.ts` §5 — personne n'est pénalisé pour un match
annulé). Migration poussée après confirmation explicite.

Le RECORD à vie affiché par le badge (max de toutes les compétitions
jamais jouées) reste réduit côté TypeScript (`lib/queries/badges.ts`),
pas en SQL — choix déjà acté pendant le cadrage technique du 08/08,
plus simple sur ce 1er usage de la technique. `lib/badges/thresholds.ts`
/`labels.ts` étendus (Métronome/Pilier rejoignent la catégorie I).

**Vérifié en conditions RÉELLES** : script jetable service_role
recalculant le gaps-and-islands en JS pur, comparé à la vue sur les 9
lignes (joueur, compétition) existantes en base — toutes concordantes
pour Métronome. Vérification manuelle dédiée pour Pilier (plus complexe,
croisement de calendrier) sur `TestJoueur1` : `pilier_streak = 3`
confirmé à la main sur 8 matchs éligibles pour sa compétition. Rendu
vérifié au clic (Playwright temporaire, retiré après usage) : Métronome
affiche Bronze (3/5, bande colorée comme les autres badges à palier),
Pilier sans palier (3/5, sous le seuil Bronze) — comportement attendu,
aucune erreur console. `tsc --noEmit`, `eslint`, `vitest run` (37/37),
`next build` (36 routes) tous propres. Committé et poussé (`ec97ef3`).

**Reste à faire** : phase 3 (Fidèle — définition du "sans absence
combiné" pronos+paris toujours pas tranchée) ; icônes/visuels par badge
et interaction "carte retournée" (notées, en attente d'assets/de
cadrage, pas bloquantes).
```

## Badges permanents — phase 3 : Fidèle, catalogue de base complet (09/08/2026, suite)

```text
L'utilisateur demande si on laisse la phase 3 de côté ou si on l'attaque
maintenant. Claude recommande de l'attaquer tout de suite MAIS en
commençant par la définition (pas le code) — le seul vrai blocage,
d'autant que la technique gaps-and-islands est encore fraîche depuis
Pilier. Recommandation suivie.

**Définition proposée par Claude et affinée par l'utilisateur.** 1re
proposition (rejetée) : un pari SÉRIE compterait comme "présent" pour
TOUS les matchs de sa série (pas seulement celui auquel il est
techniquement rattaché), pour éviter de vérifier finement le timing entre
pari et match. **Corrigée par l'utilisateur** : « il faut que le pari
perso soit rattaché au match en question sinon c'est trop facile » — un
pari SÉRIE ne compte JAMAIS, seul un pari MATCH rattaché au match précis
compte, au même titre qu'un pronostic figé sur ce match (règle d'UNION,
option retenue dès le message précédent parmi 2 proposées : union
simple vs deux streaks séparées qui se combinent).

**Migration #27** (`20260809110000_badges_fidele_streak.sql`) :
redéfinition COMPLÈTE de `user_competition_streaks` (`create or replace
view`, même geste non destructif que la migration #5 sur `user_scores`)
avec une colonne `fidele_streak` en plus. Réutilise intégralement le
calendrier `user_match_grid` déjà construit pour Pilier (matchs éligibles
× joueurs participants) — seul le critère de présence change (union
pronostic OU pari MATCH rattaché, au lieu de pronostic seul).

**Vérifié en conditions RÉELLES** : plutôt qu'un décompte manuel complet
(déjà fait 2 fois pour Métronome/Pilier), un invariant logique plus
rapide à vérifier — `fidele_streak >= pilier_streak` doit être vrai sur
CHAQUE ligne, puisque le critère de présence de Fidèle est un
sur-ensemble strict de celui de Pilier (ne peut donc jamais produire une
streak plus courte). Confirmé sur les 9 lignes (joueur, compétition)
existantes en base, script jetable service_role. Rendu vérifié au clic
(Playwright temporaire, retiré après usage) : catégorie "Fidélité /
régularité" désormais complète (Fidèle, Vétéran, Doyen) sur
`TestJoueur1`, aucune erreur console. `tsc --noEmit`, `eslint`, `vitest
run` (37/37), `next build` (36 routes) tous propres. Committé et poussé
(`ae6569c`).

**Le catalogue de base des badges permanents (~30 badges, spec
`SPEC_BADGES_PERMANENTS_V0_1.md`) est désormais ENTIÈREMENT codé, vérifié
et déployé.** Seul le badge Grimpeur (progression de rang) reste hors
périmètre, écarté par choix explicite dès le cadrage du 08/08/2026. Restent
en attente, non bloquantes : icônes/visuels dédiés par badge (assets pas
fournis) et interaction "carte retournée" au clic (idée notée, pas
cadrée).
```

## Badges permanents — interaction "carte retournée" au clic (10/08/2026)

```text
Reprise de la note laissée en suspens le 09/08/2026. L'utilisateur
confirme vouloir traiter ce point maintenant, en laissant le reste
(icônes/visuels, Grimpeur) pour plus tard.

Les 2 questions restées ouvertes lors de la note initiale (déclencheur
clic/tap seul ou aussi survol desktop ; tous les badges ou seulement les
`tiered`) sont tranchées par défaut sans repasser par l'utilisateur, choix
jugés suffisamment mineurs pour ne pas justifier une pause : clic/tap
uniquement (cohérent avec une appli mobile-first, le survol n'existe pas
sur tactile) et TOUS les badges de façon uniforme (la description était
déjà visible en permanence sur les 3 formes — tiered/binary/ladderStep —
la retirer sélectivement aurait cassé la cohérence visuelle de la
grille).

**Conséquence architecturale** : `BadgeCard` passe de composant serveur à
`"use client"` — première fois que ce module sort de ce patron, mais
cohérent avec les autres composants réellement interactifs du dépôt
(`LoginForm`, `NotificationSettings`, etc.). État local `isFlipped`
(`useState`), racine `<button>` plutôt qu'un `<div onClick>` pour rester
accessible au clavier (`aria-pressed` reflète l'état, `aria-hidden`
bascule sur la face actuellement non visible).

**CSS** : nouveau token `--motion-flip-duration` (`app/tokens.css`, 400ms
par défaut, 0ms sous `prefers-reduced-motion` — même patron que
`--motion-flash-duration`/`--motion-pulse-duration` déjà en place, R-MOT1/
R-MOT2). Flip 3D classique (`perspective`, `transform-style: preserve-3d`,
`rotateY(180deg)`, `backface-visibility: hidden`) — les 2 faces occupent
la même zone en position absolue, `.flipContainer` porte un `min-height`
fixe pour éviter que le conteneur ne s'effondre (les enfants absolus ne
contribuent pas à la hauteur du parent). Réutilise intégralement les
styles `.card`/`.locked`/`.unlocked`/`[data-tier=...]` déjà en place —
chaque face est aussi une `.card`, rien de dupliqué côté palette.

**Vérifié en conditions réelles** (Playwright temporaire, retiré après
usage) : `aria-pressed` bascule correctement à 3 clics successifs
(false→true→false), le dos affiche la bonne description après le 1er
clic (vérifié sur le badge Chirurgien), aucune erreur console. Capture
d'écran confirmant visuellement le contenu de chaque face. `tsc --noEmit`,
`eslint`, `vitest run` (37/37), `next build` (36 routes) tous propres.
Committé et poussé (`ee820d7`).

Avec ce lot, il ne reste plus que 2 points volontairement hors périmètre
sur le chantier badges : le badge Grimpeur et les icônes/visuels dédiés
par badge (en attente d'assets non encore fournis).
```

## Badges permanents — astuce de découverte du clic (10/08/2026, suite)

```text
Demande directe de l'utilisateur juste après le lot précédent : la
nouvelle interaction carte retournée n'a aucun indice visuel — rien ne
signale qu'une carte est cliquable. Ajout d'une ligne « Astuce : clique
sur une carte pour voir sa description. » sous le titre Badges
(`BadgesSection.tsx`), au-dessus de toutes les catégories, même registre
que les autres textes discrets du module (`.chartCaption` de
`page.module.css` réutilisé comme référence de style, pas littéralement
partagé). Vérifié au clic (Playwright temporaire) : astuce visible au bon
endroit, aucune erreur console. `tsc`/`eslint`/`vitest`/`next build`
propres. Committé et poussé (`a209f22`).
```

## Badges permanents — icônes par badge, chantier clos (10/08/2026, suite)

```text
L'utilisateur relance : « on va commencer à créer des logos. comment
faire ? ». Avant de se lancer, Claude vérifie comment les autres assets
visuels du projet ont été intégrés (`public/logos/teams/README.md`,
`public/brand/README.md`) : dans les deux cas (logos d'équipe, photos de
fond), la source vient de l'utilisateur (licence/possession pour les
logos, Unsplash fourni via zip pour les photos), Claude ne fait que
l'intégration technique. Mais les icônes de badges sont un cas différent
— du contenu ORIGINAL à l'appli, sans contrainte de licence de marque —
donc 3 chemins possibles proposés à l'utilisateur (`AskUserQuestion`) :
dessin SVG sur-mesure par Claude, sourcing externe par l'utilisateur
(même patron que les photos), ou bibliothèque d'icônes sous licence.
**Choix : bibliothèque sous licence.**

`lucide-react` (ISC) retenue et installée comme dépendance de PRODUCTION
(contrairement à Playwright, réinstallé/retiré à chaque vérification —
lucide-react reste dans le bundle final). `lib/badges/icons.tsx` : un
mapping direct `BadgeId -> icône`, choisi pour coller au concept de
chaque badge autant que possible (ex. Chirurgien -> `Crosshair`, Horloger
-> `Clock`, Duelliste -> `Swords`, Collectionneur -> `Gem`) — aucune
icône répétée sur les 36 badges. Trouvaille pendant la construction du
mapping : l'échelle de difficulté Prudent -> Fou furieux (5 badges) colle
naturellement aux faces de dé `Dice1` -> `Dice5` déjà présentes dans la
lib, correspondance littérale avec le niveau 1 à 5 plutôt qu'un choix
arbitraire.

Intégration dans `BadgeCard.tsx` : icône affichée à côté du libellé, sur
les 2 faces (avant/arrière) de la carte retournable — colorée avec les
mêmes tokens `--color-tier-*` que la bande/le fond déjà en place, aucun
nouveau token nécessaire.

**Vérification de choix pragmatique** : plutôt que de vérifier chaque nom
d'icône un par un contre la doc lucide (36 imports nommés), Claude a
choisi les 36 noms sur sa connaissance de la lib et laissé `tsc --noEmit`
faire office de garde-fou immédiat — un import nommé inexistant aurait
échoué à la compilation. Les 36 noms se sont révélés corrects du premier
coup, aucune correction nécessaire.

**Vérifié en conditions RÉELLES** (Playwright temporaire, retiré après
usage) : 72 `<svg>` comptés sur la page (36 badges × 2 faces), capture
d'écran confirmant un rendu visuel cohérent avec le design minimaliste
existant, aucune erreur console. `tsc --noEmit`, `eslint`, `vitest run`
(37/37), `next build` (36 routes) tous propres. Committé et poussé
(`8834596`).

**Avec ce lot, le chantier badges permanents est ENTIÈREMENT CLOS** :
spec, 3 phases de code, couleurs par palier, carte retournée, astuce,
icônes — tout est fait, vérifié et déployé. Seul le badge Grimpeur
(progression de rang) reste hors périmètre, écarté par choix explicite
dès le cadrage du 08/08/2026.
```

## Badges permanents — icône agrandie et réordonnée (10/08/2026, suite)

```text
L'utilisateur signale, juste après la clôture du chantier, une
information nouvelle qui change la priorité visuelle de la carte : ces
icônes serviront un jour à afficher les badges dans le bandeau du profil
de chaque joueur (idée mentionnée en passant, pas une demande de
construire cet affichage maintenant). Conséquence directe demandée :
l'icône doit devenir « l'info principale » de la carte plutôt qu'une
petite décoration à côté du texte.

2 ajustements successifs, chacun vérifié séparément (Playwright
temporaire) :
1. Icône agrandie de 1rem à 1.75rem, empilée verticalement avec le
   libellé (au lieu d'une ligne icône+texte côte à côte) — `min-height`
   de `.flipContainer` ajustée en conséquence (7.5rem → 8.5rem) pour
   éviter que le contenu ne déborde. Committé (`e65808d`).
2. Ordre inversé sur demande explicite : titre AU-DESSUS, icône EN
   DESSOUS (l'inverse de ce que Claude avait posé par défaut à l'étape
   précédente) — simple échange de 2 lignes JSX dans `BadgeCard.tsx`, le
   CSS `flex-direction: column` déjà en place s'occupe du reste. Committé
   (`d5e18fe`).

**Piste future notée dans `GAPS_OUVERTS.md`/`ETAT_ACTUEL.md`, PAS
cadrée** : afficher une sélection de badges dans le bandeau du profil
joueur. Rien de plus précisé par l'utilisateur à ce stade — combien de
badges, quel critère de sélection parmi les 36, emplacement exact dans
`app/(app)/profile/page.tsx` restent à trancher le jour où ce chantier
sera repris.

`tsc`/`eslint`/`vitest` (37/37)/`next build` propres aux 2 étapes.
```

## Badges permanents — remplacement des icônes stopgap par des visuels IA (10/08/2026, suite) : EN COURS, MIS EN PAUSE

```text
Aucun code applicatif touché dans cette entrée — travail entièrement
côté `Cadrage/DA/` et `Cadrage/V1/Spec visuelle/`, en dehors du dépôt
pour la génération elle-même (outils IA externes).

Point de départ : `Cadrage/DA/BADGES.pdf` (tableau fourni par
l'utilisateur, nom actuel/nom souhaité/description souhaitée/idée de
visuel). Clarifié avec l'utilisateur qu'une cellule vide en "nom souhaité"
ou "description souhaitée" signifie "garde la valeur actuelle", pas
"reste à définir" — mauvaise lecture initiale corrigée.

**Comptage des badges réconcilié à 35** (pas 36, pas 25) : le PDF liste 36
lignes, mais Pilier et Fidèle ont été fusionnés en un seul badge nommé
Fidèle (migration `20260810090000_badges_merge_pilier_into_fidele.sql`,
déjà faite plus tôt dans la journée) — 36 - 1 = 35.

**Comparatif de styles d'illustration** : artifact HTML créé (rendu
canvas de 7 styles — flat, glossy, blason/varsity, sticker, néon, jeton
3D, pixel — appliqués à Buzzer-beater et Victorieux), affiné une fois sur
demande explicite de rendu "plus réaliste" (ombres portées, anses de
trophée fermées, chiffres façon afficheur 7 segments, etc.). Classement
de l'utilisateur : Blason Varsity > Flat minimaliste > Glossy trophée.

**Catégorisation en 3 groupes actée** (confirmée par l'utilisateur, axe
"prestige" plutôt que les 6 catégories fonctionnelles officielles de
`lib/badges/labels.ts`) :
- Groupe A, Glossy trophée (3) : Pronos Master, Bracket Master, Paris
  Persos Master.
- Groupe B, Blason Varsity (9) : Métronome, Fidèle, Sans-faute,
  Visionnaire, Avant-gardiste, Victorieux (série), Buzzer-beater (série),
  Vétéran, Doyen.
- Groupe C, Flat minimaliste (23) : le reste.
Recoupé avec les vraies mécaniques (`SPEC_BADGES_PERMANENTS_V0_1.md`,
`lib/badges/thresholds.ts`) une fois découvertes en cours de route (voir
plus bas) — aucun badge n'a eu besoin de changer de groupe.

**Contrainte technique déjà actée retrouvée en cours de route** (pas
créée cette session, déjà dans `PROMPTS_BADGES_ICONES.md` avant cette
entrée) : icônes en PNG figé, linework clair neutre, palier géré par la
carte CSS, PAS par l'image — reconfirmé explicitement avec l'utilisateur
(1 image par badge, pas 5 par palier) plutôt que de partir sur un chantier
5x plus gros.

**`PROMPTS_BADGES_ICONES.md` mis à jour** avec 3 familles de composition
(l'add-on Blason/Glossy vient s'ajouter au même bloc de style de base, la
famille Flat reste sans ajout) ; tableaux I-VI retaggés par groupe ;
6 "Subject" réécrits car le jeu de mots reposait sur l'ANCIEN nom du badge
(Victorieux, Money-time, Avant-gardiste, Victorieux (série), Pronos
Master, Paris Persos Master — ce dernier duo aussi aligné en forme de
coupe pour rejoindre Bracket Master dans le groupe Glossy). Deux points
flagués sans être tranchés : Victorieux a déjà un rendu Blason validé
alors qu'il tombe en groupe Flat par mécanique (gardé en exception
documentée) ; un commentaire dans `lib/badges/icons.tsx` mentionne un
nouveau concept pour Casse-cou/Kamikaze/Fou furieux non repris dans ce
fichier de prompts.

**Nouveau fichier créé** : `PROMPTS_BADGES_GEMINI_PRETS.md` — les 35
prompts entièrement compilés (bloc de style + add-on de groupe + Subject),
prêts à copier-coller un par un, avec case à cocher par badge. Fichier
dérivé, pas la source de vérité (`PROMPTS_BADGES_ICONES.md` reste la
référence si un Subject change).

**Essai de génération** : Recraft essayé en premier (style personnalisé
figé depuis une génération raster) — jugé "pas assez précis/net/joli" par
l'utilisateur. Bascule sur **Gemini (Nano Banana)** avec les mêmes
prompts texte : nettement mieux sur les 2 premiers pilotes (Métronome,
Victorieux avec cadre Blason) — confirmé par l'utilisateur. Défaut trouvé
sur le 3e pilote (Bracket Master, groupe Glossy) : rendu en silhouette
pleine au lieu d'un contour — correctif ajouté au bloc de style commun
("pure stroke-based outline art, do not render as a solid filled
silhouette") + rappel redondant dans le Subject des 3 badges Glossy.

**Décision explicite de l'utilisateur : mise en pause du chantier ici**
("trop complexe pour le moment"), après 3/35 badges pilotés (Métronome
généré et validé ; Victorieux généré avec cadre Blason, validé plus tôt ;
Bracket Master généré mais à refaire — silhouette pleine). Scout, groupe
Flat sans cadre, jamais généré — le pilote sur les 3 groupes de
composition n'est donc pas complet. Aucune régénération faite après le
correctif "outline only". Reprise à date non fixée.
```

## Rattrapage de suivi : reprise après la pause du 10/08/2026, migration #28 poussée (13/08/2026)

```text
L'utilisateur redémarre simplement par « Tu peux retourner dans le projet
NBA pronos ? ». `git status` révèle que le dernier bloc de travail de la
session du 10/08/2026 (suite) n'avait jamais été committé ni poussé :
fusion Pilier -> Fidèle (migration #28 + `lib/badges/*` + `lib/queries/
badges.ts`), renommages de badges (Chirurgien -> Victorieux, Horloger ->
Buzzer-beater, Œil de lynx -> Money-time, Complétiste -> Avant-gardiste,
etc.), puces couleur d'équipe + logo en filigrane sur `MatchRow` (écran
Matchs), et `RevealPanel` redescendu en bas de carte dans
`PredictionForm`. Signalé explicitement à l'utilisateur avant d'agir
(3 options proposées : committer/pousser directement, revérifier au clic
d'abord, ou reprendre plutôt le chantier des visuels IA en pause) —
**choix : committer et pousser directement.**

`tsc --noEmit`, `eslint`, `vitest run` (37/37), `next build` (36 routes)
revérifiés propres sur l'état non commité AVANT tout push.

**Bug réel trouvé en poussant la migration #28** : `npx supabase db push`
échoue (`SQLSTATE 42P16 — cannot drop columns from view`). Le commentaire
de la migration affirmait à tort suivre "le même geste non destructif que
#26/#27" — mais ces 2 précédentes ne faisaient qu'AJOUTER des colonnes,
alors que #28 RETIRE `pilier_streak`, ce que Postgres refuse via
`CREATE OR REPLACE VIEW`. Corrigé en `DROP VIEW IF EXISTS` puis
`CREATE VIEW` (grep des migrations : aucune autre vue/fonction ne dépend
de `user_competition_streaks`, sans risque). Repoussée avec succès,
`npx supabase migration list` confirme `local`/`remote` synchronisés sur
`20260810090000`. `vitest run` revérifié propre après le push (37/37).
```

## Rattrapage de suivi : 9 commits des 14-15/08/2026 jamais documentés (16/08/2026)

```text
L'utilisateur demande simplement « où en est-on dans le projet nba-pronos ? ».
`git log` recoupé avec `ETAT_ACTUEL.md`/`GAPS_OUVERTS.md` révèle 9 commits
postérieurs à la dernière mise à jour connue (13/08/2026, `9ed078e`),
committés ET poussés (`git status` propre), mais absents des 3 fichiers de
suivi — même pattern que le rattrapage du 06/08/2026.

**Signalé explicitement à l'utilisateur avant d'agir** : 7 des 9 commits
n'ont pas la mention `Co-Authored-By: Claude Sonnet 5` (seuls `a5c618e` et
`82952a4`, tous deux du 14/08 après-midi, l'ont). Question posée par
`AskUserQuestion` (3 options : codé directement par l'utilisateur / fait via
Claude Code mais mention perdue / mélange des deux) — **réponse : fait via
Claude Code, la mention a juste sauté**. Cette réponse conditionne le niveau
de détail écrit dans `ETAT_ACTUEL.md` (mêmes formulations "committé et
poussé" que les autres entrées, plutôt qu'un simple constat de fait sans
attribution).

Contenu des 9 commits (détail complet dans `ETAT_ACTUEL.md` §2.60→§2.63,
pas répété ici) :
- 14/08 après-midi : script de simulation de playoffs (10 bots) + refonte du
  Bracket Playoffs en 2 colonnes Ouest/Est avec score en direct sur les
  séries en cours (`a5c618e`, `82952a4`).
- 14/08 nuit : refonte du tri du Classement — en-têtes cliquables avec
  bascule croissant/décroissant, tendance de rang, top 3 (`c55e170`).
- 15/08 : bandeau du Classement enrichi (ratio paris/difficulté, accordéon,
  zébrage) puis refonte de la création de paris — déplacée depuis "Mes
  paris" vers Matchs/Bracket, "Mes paris" devenant un écran de consultation
  seule ; écran Nouveau pari masquant les options indisponibles (`b173f75`,
  `8765d60`, `c7fa6ac`).
- 15/08 soir : bandeau `.hero-banner` — retrait de la photo de fond puis
  réalignement sur le style carte-verre theme-aware, y compris en thème
  Photo (`51bdb37`, `e2c63ef`).

**Contrairement aux rattrapages du 06/08 et du 13/08**, aucune trace de
session en temps réel n'existe pour ces 9 commits (pas d'entrée journal
correspondante avant celle-ci) : le détail ajouté à `ETAT_ACTUEL.md` est
reconstruit depuis les commentaires de code et les messages de commit
(souvent déjà assez précis — dates, décisions, bugs trouvés y sont notés en
ligne), PAS depuis une méthodologie de session confirmée. Explicitement
signalé dans chaque entrée ajoutée.

`tsc --noEmit`, `eslint` (4 warnings de variables inutilisées dans le
nouveau `scripts/seed-playoffs-simulation.mjs`, script jetable hors app),
`vitest run` (37/37), `next build` (36 routes) tous revérifiés propres sur
l'état ACTUEL du dépôt à cette occasion.
```

## Audit UX + code : parcours réel + revue multi-agents (16/08/2026)

```text
Demande de l'utilisateur : « comment auditer entièrement l'appli » puis
précisé « une mise à l'épreuve face à un potentiel joueur », comparer à des
applis de pronostics/bracket entre amis existantes. Détail complet dans
`AUDIT_UX_16_08_2026.md` (nouveau fichier dédié, pas fondu dans
`ETAT_ACTUEL.md` — nature ponctuelle, pas un instantané d'état).

**Revue de code** (`/code-review`, 9 commits du 14-15/08) : 6 angles en
parallèle (correctness x3, réutilisation, efficacité, altitude/
conventions). Trouvaille la plus solide : désync `isLive`/`isDecided` sur
le Bracket (Realtime vs instantané SSR), trouvée indépendamment par 2
agents.

**Parcours au clic** — bloqué longtemps sur la création d'un compte de test
100% neuf : le mot de passe de `TestJoueur1` était perdu et ce compte n'a
pas de vraie boîte mail (email de test), donc aucune réinitialisation
possible. Basculé sur une inscription publique fraîche
(`/signup`), qui a buté sur le quota d'emails FIXE de Supabase (2/h,
service intégré) — contournement en configurant un SMTP Resend en direct
avec l'utilisateur (2 bugs de config trouvés et corrigés en route : username
`Resend` au lieu de `resend`, port `465` au lieu de `587`). Clé API Resend
collée en clair dans le chat à 2 reprises pendant le dépannage — signalé,
régénération prévue par l'utilisateur après l'audit.

**Bug réel trouvé en marge** : une inscription sur un email déjà pris
échouait en silence (protection anti-énumération de Supabase, aucune
erreur renvoyée) — repéré en re-testant avec le vrai email de l'utilisateur
après une 1re "inscription" qui semblait réussir à tort. Confirmé avec
l'utilisateur qu'aucun doublon de compte n'était réellement créé (contrainte
unique Postgres intacte), seul le message d'erreur manquait. **Corrigé,
vérifié en conditions réelles, committé et poussé** (`1f4847a`).

Parcours terminé avec le vrai compte de l'utilisateur (`Rillettes-31`,
identifiants donnés en séance) en lecture seule — aucun clic sur un bouton
de soumission de pronostic/pari réel. Bug distinct trouvé en marge : erreur
d'hydratation React sur Profil (`NotificationSettings`), pas creusée
(hors périmètre des 9 commits).

**Comparaison concurrentielle** (recherche web) : HoopCall, Scorecast,
ParidAmis identifiés comme concurrents directs (pronostics NBA/multi-sport
entre amis). nba-pronos nettement en avance sur les badges et le support de
bracket ; en retard sur le chat intégré (Scorecast), les boosters
(ParidAmis) et le format duel hebdomadaire (HoopCall) — pistes notées, rien
de tranché.

Nettoyage : scripts Playwright jetables (`scripts/tmp-audit-*.mjs`)
supprimés en fin de session, jamais committés.
```

## Correctif : désync `isLive`/`isDecided` en direct sur le Bracket (16/08/2026)

```text
Reprise de session simple (« On reprend ? ») : l'utilisateur choisit de
traiter en premier le bug le plus solide de l'audit du même jour (2 agents
de revue de code l'avaient trouvé indépendamment), plutôt que la décision
SMTP ou la discussion produit de `AVIS_EXPERT_16_08_2026.md`.

**Cause racine** : `LiveSeriesSubscriber.tsx` (souscription Realtime sur
`series`, migration #14) ne suivait en direct QUE le vainqueur
(`official_winner_team_id`), jamais le statut (`official_status`) — ce
dernier restait l'instantané pris au chargement SSR. `NodeCard.tsx`
calculait `isLive = node.status === "IN_PROGRESS"` sur cet instantané figé,
et `SeriesDrillDown.tsx::renderColumn` groupait les cartes "en cours" vs
"repliées" de la même façon — donc une série qui passait EN_COURS ->
TERMINÉE pendant que la page Bracket était ouverte restait affichée "En
cours" avec un score figé indéfiniment (jusqu'au rechargement complet).

**Correctif** : le payload Realtime porte maintenant aussi
`official_status`. `LiveSeriesSubscriber` expose 3 hooks : les 2 existants
adaptés (`useLiveWinnerAbbreviation`) et un nouveau
(`useLiveSeriesStatus`, pour `NodeCard`), plus une Map brute
(`useLiveSeriesMap`, pour `SeriesDrillDown`/`RoundBanner`, où le statut est
lu dans un `.filter()` — un hook par itération y violerait les règles des
Hooks). **3 fichiers corrigés**, pas seulement les 2 repérés par l'audit :
en testant en conditions réelles, l'étiquette de la puce dans
`RoundBanner.tsx` (bandeau replié) affichait encore "à venir" pour une
série qui venait de basculer FINISHED — même défaut de fond (lecture de
`node.status`, l'instantané SSR, au lieu du statut live), trouvé en marge
et corrigé dans la foulée (même mécanisme, cohérent avec les 2 fichiers
déjà en cause).

**Limite assumée, signalée dans un commentaire de code** : le format de
score final (`official_score_format`) n'est PAS diffusé en direct (seuls
statut et vainqueur le sont) — une série qui vient de terminer affiche donc
"terminé" sans le score tant que la page n'est pas rechargée. Écart mineur,
cohérent avec `NodeCard` qui n'affichait déjà aucun score final en direct
avant ce correctif non plus ; pas traité pour rester dans le périmètre du
bug réellement trouvé par l'audit.

**Vérifié en conditions réelles, sans compte joueur** (mot de passe des
comptes bots de la simulation du 14/08 expiré/invalide, pas cherché à le
réinitialiser — `/bracket` est consultable par un visiteur non connecté,
suffisant pour ce test) : Playwright temporaire, page `/bracket` ouverte
sur la compétition "Playoffs NBA (simulation)" actuellement ACTIVE, une
série EN_COURS (MIL vs CHI, 1er tour Est) basculée en TERMINÉ via
`service_role` pendant que la page restait ouverte, capture d'écran
AVANT/APRÈS sans reload. Confirmé à l'écran : la carte MIL/CHI disparaît de
la colonne "en cours", rejoint le bandeau replié ("3 séries repliées" au
lieu de "2"), avec l'étiquette correcte "MIL vs CHI · terminé". État de la
série restauré à IN_PROGRESS juste après (compétition sandbox de
simulation, pas la compétition réelle — aucune donnée de vrai joueur
touchée). Script + captures jetables, supprimés en fin de session, jamais
commités.

`tsc --noEmit`, `eslint` (`components/bracket`), `vitest run` (37/37),
`next build` (36 routes) propres avant ET après le test en conditions
réelles.
```

## Correctif : bouton "Parier" trompeur sur série terminée (16/08/2026)

```text
Suite immédiate de la même session : SMTP explicitement laissé en pause par
l'utilisateur (« on laisse pour plus tard »), 2e point technique de l'audit
traité — le bouton "Parier" (`lib/queries/bracket.ts`).

**Cause** : `myBetAction` retombait sur `{ kind: "PROPOSE" }` par défaut dès
qu'aucun pari actif n'existait pour la série, sans jamais regarder
`official_status`. `BetForm.tsx::isSeriesSelectable` refusait déjà la série
une fois dans le formulaire (deadline = 1er match commencé), donc pas
exploitable pour de vrai — mais le bouton restait affiché sur la carte,
trompeur.

**Correctif** : `myBetAction` renvoie maintenant `null` d'emblée si
`official_status` est FINISHED, POSTPONED ou CANCELLED (nouvel ensemble
`NON_BETTABLE_SERIES_STATUSES`), avant même de regarder s'il existe un pari
actif — s'applique aussi bien au cas PROPOSE qu'au cas EDIT (un pari
DRAFT/SUBMITTED resté ouvert sur une série entre-temps terminée ne doit pas
non plus proposer "Modifier").

**Vérifié en conditions réelles** : mot de passe d'un compte bot de la
simulation du 14/08 réinitialisé via `service_role` (email de test, pas de
vraie boîte mail, aucun risque) pour se connecter réellement — Playwright
temporaire, `/play/bracket`, les 4 bandeaux "séries repliées" dépliés.
Confirmé à l'écran : les 3 séries terminées (OKC vs SAS 4-2, BOS vs MIA 4-1,
NYK vs ATL 4-2) n'affichent AUCUN bouton "Parier" ; les séries encore
ouvertes (à venir ou en cours, ex. LAL vs HOU, BOS vs NYK) l'affichent
toujours normalement — pas de régression sur le cas nominal.

`tsc --noEmit`, `eslint` (`lib/queries/bracket.ts`), `vitest run` (37/37),
`next build` (36 routes) propres avant ET après le test en conditions
réelles. Script + capture jetables, supprimés en fin de session.
```

## Correctifs : hydratation Profil + 4 points mineurs de l'audit (16/08/2026)

```text
Suite de la même session : l'utilisateur choisit de traiter l'erreur
d'hydratation ET les points mineurs de `AUDIT_UX_16_08_2026.md` §3 avant la
discussion produit à 4 questions. 6 correctifs indépendants.

**1. Hydratation `NotificationSettings` (Profil)** — cause : l'état
`deviceSubscribed` s'initialisait via `pushSupported() ? null : false`
DANS `useState`, une fonction qui lit `navigator`/`window` (absents côté
serveur -> toujours `false` en SSR, potentiellement `true` au 1er rendu
client si le navigateur supporte le Push) — 2 rendus initiaux divergents,
donc erreur d'hydratation React sur `.deviceNotice` (visible uniquement si
`preference === "PUSH"`). Corrigé : `null` sur les 2 rendus, la vraie valeur
déterminée après montage dans l'effet existant. Corollaire trouvé par
`eslint` (`react-hooks/set-state-in-effect`, règle absente de ce projet
avant aujourd'hui apparemment) : un `setState` synchrone dans le corps de
l'effet pour la branche "non supporté" — restructuré en promesse résolue
immédiatement pour que tout `setState` passe par un `.then()`/`.catch()`.
**Vérifié en conditions réelles** : `notification_preference` du bot forcé
à `PUSH` via `service_role` (compte de simulation, restauré après), Push
autorisé dans le contexte Playwright — le bandeau « Push activé sur ton
compte, mais pas encore sur cet appareil » s'affiche bien, AUCUN message
lié à l'hydratation en console (reproduction exacte du scénario de l'audit).

**2. Libellé "Hier" du Classement** — `computeRankTrend()`
(`lib/queries/leaderboard.ts`) prenait le dernier snapshot AVANT
aujourd'hui, potentiellement vieux de plusieurs jours si le cron a raté une
exécution, mais le libellé affichait toujours "Hier". Ajout de `daysAgo`
(arithmétique sur les clés `YYYY-MM-DD` déjà résolues, `daysBetween()`) au
type `RankTrend`, consommé par `LeaderboardRow.tsx::dayPrefix()` — "Hier"
seulement si `daysAgo <= 1`, sinon "Il y a N jours".

**3. Nœud sans conférence silencieusement supprimé** —
`SeriesDrillDown.tsx::renderColumn` (vue A Playoffs) ne rendait que les
nœuds Ouest/Est ; un nœud `conference === null` dans un tour par ailleurs à
conférence disparaissait sans trace. Ajout d'un 3e rendu "rest" centré (même
style que la Finale NBA), affiché seulement si un tel nœud existe — aucun
cas réel aujourd'hui, garde-fou pur.

**4. Redirection `/play/bracket?round=X` → `/bracket` qui perdait `round`**
— `/bracket` (vue globale) n'a pas d'onglet par tour comme l'écran de
remplissage, donc pas de "round" à restaurer au sens strict ; corrigé en
ancre (`redirect(`/bracket#round-${sp.round}`)`, `id={`round-${round.key}`}`
posé sur chaque section de `SeriesDrillDown.tsx`). **Bug distinct trouvé en
testant** : le scroll natif du navigateur vers l'ancre n'avait PAS lieu
après la redirection serveur + hydratation Next.js (`window.scrollY` restait
à 0 alors que l'élément existait) — corrigé par un effet dédié
(`scrollIntoView` au montage, lu depuis `window.location.hash`). Vérifié en
conditions réelles (Playwright authentifié) : `scrollY` passe de 0 à 473,
capture d'écran confirmant l'affichage centré sur "Demi-finales de
conférence".

**5/6. Dédoublonnage** (3 motifs, `réutilisation` de l'audit) :
- Formatage `datePart`/`timePart` "JJ/MM HH:mm" (Europe/Paris), dupliqué
  6 fois à l'identique (`match-bets.ts`, `admin-requests.ts`,
  `admin-resolution.ts`, `admin-validation.ts`, `bets.ts`, `my-bets.ts`) —
  extrait en `parisDateTimeLabel()` (`lib/dates/paris.ts`, module déjà
  dédié aux utilitaires de date Europe/Paris neutres).
- `RELEASED_*_BET_STATUSES = new Set(["REJECTED", "CANCELLED"])`, 6 copies
  identiques (`bets.ts`, `bracket-fill.ts`, `bracket.ts`, `match-bets.ts`,
  `matches.ts`, `series-bets.ts`) — extrait en `RELEASED_BET_STATUSES`
  (`lib/labels/bets.ts`, déjà la source des autres constantes de paris).
- Motif "ligne cliquable" (`role="button"` + clavier Entrée/Espace),
  dupliqué à l'identique dans `NodeCard.tsx`, `LeaderboardRow.tsx`,
  `BetGroupRow.tsx` — extrait en `clickableRowProps()`
  (nouveau `lib/hooks/clickableRow.ts`).

Volontairement PAS traités cette fois (hors du périmètre demandé) : lien
"Parier" atteignable dans une carte `aria-disabled` (point 6 Correctness),
classes CSS mortes `.hero-banner-title`/`.hero-banner-subtitle` (point 7),
et toute la section Efficacité de l'audit (mémoïsation `LeaderboardRow`,
regroupements de requêtes `getBracket()`/`getHomeData()`) — laissés dans
`GAPS_OUVERTS.md` si repris plus tard.

`tsc --noEmit`, `eslint .` (0 erreur — seuls les 4 warnings pré-existants de
`scripts/seed-playoffs-simulation.mjs`, script jetable hors app, subsistent),
`vitest run` (37/37), `next build` (36 routes) propres après chaque
correctif et à la fin. Scripts + captures Playwright jetables, supprimés en
fin de session, jamais commités.
```

## Discussion produit : les 4 questions de l'avis expert (16/08/2026)

```text
Suite de la même session : les 4 questions ouvertes de
`AVIS_EXPERT_16_08_2026.md` tranchées par `AskUserQuestion` avant de coder
quoi que ce soit (§ méthodologie habituelle de ce projet).

**Décisions** :
1. Bracket en arbre visuel connecté — **oui, ça vaut le chantier** (choisi
   comme priorité n°1 des 3 pistes retenues, codé dans la foulée cette
   session, voir entrée suivante).
2. Mécanique récurrente — **ni duel hebdo ni boosters** : l'utilisateur
   préfère un système de notifications/popups à la connexion. Contenu
   précisé par un 2e tour de questions (multi-choix) : résumé depuis la
   dernière visite, nouveaux badges/récompenses débloqués, et « des actus »
   (annonces, pas davantage précisé). **Non cadré ni codé cette session** —
   reste une piste ouverte, à cadrer avant de coder (statut différent du
   point 1 : pas encore de plan validé).
3. Chat/couche sociale in-app — **utile, à construire**. Pas cadré ni codé
   cette session.
4. Priorité SMTP vs pistes produit — **pistes produit d'abord**, SMTP reste
   explicitement en pause (déjà noté dans `GAPS_OUVERTS.md`).

Rien d'autre tranché sur les points 2/3 (pas de cadrage détaillé demandé ni
fait) — seul le point 1 a été repris immédiatement.
```

## Bracket en arbre visuel connecté (Vue B) — 1er chantier produit (16/08/2026)

```text
Suite immédiate de la discussion ci-dessus. Chantier significatif (nouveau
composant, mesure DOM dynamique) : passé par `EnterPlanMode`/`ExitPlanMode`
avant de coder — plan approuvé sans modification, sauvegardé dans
`C:\Users\lenoi\.claude\plans\refactored-soaring-jellyfish.md` (hors dépôt).

**Contexte** : Vue B (« Plein écran ↗ », poster à géométrie fixe Ouest →
Finale → Est) réordonnait déjà les tours en poster depuis le 30/07/2026,
mais SANS aucun trait de connexion entre les séries — scope réduit acté à
l'époque, revu ce jour suite à l'avis qualitatif (« le plus gros écart
d'effet waouh avec ESPN »).

**Implémentation** :
- `lib/queries/bracket.ts` : `BracketNode` expose désormais `nextSeriesId`/
  `nextSeriesSlot` (colonnes `next_series_id`/`next_series_slot`, déjà en
  base depuis la migration initiale, déjà utilisées par
  `bracket-fill.ts::CascadeSeriesRow` pour l'écran de remplissage — jamais
  exposées jusqu'ici sur l'écran de consultation globale).
- Nouveau `components/bracket/TreeConnectors.tsx` : SVG à la main (pas de
  librairie de graphes, même choix que `RankEvolutionChart.tsx`), mesure
  DOM réelle (`getBoundingClientRect`) des cartes plutôt qu'un calcul
  géométrique a priori — la hauteur des cartes n'est PAS fixe
  (`NodeCard.module.css` : en cours/terminé/pronostic/bouton Parier la font
  varier). `ResizeObserver` sur le conteneur ET chaque carte + dépendance
  sur `useLiveSeriesMap()` : une carte peut changer de hauteur SANS que son
  conteneur ne change de taille (ex. bascule EN_COURS -> TERMINÉ en direct,
  cf. le correctif Realtime de cette même session). Connecteurs en coude à
  3 segments, 2 traits indépendants par merge 2->1 (pas de jonction en Y
  fusionnée — plus simple). Couleur `--color-border-strong` (token neutre
  déjà theme-aware, jamais une couleur sémantique, §17).
- `SeriesDrillDown.tsx` (Vue B) : `.roundsB` scindé en 2 niveaux (scroll
  extérieur + `.roundsBInner` en `position: relative`, portant la mise en
  page ET le SVG en position absolue — doit couvrir tout le contenu
  scrollable, pas juste le viewport visible). Chaque carte enveloppée d'un
  petit div `ref` qui s'enregistre dans une `Map` tenue par
  `SeriesDrillDown` (pas de changement à `NodeCard.tsx`, moins de
  couplage). `Column` porte désormais un `side: "west" | "east"` (dérivé
  dans `buildMirroredColumns` : Ouest pousse le trait à droite, Est à
  gauche — miroir du poster, convergent vers la Finale NBA centrale).

**2 bugs réels trouvés en implémentant** (avant même de tester en
conditions réelles, via `eslint`) :
- `react-hooks/refs` : passer `cardRefsMap.current` (déjà déréférencé) en
  prop pendant le rendu est interdit par cette règle — corrigé en passant
  le `RefObject` lui-même à `TreeConnectors`, déréférencé SEULEMENT dans
  son propre effet.

**1 bug réel trouvé en conditions réelles** (aucun trait ne s'affichait du
tout, malgré des données/refs a priori correctes) : `containerRef.current`
restait `null` au 1er passage de l'effet de `TreeConnectors`, alors que la
garantie React habituelle ("le ref est posé avant que les effets ne
s'exécutent") aurait dû l'exclure — confirmé par un test délibéré
(`setTimeout` de 50ms dans l'effet : le ref était bien peuplé peu après).
Cause exacte non élucidée (probablement une particularité d'hydratation
Next.js sur cet arbre profond) ; corrigé pragmatiquement par une boucle de
réessai (`requestAnimationFrame`) au lieu d'abandonner au 1er passage —
pattern robuste indépendamment de la cause exacte.

**Vérifié en conditions réelles** (Playwright authentifié, compétition
sandbox, `/bracket?arbre=1`) :
- Traits visibles et correctement positionnés entre 1er tour → demies →
  finale de conférence → Finale NBA, thèmes Sombre ET Clair (Photo rendu
  identique à Sombre sur cet écran précis — l'écran Bracket/arbre ne fait
  pas partie des 9 écrans migrés au style photo/verre, pas une régression).
- Clic sur une carte traversée visuellement par un trait : le détail
  s'ouvre normalement (`pointer-events: none` sur le SVG respecté).
- Bascule EN_COURS -> TERMINÉ en direct (`service_role`, même technique que
  le correctif Realtime plus tôt cette session) : les traits se redessinent
  correctement (chemins SVG confirmés différents avant/après par
  comparaison programmatique).
- Aucune erreur console à aucune étape.

`tsc --noEmit`, `eslint .` (0 erreur, mêmes 4 warnings pré-existants hors
app), `vitest run` (37/37), `next build` (36 routes) propres. Scripts de
debug + captures Playwright jetables, supprimés en fin de session, jamais
commités.
```

## Correctif : séries du 1er tour inatteignables au scroll, Vue B paysage (16/08/2026)

```text
Signalé par l'utilisateur : « quand on penche le téléphone, on ne peut pas
voir les séries du haut du bracket, on les aperçoit mais impossible de les
afficher ». Reproduit et corrigé sans étape de cadrage — diagnostic direct
suffisant, symptôme reconnaissable.

**Cause** : `.treeColumn` (`SeriesDrillDown.module.css`, Vue B) centrait
verticalement son contenu via `justify-content: center` (demandé le
30/07/2026, pour qu'une colonne à 1 carte comme la Finale NBA s'aligne au
centre plutôt qu'en haut). Piège CSS classique : quand le contenu d'un
conteneur centré déborde (1er tour, jusqu'à 4 cartes — largement plus haut
que l'espace visible en paysage sur téléphone), il déborde symétriquement
en haut ET en bas, mais un conteneur scrollable ne peut jamais scroller à
une position NÉGATIVE — le débordement du haut (avant le point de départ du
scroll) devient donc définitivement inatteignable, alors qu'il reste
partiellement visible (d'où « on les aperçoit mais impossible de les
afficher », description exacte du symptôme).

**Correctif** : `justify-content: center` remplacé par des marges auto sur
le 1er/dernier enfant de `.treeColumn` (`margin-top: auto` /
`margin-bottom: auto`) — technique standard pour ce piège précis : centre
quand la place le permet, mais les marges auto s'effondrent à 0 dès que le
contenu ne tient plus (ancrage en haut, contenu intégralement atteignable
au scroll) au lieu de pousser le contenu hors champ.

**Vérifié en conditions réelles** (Playwright, contexte mobile émulé
`iPhone 13` en paysage, 844×390, `/bracket?arbre=1`) : `scrollHeight` (701)
largement supérieur à `clientHeight` (321) sur la colonne 1er tour Ouest
(4 cartes) — confirmé AVANT le correctif que c'était bien la source du
débordement. Après correctif : à `scrollTop = 0`, la 1ère carte (OKC-SAS)
est intégralement visible (haut de carte aligné sur le haut du conteneur,
pas de zone morte) ; en scrollant jusqu'en bas, la 4e et dernière carte
(LAL-HOU) est elle aussi intégralement visible. Captures d'écran aux 2
extrémités confirmant visuellement. Aucune erreur console.

`tsc --noEmit`, `eslint` (`components/bracket`), `vitest run` (37/37),
`next build` (36 routes) propres. Script + captures Playwright jetables,
supprimés en fin de session, jamais commités.
```

## Vue B (arbre connecté) devient le défaut desktop/paysage (16/08/2026)

```text
Suite immédiate du correctif de scroll ci-dessus : l'utilisateur, une fois
le bug corrigé, demande si cette vue ne mériterait pas de devenir
l'affichage PRINCIPAL du bracket (« plus raccord avec ce qui se fait dans
le monde du basket/NBA »), y compris pour le remplissage et les paris.
Réponse donnée en 2-3 phrases (question exploratoire) : la Vue A reste
indispensable en portrait mobile (seule vue sans scroll horizontal, règle
appliquée partout ailleurs dans ce projet), mais la Vue B peut devenir le
défaut sur desktop/paysage sans rien casser. Le remplissage
(`/play/bracket`) est un chantier à part (composant différent, interaction
séquentielle) — accepté par l'utilisateur comme 2e étape, pas traité ici.
Paris déjà couverts dans les 2 vues (bouton "Parier" déjà présent), rien à
faire de ce côté.

**Implémentation, `components/bracket/TreeView.tsx` uniquement** :
`DESKTOP_QUERY`/`LANDSCAPE_QUERY` (2 requêtes séparées, seule la 2e écoutée)
fusionnées en une seule `IMMERSIVE_DEFAULT_QUERY` (virgule = OU en media
queries) : desktop (`min-width: 1024px`) OU paysage, traités identiquement
partout dans ce fichier désormais. `EnteredBy` élargi de `"rotation" |
"explicit" | null` à `"auto" | "explicit" | null` : "auto" couvre
maintenant À LA FOIS la rotation ET le cas nouveau (viewport déjà conforme
dès le chargement) — seule une entrée "auto" ressort automatiquement quand
le viewport cesse de correspondre, jamais un choix explicite (bouton, lien
`?arbre=1` partagé/mis en favori).

**Décision inversée sciemment par rapport au commentaire d'origine**
(« jamais l'état constaté au montage, sinon tout visiteur desktop
atterrirait dans l'arbre ») : désormais recherché. `useLayoutEffect` (pas
`useEffect`) pour la détection au montage, afin de limiter au strict
minimum le flash Vue A -> Vue B sur desktop au chargement (inévitable au
tout 1er rendu SERVEUR, qui ignore toujours le viewport réel — même limite
déjà acceptée ailleurs ce projet, cf. NotificationSettings.tsx).

**Vérifié en conditions réelles** (Playwright, 3 contextes de viewport,
`/bracket` en visiteur non connecté) :
1. Desktop (1440×900), chargement à froid : Vue B affichée d'emblée, URL
   remplacée en `?arbre=1` (délai ~1-1.5s, round-trip RSC du `router.
   replace` — pas un bug, juste plus lent qu'un `waitForTimeout` initial
   trop court dans le script de test).
2. Clic "Quitter" sur desktop : retour Vue A, URL nettoyée en `/bracket` ;
   redimensionnement ensuite vers mobile portrait sans revisite : reste sur
   Vue A (le choix explicite de fermeture n'est jamais annulé par un
   redimensionnement).
3. Mobile portrait (375×667), chargement à froid : Vue A par défaut,
   inchangé — aucune régression.
4. Rotation portrait -> paysage sur mobile : entre en Vue B (comme avant,
   maintenant via la requête fusionnée).
5. Rotation retour paysage -> portrait : ressort en Vue A (comme avant).
Aucune erreur console sur les 6 scénarios testés.

`tsc --noEmit`, `eslint .` (0 erreur, mêmes 4 warnings pré-existants hors
app), `vitest run` (37/37), `next build` (36 routes) propres. Script +
captures Playwright jetables, supprimés en fin de session, jamais
commités.
```

## Remplissage du bracket : poster interactif comme mode principal (16/08/2026)

```text
Suite du chantier « arbre visuel connecté » : après le correctif de
scroll, l'utilisateur demande si cette vue ne devrait pas devenir
l'affichage PRINCIPAL du bracket, y compris pour le remplissage et les
paris. Réponse en 2-3 phrases (question exploratoire, pas de plan
d'emblée) : la Vue A reste indispensable en portrait mobile (seule vue
sans scroll horizontal), mais la Vue B peut devenir le défaut sur desktop/
paysage sans rien casser — voir l'entrée suivante. Le remplissage est un
chantier à part (composant différent, interaction séquentielle) — accepté
comme 2e étape.

**Étape 1 : Vue B devient le défaut desktop/paysage** (`TreeView.tsx`) —
`DESKTOP_QUERY`/`LANDSCAPE_QUERY` fusionnées en une seule media query
(virgule = OU), écoutée au montage (`useLayoutEffect`) ET aux changements
ultérieurs — pas seulement à la rotation comme avant. `EnteredBy` élargi de
`"rotation"|"explicit"|null` à `"auto"|"explicit"|null` : seule une entrée
"auto" ressort automatiquement au changement de viewport, un choix
explicite (bouton, lien `?arbre=1`) n'est jamais annulé par un simple
redimensionnement. Décision INVERSÉE par rapport au commentaire d'origine
du 30/07/2026 (« jamais l'état constaté au montage, sinon tout visiteur
desktop atterrirait dans l'arbre ») — désormais recherché. Vérifié en
conditions réelles (Playwright, 6 scénarios : desktop cold load, Quitter,
redimensionnement après Quitter, mobile portrait cold load, rotation
paysage, rotation retour) — aucune régression.

**Étape 2 : remplissage en poster interactif** — 3 options proposées par
`AskUserQuestion`, l'utilisateur choisit la médiane : « le poster remplace
les onglets comme mode principal, mais l'appli scrolle/surligne
automatiquement la prochaine série à compléter » (guidage conservé).
Chantier significatif (composant radicalement différent de la
consultation : chaque carte est un FORMULAIRE) — passé par `EnterPlanMode`/
`ExitPlanMode`, plan approuvé sans modification.

Généralisation (3 pièces réutilisées entre consultation ET remplissage,
plutôt que dupliquées une 2e fois — l'audit du 16/08 avait déjà signalé
3 duplications distinctes dans ce projet) :
- `components/bracket/posterColumns.ts` (nouveau) : géométrie du poster
  (Ouest ascendant, Est descendant miroir, Finale au centre) extraite de
  `SeriesDrillDown.tsx::buildMirroredColumns`, généralisée sur une forme
  neutre `{ key; label; items: T[] }` (propriété `items`, pas `nodes`/
  `series` — chaque domaine garde son propre nom de champ).
- `TreeConnectors.tsx` généralisé via `getId`/`getNextId` (extracteurs de
  fonction) plutôt qu'un nom de champ fixe : `BracketNode` utilise
  `nodeId`, `BracketFillSeries` utilise `seriesId` — aucun nom commun aux
  2 domaines, la 1re tentative (type structurel `{ nodeId; nextSeriesId }`)
  a échoué à la compilation, corrigée avant même les tests réels.
- `lib/hooks/useImmersiveDefault.ts` (nouveau) : bascule desktop/paysage
  extraite de `TreeView.tsx`, paramétrée sur `onEnter`/`onExit` (chaque
  écran garde son propre routing — `/bracket?arbre=1` vs aucun contrat
  d'URL pour `/play/bracket`) et sur `seenInviteKey` (pas de clé
  sessionStorage partagée par défaut).
- `lib/queries/bracket-fill.ts` : `BracketFillSeries` expose désormais
  `nextSeriesId` (même colonne déjà lue en interne pour la cascade,
  jamais exposée dans le type public).

Nouveaux composants :
- `FillSeriesCard.tsx` : contenu de `BracketFillBoard.tsx::SeriesPickCard`
  extrait et adapté à une colonne de poster étroite (13rem) — équipes
  empilées en lignes horizontales plutôt qu'une grille 2 colonnes, sinon
  MÊME logique (pick optimiste + `saveBracketPick`, `InlineBetForm`
  intégré tel quel).
- `FillPosterView.tsx` : le poster lui-même — géométrie + traits partagés,
  guidage automatique (`findNextIncomplete`, parcourt les colonnes dans
  l'ordre de rendu Ouest→centre→Est, gère naturellement la cascade — une
  série de tour 2+ pas encore sélectionnable est simplement ignorée
  jusqu'à ce qu'elle le devienne), bouton de validation + dialogue
  (déplacés depuis `BracketFillBoard.tsx`, plus liés à un tour précis).
  **Pas de callback "pick réussi" à remonter** (simplification décidée
  pendant l'implémentation) : `saveBracketPick` appelle déjà
  `revalidatePath("/play/bracket")`, qui rafraîchit `data` chez le parent
  et donc la cible du guidage — le flux normal des props suffit, pas de
  pont client manuel.
- `BracketFillView.tsx` (nouveau, dans `components/bracket-fill/`) :
  orchestrateur bascule flux normal (onglets, portrait)/poster (desktop-
  paysage), même rôle que `TreeView.tsx` pour la consultation. Pas de
  contrat `?arbre=` à préserver ici.
- `app/(app)/play/bracket/page.tsx` : ne rend plus directement `RoundTabs`/
  `BracketFillBoard`, délègue entièrement à `BracketFillView` (les 2
  branches "état vide" du haut du fichier restent inchangées, hors du
  nouveau composant).

**Vérifié en conditions réelles** (Playwright, compte réel `Amine92`,
compétition sandbox — `bracket_deadline` temporairement repoussée d'un
mois pour pouvoir tester le remplissage, restaurée à la fin) :
- Desktop (1440×900) : poster affiché d'emblée, 14 traits de connexion.
- **Guidage automatique confirmé avec un cas dépendant de la cascade** :
  2 picks temporairement effacés en base (une série 1er tour + la série de
  tour 2 qui en dépend), rechargement → la carte ciblée est bien la série
  du 1er tour (seule sélectionnable au départ) ; pick effectué dessus →
  après une navigation fraîche, la cible passe correctement à la série de
  tour 2 (devenue sélectionnable une fois son autre parent aussi résolu).
  Capture d'écran confirmant visuellement l'accent orange sur la bonne
  carte. Picks originaux restaurés après le test.
- Pari série depuis une carte du poster : `InlineBetForm` (composant
  INCHANGÉ, réutilisé tel quel) s'ouvre, se soumet, et affiche
  correctement une erreur serveur réelle (« La série a déjà commencé » —
  limite du jeu de données sandbox, toutes les séries de la simulation ont
  un coup d'envoi déjà passé, pas un bug) — confirme le câblage sans
  polluer la base (aucun pari créé, la validation a bloqué la sauvegarde
  comme attendu).
- Validation du bracket (bouton + dialogue) fonctionne depuis le poster.
- Mobile portrait : flux onglets inchangé, nouveau bouton "Vue poster ↗"
  présent dans l'en-tête pour un accès manuel.
- Aucune erreur console sur l'ensemble des scénarios.

`tsc --noEmit`, `eslint .` (0 erreur, mêmes 4 warnings pré-existants hors
app), `vitest run` (37/37), `next build` (36 routes) propres après chaque
étape et à la fin. Scripts + captures Playwright jetables (dont la
manipulation temporaire de `bracket_deadline`/`bracket_picks`), supprimés
et restaurés en fin de session, rien commité.
```

## Arbre toujours par défaut + alignement des cartes fusionnées (17/08/2026)

```text
Nouvelle session, reprise directe (pas de rattrapage nécessaire — tout
committé la veille). Demande de l'utilisateur en 3 parties sur le Bracket :
(1) l'arbre complet doit être l'écran d'arrivée « peu importe le device »
(plus de bascule desktop/paysage vs mobile portrait), avec « Quitter »
toujours en haut à gauche ; (2) la carte demi-finale doit être pile entre
les 2 cartes de 1er tour qui l'alimentent ; (3) confirmation que le
remplissage via cette interface poster est déjà fait (oui, session du
16/08 — `FillPosterView.tsx`). Clarifié par `AskUserQuestion` avant de
coder : la règle "peu importe le device" doit-elle aussi s'appliquer au
remplissage ? **Oui, même règle partout.**

**Simplification radicale de la bascule** (point 1) : `useImmersiveDefault.ts`
(16/08/2026 — media query desktop/paysage, invitation à tourner,
sessionStorage) devient `usePosterToggle.ts`, un simple état visible/masqué
sans AUCUNE détection de viewport — le poster est désormais TOUJOURS l'état
initial, sur les 2 écrans (`TreeView.tsx` pour la consultation,
`BracketFillView.tsx` pour le remplissage). `RotateInvite.tsx` (devenu
inutilisé) supprimé, ainsi que tout le mécanisme `?arbre=` devenu mort
(`app/bracket/page.tsx`, `BracketSummary.tsx`, `LeagueScopeChips.tsx` —
plus de `showTree`/`initialShowTree`/`initialShow`). « Quitter » déplacé en
1er élément du header (justify-content:space-between s'occupe du reste) sur
les 2 écrans — `TreeView.tsx` et `FillPosterView.tsx`
(`.headerTexts { text-align: right }` ajouté pour ce dernier, qui a 2
lignes de texte à droite plutôt qu'un simple titre).

**Alignement des cartes fusionnées sur le milieu de leurs 2 séries
d'origine** (point 2, étendu par cohérence à TOUTE fusion 2→1, pas
seulement les demi-finales — sinon la finale de conf./Finale NBA
resteraient visuellement désalignées) — `TreeConnectors.tsx`, nouvelle
fonction `alignMergedCards()` appelée en tête de `recompute()`, avant le
calcul des traits : tri topologique par passes successives (un nœud SANS
parent garde sa position naturelle du flex layout ; chaque nœud suivant
s'aligne — `transform: translateY()`, pas de reflow — une fois ses 2
parents eux-mêmes réglés), sans connaître l'ordre des tours à l'avance
(fonctionne identiquement pour Playoffs miroité et NBA Cup linéaire).
Fonction généraliste construite directement sur `getId`/`getNextId`
(même extracteurs que le tracé des traits, déjà génériques depuis le
16/08) — aucun changement de contrat, réutilisée automatiquement par les 2
écrans (consultation ET remplissage) qui partagent `TreeConnectors.tsx`.

**Vérifié en conditions réelles** (Playwright, visiteur + compte réel
`Amine92`, compétition sandbox) :
- Arbre affiché par défaut sur desktop (1440×900), mobile portrait
  (375×667), mobile paysage (667×375) ET tablette portrait (768×1024) — les
  4 contextes testés, un seul comportement partout.
- Quitter puis « Voir l'arbre complet » : va-et-vient confirmé, aucune
  régression sur le flux Vue A.
- **Alignement confirmé par calcul manuel sur capture d'écran** : chaque
  carte de tour 2+ (demi-finale, finale de conférence, Finale NBA) mesurée
  à moins de 1px du milieu exact de ses 2 parents (ex. demi-finale à
  y≈357, milieu de ses 2 parents 1er tour à (291+418)/2≈354.5).
- Remplissage (poster) : même comportement confirmé sur mobile portrait ET
  desktop — traits de connexion présents et correctement alignés (capture
  rapprochée nécessaire pour les voir clairement à pleine page, faux
  négatif corrigé en cours de vérification — les traits étaient bien là,
  juste peu contrastés à cette résolution de capture).
- Aucune erreur console sur l'ensemble des scénarios.

`tsc --noEmit`, `eslint .` (0 erreur, mêmes 4 warnings pré-existants hors
app), `vitest run` (37/37), `next build` (36 routes) propres. Scripts +
captures Playwright jetables (dont la manipulation temporaire de
`bracket_deadline`), supprimés en fin de session. Serveur de dev laissé
ACTIF à la demande explicite de l'utilisateur (contrairement aux sessions
précédentes où il était arrêté en fin de session).
```

## Correctif : libellés de tour mal positionnés après l'alignement des cartes (17/08/2026)

```text
Signalé par l'utilisateur juste après le chantier ci-dessus : « fais bien
attention aux titres des tours de playoffs sur l'écran bracket (leur
emplacement) ». Diagnostic direct par mesure DOM (Playwright,
`getBoundingClientRect` sur chaque libellé et les cartes de sa colonne) —
confirmé avant de corriger : « Demi-finales de conférence » (Ouest ET Est)
avait son libellé positionné SOUS le haut de sa 1re carte (ex. libellé à
y=394.5, carte à y=336 — la carte affichée AU-DESSUS de son propre titre).

**Cause** : l'alignement des cartes fusionnées (`alignMergedCards()`,
session précédente) déplace chaque carte via `transform: translateY()`
vers le milieu de ses 2 parents — mais le libellé de la colonne, lui,
n'était jamais déplacé, restant à sa position flex NATURELLE (calculée
pour un bloc de cartes centré, avant tout déplacement individuel). Une
colonne dont les cartes finissent tirées vers le haut (pour s'aligner sur
des parents eux-mêmes hauts placés) se retrouve donc avec des cartes
au-dessus de leur propre titre.

**Correctif** (`TreeConnectors.tsx::alignColumnLabels()`, nouvelle
fonction appelée juste après `alignMergedCards()`, avant le calcul des
traits) : repositionne chaque libellé (`transform: translateY()`, même
technique) pour qu'il reste à 8px au-dessus de la carte la PLUS HAUTE de sa
colonne — seulement si nécessaire (ne bouge pas un libellé déjà
confortablement positionné, évite un décalage inutile dans le cas courant
non affecté). Nécessite une nouvelle Map de refs pour les libellés
(`labelRefsMap`/`registerLabel`, même patron que `cardRefsMap`/
`registerCard`), câblée dans `SeriesDrillDown.tsx` ET `FillPosterView.tsx`
(consultation et remplissage partagent `TreeConnectors.tsx`, correctif
automatiquement présent sur les 2 écrans).

**Vérifié en conditions réelles** : même script de mesure DOM rejoué après
correctif — « Demi-finales de conférence — Ouest » passe de labelTop=394.5
(sous le haut de carte à 336) à labelTop=306.5 (29.5px AU-DESSUS, gap
cohérent avec « 1er tour » à 33px) ; même correction sur le côté Est et sur
« Finales de conférence — Est » (gap resserré à 9px avant, ramené à ~30px).
Capture d'écran confirmant visuellement les 7 libellés correctement
positionnés au-dessus de leur colonne.

`tsc --noEmit`, `eslint .` (0 erreur, mêmes 4 warnings pré-existants hors
app), `vitest run` (37/37), `next build` (36 routes) propres. Script de
mesure + capture jetables, supprimés en fin de session. Serveur de dev
laissé actif.
```

## Finales de conférence + Finale NBA toujours sur la même ligne (17/08/2026)

```text
Suite immédiate : l'utilisateur demande que les 2 finales de conférence et
la Finale NBA restent TOUJOURS alignées sur la même ligne horizontale —
contrairement aux demi-finales (chacune alignée indépendamment sur SES
propres parents, cf. l'entrée précédente), qui peuvent légitimement
diverger d'un côté à l'autre du poster.

**Implémentation** (`TreeConnectors.tsx::alignMergedCards()`, nouveau bloc
en fin de fonction, après la passe topologique existante) : trouve le nœud
FINAL (`getNextId(node) === null` — Finale NBA en Playoffs, finale de Cup
en NBA Cup) et ses 2 parents directs. Si exactement 2 parents, calcule la
MOYENNE des 3 positions déjà indépendamment réglées par la passe
précédente (pas la position d'un des 3 imposée aux 2 autres) et déplace
les 3 vers cette ligne partagée, en composant avec le `transform` déjà
appliqué (parsing de la valeur `translateY` existante plutôt qu'un
écrasement, pour ne pas perdre l'alignement individuel déjà calculé comme
point de départ). Générique (pas de nom de tour en dur) : s'applique aussi
bien à Playoffs (miroité, 2 finales de conférence) qu'à NBA Cup (linéaire,
2 demies) si la structure s'y prête.

**Vérifié en conditions réelles** : les 3 cartes ("Finales de conférence —
Ouest", "Finale NBA", "Finales de conférence — Est") mesurées avec un
centre vertical EXACTEMENT identique (513.5px sur la consultation, 596px
sur le remplissage — même composant partagé, correctif automatiquement
présent sur les 2 écrans). Capture d'écran confirmant visuellement
l'alignement et les traits de connexion parfaitement horizontaux entre les
3 cartes.

`tsc --noEmit`, `eslint .` (0 erreur, mêmes 4 warnings pré-existants hors
app), `vitest run` (37/37), `next build` (36 routes) propres. Scripts de
mesure + captures jetables, supprimés en fin de session. Serveur de dev
laissé actif.
```

## Nouveau : suppression manuelle d'un match, écran admin (17/08/2026)

```text
Origine : l'utilisateur (Rillettes-31, seul compte ADMIN) signale que des
matchs ajoutés pour le 17/08 n'apparaissent pas dans « Mes matchs ».
Diagnostic (agent dédié, lecture seule) : PAS un bug — l'écran Matchs
n'affiche que les matchs strictement à venir (`scheduled_at > now`), et ces
3 lignes avaient un `scheduled_at` déjà passé au moment de leur création.
Cause admise par l'utilisateur : décalage horaire (Canada, saisie pensée
« 17h » en heure française déjà passée). Demande de suite : ajouter une
fonction de suppression manuelle d'un match, qui n'existait nulle part
(seule la synchro automatique en crée).

**Recherche préalable** (agent dédié, lecture seule) avant de coder :
convention exacte des actions admin existantes (`lib/actions/
admin-results.ts::createMatch`/`saveMatchResult` — session admin
re-vérifiée par `is_admin()` PUIS écriture en `service_role`, AUCUNE policy
RLS d'INSERT/DELETE sur `matches`), et surtout le risque réel : `matches`
est référencée par `match_predictions.match_id` et `bets.match_id` SANS
`ON DELETE CASCADE` (migration initiale) — une suppression directe
échouerait avec une violation de contrainte (code Postgres 23503) si des
pronostics/paris existent déjà, plutôt que de les perdre silencieusement.
Décision : NE JAMAIS cascader — traduire cette violation en message clair
côté admin plutôt que de forcer la suppression.

**Implémentation** :
- `lib/actions/admin-results.ts::deleteMatch()` — même patron d'auth/
  écriture que les 2 actions existantes ; capture `error.code === "23503"`
  et renvoie « Impossible : des pronostics ou paris existent déjà sur ce
  match. » ; appelle `recomputeBracketDeadline()` après coup (même besoin
  que `createMatch`, la deadline dépend du match le plus tôt restant) ;
  journalise via `logAdminAction` (action `DELETE_MATCH`, `before` = état
  complet du match supprimé).
- `components/admin/DeleteMatchButton.tsx` (nouveau, "use client") —
  dialogue de confirmation IRRÉVERSIBLE, même patron exact que
  `CloseCompetitionButton.tsx` (jusqu'au CSS dupliqué, même convention que
  le reste du projet — pas de composant de dialogue partagé dans ce
  projet).
- `SeriesResultsCard.tsx` (écran `/admin/competitions/results`, déjà le
  seul endroit qui liste les matchs d'une série) : bouton « Supprimer »
  ajouté à côté du formulaire de résultat existant, pour chaque match.

**Vérifié en conditions réelles** (Playwright) : rôle `ADMIN` accordé
TEMPORAIREMENT à un compte bot de simulation (jamais touché au compte réel
de l'utilisateur), revert automatique en fin de script (`finally`).
1. Match jetable ajouté via le formulaire existant, supprimé via le
   nouveau bouton — confirmé disparu de la base après confirmation.
2. Pronostic de test créé sur un autre match réel, tentative de
   suppression de CE match — bloquée, message d'erreur exact affiché
   («Impossible : des pronostics ou paris existent déjà sur ce match. »),
   match TOUJOURS présent en base après la tentative (aucune perte de
   données). Pronostic de test nettoyé après coup.
Aucune erreur console sur les 2 scénarios. **Les 3 lignes réelles du
17/08 n'ont PAS été supprimées pendant ce test** (volontairement écarté du
scénario de vérification, qui utilisait un match jetable dédié) — laissées
à l'utilisateur, qui peut désormais les supprimer lui-même.

`tsc --noEmit`, `eslint .` (0 erreur, mêmes 4 warnings pré-existants hors
app), `vitest run` (37/37), `next build` (36 routes) propres. Scripts
Playwright jetables (dont l'octroi temporaire du rôle ADMIN au bot),
supprimés en fin de session. Serveur de dev laissé actif.
```

## Nettoyage des comptes bots de simulation + 2 correctifs remplissage (17/08/2026)

**Nettoyage** : l'utilisateur a archivé lui-même la compétition
« Playoffs NBA (simulation) » et recréé « Play offs test » pour tester le
remplissage à neuf ; a demandé de supprimer les 10 comptes bots
(`seed-sim-*@nba-pronos.test`, créés le 14/08/2026 via
`scripts/seed-playoffs-simulation.mjs`). Investigation FK au préalable
(même prudence que `deleteMatch` — aucune de ces tables n'a `on delete
cascade` sur `user_id`, seuls `push_subscriptions`/`reminder_log` l'ont) :
supprimé dans l'ordre `audit_logs` (3 lignes — résidu du test Playwright
`deleteMatch`, le bot Amine92 avait reçu le rôle ADMIN temporairement ce
jour-là) → `bracket_picks` (150, via les 10 `brackets`) → `brackets` (10)
→ `bets` (3) → `match_predictions` (273) → `competition_archives` (10) →
`leaderboard_snapshots` (40) → `competition_superlatives` (8, générées à
la clôture de la compétition de simulation) → `auth.users` (cascade
automatique vers `public.users`). Vérifié 0 ligne restante après coup.
Scripts jetables supprimés en fin de session.

**Correctifs remplissage poster** (retour utilisateur en conditions
réelles sur la compétition fraîchement recréée) :
- Boutons de score (4-0/4-1/4-2/4-3) : n'apparaissent plus qu'une fois un
  vainqueur sélectionné (`FillSeriesCard.tsx` ET `BracketFillBoard.tsx`
  côté mobile portrait, même correctif dans les 2 — avant : toujours
  visibles mais désactivés).
- Guidage automatique (`FillPosterView.tsx`) : ne scrolle plus la vue vers
  la prochaine série à compléter qu'UNE SEULE fois, au chargement — plus
  du tout après chaque pick (« on le laisse là où il était »). L'accent
  visuel `.cardTarget` continue de suivre la cible calculée, seul le
  `scrollIntoView` est maintenant gardé par un ref `hasScrolledOnMountRef`.

`tsc --noEmit`, `eslint` (fichiers touchés) propres. Serveur de dev laissé
actif.

## Nouveau : remise à zéro du bracket personnel (17/08/2026)

Demandé par l'utilisateur pendant ses tests sur la compétition
fraîchement recréée. Nouveau `resetBracket()`
(`lib/actions/bracket-fill.ts`) : remet `brackets.is_validated`/
`is_auto_validated`/`validated_at` à leur état initial PUIS efface
`predicted_winner_team_id`/`predicted_score_format` de tous les
`bracket_picks` du bracket (mise à `null`, pas de `DELETE` — RLS n'expose
aucune policy `bracket_picks_delete`, uniquement `_update`, donc pas de
service_role nécessaire ici). Verrou deadline déjà porté par la RLS
existante (`brackets_update`) : détecté via `.select("id")` après l'UPDATE
des brackets (0 ligne = verrouillé), même patron que `validateBracket`.
Ordre volontaire (brackets AVANT bracket_picks) : si la deadline bloque le
1er, on s'arrête avant de toucher aux picks.

`components/bracket-fill/ResetBracketButton.tsx` (nouveau, "use client",
partagé entre `BracketFillBoard.tsx` et `FillPosterView.tsx` — mêmes 2
rendus du même écran `/play/bracket`, pas une 4e duplication du patron de
dialogue) : bouton + dialogue de confirmation portalé vers `document.body`
(même contrainte `.photo-page` que les dialogues de validation déjà en
place), teinté `--color-loss` comme `DeleteMatchButton`. Placé à côté du
bouton « Valider mon bracket » dans les 2 écrans.

`tsc --noEmit`, `eslint`, `vitest run` (37/37) propres. Serveur de dev
laissé actif.

**Correctif same session** : l'utilisateur a signalé qu'il fallait fermer
puis rouvrir le poster (paysage) pour que la remise à zéro s'affiche.
Cause réelle : `FillSeriesCard.tsx`/`BracketFillBoard.tsx::SeriesPickCard`
initialisent `winnerTeamId`/`scoreFormat` via `useState(series.myPick...)`
— valeur lue UNE SEULE fois au montage ; `revalidatePath` rafraîchit bien
`data` chez le parent, mais l'instance déjà montée de la carte gardait son
état local périmé (React ne réinitialise pas un `useState` sur un
changement de props). 1re tentative de correctif via un `useEffect` de
resynchronisation → rejetée par `react-hooks/set-state-in-effect` (déjà
recontré 16/08 sur `NotificationSettings.tsx`). Corrigé avec le patron
React officiel « adjusting state when a prop changes » : comparaison d'une
signature `${winnerTeamId}|${scoreFormat}` PENDANT le rendu (pas dans un
effet), `setState` appelés conditionnellement dans le corps du composant —
React absorbe le re-rendu immédiat sans commit intermédiaire visible.
Même correctif dans les 2 fichiers (même bug, même cause). `tsc`,
`eslint`, `vitest run` (37/37), `next build` (36 routes) propres.

**Correctif same session (2)** : l'utilisateur a signalé une latence entre
le tap vainqueur et la possibilité de choisir le score. Cause : les
boutons (équipe ET score) portaient `disabled={isPending}` — un seul
`useTransition` partagé par les 2 taps, donc les boutons score restaient
désactivés tout l'aller-retour réseau du tap vainqueur, alors que l'état
local (optimiste) affichait déjà le bon vainqueur. Le disabled n'était pas
cosmétique par hasard : il servait à SÉRIALISER les 2 appels
`saveBracketPick` (vainqueur seul, puis vainqueur+score) pour qu'une
réponse en retard du 1er n'écrase pas le 2e si elles revenaient dans le
désordre. Corrigé en séparant les 2 : `disabled` retiré de tous les
boutons (plus de latence perçue), sauvegarde toujours sérialisée via une
petite file d'attente manuelle (`saveChainRef`, `Promise` chaînée) —
l'ordre d'écriture reste garanti sans bloquer l'UI. Même correctif dans
`FillSeriesCard.tsx` et `BracketFillBoard.tsx::SeriesPickCard`. `tsc`,
`eslint`, `vitest run` (37/37), `next build` (36 routes) propres. Serveur
de dev laissé actif.

## Nouveau/modifier un pari : fenêtre centrée au lieu d'une page (17/08/2026)

Demandé par l'utilisateur (« Concernant les paris, peut-on faire en sorte
que le formulaire apparaisse en pop-up ? »). Périmètre clarifié avec lui
(AskUserQuestion) : concerne UNIQUEMENT `/play/bets/new` et
`/play/bets/[id]/edit` (navigation pleine page jusqu'ici, atteints depuis
« Mes paris → Modifier », l'arbre du Bracket en consultation, et la
repropose après refus) — PAS `InlineBetForm.tsx` (Matchs, remplissage du
Bracket), déjà inline. Style choisi : fenêtre centrée (même registre que
les dialogues de confirmation Supprimer un match/Remettre à zéro), pas un
plein écran façon poster du Bracket.

**Implémentation** : nouveau `components/bets/BetFormModal.tsx` ("use
client", portalé vers `document.body`) — backdrop assombri + boîte
centrée (`max-width: 30rem`, `max-height: 90vh`, `overflow-y: auto`),
en-tête sticky avec titre + « × Fermer » (`router.back()`). Les 2 routes
restent de VRAIES pages Next.js (tous les raccourcis qui y mènent —
`NodeCard.tsx`, `MyBetRow.tsx`, `reproposeHref`, hub Accueil — restent de
simples `<Link>`, AUCUN changé) : seul leur RENDU devient ce dialogue au
lieu d'un `.photo-page` pleine largeur. `BetForm.tsx` (le formulaire
lui-même, inchangé sur le fond) : les 3 `router.push("/play")` après
sauvegarde/retrait remplacés par `router.back()` — referme le pop-up et
ramène exactement à l'écran d'origine plutôt qu'un hub fixe.

**Adaptation CSS notable** : `.stickyContent`/`.selectionBar` (le bandeau
« énoncé/catégorie/difficulté » qui reste visible pendant que le
sélecteur série/match défile au-dessus, acquis les 27/07 et 04/08) étaient
`position: fixed` calé au-dessus de la TabBar réelle du viewport — repris
en `position: sticky; bottom: 0` relatif au scroll INTERNE du dialogue
(`BetFormModal.module.css::.dialog`, seul conteneur défilant désormais,
plus de TabBar visible sous le fond assombri à éviter). Les paddings de
réserve `.formReserveBottom`/`.formReserveBottomCompact` (qui
compensaient le retrait du flux par `fixed`) supprimés — `sticky` reste
dans le flux, plus nécessaires.

Routes `/play/bets/new/page.module.css` et `.../[id]/edit/page.module.css`
supprimés (tout leur contenu vivait désormais dans BetFormModal, plus
rien à styler côté page). `tsc`, `eslint`, `vitest run` (37/37),
`next build` (36 routes) propres ; `/play/bets/new` et
`/play/bets/{uuid}/edit` vérifiés sans erreur (redirection /login attendue,
non authentifié) — pas de vérification Playwright authentifiée cette fois
(les 10 comptes de simulation viennent d'être nettoyés à la demande de
l'utilisateur, pas reconstruits pour ce seul test). Serveur de dev laissé
actif.

**Suite immédiate** : l'utilisateur a testé et signalé que la pop-up
n'apparaissait pas « dans le bracket ». Diagnostic : (1) plusieurs
`next build` lancés pendant que `next dev` tournait en parallèle risquaient
d'avoir laissé son cache Turbopack incohérent — serveur redémarré
proprement par précaution (`Stop-Process` + `npm run dev`, revérifié
`curl` 307 sain) ; (2) le vrai motif — l'utilisateur était sur
`/play/bracket` (remplissage), où `InlineBetForm` reste volontairement
inline (exclu du périmètre initial, déjà discuté). Confirmé avec lui : il
voulait EFFECTIVEMENT que ce cas devienne aussi une pop-up (« pour ne pas
surcharger le bracket »).

Extrait `components/ui/ModalDialog.tsx` (+ `.module.css`, déplacé depuis
`BetFormModal.module.css`) : coquille backdrop+dialogue+en-tête générique,
`onClose` fourni par l'appelant plutôt que câblé en dur — `BetFormModal.tsx`
l'utilise avec `router.back()` (vraie page), le nouveau mode "modal"
d'`InlineBetForm.tsx` avec `setIsOpen(false)` (pas de navigation, juste une
pop-up sur la carte). `InlineBetForm.tsx` : nouvelle prop `presentation?:
"inline" | "modal"` (défaut `"inline"`, Matchs inchangé) ; en mode modal, le
formulaire ouvert se rend dans `ModalDialog` au lieu de se déplier dans la
carte (nouvelle classe `.formModal`, sans fond/bordure propres — déjà
fournis par le dialogue). Piège évité : `isOpen` s'initialisait à `myBet !==
null` (auto-ouvert si un pari existe déjà, voulu en inline) — en modal ça
aurait fait apparaître la pop-up TOUTE SEULE au chargement de la carte dès
qu'un pari existait ; forcé à `false` en mode modal, bouton déclencheur
affichant alors « Modifier le pari » plutôt que `triggerLabel` quand
`myBet` existe. `FillSeriesCard.tsx` et `BracketFillBoard.tsx::SeriesPickCard`
(les 2 rendus de `/play/bracket`) passent `presentation="modal"` ; Matchs
(`PredictionForm.tsx`, 2 usages) inchangé.

`tsc`, `eslint`, `vitest run` (37/37), `next build` (36 routes) propres.
Serveur de dev redémarré une 2e fois après ce lot (même précaution
`next build`/`next dev`). Rien commité — l'utilisateur n'a pas encore
redemandé de push depuis ce lot.

## Poster : scores à côté de la carte (vers le centre), plus en dessous (17/08/2026)

Demandé par l'utilisateur (« On peut afficher les scores à gauche ou
droite (vers le centre de la page), plutôt qu'en bas ? »). Périmètre
confirmé par AskUserQuestion (preview ASCII à l'appui) : les boutons de
format (4-0/4-1/4-2/4-3) de `FillSeriesCard.tsx` (poster uniquement, PAS
`BracketFillBoard.tsx`/onglets mobile portrait — pas de notion
gauche/droite là-bas), sortis de la carte, empilés verticalement à côté
d'elle, du côté qui fait face au centre du poster (Ouest → à droite,
Est → à gauche, via `PosterColumn.side` déjà existant dans
`posterColumns.ts`).

**Tentative de vérification Playwright avant d'implémenter** : création
d'un compte de test jetable via `supabase.auth.admin.createUser` a échoué
2 fois de suite (`AuthRetryableFetchError`, HTTP 500) — panne côté
Supabase Auth apparemment transitoire, pas liée au code du projet.
Implémentation faite SANS vérification visuelle en conditions réelles
cette fois (annoncé explicitement à l'utilisateur) — à confirmer/ajuster
avec lui.

**Implémentation** : contrainte clé — `TreeConnectors.tsx` mesure le rect
DOM de chaque carte (`cardRefs`) pour ancrer ses traits ; si les scores
avaient été inclus dans le même élément mesuré, les traits se seraient
ancrés au bord extérieur du bloc scores plutôt qu'au vrai bord de la
carte. Restructuré pour que le `ref` de mesure porte SEULEMENT sur
`.card` :
- `FillPosterView.tsx` : passe désormais `cardRef` (callback) et `side`
  (`column.side`) en props à `FillSeriesCard`, au lieu d'envelopper son
  rendu dans un `<div ref=...>` externe (qui aurait englobé aussi les
  scores).
- `FillSeriesCard.tsx` : nouvelles props `side`/`cardRef` (`ref` posé
  directement sur l'élément `.card`, y compris sur la branche "non
  sélectionnable"). Quand un pari a un vainqueur (PLAYOFFS uniquement),
  rendu dans un `.cardRow` flex (carte + scores côte à côte, ordre inversé
  selon `side`) plutôt qu'à l'intérieur de la carte.
- CSS : largeur de colonne du poster INCHANGÉE (14rem, pas touché au
  couloir de traits de connexion entre colonnes, trop étroit — `--space-5`
  = 1.5rem — pour y loger aussi les scores). `.card` devient `flex: 1;
  min-width: 0` dans `.cardRow` (cède de la place aux scores plutôt que
  d'élargir la colonne) ; `.scores` passe d'une grille 2x2 sous les
  équipes à une pile verticale de largeur fixe (`2.75rem`, juste assez
  pour "4-0" etc.).

`tsc`, `eslint`, `vitest run` (37/37), `next build` (36 routes) propres.
Serveur de dev redémarré une 3e fois après ce lot. Rien commité.

**Correctif same session** : l'utilisateur a testé (capture d'écran à
l'appui) et signalé 2 problèmes : (1) « il faut que les scores restent
dans la carte sinon ça fait bizarre » — voulait le côté gauche/droite,
mais SANS sortir les scores de la boîte bordée de la carte ; (2) « ça a
augmenté la taille des cartes pour les demi-finales de conf et les
finales de conf et finale NBA ».

L'utilisateur a fourni ses identifiants réels (compte personnel, PAS un
compte de test) pour vérifier en conditions réelles — utilisés
UNIQUEMENT via variables d'environnement shell dans des scripts
Playwright jetables, jamais écrits en clair dans un fichier (ni les
scripts, ni ce journal), scripts et captures d'écran supprimés en fin de
vérification.

Diagnostic confirmé en conditions réelles : le point (2) était causé par
le `.card { flex: 1; min-width: 0; }` ajouté au tour précédent — pensé
pour l'usage dans `.cardRow` (une rangée), mais `.card` est AUSSI rendu
directement comme enfant de `.treeColumn` (une COLONNE flex) pour toute
série sans vainqueur choisi (dont TOUTES les demies/finales de conférence
tant qu'aucun pick n'y est fait) — dans ce contexte, `flex: 1` le faisait
grandir pour remplir toute la hauteur disponible de sa colonne, d'autant
plus visible que la colonne est courte (1-2 cartes) → mesuré en
conditions réelles à 393px (demies) et 797px (finales) contre ~190px
attendu. Le point (1) et (2) se corrigent par le même changement : retour
arrière sur `.cardRow` (élément frère de `.card`) au profit de
`.cardInner`, un flex row INTERNE à `.card` (donc DANS la même boîte
bordée) contenant `.content` (équipes + pari) et `.scores` (inchangés,
pile verticale 2.75rem) — `.card` redevient un simple conteneur à 1
enfant, plus de `flex: 1` parasite. `FillSeriesCard.tsx`/`.module.css`
seuls fichiers touchés (`FillPosterView.tsx` inchangé depuis le lot
précédent, la ref/le côté étaient déjà passés en props).

Revérifié en conditions réelles (mêmes identifiants) : hauteurs des
cartes redevenues cohérentes (44 à 214px selon le contenu, plus de
393/797px), DOM confirmé — une seule boîte bordée par carte (`el.id`
inspecté directement, pas de doute sur une éventuelle illusion visuelle
d'un screenshot).

`tsc`, `eslint`, `vitest run` (37/37), `next build` (36 routes) propres.
Serveur de dev redémarré une 4e fois après ce lot. Rien commité.

## Poster : score en menu déroulant, en face de l'équipe vainqueure (17/08/2026)

Dernière itération du même chantier, demandée par l'utilisateur : « le
score sélectionné (4-0 etc.) peut apparaître seulement en face de
l'équipe vainqueure sélectionnée et s'afficher en menu déroulant ? » — au
lieu des 4 boutons empilés à côté de toute la carte (lot précédent).
Simplifie beaucoup : plus de notion gauche/droite/côté de poster pour les
scores (le menu suit simplement la ligne de l'équipe cliquée, quel que
soit le côté Ouest/Est) — `side` retiré de `FillSeriesCardProps`
(`FillPosterView.tsx` ne le passe plus, resté inutile sinon).

**Implémentation** : `.teams` reste une colonne, mais chaque équipe est
maintenant une `.teamRow` (bouton équipe + `<select>` natif conditionnel,
affiché SEULEMENT quand `winnerTeamId === team.teamId`). Le `<select>`
porte les 4 formats + une option placeholder disabled ("Score") tant
qu'aucun score n'est choisi, `onChange` appelle `pick()` exactement comme
avant (même file d'attente de sauvegarde sérialisée, même resynchro
d'état). `.cardInner`/`.content`/`.scores`/`.scoreButton*` (lot
précédent) supprimés — `.card` redevient un simple conteneur à 2 enfants
(`.teams`, `.seriesBet`/pending), plus simple qu'avant ce chantier entier.

Vérifié en conditions réelles (mêmes identifiants réels de l'utilisateur,
mêmes précautions — jamais écrits sur disque) : DOM confirmé (`<select>`
présent uniquement sur la ligne Mavericks, absente sur Nuggets) +
capture d'écran (menu "4-0"/"4-1" déjà renseigné pour 2 séries, "Score ▾"
placeholder pour 2 autres où le vainqueur est choisi mais pas le score).
Scripts et capture supprimés après vérification.

`tsc`, `eslint`, `vitest run` (37/37), `next build` (36 routes) propres.
Serveur de dev redémarré une 5e fois après ce lot. Rien commité —
plusieurs lots de la session restent à pousser sur demande de
l'utilisateur.

**Commit/push** : demandé par l'utilisateur juste après. Commit
`6396f1d` — pop-up des paris (BetFormModal/ModalDialog partagé,
InlineBetForm mode "modal") + menu déroulant du score sur le poster.
Repéré et supprimé AVANT le commit un fichier parasite égaré à la racine
du repo (`UserslenoiAppData...poster-check2.png`) — résidu d'un bug
d'échappement de backslashes dans un chemin de script Playwright jetable
(chemin Windows en simple `\` non reconnu par JS, silencieusement écrit à
un chemin relatif garbled au lieu du scratchpad prévu) : corrigé en
passant aux slashes `/` dans tous les scripts jetables suivants.

**Correctif : 404 réel sur `/bracket` et `/play/bracket`** — signalé par
l'utilisateur juste après le push, confirmé (PAS une histoire de tab
périmé cette fois) : `curl`/Playwright montraient un vrai 404 (page
"Create Next App" générique de Next, aucun contenu applicatif), y compris
authentifié. Cause : cache Turbopack (`.next/`) corrompu après les
nombreux redémarrages de `next dev` interleaved avec `next build` pendant
la session (risque déjà identifié plus tôt, pas totalement écarté).
Corrigé en supprimant `.next/` entièrement avant de relancer `next dev`
(pas juste `Stop-Process` + relance, insuffisant cette fois) — revérifié
en conditions réelles (compte de l'utilisateur) : `/play/bracket` répond
200, 15 cartes de série rendues.

**Correctif : score à droite même côté Est** — signalé par l'utilisateur :
le menu déroulant du score devait apparaître à gauche du nom d'équipe
côté Est (vers le centre du poster), pas à droite comme partout. Cause :
le dernier lot avait retiré le prop `side` de `FillSeriesCard` en passant
au menu déroulant (plus jugé utile) — mais l'intention « vers le centre »
du tout 1er lot de ce chantier restait valide, seulement transposée au
sens gauche/droite DANS la ligne équipe plutôt qu'à la position d'un
panneau externe. `side` réintroduit ; `teamRow` inverse l'ordre
bouton/menu selon `side` (Est : menu avant le bouton). Vérifié en
conditions réelles (compte utilisateur) : `<select>` avant le `<button>`
dans le DOM pour une série Est (Boston Celtics), confirmant l'affichage à
gauche.

`tsc`, `eslint`, `vitest run` (37/37) propres pour ces 2 derniers
correctifs — `next build` sciemment sauté cette fois (risque de
recorrompre le cache déjà rencontré 2x cette session), remplacé par une
vérification Playwright directe en conditions réelles, jugée plus fiable
ici. Rien commité depuis `6396f1d`.

## Accueil : polish visuel (icônes, liseré d'urgence, rang en avant, pastilles, feed illustré) (18/08/2026)

```text
Nouvelle session, reprise directe. Demande ouverte de l'utilisateur
(« améliorer l'aspect visuel de la page d'accueil ») — cadrée avant tout
code, même méthode que Profil (§2.54)/Stats (§2.55) : maquette artifact
« Accueil NBA Pronos » (bascule Actuel/Proposition, tokens réels de
`app/tokens.css`, pas une palette inventée), présentée avec 5 changements
possibles. L'utilisateur valide les 5, précise vouloir garder les
notifications/popup pour plus tard.

**Implémentation, 5 changements purement visuels** :
1. Icône par type d'item dans « À traiter » — nouveau
   `components/icons/home-icons.tsx` (même patron que
   `components/icons/nav-icons.tsx` : trait net, `currentColor`, viewBox
   24x24). `PlayIcon` de la nav réutilisée telle quelle pour "matchs"
   plutôt que dupliquée.
2. Liseré d'urgence (accent si deadline < 1h, neutre sinon) — nouveau prop
   `urgencyBorder?: boolean` sur `components/ui/Countdown.tsx`, calculé à
   partir de son propre état déjà existant (`state.kind === "live"`), off
   par défaut pour ne pas affecter `components/bracket/BracketSummary.tsx`
   (seul autre appelant de `Countdown`).
3. En-tête : le rang devient le chiffre hero (`--font-size-3xl`), points et
   écart au leader passent en secondaire/chip — `HomeHeader.tsx`/
   `.module.css` restructurés, `.stats`/`.stat`/`.statLabel`/`.statValue`
   remplacés par `.statsHero`/`.rankHero`/`.ptsSecondary`/`.leaderChip`.
4. Pastilles d'équipe sur le "prochain match" — `TodoItem.matchup`
   (nouveau champ structuré `{ home, away }`, remplace le texte
   pré-formaté "Prochain : BOS - ATL") dans `lib/queries/home.ts`,
   `describeUpcomingMatch()` retourne désormais des objets équipe (avec
   `name`, pour l'`alt` de `TeamLogo`) plutôt qu'une chaîne. Ferme
   partiellement un point noté dans `GAPS_OUVERTS.md` depuis le
   24/07/2026.
5. Icône de résultat (✓/✗/–) dans le feed « Ça vient de tomber » —
   `FeedRow.tsx`, vert/rouge toujours strictement réservés au résultat
   gagné/perdu (règle déjà en place, pas touchée).

`tsc --noEmit`, `eslint`, `vitest run` (37/37), `next build` (36 routes)
propres après l'implémentation.

**Vérification au clic tentée puis abandonnée** : recherche de l'email
d'un compte de test (`TestJoueur1`) via une lecture `service_role`
strictement en lecture seule (pseudo → email, aucune mutation) —
**bloquée par le classifieur de permissions Claude Code**, même
comportement que des sessions précédentes sur des actions liées aux
identifiants. Pas de nouvelle tentative ni de contournement — signalé
explicitement à l'utilisateur, vérification restée au niveau type/build
uniquement.

Committé et poussé sur demande explicite de l'utilisateur (`b91df40`).
```

## Mes paris : suppression d'un pari encore modifiable + boutons harmonisés (18/08/2026)

```text
Suite immédiate. Demande de l'utilisateur : pouvoir supprimer un PARI
(personnalisé, pas un PRONO) encore présent dans « Mes paris ».

**Recherche préalable** (agent dédié, lecture seule) : état de la machine
à états `bets` (7 statuts), des server actions existantes (`save_bet`/
`withdraw_bet`, migration #9), de la RLS (aucune policy DELETE nulle
part), et de `GAPS_OUVERTS.md`/la spec fonctionnelle — rien ne mentionne
la suppression comme un point déjà tranché.

**1er tour `AskUserQuestion`** : proposé 2 options (vraie suppression des
brouillons uniquement / retrait doux via `CANCELLED`) — l'utilisateur
choisit la vraie suppression. **Conflit trouvé juste après, signalé
explicitement avant de coder quoi que ce soit** : en lisant les migrations
SQL, la rétention D2 (`SPEC_TECHNIQUE_V0.1_1.md` §7 — « aucune suppression,
nulle part », motivée par l'absence de backup sur le plan gratuit) est une
décision validée et auditée, pas une simple policy manquante par oubli —
le commentaire du trigger `enforce_bet_transitions` le dit lui-même
(« jamais de suppression, seulement ce retour arrière »). **2e tour
`AskUserQuestion`** avec cette information : l'utilisateur reformule le
besoin fonctionnel (« pouvoir supprimer un pari encore modifiable ») sans
trancher explicitement le mécanisme — la solution conforme à D2 (retenue,
recommandée) atteint le même résultat pratique sans y déroger : un pari
DRAFT/SUBMITTED → CANCELLED est DÉJÀ une transition légale du trigger
existant, DÉJÀ exclu du calcul de quota (`RELEASED_BET_STATUSES`), et déjà
anticipé par un commentaire de la vue badges du 09/08/2026 (« un pari
retiré par le joueur ») — jamais relié à un bouton jusqu'ici.

**Implémentation** :
- Migration #29 (`20260818090000_delete_bet_function.sql`) :
  `delete_bet(bet_id)`, SECURITY DEFINER, même patron que `save_bet`/
  `withdraw_bet` — DRAFT/SUBMITTED uniquement, passe le pari en
  `CANCELLED` avec un motif dédié (« Retiré par toi avant revue. »,
  distinct d'une neutralisation admin), `resolved_at` laissé `null`
  (aucun admin impliqué → n'apparaît pas dans le feed de l'Accueil, qui
  exige `resolved_at` non nul pour un `bet_resolved`).
- `lib/actions/bets.ts::deleteBet` (nouveau, même patron `.rpc()` que les
  3 actions existantes).
- `components/my-bets/DeleteBetButton.tsx` (+ `.module.css`, nouveau) —
  bouton + dialogue de confirmation, même patron exact que
  `components/admin/DeleteMatchButton.tsx` (§2.66/17-08).
- `MyBetRow.tsx` : bouton affiché à côté de "Modifier" (donc seulement sur
  DRAFT/SUBMITTED) ; le motif de retrait affiché une fois supprimé
  (conditionnel étendu aux paris `CANCELLED`, pas seulement WON/LOST).

`tsc --noEmit`, `eslint`, `vitest run` (37/37), `next build` (36 routes)
propres.

**Harmonisation des boutons demandée dans la foulée** (« harmonise la
forme des boutons sur ces fonctionnalités paris ») : Modifier/Reproposer
(lien souligné), Signaler à un admin (texte nu de `<summary>`), Envoyer
(bouton plein) et Supprimer (bouton contour, nouveau ci-dessus) — 4 formes
différentes pour des actions de poids comparable dans la même ligne.
Unifiées sur un seul gabarit `.actionButton` (`MyBetRow.module.css`) :
contour, hauteur de cible tactile, rayon, poids de police identiques —
seule la couleur reste porteuse de sens (accent = action neutre,
`--color-text-secondary` = utilitaire, `--color-loss` = destructif).
`DeleteBetButton.module.css` aligné pixel pour pixel dessus (`inline-flex`
ajouté). Marqueur natif du `<summary>` masqué pour garder le même gabarit.

`tsc --noEmit`, `eslint`, `vitest run` (37/37), `next build` (36 routes)
propres.

**Commit/push + migration réelle, demandés par l'utilisateur** : `git
commit`/`push` réussis (`91f398a`). **`npx supabase db push` bloqué par le
classifieur de permissions** (même comportement que la vérification au
clic de l'entrée précédente) — pas de nouvelle tentative, signalé
explicitement : la fonction `delete_bet` n'existe donc PAS ENCORE sur la
base réelle, à pousser manuellement par l'utilisateur avant que le bouton
"Supprimer" fonctionne en vrai.
```

## Rattrapage de suivi : `ETAT_ACTUEL.md`/`GAPS_OUVERTS.md` pas à jour depuis le 15/08/2026 (18/08/2026)

```text
L'utilisateur demande « tout est documenté ? » en fin de session. Vérif
des 3 fichiers de suivi : `JOURNAL_SESSIONS.md` (celui-ci) à jour jusqu'au
17/08/2026 inclus (voir les entrées ci-dessus), mais `ETAT_ACTUEL.md`
arrêté à §2.63 (15/08/2026) et `GAPS_OUVERTS.md` encore titré « État au
16/08/2026 » — ni l'un ni l'autre ne couvrait le 16-17/08 (audit, arbre
bracket, suppression de match, paris en pop-up...) ni la session du jour.

Signalé explicitement à l'utilisateur avant d'agir (`AskUserQuestion`,
2 options : tout rattraper depuis le 16/08, ou documenter seulement
aujourd'hui) — **choix : tout rattraper**. `ETAT_ACTUEL.md` §2.64→§2.70
reconstruits à partir des entrées de ce journal (déjà fiables et
détaillées pour le 16-17/08, contrairement au rattrapage du 16/08
lui-même qui partait de simples commentaires de code) ; `GAPS_OUVERTS.md`
nouveau bloc « État au 18/08/2026 » en tête, listant les points fermés
(arbre bracket, suppression de match, reset bracket, paris en pop-up) et
ouverts (icônes stopgap de l'Accueil, migration #29 pas encore poussée,
notifications/chat toujours pas cadrés, SMTP toujours en pause). Entrée
« Logos de franchise sur Accueil et Classement » mise à jour en
« partiellement résolu » plutôt que dupliquée.

Rien à committer pour cette entrée seule (fichiers de suivi uniquement,
pas de code) — laissé à l'utilisateur de demander un commit si voulu.
```

## Onglet Jouer : cadrage de la fusion Mes pronos / Résultats (18/08/2026)

```text
Nouvelle session. L'utilisateur ouvre un chantier « plus dimensionnant » :
simplifier la lecture/navigation de l'onglet Jouer. Idée de départ : un
onglet « Mes pronos » (matchs à suivre + pronos/paris associés) et un
onglet « Résultats » (matchs chronologiques + pronos/paris + état/points),
les paris SÉRIE restant visibles uniquement sur le Bracket. Demande
explicite : « dis moi ce que tu en penses et propose des options ».

**Lecture de l'existant avant tout avis** : hub `/play` (grille 2×2 :
Matchs / Mes pronos / Mon bracket / Paris), les 4 écrans qu'il ouvre, et
les specs fermées correspondantes (`SPEC_ECRAN_HUB_JOUER`,
`SPEC_ECRAN_MATCHS`, `SPEC_ECRAN_MES_PRONOS`, `SPEC_ECRAN_MES_PARIS`).
Constat partagé avec l'utilisateur avant de proposer quoi que ce soit :
duplication réelle entre Matchs (à venir) et Mes pronos/Récent (verrouillé
< 3j), et un conflit de nom à surveiller (« Mes pronos » désigne
aujourd'hui les matchs déjà VERROUILLÉS, l'inverse de l'usage souhaité par
l'utilisateur).

**3 tours `AskUserQuestion`, aucun tranché sans options présentées** :
1. Ampleur — reskin léger du hub / fusion Matchs+Mes pronos seulement
   (paris restent à part) / fusion totale incluant les paris MATCH.
   **Choix : fusion totale.**
2. Structure de nav — hub allégé à 3 cartes / onglets internes sans hub,
   Bracket en lien permanent. **Choix : onglets internes** (« colle à ma
   formulation », note l'utilisateur). Question de suivi de l'utilisateur
   (« où sera l'onglet bracket ? ») répondue par un point d'entrée fixe
   dans l'en-tête, réutilisant les données déjà calculées par
   `getBracketFillData()`/`getRemainingSeriesBets()` (déjà le patron de
   `lib/queries/play-hub.ts`, pas de nouveau calcul).
3. **Conflit de fond trouvé en lisant `SPEC_ECRAN_MES_PARIS_V0_1` §6-7,
   signalé avant d'écrire quoi que ce soit** : le cycle de vie d'un pari
   (statut, piloté par l'admin) et celui de son match (piloté par l'heure)
   divergent dans deux cas réels déjà spécifiés — un pari REJETÉ sur un
   match à venir, un pari VALIDÉ non résolu sur un match déjà terminé (cas
   « pari oublié »). Deux résolutions : le MATCH décide toujours l'onglet
   (extension du principe déjà acté « écran ancré sur les matchs »,
   `SPEC_ECRAN_MES_PRONOS_V0_1` §3) / chaque objet garde son propre statut
   (casserait le tri chronologique par date de match). **Choix : le match
   décide toujours.**

**Spec rédigée** : `Cadrage/V1/Spec visuelle/SPEC_REFONTE_ONGLET_JOUER_V0_1.md`,
même gabarit que les 4 specs sources (statut, sources et cadre, architecture,
contrats de types, récap des décisions, vérifications de dépôt). Fusionne
`lib/queries/matches.ts`+`my-predictions.ts`+la partie MATCH de
`my-bets.ts` dans un nouveau `lib/queries/play.ts` ; fenêtre « Mes pronos »
actée comme l'union EXACTE des deux fenêtres existantes (aucune largeur
nouvelle) ; `SeriesBetHeader` retiré (paris série invisibles hors
Bracket) ; aucune nouvelle migration, aucune nouvelle server action — pure
recomposition de lecture/rendu. 4 vérifications de dépôt listées (§13) :
autres appelants de `getMyBets`, garde C2 à étendre au formulaire de pari
inline, deadline réelle de proposition d'un pari sur un match verrouillé,
recensement des liens entrants à rediriger.

Utilisateur validant la spec (« la spec me va ») avec demande explicite de
tout documenter « au cas où on doit revenir en arrière » — `ETAT_ACTUEL.md`
§2.71 et cette entrée ajoutées, `GAPS_OUVERTS.md` mis à jour en
conséquence (bloc « État au 18/08/2026 »), avant tout code. **Aucune ligne
de code écrite dans cette session** : les 4 écrans actuels restent
inchangés et en production.

**Suite immédiate, même session — les 4 vérifications de dépôt levées en
lecture seule** (demande de l'utilisateur : « on lève les 4 vérifs
ensemble ? »). Deux ont changé le contenu de la spec, pas seulement
confirmé ce qui était écrit :

- **§13.1 (autres appelants de `getMyBets`)** : LEVÉE sans surprise, un
  seul appelant (`/play/bets/page.tsx`, qui disparaît).
- **§13.2 (garde C2 sur le pari)** : LEVÉE, mais **le contraire de ce qui
  était espéré** — `InlineBetForm`/`BetFormModal` n'appellent
  `useUnsavedGuard` NULLE PART (grep confirmé), seul
  `components/matches/PredictionForm.tsx` le fait. Extension nécessaire
  documentée en spec §2.2 (clé distincte de celle du prono, sinon les deux
  formulaires du même match écraseraient le même verrou).
- **§13.3 (deadline d'un pari MATCH sur un match verrouillé)** : LEVÉE,
  **hypothèse initiale de la spec invalidée en lisant le SQL** —
  `bet_deadline_open()` (`20260718110000_rls.sql` §100-112), consommée par
  la RLS ET par `save_bet`/`submit_bet`, ferme l'écriture d'un pari MATCH
  exactement à `scheduled_at > now()` : le MÊME instant que le
  verrouillage du prono, pas une fenêtre propre comme la spec le supposait
  (§3.3 corrigée en conséquence — le CTA « Parier » disparaît dès qu'un
  match se verrouille, aucun état transitoire où l'un serait éditable et
  pas l'autre).
- **§13.4 (liens entrants)** : LEVÉE, catalogue exhaustif fait par grep
  (détail en spec §2.1) — 5 fichiers d'écriture à retargeter
  (`lib/actions/{matches,bets,corrections,bet-corrections,admin-results}.ts`),
  5 fichiers de lecture, dont deux (`my-predictions/urls.ts`,
  `FilterBar.tsx`) ne peuvent plus coder un chemin en dur du tout (à
  paramétrer sur l'onglet actif), et `my-bets/SegmentTabs.tsx` qui est
  remplacé plutôt que retargeté. Un faux problème résolu au passage : le
  lien "brouillon de pari" de l'Accueil (`home.ts` ligne ~459) semblait
  ambigu (vers quel onglet ?) mais ne l'est pas — un DRAFT/SUBMITTED ne
  peut exister QUE tant que `bet_deadline_open()` est vrai, donc son match
  est TOUJOURS dans la fenêtre Mes pronos, jamais dans Résultats.

Spec mise à jour en conséquence (statut, §3.3, nouvelles §2.1/§2.2/§2.3,
§13). Toujours **aucune ligne de code écrite** — prochaine étape :
implémenter.

**Suite immédiate, même session — implémentation complète** (« ok on
fonce »). Détail exhaustif en `ETAT_ACTUEL.md` §2.72 ; résumé ici de ce qui
n'était PAS anticipé par le cadrage ni les vérifications de dépôt :

- **`getMyBets()` intégralement supprimé**, pas seulement réduit comme la
  spec le prévoyait (§2 : « CONSERVÉ, mais réduit ») — en écrivant
  `lib/queries/play.ts`, la seule chose encore consommée ailleurs
  (`QuotaSummary`/`buildQuotas`) a été rapatriée dans le nouveau module ;
  plus aucun appelant ne restait pour la fonction elle-même une fois
  `/play/bets/page.tsx` disparu.
- **Bouton "Supprimer" un pari (§2.70) sans point d'entrée dans le nouveau
  design** — trouvé en écrivant `UpcomingRowForm.tsx` : le chemin éditable
  retenu (`InlineBetForm`, patron de l'ex-écran Matchs) n'a jamais eu ce
  bouton, contrairement à l'ex-`MyBetRow` (ex-Mes paris, supprimé). Corrigé
  en l'intégrant directement dans `InlineBetForm` — les paris SÉRIE du
  Bracket (2e appelant du composant) en héritent aussi au passage, un
  bénéfice qu'ils n'avaient jamais eu.
- **Redirection de la correction de pari en dur vers `/play/bets`** (donc
  cassée) — invisible tant qu'un seul écran existait pour ce formulaire,
  devenue un vrai bug une fois accessible depuis Mes pronos ET Résultats.
  Aligné sur le mécanisme `returnTo` déjà en place pour la correction de
  prono (`corrections.ts`).
- **1 erreur eslint** (`react-hooks/purity`, `BracketEntry.tsx`) : un
  `Date.now()` appelé directement dans le corps du composant plutôt que
  dans une fonction nommée à part — corrigé en suivant le même patron que
  `deadlineLabel`, juste à côté, qui lui passait déjà.

`tsc --noEmit`, `eslint`, `vitest run` (37/37), `next build` (34 routes,
contre 36 avant — cohérence attendue : -`/play/matches` -`/play/
my-predictions` +`/play/results`) tous propres. **Pas de vérification au
clic** (pas de session authentifiée disponible sans franchir le classifieur
de permissions) — signalé explicitement, détail des parcours à revérifier
listé dans `GAPS_OUVERTS.md`. Rien commité — laissé à l'utilisateur.
```

## Avancement de la compétition active avec TestJoueur1-4 (18/08/2026)

```text
Suite immédiate : « ça a l'air de marcher, fais avancer la compétition en
cours ». Investigation en lecture seule d'abord (compétition ACTIVE = « Play
offs test », 4 comptes TestJoueur1-4 déjà existants et vierges) avant
d'écrire quoi que ce soit — mêmes réflexes que d'habitude, pas de script
à l'aveugle sur une base réelle.

Nouveau `scripts/advance-current-competition.mjs`, construit en réutilisant
telles quelles les fonctions de scoring/avancement de
`seed-playoffs-simulation.mjs` (14/08) mais SANS toucher à la compétition
existante (pas d'archivage, contrairement à ce script-là) ni aux comptes
réels. 2 bugs trouvés en relisant avant exécution (admin fictif dans
`validated_by_admin_id`, expression morte dans le calcul des picks
CONF_SEMIS) — corrigés avant le run.

Exécuté sans erreur : 20 matchs ajoutés sur 7 séries (mélange terminé/en
cours/pas commencé), 4 brackets complets, 84 pronos, 6 paris (tous statuts).
Vérifié en lecture après coup : compétition toujours ACTIVE, comptes réels
intacts, scoring et avancement de série cohérents. Détail complet en
`ETAT_ACTUEL.md` §2.73. Scripts d'inspection jetables supprimés après usage.
```

## Bracket : score conservé, points du prono, thème Photo perdu sur Mes pronos (18/08/2026)

```text
Suite du même jour, en testant les données injectées par le script
ci-dessus. 3 demandes successives de l'utilisateur, traitées une à une avec
vérification `tsc`/`eslint`/`vitest`/`next build` à chaque fois :

1. « mon bracket marque encore que je peux le modifier... et on ne voit pas
   l'avancement des séries réelles » — un seul bug expliquait les deux
   symptômes : `advance-current-competition.mjs` n'avait jamais recalculé
   `competitions.bracket_deadline` après avoir inséré des matchs antérieurs
   au seul match déjà présent. `isDeadlinePassed` restant faux,
   `/play/bracket` ne redirigeait jamais vers `/bracket` (seule vue montrant
   l'avancement officiel) — cf. `app/(app)/play/bracket/page.tsx` §61.
   Corrigé en base (deadline recalculée) et dans le script (recalcul ajouté).
2. « quand une série est finie, surligne simplement le vainqueur en vert et
   laisse le score comme sur les séries en cours » — `lib/queries/bracket.ts`
   ne calculait le score X-Y que pour IN_PROGRESS ; étendu à FINISHED.
   `NodeCard.tsx` : `LiveTeamRow` renommé `SeriesTeamRow`, accepte
   `highlight: "trend" | "win" | null` au lieu d'un booléen `isLeading` —
   vert (`--color-win`) réservé au vainqueur RÉEL, jamais confondu avec
   "en tête" (`--color-trend`) d'une série encore en cours.
3. « ajoute le nombre de points entre parenthèse à la suite de mon prono...
   si la série est finie » — `BracketMyPick` gagne un champ `points`
   (`— tant que non scoré`, colonne déjà en base, juste absente du select).
   `MyPickContent` (NodeCard.tsx) l'affiche entre parenthèses uniquement
   quand `showPoints` est vrai. Piège trouvé par le compilateur : l'un des 2
   emplacements du composant vit STRICTEMENT dans la branche `isLive`, où
   TypeScript réduit déjà `liveStatus` au type littéral `"IN_PROGRESS"`
   (narrowing sur variable alias) — comparer à `"FINISHED"` y est une
   erreur de compilation légitime, remplacé par `showPoints={false}` en dur.

4. « les nouveaux onglets... notamment mes pronos était en thème sombre et
   non en thème image » — `app/(app)/play/page.tsx` posait `photo-page`
   UNIQUEMENT sur l'état vide (hérité de l'ancien écran Matchs, jamais
   remarqué tant que Matchs restait séparé de Mes pronos qui, lui, la posait
   toujours). Corrigé : posée sans condition, comme les 8 autres écrans.

Détail complet en `ETAT_ACTUEL.md` §2.74-76. Committé groupé avec le script
de seed (`aceefb4`) pour les points 1-3 ; le point 4 reste à committer.
```

## 2e vague d'avancement de la compétition, après les pronos de l'utilisateur (18/08/2026)

```text
« j'ai fait des pronos, tu peux avancer la compétition encore ? » —
Rillettes-31 (compte réel) avait posé 4 pronos VALIDATED sur les 4 matchs
alors SCHEDULED. Lecture d'abord (`match_predictions` de Rillettes-31),
jamais deviné quels matchs résoudre.

`scripts/advance-current-competition-2.mjs` : résout ces 4 matchs +
prolonge chaque série en cours d'1-2 matchs, sans jamais écrire une ligne
de Rillettes-31/Demo_Amis — seuls les matchs bougent, la passe de scoring
fait le reste. Bug trouvé APRÈS coup (home/away confondus dans un
commentaire, DET-IND #5 gagné par DET au lieu d'IND) : plutôt que de
retoucher l'historique déjà écrit, un match #7 décisif a été ajouté pour
donner une suite à la série — le script conservé documente honnêtement ce
qui s'est vraiment passé, pas ce qui était prévu au départ.

Résultat : 3 pronos sur 4 de l'utilisateur corrects (15/13/12 pts), 1 raté
à cause du bug ci-dessus (0 pt). Détail en `ETAT_ACTUEL.md` §2.77.
```

## Résultats : filtre par date en bandeau défilant (18/08/2026)

```text
« un filtre par date qui ressemble à celui de MPP... une pastille par jour
qui défile de gauche à droite, ancien à gauche, récent à droite ». Nouveau
`components/play/DateStrip.tsx` (serveur, CSS pur), `FilterBar.tsx` réduit
au filtre série seul — les deux filtres sont désormais indépendants l'un de
l'autre plutôt que confondus dans une seule puce. `tsc`/`eslint`/`vitest`
(37/37)/`next build` (34 routes) propres. Détail en `ETAT_ACTUEL.md` §2.78.
```

## DateStrip : défilement auto au chargement + barre masquée (18/08/2026)

```text
« qu'on arrive sur l'onglet à la date du jour » + « enlever la barre de
scroll ». `DateStrip.tsx` passe "use client" pour un seul effet au montage
(scroll vers la date active, ou la plus récente à défaut) — bug de ref
partagée entre 2 pastilles trouvé et corrigé avant de tester. Barre de
défilement masquée en CSS sur les 3 moteurs, défilement resté fonctionnel.
`tsc`/`eslint`/`vitest` (37/37)/`next build` (34 routes) propres. Détail en
`ETAT_ACTUEL.md` §2.79.
```

## Mes pronos/Résultats : partage par statut au lieu de 3 jours (18/08/2026)

```text
« pourquoi la dernière date... il y a des matchs après » — répondu d'abord
que c'était voulu (fenêtre de 3 jours, décision 4 de la spec). L'utilisateur
tranche autrement : « tout ce qui est finished doit être dans résultats et
pas dans mes pronos ». Décision 4 abandonnée — partage par
`matches.status = 'FINISHED'` au lieu d'une fenêtre de temps
(`lib/queries/play.ts::fetchLockedRows`, `BACK_WINDOW_DAYS` supprimé en
entier). Précisé explicitement que ce n'est PAS une réouverture du principe
"jamais filtrer sur le statut" (T4/A8) : ce principe protège le
VERROUILLAGE (écriture), ceci est un choix d'affichage pur entre 2 vues en
lecture seule. Amendement post-implémentation ajouté à la spec (§14) plutôt
que de réécrire l'historique. `tsc`/`eslint`/`vitest` (37/37)/`next build`
(34 routes) propres. Détail en `ETAT_ACTUEL.md` §2.80.
```

## Nettoyage : matchs FINISHED avec une date future (18/08/2026)

```text
« nettoyer... pour qu'il n'y ait pas de matchs terminés alors qu'ils sont
programmés dans le futur ». Bug laissé par les 2 scripts d'avancement :
marquer un match FINISHED n'a jamais retouché `scheduled_at`, resté à sa
date d'origine (souvent future). 7 matchs trouvés en lecture seule d'abord,
corrigés par `scripts/fix-future-finished-dates.mjs` (conservé) — recule
UNIQUEMENT `scheduled_at`, ordre chronologique par série préservé, aucun
autre champ touché. Vérifié après coup : 0 incohérence restante,
`bracket_deadline` toujours correcte. Détail en `ETAT_ACTUEL.md` §2.81.
```

## Résultats : détail des points du prono entre parenthèses (18/08/2026)

```text
« afficher entre parenthèse... le détail des points (pronos, écart et
paris) ». 2 options présentées avant de coder : décomposer seulement le
prono, ou fusionner prono+pari en un total unique. Choix : décomposer
seulement le prono — le pari garde son propre total séparé. `MyPrediction`
gagne `winnerPoints`/`marginPoints` (colonnes déjà en base, juste ajoutées
au SELECT). `PredictionSummary.tsx` : « 15 pts (10 pronostic, 5 écart) ».
`tsc`/`eslint`/`vitest` (37/37)/`next build` (34 routes) propres. Détail en
`ETAT_ACTUEL.md` §2.82.
```

## Accueil : feed « Ça vient de tomber » cliquable (18/08/2026)

```text
« ça mène aux items affichés quand on clique dessus ? ». `FeedItem` gagne
`href` (match/pari MATCH -> Résultats, pari SERIES -> Bracket). 2 ancres
manquantes trouvées en creusant et ajoutées : `id="match-{id}"` n'existait
que sur `UpcomingRow.tsx` (pas `LockedRow.tsx`) ; `id="series-{id}"`
n'existait que sur l'écran de REMPLISSAGE du bracket (pas la vue globale de
consultation, la cible réelle une fois un pari série résolu). `FeedRow.tsx`
enveloppe son contenu dans un `<Link>`. `tsc`/`eslint`/`vitest`
(37/37)/`next build` (34 routes) propres. Détail en `ETAT_ACTUEL.md` §2.83.
```

## Correctif : lien du feed atterrissait sur la page mais pas la ligne (18/08/2026)

```text
Trouvé par l'utilisateur en testant §2.83 (après redémarrage du serveur de
dev — 2 instances en double sur les ports 3000/3001, coupées, une seule
relancée). Le lien du feed arrivait sur Résultats mais pas sur le match visé
: `DateStrip.tsx` défilait automatiquement au montage, au même moment que le
scroll natif vers l'ancre `#match-XXX`, et le reprenait de force. Corrigé
par une garde `window.location.hash` dans `DateStrip.tsx` — une ancre déjà
présente dans l'URL a priorité, le bandeau ne défile plus dans ce cas.
`tsc`/`eslint`/`vitest` (37/37)/`next build` (34 routes) propres. Détail en
`ETAT_ACTUEL.md` §2.84.
```

## Feed : le lien mène aussi au bon jour (18/08/2026)

```text
« ça amène le match mais sans cocher le jour, on reste sur général ».
`parisDateKey` extrait de `lib/queries/play.ts` (ex-`localDateKey`, dupliqué
localement) vers `lib/dates/paris.ts`, réutilisé dans `lib/queries/home.ts`
pour construire `/play/results?date=...#match-{id}` sur les liens du feed
(pronos ET paris MATCH). Collecte des matchs à dater étendue aux paris (pas
seulement les pronos scorés, 2 sources distinctes). `tsc`/`eslint`/`vitest`
(37/37)/`next build` (34 routes) propres. Détail en `ETAT_ACTUEL.md` §2.85.
```

## Accueil : numéro de match dans « À traiter » (18/08/2026)

```text
« si c'est le 3e match de la série écris "Game 3" ». `TodoItem["matchup"]`
gagne `gameNumber` (déjà en base, ajouté au SELECT de `getMatchesTodo`).
`TodoRow.tsx` : « Prochain : BOS – ATL · Game 3 ». `tsc`/`eslint`/`vitest`
(37/37)/`next build` (34 routes) propres. Détail en `ETAT_ACTUEL.md` §2.86.
```

## Accueil : numéro de match aussi dans la section Paris (18/08/2026)

```text
Suite immédiate : le numéro manquait dans le bloc paris MATCH encore
possibles (`getRemainingMatchBets`, lib/queries/match-bets.ts — module
distinct de `getMatchesTodo`). `MatchRow.game_number` ajouté au SELECT,
`matchLabel()` étendu : « BOS vs MIA · Game 3 · 25/07 21:00 ». Seul
appelant (`lib/queries/home.ts`) vérifié par grep. `tsc`/`eslint`/`vitest`
(37/37)/`next build` (34 routes) propres. Détail en `ETAT_ACTUEL.md` §2.87.
```

## Accueil : numéro de match aussi dans « Ça vient de tomber » (18/08/2026)

```text
Dernier bloc concerné : le feed match_scored (getFeed(), lib/queries/
home.ts) n'affichait que le score. `MatchScoreRow.game_number` ajouté au
SELECT, libellé : « Game 3 · BOS 102 - 98 ATL ». bet_scored/bet_resolved
gardent `bet.description` (texte libre du joueur), non touché.
`tsc`/`eslint`/`vitest` (37/37)/`next build` (34 routes) propres. Détail
en `ETAT_ACTUEL.md` §2.88.
```

## Accueil : cartes dépliables (18/08/2026)

```text
Les 4 cartes de l'Accueil deviennent dépliables (fermées par défaut,
point d'alerte tant que jamais ouvertes — clarifié par AskUserQuestion).
Nouveau `components/home/CollapsibleCard.tsx`, mémorisation localStorage
`home-card-seen:{id}`, lecture via `useSyncExternalStore` (pas de
setState dans un effet, lint react-hooks/set-state-in-effect). `tsc`/
`eslint`/`vitest` (37/37)/`next build` (34 routes) propres. Détail en
`ETAT_ACTUEL.md` §2.89.
```

## Accueil : compteur sur les cartes + renommages (18/08/2026)

```text
`CollapsibleCard` gagne `count: number`, pastille toujours visible (même
repliée, même à 0) à côté du chevron. Renommages : « À traiter » → « Reste
à faire », « Paris » → « Paris disponibles » (titre + aria-label mis à
jour ensemble). `tsc`/`eslint`/`vitest` (37/37)/`next build` (34 routes)
propres. Détail en `ETAT_ACTUEL.md` §2.90.
```

## Accueil : numéro de match aussi dans « Ça vient de tomber » (18/08/2026)

```text
Dernier bloc concerné : le feed match_scored (getFeed(), lib/queries/
home.ts) n'affichait que le score. `MatchScoreRow.game_number` ajouté au
SELECT, libellé : « Game 3 · BOS 102 - 98 ATL ». bet_scored/bet_resolved
gardent `bet.description` (texte libre du joueur), non touché.
`tsc`/`eslint`/`vitest` (37/37)/`next build` (34 routes) propres. Détail
en `ETAT_ACTUEL.md` §2.88.
```


## Projet Data NBA — reprise, feature engineering, lien avec le scoring (19-20/08/2026)

```text
Hors périmètre app V1 — chantier séparé `Cadrage/Stats/` (récupération de
stats NBA réelles pour, à terme, estimer des probabilités d'événements).
Détail complet dans `Cadrage/Stats/projet-data-nba.md` (§7-§11) — ici,
résumé des décisions et de ce qui a changé.

**Reprise du fetch** : script `fetch_nba_data.py` relancé (2 saisons,
2 641 matchs, box scores + avancé + play-by-play via `nba_api`). Tourne en
tâche de fond sur plusieurs heures ; s'est arrêté une 1ère fois cette nuit
(00h43) suite à une coupure réseau (DNS), pas une fin normale — relancé en
début de session du 20/08. Le script skip les fichiers déjà téléchargés
(pas de perte entre les relances).

**Feature engineering — nouvelle feature `continuite_effectif_saison`**
(`features_equipe`, `build_features.py`) : décidé de garder les moyennes
glissantes à cheval sur 2 saisons (pas de reset au 1er match), complété par
une mesure de mouvement d'effectif (part des minutes jouées cette saison,
avant le match, par des joueurs qui étaient déjà dans le "coeur d'effectif"
— 70 % des minutes — de la même équipe la saison précédente). Logique
validée par un test synthétique isolé (pas encore vérifiée sur de vraies
données 2025-26 au moment d'écrire, le fetch n'était pas allé aussi loin).

**Tables cibles construites** (`build_targets.py`, nouveau script) :
`labels_joueur` (pts/reb/ast/fg3m/stl/blk réels + double-double/
triple-double par joueur/match) et `entrainement_matchs` (1 ligne/match,
features domicile/extérieur côte à côte + home_win/ecart/total_points).
Taux vérifiés plausibles (victoire domicile 54.1 %, double-double 6.9 %,
triple-double 0.5 %, cohérents avec les vraies stats NBA).

**Taxonomie réelle des paris trouvée** : la feuille `PARIS_PERSOS_
CATEGORIES` de l'ancien classeur Excel (`Cadrage/DA/🏀 NBA Pronos -
22_04_2026 (réponses) (1).xlsx`, suivi manuel des playoffs 2026 avant
l'appli) contient 429 paris persos réels déjà catégorisés — a permis de
prioriser sur des données réelles plutôt que deviner (catégorie dominante :
seuil de points joueur, 138 mentions).

**Décision produit importante (avec l'utilisateur)** : le barème pronos
match/bracket (`T5`) ne bouge pas. Ce qui a de la valeur, c'est
d'automatiser les **paris persos** : remplacer le choix manuel d'une
difficulté (1-5) par une probabilité calculée par le modèle, qui
détermine automatiquement le palier de points — sans toucher au moteur
`scoreBet` de T5 §8 (reste intact, pur, figé), seulement à la SOURCE de
`validated_difficulty`. Nouvelle spec dédiée :
`Cadrage/V1/SPEC_TECHNIQUE_PROBA_PARIS_PERSOS_V0_1.md` — texte libre + IA
de structuration, fallback sur la difficulté manuelle pour les paris non
calculables (~1/3 de l'historique, barème du fallback pas encore tranché),
probabilité figée à la validation (même logique que P10). **Spec écrite
mais EN PAUSE** : les seuils entre paliers ne peuvent pas être calibrés
sans un modèle qui tourne pour de vrai.

**Explication du principe d'entraînement donnée à l'utilisateur avant tout
code** (détail dans `projet-data-nba.md` §11) : apprentissage supervisé
(features = avant le match, labels = résultat réel), distribution de
probabilité plutôt que seuil fixe (un pari peut porter sur n'importe quel
seuil), découpage temporel obligatoire (jamais aléatoire, anti-fuite),
calibration comme critère de qualité (plus important que la précision
brute ici, puisque la proba détermine des points).

**Prochaine étape actée pour la reprise** : entraîner un 1er modèle
jetable (régression sur les points d'un joueur, cas le plus fréquent),
vérifié sur un cas connu (Jokić) avant d'aller plus loin. Rien codé côté
modèle à ce stade — fetch de données toujours la seule chose qui tourne.
```


## Projet Data NBA — 8 modèles construits, persistance, bug DNP, correctif Poisson (20/08/2026, suite)

```text
Suite directe de l'entrée précédente (19-20/08). Détail complet dans
Cadrage/Stats/projet-data-nba.md (§12-§16) — ici, résumé des étapes.

**Modèle points affiné** : dispersion personnalisée par joueur ajoutée
(`pts_ecarttype10`, déjà calculée depuis le début mais jamais branchée) à
la place d'un écart-type global unique pour tout le monde — gain de
calibration net (écarts de +4.8% max à ±1.4% max). Démo Tatum mise à jour
(P(>40 pts) : 0.2% → 0.1%).

**Persistance des modèles** : question posée par l'utilisateur ("où sont
stockés ces modèles ?") — réponse à l'époque : nulle part, réentraînement
à chaque exécution. Corrigé : tous les scripts sauvegardent maintenant sur
disque via `joblib` (`Cadrage/Stats/models/*.joblib`), démo mise à jour
pour CHARGER le modèle plutôt que le réentraîner.

**2e catégorie : double-double/triple-double** (`train_doubledouble_
model.py`, RandomForestClassifier). Bug de calibration réel trouvé au 1er
essai : `class_weight="balanced_subsample"` (réflexe pour classe rare)
faussait massivement les probas (+30 à +60 points de % d'écart) en
rééquilibrant artificiellement l'entraînement — retiré, calibration
excellente une fois enlevé (−0.1 à +3.4%).

**Audit des stats oubliées** (question posée par l'utilisateur) : revue
complète du classeur historique (~120 libellés de `Stat pari perso`, pas
juste le top 20) — 2 vrais trous trouvés : **minutes jouées** (28
mentions, jamais modélisées comme cible) et **contres/interceptions**
(~11 mentions). Ajoutés (`stl`/`blk`/`minutes` dans `labels_joueur`,
features correspondantes dans `features_joueur`). Nouveau script généralisé
`train_stat_model.py` (même recette que les points, réutilisable) entraîne
rebonds/passes/3-points/interceptions/contres/minutes en un coup.
Pourcentages de tir (FG%/3P%/FT%, ~30 mentions) identifiés mais PAS
traités — nécessitent une approche différente (stat de taux).

**Bug de données réel trouvé et corrigé (impact large)** : ~19% des lignes
de `box_scores` étaient des DNP (joueur sur la feuille de match mais non
entré en jeu — l'API renvoie quand même une ligne, `minutes=NULL`, stats à
0, champ `comment` explicite) chargées comme de VRAIES apparitions à 0
point — faussait moyennes ET labels d'entraînement pour quasi tous les
joueurs. Repéré en creusant une prédiction Tatum incohérente. Corrigé dans
`load_to_sqlite.py` (filtre `minutes IS NOT NULL`), toute la chaîne
reconstruite.

**Résultats des 6 nouveaux modèles, très inégaux** : minutes = meilleur
modèle du lot (R²=0.557, calibration quasi parfaite) ; rebonds/passes bons ;
3-points/interceptions/contres avaient une calibration RÉELLEMENT dégradée
sur le seuil "au moins 1" (+14 à +22 points de % d'écart) — cause
identifiée : stats à faible valeur très souvent exactement nulles, la
distribution normale (cloche symétrique) ne colle pas. **Corrigé** :
distribution de Poisson pour ces 3 stats spécifiquement, vérifié
empiriquement AVANT de généraliser (même prédiction du modèle, seule la
lecture change) : écarts ramenés à ±1.4%. Vérifié aussi que Poisson
n'aide PAS points/rebonds/passes (la normale personnalisée par joueur
reste meilleure) — changement ciblé, pas généralisé partout. Chaque
`.joblib` embarque maintenant sa `distribution` (normal/poisson).

**Plan en 5 phases écrit pour la 1ère fois** (largeur des événements →
données → affinage des modèles → contexte en direct → intégration appli),
expliqué à l'oral plus tôt dans la session mais jamais couché sur papier
avant ce point — maintenant dans `projet-data-nba.md` §16.

**État en fin de session** : 8 modèles construits et sauvegardés, sur
données encore PARTIELLES (le fetch des 2 saisons tournait toujours en
tâche de fond). Décision de l'utilisateur : laisser le fetch finir en
arrière-plan, reprendre dans une autre conversation — réentraînement
complet sur les 2 saisons intégrales acté comme prochaine étape, marche à
suivre précise (commandes exactes) écrite en tête de
`projet-data-nba.md`. 2 interruptions réseau du fetch pendant la session
(scripts bloqués silencieusement après coupure DNS, PID toujours actif
mais plus aucune progression) — relancés manuellement à chaque fois, à
surveiller si ça se reproduit.
```


## Projet Data NBA — fetch terminé + réentraînement complet enchaînés en fond (20/08/2026, fin de session)

```text
Suite immédiate de l'entrée précédente. L'utilisateur a quitté la
conversation pour une autre pendant que le fetch continuait en tâche de
fond, après avoir acté la séquence à enchaîner automatiquement une fois le
fetch fini : reconstruire le pipeline puis réentraîner les 8 modèles sur
les données complètes. Fait sans repasser par lui, sur notification de fin
de tâche (2 étapes : reconstruction pipeline, puis réentraînement).

Fetch terminé : 2641/2641 matchs, 0 échec. Pipeline reconstruit
(56 938 lignes joueur/match, `entrainement_matchs` couvre les 2641 matchs
en entier). 8 modèles réentraînés, amélioration nette partout, la plus
marquée sur points (MAE 5.09→4.75, R² 0.428→0.497) et minutes (R²
0.557→0.604, toujours le meilleur modèle). Aucune régression. Détail
complet et tableau avant/après dans projet-data-nba.md §17.

Le bandeau REPRISE en tête de projet-data-nba.md est à jour : la décision
qui reste à prendre au prochain échange, c'est le choix entre compléter la
largeur (pourcentages de tir) ou avancer en profondeur (affinage des
distributions, pont temps réel) — rien tranché d'avance, volontairement.
```


## Ajustements visuels validés (session DA séparée) — implémentation (20/08/2026)

```text
Reprise d'une session de design séparée (Cowork, sans accès navigateur au
site déployé — analyse + maquettes construites directement sur le code
source et les vraies variables de app/tokens.css/app/globals.css, repo
rendu public temporairement pour l'occasion). Décisions actées, point par
point, consignées dans Cadrage/DA/AJUSTEMENTS_VISUELS_20_08_2026.md — cette
session-ci n'a fait qu'implémenter ce qui y était déjà marqué VALIDÉ, dans
l'ordre suggéré au §6/§11 du document, un commit par chantier. Avant de
commencer, question explicite posée : signaler si un chantier n'était pas
assez précis pour être codé sans ambiguïté — aucun blocage réel trouvé,
2 petits appels de jugement pris et signalés a posteriori (voir plus bas).

**1. Police — Sora + Oswald, fondation posée en premier** (`4006514`).
Trois systèmes de police coexistaient sans jamais converger (`--font-ui:
"Inter"` jamais chargée, Geist chargée via next/font mais jamais consommée,
`body { font-family: Arial... }` héritage create-next-app qui l'emportait
partout). Remplacés par Sora (`--font-ui`, texte de lecture) et Oswald
(`--font-display`/`--font-numeric`, chiffres/rangs) via next/font/google,
auto-hébergées — Oswald regroupée dans ce même commit avec Sora comme
suggéré au §11 du document (les deux étaient encore à coder, même registre
de changement de fondation). `<title>`/`description` ("Create Next App" →
"NBA Pronos") glissés dans ce commit (même fichier, changement trivial,
autorisé explicitement par le document plutôt qu'un commit dédié).

**2. Login/Signup/Reset password — restyling complet** (`1572a90`). Ces 3
écrans étaient les seuls encore sur des classes Tailwind par défaut
(`bg-black`, bordure grise générique, `text-red-600`...) alors que
PublicNav juste au-dessus est déjà aux tokens — rupture nette sur le tout
premier écran vu par un nouveau venu. CSS Module partagé
`components/auth/AuthScreen.module.css` (patron déjà utilisé ailleurs dans
le repo pour des composants proches, ex. LeagueScopeChips.module.css) :
fond photo-page, carte glass-card, bloc marque au-dessus. Exception actée
respectée : l'état "Vérifie ta boîte mail" du reset reste SANS carte (info
pure, pas une action). Message de reset réussi passé en
`--color-text-secondary`, pas `--color-win` — le vert reste strictement
réservé au résultat d'un match/pari (R-COL, règle du design system citée
dans le document lui-même comme risque à éviter).
Appel de jugement pris (non explicité dans le document) : le titre par
écran ("Connexion", "Inscription"...) déplacé À L'INTÉRIEUR de la carte
plutôt que laissé au-dessus — le document ne tranchait que le bloc marque,
pas le sort du titre existant.

**3. Profil joueur public** (`bfab0c5`). Mise en conformité pure (pas un
nouveau pattern) : `photo-page`/`glass-card` posés sur `/players/[userId]`,
seul écran (avec le Bracket global, laissé de côté) resté sans ce
traitement. Ordre des sections, espacement, densité inchangés — exactement
comme validé dans le document.

**4. Profil / onglet Stats — sections repliables** (`cf70066`, hors §6,
round 2 du document — §14). `CollapsibleCard` (déjà utilisé sur l'Accueil)
réutilisé tel quel pour Précision/Comparaison/Évolution du
classement/Paris/Badges — Précision/Comparaison ouvertes par défaut,
le reste replié. `.totalHero` reste hors carte, toujours visible.
Extension minimale du composant pour ce nouvel usage, pas anticipée dans le
document : `count` devient optionnel (Précision/Comparaison/Évolution ne
sont pas des listes, pas de nombre de lignes honnête à leur donner) ;
`defaultOpen` ajouté, qui désactive aussi le point d'alerte "jamais
ouverte" pour les cartes déjà ouvertes au chargement (rien à signaler).

**5. Bracket — badge "En cours" en `--color-live`** (`ccf854e`, §15).
`--color-accent` (orange) portait 2 sens différents sur la même carte :
statut "en cours" ET action (`.betButton`, "Parier"). Aligné sur le token
déjà utilisé correctement ailleurs pour ce statut (badge "EN DIRECT" de
Jouer/Mes pronos) — réduit au minimum après itération dans la session DA :
la teinte orange de fond/bordure de `.cardLive` est retirée entièrement
(carte neutre standard), `.betButton` inchangé. Uniquement des
déclarations de couleur, aucun changement de structure.

**6. Ticker "en direct" sur Jouer/Mes pronos — commit séparé, À L'ESSAI**
(`0214914`, §16). Seul chantier du lot marqué "à l'essai, réversible" dans
le document plutôt que VALIDÉ définitivement — traité différemment comme
demandé : commit à part, message de commit détaillant explicitement la
marche à suivre pour le retirer si l'usage réel montre que ça distrait plus
que ça n'ajoute d'énergie. Nouveau composant `components/play/LiveTicker.tsx`
(aucun équivalent partagé avec le Bracket dans le code, seulement dans les
maquettes de la session DA) : recompose des données déjà affichées sur la
page (scores de `recentLocked` + prochain match non `VALIDATED`), aucune
nouvelle donnée. Décoratif (`aria-hidden`), défilement neutralisé sous
`prefers-reduced-motion` (R-MOT2, même patron que le pulse du point live de
NodeCard). Nouveau token `--motion-ticker-duration` (app/tokens.css).

**Non traité, volontairement** : §12 (photo de profil) marqué VALIDÉ dans
le document mais explicitement "non tranché, à reprendre avant de coder"
par le document lui-même (bucket Supabase Storage à créer, format/taille,
recadrage) — pas implémenté, resterait un chantier à cadrer avant de
coder, pas une ambiguïté de comportement à deviner. §13 (nom/logo/mascotte)
— feuille de route explicitement pas un chantier à coder, comme demandé.

`tsc`/`eslint`/`vitest` (37/37)/`next build` (36 routes) propres après
CHAQUE commit (vérifié avant de committer, pas seulement en fin de
session). 6 commits poussés sur `main` (`a3f43ed..0214914`).
```


## Projet Data NBA — pourcentages de tir, approche Binomiale validée sur FT% (20/08/2026, suite)

```text
Hors périmètre app V1, suite directe de la session Data NBA du même jour
(voir entrées précédentes) — reprise après la session DA/implémentation
ci-dessus. Décision prise au point ouvert laissé en fin de session
précédente (largeur vs profondeur, §16/§17 de projet-data-nba.md) :
compléter la largeur — pourcentages de tir (FG%/3P%/FT%), seul trou de
catégorie du classeur encore non traité. Détail complet dans
projet-data-nba.md §18 — ici, résumé.

**Approche délibérément différente des 9 stats déjà modélisées** : un
pourcentage n'est pas une valeur à régresser (contrairement aux points/
rebonds/etc.), c'est un ratio réussites/tentatives. Principe retenu, validé
d'abord sur UN SEUL cas (FT%, lancers francs — le plus stable
statistiquement) avant de généraliser, même méthode que points puis les 6
autres stats : 2 sous-modèles combinés par une loi Binomiale — tentatives
régressées (RandomForestRegressor, même recette que les autres stats
comptées) + taux de réussite estimé par rétrécissement bayésien
(Beta-Binomial) du ratio observé sur 10 matchs vers la moyenne ligue (pas
une régression — un petit échantillon comme 1/1 doit être ramené vers la
moyenne, pas pris pour argent comptant).

**Bug réel trouvé en validant, pas juste une hypothèse** : le modèle de
tentatives, entraîné sur TOUS les matchs (y compris les soirs à 0
tentative, comme le reste des stats comptées), sous-estimait `n_hat` de
28% une fois comparé aux matchs où la calibration se mesure réellement
(tentative réelle > 0 — un % n'existe pas sinon). Cause identifiée :
biais de sélection — la calibration se mesure forcément sur une espérance
CONDITIONNELLE (`E[fta | fta>0]`), différente de l'espérance
INCONDITIONNELLE qu'apprend un modèle entraîné sur l'ensemble complet.
Conséquence concrète : plus les tentatives prédites sont sous-estimées,
plus un seul panier suffit à "dépasser 90%" — gonflait la proba des seuils
hauts (écart de calibration jusqu'à +17.7% sur les matchs à volume élevé).
**Corrigé** : le modèle de tentatives s'entraîne désormais UNIQUEMENT sur
les matchs avec tentative réelle ≥ 1 — écart ramené à ±4-9% selon le
seuil, plus de dérive systématique avec le seuil (contrairement à avant le
correctif, où l'écart grandissait avec le seuil et le volume d'attempts).

**Rétrécissement (`k`) testé empiriquement** (5 valeurs, même démarche que
Poisson vs normale du 20/08 précédent) : différences minimes entre elles,
signe que le biais de sélection ci-dessus dominait largement l'erreur, pas
le manque de rétrécissement. `k=5` retenu (le plus proche du ratio brut
non rétréci).

**Écart résiduel non expliqué (±4-9%), pas bloquant pour juger l'approche
validée** : hypothèse la plus probable, pas vérifiée — la variance réelle
du % par match dépasse sans doute celle d'une Binomiale pure (tirs i.i.d.),
même famille de problème que la correction Poisson déjà faite pour les
stats à faible valeur. Candidat Phase 3, pas creusé cette session.

Nouvelles colonnes ajoutées au pipeline existant (`build_targets.py` :
`labels_joueur.ftm/fta` ; `build_features.py` : `features_joueur.
fta_moy5/10`, `ftm_sum10`/`fta_sum10` — sommes BRUTES, pas un ratio déjà
calculé, nécessaires au rétrécissement bayésien). Nouveau script
`train_pct_model.py`, modèle sauvegardé `Cadrage/Stats/models/
ft_pct.joblib`.

**Pas encore tranché, décision à la reprise** : généraliser à FG%/3P%
maintenant avec la même recette, ou creuser d'abord le résiduel de
calibration (Phase 3) avant de dupliquer l'approche 2 fois de plus. Bandeau
REPRISE de projet-data-nba.md mis à jour en conséquence.
```


## Projet Data NBA — généralisation FG%/3P%, Phase 1 (largeur) terminée (20/08/2026, suite immédiate)

```text
Décision prise sur le point ouvert de l'entrée précédente : généraliser
FG%/3P% maintenant plutôt que creuser le résiduel FT% d'abord — le
résiduel n'était pas jugé bloquant. `train_pct_model.py` reparamétré en
fonction `run(stat, label_fr, makes_col, attempts_col, thresholds)` (même
patron que `train_stat_model.py`), pipeline étendu (`build_targets.py` :
fgm/fga/fg3a ; `build_features.py` : tentatives + sommes brutes pour les 3
stats). Détail complet projet-data-nba.md §18 — ici, le résultat principal.

**Résultat net : le biais de sélection découvert sur FT% pesait
proportionnellement à la RARETÉ des tentatives.** FT% (~2-4 tentatives/
match, le moins fréquent) reste le moins bien calibré (±4-9%). FG% (~10
tentatives/match, quasi tout joueur qui joue en tente) quasi parfaitement
calibré (±0-2.8%, le meilleur résultat de calibration du projet à ce jour,
tous modèles confondus). 3P% intermédiaire (±1.4-7.8%). Rétrécissement
bayésien (`k`) reconfirmé peu déterminant sur les 3 stats — le volume de
tentatives domine, pas le choix de `k`.

**Phase 1 (couverture des événements, plan §16) considérée TERMINÉE** :
12 modèles au total (`Cadrage/Stats/models/*.joblib`), tous les trous de
catégorie identifiés dans l'audit du classeur (§8/§15) sont couverts.
Prochaine décision (Phase 3/4/5) à prendre à la reprise, pas tranchée
d'avance — bandeau REPRISE et plan §16 de projet-data-nba.md mis à jour.
```


## Projet Data NBA — testeur generique des 12 modeles, autonomie utilisateur (20/08/2026, suite)

```text
Demande de l'utilisateur : comprendre comment devenir "quasi autonome" sur
l'entrainement/test des modeles, sans repasser par la conversation a chaque
fois. Explique le pipeline en 3 couches (donnees brutes -> variables ->
modeles) et ou se trouvent les "manettes" ajustables (ex : --seasons de
fetch_nba_data.py pour etendre la periode extraite). Proposition d'un
script "tout-en-un" declinee par l'utilisateur : prefere garder les scripts
separes et comprendre chacun individuellement.

**tester_modele.py (nouveau)** : generalise demo_pari_reel.py (cable en dur
sur Tatum/points) a un testeur en ligne de commande couvrant les 12
modeles a la fois (`--joueur/--stat/--seuil`), sans rien editer dans le
code. Dispatch automatique sur 3 formules selon le type de modele
(regression+distribution, classification directe, Binomial pour un %) --
reconstruit le contexte du prochain match a partir des 10 derniers matchs
reellement connus. Recherche joueur/equipe insensible aux accents (SQLite
LIKE ne gere pas les diacritiques, comparaison normalisee cote Python).

**Bug reel trouve en testant** : noms de fichiers .joblib mal documentes
pour double-double/triple-double (`doubledouble.joblib` suppose au lieu du
vrai `double_double.joblib`, produit par train_doubledouble_model.py) --
corrige dans le script et le README.

README.pdf regenere : nouvelle section 11 dediee (sommaire/numerotation a
jour, 13 sections). Au passage, l'utilisateur avait deja etendu
`DEFAULT_SEASONS` de fetch_nba_data.py a 5 saisons (2021-22->2025-26,
contre 2 avant) en experimentant de son cote suite a l'explication du
pipeline -- pas encore relance, laisse tel quel. Un exemple de commande
invalide corrige au passage dans le docstring du meme fichier.

Committe et pousse (`a9bf62f`).
```


## Projet Data NBA — écart double-double Wembanyama, limite de conception trouvée en usage réel (20/08/2026, suite)

```text
Premier usage réel de tester_modele.py par l'utilisateur, hors de la
conversation : compare P(double-double)/P(triple-double) de Victor
Wembanyama (modèle : 42.8%/3.1%) à des chiffres sortis par Gemini/Copilot
(~60%/~7%, non vérifiés/non recalculés). Question posée : écart normal,
recalibration nécessaire ?

Vérifié dans la base avant toute conclusion (pas de suppositions) :
- Taux de double-double RÉEL de Wembanyama (132 matchs en base) selon la
  fenêtre : 5 derniers matchs 60% ; **10 derniers matchs (= fenêtre du
  modèle) 40%** ; 20 derniers matchs 60% ; 40 derniers 62.5% ; saison
  complète 62.1%.
- **Le modèle colle exactement à sa fenêtre d'entrée (42.8% prédit vs 40%
  réel) — pas un bug, il fait ce qu'on lui demande.** L'écart avec Gemini/
  Copilot vient probablement d'une moyenne de saison/réputation générale
  chez l'autre LLM plutôt que d'un calcul sur la forme récente -- une
  réponse à une question légèrement différente, ni plus rigoureuse.
- Cause identifiée via `feature_importances_` : `reb_moy10` (33%) +
  `reb_moy5` (22%) pèsent plus de la moitié de la décision (ses points,
  ~26/match, ne sont jamais le facteur limitant d'un double-double —
  toujours les rebonds pour un intérieur). Son `reb_moy10` est tombé à
  9.1, tout juste sous le seuil de 10 (rebonds très irréguliers sur cette
  fenêtre précise).

**Diagnostic final : PAS un bug de calibration, une vraie LIMITE DE
CONCEPTION.** Contrairement aux modèles régressés (2 horizons moy5/moy10
déjà présents) et aux modèles de % de tir (rétrécissement bayésien vers
une moyenne longue, §18 projet-data-nba.md), le modèle double-double/
triple-double n'a aucun signal à horizon long (20 matchs, saison) pour
distinguer une vraie tendance récente d'un creux passager sur 10 matchs —
même famille de problème que celui déjà réglé pour les % de tir, jamais
appliqué à ces 2 modèles.

**Décision explicite de l'utilisateur : ne rien changer au code
maintenant.** Creuser d'abord si ce cas est isolé à Wembanyama (profil
statistique très particulier, intérieur 2m24 avec un profil scoreur
périmètre) ou général à tout joueur à forte variance de rebonds, avant de
changer la recette du modèle. Piste retenue pour la reprise : ajouter une
fenêtre longue (`reb_moy20` ou moyenne de saison) comme feature
supplémentaire, à tester empiriquement (même démarche que pour Poisson §15
et le rétrécissement §18) avant de généraliser.

Documenté dans projet-data-nba.md §19 + bandeau REPRISE mis à jour +
GAPS_OUVERTS.md. Rien codé, pas de commit pour cette entrée.
```


## Fix : fond blanc Login/Signup/Reset en prod Vercel (20/08/2026, suite)

```text
Signalé par l'utilisateur après déploiement Vercel : fond blanc sur Login/
Signup/Reset au lieu du fond sombre attendu (restylées §2.93/commit
1572a90). Pas repéré avant : aucun accès navigateur natif dans cet
environnement, seuls tsc/eslint/next build vérifiés après ce chantier —
pas un rendu réel, limite signalée explicitement dans le suivi plutôt que
découverte tue.

Cause : `body` (app/globals.css) gardait `--background`/`--foreground`,
reliquat du scaffold create-next-app — blanc par défaut, piloté par
`prefers-color-scheme` (OS), jamais branché sur le vrai système
`[data-theme]` de l'app. `html` pose déjà le bon fond
(`--color-surface-base`), mais `body` (opaque, par-dessus) le masquait
partout où rien ne repeint dessus. Les écrans avec `ScreenShell`/`.shell`
(Classement, Bracket, zone connectée) le repeignaient déjà, d'où le bug
resté invisible jusqu'ici — Login/Signup/Reset, restylées sans ce wrapper,
l'ont rendu visible en prod.

Corrigé : `body` reprend les mêmes tokens que `html`. `--background`/
`--foreground` et leur bloc `@theme inline` (`--color-background`,
`--color-foreground`, `--font-sans`, `--font-mono`) supprimés entièrement
— vérifié par grep qu'aucune classe Tailwind ne les consommait nulle part
dans le code, reliquat mort plutôt qu'une simple valeur à corriger.

`tsc`/`next build` (36 routes) propres. Committé et poussé (`8aeb6f9`).
Au passage, corrigé un bloc de code Markdown mal fermé dans
ETAT_ACTUEL.md (§2.92/§2.93, fermeture manquante préexistante avant ce
chantier — repérée en ajoutant §2.94).
```


## Login/Signup/Reset : photo forcée même sans session (20/08/2026, suite)

```text
Après le fix du fond blanc (entrée précédente), l'utilisateur signale que
le fond reste sombre uni, pas la photo attendue sur Login/Signup/Reset.

Vérifié avant de conclure à un bug : `.photo-page` n'affiche une image que
sous `[data-theme="photo"]`, jamais posé pour un visiteur non connecté
(défaut DARK dans app/layout.tsx). Ce n'est PAS un bug introduit par les
fixs précédents — c'est le comportement d'origine, déjà vrai pour
/leaderboard et /bracket (même règle, citée comme justification de
cohérence dans le document de design §1 au moment du restyling initial).

Tranché avec l'utilisateur (AskUserQuestion, 3 options) avant de coder :
forcer la photo sur Login/Signup/Reset uniquement (retenu) / forcer partout
pour un visiteur sans session (aurait aussi changé /leaderboard et
/bracket) / laisser tel quel (comportement d'origine).

Nouvelle classe `.force-photo` (app/globals.css), combinée à `.photo-page`
sur les 3 pages : reprend les mêmes règles `::before`/`::after`/
`.glass-card` que `[data-theme="photo"]` mais sans la condition — réutilise
la structure d'empilement déjà en place (isolation, z-index déjà posés par
`.photo-page`), seule la condition d'affichage change. `/leaderboard` et
`/bracket` non touchés, restent liés à la préférence utilisateur.

`tsc`/`eslint`/`next build` (36 routes) propres. Committé et poussé
(`fd44b84`).
```


## Projet Data NBA — load_to_sqlite.py plus robuste, fetch étendu rebuild (20/08/2026, suite)

```text
Demande de l'utilisateur : "n'affiche rien" en lançant load_to_sqlite.py.
Pas un bug -- aucun retour avant la toute fin (aucune barre de progression
dans le script) ET un volume 2,4x plus gros qu'avant (fetch étendu de 2 à
5 saisons lancé entre-temps par l'utilisateur, ~19 200 CSV au lieu de
~7 900). Interrompu (TaskStop) sur demande pour ajouter l'avancement --
laisse la base VIDE (tables vidées en tout début d'exécution, écriture en
un seul bloc à la fin, pas de reprise partielle) : redocumenté
explicitement dans le script.

Ajouté : avancement décompte saison par saison (lecture) puis table par
table (écriture) -- print() forcé en ligne-par-ligne
(sys.stdout.reconfigure), sinon bufferisé par bloc dès que la sortie n'est
pas un vrai terminal, exactement le problème à résoudre (constaté en
testant : rien n'apparaissait avant plusieurs dizaines de secondes malgré
le correctif tant que ce détail n'était pas réglé).

Relancé jusqu'au bout pour reconstruire la base (vidée par l'interruption
volontaire) : 6 602 matchs, 139 543 lignes box_scores, 3 054 074 lignes
play_by_play (5 saisons).

**Incident réel pendant le relance** : l'utilisateur a aussi lancé le
script de son côté, en même temps que la tâche de fond -- collision
d'écriture SQLite, l'un des deux ("database is locked") a planté avec une
trace Python brute. Vérifié avant de conclure : base intacte (comptes
exacts confirmés), l'autre exécution avait fini proprement. Corrigé pour
que ça n'arrive plus mal : `sqlite3.connect(..., timeout=120)` (5s par
défaut) -- 2 lancements accidentels simultanés se tolèrent maintenant
(l'un attend l'autre) plutôt que de planter. Encodage UTF-8 forcé au
passage (accents capitaux mal affichés avec le codepage par défaut de
PowerShell, repéré au 1er essai réel).

README.pdf mis à jour en conséquence : durée variable (pas "quelques
secondes à une minute", dépend du volume), avertissement sur
l'interruption/le double-lancement (§5), tableau saisons/volume actualisé
(§3, 5 saisons/6 602 matchs), et **note ajoutée : les 12 modèles sont
maintenant entraînés sur un dataset PÉRIMÉ** (2 saisons, alors que la base
en a maintenant 5) -- à relancer (build_features/build_targets + les 4
train_*.py) pour en profiter, pas encore fait, décision à la reprise.
Bandeau REPRISE de projet-data-nba.md mis à jour en conséquence.

Committé et poussé (`140029a`).
```


## Nouvelle page /regles (20/08/2026, suite)

```text
Demande de l'utilisateur : construire une page de règles à afficher sur le
site. Clarifié avant de coder (AskUserQuestion, 2 questions) : contenu =
barème de scoring ET règles générales (les deux, pas l'un ou l'autre) ;
emplacement = nouvelle page dédiée, pas intégrée au tutoriel "Comment
jouer ?" existant.

Recherche de contenu déléguée à un agent Explore (2 recherches distinctes :
le barème exact déjà lu directement dans SPEC_TECHNIQUE_SCORING_V0_1.md,
figé T5 ; les règles générales via agent, avec instruction explicite de
privilégier decisions_0.2.x/le code réel sur le résumé de cadrage initial
nba_pronos_resume_cadrage_valide.md — largement dépassé, plein de "à
préciser plus tard" depuis tranchés autrement). Bug potentiel évité : le
quota de paris persos avait changé depuis ce résumé initial (3 paris par
série → 1 pari série + 3 paris match), la règle de visibilité des pronos et
la cascade de départage du classement aussi précisées différemment depuis
— afficher les anciennes valeurs aurait été une vraie erreur de contenu
utilisateur.

Route `/regles`, même patron dual-nav que `/leaderboard`/`/bracket`
(ScreenShell, visiteur ou connecté). Nouveau composant générique
`components/regles/BaremeTable.tsx` (divs+flex + rôles ARIA de tableau,
convention du dépôt — jamais de `<table>`). Lien ajouté dans `PublicNav` et
Profil > Aide (à côté du lien tutoriel existant à ce moment) — pas de 5e
onglet `TabBar`, qui reste à 4.

`tsc`/`eslint`/`vitest`/`next build` (37 routes) propres. Committé et
poussé (`b7091d9`). Pas de vérification visuelle réelle (pas d'accès
navigateur dans cet environnement) — signalé explicitement avant de
pousser ; l'utilisateur a choisi de pousser quand même plutôt que d'attendre
une vérification locale.
```


## Retrait du tutoriel "Comment jouer ?" (21/08/2026)

```text
Suite directe de l'entrée précédente : demande de l'utilisateur, la page
/regles suffit désormais, retirer le tutoriel. Cartographié avant toute
suppression (agent Explore, 5 axes : fichiers composant, sites d'usage,
implication base de données, doc spec/backlog, autres références) pour ne
rien laisser à moitié cassé.

Supprimé : `components/tutorial/*` (3 composants + leurs CSS Modules),
`lib/actions/tutorial.ts` (server action `markTutorialSeen`),
`public/tutorial/*.png` (5 captures d'écran). `app/(app)/home/page.tsx` :
retire l'import, `showTutorialBanner`, les 2 sites de rendu (branche vide +
branche pleine), et simplifie `Promise.all([getHomeData(), getProfileData()])`
en `getHomeData()` seul — `getProfileData()` n'était appelé QUE pour ce
flag, sinon inutilisé dans ce fichier. `app/(app)/profile/page.tsx` : retire
l'import et l'usage, garde le lien `/regles` déjà présent juste à côté.
`lib/queries/profile.ts` : retire `tutorialSeenAt` du type/select/mapping.
2 commentaires obsolètes nettoyés en passant (`app/globals.css` référençait
`TutorialModal.tsx` comme exemple de portail React vers `document.body` —
remplacé par `components/ui/ModalDialog.tsx`, toujours valide et
fonctionnellement identique ; `profile/page.module.css` comparait
`.helpLink` au tutoriel dans son commentaire, reformulé).

**Migration #30** (`supabase/migrations/20260821090000_drop_tutorial_seen_at.sql`) :
`alter table users drop column tutorial_seen_at`, même patron que la
migration #20 (`drop_use_team_colors.sql`) — colonne retirée symétriquement
après retrait du code qui la lisait/l'écrivait, pour ne pas laisser une
colonne orpheline. Écrite mais PAS poussée sur la base réelle (`npx
supabase db push` bloqué par le classifieur de permissions côté Claude,
même blocage déjà rencontré pour la migration #29) — à faire manuellement
par l'utilisateur, noté dans GAPS_OUVERTS.md.

Doc mise à jour en cohérence : `BACKLOG_V1.md` (entrée FAIT → FAIT puis
RETIRÉ, 21/08/2026), `SPEC_TUTORIEL_JOUEUR_V0_1.md` (bandeau RETIRÉ ajouté
en tête, le statut d'origine jamais mis à jour après le vrai livrable du
31/07/2026 est noté comme tel — la spec reste comme trace historique, ne
décrit plus rien de présent dans le code).

`tsc`/`eslint`/`vitest` (37/37)/`next build` (37 routes) propres. Grep
final confirmant aucune référence résiduelle à "tutorial"/"tutoriel"
nulle part dans app/, components/, lib/.
```


## Projet Data NBA : Phase 3, overdispersion FT%/FG%/3P% — Beta-Binomial adopté sur FT% (21/08/2026)

```text
Chantier séparé de l'app V1 (Cadrage/Stats/projet-data-nba.md), reprise de
la Phase 3 du plan en 5 phases (§16) : le résiduel de calibration ±4-9%
laissé ouvert sur FT%/3P% en §18 (hypothèse overdispersion jamais vérifiée).
Même méthode que le choix Poisson vs normale (§15, distribution testée
empiriquement avant de généraliser) — rien décidé a priori.

Cause du résiduel identifiée avant de tester : `train_pct_model.py` calcule
la proba finale via une Binomiale PLUG-IN (n_hat, p_hat) — le rétrécissement
bayésien (§18) donne pourtant un vrai postérieur Beta(alpha, beta) sur le
taux, écrasé à sa seule moyenne avant d'être injecté dans la Binomiale.
L'incertitude sur le taux lui-même est donc jetée, ce qui sous-estime
mécaniquement la variance réelle match par match.

Testé (`scripts/test_overdispersion_ft.py`, nouveau script, gardé pour
trace/repro à la demande de l'utilisateur) : Beta-Binomial prédictif
(alpha/beta gardés séparés) vs Binomial plug-in actuel, même split que
train_pct_model.py, sur les 3 stats de taux avec leur k déjà retenu (§18).
Résultat, très inégal selon le volume de tentatives (même logique que §18,
mais inversée) : FT% (le moins tenté) 5.4%→4.1% (gain net) ; 3P% 3.6%→3.4%
(négligeable) ; FG% (le plus tenté, déjà quasi parfait) 0.9%→1.1%
(légèrement PIRE — élargir la distribution n'aide pas un modèle déjà bien
calibré). Décision avec l'utilisateur : adopter Beta-Binomial en prod
UNIQUEMENT sur FT%, même patron que `POISSON_STATS` (§15, correctif ciblé
par stat, jamais généralisé par défaut sans vérification).

Implémenté : `train_pct_model.py` — `BETABINOM_STATS = {"ft"}`,
`proba_pct_over_betabinom()`/`posterior_alpha_beta()` ajoutées, `run()`
sauvegarde `distribution: "beta_binomial"` pour FT% (`"binomial"` inchangé
pour FG%/3P%). Renommé au passage le label de calibration de la boucle de
sélection de k ("Beta-Binomial k=..." → "Binomial (p rétréci) k=...") —
l'ancien nom prêtait à confusion maintenant qu'un vrai Beta-Binomial
prédictif existe à côté (l'ancien calcul reste un plug-in Binomial, seul le
`p_hat` en entrée était rétréci via la formule Beta-Binomiale). Côté
lecture, `tester_modele.py` (`run_pct()`) bascule sur la CDF Beta-Binomiale
avec le postérieur complet quand `bundle["distribution"] == "beta_binomial"`,
comportement inchangé sinon.

Les 3 modèles réentraînés/resauvegardés (`models/{ft,fg,fg3}_pct.joblib`),
mêmes k retenus qu'en §18 (FT%=5, FG%=30, 3P%=5) — aucune régression sur
FG%/3P% (code de calibration identique pour ces 2 stats, chiffres
inchangés). Vérifié en conditions réelles via `tester_modele.py` (Tatum/FT%,
Curry/3P%, Jokić/FG%) : le tag `[Beta-Binomial, incertitude sur le taux
gardee]` apparaît bien uniquement pour FT%, comportement/format inchangé
pour les 2 autres stats.

**Reste ouvert, pas creusé** : même après le correctif, ~4% de biais
résiduel sur FT% (le signe de l'écart s'inverse entre le seuil 60%, +7%, et
70-90%, -4 à -6%) — signe d'un biais sur l'estimation du taux/des
tentatives eux-mêmes, piste distincte de l'overdispersion, jamais regardée.
Pas bloquant, gain déjà net (~24% de réduction du résiduel) par rapport à
avant.

Détail complet : `projet-data-nba.md` §20 (bandeau REPRISE mis à jour en
tête du fichier).
```


## Projet Data NBA : réentraînement 5 saisons, biais FT% diagnostiqué, Phase 4 démarrée (21/08/2026, suite)

```text
Enchaîné dans la foulée de l'entrée précédente, même session.

**Réentraînement sur 5 saisons** (point resté ouvert depuis le 20/08/2026,
§16/§17) : `build_features.py` → `build_targets.py` → les 4 `train_*.py`,
même séquence que §17. `features_joueur`/`labels_joueur` : 56 938 → 140 933
lignes. Amélioration nette (points MAE 4.75→4.65, R² 0.497→0.518 ; 3P%
3.6%→2.9% d'écart moyen absolu ; FT%/FG% stables), aucune régression.

**Biais résiduel FT% diagnostiqué** (~4%, signe qui s'inverse selon le
seuil, laissé ouvert dans l'entrée précédente) : nouveau script
`diagnose_ft_bias.py`, 3 hypothèses testées. Biais non conditionnel sur
p_hat/n_hat négligeables (écarté). Cause réelle : **artefact de
granularité** -- avec 1 à 6 tentatives réelles/match, les fractions
atteignables sont rares, la proba prédite (fonction de n_hat arrondi)
reste identique sur plusieurs seuils consécutifs alors que le taux réel
varie en continu. **Pas un bug, rien à corriger** -- même famille de
constat que le cas Wembanyama (§19 projet-data-nba.md).

**Phase 4 (raccordement appli) démarrée** : décisions d'architecture
prises avec l'utilisateur, aucune des deux jamais tranchée avant --
micro-service Python (FastAPI) plutôt que réimplémenter l'inférence en
TypeScript ou un job batch Supabase ; fraîcheur de `nba.db` via cron
quotidien, même patron que `sync-results.yml` côté appli. Point de
conception déduit en construisant : `nba.db`/`models/` étant gitignorés
(volumineux, régénérables), un cron GitHub Actions classique (checkout
éphémère) ne peut pas accumuler un fetch incrémental -- le service doit
tourner sur un hôte à disque persistant et faire son propre refresh, le
cron se contentant d'un curl déclencheur (`POST /refresh`), comme
`sync-results.yml` le fait déjà pour `/api/sync/results`.

Refactor préalable sans duplication : `tester_modele.py` gagne
`compute_proba()`, extrait de `main()`, réutilisé par le CLI ET le
service -- vérifié après coup que le CLI produit des résultats
rigoureusement identiques à avant (Tatum/FT%, Jokić/dd, Curry/pts vs LAL).

Nouveau `Cadrage/Stats/service/app.py` (FastAPI) : `GET /health`,
`POST /predict` (réutilise `compute_proba`/`find_player`/`find_team` tels
quels, erreurs `SystemExit`/`ValueError` existantes renvoyées en 400 avec
le même message que le CLI), `POST /refresh` (stub 501 -- fetch incrémental
nba_api pas encore écrit). Vérifié en conditions réelles (uvicorn local,
curl) : les 3 familles de modèles + adversaire/extérieur/repos + 3 cas
d'erreur (nom ambigu, joueur inconnu, seuil manquant) -- réponses
identiques au CLI déjà validé. Serveur de test arrêté après vérification.

**Reste à faire pour clore la Phase 4** : fetch incrémental nba_api
(`/refresh` reste un stub), choix de l'hébergement (disque persistant
requis -- pas encore fait), workflow GitHub Actions (cron quotidien,
dépend du point précédent). Puis, pour la Phase 5 : distribution réelle de
probas pour calibrer les seuils entre paliers, structuration IA du texte
libre, barème du fallback -- 3 points de `SPEC_TECHNIQUE_PROBA_PARIS_
PERSOS_V0_1.md` §7 indépendants de cette brique-ci.

Détail complet : `projet-data-nba.md` §21 (réentraînement + diagnostic
biais), §22 (micro-service), bandeau REPRISE mis à jour.
```


## Projet Data NBA : Phase 4, architecture sans état + Cloud Run + migration Supabase (21/08/2026, suite)

```text
Enchaîné dans la foulée de l'entrée précédente -- l'utilisateur demande
explicitement de trancher l'hébergement ("on se penche sur le point 1").

**Reconsidération avant de s'engager** : `nba.db` (575 Mo) ne pèse autant
que par le play-by-play (3M lignes), jamais lu par l'inférence -- vérifié
concrètement (copie de test sans cette table : 110 Mo). Le design prévu en
§22 (service auto-suffisant, disque local) aurait nécessité un hébergeur
payant à disque persistant juste pour ces 110 Mo + 103 Mo de modèles.
Architecture alternative proposée et retenue avec l'utilisateur : les
données utiles vivent dans Supabase (déjà en place), les modèles sont
embarqués dans l'image du service au build -- le service devient sans
état, hébergeable gratuitement. Hébergeur : Google Cloud Run, choisi après
comparaison explicite avec Render (gratuit, plus simple à déployer mais
moins robuste) et une fonction Python dans le projet Vercel existant
(écartée, risque de dépasser les limites de taille de fonction avec
scikit-learn + 103 Mo de modèles).

**Migration #31** (`20260821130000_stats_tables_for_service.sql`) : 3
tables préfixées `stats_` dans le schéma `public` (pas un nouveau schéma,
pour éviter un réglage manuel dashboard) -- `stats_equipes`/`stats_joueurs`/
`stats_box_scores` (dénormalisée, toutes les colonnes de `build_context()`
dans une seule table pour éviter les jointures PostgREST). RLS activée
sans policy. Poussée sur la base réelle (`npx supabase db push`) --
**repassé SANS blocage classifieur cette fois**, ce qui a débloqué au
passage les migrations #29 (`delete_bet`) et #30
(`drop_tutorial_seen_at`), en attente depuis plusieurs jours (voir
`GAPS_OUVERTS.md`, les 2 points correspondants retirés).

**Backfill** (`service/backfill_supabase.py`) : bug réel trouvé en migrant
-- pandas 3.0 (changement de comportement récent) renvoie des `float`/`int`
Python natifs via `to_dict()`, pas des scalaires numpy comme avant ; une
colonne entière avec des `NULL` (donc `3.0` côté pandas) atterrissait
littéralement en `3.0` dans le JSON envoyé à une colonne Postgres
`integer`, rejeté (`22P02`). Corrigé (le test de type couvre aussi les
types Python natifs). Résultat vérifié : 30 équipes, 1052 joueurs, 140 016
lignes `stats_box_scores`.

**Service réécrit** : nouveau `service/supabase_context.py` (équivalent
Postgres de `build_context()`/`find_player()`/`find_team()` de
`tester_modele.py`, laissé inchangé pour le CLI local) ; `service/app.py`
reconnecté dessus. Vérifié en conditions réelles contre la VRAIE base
Supabase (uvicorn local + curl) : résultats rigoureusement identiques à la
version SQLite (Tatum FT% 26.8%, Jokić dd 75.1%, Curry pts vs LAL 48.7%) --
aucune régression du changement d'architecture. Un détail de format
corrigé au passage (date au lieu d'un timestamp complet dans la réponse).

**`Dockerfile`** (`Cadrage/Stats/Dockerfile`) + guide de déploiement
(`service/DEPLOIEMENT_CLOUD_RUN.md`, commandes `gcloud` exactes, clé
Supabase via Secret Manager -- jamais collée dans le chat). Pas de Docker
disponible dans cet environnement pour tester le build lui-même -- guide
écrit pour que l'utilisateur l'exécute, avec son propre compte Google
Cloud.

**Nettoyage secret** : un fichier `.env.test` temporaire (clé Supabase,
pour les tests locaux du service) créé puis supprimé après usage --
couvert par `.env*` dans `.gitignore`, jamais exposé dans un commit.
Incident mineur sans conséquence : 2 anciens process `uvicorn` de sessions
précédentes étaient restés vivants en arrière-plan (le `kill`/`pkill`
bash n'agit pas fiablement sur des process Windows lancés via `&`) --
repéré via une requête PowerShell `Get-CimInstance`, arrêtés proprement.

**Reste à faire pour clore la Phase 4** : exécuter le déploiement Cloud Run
(nécessite le compte Google Cloud de l'utilisateur) ; fetch incrémental
`nba_api` + upsert quotidien Supabase (remplace le stub `/refresh`,
devenu inutile dans cette architecture) ; workflow GitHub Actions pour ce
job. Puis Phase 5 (3 points indépendants de `SPEC_TECHNIQUE_PROBA_PARIS_
PERSOS_V0_1.md` §7).

Détail complet : `projet-data-nba.md` §23, bandeau REPRISE mis à jour.
```


## Projet Data NBA : déploiement Cloud Run réel, service EN LIGNE (21/08/2026, suite)

```text
Suite immédiate de l'entrée précédente -- l'utilisateur suit
`service/DEPLOIEMENT_CLOUD_RUN.md` de bout en bout, guidé pas à pas (aucune
commande gcloud lancée depuis cet environnement, pas de compte GCP ici --
tout exécuté par l'utilisateur dans son propre terminal PowerShell).

Étapes suivies : installation `gcloud` CLI (`winget install
Google.CloudSDK`, `--include-unknown` nécessaire à cause d'un résidu d'une
install précédente) ; `gcloud init` (projet créé : `nba-pronos-stats-2026`) ;
liaison d'un compte de facturation via la console web (obligatoire même
pour le free tier, pas documenté dans la 1re version du guide -- ajouté
après coup) ; activation des 3 APIs ; clé Supabase stockée dans Secret
Manager.

**Incident réel, secret exposé** : `SUPABASE_SERVICE_ROLE_KEY` apparue en
clair dans la conversation (sélection IDE collée avec la commande gcloud).
Signalé immédiatement, rotation proposée -- déclinée par l'utilisateur
("pas nécessaire cette fois"), la clé étant déjà stockée avec succès dans
Secret Manager au moment du signalement.

**2 bugs réels rencontrés en déployant, corrigés en conditions réelles** :
1. Commande `gcloud run deploy` multi-lignes (continuation par backtick
   PowerShell, copiée du guide) mal découpée -- le déploiement s'est
   terminé AVANT que `--set-secrets` soit pris en compte, ce flag exécuté
   comme une commande séparée (erreur de syntaxe). Résultat : 1re révision
   déployée sans les identifiants Supabase. Détecté en testant `/health`
   (OK, ne dépend pas de Supabase) vs `/predict` (500). Corrigé sans
   reconstruire l'image, `gcloud run services update` en une seule ligne.
2. Permission Secret Manager manquante : le compte de service par défaut
   de Cloud Run n'a pas accès aux secrets sans octroi explicite
   (`roles/secretmanager.secretAccessor`) -- absent du guide initial,
   ajouté après coup avec la commande `gcloud secrets
   add-iam-policy-binding` correspondante.

`service/DEPLOIEMENT_CLOUD_RUN.md` corrigé avec ces 2 accrocs (commandes en
une seule ligne, étape IAM ajoutée, liaison facturation documentée) --
c'est la version qui marche, plus la version originale.

**Vérifié en conditions réelles, service EN LIGNE** :
`https://nba-pronos-stats-991522521713.europe-west1.run.app` -- `/predict`
testé (Tatum FT% 26.8%, Jokić dd 75.1%, Curry pts vs LAL 48.7%), résultats
identiques aux tests locaux d'avant déploiement. Le pont Next.js (Vercel)
<-> Python (Cloud Run) fonctionne bout en bout pour la 1ère fois.

**Reste à faire pour clore la Phase 4** : fetch incrémental `nba_api` +
upsert quotidien Supabase (remplace le stub `/refresh`) ; workflow GitHub
Actions pour ce job. Puis Phase 5 (3 points de `SPEC_TECHNIQUE_PROBA_PARIS_
PERSOS_V0_1.md` §7).

Détail complet : `projet-data-nba.md` §24, bandeau REPRISE mis à jour.
```


## Projet Data NBA : rafraîchissement quotidien écrit et validé, Phase 4 code complet (21/08/2026, suite)

```text
Dernière brique de la Phase 4 -- remplacer le stub `/refresh` par un vrai
job qui garde Supabase à jour, sans jamais appeler le service Cloud Run
(écrit directement dans Supabase, cohérent avec l'architecture sans état).

Migration #32 (`stats_matchs`) ajoutée : table légère (game_id/date/saison/
équipes) pour savoir vite quels matchs sont déjà connus, sans scanner les
140k lignes de `stats_box_scores`. `backfill_supabase.py` étendu pour la
peupler (6602 lignes locales -> Supabase).

Nouveau `service/refresh_daily.py` : saison "en cours" déduite de la date,
comparaison stats_matchs vs `leaguegamefinder` (nba_api) pour ne fetcher
que les matchs manquants. Simplification trouvée en concevant : domicile/
extérieur et l'adversaire se déduisent du champ MATCHUP de
leaguegamefinder ("@" = extérieur) -- pas besoin du play-by-play
(volontairement absent de Supabase) contrairement au pipeline local qui
l'utilise pour le score final (pas nécessaire ici).

**Testé en conditions réelles** (pas un jeu de données jetable) : 2 vrais
matchs des Finales 2026 supprimés temporairement (snapshot exact avant),
puis redétectés/réinsérés par le script, comparés colonne par colonne à
l'original.

**3 bugs réels trouvés et corrigés en testant** :
1. Pagination PostgREST tronquée à 1000 lignes (défaut) -- `known_game_ids()`
   ne voyait que 1000 des 1321 matchs déjà connus, 83 pris pour "nouveaux".
   Corrigé (pagination par `.range()`).
2. Mauvaise liste de colonnes réutilisée du pipeline local
   (`BOX_SCORE_TABLE_COLUMNS`, inclut des colonnes absentes du schéma
   Supabase allégé) -- insert rejeté par PostgREST. Liste dédiée créée.
3. Filtre DNP insuffisant en lisant l'API en direct : le pipeline local
   relit un CSV (case vide -> vrai NaN), la réponse nba_api en direct garde
   `""` -- 18 lignes DNP passées au travers (`pts=0`), corrigé.

**Point de robustesse corrigé en même temps** : ordre d'écriture changé
(`stats_box_scores` avant `stats_matchs`, pas l'inverse) -- sinon un
plantage entre les deux laisserait un match marqué "connu" alors que ses
stats manquent encore, silencieusement, pour toujours. Découvert en
pratique : le bug #2 a provoqué exactement ce scénario au 1er essai.

Après les 3 correctifs : reproduction EXACTE confirmée (mêmes 42 lignes,
toutes colonnes identiques y compris les valeurs calculées) ; test de
non-régression saison entière : 1321 connus, 1321 trouvés, 0 nouveau.

Workflow `.github/workflows/refresh-stats-supabase.yml` ajouté (cron
quotidien 10h UTC + déclenchement manuel), installe
`Cadrage/Stats/scripts/requirements.txt` (`supabase` ajouté aux
dépendances) et lance le script directement.

**Reste, action de l'utilisateur** : ajouter les secrets GitHub Actions
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` au dépôt (jamais collés dans le
chat). Une fois fait, la Phase 4 est entièrement close.

Détail complet : `projet-data-nba.md` §25, bandeau REPRISE mis à jour.
```


## Projet Data NBA : 1er run réel du cron, optimisation timeout, Phase 4 close (21/08/2026, suite)

```text
L'utilisateur ajoute les 2 secrets GitHub Actions via l'interface web (pas
via le chat) et déclenche le workflow manuellement pour un 1er test réel.

Résultat : succeeded en 10m29s -- mais les logs (partagés par
l'utilisateur, captures d'écran) montrent que ce temps est presque
entièrement des échecs : les 3 appels leaguegamefinder pour 2026-27
(hors-saison, aucun match n'existe encore) expirent chacun après 3
tentatives de 60s avant la conclusion correcte "Rien de nouveau". Comportement
final juste, mais très lent à y arriver -- et ça va se répéter chaque jour
jusqu'à mi-octobre, consommant une part non négligeable du quota gratuit
GitHub Actions (dépôt privé) pour ne rien trouver.

Corrigé : timeout (15s) et tentatives (1) réduits UNIQUEMENT pour l'appel
leaguegamefinder (fetch_season_games), fetch_box_scores garde le
timeout/les tentatives complets (un vrai match existant, où la fiabilité
compte). Revérifié en local : hors-saison ~10min -> 8s ; saison pleine
(2025-26) toujours identique (1321/1321/0 nouveau) -- aucune perte de
fiabilité, juste un échec plus rapide quand il n'y a réellement rien.

**Phase 4 du chantier Data NBA (raccordement appli) ENTIÈREMENT CLOSE** :
service déployé et vérifié sur Cloud Run (§24), rafraîchissement quotidien
automatique et fiable (§25), coût du job optimisé (§26). Reste la Phase 5
(3 points indépendants de SPEC_TECHNIQUE_PROBA_PARIS_PERSOS_V0_1.md §7).

Détail complet : `projet-data-nba.md` §26, bandeau REPRISE mis à jour.
```


## Phase 5 démarrée : structuration IA des paris persos, raccordement réel dans l'appli (21/08/2026, suite)

```text
"On y go" -- Phase 5 (relier réellement un pari perso au calcul de proba,
plutôt qu'une simple brique technique séparée). Recherche préalable
(agent Explore) sur le cycle de vie réel des paris persos : AUCUNE colonne
structurée n'existait avant (tout dans le champ description texte libre) ;
decisions_0.2.4 §10 n'envisageait l'IA que pour la résolution (suggestion
gagné/perdu), pas pour structurer à la soumission -- vraie extension de
périmètre, confirmée avant de coder plutôt que supposée.

Décisions actées avant codage : modèle Claude Opus 5 (coût réel négligeable
à ce volume, ~1-1,5 centime/pari -- pas d'option gratuite/incluse dans
l'abonnement Claude Code, API Anthropic facturée séparément) ; appel
synchrone à la SOUMISSION du pari (pas à la validation admin) ; seuils
proba->palier provisoires "à vue de nez" pour livrer une version qui
marche maintenant (point 2 de la spec, jamais calibré, reste ouvert).

Implémenté : migration (7 colonnes nullables sur `bets` + RPC
`update_bet_structuration`, même patron SECURITY DEFINER que
save_bet/withdraw_bet/delete_bet) ; 5 nouveaux fichiers `lib/ai/*`
(statCodes, structureBet -- Claude Opus 5 via client.messages.parse() +
zodOutputFormat --, statsService -- appel HTTP au micro-service Cloud Run
--, difficultyTiers, structureAndScoreBet -- orchestrateur best-effort) ;
`submitBet` (lib/actions/bets.ts) appelle l'orchestrateur après le succès
de save_bet ; écran admin de validation mis à jour (suggestion IA affichée
en lecture seule, select de difficulté pré-rempli, admin garde la main).

Best-effort de bout en bout : toute panne de cette chaîne (clé API absente,
timeout Cloud Run, joueur non trouvé, stat non calculable) laisse le pari
soumis normalement -- rien ne peut faire échouer une soumission de pari.
UNDER approximé (le service ne calcule que P(stat > seuil), UNDER =
1 - P(stat > seuil), écart mineur assumé).

Dépendances ajoutées : @anthropic-ai/sdk, zod (npm install, pas de version
devinée -- 1er essai avec une version inventée qui n'existait pas,
corrigé en laissant npm résoudre).

Bug réel trouvé en vérifiant : tsc a rejeté le cast dans
getPendingValidationBets() -- la chaîne .select(...) construite par
concaténation empêchait supabase-js d'inférer les colonnes en type
littéral. Corrigé en un seul literal string non concaténé.

tsc/eslint/vitest (37/37)/next build (38 routes) propres. Migration
poussée sur la base réelle, colonnes vérifiées lisibles.

Reste, action de l'utilisateur : ajouter ANTHROPIC_API_KEY (jamais collée
dans le chat) et STATS_SERVICE_URL (URL Cloud Run, non sensible) sur
Vercel + .env.local -- sans ça, la structuration reste silencieusement
inactive. Puis vérifier au clic (poser un vrai pari perso calculable).
Reste aussi ouvert, assumé explicitement : seuils de palier toujours
provisoires (point 2) ; barème du fallback jamais tranché (point 5,
statu quo assumé).

Détail complet : projet-data-nba.md §27,
SPEC_TECHNIQUE_PROBA_PARIS_PERSOS_V0_1.md §7bis (nouvelle section).
```


## Structuration IA vérifiée hors-interface, 1 bug réel corrigé (21/08/2026, suite)

```text
Suite directe de l'entrée précédente -- variables d'environnement
configurées par l'utilisateur, vérification que la chaîne fonctionne
réellement. Pas d'accès navigateur dans cet environnement -- vérification
directe des appels externes réels (Claude Opus 5 + micro-service Cloud
Run) via un script jetable dupliquant la logique de structureBet.ts/
statsService.ts (obligé, "server-only" bloque l'exécution hors build
Next.js).

Incident billing en route de l'utilisateur : 1er compte Anthropic sans
crédit, paiement de 6$ refusé plusieurs fois malgré un solde suffisant
(probable pré-autorisation bancaire ou blocage carte) -- résolu en créant
un 2e compte Anthropic, 5$ chargés avec succès. Nouvelle clé mise en place
directement par l'utilisateur, jamais collée dans le chat. Confirmé au
passage : la fédération d'identité proposée par la console Anthropic ne
convient pas ici (GCP/AWS/Azure/GitHub Actions seulement, pas Vercel) --
clé API statique est le bon choix pour ce projet.

Script de test, 4 cas réels : pari calculable simple (Tatum >25 pts, proba
27%, palier 4) ; pari fun non calculable (rejeté correctement, bon
raisonnement) ; pari UNDER (Curry, proba 72% après inversion 1-28%,
confirme l'approximation) ; pari triple-double (Jokić) -- extraction IA
correcte (calculable=true, comparison=null, normal pour dd/td) mais
**rejeté à tort par le code**.

Bug réel trouvé et corrigé : structureAndScoreBet.ts exigeait
`comparison` non-null pour TOUT pari calculable -- or dd/td ont
légitimement comparison=null par design (probabilité directe, pas de
notion OVER/UNDER). Conséquence avant correctif : tous les paris double-
double/triple-double, pourtant calculables, tombaient systématiquement en
repli manuel silencieux -- pas un crash, une fonctionnalité inopérante
pour 2 des 12 stats gérées. Corrigé (comparison requis seulement hors
NO_THRESHOLD_STATS ; type de predictOverUnder() élargi à "OVER"|"UNDER"|
null dans statsService.ts). Revérifié : Jokić triple-double calcule
maintenant une vraie proba (18,3%, palier 5).

tsc/eslint/vitest (37/37) propres après le correctif. Script de test
jetable supprimé après usage, jamais commité.

Reste avant de considérer la Phase 5 pleinement vérifiée : test au clic
dans l'interface réelle (soumettre un vrai pari perso, observer la
suggestion sur l'écran admin) -- logique et appels externes confirmés,
mais le passage complet par submitBet + le rendu de ValidationBetCard.tsx
jamais testés ensemble faute d'accès navigateur.

Détail complet : projet-data-nba.md §28.
```


## 1er test réel via l'interface -- bug "Junior" vs "Jr." trouvé et corrigé (21/08/2026, suite)

```text
Suite directe : l'utilisateur teste pour de vrai via npm run dev (compte
Rillettes-31). Serveur de dev périmé (tournait depuis le 19/08, avant
l'ajout des variables d'environnement -- Next.js les charge au démarrage,
pas à chaud) -- redémarré.

Pari "Michael Porter Junior marque plus de 10 pts" soumis via le vrai
formulaire (InlineBetForm -> submitBet(), confirmé identique à la fonction
modifiée en §27) -- aucun champ de structuration rempli. Diagnostiqué en
testant directement le service déployé : "Aucun joueur trouvé pour
Michael Porter Junior". Vraie cause : le nom en base est "Michael Porter
Jr.", find_player() ne fait qu'une comparaison de sous-chaîne après
normalisation des accents -- "junior" et "jr." ne matchent jamais. Claude
Opus 5 a fidèlement repris l'orthographe du joueur, la faille est côté
correspondance de nom, pas côté extraction IA.

Corrigé : normalize_suffix() (tester_modele.py, "junior"/"jr"/"jr." ->
"jr", idem senior/sr), appliquée aux deux côtés de la comparaison dans
find_player() -- corrigé dans tester_modele.py ET supabase_context.py
(réutilise la fonction, zéro duplication). Testé directement contre
Supabase : résout maintenant "Michael Porter Junior" -> Michael Porter
Jr. (1629008). Zéro régression (Tatum, Jokić, Curry ambigu, joueur
inconnu).

Reste : le service Cloud Run déployé tourne encore sur l'ancienne image --
redéploiement (gcloud run deploy, action utilisateur) nécessaire avant de
pouvoir reconfirmer de bout en bout via l'appli.

Détail complet : projet-data-nba.md §29.
```


## Design révisé : auto-validation au lieu de "admin garde la main" (21/08/2026, suite)

```text
L'utilisateur pose une question qui révèle un malentendu de conception :
en tant que joueur il peut encore choisir la difficulté alors que
l'appli est censée la prédire. Creusé : ce qu'il avait en tête depuis le
début (proba montrée au joueur À la validation, auto-validation, admin
corrige après coup) est différent de ce qui a été codé (admin garde la
main, suggestion en lecture seule, comportement joueur inchangé).
Signalé explicitement plutôt que réinterprété silencieusement -- 2
questions produit tranchées : proba visible au joueur mais SEULEMENT
après validation (pas avant, pour ne pas influencer son choix) ; auto-
validation pour les paris calculables, admin corrige après coup.

2 conflits trouvés en implémentant, signalés avant de coder autour :
/players/[userId] (proposé initialement pour la correction admin) ne
montre un pari qu'à la deadline PUBLIQUE, pas à la validation (mauvais
timing) ; et cette page porte un principe documenté dans son propre code
("même vue pour tout le monde") qu'ajouter un contrôle admin-only aurait
cassé. Réajusté avec l'utilisateur : proba au joueur -> BetBlock.tsx
("Mes pronos") ; correction admin -> /admin/validation (déjà admin-only).

Recherche préalable (agent Explore) : confirmé qu'aucun mécanisme
existant ne permet à un admin de réviser une difficulté sur un pari qui
reste VALIDATED (le système de correction est joueur-initié, ses 2
branches ne couvrent pas ce cas) -- nouvelle action nécessaire.

Implémenté : migration remplaçant update_bet_structuration (transition
directe SUBMITTED->VALIDATED si calculable, validated_by_admin_id=NULL
comme signal "validé par l'IA") ; ligne proba dans BetBlock.tsx (gardée
avant status DRAFT/SUBMITTED) ; revalidatePath rappelé après
structureAndScoreBet dans submitBet ; nouvelle getAutoValidatedBets() +
overrideAutoValidatedDifficulty() (avec recomputeBet systématique et
assertNotOwnBet réutilisée) ; nouveau AutoValidatedBetCard.tsx + section
sur /admin/validation. Nettoyage : la suggestion IA en lecture seule de
ValidationBetCard.tsx (ajoutée avant ce changement) devient du code mort
par construction -- retirée plutôt que laissée trompeuse.

tsc/eslint/vitest (37/37)/next build (38 routes) propres. Migration
poussée sur la base réelle.

Reste : redéployer le service Cloud Run (correctif Junior/Jr., toujours
pas fait) puis retester le pari via l'appli pour confirmer
l'auto-validation de bout en bout.

Détail complet : projet-data-nba.md §30,
SPEC_TECHNIQUE_PROBA_PARIS_PERSOS_V0_1.md §7bis mis à jour.
```


## Contexte de match ajouté à la structuration IA -- 2 bugs réels corrigés (21/08/2026, suite)

```text
L'utilisateur teste "Jayson Tatum marque +25 pts" sur un match Nets-
Hornets (Tatum joue à Boston, aucun rapport) -- auto-validé quand même
avec une vraie proba. Signale aussi le risque de fautes de frappe côté
joueurs (ex. "Junior" vs "Jr.", déjà vu en §29).

Même cause pour les 2 : structureBet() extrayait le nom sans connaître le
contexte du match, reprenait le texte tel quel. 2 approches envisagées :
construire une vraie table d'effectifs (plus lourd, colonne team_id
retirée volontairement en §23) vs donner à Claude Opus 5 le nom des 2
équipes du match et s'appuyer sur sa connaissance réelle des effectifs
NBA -- choisi (plus léger, testé fonctionnel).

Implémenté : structureBet() reçoit un nouveau paramètre teamNames,
prompt enrichi (vérifie l'appartenance du joueur au match, corrige
l'orthographe vers la convention NBA standard) ; structureAndScoreBet()
résout les noms d'équipe depuis series.team1_id/team2_id (null si série
pas encore déterminée, dégrade proprement) ; submitBet passe seriesId
(déjà disponible, rien de nouveau côté formulaire).

Testé avec de vrais appels Claude Opus 5 : Tatum + Nets/Hornets -> rejeté
correctement (raisonnement explicite) ; Tatum + Celtics/Heat -> accepté ;
"Michael Porter Junior" + Nets/Hornets -> corrigé en "Michael Porter Jr."
ET confirmé comme joueur des Nets (connaissance réelle, pas une
supposition).

tsc/eslint/vitest (37/37)/next build propres.

Limite assumée : repose sur la connaissance du modèle, pas une base
d'effectifs interrogée en direct -- un transfert très récent pourrait
échapper à la vérification. Très supérieur à l'absence totale de
vérification d'avant ; option "vraie table d'effectifs" reste disponible
si insuffisant en usage réel.

Reste : redéployer le service Cloud Run (correctif Junior/Jr. côté
find_player(), désormais une 2e ligne de défense) puis retester de bout
en bout via l'appli.

Détail complet : projet-data-nba.md §31.
```


## Fix observabilité : is_calculable=false écrit explicitement (21/08/2026, suite)

```text
Test "MPJ marque plus de 25 pts" sur un match Atlanta-Boston -- reste
SUBMITTED, is_calculable NULL. Ressemblait à une panne (rate limit),
c'était en fait un bug de code : structureAndScoreBet.ts retournait sans
jamais écrire en base dès que l'IA répondait "non calculable" --
is_calculable restait NULL, indistinguable d'une vraie panne. MPJ
(Brooklyn) ne joue ni pour Atlanta ni Boston -- le rejet était
probablement correct, juste jamais tracé.

Corrigé : nouvelle markNotCalculable(), appelée à chaque sortie
anticipée, écrit explicitement is_calculable=false. Vérifié séparément
avec l'utilisateur que le pari Tatum validé plus tôt sur Nets/Hornets
avait été soumis AVANT le correctif §31 -- pas un vrai trou dans la
vérification d'équipe.

tsc/eslint/vitest (37/37)/next build propres.

Détail complet : projet-data-nba.md §32.
```


## Joueur hors du match visé : proba 0% au lieu d'un rejet silencieux (21/08/2026, suite)

```text
"LeBron James marque +25 pts" sur Atlanta-Boston (LeBron joue aux Lakers)
-- correctement rejeté (is_calculable=false) mais sans que le joueur en
soit informé, retombe comme n'importe quel autre pari non calculable.
L'utilisateur demande une alerte/refus explicite, ou à défaut accepter
avec proba 0%.

Tension signalée avant de coder : rejeter la soumission romprait le
principe déjà acté "l'IA ne bloque jamais un pari" (decisions_0.2.4 §4)
et nécessiterait de réorganiser l'ordre soumission/vérification. Accepter
avec proba 0% reste cohérent, choisi avec l'utilisateur.

Implémenté : nouveau champ player_not_in_match dans le schema Zod
(distinct de calculable, qui reste true) ; structureAndScoreBet.ts force
calculated_proba=0 directement dans ce cas SANS appeler le micro-service
(qui ignorerait le contexte de match et calculerait une vraie proba à
partir des stats réelles du joueur -- le bug d'origine si on le laissait
tourner).

Testé avec de vrais appels Claude Opus 5, 3/3 cas corrects (LeBron rejeté
du bon match avec proba forcée à 0%, Tatum accepté normalement, pari fun
toujours calculable=false).

tsc/eslint/vitest (37/37)/next build propres.

Détail complet : projet-data-nba.md §33.
```

## README.pdf mis à jour + calibration réelle des seuils proba->difficulté (21/08/2026)

```text
README.pdf (Cadrage/Stats/) régénéré avec 3 nouvelles sections (service
Cloud Run, rafraîchissement quotidien Supabase, paris IA Phase 5) + un
récap des enchaînements de commandes par objectif, demandé par
l'utilisateur pour consulter l'état du projet sans repasser par la
conversation.

Calibration des seuils proba->difficulté (Phase 5 §7 point 2) : seulement
3 vrais paris calculables en base, bien trop peu pour une vraie
distribution. Simulé à la place sur 868 joueurs réels
(calibrate_difficulty_thresholds.py) -- 1er essai biaisé (mêmes seuils
fixes 50-90% testés pour FT/FG/3P%, alors que la ligue tourne à ~78%/47%/
36% selon la stat, écrasant la moyenne simulée de FG/FG3 à 12.7%),
corrigé avec des seuils réalistes par stat calés sur la vraie moyenne
ligue. Vérifié sur un cas concret : "Curry + de 20% à 3-points" donne
94.7% de proba réelle, cohérent avec le palier attendu.

Résultat final (868 joueurs, 62 280 probas simulées) : quintiles 24.9% /
39.4% / 52.9% / 66.4%. lib/ai/difficultyTiers.ts mis à jour (remplace les
seuils provisoires 80/60/40/20%). tsc/eslint/vitest (37/37)/next build
(37 routes) propres, commité et poussé.

Discussion ouverte sur le point 5 (barème du fallback) : proposition de
l'utilisateur (champ points libre 5-25 à la place du sélecteur 1-5,
impacte lib/scoring/engine.ts::scoreBet) élargie vers l'idée d'un
formulaire structuré joueur/stat/seuil pour éliminer par construction les
bugs d'extraction IA corrigés aujourd'hui -- ni l'un ni l'autre tranché,
noté dans GAPS_OUVERTS.md.

Détail complet : projet-data-nba.md §34.
```

## Phase 5 close, point 5 (barème du fallback) parqué par décision (22/08/2026)

```text
Suite immédiate de la session précédente : l'utilisateur tranche
explicitement de laisser les 2 pistes du point 5 (champ points libre vs
formulaire structuré joueur/stat) en l'état, sans en choisir une
maintenant -- "on laisse les points du formulaire structuré" (parquées,
pas rejetées). Le mécanisme manuel actuel (sélecteur 1-5, BET_DIFFICULTY_
POINTS) reste inchangé pour les paris non calculables.

Phase 5 (SPEC_TECHNIQUE_PROBA_PARIS_PERSOS_V0_1.md) déclarée CLOSE avec ce
point explicitement parqué -- statut, GAPS_OUVERTS.md et REPRISE de
projet-data-nba.md mis à jour en conséquence. Seul point encore ouvert,
indépendant : redéployer le service Cloud Run pour le fix normalize_
suffix() (2e ligne de défense, §31).
```

## Optimisation du coût des appels IA de structuration (22/08/2026)

```text
L'utilisateur relance le redéploiement Cloud Run (en parallèle) et demande
d'optimiser le coût des appels Claude à la structuration d'un pari
(lib/ai/structureBet.ts), sans perdre la précision obtenue au prix de
toute la session précédente.

Cache de prompt écarté après vérification réelle (API de comptage de
tokens) : system prompt = 441 tokens, sous le seuil minimum de cache
(~1024). Découverte plus utile en creusant les usages réels des appels :
chaque appel coûte ~2500 tokens d'entrée, dont ~2000 viennent du SCHÉMA
ZOD lui-même (les descriptions de champs, renvoyées à chaque appel pour
contraindre la sortie) -- poste dominant, incompressible par cache
(non exposé sur output_config.format).

2 changements appliqués et revalidés avec de vrais appels API (7 cas,
dont les 2 bugs corrigés cette session) : modèle par défaut Opus 5 ->
Sonnet 5 (~2.6x moins cher, résultats identiques) + descriptions du
schéma condensées (même instruction, moins de tokens). Aucune régression
sur aucun cas testé.

tsc/eslint/vitest (37/37)/next build (37 routes) propres, commité et
poussé.

Détail complet : projet-data-nba.md §35.
```

## Repli automatique des cartes prono/pari dans "Mes pronos" (22/08/2026)

```text
Reprise de la piste UX notée le 21/08/2026 (GAPS_OUVERTS.md) : après avoir
comparé Sonnet 5 et écarté Haiku 4.5 (2 échecs sur 5 cas piégeux, dont un
qui reproduisait exactement le bug player_not_in_match corrigé cette
session), l'utilisateur demande de travailler sur l'interface "Mes
pronos" -- confirmé via question : le repli automatique après
soumission, pas autre chose.

2 endroits distincts, chacun avec son propre état d'ouverture local :
- UpcomingRow.tsx (ligne de match entière) : nouvel effet surveillant la
  TRANSITION de match.viewStatus vers VALIDATED pendant que la ligne est
  ouverte -- se replie une seule fois à ce moment précis, jamais en
  forçant une ligne déjà validée qu'on rouvrirait ensuite pour consulter
  le récap.
- InlineBetForm.tsx (sous-formulaire de pari, partagé avec le Bracket) :
  handleSubmit() referme le formulaire après un succès, en inline comme
  en modal (rien d'autre ne refermait la pop-up automatiquement).

Le cas bundlé (prono + pari validés ensemble via le bouton unique) est
couvert par le seul repli de UpcomingRow -- le sous-formulaire de pari
est démonté avec le reste une fois la ligne repliée, pas besoin d'un 2e
repli pour ce cas.

tsc/eslint/vitest (37/37)/next build (37 routes) propres, commité et
poussé. PAS testé au clic dans un navigateur (pas d'outil de test UI
disponible dans cet environnement) -- à vérifier par l'utilisateur.
```

## Fix : superposition des demi-finales NBA Cup dans l'arbre (22/08/2026)

```text
L'utilisateur signale un bug visuel (capture d'écran) sur "Mon bracket"
NBA Cup, poster/arbre : l'étiquette "Demi-finales" mal placée et une
carte "Finale" qui semble flotter/chevaucher au mauvais endroit,
demi-finale manquante à l'écran.

Vérifié en base (requête directe Supabase) : la structure de données est
correcte (4 quarts -> 2 demies -> 1 finale, next_series_id/slot bien
distincts, aucune collision d'id). Le bug est donc dans le rendu, pas les
données -- exclu une 1re hypothèse (conflit marge auto CSS §16/08 vs
alignement JS) après relecture attentive de l'algorithme (delta-based,
auto-correcteur).

Cause réelle trouvée dans TreeConnectors.tsx : une règle du 17/08 force
la Finale ET ses 2 séries précédentes sur la MÊME ligne horizontale --
correcte en Playoffs (les 2 finales de conférence vivent dans 2 colonnes
DIFFÉRENTES, Ouest/Est mirroir, les aligner les garde côte à côte).
En NBA Cup (pas de conférence, colonne UNIQUE), les 2 demi-finales sont
2 cartes DE LA MÊME colonne -- la même règle les empilait littéralement
l'une sur l'autre.

Corrigé : la règle "même ligne" ne s'applique plus que si les 2 séries
qui alimentent la finale sont dans des colonnes différentes (nouveau
columnKeyById dans TreeConnectors.tsx) -- la Cup retombe sur
l'alignement normal (chaque demi-finale sur ses propres parents),
Playoffs inchangé.

tsc/eslint/vitest (37/37)/next build (37 routes) propres, commité et
poussé. PAS testé au clic dans un navigateur (pas d'outil disponible ici,
confirmé par l'utilisateur : vu sur ordinateur/tablette) -- à vérifier.
```

## Investigation pari IA non reconnu + fix affichage "CHI −4" (22/08/2026)

```text
2 sujets distincts, tous deux à partir de retours réels de l'utilisateur
sur la NBA Cup :

1. "Zacari risacher + 5 rebonds" resté is_calculable=false alors que
   "Rudy Gobert +10 rebonds" a bien fonctionné. Vérifié en base (bet
   réel), reconstitué le contexte exact (vrai match résolu depuis --
   Atlanta Hawks vs Charlotte Hornets -- et absence de contexte de match
   au moment réel du pari, les 2 quarts alimentant cette demie n'étant
   pas encore joués à l'heure du pari). Relancé 11 fois au total (Sonnet
   5, schéma condensé) avec et sans contexte : 11/11 réussites,
   orthographe corrigée ("Zaccharie Risacher"), calculable=true à chaque
   fois. Pas de bug reproductible -- probablement un aléa ponctuel
   (réseau/API), avalé silencieusement par design (best-effort, jamais
   bloquant). Solution donnée à l'utilisateur : rouvrir/resoumettre le
   pari relance l'IA depuis zéro.

2. L'utilisateur signale que "✓ CHI −4" (recap d'un prono validé) se lit
   comme un écart NÉGATIF alors que le chiffre est toujours l'écart de
   VICTOIRE du vainqueur choisi, jamais un déficit -- signe moins
   trompeur. Corrigé aux 6 endroits qui affichent ce recap :
   UpcomingRow.tsx, UpcomingRowForm.tsx, PredictionSummary.tsx,
   RevealPanelUpcoming.tsx, RevealPanelLocked.tsx,
   app/players/[userId]/page.tsx -- "−" remplacé par "+" partout,
   trouvés par grep exhaustif pour ne pas en manquer un.

tsc/eslint/vitest (37/37)/next build (37 routes) propres, commité et
poussé.
```

## Fix : find_player() non paginé + pari annulé bloquant + reset finale NBA Cup (22/08/2026)

```text
Suite du signalement "Zaccharie Risacher non reconnu" : reproduit en
local contre Supabase, cause réelle trouvée -- find_player()/find_team()
dans service/supabase_context.py n'utilisaient PAS .range() (même bug
déjà corrigé dans refresh_daily.py::known_game_ids, jamais appliqué ici).
stats_joueurs compte 1052 lignes, au-delà du plafond PostgREST (1000) :
les ~52 derniers joueurs (dont Risacher, rookie récent) étaient
invisibles quelle que soit l'orthographe. Corrigé (fetch_all_rows()
dupliqué localement -- refresh_daily.py n'est pas dans l'image Cloud
Run), testé en local (find_player + compute_proba fonctionnent). gcloud
indisponible dans cet environnement -- redéploiement demandé à
l'utilisateur.

L'utilisateur reteste avec l'orthographe corrigée : échoue encore --
attendu, tant que le service déployé n'a pas le correctif (le test local
Python contourne le service réel).

Demande de nettoyage sur la finale NBA Cup (Atlanta-Chicago) : décaler
le match à 13h30 Paris (11h30 UTC), effacer le pronostic de bracket sur
CETTE série uniquement (pas tout le bracket -- aucune action per-série
n'existait, fait via UPDATE direct Supabase, même patron que
resetBracket()), annuler le pari Risacher (passage à CANCELLED avec le
motif standard "Retiré par toi avant revue.", JAMAIS un vrai DELETE --
règle D2 du projet, "aucune suppression nulle part"). Les 3 confirmés en
base.

Bug supplémentaire découvert en testant : un pari CANCELLED restait
affiché en lecture seule (BetBlock) sur la carte du match au lieu de
libérer la place pour un nouveau pari (InlineBetForm) -- lib/queries/
play.ts attachait match.bet sans filtrer les statuts RELEASED
(CANCELLED/REJECTED), contrairement à hasBetOnThisMatch/
usedSlotsBySeries du même fichier qui le faisaient déjà. Corrigé sur la
ligne non verrouillée uniquement (la ligne verrouillée garde
l'historique, la fenêtre de pari y est fermée de toute façon).

tsc/eslint/vitest (37/37)/next build (37 routes) propres, commité et
poussé (2 commits : find_player, puis le fix match.bet). Reste : le
redéploiement Cloud Run et la vérification "tous les joueurs" demandés
par l'utilisateur, en attente.
```

## Suite et clôture : chaîne complète Risacher résolue (22/08/2026)

```text
Suite directe de l'entrée précédente. 2 rebondissements avant résolution
complète :

1. 1er redéploiement Cloud Run lancé depuis le mauvais dossier
   (Cadrage/Stats/scripts au lieu de Cadrage/Stats) -- "Building using
   Buildpacks" au lieu du Dockerfile, échec de build. Corrigé en
   relançant depuis Cadrage/Stats -- succès.

2. Une fois le service à jour, resoumettre le pari Risacher échouait
   avec "duplicate key value violates unique constraint
   uniq_active_match_bet" -- 2e bug réel, distinct du fix match.bet de
   l'entrée précédente. Cause : l'index unique partiel
   uniq_active_match_bet (schéma initial, 18/07/2026) excluait
   seulement REJECTED, jamais mis à jour quand CANCELLED a été introduit
   comme 2e statut "relâché" (migration #29, delete_bet, 18/08/2026) --
   sa jumelle uniq_active_series_bet, elle, excluait déjà les 2. Migration
   corrective écrite (20260822120000_fix_uniq_active_match_bet_cancelled.
   sql, DROP + CREATE de l'index avec le bon prédicat) -- appliquée par
   l'utilisateur via l'éditeur SQL du dashboard Supabase (pas d'accès
   CLI/DB direct dans cet environnement), guidé pas à pas.

Confirmé par l'utilisateur : pari Risacher soumis avec succès, structuré
correctement par l'IA, cohérent. Chaîne de bugs (find_player non paginé
-> match.bet non filtré sur CANCELLED -> uniq_active_match_bet non mis à
jour) entièrement résolue et vérifiée en conditions réelles.
```

## Phase 6 lancée : résolution automatique des paris IA (22/08/2026)

```text
Après 3 petits fix UI (carte cliquable Résultats, replier aussi le pari,
total points combiné, retrait du "✓" trompeur -- tous commités), l'utilisateur
lance le prochain gros chantier : résoudre automatiquement WON/LOST les
paris IA calculables, via les vraies stats déjà collectées (Data NBA) --
rejoint l'idée notée le 21/08 (decisions_0.2.4 §10).

Cadrage avant de coder : /api/sync/results tourne déjà toutes les 30 min
et auto-score déjà les PRONOSTICS (vainqueur/écart) -- le vrai trou est
la résolution des PARIS, encore 100% manuelle. 2 forks tranchés avec
l'utilisateur :
1. Périmètre : paris MATCH uniquement pour le 1er jet (paris SÉRIE trop
   ambigus -- quel match exact fait foi -- restent manuels).
2. Pont match appli <-> vraies stats NBA : les 2 mondes utilisent des
   sources externes DIFFÉRENTES et sans lien (appli = Highlightly,
   Data NBA = nba_api) -- étendre entity_mappings (déjà prévue pour ce
   genre de pont, aujourd'hui limitée à Highlightly) avec un nouveau
   source_type NBA_API, matché par date+équipes -- même logique
   déterministe déjà utilisée pour les mappings Highlightly (pas de
   nouvel écran admin).

Plan en 4 blocs, construits un par un :
1. FAIT -- capturer le vrai player_id à la structuration (au lieu de
   re-matcher structured_player_name par nom plus tard, source de bugs
   réels cette session). service/app.py renvoie désormais player_id ;
   nouvelle colonne bets.structured_player_id ; migration
   20260822130000. Testé en local (app.predict() direct). Reste à
   appliquer la migration + redéployer Cloud Run.
2-4. À construire : mapping entity_mappings NBA_API, logique de
   résolution (comparer la vraie stat au seuil), branchement en bout de
   chaîne de refresh_daily.py.

tsc/eslint/vitest (37/37)/next build (37 routes) propres, commité et
poussé pour le bloc 1.
```

## Phase 6, blocs 2-3 : résolution automatique construite (22/08/2026)

```text
lib/ai/resolveCalculableBets.ts : resolveNbaGameId() (pont match appli <->
game_id NBA via entity_mappings, nouveau source_type NBA_API, rapprochement
déterministe date NY + paire d'équipes) + computeOutcome() (compare la
vraie stats_box_scores au seuil, même définition dd/td EXACTE que
build_targets.py) + resolveCalculableBets() (boucle sur les paris MATCH
VALIDATED calculables, écrit WON/LOST + recomputeBet()). Nouvelle route
/api/resolve-bets (même auth que /api/sync/*), chaînée en bout du workflow
refresh-stats-supabase.yml.

Vérifié séparément (pas resolveCalculableBets() en entier, qui écrirait
sur de vrais paris sans accord explicite) :
- resolveNbaGameId testé contre le vrai match de la finale NBA Cup (Atlanta-
  Chicago, décalé à 11h30 UTC) : logique de rapprochement correcte
  (équipes/dates bien résolues), 0 candidat trouvé dans stats_matchs --
  ATTENDU et IMPORTANT à noter : cette compétition de test utilise des
  dates fictives d'août (hors saison NBA réelle, les vraies données
  Data NBA s'arrêtent autour de mai 2026) -- CE MÉCANISME NE POURRA JAMAIS
  ÊTRE TESTÉ DE BOUT EN BOUT SUR CETTE COMPÉTITION DE TEST PRÉCISE, faute
  de vrai match NBA le même jour. Vérifiable seulement sur une vraie
  compétition alignée sur le vrai calendrier NBA (saison réelle, ou une
  compétition de test dont les dates recouvrent un vrai match passé).
- computeOutcome vérifié sur 9 cas contre une vraie ligne stats_box_scores
  (Rudy Gobert, reb/dd/td/ft/fg/min, over/under) : 9/9 corrects.

tsc/eslint/vitest (37/37)/next build (38 routes) propres, commité et
poussé. Reste (bloc 4 restant) : redéployer Cloud Run + appliquer la
migration structured_player_id (toujours en attente, bloc 1) avant que
quoi que ce soit ici puisse tourner pour de vrai.
```

## Phase 6 : vérification complète en conditions réelles (22-23/08/2026)

```text
Cloud Run redéployé + migration structured_player_id appliquée par
l'utilisateur. Vérifiés séparément :
- Service /predict renvoie bien joueur_id (curl direct).
- Colonne structured_player_id existe (requête directe).
- Pari réel "Moussa Diabate marque +10 points" -> proba 0%,
  structured_player_id NULL : d'abord pris pour un bug, en fait
  COMPORTEMENT CORRECT -- vérifié que Diabaté joue pour Charlotte, pas
  pour Denver/Boston (le match visé) -- branche player_not_in_match,
  qui n'appelle jamais le service donc ne capture jamais de player_id
  par construction. L'utilisateur confirme que c'était un test voulu
  ("je me suis emmêlé les pinceaux").
- Pari réel suivant "Bam plante plus de 30 points" (Bam Adebayo, joueur
  réellement dans le match visé) -> structured_player_id=1628389 capturé
  correctement. Chemin normal confirmé bout en bout.

Test COMPLET du bloc 4 (résolution automatique), demandé par
l'utilisateur ("on peut faire un test sur des matchs antérieurs ?") :
la compétition de test utilise des dates fictives d'août (aucun vrai
match NBA ce jour-là), donc impossible d'utiliser un match déjà en
place. Créé TEMPORAIREMENT dans la compétition ACTIVE (accord explicite
de l'utilisateur) : une série + un match + un pari pointant vers un VRAI
match passé (Atlanta Hawks @ New York Knicks, 23/04/2026, game_id NBA
0042500123) avec un vrai joueur (Jalen Johnson, 24 points réels ce
jour-là) et un pari test "+ de 20 points" (WON attendu).

Résultat de POST /api/resolve-bets sur ces données réelles :
- Pari test résolu WON, points_awarded=15 (barème palier 3), resolution_
  reason correct, resolved_by_admin_id=null (signal système).
- entity_mappings NBA_API créé et correct (source_ref = le bon game_id).
- Le pari réel en attente (Bam Adebayo, match pas encore terminé) a été
  correctement IGNORÉ ("match pas encore terminé") -- aucun effet de
  bord sur les vrais paris de l'utilisateur.

Nettoyage : les 4 lignes de test (série/match/pari/mapping) supprimées
juste après vérification -- confirmé qu'il n'en reste aucune trace,
rien d'autre touché.

PHASE 6 COMPLÈTE ET VÉRIFIÉE DE BOUT EN BOUT EN CONDITIONS RÉELLES.
```

## Cadrage des paris SÉRIE, non codé (23/08/2026)

```text
Discussion de fond sur l'extension de l'auto-résolution aux paris SÉRIE
(exclus du scope Phase 6). Points clés : la structuration IA ne distingue
déjà pas MATCH/SERIES aujourd'hui (proba = celle du prochain match, pas
de la série) ; l'utilisateur précise avec un exemple ("un match dépasse
200 points au total") que les paris série peuvent porter sur N'IMPORTE
QUELLE stat, y compris des catégories équipe qu'aucun des 12 modèles
actuels ne sait calculer -- l'agrégation "sur la série" est un mécanisme
générique à construire une fois, pas par type de pari.

Trouvaille : entrainement_matchs (build_targets.py) a déjà total_points
et home_win comme cibles prêtes, avec des features équipe riches --
jamais utilisée par aucun script train_*.py existant.

Nœud technique identifié par l'utilisateur : N (nombre de matchs d'une
série) varie 4-7 selon l'issue, affecte la proba mais pas la résolution.
Décidé : simplifier d'abord (N = matchs déjà programmés au moment du
pari, figé comme P10) plutôt que construire un modèle de victoire par
match en prérequis.

Décision explicite : documenter comme cadrage prêt à construire plutôt
que coder maintenant (session déjà longue). Détail complet dans
GAPS_OUVERTS.md (5 pièces identifiées pour le pipeline complet).
```

## Suite du cadrage paris SÉRIE : modèle de victoire par match (23/08/2026)

```text
Juste après l'entrée précédente, discussion complémentaire (même session)
qui AFFINE la décision sur N : la longueur d'une série suit un modèle
probabiliste connu (loi binomiale négative, best-of-N classique -- pas du
machine learning), formule exacte donné un p par match. L'utilisateur
propose d'abord une moyenne historique de longueur de série -- écarté
avec lui (écrase la différence entre affrontement déséquilibré/série
serrée). Décidé : construire le modèle de proba de victoire PAR MATCH
d'abord (entrainement_matchs/home_win, déjà prêt) plutôt que démarrer
avec p=0,5 -- l'utilisateur veut un système fidèle à la forme réelle des
équipes dès le départ. L'utilisateur signale l'importance du domicile/
extérieur : déjà présent nativement dans entrainement_matchs (features
home_*/away_*), implique un calcul récursif match par match (format
2-2-1-1-1 connu à l'avance) plutôt qu'un p constant unique.

GAPS_OUVERTS.md mis à jour en conséquence (6 pièces au lieu de 5, le
modèle de victoire par match ajouté comme prérequis explicite). Toujours
PAS CODÉ, cadrage uniquement.
```

## Paris SÉRIE, pièce a0 codée et vérifiée (23/08/2026)

```text
Suite immédiate du cadrage : l'utilisateur donne le feu vert ("oui") pour
coder la pièce a0 (modèle de victoire par match + calcul de série).

train_home_win_model.py : entraîné sur entrainement_matchs, jamais
utilisée par aucun script d'entraînement jusqu'ici. Bug réel trouvé au
1er essai (dataset à 0 ligne) : 2 colonnes toujours NULL
(victoires_pct_domicile_saison côté away, _exterieur_saison côté home --
calculées seulement pour le lieu réellement joué) -- retirées. 5216/6602
lignes utilisables, bat le taux constant (log loss 0.630 vs 0.688, Brier
0.220 vs 0.247), calibration correcte, testé sur 5 vrais matchs récents.

series_probability.py : calcul récursif (programmation dynamique) de la
longueur et du vainqueur de série à partir de ce P(victoire) par match,
respecte le format domicile/extérieur 2-2-1-1-1 -- vérifié EXACT contre
le résultat classique connu (p=0.5 -> 12.5/25/31.25/31.25%, longueur
moyenne 5.8125). Testé sur un vrai affrontement (2 vraies équipes) :
75.9% de victoire de série pour la favorite, longueur moyenne 5.65
matchs (cohérent, plus court qu'à 50/50).

models/home_win.joblib généré localement (non versionné, même convention
que les 12 autres modèles). Scripts commités et poussés. GAPS_OUVERTS.md/
projet-data-nba.md (§37) mis à jour, pièce a0 retirée de la liste des
pièces manquantes.

Détail complet : projet-data-nba.md §37.
```

## Gap Supabase trouvé (team_id/stats avancées manquantes), pause décidée (23/08/2026)

```text
L'utilisateur donne le feu vert pour continuer (pièce b, contexte équipe
en production). Vérifié en direct sur Supabase avant de coder : la table
stats_box_scores n'a ni team_id ni off_rating/def_rating/net_rating/pace
-- justement les features les plus importantes du modèle home_win tout
juste entraîné. Ces colonnes existent déjà en local (box_scores/
box_scores_advanced, niveau joueur, déjà agrégées par équipe dans
build_team_games()) -- rien à extraire de nouveau depuis nba_api, juste
à étendre ce qui est copié vers Supabase (jamais fait jusqu'ici, le
projet n'avait besoin que de stats joueur avant cette session).

Proposé à l'utilisateur : continuer (migration + backfill_supabase.py +
refresh_daily.py + contexte équipe à la volée dans supabase_context.py,
même philosophie sans état que pour les joueurs) ou s'arrêter là.
Décidé : s'arrêter (session déjà très longue) -- plan complet documenté
dans GAPS_OUVERTS.md pour reprise directe.
```

## Paris SÉRIE, bloquant Supabase levé -- contexte équipe en production (23/08/2026, reprise)

```text
Reprise directe depuis GAPS_OUVERTS.md (plan à 4 étapes déjà posé). Feu
vert de l'utilisateur pour l'étape 1 (migration).

Étape 1 -- migration `20260823090000_stats_box_scores_team_advanced.sql`
(team_id, off_rating, def_rating, net_rating, pace + index team_id/
game_date). `npx supabase db push` a d'abord échoué : la migration
20260822130000 (session précédente) était déjà appliquée sur la base
réelle mais absente de l'historique de suivi Supabase -- probable reliquat
d'un push manuel après un blocage classifieur (même catégorie que déjà
rencontrée, voir mémoire `claude-code-auto-mode-classifier-blocks-
credentials`). Signalé explicitement à l'utilisateur avant d'agir (écart
d'état, pas une action destructive) : `supabase migration repair --status
applied 20260822130000` (répare juste la table de suivi, ne rejoue aucun
SQL), confirmé par l'utilisateur, puis push normal réussi.

Étape 2 -- `backfill_supabase.py` : 5 colonnes ajoutées au SELECT
(team_id déjà dans box_scores local, les 4 autres dans box_scores_
advanced -- rien à récupérer de nouveau). Relancé en tâche de fond
(~140k lignes, quelques minutes) pendant que l'étape 3 était codée en
parallèle. Vérifié après coup par une vraie requête Supabase (pas
seulement le code de sortie du script) : 140016/140016 lignes avec
team_id renseigné.

Étape 3 -- `refresh_daily.py` : `STATS_BOX_SCORE_TRAD_COLUMNS` étend
team_id, `box_adv_rows` étend off_rating/def_rating/net_rating/pace --
même patron que le reste du fichier (colonnes déjà renommées par
TRADITIONAL_COLUMNS/ADVANCED_COLUMNS de load_to_sqlite.py, réutilisées
telles quelles).

Étape 4 -- `build_team_context()`/`compute_home_win_proba()` dans
service/supabase_context.py, équivalent Supabase de build_team_games()/
add_team_rolling_features()/compute_roster_continuity()
(build_features.py), réduit à UNE équipe par appel (2 requêtes filtrées
team_id=X / opponent_team_id=X, aucune jointure nécessaire -- opponent_
team_id déjà stocké ligne par ligne). 2 simplifications trouvées en
relisant le code d'entraînement avant de coder : is_home n'est PAS une
des 21 features du modèle (déjà exclu à l'entraînement pour trou de
données) ; aucun shift(1) nécessaire en inférence live (contrairement à
l'entraînement, tous les matchs récupérés sont déjà joués, le match visé
n'existe pas encore en base). Continuité d'effectif reproduite à
l'identique (coeur d'effectif = joueurs couvrant CORE_MINUTES_SHARE des
minutes de la saison précédente) mais limitée aux 2 seules saisons
utiles au lieu de toute la base.

Testé en conditions réelles contre la vraie base (pas de test synthétique)
: Boston vs Lakers, saison 2025-26. 1er essai avec une date de test trop
ancienne (rest_days négatif, repéré immédiatement -- la base contient déjà
des matchs plus récents que la date choisie) ; corrigé avec une vraie
date future réaliste. build_team_context() → compute_home_win_proba() →
series_probability.simulate_series() bout en bout : ~78% de victoire de
série pour Boston, longueur moyenne 5.6 matchs (cohérent). Garde-fou
vérifié aussi : compute_home_win_proba() lève une erreur explicite si la
saison ciblée n'a pas encore commencé pour une équipe (testé avec
2026-27), plutôt que de renvoyer une proba silencieusement fausse.

tsc --noEmit propre (fichiers Python, aucun impact sur l'app Next.js).
Pas de migration/donnée cassée. Câblage dans service/app.py (endpoint
dédié) volontairement pas fait cette session -- pas demandé, la pièce a0
+ le contexte équipe suffisaient à lever ce bloquant précis.

GAPS_OUVERTS.md mis à jour : bloquant retiré, section réécrite en
"entièrement levé", détail des 4 étapes conservé pour trace.
```

## Paris SÉRIE, pièce (c) -- mécanisme générique d'agrégation (23/08/2026, suite)

```text
L'utilisateur demande son avis sur la prochaine pièce à construire.
Recommandé et retenu : pièce (c) plutôt que le modèle équipe total_points
-- profite immédiatement aux 12 modèles joueur déjà entraînés, alors que
total_points ne couvrirait qu'une catégorie de paris plus étroite.

2 décisions structurantes tranchées AVANT de coder (toutes les 2
explicitement notées comme "pas abordées en détail" dans GAPS_OUVERTS.md),
via AskUserQuestion, options recommandées retenues sans hésitation :
1. Sémantique d'un pari série ambigu ("marque 30+") : "au moins une fois
   sur la série" (pas "en moyenne", pas "prochain match précis").
2. Fidélité domicile/extérieur : comme le modèle d'équipe (pas 1 seule
   proba moyenne) -- coûte un peu plus de code, cohérent avec le refus
   déjà exprimé par l'utilisateur de la simplification p=0.5 pour le
   modèle d'équipe (séance précédente).

simulate_series_with_stat() (series_probability.py) : extension de
simulate_series(), DP sur l'état (victoires A, victoires B, stat déjà
arrivée ?) -- une fois le flag "arrivée" à True, la stat de la suite ne
compte plus, seul le vainqueur reste à déterminer. Hypothèse assumée :
résultat du match et stat du joueur indépendants (pas de corrélation
modélisée). Vérifié : cas limites (p_stat=0 -> 0%, p_stat=1 -> 100%
garanti dès le match 1) + cross-check EXACT contre la formule fermée
1-(1-p)^N marginalisée sur la distribution de longueur, dans le cas
particulier où domicile=extérieur (doit alors coïncider puisque la stat
n'influence plus qui gagne ni la longueur) -- coïncide au bit près.

compute_series_stat_proba() (supabase_context.py) : la vraie pièce
GÉNÉRIQUE -- wrappe compute_proba() (n'importe lequel des 12 modèles
joueur) SANS aucune logique spécifique à une stat, 2 appels
(is_home=1/0, même adversaire fixe toute la série) + 2 appels à
compute_home_win_proba() (domicile A, domicile B) déjà construits la
session précédente, combinés par simulate_series_with_stat().

Testé en conditions réelles contre la vraie base (pas de test
synthétique) : Jayson Tatum, "30+ points", Boston vs Lakers, saison
2025-26 -- ~5%/match (cohérent avec un joueur à ~27-28 pts de moyenne),
~24.7% sur la série entière, cohérent avec la longueur moyenne de la
série (~5.6 matchs) et la formule attendue.

GAPS_OUVERTS.md mis à jour : les 2 décisions tranchées documentées, pièce
(c) marquée FAITE, liste des 6 pièces mise à jour (a0/(b)/(c) faites,
restent (a) modèle équipe, (d) extraction IA, (e) résolution). Câblage
service/app.py volontairement pas fait -- pas de consommateur tant que
(d) ne reconnaît pas un pari série à l'extraction.
```

## Paris SÉRIE, pièce (d) -- extraction IA étendue (23/08/2026, suite)

```text
Investigation déléguée à un agent Explore (pipeline structuration IA
existant : structureAndScoreBet.ts, structureBet.ts, resolveCalculableBets.ts,
schéma DB) pour ne pas saturer le contexte avant de coder -- confirme que
scope=SERIES existe déjà en DB/UI (bet_scope enum, BetForm.tsx) mais est
invisible à l'étape IA (jamais transmis à structureAndScoreBet), et que
resolveCalculableBets.ts filtre déjà explicitement scope=MATCH (SERIES
jamais auto-résolu).

Bug réel trouvé AVANT de coder l'endpoint : Dockerfile du service Cloud Run
ne copiait que tester_modele.py, pas les 3 fichiers dont dépendent les
fonctions de la session (build_features.py/train_home_win_model.py/
series_probability.py) -- aurait fait planter le service au redéploiement.
Corrigé.

Nouvel endpoint /predict-series (app.py), wrappe compute_series_stat_proba().
Détermination de l'équipe à l'avantage du terrain : pas de "seed" explicite
en base -- dérivée du vrai match 1 de la série (matches.game_number=1,
home_team_id réel) plutôt qu'un ordre arbitraire team1/team2.

Champ player_team ajouté au schéma zod de structureBet.ts (l'IA indique
désormais QUELLE équipe le joueur représente, pas seulement s'il joue dans
le match) -- testé avec 3 vrais appels Claude Sonnet 5 (script jetable,
supprimé après test) : Tatum -> team1 correct, LeBron -> team2 correct,
pari équipe/total total_points -> calculable=false inchangé (pièce (a)
toujours hors périmètre). 3/3.

Correctif de conception (trouvé en écrivant le code, pas en testant) :
contrairement au patron MATCH (1-proba après coup pour UNDER),
compute_series_stat_proba() DOIT inverser la proba PAR MATCH avant de
refaire tourner la simulation de série -- P(au moins un match UNDER) !=
1 - P(au moins un match OVER) à l'échelle d'une série. Vérifié : Tatum
"30+points" UNDER vs Lakers donne ~99.9998% sur la série (quasi garanti,
correct), pas 75.3% qu'aurait donné le calcul naïf.

Instabilité réelle trouvée en testant `/predict-series` plusieurs fois de
suite : ~1 fois sur 10-15 appels, mêmes entrées exactes -> résultat
différent (p_a_wins_series 0.7940 au lieu de 0.7799). Investigation
approfondie AVANT de continuer (flaggé à l'utilisateur, feu vert reçu pour
la mitigation) : isolée par élimination à la combinaison complète de
compute_series_stat_proba() (2 modèles .joblib différents dans le même
calcul) -- ni les features équipe seules (10/10 stables), ni
compute_home_win_proba() seul (8/8), ni compute_proba() joueur seul (8/8)
ne reproduisent le problème. Hypothèse "race du pool joblib" testée
(n_jobs=1 forcé) et écartée -- ne corrige pas. Cause exacte non trouvée
avec un effort raisonnable. PAS un bug introduit cette session -- la même
architecture sert déjà en prod pour les paris MATCH, compute_series_stat_
proba() est juste le 1er endroit à combiner 2 modèles dans un calcul.
Mitigation : recalcule jusqu'à 3 fois, ne renvoie qu'un résultat où au
moins 2 essais s'accordent (tolérance 1e-6), sinon erreur explicite.
Revérifié stable sur 10+ appels après le correctif (process isolés ET via
HTTP réel, service lancé en local avec uvicorn).

lib/ai/statsService.ts : nouvelle predictSeriesStat() (même contrat de
retour que predictOverUnder(), timeout 40s au lieu de 20s -- jusqu'à 3
recalculs possibles côté service). lib/ai/structureAndScoreBet.ts : reçoit
scope désormais (transmis depuis submitBet(), lib/actions/bets.ts),
resolveSeriesHomeCourtTeam() nouveau (requête matches.game_number=1),
branche vers predictSeriesStat() si scope=SERIES sinon comportement MATCH
inchangé.

tsc/eslint/vitest (37/37)/next build (37 routes) propres. Testé bout en
bout : service local (uvicorn) + /predict-series réel (OVER et UNDER) +
3 vrais appels Claude pour player_team. Pas fait cette session : redéploiement
Cloud Run (gcloud absent de cet environnement, action de l'utilisateur) et
test réel en soumettant un vrai pari série depuis l'appli (bloqué tant que
le redéploiement n'est pas fait, STATS_SERVICE_URL pointe sur l'ancien
service sans /predict-series).

GAPS_OUVERTS.md mis à jour : pièce (d) marquée FAITE (paris série joueur
uniquement, équipe/total toujours hors périmètre), détail complet des
correctifs conservé pour trace, next step = redéploiement puis pièce (e).
```

## Paris SÉRIE, redéploiement Cloud Run + pièce (e) résolution (23/08/2026, suite)

```text
Redéploiement Cloud Run fait par l'utilisateur (commande PowerShell adaptée
en cours de route -- le 1er essai en syntaxe bash avec des `\` de
continuation de ligne a échoué sous PowerShell, corrigé avec des backticks/
une seule ligne). Revérifié /predict-series en HTTP réel sur le VRAI
service déployé (pas juste local) : résultat identique (~24,8%), mitigation
de cohérence confirmée active en production.

Utilisateur donne le feu vert pour enchaîner directement sur la pièce (e),
avec l'intention de tout tester ensemble plus tard (un vrai pari série
soumis depuis l'appli).

resolveCalculableSeriesBets() (lib/ai/resolveCalculableBets.ts) : équivalent
SERIES de resolveCalculableBets() (MATCH), câblée en parallèle dans
/api/resolve-bets. Réutilise SANS LES MODIFIER resolveNbaGameId()/
computeOutcome()/recomputeBet() (déjà éprouvées en prod côté MATCH) --
seule la logique d'agrégation par série est neuve : résout WON dès qu'UN
match réellement joué de la série satisfait le seuil (pas besoin d'attendre
la fin de la série), résout LOST seulement si series.official_status=
FINISHED (plus aucun match à venir) ET tous les matchs FINISHED ont une
ligne stats_box_scores pour ce joueur -- sinon reste en attente (même
prudence que le resolver MATCH : jamais trancher sur une absence de
donnée).

tsc/eslint/vitest (37/37) propres. PAS testé en conditions réelles :
vérifié en base qu'aucun pari scope=SERIES n'est encore is_calculable=true
(9 paris SERIES existants, tous antérieurs à la pièce (d), aucun
calculable) -- décidé de ne PAS insérer de faux pari dans la vraie table
pour tester, conformément à la demande de l'utilisateur de tout tester
ensemble à la fin plutôt que pièce par pièce à partir de maintenant.

GAPS_OUVERTS.md mis à jour : pièce (e) marquée FAITE/pas testée, chantier
paris série (a0/b/c/d/e) considéré complet pour les paris JOUEUR -- seule
la pièce (a) (modèle(s) équipe, pour les paris équipe/total) reste à
construire, hors périmètre demandé cette session.
```

## Paris SÉRIE, 1er test réel + limite de périmètre découverte (23/08/2026, suite)

```text
Setup de test : seule compétition ACTIVE était une Cup (scope SÉRIE
désactivé par design). Confirmé jetable avec l'utilisateur, archivée
directement en base (service_role, pas via closeCompetition() -- exige une
session admin réelle, inutilisable depuis un script). "Playoffs simulation"
(archivée, données 100% simulées avec de vrais IDs d'équipe) réactivée à sa
place.

1er essai (série Lakers-Rockets) : pari indisponible côté utilisateur alors
que Boston-Knicks marchait. Cause trouvée en lisant bet_deadline_open() (SQL,
migration RLS) : pour un scope SÉRIE, la deadline = MIN(scheduled_at) sur
TOUS les matchs déjà connus de la série, pas seulement le match 1. Le match
2 de Lakers-Rockets était resté à une date passée (seul le match 1 avait été
avancé) -- corrigé (les 2 matchs avancés dans le futur). Boston-Knicks
marchait par accident : aucun match n'existe encore pour cette série
(CONF_SEMIS), donc deadline = infini.

1er vrai pari série soumis : "Doncic marquera + de 100 points sur la
série" -- resté SUBMITTED, is_calculable=false, aucun champ structuré
rempli (l'utilisateur ne voyait que "Modifier"). Vérifié aucune erreur dans
les logs runtime Vercel (mcp Vercel, get_runtime_errors) sur la fenêtre
concernée -- pas une panne technique. Reproduit l'appel Claude en isolation
(script jetable, supprimé après) avec la description et le contexte exacts :
l'IA renvoie calculable=false avec le reasoning "Pari sur total série
(plusieurs matchs), pas un seuil par match unique" -- comportement VOULU,
pas un bug.

Vrai trou de conception trouvé par ce test : "sur la série" a 2 lectures
naturelles en français -- "au moins une fois" (ce qui a été construit,
motivé par l'exemple d'origine de l'utilisateur "un match dépassera 200
points") vs "cumulé/sommé sur la série" (ex. "100+ points sur la série" pour
UN joueur -- lecture la plus naturelle ici, et le pipeline actuel ne sait
pas la faire : demanderait une distribution de somme sur un nombre de
matchs lui-même aléatoire, pas juste un réglage de prompt).

Décidé avec l'utilisateur : rester sur "au moins une fois" pour l'instant,
le cumulé reste calculable=false (repli manuel existant, rien de cassé) --
noté comme chantier séparé possible si repris plus tard, pas construit à la
légère par-dessus la DP existante (conçue pour une sémantique différente).

GAPS_OUVERTS.md mis à jour avec le détail complet (2 formes de pari série,
décision, formulation de test qui devrait marcher à la place). Aucun
changement de code cette entrée -- uniquement investigation + documentation
+ setup de données de test.
```

## Paris SÉRIE, 2e essai réel -- limite du calendrier non synchronisé (23/08/2026, suite)

```text
Utilisateur retente avec une formulation sans ambiguïté cette fois ("Tatum
marquera +30 pts sur un match", scope SÉRIE) -- mais sur la série
Boston-Knicks (CONF_SEMIS), pas Lakers-Rockets. Toujours "Modifier"
uniquement côté utilisateur.

Diagnostic direct en base cette fois (pas besoin de reproduire l'appel IA
comme pour Doncic -- la cause est visible dans les données) : la série
Boston-Knicks n'a ENCORE AUCUNE ligne dans matches (calendrier jamais
synchronisé pour ce tour, contrairement à Lakers-Rockets dont les matchs 1/2
avaient été avancés manuellement plus tôt). resolveSeriesHomeCourtTeam()
(pièce (d)) cherche le match game_number=1 pour connaître l'avantage du
terrain -- absent ici, donc homeCourt=null, prediction jamais tentée,
repli non-calculable. Comportement voulu (jamais deviner qui reçoit), mais
révèle une limite de couverture réelle : un pari série peut être créé dès
que le bracket connaît les 2 équipes, mais reste non-calculable tant que le
calendrier réel n'est pas synchronisé -- indépendamment de la qualité de la
formulation du pari.

Pas de correctif de code -- pas demandé, juste consigné dans
GAPS_OUVERTS.md pour que ça ne soit pas redécouvert à froid la prochaine
fois. Redirigé l'utilisateur vers la série Lakers-Rockets (calendrier déjà
présent) pour le prochain essai -- via "Modifier" sur le pari Doncic déjà
soumis dessus (quota 1 pari série/série déjà pris, pas une nouvelle
création).
```

## Paris SÉRIE, 3e essai réel -- vrai bug de saison trouvé et corrigé (23/08/2026, suite)

```text
Utilisateur édite le pari Doncic ("+ de 50 points sur un match", formulation
sans ambiguïté cette fois) sur Lakers-Rockets (calendrier synchronisé,
contrairement à Boston-Knicks juste avant). Toujours "Modifier" seulement.

Reproduit en 2 temps : d'abord l'extraction IA seule (script jetable) --
calculable=true, player_team=team1, tout correct. Puis appel DIRECT au vrai
service Cloud Run déployé avec les paramètres exacts que l'appli aurait
envoyés : erreur claire (pas un rejet silencieux) -- features manquantes
home_continuite_effectif_saison/away_continuite_effectif_saison.

Cause : predictSeriesStat() (TS) envoie as_of_date=aujourd'hui (23/08/2026)
sans season explicite -- build_team_context() (Python) déduisait la saison
par une règle calendaire (_season_label_for_date, "à partir d'août on est
sur la saison suivante") -- donnant "2026-27", saison réelle pas encore
commencée (0 match connu, vrai intersaison actuelle). Le garde-fou de
compute_home_win_proba() (posé lors de sa construction, pièce (b)) a
refusé à raison de deviner -- c'est la déduction de saison en AMONT qui
était fausse, pas le garde-fou.

Corrigé : _season_label_for_date() (regle calendaire) remplacée par
_latest_known_season() (derniere saison REELEMENT connue en base pour
cette equipe, calculee depuis l'historique deja recupere). Correct en
cours de saison ET en intersaison reelle (retombe sur la derniere saison
terminee).

2e correctif trouvé en revérifiant après le 1er : la tolérance de
cohérence (mitigation pièce (d) de l'instabilité rare) était calibrée
1e-6 sur un SEUL cas (Tatum/Boston/Lakers, accord par chance à ~1e-9). Le
cas Doncic/Lakers/Rockets a montré un bruit normal ~1000x plus large
(~0.001-0.002) -- systématiquement rejeté à tort. Recalibrée à 1e-2 (1
point de proba), toujours nettement sous le vrai bug déjà observé (~1.4
point).

Revérifié : Doncic 50+points/match stable (~36.5%, 3 essais). Non-régression
sur Tatum/Boston/Lakers (~24.7-24.9%, sans season explicite cette fois,
comme le fera l'appli). Redéploiement Cloud Run PAS ENCORE refait --
nécessaire avant de retester depuis l'appli.

GAPS_OUVERTS.md mis à jour avec le détail complet des 2 correctifs.
```

## Bug préexistant trouvé : pari série VALIDATED invisible partout (23/08/2026, suite)

```text
Utilisateur redéploie Cloud Run -- revérifié en HTTP réel sur le vrai
service (résultat identique au local, ~36.5%). Pari série resoumis :
auto-validé avec succès (calculated_proba=0.3647, VALIDATED, difficulté 4).
Mais l'utilisateur ne le trouve plus nulle part dans l'appli -- ni le
bouton "Parier" (normal, un pari actif existe), ni ailleurs.

Investigation déléguée à un agent Explore (pas de piste évidente en tête --
préférable de tracer précisément où "mes paris" est censé se rendre
aujourd'hui plutôt que deviner). Diagnostic clair et net : bug préexistant,
pas lié au chantier paris série -- la refonte du 18/08/2026 a supprimé
l'ancien écran "Mes paris" (lecture seule, tous statuts/scopes) et migré la
consultation MATCH vers lib/queries/play.ts, mais jamais fait l'équivalent
pour SÉRIE. bracket.ts::myBetAction ne gère que PROPOSE/EDIT -- dès qu'un
pari série sort de DRAFT/SUBMITTED, plus rien ne s'affiche, alors que le
commentaire de code du fichier dit explicitement l'intention contraire
("mon propre pari m'est toujours visible"), jamais implémentée pour ce cas.
1ère fois qu'un pari série atteint VALIDATED en conditions réelles depuis
la refonte -- donc 1ère fois que ce trou se révèle, indépendamment du
travail du jour.

Confirmé avec l'utilisateur avant de coder (AskUserQuestion) : corriger
maintenant plutôt que documenter pour plus tard.

Corrigé en réutilisant TEL QUEL l'infrastructure déjà construite pour les
paris MATCH (aucune duplication) : BracketNode gagne myBet: PlayAssociatedBet
| null (lib/queries/bracket.ts), peuplé quand myBetAction est null À CAUSE
d'un pari engagé (VALIDATED/WON/LOST) plutôt que d'une série non-pariable.
NodeCard.tsx affiche <BetBlock> (components/play/BetBlock.tsx, déjà
existant côté MATCH) en lecture seule dans ce cas -- description,
catégorie, difficulté, proba calculée, points, "Signaler à un admin" pour
un pari oublié. Requête bets étendue aux champs nécessaires + requête
correction_requests ajoutée (statut "pari oublié", même mécanisme que
play.ts).

tsc/eslint/vitest(37/37)/next build (37 routes) propres. Pas de vérification
au clic possible (pas d'accès navigateur dans cet environnement) -- signalé
explicitement à l'utilisateur, à confirmer après déploiement.

GAPS_OUVERTS.md mis à jour avec le diagnostic complet et le détail du
correctif.
```

## Pari série visible : ajustement affichage au clic (23/08/2026, suite)

```text
Utilisateur confirme voir son pari, mais il s'affichait EN PERMANENCE sur
la carte de série -- demande de ne l'afficher qu'au clic.

Déplacé pour suivre le patron déjà établi de l'écran (même règle que
SeriesGroups, le détail des pronostics des autres joueurs, déjà replié
jusqu'au clic) plutôt que d'inventer un nouveau mécanisme : <BetBlock>
retiré de NodeCard.tsx (où il s'affichait sans condition d'ouverture) et
déplacé dans SeriesDrillDown.tsx, à côté de <SeriesGroups>, dans les 2
zones d'expansion déjà existantes (vue A : détail inline sous la carte,
condition node.nodeId === openSeriesId ; vue B : feuille par le bas,
openNode). Réutilise openSeriesId/isOpen déjà en place, aucun nouvel état.

tsc/eslint/vitest(37/37)/next build propres.
```

## Pari série : petite indication sur la carte repliée (23/08/2026, suite)

```text
Utilisateur demande une indication visible sans avoir à cliquer, une fois
le détail complet déplacé derrière le clic (entrée précédente).

Ajouté MyBetContent (NodeCard.tsx) -- même patron que MyPickContent déjà
en place pour le pronostic de bracket (tag + libellé court, jamais le
contenu complet du pari ici, qui reste réservé au clic). "— Ton pari" +
statut court (en jeu/gagné/perdu) + points si scoré. Nouvelles classes CSS
myBetTag/myBetNeutral/myBetWon/myBetLost (NodeCard.module.css), mêmes
tokens couleur que BetBlock.module.css (--color-win/--color-loss) --
différent de myPickNeutral/myPickCorrect qui, eux, ne portent jamais de
rouge (un pronostic manqué n'est pas un résultat de pari réel, distinction
déjà actée dans le code).

tsc/eslint/vitest(37/37)/next build propres.
```

## Pièce (a) -- cadrage posé, pas codé (23/08/2026, suite)

```text
Utilisateur demande d'attaquer la pièce (a) (modèle équipe), "à minima le
cadrage" -- pas de code cette fois, juste poser la suite.

Vérifié avant de proposer quoi que ce soit : entrainement_matchs
(build_targets.py) a déjà total_points (home_score+away_score) ET les
mêmes features équipe home_*/away_* que home_win (pièce a0) -- même patron
d'entraînement déjà éprouvé, juste une régression au lieu d'une
classification. Réduit nettement le risque technique de cette pièce.

3 décisions actées avec l'utilisateur (AskUserQuestion + discussion) :
1. total_points seul pour commencer (pas les autres paris équipe).
2. Scope MATCH seul d'abord, SÉRIE ensuite en réutilisant le mécanisme déjà
   construit pour les paris joueur (même schéma de reprise que a0 -> c).
3. Nouveau champ bet_subject ("PLAYER"/"MATCH_TOTAL") dans
   BetStructurationSchema plutôt que d'ajouter total_points aux 12
   STAT_CODES joueur -- garde l'invariant "1 stat code = 1 calcul par
   joueur" intact partout où il est déjà utilisé (Python compute_proba()/
   STATS_DISPONIBLES inclus).

GAPS_OUVERTS.md mis à jour avec le cadrage complet (5 points) + l'ordre de
construction prévu pour la prochaine reprise (train_total_points_model.py
-> compute_total_points_proba() -> endpoint /predict-total-points ->
extension schéma IA -> extension resolveCalculableBets.ts). Rien codé
cette entrée, uniquement du cadrage.
```

## Pièce (a) -- codée et testée (23/08/2026, suite immédiate)

```text
Utilisateur donne le feu vert pour coder, suite directe du cadrage. Les 5
étapes prévues enchaînées dans l'ordre sans blocage.

(i) train_total_points_model.py : réutilise BASE_FEATURE_COLS/FEATURE_COLS
de train_home_win_model.py (import direct) plutôt que MATCH_FEATURE_COLS
brut -- évite de redécouvrir le bug des 2 colonnes toujours NULL déjà
corrigé pour home_win. Entraîné en conditions réelles : 5216 lignes, MAE
15.3, R² 0.115, calibration correcte (écarts 1-5 points).

(ii) compute_total_points_proba() : factorisé _build_match_feature_row()
depuis compute_home_win_proba() (même construction de contexte, partagée
entre tout futur modèle MATCH). Testé : ~38.6% sur Boston/Lakers (220
points), cohérent avec la moyenne prédite (215.4).

Bug de calcul évité en amont (pas trouvé en testant, anticipé en écrivant
le code) : contrairement à predictSeriesStat, l'inversion OVER/UNDER pour
total_points est mathématiquement sûre en 1-proba (prédiction à l'échelle
d'un seul match) -- documenté explicitement dans le code pour éviter
qu'une future pièce mélange les 2 cas par analogie hâtive.

(iii) endpoint /predict-total-points (app.py), testé en HTTP réel local.

(iv) structureBet.ts : bet_subject (PLAYER/MATCH_TOTAL) + match_stat,
stat renommé player_stat. structureAndScoreBet.ts reçoit matchId (jamais
transmis avant), nouvelle fonction resolveMatchTeams() (équipes RÉELLES du
match precis, distinct de resolveMatchTeamNames qui donne team1/team2 de
la série, pas forcément dans le même ordre domicile/extérieur). Testé 4
vrais appels Claude Sonnet 5 (script jetable, supprimé après) : score
combiné, pari joueur (non-régression), marge de victoire (rejet correct),
total cumulé sur série (rejet correct, garde explicite ajoutée au prompt).
4/4.

(v) resolveCalculableMatchTotalBets(), câblée en parallèle des 2 autres
resolvers.

Instabilité numérique de la pièce (d) reproduite ICI AUSSI avec un SEUL
modèle -- l'hypothèse "seulement 2 modèles combinés" était incomplète.
Mitigation généralisée en _compute_with_consistency_check() (factorisée,
réutilisée par compute_series_stat_proba() ET compute_total_points_proba()
au lieu d'être dupliquée).

tsc/eslint/vitest(37/37)/next build propres. Redéploiement Cloud Run pas
encore fait (action de l'utilisateur) -- à faire avant de tester un vrai
pari MATCH_TOTAL depuis l'appli.
```

## Pièce (a) suite -- rebonds d'équipe, les 2 formes (23/08/2026, suite)

```text
Après confirmation que le pari MATCH_TOTAL marchait en vrai (redéploiement
Cloud Run fait, pari "score total" testé par l'utilisateur), demande
d'étendre la pièce (a). Question posée avant de proposer une direction :
"c'est quoi la marge de victoire ?" -- expliqué, puis l'utilisateur note
que les pronostics de match couvrent déjà l'écart, pas la peine de
dupliquer en pari perso. Décidé ensemble : direction rebonds d'équipe,
sous 2 formes (équipe précise ET combiné) -- "les deux ! ça dépendra de
l'énoncé".

Chantier nettement plus gros que total_points, en 7 morceaux :
1. Pipeline de données étendu (build_features.py : reb_pour/reb_contre,
   même patron que pts_pour/pts_contre ; build_targets.py : home_reb/
   away_reb/total_reb dans entrainement_matchs). Nouvelle table
   entrainement_equipe (build_team_perspective_dataset()) -- 1 ligne par
   (match, équipe), perspective "own"/"opp" plutôt que domicile/extérieur,
   nécessaire pour qu'un pari "CETTE équipe" reste valide qu'elle reçoive
   ou se déplace. own_is_home devient une feature explicite plutôt qu'un
   axe figé (contrairement à home_win/total_points).
2. 2 modèles entraînés en conditions réelles (total_reb R²=0.050,
   team_reb R²=0.103 -- cibles bruitées, attendu, feature importances
   cohérentes : tendance propre au rebond + rebonds concédés par
   l'adversaire en tête).
3. Refactor supabase_context.py pour partager le contexte entre modèles :
   build_team_context() calcule désormais aussi reb_pour/contre (ignoré
   par home_win/total_points, utilisé par les 2 nouveaux) ;
   _build_match_feature_row() gagne un paramètre base_cols au lieu d'un
   FEATURE_COLS figé -- évite de dupliquer la construction de contexte
   pour chaque nouveau modèle MATCH.
4. 2 nouveaux endpoints Python, testés en HTTP local.
5. Schéma IA étendu : bet_subject gagne TEAM_STAT, nouveau fichier
   teamStatCodes.ts (volontairement séparé de matchStatCodes.ts -- stat
   visant une équipe vs stat combinée symétrique, aucun invariant
   partagé). Testé 5 vrais appels Claude Sonnet 5 (équipe OVER, équipe
   UNDER, combiné reb, combiné points non-régression, joueur
   non-régression). 5/5.
6. Vrai manque de conception trouvé EN CONCEVANT (pas en testant, cette
   fois) : rien ne mémorisait quelle équipe un pari TEAM_STAT vise --
   ajouté structured_team_id (migration 20260823140000, poussée),
   update_bet_structuration() étendue, tous les points d'appel de
   structureAndScoreBet.ts mis à jour.
7. resolveCalculableReboundsBets() (nouveau) : contrairement à
   total_points (direct via matches.home_score/away_score), les rebonds
   n'existent que dans stats_box_scores -- réutilise resolveNbaGameId()
   (déjà éprouvée côté joueur) + nouvelle resolveNbaTeamId() (même
   rapprochement par tricode). Câblée en parallèle des 3 autres resolvers.

tsc/eslint/vitest(37/37)/next build propres. Migration poussée.
Redéploiement Cloud Run pas encore fait -- à faire avant de tester un vrai
pari rebonds depuis l'appli.

GAPS_OUVERTS.md mis à jour avec le détail complet des 7 morceaux + une
note sur la généralisation à ast/fg3m/stl/blk (patron désormais éprouvé 2
fois, mécanique mais pas fait).
```

## Pièce (a) suite -- généralisation ast/fg3m/stl/blk (23/08/2026, même jour)

```text
"Commit et on enchaine, je redéploye en parallèle" -- juste après avoir
commité la pièce rebonds, l'utilisateur enchaîne directement sur la
généralisation notée "pas fait" dans GAPS_OUVERTS.md, pendant qu'il
redéploie Cloud Run pour la pièce rebonds de son côté.

Patron désormais éprouvé 2 fois (pts -> reb), appliqué une 3e fois à 4
stats d'un coup (ast/fg3m/stl/blk) plutôt qu'une par une -- le geste est
mécanique, pas de raison de le refaire 4x séparément :

1. build_features.py/build_targets.py généralisés en boucle
   (TEAM_COUNTING_STATS/TEAM_TARGET_STATS) plutôt que dupliqués --
   contrairement à la pièce reb (qui avait ajouté reb à la main à côté de
   pts), ici toute la liste est traitée uniformément. Vérifié par
   exécution réelle des 2 scripts + spot-check des valeurs.
2. 2 nouveaux scripts d'entraînement (train_total_team_stats_model.py/
   train_team_stats_model.py) qui bouclent sur les 4 stats plutôt que 8
   scripts dédiés de plus -- les 2 scripts reb dédiés restent tels quels,
   pas fusionnés (fonctionnent, pas de raison de toucher).
3. Décision prise en cours de route : plutôt que garder les 4 fonctions
   dédiées rebonds à côté de nouvelles fonctions génériques (duplication),
   remplacé purement et simplement par des versions paramétrées par
   `stat` -- reb passe maintenant par le même chemin de code que les 4
   autres. Revérifié par un appel réel : même proba qu'avant (0.2173,
   bit-identique) sur le même cas test.
4. 2 endpoints génériques /predict-total-team-stat et /predict-team-stat
   (champ `stat`, 400 clair si code inconnu) -- les 2 endpoints dédiés reb
   restent déployés (contrat HTTP déjà en usage), appellent en interne les
   mêmes fonctions génériques désormais.
5. Rien à changer côté schéma Zod (structureBet.ts) -- déjà généralisé
   depuis les listes de codes dès la pièce reb, juste étendre les listes
   elles-mêmes (teamStatCodes.ts/matchStatCodes.ts).
6. statsService.ts : predictTotalRebounds (dédiée) supprimée -- plus
   personne ne l'appelait une fois predictTotalTeamStat(stat, ...) en
   place pour les 5 stats. predictTeamStat gagne un paramètre stat.
7. resolveCalculableReboundsBets() renommée resolveCalculableTeamStatBets()
   comme annoncé dans la note de la pièce reb -- filtre généralisé
   (TEAM_STAT_CODES.flatMap), logique if/in remplacée par isTotal/stat
   dérivés dynamiquement, .select(stat) au lieu de .select("reb") figé.

Testé en conditions réelles à chaque étape : appel direct supabase_context
(10 prédictions, Boston vs Lakers) + serveur HTTP local réel (uvicorn) sur
les 2 nouveaux endpoints + un appel de régression sur l'endpoint dédié reb
(même proba qu'avant, confirmé) + 10 vrais appels Claude Sonnet 5
(ast/fg3m/stl/blk × équipe précise/combiné, plus 4 cas de régression :
joueur, total_points, reb, rejet d'un pari cumulé sur la série). Tous
corrects. tsc/eslint/vitest(37/37)/next build propres.

Pas encore redéployé sur Cloud Run (l'utilisateur redéploie la pièce reb
en parallèle -- cette généralisation nécessitera un 2e redéploiement pour
être active en prod). Pas testé en conditions réelles depuis l'appli.

GAPS_OUVERTS.md mis à jour : nouvelle entrée en tête détaillant les 7
points, note "généralisation prête, pas fait" de la pièce reb remplacée
par un pointeur vers cette entrée.
```

## Nouveau chantier : liste réelle des 429 paris (23/08/2026, même jour)

```text
"je vais te fournir la liste exacte de tous les paris qu'on doit pouvoir
faire, pour qu'on les ajoute tous !" -- l'utilisateur dépose
Cadrage/Stats/types_de_paris_playoffs_2026.md (429 paris personnalisés
réels, 12 catégories, "dans la limite de ce qu'on peut automatiser").

Avant de coder quoi que ce soit : lecture complète du fichier + vérification
FACTUELLE (pas supposée) de ce que le pipeline supporte déjà, via une
recherche dédiée sur 6 points précis (données quart-temps, titulaires/banc,
oreb/dreb, fga/fg3a exposées ou non, indicateur prolongation, % tir équipe).
Résultat : le tableau est bien plus disparate qu'anticipé -- certaines
catégories sont une extension mécanique du patron ast/fg3m/stl/blk d'hier,
d'autres nécessitent une infrastructure de données qui n'existe pas du
tout (quart-temps : aucune donnée côté Supabase, seulement un play_by_play
local jamais synchronisé ; titulaires/banc : colonne présente dans les CSV
NBA bruts mais jetée dès l'ETL).

Présenté à l'utilisateur en 4 paliers (déjà couvert / extension mécanique
facile / nouveau mécanisme réutilisable / gros chantier d'infrastructure)
+ les 36 paris non-automatisables par design (fun/invalide/ambigu, déjà
correctement rejetés). Question posée : par où commencer ? Réponse :
"Les extensions faciles d'abord mais on fera tout au final, tu me
confirmes ça ?" -- confirmé : ordre croissant de complexité (faciles ->
comparaison/duel -> combos multi-conditions -> infrastructure
quart-temps), rien n'est écarté.

Chantier "extensions faciles" enchaîné dans la foulée (team_pts / fga+fg3a
/ oreb) :

1. team_pts : ajouté "pts" à TEAM_TARGET_STATS (build_targets.py) pour
   avoir pts_reel en perspective own/opp (total_points ne couvrait que le
   combiné). Piège trouvé en codant (pas en testant) : pts_pour/contre
   étaient déjà dans BASE_FEATURE_COLS depuis le tout début du projet
   (home_win) -- _team_stat_base_cols()/feature_cols_for() auraient
   dupliqué la colonne. Corrigé par une dédup générique (filtre les
   colonnes déjà présentes) plutôt qu'un cas particulier sur "pts". Pas de
   total_pts (total_points fait déjà ce travail) -- 2 listes séparées côté
   app.py pour ne pas valider un stat absent d'un des 2 côtés.

2. fga/fg3a : la donnée et les moyennes existaient déjà (utilisées en
   interne pour les modèles de %), seulement pas exposées comme stat à
   seuil. Découverte utile en lisant le code AVANT d'écrire quoi que ce
   soit : supabase_context.py (le service EN PRODUCTION) importe
   REGRESSION_STATS/CLASSIFIER_STATS/PCT_STATS directement depuis
   tester_modele.py (le script CLI local) -- un seul endroit à étendre
   suffit pour que la prod suive automatiquement, pas de duplication à
   synchroniser à la main.

3. oreb (les 3 formes -- joueur, équipe précise, combiné) : le plus gros
   des 3, seul à toucher le schéma Supabase. Migration additive (ADD
   COLUMN, non destructive) + backfill_supabase.py relancé en entier
   (140016 lignes, upsert donc rejouable) -- confirmé avec l'utilisateur
   avant de lancer (action sur la prod). Généralisation mécanique du même
   patron partout ailleurs, SAUF un oubli réel trouvé en testant :
   MATCH_FEATURE_COLS (build_targets.py) n'avait pas oreb_pour_moy5 --
   entrainement_matchs/entrainement_equipe construits AVANT le fix,
   2 scripts d'entraînement plantés sur "no such column". build_targets.py
   corrigé, relancé, tout reparti proprement. Modèle joueur en Poisson
   (comme fg3m/stl/blk, même profil "faible valeur souvent nulle") --
   vérifié empiriquement (calibration 0.2-1.4pp), pas supposé par analogie.

Testé en conditions réelles à chaque étape (Lakers vs Celtics) : HTTP
local (tous les nouveaux endpoints), 9 vrais appels Claude Sonnet 5. Un
faux "bug" trouvé en testant l'extraction IA (calculable=false alors que
player_not_in_match=true) -- en fait une erreur dans mon PROPRE script de
test jetable (prompt système simplifié, instruction manquante), pas un
bug réel : reconfirmé avec le prompt de production complet, comportement
correct. Un vrai cas d'instabilité numérique rare (team_oreb, garde-fou
CONSISTENCY_CHECK_NOTE déjà connu) déclenché une fois sur ~10 essais --
refusé correctement, 3 retries suivants cohérents (transitoire, pas
spécifique à oreb). tsc/eslint/vitest(37/37)/next build propres.

Pas encore redéployé sur Cloud Run. GAPS_OUVERTS.md mis à jour avec le
détail des 3 morceaux + la cartographie complète des 429 paris pour la
suite du chantier.
```

## Comparaison/duel (24/08/2026, chantier suivant)

```text
"on enchaine" -- 2e chantier de la liste des 429 paris, dans l'ordre
convenu (faciles -> comparaison/duel -> combos -> quart-temps).

Relu la catégorie "Comparaison/duel" (36 paris) de près : très hétérogène
(joueur vs joueur, joueur vs somme, équipe vs équipe, multiplicateur,
écart borné, "meilleur marqueur du match" vs le reste des joueurs,
égalité exacte, contre sur un joueur précis...). Avant de coder, cadrage
présenté à l'utilisateur : scope réduit au "duel simple" (le gros du
volume), "meilleur marqueur" repoussé (nécessite une simulation Monte
Carlo, mécanisme différent), 2 cas explicitement exclus (contre sur un
joueur précis -- donnée play-by-play absente ; égalité exacte -- mécanisme
combinatoire différent). Confirmé.

2 décisions de conception posées avant de coder (pas décidées seul) :
1. Stockage : nouvelle colonne JSONB (bets.structured_duel) plutôt que des
   colonnes séparées -- un duel a 2 côtés, chacun pouvant être 1 joueur,
   une somme de joueurs, ou une équipe, ça ne rentre pas dans
   structured_player_id/structured_team_id (conçus pour UNE entité).
2. Approximation normale de la différence pour comparer 2 prédictions
   (indépendance assumée entre les 2 côtés), MÊME pour les stats Poisson
   (fg3m/stl/blk/oreb) plutôt que la vraie loi de Skellam -- accepté comme
   simplification v1, cohérent avec le reste du projet.
Les deux confirmés par l'utilisateur avant de commencer à coder.

Construction :
- Découverte utile en lisant le code (pas en supposant) : supabase_context.py
  a déjà tout ce qu'il faut pour calculer une moyenne/dispersion SANS
  seuil -- juste besoin d'extraire compute_proba()/_compute_team_stat_proba_once()
  jusqu'à l'étape AVANT le norm.cdf(seuil,...) final. Nouvelles fonctions
  _player_stat_mean_scale()/_team_stat_mean_scale() (le cœur extrait),
  réutilisées à la fois par les fonctions existantes (refactor, pas de
  duplication) ET par le nouveau calcul de duel.
- Nouveauté réelle : _player_current_team_id() -- un duel peut nommer
  n'importe quel joueur du match sans que l'appelant sache d'avance de
  quel côté (domicile/extérieur) il se trouve, contrairement à un pari
  PLAYER classique où l'IA résout déjà player_team. Résolu depuis la ligne
  stats_box_scores la plus récente du joueur.
- Nouvel endpoint /predict-comparison, testé en HTTP local réel (joueur vs
  joueur, joueur vs somme de 2, équipe vs équipe, écart borné,
  multiplicateur, duel cross-stat blk/stl, rejet si un joueur nommé n'est
  dans aucune des 2 équipes du match) -- tous corrects.
- Migration 20260824090000 (bets.structured_duel) -- découverte en
  cadrant (pas en codant) : structured_comparison existait déjà (colonne
  texte OVER/UNDER), donc nouveau nom structured_duel pour éviter la
  collision.

Vrai problème trouvé en TESTANT le schéma IA (pas en le concevant) :
premier jet à champs séparés (comparison_left_kind/comparison_left_team/
comparison_relation/comparison_multiplier, symétrique côté droit) portait
le schéma à 19 champs nullable/union -- l'API Claude a rejeté l'appel
("too many parameters with union types... limit: 16"), jamais rencontré
avant dans ce projet (les schémas précédents restaient sous la limite).
Compressé à 13 en fusionnant kind+team (comparison_*_kind vaut
directement "team1"/"team2"), en réutilisant le champ comparison existant
pour porter GT/DIFF_LT, en réutilisant threshold pour le multiplicateur,
et en rendant les tableaux de joueurs non-nullable. Revérifié avec 8 vrais
appels Claude Sonnet 5 après la compression -- tous corrects, y compris
les 2 rejets attendus (égalité exacte, contre sur un joueur précis) et une
régression sur un pari PLAYER simple.

Résolution (resolveCalculableComparisonBets(), nouveau) : lit
structured_duel plutôt que structured_stat, somme la vraie stat sur TOUS
les player_ids d'un côté (1 ou N joueurs, même geste que la construction
de la prédiction).

tsc/eslint/vitest(37/37)/next build propres. Pas encore redéployé sur
Cloud Run. GAPS_OUVERTS.md mis à jour avec le détail complet + la
cartographie des 429 paris rafraîchie (comparaison/duel passé de "pas
fait" à "duel simple codé, meilleur marqueur restant").
```

## Discussion coût des tokens IA (24/08/2026, avant le chantier combo)

```text
L'utilisateur remarque que les appels Claude ont beaucoup de champs et
demande si ça consomme plus de tokens. Mesuré en conditions réelles (pas
supposé) : oui, +50% d'input tokens entre le schéma d'avant COMPARISON et
celui d'après (1263 -> 1894), pour le MÊME pari testé.

Question de suivi : est-ce modifiable plus tard, vu qu'on va encore
ajouter des catégories ? Testé la piste des objets imbriqués (au lieu de
champs à plat) : un schéma avec PLUS de champs "utiles" au total (5
bet_subject dont un COMBO à tableau) passe sans erreur une fois imbriqué,
alors que le schéma plat à 19 champs avait été rejeté par l'API
("too many parameters with union types... limit: 16"). Confirmé : la
limite compte les champs nullable/union RACINE, pas récursivement -- un
objet nullable ne compte que pour 1 quel que soit son contenu.

Mesuré ensuite si l'imbrication réduit aussi les TOKENS (pas seulement le
plafond) : non -- +33% d'input (objets imbriqués plus verbeux en JSON
Schema), -49% d'output (moins de "null" répétés), net légèrement PIRE au
total dans le test. Conclusion donnée à l'utilisateur : l'imbrication
n'est pas un levier de coût, c'est un levier de PLAFOND STRUCTUREL --
à faire pour éviter un futur rejet d'API, pas pour économiser.

Piste alternative testée et concluante : le CACHE DE PROMPT Anthropic.
Séparé le system prompt en bloc statique (instructions + listes de stats
+ schéma, identique à chaque appel) et bloc dynamique (noms d'équipes).
3 vrais appels consécutifs : le 1er écrit ~2530 tokens en cache, les 2
suivants (matchs DIFFÉRENTS) les LISENT à ~10% du prix normal --
confirmé : le schéma de sortie structurée est automatiquement inclus dans
le cache marqué sur le system prompt, pas besoin de cache_control séparé
sur output_config.

Question TTL : 5 minutes (défaut SDK) ou 1 heure ? L'utilisateur signale
que ses potes parient à des horaires très variables dans la journée --
argument en faveur de 1h (une fenêtre de 5 min raterait la plupart des
paris suivants). Discuté, mais l'utilisateur choisit explicitement de
partir sur 5 min pour l'instant et réévaluer selon le taux de succès réel
observé en prod ("on part sur le cache 5 min et on verra après").

Question annexe posée par l'utilisateur : regrouper tous les paris de la
journée et les envoyer en 1-2 fois à horaires fixes, pour économiser
encore plus ? Analysé et DÉCLINÉ (pas juste "non", expliqué pourquoi) :
submitBet() attend structureAndScoreBet() de façon SYNCHRONE et
auto-valide le pari immédiatement si calculable -- décision produit
explicite du 21/08/2026 pour donner un retour instantané et sauter la
file de validation manuelle. Un envoi groupé réintroduirait exactement
l'attente que ce mécanisme a été construit pour éliminer, avec un risque
réel de deadline/match dépassé avant traitement. Calcul de rentabilité
en prime : le regroupement ne bat le cache seul qu'à partir d'environ 10
paris par lot -- en dessous, avec des horaires étalés, il pourrait même
coûter plus cher. Décision : ne pas construire, noté en mémoire pour ne
pas être re-proposé sans un vrai problème de volume observé.

Toute cette discussion + les décisions (imbrication + cache 5min, à faire
lors du chantier combo ; regroupement décliné) sauvegardées en mémoire
long terme (nba_pronos_ai_structuration_schema_plan.md) pour survivre à
cette session.
```

## Combo multi-conditions (24/08/2026, chantier suivant -- même jour)

```text
"on s'attaque" -- 3e chantier de la liste des 429 paris. Cadrage présenté
avant de coder (même rythme que duel) : ET de N conditions, chacune
simple (1 entité, 1 stat) ou sommée (plusieurs entités et/ou plusieurs
stats, réutilise le mécanisme déjà construit pour le duel). 3 exclusions
proposées et confirmées : OU imbriqué, comptage "au moins N joueurs" sur
le roster (regroupé avec "meilleur marqueur" déjà reporté), titulaires/%
tir équipe (déjà bloqués par des données manquantes, chantier à part).
Utilisateur a demandé confirmation que les cas exclus ne sont pas perdus
-- expliqué les 3 paniers où ils atterrissent.

Comme convenu la veille : le refactor du schéma IA (objets imbriqués) et
le cache de prompt (5 min) faits DANS LA FOULÉE de ce chantier, pas
après -- même fichier (structureBet.ts), un seul passage plutôt que deux.
Bénéfice collatéral découvert en réécrivant : les champs auparavant
surchargés par manque de place (threshold portant 3 sens différents selon
le contexte, comparison portant OVER/UNDER ET GT/DIFF_LT) retrouvent
chacun leur propre champ nommé une fois dans leur objet dédié -- code plus
lisible, pas juste plus compact.

Construction Python : découverte utile en concevant (pas en codant à
l'aveugle) -- une condition combo "simple" (1 entité, 1 stat) peut
réutiliser TEL QUEL compute_proba()/_compute_team_stat_proba_once(), déjà
éprouvés, aucune nouvelle logique de calcul nécessaire pour la majorité
des cas réels du classeur (Cunningham pts+passes, Sengun pts+rebonds...).
Seule une condition "somme" (PRA, cumul multi-joueurs) a besoin d'un
mécanisme nouveau -- qui se trouve être une généralisation directe de
_resolve_comparison_operand() (chantier duel) au multi-stats en plus du
multi-joueurs déjà géré, quasi aucun code neuf.

Testé en HTTP local réel : combo simple (2 conditions), PRA (3 stats
sommées 1 joueur), cumul multi-joueurs (2 joueurs, 1 stat), mix dd/td +
stat comptée, mix joueur+équipe, rejet stat non supportée en somme.
Régression /predict-comparison bit-identique.

Test de régression COMPLET du nouveau schéma imbriqué (12 vrais appels
Claude Sonnet 5, les 5 bet_subject + 2 exclusions) : tout correct, ET le
cache de prompt confirmé fonctionnel avec le VRAI contenu de prod (1er
appel écrit en cache, les 11 suivants lisent, quel que soit le pari/match
-- exactement le comportement attendu).

Vrai gap trouvé EN TESTANT (pas prévu au cadrage) : 2 des paris combo
testés portaient sur des joueurs hors du match de test (Cunningham,
Wembanyama) -- l'IA a correctement expliqué qu'elle ne pouvait PAS les
traiter comme "joueur hors match, proba 0%" (mécanisme not_in_match
réservé à bet_subject=PLAYER) et est retombée sur calculable=false. Même
gap pour COMPARISON, jamais remarqué au chantier précédent faute d'avoir
testé ce cas précis à l'époque. Comportement actuel SÛR (repli manuel,
jamais un résultat faux), juste sous-optimal. Pas corrigé maintenant --
noté clairement dans GAPS_OUVERTS.md avec 2 pistes de correction pour
plus tard, pas ignoré silencieusement.

tsc/eslint/vitest(37/37)/next build propres. Pas encore redéployé sur
Cloud Run. GAPS_OUVERTS.md mis à jour avec le détail complet du refactor
schéma+cache, du chantier combo, des 3+1 exclusions, et la cartographie
des 429 paris rafraîchie.
```

## Prolongation / overtime (24/08/2026, chantier suivant)

```text
4e chantier de la liste des 429 paris, après comparaison/duel et combo.
Nouveau `bet_subject=MATCH_TOTAL`, `match_stat="went_to_ot"` : probabilité
directe que LE match aille en prolongation, sans seuil ni comparaison
(même absence que dd/td côté joueur).

Reformulation trouvée en scopant, AVANT de coder : le cadrage initial
supposait qu'il fallait synchroniser tout `play_by_play` vers Supabase --
faux. Le payload live Highlightly (`lib/nba/client.ts`,
`state.score.homeTeam/awayTeam`) a déjà 5 valeurs au lieu de 4 en
prolongation, jusqu'ici sommé puis jeté par `sumQuarters()`. Nouvelle
fonction `wentToOvertime()` (même fichier) -- aucune synchro `play_by_play`
nécessaire. Chantier ramené au tier "nouveau mécanisme réutilisable", pas
à l'infrastructure lourde initialement crainte.

Cible d'entraînement LOCALE (`build_targets.py::build_matchs_training()`)
dérivée de `play_by_play.period` (MAX > 4 = prolongation jouée) -- jamais
synchronisée vers Supabase et pas nécessaire de l'y synchroniser : ce
signal ne sert QU'à l'entraînement local, le signal de PRODUCTION vient de
`wentToOvertime()`. 0 NaN sur les 6602 lignes (couverture 100%). Taux de
base réel : 5.01% (confirme l'estimation ~5-8%).

Modèle `train_overtime_model.py` (calque de `train_home_win_model.py`) :
`RandomForestClassifier`, PAS de `class_weight="balanced"` (leçon dd/td du
20/08/2026 : "balanced" casse la calibration sur un événement rare).
Calibration 0.7-3.9pp, dans la fourchette déjà acceptée pour d'autres
modèles "difficiles" (total_points, team_blk...).

Instabilité numérique reproduite ICI AUSSI, sur un CLASSIFIEUR PUR cette
fois -- l'hypothèse de départ ("jamais observée sauf régression+norm.cdf")
s'est avérée FAUSSE en testant : 1 appel sur 9 a renvoyé une proba
différente lors de la vérification manuelle. `compute_overtime_proba()`
enveloppée dans `_compute_with_consistency_check()` comme les autres
modèles.

Migration `20260824110000_matches_went_to_ot.sql` (poussée) :
`matches.went_to_ot boolean`, peuplée par la synchro
(`lib/sync/results.ts::processOneMatch()`). Pas de backfill de
l'historique (nouveau type de pari, aucun pari existant n'en dépend).

Testé en conditions réelles (Boston Celtics vs Los Angeles Lakers) : HTTP
local réel (`/predict-overtime` + régression `/predict-total-points`
bit-identique), 4 vrais appels Claude Sonnet 5, chaîne complète
structuration→prédiction→service Python vérifiée de bout en bout.
tsc/eslint/vitest(37/37)/next build (38 routes) propres.

Pas encore redéployé sur Cloud Run (2e redéploiement nécessaire, après
celui de duel/combo). Pas testé en conditions réelles depuis l'appli.
GAPS_OUVERTS.md mis à jour avec le détail complet.
```

## Fix : la catégorie auto-validée reflète le vrai bet_subject (24/08/2026)

```text
Bug réel trouvé par l'utilisateur en testant "prolongation" le même jour,
corrigé le jour même. Symptôme : un pari auto-calculable affichait
TOUJOURS "Pari joueur" (`PLAYER_PROP`), quel que soit son vrai
`bet_subject` -- ex. "Le match ira en prolongation" (MATCH_TOTAL, aucun
joueur) affiché comme pari joueur.

Cause : `validated_category` recopiait `proposed_category` sans jamais le
corriger -- `proposed_category` est le défaut du formulaire de soumission
(`DEFAULT_BET_CATEGORY="PLAYER_PROP"`, `lib/labels/bets.ts`), jamais
aligné sur le `bet_subject` réel déterminé par l'IA (celui qui sert
pourtant déjà à calculer la proba). Concerne TOUS les bet_subject
auto-calculables, pas seulement `went_to_ot` -- présent depuis la 1ère
auto-validation (Phase 5, 21/08/2026), jamais remarqué avant faute d'avoir
eu plusieurs bet_subject différents à comparer côte à côte.

Corrigé : nouveau paramètre `p_category` sur `update_bet_structuration()`
(migration `20260824120000_bets_auto_category.sql`, poussée) --
`validated_category = coalesce(p_category, v_proposed_category)`,
uniquement dans la branche `calculable=true` (le repli manuel garde la
main comme avant). `structureAndScoreBet.ts` dérive `p_category` à chacun
des 6 points d'appel. Pas rétroactif : les paris déjà validés avant ce
déploiement gardent leur catégorie existante, potentiellement fausse --
hors scope de ce fix ponctuel.

tsc/eslint/vitest(37/37)/next build propres. Pas encore testé de bout en
bout via l'appli (nécessite un vrai pari soumis avec une vraie session
utilisateur, pas testable en `service_role`). GAPS_OUVERTS.md mis à jour.
```

## Gap noté : pertes de balle (tov), pas encore une stat pariable (24/08/2026)

```text
Trouvé par l'utilisateur en testant ("Les Warriors font au moins 5 pertes
de balle" ne se calcule pas). Même situation que `oreb` avant son chantier
"extension facile" du 23/08/2026 : la donnée brute existe déjà localement
(`box_scores.tov`, récupérée depuis l'API NBA, jamais exposée), mais `tov`
est absente de `STAT_CODES` (joueur) et `TEAM_STAT_CODES`/
`MATCH_STAT_CODES` (équipe). Décidé avec l'utilisateur : pas fait
maintenant, à reprendre plus tard -- même patron mécanique que oreb
(pipeline + modèle(s) + schéma IA + résolution) si repris. Noté dans
GAPS_OUVERTS.md, pas de code touché.
```

## % tir équipe (24/08/2026, chantier suivant -- session interrompue puis reprise)

```text
5e chantier de la liste des 429 paris, après overtime (annoncé en fin de
l'entrée overtime ci-dessus : "reste : % tir équipe, puis quart-temps").

Nouveau `TeamStatCode` `ft`/`fg`/`fg3`, seuls membres dont le `threshold`
est une FRACTION 0-1 (comme `PERCENTAGE_STATS` côté joueur) plutôt qu'une
valeur comptée -- nouveau `TEAM_PERCENTAGE_STATS` (`teamStatCodes.ts`)
pour distinguer les deux familles à la résolution et à l'affichage.

Résolution (`resolveCalculableTeamStatBets()`, étendue) : ft/fg/fg3 n'ont
pas de colonne pré-calculée dans `stats_box_scores` -- agrège
makes/attempts sur tous les joueurs de l'équipe pour le match, puis
calcule le ratio. Piège trouvé en codant : un `.select()` en template
dynamique (`` `${a}, ${b}` ``) casse le typage généré par
`@supabase/supabase-js` (TS2352) -- remplacé par une sélection littérale
fixe des 6 colonnes.

Modèle Python (`train_team_pct_model.py`, nouveau) : même principe que
côté joueur -- rétrécissement bayésien + Binomiale/Beta-Binomiale, à
l'échelle équipe. Entraîné avec succès (3 `.joblib` générés). Nouvel
endpoint `/predict-team-pct`, même contrat que `/predict-team-stat`.
Pipeline `build_features.py`/`build_targets.py` étendu pour fournir les
nouvelles colonnes tentatives/sum10 nécessaires au rétrécissement.

Vrai bug trouvé EN CODANT (pas en testant) dans
`supabase_context.py::build_team_context()` : le `.agg()` était codé en
dur à 7 stats au lieu d'être généré depuis `TEAM_COUNTING_STATS` -- 
plafonnait SILENCIEUSEMENT dès qu'une 8e stat rejoignait la liste,
cassant même les endpoints DÉJÀ en prod sans erreur visible. Rendu
dynamique pour de bon.

Session interrompue par un freeze juste après ce fix, avant la fin de la
vérification -- reprise dans la session suivante : tsc/eslint/
vitest(37/37)/next build reconfirmés propres, commit `e95cc68`.

Contrairement aux chantiers précédents, PAS encore testé en HTTP local
réel ni via de vrais appels Claude Sonnet 5 sur ft/fg/fg3 -- seuls les
modèles ont été entraînés avec succès et la vérification statique est
propre. Pas encore redéployé sur Cloud Run. GAPS_OUVERTS.md mis à jour
avec une nouvelle entrée en tête détaillant le chantier.
```

## % tir équipe : redéploiement Cloud Run + vérification prod (24/08/2026, même jour)

```text
Redéployé par l'utilisateur (`gcloud run deploy nba-pronos-stats --source .
--region europe-west1`) puis vérifié en conditions réelles :
`/health` répond 200, `modeles_charges` liste `team_ft_pct`/`team_fg_pct`/
`team_fg3_pct`. `/predict-team-pct` appelé en prod (Boston Celtics vs Los
Angeles Lakers, stat `ft`, seuil 0.78, `equipe_domicile=true`) :
`proba=0.488`, détail "tentatives predites = 21 | taux estime = 77.7%
(ligue: 78.3%) [Beta-Binomial, incertitude sur le taux gardee]" -- cohérent
(taux estimé proche de la moyenne ligue, proba proche de 50% vu
l'incertitude Beta-Binomiale sur un seuil proche du taux réel).

Pas encore testé via de vrais appels Claude Sonnet 5 (structuration d'un
pari ft/fg/fg3 depuis l'appli) ni résolu automatiquement sur un vrai match
joué -- seul l'appel HTTP direct au service est confirmé pour l'instant.
GAPS_OUVERTS.md mis à jour avec le résultat du test.
```

## Pari période (équipe + joueur) -- dernier chantier de la liste des 429 paris (24/08/2026)

```text
Dernier morceau de la liste des 429 paris : "pari période" (47 paris,
quarts-temps/mi-temps, niveau équipe). En le cadrant, l'utilisateur a
soulevé que ces paris peuvent aussi viser UN joueur précis (ex. "3 contres
en 1ère mi-temps pour Untel") -- 2e chantier connexe, décidé de construire
les deux dans la foulée, backfill historique inclus.

Équipe : score par quart-temps déjà présent dans le payload live
Highlightly (`state.score.homeTeam/awayTeam`), juste jamais persisté --
`matches.quarter_scores jsonb`. 6 modèles dédiés par famille de résultat
(`train_period_model.py`), `/predict-period` généralisé par `outcome_kind`.
Bug de sémantique auto-corrigé AVANT d'entraîner quoi que ce soit : MARGIN
("l'écart à la fin du 3e quart-temps") est CUMULATIF depuis le début du
match, pas le quart concerné seul -- `cumulativeQuarterIndices()` distinct
de `periodQuarterIndices()` (segment, réutilisé par TOTAL_POINTS/
QUARTER_WINNER/etc). Testé en HTTP local réel : 7/7 outcome_kind corrects.

Joueur+période : vérifié empiriquement que `play_by_play` LOCAL ne suffit
PAS pour reconstruire les cibles d'entraînement (contres/interceptions/
passes pas structurés, embarqués en texte libre dans `description`) --
contrairement à `BoxScoreTraditionalV3(range_type="1", start_period=
end_period=N)` côté API officielle, qui renvoie de vraies stats par
période (vérifié sur un match réel). Nouvelle table
`stats_box_scores_by_period`, `refresh_daily.py` étendu (synchro
quotidienne), `backfill_period_box_scores.py` (nouveau, historique complet,
resumable) lancé en tâche de fond -- ~6600 matchs, débit réel mesuré ~9-13
matchs/min, donc plutôt ~8-11h au total (l'estimation initiale de ~3h
était optimiste). Prédiction `/predict-player-period` : pas de modèle
entraîné avant la fin du backfill -- approximation v1 assumée (réutilise
`_player_stat_mean_scale()` du chantier duel, part fixe de période
Q1-Q4=25%/H1-H2=50%, dispersion réduite en `sqrt(part)`), restreinte à
REGRESSION_STATS, à remplacer par un vrai modèle une fois le backfill
terminé. Testé en HTTP local réel : 4/4 cas corrects.

**Incident réel trouvé EN TESTANT avec de vrais appels Claude Sonnet 5**
(première fois que la structuration IA était testée pour ce chantier,
après tout le reste construit) : ajouter `period_bet` comme 7e
`bet_subject` dans le schéma Zod PARTAGÉ de `structureBet.ts` a cassé
TOUS les paris, pas seulement PERIOD -- `400 The compiled grammar is too
large` côté API Claude, reproduit même sur un pari overtime n'ayant rien
à voir avec `period_bet`. Le schéma existant (hérité des chantiers combo/
duel) était déjà au plafond de complexité accepté par l'API pour les
sorties structurées : +467 caractères de JSON schema compilé (+5.8% sur
les 8089 caractères de baseline) a suffi à le faire échouer de façon
fiable. Factoriser les enums répétés en instances Zod partagées ($ref-
dédupliqué) a réduit la taille du JSON envoyé mais pas la grammaire
compilée côté serveur -- testé, insuffisant.

Discuté avec l'utilisateur avant de corriger (3 options présentées :
compresser le schéma existant / appel de secours en 2 étapes / reporter
PERIOD) : parti sur un schéma SÉPARÉ et minimal (`structurePeriodBet.ts`,
3731 caractères compilés, testé OK) plutôt qu'un appel de secours
déclenché sur `calculable=false` (explicitement écarté après question de
l'utilisateur -- coupler le coût de PERIOD à toute la population, non
bornée, des paris déjà/futurs non calculables). Routage EN AMONT par
mot-clé (`PERIOD_KEYWORD_REGEX`, `structureAndScoreBet.ts`) : un texte qui
matche appelle EXCLUSIVEMENT le schéma période, jamais les deux. Testé sur
les 47 exemples réels du corpus : 17/20 paris période matchent (les 3
prolongations en sont volontairement exclues, gérées par `went_to_ot`
inchangé), 5 "faux positifs" vérifiés un par un en conditions réelles --
aucun ne produit de mauvaise proba, y compris le cas le plus risqué (un
pari COMBO mentionnant "quarts-temps" en passant, correctement rejeté
plutôt que mal extrait). `structureBet.ts` restauré à l'identique du
commit précédent -- aucune régression possible sur les 5 types déjà en
prod, reconfirmé par un vrai appel API après restauration.

Généralisation du routage par mot-clé aux 5 autres `bet_subject`
explicitement écartée (question posée par l'utilisateur, réponse détaillée
donnée) : leur distinction est sémantique, pas lexicale ("Tatum marque
plus de points que Booker" vs "Tatum marque plus de 25 points" partagent
les mêmes mots) -- un mot-clé ne peut pas les séparer de façon fiable sans
risquer de mal router des cas qui fonctionnent aujourd'hui.

`tsc`/`eslint`/`vitest` (37/37)/`next build` propres après restructuration.
Backfill toujours en cours en fin de session -- resumable, se relance avec
`python backfill_period_box_scores.py`. GAPS_OUVERTS.md mis à jour avec le
détail complet des 2 chantiers et l'implication structurelle pour les
futurs types de paris (schéma partagé au plafond, patron à réutiliser).
```

## Pari période -- redéploiement Cloud Run + 2 bugs réels trouvés en testant via l'appli (24/08/2026, même jour)

```text
Redéployé par l'utilisateur, puis testé en conditions réelles : plusieurs
paris période soumis sur de vrais matchs de la compétition active
("Playoffs NBA (simulation)"). 3/5 corrects du premier coup (QUARTER_WINNER
équipe, MARGIN cumulé, POINT_SHARE_PCT) -- 2 échecs réels, ni l'un ni
l'autre détecté par les scripts de test isolés de la session précédente
(qui appelaient structureBet/structurePeriodBet directement, jamais toute
la chaîne structureAndScoreBet.ts avec de vraies résolutions série/match).

1. LEADS_HALF_RESULT rejeté à tort ("Cleveland mène à la mi-temps et gagne
   le match", correctement classifié par Claude -- reproduit en isolation,
   confirmé -- mais rejeté par un garde-fou trop simple dans
   structureAndScoreBet.ts : testait threshold ET comparison ensemble dès
   qu'un outcome_kind n'était pas QUARTER_WINNER/HALF_WINNER, alors que
   LEADS_HALF_RESULT a besoin de comparison SANS threshold -- 3 catégories
   réelles, le code n'en gérait que 2). Corrigé.

2. Paris joueur+période systématiquement rejetés ("Jayson Tatum réalise au
   moins 3 rebonds dans le 4e quart-temps", classification Claude correcte
   -- reproduit en isolation -- mais predictPlayerPeriodStat()
   (statsService.ts) n'envoyait jamais `comparison` dans le corps de la
   requête HTTP vers /predict-player-period (contrairement à
   predictPeriodTeamOutcome(), qui l'envoie bien) -- le service Python
   recevait comparison=null, le rejetait explicitement (400, "seuil/
   comparison obligatoires"), predictPlayerPeriodStat() retournait null.
   Diagnostiqué en rejouant la requête EXACTE envoyée par l'appli
   directement contre le service Cloud Run déployé (400 reproduit), puis
   en la rejouant avec comparison ajouté (200, proba cohérente) --
   confirme le bug avant de toucher au code. Corrigé (1 ligne).

tsc/eslint/vitest (37/37)/next build propres après les 2 fixes. Vérifiés
directement contre le service Cloud Run déployé (mêmes requêtes que
l'appli, 400 avant/200 après pour les 2). Les 2 paris déjà soumis en échec
restent en l'état (pas de correction rétroactive) -- à re-soumettre.
GAPS_OUVERTS.md mis à jour.
```

## Plan de reprise post-audit + étape 1 "5 majeur/banc" (24/08/2026, même jour)

```text
Utilisateur revient avec `Cadrage/Stats/Paris gérés_non gérés - Feuille
1.csv`, l'audit des 429 paris annoté ligne par ligne (idées, questions,
propositions). Recherche faite dans les données brutes déjà téléchargées
avant de proposer un plan : colonne `position` (titulaire/remplaçant)
présente dans les box scores locaux, jamais capturée ; fautes techniques/
temps morts/retour en zone/flagrant/ejection tous présents comme
actionType structurés dans le play-by-play, jamais agrégés. Plan en 8
étapes validé avec l'utilisateur, 4 points explicitement différés notés
dans GAPS_OUVERTS.md pour ne pas les perdre, 5 points vraiment
impossibles écartés (blessures, score exact, panier à 4 points...).

Étape 1 -- "5 majeur/banc" : `position` ajoutée à
STATS_BOX_SCORE_TRAD_COLUMNS (synchro quotidienne) + backfillée pour les
6602 matchs déjà connus (`backfill_starter_position.py`, aucun appel API,
1:1 vérifié entre CSV locaux et matchs Supabase). Bug réel trouvé en
codant le backfill : un upsert à payload partiel échoue sur cette table
(Postgres valide les NOT NULL de l'INSERT avant le conflit) -- corrigé
avec une fonction SQL de mise à jour en masse dédiée
(`bulk_update_box_score_position()`).

Aucun modèle dédié entraîné : `_team_starters()` (nouveau,
supabase_context.py) approxime les titulaires par fréquence d'apparition
en position non vide sur les 10 derniers matchs -- pas de confirmation
officielle de composition avant le match dans ce projet.
`compute_roster_split_proba()` réutilise `_player_stat_mean_scale()`/
`_team_stat_mean_scale()` déjà là, combinés par somme/soustraction sous
indépendance. Nouveau schéma IA séparé (`structureRosterSplitBet.ts`),
routé par mot-clé comme PERIOD -- schéma principal toujours inchangé.

Testé : 5 vrais appels Claude Sonnet 5 (3/3 corrects, 2/2 rejets corrects)
+ 3/3 `/predict-roster-split` en HTTP local réel + garde stat non
supportée vérifiée. Portée v1 volontairement limitée ("10 titulaires
marquent chacun 8+" = condition individuelle, pas une somme, différé à
l'étape 3 comptage roster-wide). `tsc`/`eslint`/`vitest`(37/37)/`next
build` propres. Pas encore testé de bout en bout via l'appli (vrai pari
soumis) ni redéployé sur Cloud Run/Vercel. GAPS_OUVERTS.md mis à jour.
```

## Étape 2 (partielle) "petits gains groupés" (24/08/2026, même jour)

```text
2 des 4 items faits, 2 requalifiés en creusant (pas juste codés à
l'aveugle) : "+/- comme stat pariable" et "comparaison volume tirs
équipe (fga)" ont besoin chacun d'un VRAI modèle entraîné (aucun
plusminus.joblib/team_fga.joblib n'existe, contrairement à ce que le plan
supposait) -- pas fait dans cette passe, noté dans GAPS_OUVERTS.md pour
décision avec l'utilisateur plutôt que bâclé.

OU logique (relation="OR" sur COMPARISON) : ajout d'1 valeur d'enum +
réutilisation du champ threshold existant (pas de nouveau champ) --
mesuré avant de déployer : +186 caractères sur le schéma compilé
(8089->8275), loin sous le seuil qui avait cassé PERIOD (+467). Restreint
aux stats comptées comme le reste de COMPARISON (pas les %, mécanisme
Beta-Binomial différent) -- l'exemple original du CSV utilisateur (%
plutôt que comptage) n'est donc pas couvert par cette version. Testé avec
2 vrais appels Claude + 2 appels HTTP réels (calcul + garde).

Pari "fourchette" (ex. "Minnesota marque entre 101 et 110 points") :
finalement pas un nouveau mécanisme, juste un exemple ajouté au prompt
COMBO existant (2 conditions même équipe/stat). Découverte utile en le
mesurant : le TEXTE du prompt statique n'entre PAS dans le calcul de la
grammaire compilée par l'API Claude, seule la FORME du schéma Zod compte
-- vérifié (même taille de schéma avant/après l'ajout de l'exemple). Les
exemples du prompt peuvent donc être étoffés librement à l'avenir, sans
risque de replonger dans le plafond de complexité.

tsc/eslint/vitest(37/37)/next build propres. GAPS_OUVERTS.md mis à jour
avec la requalification des 2 items restants et une question ouverte pour
l'utilisateur (entraîner maintenant vs traiter comme 2 petits chantiers
séparés plus tard).
```

## Étape 2 terminée -- entraînement +/- et fga (24/08/2026, même jour)

```text
L'utilisateur choisit d'entraîner les 2 modèles requalifiés maintenant
plutôt que plus tard. build_features.py/build_targets.py régénérés en
local (140933/6602/13204 lignes, comptes inchangés -- pas de perte de
données), train_stat_model.py et train_team_stats_model.py relancés.

plus_minus.joblib entraîné du premier coup (R²=0.039, faible mais attendu
-- le +/- est un agrégat d'équipe, intrinsèquement bruité au niveau
individuel). En le câblant côté service déployé (supabase_context.py,
PAS le script d'entraînement local -- 2 chemins de code séparés pour la
même feature), KeyError réel reproduit en HTTP (`plus_minus_moy10`
jamais calculé, seul moy5 existait). Corrigé, retesté, proba cohérente.

team_fga.joblib : échec réel EN ENTRAÎNANT (pas en câblant) --
`entrainement_equipe` n'avait pas les colonnes own_/opp_ attendues par
train_team_stats_model.py, `fga` vivant dans un mécanisme "own uniquement"
distinct (PCT_EXTRA_COLS, propre à train_team_pct_model.py, chantier "%
tir équipe" déjà en prod). Corrigé en dérivant les 8 colonnes manquantes
À PART dans build_targets.py, sans toucher PCT_EXTRA_COLS -- vérifié que
ça ne casse rien côté % tir équipe (rien d'autre modifié). Modèle
re-entraîné avec succès (R²=0.133).

fga ajouté à TEAM_STAT_CODES des DEUX côtés (TS et la liste Python séparée
de app.py -- pas partagée entre les 2 langages, piège déjà documenté en
tête de statCodes.ts). Testé en conditions réelles : /predict (plus_minus),
/predict-team-stat (fga), /predict-comparison (fga en DIFF_LT -- le cas
"comparaison volume tirs" du CSV original), et la phrase EXACTE du CSV
utilisateur rejouée via Claude + service, succès de bout en bout.

Impact schéma partagé mesuré avant déploiement (STAT_CODES/TEAM_STAT_CODES
apparaissent à plusieurs endroits) : +68 caractères, cumul +254 depuis la
baseline (8089), loin sous le seuil qui avait cassé PERIOD (+467).
tsc/eslint/vitest(37/37)/next build propres. GAPS_OUVERTS.md mis à jour --
étape 2 du plan de reprise entièrement terminée (4/4).
```
