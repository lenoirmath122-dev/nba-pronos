# NBA Pronos — Décisions validées 0.2.4

> Section : **Paris personnalisés**  
> Statut : **validé**  
> Objectif : cadrer les règles fonctionnelles des paris personnalisés avant de passer au scoring global.

---

## 1. Portée d'un pari

Décision validée :

```text
Modèle hybride : un pari porte soit sur une SÉRIE, soit sur un MATCH précis.
La portée est choisie par le joueur à la création du pari.
```

Deux natures de paris :

```text
Pari SÉRIE : porte sur toute la série.
             ex. « La série va en 7 matchs »
                 « Il y aura au moins une prolongation dans la série »
                 « Une équipe gagne un match à l'extérieur »

Pari MATCH : porte sur un match précis et identifié.
             ex. « Match 2 : Jaylen Brown marque 50 points ou plus »
```

Contrainte sur le pari MATCH :

- il ne peut viser qu'un **match bien identifié** (adversaire connu, date et heure confirmées) ;
- même exigence que la fenêtre de pronos en 0.2.3 : on ne peut pas parier sur un match dont la date n'existe pas encore (ex. un match 6 non planifié).

---

## 2. Quota de paris

Décision validée :

```text
Par joueur et par série :
  - 1 pari SÉRIE
  - 3 paris MATCH
```

Règles de quota :

- les deux quotas sont **indépendants** : le pari série n'entame pas les slots match, et inversement ;
- **au plus 1 pari MATCH par match** : les 3 paris match doivent viser **3 matchs différents** de la série.

Conséquence pratique (non bloquante) :

```text
Une série courte limite le nombre de matchs disponibles,
mais même en 4-0 il reste 4 matchs, donc les 3 slots match restent atteignables.
```

> **Note de contexte (20/07/2026, passe maquettes design)** — ce quota (1 pari
> SÉRIE + 3 paris MATCH « par série ») est le quota **Playoffs**, décrit ici
> tel qu'acté, **non modifié**. Il ne s'applique **pas tel quel** en **NBA
> Cup** : la Cup n'a aucune série (élimination directe, match unique par tour),
> donc le scope SÉRIE et le repère « par série » sont sans objet. La Cup a son
> propre quota (scope MATCH uniquement, 1 pari par match, jusqu'à 7 sur la
> phase finale) — voir `nba_pronos_decisions_nba_cup_mecanique_scoring.md` §6.

---

## 3. Deadline de soumission (différenciée selon la portée)

Décision validée :

```text
Pari SÉRIE : verrouillé à l'heure de début du 1er match de la série.
             (un pari série doit être figé avant qu'un seul match soit joué)

Pari MATCH : verrouillé à l'heure de début du match visé.
             (reste ouvert même si la série a déjà commencé,
              tant que CE match précis n'a pas démarré)
```

Principe :

- un pari série engage toute la série → il se ferme dès le tout premier match ;
- un pari match ne concerne que ce match → il reste posable jusqu'au coup d'envoi de ce match.

Cohérence : même logique de verrouillage temporel que le bracket (0.2.2) et les pronos match (0.2.3) — on fige avant que l'événement concerné puisse être influencé.

---

## 4. Workflow des statuts

Décision validée :

```text
BROUILLON → SOUMIS → VALIDÉ → GAGNÉ / PERDU
                   ↘ REFUSÉ
        (cas limite) → ANNULÉ
```

Signification des statuts :

```text
BROUILLON : le joueur rédige, pas encore soumis.
SOUMIS    : en attente de revue admin (clarté, vérifiabilité, difficulté).
VALIDÉ    : admin approuve et fixe/ajuste la difficulté → pari « en jeu ».
REFUSÉ    : admin rejette (ambigu, invérifiable, déjà joué, doublon, hors-jeu).
GAGNÉ     : résolution admin après la fin du match / de la série.
PERDU     : résolution admin après la fin du match / de la série.
ANNULÉ    : neutralisé (série/match annulé, pari devenu invérifiable)
            → 0 point, aucune pénalité.
```

---

## 5. Pari soumis mais non revu à la deadline

Décision validée :

```text
Un pari encore SOUMIS (non revu par l'admin) à sa deadline
est AUTO-VALIDÉ à la difficulté proposée par le joueur.
```

Règles :

- bénéfice du doute accordé au joueur (esprit « confiance + transparence » de 0.2.3) ;
- l'admin peut **revoir ce pari à tout moment**, avant comme après la fin du match / de la série ;
- l'admin peut ajuster la difficulté ou trancher gagné/perdu par la suite ;
- toute intervention admin reste **journalisée** ;
- le garde-fou principal est assumé comme **social** (transparence), pas technique.

---

## 6. Remplacement d'un pari refusé

Décision validée :

```text
Avant la deadline du pari : REFUSÉ libère le slot → le joueur peut reproposer un pari.
Après la deadline du pari : slot perdu, 0 point, pas de remplacement.
```

Conséquence de la deadline différenciée :

- un slot occupé par un pari MATCH refusé peut rester récupérable **plus longtemps** qu'un pari SÉRIE (deadline plus tardive) ;
- cela incite à soumettre tôt pour laisser le temps à la revue admin.

Clarification apportée lors de l'implémentation du prototype (0.2.10) :

```text
Un pari ANNULÉ (section 4 — neutralisé, match/série annulé) libère TOUJOURS
son slot de quota, quel que soit le moment de l'annulation — contrairement à
un pari REFUSÉ, où seul un refus AVANT la deadline libère le slot. Cette
distinction n'était pas tranchée explicitement ci-dessus ; elle comble un
point resté implicite, cohérente avec le principe « aucune pénalité » du
statut ANNULÉ (section 4).
```
---

## 7. Échelle de difficulté

Décision validée :

```text
5 niveaux de difficulté.

Niveau 1 : très accessible
Niveau 2 : accessible
Niveau 3 : intermédiaire
Niveau 4 : difficile
Niveau 5 : très difficile / « jackpot »
```

Règles :

- le joueur **propose** un niveau à la création ;
- l'admin **valide ou ajuste** ce niveau ;
- c'est le **niveau validé par l'admin** qui fait foi pour le scoring, pas celui proposé par le joueur.

---

## 8. Principe de scoring

Décision validée (principe uniquement, valeurs renvoyées à 0.2.5) :

```text
Plus le niveau de difficulté validé est élevé, plus le pari gagné rapporte.
Pari perdu = 0 point.
Jamais de points négatifs.
```

Renvoi :

- les **valeurs chiffrées exactes** des 5 niveaux sont définies en 0.2.5 (scoring global) ;
- la **forme de la progression** entre niveaux (linéaire ou exponentielle façon « jackpot ») est un point ouvert de 0.2.5, car elle pèse sur l'équilibre du classement.

---

## 9. Visibilité des paris

Décision validée :

```text
Chaque pari devient visible à SA propre deadline :
  - pari SÉRIE → visible au début du 1er match de la série ;
  - pari MATCH → visible au début du match visé.

L'admin voit tous les paris en permanence (nécessaire pour valider).
```

Contenu visible une fois le pari ouvert :

```text
Détail nominatif complet : auteur du pari + énoncé + difficulté validée.
Visible de tous, visiteurs publics non connectés inclus.
```

Cohérence : même ouverture maximale que pour les pronos match après verrouillage (0.2.3) — le jeu se joue entre amis, aucun secret n'est protégé une fois le pari fermé.

---

## 10. Vérification gagné / perdu

Décision validée :

```text
V1 : vérification MANUELLE par l'admin (sa décision fait foi), journalisée.
```

Interface admin dédiée, pensée pour être rapide (détail en 0.2.7) :

- file d'attente des paris `SOUMIS` à valider (clair / vérifiable / difficulté) ;
- validation ou ajustement de difficulté en un minimum de clics ;
- après les matchs / séries : liste des paris `VALIDÉ` à résoudre en `GAGNÉ` / `PERDU` ;
- rappel du contexte (série, match, joueur, énoncé) sans navigation ;
- action gagné/perdu rapide, motif obligatoire en cas de refus, le tout journalisé.

Évolution possible (non bloquante) :

```text
Une IA pourrait PRÉ-REMPLIR une suggestion gagné/perdu à partir des données du match
(box scores, score de série), l'admin confirmant d'un clic.
L'IA reste une aide à la décision, jamais l'autorité finale.
```

- réaliste pour les paris **déductibles des données** (score, box score joueur) ;
- inopérant pour les paris **flous ou subjectifs** → garde-fou humain maintenu ;
- reportable en V1, à étudier lors de la spec technique.

---

## 11. Résumé court

```text
Portée    : SÉRIE ou MATCH, choisie à la création (modèle hybride).
Quota     : 1 pari série + 3 paris match (1 max par match, matchs différents).
Deadline  : série → 1er match de la série ; match → début du match visé.
Auto-valid: pari soumis non revu à sa deadline → validé à la difficulté proposée,
            admin peut revoir à tout moment.
Statuts   : BROUILLON → SOUMIS → VALIDÉ → GAGNÉ/PERDU ; ↘ REFUSÉ ; → ANNULÉ.
Refusé    : avant deadline → slot rendu ; après → slot perdu.
Annulé    : slot TOUJOURS libéré, quel que soit le moment (contrairement à Refusé).
Difficulté: 5 niveaux, proposés par le joueur / validés par l'admin (validé fait foi).
Scoring   : plus dur = plus de points, perdu = 0, jamais négatif (valeurs → 0.2.5).
Visibilité: à la deadline du pari, détail nominatif public.
Vérif     : manuelle admin en V1, interface rapide, IA en pré-remplissage plus tard.
```

---

## 12. Points ouverts liés à 0.2.4

À préciser dans les sections suivantes ou lors de la spec technique :

- valeurs chiffrées des 5 niveaux de difficulté (section 0.2.5) ;
- forme de la progression entre niveaux : linéaire ou exponentielle (section 0.2.5) ;
- pondération des points paris personnalisés vs matchs, bracket et séries (section 0.2.5) ;
- workflow détaillé de l'interface admin de validation / résolution (section 0.2.7) ;
- faisabilité et périmètre du pré-remplissage IA gagné/perdu (spec technique) ;
- affichage des paris annulés dans les écrans joueurs et publics (détail UX en 0.2.9).

---

## 13. Suite du cadrage

Prochaine section :

```text
0.2.5 — Scoring global
```

Objectifs de la section suivante :

- définir les points pour un bon vainqueur de match ;
- définir le barème progressif de l'écart ;
- définir la condition du bonus écart ;
- définir les points de bracket par tour ;
- définir le bonus score de série ;
- définir le bonus champion NBA ;
- définir les valeurs des 5 niveaux de difficulté des paris personnalisés ;
- définir la pondération entre matchs, bracket, séries et paris personnalisés ;
- éviter qu'une source de points déséquilibre tout le classement.
