# NBA Pronos — Décisions validées 0.2.9

> Section : **UX/UI**  
> Statut : **validé**  
> Objectif : fixer la direction visuelle, la navigation et le rendu des écrans clés (joueur, public, admin), et absorber les renvois UX accumulés dans 0.2.3 → 0.2.8, avant de passer au prototype jetable.

---

## 1. Positionnement de la section

Décision validée :

```text
0.2.9 est la DERNIÈRE brique fonctionnelle du cadrage.
Elle mêle des décisions UX neuves et la clôture des renvois laissés par les sections précédentes.
```

Elle a été traitée en **7 sous-blocs** validés un par un :

```text
1. Direction visuelle
2. Navigation + dashboard joueur
3. Cartes de match + parcours de validation
4. Bracket mobile
5. Classement
6. Paris annulés + rafraîchissement live
7. Écrans admin
```

Principe transverse retenu :

```text
Mobile d'abord. Jeu entre amis (10-30 joueurs).
Chaque écran est pensé pour l'usage réel : saisie rapide, lecture au pouce,
et remontée de ce qui est urgent.
```

Aucune décision de 0.2.9 ne contredit les sections antérieures ; elle en fixe le rendu.

---

## 2. Direction visuelle

Décision validée :

```text
Direction : Arène / broadcast.
Fond : SOMBRE par défaut, bascule CLAIR disponible (préférence utilisateur).
```

Règles :

- l'énergie « arène » (bandeaux colorés, contraste) est **concentrée sur les moments forts** :
  carte de match, bracket, champion ;
- les écrans de **lecture** (classement, mes pronos, admin) restent plus calmes, juste teintés de l'identité ;
- **logos de franchise** posés sur une **pastille neutre constante** (rond clair), pour rester lisibles
  en sombre comme en clair ;
- **abréviation en fallback** si un logo manque ou charge mal.

Point noté (non bloquant) :

```text
Sourcing officiel des 30 logos NBA à prévoir en V1 (propriété intellectuelle des franchises).
Le fallback abréviation couvre l'absence de logo.
```

---

## 3. Navigation + dashboard joueur

Décision validée :

```text
Barre de navigation MOBILE à 4 onglets :
  Accueil · Jouer · Classement · Profil
```

Rôle de chaque onglet :

```text
Accueil    : centre d'attention (voir plus bas).
Jouer      : HUB regroupant Matchs, Bracket, Paris, Mes pronos,
             avec pastilles « à faire » par univers.
Classement : le classement triable/filtrable.
Profil     : profil joueur, préférences, accès admin (si rôle ADMIN).
```

Justification du hub « Jouer » :

- les trois types de pronostics ont des rythmes différents (bracket = une fois ; matchs = quotidien ;
  paris = occasionnel) → les regrouper évite de donner le même poids à tout ;
- barre aérée, matchs/bracket/paris à deux taps via le hub (acceptable car pas quotidiens tous les trois).

Décision validée — l'Accueil comme centre d'attention :

```text
Bloc « À TRAITER » : actions en attente TRIÉES PAR URGENCE (deadline la plus proche en premier),
                     avec compte à rebours et action directe.
Bloc « ÇA VIENT DE TOMBER » : feedback (points gagnés, mouvement de rang).
En-tête : rang / points, repère immédiat.
```

Ordre d'urgence retenu :

```text
bracket non validé (si deadline proche)
  > matchs (coup d'envoi proche)
    > paris (slot à reproposer / série en cours)
      > feedback récent
```

Adaptation :

- le contenu de « À traiter » s'adapte au moment de la saison (bracket avant le 1er match,
  matchs/paris pendant, état vide entre deux tours) ;
- **admin** : un bloc « À traiter (admin) » s'ajoute sur l'Accueil, visible selon le rôle uniquement ;
- **visiteur non connecté** : navigation réduite (classement + bracket global), pas de hub « Jouer ».

---

## 4. Cartes de match + parcours de validation

Décision validée — la carte de match :

```text
Saisie : vainqueur (2 boutons) + écart (pavé numérique).
Avant validation : pronos des autres MASQUÉS via un panneau verrouillé explicite.
Compteur « X/N ont pronostiqué » : visible en permanence (le nombre, jamais le contenu).
```

Décision validée — la validation (mécanique fondatrice « valider = voir », 0.2.3) :

```text
Validation DÉFINITIVE, précédée d'une CONFIRMATION LÉGÈRE
(rappel : plus modifiable + tu verras les autres).
Après validation : RÉVÉLATION des pronos validés des autres
  → tendance (barre) + détail nominatif (qui a mis quoi + écart),
  → mise à jour continue jusqu'au coup d'envoi.
```

Décision validée — l'écran « Matchs » (dans le hub Jouer) :

```text
Liste de la fenêtre glissante 3 jours (0.2.3), groupée par jour, plus proche en premier.
4 statuts lisibles d'un coup d'œil :
  validé (vert) · prêt (ambre) · incomplet / écart manquant (gris) · à faire (bleu).
Bandeau « Tout valider » : n'apparaît que s'il existe des brouillons COMPLETS ;
  ne compte que les matchs « prêts » (ni validés, ni incomplets) ;
  confirmation listant les matchs concernés + rappel des conséquences.
```

Écrans distincts (rappel 0.2.3) :

```text
« Matchs »     : fenêtre de saisie (3 jours).
« Mes pronos » : historique + matchs en cours ou verrouillés (accès par segment).
```

Après le coup d'envoi (verrouillé) :

```text
Tout devient public (visiteurs inclus), saisie fermée.
```

---

## 5. Bracket mobile

Décision validée — le remplissage :

```text
Remplissage TOUR PAR TOUR.
Une série = une carte : vainqueur en 1 tap + score de série en boutons (4-0 / 4-1 / 4-2 / 4-3).
Les tours suivants se PRÉ-REMPLISSENT avec les équipes que le joueur fait avancer.
Champion déduit automatiquement du chemin (0.2.2).
Groupé par conférence (Est puis Ouest au 1er tour).
Navigation par tour en haut + progression X/15.
```

Décision validée — la consultation (bracket global public + relecture après deadline) :

```text
Vue A « RÉSUMÉ PAR TOUR » par DÉFAUT :
  état réel de chaque série + tendances des joueurs ; tap sur une série = détail (drill-down 0.2.6).
Vue B « ARBRE SCROLLABLE » disponible en PLEIN ÉCRAN / paysage :
  tableau façon poster, défilement horizontal + zoom, pour l'effet « waouh ».
```

Tendances (rappel 0.2.6) :

```text
Seuil dynamique : pourcentage au-delà de 10 brackets remplis, nombre brut en dessous.
```

---

## 6. Classement

Décision validée — le tableau unique triable (rappel 0.2.6) :

```text
Un seul classement. Tri par PUCES : Total · Matchs · Bracket · Paris · Forme.
La puce active pilote le tri et met en avant sa valeur par joueur.
```

Décision validée — repère permanent :

```text
Le TOTAL reste TOUJOURS affiché, même en tri par une autre colonne,
pour ne jamais perdre le référentiel du classement réel.
```

Décision validée — lignes et forme récente :

```text
Chaque ligne est DÉPLIABLE en sous-totaux publics : Matchs / Bracket / Paris / Forme.
« Forme récente » : fenêtre glissante de 7 JOURS, toutes sources confondues.
```

Décision validée — cas particuliers d'affichage :

```text
Joueur INACTIF (désactivé) : grisé + tag « inactif », CONSERVÉ au classement avec ses points (0.2.7).
Absents sur un match : compteur neutre « X n'ont pas joué » ; noms révélés au clic / survol.
Barre « toi » collante : rappel de sa position en bas de liste, activée au-delà de 20 joueurs.
```

Départage (rappel 0.2.6) :

```text
1. Total  2. Bons vainqueurs de MATCH  3. Écarts exacts  4. Points bracket  5. Ex-aequo assumé.
```

---

## 7. Paris annulés + rafraîchissement live

Décision validée — affichage des paris annulés (renvoi 0.2.4) :

```text
Pari ANNULÉ / neutralisé : affiché BARRÉ + grisé dans « Mes paris »,
  mention « neutralisé » + raison (ex. match annulé), 0 point sans pénalité.
Visuellement DISTINCT d'un « perdu ». Même traitement en public.
Placement : dans la liste (pas de section séparée).
```

Décision validée — rafraîchissement live (renvoi 0.2.8), CIBLE :

```text
Mise à jour SILENCIEUSE en place (score, écart courant, pronos qui se dévoilent avant coup d'envoi),
+ repère discret « mis à jour il y a… » et badge « EN DIRECT ».
```

Réalisme assumé :

```text
Proto : « direct » piloté par la simulation (curseur), pas un vrai flux temps réel.
V1    : la fraîcheur dépend de l'API choisie ; une API gratuite imposera un rythme plus lent au début.
Écran conçu pour DÉGRADER PROPREMENT selon la fréquence réelle de synchro.
```

Garde-fou (rappel 0.2.8) :

```text
Le VERROUILLAGE des pronos est piloté par l'heure connue du match, PAS par le live.
Aucun risque lié à la fraîcheur de la donnée sur le verrouillage.
```

---

## 8. Écrans admin

Décision validée — organisation :

```text
Entrée : TABLEAU DE BORD ADMIN unique (même patron que l'Accueil joueur),
  avec compteurs par file → chaque file s'ouvre en PAGE DÉDIÉE.
```

Décision validée — les files (rappel 0.2.7) :

```text
FILE DE VALIDATION :
  1 carte / pari SOUMIS, contexte complet SANS navigation (joueur, série/match, énoncé) ;
  réglette de difficulté 1-5 ajustable ; Valider (niveau retenu) / Refuser (motif OBLIGATOIRE).

FILE DE RÉSOLUTION :
  1 carte / pari échu, rappel des points en jeu ; Gagné / Perdu ;
  motif recommandé (obligatoire si contesté) ; action journalisée.
  IA de pré-remplissage gagné/perdu : HORS périmètre V1 (0.2.4 / 0.2.8).

FILE DES REQUÊTES (correction joueur → admin) :
  même patron ; statuts EN_ATTENTE → TRAITÉE / REFUSÉE ; prono visé + justification du joueur.
```

Décision validée — gestion des joueurs :

```text
Actions contextuelles par ligne : promouvoir / désactiver / réactiver / rétrograder.
Garde-fous VISIBLES dans l'UI :
  - pas d'auto-rétrogradation (action bloquée sur sa propre ligne) ;
  - dernier admin actif non rétrogradable.
Joueur désactivé : conserve pronos et points, reste au classement (marqué inactif).
```

Décision validée — logs et recalcul (rappel 0.2.7) :

```text
Historique des LOGS : écran de consultation pure (audit privé : acteur, action, cible,
  avant → après, horodatage), filtrable, réservé aux admins. Aucune action dessus.
Bouton « RECALCULER » : filet de sécurité en zone admin, avec confirmation + journalisation.
```

---

## 9. Résumé court

```text
Direction    : Arène / broadcast, sombre par défaut (bascule clair), logos sur pastille neutre.
Navigation   : 4 onglets — Accueil / Jouer (hub) / Classement / Profil.
Accueil      : centre d'attention — « À traiter » trié par urgence + « Ça vient de tomber ».
Carte match  : vainqueur + écart ; valider = voir (confirmation légère) ; révélation + màj continue.
Écran Matchs : fenêtre 3 jours groupée, 4 statuts, bandeau « Tout valider » (prêts) + confirmation.
Bracket      : remplissage tour par tour (pré-rempli, champion déduit) ;
               consultation résumé par tour (défaut) + arbre scrollable (plein écran).
Classement   : tri par puces, TOTAL toujours visible, sous-totaux dépliables, forme 7 jours ;
               inactif conservé, absents en compteur (noms au clic), barre « toi » si > 20 joueurs.
Paris annulés: barrés + neutralisés, distincts d'un perdu, dans la liste.
Live (cible) : silencieux + repère « mis à jour » ; dégrade proprement selon l'API.
Admin        : hub admin + files (validation / résolution / requêtes), gestion joueurs,
               logs (consultation), bouton recalcul. Traiter vite, contexte sans navigation.
```

---

## 10. Points ouverts liés à 0.2.9

À préciser en 0.2.10 (prototype) ou lors de la spec technique :

- sourcing des 30 logos officiels et format d'intégration (V1) ;
- détail fin des écrans admin : filtres et tri de l'historique des logs ;
- comportement exact de la bascule vue A / vue B du bracket (plein écran / paysage) ;
- micro-animations et seuils du rafraîchissement live selon la fréquence réelle de synchro ;
- fréquence de rafraîchissement de l'affichage joueur en direct (dépend de l'API, spec technique) ;
- rendu précis de la barre « toi » collante et du drill-down bracket au clic (nominatif ou non par série) ;
- états vides de chaque écran (Accueil, Matchs, files admin) — libellés définitifs.

---

## 11. État du cadrage fonctionnel

```text
0.2.1 → 0.2.9 : VALIDÉS.
Le cadrage fonctionnel (0.2.x hors prototype) est COMPLET.
```

Prochaine et dernière section de cadrage :

```text
0.2.10 — Prototype jetable
```

Objectifs de la section suivante :

- définir le périmètre exact du prototype (quelles règles testées, quels écrans minimum) ;
- définir les données fictives (nombre de faux joueurs, séries, matchs) ;
- caler le nombre de faux joueurs pour tester les deux côtés du seuil de 10 brackets (0.2.6 / 0.2.8) ;
- définir le niveau de fidélité UX visé ;
- confirmer la stack du prototype et le rôle de la simulation d'API (0.2.8).

Puis viendront les livrables consolidés :

```text
Spec fonctionnelle V0.1 · Liste des points ouverts · Synthèse pour Claude Project.
```
