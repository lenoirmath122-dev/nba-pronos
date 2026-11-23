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
