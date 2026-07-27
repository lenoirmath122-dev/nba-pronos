# NBA Pronos — SPEC ÉCRAN BRACKET PERSONNEL (remplissage) V0.1

> **Statut : VALIDÉ (27/07/2026).** Écran de remplissage du bracket, laissé
> HORS PÉRIMÈTRE par `SPEC_ECRAN_CLASSEMENT_BRACKET_V0_1.md` §18 (« Écran de
> remplissage du bracket (lot ultérieur) »). Close après confirmation des 4
> points du §12 (même session). Implémentation autorisée sous réserve du
> pré-vol §11.
>
> Distinct de `/bracket` (vue globale de consultation, PARTAGÉE
> visiteur/joueur, déjà codée) : cet écran est la saisie PERSONNELLE d'un
> joueur connecté sur SON PROPRE bracket.

---

## 0. Sources et cadre

```text
Règles fonctionnelles : nba_pronos_decisions_0_2_2_bracket_initial.md (ouverture,
  deadline, contenu, score de série, validation, cas limites) ;
  nba_pronos_decisions_0_2_9_ux_ui.md §5 (remplissage tour par tour, cascade,
  champion déduit, groupement conférence).
Données   : SPEC_TECHNIQUE_MODELE_DONNEES_V0_1.md §3.9/§3.10 (tables `brackets`,
  `bracket_picks`), `series` (§3.6 — team1_id/team2_id NULL tant que le tour
  n'est pas atteint, next_series_id/next_series_slot pour la cascade).
RLS       : SPEC_TECHNIQUE_RLS_V0_1.md — policies `brackets_insert/update` et
  `bracket_picks_insert/update` DÉJÀ EN PLACE (migration #3), voir §11.
NBA Cup   : `SPEC_ECRAN_CLASSEMENT_BRACKET_V0_1.md` §14 (structure 4 quarts →
  2 demies → 1 finale, pas de score de série, groupement par tour sans
  conférence) — MÊME traitement repris ici pour la cohérence des deux écrans.
Précédent connu (prototype, hors dépôt V1 mais leçon retenue) : un bug réel a
  fait primer le résultat OFFICIEL sur le pronostic du joueur pour dériver les
  candidats des tours 2+, et validait un pick contre les colonnes officielles
  (toujours NULL avant le vrai résultat) au lieu des candidats dérivés — voir
  §5/§11, garde-fou explicite pour ne pas le reproduire.
```

---

## 1. Architecture

```text
Route (T6a, groupe (app), gardée par proxy.ts) :
  /play/bracket   → remplissage du bracket personnel du joueur connecté.
  (déjà référencée, inerte, dans le hub temporaire — ETAT_ACTUEL.md §2.10)

Composants serveur par défaut. Le remplissage tour par tour est interactif
(tap vainqueur, boutons de score) → UNE feuille "use client" pour la carte de
série active, même patron que TeamPicker/MarginStepper de l'écran Matchs
(sous-composants sans "use client" propre, transitivement bundlés par un
ancêtre client).
```

## 2. Ouverture et deadline — **acté (0.2.2 §1/§2)**

```text
Ouverture : le bracket n'existe que si TOUTES les séries du 1er tour sont
  connues officiellement (team1_id/team2_id renseignés sur les 8 séries
  ROUND_1). Sinon : état vide dédié (§8).
Deadline  : `competitions.bracket_deadline` (heure du 1er match des
  playoffs) — RÉUTILISE `bracket_deadline_passed(competition_id)` (migration
  #3), déjà la source de vérité du bracket global. Pas une 3e implémentation.
Après la deadline : lecture seule, aucune saisie possible (RLS s'en charge,
  §11) — redirection ou bandeau informatif vers `/bracket` (vue globale),
  pas un formulaire figé affiché pour rien.
```

## 3. Contenu et cascade — **acté (0.2.2 §4/§8, 0.2.9 §5)**

```text
Par série : vainqueur + score de série (4-0/4-1/4-2/4-3, boutons prédéfinis,
  AUCUNE saisie libre). Score NUL en NBA Cup (matchs secs, pas de série).
Champion NBA / vainqueur Cup : déduit automatiquement du chemin complet du
  bracket (vainqueur de la finale) — jamais un choix séparé.

Cascade (tours 2+) : la série affiche ses 2 équipes CANDIDATES —
  officielles (team1_id/team2_id) pour le 1er tour, DÉRIVÉES des picks du
  JOUEUR sur les 2 séries qui l'alimentent (next_series_id/next_series_slot)
  pour les tours suivants. Tant que les 2 candidates ne sont pas connues
  (l'une des 2 séries feeder n'a pas encore de pick) → lecture seule
  « Équipe à définir — complète les séries précédentes ».

RÈGLE NON NÉGOCIABLE (leçon retenue, cf. §0) : la dérivation des candidats de
  tour 2+ ne lit JAMAIS le résultat OFFICIEL de la série précédente — SEULEMENT
  le pick du joueur sur cette série. Le bracket du joueur reste bâti sur SES
  PROPRES pronostics jusqu'au bout, même si une branche entière s'avère fausse
  au tour précédent (0.2.2 §6 : "les points sont acquis quel que soit
  l'adversaire effectivement rencontré"). Ce cas ("résultat réel connu alors
  que le bracket est encore modifiable") ne peut de toute façon jamais se
  produire : le bracket se verrouille au 1er match des playoffs, avant tout
  résultat de tour 2+ — mais le CODE ne doit pas dépendre de cette
  impossibilité pour être correct.
```

## 4. Modification et validation — **acté (0.2.2 §2/§3)**

```text
Modifiable librement jusqu'à la deadline, MÊME après avoir cliqué
  « Valider » (contrairement aux pronos match — irréversibles après
  validation). Deux états distincts, pas un statut binaire figé :
  - is_validated  : geste volontaire du joueur (bouton), horodaté validated_at.
  - is_auto_validated : posé par le mécanisme de deadline (hors périmètre de
    cet écran, façon sealDeadlines — voir GAPS_OUVERTS.md) si le joueur n'a
    jamais cliqué Valider avant l'heure du 1er match.
« Valider » n'exige PAS un bracket complet (0/15 à 15/15 accepté, cohérent
  avec l'auto-validation) — bouton toujours actif, pas de garde de
  complétude. Popup de confirmation : explique le fonctionnement (reste
  modifiable), PAS un avertissement "définitif" (ce serait faux).

Contenu du popup — **acté (27/07/2026)** :
  Titre   : « Valider ton bracket ? »
  Corps   : « Ton bracket reste modifiable jusqu'à la deadline, même après
             validation — tu peux revenir corriger un pick à tout moment
             avant ça. »
  Boutons : « Annuler » / « Valider »
```

## 5. Écriture — server action(s)

```text
saveBracketPick(seriesId, winnerTeamId, scoreFormat?) :
  upsert sur (bracket_id, series_id) — crée le bracket du joueur au 1er pick
  s'il n'existe pas encore (unique (user_id, competition_id), §11).
  Garde SERVEUR (recalculée, jamais confiée au client) : winnerTeamId DOIT
  être l'une des 2 équipes CANDIDATES de cette série au moment de l'écriture
  (recalcul de la MÊME fonction de cascade que la lecture, §3) — PAS une
  vérification contre series.team1_id/team2_id (toujours NULL pour les
  tours 2+ avant le vrai résultat, piège déjà rencontré §0). scoreFormat
  ignoré/NULL forcé si la compétition est NBA_CUP.

validateBracket() : pose is_validated=true, validated_at=now(). Aucune garde
  de complétude (§4). N'écrase aucun pick existant.

Deadline : RLS (`bracket_picks_insert/update`, `brackets_insert/update`,
  migration #3) porte DÉJÀ la garde `not bracket_deadline_passed(competition_id)`
  ET `user_id = auth.uid()` ET `is_active()` — AUCUNE migration nécessaire
  pour ce lot, contrairement à « Nouveau pari ». Le seul contrôle applicatif
  à écrire est la validité du candidat (ci-dessus), non exprimable en RLS
  (dépend d'une cascade calculée, pas d'une colonne).
```

## 6. Lecture — groupement et navigation — **acté (0.2.9 §5)**

```text
Navigation par TOUR (onglets/segments en haut), 1er tour groupé par
  CONFÉRENCE (Est puis Ouest) — NBA Cup : groupement par tour uniquement
  (pas de conférence, même traitement que la vue globale §14 de
  SPEC_ECRAN_CLASSEMENT_BRACKET_V0_1.md).
Une série = une carte : logos + tap direct sur l'équipe (même patron que
  TeamPicker de l'écran Matchs) + boutons de score juste en dessous.
Barre de progression X/15 (Playoffs) ou X/7 (NBA Cup) : compte les
  bracket_picks du joueur avec vainqueur ET score renseignés (score toujours
  considéré renseigné en NBA Cup, qui n'en a pas).
```

## 7. Couche de lecture — contrats de types (esquisse, à figer)

```ts
export type BracketFillCandidate = {
  teamId: string;
  abbreviation: string;
  name: string;
} | null; // null = pas encore déterminé (cascade incomplète)

export type BracketFillSeries = {
  seriesId: string;
  round: string;
  conference: "EAST" | "WEST" | null; // null = finale/Cup
  teamA: BracketFillCandidate;
  teamB: BracketFillCandidate;
  isSelectable: boolean;        // true seulement si teamA ET teamB connus
  myPick: {
    winnerTeamId: string | null;
    scoreFormat: "4-0" | "4-1" | "4-2" | "4-3" | null; // toujours null en Cup
  };
};

export type BracketFillRound = { key: string; label: string; series: BracketFillSeries[] };

export type BracketFillData = {
  competitionId: string | null;      // null = aucune compétition active
  competitionType: "PLAYOFFS" | "NBA_CUP";
  isStructureKnown: boolean;         // false = 1er tour pas encore officiel (Playoffs) / 8 qualifiés Cup pas encore connus
  deadline: string | null;           // ISO
  isDeadlinePassed: boolean;
  isValidated: boolean;
  isAutoValidated: boolean;
  rounds: BracketFillRound[];
  filledCount: number;
  totalCount: number;                // 15 ou 7
};
```

## 8. États vides — libellés **actés (27/07/2026)**

```text
Aucune compétition active        : « Aucune compétition en cours. » / « La
                                    prochaine arrive bientôt. » (même libellé
                                    que les autres écrans).
Structure pas encore connue       : « Le 1er tour n'est pas encore officiel. »
                                    (Playoffs) / « Les 8 qualifiés ne sont pas
                                    encore connus. » (Cup) — mêmes libellés que
                                    SPEC_ECRAN_CLASSEMENT_BRACKET_V0_1.md §16.
Deadline dépassée                 : « Ton bracket est verrouillé. » + lien
                                    vers /bracket (vue globale).
Série non sélectionnable (cascade
  incomplète)                     : « Équipe à définir — complète les séries
                                    précédentes. »
```

## 9. Règles de rendu (T7 — non négociables)

```text
- CSS Modules colocalisés lisant EXCLUSIVEMENT les tokens de app/tokens.css.
- Composants serveur par défaut ; "use client" limité à la carte de série
  interactive (tap vainqueur + boutons score), justifié feuille par feuille.
- Logos de franchise via components/ui/TeamLogo.tsx (déjà partagé
  Bracket/Matchs/Mes pronos/Nouveau pari).
- Or (--color-champion) réservé au champion déduit en fin de chemin, jamais
  ailleurs sur cet écran (cohérence avec la vue globale, §17 de
  SPEC_ECRAN_CLASSEMENT_BRACKET_V0_1.md).
- Aucune valeur visuelle en dur.
```

## 10. Hors périmètre de cet écran

```text
- Vue globale de consultation (/bracket, déjà codée) : inchangée.
- Auto-validation à la deadline (sealDeadlines-like, mécanisme serveur) :
  hors périmètre, comme pour les pronos match/paris (GAPS_OUVERTS.md).
- Décisions admin sur cas limites (série annulée/reportée, correction de
  donnée avant deadline, 0.2.2 §11) : lot écrans admin.
- Publication Realtime de `series` (T4 §9) — **acté (27/07/2026) : REPORTÉE**,
  toujours pas activée. Aucun besoin live identifié sur CET écran précis
  (remplissage personnel, pas de contenu d'autres joueurs à rafraîchir en
  direct) ; la vue globale (drill-down) fonctionne déjà sans lui en SSR.
```

## 11. Vérifications de dépôt — à lever **avant** la 1re ligne de code

```text
1. RLS `brackets_insert/update` et `bracket_picks_insert/update` (migration
   #3) : confirmées EXISTANTES et suffisantes pour propriétaire/actif/deadline
   (relu §0/§5 de cette spec) — à revérifier au moment de coder que rien n'a
   changé depuis.
2. `bracket_deadline_passed(competition_id)` (migration #3) : confirmée
   réutilisable telle quelle.
3. Existence réelle de la route `/play/bracket` : à vérifier sur le disque
   (aujourd'hui une entrée inerte du hub temporaire).
4. Jeu de données de test (`scripts/seed-playoffs-test-data.mjs`) : le
   bracket d'Amine92 est VOLONTAIREMENT incomplet (11/15) — vérifier qu'il
   reste exploitable tel quel pour tester la cascade sans le modifier
   inutilement.
```

## 12. Récapitulatif des décisions actées (27/07/2026)

```text
A. Realtime `series` : REPORTÉE (aucun besoin live sur cet écran précis).
B. Libellés des états vides (§8) : actés tels quels.
C. Popup de confirmation « Valider » (§4) : titre/corps/boutons actés.
D. Fichiers : lib/queries/bracket-fill.ts + lib/actions/bracket-fill.ts,
   DISTINCTS de lib/queries/bracket.ts (vue globale, lecture seule) — évite
   de mélanger les contrats de types des deux écrans.
```
