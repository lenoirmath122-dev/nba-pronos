# NBA Pronos — SPEC ÉCRAN MES PRONOS V0.1

> **Statut** : **CLOSE** — les 10 points ouverts de la rédaction du 24/07/2026
> ont tous été tranchés le même jour et sont intégrés ci-dessous. Les **trois
> vérifications de dépôt** (§18) ont été levées en lecture seule (ÉTAPE 0,
> 24/07/2026) : les 3 étaient déjà correctes, rien à corriger dans la
> migration #7. Écran codé, vérifié (`tsc`/`eslint`/`next build`) et testé en
> conditions réelles (sessions authentifiées, écriture réelle, cas négatif
> RLS) — voir `ETAT_ACTUEL.md` §2.11 et `JOURNAL_SESSIONS.md`. Aucun point
> produit ouvert.
> **Portée** : `app/(app)/play/my-predictions/page.tsx` (route fixée par T6a),
> `lib/queries/my-predictions.ts`, `lib/actions/corrections.ts`,
> `lib/labels/rounds.ts`, `components/my-predictions/*`, migrations **#7** et **#8**.
> **Cinquième écran du hub joueur**, deuxième écran qui écrit (une seule
> écriture : la requête de correction). Premier écran qui porte le **live**.
>
> **Décisions actées au cadrage du 24/07/2026** : ancrage sur les matchs (§3) ;
> fenêtre 3 jours en arrière (§4.1) ; segments Récent / Historique + filtres date
> et série (§4.2) ; révélation des autres au clic (§7) ; requête de correction
> possible sur un match jamais ouvert, **voie A** (§10) ; points affichés avec
> « — » tant que non scorés (§9) ; badge EN DIRECT + remontée en tête, mais
> réordonnancement **au chargement seulement** (§5.2) ; rappel du pari associé en
> lecture seule (§11).
>
> **Amendements du 24/07/2026 (mêmes sources, après arbitrage des points ouverts)** :
> marquage de correction admin **nominatif** et non générique (§7.1, §13) ;
> publication Realtime activée par migration versionnée (§18 → §1) ; historique
> plafonné à 40 lignes (§4.4) ; libellés de tour extraits en module partagé
> (§16.5) ; formulaire de requête en composant **serveur** (§1.1).

## 0. Sources et cadre

| Sujet | Source | Ce qu'elle impose |
|---|---|---|
| Route et arbre `app/` | T6a §3 | `(app)/play/my-predictions/page.tsx` ; lecture via `lib/queries/*` + `getServerClient()` |
| Ancrage sur les matchs | `SPEC_ECRAN_MATCHS_V0_1` §17/§18.2, `GAPS_OUVERTS.md` | contrainte **transmise**, non rediscutée (§3) |
| Le live vit ici | idem | badge EN DIRECT, score courant, Realtime `matches` — **retiré** de l'écran Matchs |
| Verrouillage | 0.2.3 §4, T6c §10.3 | piloté par l'**heure connue** du match, jamais par `matches.status` |
| `LOCKED` jamais écrit | T6b §9.2 | « verrouillé » est **calculé**, pas stocké |
| Auto-validation | T6b §2 (`sealDeadlines`) | brouillon **complet** → `VALIDATED` ; brouillon **partiel** → reste `DRAFT` |
| Correction sur requête | 0.2.3 §7, 0.2.7 §6 | le joueur peut demander à un admin de **saisir**/corriger ; 1 requête = 1 prono ; pas de délai limite |
| Transparence | 0.2.3 §7 | prono saisi/corrigé par un admin marqué **publiquement**, **avec les deux noms** — garde-fou explicitement **social** |
| Scoring | T5 §5 | ne score qu'une prédiction **figée ET complète** ; recalcul **idempotent** ; jamais de points négatifs |
| Confidentialité | T3, D4/C-5 | « valider = voir », par match ; après verrouillage, tout est révélé |
| Paris | T1 §3.10 | `uniq_active_match_bet` → **au plus un** pari MATCH actif par (joueur, match) |
| Realtime | T4 §9, T6c §14.2 | publication à activer côté base — **migration #8** (§1) |
| Couleurs / rayons | T7 + amendement V0.2 | vert/rouge = **résultat** uniquement ; or = champion (absent ici) |

**Conventions** : TypeScript strict, App Router, composants serveur par défaut,
commentaires FR, noms de code EN, styles via les tokens de `app/tokens.css`
(aucune valeur en dur), CSS Modules colocalisés.

---

## 1. Architecture

```text
app/(app)/play/my-predictions/page.tsx
    → composant SERVEUR. Lit searchParams (Promise en Next.js 16 — piège §16.4),
      appelle lib/queries/my-predictions.ts, compose la liste. Aucun fetch client.

lib/queries/my-predictions.ts
    → toute la lecture de l'écran (§13). getServerClient(), jamais service_role.
      Nommé d'après la ROUTE (règle réelle des 4 fichiers existants), pas
      « predictions.ts » qui serait ambigu : l'écran montre LES MIENS.

lib/actions/corrections.ts
    → SEULE écriture de l'écran : requestPredictionCorrection() (§14).
      Appelle la fonction SQL de la migration #7 via .rpc().

lib/labels/rounds.ts
    → NOUVEAU module PARTAGÉ : libellés de tour (« 1er tour », « Demi-finales de
      conférence », …). Extrait de l'écran Bracket, qui les portait en dur, et
      importé par les DEUX écrans (§16.5).

components/my-predictions/*
    → rendu. Intégralement SERVEUR sauf une feuille (§1.1).

supabase/migrations/<timestamp>_request_prediction_correction.sql   (#7)
    → fonction SECURITY DEFINER (§10.2) + le cas échéant la policy SELECT
      manquante sur correction_requests (§18.2) — même sujet, même migration.

supabase/migrations/<timestamp>_realtime_matches.sql                (#8)
    → alter publication supabase_realtime add table matches;
      Sujet distinct → migration distincte. La table `series`, prévue par T4 §9,
      n'est PAS publiée ici : elle le sera le jour où le Bracket personnel la
      consomme. Chaque table publiée quand un écran en a besoin, pas avant.
```

### 1.1 Composants client — **un seul**

L'écran est conçu pour n'avoir presque aucun composant client. Trois raisons le
permettent :

1. **Le dépliage n'a pas besoin de JavaScript.** Le panneau des autres joueurs
   utilise `<details>`/`<summary>` natif. Le contenu est rendu **serveur** et
   masqué tant qu'il n'est pas déplié — ce qui satisfait exactement la demande
   (« seulement quand on clique dessus pour ne pas surcharger l'écran ») sans une
   ligne de JS. Aucune fuite : sur un match verrouillé, la RLS révèle déjà ces
   données à tout le monde (§12).
2. **Les filtres n'ont pas besoin de JavaScript.** Formulaires `GET` natifs qui
   écrivent dans l'URL (§4.2).
3. **La requête de correction n'a pas besoin de JavaScript.** `<form
   action={...}>` natif, erreur rendue au rechargement. C'est un geste
   exceptionnel, pas une saisie répétée : un retour instantané ne vaut pas un
   composant client de plus. Le patron est déjà prouvé sur ce projet — le bouton
   de déconnexion a été testé de bout en bout sans JS.

Reste donc **une seule** feuille cliente, et elle est incompressible :

```text
components/my-predictions/LiveSubscriber.tsx   → "use client" (1/1)
    Souscription Realtime UNIQUE pour tout l'écran (un canal, pas un par ligne).
    Tient une table matchId → { status, homeScore, awayScore } et ne met à jour
    QUE le contenu des lignes concernées (§5.3).
```

Tout le reste — `MatchRowStatic`, `PredictionSummary`, `RevealPanel`,
`AssociatedBetCard`, `SeriesBetHeader`, `FilterBar`, `SegmentTabs`,
`CorrectionRequestForm`, `EmptyState` — est **serveur**.

---

## 2. Compétition affichée

Une seule compétition `ACTIVE` à la fois (décisions multi-compétitions §1) :
l'écran la lit sans sélecteur, comme les quatre écrans précédents. Aucune
compétition active → état vide global (§15.1).

---

## 3. Périmètre — ancré sur les MATCHS, pas sur les pronos

**Contrainte transmise, non rediscutée.**

L'écran liste des **matchs verrouillés** et y accroche le prono du joueur quand
il existe. Il ne liste **jamais** des lignes `match_predictions`.

```text
Sélection : matches.scheduled_at IS NOT NULL
            AND matches.scheduled_at <= now()
```

Trois conséquences directes :

- un match totalement oublié **apparaît quand même** — c'est précisément celui
  dont le joueur a le plus besoin ;
- le filtre ne porte **jamais** sur `matches.status` (le planificateur tourne
  toutes les 30–60 min : un match commencé peut rester `SCHEDULED` près d'une
  heure — T4/A8, §5.4) ;
- **aucun recouvrement** avec l'écran Matchs, qui sélectionne `scheduled_at >
  now()`. Même horloge, deux sens. Un match ne peut ni apparaître sur les deux
  écrans, ni disparaître entre les deux.

**Matchs à `scheduled_at` NULL — acté** : exclus, et aucune règle d'écran n'est
inventée pour eux. Un match joué sans heure connue est une **anomalie de
données**, pas un cas d'usage : c'est à la synchro (T4) de renseigner la date. À
faire remonter dans un écran admin de qualité de données le jour où ces écrans
existeront.

---

## 4. Fenêtre, segments, filtres et volume

### 4.1 Deux segments — **acté**

```text
« Récent »     → scheduled_at entre now() − 3 jours et now()   [par défaut]
« Historique » → tous les matchs verrouillés de la compétition
```

Les 3 jours en arrière sont la **symétrie exacte** des 3 jours en avant de
l'écran Matchs. Ensemble, les deux écrans couvrent une fenêtre glissante de six
jours autour du présent, sans trou ni doublon.

Le segment actif vit dans l'URL (`?tab=recent` / `?tab=history`), pas dans un
état client — l'écran reste serveur et un lien reste partageable.

### 4.2 Filtres date et série — **acté**

```text
?date=YYYY-MM-DD   → les matchs de ce jour (fuseau Europe/Paris, §16.3)
?series=<uuid>     → les matchs de cette série
```

Rendu : formulaire `GET` natif (un `<input type="date">`, un `<select>` de séries,
un bouton « Filtrer »). Aucun JavaScript, aucun composant client. Les valeurs
proposées viennent de `availableDates` / `availableSeries` (§13) — jamais une
liste inventée au rendu.

### 4.3 Trois modes exclusifs — **acté**

`Récent`, `Historique` et `Filtré` sont **exclusifs**. Un filtre actif
**remplace** la segmentation et porte sur **tout l'historique**.

Raison : « Récent » combiné à une date d'il y a trois semaines donnerait
systématiquement une liste vide — un cul-de-sac inexplicable pour le joueur.
Quand un filtre est actif, les deux segments sont remplacés par une puce
« Filtre : *valeur* ✕ » qui rend le retour évident.

### 4.4 Volume de l'historique — **acté**

```text
Historique plafonné à 40 lignes.
Bouton « Charger plus » → incrémente ?limit= dans l'URL.
```

Serveur, sans composant client, cohérent avec les filtres. Une compétition
Playoffs complète compte ~86 matchs, et chaque ligne transporte les pronos des
autres joueurs (§7) : une page non bornée grossirait vite. Le jeu de test ne
contenant que 9 matchs, rien de réaliste n'est mesurable aujourd'hui — un plafond
simple ferme le risque pour un coût quasi nul, plutôt que d'optimiser à l'aveugle.

---

## 5. Le live

### 5.1 Badge EN DIRECT

Un match dont `matches.status = 'IN_PROGRESS'` porte un badge **EN DIRECT** et
affiche le score courant (`home_score` / `away_score`).

Rappel T4/A6 : ces colonnes stockent le **total déjà sommé** par
`lib/nba/client.ts` à partir du tableau par quart-temps de l'API — jamais une
valeur brute. L'écran ne fait aucune arithmétique de score.

### 5.2 Ordre de la liste — **acté**

```text
1. les matchs EN DIRECT, en tête
2. puis les autres, du plus récent au plus ancien (anti-chronologique)
```

**Le réordonnancement n'a lieu qu'au chargement de l'écran.** Un match qui passe
en direct pendant que le joueur lit ne remonte pas sous ses yeux : il gagne son
badge et son score là où il est, et ne prendra la tête qu'au prochain chargement.

Raison : si le joueur a déplié une ligne pour lire les pronos des autres, une
remontée décalerait le contenu sous son doigt.

### 5.3 Ce que le Realtime met à jour — **règle**

```text
Le Realtime met à jour le CONTENU d'une ligne (statut, score).
Il ne modifie JAMAIS l'ORDRE de la liste, ni sa composition (aucune ligne
n'apparaît ni ne disparaît en direct).
```

Une seule souscription pour tout l'écran (`LiveSubscriber`, §1.1), sur `matches`,
restreinte aux `matchId` réellement présents dans la page.

### 5.4 Latence assumée — **à écrire dans l'écran, pas seulement ici**

Le badge dépend de `matches.status`, que **seul le planificateur écrit**, toutes
les 30 à 60 minutes. Un match commencé depuis vingt minutes peut être joué sans
badge, un match terminé rester `IN_PROGRESS` un moment.

Ce n'est pas un défaut de l'écran, c'est la cadence de la synchro. La spec
l'acte : **le live est indicatif, jamais une horloge officielle**. Il ne pilote
rien — surtout pas le verrouillage, qui reste piloté par `scheduled_at` (§3).

---

## 6. La ligne repliée

```text
- l'affiche (logos + abréviations, via components/ui/TeamLogo.tsx) ;
- le numéro de match dans la série (« Match 3 ») ;
- la date / l'heure, ou le badge EN DIRECT (§5.1) ;
- le score du match — courant si en direct, final si terminé, « — » sinon ;
- MON prono, sous une des trois formes du §8 ;
- mes points sur ce match (§9) ;
- le rappel du pari associé, s'il y en a un (§11) ;
- l'état de ma requête de correction, s'il y en a une (§10.5).
```

Aucune action de saisie de prono nulle part : le verrouillage au coup d'envoi est
**irréversible** (0.2.3 §4). Cet écran ne rouvre jamais rien (§17).

---

## 7. Le panneau déplié — **acté**

Les pronos des **autres joueurs** ne sont pas affichés d'emblée : ils vivent dans
un panneau replié, ouvert au clic. Sur **tous** les matchs verrouillés, pas
seulement les terminés.

Le panneau reprend le patron du drill-down du Bracket (`SeriesDrillDown`) et du
`RevealPanel` de l'écran Matchs :

```text
- la liste nominative des pronos des autres joueurs ACTIFS ;
- le marquage public de correction admin (§7.1) ;
- les joueurs qui n'ont pas pronostiqué, en compteur (patron `absentees` de
  l'écran Matchs, repris tel quel).
```

Rendu **serveur**, masqué par `<details>` (§1.1).

### 7.1 Marquage de correction admin — **NOMINATIF (amendement du 24/07/2026)**

0.2.3 §7 exige que tout prono saisi ou corrigé par un admin soit marqué
publiquement **« avec l'auteur de la requête et l'admin ayant agi »**, et pose
que le garde-fou principal est **social, pas technique** — c'est-à-dire qu'il
repose entièrement sur ces noms.

L'écran Matchs rend un badge **générique** parce que son contrat de types, figé
avant, ne portait aucun nom. Cette spec écrit un contrat neuf : **rien n'oblige à
reconduire cette perte**, et un badge anonyme viderait la règle de sa substance.

**Rendu retenu** :

```text
« Saisi par <admin> à la demande de <joueur> — <motif> »
```

**Simplification trouvée à la rédaction du contrat** : le requérant est
**toujours** le propriétaire du prono. 0.2.3 §7 ne permet de demander que la
correction de **son** prono, et le garde-fou §10.3 restreint l'écriture à
`auth.uid()`. « À la demande de Y » désigne donc toujours le joueur dont on lit
la ligne — déjà connu. Il n'y a **rien à lire dans `correction_requests`** : un
seul join sur `users` pour le pseudo de l'admin suffit. La transparence de
0.2.3 §7 est intégralement servie, avec une requête de moins, et sans dépendre de
la policy du §18.2.

`correction_reason` est porté par `match_predictions` (donc sans enjeu de RLS) et
**affiché en entier** : quand la transparence est le seul garde-fou, elle ne se
tronque pas.

**Divergence assumée** : Matchs restera générique, Mes pronos sera nominatif. À
aligner plus tard sur l'écran Matchs — noté en gap ouvert, pas reproduit ici par
souci de symétrie.

---

## 8. Les trois états d'un prono — **structurant**

Un match verrouillé se trouve dans exactement un de ces trois états. Ils sortent
directement de `sealDeadlines` (T6b §2), qui auto-valide les brouillons complets
et laisse les partiels en `DRAFT` :

| État | Base | Scoré ? | Requête possible ? |
|---|---|---|---|
| **FROZEN** — prono figé | ligne `VALIDATED`, les deux champs remplis | oui | oui (correction) |
| **INCOMPLETE** — brouillon partiel | ligne `DRAFT`, un seul champ rempli | **non** | oui (correction) |
| **MISSING** — pas de prono | aucune ligne, **ou** ligne vide (§10.2) | non | oui (saisie) |

`INCOMPLETE` et `MISSING` sont **les matchs oubliés** : ce sont eux que l'écran
existe pour faire remonter. Visuellement distincts d'un prono figé, sans être
punitifs — **pas de rouge** : le rouge est réservé au **résultat** (T7).

`FROZEN` couvre indifféremment une validation volontaire et une auto-validation
(`is_auto_validated`) — distinction jamais observable en pratique, simplification
déjà actée pour l'écran Matchs et reconduite ici.

---

## 9. Points affichés — **acté**

```text
points_awarded (colonne générée : winner_points + margin_bonus_points)
scored_at IS NULL  →  rendu « — »
```

**« — », jamais « 0 »** tant que `scored_at` est NULL. Un match non encore scoré
n'est pas un match à zéro point : afficher « 0 » serait un mensonge. Le moteur de
scoring (T5) n'étant pas codé, `scored_at` sera NULL **partout** tant que ce lot
n'est pas fait.

Un prono `INCOMPLETE` ou `MISSING` ne sera jamais scoré (T5 §5 : figée **et**
complète) : « — » permanent, ce qui est exact.

Rappel T5 : **aucune pénalité négative nulle part**. Un match oublié vaut zéro,
jamais moins.

---

## 10. Requête de correction — **voie A, actée**

### 10.1 La règle produit

0.2.3 §7 : « un joueur peut demander à un admin de **saisir**/corriger son prono.
La requête peut être envoyée même après le début ou la fin du match. » Le mot
« saisir » couvre le match jamais ouvert — c'est la moitié de la règle que ni T1
ni T3 n'avaient outillée.

Le joueur peut déposer une requête depuis les **trois** états du §8.

### 10.2 Le mécanisme — migration #7

`correction_requests.target_match_prediction_id` référence
`match_predictions(id)` : une requête vise une **ligne de prono**, pas un match.
Or dans l'état `MISSING`, aucune ligne n'existe, et la policy `mp_insert`
(`not match_is_locked(match_id)`) interdit au joueur d'en créer une.

**Voie retenue (A)** : une fonction `SECURITY DEFINER` fait les deux écritures
dans **une seule transaction** —

```text
1. si aucune ligne (user_id, match_id) n'existe :
   créer match_predictions en DRAFT, predicted_winner_team_id = NULL,
   predicted_margin = NULL ;
2. créer correction_requests pointant sur cette ligne.
```

La ligne vide n'existe **jamais sans sa requête** : pas d'orpheline.

Côté admin, rien de neuf : il **modifie** une ligne existante, exactement comme
pour corriger un prono déjà rempli. Un seul geste, un seul chemin de code — celui
que T3 avait prévu (« admin : sur requête », trigger T-c) et que le seed du
23/07 a réellement exercé.

**Pourquoi ce contournement est acceptable** : la fonction contourne
`not match_is_locked()` mais **n'écrit aucun contenu de pronostic**. Le joueur
n'acquiert pas la capacité d'exprimer un prono après le coup d'envoi — il ouvre
un dossier vide qu'un admin devra remplir, publiquement et tracé.
L'irréversibilité du verrouillage reste entière. Cette justification figure
**en commentaire dans la migration**, pas seulement ici.

### 10.3 Garde-fous de la fonction — tous obligatoires

```text
- uniquement pour auth.uid() (jamais pour le compte d'un autre joueur) ;
- uniquement si le joueur est ACTIVE (un DISABLED n'écrit plus) ;
- uniquement si le match est effectivement VERROUILLÉ (sinon la saisie normale
  s'applique : on ne double pas un chemin qui existe) ;
- uniquement si aucune ligne (user_id, match_id) n'existe déjà — sinon on
  réutilise l'existante, jamais on n'en crée une seconde (idempotent) ;
- la ligne créée ne porte QUE des NULL, en DRAFT. Aucune autre valeur ;
- justification obligatoire (0.2.7 §6) ;
- une seule requête PENDING par prono à la fois.
```

### 10.4 La règle de lecture qui en découle — **non négociable**

```text
AUCUNE requête, AUCUN rendu ne doit tester la PRÉSENCE d'une ligne
match_predictions. Toujours sa COMPLÉTUDE.
```

Une ligne vide est désormais un état **légitime** de la base. Toute lecture qui
compte les lignes plutôt que les pronos complets se trompera — y compris
`count_committed_predictions`, protégée en principe par `status <> 'DRAFT'`, donc
correcte, **à vérifier malgré tout** (§18.3). C'est la contrepartie de la voie A,
et le type `MyPredictionState` (§13) l'encode : une ligne vide se rend en
`MISSING`, jamais en `INCOMPLETE`.

### 10.5 Le cycle de vie côté joueur

```text
PENDING   → « Requête en attente »
PROCESSED → le prono est mis à jour et marqué publiquement (§7.1)
REJECTED  → « Requête refusée : <motif> » — motif OBLIGATOIRE (0.2.7 §6)
```

Un refus laisse la ligne vide en base pour toujours (aucun DELETE joueur nulle
part, rétention D2). Elle reste **invisible** : elle se rend en `MISSING`, comme
avant la requête. C'est le résidu assumé de la voie A.

Cas limite à afficher honnêtement : s'il n'existe qu'**un seul admin** et que le
requérant est cet admin, sa requête reste `PENDING` indéfiniment (0.2.7 §2). Ne
pas laisser croire à un bug.

---

## 11. Le pari associé — **acté, lecture seule**

L'écran reste un écran de **pronos**. Le pari n'y est qu'un rappel : « juste pour
voir ». Le détail, les actions et le cycle de vie complet restent sur
`/play/bets` (« Mes paris »), lot suivant.

### 11.1 Pari MATCH

`uniq_active_match_bet` garantit **au plus un** pari MATCH actif par (joueur,
match) : la ligne porte un **emplacement**, pas une liste. Affiché : description,
catégorie, difficulté (`validated_difficulty` si elle existe, sinon
`proposed_difficulty` — la validée fait foi, 0.2.4 §7), statut, points.

### 11.2 Pari SERIES — **uniquement en filtre série**

Un pari `SERIES` n'a pas de `match_id` : il porte sur la série entière, donc 4 à
7 matchs. L'afficher sur chaque ligne le répéterait jusqu'à sept fois.

**Décision** : il n'apparaît **que** lorsqu'un filtre `?series=` est actif, dans
un **en-tête de série** au-dessus de la liste (« Ton pari sur cette série : … »).
Il ne peut pas se loger dans une ligne de match puisqu'il n'en vise aucun.
Cohérent : filtrer par série, c'est regarder la série comme un tout.

Conséquence assumée : en navigation normale, un pari de série n'est pas visible
ici. Il l'est sur « Mes paris ».

### 11.3 Statuts montrés

**Tous mes paris**, quel que soit leur statut, rendus selon T6c : un pari
`CANCELLED` barré et grisé, un `REJECTED` signalé comme tel. Masquer les refusés
ou les annulés donnerait l'impression fausse qu'aucun pari n'a existé sur ce
match.

### 11.4 Inerte jusqu'au lot « Paris »

Le rappel **n'est pas cliquable** en V0.1 : `/play/bets` n'existe pas encore
(même situation que le hub Jouer temporaire). Le lot « Paris » le rendra actif en
même temps qu'il fixera la destination du raccourci déjà en attente sur l'écran
Matchs.

---

## 12. Confidentialité

Cet écran ne montre **que des matchs verrouillés**. La RLS révèle donc déjà les
pronos de tous à tout le monde sur ces matchs (D4/C-5). Contrairement aux écrans
Matchs et Bracket, il n'y a **pas** de branche pré-révélation à coder : le patron
`others`/`absentees` vides côté serveur n'a pas lieu d'être ici.

Deux conséquences :

- rendre le panneau déplié côté serveur ne fuite rien (§1.1) ;
- **on ne se repose pas sur ce raisonnement pour filtrer** : la RLS reste la
  seule autorité de lecture, l'écran ne recalcule aucune visibilité. Si un match
  non verrouillé se retrouvait un jour dans la sélection, c'est la RLS qui
  masquerait, pas un `if` de rendu.

Les paris affichés sont **les miens uniquement** : aucune visibilité croisée ici.

---

## 13. Couche de lecture — contrats de types

`lib/queries/my-predictions.ts`. **Ces types font autorité** : le rendu n'affiche
rien qu'ils ne portent pas.

```ts
// RÉUTILISÉ TEL QUEL depuis lib/queries/matches.ts — ne pas redéfinir,
// ne pas modifier (contrat figé par SPEC_ECRAN_MATCHS_V0_1 §13) :
//   TeamRef
// Si sa forme réelle ne convient pas, le SIGNALER (§18.1), pas l'adapter.

export type MyPredictionsMode = 'RECENT' | 'HISTORY' | 'FILTERED';

/** État live du match, tel qu'on peut l'affirmer — cf. §5.4. */
export type MatchLiveState =
  | 'STARTED'    // heure passée, mais la base dit encore SCHEDULED (latence synchro)
  | 'LIVE'       // IN_PROGRESS
  | 'FINISHED'
  | 'POSTPONED'
  | 'CANCELLED';

/** Les trois états du §8. Une ligne VIDE se rend en MISSING, jamais INCOMPLETE. */
export type MyPredictionState = 'FROZEN' | 'INCOMPLETE' | 'MISSING';

/** Marquage de correction admin, NOMINATIF (§7.1).
 *  Le requérant est toujours le propriétaire du prono : il n'est donc pas porté
 *  ici, il est déjà connu de la ligne qui affiche ce bloc. */
export type AdminCorrection = {
  adminName: string;
  reason: string | null;
};

export type MyPrediction = {
  state: MyPredictionState;
  predictedWinner: TeamRef | null;
  predictedMargin: number | null;
  isAutoValidated: boolean;
  /** null = pas corrigé par un admin. */
  adminCorrection: AdminCorrection | null;
  /** null = pas encore scoré → rendu « — », jamais « 0 » (§9). */
  points: number | null;
};

/** Prono d'un AUTRE joueur, révélé dans le panneau déplié (§7).
 *  NE réutilise PAS OtherPrediction de matches.ts : ce type-là ne porte qu'un
 *  booléen isAdminCorrected, ce qui viderait 0.2.3 §7 de sa substance (§7.1). */
export type RevealedPrediction = {
  userId: string;
  userName: string;
  predictedWinner: TeamRef | null;
  predictedMargin: number | null;
  adminCorrection: AdminCorrection | null;
  points: number | null;
};

export type CorrectionRequestState = {
  status: 'PENDING' | 'PROCESSED' | 'REJECTED';
  /** Obligatoire si REJECTED (0.2.7 §6). */
  adminReason: string | null;
  createdAt: string;
};

export type AssociatedBet = {
  id: string;
  description: string;
  category: string;
  /** validated_difficulty ?? proposed_difficulty — la validée fait foi. */
  difficulty: number;
  isDifficultyValidated: boolean;
  status: 'DRAFT' | 'SUBMITTED' | 'VALIDATED' | 'REJECTED' | 'WON' | 'LOST' | 'CANCELLED';
  points: number | null;
};

export type MyPredictionRow = {
  matchId: string;
  seriesId: string;
  gameNumber: number;
  /** ISO. Jamais null : les matchs sans heure sont exclus (§3). */
  scheduledAt: string;
  home: TeamRef;
  away: TeamRef;
  homeScore: number | null;
  awayScore: number | null;
  liveState: MatchLiveState;
  prediction: MyPrediction;
  correctionRequest: CorrectionRequestState | null;
  /** Pari MATCH uniquement. Les paris SERIES vivent dans seriesBet (§11.2). */
  bet: AssociatedBet | null;
  /** Toujours chargés côté serveur : tout est révélé sur un match verrouillé
   *  (§12). Le repli est purement visuel (<details>). */
  others: RevealedPrediction[];
  absenteeCount: number;
};

export type SeriesBetHeader = {
  seriesId: string;
  /** Construit avec lib/labels/rounds.ts, jamais en dur (§16.5). */
  seriesLabel: string;
  bet: AssociatedBet | null;
};

export type MyPredictionsData = {
  mode: MyPredictionsMode;
  filter: { date: string | null; seriesId: string | null };
  /** Non null UNIQUEMENT en mode FILTERED sur une série (§11.2). */
  seriesBet: SeriesBetHeader | null;
  /** Déjà triées : EN DIRECT en tête, puis anti-chronologique (§5.2). */
  rows: MyPredictionRow[];
  /** Pagination de l'historique (§4.4). */
  hasMore: boolean;
  /** Valeurs proposables par les filtres — jamais inventées au rendu (§4.2). */
  availableDates: string[];
  availableSeries: { id: string; label: string }[];
};

export async function getMyPredictions(params: {
  mode: MyPredictionsMode;
  date?: string;
  seriesId?: string;
  limit?: number;            // défaut 40 (§4.4)
}): Promise<MyPredictionsData | null>;   // null = aucune compétition ACTIVE
```

---

## 14. Écriture — server action

`lib/actions/corrections.ts` :

```ts
export async function requestPredictionCorrection(input: {
  matchId: string;
  justification: string;
  proposedWinnerTeamId?: string;
  proposedMargin?: number;
}): Promise<ActionResult>;
```

Elle appelle la fonction SQL de la migration #7 via `.rpc()`. **Aucune écriture
directe** sur `match_predictions` : tous les garde-fous du §10.3 vivent dans la
fonction, côté base — jamais dans l'action, encore moins dans le client.

Règle rappelée : **toute validation serveur recalcule ses propres garde-fous
depuis la base**, jamais depuis ce qu'affiche le client (le match est verrouillé ?
le joueur est actif ? une requête existe déjà ?).

Post-succès : `revalidatePath('/play/my-predictions')` + `'/home'` (une requête en
attente peut alimenter l'Accueil).

---

## 15. États vides — libellés **exacts**

```text
15.1  Aucune compétition ACTIVE
      « Aucune compétition en cours. »

15.2  Segment « Récent » vide
      « Aucun match verrouillé ces trois derniers jours. »
      + lien vers l'historique.

15.3  Segment « Historique » vide (début de compétition)
      « Aucun match verrouillé pour l'instant. »
      + « Tes pronos apparaîtront ici après le coup d'envoi. »

15.4  Filtre sans résultat
      « Aucun match pour ce filtre. »
      + puce de retrait du filtre (§4.3).

15.5  Panneau déplié sans autre joueur
      « Personne d'autre n'a pronostiqué sur ce match. »
```

---

## 16. Règles de rendu et pièges

### 16.1 T7 — non négociables

- vert / rouge réservés au **résultat** ; un prono manquant n'est **pas** rouge ;
- or réservé au champion de la finale — **absent de cet écran** ;
- aucune valeur visuelle en dur : uniquement les tokens de `app/tokens.css`.

### 16.2 Logos

Via `components/ui/TeamLogo.tsx` (chemin déduit de l'abréviation, repli texte via
`onError`) — jamais `teams.logo_url`, qui reste vide.

### 16.3 Fuseau

Regroupement et filtre par jour en **Europe/Paris**, comme l'écran Matchs — le
fuseau machine du serveur peut être UTC en hébergement. Convention explicite,
pas déduite.

### 16.4 Next.js 16

- `searchParams` est une **Promise** : la page doit l'attendre ;
- `cookies()` est asynchrone → `getServerClient()` est `async` ;
- `next/image` refuse d'optimiser un SVG sans `dangerouslyAllowSVG` → prop
  `unoptimized`, déjà en place dans `TeamLogo` ;
- ESLint `react-hooks/set-state-in-effect` : dans `LiveSubscriber`, tout
  `setState` d'effet doit vivre dans une **fonction nommée** appelée depuis
  l'effet, jamais au premier niveau de son corps.

### 16.5 Libellés de tour — module partagé

`lib/labels/rounds.ts` : les libellés (« 1er tour », « Demi-finales de
conférence », « Finales de conférence », « Finale NBA ») sont **extraits** de
l'écran Bracket, qui les portait en dur, et importés par les deux écrans.

C'est une modification d'un écran **déjà codé et vérifié** : à faire en début de
lot, isolément, avec ses trois vérifications, avant d'écrire le nouvel écran.
L'alternative — recopier les chaînes — créerait un second vocabulaire qui
divergerait au premier changement de libellé.

### 16.6 RLS silencieuse

Une écriture bloquée par la RLS ne renvoie **pas toujours** d'erreur : un
`UPDATE` dont la clause `USING` ne matche aucune ligne réussit avec zéro ligne
affectée et `error` à `null`. Tout test d'écriture doit compter les **lignes
réellement affectées**, jamais se contenter de l'absence d'erreur.

---

## 17. Hors périmètre

```text
- Toute saisie ou modification d'un prono : le verrouillage au coup d'envoi est
  IRRÉVERSIBLE (0.2.3 §4). Cet écran consulte, il ne rouvre rien.
- Le détail et les actions sur les paris → « Mes paris » (/play/bets).
- Le bracket personnel → /play/bracket.
- Les matchs à venir → écran Matchs (aucun recouvrement, §3).
- Les matchs à scheduled_at NULL (§3).
- Le traitement des requêtes → écrans admin (/admin/requests).
- La publication Realtime de `series` → au lot Bracket personnel (§1).
- L'alignement du badge de correction de l'écran Matchs sur le rendu nominatif
  (§7.1) → gap ouvert.
- Le moteur de scoring (T5) et la synchro (T4) : NON CODÉS. L'écran les
  consomme, il ne les implémente pas — d'où « — » partout sur les points tant
  que ces lots ne sont pas faits.
```

---

## 18. Vérifications de dépôt — à lever **avant** la première ligne de code

Trois points, tous en **lecture seule**, aucun ne demande d'arbitrage produit.
Ils n'ont pas pu être levés à la rédaction (dépôt inaccessible ce jour-là).

1. **Forme réelle de `TeamRef`** (`lib/queries/matches.ts`). Doit être
   **importé**, jamais redéfini ni modifié. S'il ne convient pas : ne pas toucher
   à `matches.ts`, déclarer un type local dans `my-predictions.ts` et le
   signaler. Un `lib/queries/types.ts` partagé serait plus propre à terme, mais
   c'est un amendement à T6a — pas quelque chose à glisser dans un lot d'écran.
2. **Policy SELECT sur `correction_requests`.** La matrice T3 §5 documente
   l'INSERT (« self actif ») et l'UPDATE (admin) mais pas le SELECT joueur, qui
   existe probablement ailleurs dans T3. Le joueur doit voir l'état de **sa**
   requête (§10.5). Si la policy manque, la corriger **dans la migration #7** —
   même sujet, pas une huitième migration : `requester_user_id = auth.uid() or
   is_admin()`.
3. **Triggers T-b / T-c sur une ligne vide** (migration #3). Une seule passe de
   lecture vérifie trois choses : que T-b autorise `DRAFT → VALIDATED` sur une
   ligne à NULL ; que T-c se contente d'une requête liée et d'un admin différent
   de l'auteur ; et que `count_committed_predictions` filtre bien sur
   `status <> 'DRAFT'` (auquel cas les lignes vides sont inoffensives, §10.4). Si
   un garde-fou bloque, le correctif appartient à la migration #7 — **jamais** à
   un contournement applicatif.

---

## 19. Récapitulatif des décisions actées (24/07/2026)

| # | Décision |
|---|---|
| 1 | Écran **ancré sur les matchs** : tout match verrouillé apparaît, même sans ligne de prono (§3) |
| 2 | Sélection sur `scheduled_at <= now()`, **jamais** sur `matches.status` (§3) |
| 3 | Aucun recouvrement avec l'écran Matchs — même horloge, deux sens (§3) |
| 4 | Matchs à `scheduled_at` NULL : exclus, traités comme une **anomalie de données** (§3) |
| 5 | Fenêtre « Récent » = **3 jours en arrière**, symétrie de l'écran Matchs (§4.1) |
| 6 | Deux segments **Récent / Historique**, état dans l'URL (§4.1) |
| 7 | Filtres **date** et **série** dans l'URL, formulaire `GET` natif (§4.2) |
| 8 | Récent / Historique / Filtré **exclusifs** ; un filtre porte sur tout l'historique (§4.3) |
| 9 | Historique plafonné à **40 lignes** + « Charger plus » via `?limit=` (§4.4) |
| 10 | Badge **EN DIRECT** + score courant ; l'écran porte le live, retiré de Matchs (§5.1) |
| 11 | Les matchs en direct **remontent en tête**, mais **au chargement seulement** (§5.2) |
| 12 | Le Realtime met à jour le **contenu**, jamais l'**ordre** ni la composition (§5.3) |
| 13 | Le live est **indicatif** : latence assumée de 30–60 min, il ne pilote rien (§5.4) |
| 14 | Pronos des autres **révélés au clic**, sur tous les matchs verrouillés (§7) |
| 15 | Marquage de correction admin **NOMINATIF** + motif entier — amendement (§7.1) |
| 16 | Le requérant étant toujours le propriétaire du prono, `correction_requests` n'est **pas lue** pour ce marquage (§7.1) |
| 17 | Trois états : **FROZEN / INCOMPLETE / MISSING** (§8) |
| 18 | Points affichés ; **« — »** tant que `scored_at` est NULL, jamais « 0 » (§9) |
| 19 | Requête de correction possible depuis les **trois** états, y compris un match jamais ouvert (§10.1) |
| 20 | **Voie A** : ligne vide + requête dans une seule transaction, `SECURITY DEFINER`, migration #7 (§10.2) |
| 21 | Le contournement n'écrit **aucun contenu de pronostic** — l'irréversibilité du verrouillage reste entière (§10.2) |
| 22 | **Ne jamais tester la présence d'une ligne de prono, toujours sa complétude** (§10.4) |
| 23 | Pari associé en **lecture seule** ; le détail reste sur « Mes paris » (§11) |
| 24 | Pari **MATCH** sur la ligne ; pari **SERIES** uniquement en filtre série, en en-tête (§11.2) |
| 25 | **Tous** les statuts de mes paris sont montrés, y compris annulés et refusés (§11.3) |
| 26 | Le rappel de pari est **inerte** jusqu'au lot « Paris » (§11.4) |
| 27 | Aucune branche pré-révélation : tout est verrouillé ici, la RLS reste seule autorité (§12) |
| 28 | **Un seul composant client** : la souscription Realtime. Dépliage, filtres et formulaire de requête sans JS (§1.1) |
| 29 | Publication Realtime de `matches` par **migration versionnée #8** ; `series` reportée au lot Bracket personnel (§1) |
| 30 | Libellés de tour extraits en **module partagé** `lib/labels/rounds.ts` (§16.5) |
| 31 | Aucune saisie de prono : cet écran **ne rouvre jamais rien** (§17) |
