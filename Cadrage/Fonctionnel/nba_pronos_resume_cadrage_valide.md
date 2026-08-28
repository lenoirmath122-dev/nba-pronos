# NBA Pronos — Résumé de cadrage validé

> Document de transition destiné à être réutilisé ensuite dans Claude / projets IA.  
> Objectif : conserver une synthèse claire de ce qui a été validé avant de passer à la suite du cadrage puis au développement.

---

## 1. Contexte général

Le projet consiste à créer une application web privée de pronostics autour des **playoffs NBA**, jouée entre amis.

Le projet repart de zéro, indépendamment de toute ancienne ébauche ou autre WebApp.  
La stack envisagée pour la vraie version est :

- **Next.js** ;
- **Supabase** ;
- **Supabase Auth** ;
- **PostgreSQL** ;
- **RLS** ;
- **Vercel** ;
- **GitHub → Vercel** ;
- **Vercel Cron Jobs** ;
- **API NBA externe** à terme.

Avant de coder la V1 définitive, il est décidé de réaliser un **prototype jetable** pour tester le concept global en version simplifiée.

---

## 2. Vision produit validée

L’application doit permettre à un groupe d’amis de participer à une compétition de pronostics sur les playoffs NBA.

Chaque joueur pourra :

- créer un compte ;
- rejoindre la compétition ;
- remplir un bracket initial ;
- pronostiquer les matchs disponibles ;
- proposer des paris personnalisés par série ;
- consulter ses scores ;
- consulter le classement ;
- voir les pronostics validés des autres selon certaines règles.

Un administrateur pourra :

- gérer les joueurs ;
- gérer la compétition ;
- superviser les matchs et résultats ;
- corriger manuellement certains résultats si nécessaire ;
- valider ou ajuster les paris personnalisés ;
- vérifier les paris personnalisés gagnés/perdus ;
- relancer ou contrôler les calculs de score.

---

## 3. Périmètre de la V1

### Périmètre NBA

Décision validée :

- la V1 couvre **uniquement les playoffs NBA** ;
- pas de saison régulière ;
- pas de play-in dans le périmètre initial.

### Nombre de joueurs

Décision validée :

- cible principale : **10 à 30 joueurs**.

L’application n’a donc pas besoin d’être pensée pour une très grande échelle dès le départ, mais elle doit rester propre, sécurisée et maintenable.

---

## 4. Prototype jetable

Avant la V1 complète, un prototype rapide doit être réalisé.

### Objectif du prototype

Tester l’ensemble du concept en version simplifiée :

- bracket ;
- pronostics match par match ;
- validation des pronostics ;
- visibilité des pronostics des autres ;
- paris personnalisés ;
- scoring simplifié ;
- classement ;
- expérience UX globale.

### Ce que le prototype ne doit pas viser

Le prototype n’a pas besoin d’intégrer :

- une vraie API NBA ;
- une sécurité complète ;
- une architecture définitive ;
- une base de données parfaitement normalisée ;
- des règles RLS complètes ;
- un système de cron réel.

### Simulation d’API

Comme il n’y a pas de playoffs en cours, le prototype devra **simuler l’API NBA**.

La simulation devra permettre de tester :

- des matchs programmés ;
- des matchs terminés ;
- des scores fictifs ;
- des changements de statut ;
- le recalcul des points ;
- la mise à jour du bracket et du classement.

---

## 5. Utilisateurs et rôles

### Comptes utilisateurs

Décision validée :

- les utilisateurs auront des comptes ;
- Supabase Auth est envisagé pour gérer l’inscription et la connexion ;
- l’application reste privée.

Point à préciser plus tard :

- inscription libre ou validation obligatoire par admin ;
- accès par lien secret ou non ;
- statut utilisateur : en attente, actif, désactivé.

### Rôles validés

Les rôles à prévoir sont :

- **Joueur** ;
- **Admin de compétition** ;
- **Visiteur non connecté** avec accès limité au classement.

### Visiteurs non connectés

Décision validée :

- les visiteurs non connectés peuvent voir uniquement le classement général.

À préciser plus tard :

- s’ils voient les noms/pseudos complets ;
- s’ils voient uniquement les scores ;
- s’ils peuvent voir le détail des pronostics ou non.

---

## 6. Bracket initial

Décision validée :

- chaque joueur remplit un bracket initial ;
- ce bracket contient le **vainqueur de chaque série** ;
- le joueur doit aussi prédire le **score de chaque série**.

Exemple :

```text
Celtics battent Knicks 4-2
Lakers battent Warriors 4-3
```

### Indépendance avec les pronostics match par match

Décision importante validée :

- les points obtenus via le bracket ou les séries ne sont **pas corrélés** avec les points obtenus sur les pronostics match par match.

Cela signifie que :

- un mauvais bracket ne pénalise pas les pronostics match par match ;
- les pronostics match par match gardent leur propre scoring ;
- le bracket a son propre scoring ;
- les points peuvent ensuite être additionnés dans un classement global.

---

## 7. Pronostics match par match

### Type de pronostic principal

Décision validée :

- pour chaque match, le joueur pronostique :
  - le vainqueur ;
  - l’écart de points.

Exemple :

```text
Celtics gagnent de 8 points
```

### Fenêtre de pronostics

Décision validée :

- les joueurs doivent pouvoir pronostiquer match par match ;
- l’application doit afficher en priorité les matchs disponibles sur les **2 ou 3 prochains jours**.

Objectif UX :

- ne pas noyer les joueurs dans une longue liste ;
- rendre la saisie rapide ;
- guider les joueurs vers les pronostics urgents.

---

## 8. Validation et verrouillage des pronostics

### Verrouillage temporel

Décision validée :

- un pronostic peut être saisi ou modifié jusqu’à **l’heure exacte du match**.

Règle métier :

```text
Si l’heure actuelle est antérieure à l’heure de début du match :
  le pronostic peut être saisi ou modifié, tant qu’il n’a pas été validé définitivement.

Si l’heure actuelle est égale ou postérieure à l’heure de début du match :
  le pronostic est verrouillé.
```

### Validation définitive

Décision validée :

- lorsqu’un joueur valide son pronostic pour pouvoir voir les pronostics des autres, son pronostic devient **définitif**.

Principe produit :

```text
Voir les pronostics des autres = accepter de figer son propre pronostic.
```

Conséquences :

- tant que le joueur n’a pas validé, il peut modifier son pronostic ;
- après validation, il peut voir les pronostics validés des autres ;
- après validation, il ne peut plus modifier son propre pronostic ;
- à l’heure du match, les pronostics non validés ou absents sont verrouillés selon les règles d’oubli.

---

## 9. Visibilité des pronostics des autres

Décision validée :

- un joueur ne peut voir les pronostics validés des autres qu’après avoir validé son propre pronostic.

Règle métier :

```text
Pour un match donné :
- si le joueur n’a pas validé son pronostic, il ne voit pas les pronostics des autres ;
- s’il valide son pronostic, son choix devient définitif ;
- il peut alors voir les pronostics déjà validés par les autres joueurs ;
- après le verrouillage du match, les pronostics validés deviennent consultables selon les règles de visibilité retenues.
```

Objectif :

- éviter que les joueurs copient ou s’inspirent des pronostics des autres avant de s’engager.

---

## 10. Oubli de pronostic

Décisions validées :

- absence de pronostic = **0 point** ;
- possibilité exceptionnelle pour l’admin de saisir ou corriger un oubli.

À cadrer plus tard :

- l’action admin doit-elle être tracée ?
- faut-il un commentaire obligatoire ?
- jusqu’à quand l’admin peut-il intervenir ?
- est-ce visible des autres joueurs ?

Recommandation future :

- toute correction admin doit être journalisée.

---

## 11. Paris personnalisés

### Principe

Décision validée :

- les joueurs peuvent proposer des paris personnalisés.

Exemples possibles :

```text
Joueur X marque plus de 30 points dans un match de la série.
La série va en 7 matchs.
Il y aura au moins une prolongation dans la série.
Une équipe gagne un match à l’extérieur.
Un joueur réalise un triple-double.
```

### Nombre de paris personnalisés

Décision validée :

- chaque joueur peut proposer **3 paris personnalisés par série**.

Exemple :

```text
Pour Celtics vs Knicks :
- chaque joueur peut proposer jusqu’à 3 paris personnalisés.

Pour Lakers vs Warriors :
- chaque joueur peut proposer à nouveau jusqu’à 3 paris personnalisés.
```

### Difficulté

Décision validée :

- le joueur pré-évalue le niveau de difficulté de son pari ;
- l’admin vérifie et valide ensuite ce niveau.

Structure logique d’un pari personnalisé :

```text
Description du pari
Série concernée
Joueur auteur du pari
Difficulté proposée par le joueur
Difficulté validée par l’admin
Statut de validation
Résultat final gagné/perdu
Points attribués
```

### Statuts possibles

À prévoir dans la suite du cadrage :

```text
BROUILLON
SOUMIS
VALIDÉ
REFUSÉ
GAGNÉ
PERDU
ANNULÉ
```

À clarifier plus tard :

- jusqu’à quand un pari personnalisé peut être proposé ;
- si les autres joueurs peuvent voir les paris personnalisés avant validation ;
- si un pari personnalisé refusé peut être remplacé ;
- si l’admin peut modifier la formulation ;
- si l’admin peut modifier la difficulté proposée.

---

## 12. Scoring validé au niveau conceptuel

Le scoring exact n’est pas encore figé en valeurs chiffrées, mais les principes sont validés.

### Scoring match par match

Décision validée :

- bon vainqueur = points fixes ;
- écart = plus le joueur est proche de l’écart réel, plus il gagne de points.

Exemple de logique possible :

```text
Bon vainqueur : +X points
Écart exact : bonus maximal
Écart proche : bonus intermédiaire
Écart éloigné : bonus faible ou nul
Mauvais vainqueur : 0 point ou pas de bonus d’écart
```

À préciser plus tard :

- valeur exacte des points ;
- barème progressif de l’écart ;
- si le bonus écart n’est accordé que lorsque le vainqueur est correct.

Recommandation à étudier :

```text
Le bonus d’écart ne devrait être accordé que si le vainqueur pronostiqué est correct.
```

### Scoring bracket / séries

Décisions validées :

- bonus vainqueur de série ;
- bonus score de série ;
- bonus champion NBA.

Les points du bracket sont indépendants des points des matchs.

### Scoring des paris personnalisés

Décision validée :

- les points des paris personnalisés dépendent du niveau de difficulté validé.

Exemple de structure possible :

```text
Difficulté 1 : peu de points
Difficulté 2 : points moyens
Difficulté 3 : points élevés
Difficulté 4 : très gros bonus
Difficulté 5 : jackpot
```

Les valeurs exactes restent à définir.

---

## 13. Classement

### Classement général

Le classement général doit agréger plusieurs sources de points :

- points des pronostics match par match ;
- points du bracket ;
- bonus séries ;
- bonus champion NBA ;
- points des paris personnalisés.

### Départage des égalités

Décision validée :

- en cas d’égalité, le premier critère de départage est le **nombre de bons vainqueurs**.

Structure possible :

```text
1. Total de points
2. Nombre de bons vainqueurs
3. Critère complémentaire à définir si nécessaire
```

À préciser plus tard :

- deuxième critère de départage ;
- égalité acceptée si les joueurs restent ex æquo après les critères définis.

---

## 14. Données NBA et résultats

### V1 cible

Décision validée :

- la vraie V1 doit synchroniser automatiquement les matchs et résultats via une **API NBA**.

Fonctions attendues à terme :

- récupération des équipes ;
- récupération du calendrier playoffs ;
- récupération des horaires ;
- récupération des statuts de matchs ;
- récupération des scores ;
- détection des matchs terminés ;
- recalcul automatique des scores ;
- mise à jour du classement.

### Correction manuelle

Décision validée :

- une correction manuelle des résultats doit être possible ;
- elle est réservée à l’admin.

Cas d’usage :

- erreur API ;
- retard de synchronisation ;
- match reporté ;
- bug de mapping ;
- besoin de recalcul manuel.

---

## 15. Écrans validés pour la V1

Les écrans suivants sont considérés comme nécessaires pour la V1 :

### Authentification

- connexion ;
- inscription ;
- potentiellement récupération de mot de passe.

### Joueur

- accueil / dashboard joueur ;
- liste des matchs à pronostiquer ;
- mes pronostics ;
- classement général ;
- détail des scores par joueur ;
- bracket global ;
- état global de la compétition.

### Admin

- page admin minimale ;
- gestion des joueurs ;
- gestion / supervision des matchs ;
- correction des résultats ;
- validation des paris personnalisés ;
- vérification des paris personnalisés ;
- recalcul des scores ;
- supervision des synchronisations ou simulations.

### Visiteur

- classement public limité.

---

## 16. UX/UI

Décisions validées :

- l’application doit être **responsive mobile + desktop dès la V1** ;
- la simplicité d’usage est prioritaire ;
- un brainstorming UX/UI dédié doit être réalisé avant le développement complet.

Objectifs UX :

- permettre de pronostiquer rapidement ;
- rendre visibles les matchs urgents ;
- rendre le bracket compréhensible ;
- éviter la complexité malgré des règles riches ;
- bien distinguer :
  - bracket ;
  - matchs ;
  - paris personnalisés ;
  - classement ;
  - administration.

À explorer dans le brainstorming UX/UI :

- style visuel global ;
- ambiance sport / NBA ou interface plus sobre ;
- cartes de match ;
- flux de validation d’un prono ;
- état des pronostics ;
- affichage des pronostics des autres ;
- visualisation du bracket ;
- dashboard joueur ;
- ergonomie mobile.

---

## 17. Contraintes fortes

Décisions validées :

- application privée ;
- comptes utilisateurs ;
- simplicité d’usage prioritaire ;
- automatisation prioritaire dans la V1 cible ;
- correction admin possible ;
- prototype jetable avant V1 ;
- simulation d’API dans le prototype ;
- brainstorming UX/UI avant développement complet.

---

## 18. Architecture cible envisagée, non encore détaillée

La stack cible reste :

```text
Next.js
Supabase
Supabase Auth
PostgreSQL
RLS
Vercel
GitHub → Vercel
Vercel Cron Jobs
API NBA externe
```

Mais aucune décision technique détaillée n’est encore figée dans ce document.

La prochaine étape technique devra définir :

- structure du projet Next.js ;
- modèle de données Supabase ;
- règles RLS ;
- stratégie Auth ;
- routes serveur / server actions ;
- simulation d’API pour le prototype ;
- future intégration API NBA ;
- cron jobs ;
- stratégie de déploiement.

---

## 19. Points restant à arbitrer

Les sujets suivants restent à cadrer :

### Accès et inscription

- inscription libre ou validation admin obligatoire ;
- lien secret ou non ;
- statut utilisateur en attente / actif / désactivé.

### Bracket

- date limite de validation du bracket ;
- possibilité ou non de modifier le bracket ;
- scoring exact du vainqueur de série ;
- scoring exact du score de série ;
- scoring exact du champion NBA.

### Matchs

- barème exact du bon vainqueur ;
- barème progressif de l’écart ;
- comportement si le vainqueur est faux mais l’écart absolu est proche ;
- gestion des matchs reportés ou annulés.

### Paris personnalisés

- date limite de soumission ;
- statut exact du workflow ;
- visibilité des paris personnalisés ;
- remplacement d’un pari refusé ;
- barème exact par difficulté ;
- méthode de validation admin ;
- traçabilité des décisions admin.

### Classement

- pondération entre matchs, bracket, séries et paris personnalisés ;
- deuxième critère de départage ;
- détail public ou privé des scores.

### UX/UI

- style visuel ;
- navigation principale ;
- structure du dashboard ;
- design du bracket mobile ;
- parcours de validation des pronostics ;
- expérience admin.

---

## 20. Prochaine étape recommandée

La prochaine étape logique est de produire une **SPEC fonctionnelle V0.1** plus détaillée.

Proposition de structure :

```text
1. Vision produit
2. Périmètre prototype
3. Périmètre V1
4. Utilisateurs et rôles
5. Parcours joueur
6. Parcours admin
7. Règles de bracket
8. Règles de pronostics match
9. Règles de paris personnalisés
10. Règles de scoring
11. Classement
12. Écrans
13. Données fonctionnelles
14. Points ouverts
```

Ensuite, seulement après validation fonctionnelle :

```text
SPEC technique V0.1
```

Puis :

```text
Prototype jetable
```

Puis :

```text
V1 propre avec Next.js + Supabase + Vercel
```
