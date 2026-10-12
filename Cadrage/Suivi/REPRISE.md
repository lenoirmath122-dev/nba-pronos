# Reprise — NBA Pronos

> Seul fichier lu en début de session. Réécrit en entier à chaque passation, 20 lignes max.

## État actuel (mis à jour le 12/10/2026)
- **Objectif en cours** : popup hebdo LLM (classement hebdo, lot 5). PR 1 à 5
  mergées sur `main` le 12/10 (#170 pipeline, #171 popup joueur, #172 admin).
  Aucun appel LLM réel à ce jour.
- **Prochaine étape** : à cadrer (vérifs sur preview, premier essai réel) ;
  voir `chantiers/CHANTIER_CLASSEMENT_HEBDO.md`.
- **Échéances** : compétition réelle `DAILY_MATCH` **avant le 16/10 à 5 h UTC**
  (« Saison régulière - entrainement » créée le 12/10 : vérifier `weekly_ranking`
  actif) ; premier figement hebdo **lundi 26/10** ; bêta Cup **04/12**.
- **Communication** : Reel de clôture du test prêt (`DA/instagram/Réels/…cloture-
  test-reel-v3.mp4` + légende), à publier puis repartager en Story ; CTA « Inscris-toi ».
- **Points ouverts** : durée de `/admin/competitions` sur preview (60 ou 300 s) ;
  tarif réel de `claude-sonnet-5-5` ; reste de la popup dans `chantiers/`.
- **Pièges** : une branche + un worktree par PR, depuis `origin/main` ; docs de
  suivi non commitées ; migrations via MCP Supabase ; jamais de secret affiché.
- **En attente ailleurs** : correctif Memphis, actions VM / crons (`GAPS_OUVERTS.md`).
