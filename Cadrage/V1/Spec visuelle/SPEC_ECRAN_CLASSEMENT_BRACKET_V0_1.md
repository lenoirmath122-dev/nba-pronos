# NBA Pronos — SPEC ÉCRANS CLASSEMENT & BRACKET V0.1

> **Statut** : **complète** — aucun point produit ouvert (§18). Rédigée et close le
> 22/07/2026, phase V1 propre.
> **Portée** : les deux écrans **partagés** visiteur / joueur connecté — Classement et
> Bracket (vue globale de consultation). L'écran de **remplissage** du bracket est hors
> périmètre (lot ultérieur).
> **Décisions prises le 22/07/2026** : bascule vue B (§10), drill-down inline (§11),
> séparateur du Total (§4), marqueur « corrigé » (§7), et les 5 points de §17.

## 0. Sources et cadre

| Sujet | Source | Ce qu'elle impose |
|---|---|---|
| Classement, tri, départage, visibilité | 0.2.6 | tableau unique, puces, rang sur Total, départage 5 critères, sous-totaux publics |
| Bracket, remplissage et consultation | 0.2.2 + 0.2.9 §5 | vue A résumé par défaut, vue B arbre plein écran, champion déduit |
| Tendances | 0.2.6 §4 | % au-delà de 10 brackets remplis, nombre brut sinon — **seuil par série** |
| Détail après deadline | 0.2.6 §4 | brackets individuels visibles **uniquement après la deadline** |
| Correction admin | 0.2.7 §7 + modèle | `is_admin_corrected` sur `match_predictions` et `bets` ; marquage public |
| NBA Cup | décisions NBA Cup | 4 quarts → 2 demies → 1 finale ; deadline unique = 1er quart ; pas de série |
| Routes partagées | T6a | URL physique unique, hors groupes `(app)`/`(public)` ; nav seule différence |
| Rendu | T7 + amendement V0.2 | vert/rouge = résultat seul ; or = champion ; `--color-trend` = registre admin |

**Conventions** : TypeScript strict, composants serveur par défaut, commentaires FR, noms de
code EN, styles **exclusivement** via les tokens de `app/tokens.css`.

---

## 1. Architecture partagée

```text
app/leaderboard/page.tsx   → Classement. URL unique, hors (app) et (public).
app/bracket/page.tsx       → Bracket, vue globale. Idem.
lib/queries/leaderboard.ts → lecture du classement.
lib/queries/bracket.ts     → lecture du bracket global.
components/leaderboard/*   → rendu (présentationnel).
components/bracket/*       → rendu (présentationnel).
components/ui/Countdown.tsx → DÉPLACÉ depuis components/home/ : désormais partagé
                              (Accueil + bracket avant deadline). Comportement inchangé.
```

**Règle structurante (non négociable)** : un **seul** composant de rendu sert le visiteur et
le joueur connecté. Ce qui varie :

- la **nav** (réduite pour le visiteur, 4 onglets pour le connecté) — décidée par le layout,
  pas par l'écran ;
- le **contenu**, uniquement par la **RLS**. **Jamais de `if (role)` de sécurité dans le
  code de l'écran.** Un `if` d'affichage (afficher un CTA « Se connecter ») est autorisé ;
  un `if` qui décide *quelles données montrer* ne l'est pas.

**Visiteur non connecté** : lecture complète, nav réduite, CTA discret « Se connecter ».
Aucun blocage de lecture (5.8).

## 2. Compétition affichée

Une seule compétition `ACTIVE` à la fois → aucun sélecteur. Aucune active → état vide global
(§15). Les classements de **compétitions archivées** sont hors périmètre V1 (backlog).

---

# PARTIE A — CLASSEMENT

## 3. Ce qui est déjà acté (rappel, non rediscuté)

Un seul tableau ; tri par puces **Total · Matchs · Bracket · Paris · Forme** ; le **Total
reste toujours affiché** quelle que soit la puce ; le **rang affiché est toujours calculé sur
Total** ; départage **1.** Total **2.** bons vainqueurs de match **3.** écarts exacts
**4.** points bracket **5.** ex-aequo assumé ; ligne dépliable en sous-totaux publics
(forme = 7 jours glissants) ; joueur inactif grisé + tag « inactif », conservé avec ses
points ; barre « toi » collante **au-delà de 20 joueurs classés seulement**, visible
**seulement** quand la ligne du joueur sort du viewport ; mobile = 3 colonnes max, **jamais**
de scroll horizontal ; desktop = toutes les colonnes.

## 4. Ordre des colonnes et séparateur du Total — **acté 22/07/2026**

Le Total est **déplacé juste après l'identité du joueur**, avant le détail :

```text
Rang │ Joueur │ Total ┃ Matchs │ Bracket │ Paris │ Forme
                        ↑ filet --color-border-subtle
```

Lecture en deux temps : « qui, et combien » à gauche du filet, « d'où viennent ces points » à
droite. Le Total colle au rang qu'il détermine.

**Le séparateur est un simple filet vertical `--color-border-subtle`** — pas une bordure
appuyée (avec les bordures « voile » de l'amendement V0.2, un trait marqué découpe le tableau
en deux blocs qui ne se parlent plus). **Pas de colonne figée** : le sticky résout un scroll
horizontal qui, par décision, n'existe jamais.

### 4.1 Deux emphases qui ne doivent pas se concurrencer

| Élément | Moyen | Nature |
|---|---|---|
| **Total** | `--color-text-primary` + graisse **semibold** | permanent, structurel, **jamais coloré** |
| **Colonne active** (puce) | bande `--color-accent-soft`, valeur en `--color-accent` | contextuel, se déplace avec la puce |

L'un joue sur la **graisse**, l'autre sur la **teinte** : ils ne se marchent jamais dessus, et
se cumulent naturellement quand la puce active *est* Total.

### 4.2 Rendu du tableau

- Chiffres **alignés à droite**, `font-variant-numeric: tabular-nums` (sinon les colonnes
  tremblent au changement de tri).
- **En-têtes cliquables, avec flèche de tri** — **corrigé le 13/08/2026**, annule et remplace
  la décision d'origine ci-dessous. Chaque en-tête de colonne (Total/Matchs/Bracket/Paris/
  Forme) est lui-même le déclencheur de tri (chevron ▾ affiché uniquement sur la colonne
  active). Raison du revirement : la rangée de puces séparée (§5, ancienne version) affichait
  **les mêmes 5 libellés une seconde fois**, juste au-dessus des en-têtes — redondance visuelle
  repérée à l'usage, pas anticipée à la rédaction de cette spec.
  > *Décision d'origine (annulée) :* ~~Aucune flèche de tri dans les en-têtes : les puces
  > portent seules cette information.~~
- **Mobile (3 colonnes)** : `Rang/Joueur │ Total ┃ colonne active`. Même grammaire, même
  emplacement du filet — rien à réapprendre entre les formats. Les en-têtes non actifs étant
  masqués sur ce format, un sélecteur dédié (`MobileSortSelect`) reste nécessaire pour changer
  la colonne affichée — cf. §5.

## 5. Tri du classement — **corrigé le 13/08/2026**

`total | matches | bracket | bets | form`. **Les en-têtes de colonnes du tableau portent
eux-mêmes le tri** (§4.2) — il n'existe plus de rangée de puces séparée au-dessus du tableau
(`SortChips`, retiré). Sur mobile, où seule la colonne active reste visible parmi les 4 de
détail, un sélecteur compact (`MobileSortSelect`) occupe la même place que l'en-tête qu'il
remplace et propose les 4 choix de détail (jamais Total, qui garde sa propre colonne fixe).

La colonne active pilote le **tri des lignes** et la **colonne mise en avant**. Elle ne change
**jamais** le rang affiché, toujours calculé sur Total (interprétation actée).

**Bascule croissant/décroissant — corrigée le 14/08/2026** (comportement de tableur attendu,
remonté par l'utilisateur juste après la 1ère version de ce lot). Cliquer un en-tête déjà actif
inverse le sens (`?ordre=asc`, absent = décroissant, repli habituel) ; cliquer un en-tête
différent bascule dessus en décroissant. `▾` = décroissant, `▴` = croissant. Sur mobile, un
bouton dédié à côté de `MobileSortSelect` porte cette bascule pour la colonne de détail active
(l'en-tête de `Total`, lui, reste un `<Link>` normal même sur mobile — sa bascule s'y fait
directement).
> *Décision d'origine (annulée) :* ~~Le tri est toujours décroissant, aucune bascule
> croissant/décroissant n'existe dans ce projet.~~

Tri **alphabétique** différé (hors V1).

## 6. Ligne dépliée

Sous-totaux publics **Matchs / Bracket / Paris / Forme**, plus :

- **« dont Écarts »** (nombre d'écarts exacts) — vit **ici**, dans l'expansion, et **pas** en
  6ᵉ puce (interprétation actée) ;
- le **marqueur de correction** en clair (§7).

## 7. Marqueur « corrigé par admin » — **acté 22/07/2026**

**Donnée disponible** : `is_admin_corrected` (+ `corrected_by_admin_id`,
`correction_request_id`, `correction_reason`) sur `match_predictions` **et** `bets`. La
correction est donc un attribut **d'un prono ou d'un pari**, jamais d'un joueur : le marqueur
de ligne est un **agrégat** (« au moins un élément corrigé »).

| Emplacement | Rendu |
|---|---|
| Ligne repliée | badge **discret sans texte**, `--color-trend`, `--radius-badge`, **accolé au pseudo** |
| Ligne dépliée | texte explicite : **« N éléments corrigés par un admin, sur requête »** + chevron vers le détail |
| Desktop | infobulle au survol du badge, même texte |
| Mobile | **pas d'infobulle** : le tap déplie la ligne |

**Wording impératif** : la mention **« sur requête »** est obligatoire. Une correction n'existe
que sur demande du joueur (0.2.3/0.2.7 : un admin ne corrige jamais de sa propre initiative et
ne traite jamais sa propre requête). Sans cette nuance, « corrigé » se lit « on a touché à son
score » — stigmatisant et faux.

**Placement impératif** : accolé au **pseudo**, **jamais dans la colonne Total** — sur le
Total, il suggérerait que le total a été édité à la main.

**Teinte** : `--color-trend`, déjà le registre « admin » établi sur l'Accueil — une grammaire,
pas deux.

> *Vigilance (pas une décision)* : si le badge se banalise sur une saison, on le réservera à
> l'expansion seule. Réglage d'affichage, aucun impact données.

## 8. États des joueurs — **acté 22/07/2026**

Deux états distincts, à ne pas confondre :

| État | Définition | Rendu |
|---|---|---|
| **Inactif** | compte désactivé par un admin, **points conservés** | ligne grisée (`--opacity-inactive`) + tag « inactif », **reste classée** |
| **Jamais joué** | aucune ligne de scoring | **absent du classement** |

« Jamais joué » **n'apparaît pas** : ni ligne à 0, ni pied de page. Cohérent avec la
participation émergente actée sur l'Accueil (remplir un champ vaut inscription) et avec la
lecture directe de `user_scores`.

## 9. Ex-aequo — **acté 22/07/2026**

Numérotation sportive classique : **1, 2, 2, 4** — les ex-aequo partagent le rang, le rang
suivant saute. **Aucun départage arbitraire à l'affichage** une fois les 5 critères épuisés.

---

# PARTIE B — BRACKET (vue globale)

## 10. Vues A / B et bascule — **acté 22/07/2026**

**Vue A « résumé par tour »** = défaut : état réel de chaque série + tendances, groupé par
conférence (Playoffs), navigation par tour, progression X/15.
**Vue B « arbre »** = poster plein écran, défilement horizontal + **zoom natif** (pincer ;
pas de boutons +/− maison).

### 10.1 Nature technique du plein écran

**Pas l'API Fullscreen** (`requestFullscreen` indisponible sur iPhone/Safari) → **overlay
plein viewport**, piloté par un **paramètre d'URL `?arbre=1`** : le bouton retour Android sort
de la vue B au lieu de quitter la page, et l'URL reste partageable.

### 10.2 Déclencheurs

| Contexte | Au tap sur « plein écran ↗ » |
|---|---|
| Desktop (≥ lg) | vue B directement |
| Mobile **déjà en paysage** | vue B directement (pas d'invitation inutile) |
| Mobile portrait | **invitation à tourner** (§10.3) |

**Rotation automatique** : un passage **portrait → paysage** sur cet écran entre en vue B.
Contraintes impératives :

- **uniquement sur un événement de rotation**, jamais d'après l'orientation constatée au
  chargement — sinon **tout visiteur desktop atterrit directement dans l'arbre**, alors que la
  vue A est le défaut ;
- **uniquement sous le point de rupture mobile** ;
- **portée** : la **vue globale de consultation uniquement**. Sur l'écran de remplissage du
  bracket, tourner l'appareil ne change rien — on ne fait pas disparaître un formulaire en
  cours sous les doigts de quelqu'un.

**Retour paysage → portrait**, selon le mode d'entrée :

| Entré par | Au retour en portrait |
|---|---|
| rotation | **sort** vers la vue A (effet « coup d'œil », symétrique) |
| bouton, ou « Voir quand même » | **reste** en vue B, repli portrait — un choix explicite prime sur la règle automatique |

**Historique** : une entrée **par rotation remplace** l'entrée d'URL (`replace`), une entrée
**par le bouton en ajoute** une (`push`). Sinon tourner trois fois son téléphone crée trois
retours en arrière à défaire.

### 10.3 Invitation à tourner (mobile portrait)

Overlay sur `--color-surface-base` : icône de téléphone qui pivote (animation **neutralisée
sous `prefers-reduced-motion`**), titre **« Tourne ton téléphone »**, sous-titre **« L'arbre
complet s'affiche mieux en paysage. »**, et **deux sorties** :

| Action | Effet |
|---|---|
| il tourne | overlay disparaît **tout seul**, vue B paysage |
| « Voir quand même » | vue B **en portrait**, arbre scrollable horizontalement (dégradé, utilisable) |
| fermeture (×) | retour vue A |

**Jamais de cul-de-sac** — raison concrète : **beaucoup d'utilisateurs verrouillent la
rotation au niveau de l'OS**. Pour eux, tourner l'appareil ne produit rien ; une invitation
bloquante les enfermerait dans un écran mort. C'est aussi pourquoi le **bouton reste
nécessaire** malgré la rotation automatique.

L'invitation **ne réapparaît pas dans la même session** si « Voir quand même » a déjà été
choisi.

## 11. Drill-down d'une série — **acté 22/07/2026**

**Niveau de détail : nominatif** (« qui a pris qui »). *Note de traçabilité : 0.2.6 §4
renvoyait ce choix à 0.2.9, qui renvoyait à 0.2.6 — la boucle n'avait jamais été fermée. Elle
l'est ici, le 22/07/2026.*

**Contenant selon la vue** :

| Vue | Rendu |
|---|---|
| **A (résumé)** | **expansion inline** sur place, **une seule série ouverte à la fois** (accordéon) |
| **B (arbre)** | **feuille par le bas** superposée — l'arbre est un poster à géométrie fixe, une expansion inline déplacerait toutes les branches |

**Contenu, groupé par pronostic** (pas une liste de 30 lignes), **trié par effectif
décroissant** :

```text
Celtics en 6   ████████░░  8 joueurs
               Marc · Julie · Sam · Léa · Tom · Ana · Paul · Yann
Celtics en 7   ███░░░░░░░  3 joueurs
               Chloé · Max · Rita
Knicks en 7    ██░░░░░░░░  2 joueurs
               Hugo · Nina
```

Au plus 8 combinaisons (2 équipes × 4 formats), donc compact même à 30 joueurs. L'expansion
inline **préserve le contexte** : on compare à la série voisine sans naviguer.

**Pas d'URL pour le drill-down** (état local) : un `?serie=` compliquerait le bouton retour
pour un bénéfice marginal entre 10 et 30 amis. Ajoutable plus tard.

**Cas limites** : série sans aucun bracket rempli → « Aucun bracket rempli sur cette série ».
Les joueurs sans bracket **n'apparaissent nulle part** dans le détail (ils ne sont pas
« absents », ils n'existent pas pour cette série).

## 12. Tendances

Seuil **par série** (pas global) : **≥ 11 brackets remplis sur cette série → pourcentage** ;
**≤ 10 → nombre brut** (« 7 joueurs sur 9 »). Le dénominateur est le nombre de brackets
**effectivement remplis**, pas le nombre d'inscrits.

## 13. Avant la deadline du bracket — **acté 22/07/2026**

Le détail nominatif n'existe **qu'après la deadline** (0.2.6 §4). Avant :

- l'écran existe et montre la **structure seule** (têtes de série connues) ;
- **compte à rebours** vers la deadline (`components/ui/Countdown.tsx`) ;
- message : **« Les brackets des joueurs seront visibles après la deadline. »** ;
- **aucune tendance, aucun nom**, tap sur une série **sans effet**.

Raison : agréger pendant le remplissage divulgue des pronos **et** provoque un effet moutonnier
(« 70 % ont pris les Celtics » → tout le monde suit).

## 14. NBA Cup — **acté 22/07/2026**

Même écran, même composant, **piloté par le type de compétition** :

| | Playoffs | NBA Cup |
|---|---|---|
| Structure | 15 séries | **4 quarts → 2 demies → 1 finale** (7 matchs secs) |
| Carte | vainqueur **+ score de série** | **vainqueur seul** (aucun score de série) |
| Progression | X/15 | **X/7** |
| Groupement | **par conférence** (Est puis Ouest au 1er tour) | **par tour uniquement**, matchs ordonnés par coup d'envoi |
| Seuil tendances | par série | **par match** |
| Deadline | — | **unique** = coup d'envoi du 1er quart |

> **Pas de conférence en Cup** : la spec Cup ne la mentionne nulle part (c'est une notion du
> bracket Playoffs). Elle n'est donc **pas inventée**. Si elle est souhaitée un jour, elle est
> dérivable via `teams.conference`, mais il faudra fixer une règle d'ordre pour les demies.

**Avant la qualification des 8 équipes** (~27-30 novembre), la phase finale n'existe pas :
état vide dédié (§15).

---

# PARTIE C — CONTRATS, ÉTATS, RÈGLES

## 15. Couche de lecture — contrats de types

> Les **noms de colonnes et valeurs de statut** sont à lire dans le **schéma réel** à
> l'implémentation. Cette spec fige les **types de sortie**, pas les requêtes.

### 15.1 `lib/queries/leaderboard.ts`

```ts
export type SortKey = "total" | "matches" | "bracket" | "bets" | "form";

export type LeaderboardRow = {
  userId: string;
  pseudo: string;
  rank: number;                 // TOUJOURS calculé sur Total ; ex-aequo = même rang (1,2,2,4)
  totalPoints: number;
  matchesPoints: number;
  bracketPoints: number;
  betsPoints: number;
  formPoints: number;           // 7 jours glissants
  exactMarginsCount: number;    // « dont Écarts » — expansion uniquement
  isInactive: boolean;          // compte désactivé, points conservés
  adminCorrectionsCount: number; // 0 = aucun badge
  isCurrentUser: boolean;       // pilote la barre « toi » collante
};

export type LeaderboardData = {
  competitionId: string | null; // null = aucune compétition active
  competitionName: string | null;
  sortKey: SortKey;
  rows: LeaderboardRow[];       // déjà triées selon sortKey, rang déjà calculé sur Total
  currentUserRank: number | null; // null = visiteur, ou joueur non classé
  rankedCount: number;          // pilote le seuil de 20 de la barre collante
};

export async function getLeaderboard(sortKey: SortKey): Promise<LeaderboardData>;
```

Le **tri**, le **rang** et le **départage** sont calculés **côté serveur** dans ce module ; les
composants ne font que rendre.

### 15.2 `lib/queries/bracket.ts`

```ts
/** Un groupe de joueurs ayant fait le même pronostic sur une série. */
export type SeriesPickGroup = {
  teamAbbreviation: string;
  seriesFormat: string | null;  // null en NBA Cup (match sec)
  count: number;
  percentage: number | null;    // null si ≤ 10 brackets remplis SUR CETTE SÉRIE
  players: string[];            // pseudos ; VIDE avant la deadline
};

export type BracketNode = {
  nodeId: string;
  round: string;
  conference: "EAST" | "WEST" | null; // null = finale croisée, ou NBA Cup
  teamA: { abbreviation: string; name: string } | null; // null = pas encore déterminé
  teamB: { abbreviation: string; name: string } | null;
  actualWinnerAbbreviation: string | null; // état réel
  filledBracketsCount: number;
  groups: SeriesPickGroup[];    // VIDE avant la deadline
};

export type BracketRound = { key: string; label: string; nodes: BracketNode[] };

export type BracketData = {
  competitionId: string | null;
  competitionType: "PLAYOFFS" | "NBA_CUP";
  deadline: string | null;      // ISO
  isDeadlinePassed: boolean;    // pilote §13 (tendances + noms)
  isStructureKnown: boolean;    // false = Cup avant qualification des 8
  rounds: BracketRound[];
  filledCount: number;          // progression X/15 ou X/7
  totalCount: number;
};

export async function getBracket(): Promise<BracketData>;
```

**Impératif** : quand `isDeadlinePassed === false`, `groups` et `players` sont **vides côté
serveur** — la confidentialité ne repose pas sur un `if` de rendu.

## 16. États vides — libellés **exacts**

| Cas | Titre | Sous-titre |
|---|---|---|
| Aucune compétition active | Aucune compétition en cours | La prochaine arrive bientôt. |
| Classement sans aucun joueur classé | Personne n'a encore marqué | Le classement s'affichera dès les premiers pronos. |
| Bracket avant deadline | Les brackets arrivent | Les brackets des joueurs seront visibles après la deadline. |
| Cup avant qualification des 8 | La phase finale n'est pas encore définie | Les 8 qualifiés seront connus fin novembre. |
| Série sans bracket rempli | *(inline)* | Aucun bracket rempli sur cette série |

Cohérence assumée avec l'Accueil : « Aucune compétition en cours » est le **même libellé**
partout.

## 17. Règles de rendu communes (T7 — non négociables)

- **vert (`--color-win`) / rouge (`--color-loss`) = RÉSULTAT gagné/perdu uniquement.** Jamais
  pour un statut, une urgence, un tri ou une action.
- **Or (`--color-champion`) = champion** : légitime sur le bracket (champion déduit), nulle
  part ailleurs.
- **`--color-trend`** = registre admin / tendance neutre (badge de correction, blocs admin).
- **Aucune pénalité négative** nulle part.
- **Pivot A1** sur les points : `null` → « - » ; `0` → « 0 » ; en attente → marqueur neutre.
- Joueur inactif : `--opacity-inactive`. Élément annulé/neutralisé : `--opacity-cancelled`,
  **jamais rouge**.
- Tous les chiffres en `tabular-nums`. Cible tactile ≥ `--tap-target-min`.
- **Aucune valeur visuelle en dur** : tout via `app/tokens.css`.

## 18. Hors périmètre

- **Realtime** sur ces deux écrans : **non en V1**, SSR uniquement (comme l'Accueil). Le
  classement bouge par salves après les matchs ; un rafraîchissement à la navigation suffit.
  Le live reste réservé à l'écran Matchs.
- **Écran de remplissage** du bracket (lot ultérieur).
- **Compétitions archivées** (backlog).
- **Tri alphabétique** du classement (différé, interprétation actée).
- `?serie=` pour le drill-down (ajoutable plus tard).

## 19. Récapitulatif des décisions

| # | Décision | § |
|---|---|---|
| 1 | Bascule vue B : bouton + rotation portrait→paysage, jamais d'après l'état au chargement | §10.2 |
| 2 | Retour portrait : sort si entré par rotation, reste si choix explicite ; `replace` vs `push` | §10.2 |
| 3 | Invitation à tourner : 3 issues, jamais bloquante (rotation verrouillée OS) | §10.3 |
| 4 | Drill-down **nominatif**, inline en vue A / feuille en vue B, groupé par prono | §11 |
| 5 | Total déplacé après le joueur, filet `--color-border-subtle`, emphase graisse vs teinte | §4 |
| 6 | Marqueur « corrigé » : badge `--color-trend` au pseudo + « sur requête » en expansion | §7 |
| 7 | Bracket avant deadline : structure + compte à rebours, ni tendance ni nom | §13 |
| 8 | NBA Cup : vainqueurs seuls, X/7, groupement par tour (pas de conférence) | §14 |
| 9 | « Jamais joué » absent du classement ; « inactif » conservé et classé | §8 |
| 10 | Ex-aequo : 1, 2, 2, 4 | §9 |
| 11 | Pas de Realtime en V1 | §18 |
| 12 | **Corrigé 13/08/2026** — en-têtes cliquables avec flèche de tri, `SortChips` retiré (doublon visuel avec les en-têtes) | §4.2/§5 |
| 13 | **Corrigé 14/08/2026** — bascule croissant/décroissant (`?ordre=`), en plus du choix de colonne | §5 |

> Rappel de méthode, pas une question : les **noms de colonnes** et **valeurs de statut** sont
> à lire dans le schéma réel à l'implémentation. Cette spec décrit l'intention et fige les
> contrats de types ; elle ne présume aucun nom.
