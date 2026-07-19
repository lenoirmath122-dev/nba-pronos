# SPEC_DESIGN_SYSTEM_V0.1 — Design system NBA Pronos (T7)

> Phase : V1 propre. Livrable de cadrage **technique/visuel**. **Statut : VALIDÉ et
> figé (19/07/2026).** Le 1er écran joueur vient APRÈS T7 (B9 / 0.2.9 §2).
> Nature : **design tokens + règles d'usage**. Aucun écran, aucun composant, aucune
> feuille de style de production ici — seulement les jetons et leurs règles.
> T7 **ne produit aucune migration**, ne touche ni au SQL, ni aux server actions
> (T6b), ni aux lectures (T6a), ni au Realtime (T6c).
> Hérite en droite ligne de **0.2.9 §2** (direction visuelle, close), **B4** (logos),
> **B7** (flash live) et des renvois explicites de **T6c §12** vers T7.

---

## 0. Résumé du chantier T7

```text
1.  Principes du design system : token-first, dark défaut, thème = override de     → §2
    tokens, énergie « arène » concentrée sur les moments forts.
2.  Palette — dark (défaut) + bascule clair, surfaces / texte / bordures /          → §3
    accent arène / couleurs sémantiques (gagné, perdu, neutralisé, en attente, live).
3.  Typographie — familles, échelle, poids, chiffres tabulaires des « scores ».     → §4
4.  Espacements / rythme — échelle d'espacement, rayons, élévation.                 → §5
5.  Flash B7 « donnée qui vient de changer » — couleur + durée + courbe,            → §6
    respect prefers-reduced-motion (cible = la cellule, déclencheur figé T6c).
6.  Badges — EN DIRECT (live) et « corrigé par admin X sur requête de Y ».          → §7
7.  Puces de tri du classement — forme, état actif/inactif, Total permanent.        → §8
8.  États de rendu spéciaux — pari annulé (barré + grisé, ≠ perdu),                 → §9
    joueur inactif (grisé + tag), marqueur « en attente » (A1).
9.  Logos & pastille neutre constante + fallback abréviation (B4 / 0.2.9 §2).       → §10
10. Accessibilité & responsive — contraste, mobile d'abord, cibles tactiles,        → §11
    prefers-reduced-motion transverse.
11. Ce que T7 ne dit pas (→ post-T7).                                               → §12
12. Plan de validation T7.                                                          → §13
13. Décisions actées à la validation (accent orange, typo, pastille).              → §14
```

Rien à coder tant que T7 n'est pas validée.

---

## 1. Décisions closes réutilisées (non rouvrables)

| Sujet | Décision | Source |
|---|---|---|
| Direction visuelle | Arène / broadcast ; énergie concentrée sur les moments forts (carte match, bracket, champion), écrans de lecture plus calmes | 0.2.9 §2 |
| Thème | **Sombre par défaut**, bascule **clair** (préférence utilisateur) | 0.2.9 §2 |
| Mobile d'abord | Chaque écran pensé mobile (10-30 joueurs), lecture au pouce | 0.2.9 §1 |
| Logos | Vrais logos (Highlightly, `GET /teams`.`logo`), **hébergés en interne**, posés sur **pastille neutre constante** | B4 / 0.2.9 §2 |
| Fallback logo | **Abréviation** si logo manque / charge mal | 0.2.9 §2 / B4 |
| Flash live B7 | Déclencheur (`id` vient de changer) et cible (la **cellule**) **figés par T6c** ; couleur/courbe/durée = tokens **ici** | T6c §2.4 / B7 |
| Reduced motion | Sous `prefers-reduced-motion`, la valeur change **sans** animation (jamais de clignotement) | T6c §2.4 |
| Pari annulé | **Barré + grisé**, « neutralisé » + raison, « 0 pt » neutre, **distinct d'un perdu** (un perdu n'est ni barré ni grisé) | 0.2.9 §7 / T6c §4 |
| Joueur inactif | **Grisé + tag « inactif »**, conservé au classement avec ses points | 0.2.7 / 0.2.9 §6 / T6c §6.2 |
| Marquage correction | Attribut **public** « saisi/corrigé par admin X sur requête de Y » (le log d'audit reste privé) | 0.2.3 §7 / T6b / T6c §5 |
| Badge EN DIRECT | Sur match en cours (`status` live), retiré à FINISHED ; « match en cours », pas « temps réel à la seconde » | 0.2.9 §7 / T6c §10 |
| Puces de tri | Total · Matchs · Bracket · Paris · Forme ; **Total toujours visible**, rang toujours calculé sur Total | 0.2.6 / 0.2.9 §6 / T6c §9 |
| Convention A1 | « - » (absence) / « 0 » (scoré-zéro) / « en attente » (participé non résolu) au grain **cellule** | T5 §12.3 / T6c §3 |
| Jamais de pénalité négative | Aucun signe négatif nulle part (P6) — vaut aussi pour le **rendu** | T1 §6.1 / T6c §4 |

> T7 **applique** ces décisions au niveau visuel ; elle n'en rouvre aucune. Les seuls
> arbitrages neufs de T7 sont des **valeurs de token** (couleurs, tailles, durées) et
> leurs **règles d'usage**.

---

## 2. Principes du design system

```text
P-DS1  Token-first. Toute couleur, taille, espacement, rayon, durée passe par un
       token nommé. Aucun littéral « en dur » dans les écrans (post-T7).
P-DS2  Thème = jeu de tokens. Le DARK est le défaut ; le CLAIR est un OVERRIDE des
       mêmes noms de token (mêmes clés, valeurs différentes). Un écran ne connaît
       jamais le thème actif : il lit des tokens sémantiques (ex. --color-surface-
       elevated), jamais une couleur brute. Cohérent P1 (le rendu ne re-décide rien).
P-DS3  Deux registres d'énergie (0.2.9 §2) :
         ARÈNE   — carte de match, bracket, champion, live : contraste, accent,
                   élévation, gros chiffres.
         LECTURE — classement, mes pronos, écrans admin : calme, plat, juste teinté
                   de l'identité. Mêmes tokens, densité d'accent moindre.
P-DS4  Mobile d'abord. Toutes les échelles (typo, espacement) sont définies pour le
       viewport mobile ; le desktop élargit, il ne redéfinit pas.
P-DS5  Séparation stricte des noms de token :
         PRIMITIFS  (--c-navy-900, --c-orange-500…) : la palette brute, jamais lue
                    directement par un écran.
         SÉMANTIQUES(--color-surface-base, --color-text-primary…) : ce que les
                    écrans lisent. Le thème ne remappe QUE la couche sémantique.
P-DS6  Accessibilité non négociable : tout couple texte/fond vise WCAG AA (§11).
P-DS7  Convention de nommage : tokens en anglais, kebab-case, préfixe par famille
       (--color-*, --font-*, --space-*, --radius-*, --elevation-*, --motion-*).
```

---

## 3. Palette

> Valeurs **actées**. La **teinte d'accent** = **orange broadcast** (§14.1, retenue
> « pour le moment » : réversible sans refonte car c'est un token sémantique). Le
> reste découle de la direction (fond sombre broadcast, non-noir pur, pour laisser
> respirer l'accent).

### 3.1 Primitifs (couche brute, non lue par les écrans — P-DS5)

```text
Neutres (bleu-nuit d'arène, pas de gris pur — chaleur broadcast) :
  --c-navy-950  #0B0E14      --c-navy-900  #10141D
  --c-navy-800  #141924      --c-navy-700  #1E2531
  --c-navy-600  #2A3341      --c-navy-500  #3A4557
  --c-slate-400 #5E6B7D      --c-slate-300 #8793A4
  --c-slate-200 #A8B2C1      --c-slate-100 #CBD3DE
  --c-white-050 #F2F5FA      --c-white-000 #FFFFFF

Accent arène (acté §14.1 — « broadcast orange », réversible car token) :
  --c-orange-600 #E2551F     --c-orange-500 #FF6A2B     --c-orange-400 #FF8A54

Champion / mise en avant rare :
  --c-gold-500  #F5C451      --c-gold-400  #FFD777

Sémantiques de jeu :
  --c-green-500 #2FBF71  (gagné)     --c-red-500   #E5484D  (perdu)
  --c-red-live  #FF2D4B  (live)      --c-blue-300  #6FA8FF  (info / en attente)
```

### 3.2 Tokens sémantiques — thème DARK (défaut)

```text
Surfaces
  --color-surface-base        = --c-navy-950   (fond d'application)
  --color-surface-raised      = --c-navy-800   (carte de lecture)
  --color-surface-arena       = --c-navy-700   (carte de match / bracket : registre arène)
  --color-surface-overlay     = --c-navy-700   (modale, feuille, popover)
  --color-border-subtle       = --c-navy-600
  --color-border-strong       = --c-navy-500

Texte
  --color-text-primary        = --c-white-050
  --color-text-secondary      = --c-slate-200
  --color-text-muted          = --c-slate-400   (désactivé, méta, « en attente »)
  --color-text-on-accent      = --c-navy-950    (texte posé SUR l'accent)

Accent
  --color-accent              = --c-orange-500
  --color-accent-hover        = --c-orange-400
  --color-accent-pressed      = --c-orange-600
  --color-accent-soft         = rgba(255,106,43,0.14)   (fond ténu, chips, halo)
  --color-champion            = --c-gold-500

Sémantiques de jeu (voir règles d'usage §3.4)
  --color-win                 = --c-green-500
  --color-loss                = --c-red-500
  --color-live                = --c-red-live
  --color-pending             = --c-slate-300   (« en attente », neutre)
  --color-neutralized         = --c-slate-400   (« neutralisé » — JAMAIS rouge)
```

### 3.3 Tokens sémantiques — thème CLAIR (override P-DS2)

```text
Surfaces
  --color-surface-base        = #F4F6FA
  --color-surface-raised      = --c-white-000
  --color-surface-arena       = --c-white-000   (l'énergie arène vient de l'accent
                                                  et de l'élévation, pas du fond)
  --color-surface-overlay     = --c-white-000
  --color-border-subtle       = #DDE3EC
  --color-border-strong       = #C2CBD9

Texte
  --color-text-primary        = --c-navy-900
  --color-text-secondary      = #3A4557
  --color-text-muted          = --c-slate-400
  --color-text-on-accent      = --c-white-000

Accent
  --color-accent              = --c-orange-600   (assombri d'un cran pour le contraste
                                                  sur fond clair — cf. §11.1)
  --color-accent-hover        = --c-orange-500
  --color-accent-pressed      = #C0450F
  --color-accent-soft         = rgba(226,85,31,0.10)
  --color-champion            = #C9971F          (or plus profond, lisible sur clair)

Sémantiques de jeu
  --color-win                 = #1E9E58
  --color-loss                = #C7443F
  --color-live                = --c-red-live
  --color-pending             = --c-slate-400
  --color-neutralized         = --c-slate-400
```

### 3.4 Règles d'usage des couleurs sémantiques

```text
R-COL1  GAGNÉ = --color-win ; PERDU = --color-loss. Ce sont des résultats de jeu
        normaux : texte/pastille pleine opacité, JAMAIS barrés.
R-COL2  NEUTRALISÉ (annulé) n'est JAMAIS rouge (ce n'est pas une perte, P6). Il
        emploie --color-neutralized (gris) + le style barré/grisé de §9.1.
R-COL3  Collision voulue résolue par la FORME : LIVE partage la famille rouge de
        PERDU, mais LIVE n'apparaît QUE sous forme de BADGE (pastille + point qui
        pulse, §7.1) sur une carte de match ; PERDU n'est jamais rendu en badge.
        Contextes et formes disjoints → aucune confusion. (Aucune 6e couleur ajoutée.)
R-COL4  L'accent (--color-accent) est réservé aux ACTIONS et aux MOMENTS FORTS
        (bouton primaire, puce de tri active, halo arène). En registre LECTURE, il
        reste un liseré, pas un aplat (P-DS3).
R-COL5  --color-champion (or) est RARE : champion déduit / vainqueur de finale
        uniquement. Jamais pour un état courant.
R-COL6  « EN ATTENTE » (A1, participé non résolu) = --color-pending, neutre, discret,
        distinct de « - » (absence, muet) et de « 0 » (scoré-zéro, --color-text-
        primary). Voir §9.3.
```

---

## 4. Typographie

> Famille **actée** (§14.2) : une famille **unique** open-source à chiffres
> tabulaires, **auto-hébergée** (extension actée du principe B4 « pas de hotlink
> externe »). Choix guidé par : lisibilité mobile, **chiffres tabulaires** (scores,
> écarts, compte à rebours qui ne « sautent » pas).

### 4.1 Familles

```text
--font-ui       = « Inter », system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
--font-display  = même famille en graisses lourdes, resserrée par letter-spacing
                  (pas de 2e fichier de police pour la V1 — acté §14.2).
--font-numeric  = --font-ui avec `font-variant-numeric: tabular-nums` FORCÉ
                  (scores, écarts, points, compte à rebours, valeurs de puce).
```

### 4.2 Échelle (mobile d'abord, base 16px = 1rem)

```text
--font-size-xs    0.75rem   (12px) — méta, « mis à jour il y a… », tags
--font-size-sm    0.875rem  (14px) — texte secondaire, légendes
--font-size-base  1rem      (16px) — corps par défaut
--font-size-md    1.125rem  (18px) — libellés de carte
--font-size-lg    1.25rem   (20px) — titres de section
--font-size-xl    1.5rem    (24px) — score courant en carte de match
--font-size-2xl   2rem      (32px) — moments forts (score final, écart)
--font-size-3xl   2.5rem    (40px) — champion, écran de célébration (arène)
```

Desktop : l'échelle **s'agrandit d'un cran** sur les titres via media query (P-DS4),
elle n'introduit pas de nouvelles tailles.

### 4.3 Graisses & interlignage

```text
--font-weight-regular  400   --font-weight-medium  500
--font-weight-semibold 600   --font-weight-bold    700
--line-height-tight    1.15  (chiffres arène, titres)
--line-height-normal   1.45  (corps, lecture)
```

### 4.4 Règles d'usage

```text
R-TYP1  Toute donnée CHIFFRÉE comparée en colonne (classement, écarts, scores,
        compte à rebours) utilise --font-numeric (tabular-nums) → alignement stable,
        pas de « saut » à l'incrément live (cohérent avec le flash B7, §6).
R-TYP2  Registre ARÈNE : --font-display + graisse bold sur les gros chiffres
        (score, écart, champion). Registre LECTURE : graisses regular/medium.
R-TYP3  Une seule famille pour la V1 (§14.2). Le contraste vient de la GRAISSE et de
        la TAILLE, pas d'un empilement de polices.
```

---

## 5. Espacements, rayons, élévation

### 5.1 Échelle d'espacement (base 4px)

```text
--space-1  0.25rem (4px)    --space-2  0.5rem  (8px)
--space-3  0.75rem (12px)   --space-4  1rem    (16px)
--space-5  1.5rem  (24px)   --space-6  2rem    (32px)
--space-7  3rem    (48px)   --space-8  4rem    (64px)
```

Règle : marges et gouttières **uniquement** sur cette échelle (P-DS1). Padding de
carte par défaut = `--space-4` ; gouttière de liste = `--space-3`.

### 5.2 Rayons

```text
--radius-sm    6px    (tags, badges, puces)
--radius-md    10px   (cartes de lecture, champs)
--radius-lg    16px   (cartes de match / bracket — registre arène)
--radius-pill  999px  (puces de tri, badge EN DIRECT)
--radius-full  50%    (pastille de logo, point « live »)
```

### 5.3 Élévation (le contraste d'énergie arène/lecture, P-DS3)

```text
--elevation-flat   none                                  (écrans de lecture)
--elevation-raised 0 1px 2px rgba(0,0,0,0.30)            (carte de lecture, dark)
--elevation-arena  0 6px 20px rgba(0,0,0,0.45)           (carte de match / bracket)
--elevation-glow   0 0 0 1px var(--color-accent-soft),   (halo d'accent, moment fort
                   0 6px 24px rgba(255,106,43,0.18)        — usage parcimonieux R-COL4)
```

En thème CLAIR, les ombres sont réduites (`rgba(16,20,29,0.10~0.16)`) : l'énergie
arène passe alors surtout par l'accent et le rayon, pas par l'ombre.

```text
R-ELV1  --elevation-arena / --elevation-glow : réservés aux MOMENTS FORTS (P-DS3).
        Un écran de lecture n'empile jamais plus que --elevation-raised.
```

---

## 6. Flash B7 — « donnée qui vient de changer »

> Déclencheur (l'`id` entre dans `justChangedIds`) et cible (**la cellule** modifiée)
> **figés par T6c §2.4**. T7 ne fixe que l'**apparence** et la **durée**.

### 6.1 Tokens

```text
--motion-flash-color     = --color-accent-soft   (surbrillance ténue, teintée accent)
--motion-flash-duration  = 1200ms                 (dans la fourchette B7 ~1-2 s)
--motion-flash-easing    = cubic-bezier(0.2, 0, 0, 1)   (ease-out : pic immédiat,
                                                          retour doux au neutre)
```

### 6.2 Comportement

```text
- La cellule reçoit un fond --motion-flash-color qui s'éteint vers transparent en
  --motion-flash-duration, puis revient à l'état neutre. Purement cosmétique :
  aucune dépendance métier, aucun son, aucune modale (T6c §2.4).
- Un SEUL flash par événement ; pas de clignotement répété.
- La couleur teinte, elle ne masque pas : le texte reste lisible pendant le flash
  (contraste AA maintenu sur --color-surface-* — §11.1).
```

### 6.3 prefers-reduced-motion (règle close, T6c)

```text
R-MOT1  Sous prefers-reduced-motion : le flash N'EST PAS joué. La valeur change
        INSTANTANÉMENT (pas d'animation, pas de clignotement). C'est un remplacement
        de valeur nu — jamais un fondu accéléré. (T6c §2.4, non rouvrable.)
R-MOT2  Toute autre animation d'ambiance (pulse du point live §7.1, transitions de
        thème) tombe elle aussi sous R-MOT1 : réduite/désactivée sous cette
        préférence. Le design system n'a AUCUNE animation indispensable au sens.
```

---

## 7. Badges

Forme commune : pastille `--radius-pill`, `--font-size-xs`, `--font-weight-semibold`,
padding `--space-1 --space-2`, `letter-spacing` léger. Deux badges spécifiés ici ;
les libellés exacts hors de ces deux-là restent B9 (post-T7).

### 7.1 Badge EN DIRECT (live)

```text
- Fond : --color-live à faible opacité (soft) ; texte : --color-live ; libellé court
  en capitales (« EN DIRECT »).
- POINT qui pulse à gauche (--radius-full, --color-live) : pulsation lente (~1.5 s,
  opacité 1 → 0.4 → 1).
- Présent tant que le match est « en cours » ; RETIRÉ à FINISHED (T6c §10.1). C'est
  « match en cours », pas « temps réel à la seconde » (T6c §10.3) — le repère
  « mis à jour il y a… » (texte --color-text-muted, --font-size-xs) porte la
  fraîcheur réelle, à côté du badge.
- prefers-reduced-motion : le point NE pulse PAS (statique, pleine opacité) — R-MOT2.
```

### 7.2 Badge de correction admin (attribut public)

```text
- Ton FACTUEL, jamais alarmant : fond --color-accent-soft OU neutre (--color-border-
  subtle), texte --color-text-secondary. PAS de rouge (ce n'est pas une erreur du
  joueur, c'est une trace).
- Deux formes de libellé (T6c §5 / T6c-test 11-12) :
    « corrigé par {X} »                     ← correction sans requête
    « corrigé par {X} sur requête de {Y} »  ← correction demandée par le joueur Y
- Icône discrète optionnelle (crayon/bouclier) à gauche.
- La RAISON est consultable au tap/survol (attribut de ligne — correction_reason),
  jamais via audit_logs (le composant public n'interroge pas l'audit — T6c §5).
- Visible APRÈS verrouillage du prono (T6c-test 11).
```

---

## 8. Puces de tri du classement

> Puces : **Total · Matchs · Bracket · Paris · Forme** (0.2.6 / 0.2.9 §6 / T6c §9.1).
> Total **toujours présent** ; rang **toujours** calculé sur Total (T6c §9.1).

### 8.1 Forme

```text
- Chip `--radius-pill`, --font-size-sm, hauteur ≥ 40px (cible tactile §11.3).
- INACTIVE : fond transparent, bordure --color-border-subtle, texte --color-text-
  secondary.
- ACTIVE  : fond --color-accent, texte --color-text-on-accent (R-COL4). Une seule
  puce active à la fois.
- Rangée de puces HORIZONTALE ; sur mobile elle peut défiler horizontalement SI
  nécessaire — ceci ne contredit pas 0.2.9 §11.5, qui interdit le scroll horizontal
  du TABLEAU de classement, pas de la rangée de puces (le tableau reste à 3 colonnes,
  T6c §9.4).
```

### 8.2 Règles d'usage

```text
R-CHIP1 La puce « Total » reste visuellement DISPONIBLE et sa valeur reste affichée
        dans le tableau même quand une autre puce est active (repère du classement
        réel, 0.2.9 §6). Changer de puce ne renumérote jamais le rang (T6c §9.1).
R-CHIP2 « dont Écarts » est une aide de lecture triable, PAS une 6e puce officielle
        (T6c §9.1) : si rendu, style visuellement SECONDAIRE (bordure pointillée ou
        --color-text-muted), distinct des 5 puces officielles.
```

---

## 9. États de rendu spéciaux

### 9.1 Pari annulé / neutralisé (0.2.9 §7 / T6c §4)

```text
- Texte BARRÉ (line-through) + grisé : opacité --opacity-cancelled = 0.55, couleur
  ramenée vers --color-neutralized.
- Mention « neutralisé » + la RAISON (resolution_reason, ex. « match annulé »).
- « 0 pt » explicite, présenté comme NEUTRE (--color-text-muted), jamais en rouge.
- Reste DANS la liste (pas de section à part).
R-CAN1  Distinction stricte annulé vs perdu :
          ANNULÉ = barré + grisé + « neutralisé » (gris).
          PERDU  = NI barré NI grisé, pleine opacité, --color-loss (rouge).
        Aucun signe négatif nulle part (P6) — ni « -X », ni flèche descendante rouge
        sur un annulé.
```

### 9.2 Joueur inactif / désactivé (0.2.7 / 0.2.9 §6 / T6c §6.2)

```text
- Ligne grisée : opacité --opacity-inactive = 0.60 sur la ligne entière.
- Tag « inactif » : pastille --radius-sm, fond --color-border-subtle, texte
  --color-text-muted, --font-size-xs.
- CONSERVÉ au classement AVEC ses points ; compte au rang et au départage comme
  tout joueur (T6c §6.2). Le rendu lit users.status, il ne re-décide rien (P1).
```

### 9.3 Marqueur « en attente » (A1, T6c §3)

```text
- Cas EN ATTENTE (participé, entité non résolue) : marqueur NEUTRE --color-pending
  (petit tag ou pastille discrète) à côté du pick, --font-size-xs.
- Distinct de « - » (absence : simple tiret --color-text-muted, aucun tag) et de
  « 0 » (scoré-zéro : chiffre --color-text-primary).
- Vit UNIQUEMENT au grain cellule de détail ; au total tout se somme à 0 (T6c §3).
```

### 9.4 Tokens d'opacité d'état

```text
--opacity-cancelled  0.55   --opacity-inactive  0.60   --opacity-disabled-ctrl 0.40
```

---

## 10. Logos & pastille neutre

> B4 : logos Highlightly (`GET /teams`.`logo`, `https://highlightly.net/nba/images/
> teams/{id}.png`), **hébergés en interne** (pas de hotlink). 0.2.9 §2 : **pastille
> neutre constante** + **fallback abréviation**.

### 10.1 Pastille neutre (constante, les deux thèmes)

```text
- Forme : cercle --radius-full.
- Fond : --color-logo-pastille = #EDF1F7 — CONSTANT en dark ET en clair (0.2.9 §2 :
  « rond clair » constant, pour que le logo reste lisible dans les deux thèmes). Ce
  token ne fait PAS partie des overrides de thème (§3) : c'est une constante.
- Le logo est INSCRIT dans la pastille avec un padding interne (--space-1 à --space-2
  selon la taille) pour ne pas toucher le bord.
```

### 10.2 Tailles

```text
--logo-size-sm  24px  (ligne de classement, liste dense)
--logo-size-md  32px  (carte de match, drill-down)
--logo-size-lg  48px  (moment fort : entête de match, bracket)
```

### 10.3 Fallback abréviation (B4 / 0.2.9 §2)

```text
- Déclenché si le logo manque, échoue au chargement, ou n'est pas encore hébergé
  en interne.
- MÊME pastille neutre ; à l'intérieur, l'abréviation d'équipe (2-3 lettres) en
  --font-numeric-like (bold, tabular), --color-navy-900 sur la pastille claire.
- Aucune couleur d'équipe inventée : la pastille reste neutre (0.2.9 §2), le fallback
  ne colore pas.
R-LOGO1 Qualité visuelle exacte des PNG Highlightly (transparence, résolution) à
        vérifier À L'INTÉGRATION réelle (B4) ; le design system fixe le CONTENANT
        (pastille + tailles + fallback), pas la vérif d'assets.
```

---

## 11. Accessibilité & responsive

### 11.1 Contraste (WCAG AA — P-DS6)

```text
- Texte normal ≥ 4.5:1, texte large (≥ --font-size-lg bold) ≥ 3:1 sur son fond.
- --color-text-primary sur --color-surface-base : conforme dans les DEUX thèmes.
- L'accent sur fond CLAIR est assombri (--c-orange-600) précisément pour tenir le
  contraste du texte --color-text-on-accent (§3.3). Vérification obligatoire au
  moment d'intégrer chaque couple (plan §13).
- Ne jamais coder une info UNIQUEMENT par la couleur : annulé porte AUSSI le barré,
  live porte AUSSI le point + le mot, gagné/perdu portent AUSSI un libellé.
```

### 11.2 Responsive (mobile d'abord — P-DS4)

```text
--breakpoint-sm  640px   --breakpoint-md  768px   --breakpoint-lg  1024px
- Base = mobile. Les media queries ÉLARGISSENT (colonnes de classement complètes au
  desktop, échelle typo +1 cran) ; elles ne redéfinissent pas les tokens de base.
- Tableau de classement : 3 colonnes max en mobile, jamais de scroll horizontal
  (T6c §9.4) ; toutes colonnes au desktop.
```

### 11.3 Cibles tactiles & focus

```text
--tap-target-min  44px  — hauteur/largeur minimale des contrôles tactiles (boutons
        de vainqueur, puces de tri, pavé numérique d'écart, tap sur une série).
--focus-ring = 0 0 0 2px var(--color-surface-base), 0 0 0 4px var(--color-accent)
        — anneau de focus VISIBLE au clavier sur tout élément interactif.
```

---

## 12. Ce que T7 ne dit pas

```text
- Aucun écran, aucun composant, aucune CSS de production : le 1er écran joueur vient
  APRÈS T7 (B9 / 0.2.9 §2).                                                → post-T7
- Libellés / chaînes définitifs (états vides, wording C2, marqueur « en attente ») :
  restent B9, figés au code de chaque écran (T6c §11.2).                   → post-T7
- Le SQL, le Realtime, les server actions, les lectures.        → T1/T3/T4/T6a/T6b/T6c
- La config du planificateur externe (cron).                             → T8/déploiement
- Le sourcing d'assets logos et leur vérif qualité (B4) : disponibilité confirmée,
  intégration réelle à faire au code de l'écran concerné.                 → post-T7
```

---

## 13. Plan de validation T7

```text
PALETTE & THÈME
1.  Basculer dark ↔ clair : SEULS les tokens sémantiques changent ; aucun écran ne
    lit une couleur brute (revue : aucun primitif --c-* lu hors de la couche thème).
2.  --color-text-primary / --color-surface-base : contraste AA vérifié dans les 2 thèmes.
3.  Accent actif (puce, bouton) : --color-text-on-accent lisible AA sur --color-accent,
    dans les 2 thèmes (accent assombri au clair).

SÉMANTIQUES DE JEU
4.  Gagné (vert) ≠ perdu (rouge) ≠ neutralisé (gris, barré) : trois rendus distincts,
    aucun signe négatif sur l'annulé (P6).
5.  Live (badge rouge + point) jamais confondu avec perdu : perdu n'est jamais un badge.
6.  « - » / « 0 » / « en attente » : trois rendus cellule distincts (A1).

FLASH B7
7.  Cellule changée → un flash unique ~1.2 s, texte lisible pendant le flash.
8.  prefers-reduced-motion → valeur changée SANS animation, aucun clignotement (R-MOT1).

BADGES & PUCES
9.  EN DIRECT présent en cours, retiré à FINISHED ; point statique sous reduced-motion.
10. « corrigé par X » et « corrigé par X sur requête de Y » : ton factuel, pas rouge,
    raison au tap.
11. Puce active = accent ; Total toujours affiché ; changer de puce ne renumérote pas.

ÉTATS SPÉCIAUX & LOGOS
12. Pari annulé barré + grisé + « neutralisé » ; perdu ni barré ni grisé.
13. Joueur inactif grisé + tag, toujours au classement avec points.
14. Pastille neutre constante en dark ET clair ; fallback abréviation sur la même
    pastille quand le logo manque.

RESPONSIVE & A11Y
15. Mobile : classement 3 colonnes, aucun scroll horizontal du tableau.
16. Toute cible tactile ≥ 44px ; focus clavier visible partout.
```

---

## 14. Décisions actées à la validation de T7 (19/07/2026)

> Les trois points restés ouverts en fin de rédaction ont été tranchés à la
> validation. Aucun ne rouvre une décision produit ou technique actée.

### 14.1 Teinte d'accent « arène » = **orange broadcast** — *acté*

**Acté.** L'accent est l'**orange broadcast** (`--c-orange-500 #FF6A2B` en dark,
assombri en `--c-orange-600 #E2551F` au clair pour le contraste — §3.2/§3.3).
Retenu **« pour le moment »** : comme il ne vit que dans la couche de tokens
sémantiques (`--color-accent*`, P-DS2/P-DS5), il reste **réversible sans refonte** —
changer la teinte plus tard = éditer les primitifs `--c-orange-*`, aucun écran ne
lisant une couleur brute. Choix cohérent « parquet / diffusion NBA » et **neutre
vis-à-vis des 30 franchises** (les couleurs d'équipe vivent dans les logos sur
pastille, pas dans le chrome). Alternatives écartées pour l'instant : bleu
électrique, duo orange + or (l'or reste réservé au champion, §3 R-COL5).

### 14.2 Typographie : famille unique, chiffres tabulaires, auto-hébergée — *acté*

**Acté.** Une **seule famille** open-source à chiffres tabulaires ; le contraste
vient de la **graisse/taille**, pas d'un empilement de polices (pas de 2e fichier en
V1). La police est **hébergée en interne** (pas de CDN externe type Google Fonts) —
extension **actée** du principe B4 « pas de hotlink externe » retenu pour les logos.
Le nom exact de la famille (Inter ou équivalent) est un détail d'intégration figé au
moment d'ajouter l'asset, sans impact sur les tokens `--font-*`.

### 14.3 Pastille neutre constante hors thème — *acté*

**Acté.** `--color-logo-pastille` (#EDF1F7) est une **constante**, identique en dark
et en clair (§10.1) : c'est la seule exception assumée au mécanisme d'override de
thème (P-DS2). Motif retenu (formulé à la validation) : garantir un **rendu du logo
toujours optimal**, quel que soit le thème actif — le rond clair constant préserve la
lisibilité de tous les logos dans les deux modes (0.2.9 §2, « lisible en sombre comme
en clair »).

---

**T7 est VALIDÉE et figée (19/07/2026).** Aucune migration, aucun écran, aucune
décision produit ou technique actée rouverte. On peut enchaîner sur le premier écran
joueur codé (post-T7, B9 / 0.2.9 §2), qui consommera exclusivement les tokens
sémantiques définis ici.
