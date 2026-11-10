# Reprise — NBA Pronos (10/11/2026, passation 27)
- **Bouton admin « Import des box scores »** — PR #284 mergée. Page `/admin/stats-import` (Admin > Système) : action serveur
  `lib/actions/admin-stats-import.ts` -> API GitHub `workflow_dispatch` de `run-stats-import-vm.yml` sur `main`
  (WIF de la VM limité à `main`). Composant `components/admin/StatsImportButton.tsx`. Journal admin : `TRIGGER_STATS_IMPORT`.
- **À FAIRE PAR L'UTILISATEUR (sinon le bouton affiche « non configuré »)** : jeton GitHub fine-grained (dépôt nba-pronos,
  Actions : Read and write, durée limitée -> noter l'expiration), ajouté dans Vercel (Production) sous `GITHUB_DISPATCH_TOKEN`,
  puis redéployer la prod. Ensuite tester le bouton et vérifier le run dans l'onglet Actions. Pas testé en réel.
- **Chat #283 mergé** (réacteurs, pseudo cliquable, mentions @). Prochaine étape possible : push dédié à la personne taguée
  (`lib/push/notifyChatMessage.ts`, même en sourdine), pas tranché.
- **Quota Vercel « Fluid Active CPU »** : #276-#279 mergés le 05/11. Noter la valeur avant/après ; décider d'allonger les
  durées de cache ou de cacher résultats terminés + séries du bracket.
- **Aide aux débutants** : #274 à merger ; captures du réel (Docker + Supabase local : **demander avant**).
- **Pièges** : fichiers en CRLF ; `tsc`/`eslint` : erreurs connues dans `Cadrage/docs/reel*` ; une branche par PR ; ne jamais
  lancer l'import pendant le timer VM de 12h/16h Paris.
- **Ouvert, hérité** : 983 `stats_box_scores.pf` vides ; pari Memphis `f4f3ebd6…` à rejouer (coût IA, demander) ; poller VM
  (dryRun -> réel) ; probas instables. **Échéances** : bêta Cup 04/12.
