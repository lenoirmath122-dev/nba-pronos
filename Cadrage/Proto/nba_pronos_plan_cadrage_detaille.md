# NBA Pronos — Plan de cadrage détaillé

> Version légèrement détaillée  
> Objectif : garder une vue claire de ce qui est déjà validé, de ce qui reste à arbitrer, et des livrables à produire avant développement.

---

## 0. Cadrage général

### 0.1 — Vision produit générale `[VALIDÉ]`

Application web privée de pronostics entre amis autour des **playoffs NBA uniquement**.

Principes déjà validés :

- cible : **10 à 30 joueurs** ;
- stack cible envisagée : **Next.js + Supabase + Vercel + GitHub** ;
- comptes utilisateurs via Supabase Auth à terme ;
- automatisation prévue via API NBA dans la vraie V1 ;
- prototype jetable avant V1 ;
- simulation d’API dans le prototype ;
- responsive mobile + desktop ;
- simplicité d’usage prioritaire.

Le jeu repose sur :

- un bracket initial ;
- des pronostics match par match ;
- des paris personnalisés ;
- un scoring global ;
- un classement public partiel ;
- une administration.

---

## 0.2 — Cadrage fonctionnel détaillé

### 0.2.1 — Accès, inscription et rôles `[VALIDÉ]`

Décisions validées :

- inscription libre avec accès immédiat ;
- validation / invalidation / désactivation possible par admin ;
- rôles applicatifs : `PLAYER` et `ADMIN` uniquement ;
- visiteur non connecté traité à part, sans rôle stocké en base ;
- visiteur public peut voir :
  - classement général ;
  - détail des sources de points ;
  - bracket global ;
- profil joueur enrichi :
  - pseudo ;
  - avatar ;
  - équipe favorite ;
  - bio ;
- admin = joueur avec droits supplémentaires ;
- actions admin sensibles à tracer.

Point à intégrer lors de la consolidation (remonté depuis 0.2.3) :

- contrainte **« au moins deux admins »** (un admin ne peut pas traiter sa propre requête de correction).

Livrable déjà généré :

- `nba_pronos_decisions_0_2_1_acces_roles.md`

---

### 0.2.2 — Bracket initial `[VALIDÉ]`

Décisions validées :

- le bracket ouvre quand toutes les séries du 1er tour sont officiellement connues ;
- deadline : heure exacte du premier match des playoffs ;
- bracket rempli mais non validé automatiquement validé à la deadline ;
- bracket modifiable jusqu’à la deadline même après validation ;
- contenu : vainqueur de chaque série + score de série ;
- scores de série via boutons prédéfinis ;
- formats autorisés : `4-0`, `4-1`, `4-2`, `4-3` ;
- points de vainqueur de série croissants selon le tour ;
- bonus score de série uniquement si le vainqueur est correct ;
- champion NBA déduit automatiquement du bracket ;
- brackets des autres cachés jusqu’à la deadline ;
- bracket global public : état réel + tendances joueurs ;
- cas limites : décision admin si série annulée/reportée ;
- si une donnée API change, le bracket joueur reste figé ;
- admin peut rouvrir / corriger avant deadline en cas d’erreur de donnée.

Livrable déjà généré :

- `nba_pronos_decisions_0_2_2_bracket_initial.md`

---

### 0.2.3 — Pronostics match par match `[VALIDÉ]`

Décisions validées :

- fenêtre glissante sur 3 jours, matchs bien identifiés uniquement, tri par proximité temporelle ;
- match démarré ou verrouillé → bascule de la fenêtre de saisie vers « Mes pronos » ;
- contenu du prono : vainqueur + écart, indissociables ;
- écart obligatoire, entier positif ≥ 1 ;
- saisie de l’écart en champ numérique libre, scoring de proximité ;
- cycle brouillon → validé (irréversible) → verrouillé ;
- validation match par match, avec option « Valider tous les matchs complets » (confirmation requise) ;
- avant match : voir les pronos des autres seulement après avoir validé le sien, mise à jour continue ;
- à la deadline : brouillon complet auto-validé, brouillon partiel = absence (0 point) ;
- absence totale = 0 point, jamais de pénalité négative ;
- correction admin uniquement sur requête du joueur (même après match), transparente et journalisée ;
- un admin ne peut jamais corriger son propre prono → nécessite un autre admin (**≥ 2 admins**) ;
- match reporté : pronos conservés, deadline recalée, admin peut rouvrir en cas exceptionnel ;
- match annulé : neutralisé, 0 point pour tous ;
- après verrouillage : tous les pronos visibles de tous, détail nominatif inclus, visiteurs publics compris ;
- compteur « X/N ont pronostiqué » public en permanence, détail conditionné avant match et ouvert après.

Livrable déjà généré :

- `nba_pronos_decisions_0_2_3_pronostics_matchs.md`

---

### 0.2.4 — Paris personnalisés `[VALIDÉ]`

Décisions validées :

- modèle **hybride** : un pari porte soit sur une **série**, soit sur un **match précis**, portée choisie à la création ;
- quota par joueur et par série : **1 pari série + 3 paris match** ;
- au plus 1 pari match par match → les 3 paris match visent 3 matchs différents ;
- pari match limité aux matchs bien identifiés (adversaire, date, heure confirmés) ;
- deadline différenciée :
  - pari série → verrouillé au début du 1er match de la série ;
  - pari match → verrouillé au début du match visé (reste ouvert série déjà commencée) ;
- workflow des statuts : `BROUILLON → SOUMIS → VALIDÉ → GAGNÉ/PERDU`, `↘ REFUSÉ`, `→ ANNULÉ` ;
- pari soumis non revu à sa deadline → auto-validé à la difficulté proposée, admin peut revoir à tout moment ;
- pari refusé : avant deadline → slot libéré et reproposable ; après → slot perdu ;
- échelle de difficulté à **5 niveaux**, proposés par le joueur et validés/ajustés par l’admin (niveau validé fait foi) ;
- scoring : plus la difficulté validée est élevée, plus le pari gagné rapporte ; perdu = 0 ; jamais négatif ;
- valeurs chiffrées et forme de progression renvoyées à 0.2.5 ;
- visibilité : chaque pari devient visible à sa propre deadline, détail nominatif public (visiteurs inclus) ;
- vérification gagné/perdu **manuelle** par l’admin en V1, journalisée, via une interface admin rapide ;
- évolution non bloquante : pré-remplissage IA de la suggestion gagné/perdu, admin confirme.

Livrable déjà généré :

- `nba_pronos_decisions_0_2_4_paris_personnalises.md`

---

### 0.2.5 — Scoring global `[À TRAITER]`

À valider :

- points pour bon vainqueur de match ;
- barème progressif de l’écart ;
- condition du bonus écart ;
- points de bracket par tour ;
- bonus score de série ;
- bonus champion NBA ;
- valeurs des 5 niveaux de difficulté des paris personnalisés ;
- forme de progression entre niveaux (linéaire ou exponentielle) ;
- pondération entre matchs, bracket, séries et paris personnalisés.

Objectif : éviter qu’une source de points déséquilibre tout le classement.

---

### 0.2.6 — Classement et visibilité `[À TRAITER]`

Déjà validé :

- classement public accessible aux visiteurs ;
- détail des sources de points visible publiquement ;
- bracket global public ;
- départage principal par nombre de bons vainqueurs.

À valider :

- niveau de détail visible pour les joueurs connectés ;
- niveau de détail visible pour les visiteurs ;
- classements secondaires ;
- départages complémentaires ;
- détail public ou privé des pronostics individuels.

---

### 0.2.7 — Administration `[À TRAITER]`

À valider :

- gestion des joueurs ;
- changement de rôle ;
- désactivation / réactivation ;
- gestion compétition ;
- supervision séries ;
- supervision matchs ;
- correction horaires / scores / statuts ;
- validation des paris personnalisés ;
- décision gagné/perdu des paris personnalisés ;
- interface admin de validation / résolution des paris (file d’attente, résolution rapide) ;
- workflow de requête de correction joueur → admin (remonté de 0.2.3) ;
- recalcul des scores ;
- logs admin.

---

### 0.2.8 — Données NBA, API et simulation `[À TRAITER]`

Déjà validé :

- prototype sans API réelle ;
- simulation d’API obligatoire ;
- V1 avec API NBA réelle ;
- correction manuelle admin possible.

À valider :

- simulation des matchs ;
- simulation des scores ;
- simulation des statuts ;
- choix futur d’API NBA ;
- mapping équipes ;
- mapping matchs ;
- cron Vercel ;
- logs de synchronisation ;
- recalcul automatique ;
- faisabilité du pré-remplissage IA des paris personnalisés (remonté de 0.2.4).

---

### 0.2.9 — UX/UI `[À TRAITER]`

Déjà validé :

- responsive mobile + desktop ;
- simplicité d’usage prioritaire ;
- brainstorming UX/UI dédié nécessaire.

À valider :

- direction visuelle ;
- navigation principale ;
- dashboard joueur ;
- design des cartes de match ;
- expérience de validation ;
- affichage des pronos des autres ;
- affichage des joueurs absents (« n’a pas pronostiqué » ou masqué, remonté de 0.2.3) ;
- affichage des paris annulés (remonté de 0.2.4) ;
- bracket mobile ;
- écrans admin ;
- ambiance générale.

---

### 0.2.10 — Prototype jetable `[À TRAITER]`

Déjà validé :

- prototype avant V1 propre ;
- tout le concept testé en version simplifiée ;
- simulation API ;
- pas d’API NBA réelle.

À valider :

- périmètre exact du prototype ;
- données fictives ;
- nombre de faux joueurs ;
- nombre de séries ;
- nombre de matchs ;
- scoring simplifié ;
- écrans minimum ;
- niveau de fidélité UX ;
- stack du prototype.

---

## 1. Livrables fonctionnels `[À PRODUIRE]`

### 1.1 — `SPEC_FONCTIONNELLE_V0.1.md`

Document consolidé regroupant toutes les décisions fonctionnelles validées.

Contenu prévu :

- vision produit ;
- périmètre V1 ;
- périmètre prototype ;
- utilisateurs et rôles ;
- bracket initial ;
- pronostics match ;
- paris personnalisés ;
- scoring ;
- classement ;
- visibilité ;
- administration ;
- API / simulation ;
- UX/UI ;
- cas limites ;
- points ouverts.

### 1.2 — Liste des points ouverts

Document court listant uniquement les décisions restant à prendre.

### 1.3 — Synthèse pour Claude / projets IA

Document optimisé pour être utilisé dans Claude Projects comme contexte global.

---

## 2. Livrables techniques `[À PRODUIRE]`

### 2.1 — `SPEC_TECHNIQUE_V0.1.md`

À produire après validation de la spec fonctionnelle.

Contenu prévu :

- architecture Next.js ;
- structure des routes ;
- Supabase Auth ;
- modèle SQL ;
- règles RLS ;
- types TypeScript ;
- server actions / API routes ;
- simulation API ;
- cron ;
- logs ;
- déploiement Vercel ;
- variables d’environnement ;
- stratégie GitHub.

### 2.2 — Modèle de données Supabase

Tables, relations, statuts, contraintes et index.

### 2.3 — Règles RLS

Politiques de sécurité par rôle et par table.

### 2.4 — Architecture Next.js

Structure `/app`, composants, layout, routes publiques, routes privées et routes admin.

### 2.5 — Stratégie API NBA / simulation

Différence entre prototype simulé et V1 avec API réelle.

---

## 3. Roadmap de développement `[À PRODUIRE]`

### 3.1 — Roadmap prototype jetable

Objectif : tester vite toutes les règles métier sans viser la qualité finale.

### 3.2 — Roadmap V1 propre

Objectif : reconstruire proprement avec Supabase, RLS, API, cron et déploiement.

### 3.3 — Plan de prompts / tâches pour Claude

Objectif : découper le développement en tâches courtes, contrôlables et générables via Claude Projects.

---

## 4. État d’avancement synthétique

Validé :

- 0.1 — Vision produit générale ;
- 0.2.1 — Accès, inscription et rôles ;
- 0.2.2 — Bracket initial ;
- 0.2.3 — Pronostics match par match ;
- 0.2.4 — Paris personnalisés.

À traiter ensuite :

- 0.2.5 — Scoring global ;
- 0.2.6 — Classement et visibilité ;
- 0.2.7 — Administration ;
- 0.2.8 — Données NBA, API et simulation ;
- 0.2.9 — UX/UI ;
- 0.2.10 — Prototype jetable.

À produire en fin de cadrage :

- spec fonctionnelle ;
- spec technique ;
- roadmap Claude ;
- plan prototype ;
- plan V1.
