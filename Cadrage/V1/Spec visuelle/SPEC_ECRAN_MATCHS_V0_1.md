# NBA Pronos — SPEC ÉCRAN MATCHS V0.1

> **Statut** : **close** — les 4 points ouverts ont été tranchés le 23/07/2026 (§18). Une
> seule contrainte est transmise au lot suivant (« Mes pronos », §17), aucune ne bloque
> l'implémentation de cet écran. Rédigée et close le 23/07/2026, phase V1 propre.
> Amendée à l'usage réel le 25/07/2026 (§20) : l'entête replié perd son logo,
> refondu en split neutre deux abréviations. Amendée à nouveau le 27/07/2026
> (§21) : le dialogue de validation devient à deux variantes selon que le
> brouillon local est enregistré ou non.
> **Portée** : l'écran **Matchs** du hub Jouer (`/play/matches`) — la fenêtre de **saisie**
> des pronos match par match. Les écrans « Mes pronos », « Paris » et « Bracket personnel »
> du même hub sont hors périmètre (lots ultérieurs, un écran à la fois).
> **Décisions prises le 23/07/2026** : §6 (saisie de l'écart), §3 (vue repliée et
> multi-ouverture), §10 (indicateur du raccourci pari).

## 0. Sources et cadre

| Sujet | Source | Ce qu'elle impose |
|---|---|---|
| Fenêtre, contenu, cycle de vie | 0.2.3 §1-5 | 3 jours glissants, matchs bien identifiés, plus proche en premier ; vainqueur + écart indissociables ; brouillon → validé (irréversible) → verrouillé |
| Écart | 0.2.3 §3 + synthèse §5 | entier, bornes **1 à 50**, pavé numérique, scoring de proximité |
| Visibilité | 0.2.3 §9 | « valider = voir » ; compteur X/N permanent ; détail nominatif conditionné avant le coup d'envoi |
| Carte de match, « Tout valider » | 0.2.9 §4 | 4 statuts lisibles d'un coup d'œil ; bandeau conditionné aux brouillons complets |
| Raccourci pari | 0.2.9 §12 | entrée **secondaire**, visuellement distincte du CTA de validation |
| Quotas de paris | 0.2.4 §2 + §6 · Cup §6 | Playoffs : 3 paris MATCH par série, 1 max par match · Cup : 1 par match |
| Statuts de prono (couleurs) | T7 §15.5 | rampe neutre, hors vert et hors or ; seul `validé` porte l'accent |
| Vainqueur au tap | T7 §15.8 | l'affrontement est le sélecteur, pas deux boutons segmentés |
| Server actions | T6b §3.1 + §4 | `saveMatchPredictionDraft` / `validateMatchPrediction` / `validateAllCompleteMatchPredictions` ; garde C2 |
| Live et Realtime | T6c §2.2 + §10 + §14.1 | souscription `matches` uniquement ; révélation des pronos d'autrui **non** temps réel |
| Absents | T6c §6.1 | compteur neutre « X n'ont pas joué », dépliable |

**Conventions** : TypeScript strict, composants serveur par défaut, commentaires FR, noms de
code EN, styles **exclusivement** via les tokens de `app/tokens.css`.

---

## 1. Architecture

```text
app/(app)/play/matches/page.tsx   → écran Matchs (serveur). Sous le groupe (app),
                                     donc nav 4 onglets + garde de session héritées.
lib/queries/matches.ts            → lecture (contrats figés §13).
lib/actions/matches.ts            → server actions (T6b §3.1, §14).
lib/hooks/useUnsavedGuard.ts      → garde C2, NOUVEAU et TRANSVERSE (§12).
components/matches/*              → rendu.
```

**Feuilles client — exactement trois** (toute autre est à justifier) :

| Composant | Pourquoi client |
|---|---|
| `MatchRow.tsx` | état d'ouverture local de sa propre ligne |
| `PredictionForm.tsx` | état de saisie local + drapeau `dirty` (C2) |
| `ValidateAllBanner.tsx` | dialogue de confirmation |

`TeamPicker`, `MarginStepper`, `RevealPanel`, `BetShortcut`, `MatchDayGroup` sont **sans
`"use client"`** : rendus exclusivement par un parent client, même mécanisme que
`NodeCard`/`SeriesGroups` du bracket. `MatchDayGroup` et la page restent serveur.

**Conséquence directe de la multi-ouverture (§3)** : aucun état « quelle ligne est ouverte »
ne remonte dans un parent. Chaque `MatchRow` porte son propre booléen. La page et la liste
restent des composants serveur.

## 2. Compétition et fenêtre affichées

Une seule compétition `ACTIVE` → aucun sélecteur. Aucune active → état vide global (§15).

Fenêtre : **glissante sur 3 jours**, `matches` dont `scheduled_at` est **non NULL** et
compris dans la fenêtre, **groupés par jour**, le plus proche en premier. Un match dont la
date n'est pas confirmée (matchs 5-6-7 d'une série) n'apparaît pas — c'est le cas
`scheduled_at IS NULL`, pas un filtre applicatif inventé.

**Sortie de fenêtre — acté 23/07/2026** : dès qu'un match démarre, il quitte cet écran et
bascule dans « Mes pronos » (0.2.3 §1, lecture littérale retenue). **Cet écran ne montre donc
que des matchs à venir**, jamais un match en cours ou terminé.

**Le filtre porte sur l'heure, jamais sur le statut** :

```text
scheduled_at IS NOT NULL
  AND scheduled_at > now()
  AND scheduled_at <= now() + 3 jours
```

Filtrer sur `matches.status = 'SCHEDULED'` serait un **bug** : le planificateur tournant
toutes les 30-60 min (T4/A8), un match commencé peut rester `SCHEDULED` en base pendant près
d'une heure, et un match passé en `IN_PROGRESS` par une synchro en avance disparaîtrait
avant son heure. Le verrouillage est piloté par l'heure connue, **jamais** par le live
(T6c §10.3) — le filtre de cette fenêtre suit la même autorité.

---

## 3. Structure de l'écran — vue repliée — **acté 23/07/2026**

**Vue repliée par défaut, fixe** : pas de bascule compacte/détaillée. **Plusieurs lignes
peuvent être dépliées simultanément.**

> Divergence assumée avec `SeriesDrillDown` du bracket (une seule série ouverte à la fois) :
> les gestes n'ont pas le même but — consulter là-bas, **saisir** ici. Ne pas « harmoniser »
> l'un des deux plus tard par erreur.

L'état d'ouverture n'est **pas persisté** (ni `sessionStorage`, ni URL).

### 3.1 Ligne repliée

Doit rester lisible d'un coup d'œil (0.2.9 §4) :

```text
[logo] BOS – MIA          21:00 · verrou dans 2 h 14      [statut]  ▾
```

- affiche **toujours** le statut (rampe §4) ;
- si `validé` : rappelle le prono figé (`✓ LAL −8`) ;
- l'heure de verrouillage est un repère textuel, **pas** un compte à rebours vivant sur
  chaque ligne (un `Countdown` par ligne coûterait un timer par match) — le décompte animé
  reste réservé à la ligne **dépliée**.

> **Amendement §20 (25/07/2026)** : le mockup ci-dessus (`[logo] BOS – MIA …`) est
> **remplacé** à l'implémentation par une variante « split neutre » sans logo —
> voir §20. Le statut et le chevron sont inchangés ; c'est la zone
> équipes/heure qui change de disposition.

### 3.2 Ligne dépliée

Ordre imposé : affrontement (sélecteur de vainqueur) → écart → panneau « valider = voir » →
actions → raccourci pari.

---

## 4. Statuts de prono

Rampe neutre T7 §15.5, appliquée telle quelle — **ni vert, ni or, ni rouge**.

| Statut affiché | Dérivation (données réelles) | Rendu (§15.5) |
|---|---|---|
| `à faire` | aucune ligne `match_predictions` | contour pointillé, texte `--text-muted`, cercle vide |
| `incomplet` | ligne DRAFT avec **un seul** des deux champs | contour plein `--border-subtle`, demi-cercle |
| `prêt` | ligne DRAFT avec **les deux** champs | `--surface-raised` + anneau accent 1px, flèche |
| `validé` | `status = 'VALIDATED'` | `--accent-soft` + liseré, coche |

`LOCKED` n'est **jamais** un statut stocké (T6b §9.2) : le verrouillage est déduit de
l'heure du match. Ne pas le lire en base.

**Sort d'un brouillon `incomplet` à la deadline** — déjà spécifié, rien de neuf (T6b §2) :

```text
brouillon COMPLET  → VALIDATED, is_auto_validated = true   (scoré)
brouillon PARTIEL  → reste DRAFT                            (absence, 0 point)
```

La ligne **n'est pas supprimée** : elle reste `DRAFT`, donc jamais publique (`status <>
'DRAFT'` est la clé de visibilité, T6b §1) et jamais scorée. Le joueur peut donc enregistrer
un prono à moitié rempli et le finaliser plus tard ; s'il oublie, le match compte comme une
absence — 0 point, **jamais de pénalité négative**.

> Conserver cette ligne (plutôt que la purger) est aussi ce qui rend calculable le rappel
> « tu n'as pas encore pronostiqué le match de ce soir », inscrit au `BACKLOG_V1` en
> **PRIORITÉ**. On ne le construit pas ici ; on ne le ferme pas non plus.

## 5. Saisie du vainqueur — tap direct

T7 §15.8 : le joueur tape **l'équipe** (logo + nom), pas un bouton segmenté séparé. Les deux
équipes forment le sélecteur ; l'équipe choisie prend l'état sélectionné (accent en filet,
jamais vert — le vert reste le résultat).

Garde serveur (T6b §3.1) : `predictedWinnerTeamId ∈ { home_team_id, away_team_id }`. Le
rendu ne re-décide rien.

## 6. Saisie de l'écart — **acté 23/07/2026**

```text
Stepper −/+ · la valeur centrale est TAPABLE et ouvre le pavé numérique (saisie libre).
État initial : CASE VIDE.
  "−" inactif tant que la case est vide.
  "+" sur case vide pose 1.
  tap sur la zone valeur (vide ou non) = pavé numérique.
Bornes 1..50 : "−" inactif à 1, "+" inactif à 50, le pavé refuse hors bornes.
```

**Interdit — ne jamais pré-remplir à 1.** Un écart pré-rempli rendrait « complet » un
brouillon où le joueur n'a choisi que le vainqueur : à la deadline ce brouillon serait
**auto-validé et scoré** avec un écart qu'il n'a jamais posé, alors que la synthèse §5
distingue explicitement brouillon complet (auto-validé) et brouillon partiel (absence,
0 point). L'état vide doit rester un état vide.

**Divulgation** : l'écart est **visible d'emblée**, pas révélé après le choix du vainqueur.
Les deux champs sont indissociables (0.2.3 §2) mais leur ordre de saisie est libre.

Rendu : `tabular-nums`, cibles tactiles ≥ `--tap-target-min` sur `−` et `+`.

## 7. Enregistrer et valider — deux actions distinctes

T6b §4 est explicite : **pas d'auto-save silencieux**, le brouillon est un acte explicite.
La ligne dépliée porte donc **deux** actions, pas une :

```text
[ Enregistrer le brouillon ]   secondaire — saveMatchPredictionDraft
[ Valider le prono ]           primaire   — validateMatchPrediction, IRRÉVERSIBLE
```

- `Valider` exige les deux champs ; sur un prono incomplet l'action est **désactivée** côté
  UI **et** rejetée côté serveur (la garde UI n'est jamais l'autorité) ;
- `Valider` est précédé d'une **confirmation légère** (0.2.9 §4) rappelant les deux
  conséquences : plus modifiable, **et** tu vois les pronos des autres ;
- ce dialogue est **distinct** du dialogue C2 de perte de saisie (T6c §11.1) — ne pas les
  confondre ni les fusionner ;
- après succès, la ligne passe en `validé` et se re-rend révélée (§8).

## 8. Panneau « valider = voir » et révélation

Avant validation, la zone des pronos d'autrui est un **panneau verrouillé explicite**
(0.2.9 §4) — pas une absence silencieuse. Il porte le compteur, jamais le contenu.

```text
Compteur « X/N ont pronostiqué » : visible EN PERMANENCE, pour tous (0.2.3 §9).
Détail nominatif : seulement si isRevealed.
```

Après révélation :

- liste nominative « qui a mis quoi + écart » ;
- **absents** : compteur neutre « X n'ont pas joué », dépliable (T6c §6.1) — ton factuel,
  aucune stigmatisation, jamais mélangés à la liste des pronos ;
- joueur `DISABLED` : conservé, `--opacity-inactive` + tag « inactif » (T6c §6.2) ;
- prono corrigé par un admin : badge `--color-trend` + mention « saisi/corrigé par X sur
  requête de Y » (T6c §5).

**Impératif de confidentialité** (même patron que `getBracket`) : quand `isRevealed` est
faux, `others` et `absentees` sont **vides côté serveur** — la requête n'est pas lancée. La
RLS (`has_committed_prediction`) bloquerait de toute façon, mais le code ne s'y fie pas seul.

**Pas de temps réel sur la révélation** (T6c §14.1, acté) : quand un autre joueur valide, son
prono apparaît au **prochain rendu serveur**, pas en direct. Ne pas ajouter de souscription
`match_predictions` — cela rouvrirait la publication Realtime bornée par T4 §9.

## 9. Bandeau « Tout valider »

0.2.3 §4 / 0.2.9 §4, appliqué tel quel :

- n'apparaît **que** s'il existe au moins un brouillon **complet** (`readyCount > 0`) ;
- ne compte **que** les `prêt` — ni les incomplets, ni les déjà validés ;
- confirmation explicite **listant les matchs concernés** + rappel de l'irréversibilité,
  affichée **avant** l'appel (T6b §3.1 : l'action ne confirme pas, l'écran confirme) ;
- l'action renvoie `validatedMatchIds` — les lignes concernées passent en `validé`.

## 10. Raccourci pari — **acté 23/07/2026**

Entrée **secondaire**, visuellement distincte du CTA de validation (0.2.9 §12). Deux
compétitions, deux indicateurs :

```text
NBA CUP    : BINAIRE — « pari posé » / « proposer un pari ». Quota = 1 par match,
             il n'existe pas de série, donc aucun budget à afficher.
PLAYOFFS   : COMPTEUR x/3 — slots de paris MATCH consommés sur LA SÉRIE de ce match.
             (le pari SÉRIE a son quota indépendant et n'est pas proposable d'ici)
```

**Second état, obligatoire dans les deux cas** : `x/3` dit combien de slots restent dans la
série, **pas** si *ce* match précis en porte déjà un — or la règle « au plus 1 pari MATCH par
match » (0.2.4 §2) interdit d'en reproposer un. Le point d'entrée doit donc porter un état
« pari déjà posé sur ce match », désactivé, en plus du compteur.

**Consommation d'un slot** — entièrement spécifiée par 0.2.4 §6, rien à trancher, à calculer
**côté serveur** et jamais à déduire de l'affichage :

| Cas | Slot |
|---|---|
| Pari `REJECTED` **avant** sa deadline | **libéré** |
| Pari `REJECTED` **après** sa deadline | consommé (perdu) |
| Pari `CANCELLED` | **libéré, toujours**, quel que soit le moment |
| `DRAFT` / `SUBMITTED` / `VALIDATED` / `WON` / `LOST` | consommé |

Destination du raccourci : hors périmètre de cet écran (lot « Paris »). Voir §18.3.

## 11. Live — **aucun sur cet écran** (acté 23/07/2026)

Cet écran n'affiche que des matchs **à venir** (§2). Il n'y a donc **ni badge EN DIRECT, ni
score, ni souscription Realtime** ici : rien n'y bouge en direct, et l'ouvrir sur une
souscription `matches` reviendrait à écouter des lignes qui ne changent pas encore.

Le live (badge EN DIRECT, score courant, « mis à jour il y a… », dégradation propre selon la
fraîcheur de synchro — T6c §10) appartient à l'écran **« Mes pronos »**, où vivent les matchs
en cours et verrouillés. C'est un déplacement de périmètre, pas une suppression : T6c reste
valable, il s'applique juste à un autre écran que ce que laissaient entendre ses apartés.

Seul point de contact conservé : le repère « verrou dans 2 h 14 » de la ligne repliée et le
décompte de la ligne dépliée sont calculés depuis `scheduled_at`, **jamais** depuis le statut
live.

## 12. Garde-fou C2

`lib/hooks/useUnsavedGuard.ts` est **créé par ce lot** : c'est le premier des trois écrans à
saisie perdable (pronos, paris, bracket). À écrire comme un hook **transverse**, pas comme un
détail de cet écran.

```text
dirty  ← dès qu'un champ change dans PredictionForm
dirty  ← remis à zéro après une server action réussie
Sortie : beforeunload (onglet) ET garde de navigation App Router (interne)
Dialogue : « Rester » (par défaut) / « Quitter quand même », ton entre potes (T6c §11.1)
```

Wording exact figé au moment de coder (B9). C2 est une garde d'**ergonomie**, jamais de
sécurité : la RLS et le verrouillage temporel restent l'autorité.

Avec la multi-ouverture (§3), plusieurs lignes peuvent être `dirty` en même temps — le
drapeau est **agrégé** au niveau de l'écran, pas par ligne.

---

## 13. Couche de lecture — contrat de types

> Les **noms de colonnes** et **valeurs de statut** sont à relire dans le schéma réel à
> l'implémentation. Cette spec fige les **types de sortie**, pas les requêtes.

```ts
export type TeamRef = { id: string; abbreviation: string; name: string };

export type PredictionViewStatus = "TODO" | "INCOMPLETE" | "READY" | "VALIDATED";

/** Prono d'un AUTRE joueur, révélé seulement quand isRevealed. */
export type OtherPrediction = {
  pseudo: string;
  teamAbbreviation: string;
  margin: number;
  isAdminCorrected: boolean;
  isInactive: boolean;
};

/** Indicateur du raccourci pari — §10. */
export type BetSlotIndicator =
  | { mode: "BINARY"; hasBetOnThisMatch: boolean }
  | { mode: "SERIES_QUOTA"; hasBetOnThisMatch: boolean; usedSlots: number; totalSlots: 3 };

export type MatchCard = {
  matchId: string;
  seriesId: string;
  scheduledAt: string;              // ISO ; jamais null dans cette fenêtre (§2)
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  myWinnerTeamId: string | null;    // null = pas encore choisi
  myMargin: number | null;          // null = CASE VIDE (§6), jamais 0, jamais pré-rempli
  viewStatus: PredictionViewStatus;
  predictedCount: number;           // X du compteur
  eligibleCount: number;            // N du compteur — joueurs ACTIVE uniquement (§18.4)
  isRevealed: boolean;              // calculé serveur, jamais côté rendu
  others: OtherPrediction[];        // VIDE si !isRevealed
  absentees: string[];              // VIDE si !isRevealed
  betSlot: BetSlotIndicator;
};

export type MatchDay = {
  key: string;                      // date locale, clé de regroupement
  label: string;                    // « Ce soir », « Demain », « Samedi 25 »
  matches: MatchCard[];             // triés par scheduledAt croissant
};

export type MatchesData = {
  competitionId: string | null;     // null = aucune compétition active
  competitionType: "PLAYOFFS" | "NBA_CUP";
  days: MatchDay[];                 // déjà triés, plus proche en premier
  readyCount: number;               // pilote le bandeau « Tout valider » (§9)
};

export async function getMatches(): Promise<MatchesData>;
```

Le regroupement par jour, le tri, la dérivation de `viewStatus` et le calcul des slots de
paris sont faits **côté serveur** dans ce module ; les composants ne font que rendre.

## 14. Server actions consommées

Aucune action nouvelle. `saveMatchPredictionDraft` reçoit un **correctif post-validation**
de sa signature T6b §3.1 (§18.1) ; les deux autres sont inchangées.

```ts
// CORRIGÉ (23/07/2026) : les deux champs deviennent optionnels — le brouillon PARTIEL
// est un état produit acquis (0.2.3 §5, 0.2.9 §4, T1 §3.9, T6b §2).
saveMatchPredictionDraft(input: {
  matchId: string;
  predictedWinnerTeamId?: string | null;   // null = champ vidé
  predictedMargin?: number | null;         // 1..50 si fourni
}): Promise<ActionResult>;

validateMatchPrediction(matchId)              // INCHANGÉE — exige toujours les 2 champs
validateAllCompleteMatchPredictions()         // INCHANGÉE
```

Gardes serveur inchangées (T6b §3.1) : appartenance du vainqueur à la paire du match, écart
entier 1..50, match non verrouillé. Elles s'appliquent à **chaque champ fourni** ; un champ
absent n'est simplement pas écrit.

`revalidatePath('/play/matches')` **et** `'/home'` après chaque action (T6b §3.1) — l'Accueil
porte l'item « À traiter » correspondant.

## 15. États vides — libellés **exacts**

| Cas | Titre | Sous-titre |
|---|---|---|
| Aucune compétition active | Aucune compétition en cours | La prochaine arrive bientôt. |
| Fenêtre 3 jours sans affiche | Aucun match à pronostiquer pour l'instant | Les prochaines affiches s'afficheront ici dès qu'elles seront connues. |
| Tout est validé | Tout est validé | Tu es à jour sur les 3 prochains jours. |

« Aucune compétition en cours » est le **même libellé** que sur l'Accueil, le Classement et
le Bracket. Le premier titre est repris **mot pour mot** de 0.2.3 §1.

Ton neutre ici (B9) : aucune action n'est possible dans ces trois cas, donc pas d'injonction.

## 16. Règles de rendu communes (T7 — non négociables)

- **vert / rouge = RÉSULTAT gagné ou perdu uniquement.** Jamais un statut de saisie, jamais
  une urgence, jamais une action. Les statuts de prono suivent la rampe neutre §4.
- **Or = champion**, absent de cet écran.
- **`--color-trend`** = registre admin (badge de correction).
- **Aucune pénalité négative** nulle part.
- Chiffres en `tabular-nums`. Cibles tactiles ≥ `--tap-target-min`.
- **Aucune valeur visuelle en dur** : tout via `app/tokens.css`.

## 17. Hors périmètre

- « Mes pronos », « Paris », « Bracket personnel » — lots ultérieurs. **Deux contraintes y
  sont transmises** : l'écran « Mes pronos » doit être ancré sur les **matchs** et non sur
  les pronos (§18.2), et c'est lui qui porte le **live** (§11).
- Écran de création d'un pari (destination du raccourci §10).
- Requête de correction admin (0.2.3 §7) — se pilote depuis « Mes pronos ».
- Match reporté / annulé (0.2.3 §8) : la donnée est portée par `matches.status`, le rendu
  spécifique de ces deux cas sur cet écran n'est pas traité ici.
- Souscription Realtime sur `match_predictions` (écartée par T6c §14.1).

---

## 18. Points tranchés le 23/07/2026

### 18.1 — Brouillon partiel : autorisé, conservé, non scoré — **acté**

T6b §3.1 fige `saveMatchPredictionDraft({ matchId, predictedWinnerTeamId, predictedMargin })`
avec les **deux champs obligatoires**. Or le brouillon **partiel** est une réalité produit
acquise, à trois endroits indépendants :

- 0.2.3 §5 et la synthèse §5 : « brouillon PARTIEL (un seul des deux champs) → absence » ;
- 0.2.9 §4 : le statut `incomplet / écart manquant` est l'un des 4 statuts affichés ;
- T1 §3.9 : `predicted_winner_team_id` et `predicted_margin` sont **nullable** en base.

Avec la signature actuelle, un joueur ne pourrait jamais enregistrer un prono à moitié
rempli, et le statut `incomplet` ne serait atteignable qu'à travers une correction admin.
C'est la même classe de correctif que ceux déjà appliqués à T6a (`middleware.ts` → `proxy.ts`,
`getServerClient` rendu async) : une spec validée qu'un détail d'implémentation contredit.

**Correctif proposé** — les deux champs deviennent optionnels, les gardes serveur restent :

```ts
saveMatchPredictionDraft(input: {
  matchId: string;
  predictedWinnerTeamId?: string | null;   // null autorisé = champ vidé
  predictedMargin?: number | null;         // 1..50 si fourni
}): Promise<ActionResult>;
```

`validateMatchPrediction` reste **inchangée** : elle exige toujours les deux champs.

**Acté** : un brouillon incomplet peut être enregistré et complété plus tard ; s'il ne l'est
pas, il vaut absence à la deadline (0 point, jamais de négatif). C'est exactement ce que
T6b **§2** prévoyait déjà (« brouillon PARTIEL → reste DRAFT »). Le correctif ne change donc
aucune règle : il rend §3.1 cohérent avec §2 du même document. À marquer « post-validation »
dans T6b, comme les trois correctifs de T6a.

### 18.2 — Matchs = avant coup d'envoi uniquement — **acté**

Deux sources se contredisent :

- **0.2.3 §1** (décision produit, explicite) : « dès qu'un match démarre ou que son prono est
  verrouillé, il **quitte la fenêtre de saisie** et bascule dans "Mes pronos" » ;
- **`SPEC_ECRAN_CLASSEMENT_BRACKET` §18** (aparté technique) : « le live reste réservé à
  l'écran Matchs », et T6c §2.2 dit que la souscription `matches` « alimente les cartes de
  match et l'écran live ».

Si 0.2.3 §1 s'applique littéralement, **aucun match en cours n'est visible ici** — le badge
EN DIRECT et la souscription Realtime n'ont alors rien à faire sur cet écran, et le live
appartient à « Mes pronos ».

**Acté** : 0.2.3 §1 l'emporte — c'est une décision produit explicite, les deux autres mentions
sont des apartés techniques écrits avant que les écrans existent. Cet écran s'arrête au coup
d'envoi (§2), et le live part au lot « Mes pronos » (§11).

**Contrainte transmise au lot « Mes pronos »** (acté au même moment) : un joueur qui a oublié
un match doit **quand même pouvoir y accéder**. « Mes pronos » est donc **ancré sur les
matchs, pas sur les pronos** — tout match passé au verrouillage y apparaît, **y compris
quand aucune ligne `match_predictions` n'existe**. Un écran qui listerait les pronos
existants ferait disparaître exactement les matchs oubliés, c'est-à-dire ceux dont le joueur
a le plus besoin.

C'est déjà la lettre de 0.2.3 §1, qui décrit « Mes pronos » comme « historique **+ matchs**
en cours ou verrouillés » — des matchs, pas des pronos.

> **Précision de portée** : « accéder » = **consulter** le match et, le cas échéant, déposer
> une **requête de correction** (0.2.3 §7 — une requête peut être envoyée même après le
> match, et seul un admin peut y donner suite). Ce n'est **pas** une réouverture de la
> saisie : le verrouillage au coup d'envoi reste irréversible (0.2.3 §4). Si l'intention
> était de permettre une saisie tardive, c'est une autre décision, qui contredirait une
> règle validée — à rouvrir explicitement, pas ici.

### 18.3 — Destination du raccourci pari — **acté (reporté)**

`/play/bets/new?matchId=…` n'est fixée nulle part (ni 0.2.9 §12, ni T6a). Route à figer au
lot « Paris » ; d'ici là le raccourci pointe vers une cible provisoire.

### 18.4 — `N` du compteur « X/N ont pronostiqué » — **acté**

`N` = joueurs `ACTIVE` **uniquement**. Un joueur `DISABLED` est exclu du dénominateur (il
n'a plus le droit d'écrire, T6c §6.2 — l'y compter rendrait `N/N` inatteignable à jamais).
Lecture littérale de T6c §6.1, qui définit l'absent parmi « les joueurs actifs de la
compétition ». Rappel : `DISABLED` reste en revanche **conservé au classement** avec ses
points — les deux règles ne se contredisent pas, elles portent sur deux choses différentes.

---

## 19. Récapitulatif des décisions

| # | Décision | § |
|---|---|---|
| 1 | Vue repliée par défaut, fixe, sans bascule | §3 |
| 2 | Plusieurs lignes dépliables simultanément ; état non persisté | §3 |
| 3 | Écart : stepper `−/+`, valeur tapable → pavé numérique, bornes 1-50 | §6 |
| 4 | Case vide au départ ; `−` inactif ; `+` pose 1 ; jamais de pré-remplissage | §6 |
| 5 | Écart visible d'emblée, pas de divulgation progressive | §6 |
| 6 | Deux CTA distincts : enregistrer le brouillon / valider (irréversible) | §7 |
| 7 | Raccourci pari : binaire en Cup, `x/3` en Playoffs, + état « déjà posé » | §10 |
| 8 | Confidentialité gérée dans la requête (`others` vide serveur), pas au rendu | §8 |
| 9 | Révélation des pronos d'autrui non temps réel (T6c §14.1 appliqué) | §8 |
| 10 | 3 feuilles client seulement ; `useUnsavedGuard` créé ici, transverse | §1 §12 |
| 11 | Brouillon partiel enregistrable, conservé en `DRAFT`, = absence à la deadline | §4 §18.1 |
| 12 | `saveMatchPredictionDraft` : les 2 champs deviennent optionnels (correctif T6b) | §14 §18.1 |
| 13 | Écran borné au coup d'envoi ; filtre sur `scheduled_at`, jamais sur `status` | §2 §18.2 |
| 14 | Aucun live ici : badge EN DIRECT et souscription `matches` → « Mes pronos » | §11 |
| 15 | « Mes pronos » ancré sur les **matchs** (contrainte transmise au lot suivant) | §17 §18.2 |
| 16 | `N` du compteur = joueurs `ACTIVE` uniquement | §18.4 |
| 17 | Entête replié refondu en split neutre, sans logo (amendement 25/07/2026) | §3.1 §20 |
| 18 | Dialogue de validation à deux variantes selon brouillon enregistré ou non (27/07/2026) | §7 §21 |

> Rappel de méthode, pas une question : les **noms de colonnes** et **valeurs de statut** sont
> à lire dans le schéma réel à l'implémentation. Cette spec décrit l'intention et fige les
> contrats de types ; elle ne présume aucun nom.

---

## 20. Amendement post-implémentation — entête replié (25/07/2026)

> Rédigé après coup, à l'usage réel (écran codé, testé dans un vrai
> navigateur, retouché à la demande de l'utilisateur) — pas une réouverture
> du produit tranché le 23/07/2026, une précision de mise en forme. Le
> comportement d'ouverture (§3), le contenu de la ligne dépliée (§3.2),
> `PredictionForm` et `TeamPicker` (hors son logo agrandi, cf.
> `SPEC_DESIGN_SYSTEM_V0_1.md` §16.1) ne sont pas concernés.

**Constat** : le mockup de §3.1 (`[logo] BOS – MIA … [statut] ▾`) plaçait un
logo devant le libellé des équipes. À l'usage réel, demandé explicitement par
l'utilisateur : **variante « split neutre »** — les deux logos disparaissent
de l'entête replié, remplacés par les deux abréviations en grand (grille
1fr/1px/1fr, séparateur vertical), la ligne heure/verrou et la ligne statut/
chevron passant d'une seule rangée à deux rangées empilées séparées par une
bordure.

```text
  BOS         |         MIA
——————————————————————————————————————
21:00 · verrou dans 2 h 14        [statut]  ▾
```

**Acté** :
- le logo « moment fort » ne disparaît pas de l'écran : il se déplace vers la
  **carte-sélecteur** (`TeamPicker`, ligne dépliée), agrandie à 48px en
  conséquence — voir `SPEC_DESIGN_SYSTEM_V0_1.md` §16.1, même amendement,
  décision symétrique ;
- le statut (rampe §4) et le chevron sont **repris tels quels**, seulement
  redistribués dans la nouvelle disposition — aucune règle de §4 n'est
  rouverte ;
- l'accessibilité de l'ordre de lecture (équipe à domicile vs visiteuse) est
  préservée par un texte `sr-only` (« contre ») entre les deux abréviations,
  invisible à l'écran mais lu par les lecteurs d'écran.

**Hors périmètre de cet amendement** : la carte dépliée (`TeamPicker`) a par
ailleurs perdu l'affichage de l'abréviation à côté de son logo (ne reste que
logo + nom complet) — ce n'est pas une conséquence du split neutre, mais un
choix séparé fait le même jour (l'abréviation, répétée aux deux endroits,
n'avait plus d'utilité une fois le split en place dans l'entête).

## 21. Amendement post-implémentation — dialogue de validation (27/07/2026)

> Rédigé après coup, à l'usage réel (bug remonté par l'utilisateur en test
> mobile sur le déploiement Vercel) — pas une réouverture de §7, une
> précision de son dialogue de confirmation.

**Constat** : `Valider le prono` (bouton primaire, §7) s'active dès que la
saisie **locale** (équipe + écart) est complète, mais `validateMatchPrediction`
relit le brouillon **persisté** en base — jamais la saisie locale. Un joueur
qui remplit les deux champs puis clique directement sur `Valider` sans être
passé par `Enregistrer le brouillon` déclenchait le rejet serveur
« Choisis un vainqueur et un écart avant de valider. », alors même que
l'écran affichait une sélection complète. Repéré sur un vrai test mobile
(LAL–HOU, Lakers sélectionnés, écart à 6, rejet malgré tout).

**Acté** :
- le bouton `Valider le prono` reste accessible dès que la saisie locale est
  complète (§7 inchangé — la garde d'incomplétude reste la seule à désactiver
  le bouton) ;
- le dialogue de confirmation devient **à deux variantes**, selon que la
  saisie locale diffère ou non du brouillon déjà enregistré :
  - **brouillon à jour** (rien à enregistrer) : dialogue inchangé, `Annuler` /
    `Valider` ;
  - **brouillon non enregistré** : la conséquence de la perte de
    modifiabilité est explicitée dans le corps du dialogue, et **trois**
    actions sont proposées — `Retour` (ferme sans rien faire), `Enregistrer
    le brouillon` (sauvegarde, referme le dialogue, le prono reste
    modifiable), `Valider définitivement` (enregistre **puis** valide en un
    seul geste, irréversible) ;
- `Valider définitivement` n'est pas de l'auto-save silencieux (garde de §7
  T6b §4) : c'est un clic explicite sur un bouton dont le libellé annonce
  précisément qu'il enregistre et valide à la fois — le joueur choisit ce
  chemin en connaissance de cause, il n'est jamais déclenché sans action.

## 22. Amendement post-implémentation — positionnement du stepper d'écart (02/08/2026)

> Rédigé après coup, à la demande explicite de l'utilisateur (« gérer
> l'écart pronostiqué par un bouton + disponible sous chaque équipe ») — pas
> une réouverture des règles de §6, un correctif de **positionnement** du
> même stepper.

**Avant** : le stepper `−/+` de §6 était rendu comme un bloc unique, sous le
sélecteur de vainqueur (`TeamPicker`) mais sans lien visuel avec l'une ou
l'autre équipe.

**Acté** : le stepper est désormais scindé sur les 2 colonnes du
`TeamPicker` (même `grid-template-columns: 1fr 1fr`) — `−`/valeur/`+`
n'apparaissent QUE sous la colonne de l'équipe déjà choisie comme vainqueur ;
l'autre colonne reste vide. Toutes les règles de §6 restent **inchangées** :
case vide au départ, jamais de pré-remplissage, `−` inactif tant que vide ou
à 1, `+` sur case vide pose 1, tap sur la valeur ouvre le pavé numérique,
bornes 1..50. Changer de vainqueur fait juste basculer le stepper de colonne
— la valeur déjà posée est conservée (elle ne s'est jamais rattachée à un
camp précis en base, `predicted_margin` reste un entier unique).

**Aller-retour en session** : l'utilisateur a d'abord demandé de retirer le
`−` (« seulement le + »), confirmé par `AskUserQuestion` avant de coder ;
puis, une fois le nouveau positionnement validé à l'usage, a demandé de le
réintroduire (« j'aime bien comment c'est actuellement, il manque juste le
bouton − ») — remis à l'identique de §6, toujours sous la colonne du
vainqueur. Les deux passes sont committées séparément (`939f3f9` puis
`139de16`).
