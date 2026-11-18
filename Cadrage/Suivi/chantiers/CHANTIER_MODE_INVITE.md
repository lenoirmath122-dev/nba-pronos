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
- **Ordre des lots** : A → B → D → C → E → F → G. Une seule branche `feat/mode-invite` + une PR globale (décision 18/11/2026), un commit par lot, jamais sur `main` directement.

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
- **B — `requireAuth`** : `AuthGateProvider` + `useRequireAuth(action)`, modale légère en `dynamic()`. Action en attente
  sérialisée (type, payload, URL de retour), rejouée/préremplie après connexion via `/auth/callback`. Brouillon du chat
  écrit en localStorage à chaque frappe (jamais perdu). Réutilise `registerPronos` / `requestLoginLink` (un seul chemin
  d'inscription). Actions : écrire dans le chat, pronostiquer, parier, suivre, réagir. Blocage réel côté serveur.
- **D — Liens profonds / UTM** : `/match/[id]` avec `generateMetadata` + image OG ; `/ce-soir` vers le match mis en avant
  (`lib/publicHome/focus.ts`) ; `src` / `utm_*` conservés dans les liens internes et à l'inscription.
- **C — Webview Instagram** : message « Ouvrir dans le navigateur » (consigne iOS, intent Android) à la place du bouton Google ;
  cookies de session valides en webview ; lien magique ouvert ensuite dans Safari/Chrome.
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
