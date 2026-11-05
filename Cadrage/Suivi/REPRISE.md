# Reprise — NBA Pronos (05/11/2026, passation 23)
- **Chantier aide aux débutants** (`chantiers/CHANTIER_AIDE_DEBUTANTS.md`, refonte : `chantiers/cadrage-refonte-prono.md`) :
  L1-L4 mergés (#267-#270, #272). **Refonte de la carte de prono mergée (#273)** : 5 traits de forme dans les boutons
  d'équipe, popup « Détail des équipes » à 3 onglets (Face à face, Effectif triable, Joueurs à surveiller), bandeau
  « Prochain à pronostiquer » aligné sur le jour NY de la carte.
- **PR ouverte** : #274 (bouton « Détail des équipes » compact, en haut à droite de la carte, en face de l'heure).
  À merger ; regarder le rendu sur le preview (heure + bouton peuvent se serrer sur petit écran ; cible tactile 32 px < 44 px,
  zone de toucher à agrandir si besoin).
- **Quota Vercel** : alerte 90 % Fluid Active CPU (4 h/mois, plan Hobby, quota partagé par les 6 projets) le 05/11 ;
  PR #276 ouverte (proxy sans appel Supabase pour les anonymes, `api/`, `_vercel/`, statiques hors matcher). Suivre la page Usage.
- **Quota Vercel (suite)** : PR #277 ouverte : thème déplacé vers un cookie `pb-theme` (`public/theme-init.js` + `<ThemeSync>`
  dans le layout (app)), layout racine sans session -> `/` réellement en cache 60 s. Étape suivante proposée : cache des données communes.
- **Non fait** : captures d'écran du réel (§8 : script Playwright `scripts/reel-captures/`, seed, `CAPTURES.md`) et
  vérification navigateur 375 px / desktop : demandent Docker + Supabase local, **demander avant de lancer**.
  Aucun serveur de test n'est lancé.
- **À faire ensuite** : contrôler `computed_at` de `stats_team_form` après 12h/16h (VM à jour après #268) ;
  L1-4 (5 bilans vs classement NBA : PHI 8-1, DET 6-2, BOS 6-2) ; L1-5 (titulaires C) ; L5 (visuel) à cadrer.
- **Pièges** : `structureBet` AU PLAFOND de grammaire ; une branche par PR (jamais main) ; le classificateur bloque
  merges / reset / écritures prod ; Python absent (utiliser node) ; heredoc bash avec apostrophes peut échouer (utiliser
  Write) ; `tsc` signale des erreurs connues dans `Cadrage/docs/reel-v2-pack` et `.next/dev/types`.
- **Autres chantiers** : paris persos non calculables, Profil & badges, entonnoir UTM, popup hebdo : voir
  `JOURNAL_SESSIONS.md` (5 dernières lignes) et `GAPS_OUVERTS.md`.
- **Ouvert, hérité** : 983 `stats_box_scores.pf` vides ; « Hauser ou Pritchard » ; pari Memphis `f4f3ebd6…` à rejouer
  (coût IA, demander d'abord) ; poller VM (dryRun → réel) ; probas instables. **Échéances** : bêta Cup 04/12.
