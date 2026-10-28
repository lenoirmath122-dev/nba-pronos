# Reprise — NBA Pronos (28/10/2026, passation 21)
- **Chantier paris persos non calculables : code terminé** (`chantiers/CHANTIER_ENRICHISSEMENT_MODELES.md`, section
  « Revue du 28/10/2026 »). Lots 1 à 4 mergés (#260, #261). **Lot 5 : PR #263 ouverte** (`fix/aiguillage-enchainements-quarts`,
  contient aussi cette passation), à merger ; aucune migration.
- **Lot 5 réduit à l'aiguillage** (mesure prod : 2 enchaînements de quarts sur 106 paris, 0 pari points d'équipe par période) :
  pas de modèle `TEAM_POINTS`. Les enchaînements passent par `mixed_combo` → `structureComboPeriodBet`.
- **À faire ensuite** : dans la file admin, regarder le premier passage réel de `GENERAL>X`, de la question de précision,
  de l'« Estimation IA » et d'un combo de quarts (aucun n'a tourné contre la vraie API). Option : rejouer le pari Minnesota
  W-W-L-W (coût IA, demander d'abord).
- **Pièges** : `structureBet` AU PLAFOND de grammaire (ne pas ajouter de champs) ; une branche par PR ; le classificateur
  bloque merges / reset / écritures prod ; vérifier `supabase migration list` après un merge avec migration ; CLI
  `supabase` absente de cette machine (requêtes prod en lecture via le MCP Supabase) ; `tsc` signale des erreurs connues
  dans `Cadrage/docs/reel-v2-pack` (Remotion), sans rapport.
- **Autres chantiers** (Profil & badges, entonnoir UTM, popup hebdo) : état dans `JOURNAL_SESSIONS.md` (5 dernières
  lignes) et `GAPS_OUVERTS.md`.
- **Ouvert, hérité** : 983 `stats_box_scores.pf` vides ; « Hauser ou Pritchard » ; pari Memphis `f4f3ebd6…` à rejouer
  (coût IA, demander d'abord) ; Booker « 40 % au tir en 1re mi-temps » = `STATS_NO_PREDICTION` ; poller VM (dryRun → réel) ;
  probas instables. **Échéances** : bêta Cup 04/12.
