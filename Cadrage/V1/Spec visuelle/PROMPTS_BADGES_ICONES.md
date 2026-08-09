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
Flat vector badge icon, minimalist line-art emblem, centered composition,
transparent background, no text or letters, no scene or background
elements, single bold silhouette readable at small size (24px), sports/
esports achievement badge aesthetic inspired by NBA broadcast graphics,
clean geometric shapes, light grey or white linework on transparent
background, high contrast, square 1:1 composition, icon only, no
photorealism, no gradients.
```

Puis, pour chaque badge : coller ce bloc de style + la ligne "Subject"
correspondante ci-dessous. Exemple complet pour Chirurgien :

```
Flat vector badge icon, minimalist line-art emblem, centered composition,
transparent background, no text or letters, no scene or background
elements, single bold silhouette readable at small size (24px), sports/
esports achievement badge aesthetic inspired by NBA broadcast graphics,
clean geometric shapes, light grey or white linework on transparent
background, high contrast, square 1:1 composition, icon only, no
photorealism, no gradients.
Subject: a precise crosshair / targeting reticle, sharp and clean lines,
symbolizing surgical accuracy in predictions.
```

---

## I. Pronostics de match

| Badge | Subject |
|---|---|
| Chirurgien | A precise crosshair / targeting reticle, sharp and clean lines, symbolizing surgical accuracy in predictions. |
| Horloger | A minimalist analog clock face with precise hour and minute hands, symbolizing exact timing. |
| Œil de lynx | A sharp, alert eye with a focused pupil, symbolizing keen observation and near-perfect insight. |
| Métronome | A classic metronome, arm mid-swing, symbolizing rhythm and consistency. |
| Pilier | A solid architectural column / pillar, symbolizing steadfast reliability. |
| Machine à pronos | A stylized mechanical gear or circuit-board motif, symbolizing tireless, high-volume prediction-making. |

## II. Bracket personnel

| Badge | Subject |
|---|---|
| Chirurgien (série) | A bullseye target merged with a subtle tournament-bracket line motif, symbolizing precise series predictions. |
| Scoreur (série) | A percent symbol styled like a basketball scoreboard digit, symbolizing exact score predictions. |
| Visionnaire | A stylized crystal ball with sparkle accents, symbolizing foresight and anticipation. |
| Complétiste | A checkmark inside a rounded seal / badge outline, symbolizing full completion. |
| Sans-faute | A shield with a clean checkmark at its center, symbolizing flawless performance. |

## III. Paris perso

| Badge | Subject |
|---|---|
| Scout | A pair of binoculars, symbolizing player scouting and observation. |
| Comptable | A minimalist calculator, symbolizing precise score calculation. |
| Tacticien | A compass with a bold needle, symbolizing tactical planning and strategy. |
| Minuteur | A kitchen-timer dial with tick marks, symbolizing timed-period predictions. |
| Duelliste | Two crossed swords, symbolizing head-to-head duels. |
| Chronomètre | A wristwatch face with second markers, symbolizing playing-time tracking. |
| Assembleur | Two interlocking puzzle pieces, symbolizing combining multiple player stats. |
| Limier | A magnifying glass over a footprint / trail, symbolizing detective-like event tracking. |
| Fantaisiste | A party-popper bursting with confetti, symbolizing fun, offbeat predictions. |
| Accro du pari | A stack of casino chips, symbolizing high-volume betting. |
| Maïno | A pair of theatrical comedy/drama masks, symbolizing absurd, larger-than-life bets. |
| Prudent | A single die showing one pip, symbolizing a cautious, low-risk bet. |
| Joueur | A single die showing two pips, symbolizing a playful, moderate-risk bet. |
| Casse-cou | A single die showing three pips with a small flame accent, symbolizing a daring bet. |
| Kamikaze | A single die showing four pips with a bold lightning-bolt accent, symbolizing a reckless bet. |
| Fou furieux | A single die showing five pips engulfed in dynamic flame/energy lines, symbolizing an all-or-nothing bet. |

## IV. Classement global

| Badge | Subject |
|---|---|
| Collectionneur | A faceted gemstone, symbolizing accumulated value and points. |
| Pronos Master | An upward-trending line-chart arrow, symbolizing mastery of match predictions. |
| Bracket Master | A trophy cup with a subtle bracket-tree engraving, symbolizing bracket mastery. |
| Paris Persos Master | A neat stack of coins, symbolizing mastery of personal bets. |
| Podiumista | A medal hanging from a ribbon, symbolizing podium finishes. |

## V. Fidélité / régularité

| Badge | Subject |
|---|---|
| Fidèle | A solid, warm heart shape, symbolizing loyal, consistent engagement. |
| Vétéran | A laurel wreath encircling a small clock mark, symbolizing seasoned experience. |
| Doyen | An hourglass with sand flowing, symbolizing the passage of time and seniority. |

## VI. Ligues

| Badge | Subject |
|---|---|
| Sociable | A small group of three connected silhouette figures, symbolizing community and camaraderie. |

---

## Après génération

- Nommer les fichiers par `BadgeId` (ex. `chirurgien.png`, `oeil-de-lynx.png`)
  pour matcher directement les clés de `lib/badges/icons.tsx` — facilite
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
