# NBA Pronos — SPEC ÉCRAN HUB JOUER V0.1

> **Statut : EN COURS DE VALIDATION (28/07/2026).** Aucune spec n'existait —
> rédigée EN SÉANCE avec l'utilisateur (même patron que
> `SPEC_ECRAN_BRACKET_PERSONNEL_V0_1.md`). Remplace le hub temporaire
> (`ETAT_ACTUEL.md` §2.10, `app/(app)/play/page.tsx`), posé uniquement pour
> disposer d'un chemin de navigation vers les 4 écrans déjà codés.

---

## 0. Sources et cadre

```text
Règle fonctionnelle fondatrice (NON rouvrable) : nba_pronos_decisions_0_2_9_
  ux_ui.md §3 — « Jouer : HUB regroupant Matchs, Bracket, Paris, Mes pronos,
  avec pastilles "à faire" par univers. » Justification actée : les 3 types
  de pronostics ont des rythmes différents (bracket = une fois ; matchs =
  quotidien ; paris = occasionnel) → les regrouper évite de donner le même
  poids visuel à tout.
Admin  : le bloc « À traiter (admin) » vit sur Accueil (0.2.9 §3), PAS ici —
  le hub Jouer est identique pour un joueur et un admin.
Visiteur non connecté : pas de hub Jouer (nav réduite, 0.2.9 §3) — déjà geré
  structurellement par proxy.ts (zone /play protégée, T6a §4.1), rien de
  nouveau à coder pour ce point.
```

---

## 1. Architecture

```text
Route (T6a, groupe (app), gardée par proxy.ts) : /play
  → remplace app/(app)/play/page.tsx (hub temporaire, ETAT_ACTUEL §2.10).

Layout : 4 cartes rectangulaires en grille 2×2 — DÉCIDÉ AVEC L'UTILISATEUR
  (28/07/2026) :
    ligne 1 : Matchs        · Mes pronos
    ligne 2 : Mon bracket   · Paris

Composant SERVEUR par défaut (aucune interaction, juste navigation — tap sur
  une carte = <Link> vers l'écran cible, même patron que le hub temporaire).
  Aucun "use client" attendu : chaque carte affiche des données déjà connues
  au moment du rendu SSR, pas de live nécessaire ici (voir §7).
```

## 2. Contenu par carte — **acté avec l'utilisateur (28/07/2026)**

```text
Principe général : chaque carte = titre + (si quelque chose à montrer)
  UNE pastille "à faire" (nombre) + un aperçu TRÈS COURT (1-2 lignes max) de
  ce qui se passe dans l'onglet correspondant. Réutilise des données DÉJÀ
  calculées ailleurs (lib/queries/{matches,bracket-fill,my-bets,
  my-predictions}.ts) — aucune nouvelle requête lourde, un module de lecture
  DÉDIÉ (lib/queries/play-hub.ts) compose des lectures LÉGÈRES de ces mêmes
  sources plutôt que de réutiliser leurs types complets (qui portent bien
  plus que nécessaire pour une carte).
```

### 2.1 Carte « Matchs » (rythme quotidien)

```text
Source : équivalent léger de getMatches() (lib/queries/matches.ts) — mêmes
  matchs de la fenêtre glissante 3 jours (§2 de SPEC_ECRAN_MATCHS_V0_1),
  mais seulement matchId/scheduledAt/teams/viewStatus, pas others/absentees.
Pastille : nombre de matchs de la fenêtre avec viewStatus != "VALIDATED".
Aperçu   : si pastille > 0, le match le PLUS PROCHE (scheduledAt le plus tôt)
  en une ligne — ex. « BOS - ATL, ce soir ».
Vide     : pastille == 0 (fenêtre vide OU tout déjà validé) → carte réduite
  au titre seul (§3).
```

### 2.2 Carte « Mes pronos » (pure consultation — PAS de pastille « à faire »)

```text
Source : équivalent léger de getMyPredictions() (lib/queries/my-predictions.ts),
  segment RÉCENT uniquement — le match verrouillé le plus RÉCEMMENT scoré
  (prediction.points != null), triée par scheduledAt décroissant.
Pas de pastille (rien à « faire » sur un écran de consultation, cohérent avec
  0.2.9 : cette carte donne du FEEDBACK, pas une action).
Aperçu   : le dernier prono scoré — ex. « Dernier verrouillé : ✓ LAL −6
  (gagné) » ou l'équivalent si le pick était perdant (à figer au code selon
  les libellés déjà utilisés par Mes pronos, pas de nouveau vocabulaire).
Vide     : aucun match verrouillé et scoré à ce jour (début de saison, ou
  aucune participation) → carte réduite au titre seul.
```

### 2.3 Carte « Mon bracket » (rythme unique)

```text
Source : équivalent léger de getBracketFillData() (lib/queries/bracket-fill.ts)
  — filledCount/totalCount/isValidated/deadline/isDeadlinePassed/
  isStructureKnown, sans le détail des 15 séries (inutile ici).
Pastille : "X/15" (ou X/7 en NBA Cup) tant que isDeadlinePassed == false.
Aperçu   : rien de plus par défaut ; si la deadline est PROCHE (< 2 jours,
  seuil à aligner avec Countdown déjà utilisé ailleurs — components/ui/
  Countdown.tsx), une 2e ligne compacte de compte à rebours.
Vide     : aucune compétition active, OU structure du 1er tour pas encore
  officielle (isStructureKnown == false), OU deadline déjà passée (plus
  rien à faire, même si le bracket est incomplet — trop tard) → carte
  réduite au titre seul.
```

### 2.4 Carte « Paris » (rythme occasionnel)

```text
Source : équivalent léger de getMyBets() (lib/queries/my-bets.ts), champ
  `ongoing` uniquement — compte par statut (DRAFT / SUBMITTED), pas le
  détail des paris (quotas, énoncés).
Pastille : total DRAFT + SUBMITTED parmi les paris `ongoing`.
Aperçu   : décompte actionnable, PAS un total brut — ex. « 1 brouillon,
  2 en attente d'admin » (n'affiche que les catégories non nulles).
Vide     : aucun pari DRAFT ni SUBMITTED en cours → carte réduite au titre
  seul (un pari VALIDATED/WON/LOST/REJECTED/CANCELLED ne compte pas comme
  "à faire", cohérent avec ONGOING_STATUSES déjà utilisé par my-bets.ts).
```

---

## 3. État vide — **acté avec l'utilisateur (28/07/2026)**

```text
Quand une carte n'a RIEN à montrer (voir §2.1-2.4), elle affiche UNIQUEMENT
  son titre — PAS de libellé de substitution du type « Rien à faire » ni
  d'état vide dédié. C'est un choix EXPLICITE de l'utilisateur, à ne pas
  confondre avec les états vides des écrans dédiés eux-mêmes (Matchs,
  Bracket, Paris, Mes pronos gardent leurs propres messages d'état vide,
  inchangés — cette règle ne s'applique QU'à la carte du hub).
```

---

## 4. Lecture — contrats de types (esquisse, à figer)

```ts
export type PlayHubMatchesCard = {
  todoCount: number;
  nextMatch: { homeAbbreviation: string; awayAbbreviation: string; scheduledAt: string } | null; // null si todoCount == 0
};

export type PlayHubPredictionsCard = {
  lastScored: { teamAbbreviation: string; margin: number; isWin: boolean; points: number } | null; // null si aucun
};

export type PlayHubBracketCard = {
  filledCount: number;
  totalCount: number; // 15 ou 7
  deadline: string | null; // ISO
  isNearDeadline: boolean; // < 2 jours
  isActionable: boolean; // false = carte réduite au titre (§2.3)
};

export type PlayHubBetsCard = {
  draftCount: number;
  submittedCount: number; // total = pastille ; les 2 comptes alimentent l'aperçu
};

export type PlayHubData = {
  matches: PlayHubMatchesCard;
  predictions: PlayHubPredictionsCard;
  bracket: PlayHubBracketCard;
  bets: PlayHubBetsCard;
};
```

---

## 5. Écriture

```text
Aucune. Écran purement navigationnel — chaque carte est un <Link> vers son
  écran dédié (/play/matches, /play/my-predictions, /play/bracket,
  /play/bets), même cible que le hub temporaire actuel.
```

---

## 6. Règles de rendu (T7 — non négociables)

```text
- CSS Modules colocalisés, tokens de app/tokens.css exclusivement.
- Composant SERVEUR (aucune interaction hormis la navigation native <Link>).
- Grille 2×2 responsive (mobile d'abord, 0.2.9 §1) — 2 colonnes conservées
  même en mobile (contrainte du layout demandé), pas de bascule 1 colonne.
- Aucune valeur visuelle en dur.
```

---

## 7. Hors périmètre de cet écran

```text
- Realtime : aucun besoin identifié (les 4 cartes affichent un instantané
  SSR, rafraîchi à la navigation — même logique que Bracket personnel §10,
  qui avait fait le même constat). Pas d'activation Realtime supplémentaire
  pour ce lot.
- Détail des 4 écrans cibles : inchangés, cette spec ne touche qu'au hub.
- Bloc « À traiter (admin) » : reste sur Accueil (0.2.9 §3), hors périmètre.
```

---

## 8. Vérifications de dépôt — à lever avant la 1re ligne de code

```text
1. Confirmer que app/(app)/play/page.tsx (hub temporaire) est bien le seul
   fichier à remplacer, et que TabBar/layout n'ont rien de spécifique au
   hub temporaire à défaire.
2. Vérifier qu'aucun autre écran ne dépend du contenu actuel de /play
   (ex. lien direct vers le hub depuis Accueil) avant de le réécrire.
```

---

## 9. Récapitulatif des décisions actées (28/07/2026)

```text
A. Layout : grille 2×2, ligne 1 = Matchs/Mes pronos, ligne 2 = Bracket/Paris.
B. État vide par carte : titre seul, jamais de libellé de substitution.
C. Contenu par carte : §2.1-2.4 (pastille + aperçu 1-2 lignes, sources
   légères dédiées plutôt que réutilisation des requêtes complètes).
D. Aucun Realtime, aucune écriture — écran de lecture/navigation pur.
```
