# Panier Ballon — Cadrage business, identité et communication

> Document de synthèse produit en session Cowork le 26-27/08/2026, à partir de trois
> documents de travail (feuille de route, identité de marque, plan de communication).
> Suit le même esprit que les docs de `Cadrage/` du dépôt : ce qui est acté est marqué
> comme tel, ce qui reste ouvert aussi. Rien ici ne modifie le cadrage fonctionnel ou
> technique existant — ce document couvre uniquement le volet business/marque/communication,
> jusque-là absent du dépôt.

---

## 1. Modèle économique

**Recadrage acté en cours de session** : le contenu produit pour le lancement n'est pas un
projet à monétiser séparément (pas de produit digital sur le récit de la construction, pas
d'audience personnelle à faire fructifier à côté). C'est le moteur marketing d'un seul
produit : **Panier Ballon**, l'application elle-même. Si l'audience construite en chemin
donne un jour envie d'un revenu indépendant, ce sera une option à évaluer à ce moment-là —
pas une brique du plan actuel.

### Calendrier des grandes phases

| Phase | Fenêtre | Focus |
|---|---|---|
| 0 — Fondations & alpha | 26 août – fin sept. 2026 | V1 de l'app finie ; alpha privée avec 3-5 groupes de potes proches en septembre ; corrections à partir de leurs retours. Compétition en format NBA Cup **fictif** (aucun vrai match ne se joue en septembre — chaque match emprunte le score et les vraies stats d'un match NBA de la saison passée, `entity_mappings`) |
| 1 — Bêta | Oct. – nov. 2026 | Élargissement au-delà du premier cercle (contacts de contacts, premiers abonnés Instagram), montée du rythme de contenu. Compétition en format NBA Cup **réel** cette fois — le vrai tournoi officiel de la ligue, qui se joue chaque année en novembre : vrais matchs, en direct, aucun emprunt |
| 2 — Itération | Déc. 2026 – mars 2027 | Corriger, trancher le modèle de monétisation, préparer le lancement |
| 3 — Lancement | Avril 2027 → | Lancement iOS/Android (calé sur les vrais playoffs NBA), bascule en mode entretien (< 5h/semaine) |

### Addendum — session Cowork du 15/09/2026

**Précision actée le 15/09/2026** : la Phase 1 — Bêta déborde légèrement la fenêtre
"oct.–nov." indiquée plus haut — la vraie NBA Cup se joue en phase de groupes du
30 octobre au 27 novembre, puis en phases finales à élimination directe du 4 au
11 décembre (quarts 4-5 déc., demies 8-9 déc., finale 11 déc.). C'est cette dernière
semaine qui sert de bêta non-officielle à plus grande échelle : cible indicative
50-100 utilisateurs actifs, en fonction du recrutement réel pendant l'alpha et le
début de bêta — pas un chiffre à atteindre au 1er novembre, un palier à viser sur
la fenêtre NBA Cup.

Deux vagues d'élargissement supplémentaires ensuite, avant la Phase 2 (creux
volontaire) :
- **Christmas Day (25 déc.)** — pas un bracket, un pick'em léger sur les 5 matchs
  du jour ; bonne relance juste après la NBA Cup, pendant que tout le monde est
  devant la télé.
- **Play-In Tournament (mi-avril 2027, dates non encore publiées par la NBA)** —
  mini-bracket par conférence (7e vs 8e, 9e vs 10e, barrage) : répétition générale
  du vrai tournoi des playoffs, une semaine avant, qui vient nourrir directement
  la Phase 3b (Lancement avril).

### Monétisation de l'app — non tranchée

Le choix entre achat unique et abonnement/freemium reste ouvert. Recommandation : un achat
unique oblige à trouver continuellement de nouveaux acheteurs pour maintenir le revenu,
ce qui va à l'encontre de l'objectif de descendre sous 5h/semaine après le lancement ; un
abonnement/freemium génère un revenu récurrent sur la même base d'utilisateurs.

**Test à se poser en phase 2** : *"est-ce que quelqu'un qui a déjà résolu son problème avec
l'app y reviendrait le mois prochain ?"* Si oui → abonnement/freemium plutôt qu'achat unique.

### Budget (plafond 500 €)

| Poste | Quand | Coût estimé |
|---|---|---|
| Nom de domaine (1 an) | Phase 0 | ≈ 15 € |
| Compte développeur Apple (1 an) | Phase 2 | ≈ 92 € |
| Compte développeur Google Play (unique) | Phase 2 | ≈ 23 € |
| Outils (landing page, newsletter, design) | Continu | 0 € — paliers gratuits |
| **Engagé** | | **≈ 130 €** |
| **Réserve disponible** | | **≈ 370 €** |

La réserve peut financer une mise en avant ponctuelle au lancement (post sponsorisé ciblé,
geste symbolique pour les premières ligues inscrites) — pas d'usage à lui trouver avant d'en
avoir une raison précise.

---

## 2. Identité de marque

### Point de vigilance (à ne pas trancher à la légère)

Le cadrage technique existant (`B4`, `Cadrage/Fonctionnel/nba_pronos_PREP_SPEC_TECHNIQUE_V1.md`)
note déjà que les vrais logos NBA sont des marques déposées, jugé « faible risque pour une
app privée/non commerciale ». Ce calcul change avec une communication publique et une
monétisation prévue :

- **Le nom de marque public ne doit pas contenir « NBA »** — l'usage descriptif
  (« compétition de pronostics sur les playoffs NBA ») reste normal, l'intégrer au nom de
  la marque est le geste le plus exposé.
- **L'usage des vrais logos d'équipes dans les supports marketing publics** mérite d'être
  reconsidéré séparément de leur usage dans l'app elle-même.
- Ni l'un ni l'autre n'est tranché ici — un avis juridique rapide est recommandé avant le
  lancement, pas après.

### Nom retenu : Panier Ballon (PB)

Choisi après une recherche de plusieurs pistes (« Clutch » et « Buzzer » écartés, saturés
par des apps existantes — ClutchPoints, ClutchPredict, BuzzerBeater...). Aucun conflit direct
trouvé sur « Panier Ballon » (domaine, réseaux sociaux, recherche web générale).

**Recherche INPI gratuite faite le 27/08/2026** : aucun résultat sur la base Marques
(FR/EU/WO, marques en vigueur, classes de Nice 9 — logiciels/applications — et 41 —
divertissement/jeux) ni sur la base Entreprises (noms de société). Suffisant pour une
bêta privée entre potes. À garder en tête : cette recherche gratuite ne détecte que les
correspondances exactes, pas les similarités phonétiques/orthographiques proches — une
recherche approfondie payante (INPI, à partir de 50€) resterait recommandée avant un vrai
dépôt de marque ou un lancement grand public.

Le nom est volontairement redondant (un panier contient déjà un ballon) — assumé comme un
private joke plutôt que caché. Découverte utile en cours de recherche : « ballon-panier »
est le terme réel du français québécois pour désigner le basketball, ce qui donne une
légitimité inattendue en plus du clin d'œil. Un compte Instagram existe sous ce nom dans
l'ordre inverse (@ballonpaniercentrenord, association basket au Québec) — pas un conflit,
mais à garder en tête.

**Alternatives explorées et gardées en réserve** si Panier Ballon ne tient pas la distance :
- **L'Arène** — reprend le vocabulaire déjà utilisé par le design system (« énergie arène »).
- **Le Pool** — le mot que le public cible utilise déjà pour désigner l'activité.
- **Dynastie** — s'accorde avec le token « champion » (or) du design system.
- Une veine « sigle officiel en façade, clin d'œil connu derrière » (BDE, BG, TN, PLS) a
  aussi été explorée, à l'origine d'une blague fondatrice (« BBL » pour Brazilian Butt
  Lift) écartée pour incompatibilité avec les règles de contenu App Store/Play — gardée
  comme easter egg interne, pas comme façade publique.

### Logo / wordmark

**Décision actée le 28/08/2026** : le logo illustré (panier + ballon, vectorisé en SVG à
partir de `Cadrage/DA/Logo.jpg`, déjà intégré comme icône d'app/favicon —
`public/brand/logo.svg`, `app/favicon.ico`, `app/apple-icon.png`,
`public/icons/icon-{192,512}.png`) est retenu comme logo actuel de Panier Ballon.
**Provisoire, assumé comme tel** : pas la version définitive, une meilleure itération reste
à concevoir plus tard — la direction wordmark ci-dessous reste une piste possible pour cette
itération, entre autres.

Direction alternative envisagée à l'origine, gardée en réserve : pas de logo illustré
complexe nécessaire — le design system est déjà token-first. Un **wordmark typographique**
en Oswald (police déjà réservée aux scores/moments forts de l'app), sur fond navy
(`#0B0E14`) avec l'accent orange broadcast (`#FF6A2B`), et un mark simple représentant un
ballon déjà posé dans le panier (littéralise le nom). Une déclinaison **monogramme « PB »**
en badge pour l'icône d'app et le favicon.

### Ton de voix

| À faire | À éviter |
|---|---|
| Phrases courtes, verbes d'action (« Rejoins ta ligue ») | Le mot « paris » dans toute communication publique (cf. point ANJ ci-dessous) |
| Parler à la personne qui pourrait animer son groupe, pas au fan NBA en général | Le vocabulaire startup générique (« disruptif », « gamechanger ») |
| Nommer les mécaniques par leur vrai nom (bracket, série, pari perso) | S'adresser à un fan NBA générique plutôt qu'au commissaire de pool |
| Assumer le premier degré du nom (« oui, un panier a déjà un ballon dedans ») | |

### Mascotte

Explicitement en dernier dans l'ordre validé (nom → logo/wordmark → mascotte, retrouvé dans
`Cadrage/DA/AJUSTEMENTS_VISUELS_20_08_2026.md` §13, hors dépôt). Rien à trancher avant le
lancement.

---

## 3. Plan de communication

> **Recentrage acté le 27/08/2026** : pour rester tenable à moins de 5h/semaine après le
> lancement, le plan actif se limite pour le moment à deux canaux — **Instagram** et le
> **réseau perso**. Discord, X, TikTok, TrashTalk/forums, groupes Facebook et
> micro-créateurs restent entièrement documentés en fin de section 3 (« En réserve »),
> prêts à être réactivés plus tard si le besoin s'en fait sentir. Rien n'est perdu, juste
> mis de côté.

**Complément acté le 15/09/2026** : le recentrage Instagram + réseau perso tient
tel quel jusqu'à fin septembre (alpha fermée). À partir d'octobre, trois canaux
déjà documentés en réserve passent en actif : Discord, référencement (SEO), et
contact direct des créateurs/médias basket FR.

Discord n'a besoin d'aucune conception supplémentaire — structure, rôles et
messages sont déjà rédigés plus bas (§ "Discord — structure") ; la catégorie
BÊTA (#liste-attente, #bugs-et-retours, #idées) colle même déjà à la fenêtre
oct.-nov. Il n'y a qu'à créer le serveur et l'ouvrir.

SEO et créateurs, eux, restent à construire de zéro : guide pas-à-pas dédié
plutôt qu'un ajout de ligne ici, ce terrain étant nouveau. Voir
`Cadrage/Business/panier_ballon_elargissement_octobre.md`.

### Positionnement

Le produit ne se positionne pas comme la réparation d'un problème que tout le monde vivrait
déjà (peu de groupes ont aujourd'hui un vrai pool NBA organisé) mais comme **une activité
communautaire nouvelle à proposer à son groupe**, dans l'esprit d'une soirée jeux ou d'un
fantasy league. *Hypothèse à confronter au terrain pendant l'alpha et la bêta, pas une
certitude.*

**Taglines** :
1. Vivez les playoffs en mode ligue entre potes.
2. Une compét rien que pour votre groupe.
3. Les playoffs sont meilleurs quand tout le monde a un pronostic à défendre.

**Messages à tenir partout** : groupe fermé de 10 à 30 personnes (pas une compétition
ouverte anonyme) ; classement et scores calculés automatiquement ; paris perso en langage
libre (« Jokic fait un triple-double ») validés automatiquement à partir des vraies stats
du match.

**Concurrents/adjacents identifiés** (vérifiés par l'utilisateur — pas de recouvrement
réel) : Scorecast, Pronos entre amis, Matchguess.

> **Point de vigilance ANJ** — en France, la communication autour des paris sportifs réels
> est strictement encadrée. Panier Ballon ne fait circuler aucun argent réel, uniquement
> des points, mais le mot « paris » (utilisé dans le cadrage technique) peut prêter à
> confusion en communication publique. Préférer « pronostics », « pool entre amis » ou
> « jeu de prédiction », et indiquer clairement « aucun argent réel, uniquement des
> points » dès que le contexte peut créer une ambiguïté.

### Le profil visé — le·la commissaire de pool

| | |
|---|---|
| **Comportement** | Aime organiser des trucs pour son groupe de potes. Pas forcément déjà un pool NBA formalisé — le réflexe d'animer le groupe est déjà là. |
| **Motivation** | Envie de proposer quelque chose de fédérateur et nouveau pour les playoffs, pas de réparer un système existant. |
| **Où le·la trouver** | Son propre groupe de discussion (le canal le plus direct) et Instagram, où le contenu produit circule facilement même sans audience de départ. D'autres communautés NBA francophones existent (X, TrashTalk, groupes Facebook, forums fantasy/pronos, Discord basket) — gardées en réserve, pas actives pour le moment. |
| **Déclencheur** | Le début des playoffs — l'envie naturelle de vivre ça ensemble. Fenêtre d'attention de 2-3 semaines en mars-avril. |

### Canaux actifs — Instagram + réseau perso

- **Ton réseau perso** *(actif)* — le plus fort taux de conversion, souvent sous-estimé.
  Ce sont tes testeurs alpha et tes premières ligues actives : pas besoin d'audience pour
  les recruter, juste d'un message direct.
- **Instagram** *(actif)* — captures et vidéos de l'interface (pas besoin d'apparaître) ;
  c'est le canal qui porte la démo visuelle et la crédibilité publique du projet.

Les autres canaux explorés (Discord dédié, X, TikTok, TrashTalk & forums fantasy, groupes
Facebook NBA, micro-créateurs basket) restent entièrement documentés en fin de section
(« En réserve ») — rien n'est perdu, juste mis de côté pour rester tenable en solo.

### Réseau perso — séquence de messages

L'app (V1) est finie — ces messages s'adressent à deux publics à deux moments différents :
le premier cercle (3-5 groupes de potes proches) pour l'**alpha de septembre**, puis un
cercle plus large (contacts de contacts, abonnés Instagram intéressés) pour
l'**élargissement d'octobre**.

```
[Message 1 — invitation à l'alpha, S2 sept., pour le premier cercle]
L'app est prête : une ligue de pronos NBA à faire tourner entre nous
pendant les playoffs. Ça vous dit qu'on lance ça cette semaine, en tout
petit comité pour commencer ?

[Relance, si pas de réponse ~1 semaine après]
Toujours chaud pour tester la ligue de pronos dont je te parlais ? On
est déjà quelques-uns dessus, ce serait cool de t'avoir aussi.

[Élargissement, oct. — pour les contacts hors du premier cercle]
On teste depuis quelques semaines un truc entre potes : une ligue de
pronos NBA pour les playoffs, gratuite, aucun argent réel — que des
points. Ça te dit d'essayer avec ta bande ? [lien]
```

### Instagram — contenu

Démo léchée : Reels de capture d'écran (bracket, flash live, classement), carrousels
explicatifs en feed, Stories pour le compte à rebours. Cadence : 1-2 Reels/semaine en
bêta, 3+/semaine en mars-avril. Aucun besoin d'apparaître à l'écran — l'interface
elle-même (fond sombre, flash orange en direct) est un sujet visuel suffisant.

**Hashtags** : stratégie complète dans `Cadrage/DA/instagram/
strategie-hashtags-instagram-panier-ballon.md` (28/08/2026) — 3 à 5 par post,
mix propriétaire/niche/moyen/large (`#PanierBallon` systématique, 1 seul
hashtag large max). `#NBAPlayoffs` volontairement écarté des posts liés à
l'alpha de septembre (format NBA Cup fictif, pas les vrais playoffs — voir
Post 3 ci-dessous) ; `#NBACup` utilisé à la place pour ces posts-là.
Combos déjà intégrés aux légendes des Posts 1/2/3.

**Posts — phase Fondations, avant l'ouverture de la bêta (contenu à ajuster au fil de l'eau) :**

```
[Post 1 · S2, semaine du 1-7 sept. — pourquoi tu construis ça]
Je construis une appli pour vivre les playoffs autrement : une ligue de
pronostics NBA à faire tourner avec sa bande de potes, plutôt que chacun
dans son coin.

Bracket, pronostics match par match, et des paris perso ("Jokic fait un
triple-double") validés automatiquement à partir des vraies stats du
match.

L'alpha tourne dès cette semaine avec un premier petit groupe — je
documente la suite ici jusqu'à l'ouverture plus large en octobre. 🏀

NB : l'alpha sera une compétition fictive pour tester les fonctionnalités
de l'application.

On vous en dit plus très bientôt 🏀

#PanierBallon #NBAFrance #BasketFrancais #NBAPronos #NBA
```

```
[Post 2 · S3, semaine du 8-14 sept. — avancement, carrousel de captures]
Ça avance 👀
L'alpha tourne déjà avec un premier groupe de potes — bracket, pronos
match par match, classement en direct.

La suite s'ouvre un peu plus large en octobre. Si ta bande n'a pas
encore de ligue de pronos pour les playoffs cette année, DM-moi.

#PanierBallon #NBAFrance #BasketFrance #BasketballCommunity #Basketball
```

```
[Post 3 · S4, semaine du 15-21 sept., juste avant le coup d'envoi du
20/09 — pourquoi le format NBA Cup, tient la promesse du NB du Post 1]
Petite explication avant le coup d'envoi 👇

Les vrais playoffs NBA, c'est en avril — trop loin pour tester l'appli
maintenant. On lance donc l'alpha sur un format NBA Cup : même
mécanique de bracket/pronos/paris qu'en playoffs, mais jouable dès
maintenant, en empruntant le score et les vraies stats de matchs déjà
joués la saison dernière.

La bêta d'octobre/novembre prendra le relais sur la vraie NBA Cup — le
tournoi officiel de la ligue, qui se joue chaque année en novembre —
cette fois avec de vrais matchs en direct, pas d'emprunt.

Coup d'envoi du 1er quart de finale de l'alpha : 20 septembre 🏀

#PanierBallon #NBACup #NBAFrance #FantasyBasketball #NBA
```

**Structure visuelle du Post 3 (carrousel, plan validé le 31/08/2026, visuel pas encore construit)** —
même gabarit que Posts 1/2 (`Cadrage/DA/instagram/SPEC_VISUELS_INSTAGRAM.md`) : cover photo +
slides navy, bandeau orange en majuscules, titre court en gras, trait orange en bas. Cover sur
`hero-hk.jpg` ou `hero-hoop.jpg` plutôt que `hero-mural.jpg` (déjà utilisé en cover sur les Posts 1
et 2 — éviter 3 covers identiques d'affilée sur la grille du profil) :

1. **Cover** (fond photo) — bandeau `OÙ ON EN EST`, titre *« L'Alpha, c'est pour très bientôt. »*,
   sous-texte `Compétition ALPHA · dès le 20 septembre`.
2. **navy, bandeau `L'ALPHA`** — titre *« Une compétition 100% entre potes, en conditions réelles. »*,
   corps : format NBA Cup à 8 équipes, élimination directe (4 quarts → 2 demies → 1 finale),
   démarrage le 20/09.
3. **navy, bandeau `LES COULISSES`** (même registre que le slide « LES DONNÉES » du Post 1) —
   titre *« Fictive, mais pas inventée. »*, corps : chaque match emprunte le vrai score et les
   vraies stats d'un match NBA déjà joué — pronostics et paris perso se résolvent sur de la vraie
   donnée, pas du hasard.
4. **navy, bandeau `LA SUITE`** — titre *« Direction la bêta, en octobre-novembre. »*, corps
   volontairement court : bascule sur la vraie NBA Cup, le tournoi officiel de la ligue, en vrais
   matchs, en direct.
5. **closing/CTA** (retour au fond photo, effet bookend avec la cover) — bandeau `REJOINS L'ALPHA`,
   titre *« Installe l'appli avant le 20 septembre. »*, CTA `Lien dans la bio 🔗` (ou renvoi vers le
   tuto d'installation du Post 2).

**Gabarits closing/CTA créés le 02/09/2026** : `Cadrage/DA/instagram/Posts/post-conclusion-gabarit.svg`
(dark) et `-clair.svg` — contenu centré horizontalement et verticalement (pas ancré en bas comme les
autres slides), classe `.cta` dédiée en orange à la place du sous-titre. Détail dans
`Cadrage/DA/instagram/SPEC_VISUELS_INSTAGRAM.md`, section « Format 2bis ». Reste à dupliquer en
Illustrator avec la photo hero du Post 3 pour obtenir l'effet bookend, et à caler le texte ci-dessus.

**Point encore ouvert** : la cover du Post 3 (`post-3.png`) réutilise `hero-mural.jpg`, déjà utilisé
sur les covers des Posts 1 et 2 — alors que ce plan prévoyait `hero-hk.jpg` ou `hero-hoop.jpg` pour
éviter 3 covers identiques d'affilée sur la grille du profil (cf. note ci-dessous, non appliquée).
À trancher avant publication : garder le mural (et donc bookender le slide 5 dessus) ou changer la
photo de cover + conclusion.

**S4 · semaine du 15-21 sept. — rythme de croisière (1-2 posts, contenu libre selon l'avancement réel) :**
- Post "update" : une capture d'une fonctionnalité corrigée ou améliorée grâce aux retours de l'alpha + une phrase courte.
- Story avec sticker sondage ("Vous êtes plutôt bracket ou paris perso ?") pour faire réagir les premiers abonnés.

```
[Story · S5, semaine du 22-30 sept. — compte à rebours vers l'élargissement
d'octobre, pour les abonnés qui ne sont pas encore dans l'alpha]
L'alpha tourne bien depuis quelques semaines — le cercle s'élargit
bientôt 👀
Si tu veux être parmi les prochains, dis-le-moi vite.
```

**Vidéo 1 · S3-4 oct. — démo bracket (Reels, ~12s)**
- 0-2s : écran d'accueil, fond sombre, logo Panier Ballon.
- 2-6s : remplissage du bracket en accéléré.
- 6-9s : zoom sur le flash orange qui s'anime en direct.
- 9-12s : classement avec les noms du groupe de test.
- Texte à l'écran : *"Le pool de vos potes, mais avec un vrai bracket"* — CTA : *"Lien en bio pour la bêta"*.

**Vidéo 2 · S1 mars — compte à rebours (Reels + Stories)**
- 0-3s : *"Playoffs dans 5 semaines"* en gros texte sur fond navy/orange.
- 3-8s : montage rapide des fonctionnalités déjà vues.
- 8-10s : *"Rejoins la liste d'attente"* + lien.

**Vidéo 3 · Jour J avril — annonce de lancement**
- 0-6s : montage rythmé de toutes les fonctionnalités.
- 6-9s : icônes App Store / Google Play.
- 9-12s : *"C'est disponible"* — lien en bio.

### Calendrier — semaine par semaine

**Phase 0 · Fondations & alpha (26 août – 30 sept. 2026)**
- S1 (26-31 août) : Compte Instagram créé (pseudo réservé), logo provisoire fait.
  Recherche INPI faite — RAS (marques + sociétés).
- S2 (1-7 sept.) : Message direct à 3-5 groupes de potes — invitation à rejoindre
  l'**alpha dès maintenant** (l'app V1 est prête). Premier post Instagram (pourquoi tu
  construis ça).
- S3 (8-14 sept.) : Alpha lancée avec les groupes qui répondent présent — onboarding
  individuel de chacun. Landing page avec capture d'email en ligne (utile pour
  l'élargissement d'octobre). Deuxième post Instagram (avancement).
- S4 (15-21 sept.) : Alpha active — retours et corrections en continu. Rythme de
  croisière sur Instagram (1-2 posts/sem.).
- S5 (22-30 sept.) : Corrections finales à partir des retours de l'alpha. Story de
  compte à rebours vers l'élargissement d'octobre.

**Phase 1 · Élargissement bêta (oct. – nov. 2026)**
- S1-2 (1-14 oct.) : Ouverture élargie au-delà du premier cercle — contacts de contacts,
  premiers abonnés Instagram intéressés. Onboarding individuel de chaque nouveau testeur.
- S3-4 (15-31 oct.) : Boucle de retours documentée en Story Instagram (bugs trouvés,
  corrigés). Première vidéo démo (bracket) en Reel, appuyée sur l'usage réel de l'alpha.
- S5-6 (1-14 nov.) : Poursuite de l'élargissement léger.
- S7-9 (15-30 nov.) : Stabilisation. Bilan partagé en Story/carrousel Instagram et au
  réseau perso — alpha de septembre et bêta élargie d'octobre confondues.

**Phase 2 · Creux volontaire (déc. 2026 – fév. 2027)**
- Décembre : bilan et pause méritée. Janvier : préparation des supports de lancement
  (vidéo de présentation, textes App Store/Play, visuels Instagram).

**Phase 3a · Montée en pression (mars 2027)**
- S1 : compte à rebours sur Instagram (« playoffs dans 5 semaines »). Relance
  individuelle des contacts du réseau perso pas encore inscrits.
- S2 : vidéo récap « la saison de construction » en Reel. Fiche App Store/Play publiée.
- S3 : dernier appel au réseau perso (« réserve ta place avant le coup d'envoi »).
- S4 : jour J préparé dans le détail (textes, visuels, planning minute par minute).

**Phase 3b · Lancement (avril 2027 →)**
- Jour J : annonce coordonnée sur Instagram et auprès du réseau perso.
- J+1 à J+3 : relance des retardataires du réseau perso ; brackets partagés par les
  joueurs repostés en Story.
- Semaine 2 : premiers résultats de playoffs réels, premier post « temps fort du
  classement ».
- Avril–juin : rythme de croisière hebdomadaire sur Instagram, décroissance progressive
  vers le mode entretien.

### Checklist — jour du lancement

- [ ] Annonce publiée sur Instagram et envoyée au réseau perso au même moment
- [ ] Message direct envoyé à chaque groupe/contact du réseau perso
- [ ] Demande explicite aux premières ligues de partager leur bracket (repost en Story)
- [ ] Rappel « aucun argent réel, uniquement des points » visible en bio Instagram et sur
      les pages publiques

### Objectifs indicatifs par phase

| Phase | Indicateur | Cible indicative |
|---|---|---|
| Alpha (sept.) | Testeurs actifs (3-5 groupes proches) | 10–20 |
| Fondations & alpha (sept.) | Abonnés Instagram | 20–40 |
| Bêta élargie (oct.–nov.) | Testeurs actifs cumulés | 15–30 |
| Montée (mars) | Abonnés Instagram | 150–300 |
| Lancement (avril) | Ligues actives créées | 10–20 |

Repères de départ, pas des promesses — l'alpha de septembre et la bêta élargie
d'octobre/novembre donneront de vraies données pour les recalibrer.

### En réserve — canaux mis de côté pour le moment

Ces canaux ont été travaillés en détail avant le recentrage sur Instagram + réseau perso.
Rien n'est perdu : ils restent prêts à être activés si ces deux canaux ne suffisent pas,
ou une fois que le rythme de croisière (< 5h/semaine) laisse de la marge.

> **Mise à jour du 15/09/2026** : Discord est désormais activé à partir d'octobre (voir
> l'addendum en tête de section 3) — la structure ci-dessous n'est plus « en réserve »,
> elle est prête à être exécutée telle quelle. X, TikTok, TrashTalk/forums, groupes
> Facebook et micro-créateurs restent en réserve pour Instagram et le réseau perso, mais
> une partie (créateurs, forums, groupes Facebook) est elle aussi activée à partir
> d'octobre — voir `Cadrage/Business/panier_ballon_elargissement_octobre.md`, qui reprend
> et adapte les messages-types ci-dessous au contexte bêta plutôt qu'au contexte
> pré-lancement pour lequel ils avaient été écrits.

#### Discord — structure

```
📋 INFOS
  #annonces        (lecture seule)
  #règles
  #présentation

💬 COMMUNAUTÉ
  #discussion-générale
  #débats-nba
  #easter-eggs     (private jokes)

🧪 BÊTA            (oct.–nov., puis archivée)
  #liste-attente
  #bugs-et-retours
  #idées

🏆 LIGUES          (à partir d'avril)
  #trouve-ta-ligue
  #résultats-et-classements
```

Rôles : **Membre** (défaut), **Testeur bêta**, **Fondateur** (premiers arrivés).

**Description du serveur :**
```
Panier Ballon 🏀
Une ligue de pronostics NBA à vivre entre potes pendant les playoffs.
Bracket, pronostics match par match, paris perso résolus automatiquement.
Aucun argent réel — que des points.
```

**Message d'accueil (épinglé dans #annonces) :**
```
Bienvenue sur Panier Ballon 👋

Ici, c'est le QG pour vivre les playoffs autrement : une ligue de pronostics
à faire tourner avec ton groupe de potes.

Pas d'argent réel ici, ni dans l'app — seulement des points et un ego à
défendre au classement.

→ Dis bonjour dans #présentation
→ Les règles sont dans #règles
→ La bêta ouvre en octobre, inscris-toi dans #liste-attente
```

**Règles (#règles) :**
```
1. Respect entre membres, comme dans n'importe quel groupe de potes élargi.
2. Aucun argent réel ne circule ici ni dans l'app — uniquement des points.
   On ne parle pas de "paris" au sens réel du terme.
3. Pas de promo hors-sujet ni de spam.
4. Les retours bêta vont dans #bugs-et-retours, pas en message privé.
```

#### X — piliers de contenu

Deux piliers sur un seul fil : **le chantier** (récit de construction, builders) et **la
ligue** (démos, invitations, moments forts). Dosage ~60% chantier / 40% joueurs en phase
0-1, inversion à partir de mars. Cadence 2-3 posts/semaine, un fil plus long tous les 15
jours, rythme hebdomadaire après le lancement.

**Posts prêts à publier :**

```
[S2 sept. — pilier chantier]
Je construis une appli depuis 5 semaines, en solo, avec l'IA en copilote.
317 commits. Le cœur du truc : un moteur qui comprend "Jokic fait un
triple-double" et va vérifier tout seul dans les vraies stats du match si
c'est vrai.
Je vais documenter tout le parcours ici. 🧵
```

```
[S4 sept. — pilier chantier]
Bug du jour : une faute technique d'entraîneur était comptée comme celle
d'un joueur. Corrigé en vérifiant le vrai roster à chaque pari perso.
Ce genre de détail, c'est 80% du travail sur un moteur qui doit comprendre
du langage libre plutôt que des cases à cocher.
```

```
[S3-4 oct. — pilier joueurs, avec vidéo]
Voilà à quoi ressemble une ligue sur Panier Ballon 🏀
Bracket, pronostics match par match, et des paris entre potes que l'appli
valide toute seule à partir des vraies stats.
La bêta tourne avec un petit groupe pour l'instant — DM si ça te tente
pour la suite.
```

```
[S1 mars — pilier joueurs, countdown]
Playoffs dans 5 semaines.
Si ton groupe n'a pas encore de ligue de pronos, c'est le moment d'en
lancer une. Panier Ballon ouvre en grand en avril 🏀
```

```
[Jour J avril — lancement]
C'est lancé.
Panier Ballon est dispo sur iOS et Android : une ligue de pronos entre
potes pour les playoffs. Gratuit pour commencer. Aucun argent réel — que
des points et un ego à défendre au classement.
[lien]
```

#### TikTok — contenu relatable

Registre différent d'Instagram : relatable d'abord, produit ensuite, rendu plus brut
assumé plutôt que léché. Aucun besoin d'apparaître à l'écran.

**Vidéo · contenu relatable (dès la bêta, pas besoin de l'app)**
- Concept : *"Les 4 potes dans un pool de pronos"* — texte animé, aucun visage requis.
- Archétypes : celui qui prend ça trop au sérieux · celui qui oublie toujours de rendre ses pronos · celui qui conteste l'écart de points · celui qui gagne sans rien connaître au basket.
- Chute : *"Il vous manque plus que l'appli"* — lien en bio.

#### TrashTalk, forums et réseau externe

Trois canaux, un principe commun : jamais de pitch en premier message. Participation
authentique d'abord (commentaires, valeur ajoutée réelle), présentation ensuite,
seulement une fois identifié comme membre légitime.

- **TrashTalk & forums fantasy** — plus grosse communauté NBA francophone ; viser une
  mention éditoriale plutôt qu'un partenariat de croissance direct.
- **Groupes Facebook NBA** — groupes actifs confirmés : « PRONOSTICS NBA 🏀 Pro du
  basket », « Débats et Pronostics NBA (D&PNBA) ».
- **Micro-créateurs basket** — scène streetball/freestyle française (Quai 54, Brisco
  Basket Freestyle) plutôt que les gros comptes généralistes ; approche par échange
  (accès anticipé, statut « partenaire fondateur ») plutôt que payante.

**Forums / groupes Facebook — post de présentation (à partir de février) :**
```
Salut à tous, je voulais partager un projet perso : je développe une
appli pour organiser une ligue de pronostics NBA entre potes pendant les
playoffs (bracket, pronostics match par match, paris perso validés
automatiquement par IA). Aucun argent réel, juste des points et de la
fierté à défendre au classement.

La bêta ouvre en octobre si ça intéresse quelqu'un ici — je suis preneur
de retours, bons ou mauvais.
```

**TrashTalk / créateur NBA francophone — premier contact (février) :**
```
Objet : Une appli pour organiser son pool de pronostics NBA entre potes

Bonjour [prénom],

[Une phrase liée à un contenu précis d'eux — jamais un mail générique.]

Je lance en avril Panier Ballon, une appli pour organiser une ligue de
pronostics NBA entre amis pendant les playoffs : bracket, pronostics
match par match, et des paris perso en langage libre validés
automatiquement par un moteur qui vérifie les vraies stats du match.

Ce serait avec plaisir de vous faire tester en avant-première si ça peut
intéresser votre communauté — sans obligation, juste pour avoir votre avis.

[Lien bêta / Discord]
```

Relancé en semaine 3 de mars pour confirmer une mention au lancement.

> **Note du 15/09/2026** : ce message TrashTalk/forums de février reste valable tel
> quel pour une relance de confirmation en mars, proche du vrai lancement. Pour un
> premier contact dès octobre (bêta, pas lancement), utiliser la version adaptée dans
> `Cadrage/Business/panier_ballon_elargissement_octobre.md` (§2.3) — même structure,
> langage « bêta ouverte sur la vraie NBA Cup » plutôt que « je lance en avril ». Le
> post forums/Facebook ci-dessus, lui, est déjà écrit pour octobre et n'a pas besoin
> d'adaptation.

---

## Prochaines actions

- [x] Compte Instagram créé — fait le 28/08/2026, `@panierballon.app`
- [x] Réserver panierballon.fr / .com — achetés le 28/08/2026 (les deux). `.fr` retenu
      comme domaine principal (public francophone), `.com` en redirection dessus une fois
      les deux pointés vers Vercel
- [x] Pointer panierballon.fr / .com vers Vercel (projet `nba-pronos`) + redirection
      307→`.fr` — fait et vérifié en ligne le 28/08/2026
- [ ] Référencement (SEO) — constaté le 28/08/2026 : le site ne remonte pas sur Google.
      Normal à ce stade (domaine tout juste pointé, app derrière connexion donc rien
      d'indexable, aucun lien externe pointant dessus) — pas urgent pendant l'alpha
      fermée, à reprendre avant l'élargissement d'octobre ou le lancement public
      (mots-clés, page d'accueil publique indexable, backlinks Instagram/réseau perso).
      **Repris à partir d'octobre** — voir `Cadrage/Business/panier_ballon_elargissement_octobre.md`
- [x] Recherche INPI formelle sur « Panier Ballon » — faite le 27/08/2026, RAS (marques + sociétés)
- [x] Logo provisoire généré (IA)
- [ ] Envoyer le message d'invitation à l'alpha aux 3-5 groupes de potes (l'app V1 est prête)
- [ ] Concevoir une itération non-provisoire du logo, une fois le rythme le permet (le
      logo illustré actuel reste temporaire, cf. « Logo / wordmark » — la piste wordmark
      y est gardée en réserve, pas actée comme la suite)
- [ ] Lancer les visuels de marque pour Instagram (photo de profil, gabarits de
      post/Reel) — piste : skill « design » pour produire des mockups dans l'identité
      définie ici
- [ ] Créer le serveur Discord à partir de la structure ci-dessus (à partir d'octobre —
      voir `Cadrage/Business/panier_ballon_elargissement_octobre.md`)
- [ ] Corriger le mot « paris » dans `app/layout.tsx` et `app/manifest.ts` (repéré le
      15/09/2026, détail dans `panier_ballon_elargissement_octobre.md` §1.2)

---

*Document produit en session Cowork, mis à jour au fil de l'eau — à réviser après les
retours de l'alpha de septembre et de la bêta élargie d'octobre/novembre 2026,
notamment le positionnement (hypothèse « activité communautaire » à confronter au
terrain) et le modèle de monétisation de l'app.*
