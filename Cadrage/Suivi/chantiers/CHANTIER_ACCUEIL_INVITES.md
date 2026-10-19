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
- **Tâche 2 faite** (migrations non poussées) : `PENDING` rouvre volontairement la
  décision de juillet 2026 (« PENDING écarté », B1, sans motif écrit), parce que le
  parcours invité en a besoin. Préférences e-mail ajoutées ; rappel du soir décoché
  par défaut tant que 1.12 n'est pas tranché.
- **Tâche 3 faite** : `lib/publicHome/select.ts` (logique pure, testée) et
  `lib/publicHome/query.ts` (client anonyme sans cookie, donc `revalidate = 60`
  possible). Une seule compétition `ACTIVE` à la fois : « toutes les compétitions
  `DAILY_MATCH` » du plan se réduit à celle-là. Le filtre de publication des jours
  (`hiddenSeriesFilter`) est appliqué. Deux fonctions SQL ajoutées à la migration
  `...090100` : totaux de pronos et stats du dernier résultat.
- **Piste pour la tâche 9** : la vue `user_scores` (CTE `participants`) est la source du
  classement et ne filtre pas le statut. Ajouter l'exclusion de `PENDING` **dans la
  vue** corrige d'un coup tout ce qui la lit ; il restera les requêtes qui lisent
  `users` directement (annuaire, profil, chat, snapshots).
- **Tâche 4 faite** (non vérifiée à l'écran) : `components/publicHome/HomePlay.tsx`
  (blocs 2 à 5, preuve sociale dans la carte après le choix), `lib/publicHome/basket.ts`
  (panier localStorage, logique pure testée) et `labels.ts` (surtitre, compte à rebours).
  La page garde en dessous les anciens blocs (cartes, étapes) : ménage en tâche 10.
  Le bouton « Enregistrer » pointe sur `/signup` en attendant l'écran ② (tâche 5).
  Pas de vérification visuelle : il faut un Supabase avec matchs `DAILY_MATCH`.
