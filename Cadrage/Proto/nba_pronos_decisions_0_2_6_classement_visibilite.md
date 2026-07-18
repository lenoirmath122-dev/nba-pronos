# NBA Pronos — Décisions validées 0.2.6

> Section : **Classement et visibilité**  
> Statut : **validé**  
> Objectif : consolider les règles de visibilité déjà tranchées ailleurs, fixer les critères de départage et l'organisation du classement, avant de passer à l'administration.

---

## 1. Positionnement de la section

Décision validée :

```text
0.2.6 est avant tout une CONSOLIDATION.
```

Une grande partie de la visibilité a déjà été tranchée dans les sections précédentes :

- pronos match : détail nominatif public après verrouillage (0.2.3) ;
- paris personnalisés : détail nominatif public à la deadline du pari (0.2.4) ;
- données privées jamais exposées : email, ids internes, logs admin (0.2.1) ;
- bracket global public : état réel + tendances (0.2.2).

Le travail de 0.2.6 consiste donc à :

- unifier ces règles éparses ;
- fixer ce qui restait flou (brackets individuels, départage, sources) ;
- organiser l'affichage du classement.

Aucune décision de 0.2.6 ne contredit les sections antérieures.

---

## 2. Détail visible : joueur connecté vs visiteur

Décision validée :

```text
Après verrouillage / deadline, la CONSOMMATION de données est IDENTIQUE
pour un visiteur non connecté et un joueur connecté.
```

La seule différence tient à trois choses, toutes déjà actées ailleurs :

```text
1. Le connecté peut AGIR (saisir, valider, proposer un pari, éditer son profil).
2. Le connecté a l'accès CONDITIONNEL au pré-verrouillage
   (règle « valider = voir » de 0.2.3), impossible pour un visiteur.
3. Les données privées restent invisibles pour TOUS les non-admins.
```

Règle de synthèse :

```text
Après coup (match verrouillé, pari à sa deadline, bracket à sa deadline) :
  visiteur = joueur pour tout ce qui est donnée de jeu.

Avant coup :
  seul le joueur ayant validé voit le détail des autres.
```

Données à ne jamais exposer (rappel 0.2.1) :

- email ;
- identifiants internes ;
- logs / historiques d'actions admin ;
- données de sécurité ;
- toute information privée non destinée au classement.

---

## 3. Départage des égalités

Décision validée :

```text
Cascade « cœur du jeu » :

1. Total de points
2. Nombre de bons VAINQUEURS DE MATCH
3. Nombre d'ÉCARTS EXACTS (marge pronostiquée = marge réelle)
4. Points BRACKET
5. Ex-aequo assumé si toujours à égalité après ces critères
```

Précision importante (tranche une ambiguïté héritée) :

```text
« Bons vainqueurs » = bons vainqueurs de MATCH, pas de série.
```

Justification :

- le total de points prime toujours ;
- à égalité, on récompense d'abord la lecture du jeu au quotidien (vainqueurs match), puis la finesse (écarts exacts), puis la vision de départ (bracket) ;
- l'ex-aequo final est accepté : un cas rare ne justifie pas un critère artificiel supplémentaire.

---

## 4. Brackets individuels après la deadline du bracket

Décision validée :

```text
La vue publique par défaut reste en TENDANCES agrégées.
Un clic sur une série ouvre le détail de cette série.
```

Affichage des tendances — seuil dynamique :

```text
Plus de 10 brackets remplis (≥ 11) : affichage en POURCENTAGE.
    ex. « 70 % ont choisi Celtics »

10 brackets remplis ou moins (≤ 10) : affichage en NOMBRE BRUT.
    ex. « 7 joueurs sur 9 ont choisi Celtics »
```

Précisions :

- le seuil se calcule sur les **brackets effectivement remplis**, pas sur le nombre d'inscrits ;
- en petit effectif, le pourcentage est trompeur (1 sur 3 = 33 % suggère une fausse masse) → le compte brut est plus parlant ;
- le seuil de 10 tombe dans la cible 10-30 joueurs du projet, donc bien positionné.

Choix assumé :

```text
Le bracket, image stratégique complète d'un joueur,
reste moins exposé « brut » que les pronos match,
tout en étant explorable série par série.
```

Point renvoyé :

- le niveau exact du détail au clic (distribution enrichie seule, ou détail nominatif « qui a mis quoi » par série) et le rendu UI → **0.2.9**.

---

## 5. Organisation du classement

Décision validée :

```text
Un SEUL classement, TRIABLE et FILTRABLE par catégorie,
plutôt que des écrans secondaires figés et séparés.
```

Le tableau affiche des colonnes par source :

```text
Total | Matchs | Bracket | Paris | Forme récente
```

Comportement :

- un clic sur une colonne **réordonne tout le classement** selon cette source ;
- trier par « Bracket » donne de fait le classement des meilleurs bracketteurs ;
- trier par « Matchs » donne les meilleurs pronostiqueurs match ;
- trier par « Paris » donne les meilleurs parieurs ;
- trier par « Forme récente » donne le classement du moment.

Conséquence :

```text
Les « classements secondaires par source » deviennent des VUES TRIÉES
du même tableau, pas des écrans distincts à maintenir.
```

Départage sur un tri par catégorie :

```text
En cas d'égalité sur la colonne triée,
la cascade de départage générale (section 3) s'applique.
```

Forme récente :

```text
Points crédités sur une FENÊTRE GLISSANTE, toutes sources confondues.
Valeur exacte de la fenêtre (ex. 7 jours) à caler en 0.2.9, non bloquant.
```

---

## 6. Affichage des sources de points

Décision validée :

```text
Chaque ligne du classement est DÉPLIABLE en sous-totaux publics.
```

Postes affichés :

```text
Matchs
Bracket (vainqueur + score + affiche)
Paris
Total
```

Cohérence :

- granularité alignée sur la structure de 0.2.5 (Matchs 47 % / Bracket 34 % / Paris 19 %) ;
- ces sous-totaux sont **publics** (déjà acté en 0.2.1 : les sources de points sont visibles des visiteurs).

---

## 7. Résumé court

```text
Positionnement : consolidation des règles de visibilité + fixation du classement.
Connecté vs visiteur : consommation identique après coup ; le connecté agit et
                       voit le pré-verrouillage conditionnellement (valider = voir).
Données privées : jamais exposées (email, ids, logs admin).
Départage : 1.total 2.bons vainqueurs MATCH 3.écarts exacts 4.pts bracket 5.ex-aequo.
Brackets après deadline : tendances par défaut, clic sur série = détail.
Seuil tendances : > 10 brackets remplis → %, sinon → nombre brut.
Classement : un seul tableau, triable/filtrable par colonne (Total/Matchs/Bracket/
             Paris/Forme récente) ; les secondaires sont des vues triées.
Forme récente : fenêtre glissante toutes sources (durée → 0.2.9).
Sources : chaque ligne dépliable en Matchs / Bracket / Paris / Total, public.
```

---

## 8. Points ouverts liés à 0.2.6

À préciser en 0.2.9 (UX/UI) ou lors de la spec technique :

- rendu UI du drill-down bracket + choix nominatif ou non par série ;
- valeur exacte de la fenêtre « forme récente » (non bloquant) ;
- affichage des joueurs absents dans le classement (« n'a pas pronostiqué » ou masqué, remonté de 0.2.3) ;
- affichage des paris annulés dans les écrans joueurs et publics (remonté de 0.2.4) ;
- colonnes visibles vs masquées sur mobile (tri/filtre sur petit écran) ;
- règles d'arrondi et d'affichage des sous-totaux (renvoi 0.2.5).

---

## 9. Suite du cadrage

Prochaine section :

```text
0.2.7 — Administration
```

Objectifs de la section suivante :

- gestion des joueurs (validation, désactivation, réactivation, changement de rôle) ;
- supervision de la compétition, des séries et des matchs ;
- correction des horaires, scores et statuts ;
- interface de validation / résolution des paris personnalisés (file d'attente, résolution rapide) ;
- workflow de la requête de correction joueur → admin (remonté de 0.2.3) ;
- recalcul des scores ;
- politique de logs admin ;
- intégration de la contrainte « au moins deux admins » (remonté de 0.2.3 vers 0.2.1).
