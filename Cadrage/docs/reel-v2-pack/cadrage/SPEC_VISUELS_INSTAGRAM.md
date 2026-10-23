# Visuels Instagram — Panier Ballon — spec de recréation

> Feuille de route pour recréer (ou faire évoluer) ces visuels dans
> Illustrator/Figma/Canva, indépendamment des fichiers `.svg` fournis dans ce
> dossier. Identité reprise telle quelle du design system de l'app
> (`app/tokens.css`) — rien inventé ici, tout est sourcé.

> **Mise à jour du 06/10/2026** : le logo à utiliser est le nouveau wordmark « Panier Ballon » (`public/brand/logo-{horizontal,carre}.svg`, intégré le 05/10), y compris pour la photo de profil ; les mentions de « logo » ci-dessous décrivent l'ancien badge. Le gabarit Story est dans `Storys/story-gabarit.svg` (et `-clair`), pas à la racine. Cadrage des visuels oct.-nov. : `Cadrage/Business/panier_ballon_instagram_octobre_novembre.md` §5.

## Palette

| Rôle | Hex | Usage |
|---|---|---|
| Fond profil (bg du logo) | `#1b2036` | Photo de profil uniquement (couleur propre au fichier logo) |
| Fond posts/Story — haut | `#1C2432` | Dégradé vertical (180°), haut |
| Fond posts/Story — bas | `#171D28` | Dégradé vertical (180°), bas |
| Accent orange | `#FF6A2B` | Kicker, trait de soulignement, anneau décoratif |
| Texte principal | `#F5F7FA` | Titres, sous-titres (opacité réduite pour le sous-titre, voir plus bas) |

Pas d'autre couleur. Pas de dégradé sur le texte ni sur l'accent — l'orange
reste plat partout où il sert de couleur de contenu (seul le fond utilise un
dégradé, et seulement du haut vers le bas).

## Typographie

- **Oswald** (600/700) — logo/wordmark, kicker, titres. Condensée,
  volontairement — c'est la police déjà réservée aux scores/moments forts
  dans l'app.
- **Sora** (400/500/600) — sous-titres, texte de lecture. Police de corps
  de l'app.
- Google Fonts : `https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Sora:wght@400;500;600&display=swap`
- Fallback si les polices ne chargent pas : `'Arial Narrow', Arial,
  sans-serif` pour Oswald, `system-ui, sans-serif` pour Sora.

## Règle de forme

Coins **nets, jamais arrondis** — l'app entière utilise un rayon de 2 à 4px
maximum (`--radius-sm/md/lg` dans `tokens.css`), jamais de grand rayon ni de
pilule sur un bloc de contenu. Le seul cercle légitime est décoratif (anneau
d'ambiance) ou le logo lui-même.

## Format 1 — Photo de profil (1080×1080)

- Fond plein `#1b2036` (couleur propre du logo, pas les tokens app — évite
  toute couture visible autour du logo).
- Logo centré, largeur ≈ 750px (≈ 70% du cadre) — laisse une marge d'environ
  15% de chaque côté, nécessaire pour que le crop circulaire d'Instagram ne
  mange pas les bords du dessin.
- Optionnel : lueur radiale orange très douce derrière le logo (`#FF6A2B` à
  20% d'opacité au centre, vers transparent), purement décorative.

## Format 2 — Post 4:5 (1080×1350)

**Changé le 28/08/2026** (demandé par l'utilisateur, après un aller-retour
Illustrator sur `post-1.svg`) — était en 1080×1080 (carré) à l'origine ;
passé en 1080×1350 (portrait 4:5, le format feed Instagram qui s'affiche en
entier une fois cliqué) pour donner plus de respiration verticale au bloc de
contenu. Structure en 2 blocs : un bandeau haut (identité) et un bloc bas
ancré au bas du cadre (contenu) — **inchangée dans le principe**, seule la
hauteur du cadre a grandi.

- **Padding horizontal** : 96px gauche/droite (marge de sécurité réelle
  mesurée ≥ 85px sur tous les éléments actuels, largement au-dessus des
  35px minimum demandés pour anticiper un recadrage d'aperçu — vérifié au
  pixel près avec Chromium headless, jamais estimé à l'œil : les polices
  condensées rendent plus larges qu'un calcul rapide ne le laisse penser,
  voir plus bas).
- **Bandeau haut** (y = 88, inchangé) : logo (56px de large) + `PANIER
  BALLON` en Oswald 600, 26px, majuscules, letter-spacing large (~0.14em),
  couleur blanche à 72% d'opacité. Ancré en HAUT du cadre — ne bouge jamais
  quand la hauteur du cadre change.
- **Bloc bas**, ancré au bas du cadre à 88px du bord inférieur (donc à
  `1262` sur un cadre de 1350, contre `992` sur l'ancien cadre carré de
  1080 — même règle des 88px, juste recalculée sur la nouvelle hauteur),
  empilé du bas vers le haut :
  1. Trait orange plein, 96×6px, à 88px du bas.
  2. Sous-titre — Sora 400, 32px, blanc à 68%, interligne 1.4, largeur max
     ~760px (se casse sur plusieurs lignes).
  3. Titre — Oswald 700, **84px par défaut** (voir note plus bas), blanc
     plein, interligne serré (~1.04), largeur max ~840px.
  4. Kicker (accroche courte) — Sora 600, 28px, majuscules, orange plein,
     letter-spacing ~0.10em.
  Espacement vertical entre chaque élément : ~28px.
- **Décor** : anneau fin (2px, orange à 14% d'opacité) débordant du coin
  haut-droit, ~760px de diamètre, avec une lueur radiale douce au centre —
  ancré au coin, ne bouge jamais quand la hauteur du cadre change.
- **Espace vide entre le bandeau haut et le bloc bas** : volontairement
  généreux (~700px sur ce format, plus de la moitié du cadre) — choix de
  composition assumé (fidèle au fond sombre/moody de la marque), pas un
  oubli. Confirmé avec l'utilisateur le 28/08/2026 plutôt que de centrer le
  bloc verticalement (qui aurait été la convention du format Story,
  ci-dessous — les deux formats gardent des logiques différentes).

**Titre à 84px : PAS une garantie universelle, à vérifier au cas par cas.**
Le premier post réel (`post-1.svg`, titre sur 2 lignes "La nouvelle ligue de
pronos" / "sur la NBA.") débordait à 84px — 51,9px de marge droite mesurée
au lieu des 70-85px visés, l'estimation initiale de largeur (~840px) était
trop optimiste une fois rendu avec la vraie police Oswald Bold condensée.
Corrigé à 81px pour ce post précis (932px → 899px de large, marge droite
remontée à 85,2px) — **ne pas généraliser 81px comme nouvelle valeur par
défaut** : un titre plus court peut très bien tenir à 84px. Toujours
vérifier avec un rendu réel (Chromium headless + polices installées, comme
fait ici), jamais par calcul de largeur moyenne de caractère.

Gabarit réutilisable : seuls kicker/titre/sous-titre changent d'un post à
l'autre — tout le reste (structure, tailles, couleurs) reste fixe. Un post
au titre particulièrement long peut nécessiter de réduire le titre de
quelques px (comme `post-1.svg`) — vérifier la marge droite réelle avant
publication, pas seulement visuellement.

## Format 2bis — Closing/CTA (même 1080×1350)

**Ajouté le 02/09/2026**, pour combler un trou constaté sur les 3 premiers
posts : seul `post-1.svg` avait un slide de conclusion, fait à la main
directement dans Illustrator (pas de classes CSS communes, rien à
dupliquer proprement) — les Posts 2 et 3 n'en ont pas, alors que le plan du
Post 3 (`Cadrage/Business/panier_ballon_cadrage_business_communication.md`)
en prévoit un explicitement (slide 5, effet bookend avec la cover).

Gabarits dédiés : `post-conclusion-gabarit.svg` (dark) et
`post-conclusion-gabarit-clair.svg` (clair) — dérivés du gabarit Format 2,
même palette/typo/structure de fond, mais avec deux différences
volontaires :

- **Contenu centré**, horizontalement (`text-anchor: middle`, x=540 = milieu
  des 1080px) et verticalement (bloc kicker → titre → CTA → trait orange
  centré autour de y≈675, milieu des 1350px) — contrairement au Format 2
  ci-dessus qui reste ancré en bas à gauche. Demandé explicitement pour les
  slides de conclusion, qui doivent se lire comme une carte de clôture
  plutôt que continuer la logique de lecture des slides de contenu.
- **Sous-titre remplacé par une classe `.cta`** (Sora 600, orange plein,
  34px) à la place du sous-titre gris clair habituel — ex. `Lien dans la
  bio 🔗`. Le wordmark reste ancré en haut à gauche, inchangé (signature de
  marque commune à tous les types de slide).
- Fond navy/gris clair par défaut comme le gabarit générique — à remplacer
  par la photo hero de la cover du post en Illustrator pour obtenir l'effet
  bookend (même logique que `post-1.svg` vs `post-gabarit.svg` : le
  gabarit reste sans photo, la vraie photo s'ajoute à l'export final).

Comme pour le Format 2, positions à vérifier avec un rendu réel avant
publication (texte centré = marges gauche/droite à recontrôler, pas
seulement le titre le plus long testé jusqu'ici).

## Format 3 — Story (1080×1920)

Même palette/typo que le format post, orientation verticale.

- **Zone de sécurité HAUTE** : 250px — rien d'important ici (Instagram y
  pose le pseudo/profil au-dessus de la Story).
- **Zone de sécurité BASSE** : ~540px en bas (320px de marge + 220px de
  zone libre) — réservée à la barre de réponse native + un sticker
  Instagram (sondage, compte à rebours...) à poser après export.
- Entre les deux : logo/wordmark en haut du contenu (même traitement que le
  post, à échelle réduite), puis kicker/titre/sous-titre **centrés
  verticalement** dans l'espace utile (contrairement au post 4:5 ci-dessus,
  qui reste ancré en BAS — les 2 formats suivent des logiques de
  composition différentes, ne pas les confondre), même hiérarchie
  typographique que le post (titre en Oswald 700 ~92px, sous-titre Sora
  400 ~34px).
- Anneau décoratif : même principe que le post, positionné en haut-gauche
  cette fois.

## Format 4 — Logigramme / infographie (même 1080×1350)

**Ajouté le 11/09/2026**, pour le slide 2 du Post 4 (carrousel à 3 slides :
cover Format 2 + logigramme Format 4 + closing/CTA Format 2bis) : explique
une fonctionnalité en schéma plutôt qu'en kicker/titre/photo. Dérivé du
Format 2 « slide de contenu » (même bandeau haut, même zone de contenu
96–984 × 426–1256), mais la zone de contenu est occupée par un
enchaînement d'étapes plutôt qu'une photo/capture :

- **Étapes séquentielles** : bloc rectangulaire pleine largeur (bord
  `#F5F7FA` à 20% d'opacité), pastille orange pleine numérotée (Oswald 700,
  chiffre foncé `#171D28` sur fond `#FF6A2B`) + titre d'étape (Sora 600,
  majuscules) + corps (Sora 400, blanc à 72%, 2-3 lignes courtes).
- **Étapes ramifiées** (ex. calculable / non calculable) : deux blocs
  côte à côte, bord orange à 45% d'opacité (au lieu du bord blanc des étapes
  simples) pour signaler visuellement une bifurcation, puis les flèches se
  rejoignent en un seul connecteur avant l'étape suivante.
- **Connecteurs** : trait orange 2px + tête de flèche (`marker` SVG),
  verticaux entre étapes simples, en équerre pour une fusion de branches.
- **Échelle de valeur** (ex. difficulté 1-5) : seule dérogation à la palette
  à 2 couleurs — un dégradé sémantique vert `#2FBF71` → ambre `#F5A623` →
  rouge `#E5484D` (vert/rouge repris de `--c-green-500`/`--c-red-500` dans
  `app/tokens.css`, ambre ajouté car aucun token jaune n'existe dans l'app).
  Réservé aux légendes de type gradient de sévérité — ne pas réutiliser ces
  couleurs ailleurs dans le visuel, l'orange de marque reste le seul accent
  pour tout le reste (pastilles, connecteurs, kicker).
- Bandeau haut, kicker, titre (52px, pas 84px — registre « slide de
  contenu », pas cover) et trait orange bas : identiques au Format 2.

## Crédit photo (`hero-*.jpg`)

**Clarifié le 11/09/2026** (question posée à l'usage du Post 4) : aucun
crédit photographe n'est nécessaire sur les posts Instagram utilisant
`hero-mural.jpg`/`hero-hoop.jpg`/`hero-hk.jpg`. Ces 3 photos sont sous
licence Unsplash, dont les termes sont explicites — *« No permission needed
(though attribution is appreciated!) »* — l'attribution est appréciée mais
jamais exigée, y compris en usage commercial.

Ce n'est pas une position ad hoc pour l'Instagram : c'est déjà le
raisonnement retenu en production pour ces mêmes fichiers, réutilisés comme
fonds plein écran du thème « Photo » de l'appli (`public/brand/README.md`,
§15.7 — *« Sources : 3 photos Unsplash fournies par l'utilisateur via
Cadrage/DA/*.zip (licence Unsplash) »*, aucun nom de photographe consigné
là non plus). Le nom du photographe original n'est de toute façon plus
retrouvable — photos téléchargées sans compte Unsplash début août 2026,
aucune métadonnée EXIF/XMP conservée dans les fichiers.

Si un jour une nouvelle photo hero est ajoutée, même logique : licence
Unsplash (ou équivalente sans attribution obligatoire) suffit, pas besoin
de chercher/consigner un crédit nommé — seule l'exigence §15.7 (licenciée
ou possédée, sans watermark, hébergée en interne) doit être vérifiée.

Comme les autres formats, vérifier le rendu réel (Chromium headless) avant
export final — la densité de texte par bloc est plus contrainte ici que sur
un slide classique (plusieurs blocs empilés dans la même zone de contenu).

## Fichiers fournis dans ce dossier

`profil.svg`, `post-gabarit.svg`/`post-gabarit-clair.svg` (générique, cover),
`post-conclusion-gabarit.svg`/`post-conclusion-gabarit-clair.svg`
(générique, closing/CTA — voir Format 2bis), `post-1.svg`/`post-2.svg`
(copie réelle des 2 premiers posts, cf. le cadrage business/communication),
`Post 4/post-4.svg` (image unique, logigramme — voir Format 4),
`story-gabarit.svg` — vecteur complet, logo inclus en chemins réels
(éditable directement dans Illustrator/Figma/Inkscape, texte modifiable en
place).
