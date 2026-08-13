# Prompts IA générative — visuels des 36 badges permanents

> Préparé le 10/08/2026 à la demande de l'utilisateur, pour générer des
> visuels de badges via une IA générative externe (Midjourney, DALL-E,
> Recraft...), en remplacement des icônes `lucide-react` actuelles
> (`lib/badges/icons.tsx`). Rien n'est encore intégré au code — ce fichier
> ne contient que les prompts, à essayer et itérer hors de ce dépôt.
>
> Emplacement : `Cadrage/DA/` est entièrement hors dépôt (`.gitignore`),
> réservé aux assets de travail (maquettes, exports) — ce fichier de
> prompts est du texte de référence à suivre dans le temps, donc rangé ici
> dans `Cadrage/V1/Spec visuelle/`, à côté de
> `SPEC_BADGES_PERMANENTS_V0_1.md`. Les images générées, elles, iront bien
> dans `Cadrage/DA/` (voir "Après génération" en bas de ce fichier).
>
> **1er essai (10/08/2026, badge Chirurgien)** : résultat concluant —
> silhouette lisible, fond transparent propre (le rendu partagé en aparté
> avait un fond blanc, mais c'était un export de partage — le fichier
> source est bien transparent). Bords légèrement irréguliers (rendu peint,
> pas du vectoriel net) : confirme qu'on repart sur un PNG figé en couleur
> neutre plutôt qu'un SVG recolorable comme les icônes lucide actuelles
> (cf. "Contrainte technique" ci-dessous, déjà anticipée).
>
> **2e essai, même badge, nouveau style** : icône encadrée dans un blason/
> bouclier plutôt que l'icône seule — VALIDÉ par l'utilisateur pour ce
> badge. **Le cadre n'est PAS une règle fixe pour les 36** : décidé au cas
> par cas selon ce qui rend bien pour chaque badge, pas de contrainte
> d'uniformité à respecter en générant les 35 suivants.
>
> **Mise à jour du 10/08/2026 (plus tard le même jour)** : comparatif de 7
> styles d'illustration fait par l'utilisateur (hors de ce fichier), classé
> Blason Varsity > Flat minimaliste > Glossy trophée. Décision : garder LE
> MÊME bloc de style de base pour les 35 (linework clair neutre, cf.
> contrainte technique ci-dessous — inchangé), mais répartir les badges en
> 3 groupes de COMPOSITION (§ "Trois familles de composition" plus bas),
> chaque groupe ajoutant une consigne de cadrage/silhouette au-dessus du
> bloc de base commun, sans jamais introduire de couleur ni de dégradé.
> Reconfirmé à cette occasion : 1 seule image par badge (pas de variante par
> palier Bronze->Diamant, le palier reste géré par la carte CSS — cf.
> `Cadrage/V1/Spec visuelle/SPEC_BADGES_PERMANENTS_V0_1.md`).
>
> **Point d'attention non résolu** : le "Victorieux" ci-dessus (ex-
> Chirurgien) est le SEUL badge déjà généré avec le cadre blason, mais le
> classement par groupe plus bas le range dans "Flat" (sa mécanique —
> bons vainqueurs pronostiqués — n'est pas un badge de record/ancienneté).
> Choix fait ici : le garder en Blason par exception (travail déjà validé,
> pas de raison de le refaire), à corriger si tu préfères l'aligner sur la
> logique du groupe plutôt que sur l'essai déjà fait.
>
> **Noms à jour (10/08/2026, révision utilisateur sur le tableau PDF)** :
> Chirurgien->Victorieux, Horloger->Buzzer-beater, Œil de lynx->Money-time,
> Chirurgien (série)->Victorieux (série), Scoreur (série)->Buzzer-beater
> (série), Complétiste->Avant-gardiste. Les tableaux ci-dessous utilisent
> désormais les noms à jour ; certains "Subject" ont été réécrits quand le
> jeu de mots reposait sur l'ANCIEN nom (voir notes par badge). Pilier a été
> retiré (fusionné dans Fidèle).

## Contrainte technique à garder en tête

Les icônes `lucide-react` actuelles sont des SVG en `currentColor` : elles
héritent automatiquement la couleur du palier (Bronze/Argent/Or/Platine/
Diamant) via CSS (`app/tokens.css`, `--color-tier-*`, voir
`components/profile/BadgeCard.module.css`). Une image générée par IA sera
très probablement un **PNG figé**, pas recolorable de la même façon.

**Conséquence pour les prompts ci-dessous** : ils demandent un rendu en
linework **clair et neutre** (blanc/gris très clair) sur fond transparent,
qui reste lisible sur les fonds sombres de l'appli quel que soit le palier.
La coloration par palier (bande de gauche + fond teinté de la carte)
continuera d'être gérée par le CSS existant, indépendamment de l'image —
elle n'a donc pas besoin d'être "dans" l'image elle-même. Si l'outil choisi
sait exporter en SVG propre (vectoriel, une seule couleur), c'est un vrai
plus (recolorable comme aujourd'hui) mais pas une obligation.

## Style commun — à coller en tête de CHAQUE prompt

```
Flat vector badge icon, minimalist line-art emblem, pure stroke-based
outline art (do not render as a solid filled silhouette, outline only, no
color fill), centered composition, transparent background, no text or
letters, no scene or background elements, single bold silhouette readable
at small size (24px), sports/esports achievement badge aesthetic inspired
by NBA broadcast graphics, clean geometric shapes, light grey or white
linework on transparent background, high contrast, square 1:1 composition,
icon only, no photorealism, no gradients.
```

> **Correctif du 10/08/2026 (pilote Gemini/Nano Banana)** : ajout de "pure
> stroke-based outline art / do not render as a solid filled silhouette" —
> le pilote sur Bracket Master a produit un gobelet en silhouette pleine
> au lieu d'un contour, incohérent avec les blasons. Si ça se reproduit
> malgré cet ajout, le préciser une seconde fois directement après le
> Subject du badge concerné.

Puis, pour chaque badge : coller ce bloc de style + la ligne "Subject"
correspondante ci-dessous. Exemple complet pour Chirurgien :

```
Flat vector badge icon, minimalist line-art emblem, pure stroke-based
outline art (do not render as a solid filled silhouette, outline only, no
color fill), centered composition, transparent background, no text or
letters, no scene or background elements, single bold silhouette readable
at small size (24px), sports/esports achievement badge aesthetic inspired
by NBA broadcast graphics, clean geometric shapes, light grey or white
linework on transparent background, high contrast, square 1:1 composition,
icon only, no photorealism, no gradients.
Subject: a five-pointed star inside a circular medal outline, symbolizing
correctly picking the winning team.
```

## Trois familles de composition (10/08/2026)

Chaque badge ci-dessous porte un tag **Groupe A / B / C**. Dans les trois
cas, coller le bloc "Style commun" ci-dessus en premier — inchangé, aucune
couleur, aucun dégradé. La différence tient uniquement à ce qu'on ajoute
PAR-DESSUS avant la ligne "Subject" :

**Groupe C — Flat minimaliste (défaut, 23 badges)** : rien à ajouter. Coller
Style commun + Subject, comme dans l'exemple ci-dessus.

**Groupe B — Blason Varsity (9 badges + 1 exception)** — ajouter avant le
Subject :

```
Compose the icon housed within a heraldic shield/crest outline, with a
small laurel sprig along the shield's lower rim and a thin ribbon banner
beneath it — varsity/collegiate patch aesthetic. Still pure light grey/
white linework, no color fill.
```

**Groupe A — Glossy trophée (3 badges)** — ajouter avant le Subject :

```
Compose the icon as a trophy-cup silhouette with the subject's motif
engraved on the cup's bowl, and a thin double-line accent along the rim
suggesting polished metal. Still pure light grey/white linework, no color
fill, no gradient.
```

*(Le nom "Glossy trophée" décrit l'intention du style choisi dans le
comparatif — le rendu final reste linework neutre comme les 34 autres, pas
un vrai dégradé métallique doré. Si tu veux un vrai rendu doré/brillant
avec de la couleur pour ce groupe, dis-le : ça sortirait de la contrainte
technique actée plus haut, à valider avant de générer.)*

---

## I. Pronostics de match

| Badge | Groupe | Subject |
|---|---|---|
| Victorieux *(ex-Chirurgien)* | **B — Blason** ⚠️ *(exception : mécanique = groupe C, mais cadre Blason déjà généré et validé — utiliser l'add-on Blason, pas l'add-on Flat)* | A five-pointed star inside a circular medal outline, symbolizing correctly picking the winning team. *(sujet réécrit : l'ancien "crosshair/precision chirurgicale" collait au nom Chirurgien, plus à Victorieux)* |
| Buzzer-beater *(ex-Horloger)* | C — Flat | A minimalist analog clock face with precise hour and minute hands, symbolizing exact timing. |
| Money-time *(ex-Œil de lynx)* | C — Flat | A clock face with its two hands almost meeting at the top, a small gap remaining between them, symbolizing a near-exact margin guess just shy of perfect. *(sujet réécrit : l'ancien "œil de lynx" ne collait plus à Money-time — repris en écho visuel au cadran de Buzzer-beater)* |
| Métronome | B — Blason | A classic metronome, arm mid-swing, symbolizing rhythm and consistency. |
| Machine à pronos | C — Flat | A stylized mechanical gear or circuit-board motif, symbolizing tireless, high-volume prediction-making. |

## II. Bracket personnel

| Badge | Groupe | Subject |
|---|---|---|
| Victorieux (série) *(ex-Chirurgien (série))* | B — Blason | A bullseye target merged with a subtle tournament-bracket line motif, symbolizing correctly picking a series winner. |
| Buzzer-beater (série) *(ex-Scoreur (série))* | B — Blason | A percent symbol styled like a basketball scoreboard digit, symbolizing an exact score prediction in the series. |
| Visionnaire | B — Blason | A stylized crystal ball with sparkle accents, symbolizing foresight and anticipation. |
| Avant-gardiste *(ex-Complétiste)* | B — Blason | A tournament-bracket diagram completely filled in, with a small flag planted at its final node, symbolizing being among the first to complete a bracket 100%. *(sujet réécrit : l'ancien "checkmark/seal" collait à Complétiste, plus à Avant-gardiste)* |
| Sans-faute | B — Blason | A clean checkmark at the center, symbolizing flawless performance. *(sujet allégé : le "shield" du subject d'origine faisait doublon avec le blason déjà fourni par l'add-on Groupe B)* |

## III. Paris perso

| Badge | Groupe | Subject |
|---|---|---|
| Scout | C — Flat | A pair of binoculars, symbolizing player scouting and observation. |
| Comptable | C — Flat | A minimalist calculator, symbolizing precise score calculation. |
| Tacticien | C — Flat | A compass with a bold needle, symbolizing tactical planning and strategy. |
| Minuteur | C — Flat | A kitchen-timer dial with tick marks, symbolizing timed-period predictions. |
| Duelliste | C — Flat | Two crossed swords, symbolizing head-to-head duels. |
| Chronomètre | C — Flat | A wristwatch face with second markers, symbolizing playing-time tracking. |
| Assembleur | C — Flat | Two interlocking puzzle pieces, symbolizing combining multiple player stats. |
| Limier | C — Flat | A magnifying glass over a footprint / trail, symbolizing detective-like event tracking. |
| Fantaisiste | C — Flat | A party-popper bursting with confetti, symbolizing fun, offbeat predictions. |
| Accro du pari | C — Flat | A stack of casino chips, symbolizing high-volume betting. |
| Maïno | C — Flat | A pair of theatrical comedy/drama masks, symbolizing absurd, larger-than-life bets. |
| Prudent | C — Flat | A single die showing one pip, symbolizing a cautious, low-risk bet. |
| Joueur | C — Flat | A single die showing two pips, symbolizing a playful, moderate-risk bet. |
| Casse-cou | C — Flat ⚠️ | A single die showing three pips with a small flame accent, symbolizing a daring bet. |
| Kamikaze | C — Flat ⚠️ | A single die showing four pips with a bold lightning-bolt accent, symbolizing a reckless bet. |
| Fou furieux | C — Flat ⚠️ | A single die showing five pips engulfed in dynamic flame/energy lines, symbolizing an all-or-nothing bet. |

⚠️ *`lib/badges/icons.tsx` a un commentaire daté du 10/08/2026 qui dit que
ces 3 subjects (dé + effet) seraient déjà remplacés par un nouveau concept
qui "abandonne les dés aux 2 derniers paliers" — pas repris ici, ce fichier
de prompts n'a pas encore ce nouveau concept. Je n'ai rien changé sur ces
3 lignes, à trancher séparément.*

## IV. Classement global

| Badge | Groupe | Subject |
|---|---|---|
| Collectionneur | C — Flat | A faceted gemstone, symbolizing accumulated value and points. |
| Pronos Master | A — Glossy | A trophy cup with a subtle upward-trending chart line engraved on its bowl, symbolizing mastery of match-prediction points. *(sujet réécrit pour rejoindre la forme "coupe" de Bracket Master et Paris Persos Master — l'ancien "chart arrow" seul n'avait pas de coupe)* |
| Bracket Master | A — Glossy | A trophy cup with a subtle bracket-tree engraving, symbolizing bracket mastery. |
| Paris Persos Master | A — Glossy | A trophy cup with a subtle handwritten-scribble line engraved on its bowl, symbolizing mastery of personal-bet points. *(sujet réécrit, même raison que Pronos Master)* |
| Podiumista | C — Flat | A medal hanging from a ribbon, symbolizing podium finishes. |

## V. Fidélité / régularité

| Badge | Groupe | Subject |
|---|---|---|
| Fidèle | B — Blason | A solid, warm heart shape, symbolizing loyal, consistent engagement. |
| Vétéran | B — Blason | A laurel wreath encircling a small clock mark, symbolizing seasoned experience. |
| Doyen | B — Blason | An hourglass with sand flowing, symbolizing the passage of time and seniority. |

## VI. Ligues

| Badge | Groupe | Subject |
|---|---|---|
| Sociable | C — Flat | A small group of three connected silhouette figures, symbolizing community and camaraderie. |

---

## Après génération

- Nommer les fichiers par `BadgeId` — la clé INTERNE du code
  (`lib/badges/thresholds.ts`/`icons.tsx`, ex. `CHIRURGIEN`, `OEIL_DE_LYNX`),
  PAS le nom affiché à l'écran (ex. `chirurgien.png`, `oeil-de-lynx.png`,
  même pour les badges renommés Victorieux/Money-time/etc. — la clé de code
  n'a pas changé le 10/08/2026, seul `BADGE_LABELS` a été mis à jour) — pour
  matcher directement les clés de `lib/badges/icons.tsx` et faciliter
  l'intégration plus tard.
- Déposer les exports ici, dans `Cadrage/DA/` (même dossier que les autres
  maquettes/assets de travail), ou dans un sous-dossier dédié
  `Cadrage/DA/badges/` si le nombre de fichiers devient difficile à
  parcourir.
- Ne pas committer de PNG en base64 dans un HTML de maquette — déposer les
  fichiers image directement (même règle que `public/brand/README.md`).
- L'intégration réelle (remplacement de `BADGE_ICONS` par des `<Image>`
  Next.js pointant vers ces fichiers) sera un chantier à part, une fois les
  visuels validés — pas fait dans cette session.
