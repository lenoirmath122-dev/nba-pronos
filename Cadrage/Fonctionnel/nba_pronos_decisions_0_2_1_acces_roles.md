# NBA Pronos — Décisions validées 0.2.1

> Section : **Accès, inscription et rôles**  
> Statut : **validé**  
> Objectif : conserver les décisions fonctionnelles prises avant de passer au cadrage du bracket initial.

---

## 1. Inscription

Décision validée :

```text
Inscription libre avec accès immédiat,
mais avec possibilité de validation ou d’invalidation par un admin.
```

Concrètement :

- un utilisateur peut créer son compte librement ;
- il peut accéder à l’application après inscription ;
- l’accès initial est donc fluide ;
- un admin peut ensuite intervenir pour gérer l’accès.

Actions admin à prévoir :

- valider explicitement un joueur si besoin ;
- désactiver un joueur ;
- réactiver un joueur ;
- contrôler la liste des utilisateurs inscrits.

Statuts fonctionnels à prévoir :

```text
ACTIVE     = joueur actif, peut participer
DISABLED   = joueur désactivé par admin, ne peut plus participer
```

Option supplémentaire possible, mais non prioritaire :

```text
PENDING    = joueur inscrit mais en attente de validation
```

Pour la V1, la règle principale retenue est :

```text
Nouvel inscrit = ACTIVE par défaut.
Admin peut passer le compte en DISABLED si nécessaire.
```

---

## 2. Rôles applicatifs

Décision validée :

```text
PLAYER + ADMIN uniquement.
Les visiteurs non connectés sont gérés à part.
```

Rôles à stocker en base :

```text
PLAYER
ADMIN
```

Le visiteur public n’est pas un rôle applicatif stocké. Il correspond simplement à :

```text
Utilisateur non connecté.
```

Conséquence :

- la gestion des rôles reste simple ;
- l’admin est un utilisateur avec des droits supplémentaires ;
- le visiteur public est traité par les règles d’accès des pages publiques.

---

## 3. Visiteurs publics

Décision validée :

Les visiteurs non connectés peuvent voir :

- le classement général ;
- le détail des sources de points ;
- le bracket global.

Sources de points potentiellement visibles :

```text
Points matchs
Points bracket
Points séries
Points champion
Points paris personnalisés
Score total
```

Règle de prudence à conserver :

```text
Les visiteurs peuvent voir les scores et agrégats,
mais ne doivent pas voir les données privées.
```

Données à ne jamais exposer publiquement :

- email ;
- identifiants internes ;
- logs admin ;
- données de sécurité ;
- informations privées non destinées au classement.

Point restant à préciser plus tard :

- les visiteurs voient-ils le détail complet des pronostics individuels ou uniquement des agrégats ?

Règle provisoire recommandée :

```text
Classement public = scores, sources de points et bracket global.
Détail complet des pronostics individuels à arbitrer plus tard.
```

---

## 4. Profil joueur

Décision validée :

```text
Profil enrichi : pseudo + avatar + équipe favorite + bio.
```

Champs fonctionnels du profil :

```text
pseudo
avatar
équipe favorite
bio
```

Règles proposées :

- le pseudo est obligatoire ;
- l’avatar est optionnel ;
- l’équipe favorite est optionnelle ;
- la bio est optionnelle ;
- l’email est privé ;
- l’email ne doit jamais être affiché publiquement.

Affichage public possible :

```text
Pseudo
Avatar
Équipe favorite
Score total
Sources de points
```

---

## 5. Admin

Décision validée :

```text
Admin = joueur + droits admin.
```

Cela signifie que l’admin :

- participe au jeu ;
- peut remplir son bracket ;
- peut saisir ses pronostics ;
- apparaît au classement ;
- dispose aussi d’un accès aux fonctions d’administration.

Droits admin à prévoir :

```text
Gestion des joueurs
Activation / désactivation des joueurs
Supervision de la compétition
Supervision des séries
Supervision des matchs
Correction des résultats
Validation des paris personnalisés
Ajustement de la difficulté des paris personnalisés
Vérification des paris personnalisés gagnés/perdus
Recalcul des scores
Consultation des logs ou historiques d’actions
```

Point de vigilance :

```text
Un admin est aussi joueur, donc toutes les actions admin sensibles doivent être traçables.
```

Actions admin à journaliser :

- correction de résultat ;
- modification de match ;
- validation ou refus d’un pari personnalisé ;
- modification de difficulté d’un pari personnalisé ;
- décision gagné/perdu sur un pari personnalisé ;
- désactivation ou réactivation d’un joueur ;
- recalcul manuel des scores.

---

## 6. Résumé court

```text
Inscription : libre, accès immédiat, admin peut invalider/désactiver.
Rôles : PLAYER et ADMIN uniquement.
Visiteurs : non connectés, hors base, peuvent voir classement + sources de points + bracket global.
Profil joueur : pseudo, avatar, équipe favorite, bio.
Admin : joueur avec droits admin.
Traçabilité : requise pour les actions admin sensibles.
```

---

## 7. Points ouverts liés à 0.2.1

À préciser dans les sections suivantes ou lors de la spec technique :

- faut-il ajouter un statut `PENDING` plus tard ?
- faut-il un code compétition malgré l’inscription libre ?
- quel niveau de détail des pronostics est visible publiquement ?
- quelle partie du bracket global est publique ?
- quels champs du profil sont visibles par les visiteurs ?
- quelle politique de logs admin exacte prévoir ?

---

## 8. Suite du cadrage

Prochaine section :

```text
0.2.2 — Bracket initial
```

Objectifs de la section suivante :

- définir quand le bracket ouvre ;
- définir quand il se verrouille ;
- définir s’il est modifiable avant validation ;
- définir le contenu exact du bracket ;
- définir le scoring bracket ;
- définir l’affichage du bracket global ;
- définir les cas limites.
