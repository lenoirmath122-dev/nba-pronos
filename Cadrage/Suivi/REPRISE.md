# Reprise — NBA Pronos (28/10/2026, passation 20)
- **Chantier en cours : paris persos non calculables** (`chantiers/CHANTIER_ENRICHISSEMENT_MODELES.md`, section
  « Revue du 28/10/2026 »). Lots 1, 2, 4 mergés (#260). **Lot 3 : PR #261 ouverte** (`feat/estimation-ia-paris-non-calculables`,
  checks verts), à merger ; aucune migration.
- **Après le merge** : regarder dans la file admin la route `GENERAL>X`, la question de précision et l'« Estimation IA »
  (jamais essayées contre la vraie API).
- **Prochaine étape : lot 5, en Opus** (modélisation) : enchaînements de quarts-temps depuis `QUARTER_WINNER`, puis
  éventuel kind `TEAM_POINTS` par période (seul cas qui justifie d'entraîner un modèle), « 5 majeur 2× » en estimation IA.
  Décider d'abord si ces paris reviennent assez souvent pour valoir un modèle.
- **Pièges** : `structureBet` AU PLAFOND de grammaire (ne pas ajouter de champs) ; une branche par PR ; le classificateur
  bloque merges / reset / écritures prod ; vérifier `supabase migration list` après un merge avec migration.
- **Autres chantiers** (Profil & badges, entonnoir UTM, popup hebdo, mail Resend) : état dans `JOURNAL_SESSIONS.md` (5 dernières
  lignes) et `GAPS_OUVERTS.md`. Le détail de la passation 19 (25/10) n'a pas été revérifié ici.
- **Ouvert, hérité** : 983 `stats_box_scores.pf` vides ; « Hauser ou Pritchard » ; pari Memphis `f4f3ebd6…` à rejouer
  (coût IA, demander d'abord) ; poller VM (dryRun → réel) ; probas instables. **Échéances** : bêta Cup 04/12.
