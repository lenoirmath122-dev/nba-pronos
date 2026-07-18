# NBA Pronos — Décisions validées 0.2.2

> Section : **Bracket initial**  
> Statut : **validé**  
> Objectif : cadrer les règles fonctionnelles du bracket initial avant de passer aux pronostics match par match.

---

## 1. Ouverture du bracket

Décision validée :

```text
Le bracket ouvre dès que toutes les séries du 1er tour sont connues officiellement.
```

Conséquences :

- le bracket n’est pas ouvert avec des équipes provisoires ;
- on attend que le tableau officiel des playoffs soit disponible ;
- les joueurs remplissent un bracket complet à partir des vraies séries du 1er tour.

Objectif : éviter les ambiguïtés liées au play-in, aux seeds provisoires ou aux matchups non confirmés.

---

## 2. Deadline et verrouillage du bracket

Décision validée :

```text
Le bracket se verrouille à l’heure exacte du premier match des playoffs.
```

Précision ajoutée :

```text
Si un joueur a rempli son bracket sans cliquer sur Valider avant la deadline,
alors son bracket est automatiquement validé à la deadline.
```

Règle fonctionnelle :

```text
Avant la deadline :
  le bracket peut être rempli et modifié.

À la deadline :
  tout bracket rempli est automatiquement validé et verrouillé.
  tout bracket vide ou incomplet est traité selon une règle à préciser.
```

Point restant à préciser plus tard :

- que faire d’un bracket partiellement rempli à la deadline ?
  - auto-validation partielle ?
  - invalidation ?
  - validation uniquement des séries remplies ?

---

## 3. Modification et validation du bracket

Décision validée :

```text
Le bracket reste modifiable jusqu’à la deadline, même après validation.
```

Cette règle est spécifique au bracket.

Elle diffère volontairement des pronostics match par match, pour lesquels la validation servira à figer le prono afin de voir ceux des autres.

Règle fonctionnelle :

```text
Bracket validé avant deadline : modifiable.
Bracket non validé mais rempli : auto-validé à la deadline.
Bracket après deadline : verrouillé et non modifiable.
```

---

## 4. Contenu du bracket

Décision validée :

```text
Le bracket contient le vainqueur de chaque série + le score de chaque série.
```

Exemple :

```text
Celtics battent Knicks 4-2
Lakers battent Warriors 4-3
```

Le champion NBA n’est pas choisi séparément : il est déduit automatiquement du chemin complet du bracket.

---

## 5. Format du score de série

Décision validée :

```text
Le score de série est choisi via des boutons prédéfinis.
```

Les valeurs autorisées sont uniquement les formats réalistes :

```text
4-0
4-1
4-2
4-3
```

Objectifs UX :

- éviter les erreurs de saisie ;
- simplifier l’usage mobile ;
- rendre la validation plus propre ;
- faciliter le scoring.

---

## 6. Scoring du vainqueur de série

Décision validée :

```text
Les points pour un bon vainqueur de série sont croissants selon le tour.
```

Principe :

```text
Plus le tour est avancé, plus le bon pronostic vaut de points.
```

Exemple de logique possible, valeurs non encore validées :

```text
1er tour : valeur faible
Demi-finales de conférence : valeur moyenne
Finales de conférence : valeur élevée
Finale NBA : valeur très élevée
```

Les valeurs exactes restent à définir dans la section scoring.

---

## 7. Scoring du score de série

Décision validée :

```text
Le bonus de score de série est accordé uniquement si le vainqueur de série est correct.
```

Exemple :

```text
Prono : Celtics 4-2 Knicks
Résultat : Celtics 4-2 Knicks
=> points vainqueur + bonus score exact

Prono : Celtics 4-2 Knicks
Résultat : Knicks 4-2 Celtics
=> aucun bonus score, même si le format 4-2 est correct
```

Objectif : éviter de récompenser un score exact associé au mauvais vainqueur.

---

## 8. Champion NBA

Décision validée :

```text
Le champion NBA est déduit automatiquement du bracket.
```

Conséquence :

- pas de choix champion séparé ;
- pas d’incohérence possible entre bracket et champion ;
- le vainqueur de la finale NBA dans le bracket devient le champion pronostiqué.

---

## 9. Visibilité des brackets des autres joueurs

Décision validée :

```text
Les brackets des autres joueurs sont cachés jusqu’à la deadline du bracket.
```

Avant la deadline :

- un joueur ne voit pas les brackets individuels des autres ;
- cela évite la copie ou l’influence.

Après la deadline :

- les brackets peuvent devenir visibles selon les écrans prévus ;
- la compétition devient consultable et plus fun à suivre.

---

## 10. Bracket global public

Décision validée :

```text
Le bracket global public affiche l’état réel des séries + les tendances des joueurs.
```

Exemples de tendances :

```text
70 % des joueurs ont choisi Celtics sur cette série.
45 % ont prévu Celtics 4-2.
30 % ont choisi Nuggets champions.
```

Le bracket global public ne doit pas nécessairement afficher tous les brackets individuels.

Objectif : rendre le suivi public intéressant sans exposer trop de détail individuel.

---

## 11. Cas limites

Décisions validées :

```text
Si une série est annulée ou reportée, l’admin décide manuellement.
```

```text
Si une donnée API change, le bracket joueur reste figé.
```

```text
Si une erreur de donnée est détectée avant la deadline,
l’admin peut rouvrir ou corriger le bracket / les données.
```

Règles importantes :

- une mise à jour API ne doit pas modifier les prédictions déjà saisies ;
- les prédictions joueur restent historisées et figées après deadline ;
- l’admin doit pouvoir corriger une erreur de donnée avant verrouillage ;
- les corrections importantes devront être tracées.

---

## 12. Résumé court

```text
Ouverture : quand toutes les séries du 1er tour sont officiellement connues.
Deadline : heure exacte du premier match des playoffs.
Auto-validation : bracket rempli mais non validé auto-validé à la deadline.
Modification : bracket modifiable jusqu’à la deadline, même après validation.
Contenu : vainqueur de chaque série + score de série.
Score série : choix via boutons prédéfinis 4-0, 4-1, 4-2, 4-3.
Scoring vainqueur série : points croissants selon le tour.
Bonus score série : seulement si le vainqueur est correct.
Champion : déduit automatiquement du bracket.
Visibilité : brackets des autres cachés jusqu’à la deadline.
Bracket global public : état réel + tendances des joueurs.
Cas limites : décisions admin, données API ne modifient pas les prédictions figées.
```

---

## 13. Points ouverts liés à 0.2.2

À préciser plus tard :

- traitement d’un bracket partiellement rempli à la deadline ;
- barème exact des points par tour ;
- bonus exact pour le score de série ;
- bonus exact pour le champion NBA ;
- niveau de détail visible dans les brackets individuels après deadline ;
- niveau de détail affiché publiquement vs connecté ;
- traçabilité des corrections admin sur le bracket.

---

## 14. Suite du cadrage

Prochaine section :

```text
0.2.3 — Pronostics match par match
```

Objectifs :

- définir le cycle brouillon / validation / verrouillage ;
- définir la fenêtre de matchs visibles ;
- définir la saisie vainqueur + écart ;
- définir les règles de visibilité des pronostics des autres ;
- définir les règles en cas d’oubli ;
- définir les cas de match reporté, annulé ou corrigé.
