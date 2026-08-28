# NBA Pronos — SPEC TECHNIQUE V0.1 (document maître)

> **Nature** : document maître COURT de la spec technique V1, conforme au
> découpage acté le 17/07/2026 (`JOURNAL_SESSIONS.md`, méthodo §7 : pas de
> pavé unique). Il contient les **principes transverses**, la **carte des
> fichiers thématiques**, les **contrats entre modules** et l'**ordre de
> construction**.
>
> **Il ne contient volontairement PAS** : le schéma SQL détaillé, les
> policies RLS, les routes Next.js écran par écran, les design tokens. Chacun
> vit dans son fichier thématique (§4).
>
> **Ne rouvre aucune décision** : le cadrage fonctionnel
> (`SPEC_FONCTIONNELLE_V0_2.md`, `SYNTHESE_CLAUDE_PROJECT_1_3.md`) et les
> réponses techniques de `PREP_SPEC_TECHNIQUE_V1.md` sont **clos**. Ce
> document les traduit en architecture, il ne les rejuge pas.
>
> **Statut** : **VALIDÉ** avec l'utilisateur le 17/07/2026 (4e session de la
> journée) — structure du document + les 5 décisions du §7, qui étaient des
> questions ouvertes à la rédaction et sont désormais actées.
>
> Périmètre acté avec l'utilisateur le 17/07/2026 : **V1 complète
> (Playoffs + NBA Cup)** pour le modèle de données et les RLS, avec un
> **séquencement d'implémentation orienté NBA Cup** (première compétition
> réellement jouée, cf. roadmap `decisions_multi_competitions_historique.md`
> §8).

---

## 1. Objet

La V1 reconstruit proprement ce que le prototype a validé fonctionnellement :
mêmes règles de jeu, mêmes barèmes, mêmes workflows — mais avec une vraie
authentification, des RLS complètes, la vraie API NBA (Highlightly) et une
synchro réelle.

Ce que la V1 change par rapport au proto, et **rien d'autre** :

```text
1. Auth réelle (Supabase Auth) remplace le compte humain unique.
2. RLS complètes remplacent l'absence totale de sécurité DB.
3. API Highlightly + planificateur externe remplacent seed/curseur simulés.
4. Supabase Realtime remplace l'absence d'affichage live.
5. Écrans admin manquants au proto (logs d'audit, promotion/rétrogradation).
```

```text
6. Rétention des données opérationnelles (D2) remplace l'effacement à
   chaque clôture.
```

Tout le reste (barème, statuts, cycles de vie, visibilité, classement,
archives) est repris **à l'identique** — le proto en a été la validation.

---

## 2. Ce qui est déjà tranché (rappel, non rouvrable)

Pour éviter toute redécision silencieuse dans les fichiers thématiques.

| Sujet | Décision | Source |
|---|---|---|
| Fournisseur API NBA | Highlightly, accès direct (pas RapidAPI), `https://nba.highlightly.net`, header `x-rapidapi-key` seul, 100 req/jour | A6 |
| Appels datés | `timezone=America/New_York` **toujours** ; le champ `date` renvoyé reste UTC | A6 |
| Score API | tableau par quart-temps → **à sommer**, jamais lu comme valeur unique | A6 |
| Synchro | planificateur externe gratuit (cron-job.org / GitHub Actions) appelant une route HTTP. Horaires 1×/jour ; résultats 30-60 min **uniquement en fenêtre de match** | A8 |
| Pause Supabase | 2e job « heartbeat » léger, actif toute l'année | A8 |
| Live | Supabase Realtime (clé anon), pas de polling | A9 |
| Bootstrap admin | seed manuel unique en migration SQL, après inscription normale du 1er compte | A4 |
| Auth | email (technique, privé) + mot de passe Supabase Auth ; pseudo = identité publique ; code compétition vérifié **serveur** avant création du compte | C4 |
| Logs | 2 tables séparées `audit_logs` / `sync_logs`, sans purge auto | B2, B3 |
| Logos | URL native Highlightly (`GET /teams`, champ `logo`), hébergement interne | B4 |
| RLS — arbitrages fondateurs | (A) lectures via session utilisateur, `service_role` réservé synchro/seed ; (B) règle temporelle dans les policies SQL ; (C) `is_admin()` SECURITY DEFINER STABLE sur `users.role` ; (D) `users.id = auth.users.id` | 17/07 |
| Paris | catégories fixes (9), corrigeables par l'admin au même geste que la difficulté ; pas de pré-remplissage IA en V1 | C3, A5 |
| Perte de saisie | à construire en V1 sur les 3 écrans de saisie (pronos, paris, bracket) | C2 |

Références : `A*`/`B*`/`C*` = `nba_pronos_PREP_SPEC_TECHNIQUE_V1.md`.

---

## 3. Principes transverses

### 3.1 Sécurité

```text
P1. La RLS est la SEULE source de vérité de la visibilité. Aucune règle de
    visibilité n'est réimplémentée en applicatif. Le code peut choisir
    QUOI AFFICHER, jamais CE QU'IL A LE DROIT DE LIRE.
P2. Tout accès utilisateur passe par la clé anon + JWT de session.
    `service_role` n'apparaît QUE dans : routes de synchro, heartbeat,
    migrations/seed. Jamais dans un composant, jamais dans une server
    action déclenchée par un joueur.
P3. La règle temporelle (« public seulement après deadline/verrouillage »)
    est évaluée par `now()` DANS la policy, comparé à l'heure du match ou
    à `competitions.bracket_deadline`.
P4. `is_admin()` est SECURITY DEFINER STABLE et lit `users.role` — jamais
    un claim JWT (promotion effective sans re-login, pas de récursion de
    policy sur `users`).
```

### 3.2 Données et scoring

```text
P5. Le recalcul du scoring est IDEMPOTENT : il rejoue tout le barème à
    partir des données officielles figées + prédictions figées. Rejouable
    n fois, même résultat, jamais de double comptage.
P6. Aucun point négatif nulle part. Absence = 0, annulé = 0, perdu = 0.
    Une valeur négative dans une colonne de points est un bug, pas un cas.
P7. Le classement n'est jamais stocké : vues calculées (`user_scores`,
    `user_recent_form`). Seules les ARCHIVES sont figées, à la clôture.
P8. L'app ne travaille QUE sur des ids internes. `entity_mappings` est la
    seule frontière avec les ids Highlightly. Une entité non confirmée
    reste PENDING : aucun scoring, aucun verrouillage ne s'appuie dessus.
P9. Le verrouillage est piloté par l'HEURE CONNUE du match, jamais par la
    fraîcheur de la synchro. Une synchro en retard ne déverrouille rien.
P10. Une mise à jour de donnée officielle ne modifie JAMAIS une prédiction
     déjà saisie.
```

### 3.3 Code

```text
P11. TypeScript strict. Noms de code en anglais, commentaires en français.
P12. App Router, composants SERVEUR par défaut ; `"use client"` seulement
     là où il y a interaction ou souscription Realtime.
P13. Écritures joueur = server actions. Écritures système = routes API
     (appelées par le planificateur externe, protégées par secret).
P14. Priorité au gratuit / meilleur rapport perf-coût ; passage au payant
     seulement si un besoin réel l'impose (principe acté A8).
P15. Toute migration vit dans `supabase/migrations/`, appliquée par
     `supabase db push`. Plus jamais de SQL manuel non versionné.
```

---

## 4. Carte des fichiers thématiques

Chacun est un livrable à produire et faire valider séparément, dans une
session dédiée qui charge ce document maître + sa propre dépendance.

| # | Fichier | Contenu | Dépend de |
|---|---|---|---|
| T1 | `SPEC_TECHNIQUE_MODELE_DONNEES_V0.1.md` | Schéma V1 complet : tables, enums, contraintes, index, vues, diff explicite vs `schema_prototype.sql` | ce doc |
| T2 | `SPEC_TECHNIQUE_AUTH_V0.1.md` | Supabase Auth, inscription + code compétition, bootstrap admin, statuts/rôles, sessions | T1 |
| T3 | `SPEC_TECHNIQUE_RLS_V0.1.md` | Policies table par table, `is_admin()`, `security_invoker` des vues, matrice visiteur/joueur/admin | T1, T2 |
| T4 | `SPEC_TECHNIQUE_SYNCHRO_API_V0.1.md` | Client Highlightly, routes de synchro, heartbeat, mapping, `sync_logs`, fenêtres d'exécution | T1 |
| T5 | `SPEC_TECHNIQUE_SCORING_V0.1.md` | Moteur idempotent, barèmes Playoffs + Cup, neutralisations en cascade, déclencheurs | T1 |
| T6 | `SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0.1.md` | Arborescence `app/`, routes, server actions, Realtime, garde-fou de saisie (C2) | T1→T5 |
| T7 | `SPEC_DESIGN_SYSTEM_V0.1.md` | Design tokens (palette, typo, espacements, composants) | T6 |
| T8 | `SPEC_TECHNIQUE_DEPLOIEMENT_V0.1.md` | Vercel, variables d'env, secrets, planificateur externe, GitHub | T4 |

Le backlog (`BACKLOG_V1.md`) n'a **pas** de fichier dédié : chaque item y est
traité comme une contrainte de non-fermeture dans T1 (§6.3), pas comme une
fonctionnalité à construire.

---

## 5. Contrats entre modules

Frontières strictes. Chaque flèche est un contrat : ce qui la traverse est
typé, ce qui est en amont n'est jamais visible en aval.

```text
Highlightly  →  lib/nba/client.ts  →  lib/sync/*  →  [DB officielle]
                                                          ↓
                                          lib/scoring/engine.ts
                                                          ↓
                                        [colonnes points_awarded]
                                                          ↓
                                      vues user_scores / user_recent_form
                                                          ↓
                                       composants serveur (session anon+JWT)
                                                          ↓
                                                   RLS ← seule autorité
```

**Contrats explicites :**

```text
C-1  lib/nba/client.ts est le SEUL fichier qui connaît Highlightly. Il
     renvoie des DTO normalisés, jamais un payload brut. C'est lui qui
     impose timezone=America/New_York et qui SOMME le tableau de score.
     Changer de fournisseur un jour = réécrire ce seul fichier.

C-2  lib/sync/* est le SEUL module autorisé à écrire teams/series/matches/
     entity_mappings. Il utilise service_role. Il journalise dans sync_logs.
     Il n'écrit JAMAIS une prédiction de joueur (P10).

C-3  lib/scoring/engine.ts est PUR au sens métier : entrées = données
     officielles + prédictions, sortie = points. Il ne lit jamais l'API,
     ne déclenche jamais de synchro, ne connaît pas Highlightly.

C-4  Les server actions joueur écrivent UNIQUEMENT les tables de
     prédiction (brackets/bracket_picks/match_predictions/bets/
     correction_requests) et jamais les données officielles.

C-5  Les vues de classement sont dérivées, jamais écrites. Elles sont
     security_invoker = true (§7-D4) : elles ne contournent JAMAIS la RLS.
     Une vue qui aurait besoin de la contourner pour fonctionner est le
     signe d'une policy fausse, pas d'un besoin légitime.

C-6  Aucun composant ne re-filtre ce que la RLS a déjà filtré (P1). Si un
     écran a besoin d'une donnée qu'il ne reçoit pas, c'est la policy qu'on
     corrige — pas une requête service_role de contournement.
```

---

## 6. Ordre de construction

Séquencement orienté NBA Cup (lancement visé : phase finale, 4-11 décembre ;
compétition jouable à ouvrir vers le 27-30 novembre).

```text
Étape 0 — Fondations         : dépôt NEUF + projet Supabase NEUF (D1),
                               env, migration initiale.
Étape 1 — Modèle de données  : T1. Playoffs + Cup dès maintenant.
Étape 2 — Auth               : T2. Inscription + code + bootstrap admin.
Étape 3 — RLS                : T3. AVANT tout écran — pas après.
Étape 4 — Synchro + mapping  : T4. Teams/logos d'abord, puis matchs.
Étape 5 — Scoring            : T5. Portage du moteur proto + Cup.
Étape 6 — Design system      : T7 (session dédiée, juste avant l'étape 7).
Étape 7 — Écrans joueur      : bracket → pronos → paris → classement.
Étape 8 — Écrans admin       : files paris, corrections, logs, compétitions.
Étape 9 — Live               : Realtime sur les écrans concernés.
Étape 10 — Clôture/archives  : portage de l'existant proto.
```

Règle de séquence : **l'étape 3 (RLS) ne se saute pas et ne se reporte pas
après les écrans.** Écrire les écrans d'abord conduit invariablement à
contourner la RLS pour « débloquer », puis à ne jamais revenir.

### 6.3 Contraintes de non-fermeture (backlog V1)

À respecter dans T1, sans rien construire :

```text
- Ligues : prévoir que le classement puisse être FILTRÉ par sous-groupe
  (vue filtrée, pas un scoring parallèle). Ne pas coder « le classement =
  tous les joueurs » en dur.
- Classement all-time : garde-fou déjà signalé (BACKLOG_V1) — dépend d'un
  barème stable, sinon rang/points relatifs. Ne pas trancher maintenant.
- Courbe d'évolution + page perso historique : DÉBLOQUÉES par D2 (§7) —
  les données opérationnelles sont conservées. Rien à construire pour
  autant : D2 se contente de ne pas fermer la porte.
- Superlatifs / badges : dérivables des archives existantes, aucun impact.
- Notifications / .ics / export image : aucun impact sur le modèle.
```

---

## 7. Décisions actées à la validation de ce document (17/07/2026)

Ces 5 points étaient des questions ouvertes à la rédaction. Ils sont
désormais **tranchés avec l'utilisateur** et ont le même statut que les
décisions du §2 : non rouvrables sans motif explicite.

### D1 — Nouveau dépôt, nouveau projet Supabase

```text
V1 = dépôt NEUF + projet Supabase NEUF. Le proto (dépôt nba-pronos-proto +
sa base) reste intact, en lecture, comme référence.

Motifs :
- le code proto qui ne doit pas survivre (simulation, botScripting,
  simulation_state, is_primary_human, écrans de debug) n'arrive dans la V1
  que si on le copie VOLONTAIREMENT (cf. D3) — pas par oubli de suppression ;
- users.id doit devenir l'id de auth.users (arbitrage D) : c'est une refonte
  de clé primaire, pas une migration — repartir propre est plus sûr ;
- la base proto contient 17 faux comptes et 3 compétitions archivées, qui
  n'ont rien à faire dans une base de production.

Contrainte vérifiée : le plan gratuit Supabase autorise 2 projets ACTIFS
(les projets en pause ne comptent pas). Proto + V1 = 2 → dans les clous, et
le proto se mettra en pause seul (aucun heartbeat dessus, cf. A8).

Coût accepté : perte de l'historique Git du proto sur les fichiers repris —
l'historique réel du projet vit dans JOURNAL_SESSIONS.md.
```

### D2 — Rétention des données opérationnelles : `competition_id`, plus aucun effacement

```text
Le modèle proto "wipeOperationalData() à chaque clôture, donc pas de
competition_id" est ABANDONNÉ en V1.

V1 : competition_id sur les tables opérationnelles, données CONSERVÉES.
La clôture devient : bascule ACTIVE -> ARCHIVED + snapshot du classement.
Aucune suppression, nulle part.

Motifs :
- asymétrie des risques : conserver sans s'en servir coûte quelques colonnes
  et quelques filtres ; effacer et le regretter est irrécupérable (pas de
  backup sur le plan gratuit). Volume négligeable à 10-30 joueurs ;
- la décision proto était juste POUR LE PROTO (jetable, rejoué en boucle).
  En V1 il s'agit de vraies saisons avec de vrais joueurs ;
- débloque 2 items de BACKLOG_V1 (courbe d'évolution, page perso) sans les
  construire ni imposer de migration douloureuse plus tard.

Côté joueur : AUCUN changement fonctionnel. L'app "se reset" toujours à
chaque nouvelle compétition — c'est un filtre au lieu d'un effacement.

Coût assumé, à traiter dans T1 : toutes les contraintes d'unicité sont à
re-scoper (brackets : unique(user_id) -> unique(user_id, competition_id) ;
index de quotas de paris idem), et chaque requête gagne un filtre.

Conception proposée pour T1 (à confirmer dans T1, pas ici) :
competition_id est structurellement nécessaire sur `series` et `brackets`
seulement — le reste (matches, bracket_picks, match_predictions, bets) peut
le déduire par jointure. Il sera néanmoins DÉNORMALISÉ sur ces tables :
policies RLS et index bien plus simples avec une colonne directe qu'avec une
jointure évaluée à chaque ligne. Compromis assumé, cohérence à garantir
(trigger ou code d'écriture unique).
```

### D3 — Portage du code proto

```text
On REPREND le code du proto plutôt que de réécrire depuis la spec — avec
droit de vérification et de modification à chaque fichier repris.

Concerne notamment : lib/scoringEngine.ts (vérifié de bout en bout sur une
saison complète), lib/bracketRounds.ts, lib/competitionSetup.ts,
lib/leaderboardSort.ts.

Corollaire de D1 : chaque fichier repris est copié EXPLICITEMENT dans le
dépôt neuf, jamais hérité passivement. Ce qui n'est pas copié n'existe pas.
```

### D4 — Vues de classement : `security_invoker = true`

```text
`user_scores` et `user_recent_form` sont déclarées security_invoker = true
(Postgres 15+) : la vue applique les droits du LECTEUR, pas ceux de son
propriétaire.

Rappel du piège évité : par défaut, une vue Postgres s'exécute avec les
droits de son créateur et CONTOURNE donc la RLS des tables sous-jacentes.
Des policies impeccables sur match_predictions seraient rendues inopérantes
par une vue oubliée.

Ça fonctionne sans fausser aucun total grâce à un INVARIANT du produit, à
énoncer et à TESTER explicitement dans T3 :

  « Tout point n'existe que sur une ligne déjà publique. »

  - un prono match ne marque qu'une fois le match TERMINÉ (donc après le
    coup d'envoi, donc après le verrouillage qui l'a rendu public) ;
  - un pick de bracket ne marque qu'à la résolution de la série (donc après
    la deadline du bracket) ;
  - un pari ne marque qu'à sa résolution admin (donc après sa deadline).
  - les lignes encore secrètes (brouillons, bracket avant deadline) valent 0
    et ne changent aucune somme.

Si cet invariant est un jour cassé, le classement devient faux : c'est le
signal d'alarme voulu, pas une régression silencieuse.

Surcoût de performance nul à cette échelle (30 joueurs).
```

### D5 — Conséquence de D4 sur `users` : plus de colonne `email`

```text
En mode invoker, la vue de classement joint `users` -> les visiteurs non
connectés doivent pouvoir LIRE `users` (pseudos du classement, déjà public
après verrouillage). Or la RLS filtre des LIGNES, pas des COLONNES :
autoriser cette lecture exposerait `email`, qui doit rester privé en toutes
circonstances (0.2.1).

Solution retenue, qui découle de C4 : l'email est déjà l'identifiant
technique de Supabase Auth, donc il vit dans `auth.users`.
=> `public.users` ne porte AUCUNE colonne `email`. Le doublon disparaît, le
problème avec lui. À intégrer à T1.
```

### D6 — NBA Cup : la synchro ne connaît que les 8 qualifiés

```text
La compétition n'existe en base qu'à partir des 8 équipes qualifiées pour
la phase finale (~27-30 novembre). Aucun match de poule n'est ingéré.

Motifs :
- aucun prono n'est possible en phase de groupes (décision fonctionnelle
  close, decisions_nba_cup_mecanique_scoring.md §1) : ingérer un mois de
  matchs pour zéro valeur fonctionnelle ;
- quota API : 100 requêtes/jour, autant les dépenser sur la phase finale ;
- l'admin saisit les 8 qualifiés lui-même (information publique le 27/11)
  via l'écran de création déjà existant (A7).

NUANCE IMPORTANTE : la synchro du RÉFÉRENTIEL des 30 équipes (GET /teams :
noms, abréviations, conférences, logos) est INDÉPENDANTE de tout ça et se
fait une fois pour toutes, hors compétition. Ce n'est pas de la phase de
groupes.

Conséquence acceptée : pas de pré-remplissage automatique des 8 qualifiés
dans l'écran de création (A7 le mentionnait comme confort). Saisie manuelle
de 8 équipes, une fois par an — jugé moins coûteux que le quota d'API et le
code nécessaires pour l'automatiser.
```

---

## 8. Ce que ce document ne dit pas

Volontairement, pour rester le document maître :

```text
- Aucune table, colonne, enum ou contrainte  → T1.
- Aucune policy SQL                          → T3.
- Aucune route, aucun composant              → T6.
- Aucune couleur, typo, espacement           → T7.
```

Si une session a besoin d'un de ces détails, elle charge ce document **plus**
le fichier thématique concerné — jamais l'ensemble du Project.
