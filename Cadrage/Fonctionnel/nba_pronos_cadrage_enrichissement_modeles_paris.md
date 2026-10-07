# Cadrage — enrichissement des modèles et couverture des types de paris

> Cadrage du 07/10/2026. Objectif : « oublier le moins de types de paris
> possible » (le « 99 % » est une façon de parler, pas un seuil mesuré).
> Recherche, création et entraînement des nouveaux modèles : sur les saisons
> déjà disponibles localement (`Cadrage/Stats/data/nba.db`).

## 1. Décisions prises (07/10/2026)

| # | Sujet | Décision |
|---|---|---|
| 1 | Play-by-play (PBP) | Archive brute par match (Cloud Storage, ~0,3 Go/saison) **et** agrégats en base |
| 2 | Backfill | Oui, depuis la base SQLite locale (PBP brut des saisons passées) |
| 3 | Premier marqueur / première équipe à marquer | Tout point marqué compte, lancers francs inclus (≠ pratique la plus courante des bookmakers, voulu) |
| 4 | Course à X points | Première équipe dont le score est ≥ X |
| 5 | Prolongation | Incluse pour les paris de match entier ; les paris par quart restent sur les 4 quarts |
| 6 | Joueur absent (DNP) | Pari perdu partout (en relation OU, seul le côté de l'absent échoue) |
| 7 | « Plus de X » | Strictement supérieur ; « X+ » / « au moins X » = X inclus (à vérifier dans le code avant de figer) |
| 8 | Séries, saison, awards, All-Star | Parier jusqu'au début de la période visée ; résolution automatique, éventuellement déléguée à l'IA |
| 9 | Types sans modèle résolus par l'IA | Estimation affichée comme « approximative » |
| 10 | Nom approximatif | Proposer une correction au joueur + dictionnaire d'alias |
| 11 | Ordre | S1-S4, puis play-by-play, puis séries (avant les playoffs) |
| 12 | Difficulté / points | Dérivés de la probabilité, comme aujourd'hui |

## 2. État actuel de la couverture (code au 07/10/2026)

Le chiffre de l'audit du 24/08 (69 % calculé auto, 17 % partiel, 14 % non, sur
393 paris dans le périmètre) est périmé : roster split, superlatifs, dernier
panier, contre sur joueur et fautes techniques sont livrés depuis. Il faut le
re-mesurer en rejouant le corpus (`Cadrage/Stats/types_de_paris_playoffs_2026.md`)
dans le pipeline actuel.

Couvert (scope match) : stat joueur (12 stats + DD/TD/tech + % de tir), joueur
absent, stat équipe (9 + %), total du match (8 stats + prolongation, temps
morts, backcourt, buzzer), fautes techniques (joueur/équipe/match), périodes
équipe (7 types) et joueur, duel (GT, DIFF_LT, OR, multiplicateur, somme),
combo ET (+ ET/OU imbriqué), roster split/count, superlatif, dernier panier,
contre sur joueur. Scope série : joueur « au moins une fois » seulement.

## 3. Catalogue des ajouts (difficulté F/M/L)

**Stats et résultat du match**
- S1 pf (+ « exclu pour 6 fautes »), dreb, ftm/fta, fgm, 2 points ; versions équipe/total — F
- S2 Combinés joueur (stl+blk, P+R, P+A, R+A, fantasy score) — F
- S3 Écart final (« gagne de X+ », handicap, tranches) — M
- S4 Vainqueur du match dans un pari ou un combo — F (`home_win` existe)
- S5 Pair/impair, quart ou mi-temps le plus prolifique, égalité sur un quart — F
- S6 « Joue seulement N quarts-temps » (minutes > 0, 4 quarts réglementaires à confirmer) — M
- S7 +/- par période (backfill ou non calculable) — M
- S8 Titulaire ou remplaçant — F
- S9 Points raquette / contre-attaque / deuxième chance / sur balles perdues (nouvel import) — M
- S10 Hustle et tracking (nouvel import) — M

**Play-by-play** (à stocker, voir §4)
- P1 Premier marqueur, première équipe à marquer
- P2 Course à X points
- P3 Plus grosse avance, remontée, « mène de 20 puis perd »
- P4 Changements de leader, égalités, séries de points
- P5 Dunks, premier 3 points, premier rebond / passe
- P6 Expulsions, flagrants, entre-deux
- P7 Dernier à marquer par équipe, buzzer beater par joueur

**Séries** : R1 séries équipe/total/période/duel/combo (L) ; R2 cumul sur la
série (L) ; R3 vainqueur de série, score exact, nombre de matchs, balayage,
remontée 3-1 (M).

**Saison / événements** : A1 champion, MVP, DPOY, ROY, victoires de saison,
qualification, seeding, MVP des Finales ; A2 All-Star, concours, NBA Cup.
Résolution par IA avec source tracée.

**Expressivité** : L1 ET/OU arbitrairement imbriqués (un arbre booléen) ; L2
égalité exacte ; L3 comparaison de deux comptages ; L4 ratio joueur sur
période ; L5 seuil conditionné (min. de tirs) ; L6 conditions sur la présence
d'un autre joueur ; L7 négation généralisée ; L8 alias et noms approximatifs.

**Hors périmètre** (aucune trace officielle) : hymne, réseaux sociaux,
« cringe », vague. Refusés dès la saisie avec un message clair.

## 4. Play-by-play : ce qui est stocké aujourd'hui

- Endpoint `PlayByPlayV3`, un appel par match (`refresh_daily.py:268`).
- **Brut jamais stocké en production** (`refresh_daily.py:19`). Seule la base
  SQLite locale a la table `play_by_play` (entraînement).
- Agrégats en base : fautes techniques et backcourt par joueur
  (`stats_box_scores`), temps morts / buzzer beater / dernier panier par match
  (`stats_matchs`), contres (`stats_block_events`).
- Sans nouvel import, seuls ces 6 marchés se calculent. P1 à P7 imposent
  l'archive brute et de nouveaux agrégats. Volumétrie estimée (non mesurée) :
  ~450 lignes/match, ~1,8 Go pour 6 602 matchs, ~0,3 Go pour une saison.

## 5. Points à vérifier avant de coder

- Sept paris joueur + seuil de l'alpha, `is_calculable=true`, ont été résolus à
  la main (aucun motif enregistré) : trouver pourquoi la résolution auto les a
  ratés (noms approximatifs, timing, import de box score).
- Aucun motif de non-calcul n'est stocké (`refusal_reason` vide) : en ajouter
  un à chaque `is_calculable=false`, indispensable pour mesurer la couverture.
- Contradictions des rapports d'exploration : combo OU imbriqué (refusé ou
  supporté), scope série pour DD/TD/tech, nombre de codes par famille.
- Colonnes pf, dreb, ftm/fta, fgm dans `stats_box_scores` : à confirmer.
- Cache des modèles (aucun aujourd'hui, 920 Mo) : cache borné avant d'ajouter
  des dizaines de modèles (lot Q1 de l'architect).
- `cdn.nba.com/static/json/liveData` : à tester depuis GitHub, Vercel et la VM
  comme source de PBP moins bloquée que `stats.nba.com`.
- Calibration : période (jusqu'à +22 %) et `team_blk` (+12,3 %) à corriger ;
  corrélation des combos (indépendance supposée) à traiter.

## 6. Prochaines étapes proposées

1. Re-mesurer la couverture sur le corpus avec le pipeline actuel + enregistrer
   les motifs de non-calcul.
2. Lot 1 : cache des modèles + S1 + S2 + S4 (une branche, une PR).
3. Lot 2 : S3 (écart final), S6, S7.
4. Lot 3 : archive PBP + agrégats + backfill, puis P1-P3.
5. Lot 4 : séries (R1-R3) avant les playoffs ; résolution IA pour A1/A2.
6. Transverse : L1 (arbre booléen), L8 (alias), suggestion de seuils.
