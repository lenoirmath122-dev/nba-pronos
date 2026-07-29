# Assets de marque

`hero-parquet.jpg` — bandeau de section « parquet » (§15.7), câblé par le token
unique `--hero-image` (`app/tokens.css`). Déposé le 29/07/2026 (format réel
`.jpg`, pas `.webp` comme envisagé initialement — le token suit le fichier
réel, pas l'inverse).

Exigences (B4 / §15.7) : image **licenciée ou possédée**, **sans watermark**,
hébergée en interne (pas de hotlink). Ne JAMAIS committer le base64 des maquettes
(placeholder de visualisation uniquement).

Placeholder de dev : nommer le fichier `*.dev.*` (ex. `hero-parquet.dev.webp`),
ignoré par git (voir `.gitignore`), à remplacer par l'asset réel avant mise en ligne.
