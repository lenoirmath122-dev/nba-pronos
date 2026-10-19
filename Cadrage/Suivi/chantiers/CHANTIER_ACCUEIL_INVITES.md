# Chantier — accueil jouable et pronos invités (Phase 1 du plan d'attractivité)

> **Nature** : vivant. Plan complet : `Cadrage/Business/plan-panier-ballon-attractivite.md`
> (v2, 19/10/2026). **À ne lire que quand la session porte sur ce chantier.**
> Quand un point est traité, le retirer ici ET dans `GAPS_OUVERTS.md`.

- **Décisions du 19/10/2026** : on démarre par 1A (accueil + pronos invités +
  inscription email/Google), puis 1B (emails). `refonte-ux` est mergée **après**
  ce chantier (conflit attendu sur `app/(public)/page.tsx`). Le rappel du soir
  coché ou non par défaut (plan 1.12) se tranche avant 1B.
- **Branche / worktree** : `feat/accueil-pronos-invites`, `../nba-pronos-accueil`.
- **Tâche 1 faite (vérifications)** :
  - code d'entrée : facultatif à l'inscription (`lib/auth/actions.ts:96`), sans code
    rattachement à la compétition `ACTIVE`. Rien à supprimer. Le flux actuel exige un
    mot de passe : à reprendre pour le parcours invité ;
  - filtres joueurs : l'existant n'exclut **pas** les `DISABLED` (affichés avec
    `isInactive` : `leaderboard.ts`, `player-profile.ts`, `players-directory.ts`,
    `weeklyLeaderboard.ts`). `PENDING` doit être exclu complètement : un filtre par
    requête, plus snapshots, chat, agrégats. Tâche 9 réestimée à 1 j ;
  - RLS : `is_active` (`rls.sql:51`) ne reconnaît que `ACTIVE`, un compte `PENDING`
    risque d'être bloqué sur ses propres lectures : à tester avant la Server Action.
  - **Reste à vérifier** : automatisation des matchs (≥ 4 jours d'avance).
- **Ordre** : migration (t2) → requêtes et blocs de l'accueil (t3-4) → Server Action
  et callback (t5-6) → Google, mot de passe, filtres, états, funnel (t7-11).
