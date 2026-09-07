# Logos des franchises NBA

Un fichier SVG par franchise, nommé **exactement** comme `teams.abbreviation`
(en MAJUSCULES) : `BOS.svg`, `LAL.svg`, `GSW.svg`…

- Source **unique** de l'affichage (décision 21/07/2026 ; amende `SPEC_TECHNIQUE_SYNCHRO §4`).
- `/api/sync/teams` ne télécharge PAS les logos ; `teams.logo_url` reste en base
  mais n'est pas lu pour l'affichage (fallback théorique seulement).
- Fallback d'affichage si un SVG manque : l'abréviation en texte (B4).
- Assets sans watermark, hébergés en interne (B4). **Correction (07/09/2026) :**
  la mention précédente ("licenciés ou possédés") n'est pas corroborée — ce
  sont des logos de franchise NBA sans licence, un risque accepté tel quel
  pour la bêta fermée gratuite actuelle (voir `Cadrage/Juridique/
  conseils_juridiques_deploiement_application.md`), à revoir obligatoirement
  avant toute ouverture publique/commerciale (licence ou remplacement des
  visuels).
