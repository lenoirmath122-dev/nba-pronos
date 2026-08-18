# NBA Pronos — SPEC REFONTE ONGLET JOUER V0.1

> **Statut** : **IMPLÉMENTÉE, pas encore vérifiée au clic** — cadrage
> conversationnel puis les 4 vérifications de dépôt (§13) le 18/08/2026,
> code écrit dans la foulée le même jour. `tsc`/`eslint`/`vitest`
> (37/37)/`next build` (34 routes) propres — voir `ETAT_ACTUEL.md` §2.72
> pour le détail complet, dont 2 corrections trouvées en codant (bouton
> Supprimer un pari sans point d'entrée dans le nouveau design ; redirection
> de correction de pari en dur, cassée par la coexistence des 2 onglets).
> Reste à vérifier en conditions réelles (session authentifiée), voir
> `GAPS_OUVERTS.md`.
> **Portée** : remplace/fusionne quatre écrans existants et fermés
> (`SPEC_ECRAN_HUB_JOUER_V0_1`, `SPEC_ECRAN_MATCHS_V0_1`,
> `SPEC_ECRAN_MES_PRONOS_V0_1`, `SPEC_ECRAN_MES_PARIS_V0_1`) par **deux
> onglets** + un point d'entrée permanent vers l'écran Bracket (inchangé,
> `SPEC_ECRAN_BRACKET_PERSONNEL_V0_1`). Cette spec ne réécrit **rien** de ce
> que les quatre specs sources ont déjà tranché sur le fond (rampe de statut,
> quotas, règles de correction, confidentialité, C2…) — elle les référence et
> ne documente que ce qui **change** : la découpe des écrans et le
> rattachement pari↔match.
>
> **Trois décisions actées avec l'utilisateur (18/08/2026)** :
> 1. **Fusion totale** (pas seulement les matchs) : les paris personnels
>    (paris MATCH) rejoignent les deux onglets ; seuls les paris SÉRIE restent
>    exclusivement sur le Bracket.
> 2. **Pas de hub à cartes** : `/play` ouvre directement sur l'écran, avec
>    deux onglets internes (« Mes pronos » / « Résultats ») — un niveau de
>    navigation en moins par rapport au hub 2×2 actuel.
> 3. **Le MATCH décide toujours l'onglet**, jamais le statut du pari. Un pari
>    REJETÉ sur un match à venir reste affiché dans « Mes pronos » ; un pari
>    VALIDÉ non résolu sur un match déjà dans « Résultats » y reste, avec
>    l'action de signalement toujours disponible là où il est.

## 0. Sources et cadre

| Sujet | Source | Ce qu'elle impose ici |
|---|---|---|
| Rampe de statut prono, C2, confidentialité, live | `SPEC_ECRAN_MATCHS_V0_1`, `SPEC_ECRAN_MES_PRONOS_V0_1` | reconduits **tels quels** (§4/§5/§8 respectivement) |
| Statuts de pari, quotas, correction « pari oublié » | `SPEC_ECRAN_MES_PARIS_V0_1` §4/§5/§7 | reconduits **tels quels** |
| Fenêtre 3 jours Matchs / Récent | `SPEC_ECRAN_MATCHS_V0_1` §2, `SPEC_ECRAN_MES_PRONOS_V0_1` §4.1 | **fusionnées** en une seule fenêtre « Mes pronos », §3.1 |
| Ancrage sur les matchs, jamais sur les pronos/paris | `SPEC_ECRAN_MES_PRONOS_V0_1` §3 | **étendu** aux paris MATCH (décision 3 ci-dessus) — c'est l'application du même principe, pas une règle nouvelle |
| Filtrer sur l'heure, jamais sur `matches.status` | `SPEC_ECRAN_MATCHS_V0_1` §2, rappelé T4/A8 | **non négociable**, structure toute la fenêtre §3.1 |
| Paris SÉRIE, proposition et affichage | `SPEC_ECRAN_BRACKET_PERSONNEL_V0_1`, `NodeCard.tsx` | inchangé, hors périmètre de cette spec (§10) |
| Couleurs / rayons | T7 | vert/rouge = résultat uniquement ; reconduit tel quel |

**Conventions** : identiques au reste du projet (TypeScript strict, App
Router, composants serveur par défaut, CSS Modules sur les tokens de
`app/tokens.css`, aucune valeur en dur).

---

## 1. Pourquoi cette refonte

Le hub actuel (`app/(app)/play/page.tsx`, grille 2×2) sépare Matchs / Mes
pronos / Bracket / Paris par **type d'objet**. Deux frictions observées par
l'utilisateur :

- **Duplication réelle** entre l'écran Matchs (`scheduled_at > now()`) et le
  segment « Récent » de Mes pronos (`scheduled_at` dans les 3 jours
  précédents) — deux endroits qui montrent des matchs à des joueurs qui n'ont
  pas fini de « suivre » l'échéance.
- **Le pari est éclaté sur un troisième écran** (`/play/bets`) alors qu'il
  concerne le même match que le prono qu'on regarde déjà.

La refonte re-tranche sur l'axe **temporel** (à suivre / réglé) plutôt que
sur le type d'objet, et rattache le pari à son match plutôt qu'à un écran à
part.

---

## 2. Architecture

```text
app/(app)/play/page.tsx
    → devient l'écran « Mes pronos » (à suivre). Remplace l'ancien hub ET
      l'ancien app/(app)/play/matches/page.tsx ET le segment « Récent » de
      l'ancien app/(app)/play/my-predictions/page.tsx.

app/(app)/play/results/page.tsx                                    NOUVEAU
    → écran « Résultats ». Remplace le segment « Historique » de l'ancien
      my-predictions ET le segment « Terminés » de l'ancien
      app/(app)/play/bets/page.tsx.

app/(app)/play/matches/                                            SUPPRIMÉ
app/(app)/play/my-predictions/                                     SUPPRIMÉ
app/(app)/play/bets/page.tsx (INDEX seul)                          SUPPRIMÉ
app/(app)/play/bets/new/, app/(app)/play/bets/[id]/edit/            INCHANGÉS
    → toujours de vraies pages (formulaire pop-up, cf. §2.68
      ETAT_ACTUEL.md), toujours atteignables depuis une ligne de Mes
      pronos ou Résultats, exactement comme aujourd'hui depuis Matchs/
      Mes paris.
app/(app)/play/bracket/                                            INCHANGÉ

lib/queries/play.ts                                                 NOUVEAU
    → fusionne lib/queries/matches.ts + lib/queries/my-predictions.ts +
      la partie MATCH de lib/queries/my-bets.ts (§9). Un seul module de
      lecture pour les deux onglets (même sélection de base, cf. §3),
      nommé d'après la route comme la convention du projet l'exige
      (« Mes pronos »/« Résultats » vivent sous /play, pas sous un nom
      métier séparé).
lib/queries/matches.ts, lib/queries/my-predictions.ts               SUPPRIMÉS
    (logique absorbée dans play.ts — pas de doublon transitoire)
lib/queries/my-bets.ts
    → CONSERVÉ, mais réduit à ce qui sert encore ailleurs : le calcul de
      quota (QuotaSummary, réutilisé tel quel par play.ts, §9) et toute
      logique consommée par home.ts (badges, feed Accueil). La liste
      complète des paris (ongoing/finished) qu'il exposait aujourd'hui est
      remplacée par la sélection de play.ts — à vérifier au pré-vol (§13)
      si d'autres appelants existent avant de retirer quoi que ce soit.

components/play/PlayTabs.tsx                                        NOUVEAU
    → bascule Mes pronos/Résultats, état dans l'URL (même patron que
      SegmentTabs existant), pas de composant client.
components/play/BracketEntry.tsx                                    NOUVEAU
    → point d'entrée permanent vers le Bracket, §4. Alimenté par
      getBracketFillData() + getRemainingSeriesBets(), réutilisées TELLES
      QUELLES (déjà le patron de lib/queries/play-hub.ts, qui documente
      explicitement pourquoi ne pas les redupliquer).

components/matches/ValidateAllBanner.tsx                            INCHANGÉ
components/matches/MatchDayGroup.tsx → adapté pour porter aussi le pari
components/my-predictions/MatchRowStatic.tsx → fusionné avec MatchDayGroup
    (les deux rendent une ligne match ; devenir une seule famille de
    composants pour l'onglet Mes pronos et l'onglet Résultats, avec une
    prop d'éditabilité plutôt que deux implémentations parallèles — à
    trancher précisément en codant, §13)
components/my-bets/QuotaBanner.tsx                                   INCHANGÉ
components/my-bets/MyBetRow.tsx → logique d'actions reprise par le bloc
    pari intégré à la ligne match (plus de ligne dédiée à un pari seul,
    sauf paris SÉRIE qui n'apparaissent plus ici du tout, §10)
components/bets/InlineBetForm.tsx, BetFormModal.tsx                 INCHANGÉS

components/nav/TabBar.tsx                                            INCHANGÉ
    (l'onglet bas « Jouer » pointe toujours vers /play — seul ce qu'il y a
    DERRIÈRE change)
```

### 2.1 Recensement des liens entrants — vérification §13.4, levée

Catalogue exhaustif (grep sur `/play/matches`, `/play/my-predictions`,
`/play/bets` hors `/play/bets/new` et `/play/bets/[id]/edit`, qui restent
inchangés) :

```text
ÉCRITURE (revalidatePath / redirect à retargeter) :
  lib/actions/matches.ts          3× revalidatePath("/play/matches")
                                   → revalidatePath("/play")
  lib/actions/bets.ts              3× paire ("/play/bets", "/play/matches")
                                   → paire ("/play", "/play/results") — un
                                     pari peut désormais être écrit depuis
                                     N'IMPORTE LEQUEL des deux onglets
                                     (bloc pari en lecture/écriture dans
                                     les deux, §3.3/§5.2), donc les DEUX
                                     chemins doivent être invalidés, pas
                                     un seul comme aujourd'hui.
  lib/actions/corrections.ts       revalidatePath("/play/my-predictions")
                                   → revalidatePath("/play") ET
                                     revalidatePath("/play/results") (une
                                     correction de prono peut viser un
                                     match des deux fenêtres) ; le
                                     paramètre `returnTo` (déjà présent,
                                     porte l'onglet d'origine dans l'URL)
                                     reste le mécanisme de redirection —
                                     rien à changer là.
  lib/actions/bet-corrections.ts   revalidatePath("/play/bets") + 2×
                                   redirect("/play/bets"...) codés en dur
                                   → À ALIGNER sur le patron `returnTo` de
                                     corrections.ts (absent ici aujourd'hui,
                                     alors que les deux formulaires sont
                                     désormais cousins sur le même écran) :
                                     sans ça, une correction de pari
                                     déposée depuis Résultats renverrait
                                     à tort vers Mes pronos.
  lib/actions/admin-results.ts     revalidatePath("/play/matches") +
                                   revalidatePath("/play/my-predictions")
                                   → revalidatePath("/play") +
                                     revalidatePath("/play/results")

LECTURE (hrefs à retargeter) :
  lib/queries/home.ts   "/play/matches#match-${matchId}" → "/play#match-${matchId}"
                         "/play/matches"                 → "/play"
                         "/play/bets" (hasDraft)          → "/play" — SANS
                           ambiguïté malgré les apparences : un DRAFT/
                           SUBMITTED ne peut exister QUE tant que
                           bet_deadline_open() est vrai (§3.3 corrigé), donc
                           son match est TOUJOURS encore dans la fenêtre
                           Mes pronos, jamais dans Résultats. Décision 3
                           (le match décide) résout ce cas sans nouvelle
                           règle.
                         "/play/bets/new" (hasDraft=false) → inchangé
  lib/reminders/matchesReminder.ts   url: "/play/matches" → "/play"
  components/my-predictions/urls.ts  BASE_PATH en dur "/play/my-predictions"
                         → À PARAMÉTRER sur l'onglet actif ("/play" ou
                           "/play/results"), consommé par PlayTabs ET par
                           FilterBar (qui pointe aujourd'hui son <form
                           action="/play/my-predictions">, même souci) —
                           ces deux fichiers ne peuvent plus coder un
                           chemin unique en dur du tout.
  components/my-bets/SegmentTabs.tsx "/play/bets?segment=ONGOING/FINISHED"
                         → COMPOSANT REMPLACÉ par PlayTabs (§2), pas une
                           simple substitution de href — la segmentation
                           par STATUT de pari disparaît en tant que
                           navigation autonome (§5.3).

INCHANGÉS (à ne pas toucher) :
  lib/queries/my-bets.ts (liens vers /play/bets/new, création)
  components/bracket/NodeCard.tsx (/play/bets/new, /play/bets/[id]/edit)
  components/my-bets/MyBetRow.tsx (/play/bets/[id]/edit)
  components/bets/BetFormModal.tsx, components/my-predictions/AssociatedBetCard.tsx
    (mentions en commentaire seulement, à corriger par confort de lecture,
    aucun impact fonctionnel)
```

### 2.2 Garde C2 — vérification §13.2, levée : EXTENSION NÉCESSAIRE

`InlineBetForm.tsx`/`BetFormModal.tsx` **n'appellent `useUnsavedGuard`
nulle part** — seul `components/matches/PredictionForm.tsx` le fait
aujourd'hui (`markDirty`/`clearDirty` sur la clé `match.matchId`,
`lib/hooks/useUnsavedGuard.tsx` §126). Sans changement, une saisie de pari
en cours serait perdue silencieusement en changeant d'onglet — un risque
qui n'existait pas avant (le pari vivait sur son propre écran, sans
formulaire de prono à côté pour donner envie de changer d'onglet en cours
de saisie).

**À faire en codant, pas un point ouvert produit** : ajouter
`useUnsavedGuard(...)` dans `InlineBetForm`, sur une clé **distincte** de
celle du prono du même match (ex. `` `bet:${matchId ?? seriesId}` `` vs
`matchId` tout court) — sinon les deux formulaires partageraient le même
verrou et écraseraient l'état `dirty` l'un de l'autre.

### 2.3 Autres appelants de `getMyBets` — vérification §13.1, levée

Un seul appelant hors sa propre définition : `app/(app)/play/bets/page.tsx`
(qui disparaît, §2). Aucun autre fichier du dépôt n'importe `getMyBets` —
la réduction de périmètre annoncée en §2 (garder seulement le calcul de
quota) peut se faire sans épargner d'appelant supplémentaire.

Aucune migration base nécessaire : cette refonte est une recomposition de
lecture/rendu, aucune règle d'écriture (`save_bet`, `validateMatchPrediction`,
`requestPredictionCorrection`, `requestBetCorrection`) ne change.

---

## 3. Onglet « Mes pronos » (à suivre)

### 3.1 Sélection — fusion des deux fenêtres existantes

```text
matches.scheduled_at IS NOT NULL
  AND matches.scheduled_at >= now() − 3 jours
```

**Pas de borne haute.** C'est l'union exacte de l'ancien Matchs
(`scheduled_at > now()`) et de l'ancien Récent (`scheduled_at` entre
`now()−3j` et `now()`) — les deux fenêtres qui, ensemble, couvraient déjà
« six jours glissants sans trou ni doublon » (`SPEC_ECRAN_MES_PRONOS_V0_1`
§4.1). On ne change pas la largeur de fenêtre, on arrête juste de la couper
en deux écrans.

Toujours **filtré sur l'heure, jamais sur `matches.status`** — même
justification qu'avant (latence du planificateur, T4/A8) : un match qui
vient de démarrer reste ici (badge EN DIRECT, §3.4), il n'en sort qu'après
le délai de 3 jours.

> **Point à trancher, mineur, pas encore posé à l'utilisateur** : un match
> vieux de 3 jours mais toujours `IN_PROGRESS` (report, prolongation
> improbable en NBA mais un décalage de synchro reste possible) basculerait
> quand même en Résultats à J+3, potentiellement avant son vrai coup de
> sifflet final. Cas limite déjà theoriquement présent dans l'ancien
> découpage Récent/Historique (jamais observé en pratique) — reconduit à
> l'identique, pas aggravé par la fusion. À noter en gap si ça se produit
> réellement.

### 3.2 Contenu par ligne — fusion Matchs + Mes pronos

Reprend la ligne repliée/dépliée de `SPEC_ECRAN_MATCHS_V0_1` §3 pour un match
pas encore commencé (saisie du vainqueur/écart, §5/§6 de cette spec-là,
inchangées), et bascule sur le rendu figé de `SPEC_ECRAN_MES_PRONOS_V0_1` §6
dès que le match est verrouillé (`scheduled_at <= now()`) — **c'est déjà
exactement la logique que `viewStatus`/`MyPredictionState` encodent
séparément aujourd'hui**, il n'y a rien de nouveau à calculer, seulement à
rendre dans un seul écran au lieu de deux.

```text
- l'affiche (logos + abréviations) ;
- le numéro de match dans la série ;
- l'heure / le verrou / le badge EN DIRECT + score courant (§5.1
  MES_PRONOS, live toujours absent avant verrouillage, §11 MATCHS) ;
- MON prono : saisissable si pas verrouillé (§5/§6/§7 MATCHS), figé sinon
  (les trois états FROZEN/INCOMPLETE/MISSING, §8 MES_PRONOS) ;
- mes points, « — » tant que non scoré (toujours vrai ici : un match dans
  cette fenêtre n'est jamais scoré depuis plus de 3 jours) ;
- panneau « valider = voir » (verrouillé) ou raccourci pari (pas encore
  verrouillé) — panneau replié par défaut, comme aujourd'hui ;
- le bloc pari associé, §3.3.
```

### 3.3 Bloc pari associé — désormais ÉDITABLE ici

C'est le changement de fond de la fusion (décision 1). Le rappel de pari,
purement lecture seule dans l'ancien Mes pronos (§11.4 de cette spec :
« l'écran reste un écran de pronos »), devient l'écran où on **agit** sur le
pari :

```text
Aucun pari sur ce match, slot disponible (betSlot, §10 MATCHS)
    → CTA « Parier » → ouvre BetFormModal, UNIQUEMENT tant que le match
      n'est pas verrouillé (scheduled_at > now()).

**Correctif du 18/08/2026 (vérification de dépôt §13.3)** : contrairement à
ce que cette spec supposait initialement, la deadline d'un pari MATCH n'est
PAS indépendante de celle du prono — `bet_deadline_open()`
(`supabase/migrations/20260718110000_rls.sql` §100-112), consommée à la
fois par la RLS (`bets_insert`/`bets_update_self`) et par `save_bet`/
`submit_bet` (`20260726130000_bet_write_functions.sql` §97/§161), ferme
l'écriture d'un pari MATCH exactement à `scheduled_at > now()` — **le même
instant que le verrouillage du prono**, pas un délai propre. (Un pari
SÉRIE, lui, reste ouvert jusqu'au 1er match de la série — mais il ne vit
que sur le Bracket, §6, hors périmètre ici.)

**Conséquence directe pour Mes pronos** : dès qu'un match entre dans la
fenêtre « verrouillé » (§3.1), le CTA « Parier »/« Modifier le pari »
disparaît — plus aucune écriture n'est possible dessus, le serveur la
rejetterait de toute façon (RLS silencieuse, §16.6 MES_PRONOS). Un pari
DRAFT/SUBMITTED existant sur un match qui vient de se verrouiller devient
donc lecture seule dans le même mouvement que le prono — pas de fenêtre où
l'un est encore éditable et l'autre non.

Pari DRAFT/SUBMITTED (match pas encore verrouillé)
    → rendu + actions Modifier/Reproposer/Supprimer/Envoyer (patron
      MyBetRow.tsx repris tel quel), plus le formulaire de correction
      « pari oublié » si déjà éligible (rare ici, un match récent est
      encore FINISHED depuis peu — possible malgré tout, §7 MES_PARIS
      reconduit sans changement).

Pari VALIDATED/REJECTED/WON/LOST/CANCELLED
    → rendu lecture seule selon la rampe §5 MES_PARIS (statuts, couleurs,
      barré/grisé), reconduite À L'IDENTIQUE — un REJETÉ reste ici tant
      que SON match est dans cette fenêtre (décision 3), même si le pari
      lui-même est « terminé ».
```

Le résumé de quota (`QuotaBanner`, §4 MES_PARIS) migre en bandeau global en
tête de l'onglet — même contrat, même composant, juste déplacé du haut de
`/play/bets` au haut de `/play`.

### 3.4 Bandeau « Tout valider »

Reconduit à l'identique (`ValidateAllBanner`, §9 MATCHS) : n'apparaît que
s'il existe au moins un brouillon **complet** parmi les matchs pas encore
verrouillés de cette fenêtre.

---

## 4. Point d'entrée Bracket — permanent, dans l'en-tête

Décision 2 (§ préambule) : pas de 3ᵉ onglet, un bouton/pastille fixe dans
l'en-tête de l'écran, visible sur Mes pronos **et** Résultats.

```text
┌───────────────────────────────────────┐
│ Jouer                      [Bracket ›]│  ← reprend filledCount/totalCount
├───────────────────────────────────────┤     ou l'alerte deadline, EXACTEMENT
│ [Mes pronos]     [Résultats]           │     ce que rendait la carte
├───────────────────────────────────────┤     PlayHubCard "Mon bracket"
```

`components/play/BracketEntry.tsx` consomme `getBracketFillData()` +
`getRemainingSeriesBets()` sans réimplémenter leur calcul (même réutilisation
que documentée dans `lib/queries/play-hub.ts`, §2 de ce fichier).

---

## 5. Onglet « Résultats »

### 5.1 Sélection

```text
matches.scheduled_at < now() − 3 jours
```

Exactement l'ancien segment « Historique » de Mes pronos (§4.1
`SPEC_ECRAN_MES_PRONOS_V0_1`), reconduit tel quel : tri anti-chronologique,
plafond 40 lignes + « Charger plus » (§4.4), filtres date/série/ligue (§4.2,
`FilterBar`/`LeagueScopeChips` inchangés).

### 5.2 Contenu par ligne

Rendu figé identique à l'ancien Mes pronos §6/§8/§9 (prono + points + panneau
déplié des autres joueurs) **plus** le bloc pari associé, rendu en lecture
seule **sauf** l'action « Signaler à un admin » du cas « pari oublié »
(§7 `SPEC_ECRAN_MES_PARIS_V0_1`), qui reste active ici — c'est précisément
le cas d'un pari VALIDÉ sur un match déjà dans cet onglet mais jamais résolu
(décision 3).

### 5.3 Ce qui ne change PAS de segmentation

Le découpage « En cours »/« Terminés » de l'ancien Mes paris **disparaît en
tant que segmentation autonome** : il devient une conséquence de la
segmentation par match. Un pari WON/LOST/REJECTED/CANCELLED sur un match
récent (< 3 jours) reste visible dans Mes pronos, pas dans Résultats — cas
réel (ex. un pari REJETÉ juste avant le coup d'envoi), assumé par la
décision 3.

---

## 6. Paris SÉRIE — exclusivement Bracket

Aucun changement de fond : un pari SÉRIE n'a pas de `match_id`, ne peut donc
apparaître ni dans Mes pronos ni dans Résultats. Ce qui change : le
`SeriesBetHeader` que l'ancien Mes pronos affichait quand on filtrait par
`?series=` (§11.2 `SPEC_ECRAN_MES_PRONOS_V0_1`) est **retiré** — plus aucune
apparition d'un pari série en dehors du Bracket, conformément à la demande
initiale de l'utilisateur (« les paris séries eux, sont visibles seulement
sur la partie bracket »).

---

## 7. Confidentialité, live, C2 — inchangés

Reconduits sans modification depuis les specs sources :

```text
- confidentialité « valider = voir » par match, RLS seule autorité (§12
  MES_PRONOS, §8 MATCHS) ;
- live porté uniquement sur un match verrouillé (§5 MES_PRONOS), toujours
  absent avant (§11 MATCHS) — la fusion ne change pas CETTE frontière-là,
  seulement l'écran qui l'affiche ;
- garde C2 (saisie non enregistrée) : toujours actif sur le formulaire de
  prono ; à étendre au formulaire de pari inline s'il ne l'est pas déjà
  (à vérifier au pré-vol, §13) puisque les deux formulaires coexistent
  maintenant sur le même écran.
```

---

## 8. Couche de lecture — contrat de types (esquisse)

`lib/queries/play.ts` — fusion de `MatchCard`/`MyPredictionRow` (données
match+prono, inchangées dans leur forme) avec un type de pari unifié qui
couvre TOUS les statuts (plus seulement DRAFT/SUBMITTED comme l'ancien
`MyMatchBet` de Matchs) :

```ts
// Réutilisés tels quels, à importer, jamais redéfinir (même règle que
// SPEC_ECRAN_MES_PRONOS_V0_1 §13 pour TeamRef) :
//   TeamRef, OtherPrediction, PredictionViewStatus, MatchLiveState,
//   MyPredictionState, AdminCorrection, CorrectionRequestState,
//   QuotaSummary (my-bets.ts)

/** Pari MATCH associé à une ligne — TOUS statuts (décision 3 : le match
 *  décide de l'onglet, le pari garde son propre statut, quel qu'il soit). */
export type PlayAssociatedBet = {
  betId: string;
  description: string;
  category: BetCategory;
  difficulty: BetDifficulty;         // validated ?? proposed, la validée fait foi
  status: "DRAFT" | "SUBMITTED" | "VALIDATED" | "REJECTED" | "WON" | "LOST" | "CANCELLED";
  isAdminCorrected: boolean;
  refusalReason: string | null;
  resolutionReason: string | null;
  pointsAwarded: number | null;
  isForgottenResolution: boolean;    // §5.2 — action "Signaler" encore active
  hasPendingCorrectionRequest: boolean;
  reproposeHref: string | null;      // REJECTED + pas encore expiré
};

export type PlayMatchRow = {
  matchId: string;
  seriesId: string;
  scheduledAt: string;
  home: TeamRef;
  away: TeamRef;
  homeScore: number | null;
  awayScore: number | null;
  liveState: MatchLiveState;
  isLocked: boolean;                 // scheduled_at <= now() — pilote saisie vs figé
  viewStatus: PredictionViewStatus;  // avant verrouillage
  predictionState: MyPredictionState | null; // après verrouillage
  myWinnerTeamId: string | null;
  myMargin: number | null;
  points: number | null;
  correctionRequest: CorrectionRequestState | null;
  isRevealed: boolean;
  others: OtherPrediction[];         // vide si !isRevealed
  absenteeCount: number;
  predictedCount: number;
  eligibleCount: number;
  betSlot: BetSlotIndicator;         // §10 MATCHS, inchangé
  bet: PlayAssociatedBet | null;
};

export type PlayTab = "UPCOMING" | "RESULTS";

export type PlayData = {
  competitionId: string | null;
  tab: PlayTab;
  rows: PlayMatchRow[];              // triés : EN DIRECT en tête (§5.2 MES_PRONOS),
                                      // puis chronologique croissant (UPCOMING) ou
                                      // anti-chronologique (RESULTS)
  quotas: QuotaSummary[];            // UPCOMING uniquement, bandeau §3.3
  readyCount: number;                // UPCOMING uniquement, pilote §3.4
  hasMore: boolean;                  // RESULTS uniquement, pagination §5.1
  availableDates: string[];
  availableSeries: { id: string; label: string }[];
};

export async function getPlayData(params: {
  tab: PlayTab;
  date?: string;
  seriesId?: string;
  limit?: number;
  leagueId?: string | null;
}): Promise<PlayData | null>;
```

---

## 9. Écriture — aucune nouvelle server action

Toutes les écritures existent déjà et sont réutilisées sans modification :

```text
saveMatchPredictionDraft / validateMatchPrediction   (prono)
requestPredictionCorrection                          (correction prono)
saveBet / submitBet / withdrawBet / deleteBet         (pari, lib/actions/bets.ts)
requestBetCorrection                                  (correction pari, §7 MES_PARIS)
```

Seuls les `revalidatePath` changent de cible (`/play` et `/play/results` au
lieu des quatre routes actuelles).

---

## 10. Hors périmètre

```text
- Paris SÉRIE : proposition, affichage, cycle de vie — entièrement sur
  Bracket, cette spec n'y touche pas (§6).
- Révélation publique des paris des autres joueurs (0.2.4 §9) — toujours
  reportée, GAPS_OUVERTS.md, indépendant de cette refonte.
- Contester un pari REJETÉ ou déjà résolu — toujours hors périmètre (§7
  MES_PARIS, terminal dans enforce_bet_transitions).
- Écran Bracket lui-même — inchangé, seul son POINT D'ENTRÉE change (§4).
- Toute nouvelle règle de scoring, de quota, ou de deadline — cette spec
  ne fait que recomposer l'affichage de règles déjà actées ailleurs.
```

---

## 11. États vides — à réconcilier

```text
Aucune compétition ACTIVE        → « Aucune compétition en cours. » (inchangé)
Mes pronos vide                  → à rédiger : fusion de « Aucun match à
                                    pronostiquer » (MATCHS §15) et « Aucun
                                    match verrouillé ces trois derniers
                                    jours » (MES_PRONOS §15.2) — un seul
                                    message, cette fenêtre n'a plus deux
                                    sources.
Résultats vide (début de saison) → « Aucun match verrouillé pour l'instant. »
                                    (MES_PRONOS §15.3, reconduit)
Filtre sans résultat             → « Aucun match pour ce filtre. » (inchangé)
```

À trancher précisément en rédigeant l'écran — pas un point structurant, mais
les libellés exacts n'ont pas encore été écrits pour le cas fusionné.

---

## 12. Récapitulatif des décisions actées (18/08/2026)

| # | Décision |
|---|---|
| 1 | Fusion **totale** : paris MATCH rejoignent les deux onglets, paris SÉRIE restent exclusivement au Bracket |
| 2 | **Pas de hub à cartes** : `/play` ouvre directement sur des onglets internes (Mes pronos / Résultats) |
| 3 | **Le match décide toujours l'onglet**, jamais le statut du pari — le pari garde son statut propre, y compris quand il « détonne » avec la fenêtre de son match |
| 4 | Fenêtre Mes pronos = **union exacte** des anciennes fenêtres Matchs (à venir) et Récent (verrouillé < 3j) — aucune nouvelle largeur inventée |
| 5 | Résultats = ancien segment Historique, **tel quel** (tri, pagination, filtres) |
| 6 | Bracket accessible par un **point d'entrée permanent dans l'en-tête**, pas un 3ᵉ onglet, réutilisant `getBracketFillData()`/`getRemainingSeriesBets()` sans recalcul |
| 7 | `SeriesBetHeader` retiré de Mes pronos/Résultats (paris série invisibles hors Bracket) |
| 8 | Aucune nouvelle migration, aucune nouvelle server action |

---

## 13. Vérifications de dépôt — **LEVÉES en lecture seule le 18/08/2026**

```text
1. Autres appelants de getMyBets — LEVÉE, aucun risque : un seul appelant
   (app/(app)/play/bets/page.tsx, qui disparaît). Détail §2.3.
2. Garde C2 sur InlineBetForm/BetFormModal — LEVÉE, EXTENSION REQUISE :
   n'existe pas aujourd'hui (seul PredictionForm.tsx l'utilise). À ajouter
   en codant, clé distincte de celle du prono. Détail §2.2.
3. Deadline réelle d'un pari MATCH sur un match verrouillé — LEVÉE, SPEC
   CORRIGÉE : bet_deadline_open() ferme l'écriture exactement au
   verrouillage du prono (scheduled_at > now()), pas une fenêtre propre
   comme cette spec le supposait initialement. §3.3 corrigée en
   conséquence.
4. Recensement des liens entrants — LEVÉE, catalogue exhaustif en §2.1 :
   5 fichiers d'écriture (revalidatePath/redirect) à retargeter, 5 fichiers
   de lecture (hrefs) à retargeter dont 2 (urls.ts, FilterBar.tsx) à rendre
   paramétrables sur l'onglet actif plutôt qu'à simplement renommer, 1
   composant (my-bets/SegmentTabs.tsx) remplacé plutôt que retargeté.
```

Plus aucun blocage connu avant d'écrire le code.
