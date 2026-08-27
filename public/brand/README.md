# Assets de marque

`logo.svg` — logo NBA Pronos (badge panier + ballon), source vectorielle
maîtresse. Vectorisé le 27/08/2026 à partir de `Cadrage/DA/Logo.jpg` (fond
4 couleurs d'origine retiré par seuillage sur le contour, badge tracé par
couche de couleur — navy/orange base/orange ballon/blanc/noir — puis
optimisé SVGO). Sert de source pour `app/favicon.ico`, `app/apple-icon.png`
et `public/icons/icon-{192,512}.png` (générés à sa résolution, plus besoin
de repartir du JPEG). Réutilisable directement dans l'UI (nav visiteur,
écrans de connexion) si besoin, même logique que les blasons d'équipe
(`public/logos/teams/*.svg`).

`hero-parquet.jpg` — bandeau de section « parquet » (§15.7), câblé par le token
unique `--hero-image` (`app/tokens.css`). Déposé le 29/07/2026 (format réel
`.jpg`, pas `.webp` comme envisagé initialement — le token suit le fichier
réel, pas l'inverse).

`hero-mural.jpg` / `hero-hoop.jpg` / `hero-hk.jpg` — fonds plein écran des
écrans migrés vers `.photo-page` (`app/globals.css`, essai DA 05/08/2026,
généralisé le 06/08/2026) : remplacent le bandeau photo par un fond de page
fixe derrière des cartes translucides (`.glass-card`). Câblés par le token
`--photo-page-image` (`app/tokens.css`), redéfini par joueur via l'attribut
`data-bg` posé sur `<html>` (`app/layout.tsx`, colonne `users.background_theme`,
migration `20260806090000_background_theme.sql`) — `hero-mural.jpg` reste la
valeur par défaut (`:root`, aucun attribut). Sélecteur : Profil > Compte >
« Fond d'écran ».
Sources : 3 photos Unsplash fournies par l'utilisateur via `Cadrage/DA/*.zip`
(licence Unsplash), recompressées (1080px large, q68) avant dépôt ici.

`hero-*-thumb.jpg` — vignettes carrées (220px, q62) du sélecteur « Fond
d'écran » ci-dessus, dérivées des fichiers plein écran correspondants — à
régénérer si l'asset source change (voir `scripts/` ou recompresser à la main,
pas de script dédié committé pour l'instant).

Exigences (B4 / §15.7) : image **licenciée ou possédée**, **sans watermark**,
hébergée en interne (pas de hotlink). Ne JAMAIS committer le base64 des maquettes
(placeholder de visualisation uniquement).

Placeholder de dev : nommer le fichier `*.dev.*` (ex. `hero-parquet.dev.webp`),
ignoré par git (voir `.gitignore`), à remplacer par l'asset réel avant mise en ligne.
