# NBA Pronos — Décisions validées 0.2.5

> Section : **Scoring global**  
> Statut : **validé**  
> Objectif : figer les valeurs chiffrées de toutes les sources de points et garantir leur équilibre dans le classement, avant de passer au classement et à la visibilité.

---

## 1. Méthode : équilibre d'abord (top-down)

Décision validée :

```text
On fixe d'abord le POIDS CIBLE de chaque source sur un playoffs complet,
puis on cale les valeurs chiffrées pour atteindre cette cible.
```

Raison : le vrai risque de cette section n'est pas la valeur d'une source isolée, mais son **poids relatif** dans le classement final. Une source peut être parfaitement calibrée en interne et quand même écraser tout le reste par son seul volume (≈ 86 matchs contre 15 séries).

Cible d'équilibre retenue, pour un joueur **engagé** (qui pronostique tout) :

```text
Matchs                : ~45-49 %  → cœur du jeu, récompense l'assiduité
Bracket + séries      : ~30-35 %  → récompense la vision de départ
  (dont champion, désormais intégré au bracket)
Paris personnalisés   : ~15-20 %  → le sel, potentiel de remontada
```

L'équilibre final a été **vérifié par simulation Monte-Carlo** (voir section 9).

---

## 2. Scoring match par match

Décision validée :

```text
Bon vainqueur : 10 points (fixe, constant sur tous les tours).
Bonus d'écart : ajouté UNIQUEMENT si le vainqueur est correct.
Mauvais vainqueur : 0 point (ni base, ni bonus d'écart).
```

Barème du bonus d'écart (par paliers, sur l'écart entre la marge pronostiquée et la marge réelle) :

```text
Écart exact (0)   : +5
Écart de 1 à 2    : +3
Écart de 3 à 5    : +2
Écart de 6 à 9    : +1
Écart de 10 et +  : +0
```

Conséquences :

- un prono correct rapporte de **10 à 15 points** ;
- le vainqueur porte l'essentiel de la valeur ; l'écart ajoute de la finesse sans jamais renverser la logique « qui a bien lu le match » ;
- points **constants sur tous les tours** : la dramaturgie « plus c'est tard, plus ça vaut » est déjà portée par le bracket, on ne l'empile pas deux fois.

Choix du socle à 10 (plutôt que 3) : assumé pour offrir de la **granularité** au reste du barème sans recourir aux décimales.

---

## 3. Modèle de bracket : indépendant de l'adversaire (advancement-based)

Décision validée (fondamentale — complète et précise 0.2.2) :

```text
À chaque tour, les points « vainqueur de série » sont attribués si l'équipe
désignée gagnante à ce niveau gagne réellement sa série à ce tour,
INDÉPENDAMMENT de l'adversaire réellement rencontré.
```

Exemple :

```text
Prono demi-conf : Lakers battent Denver.
Réalité         : Lakers battent Memphis.
=> Les Lakers gagnent bien leur demi-conf → points VAINQUEUR acquis.
   L'adversaire prévu (Denver) faux n'annule pas le point vainqueur.
```

Justification : pour un jeu entre amis, ce modèle évite qu'une upset précoce détruise toute une branche du bracket. Chaque bon pronostic paie pour lui-même, ce qui garde le jeu vivant jusqu'au bout.

Conséquence directe sur le champion :

```text
Puisque le vainqueur est indépendant de l'adversaire JUSQU'EN HAUT,
« champion NBA » = « l'équipe désignée gagnante de la finale NBA gagne la finale NBA »
                 = exactement les points de vainqueur de la finale NBA.
=> PAS de bonus champion séparé : il est intégré à la valeur de la finale NBA.
```

---

## 4. Scoring bracket — vainqueur de série (croissant par tour)

Décision validée :

```text
1er tour                    :  25 points
Demi-finales de conférence  :  45 points
Finales de conférence       :  80 points
Finale NBA (= champion)     : 250 points
```

Principe : le poids doit venir du **haut du bracket** (là où c'est dur à prévoir), pas du 1er tour (où beaucoup tomberont juste).

La finale NBA à 250 fusionne l'ancien « vainqueur de finale » et l'ancien « bonus champion » (130 + 120) en une seule valeur, cohérente avec le modèle indépendant de l'adversaire.

---

## 5. Scoring bracket — bonus score exact de série

Décision validée (complète la règle 0.2.2) :

```text
Bonus accordé UNIQUEMENT si le vainqueur de série est correct
ET si le format (4-0 / 4-1 / 4-2 / 4-3) correspond à la vraie série.
Indépendant de l'adversaire.
```

Barème (croissant par tour, toujours inférieur à la valeur du vainqueur) :

```text
1er tour                    : +10
Demi-finales de conférence  : +20
Finales de conférence       : +30
Finale NBA                  : +50
```

Exemple :

```text
Prono : Lakers 4-2.  Réalité : Lakers 4-1.
=> Vainqueur OK, mais format 4-2 ≠ 4-1 → PAS de bonus score.
```

---

## 6. Scoring bracket — bonus affiche

Décision validée :

```text
Bonus accordé si la série oppose EXACTEMENT les deux mêmes équipes
que la vraie série à ce tour, INDÉPENDAMMENT du vainqueur.
Pas de bonus affiche au 1er tour (matchups officiels connus de tous).
```

Barème (croissant par tour) :

```text
1er tour                    :  +0  (pas d'affiche à deviner)
Demi-finales de conférence  : +15
Finales de conférence       : +25
Finale NBA                  : +40
```

Ce bonus récompense « j'ai lu tout le tableau ». Il est **orthogonal** au vainqueur : on peut avoir la bonne affiche et le mauvais vainqueur, ou l'inverse.

---

## 7. Les trois composantes indépendantes du bracket

Décision validée :

```text
Chaque série se score sur TROIS composantes indépendantes qui se cumulent :

1. VAINQUEUR      : bonne équipe gagnante (indépendant de l'adversaire)
2. SCORE EXACT    : vainqueur correct + format réel correct
3. AFFICHE        : les deux bonnes équipes (indépendant du vainqueur)
```

Cas extrême assumé — la « ligne finale NBA parfaite » :

```text
Affiche (+40) + Champion/vainqueur (+250) + Score exact (+50) = 340 points
sur la seule finale NBA.
Rarissime, spectaculaire : le graal de celui qui avait tout lu dès le départ.
```

---

## 8. Scoring des paris personnalisés

Décision validée :

```text
Progression LINÉAIRE selon la difficulté validée par l'admin.

Niveau 1 :  5 points
Niveau 2 : 10 points
Niveau 3 : 15 points
Niveau 4 : 20 points
Niveau 5 : 25 points

Pari perdu = 0. Jamais de points négatifs.
```

Choix du linéaire (plutôt qu'une progression exponentielle « jackpot ») :

```text
La progression exponentielle (ex. 5/10/20/40/80) transformait un profil
« gros parieur » en machine à gagner (jusqu'à 48 % de ses points via paris seuls),
créant une stratégie dégénérée.
Le linéaire garde le parieur COMPÉTITIF sans le rendre imbattable.
```

C'est le **niveau validé par l'admin** qui fait foi (rappel 0.2.4).

---

## 9. Équilibre vérifié par simulation

Méthode :

```text
Simulation Monte-Carlo d'un playoffs complet (structure réaliste : 15 séries,
longueurs de série pondérées, ~86 matchs), sur 5 profils de joueurs types.
Robustesse confirmée : 5 graines × 5000 saisons = 25 000 saisons par profil.
```

Répartition obtenue pour le joueur de référence « complet » (engagé, fait tout) :

```text
Matchs  : 47 %
Bracket : 34 %   (vainqueur + score + affiche, champion inclus)
Paris   : 19 %
Variation entre graines : ±0,2 à 0,5 point → très stable.
```

Classement des profils (stable sur toutes les graines) :

```text
1. Le complet     (fait tout)                  — gagne dans 100 % des cas
2/3. Le parieur / Le régulier                  — au coude-à-coude, se départagent à la marge
4. Le visionnaire (bon bracket, zappe matchs)  — ne remonte jamais son absentéisme
5. Le casual      (peu engagé)                  — toujours dernier
```

Conclusions validées :

- aucune source ne déséquilibre le classement ;
- aucune stratégie mono-source (tout parier, ne faire que le bracket) ne domine ;
- l'effort global (jouer sur toutes les sources) est la meilleure stratégie ;
- un bon appel du champion (250 ≈ 19 % du total) peut à lui seul faire basculer la ligue — effet **assumé** et voulu pour un jeu entre amis.

---

## 10. Résumé court

```text
Méthode        : équilibre cible d'abord, valeurs ensuite ; vérifié par simulation.
Match          : vainqueur 10 (constant) + bonus écart 5/3/2/1/0, si vainqueur correct.
Modèle bracket : indépendant de l'adversaire (advancement-based).
Vainqueur série: 25 / 45 / 80 / 250 (finale NBA = champion, fusionné).
Score exact    : +10 / +20 / +30 / +50, si vainqueur correct + format réel.
Affiche        : 0 / +15 / +25 / +40, bonnes 2 équipes, indépendant du vainqueur.
Paris perso    : linéaire 5 / 10 / 15 / 20 / 25 ; perdu = 0, jamais négatif.
Équilibre      : Matchs 47 % / Bracket 34 % / Paris 19 %, classement sain.
```

---

## 11. Points ouverts liés à 0.2.5

À préciser dans les sections suivantes ou lors de la spec technique :

- valeur maximale exacte de l'écart saisissable sur un match (renvoi 0.2.3, à caler en UX) ;
- option non retenue à ce stade : bonus « affiche parfaite du 1er tour » (sans objet, matchups connus) ;
- règles d'arrondi et d'affichage des sous-totaux par source dans l'UI (détail 0.2.6 / 0.2.9) ;
- gestion du scoring en cas de série annulée / neutralisée vis-à-vis du bracket (renvoi cas limites 0.2.2) ;
- confirmation que le bonus affiche se compare bien par paire d'équipes et non par position de slot (à figer en spec technique).

---

## 12. Suite du cadrage

Prochaine section :

```text
0.2.6 — Classement et visibilité
```

Objectifs de la section suivante :

- définir le niveau de détail visible pour les joueurs connectés ;
- définir le niveau de détail visible pour les visiteurs publics ;
- définir les classements secondaires éventuels ;
- définir les critères de départage complémentaires (au-delà du nombre de bons vainqueurs) ;
- trancher le détail public ou privé des pronostics individuels ;
- définir l'affichage des sources de points dans le classement.
