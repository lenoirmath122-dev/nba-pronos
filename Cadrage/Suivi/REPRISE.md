# Reprise — NBA Pronos

> Seul fichier lu en début de session. Réécrit en entier à chaque passation, 20 lignes max.
> Mis à jour le 19/10/2026.

- **Chantier en cours : accueil jouable et pronos invités** (Phase 1A du plan
  `Cadrage/Business/plan-panier-ballon-attractivite.md`). Détail :
  `chantiers/CHANTIER_ACCUEIL_INVITES.md`. Branche `feat/accueil-pronos-invites`,
  worktree `../nba-pronos-accueil` (node_modules en lien vers le dépôt principal).
  4 commits locaux, **branche non poussée, pas de PR**, migrations non appliquées.
- **Fait** : tâche 1 (vérifications), 2 (migrations `PENDING`, préférences e-mail,
  2 fonctions SQL d'agrégats), 3 (`lib/publicHome/select.ts` testé + `query.ts`).
  Rien d'affiché : `app/(public)/page.tsx` est inchangée.
- **Prochaine étape : tâche 4** (blocs de l'accueil : match du soir, équipe, écart,
  prochains matchs, panier `localStorage` collé en bas). Commencer par panier + logique.
- **Décisions du 19/10** : `refonte-ux` mergée APRÈS ce chantier (conflit sur
  `app/(public)/page.tsx`) ; rappel du soir (1.12) à trancher avant 1B ; `PENDING`
  rouvre volontairement le « PENDING écarté (B1) » de juillet.
- **Tâche 9** : exclure `PENDING` dans la vue `user_scores` (corrige le classement
  d'un coup), puis les requêtes qui lisent `users`. Tester tôt la RLS `is_active`.
- **Reste à vérifier** : création automatique des matchs ≥ 4 jours d'avance.
- **Autres PR (état au 17/10)** : #181 (nom « Semaine N »), #179 (rappel du soir) à
  merger. Réel V2 : `Cadrage/docs/reel-v2-pack/` (dépôt principal, non commité).
- **Échéances** : 1er match saison nuit du 20 au 21/10 ; livraison 1A visée avant le
  24-25/10 ; figement hebdo 26/10 ; bêta Cup 04/12.
- **Pièges** : une branche + un worktree par PR depuis `origin/main` ; après merge
  d'une migration, `supabase migration list` ; le dépôt principal est sur une autre
  branche avec des modifs non commitées (ne pas y toucher) ; jamais de secret affiché.
