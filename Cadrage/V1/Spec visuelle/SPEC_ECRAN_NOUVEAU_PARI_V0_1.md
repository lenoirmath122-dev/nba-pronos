# NBA Pronos — SPEC ÉCRAN NOUVEAU PARI (création / édition) V0.1

> **Statut : VALIDÉ (26/07/2026).** Premier écran du lot « Paris ». Rédigé
> après cadrage du périmètre (session du 26/07/2026), clos après confirmation
> des 3 points ouverts du §16 (même session). Implémentation autorisée sous
> réserve du pré-vol §15.
>
> Deux autres surfaces du lot Paris sont hors de CETTE spec (specs à venir) :
> « Mes paris » (consultation / quotas) et la **révélation publique** d'un pari
> ouvert, actée pour vivre sur Matchs + Mes pronos (joueurs connectés) et sur
> `/bracket` (public non connecté) — pas sur cet écran.

---

## 0. Sources et cadre

```text
Produit    : nba_pronos_decisions_0_2_4_paris_personnalises.md (portée, quota,
             deadline, statuts, difficulté, refus) ; catégorie = C3 de
             nba_pronos_PREP_SPEC_TECHNIQUE_V1.md (9 catégories fixes) ;
             quota NBA Cup = nba_pronos_decisions_nba_cup_mecanique_scoring.md §6.
Données    : SPEC_TECHNIQUE_MODELE_DONNEES_V0_1.md §3.10 (table `bets`),
             enums bet_scope / bet_status / bet_category.
RLS        : SPEC_TECHNIQUE_RLS_V0_1.md §5 (écriture `bets` = « self avant
             validation » ; DELETE joueur interdit partout, rétention D2) + §6
             (trigger `enforce_bet_transitions`).
Archi/UI   : T6a (routes, server actions), T7 (design system, tokens),
             conventions Matchs / Mes pronos (feuille client unique, fuseau,
             logos, Next.js 16).
Arbitrages de cadrage (session 26/07/2026, tranchés AVEC l'utilisateur) :
  - un pari SOUMIS reste MODIFIABLE ET RETIRABLE tant que non revu ET avant
    deadline (§8/§9) ;
  - consommation de slot : SIMPLIFICATION (b) — un REJECTED libère TOUJOURS le
    slot, pas de colonne `rejected_at`, pas de migration de quota (§6) ;
  - double point d'entrée : raccourci Matchs + hub Mes paris (§2).
```

---

## 1. Architecture

```text
Routes (T6a, groupe (app), gardées par proxy.ts) :
  /play/bets/new            → création (contexte libre OU ?matchId=<uuid>)
  /play/bets/[id]/edit      → édition d'un pari DRAFT ou SUBMITTED du joueur

Composants serveur par défaut. UNE seule feuille client : le formulaire
(interactif — champs contrôlés, bascule de portée, sélecteurs). Le cadrage
(séries/matchs ouverts, état de quota, catégories) est LU côté serveur et
passé en props au formulaire. Aucune donnée de disponibilité n'est déduite du
client (brief §4) : le rendu client n'est qu'un confort, la server action
recalcule tout.
```

### 1.1 Frontière `"use client"`

Un composant `BetForm.tsx` (`"use client"`) porte la saisie et appelle les
server actions. Les sélecteurs de série/match et la grille de catégories/
difficulté peuvent rester des sous-composants serveur rendus en `children`, ou
être internes au formulaire — au choix de l'implémentation, une seule directive
`"use client"` au sommet du formulaire.

---

## 2. Contexte d'entrée — **acté, DEUX points d'entrée**

Le même écran sert deux contextes ; un seul paramètre les distingue.

```text
A. RACCOURCI depuis Matchs   → /play/bets/new?matchId=<uuid>
   Pré-remplit : portée = MATCH, match cible = ce match, série = sa série.
   (ferme le gap « destination du raccourci pari », SPEC_ECRAN_MATCHS §18.3)

B. HUB « Mes paris » (libre) → /play/bets/new
   Aucun pré-remplissage : le joueur choisit la portée, puis la cible.

C. ÉDITION                   → /play/bets/[id]/edit
   Charge un pari EXISTANT du joueur, en statut DRAFT ou SUBMITTED.
```

Règle du raccourci (contexte A) : la portée MATCH et le match sont pré-cochés,
mais la bascule de portée **reste disponible** — le joueur peut passer en SÉRIE
sur la même série (le match cible est alors relâché). Le raccourci exprime une
**intention** MATCH, pas une contrainte.

`searchParams` est une **Promise** en Next.js 16 → à `await` côté page serveur.
Un `matchId` invalide, hors compétition active, ou pointant un match déjà
commencé → l'écran retombe sur le contexte libre (B) avec un message discret
« ce match n'est plus ouvert au pari » (pas une erreur bloquante).

---

## 3. Choix de la portée SÉRIE / MATCH — **acté (0.2.4 §1)**

```text
Playoffs : les deux portées existent.
  SÉRIE  → porte sur toute la série (ex. « la série va en 7 »).
  MATCH  → porte sur un match précis et identifié.

NBA Cup  : portée SÉRIE MASQUÉE (aucune série n'existe, decisions_nba_cup §6).
           Seul MATCH est proposable. `bet_scope=SERIES` reste interdit par
           garde applicative (le schéma le note : « SERIES écarté
           fonctionnellement (garde app) »).
```

La bascule de portée est un contrôle binaire (SÉRIE / MATCH), réduit à un état
figé « MATCH » en NBA Cup.

---

## 4. Sélection de la cible — **acté (0.2.4 §1/§3)**

### 4.1 Portée SÉRIE

Le joueur choisit une **série** de la compétition active où :
- le pari série est **encore ouvert** — le **1er match de la série n'a pas
  commencé** (deadline série, §7) ;
- le joueur n'a **pas déjà** un pari série **actif** sur cette série (quota 1,
  §6).

Libellé d'une série (module partagé `lib/labels/rounds.ts`, même règle que Mes
pronos) : `<libellé de tour> — <team1> vs <team2>`, construit sur
`series.team1_id/team2_id` (pas les home/away d'un match, qui peuvent être
inversés d'un match à l'autre).

### 4.2 Portée MATCH

Le joueur choisit une série, puis un **match** de cette série qui est :
- **identifié** — `matches.scheduled_at` **non NULL** (adversaire connu, date/
  heure confirmées ; 0.2.4 §1 : « on ne peut pas parier sur un match dont la
  date n'existe pas encore ») ;
- **non commencé** — `scheduled_at > now()` (deadline match, §7) ;
- sans pari **actif** déjà posé par ce joueur sur CE match (au plus 1/match,
  §6) ;
- et la série ne doit pas avoir épuisé ses **3 slots MATCH** (Playoffs, §6).

Un match non planifié (`scheduled_at IS NULL`, ex. « match 6 » d'une série non
encore prolongée) **n'est pas sélectionnable** — affiché grisé ou absent.

---

## 5. Contenu du pari — énoncé, catégorie, difficulté — **acté**

Trois champs proposés par le joueur (`bets.description`,
`proposed_category`, `proposed_difficulty`) :

### 5.1 Énoncé (`description text not null`)

Texte libre décrivant le pari (ex. « Match 2 : Jaylen Brown marque 50+ »).
Non NULL en base ; **non vide exigé pour SOUMETTRE** (§8), toléré vide pour un
brouillon (§8).

### 5.2 Catégorie — **9 fixes (C3), proposée par le joueur**

Liste déroulante fermée (pas de tag libre). Valeurs enum → libellés FR :

```text
PLAYER_PROP         → Pari joueur              (défaut proposé, le plus fréquent)
SCORE_TOTAL         → Score / total match
TEAM_PROP           → Pari équipe
PERIOD              → Pari période
HEAD_TO_HEAD        → Comparaison / duel
PLAYING_TIME        → Rotation / temps de jeu
MULTI_PLAYER_COMBO  → Combo multi-joueurs
GAME_EVENT          → Événement de match
FUN_OFF_COURT       → Fun / hors terrain
```

C3 : l'admin peut corriger la catégorie à la validation (même geste que la
difficulté) — hors de cet écran. Ici, le joueur ne renseigne que
`proposed_category`.

### 5.3 Difficulté — **5 niveaux (0.2.4 §7), proposée par le joueur**

```text
1 très accessible · 2 accessible · 3 intermédiaire · 4 difficile · 5 jackpot
```

`proposed_difficulty smallint not null check between 1 and 5`. C'est la
difficulté **validée par l'admin** qui fera foi au scoring (0.2.4 §7) — pas
celle proposée ici. Barème (rappel, non affiché comme promesse ferme puisque
l'admin peut ajuster) : 5 / 10 / 15 / 20 / 25 (0.2.5 §8).

### 5.4 Valeurs par défaut d'un brouillon — **acté (26/07/2026)**

`proposed_category` et `proposed_difficulty` sont `not null` sans valeur par
défaut en base : le formulaire doit toujours porter une valeur choisie.
Catégorie par défaut = `PLAYER_PROP` (le plus fréquent, C3), difficulté par
défaut = `3` (milieu d'échelle).

---

## 6. Quota et disponibilité des slots — **recalcul SERVEUR, temporel**

### 6.1 Les quotas (0.2.4 §2 / Cup §6)

```text
Playoffs, par joueur ET par série :
  - 1 pari SÉRIE
  - 3 paris MATCH, sur 3 matchs DIFFÉRENTS (au plus 1 par match)
  Les deux quotas sont indépendants.

NBA Cup, par joueur :
  - scope MATCH uniquement, 1 pari par match, lu MATCH PAR MATCH
    (jusqu'à 7 au total sur les 7 matchs de phase finale) — aucun cap « série ».
```

### 6.2 Ce que la base garantit, ce qu'elle NE garantit PAS

```text
Index uniques partiels (T1 §3.10) — garde DB grossière :
  uniq_active_series_bet : 1 pari SÉRIE actif par (user, series)
  uniq_active_match_bet  : 1 pari MATCH actif par (user, match)
NON exprimable en index (T1 le note) : « 3 paris MATCH par série sur 3 matchs
différents » → COUNT obligatoire en SERVER ACTION.
```

Un index partiel **ne peut pas** référencer `now()` (fonction non immuable) :
la distinction « avant / après deadline » est donc **structurellement**
serveur, jamais DB. Les gardes de quota se recalculent depuis la base à chaque
écriture (brief §4), jamais depuis l'affichage.

### 6.3 Consommation d'un slot — **table 0.2.4 §6, simplification (b) actée**

Reprise à l'identique de la table de SPEC_ECRAN_MATCHS §10, avec l'arbitrage (b)
de cette session :

| Cas | Slot |
|---|---|
| Pari `REJECTED` (avant OU après deadline) | **libéré** — *simplification (b)* |
| Pari `CANCELLED` | libéré, toujours |
| `DRAFT` / `SUBMITTED` / `VALIDATED` / `WON` / `LOST` | consommé |

> **Écart assumé (b)** — 0.2.4 §6 distingue « REJECTED après deadline =
> consommé ». Faute de `rejected_at`, et le cas étant hors flux normal (à la
> deadline un `SUBMITTED` est auto-validé, pas rejeté), on libère TOUJOURS sur
> `REJECTED`. Cohérent avec les deux index T1 et avec Matchs. À rouvrir si
> `rejected_at` est un jour ajouté.

> **Note T1 mineure (non bloquante)** — `uniq_active_match_bet` n'exclut que
> `REJECTED`, pas `CANCELLED` ; un pari MATCH `CANCELLED` occupe donc encore
> son slot au niveau DB. Sans effet pratique (un match annulé n'est pas
> re-pariable) ; le COUNT serveur, lui, exclut bien `CANCELLED` (table
> ci-dessus). Signalé, pas corrigé dans ce lot.

---

## 7. Deadline différenciée — **acté (0.2.4 §3), pilotée par l'heure connue**

```text
Pari SÉRIE : verrouillé à l'heure de début du 1ER MATCH de la série.
Pari MATCH : verrouillé à l'heure de début du MATCH visé.
```

Deadline calculée depuis `matches.scheduled_at` (**heure connue**), **jamais**
depuis `matches.status` ni le live (T6c §10.3 ; le planificateur tournant
toutes les 30-60 min, un match commencé peut rester `SCHEDULED` près d'une
heure). Réutilise la fonction `bet_deadline_open` (migration #3, `SECURITY
DEFINER`) et/ou le calcul TS déjà reproduit pour l'Accueil — **une seule**
source de vérité de deadline à réutiliser, pas une 3e implémentation.

Création possible **uniquement avant** la deadline de la cible. Après : la cible
n'est plus sélectionnable (§4) et toute soumission est refusée serveur (§8).

---

## 8. Deux actions — Enregistrer brouillon / Soumettre — **acté (0.2.4 §4)**

```text
BROUILLON (DRAFT)  : « Enregistrer le brouillon » — persistance sans revue.
                     description peut être vide ; catégorie + difficulté
                     toujours présentes (défauts §5.4).
SOUMETTRE (SUBMITTED) : « Soumettre à validation » — entre dans la file admin.
                     Exige (recalculé serveur) : description NON VIDE, cible
                     valide et identifiée, deadline non passée, slot de quota
                     disponible, propriétaire = auteur.
```

`submitted_at` est posé à `now()` **à la transition** DRAFT→SUBMITTED. Éditer un
pari déjà SUBMITTED (§9) met à jour les champs sans retoucher `submitted_at`.

---

## 9. Cycle de vie côté joueur — **acté (arbitrage 26/07/2026)**

```text
Statuts éditables sur CET écran : DRAFT, SUBMITTED (et seulement avant deadline).
Non éditables ici : VALIDATED, REJECTED, WON, LOST, CANCELLED → lecture seule /
                    redirection vers « Mes paris ».
```

Trois gestes joueur :

```text
1. Modifier         : écrase librement les champs, tant que DRAFT ou SUBMITTED
                      ET avant deadline (RLS `bets` = « self avant validation »,
                      T3 §5 — AUCUN conflit, autorisé tel quel).
2. Soumettre        : DRAFT → SUBMITTED (§8).
3. Revenir en brouillon (retirer) : SUBMITTED → DRAFT. Le pari sort de la file
                      admin, revient en brouillon. JAMAIS une suppression.
```

> **Pas de suppression joueur.** DELETE est interdit partout (T3 §5 point 4,
> rétention D2). « Retirer » un pari soumis = le **repasser en brouillon**, pas
> l'effacer. L'écran ne propose donc **aucun** bouton « Supprimer ».

> **DÉPENDANCE À LEVER (§15).** La transition `SUBMITTED → DRAFT` n'est PAS dans
> le workflow acté 0.2.4 (qui ne montre que `DRAFT → SUBMITTED → VALIDATED`).
> Elle doit être **autorisée par le trigger `enforce_bet_transitions`**
> (migration #3). À vérifier dans `supabase/migrations/…_rls.sql` avant de coder
> le geste « retirer ». Si absente : migration versionnée dédiée (contenu montré
> + confirmation avant `db push`).

### 9.1 Re-proposition après refus — **acté (0.2.4 §6)**

Un pari `REJECTED` **libère son slot** (simplification (b), §6) **si la deadline
n'est pas passée**. Le joueur peut alors reproposer un pari sur la même cible
via un **nouveau** pari (l'ancien reste `REJECTED`, archivé — rétention D2), pas
en ré-éditant le pari refusé. Après deadline, la cible n'est plus sélectionnable
(§4) : rien à reproposer.

### 9.2 Re-ciblage interdit en édition — **acté (26/07/2026)**

En édition (`/play/bets/[id]/edit`), `scope`, `series_id` et `match_id` sont
**figés** — seuls énoncé / catégorie / difficulté changent. La cible définit le
slot consommé ; la changer reviendrait à migrer un slot, source d'incohérences
de quota. Pour viser une autre cible → créer un nouveau pari (soumis au quota).

---

## 10. Couche de lecture — contrats de types (esquisse, à figer)

```ts
// Contexte d'entrée résolu côté page serveur.
type NewBetContext =
  | { mode: 'FROM_MATCH'; matchId: string }   // raccourci Matchs (?matchId=)
  | { mode: 'FREE' };                          // hub Mes paris

type BetCategory =
  | 'PLAYER_PROP' | 'SCORE_TOTAL' | 'TEAM_PROP' | 'PERIOD' | 'HEAD_TO_HEAD'
  | 'PLAYING_TIME' | 'MULTI_PLAYER_COMBO' | 'GAME_EVENT' | 'FUN_OFF_COURT';

// Cadrage lu serveur pour armer le formulaire.
type BetFormBootstrap = {
  competition: { id: string; kind: 'PLAYOFFS' | 'NBA_CUP' };
  categories: { value: BetCategory; label: string }[];   // 9, libellés FR (§5.2)
  seriesOptions: SeriesOption[];                          // séries de la compétition
};

type SeriesOption = {
  seriesId: string;
  label: string;                 // « 1er tour — BOS vs MIA »
  team1Abbr: string; team2Abbr: string;
  seriesBetOpen: boolean;        // 1er match non commencé (deadline série)
  seriesSlotTaken: boolean;      // 1 pari SÉRIE actif déjà posé
  matchSlotsUsed: number;        // slots MATCH consommés (Playoffs : 0..3)
  matchOptions: MatchOption[];
};

type MatchOption = {
  matchId: string;
  gameNumber: number;            // 1..7
  label: string;                 // « Match 2 — 25/07 21:00 » (fuseau Europe/Paris)
  isIdentified: boolean;         // scheduled_at != null
  matchBetOpen: boolean;         // non commencé
  matchSlotTaken: boolean;       // pari actif déjà posé sur ce match
};

// Pari en édition (DRAFT ou SUBMITTED du joueur).
type EditableBet = {
  betId: string;
  status: 'DRAFT' | 'SUBMITTED';
  scope: 'SERIES' | 'MATCH';
  seriesId: string;
  matchId: string | null;
  description: string;
  proposedCategory: BetCategory;
  proposedDifficulty: 1 | 2 | 3 | 4 | 5;
};
```

Tous les booléens de disponibilité (`*Open`, `*SlotTaken`, `matchSlotsUsed`)
sont **calculés serveur** depuis la base ; le client ne fait que les afficher.

---

## 11. Écriture — server actions

```text
saveDraft(input)      : INSERT (nouveau) ou UPDATE (édition d'un DRAFT) → DRAFT.
submitBet(input)      : nouveau DRAFT→SUBMITTED, ou (ré)écriture d'un SUBMITTED.
                        Pose submitted_at à la 1re transition uniquement.
withdrawBet(betId)    : SUBMITTED → DRAFT (§9). Aucun changement de champ.
```

Gardes **recalculées depuis la base** dans chaque action (jamais depuis le
client, brief §4) :

```text
- propriétaire : user_id = auth.uid() (aussi porté par la RLS) ;
- statut : action cohérente avec l'état réel du pari (pas de submit d'un
  VALIDATED, pas de withdraw d'un DRAFT, etc.) ;
- deadline : la cible n'a pas commencé (bet_deadline_open / calcul TS unique) ;
- cible identifiée : scheduled_at non NULL pour un pari MATCH ;
- quota : COUNT serveur des slots consommés (table §6.3), scope + Playoffs/Cup ;
- portée/Cup : bet_scope=SERIES refusé si compétition NBA_CUP.
```

L'écriture illégale doit être vérifiée par le **nombre de lignes affectées**,
pas seulement l'absence d'erreur (piège RLS connu : un UPDATE dont la clause
`USING` ne matche aucune ligne réussit avec 0 ligne et `error=null`).

---

## 12. États vides et erreurs — libellés **exacts** (à figer)

```text
Aucune série ouverte au pari      : « Aucune série n'est ouverte au pari pour
                                     l'instant. »
Aucun match sélectionnable        : « Aucun match identifié et à venir dans
                                     cette série. »
Quota série atteint               : « Tu as déjà ton pari série sur cette
                                     série. »
Quota match atteint (Playoffs)    : « Tu as déjà 3 paris match sur cette série. »
Pari déjà posé sur ce match       : « Tu as déjà un pari sur ce match. »
Cible fermée (deadline passée)    : « Ce match a déjà commencé, le pari est
                                     fermé. » / « La série a déjà commencé. »
Énoncé vide à la soumission       : « Décris ton pari avant de le soumettre. »
Raccourci vers un match fermé     : « Ce match n'est plus ouvert au pari. »
```

Libellés actés tels quels (26/07/2026). Principe : jamais d'erreur technique
brute, toujours un message tokenisé et lisible.

---

## 13. Règles de rendu (T7 — non négociables)

```text
- CSS Modules colocalisés lisant EXCLUSIVEMENT les tokens sémantiques de
  app/tokens.css. Aucune valeur en dur.
- Composants serveur par défaut ; « use client » justifié feuille par feuille
  (ici : le formulaire).
- Next.js 16 : searchParams est une Promise (await) ; cookies() async.
- Fuseau d'affichage des horaires de match : Europe/Paris, explicite (même
  convention que Matchs / Mes pronos ; ne jamais se fier au fuseau machine).
- Logos de franchise sur les sélecteurs (série/match) via components/ui/
  TeamLogo.tsx (chemin déduit de l'abréviation, SVG servi `unoptimized`).
- CTA de soumission ≠ action secondaire (brouillon) : hiérarchie visuelle T7.
```

---

## 14. Hors périmètre de cet écran

```text
- Validation / résolution admin des paris (SUBMITTED→VALIDATED/REJECTED,
  →WON/LOST) : lot « écrans admin » (0.2.7 + 0.2.4 §10).
- Auto-validation à la deadline (SUBMITTED non revu → VALIDATED, 0.2.4 §5) :
  MÉCANISME SERVEUR (façon sealDeadlines), pas un écran.
- Révélation publique d'un pari ouvert (0.2.4 §9) : Matchs / Mes pronos
  (joueurs) + /bracket (public non connecté) — specs distinctes.
- Écran « Mes paris » (consultation, statuts, quotas globaux) : spec distincte.
```

---

## 15. Vérifications de dépôt — à lever **avant** la 1re ligne de code

```text
1. enforce_bet_transitions (migration #3) : la transition SUBMITTED→DRAFT
   (geste « retirer », §9) est-elle autorisée ? Si non → migration versionnée
   dédiée pour l'ajouter (contenu montré + confirmation avant db push).
2. bet_deadline_open : signature exacte et sémantique de la fonction (migration
   #3) OU du calcul TS de l'Accueil, pour réutiliser une source unique de
   deadline (§7), sans en réécrire une 3e.
3. Existence réelle des routes /play/bets/* (aujourd'hui inertes dans le hub
   Jouer temporaire) : les créer dans le groupe (app), gardées par proxy.ts.
4. TeamLogo : réutilisable tel quel sur des sélecteurs (déjà le cas sur
   Bracket/Matchs/Mes pronos) — vérifier le tier de taille voulu.
```

---

## 16. Récapitulatif des décisions actées (26/07/2026)

```text
Routes         : /play/bets/new (+ ?matchId=), /play/bets/[id]/edit.
Entrées        : raccourci Matchs + hub Mes paris (double), + édition.
Portée         : SÉRIE/MATCH (Playoffs) ; MATCH seul (NBA Cup, SÉRIE masquée).
Cible          : identifiée (scheduled_at non NULL) + non commencée.
Contenu        : énoncé + catégorie (9 fixes, C3) + difficulté (1-5) proposés.
Quota          : Playoffs 1 série + 3 match/série (≤1/match) ; Cup 1/match (≤7),
                 « 3/série » recalculé SERVEUR (index DB insuffisant).
Slot           : REJECTED libère TOUJOURS (b) ; CANCELLED libère ; reste consomme.
Deadline       : série = 1er match ; match = ce match ; heure connue, jamais live.
Actions        : Enregistrer brouillon / Soumettre / Revenir en brouillon.
Éditable       : DRAFT + SUBMITTED, avant deadline (RLS « self avant validation »).
Suppression    : AUCUNE (D2). « Retirer » = SUBMITTED→DRAFT.
Révélation §9  : hors de cet écran.

Points §16 confirmés (26/07/2026) : défauts de brouillon PLAYER_PROP/3 (§5.4) ;
re-ciblage figé en édition (§9.2) ; libellés exacts tels quels (§12).
DÉPENDANCE restante : whitelist SUBMITTED→DRAFT du trigger, à lever au pré-vol
(§15.1).
```
