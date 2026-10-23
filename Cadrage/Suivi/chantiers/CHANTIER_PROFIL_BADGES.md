# Chantier — Profil, badges et leur affichage (classement, profil, ailleurs)

> **Nature** : vivant — plan de chantier, découpé en lots d'une PR chacun
> (méthode `Cadrage/Suivi/README.md` : une étape par conversation). Rédigé le
> 23/10/2026 à partir du code de `main` et de la base de prod. Décisions D1–D8
> validées sur maquettes le 23/10/2026 (§3), avec la contrainte « DA en
> place, pas de nouvelles couleurs ».

---

## 1. Constat (état réel au 23/10/2026)

**Profil (soi-même)** — depuis #212, le Profil est un panneau
(`components/profile/SettingsDrawer.tsx`) : avatar à initiales, pseudo,
rang · points, carte de 3 stats (Précision, Meilleur rang, Badges), puis le
menu. Conséquences :
- le **bandeau aux couleurs de l'équipe favorite** (photo recolorée, blason,
  04/08/2026) n'est plus affiché nulle part pour soi ; `lib/queries/profile.ts`
  calcule encore ses données (à vérifier : probablement du code mort) ;
- les **badges épinglés** ne sont plus visibles par leur propriétaire : seul
  `/players/[userId]` les affiche (`PinnedBadges`). Épingler n'a plus de
  vitrine pour soi ;
- la pastille « badge non vu » est un TODO (`SettingsDrawer.tsx`), bloquée
  parce que le « vu » vit en localStorage (`badges-seen:<userId>`).

**Badges** — `/stats?tab=badges` : 6 catégories, ~35 badges en cartes
retournables (`BadgeCard`, flip pour la description), écusson au métal du
palier (`BadgeEmblem`, tailles sm/md/lg), bouton épingle sur chaque carte
débloquée (max 3, `users.pinned_badge_ids`). Popup de déblocage
(`NewBadgesWatcher`). Lecture pure via les vues `user_badges_lifetime` /
`user_competition_streaks` : **aucune date de déblocage stockée**. Icônes
`lucide-react` en attendant les visuels dessinés (p6-20, 3/35 pilotés).

**Classement** — `LeaderboardRow` : rang, tendance, avatar à initiales,
pseudo (lien vers `/players/[id]`), pastille de correction. **Aucun badge.**
Même chose dans `StickyMeBar`.

**Profil public** `/players/[userId]` — en-tête `glass-card` : pseudo +
`PinnedBadges` (sm, `title` seulement — illisible au tap mobile), tag
Admin/désactivé, équipe favorite, bio ; puis Palmarès hebdo, rang,
bracket, pronos, paris. Pas de vue d'ensemble des badges du joueur.

**Adoption (prod, 23/10)** : 2 joueurs sur 24 ont épinglé un badge, 5 sur 24
ont choisi une équipe favorite. → Tout affichage qui ne repose QUE sur
l'épinglage restera vide pour ~90 % des joueurs.

**Contrainte de spec** — `SPEC_BADGES_PERMANENTS_V0_1.md` §1 : aucune
comparaison directe entre joueurs dans un badge. Afficher la vitrine d'un
joueur à côté de son nom n'est pas une comparaison (c'est déjà fait sur
`/players`), mais une mention de rareté (« 12 % des joueurs ») le serait
davantage → décision D6.

### 1 bis. Vu en réel (panierballon.fr, 23/10/2026, 375 px et desktop, compte Rillettes-31)

- **Page Badges sur mobile : une carte par ligne.** 35 cartes de 200 px de
  haut → page de **7 900 px** (~10 écrans). Cause :
  `BadgesSection.module.css` → `minmax(9.5rem, 1fr)` ne laisse pas tenir 2
  colonnes dans ~309 px avec la gouttière. Sur desktop, 3 colonnes, correct.
- **Cartes verrouillées quasi illisibles** : gris translucide posé sur la
  photo de fond, l'écusson se fond dans le décor (Money-time, Comptable…).
- **On arrive sur « Badges » sans voir l'onglet actif** : les 6 onglets de
  `/stats` défilent horizontalement, « Badges » est hors écran à 375 px.
- **La barre de progression ne se voit pas** sur la face avant : seul le
  texte « 15/25 » est lisible.
- **Épinglage** : 3 badges épinglés, mais les boutons disent « Épingler dans
  le bandeau de profil » (bandeau qui n'existe plus pour soi). Épinglé =
  fond orange pâle sur l'icône, peu distinct.
- **Page joueur `/players/[id]`** : les 3 badges épinglés font ~18 px à
  côté du pseudo, illisibles ; pas de bandeau d'équipe (juste une ligne
  logo + « Memphis Grizzlies »).
- **Panneau Profil** : avatar « RI » orange, comme tout le monde ; « Badges
  17 » n'indique pas sur combien (35).
- **Classement** : vue Général = avatars à initiales tous orange (« R3 »,
  « R4 » pour Rillettes-31/49 : indistinguables) ; vue Semaine = aucun
  avatar. **Ta propre ligne n'est pas mise en évidence en vue Général**
  (`rowMe` n'existe que dans `WeeklyLeaderboardList`).
- Un premier passage sur mobile affiche la popup « Bienvenue » par-dessus
  `/stats` (normal pour un nouvel appareil, à garder en tête pour la recette).

---

## 2. Cible

Une **identité de joueur unique** (avatar + pseudo + vitrine de badges),
rendue par un seul composant à plusieurs tailles, partout où un joueur
apparaît : panneau Profil, page profil, classement, barre « moi »,
éventuellement chat et popups. Une **vitrine** qui n'est jamais vide quand
le joueur a au moins un badge. Une **page Badges** qui donne envie de
progresser (prochain palier, progression) au lieu d'une grille à retourner
carte par carte.

---

## 3. Décisions

**Validées le 23/10/2026** sur maquettes (canevas « Panier Ballon — Profil &
badges »), avec une contrainte transversale : **respecter la DA en place,
sans ajouter de couleurs.** Concrètement : fond bleu-nuit, accent orange
unique, métaux de palier existants (`--color-tier-*`) pour les badges et
rien d'autre ; les couleurs d'équipe restent cantonnées au bandeau photo du
profil (validé le 04/08) et au bandeau télé du prono, jamais sur les avatars
ni dans le classement.

| # | Question | Décision |
|---|---|---|
| D1 | Que montre la vitrine quand le joueur n'a rien épinglé ? | **Choix auto** : les 3 badges de plus haut palier (à palier égal : le plus récent dans l'ordre du catalogue). Les épinglés passent toujours devant. |
| D2 | Combien de badges dans une ligne de classement ? | **1 en portrait mobile, 3 en paysage/desktop.** Le n° 1 de la vitrine = le « badge signature ». |
| D3 | Où vit « mon profil » ? | **Une vraie page « Mon profil » à onglets Stats · Badges · Historique · Ligues**, ouverte en touchant son pseudo dans le panneau (aujourd'hui ça mène au changement de pseudo — contre-intuitif). En-tête commun : bandeau d'équipe, avatar, pseudo + badge signature, rang, « Modifier le profil ». Le changement de pseudo passe dans Compte (« Identifiants et pseudo ») et dans « Modifier le profil ». `/players/[id]` partage le même en-tête, onglets réduits pour les autres (voir Lot 3). |
| D4 | Ramener le bandeau aux couleurs de l'équipe ? | **Oui, sur l'en-tête de la page profil** (soi et public), avec le rendu validé le 04/08. Rien ne change sans équipe choisie. |
| D5 | « Badge vu » en base plutôt qu'en localStorage ? | **Oui** (colonne `users.badges_seen jsonb`) : débloque la pastille du panneau, marche entre appareils, plus de « tout défile » au 1er passage sur un nouveau téléphone. |
| D6 | Afficher la rareté d'un badge (% de joueurs qui l'ont) ? | **Non pour l'instant** (frôle la règle §1, et peu parlant à 24 joueurs). À rouvrir avec plus de joueurs. |
| D7 | Stocker la date de déblocage de chaque palier ? | **Oui, en même temps que D5** (même table/colonne) : permet « débloqué le 12/10 » dans le détail et un tri « récents ». Pas rétroactif : les badges déjà acquis n'auront pas de date. |
| D8 | Photo de profil / avatars (p6-22) ? | **Hors de ce chantier.** Avatar à initiales inchangé (orange sur fond orange pâle, comme aujourd'hui — PAS teinté équipe, contrainte DA). Seul correctif : des initiales lisibles (« RI » et non « R3 » pour Rillettes-31). |

---

## 4. Lots

Ordre conseillé : Q → 0 → 1 → 2 → 3 → 4 → 5, puis 6 et 7 quand tu veux.
Chaque lot = une branche + un worktree + une PR, recette téléphone (375 px)
et desktop avant merge.

### Lot Q — Correctifs rapides (avant la refonte, ~1 session)

Petits gains visibles tout de suite, sans décision à prendre :
1. Page Badges : **2 colonnes à 375 px** (`minmax(8.5rem, 1fr)` ou
   `repeat(2, 1fr)` sous 480 px) ; vérifier que les libellés longs
   (« Buzzer-beater (série) ») passent sur 2 lignes proprement.
2. Cartes verrouillées : fond opaque (`--color-surface-*`) au lieu du gris
   translucide, écusson en contour lisible.
3. Onglets `/stats` : faire défiler l'onglet actif dans la vue au
   chargement (`scrollIntoView({ inline: "center" })` côté client, ou
   ordre/largeur revus).
4. Libellés du bouton épingle : « Mettre en vitrine » / « Retirer de la
   vitrine » (plus de « bandeau de profil »).
5. Classement vue Général : mettre en évidence la ligne du joueur connecté
   (même style que `rowMe` de la vue Semaine).
6. Panneau Profil : « 17/35 » au lieu de « 17 ».

**Recette** : 375 px et desktop, thème clair et sombre.

### Lot 0 — Maquettes ✅ (23/10/2026)

Canevas « Panier Ballon — Profil & badges » (artifact claude.ai, hors
dépôt) : classement portrait/paysage, pop-over d'un badge, profil vu par
les autres, « Mon profil » à onglets, panneau Profil, page/onglet Badges,
fiche d'un badge, écusson. Validées sous réserve de la contrainte DA (§3).
Sources HTML des maquettes (couleurs, tailles, espacements exacts, lisibles
par Claude Code) : `Cadrage/V1/Spec visuelle/maquettes_profil_badges/`.
Ce sont des références visuelles, pas du code à copier : l'implémentation
suit les conventions du dépôt (CSS Modules, tokens de `app/tokens.css`,
composants serveur par défaut).

### Lot 1 — Fondations : vitrine et état « vu » côté serveur

- `lib/badges/showcase.ts` (pur, testé vitest) :
  `resolveShowcase(badges, pinnedIds, max)` → épinglés d'abord, complétés
  par le choix auto (D1). Tests : 0/1/3 épinglés, épinglé devenu invalide,
  aucun badge.
- `lib/queries/badges.ts` : `getShowcaseBadges(userIds: string[])` en
  **lecture groupée** (une requête sur `user_badges_lifetime` +
  `user_competition_streaks` + `users.pinned_badge_ids` filtrée par
  `in(user_id, ...)`), pour le classement. Factoriser avec
  `getProfileBadges` pour ne pas dupliquer le calcul des paliers.
  Mesurer le temps sur le classement complet ; si ça coûte, prévoir une
  vue matérialisée rafraîchie par le cron de synchro (pas avant d'avoir mesuré).
- Si D5/D7 validés : migration `users.badges_seen jsonb` (forme
  `{ "<badgeId>": { "tier": "OR", "seen_at": "...", "unlocked_at": "..." } }`),
  RLS : lecture/écriture par le propriétaire seulement ; Server Action
  `markBadgesSeen()` ; `NewBadgesWatcher` lit/écrit en base (repli
  localStorage le temps d'une version, puis retrait). Mettre à jour export
  RGPD et `delete_account_data`.
- Pièges : vues `security_invoker = false` (n'exposer que des agrégats) ;
  migration appliquée à la main (`audit/RUNBOOK_MIGRATIONS.md`) ; revue des
  objets dépendants (audit DATA-001).

**Recette** : tests verts, aucun changement visible.

### Lot 2 — Composants d'identité partagés

- `components/player/PlayerIdentity.tsx` (serveur) : avatar (initiales
  corrigées, couleurs actuelles) + pseudo (lien optionnel) + `BadgeStrip`. Tailles
  `row` (classement), `bar` (StickyMeBar), `header` (page profil).
- `components/badges/BadgeStrip.tsx` : N écussons `sm`, ordre de la
  vitrine, débordement « +k » optionnel.
- `components/badges/BadgePopover.tsx` (client, le seul) : au tap/clic sur un
  écusson, nom + palier + description courte + lien « Voir ses badges ».
  Remplace les `title` illisibles sur mobile. Un seul pop-over ouvert à la
  fois, fermeture Échap/clic extérieur, focus géré (réutiliser `FocusTrap`
  si pertinent).
- Remplacer `PinnedBadges` par `BadgeStrip` (garder l'export le temps de la migration).
- CSS Modules + tokens de `app/tokens.css` uniquement.

**Recette** : page de test interne ou storybook-like non nécessaire ; vérifier
sur `/players/[id]` qui l'utilise déjà.

### Lot 3 — « Mon profil » à onglets (+ profil des autres)

Le plus gros lot ; à découper en 2 PR si besoin (3a structure + en-tête,
3b contenu des onglets).

- **Route** : `/profile` redevient une vraie page (aujourd'hui elle ne fait
  que rediriger). Onglets en `?tab=stats|badges|historique|ligues`, défaut
  `stats`. Les anciennes URLs `/profile?tab=stats|historique|ligues` (déjà
  gérées en redirection) retombent naturellement sur le bon onglet ;
  `/stats`, `/stats?tab=badges`, `/profile/historique`, `/profile/ligues`
  redirigent vers l'onglet correspondant. `/players/[moi]` → `/profile`.
- **En-tête commun** (`PlayerIdentity size="header"`, partagé avec
  `/players/[id]`) : bandeau d'équipe (D4 — rendu du 04/08 : photo
  désaturée recolorée, blason, voir `lib/labels/teamColors.ts` et ce qui
  reste dans `lib/queries/profile.ts`), avatar, pseudo + badge signature,
  équipe, puces rang / badges / meilleur rang. Mode soi : bouton
  « Modifier le profil » (pseudo, équipe, bio).
- **4 onglets en barre fixe**, 4 colonnes égales qui tiennent à 375 px (ne
  PAS reproduire les 6 onglets défilants de `/stats`, cf. §1 bis). Pastille
  « nouveaux » sur Badges (D5).
  - *Stats* : contenu actuel de `/stats` repris tel quel (refonte de
    l'onglet Stats = chantier séparé, plus tard — décision du 23/10). Seule
    exigence : ne pas empiler une 2e rangée d'onglets défilants sous la
    1re ; à défaut de mieux, un sélecteur simple.
  - *Badges* : contenu du Lot 4 (vitrine, le plus proche, filtres, grille).
  - *Historique* : contenu actuel de `/profile/historique`.
  - *Ligues* : contenu actuel de `/profile/ligues`.
- **Panneau Profil** (`SettingsDrawer`) : la carte d'identité mène à
  `/profile` (et plus à `/profile/pseudo`) ; « Voir mon profil » écrit ;
  badge signature à côté du pseudo ; « 17/35 ». Les lignes Stats / Badges /
  Historique / Ligues restent comme raccourcis vers les onglets (on pourra
  les retirer plus tard si elles font doublon) ; « Identifiants » devient
  « Identifiants et pseudo ».
- **Profil des autres** `/players/[id]` : même en-tête, onglets réduits à
  ce qui est public — **Badges** (lecture seule) et **Pronos & paris**
  (contenu actuel : rang, bracket, pronostics, paris, palmarès). Pas de
  Ligues ni d'Historique (privés). La RLS reste seule juge de ce qui
  s'affiche.
- Nettoyer le code mort du bandeau s'il y en a.

**Recette** : soi vs autre joueur, avec/sans équipe, avec/sans badge,
compte désactivé, visiteur non connecté, toutes les anciennes URLs
(favoris, notifications push, mails) qui doivent atterrir au bon endroit.

### Lot 4 — Onglet Badges

- En-tête : « 17/35 débloqués » + **« Le plus proche »** : les badges
  dont le prochain palier est le plus proche en % (« plus qu'un prono pour
  l'Or »).
- Vitrine en haut : 3 emplacements + « Modifier » (remplace l'épingle sur
  chaque carte).
- Filtres Tous / Débloqués / À débloquer + catégories conservées.
- Grille **2 colonnes** à 375 px, cartes compactes ; badges en vitrine et
  nouveaux signalés par une puce.
- Remplacer le flip par une **fiche détail** (bottom sheet mobile, panneau
  desktop) : grand écusson, description, les 5 seuils avec le palier
  atteint, progression, date de déblocage si D7, « Mettre en vitrine ».
- La grille reste un composant serveur ; seul le sheet est client.
- Le même composant sert, en lecture seule, l'onglet Badges de
  `/players/[id]`.

**Recette** : 375 px, clavier, lecteur d'écran (libellés des écussons),
thème clair/sombre (l'écusson garde son cœur sombre).

### Lot 5 — Classement

- `LeaderboardRow` et `StickyMeBar` passent sur `PlayerIdentity size="row"` /
  `"bar"` avec 1 ou 3 badges (D2), données de `getShowcaseBadges()` chargées
  avec le classement (une requête de plus, pas une par ligne).
- Tap sur l'écusson → `BadgePopover` ; tap sur le pseudo → profil (comme
  aujourd'hui). Attention aux zones de tap qui se chevauchent sur mobile.
- En profiter pour mémoïser `LeaderboardRow` (GAPS_OUVERTS, déjà identifié).
- Vérifier le classement hebdo (`WeeklyLeaderboardList`) et le bandeau
  champion : même composant ou rien, mais pas deux styles.
- Vérifier le snapshot du classement (`leaderboard_snapshots`) : non
  concerné, l'affichage est lu à la volée.

**Recette** : 24 joueurs, ligues privées, tri par colonnes, paysage, temps
de chargement avant/après (noter les chiffres dans la PR).

### Lot 6 — Ailleurs (optionnel, petit)

Badge signature à côté du pseudo dans : messages du chat, popup « Pronos et
paris des autres », popup hebdo/champion. Même `PlayerIdentity`, rien de
nouveau à concevoir. Un endroit par PR si ça touche des requêtes.

### Lot 7 — Visuels dessinés des badges (p6-20, indépendant)

`BadgeEmblem` isole déjà le centre de l'écusson : remplacer la table
`BADGE_ICONS` (`lib/badges/icons.tsx`) par des SVG dessinés badge par badge,
sans toucher au reste. Peut avancer en parallèle de tout le chantier, au
rythme des visuels (prompts déjà prêts : `Cadrage/V1/Spec visuelle/PROMPTS_BADGES_*.md`).

---

## 4 bis. Livraison groupée (« mise à jour » du lundi 26/10/2026)

Décision du 23/10 : rien de ce chantier ne part en production au fil de
l'eau. Tout est livré d'un bloc au début de la semaine de compétition
suivante, comme une mise à jour.

**Branche d'intégration** `release/profil-badges`, créée depuis `main`.
- Chaque lot : sa branche (`feat/pb-lot-q`, `feat/pb-lot-1`…) et son
  worktree, créés **depuis `release/profil-badges`**, et sa PR **vers
  `release/profil-badges`, jamais vers `main`**. Rien n'est donc déployé en
  production tant que la branche d'intégration n'est pas fusionnée.
- Vercel construit un aperçu (preview) pour chaque branche poussée : la
  recette se fait sur l'aperçu de `release/profil-badges`, sur téléphone.
- `main` continue de vivre (correctifs paris, IA…) : fusionner `main` dans
  `release/profil-badges` régulièrement (au moins avant la recette finale)
  pour éviter les conflits du dernier moment.
- Fichiers de suivi (`REPRISE.md`, `JOURNAL_SESSIONS.md`, ce fichier) :
  commités sur `main` directement, pour ne pas créer de conflits avec les
  passations des autres chantiers.

**Base de données** — les aperçus Vercel utilisent la MÊME base Supabase que
la prod (même clé anon en preview et en production). Donc :
- tout ce qu'on fait sur un aperçu (épingler, marquer « vu ») touche les
  vraies données — sans risque ici, mais à savoir ;
- la migration du Lot 1 (`users.badges_seen`) est **additive** : elle peut
  être appliquée en prod en avance (l'ancien code l'ignore), et doit l'être
  avant de tester le Lot 1 sur l'aperçu. Aucune migration destructive dans
  ce chantier ;
- à vérifier au premier aperçu : la connexion fonctionne sur le domaine
  `*.vercel.app` (Turnstile et les URL de redirection Supabase peuvent être
  limités à panierballon.fr).

**Jour J** (lundi 26/10, après les matchs de la nuit et avant le début de
la semaine à 10 h, en évitant les crons de 8 h/9 h UTC) :
1. fusionner `main` dans `release/profil-badges`, dernière recette sur
   l'aperçu ;
2. PR `release/profil-badges` → `main`, fusion par l'utilisateur → déploiement
   automatique ;
3. recette rapide sur panierballon.fr (classement, profil, badges, anciennes
   URL) ; en cas de pépin, « Instant Rollback » Vercel vers le déploiement
   précédent ;
4. optionnel : un message « Quoi de neuf » dans le chat général.

**Périmètre réaliste d'ici lundi** (1 lot ≈ 1 session) : Q, 1, 2, 4, 5 en
priorité, puis 3. Ce qui n'est pas prêt et recetté dimanche soir attend la
mise à jour suivante (lundi 02/11) — ne pas fusionner un lot à moitié testé.
L'onglet Stats de « Mon profil » reprend `/stats` tel quel ; sa refonte est
un chantier séparé, plus tard.

## 5. Hors périmètre

Photo de profil/avatars (p6-22) ; badge Grimpeur ; rareté des badges (D6) ;
classement all-time ; nouveaux badges.

---

## 6. Démarrer un lot dans Claude Code

Coller en début de conversation (adapter le n° de lot) :

```text
Lis Cadrage/Suivi/REPRISE.md puis Cadrage/Suivi/chantiers/CHANTIER_PROFIL_BADGES.md.
On fait le Lot <n> et seulement lui, sur une branche créée depuis
release/profil-badges et une PR vers release/profil-badges (jamais vers main,
cf. §4 bis). Les décisions D1–D8 de la §3 sont
tranchées comme indiqué dans le fichier. Avant de coder, lis les docs Next.js
de node_modules/next/dist/docs/ utiles au lot (AGENTS.md), puis propose-moi
la liste des fichiers touchés et l'ordre des commits. Une branche + un
worktree. Tests vitest pour toute logique pure. À la fin : passation
(REPRISE.md, une ligne de JOURNAL_SESSIONS.md, cocher le lot ici).
```

## 7. Suivi

- [ ] Lot Q — Correctifs rapides
- [x] Lot 0 — Maquettes, D1–D8 tranchées (23/10)
- [ ] Lot 1 — Vitrine + état « vu » en base
- [ ] Lot 2 — Composants d'identité
- [ ] Lot 3 — « Mon profil » à onglets
- [ ] Lot 4 — Onglet Badges
- [ ] Lot 5 — Classement
- [ ] Lot 6 — Ailleurs
- [ ] Lot 7 — Visuels dessinés
