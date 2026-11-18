# Chantier — mode invité intégral (visiteurs Instagram)

> **Nature** : vivant, cadrage validé le 17/11/2026, **aucun code écrit**. À ne lire que quand
> la session porte sur ce chantier. Quand un lot est livré, le retirer ici ET dans `GAPS_OUVERTS.md`.
> Prolonge `CHANTIER_ACCUEIL_INVITES.md` (accueil jouable, comptes `PENDING`, lien magique : déjà sur `main`).

## But
Le trafic vient d'Instagram (bio, stickers de story, posts). Le visiteur arrive directement dans l'appli
en invité, lit tout, et ne crée un compte qu'au moment d'agir. Les connectés ne sont pas touchés.

## Décisions (17/11/2026)
- **Accueil** : un invité tombe sur « Jouer » (liste des matchs / `/ce-soir`), pas sur l'accueil actuel.
  Valeur par défaut du drapeau `GUEST_APP_MODE` = `on` ; `off` rend l'accueil jouable actuel (comparaison A/B).
  Les connectés restent renvoyés vers `/home` depuis `/`.
- **Chat invité** : lecture du canal **Général seulement** ; ligues privées masquées.
- **Ordre des lots** : A → B → D → C → E → F → G (A, B, D, C livrés). Une seule branche `feat/mode-invite` + une PR globale (décision 18/11/2026), un commit par lot, jamais sur `main` directement.

## Déjà sur `main` (à réutiliser, ne pas refaire)
- `/` jouable sans compte, panier localStorage (`lib/publicHome/basket.ts`), `registerPronos` / `requestLoginLink` (`lib/auth/guest.ts`), comptes `PENDING`.
- `lib/auth/inAppBrowser.ts` (Instagram, Facebook, TikTok, Snapchat) ; `GoogleButton` masqué en webview.
- `/auth/callback` accepte `token_hash` + `type` (lien magique ouvert dans un autre navigateur).
- Mesure : `lib/funnel/*`, cookies `pb_vid` / `pb_utm`, Vercel Analytics, table `funnel_events`.
- Server Actions : toutes vérifient `auth.getUser()` ; RLS d'écriture exige `auth.uid()` + `is_active()`.
- `/leaderboard`, `/players` : routes hors groupes, nav adaptée à la session (patron à copier).

## Écarts à combler
`proxy.ts` (`APP_ZONE_PREFIXES`) et `app/(app)/layout.tsx` renvoient un invité vers `/login` pour
`/home`, `/play`, `/profile`, `/chat`, `/stats`. `/chat` et `/play` lisent `auth.getUser()`.
Pas de `/match/[id]`, pas de `/ce-soir`, pas de `requireAuth`, pas de bandeau, UTM non propagés.

## Lots
- **A — Lecture invité** : LIVRÉ sur `feat/mode-invite` (18/11/2026), pas encore mergé ni déployé. Routes `/matchs`, `/match/[id]`,
  `/chat-invite` (servie à un invité sur `/chat` par réécriture dans `proxy.ts`), lectures `lib/guest/query.ts` en client anonyme.
  Un connecté sur `/matchs` ou `/match/*` est renvoyé vers `/play` (à raffiner au lot D). Migration `20261118090000` : `anon` limité aux
  colonnes publiques de `users` ; **à pousser** (`supabase db push --remote`) avant la mise en prod, sinon `/chat-invite` marche mais
  `users` reste lisible en entier. Pseudo sans `@` (signup + changement). Acté : le Général est lisible par anon.
  **Reste** : renommer le compte dont le pseudo est un e-mail (id `5b39327a…`, via `request_pseudo_change` ou à la main).
- **B — `requireAuth`** : LIVRÉ sur `feat/mode-invite` (18/11/2026). `components/auth/AuthGateProvider` (+ `useRequireAuth`), modale
  `AuthGateModal` en `dynamic()` (réutilise `registerPronos` / `requestLoginLink`), `lib/auth/pendingAction.ts` (action en attente en
  localStorage, 7 jours, URL de retour interne seulement), `PendingActionReplay` sur `/bienvenue` (ramène à l'URL + `?reprise=<type>`),
  brouillon du chat `pb.chatDraft.v1` à chaque frappe. Branché sur `/chat-invite` (composeur) et `/match/[id]` (bouton « Pronostiquer »).
  **Reste** : brancher `bet`, `follow`, `react` quand ces actions existeront côté invité ; l'action rejouée n'est pas exécutée,
  seulement retrouvée (le connecté tombe sur `/play` depuis `/match/*`). Lien ouvert dans un autre navigateur : pas de reprise.
- **D — Liens profonds / UTM** : LIVRÉ en partie. `/match/[id]/opengraph-image` (texte seul), `/ce-soir` (redirige vers le prochain match,
  garde `src`/`focus`/`utm_*`). **Non fait, volontairement** : propagation des UTM dans les liens internes ; le cookie `pb_utm`
  (capté à l'arrivée) et le visiteur gardé dans les métadonnées du compte couvrent déjà l'inscription.
- **C — Webview Instagram** : LIVRÉ (modale seulement) : `OpenInBrowserNotice` (intent Chrome Android, consigne Safari iOS) à la place
  de Google. **Reste** : vérifier les cookies de session en vrai webview (recette manuelle, lot G).
- **E — Bandeau invité** : fermable, mémorisé, non masquant (bas de page), bouton « Créer un compte » -> modale du lot B.
- **F — Mesure** : événements `guest_action_attempted` (type), `auth_modal_opened`, `action_completed` ;
  migration `funnel_events` à **pousser à la main** après merge (`supabase db push --remote`).
- **G — Performance mobile** : mesurer d'abord (`next build`, JS initial de `/`, `/match/[id]`, `/chat`, Lighthouse mobile) ;
  `dynamic()` pour modale et `ChatSubscriber` ; zéro redirection ni flash pour un invité.

## Drapeau
`GUEST_APP_MODE` (variable d'environnement, lue dans `proxy.ts`). Pas d'Edge Config à ce stade.

## Risques
Migrations non déployées par un simple merge ; quota CPU Vercel (rester en client anonyme + cache) ;
deux chemins d'inscription si la modale ne réutilise pas le flux `PENDING` ; recette du chantier invités
précédent jamais faite contre un vrai Supabase (à faire avant d'empiler).

## Checklist de recette finale (à produire au lot G)
Manuel, iPhone + Android : lien en bio et sticker de story, navigateur intégré Instagram ; invité qui lit match,
classement, chat Général ; action -> modale -> lien magique ouvert dans Safari/Chrome -> retour au bon endroit,
action rejouée, texte du chat conservé ; bandeau fermé qui reste fermé ; UTM jusqu'à `funnel_events` ; drapeau `on`/`off`.
