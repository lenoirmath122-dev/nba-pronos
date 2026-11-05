# Cadrage : refonte de la carte de prono (forme + popup « Détail des équipes »)

> Brief à donner à Claude Code. Maquette validée : canvas « Carte de prono — refonte » (https://claude.ai/artifact/JDUbhsMdYjqbU3FKz9rDTp, privé).

## 1. Contexte

App Panier Ballon (Next.js + CSS Modules d'après les noms de classes générés, déployée sur Vercel). Écran concerné : **`/play` → onglet « Mes pronos »**, une carte par match.

Aujourd'hui, une carte contient :
- l'heure et le compte à rebours ;
- deux boutons d'équipe (logo + abréviation) et le bouton de participation (classe `ParticipationTrigger`) ;
- quand une équipe est choisie, le sélecteur d'écart (classe `MarginStepper`) ;
- sous les boutons, un bloc de forme par équipe (« GSW 5-3 », « V V V V V », « En feu ») ;
- un bouton « Détail des équipes » qui ouvre une popup (en-tête de forme, « Joueurs à surveiller », « Effectif complet », légende) ;
- les boutons « Enregistrer le brouillon » / « Valider le prono » ;
- le bloc « Mon pari » (texte libre, jusqu'à 15 pts, « Soumettre »).

Objectif : alléger la carte et ranger tout le détail dans une popup à onglets, **sans toucher à la logique de prono ni aux données**.

## 2. Périmètre

**Dans le périmètre**
1. Forme sur 5 matchs affichée **dans le bouton d'équipe**, sous forme de 5 traits.
2. Suppression du bloc de forme texte sous les boutons.
3. Refonte de la popup « Détail des équipes » en **3 onglets** : Face à face, Effectif, Joueurs à surveiller.
4. Deux petits bugs relevés (section 6).

**Hors périmètre**
- Le sélecteur d'écart : **il reste exactement comme aujourd'hui**. N'ajoute aucun repère, aucune moyenne ni aucune aide au choix de l'écart.
- « Mon pari », les brouillons, la validation, le barème, la participation.
- Le calcul et la récupération des stats : réutilise les données qui alimentent déjà la popup actuelle.
- La page d'accueil publique (`/`).

## 3. Changement 1 : forme dans le bouton d'équipe

- Sous l'abréviation de l'équipe, à l'intérieur du bouton : **5 traits horizontaux** (environ 16 × 4 px, espacés de 3 px, coins arrondis de 2 px), centrés.
- Vert = victoire (`--color-win`), rouge = défaite (`--color-loss`). **Pas de lettre V/D.**
- Ordre : **le match le plus récent à gauche**, comme l'affichage actuel. Exemple : Miami « V D V V D » avec « série en cours : 1 victoire ».
- Moins de 5 matchs joués : n'affiche que les traits disponibles, ou complète avec des traits neutres (`--color-pending`) ; choisis l'option la plus simple et précise-la dans ton récap.
- Accessibilité : le groupe de traits porte un `aria-label`, par exemple « 5 derniers matchs : 3 victoires, 2 défaites ». La couleur seule ne suffit pas pour les lecteurs d'écran ni pour les daltoniens.
- Les états du bouton (normal, sélectionné avec bordure orange et fond teinté, non sélectionné) ne changent pas. La hauteur du bouton augmente juste pour accueillir les traits.
- **Supprime** le bloc sous les boutons (bilan « 5-3 », lettres V/D, badge « En feu »). Ces infos passent dans l'onglet Face à face.

## 4. Changement 2 : popup « Détail des équipes » à onglets

### Structure commune
- En-tête : titre « Détail des équipes », sous-titre « GSW – MIA · cette nuit, 04:00 » (abréviations et heure du match), bouton « Fermer » avec une croix.
- Barre d'onglets sous l'en-tête : **Face à face** (par défaut) · **Effectif** · **Joueurs à surveiller**.
  - L'onglet actif a le texte en couleur principale et un soulignement orange de 2 px. Les onglets inactifs sont en texte atténué.
  - Sémantique ARIA : `role="tablist"`, `role="tab"`, `aria-selected`, `role="tabpanel"`. Les flèches gauche/droite passent d'un onglet à l'autre si c'est simple à faire.
- Le contenu défile à l'intérieur de la popup. L'en-tête et les onglets restent fixes.
- Mobile : la popup occupe presque tout l'écran (environ 12 px de marge latérale, 32 px en haut et en bas). Desktop : largeur max d'environ 480 px, centrée, hauteur max d'environ 85vh.
- Fermeture par le bouton, par Échap et par un clic sur le fond, si la popup actuelle le gère déjà. Garde le focus piégé dans la popup comme aujourd'hui, ou ajoute-le s'il manque.
- À chaque ouverture, la popup se rouvre sur l'onglet Face à face.

### Onglet Face à face
Deux colonnes (GSW à gauche, MIA à droite) et une étiquette centrale par ligne :

| Ligne | Exemple GSW | Exemple MIA |
|---|---|---|
| En-tête | logo + GSW | MIA + logo |
| Forme | badge « En feu » | badge « En forme » |
| 5 derniers | 5 traits (même composant qu'en §3) | 5 traits |
| Bilan | 5-3 | 3-5 |
| Classement | 8e Ouest | 9e Est |
| Écart moyen (5 derniers) | +11,4 | +1,6 |
| Série en cours | 5 V | 1 V |
| À domicile | 3-1 | 1-3 |
| À l'extérieur | 2-2 | 2-2 |

Sous le tableau : « Début de saison : peu de matchs joués, ces chiffres bougent vite. Classement indicatif. » Affiche cette phrase aux mêmes conditions qu'aujourd'hui.

Le badge « En feu » est en orange sur fond orange léger. Les autres badges de forme sont en gris sur fond `navy-700`. Garde la logique de libellé existante.

### Onglet Effectif
- Sélecteur d'équipe segmenté en haut : « GSW · 15 joueurs » | « MIA · 14 joueurs ».
- Phrase d'aide : « Moyennes par match. Touche une colonne pour trier. »
- Tableau :
  - colonnes dans cet ordre : **Joueur, PTS, REB, PD, 3PTS, % tir, MIN, M** (M = matchs joués) ;
  - tri par défaut : PTS décroissant. Un toucher sur un en-tête trie par cette colonne en décroissant. L'en-tête actif est en orange, souligné, avec une flèche ↓, et sa colonne a un fond orange très léger ;
  - un `% tir` absent s'affiche « – » et passe en fin de tri ;
  - noms abrégés : initiale du prénom + nom (« S. Curry », « G. Antetokounmpo »). Laisse tels quels les prénoms qui sont des initiales (« LJ Cryer ») ;
  - badge « T » à côté du nom pour un titulaire ;
  - la colonne Joueur reste fixe au défilement horizontal, et la ligne d'en-tête reste fixe au défilement vertical ;
  - nombres en police chiffres (`--font-numeric`), décimales à virgule, alignés à droite.
- Pied fixe : « Mis à jour le 05/11 à 09:52 » (la donnée existe déjà) et un bouton « Légende » qui déplie une ligne : « PTS points · REB rebonds · PD passes décisives · 3PTS paniers à 3 points réussis · % tir part des tirs réussis · MIN minutes · M matchs joués · T titulaire ».

### Onglet Joueurs à surveiller
- Même sélecteur d'équipe que l'onglet Effectif. Le choix d'équipe est partagé entre les deux onglets.
- Une carte par joueur à surveiller. **Réutilise la sélection actuelle** des 3 joueurs : la maquette montre les 3 meilleurs marqueurs, ce qui correspond aux données actuelles.
  - nom complet en gras ;
  - ligne secondaire : « Titulaire · 6 matchs · 28,8 min · 47 % au tir » ;
  - 4 tuiles en grille : PTS, REB, PD, 3PTS (valeur en gros, libellé en petit). Ces tuiles ne sont pas cliquables.
- Note de bas : « Moyennes par match en saison régulière. »

## 5. Design system à utiliser

Utilise les variables CSS existantes (`:root`), sans aucune couleur en dur :
- surfaces : `--color-surface-base`, `--color-surface-raised` (popup, carte), `--color-surface-inset` (boutons, tuiles) ;
- bordures : `--color-border-hair`, `--color-border-subtle`, `--color-border-strong` ;
- texte : `--color-text-primary`, `--color-text-secondary` et le gris atténué existant ;
- accent : `--color-accent` (orange `#ff6a2b`) ;
- états : `--color-win`, `--color-loss`, `--color-pending` ;
- polices : `--font-ui` (Sora), `--font-numeric` (Oswald).

Cibles tactiles d'au moins 44 px (onglets, sélecteurs, en-têtes de tri, Fermer). Contraste du texte d'au moins 4.5:1.

## 6. Bugs annexes à corriger

1. Il manque une espace dans « 5 victoires**d'**affilée » et « 1 victoire**d'**affilée » (texte de série).
2. Le bandeau « Prochain à pronostiquer » affiche « GSW – MIA · **06/11** 04:00 », alors que la carte indique « Match du **05/11** », nuit du 05 au 06. Trouve la cause, probablement un fuseau ou une convention de date « nuit du », et aligne les deux affichages sur la convention de la carte.

## 7. Critères d'acceptation

- [ ] Chaque bouton d'équipe affiche jusqu'à 5 traits verts ou rouges, le plus récent à gauche, avec un `aria-label` lisible.
- [ ] Le bloc de forme texte sous les boutons a disparu.
- [ ] Le sélecteur d'écart, les brouillons, la validation et « Mon pari » se comportent exactement comme avant.
- [ ] La popup s'ouvre sur Face à face et passe d'un onglet à l'autre sans recharger les données.
- [ ] Face à face affiche les 8 lignes de la section 4 pour les deux équipes.
- [ ] Effectif : le tri marche sur les 7 colonnes, la colonne Joueur et l'en-tête restent fixes, le « – » passe en dernier et la légende se déplie.
- [ ] Joueurs à surveiller : 3 cartes par équipe, sélecteur d'équipe partagé avec Effectif.
- [ ] Rendu correct à 375 px de large et sur desktop, sans défilement horizontal de la page.
- [ ] Les deux bugs de la section 6 sont corrigés.
- [ ] Lint, types, tests et build passent.

## 8. Démarche attendue

1. **Explore avant de coder** : repère le composant de carte (`UpcomingRow`), le sélecteur d'écart (`MarginStepper`), la popup actuelle (cherche « Détail des équipes ») et la source des stats. Résume ce que tu as trouvé en quelques lignes avant de modifier quoi que ce soit.
2. Crée un petit composant réutilisable pour les 5 traits (bouton et onglet Face à face).
3. Refonds la popup en gardant ses props et ses données d'entrée. Si tu dois découper le code, fais-le en sous-composants par onglet.
4. Ne modifie ni l'API, ni le schéma Supabase, ni la récupération des données. Si une donnée manque, **arrête-toi et signale-le** au lieu de l'inventer.
5. Vérifie dans le navigateur à 375 px et sur desktop, sur au moins deux matchs, dont un avec une équipe qui a peu de matchs joués.
6. Termine par un récap : fichiers modifiés, choix faits sur les points ouverts (moins de 5 matchs, cause du bug de date), et ce qui reste à vérifier.
