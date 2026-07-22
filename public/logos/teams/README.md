# Logos des franchises NBA

Un fichier SVG par franchise, nommé **exactement** comme `teams.abbreviation`
(en MAJUSCULES) : `BOS.svg`, `LAL.svg`, `GSW.svg`…

- Source **unique** de l'affichage (décision 21/07/2026 ; amende `SPEC_TECHNIQUE_SYNCHRO §4`).
- `/api/sync/teams` ne télécharge PAS les logos ; `teams.logo_url` reste en base
  mais n'est pas lu pour l'affichage (fallback théorique seulement).
- Fallback d'affichage si un SVG manque : l'abréviation en texte (B4).
- Assets **licenciés ou possédés**, sans watermark, hébergés en interne (B4).
