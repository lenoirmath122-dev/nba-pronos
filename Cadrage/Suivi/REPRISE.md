# Reprise — NBA Pronos (05/11/2026, passation 22)
- **Chantier aide aux débutants** (`chantiers/CHANTIER_AIDE_DEBUTANTS.md`) : forme des équipes sur la carte de match +
  popup « Détail des équipes ». Lots 1-4 codés, **L5 (visuel) à cadrer plus tard**.
- **État** : L1 mergé et appliqué en prod (#267, 30 équipes / 452 joueurs, 69 ms). **PR ouvertes à merger dans l'ordre** :
  #268 (L2, job VM) → #269 (L3, API + cache) → #270 (L4, composants, ciblée sur la branche du L3).
- **À faire ensuite** : après #268, mettre à jour la VM (`git pull` + `install.sh`, `Cadrage/Stats/vm/DEPLOIEMENT_VM.md`)
  puis contrôler `computed_at` de `stats_team_form` après 12h/16h. Après #269+#270, regarder la popup en vrai sur un preview.
- **Non fait** : test e2e de la popup et captures d'écran du réel (§8) — demandent Docker/Supabase local, à lancer
  seulement sur demande ; L1-4 (5 bilans vs classement NBA : PHI 8-1, DET 6-2, BOS 6-2 en tête de l'Est) ; L1-5 (titulaires C).
- **Pièges** : `structureBet` AU PLAFOND de grammaire ; une branche par PR ; le classificateur bloque merges / reset /
  écritures prod ; migration via MCP = version horodatée par le MCP, renommer le fichier local pour l'aligner ; CLI
  `supabase` absente (requêtes prod via le MCP) ; `tsc` signale des erreurs connues dans `Cadrage/docs/reel-v2-pack`.
- **Autres chantiers** : paris persos non calculables (code terminé, premier passage réel en file admin à observer),
  Profil & badges, entonnoir UTM, popup hebdo : voir `JOURNAL_SESSIONS.md` (5 dernières lignes) et `GAPS_OUVERTS.md`.
- **Ouvert, hérité** : 983 `stats_box_scores.pf` vides ; « Hauser ou Pritchard » ; pari Memphis `f4f3ebd6…` à rejouer
  (coût IA, demander d'abord) ; poller VM (dryRun → réel) ; probas instables. **Échéances** : bêta Cup 04/12.
