# NBA Pronos — État du développement du prototype

> **Nature de ce document** : synthèse technique de ce qui a été CONSTRUIT (code, base de données), à destination d'une future conversation Claude qui devra reprendre le développement. Ne contient pas les règles fonctionnelles (qui restent dans la synthèse Claude Project et les fichiers `decisions_0.2.x`) — uniquement l'état d'avancement technique et les décisions d'implémentation prises en cours de route.
>
> **À faire par l'utilisateur** : remplacer la version précédente de ce fichier dans les fichiers du Project, pour qu'une nouvelle conversation puisse s'en servir de point de départ.

---

## 1. Contexte technique

```text
Stack   : Next.js 16.2.10 (Turbopack, App Router, TypeScript, Tailwind) + Supabase (Postgres).
Sans src/ : le projet utilise la racine (app/, lib/) directement, pas de dossier src/.
RLS     : volontairement absente (phase prototype, 0.2.10).
Auth    : aucune — pas de vrai système de connexion, un seul admin (l'utilisateur),
          16 bots scriptés (voir §3). C'est CE compte admin qui incarne le "joueur
          humain" sur les écrans "Mes pronos match", "Mon bracket" et "Mes paris".
Dossier local : nba-pronos-proto (chemin exact sur la machine de l'utilisateur, Windows).
OS      : Windows, PowerShell — Node.js tourne en local (npm run dev), Turbopack.
```

---

## 2. Fichiers créés jusqu'ici

### Scripts SQL (exécutés dans Supabase SQL Editor, dans cet ordre)

```text
schema_prototype.sql       — schéma complet (tables, enums, vues), sans RLS. DÉJÀ EXÉCUTÉ.
seed_initial_data.sql      — 16 équipes, 15 séries (structure), competition_settings,
                              compte admin, 5 bots initiaux. DÉJÀ EXÉCUTÉ.
seed_simulation_state.sql  — ligne simulation_state initiale. DÉJÀ EXÉCUTÉ.
migration_margin_bonus_points.sql — sépare le scoring des pronos match en 2 colonnes
                              stockées (winner_points / margin_bonus_points). DÉJÀ EXÉCUTÉ.

reset_simulation.sql ("Nouvelle saison") — réinitialise une saison fraîche : EFFACE
  correction_requests / match_predictions / bets / bracket_picks / brackets / matches,
  réinitialise les séries, nouvelle seed + curseur, reprogramme les 8 matchs "game 1"
  du 1er tour à J+1 20h (heure de Paris). EXÉCUTÉ 2 FOIS au total, toutes deux il y a
  2 sessions (avant celle-ci et celle d'avant) — accord explicite de l'utilisateur à
  chaque fois, qui savait que ça effacerait les données de test déjà validées.

test_faux_brouillons.sql / test_bracket_partiel.sql — NON SAUVEGARDÉS EN FICHIER LOCAL,
  nettoyés depuis par les resets.

--- Scripts SQL exécutés directement dans le SQL Editor (session d'il y a 2 séances et
    celle d'avant celle-ci), aucun n'est un fichier .sql sauvegardé localement ---

Ajout de 10 bots supplémentaires (5 → 15) : insert users avec bot_profile, répartition
  réaliste (2 ALL_ROUNDER, 3 BETTOR, 4 REGULAR, 2 VISIONARY, 4 CASUAL au total).
Ajout ponctuel d'1 bot de test (Bot_Test_Deadline, ALL_ROUNDER) pour valider le fix de
  deadline du bracket — ⚠️ JAMAIS SUPPRIMÉ (voir §3, gap toujours ouvert).
Résolution en masse des paris MATCH : UPDATE bets basé sur l'écart réel du match
  (< 5 points → WON), CAST explicite ::bet_status nécessaire (piège Postgres, voir §13).
Résolution en masse des paris SÉRIE : UPDATE bets basé sur le nombre de matchs
  FINISHED d'une série officiellement FINISHED (7 matchs → WON, sinon LOST).
```

### Code applicatif (Next.js)

```text
lib/supabaseClient.ts      — client Supabase partagé.
lib/prng.ts                — générateur pseudo-aléatoire déterministe partagé (seededRandom).
lib/simulationEngine.ts    — simulateMatchOutcome(seed, matchId) : résultat déterministe
                              d'un match (vainqueur, écart, scores).
lib/deadlineValidation.ts  — Fonctions de DÉCISION PURE pour les auto-validations à la
                              deadline (pronos match ET bracket). Voir §5.
lib/bracketCandidates.ts   — computeNextRoundCandidates(feederSlot1WinnerId,
                              feederSlot2WinnerId) : fonction de DÉCISION PURE qui calcule
                              les 2 équipes candidates d'une série de tour 2+, à partir
                              UNIQUEMENT des picks du joueur sur les 2 séries qui
                              l'alimentent (JAMAIS le résultat réel — voir §7.2).
lib/simulationAdvance.ts   — advanceSimulationByOneDay() : cœur du moteur de simulation.
                              Résout les matchs échus, détecte fin de série, propage le
                              vainqueur au tour suivant, programme le match/tour suivant,
                              auto-valide les paris/pronos/brackets à leur deadline.
lib/botConfig.ts           — BOT_FILL_RATES par profil de bot. Inchangé depuis 2 sessions.
lib/botScripting.ts        — runBotScripts() : fait "jouer" TOUS les bots (dynamique,
                              requête sur bot_profile non nul — aucune limite en dur sur
                              le nombre de bots). RÉÉCRIT il y a 2 sessions, voir §7.7
                              pour le détail complet des 4 bugs corrigés.
lib/scoringEngine.ts       — recalculateAllScores() : recalcul idempotent complet.
                              VÉRIFIÉ (scoring bracket série par série, cross-check
                              manuel sur Bot_Complet — voir §4).
lib/testTools.ts           — ⚠️ OUTIL DE TEST UNIQUEMENT, jamais relié à un vrai écran.
lib/betQuota.ts            — Fonctions PURES de quota : computeMatchBetQuota(),
                              canCreateMatchBet(), canCreateSeriesBet() — voir §8.
                              RÉUTILISÉES par lib/botScripting.ts (les bots passent
                              maintenant par les mêmes fonctions que le joueur).
lib/betQueries.ts           — Fonctions de lecture Supabase pour les paris :
                              getMyMatchBets (fenêtre 3 jours), getAllMyMatchBets /
                              getMySeriesBets (historique complet), getEligibleSeriesForBet,
                              getSeriesLabels, getSimulationCursorAt, toQuotaInput.
                              RÉUTILISÉES par lib/botScripting.ts.

app/page.tsx                — page d'accueil, TEST de connexion Supabase uniquement.
app/admin/page.tsx           — tableau de bord admin (debug). Boutons remplacés par
                                <SubmitButton> (état de chargement visible) et
                                <AdvanceManyDaysControl> (progression en direct
                                "Jour X / N"). VÉRIFIÉ FONCTIONNEL.
app/admin/SubmitButton.tsx   — Client Component, useFormStatus(), bouton
                                désactivé + texte "en cours..." pendant une Server Action.
app/admin/AdvanceManyDaysControl.tsx — Client Component qui boucle CÔTÉ CLIENT
                                sur advanceOneDayStep() (1 requête par jour, au lieu
                                d'une seule requête géante) — affiche "Jour X / N en
                                cours...". Remplace le <form action={advanceManyDays}>.
app/admin/actions.ts         — server actions du tableau de bord admin. Contient
                                advanceOneDayStep() et finalizeAdvance() pour
                                AdvanceManyDaysControl. advanceManyDays() (l'ancienne
                                version, tout-en-un) reste présente mais N'EST PLUS
                                APPELÉE par page.tsx — inoffensif, pas supprimée.
app/admin/paris/page.tsx     — file de résolution des paris (Gagné/Perdu). Gestion
                                d'erreur Supabase ajoutée (error jamais vérifié avant),
                                affichage enrichi (équipes, conférence, score réel du
                                match visé). VÉRIFIÉE avec de vrais paris sur une
                                saison complète, fonctionne correctement.
app/admin/paris/actions.ts   — server actions de résolution (resolveBetWon/Lost).
                                Inchangé, vérifié fonctionnel.
app/classement/page.tsx      — Écran "Classement" (0.2.6). Tri complet sur 6 colonnes
                                (Total/Matchs/dont Écarts/Bracket/Paris/Forme 7j),
                                inversion asc/desc au reclic sur la même colonne (état
                                porté par l'URL ?sort=&dir=, composant serveur, pas de
                                useState). Rang TOUJOURS calculé sur Total peu importe
                                le tri d'affichage actif (0.2.9 §6 : "ne jamais perdre
                                le référentiel du classement réel") — calculé une fois
                                dans une Map séparée de l'ordre d'affichage. Requête
                                ajoutée sur la vue user_recent_form (jamais interrogée
                                avant cette session). "dont Écarts" (margin_bonus_points)
                                rendu triable à la demande de l'utilisateur — CE N'EST
                                PAS une des 5 colonnes listées par 0.2.6/0.2.9 (Total/
                                Matchs/Bracket/Paris/Forme récente), à garder en tête.
                                Tri alphabétique par pseudo explicitement DIFFÉRÉ EN V1
                                sur demande de l'utilisateur (non couvert par 0.2.6/
                                0.2.9 non plus).
app/bracket-global/page.tsx  — NOUVEAU. Écran public "Bracket global" (0.2.2 §9,
                                0.2.6 §4). Garde d'accès GLOBALE ET UNIQUE (si
                                cursor_at < bracket_deadline → page entièrement
                                cachée, rien d'autre affiché). 15 séries groupées par
                                tour puis conférence (Est puis Ouest au 1er tour,
                                0.2.9 §5), chacune affichant l'état réel (si connu) et
                                la tendance agrégée au format exact de l'exemple 0.2.2
                                ("45% ont prévu Celtics 4-2" — vainqueur + format de
                                score les plus fréquents ENSEMBLE, pas séparément).
                                Seuil dynamique %/brut calculé PAR SÉRIE, pas sur le
                                bracket entier (interprétation tranchée avec
                                l'utilisateur, documentée en §10bis). Libellé "champion"
                                au lieu de "vainqueur de la série" pour NBA_FINALS
                                (même donnée, vocabulaire différent selon 0.2.2).
                                Drill-down nominatif par série via ?series=<id>
                                (composant serveur, lien Next, pas de modale JS) —
                                jamais le bracket entier d'un joueur d'un coup (0.2.2
                                §9). VÉRIFIÉ FONCTIONNEL : mélange réel de séries
                                affichées en % et en nombre brut observé selon le tour
                                (tour 1 souvent au-dessus de 10, tours suivants en
                                dessous à cause de l'effet cascade — cohérent).
app/paris-globaux/page.tsx   — NOUVEAU. Écran public "Paris des joueurs" (0.2.4 §9).
                                PAS de garde d'accès globale contrairement au bracket :
                                révélation PARI PAR PARI, chacun à SA PROPRE deadline
                                (règle 0.2.4 exacte : "chaque pari devient public à SA
                                propre deadline, détail nominatif complet") — 1er match
                                de la série pour un pari série, coup d'envoi du match
                                visé pour un pari match. Un pari SUBMITTED (pas encore
                                traité par l'admin) est déjà visible si sa deadline est
                                dépassée — la visibilité ne dépend QUE de la deadline,
                                jamais de la résolution admin. Les DRAFT sont toujours
                                exclus (`.neq('status', 'DRAFT')`) — jamais soumis,
                                jamais publics. Regroupement par série (même structure
                                que bracket-global, pour une lecture cohérente d'un
                                écran public à l'autre). Paris CANCELLED affichés
                                barrés + grisés, visuellement distincts d'un LOST
                                (0.2.9 §7 : "visuellement DISTINCT d'un perdu"). Tri
                                Gagné→Perdu (ordre de priorité sur le statut existant,
                                pas un nouveau champ) et alphabétique par joueur, via
                                ?sort=, appliqué séparément aux paris SÉRIE et MATCH
                                de chaque section. VÉRIFIÉ FONCTIONNEL.

app/pronos/page.tsx          — Écran "Mes pronos match" (0.2.3) — voir §6.
app/pronos/actions.ts        — Server actions pronos : saveDraftMatchPrediction,
                               validateMatchPrediction, validateAllCompleteFormEntries.
app/pronos/ValidateButton.tsx     — Bouton "Valider" d'un match (composant client).
app/pronos/ValidateAllButton.tsx  — Bandeau "Valider tous les matchs complets".
app/pronos/betActions.ts    — saveDraftMatchBet, submitMatchBet (upsert commun
                               upsertActiveMatchBet), submitAllCompleteBetEntries.
app/pronos/AddBetForm.tsx   — Formulaire de pari MATCH (création/édition de
                               brouillon), sur la carte de match — voir §6.6.
app/pronos/SubmitAllBetsButton.tsx — Bandeau "Soumettre tous mes paris complets" §6.7.

app/bracket/page.tsx          — Écran "Mon bracket" (0.2.2) complet — voir §7.
app/bracket/actions.ts        — Server actions : saveBracketPick, validateBracket
                               (+ helpers internes getOrCreateBracket, getAdminId,
                               getValidCandidateTeamIds). ⚠️ TOUJOURS NON REVÉRIFIÉ
                               pour la question du bracket_deadline (côté JOUEUR
                               HUMAIN, pas les bots) — gap ouvert depuis 2 sessions,
                               toujours pas traité.
app/bracket/ValidateBracketButton.tsx — Bouton "Valider mon bracket" (composant
                               client, PAS irréversible contrairement aux pronos).

app/paris/actions.ts        — saveDraftSeriesBet, submitSeriesBet (upsert commun
                               upsertActiveSeriesBet).
app/paris/SeriesBetForm.tsx — Formulaire de pari SÉRIE, 2 modes (création/édition) §9.3.
app/paris/page.tsx          — Écran "Mes paris" (0.2.4) complet — voir §9. Reste
                               volontairement PERSONNEL (mes brouillons/mes paris) —
                               distinct de app/paris-globaux (public, tous joueurs),
                               même séparation que /bracket (personnel) vs
                               /bracket-global (public).
```

---

## 3. État actuel de la base de données

```text
- 17 utilisateurs : 1 admin (le porteur du projet, joueur humain) + 16 bots
  (15 de la répartition "réaliste" voulue + Bot_Test_Deadline, créé pour un test
  technique ponctuel et JAMAIS SUPPRIMÉ depuis 2 sessions).
- Répartition des 15 bots "officiels" : 2 ALL_ROUNDER, 3 BETTOR, 4 REGULAR,
  2 VISIONARY, 4 CASUAL (Bot_Test_Deadline, ALL_ROUNDER, est un 16e bot en plus,
  hors de cette répartition voulue).
- 16 équipes, 15 séries (structure de l'arbre bracket).
- Seed 'nba-pronos-seed-2' (inchangée depuis le 2e reset, il y a 2 sessions).
- Saison COMPLÈTE simulée jusqu'au bout : les 15 séries sont officiellement
  FINISHED, y compris NBA_FINALS (curseur de simulation final : 17/08/2026).
  Champion = équipe official_winner_team_id de NBA_FINALS
  ('11111111-1111-1111-1111-000000000007' — nom exact jamais reconfirmé
  formellement, à vérifier dans la table teams si besoin).
- Tous les matchs sont FINISHED (aucun SCHEDULED restant).
- bets : TOUS les paris de la saison ont été résolus en WON/LOST (plus aucun
  SUBMITTED/VALIDATED orphelin depuis la fin de la session d'il y a 2 séances).
- bracket_picks : scoring vérifié CORRECT série par série, y compris le bonus
  "affiche" (cross-check manuel fait sur Bot_Complet, 120 pts bracket, cohérent
  avec le barème).
- competition_settings.bracket_deadline : dépassée depuis longtemps.
- AUCUNE modification de schéma cette session (ni migration, ni nouvelle table) —
  seulement de nouveaux écrans de LECTURE sur des données déjà existantes
  (classement enrichi, bracket-global, paris-globaux). La base de données de fin
  de session précédente n'a pas bougé pendant cette session-ci.

⚠️ POINT D'ATTENTION NON TRANCHÉ, DEPUIS 2 SESSIONS — Bot_Test_Deadline :
Créé pour prouver que le fix de deadline du bracket fonctionne (bracket_picks
bloqué à 0/15 comme attendu). Sa suppression a été proposée il y a 2 sessions
mais jamais confirmée exécutée par l'utilisateur, et le sujet n'a pas été rabordé
depuis — il fait donc toujours partie intégrante des données (16e bot, bracket
structurellement bloqué à 0/15 pour toujours, faussant légèrement la répartition
"réaliste" voulue à l'étape 2 de la roadmap). À la prochaine occasion : demander à
l'utilisateur s'il veut le garder (auquel cas mettre à jour la doc en conséquence)
ou le supprimer proprement (ordre : bracket_picks → brackets → match_predictions
→ bets → users, sauf si des ON DELETE CASCADE existent déjà, jamais vérifié).
```

---

## 4. Détail du moteur de scoring (points d'attention pour la suite)

```text
- Pronos match : 10 pts fixes vainqueur (winner_points) + bonus écart 5/3/2/1/0
  (margin_bonus_points), stockés dans DEUX colonnes séparées. points_awarded = colonne
  GENERATED, jamais écrite directement. Idempotent (UPDATE, pas d'accumulation).
- Bracket : 3 composantes indépendantes (vainqueur / score exact / affiche), barème par
  tour (25/45/80/250 etc., cf. 0.2.5). Le bonus AFFICHE est déduit des picks du joueur
  sur les 2 séries qui alimentent la série courante — EXACTEMENT la même logique que
  lib/bracketCandidates.ts (voir getPredictedMatchupTeams() dans scoringEngine.ts) :
  bon réflexe de vérifier la cohérence entre les deux si l'un des deux est retouché.
  Le scoring d'une série non remplie vaut déjà 0 point tout seul.
  ✅ VÉRIFIÉ EN CONDITIONS RÉELLES (saison complète, cross-check manuel sur
  Bot_Complet — 4 séries gagnées correctement identifiées sur 15, points cohérents
  avec le barème, bonus affiche correctement à 0 sur une série pourtant gagnée car
  une erreur de pick en amont invalidait l'affiche prédite). Une fausse alerte a été
  levée en cours de route (le "points bracket : 0" observé en milieu de saison était
  normal — aucune série FINISHED à ce moment précis — pas un bug de scoring ; deux
  captures d'écran à des moments différents avaient été confondues par erreur).
- Paris : barème linéaire (5/10/15/20/25 selon difficulté validée), UNIQUEMENT si
  status = WON. Recalculé sur TOUS les paris pour rester idempotent.
  ✅ VÉRIFIÉ : idempotence confirmée (recalcul répété sans changement de points),
  aucune pénalité négative observée sur l'ensemble de la saison simulée.
```

---

## 5. Auto-validation à la deadline (0.2.2 / 0.2.3) — FAIT ET TESTÉ

```text
lib/deadlineValidation.ts :
  - decideMatchPredictionOutcomeAtDeadline() (pronos match) : AUTO_VALIDATE si complet,
    MARK_AS_ABSENCE (→ LOCKED) si partiel, ALREADY_VALIDATED sinon.
  - decideBracketOutcomeAtDeadline() (bracket) : AUTO_VALIDATE si is_validated=false
    peu importe le remplissage, ALREADY_VALIDATED sinon.
Branchées dans lib/simulationAdvance.ts (autoResolveMatchPredictionsAtDeadline /
autoResolveBracketsAtDeadline). Les deux testées en conditions réelles, confirmées
correctes — reconfirmé indirectement sur une saison complète (aucun SUBMITTED
orphelin en fin de saison simulée, deadlines par match/série toutes bien respectées
de bout en bout).
```

---

## 6. Écran "Mes pronos match" (0.2.3) — FAIT ET TESTÉ

```text
6.1 Fenêtre glissante (lecture seule) : calculée sur simulation_state.cursor_at, pas
    l'heure réelle (0.2.10).
6.2 Saisie brouillon : upsert (user_id, match_id), aucun champ requis (brouillon PARTIEL
    autorisé, cf. MARK_AS_ABSENCE).
6.3 Validation (irréversible) : PAS besoin d'avoir sauvegardé un brouillon au préalable —
    2 boutons submit du même <form>, formAction différente. Garde-fou serveur : "pas de
    prono validable sans écart" (0.2.3 §2).
6.4 Révélation + compteur : dès que mon prono est VALIDATED, peu importe volontaire ou
    auto-validé — SIMPLIFICATION ASSUMÉE par rapport à 0.2.3 §5 (la distinction n'a jamais
    d'effet observable). À reporter dans decisions_0.2.3 par l'utilisateur s'il le
    souhaite.
6.5 "Valider tous les matchs complets" : agit sur l'état RÉEL du DOM (tous les
    formulaires visibles, via attribut data-match-prediction-form), pas seulement sur les
    brouillons déjà enregistrés. Ne bloque JAMAIS sur les matchs incomplets — les valide
    et ignore les autres, message informatif après coup.
```

### 6.6 Création de pari MATCH depuis la carte de match — FAIT ET TESTÉ

```text
AddBetForm.tsx sous chaque carte : "+ Ajouter un pari" si pas de pari actif sur ce
match, sinon formulaire pré-rempli (si DRAFT, modifiable) ou lecture seule (si
SUBMITTED+). Le formulaire ne se ferme JAMAIS lui-même au clic — c'est le re-rendu
serveur (revalidatePath) qui bascule l'affichage vers l'état "pari existant", pas de
JS pour gérer l'ordre clic/résultat serveur. Quota bloqué côté client (bouton masqué
si complet), comme ValidateButton bloque déjà vainqueur/écart manquants.
```

### 6.7 Soumission groupée des paris — FAIT ET TESTÉ

```text
SubmitAllBetsButton.tsx : même philosophie que ValidateAllButton (lit l'état réel du
DOM via data-match-bet-form, soumet les paris complets, ignore les incomplets,
message récapitulatif). Bouton DISTINCT de ValidateAllButton (Option A retenue avec
l'utilisateur, pas de fusion pronos+paris en un seul clic), pour garder des popups
de confirmation séparées et un bug isolable. Chaque pari réussit/échoue
indépendamment (quota, deadline) — pas de blocage en bloc si un seul échoue.
```

---

## 7. Écran "Mon bracket" (0.2.2) — FAIT ET TESTÉ, LES 6 BRIQUES

### 7.1 Lecture seule

```text
15 séries groupées par tour, 1er tour groupé par conférence (Est puis Ouest, 0.2.9 §5).
Équipes affichées : réelles si connues (1er tour), "Équipe à définir" sinon.
```

### 7.2 Fonction pure "équipes candidates" — ⚠️ CORRIGÉE APRÈS UNE 1ÈRE VERSION FAUSSE

```text
lib/bracketCandidates.ts : computeNextRoundCandidates(feederSlot1WinnerId, feederSlot2WinnerId)
  → { team1Id, team2Id }, dérivés UNIQUEMENT des picks du joueur sur les 2 séries qui
  alimentent la série courante.

ERREUR INITIALE (détectée par l'utilisateur, pas par Claude) : la 1ère version faisait
primer le résultat RÉEL officiel sur le pronostic du joueur dès qu'il devenait connu. FAUX :
0.2.9 dit explicitement "les tours suivants se pré-remplissent avec les équipes que LE
JOUEUR fait avancer", et 0.2.2 §6 confirme côté scoring ("les points sont acquis... quel
que soit l'adversaire EFFECTIVEMENT rencontré... une upset précoce ne détruit pas la
branche"). Le bracket du joueur reste bâti sur SES PROPRES pronostics jusqu'au bout, même
s'il s'est trompé sur une branche entière au 1er tour — jamais corrigé par la réalité.
Techniquement, ce cas ("le réel est connu alors que le bracket est encore modifiable") ne
peut de toute façon JAMAIS se produire : le bracket se verrouille au 1er match des
playoffs, donc avant tout résultat de tour 2+. La fonction corrigée n'a plus besoin de
connaître le résultat officiel du tout.
```

### 7.3 Saisie d'un pick (1er tour)

```text
app/bracket/actions.ts : saveBracketPick(formData). Upsert sur (bracket_id, series_id).
Garde-fou : le vainqueur soumis doit correspondre à l'une des 2 équipes CANDIDATES de la
série (pas les colonnes officielles team1_id/team2_id, qui restent null pour les tours 2+
— voir bug ci-dessous).
```

### 7.4 Pré-remplissage en cascade (tours 2+)

```text
Le 1er tour et les tours suivants partagent le MÊME code d'affichage : chaque série
calcule ses 2 équipes candidates (officielles pour le 1er tour, dérivées via
computeNextRoundCandidates() pour les suivants). Si les 2 sont connues → formulaire de
saisie. Sinon → lecture seule "Équipe à définir... complète les séries précédentes".

⚠️ BUG RENCONTRÉ ET CORRIGÉ EN COURS DE ROUTE : la 1ère version de saveBracketPick
validait le vainqueur soumis contre series.team1_id/team2_id (les colonnes OFFICIELLES),
qui restent null pour les tours 2+ tant que le vrai résultat n'est pas tombé — donc TOUJOURS
en échec pour ces séries. Corrigé en recalculant côté serveur les mêmes équipes candidates
qu'à l'affichage (nouvelle fonction interne getValidCandidateTeamIds() dans actions.ts, qui
refait la recherche des séries "feeder" + lecture de leurs picks). Point de vigilance pour
la suite : toute logique de validation doit être recalculée aussi côté serveur, ne JAMAIS
supposer que ce qui est affiché côté client correspond aux colonnes officielles en base.
```

### 7.5 Validation globale du bracket

```text
app/bracket/actions.ts : validateBracket(). Met is_validated = true, validated_at = now.
PAS irréversible (0.2.2 §3, contrairement aux pronos match) : reste modifiable après.
PAS besoin d'être complet pour valider (0/15 à 15/15 accepté, cohérent avec la règle
d'auto-validation §5). Popup de confirmation reformulée en conséquence (pas d'avertissement
"définitif", juste une explication du fonctionnement).
```

### 7.6 Barre de progression X/15

```text
Compte les bracket_picks du joueur avec vainqueur ET score renseignés, sur le total de
séries (15). Affichage simple, pas de logique complexe.
```

### 7.7 lib/botScripting.ts — RÉÉCRIT (il y a 2 sessions), 4 bugs corrigés

```text
Périmètre de la révision : le point 1 de la roadmap demandait de vérifier si les
bots créaient bien des paris. En creusant, 3 problèmes distincts ont été trouvés et
corrigés dans le MÊME fichier lib/botScripting.ts, puis un 4e a été trouvé et corrigé
suite à une question de l'utilisateur en fin de cette même session :

BUG 1 — Cascade du bracket ne fonctionnait JAMAIS pour les tours 2+ :
  fillBracketPicks() filtrait les séries sur team1_id/team2_id NON NULS (colonnes
  OFFICIELLES) — EXACTEMENT LE MÊME BUG que celui déjà trouvé et corrigé côté joueur
  en §7.2/§7.4, mais jamais reporté sur le code des bots (écrit avant ce fix, jamais
  mis à jour depuis). Conséquence : les bots ne remplissaient JAMAIS les tours 2 à 4
  de leur bracket (ces colonnes ne se remplissent qu'après le vrai résultat, bien
  après que le bracket soit verrouillé). CORRIGÉ : réécriture complète, traitement
  des 15 séries dans l'ordre des tours (ROUND_1 → CONF_SEMIS → CONF_FINALS →
  NBA_FINALS), dérivation des candidats de tour 2+ via computeNextRoundCandidates()
  à partir des PROPRES picks du bot sur les séries feeder (retrouvées via
  next_series_id / next_series_slot), en une seule passe grâce à l'ordre de
  traitement. VÉRIFIÉ : Bot_Complet/Bot_Visionnaire (fillRate=1.0) atteignent 15/15
  dès le 1er appel ; cross-check manuel confirmé qu'un pick de CONF_SEMIS correspond
  bien à un pick du bot sur une série ROUND_1 feeder, jamais au résultat réel.

BUG 2 — Paris MATCH possibles sur des matchs déjà commencés/terminés :
  fillBets() ne filtrait pas les matchs par statut (contrairement à
  fillMatchPredictions() qui filtre bien SCHEDULED). CORRIGÉ : ajout de
  .eq('status', 'SCHEDULED') sur la requête matches pour les paris match.

BUG 3 — Paris SÉRIE possibles sur des séries déjà commencées :
  Aucune vérification de la deadline par série (1er match pas encore commencé).
  CORRIGÉ : réutilisation de getEligibleSeriesForBet(cursorAt) (lib/betQueries.ts),
  la MÊME fonction que côté joueur, au lieu de dupliquer la logique.

BONUS — Réutilisation de lib/betQuota.ts : fillBets() réimplémentait sa propre
  logique de quota (comptage manuel, sans gérer la nuance REJETÉ/ANNULÉ §8).
  CORRIGÉ : appel direct à canCreateMatchBet()/canCreateSeriesBet().

BUG 4 (trouvé et corrigé APRÈS les 3 premiers, suite à une question de l'utilisateur) —
  Aucune vérification du bracket_deadline GLOBAL (0.2.2 §2 : verrouillage unique pour
  tout le bracket, à l'heure du 1er match des playoffs — À NE PAS CONFONDRE avec les
  deadlines PAR SÉRIE/MATCH des paris, qui elles fonctionnaient déjà bien). Les bots
  pouvaient continuer à remplir/modifier leur bracket indéfiniment après la deadline.
  CORRIGÉ : lecture de competition_settings.bracket_deadline en tout début de
  fillBracketPicks(), sortie immédiate si simulation_state.cursor_at l'a dépassée.
  VÉRIFIÉ avec un bot neuf créé après la deadline (Bot_Test_Deadline, ALL_ROUNDER,
  fillRate=1.0) : resté à 0/15 comme attendu, alors qu'il aurait dû halluciner 15/15
  instantanément sans le fix.

⚠️ GAP OUVERT, TOUJOURS PAS TRAITÉ (2 sessions plus tard) : app/bracket/actions.ts
  (saveBracketPick, le code du JOUEUR HUMAIN, pas des bots) n'a JAMAIS été revérifié
  pour la même question — rien ne prouve qu'il vérifie lui aussi bracket_deadline
  avant d'accepter une modification. Comme il n'y a qu'un seul joueur humain
  (l'admin) et qu'il n'a jamais testé de modifier son bracket après la deadline, ce
  n'est ni confirmé bug ni confirmé sain — à vérifier explicitement si l'occasion
  se présente.

⚠️ GAP DE PERFORMANCE CONNU, TOUJOURS PAS CORRIGÉ (jugé hors scope pour un
  prototype jetable) : fillBracketPicks()/fillMatchPredictions()/fillBets() font de
  NOMBREUSES requêtes Supabase séquentielles individuelles par bot (pas de requêtes
  groupées/batch). Avec 16 bots, un "Avancer de N jours" avec un N élevé (testé à
  60) a saturé la mémoire du process Node (RAM à ~90%, CPU faible = signe de
  swapping) et bloqué TOUS les boutons admin pendant ~84 secondes avant de finir
  par répondre (aucune perte de données constatée, juste très lent). Corrigé en
  CONTOURNEMENT côté UI (AdvanceManyDaysControl fait maintenant 1 requête par jour
  au lieu d'une requête géante), mais le code de botScripting.ts lui-même reste non
  optimisé et n'a pas été retouché depuis. À corriger en V1 (requêtes groupées /
  Promise.all bien dosé) si la taille du groupe d'amis dépasse largement 16-20
  joueurs.

**Testé en conditions réelles** : saison complète (15 séries, ~90 matchs simulés),
16 bots, aucune anomalie de cascade, deadline, ou quota détectée après les 4
corrections ci-dessus.
```

---

## 8. Logique de quota des paris (lib/betQuota.ts) — FAIT ET TESTÉ

```text
Fonctions PURES (aucun accès DB) :
  computeMatchBetQuota(existingBetsInSeries) : usedSlots / remainingSlots /
    matchIdsWithActiveBet, sur le quota de 3 paris match max par série.
  canCreateMatchBet(matchId, existingBetsInSeries) : autorise ou refuse un nouveau
    pari sur CE match précis (1 max par match + quota de 3 respecté).
  canCreateSeriesBet(existingSeriesBet, firstMatchScheduledAt) : idem pour le quota
    de 1 pari série max par série.

Règle de libération du slot (0.2.4 §6, précisée en cours d'implémentation — 0.2.4 ne
tranchait pas ce cas explicitement) :
  - REJETÉ décidé AVANT le coup d'envoi du match/de la série visé(e) → slot libéré
    (le pari lui-même était invalide : ambigu, invérifiable, doublon...) ;
  - ANNULÉ, quel que soit le moment → slot toujours libéré (événement externe,
    aucune pénalité, 0.2.4 §4) ;
  - tous les autres cas — y compris REJETÉ décidé APRÈS le coup d'envoi — slot
    occupé, sans remplacement possible (0.2.4 §6 : "après la deadline, slot perdu").

Note pour les paris SÉRIE : la nuance REJETÉ avant/après deadline est PRESQUE
TOUJOURS redondante en pratique (la deadline du pari série coïncide avec le début
de la série entière, déjà vérifiée avant toute création) — gardée dans le code pour
la robustesse et la cohérence avec les paris match, mais peu susceptible de
s'activer réellement.

Testé en conditions réelles par l'utilisateur : quota qui bloque au 4e pari match
sur une série, comportement REJETÉ/ANNULÉ validé par raisonnement sur des exemples
avant écriture du code. RÉUTILISÉ par lib/botScripting.ts (les bots passent
maintenant par les mêmes fonctions que le joueur, au lieu de dupliquer la logique
— voir §7.7), donc doublement exercé sur un volume réel important (16 bots ×
saison complète) sans anomalie de quota détectée.
```

---

## 9. Écran "Mes paris" (0.2.4) — FAIT ET TESTÉ

### 9.1 Contrainte technique actée avant le code

```text
description et proposed_difficulty sont NOT NULL en base (contrairement à
match_predictions, où les colonnes équivalentes sont nullable). Conséquence assumée
avec l'utilisateur : un pari ne peut être sauvegardé (brouillon ou soumis) que
COMPLET — jamais partiel en base. Un pari en cours de saisie incomplet n'existe que
dans le formulaire du navigateur, jamais persisté.
```

### 9.2 Avertissement de perte de saisie

```text
beforeunload sur AddBetForm.tsx ET SeriesBetForm.tsx : avertit dès qu'il y a du
contenu non sauvegardé (y compris un pari COMPLET pas encore cliqué, pas seulement
un pari partiel — décision explicite de l'utilisateur). Couvre UNIQUEMENT
fermeture/rafraîchissement d'onglet, PAS la navigation interne de l'app (gap assumé
pour le prototype).
```

### 9.3 Formulaire de pari série + liste groupée

```text
SeriesBetForm.tsx : 2 modes (création via <select> des séries éligibles / édition).
Pour le pari série, affichage simplifié "1/1 si statut ni REJETÉ ni ANNULÉ" (pur
affichage récapitulatif ; la vérification stricte avec nuance temporelle reste dans
canCreateSeriesBet(), déjà appliquée côté server action).

Le gap "Mes paris n'affiche que les paris de l'utilisateur, jamais ceux des bots"
(noté pendant plusieurs sessions) est désormais RÉSOLU AUTREMENT que prévu à
l'origine : plutôt que de modifier "Mes paris" (personnel) pour y injecter les
paris des autres, un écran PUBLIC SÉPARÉ a été créé — app/paris-globaux/page.tsx
(voir §2). "Mes paris" reste volontairement personnel (mes brouillons/mes paris),
la vue "tout le monde" vit ailleurs. Cohérent avec la séparation déjà faite entre
/bracket (personnel) et /bracket-global (public).

**Testé en conditions réelles** : quota qui bloque au 4e pari match sur une série,
pari série qui disparaît du menu déroulant une fois créé, messages d'erreur clairs
sur quota dépassé / série déjà utilisée.
```

---

## 10. Ce qui N'EST PAS encore construit / vérifié (gaps connus, prototype)

```text
Écrans/fichiers à revérifier :
  - Aucun nouveau identifié cette session. app/bracket/actions.ts reste le seul
    point de vigilance hérité (bracket_deadline côté joueur humain, jamais
    vérifié depuis 2 sessions).

Fonctionnalités du périmètre 0.2.10 PAS ENCORE construites — IL N'EN RESTE QU'UNE :
  - Requêtes de correction (0.2.3 §7 / 0.2.7 §6) : table correction_requests existe
    en base (schéma complet retrouvé cette session, voir §15 pour le détail),
    AUCUN code applicatif écrit dessus. DERNIÈRE ÉTAPE DE LA ROADMAP (§12).

Gaps résolus cette session (retirés de cette liste) :
  - Tendances du bracket (0.2.6/0.2.8) : construit (app/bracket-global/page.tsx),
    seuil dynamique vérifié fonctionnel avec un vrai mélange %/brut selon le tour.
  - Visibilité des paris des AUTRES joueurs (0.2.4 §9) : construit
    (app/paris-globaux/page.tsx), révélation pari par pari vérifiée fonctionnelle.
  - Classement (tri par colonne, sous-totaux, forme récente) : entièrement construit
    et vérifié (tri 6 colonnes, asc/desc, rang stable sur Total, colonne Forme 7j).

Gaps résolus il y a 2 sessions (rappel, toujours vrais) :
  - lib/botScripting.ts / botConfig.ts : les bots créent maintenant bien des paris,
    respectent tous les quotas/deadlines, ET remplissent correctement leur bracket
    jusqu'au tour 4 — voir §7.7 pour le détail des 4 bugs corrigés.
  - app/admin/paris/page.tsx + actions.ts : parcours SOUMIS→VALIDÉ→GAGNÉ/PERDU
    désormais exercé avec de vrais paris (session complète), gestion d'erreur
    ajoutée, affichage enrichi (équipes/score) pour pouvoir juger chaque pari.
  - Montée en charge progressive des faux joueurs (0.2.10 §3) : 5 → 17 joueurs
    (16 bots + admin), seuil de 10 atteignable et testé.

Nouveaux gaps identifiés il y a 2 sessions, toujours ouverts :
  - app/bracket/actions.ts (saveBracketPick, côté JOUEUR HUMAIN) : jamais revérifié
    pour la vérification du bracket_deadline.
  - Performance de lib/botScripting.ts à grande échelle (requêtes séquentielles non
    groupées) — voir §7.7, gap de performance. Contourné côté UI, pas corrigé dans
    le code lui-même. Non retouché cette session non plus (aucune nouvelle
    simulation lancée).
  - Bot_Test_Deadline jamais supprimé de la base — voir §3, point d'attention.

Gaps techniques génériques déjà connus (inchangés) :
  - Transition match_predictions → LOCKED au coup d'envoi, DE FAÇON GÉNÉRALE :
    toujours contournée par la fenêtre glissante, pas implémentée en tant que telle.
  - Pas de vraie authentification (admin "hardcodé" comme seul utilisateur non-bot).

Estimation d'avancement (mise à jour en fin de cette session) : environ 90-95 % du
périmètre fonctionnel du prototype (0.2.10). Les 3 sources de scoring, le
classement, les tendances bracket et la visibilité des paris sont désormais tous
vérifiés de bout en bout sur une saison complète et réelle. Il ne reste QUE les
requêtes de correction (§12, étape 7 — la toute dernière de la roadmap initiale).
```

## 10bis. Interprétations/décisions d'implémentation actées en cours de route (à reporter dans les fichiers `decisions_0.2.x` par l'utilisateur s'il le souhaite)

```text
- INTERPRÉTATION TRANCHÉE il y a 2 sessions (pas une nouvelle règle produit, une
  clarification d'implémentation demandée explicitement à l'utilisateur) : le
  seuil de "10 brackets remplis" (0.2.6) se compte SÉRIE PAR SÉRIE (nombre de
  joueurs ayant rempli LEUR pick sur CETTE série précise), PAS sur le bracket
  entier à 15/15. Cette lecture est cohérente avec le fait que l'écran de
  tendances s'ouvre "série par série" au clic (0.2.6 §4). CONFIRMÉE cette session
  par la construction et le test réel de app/bracket-global/page.tsx (mélange
  observé de séries en % et en brut selon le tour, comme attendu avec cette
  lecture).
- Tri du classement : 6 colonnes cliquables (Total/Matchs/dont Écarts/Bracket/
  Paris/Forme 7j), inversion de direction au reclic sur la même colonne (non
  spécifié explicitement par 0.2.6, mais cohérent avec l'usage attendu d'un tri
  cliquable). Le rang affiché reste TOUJOURS celui du classement par Total, peu
  importe la colonne triée à l'affichage (0.2.9 §6).
- "dont Écarts" rendu triable à la demande de l'utilisateur — CE N'EST PAS une des
  5 colonnes listées par 0.2.6/0.2.9, à garder en tête si la spec 0.2.6 est un jour
  révisée pour formaliser ce choix (ou l'inverse, le retirer).
- Tri alphabétique du classement par pseudo : explicitement DIFFÉRÉ EN V1 sur
  demande de l'utilisateur (non couvert par 0.2.6/0.2.9 non plus).
- Catégorisation des paris (tags/catégories proposés à la création, tri par onglet
  dans "Paris des joueurs") : NOUVEAU POINT OUVERT V1, explicitement demandé par
  l'utilisateur puis reporté en V1 de son propre chef, PAS implémenté dans le
  prototype. Toucherait le formulaire de création de pari (0.2.4, section close) —
  d'où le report plutôt qu'une implémentation silencieuse. Pour l'instant, le tri
  de app/paris-globaux/page.tsx utilise uniquement des champs déjà existants
  (statut trié par priorité gagné→perdu, pseudo alphabétique).
```

---

## 11. Points ouverts pour la V1 (hors périmètre du prototype)

```text
⚠️ Fenêtre de remplissage du bracket très courte en pratique (play-in → 1er tour) :

Constat (vérifié sur le vrai calendrier NBA 2026) : le play-in se termine un vendredi
soir, le 1er tour démarre dès le lendemain. Avec la règle actuelle (0.2.2 : bracket
ouvre seulement quand les 8 séries sont TOUTES connues + deadline = heure exacte du
1er match), un joueur peut n'avoir qu'UNE SOIRÉE pour remplir 15 séries.

Piste proposée par l'utilisateur, à instruire en spec technique V1 (PAS tranchée,
PAS à implémenter dans le prototype où le problème ne se pose pas) : ouvrir le
bracket plus tôt (fin de saison régulière), séries encore incertaines affichées "à
venir" / équipes provisoires, remplacées automatiquement une fois le play-in
terminé. Point de friction identifié : une série incertaine peut avoir jusqu'à 4
équipes candidates (pas 2). Note : la règle 0.2.2 actuelle a été écrite
explicitement pour éviter cette ambiguïté — cette piste la rouvre en connaissance
de cause.

⚠️ Avertissement de perte de saisie sur un pari incomplet — cas partiel :

Décidé pour le prototype : la popup d'avertissement avant de quitter un pari
match/série incomplet (description ou difficulté renseignée mais pas les 2) ne
couvre QUE la fermeture d'onglet / rafraîchissement / changement d'URL (événement
navigateur natif beforeunload). Le cas "clic vers un autre onglet de navigation
interne de l'app (Accueil / Jouer / Classement...) avec un pari incomplet en
cours" N'EST PAS couvert : Next.js App Router n'a pas d'événement natif équivalent
pour la navigation interne (SPA), ça nécessiterait un état partagé entre la barre
de nav et chaque formulaire concerné — jugé disproportionné pour un prototype à
fidélité UX moyenne (0.2.10). À réévaluer en V1 si le besoin se confirme en usage
réel avec plusieurs joueurs.

⚠️ Performance de la simulation de bots à grande échelle (identifié il y a 2
sessions, toujours pas corrigé) : voir §7.7. Les requêtes séquentielles non
groupées de botScripting.ts deviennent un vrai goulot d'étranglement au-delà d'une
quinzaine de bots simulés sur plusieurs dizaines de jours d'un coup (incident
mémoire réel constaté : RAM à ~90%, blocage de tous les boutons admin pendant
~84 secondes avec N=60 jours d'un coup). Pour la V1 (vraie API + Vercel Cron, pas
de simulation de bots), ce problème ne se posera probablement plus de la même
façon — mais à garder en tête si un mécanisme de bots de démo devait être conservé.

⚠️ NOUVEAU cette session — Catégorisation des paris personnalisés : ajouter un
champ catégorie (cases à cocher ou saisie libre) au moment de la création d'un
pari (0.2.4, section actuellement close), pour permettre un tri par
catégorie/onglet sur l'écran public "Paris des joueurs" (et potentiellement "Mes
paris"). Demandé explicitement par l'utilisateur, reporté à la V1 de son propre
chef plutôt que de rouvrir 0.2.4 dans le prototype. Nécessitera : nouvelle colonne
sur `bets` (catégorie, probablement un enum ou une table de tags many-to-many
selon le niveau de flexibilité voulu — à trancher en spec technique V1),
modification des formulaires de création (AddBetForm.tsx, SeriesBetForm.tsx),
modification de l'écran de tri (app/paris-globaux/page.tsx).

⚠️ Rappel de périmètre confirmé avec l'utilisateur (ne bloque rien, juste un repère
pour la suite) :

Le prototype construit la BASE DE DONNÉES, la LOGIQUE MÉTIER (quotas, deadlines,
statuts, scoring) et des écrans FONCTIONNELS minimaux — assez pour jouer réellement
et juger l'équilibre du jeu. Le groupement par tour/statut/série dans les écrans
actuels n'est PAS de la "polish" : c'est nécessaire à la lisibilité, donc déjà fait.
Ce qui reste hors périmètre prototype (0.2.10, confirmé explicitement) : la
direction visuelle (0.2.9 : sombre/broadcast, cartes stylées), la barre de nav à 4
onglets, et toute navigation avancée (ex. clic sur une série dans "Mes paris" →
page dédiée, drill-down, transitions). Rien de tout ça n'est à construire avant la
V1, même si ça semble une amélioration mineure en cours de route.
```

---

## 12. Roadmap restante (mise à jour)

```text
FAIT :
  1. lib/botScripting.ts (bots + paris, cascade bracket, deadline globale)   ✅
  2. Montée en charge à 17 joueurs, seuil de 10 testable par série            ✅
  3. Saison complète simulée, paris résolus via le vrai parcours admin       ✅
  4. Classement : tri 6 colonnes, asc/desc, rang stable, forme récente        ✅
  5. Écran de tendances bracket (app/bracket-global, seuil dynamique)         ✅
  6. Visibilité des paris des AUTRES joueurs (app/paris-globaux)              ✅

RESTE :
  7. Requêtes de correction (0.2.3 §7 / 0.2.7 §6) — DERNIÈRE ÉTAPE DE LA
     ROADMAP INITIALE. Table correction_requests + FK sur match_predictions
     déjà en base (schéma complet retrouvé cette session) :

     create table correction_requests (
       id uuid primary key default gen_random_uuid(),
       requester_user_id uuid not null references users(id),
       target_type correction_target_type not null,          -- MATCH_PREDICTION | BET
       target_match_prediction_id uuid references match_predictions(id),
       target_bet_id uuid references bets(id),
       justification text not null,
       status correction_request_status not null default 'PENDING', -- PENDING|PROCESSED|REJECTED
       admin_reason text,              -- obligatoire si REJECTED
       handled_by_admin_id uuid references users(id), -- jamais l'auteur si celui-ci est admin
       created_at timestamptz not null default now(),
       handled_at timestamptz
       -- + contrainte CHECK : target_type cohérent avec la colonne cible renseignée
     );
     -- match_predictions a une FK correction_request_id vers cette table.

     Workflow (0.2.7 §6) : EN_ATTENTE → TRAITÉE / REFUSÉE (motif admin obligatoire
     si refusée). 1 requête = 1 prono OU 1 pari, jamais globale. Canal in-app
     uniquement (formulaire depuis le prono/pari concerné). Traitement par
     n'importe quel admin SAUF l'auteur du prono si celui-ci est lui-même admin
     (contrainte "≥ 2 admins", déjà actée en synthèse §3). Pas de délai limite
     (traitable même après le match). Marquage public de transparence attendu sur
     l'objet corrigé (ex. "prono corrigé par admin X sur requête de Y") — à
     vérifier si les colonnes existent déjà sur match_predictions (probable,
     is_admin_corrected / correction_reason évoqués dans le schéma mais jamais vus
     en entier cette session) et si un équivalent existe côté bets.

Non planifié pour l'instant (pas d'urgence identifiée) : granularité de simulation
match/série (en plus de "jour"), cas limites reporté/annulé déclenchables depuis
l'UI plutôt qu'en édition directe, optimisation performance de botScripting.ts,
vérification du bracket_deadline côté joueur humain (app/bracket/actions.ts),
décision sur Bot_Test_Deadline (garder ou supprimer), catégorisation des paris
(reportée en V1, voir §11).
```

---

## 13. Convention de travail avec l'utilisateur (important pour la suite)

```text
- L'utilisateur est TOTALEMENT DÉBUTANT (jamais utilisé Supabase, Next.js, VS Code, Git
  avant ce projet). CHAQUE action doit être expliquée : quoi, pourquoi, comment,
  étape par étape, une action à la fois, en attendant sa confirmation avant de continuer.
- Systèmes déjà en place que l'utilisateur sait manipuler : Supabase SQL Editor et Table
  Editor, VS Code (créer fichiers/dossiers, terminal intégré, Ctrl+S), copier-coller de
  fichiers complets (préférer donner le fichier ENTIER plutôt que des diffs), F12
  DevTools (onglets Network/Console, appris il y a 2 sessions).
- Fichiers de suivi (comme ce document) : MÊME RÈGLE — toujours régénérés en entier,
  SANS résumer/couper ce qui existait déjà (erreur commise puis corrigée cette
  session : ne JAMAIS renvoyer à "voir version précédente", toujours tout reproduire).
- Pédagogie appréciée : proposer d'abord une fonction isolée/pure avec des exemples
  concrets à deviner, AVANT de la brancher sur le reste.
- L'utilisateur pose souvent de VRAIES BONNES QUESTIONS DE FOND qui remettent en cause
  une implémentation en cours ou une réponse de Claude — à prendre au sérieux, creuser
  à fond, ne pas défendre le premier jet. Exemples marquants : cascade du bracket côté
  joueur (a détecté une erreur de conception — le réel ne doit JAMAIS remplacer le
  pronostic du joueur) ; lien pronos/paris (a mené au bandeau de soumission groupée) ;
  "pourquoi moins de bots au fil des tours ?" (a mené à une explication claire de
  l'effet cascade cumulatif, pas un bug) ; "on peut trier les paris par catégorie ?"
  (a mené à distinguer clairement ce qui touche des données existantes [OK à faire]
  de ce qui rouvrirait 0.2.4 [à différer/demander]) ; "722 lignes vs 485 lignes ?"
  (a détecté que Claude avait résumé au lieu de régénérer intégralement le fichier
  de suivi, malgré la règle explicite — corrigé dans la foulée).
- Symétriquement : ne pas suivre aveuglément une hypothèse de l'utilisateur non plus.
  Exemple : l'hypothèse "trop de clics = doublons de paris" s'est révélée fausse après
  vérification SQL (piège GROUP BY sur des match_id NULL) ; une "confirmation" de bug
  donnée par Claude sur les points bracket à 0 s'est aussi révélée fausse après
  relecture attentive (deux captures d'écran à des moments différents confondues).
  Dans les deux cas, la bonne réponse était de vérifier avec une requête SQL précise
  plutôt que de trancher à l'instinct, dans un sens ou dans l'autre.
- Attention à ne jamais interpréter une clarification demandée par l'utilisateur comme
  une réouverture de règle si ce n'en est pas une : bien distinguer "ceci est une pure
  question d'implémentation" de "ceci touche une règle déjà validée" avant de trancher.
  Exemple : l'interprétation du seuil "10 brackets remplis" (par série vs par bracket
  entier) n'était PAS dans les décisions validées — vérifié explicitement avec
  l'utilisateur avant de choisir une lecture (§10bis).
- NOUVELLE LEÇON — distinguer "ajouter un tri/filtre sur des données DÉJÀ EXISTANTES"
  (pure UI, jamais un problème, peut être fait directement sans demander) de "ajouter
  un NOUVEAU CHAMP à la saisie" (touche potentiellement une section validée et close,
  à signaler avant d'implémenter, jamais fait silencieusement). Appliqué explicitement
  sur la demande de catégorisation des paris : tri par statut/joueur fait directement,
  champ "catégorie" à la création signalé et reporté en V1 sur décision de l'utilisateur.
- NOUVELLE LEÇON — deux formes de "révélation après verrouillage" bien distinctes, à
  ne pas confondre lors d'un nouvel écran public : garde d'accès GLOBALE ET UNIQUE
  (bracket : une seule deadline pour tout, cf. bracket-global) vs révélation ÉLÉMENT
  PAR ÉLÉMENT selon sa propre deadline (paris : chaque pari a la sienne, cf.
  paris-globaux). Vérifier laquelle des deux s'applique avant de coder un nouvel écran
  "public" du même genre.
- Avant toute action DESTRUCTIVE sur les données (ex. script de reset qui efface des
  vraies données de test déjà validées), expliquer précisément ce qui va être perdu et
  obtenir une confirmation EXPLICITE avant de donner le feu vert — ne jamais supposer
  qu'un "on peut réinitialiser ?" vaut accord pour tout effacer sans le dire clairement.
- Leçon technique du bug §7.4 : toute validation serveur doit recalculer ses propres
  garde-fous depuis la base, jamais supposer que les données affichées côté client
  correspondent aux colonnes "officielles" — particulièrement important pour le bracket,
  où les données affichées (candidats) et les données officielles (résultats réels)
  sont volontairement deux choses différentes. Le même type de bug (candidats calculés
  depuis le réel plutôt que depuis les picks du joueur) s'est reproduit dans
  lib/botScripting.ts (§7.7, BUG 1) car ce fichier avait été écrit AVANT le fix côté
  joueur — toujours se demander, en auditant un fichier "jamais revu", s'il ne
  reproduit pas un bug déjà corrigé ailleurs.
- Avant d'écrire du code touchant un fichier existant, demander son contenu actuel à
  l'utilisateur plutôt que de deviner son style — appliqué systématiquement.
- Dans Postgres, un CASE WHEN ... THEN 'X' ELSE 'Y' END sur une colonne ENUM
  nécessite un cast explicite (`::nom_du_type_enum`), sinon erreur 42804 "column is
  of type X but expression is of type text".
- Un GROUP BY sur une colonne nullable (ex. match_id pour des paris scope=SERIES)
  regroupe TOUTES les valeurs NULL ensemble — un piège classique pour une requête
  de détection de doublons, toujours filtrer le scope/type concerné avant de
  grouper sur une colonne potentiellement NULL.
- L'attribut `cz-shortcut-listen="true"` dans les warnings d'hydration React vient
  d'une extension de navigateur (type ColorZilla), pas du code — à ignorer
  systématiquement, ce n'est jamais la vraie erreur.
- À partir d'une quinzaine de bots simulés, une seule grosse Server Action
  séquentielle (ex. 60 jours d'un coup) peut saturer la mémoire du serveur de dev
  et bloquer TOUS les boutons pendant plus d'une minute, sans perte de données mais
  avec une UX qui semble "plantée" — préférer découper en plus petites requêtes
  successives (pattern AdvanceManyDaysControl) au-delà d'un certain volume.
- Commandes Git : les taper UNE PAR UNE dans le terminal, attendre la fin de chacune.
- Erreurs déjà rencontrées et résolues : oublis de sauvegarde, confusion de dossier,
  ordre des inserts SQL vis-à-vis des clés étrangères, `git add`/`commit`/`push` collés
  sur une seule ligne, accents dans les messages de commit sous PowerShell, indicateurs
  Git (M/U dans l'explorateur VS Code) confondus avec des erreurs réelles — toujours
  vérifier le panneau "Problems" avant de conclure à un bug.
```

---

## 14. Dépôt Git

```text
Dépôt local : initialisé (git init).
Dépôt distant : GitHub, privé — https://github.com/lenoirmath122-dev/nba-pronos-proto
Branche       : main (remote "origin").
Identité Git  : user.name "Mathieu", user.email lenoir.math122@gmail.com (config --global).

Commits confirmés poussés avec succès (du plus ancien au plus récent) :
  1. Premier commit initial (32 fichiers, 8153 lignes).
  2. "Ajout du sous-total bonus d'ecart au classement" — jamais reconfirmé
     explicitement, mais aucun souci depuis, probablement bon.
  3. "Ajout auto-validation des pronos match a la deadline" — confirmé.
  4. "Ajout auto-validation du bracket a la deadline" — jamais reconfirmé
     explicitement, mais aucun souci depuis, probablement bon.
  5. "Ajout de l'ecran Mes pronos match complet" — confirmé.
  6. "Ajout de l'ecran Mon bracket complet" — confirmé.
  7. "Ajout de la creation de paris match depuis Mes pronos match" — confirmé
     (lib/betQuota.ts, lib/betQueries.ts, app/pronos/betActions.ts,
     app/pronos/AddBetForm.tsx, modification app/pronos/page.tsx).
  8. "Ajout ecran Mes paris, creation de paris et soumission groupee" — confirmé
     (app/paris/actions.ts, app/paris/SeriesBetForm.tsx, app/paris/page.tsx,
     app/pronos/SubmitAllBetsButton.tsx, ajouts à lib/betQuota.ts et
     lib/betQueries.ts, modification app/pronos/page.tsx).

⚠️ AUCUN COMMIT FAIT depuis — ça fait maintenant 2 SESSIONS D'AFFILÉE sans commit.
Fichiers modifiés/créés cumulés sur ces 2 sessions, TOUS EN ATTENTE DE COMMIT :
  - lib/botScripting.ts (réécrit, 4 bugs corrigés — §7.7)
  - app/admin/paris/page.tsx (gestion d'erreur + affichage enrichi)
  - app/admin/page.tsx (boutons remplacés par SubmitButton/AdvanceManyDaysControl)
  - app/admin/actions.ts (ajout advanceOneDayStep + finalizeAdvance)
  - app/admin/SubmitButton.tsx (NOUVEAU fichier)
  - app/admin/AdvanceManyDaysControl.tsx (NOUVEAU fichier)
  - app/classement/page.tsx (tri 6 colonnes, rang stable, forme récente)
  - app/bracket-global/page.tsx (NOUVEAU fichier)
  - app/paris-globaux/page.tsx (NOUVEAU fichier)

À FAIRE en tout début de prochaine session, EN PRIORITÉ HAUTE (le volume non
sauvegardé devient conséquent) : vérifier `git status`, committer ces 9 fichiers
(probablement en 4 commits logiques : "fix bots" / "amélioration admin paris" /
"indicateurs de chargement admin" / "classement + bracket-global + paris-globaux"),
puis `git push`.
```

---

## 15. Comment reprendre dans une nouvelle conversation

```text
1. Fournir ce document (déjà dans les fichiers du Project si l'utilisateur l'a ajouté).
2. PRIORITÉ ABSOLUE : vérifier l'état RÉEL du dépôt Git (`git status`) — PAS à jour
   depuis 2 sessions (voir §14), committer les 9 fichiers listés AVANT de coder
   quoi que ce soit de nouveau.
3. Suivre l'ordre convenu en §12, en reprenant au POINT 7 (dernier point de la
   roadmap initiale) : requêtes de correction. Le schéma de correction_requests
   est déjà connu (voir §12 pour le CREATE TABLE complet retrouvé cette session),
   mais DEMANDER quand même à l'utilisateur, avant d'écrire quoi que ce soit :
   - le contenu actuel de app/pronos/page.tsx et app/paris/page.tsx (pour savoir
     où accrocher un bouton "Demander une correction" sur un prono/pari donné) ;
   - confirmer si match_predictions a bien les colonnes is_admin_corrected /
     correction_reason / correction_request_id (évoquées dans le schéma vu cette
     session, mais jamais la définition complète de la table match_predictions) ;
   - vérifier si un équivalent existe côté bets, ou si le marquage de transparence
     n'est prévu QUE pour les pronos.
4. Pas d'écran existant pour la résolution admin des requêtes — à construire de
   zéro (probablement app/admin/corrections/page.tsx + actions.ts, même esprit
   que app/admin/paris/page.tsx + actions.ts, déjà éprouvé).
5. Décisions en suspens à soumettre à l'utilisateur dès que l'occasion se présente
   (pas bloquantes, mais à ne pas oublier, ouvertes depuis 2 sessions) : que faire
   de Bot_Test_Deadline (§3), vérifier app/bracket/actions.ts pour le
   bracket_deadline côté joueur humain (§7.7).
```