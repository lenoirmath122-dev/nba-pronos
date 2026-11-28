# Chantier : bracket NBA Cup rempli en invité, compte demandé à la validation (28/11/2026)

Suite de la popup NBA Cup (PR #324, `CHANTIER_POPUP_NBA_CUP.md`). Cadré avec l'utilisateur le 28/11/2026.
**2e PR séparée** : #324 se merge telle quelle (bouton visiteur « Créer mon compte ») ; cette PR remplace
le bouton par « Remplir mon bracket ». Échéance : avant le 04/12 (date limite du bracket).

**État (28/11/2026)** : implémenté sur `claude/bracket-invite` (PR #325). Décisions de l'utilisateur :
- Funnel : `bracket` est enregistré comme `predict` dans `funnel_events`, donc pas de migration
  (`funnelActionType`, `lib/auth/pendingAction.ts`). La reprise reste typée `bracket`.
- Compte qui a déjà des choix en base : on garde ce bracket et on efface le brouillon du navigateur.
  Un message le dit au joueur. Pas de bouton « Remplacer ».

## Parcours voulu

1. Visiteur → popup → « Remplir mon bracket » → `/play/bracket` en mode invité (plus de renvoi vers /play).
2. Il remplit l'arbre comme un connecté ; ses choix sont gardés **dans le navigateur** (localStorage), rien en base.
3. « Valider mon bracket » → modale de compte existante (`useRequireAuth`, `AuthGateModal`) avec une action en attente.
4. Après création du compte (retour sur `/bienvenue` → `PendingActionReplay`) : les choix sont **enregistrés
   automatiquement** dans son bracket (`saveBracketPick` pour chacun), puis il revient sur `/play/bracket` rempli.
   **Il lui reste à cliquer « Valider »** : jamais de `validateBracket` automatique.
5. Brouillon effacé du navigateur une fois enregistré.

## Existant à réutiliser (vérifié dans le code)

- `lib/auth/pendingAction.ts` : action en attente en localStorage (`pb.pendingAction.v1`), `returnUrl` sûr,
  expiration 7 j ; types `chat|predict|bet|follow|react` → ajouter `bracket`. Modèle du brouillon : `pb.chatDraft.v1`.
- `components/auth/PendingActionReplay.tsx` : sur `/bienvenue`, ramène à `returnUrl`. Principe du chantier invité :
  « ramener au bon endroit, pas exécuter l'action à la place du joueur ». Ici, l'enregistrement des choix est une
  exception **voulue par l'utilisateur** (pas la validation).
- Connecté : `saveBracketPick({ seriesId, winnerTeamId, scoreFormat })` à chaque tap, `validateBracket()` à la fin
  (`lib/actions/bracket-fill.ts`), UI dans `components/bracket-fill/FillPosterView.tsx` / `BracketFillView.tsx`.
- `app/(app)/play/bracket/page.tsx` : `redirectGuestToPlay()` à retirer pour la NBA Cup ; `getBracketFillData`
  (`lib/queries/bracket-fill.ts:185`) renvoie `emptyData()` sans user → à faire tourner sans user (structure,
  équipes, cascade des candidats ; pas de pick serveur). Vérifier que la RLS laisse anon lire ce qu'il faut.

## Étapes

1. `getBracketFillData` sans user + page `/play/bracket` ouverte aux invités (NBA Cup seulement ; playoffs : inchangé, à moins que ce soit gratuit).
2. Mode invité de l'arbre : un « magasin » de choix local (localStorage, clé versionnée par `competitionId`) à la place des appels serveur ; même cascade (un choix amont change → les choix aval incompatibles tombent, comme côté serveur).
3. « Valider » en invité → `useRequireAuth("bracket")` avec `returnUrl: "/play/bracket?reprise=bracket"`.
4. Reprise : sur `/play/bracket?reprise=bracket` connecté, lire le brouillon, enregistrer les choix **dans l'ordre des tours** (quarts → demies → finale, sinon la cascade serveur refuse), afficher un retour (« Tes choix sont enregistrés, valide ton bracket »), effacer le brouillon. Si le joueur a déjà des choix en base : ne pas écraser sans demander (cas rare ; afficher un choix simple ou garder la base, à proposer à l'utilisateur).
5. Popup : bouton visiteur « Remplir mon bracket » → `/play/bracket` ; texte visiteur ajusté (« crée ton compte à la validation »).
6. Funnel : `guest_action_attempted` / `auth_modal_opened` / `action_completed` avec le type `bracket`.
7. Tests unitaires (magasin local + cascade, ordre d'enregistrement, parse du brouillon) ; vérification navigateur sur la preview (visiteur : remplir, valider → modale).

## Risques

- **Lien de confirmation ouvert dans un autre navigateur** (mail ouvert hors de la webview Instagram, par ex.) :
  le brouillon reste dans le premier navigateur → le joueur arrive sans ses choix. Limite déjà acceptée pour le chat ;
  la signaler dans la PR. Google sign-in : même navigateur, pas de souci.
- **Date limite passée entre le remplissage et l'inscription** : l'enregistrement est refusé → message clair, brouillon effacé.
- **Fuite entre comptes** sur un appareil partagé : effacer le brouillon après enregistrement ou refus ; clé par compétition.
- Ne pas tester l'inscription en prod avec un vrai compte sans accord ; e2e / Supabase local : demander avant.

## Critère de fin

PR ouverte (base : `main` une fois #324 mergée), tests verts, parcours visiteur vérifié sur la preview jusqu'à la
modale de compte ; reprise après inscription vérifiée au moins par tests unitaires, et en vrai si l'utilisateur fournit un compte de test.
