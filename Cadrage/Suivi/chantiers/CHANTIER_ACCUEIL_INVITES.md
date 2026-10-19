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
- **Tâches 5 à 8 faites** (rien testé contre un vrai Supabase) :
  - t5 : `/enregistrer` + Server Action `registerPronos` (`lib/auth/guest.ts`) : le compte est
    créé par `auth.admin.createUser` (e-mail non confirmé, métadonnée `pending_validation`),
    pronos insérés avec le client privilégié (`buildPredictionRows`, `competition_id` pris en
    base), puis lien envoyé par `signInWithOtp`. E-mail déjà inscrit : même écran, lien de
    connexion, panier gardé dans le navigateur. Le panier local n'est vidé que par `/bienvenue`.
  - t6 : `app/auth/callback/route.ts` (`token_hash`+`type`, ou `code`), `PENDING` -> `ACTIVE`
    si l'âge est déclaré, sinon `/choisir-pseudo`. `/bienvenue` : liste des pronos, préférences
    e-mail, « Je préfère en push » (app installée seulement), enregistrement du panier restant.
    `(app)/layout.tsx` renvoie un compte `PENDING` finir son inscription.
  - t7 : `GoogleButton` (masqué dans Instagram/Facebook), `/choisir-pseudo`, bouton aussi sur
    `/signup` et `/login`. Migration `...090200` : `handle_new_user` crée un profil `PENDING`
    au pseudo provisoire pour un retour Google.
  - t8 : `/login` à trois options (lien par défaut, e-mail + mot de passe, Google),
    `PasswordSection` dans le profil. Les 2 specs e2e de connexion cliquent d'abord
    « Email + mot de passe » (non rejouées).
- **À faire avant de tester** : appliquer les 3 migrations ; activer le fournisseur Google
  (Supabase + Google Cloud) ; **modèle d'e-mail Supabase** « Magic Link » et « Confirm signup » :
  lien `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email` (sans cela le lien
  ouvert dans un autre navigateur échoue) ; ajouter `/auth/callback` aux URLs de redirection
  autorisées. Vérifier qu'un utilisateur créé non confirmé peut recevoir un lien `signInWithOtp`.
- **Reste du chantier** : t9 (filtrage `ACTIVE` partout + nettoyage 7 jours), t10 (états, ménage
  de la page, blocs 6-9), t11 (funnel + recette). Piste t9 : la vue `user_scores`.
