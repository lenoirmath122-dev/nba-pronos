# Chantier — invité dans la vraie appli (/play ouvert)

> Remplace `CHANTIER_MODE_INVITE.md` (lots A à G, abandonnés le 18/11/2026). Plan écrit le 18/11/2026.
> Branche unique `feat/invite-play` (partie de `main`), un commit par lot, une PR. Jamais sur `main`.

## But
Un visiteur (souvent venu d'Instagram) ouvre la VRAIE appli : `/play`, même navigation que les joueurs.
Il lit tout ; le compte n'est demandé qu'au moment d'agir (pronostiquer, parier, écrire dans le chat).
`/` : invité -> `/play`, connecté -> `/home`. Chat Général en lecture. `/home` et `/profile` restent derrière le compte.

## Ce qu'on sait déjà (vérifié le 18/11)
- `proxy.ts` : `APP_ZONE_PREFIXES = ["/home", "/play", "/profile"]` -> `/login` sans session ; `AUTH_PAGES` (`/`, `/login`, `/signup`)
  renvoie un connecté vers `/play` (à passer à `/home` pour `/` seulement).
- `app/(app)/layout.tsx` : `redirect("/login")` sans user, puis profil (service client), `getNavBadgeData`, `getRecentAdminValidatedBets`,
  watchers (popups, badges, onboarding). Couvre `/home`, `/play`, `/profile`, `/chat`, `/stats`.
- `lib/queries/play.ts` : `getPlayUpcoming` (l.371) et la requête Résultats (l.1055) font `if (!user) return null`.
- RLS : `teams`, `competitions`, `matches` lisibles par tous ; `match_predictions_select` / `bets_select` sans restriction de rôle
  (anon voit les pronos verrouillés et les paris publics, comme un joueur qui n'a pas pronostiqué) ; `chat_messages_select`
  laisse lire `GLOBAL` à anon. `users` : anon limité aux colonnes publiques (migration `20261118090000`, en prod, à GARDER).
- Server Actions : toutes vérifient `auth.getUser()` ; écriture RLS = `auth.uid()` + `is_active()`. Ouvrir la lecture n'ouvre aucune écriture.

## Lot 1 — Supprimer le code A-G inutile
Supprimer : `app/matchs/`, `app/match/` (page + opengraph-image), `app/ce-soir/`, `app/chat-invite/`, `components/guest/` (tout),
`components/nav/PublicShell.tsx`, `lib/guest/query.ts` ; dans `proxy.ts` : `GUEST_ONLY_PREFIXES`, `GUEST_CHAT_*` et leurs blocs ;
dans `scripts/check-static-routes.mjs` : lignes `/matchs` et `/chat-invite`.
**Garder** (réutilisé au lot 3) : `components/auth/AuthGateProvider.tsx`, `AuthGateModal.*`, `OpenInBrowserNotice.tsx`,
`PendingActionReplay.tsx` (+ son appel dans `app/bienvenue/page.tsx`), `lib/auth/pendingAction.*`, événements funnel
(`lib/funnel/*`, migration `20261118120000` gardée : déjà en prod, servira à mesurer), règles de pseudo (`lib/pseudo/rules.*`),
ajouts `lib/auth/inAppBrowser.*`. Retirer de `AuthGateProvider` le rendu de `GuestBanner` (supprimé).
Fin du lot : `npx tsc --noEmit`, `npm run lint`, tests unitaires verts ; `grep -r "guest/" app components lib` vide.

## Lot 2 — Ouvrir `/play` et `/chat` aux invités (lecture)
1. `proxy.ts` : retirer `/play` de `APP_ZONE_PREFIXES` (garder `/home`, `/profile`, ajouter `/stats` si utile — il redirige vers `/profile`).
   `/` sans session -> redirection vers `/play` ; `/` avec session -> `/home` ; `/login`, `/signup` avec session -> `/play` (inchangé).
   Le court-circuit sans cookie (économie CPU) reste en place.
2. `app/(app)/layout.tsx` : sans user, NE PLUS rediriger ; rendre la coquille invité : `TabBar` en variante invité (pas de pastilles,
   pas de tiroir de réglages), pas de profil/thème serveur (thème par défaut / cookie `pb-theme`), aucun watcher
   (ValidatedBets, WeeklyPopup, ActivityRecap, NewBadges, OnboardingGuide), mais `AuthGateProvider` autour du contenu.
   Défense en profondeur : `app/(app)/home/layout.tsx` et `app/(app)/profile/layout.tsx` (à créer) font `redirect("/login")` sans user.
3. `lib/queries/play.ts` : `getPlayUpcoming` et Résultats acceptent `user = null` -> pas de pronos/paris personnels, `quotas` vides,
   `readyCount = 0`. Ne pas dupliquer les requêtes : passer `userId: string | null` aux fonctions internes et sauter les lectures « mes… ».
   `getRowShowcases` : vérifier qu'il lit avec un client que la RLS laisse passer en anon.
4. Composants `/play` : en invité, masquer « Tout valider » (`ValidateAllBanner`) et les états « mon prono » ; tout bouton d'écriture
   (enregistrer/valider un prono, nouveau pari, bracket, correction) appelle `useRequireAuth()` (type `predict` / `bet`) au lieu de l'action.
   `/play/bets/new`, `/play/bets/[id]/edit` : sans user -> `redirect("/play")` (ou modale), jamais d'écran cassé. `/play/bracket` : lecture si
   la page tient sans user, sinon modale depuis `BracketEntry`.
5. `app/(app)/chat/page.tsx` : sans user, lire le canal Général seulement (ligues masquées), pas de `ChatSubscriber` temps réel si coûteux,
   composeur remplacé par un bouton « Écrire » -> `useRequireAuth("chat")` (le brouillon `pb.chatDraft.v1` existe déjà).
6. `TabBar` invité : onglets Jouer, Chat, Classement (`/leaderboard`, déjà public) ; Accueil/Profil -> modale de compte.
Fin du lot : en navigation privée, `/` -> `/play`, lecture des matchs, Résultats, Chat Général ; `/home` et `/profile` -> `/login` ;
connecté : rien ne change (vérifier `/play`, `/home`, popups). `check-static-routes` : `/play` doit rester dynamique.

## Lot 3 — Compte au moment d'agir + reprise
- `useRequireAuth` branché sur toutes les écritures du lot 2 ; la modale réutilise `registerPronos` / `requestLoginLink` (flux `PENDING`).
- Action en attente : retour sur l'URL d'origine (`/play?reprise=predict`, `/chat?reprise=chat`), via `PendingActionReplay` sur `/bienvenue`.
  Rejouer = ramener au bon endroit (et restaurer le brouillon du chat), pas exécuter l'action à la place du joueur.
- Funnel : `guest_action_attempted` + `auth_modal_opened` à l'ouverture, `action_completed` à la reprise (déjà codés, à rebrancher).
- `/` (accueil jouable avec panier `lib/publicHome/*`) n'est plus servi aux invités : NE PAS le supprimer dans ce chantier
  (décision à prendre après mesure) ; noter dans `GAPS_OUVERTS.md`.

## Risques
- **Quota CPU Vercel** : chaque visite invitée rend `/play` dynamiquement (avant : `/` statique, revalidate 60). Mesurer après déploiement ;
  si besoin, mettre en cache les lectures publiques (`unstable_cache`/`"use cache"` selon la doc Next 16 de `node_modules/next/dist/docs/`).
- **Fuite entre comptes** : `/play` lit la session -> doit rester dynamique (ne jamais l'ajouter à l'allowlist statique).
- **SEO** : `/` devient une redirection ; vérifier `app/sitemap.ts` et les balises de `/play` (titre, description, OG).
- **Fonctions SQL appelées par la RLS** (`match_is_locked`, `has_committed_prediction`, `bet_is_public`) : vérifier qu'anon peut les exécuter
  (sinon erreurs de lecture silencieuses = listes vides).
- **Layout partagé** : un oubli de garde sur `/home` ou `/profile` afficherait des écrans vides, pas de données (RLS), mais à tester.
- Fichiers en CRLF : éditer via script Python UTF-8. Build local : déplacer `Cadrage/docs/reel-v2-pack` le temps du build.
- Aucune migration prévue. Tests e2e / Supabase local : demander avant.

## Critère de fin
PR `feat/invite-play` ouverte, CI verte, lots 1 à 3 en 3 commits ; recette manuelle décrite dans la PR (navigation privée desktop +
mobile, webview Instagram si possible) ; `CHANTIER_MODE_INVITE.md` supprimé ; `REPRISE.md` / `GAPS_OUVERTS.md` à jour à la passation.
