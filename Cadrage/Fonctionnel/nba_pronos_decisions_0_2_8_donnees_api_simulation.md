# NBA Pronos — Décisions validées 0.2.8

> Section : **Données NBA, API et simulation**  
> Statut : **validé**  
> Objectif : cadrer la frontière entre simulation (prototype) et API réelle (V1), le modèle de données de jeu simulé, le comportement de la simulation, le cahier des charges de données V1, le mapping, la synchronisation et le pré-remplissage IA — avant de passer à l'UX/UI.

---

## 0. Principe transverse de la section

Décision structurante :

```text
La section vit sur DEUX TEMPS distincts, à ne jamais confondre :

PROTO : simulation d'API, pas de NBA réelle, pas de cron réel.
V1    : API NBA externe, cron Vercel, synchro automatique.
```

Règles déjà validées ailleurs, rappelées comme garde-fous permanents :

- une mise à jour de données ne modifie **jamais** une prédiction figée (0.2.2, 0.2.3) ;
- le recalcul est **idempotent** : même état → même résultat (0.2.7).

---

## 1. Frontière simulation / réel

Décision validée :

```text
Pas de format de données commun imposé au proto.
Le proto est jetable : on ne sur-conçoit pas pour imiter une API NBA
non encore choisie. La V1 adaptera son contrat de données.
```

Nuance retenue :

```text
Garder malgré tout des noms de champs SAINS et lisibles au proto
(équipes, date/heure, statut, score, format de série),
non pour imiter une API, mais pour que le proto reste lisible
comme matière première lors du cadrage V1.
```

Stockage de la donnée de jeu au proto :

```text
Pas de table de résultats NBA dédiée.
Génération DÉTERMINISTE, pilotée par deux éléments persistés :
  - une graine (seed) + les fixtures figées ;
  - un curseur « où en est-on dans les playoffs simulés » (le temps).
```

Justification :

- une génération purement aléatoire à chaque affichage casserait l'idempotence
  et la règle « une prédiction figée n'est jamais modifiée » ;
- avec (seed + curseur), les résultats sont recalculables à l'identique →
  pas besoin de stocker les résultats, on persiste seulement le curseur.

Bascule simu → API réelle :

```text
Adaptations acceptées lors du passage V1.
Pas d'objectif « bascule sans rien toucher ».
```

---

## 2. Modèle de données de jeu simulé

Décision validée — structure :

```text
Playoffs COMPLET, structure identique à la V1 :
  1er tour              : 8 séries
  Demi-finales de conf. : 4 séries
  Finales de conférence : 2 séries
  Finale NBA            : 1 série
  = 15 séries, 4 tours.
```

Justification :

- le scoring (0.2.5) est déjà câblé sur 4 tours (25 / 45 / 80 / 250, bonus affiche et score) ;
- le champion = finale NBA (fusion 0.2.5) n'existe qu'au 4ᵉ tour ;
- l'équilibre 47 / 34 / 19 (0.2.5) n'a de sens que sur un playoffs entier ;
- « prototype jetable » = simplifier la QUALITÉ (code, sécurité, UX),
  pas la STRUCTURE de jeu.

Décision validée — faux joueurs :

```text
Nombre exact à caler en spec proto.
Contrainte fonctionnelle : pouvoir tester les DEUX côtés du seuil de
10 brackets remplis (bascule pourcentage / nombre brut, 0.2.6).
```

Décision validée — comportements :

```text
Faux joueurs à comportements VARIÉS, calqués sur les 5 profils de 0.2.5 :
  complet, parieur, régulier, visionnaire, casual.
```

Objectif : rejouer au proto la simulation qui a validé l'équilibre du scoring,
et vérifier « en vrai » que le classement se comporte comme prévu par Monte-Carlo.

---

## 3. Ce que la simulation doit produire

Décision validée — avancement du temps :

```text
Deux modes combinés :
  - MANUEL : bouton admin « avancer d'un cran » (pas à pas, debug fin) ;
  - AUTO débrayable : horloge fictive qui déroule seule, reprise en main possible.
```

Granularité d'un cran :

```text
Au choix : match / jour / série entière.
  - match : debug fin ;
  - jour  : colle à la fenêtre glissante 3 jours (0.2.3) et aux soirées multi-matchs ;
  - série : saut rapide vers les tours hauts du bracket.
```

Décision validée — déroulé produit :

```text
La simulation AUTO ne produit que le NOMINAL (programmé → terminé).
Les cas limites (reporté / annulé) restent déclenchables À LA MAIN
par l'admin (levier déjà validé 0.2.7), pour tester les règles 0.2.3.
```

Décision validée — résultats :

```text
Résultats DÉTERMINISTES via seed. Pas de forçage de résultat précis
(un forçage créerait un état hors-seed, non reproductible, cassant
l'idempotence 0.2.7).
```

Note spec proto (non bloquant) :

```text
Pour tester un scénario ciblé (ex. « finale en 4-3 »), changer de seed
ou prévoir quelques seeds pré-choisies aux déroulés intéressants.
```

---

## 4. API NBA réelle (V1)

Décision validée — choix du fournisseur :

```text
Reporté à la spec technique (Claude).
Décision technique (endpoints, couverture, fraîcheur, tarif, fiabilité).
```

Décision validée — cahier des charges de données V1 (dérivé des règles) :

```text
Équipes (les 16 qualifiées)        → bracket, mapping (0.2.2)
Calendrier des séries + affiches   → bracket, bonus affiche (0.2.2 / 0.2.5)
Date + heure de chaque match       → fenêtre 3 jours, deadlines, verrouillage (0.2.3)
Statut de match                    → verrouillage, reporté/annulé (0.2.3 / 0.2.7)
  (programmé / en cours / terminé / reporté / annulé)
Score final de match               → scoring vainqueur + écart (0.2.5)
Format / score de série (4-0…4-3)  → scoring bracket : vainqueur, score exact (0.2.5)
Statut de série                    → clôture série, paris série (0.2.4 / 0.2.7)
  (en cours / terminée / reportée / annulée)
```

```text
Box scores individuels : HORS PÉRIMÈTRE V1.
La vérification des paris personnalisés est manuelle en V1 (0.2.4),
elle n'en a pas besoin. (Rediscuté au bloc 7 pour l'IA.)
```

Décision validée — exigences minimales (formulées ici, évaluées en spec technique) :

```text
Toute API retenue devra fournir, comme conséquence des règles de jeu :
  - horaires de match fiables (verrouillage à l'heure exacte, 0.2.3) ;
  - statuts de match fiables ;
  - scores finaux fiables ;
  - fraîcheur compatible avec le verrouillage temps réel.
La spec technique VÉRIFIE que le fournisseur coche ces cases,
elle n'a pas à redécouvrir ce qu'il faut exiger.
```

---

## 5. Mapping équipes et matchs

Décision validée — principe :

```text
Identifiants internes STABLES + table de correspondance vers l'id de la source.
Le reste de l'app ne travaille QUE sur les ids internes ;
la source n'est connue que d'une seule couche.
```

Justification :

- protège l'idempotence : les pronos figés pointent vers des ids internes
  qui ne bougent jamais, quoi que fasse la source ;
- rend un changement de fournisseur ou de libellé sans impact sur le scoring.

Décision validée — au proto :

```text
Même principe de mapping appliqué (source = simulation),
pour valider le mécanisme le plus risqué avant la V1.
```

Décision validée — entité non reconnue (V1) :

```text
Rapprochement AUTO = simple SUGGESTION.
Tant que l'admin n'a pas confirmé, l'entité reste EN ATTENTE :
  aucun scoring, aucun verrouillage, aucune écriture sur un objet de jeu
  ne s'appuie dessus.
Toute confirmation de mapping est JOURNALISÉE (qui, quand, source → interne).
```

Règle de sûreté :

```text
Rien d'inconnu n'entre dans le scoring sans validation humaine.
« Auto » = proposer pour épargner de la saisie, jamais décider et appliquer seul.
```

Note spec technique (non bloquant) :

```text
Établir / confirmer le mapping équipes EN BLOC à l'ouverture du 1er tour
(16 équipes + 8 affiches connues d'un coup) → réduit fortement les surprises.
```

---

## 6. Cron Vercel, synchro et logs de synchronisation

Vocabulaire :

```text
Synchro : l'app va chercher les données fraîches auprès de la source
          et met à jour sa base (déclenche ensuite le scoring).
Cron    : tâche qui se déclenche seule à intervalle régulier.
Cron Vercel : service de cron de l'hébergeur ; V1 UNIQUEMENT.
Logs de synchro : traces MACHINE de chaque synchro (quand, quoi, succès/erreur),
          distinctes des logs admin d'actions HUMAINES (0.2.7).
```

Décision validée — découplage horaire / synchro :

```text
Horaires des matchs : rafraîchis RÉGULIÈREMENT à l'approche des matchs
                      (évite de verrouiller sur un horaire périmé en cas de report).
Verrouillage        : piloté par l'HEURE connue du match, PAS par la synchro
                      → pas besoin de synchro minute par minute.
Synchro résultats   : PLUSIEURS FOIS PAR JOUR pendant la phase de matchs
                      (pas 1×/jour), pour suivre le rythme des matchs.
```

Décision validée — recalcul auto :

```text
Chaîne : synchro → un résultat a-t-il changé ?
           OUI → recalcul déclenché (points + classement mis à jour dans la foulée) ;
           NON → aucun recalcul (on ne rejoue pas pour rien).
Recalcul idempotent (0.2.7).
```

Décision validée — logs de synchro :

```text
Actés dès maintenant.
Traces machine : horodatage, données récupérées, succès / erreur.
Réservés au DIAGNOSTIC, non publics.
Distincts des logs admin (actions humaines, 0.2.7).
```

Renvoi 0.2.9 :

```text
Le rafraîchissement de l'AFFICHAGE joueur en direct (l'écran qui se met à jour
sous les yeux) relève de l'UX, distinct du recalcul serveur traité ici.
Ici on garantit une donnée à jour vite ; comment le joueur la voit arriver → 0.2.9.
```

---

## 7. Pré-remplissage IA gagné / perdu

Rappel (0.2.4) :

```text
Vérification des paris personnalisés = MANUELLE par l'admin en V1, sa décision fait foi.
Une IA pourrait PRÉ-REMPLIR une suggestion gagné/perdu, l'admin confirmant d'un clic.
L'IA reste une aide, jamais l'autorité finale.
```

Décision validée — principe :

```text
PRINCIPE acté comme évolution possible (0.2.4 inchangé).
Manuel admin = référence pour la V1.
Faisabilité et périmètre exact → spec technique (Claude).
```

Décision validée — données :

```text
Box scores individuels HORS périmètre V1 tant que l'IA n'est pas décidée
(cohérent avec le bloc 4).
Un élargissement éventuel du cahier des charges de données fera partie
de la future décision IA, pas avant.
```

Garde-fou maintenu :

```text
Même avec les box scores, l'IA ne tranchera JAMAIS les paris flous ou subjectifs.
Le garde-fou humain reste dans tous les cas (rappel 0.2.4).
```

---

## 8. Résumé court

```text
Frontière      : pas de format commun imposé au proto (V1 adapte) ; noms de champs sains.
Stockage proto : pas de table de résultats ; génération déterministe (seed + curseur).
Structure      : playoffs COMPLET (15 séries, 4 tours), identique à la V1.
Faux joueurs   : nombre → spec proto ; contrainte seuil 10 brackets ; 5 profils variés (0.2.5).
Temps proto    : manuel + auto débrayable ; cran match / jour / série.
Simu auto      : nominal seulement ; cas limites déclenchés à la main par l'admin (0.2.7).
Résultats      : déterministes via seed, pas de forçage ; seeds pré-choisies possibles.
Fournisseur API: reporté à la spec technique.
Données V1     : équipes, calendrier, affiches, horaires, statuts, scores, format série.
                 Box scores HORS périmètre. Exigences formulées ici, évaluées en spec tech.
Mapping        : ids internes stables + table de correspondance ; même principe au proto ;
                 entité inconnue → suggestion, EN ATTENTE jusqu'à confirmation admin (tracée).
Cron           : V1 uniquement. Horaires rafraîchis ; verrouillage piloté par l'heure connue.
Synchro        : plusieurs fois/jour pendant les matchs ; recalcul si résultat changé (idempotent).
Logs synchro   : actés (machine, diagnostic, non publics), distincts des logs admin.
IA paris       : principe acté, faisabilité → spec tech ; box scores hors périmètre ;
                 garde-fou humain maintenu.
```

---

## 9. Points ouverts liés à 0.2.8

À préciser en 0.2.9 (UX/UI) ou lors de la spec technique :

- nombre exact de faux joueurs et de données fictives du proto (spec proto) ;
- seeds pré-choisies pour scénarios ciblés (spec proto) ;
- rafraîchissement de l'affichage joueur en direct (0.2.9) ;
- fréquence précise de synchro et de rafraîchissement des horaires (spec technique) ;
- choix du fournisseur d'API NBA et vérification des exigences (spec technique) ;
- mécanisme technique du mapping en bloc au 1er tour (spec technique) ;
- faisabilité et périmètre du pré-remplissage IA gagné / perdu (spec technique) ;
- format de stockage et rétention des logs de synchro (spec technique, non bloquant).

---

## 10. Suite du cadrage

Prochaine section :

```text
0.2.9 — UX/UI
```

Objectifs de la section suivante (dont renvois accumulés) :

- direction visuelle, navigation principale, dashboard joueur ;
- design des cartes de match et expérience de validation d'un prono ;
- affichage des pronos des autres ;
- affichage des joueurs absents (« n'a pas pronostiqué » ou masqué, renvoi 0.2.3) ;
- affichage des paris annulés (renvoi 0.2.4) ;
- rendu du drill-down bracket + choix nominatif ou non par série (renvoi 0.2.6) ;
- valeur exacte de la fenêtre « forme récente » (renvoi 0.2.6) ;
- colonnes visibles vs masquées sur mobile (renvoi 0.2.6) ;
- marquage visuel « joueur inactif » au classement (renvoi 0.2.7) ;
- rendu des écrans admin (files de paris, historique de logs, gestion joueurs, renvoi 0.2.7) ;
- rafraîchissement de l'affichage joueur en direct (renvoi 0.2.8) ;
- bracket mobile et ambiance générale.
```
