# Assets de marque

`hero-parquet.webp` — bandeau de section « parquet » (§15.7), câblé par le token
unique `--hero-image` (à définir dans le futur fichier de tokens de prod).

Exigences (B4 / §15.7) : image **licenciée ou possédée**, **sans watermark**,
hébergée en interne (pas de hotlink). Ne JAMAIS committer le base64 des maquettes
(placeholder de visualisation uniquement).

Placeholder de dev : nommer le fichier `*.dev.*` (ex. `hero-parquet.dev.webp`),
ignoré par git (voir `.gitignore`), à remplacer par l'asset réel avant mise en ligne.
