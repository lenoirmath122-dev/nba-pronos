# NBA Pronos — Mécanique de jeu & barème NBA Cup 2026 — décisions

> Statut : décisions actées en discussion avec l'utilisateur le 16/07/2026.
> Complète `nba_pronos_decisions_multi_competitions_historique.md` (§7,
> point ouvert désormais résolu). À renuméroter dans la séquence officielle
> `decisions_0_2_x` si souhaité.

---

## 1. Phase de groupes — hors scope, aucun pronostic

Décision validée :

```text
Aucun pronostic pendant la phase de groupes (30 oct → 27 nov).
Traitement identique à n'importe quel match de saison régulière classique :
l'app n'a jamais permis de pronostiquer ces matchs, la Cup ne fait pas
exception. Les matchs de poule ne sont pas pariables, on attend.
```

Conséquence : la "compétition" jouable ne démarre qu'une fois les 8 équipes
qualifiées pour la phase finale connues (~27-30 novembre).

## 2. Mini-bracket — phase à élimination directe

Décision validée :

```text
7 matchs, 3 tours, élimination directe, AUCUNE série sur toute la phase :

Quarts de finale  : 4 matchs (8 équipes)   — 4-5 décembre
Demi-finales      : 2 matchs (4 équipes)   — 8-9 décembre
Finale            : 1 match  (2 équipes)   — 11 décembre

Réutilise le mécanisme 0.2.2 tel quel :
  - cascade d'avancement (le vainqueur prédit d'un tour pré-remplit
    l'affiche du tour suivant) ;
  - champion déduit automatiquement du chemin (vainqueur de la finale) ;
  - UNE seule deadline = coup d'envoi du 1er match de quart de finale ;
  - brackets des autres joueurs cachés jusqu'à la deadline (0.2.2 §9) ;
  - bracket modifiable jusqu'à la deadline, même après validation ;
  - une donnée API modifiée ne change jamais une prédiction déjà figée.

Seule différence avec le bracket playoffs : pas de série, donc pas de
"score exact" à prédire — seulement qui gagne le match.
```

## 3. Composantes de scoring du mini-bracket

Décision validée :

```text
2 des 3 composantes du bracket playoffs (0.2.5 §7), la 3e disparaît :

1. VAINQUEUR : bonne équipe gagnante, indépendant de l'adversaire réel
   (même modèle "advancement-based" que 0.2.5 §3 — un bon appel paie pour
   lui-même même si l'adversaire prévu était faux).
2. AFFICHE   : les deux bonnes équipes s'affrontent à ce tour, indépendant
   du vainqueur prédit.
3. SCORE EXACT : SUPPRIMÉ — aucune série, rien à prédire à la place.

Pas d'affiche au tour des quarts (affiches déjà connues dès l'ouverture,
comme le 1er tour des playoffs 0.2.5 §6).
```

## 4. Barème chiffré — mini-bracket

Décision validée :

| Tour | Vainqueur | Affiche |
|---|---|---|
| Quarts (4 matchs) | 20 | +0 |
| Demies (2 matchs) | 50 | +15 |
| Finale = champion (1 match) | 150 | +25 |

```text
Bracket "parfait" (4 quarts + 2 demies + demies affiche + finale +
finale affiche) = 4×20 + 2×50 + 2×15 + 150 + 25 = 385 points max.

Choix explicitement NON validé par simulation Monte-Carlo (contrairement à
0.2.5) : périmètre trop réduit (7 matchs) pour que ça change grand-chose,
valeurs fixées au jugement plutôt qu'à la simulation. Cohérent avec le
principe déjà établi "le poids vient du haut du tableau".
```

## 5. Pronos match — réutilisation à l'identique

Décision validée :

```text
0.2.3 / 0.2.5 §2 réutilisés SANS AUCUNE modification sur les 7 matchs de
phase finale, au fur et à mesure qu'ils approchent :
  Vainqueur : 10 points fixes.
  Bonus écart (si vainqueur correct) : +5 / +3 / +2 / +1 / +0.
Max théorique sur les 7 matchs pris isolément : 7 × 15 = 105 points.

Coexiste avec le mini-bracket exactement comme aujourd'hui pour les
playoffs : le bracket se remplit une fois avant le 1er quart, les pronos
match se remplissent match par match — deux sources indépendantes sur les
mêmes matchs.
```

## 6. Paris personnalisés — scope MATCH uniquement

Décision validée :

```text
0.2.4 réutilisé tel quel, avec le scope SÉRIE retiré (sans objet, aucune
série n'existe dans la Cup). Seul le scope MATCH reste disponible, sur les
7 matchs de phase finale.

Niveaux et barème inchangés (0.2.5 §8) :
  Niveau 1 : 5 pts | Niveau 2 : 10 pts | Niveau 3 : 15 pts
  Niveau 4 : 20 pts | Niveau 5 : 25 pts
Pari perdu = 0, jamais de points négatifs — règle intangible du projet.
```

**Amendement (20/07/2026, passe maquettes design)** — précision de quota,
restée implicite ci-dessus :

```text
En NBA Cup : 1 pari personnalisé par match, par joueur.
Pas de cap « par série » : aucune série n'existe dans la Cup (§2), donc le
quota « par série » de 0.2.4 §2 (1 pari SÉRIE + 3 paris MATCH) ne s'applique
PAS tel quel — seul le scope MATCH existe (déjà acté ci-dessus), et son
quota se lit MATCH PAR MATCH, pas agrégé par série dégénérée.

Conséquence : jusqu'à 1 pari personnalisé sur CHACUN des 7 matchs de la
phase finale (4 quarts + 2 demies + 1 finale) — soit jusqu'à 7 paris au
total sur toute la Cup, contre 3 par série en Playoffs.
```

---

## 7. Résumé court

```text
Phase de groupes  : hors scope, aucun pronostic (comme la saison régulière).
Mini-bracket      : 7 matchs, 3 tours, élimination directe, réutilise 0.2.2.
Composantes       : Vainqueur (20/50/150) + Affiche (0/+15/+25). Pas de
                    score exact (aucune série).
Pronos match      : 0.2.3/0.2.5 tel quel, 7 matchs, 10 + écart 5/3/2/1/0.
Paris perso       : 0.2.4 tel quel, scope MATCH uniquement, 5/10/15/20/25.
Validation        : jugement direct, pas de Monte-Carlo (échelle trop
                    réduite pour le justifier).
```

## 8. Points ouverts restants

```text
Fonctionnel/mécanique NBA Cup : CLOS avec ce document.

Restent uniquement des points techniques (déjà identifiés dans
nba_pronos_decisions_multi_competitions_historique.md §7) :
  - fournisseur d'API NBA réelle (bloquant, à trancher en spec technique) ;
  - mécanisme d'authentification réelle (à trancher en spec technique).
```

## 9. Statut de la roadmap

```text
Phase 1 — Décisions fonctionnelles : TERMINÉE
  (multi-compétitions/historique + mécanique/barème NBA Cup).

Prochaine étape : Phase 2 — enrichir le PROTOTYPE existant avec ces deux
briques (2-3 semaines max, toujours sans auth/RLS, toujours simulé).
```
