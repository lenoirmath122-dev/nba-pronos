# NBA Pronos — SPEC TECHNIQUE T5 — SCORING V0.1

> **Nature** : fichier thématique T5 du découpage acté dans `SPEC_TECHNIQUE_V0.1.md`
> (§4). Couvre le **moteur de scoring idempotent** : dérivation de l'agrégat de
> série depuis les matchs, barèmes **Playoffs** et **NBA Cup**, neutralisation A2,
> les **déclencheurs** de recalcul, et la couture avec T4. Ne contient **aucun
> appel API** (→ T4, C-1), **aucun écran ni server action** (→ T6), **aucune
> policy RLS** (→ T3).
>
> **Dépend de** : T1 (colonnes de points, `generated`/CHECK≥0, agrégat série), T4
> (contrat « résultat changé → recalcul », §8). Réutilise des décisions closes :
> 0.2.5 (barème Playoffs), mécanique/barème NBA Cup (`decisions_nba_cup_*`), 0.2.4
> (cycle de vie des paris, résolution admin manuelle), 0.2.3 (cycle de vie des
> pronos match), 0.2.2 (bracket advancement-based), et le **Bloc A de
> PREP_SPEC_TECHNIQUE_V1** (A1 affichage, A2 série annulée, A3 affiche = paire non
> ordonnée au même slot).
>
> **Statut** : **VALIDÉ** avec l'utilisateur le 19/07/2026. Les 4 points qui étaient
> soumis à décision à la rédaction (frontière d'écriture `series.official_*`, chemin
> d'écriture d'une résolution admin de série, convention NULL/0, contrat T6 sur
> `validated_difficulty`) sont désormais **actés** (§12) et ont le même statut non
> rouvrable que les décisions de T1-T4. Prochaine spec : T6 (écrans + server actions
> + Realtime), qui consomme les colonnes de scoring et la convention §12.3.
>
> **Périmètre** : V1 complète, **Playoffs et NBA Cup**, dans le même moteur (une
> série NBA Cup est une série dégénérée à 1 match — T1 §3.4). T5 ne produit
> **aucune migration** (les colonnes existent déjà — T1) ; c'est du code
> applicatif pur, écrit après validation.

---

## 0. Résumé du chantier T5

```text
1. Rappel des invariants non négociables (P5/P6, sommer le score)        → §1
2. Deux natures de scoring : piloté-données vs piloté-admin              → §2
3. Le moteur PUR (lib/scoring/engine.ts) : signatures, aucune I/O        → §3
4. Dérivation de l'agrégat de série depuis les matchs (best-of-7 / Cup)  → §4
5. Barème MATCH (pronos) : vainqueur 10 + bonus d'écart                  → §5
6. Barème BRACKET Playoffs : vainqueur / score exact / affiche           → §6
7. Barème BRACKET NBA Cup : vainqueur / affiche (pas de score exact)     → §7
8. Barème PARIS : linéaire 5/10/15/20/25, résolution admin              → §8
9. Neutralisation A2 : série annulée + cascade jusqu'à décision admin    → §9
10. Orchestration & déclencheurs (recompute*, couture T4)               → §10
11. Plan de test T5                                                      → §11
12. Points soumis à validation (frontières C-2/C-3, convention NULL/0)  → §12
```

Rien à coder tant que T5 n'est pas validé.

---

## 1. Invariants non négociables (rappel du maître, §3.2)

| # | Invariant | Conséquence concrète en T5 |
|---|---|---|
| P5 | Recalcul **idempotent** | Chaque composante est **réécrite en entier** à chaque passe (jamais incrémentée). Rejouer *n* fois = même état. Les totaux (`points_awarded`) sont `generated`, jamais accumulés. |
| P6 | **Aucun point négatif** | Toute composante vaut un entier ≥ 0 ou `NULL` (non scoré). Absence = 0, annulé = 0, perdu = 0. La DB le garantit (CHECK≥0, T1 §6.2) ; le moteur ne s'appuie pas dessus, il ne produit jamais de négatif. |
| P8 | Ids internes uniquement | Le moteur ne lit **que** des ids internes et des données officielles figées. Il ne connaît pas Highlightly. |
| P10 | Prédiction figée intouchable | Le moteur écrit **uniquement** les colonnes de scoring (`*_points`, `is_*_correct`, `margin_diff`, `scored_at`). Il ne touche **jamais** `predicted_*`, ni le statut de la prédiction. |
| C-3 | Moteur **pur** | `lib/scoring/engine.ts` = entrées (données officielles + prédictions) → sorties (points). Aucune I/O, aucun appel API, aucun déclenchement de synchro. |

**Rappel A6 (source du score)** : `matches.home_score` / `away_score` (T1 §3.5) contiennent **déjà la somme** du tableau par quart-temps, effectuée par `lib/nba/client.ts` (C-1, T4 §3). **Le moteur lit ces totaux, il ne resomme rien et ne lit jamais un tableau brut** — la règle « sommer le tableau » vit entièrement côté C-1, en amont de T5.

---

## 2. Deux natures de scoring (à distinguer clairement)

Le barème a **une seule autorité** (le moteur pur, §3), mais **deux chemins de
déclenchement**, parce que deux sources d'entrée diffèrent :

```text
A. Scoring PILOTÉ PAR LES DONNÉES (automatique) — pronos match & bracket
   Entrée officielle = résultats de matchs synchronisés (T4).
   Déclencheur       = /api/sync/results détecte un changement (T4 §8),
                       ou le bouton admin « tout recalculer » (filet, synthèse §7).
   Concerne          = match_predictions, bracket_picks (+ agrégat de série §4).

B. Scoring PILOTÉ PAR L'ADMIN (résolution manuelle) — paris personnalisés
   Entrée officielle = la DÉCISION admin GAGNÉ/PERDU (0.2.4 §10, V1 = manuel).
   Déclencheur       = la server action de résolution admin (T6).
   Concerne          = bets uniquement.
```

Les deux chemins appellent les **mêmes fonctions pures** (§3) et respectent P5 :
réappliquer la même entrée produit le même résultat. Un pari n'est **pas** rescoré
par la synchro (aucune donnée API ne tranche un pari en V1) ; un prono/bracket
n'est **pas** rescoré par une action admin de résolution de pari. Le bouton
« tout recalculer » (filet de sécurité) rejoue **A** intégralement, et peut aussi
rejouer **B** à partir des statuts de paris déjà figés (idempotent des deux côtés).

---

## 3. Le moteur pur (`lib/scoring/engine.ts`)

Fonctions **pures** (aucune I/O). L'orchestration (lecture/écriture DB,
transactions, déclencheurs) vit en §10, jamais ici (C-3).

```ts
// ── Types d'entrée (vues figées, déjà lues en amont ; ids internes only) ──────

/** Résultat officiel figé d'un match (scores DÉJÀ sommés par C-1). */
type OfficialMatch = {
  id: string;
  status: MatchStatus;                 // 'SCHEDULED'|'IN_PROGRESS'|'FINISHED'|'POSTPONED'|'CANCELLED'
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;            // total sommé (T1 §3.5)
  awayScore: number | null;
};

/** Agrégat officiel d'une série, DÉRIVÉ des matchs (§4). */
type SeriesOutcome = {
  status: SeriesStatus;                // 'SCHEDULED'|'IN_PROGRESS'|'FINISHED'|'POSTPONED'|'CANCELLED'
  winnerTeamId: string | null;
  scoreFormat: SeriesFormat | null;    // '4-0'|'4-1'|'4-2'|'4-3' ; NULL en Cup
};

// ── Sorties (colonnes de scoring à persister, écrites EN ENTIER — P5) ─────────

type MatchPredictionScore = {
  isWinnerCorrect: boolean | null;     // NULL = non scoré / neutralisé
  marginDiff: number | null;
  winnerPoints: number | null;         // ≥ 0
  marginBonusPoints: number | null;    // ≥ 0
};

type BracketPickScore = {
  isWinnerCorrect: boolean | null;
  isScoreExact: boolean | null;        // toujours NULL en Cup (pas de score exact)
  isMatchupCorrect: boolean | null;
  winnerPoints: number | null;         // ≥ 0
  exactScorePoints: number | null;     // toujours NULL en Cup
  matchupPoints: number | null;        // ≥ 0
};

type BetScore = { pointsAwarded: number | null }; // ≥ 0

// ── Dérivation & scoring (toutes pures) ───────────────────────────────────────

/** §4 — agrégat de série depuis SES propres matchs (best-of-7 ou 1 match Cup). */
function deriveSeriesOutcome(
  matches: OfficialMatch[],
  competitionType: CompetitionType,    // 'PLAYOFFS' | 'NBA_CUP'
): SeriesOutcome;

/** §5 — prono match. */
function scoreMatchPrediction(
  prediction: { predictedWinnerTeamId: string | null; predictedMargin: number | null; isFrozen: boolean },
  match: OfficialMatch,
): MatchPredictionScore;

/** §6/§7 — pick de bracket. `round` porte le tour ; `predictedPair`/`officialPair`
 *  servent l'affiche ; `officialPair` peut être incomplète (upstream non résolu). */
function scoreBracketPick(
  pick: { predictedWinnerTeamId: string | null; predictedScoreFormat: SeriesFormat | null },
  round: PlayoffRound,                 // 'ROUND_1'|'CONF_SEMIS'|'CONF_FINALS'|'NBA_FINALS'|'CUP_QUARTERS'|'CUP_SEMIS'|'CUP_FINAL'
  outcome: SeriesOutcome,
  predictedPair: { a: string | null; b: string | null }, // paire routée par le joueur (§6.3)
  officialPair:  { a: string | null; b: string | null }, // series.team1_id / team2_id
): BracketPickScore;

/** §8 — pari, depuis son statut figé + difficulté validée. */
function scoreBet(
  bet: { status: BetStatus; validatedDifficulty: number | null },
): BetScore;
```

**Pourquoi des fonctions séparées et non un gros `recompute` pur** : la pureté et
la testabilité. Chaque fonction se teste sur des cas de table (§11) sans base.
L'orchestration (qui lit quoi, écrit quoi, dans quelle transaction) est un
adaptateur autour d'elles (§10).

---

## 4. Dérivation de l'agrégat de série (`deriveSeriesOutcome`)

L'API ne fournit **que des matchs** (branche B, T4 §5). Le **vainqueur / format /
statut** d'une série sont donc **dérivés de ses matchs** (T4 §5.3). Règle :

```text
PLAYOFFS (best-of-7) :
  wins[teamX] = nombre de matchs FINISHED où teamX a le plus grand total sommé.
  - Un CLINCH survient dès qu'une équipe atteint 4 victoires.
  - winnerTeamId  = l'équipe à 4 victoires (sinon NULL).
  - scoreFormat   = '4-' || wins[perdant]  (perdant = l'autre équipe de la série)
                    → 4-0 / 4-1 / 4-2 / 4-3. NULL tant que pas de clinch.
  - status        = FINISHED si clinch ; sinon IN_PROGRESS si ≥1 match FINISHED ;
                    sinon SCHEDULED. (POSTPONED/CANCELLED : voir ci-dessous.)

NBA CUP (série = 1 match) :
  - winnerTeamId  = vainqueur de l'unique match si FINISHED, sinon NULL.
  - scoreFormat   = NULL (jamais de score exact en Cup).
  - status        = statut de l'unique match, mappé 1:1.
```

Précisions :

- **NBA ne connaît pas le nul** (prolongations jusqu'à décision) → `homeScore ≠
  awayScore` sur tout match FINISHED. Le moteur n'a pas de cas d'égalité à gérer ;
  il journalise une anomalie (et neutralise le match) si l'entrée le contredit.
- **Matchs non FINISHED ignorés** dans le comptage des victoires (seul un match
  terminé compte pour le clinch).
- **CANCELLED / POSTPONED de série** : la synchro n'invente pas ces statuts (elle
  n'a que des matchs) ; ils sont posés par l'admin (0.2.7) ou dérivés d'une
  cascade (§9). `deriveSeriesOutcome` **respecte un statut CANCELLED/POSTPONED
  déjà présent** en le renvoyant tel quel (elle ne le réécrit pas à partir des
  matchs) — c'est la porte d'entrée de la neutralisation A2 (§9). **Précision
  d'implémentation, §13.1** : dans le code réel, ce respect n'est pas porté
  par cette fonction elle-même (dont la signature `(matches, competitionType)`
  ne reçoit même pas le statut actuel) mais par son appelant.

> **Frontière d'écriture (actée §12.1)** : `deriveSeriesOutcome` est **pure** (elle
> *calcule* l'agrégat). L'**écriture** de `series.official_*` reste dans `lib/sync`
> (C-2 intact), via le writer partagé `writeSeriesOutcome` (§10.1) ; l'orchestration
> T5 n'écrit **jamais** `series`, seulement les colonnes de scoring des tables de
> prédiction.

---

## 5. Barème MATCH — pronos (`scoreMatchPrediction`)

Identique **Playoffs et NBA Cup** (mécanique Cup §5 : réutilisation à l'identique).

```text
Condition de scoring : la prédiction est FIGÉE (VALIDATED ou LOCKED) ET complète
  (predictedWinnerTeamId ET predictedMargin non NULL) ET le match est FINISHED.
  Sinon → absence : toutes colonnes NULL (0 au total, aucune pénalité — synthèse §5).

Si match CANCELLED → neutralisé : winnerPoints=0, marginBonusPoints=0,
  isWinnerCorrect=NULL, marginDiff=NULL (0 pour tous, aucune pénalité — synthèse §5).

Si match FINISHED (both scores présents) :
  actualWinner  = équipe au plus grand total sommé.
  actualMargin  = |homeScore − awayScore|            (≥ 1, jamais nul).
  isWinnerCorrect = (predictedWinnerTeamId == actualWinner).

  Si isWinnerCorrect :
    winnerPoints  = 10                                (fixe, tous tours — 0.2.5 §2).
    marginDiff    = |predictedMargin − actualMargin|.
    marginBonusPoints = palier(marginDiff) :
        marginDiff == 0        → 5
        marginDiff 1..2        → 3
        marginDiff 3..5        → 2
        marginDiff 6..9        → 1
        marginDiff ≥ 10        → 0
  Sinon (mauvais vainqueur) :
    winnerPoints = 0 ; marginBonusPoints = 0 ; marginDiff = NULL   (ni base ni bonus).
```

Un prono correct rapporte **10 à 15** points ; le bonus d'écart n'existe **que**
si le vainqueur est correct (0.2.5 §2).

---

## 6. Barème BRACKET — Playoffs (`scoreBracketPick`)

Trois composantes **indépendantes et cumulables** (0.2.5 §7), scorées contre
l'**agrégat officiel de série** (§4), en modèle **advancement-based** (0.2.5 §3 :
indépendant de l'adversaire réellement rencontré).

### 6.1 Barème chiffré (0.2.5 §4/§5/§6 — synthèse §7)

| Tour (`round`) | Vainqueur | Score exact | Affiche |
|---|---|---|---|
| `ROUND_1` | 25 | +10 | +0 |
| `CONF_SEMIS` | 45 | +20 | +15 |
| `CONF_FINALS` | 80 | +30 | +25 |
| `NBA_FINALS` (= champion) | 250 | +50 | +40 |

Finale NBA parfaite = 250 + 50 + 40 = **340** (0.2.5 §7). Pas de bonus champion
séparé (fusionné dans la finale, 0.2.5 §3).

### 6.2 Règles par composante

```text
Condition préalable : série FINISHED avec winnerTeamId connu (sinon voir §6.4).

VAINQUEUR :
  isWinnerCorrect = (pick.predictedWinnerTeamId == outcome.winnerTeamId).
  winnerPoints    = isWinnerCorrect ? valeurVainqueur(round) : 0.
  (Indépendant de l'adversaire : on compare au vainqueur OFFICIEL, point.)

SCORE EXACT (Playoffs uniquement) :
  isScoreExact    = isWinnerCorrect
                    AND pick.predictedScoreFormat == outcome.scoreFormat.
  exactScorePoints = isScoreExact ? valeurScoreExact(round) : 0.
  (Bonus uniquement si vainqueur correct ET format réel exact — 0.2.5 §5.)

AFFICHE :
  Pas d'affiche au 1er tour (matchups connus) → ROUND_1 : matchupPoints = 0,
  isMatchupCorrect = false.
  Sinon (§6.3) : isMatchupCorrect = paires ÉGALES en NON-ORDONNÉ (A3), au même
  slot (structurellement garanti par l'arbre, A3).
  matchupPoints = isMatchupCorrect ? valeurAffiche(round) : 0.
  (Orthogonal au vainqueur : bonne affiche + mauvais vainqueur possible, et
   l'inverse — 0.2.5 §6.)

scored_at = horodatage de la passe (sur les composantes effectivement scorées).
```

### 6.3 Paire prédite vs paire officielle (affiche)

L'affiche compare **deux paires d'équipes** :

```text
Paire OFFICIELLE de la série S = { S.team1_id, S.team2_id }  (les vraies équipes,
  remplies par sync/admin au fur et à mesure que le vrai bracket avance).

Paire PRÉDITE de la série S (tour > feuille) = les vainqueurs que LE JOUEUR a
  désignés dans les DEUX séries qui alimentent S via la cascade d'avancement
  (T1 §3.4 : next_series_id / next_series_slot) :
    feeders = { F : F.next_series_id == S.id }, placés par F.next_series_slot ∈ {1,2}.
    paire prédite = { pick(F_slot1).predictedWinnerTeamId,
                      pick(F_slot2).predictedWinnerTeamId }.
```

Comparaison **non ordonnée** (A3 : `A-B == B-A`). Comme le bracket est
advancement-based **sans reseeding**, une paire donnée ne peut apparaître qu'à
**un seul slot** d'un tour donné → paire ⇔ (paire + slot), pas d'ambiguïté (A3).

Cas limites :
- Un feeder sans pick (le joueur n'a pas prédit cette série amont) → paire prédite
  **incomplète** → affiche = 0 (le joueur n'a pas routé de paire complète).
- Paire officielle **incomplète** (une équipe pas encore avancée / branche non
  résolue) → affiche **en attente** (NULL, pas 0) : elle sera scorée quand la
  paire officielle sera connue (§6.4).

### 6.4 États non terminaux (en attente vs neutralisé)

```text
Série SCHEDULED / IN_PROGRESS / POSTPONED  → composantes NON scorées : NULL,
  scored_at NULL. Elles seront (re)calculées à la résolution. (En attente ≠ 0.)

Série CANCELLED                            → NEUTRALISÉE (§9) : winnerPoints=0,
  exactScorePoints=0, matchupPoints=0 ; flags NULL ; scored_at posé. (0 pour tous.)
```

La distinction **NULL (en attente)** vs **0 (scoré-zéro / neutralisé)** est une
convention **actée** (§12.3) : elle alimente l'affichage A1 en T6 (`-` si aucune
participation, `0` si participé mais 0 point), sans impact sur les totaux (les deux
se somment à 0 via coalesce — T1 §6.1).

---

## 7. Barème BRACKET — NBA Cup (`scoreBracketPick`, variante)

Le mini-bracket Cup réutilise **2 des 3 composantes** ; le **score exact
disparaît** (aucune série, rien à prédire — mécanique Cup §3).

### 7.1 Barème chiffré (mécanique Cup §4)

| Tour (`round`) | Vainqueur | Affiche |
|---|---|---|
| `CUP_QUARTERS` | 20 | +0 |
| `CUP_SEMIS` | 50 | +15 |
| `CUP_FINAL` (= champion) | 150 | +25 |

Bracket Cup « parfait » = 4×20 + 2×50 + 2×15 + 150 + 25 = **385** (mécanique Cup §4).

### 7.2 Différences avec Playoffs

```text
- SCORE EXACT : SUPPRIMÉ. isScoreExact = NULL, exactScorePoints = NULL toujours.
  (predicted_score_format et official_score_format sont NULL en Cup — T1 §3.4/§3.8.)
- VAINQUEUR : identique (advancement-based, comparé au vainqueur officiel).
  L'agrégat de série Cup = le vainqueur de l'unique match (§4).
- AFFICHE : identique dans le principe. Pas d'affiche aux quarts (affiches connues
  dès l'ouverture, comme ROUND_1) → CUP_QUARTERS : matchupPoints = 0.
  La paire prédite se dérive de la même cascade (§6.3).
```

Le moteur route Playoffs vs Cup par le `round` (préfixe `CUP_`) et par
`competitionType` — mêmes signatures, tables de barème distinctes.

---

## 8. Barème PARIS personnalisés (`scoreBet`)

Résolution **manuelle admin** en V1 (0.2.4 §10) ; le moteur ne fait que **mapper
un statut figé + la difficulté validée → points**. Idempotent (réappliquer le même
statut = mêmes points).

```text
Barème (linéaire, 0.2.5 §8 — synthèse §7) : niveau → points
  1 → 5 | 2 → 10 | 3 → 15 | 4 → 20 | 5 → 25.

scoreBet(status, validatedDifficulty) :
  WON        → pointsAwarded = bareme(validatedDifficulty).   (difficulté VALIDÉE fait foi — 0.2.4 §7)
  LOST       → pointsAwarded = 0.
  CANCELLED  → pointsAwarded = 0.                              (neutralisé, 0, aucune pénalité — 0.2.4 §4)
  DRAFT | SUBMITTED | VALIDATED | REJECTED → pointsAwarded = NULL.  (non résolu / hors jeu → non scoré)
```

Notes :

- **Portée identique Playoffs / Cup** (Cup : scope MATCH uniquement — mécanique
  Cup §6 — mais le scoring ne dépend pas du scope, seulement du statut + difficulté).
- **`validatedDifficulty` requis pour un pari résolu** : un pari `WON` doit avoir
  `validated_difficulty` non NULL. L'auto-validation (0.2.4 §5 : SOUMIS non revu à
  la deadline → validé à la difficulté proposée) **doit** poser
  `validated_difficulty = proposed_difficulty` **côté T6** (action de
  verrouillage), afin que le barème ait une valeur. Le moteur **lit
  `validated_difficulty`** et ne « retombe » **pas** silencieusement sur
  `proposed_difficulty` — un `WON` sans `validated_difficulty` est une **anomalie
  journalisée**, pas un cas nominal (garde « validé fait foi » propre). **Contrat T6
  acté** (§12.4) : l'auto-validation pose `validated_difficulty = proposed_difficulty`.
- Le moteur **ne libère pas** le slot de quota d'un pari ANNULÉ (0.2.4 §6) : c'est
  un effet de workflow (T6), pas du scoring.

---

## 9. Neutralisation A2 — série annulée / cascade

A2 (confirmé) : sur la série elle-même, **neutralisée, 0 pour tous** ; sur les
tours dépendants, **cascade jusqu'à décision admin manuelle et journalisée**.

### 9.1 Sur la série annulée elle-même

```text
outcome.status == CANCELLED  →  pour CHAQUE pick de cette série :
  winnerPoints = 0, exactScorePoints = 0 (Playoffs) / NULL (Cup), matchupPoints = 0 ;
  isWinnerCorrect / isScoreExact / isMatchupCorrect = NULL ; scored_at posé.
Idem paris de série (§8, CANCELLED → 0) et pronos des matchs annulés (§5, CANCELLED → 0).
Aucune pénalité, jamais (P6).
```

### 9.2 Cascade sur les tours dépendants — mécanisme

Le point clé : **le moteur score contre des données officielles ; il n'invente
jamais une avancée**. La cascade A2 est donc une **conséquence naturelle** de
données officielles incomplètes, pas un algorithme de graphe spécial :

```text
Si S est CANCELLED, l'équipe qui aurait dû « avancer » de S vers la série aval D
n'existe pas. Tant que l'admin n'a pas tranché (A2 : désigner manuellement qui
avance) :
  - la paire OFFICIELLE de D reste incomplète (un slot NULL) ;
  - donc l'affiche de D est EN ATTENTE (NULL, §6.3/§6.4), jamais un faux 0 ;
  - le vainqueur de D ne se score que si D se joue réellement et produit un
    winnerTeamId officiel (sinon D reste SCHEDULED → non scoré).
=> Aucun point fantôme n'est jamais attribué à partir d'une branche neutralisée.

Quand l'admin résout manuellement (décision JOURNALISÉE, A2) en renseignant les
données officielles aval (paire et/ou vainqueur de D), le moteur — étant pur et
scorant contre l'officiel — reprend le scoring normal de D SANS logique spéciale.
```

Autrement dit : **la neutralisation en cascade = "ne pas scorer ce qui dépend
d'une donnée officielle absente"**, et la **sortie de cascade = l'admin complète
la donnée officielle**. Le moteur n'a besoin d'aucun état "neutralisé" propagé :
il lui suffit de traiter `CANCELLED → 0` (§9.1) et `officiel incomplet → NULL/en
attente` (§6.4). C'est robuste, idempotent, et fidèle à A2.

> **Frontière d'écriture (actée §12.2)** de la résolution admin (poser
> `official_status = CANCELLED`, ou renseigner la paire/vainqueur aval) : c'est une
> **écriture sur `series`**, routée via le writer partagé `writeSeriesOutcome` de
> `lib/sync` (C-2 intact) ; l'action admin (T6) l'appelle puis déclenche
> `recomputeSeries`. Toute résolution A2 reste **journalisée** (0.2.7).

---

## 10. Orchestration & déclencheurs (`lib/scoring/recompute.ts`)

Adaptateur **impur** autour du moteur pur (§3) : il lit les données figées, appelle
les fonctions pures, et **écrit uniquement les colonnes de scoring** (P10). Il
tourne en contexte système (`service_role`) car déclenché par la synchro, une
action admin, ou le filet de sécurité — jamais par une action joueur (P2).

### 10.1 Granularité proposée (finalise le point ouvert GAPS)

```ts
// Un match a changé (couture T4 §8) : score ses pronos, re-dérive sa série,
// score les picks de cette série.
async function recomputeMatch(matchId: string): Promise<void>;

// Une série a changé (agrégat re-dérivé, ou paire officielle complétée, ou
// résolution A2) : score tous les picks de cette série.
async function recomputeSeries(seriesId: string): Promise<void>;

// Un pari a été résolu par l'admin (chemin B, §2).
async function recomputeBet(betId: string): Promise<void>;

// Filet de sécurité admin (synthèse §7) : rejoue TOUT le barème d'une compétition.
async function recomputeCompetition(competitionId: string): Promise<void>;
```

Chaîne pilotée-données (chemin A) déclenchée par `recomputeMatch` :

```text
recomputeMatch(m) :
  1. lit m (officiel figé) + les pronos FIGÉS de m → scoreMatchPrediction → écrit.
  2. re-dérive l'agrégat de la série parente (deriveSeriesOutcome sur SES matchs).
  3. si l'agrégat a CHANGÉ → lib/sync.writeSeriesOutcome écrit series.official_*
     (C-2, §12.1) puis recomputeSeries(série parente).
recomputeSeries(s) :
  4. lit s (officiel) + tous les picks de s + les picks feeders (paire prédite §6.3)
     + la paire officielle de s → scoreBracketPick → écrit les picks de s.
```

Propagation aval : quand la **paire officielle** d'une série aval D est complétée
(vraie équipe qui avance, écrite par `lib/sync.writeSeriesOutcome`), cette écriture
sur `series` déclenche `recomputeSeries(D)` — l'affiche de D passe alors d'« en
attente » à scorée. La propagation suit `next_series_id` **d'un cran**, pilotée par
un **changement réel de donnée** (pas de récursion aveugle).

> **Un seul écrivain de `series` (C-2, acté §12.1/§12.2)** : `writeSeriesOutcome`
> vit dans `lib/sync` et est le **point d'écriture unique** de `series.official_*`,
> qu'il soit appelé par la synchro (agrégat re-dérivé) ou par une action admin
> (override/résolution A2). L'orchestration de scoring T5 n'écrit que les colonnes
> de scoring des tables de prédiction (`bracket_picks`, `match_predictions`,
> `bets`) — jamais `series`, `matches` ou `teams`.

### 10.2 Idempotence de l'orchestration (P5)

```text
- Chaque colonne de scoring est réécrite EN ENTIER à chaque passe (UPDATE, jamais
  d'incrément). points_awarded est generated → recalculé, jamais accumulé (T1 §6.3).
- Rejouer recomputeMatch / recomputeSeries / recomputeCompetition sur le même état
  officiel produit exactement les mêmes lignes. Aucune notion de "delta" persistée.
- recomputeCompetition parcourt toutes les séries et tous les matchs dans un ordre
  quelconque : le résultat ne dépend pas de l'ordre (chaque entité score contre
  l'officiel figé au moment de la passe), donc il reste idempotent.
```

### 10.3 Couture avec T4 (contrat §8 de T4)

```text
T4 garantit : matches.home_score/away_score (sommés), matches.status, et la
  DÉTECTION « a changé ». Sur changement, /api/sync/results appelle DIRECTEMENT
  recomputeMatch(matchId) dans la MÊME transaction (T4 §8, acté).
T5 fournit : recomputeMatch et la cascade décrite ci-dessus.
Rien n'a changé → aucune passe (on ne rejoue pas pour rien — T4 §8).
```

Transaction : la lecture officielle, l'appel au moteur pur et l'écriture des
colonnes de scoring (et de `series.official_*` si l'agrégat change — §12.1) sont
dans **une seule transaction**, pour ne jamais laisser un état partiellement scoré
visible (cohérence avec l'invariant D4 « tout point n'existe que sur une ligne déjà
publique », T3).

---

## 11. Plan de test T5

Le moteur pur (§3) se teste **sans base**, sur cas de table. L'orchestration (§10)
se teste en base de test.

```text
MOTEUR PUR — deriveSeriesOutcome (§4)
1.  4 matchs FINISHED, 4-0 → status FINISHED, winner = vainqueur, format '4-0'.
2.  Série 3-3 puis match 7 → clinch, format '4-3'.
3.  Série 3-2 (5 joués) → IN_PROGRESS, winner NULL, format NULL.
4.  Cup (1 match FINISHED) → FINISHED, winner = vainqueur du match, format NULL.
5.  Statut CANCELLED déjà présent en entrée → renvoyé tel quel (pas réécrit §4).
    Testé via recomputeMatch, pas deriveSeriesOutcome directement — voir §13.

MOTEUR PUR — scoreMatchPrediction (§5)
6.  Bon vainqueur + écart exact → 10 + 5 = 15.
7.  Bon vainqueur + marginDiff 4 → 10 + 2 = 12.
8.  Bon vainqueur + marginDiff 12 → 10 + 0 = 10.
9.  Mauvais vainqueur → 0 (ni base ni bonus, marginDiff NULL).
10. Match CANCELLED → neutralisé : 0/0, flags NULL.
11. Prédiction non figée / partielle → absence : tout NULL.

MOTEUR PUR — scoreBracketPick Playoffs (§6)
12. CONF_FINALS, vainqueur OK, format OK, affiche OK → 80 + 30 + 25 = 135.
13. NBA_FINALS parfaite → 250 + 50 + 40 = 340.
14. Vainqueur OK, format faux → vainqueur seul (score exact = 0).
15. Affiche OK, vainqueur faux → affiche seule (orthogonalité, §6.2).
16. ROUND_1 → affiche = 0 (matchups connus).
17. Paire prédite incomplète (feeder sans pick) → affiche = 0.
18. Paire officielle incomplète → affiche NULL (en attente, pas 0).
19. Comparaison d'affiche non ordonnée : {A,B} vs {B,A} → correct (A3).

MOTEUR PUR — scoreBracketPick NBA Cup (§7)
20. CUP_SEMIS, vainqueur OK, affiche OK → 50 + 15 = 65 ; score exact NULL.
21. CUP_FINAL vainqueur OK → 150 ; CUP_QUARTERS affiche = 0.

MOTEUR PUR — scoreBet (§8)
22. WON niveau 5 → 25 ; WON niveau 1 → 5.
23. LOST → 0 ; CANCELLED → 0 ; VALIDATED/SUBMITTED/DRAFT/REJECTED → NULL.
24. WON sans validated_difficulty → anomalie journalisée (pas un total inventé).

A2 — cascade (§9)
25. Série CANCELLED → tous ses picks à 0, flags NULL, aucune pénalité.
26. Série amont CANCELLED, aval non résolu → affiche aval EN ATTENTE (NULL),
    aucun point fantôme.
27. Admin résout l'aval (paire renseignée) → recomputeSeries aval score
    normalement, sans code spécial.

IDEMPOTENCE & ORCHESTRATION (§10, en base)
28. recomputeMatch deux fois de suite → colonnes identiques (P5).
29. recomputeCompetition deux fois → état identique ; ordre de parcours sans effet.
30. Passe de recalcul : predicted_* jamais modifié (P10).
31. Aucune colonne de points négative nulle part (P6) — vérif transverse.
32. Match FINISHED→recompute→puis correction admin d'un prono (0.2.3 §7) →
    recomputeMatch rescore uniquement ce prono, idempotent.
```

**Couverture réelle (28/07/2026)** : cas 1-4 et 6-27 dans `lib/scoring/
engine.test.ts` (moteur pur). Cas 5, 28, 29 (variante directe), 31 dans
`lib/scoring/recompute.test.ts` (orchestration, contre une fake DB en
mémoire — pas une vraie instance Supabase, voir tête de fichier). Cas 30 et
32 pas couverts par un test dédié à ce jour (30 découle structurellement du
fait que `recompute.ts` n'écrit jamais `predicted_*`, vérifiable par lecture
du code ; 32 nécessiterait un scénario de correction admin complet, hors
périmètre de ce lot).

---

## 12. Décisions actées à la validation de T5 (19/07/2026)

Les 4 points ouverts à la rédaction sont tranchés (recommandations suivies). Ils ont
désormais le même statut non rouvrable que les décisions de T1-T4.

### 12.1 Frontière C-2 : `series.official_*` écrit par `lib/sync`

`deriveSeriesOutcome` (T5) **calcule** l'agrégat ; **l'écriture** de
`series.official_status / official_winner_team_id / official_score_format` reste
**dans `lib/sync`** via un writer unique `writeSeriesOutcome` — **C-2 intact**
(lib/sync seul écrivain de `series/matches/teams`). L'orchestration de scoring T5
n'écrit **que** les colonnes de scoring des tables de prédiction (`bracket_picks`,
`match_predictions`, `bets`), jamais `series`. **Acté.**

### 12.2 Résolution admin de série (A2) via le writer partagé

Les écritures admin sur `series` (poser `CANCELLED`, désigner l'équipe qui avance,
A2) passent par le **même** `writeSeriesOutcome` de `lib/sync` (pas d'exception à
C-2). L'action admin (T6) l'appelle, puis déclenche `recomputeSeries`. Toute
résolution A2 reste **journalisée** (0.2.7). **Acté.**

### 12.3 Convention NULL (en attente) vs 0 (scoré-zéro / neutralisé)

Le moteur distingue **NULL = non scoré / en attente** et **0 = scoré, zéro point**
(mauvais pick, ou série neutralisée). Les deux se somment à 0 dans `user_scores`
(coalesce, T1 §6.1) → **aucun impact sur les totaux**. La distinction est le pivot
de l'affichage **A1** en T6 (`-` si aucune participation à la source, `0` si
participé mais 0 point). **Acté.**

### 12.4 Contrat T6 sur `validated_difficulty` des paris auto-validés

L'**auto-validation** d'un pari (0.2.4 §5) **pose `validated_difficulty =
proposed_difficulty`** côté T6. Le moteur lit **`validated_difficulty`** sans
retomber sur `proposed_difficulty` ; un `WON` sans `validated_difficulty` est une
**anomalie journalisée** (garde « validé fait foi » propre). **Acté.**

---

**T5 est VALIDÉ et figé.** T5 ne produit **aucune migration** (les colonnes existent
déjà — T1) ; c'est du code applicatif pur, écrit après ce feu vert (portage du
moteur proto vérifié — D3 — réécrit proprement autour des signatures du §3,
TypeScript strict, commentaires FR, noms EN). Prochaine spec : **T6** (arborescence
`app/`, server actions, Realtime, garde-fou de saisie C2), qui **consomme** les
colonnes de scoring et la convention §12.3, et implémente le writer partagé
`writeSeriesOutcome` (§12.1/§12.2) côté `lib/sync` (spécifié en T4, réutilisé ici).

---

## 13. Correctif post-audit (28/07/2026) — garde CANCELLED/POSTPONED : orchestration, pas fonction pure

### 13.1 Constat

Audit structurel du 28/07/2026 (`GAPS_OUVERTS.md`) : la lettre du §4
attribue le respect d'un statut `CANCELLED`/`POSTPONED` déjà posé à
`deriveSeriesOutcome` elle-même (« la renvoyant tel quel »). Dans
l'implémentation réelle (`lib/scoring/engine.ts`), `deriveSeriesOutcome` a
la signature stricte `(matches, competitionType)` du §3 — elle ne reçoit
**jamais** le statut actuellement en base, donc ne peut structurellement
rien « respecter » : rester pure au sens C-3 (aucune connaissance de l'état
persisté) l'en empêche par construction.

### 13.2 Où vit réellement le garde-fou

Dans `lib/scoring/recompute.ts` (`recomputeMatch`), AVANT tout appel à
`deriveSeriesOutcome` :

```text
if (ADMIN_LOCKED_STATUSES.has(seriesRow.official_status)) {   // {"CANCELLED", "POSTPONED"}
  await recomputeSeries(seriesRow.id);   // rescore les picks contre l'état existant
  return;                                 // deriveSeriesOutcome n'est jamais appelée
}
```

`deriveSeriesOutcome` n'est donc pas « appelée puis son résultat ignoré » —
elle n'est **jamais invoquée du tout** quand la série est verrouillée par un
admin. Le comportement produit (un statut CANCELLED/POSTPONED n'est jamais
écrasé par une dérivation depuis les matchs) est conforme à l'intention du
§4 ; seul l'endroit où vit la garantie diffère de sa description littérale.

### 13.3 Décision

**Pas un bug, pas une correction de code à faire** : la localisation dans
l'orchestration est la seule cohérente avec C-3 (le moteur pur ne doit rien
savoir de l'état persisté) et était déjà documentée en commentaire dans le
code (`engine.ts`, tête de `deriveSeriesOutcome` ; `recompute.ts`, commentaire
au-dessus de `ADMIN_LOCKED_STATUSES`) — ce n'était donc pas un écart
silencieux, mais un écart entre la prose du §4 et l'implémentation qui
n'avait jamais été rétro-acté ici. **Acté** : le §4 décrit l'intention
produit, ce §13 fait foi pour l'implémentation réelle. Testé explicitement
(cas 5 du plan §11) dans `lib/scoring/recompute.test.ts`.

**T5 reste VALIDÉ et figé** — ce §13 est un rattrapage documentaire, pas une
réouverture de décision.
