# Chantier — Règlement NBA Cup, CGU et page Règles (23/11/2026)

Annonce des lots sur Instagram le 24/11. Pas un avis juridique.

## Décisions (phase 1, réponses du 23/11)

- **Organisateur** : Mathieu Lenoir, particulier en nom propre ; contact panier.ballon.pronos@gmail.com ;
  adresse communicable sur demande (comme les mentions légales).
- **Participants** : 15 ans et plus (même seuil que le site) ; un mineur doit avoir l'accord d'un parent
  pour recevoir le lot. Résidence : France, Belgique, Suisse. Une personne = un compte.
- **Compte validé requis** à la date limite (statut ACTIVE ; PENDING exclus).
- **Exclus** : comptes ADMIN ; comptes de test (liste à sortir en base en lecture seule, validée par l'utilisateur).
  Famille proche non exclue.
- **Lot 1 (tirage)** : bracket complet = 7 choix (4 quarts, 2 demies, finale) avec un vainqueur à la date
  limite, validé ou non. Maillot Swingman au choix, 104,99 €, colis suivi. Tirage filmé le 04/12.
- **Lot 2 (meilleure ligue)** : **supprimé**. Ne pas l'écrire dans le règlement.
- **Option désactivée « meilleur pronostiqueur »** : 1er du classement NBA Cup ; lot = carte cadeau
  ~50 € (Decathlon probable, à confirmer). Article supprimable.
- **Départage** : 4 critères du classement (points, bons vainqueurs, écarts exacts, points de bracket),
  puis tirage au sort filmé.
- **Gagnant** : contacté par e-mail du compte + message chat + push + story Instagram ; 7 jours pour
  répondre, sinon nouveau tirage.
- **Publication** : pseudo seulement (jamais le nom), annoncé dans le règlement ; refus possible sans perdre le lot.
- **CGU v2 du 24/11/2026** (v1 implicite = 03/09/2026) ; retirer « bêta privée, sur invitation » et
  « cercle fermé » des CGU et de la confidentialité.

## Faits techniques (audit)

- Pages : `app/cgu`, `app/confidentialite`, `app/regles`, `app/mentions-legales` ; liens :
  `components/nav/PublicLegalBar.tsx`, `components/profile/InfoSections.tsx`.
- Date limite : `competitions.bracket_deadline` (timestamptz) = 1er match de la compétition
  (`lib/competitions/bracketDeadline.ts`) ; verrou RLS `bracket_deadline_passed()`. Vérifier qu'aucun
  match Cup n'est avant le 1er quart.
- Bracket : `brackets` + `bracket_picks` (pas de flag « complet »). Barème Cup : `lib/scoring/engine.ts`.
- E-mail : `auth.users` uniquement. Aucune adresse postale collectée aujourd'hui → paragraphe à ajouter
  à la confidentialité.

## Reste à faire (phase 2)

1. Rédiger règlement, CGU (avant/après), confidentialité, encadré Règles → montrer en entier à l'utilisateur.
2. Lister les comptes de test en base (lecture seule), faire valider.
3. Intégration (session Sonnet) : page `/reglement-nba-cup`, lien pied de page + profil, encadré Règles,
  `scripts/tirage-nba-cup-eligibles.sql` (lecture seule, non exécuté). Branche + PR, pas de déploiement.
4. À la main : annonce Instagram avec la mention Meta, lien du règlement dans la story « Les lots ».

## Version 2 (24/11/2026) — deux cartes cadeaux au classement

Remplace le maillot tiré au sort de la v1 (#322). À mettre en production avant le 25/11 à 12h30.

- **Lots** : deux cartes cadeaux numériques Decathlon de 50 € (constante `GIFT_CARD_EUR` dans
  `app/reglement-nba-cup/page.tsx`) ; ni échangeables, ni remboursables en argent ; remplaçables par une carte
  de valeur équivalente si l'enseigne n'est plus disponible. Mention « Decathlon n'organise pas ce jeu et ne le
  parraine pas ».
- **Lot 1 — meilleur bracket** : le plus de points de bracket à l'issue de la finale (choix enregistrés avant
  la date limite). Départage : bons vainqueurs, puis bon champion, puis bracket créé le plus tôt.
- **Lot 2 — meilleur pronostiqueur des matchs de la Cup** : le plus de points sur les pronos de matchs, du
  1er quart à la finale (ni bracket, ni pronos personnalisés, ni saison régulière). Départage : bons
  vainqueurs, puis écarts exacts, puis premier prono Cup posé le plus tôt.
- **Aucun tirage au sort**, même pour départager. **Pas de cumul** : si le gagnant du lot 1 est aussi 1er du
  lot 2, le lot 2 passe au suivant.
- **Remise** : contact par l'e-mail du compte ; sans réponse sous 7 jours, le lot passe au suivant ; carte
  envoyée par e-mail sous 15 jours ; aucune adresse postale. Annonce au plus tard le 14/12/2026.
- **Pages** : règlement v2 (« Version 2 du 24/11/2026 »), encadré Règles `#nba-cup-lots` (remplace
  `#nba-cup-maillot`), paragraphe « opération avec lots » de la confidentialité. CGU inchangées.
- **Script** : `scripts/classements-nba-cup-lots.sql` (deux requêtes en lecture seule, colonne
  `gagnant_lot_1` pour le non-cumul) remplace `scripts/tirage-nba-cup-eligibles.sql`. Testé le 24/11 sur
  « Alpha NBA Cup ».
- **Données des départages** : `bracket_picks.is_winner_correct` et `points_awarded`, manche `CUP_FINAL`
  pour le champion, `brackets.created_at` (posé au premier choix enregistré) ; `match_predictions`
  `points_awarded`, `is_winner_correct`, `margin_diff = 0`, `created_at` (aucune suppression de prono dans
  le code, donc stable).
- **Reste à la main** : vérifier e-mail confirmé, âge et résidence des gagnants avant l'envoi (non vérifiable
  en SQL).
