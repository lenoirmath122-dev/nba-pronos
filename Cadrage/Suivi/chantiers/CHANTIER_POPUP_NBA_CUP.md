# Chantier : popup « Remplis ton bracket NBA Cup » (28/11/2026)

Cadré avec l'utilisateur le 28/11/2026 (session Opus). Exécution prévue sur Sonnet,
une branche + PR (jamais de commit sur main).

## But

À l'ouverture de l'appli, pendant la préparation de la NBA Cup, inviter à remplir
le bracket. Fin automatique à la date limite (coup d'envoi du 1er quart, 04/12).

## Règles tranchées

| Sujet | Décision |
|---|---|
| Cible | Connectés **dont le bracket n'est pas complet** + visiteurs (accueil public `/` et appli invité) |
| Période | Dès que le bracket est remplissable (compétition `NBA_CUP` active, séries des quarts avec 2 équipes connues, `bracket_deadline` dans le futur) jusqu'à `bracket_deadline`. Aucun interrupteur admin. |
| Fréquence | À **chaque ouverture** de l'appli (pas à chaque navigation interne) |
| « Me rappeler plus tard » | Masque jusqu'à **demain minuit, heure de Paris** |
| Croix / clic à côté / Échap | Masque pour **cette visite** seulement (sessionStorage) |
| Disparition | Dès que le bracket est complet (connecté), ou une fois la date limite passée |
| Ordre des popups | « Pari validé » → guide d'arrivée (`OnboardingGuide`) → **NBA Cup** → popup hebdo → récap → badges (guide avant NBA Cup : choix de l'utilisateur, 28/11/2026) |
| État « vu » | Client uniquement (localStorage + sessionStorage), **aucune migration** |

## Contenu

- Visuel NBA Cup en tête (trophée ou mini-bracket ; SVG/CSS maison, pas de logo officiel NBA).
- Titre + compte à rebours jusqu'à la date limite (réutiliser `components/ui/Countdown.tsx` si adapté).
- Lots : « deux cartes cadeaux » au classement, **sans montant** (décision de l'utilisateur,
  28/11/2026) + lien `/reglement-nba-cup`, qui seul donne le montant.
- Avancement si bracket commencé : « 3/7 séries remplies, termine-le ».
- Boutons : connecté → « Remplir mon bracket » (`/bracket`) ; visiteur → « Créer mon compte » (`/signup`).
  Second bouton : « Me rappeler plus tard ».

## Visiteur → inscription

Pas de redirection après inscription à construire (le parcours signup → mail →
`/choisir-pseudo` n'a aucun paramètre de retour). Une fois connecté, le joueur a
un bracket vide : la popup réapparaît d'elle-même avec « Remplir mon bracket ».
Les clés de masquage visiteur ne doivent donc **pas** suivre le joueur une fois
connecté (clés distinctes invité / connecté).

## Fichiers (prévision)

- `lib/queries/nbaCupPopup.ts` (nouveau) : état de la popup pour l'utilisateur courant
  `{ open: boolean, deadline, filled, total }` (requête légère, pas `getBracket` complet).
  Visiteur : seulement la période et la date limite.
- `lib/actions/nba-cup-popup.ts` (nouveau) : action serveur lue par le watcher après le montage (même cycle que `WeeklyPopupWatcher` : délai ~800 ms).
- `components/nbaCupPopup/NbaCupPopupWatcher.tsx` + `.module.css` (nouveaux), sur la coquille `components/ui/ModalDialog.tsx`.
- `components/weeklyPopup/WeeklyPopupProvider.tsx` : ajouter un état « popup NBA Cup ouverte » ; `WeeklyPopupWatcher` attend qu'elle soit fermée (même mécanique que récap/badges).
- `app/(app)/layout.tsx` : monter le watcher dans les deux branches (connecté et invité ; la branche invité n'a pas de `WeeklyPopupProvider`).
- `app/(public)/page.tsx` : monter le watcher version visiteur.
- Coupe-circuit e2e : clé localStorage `nba-cup-popup:disabled`, posée dans `e2e/fixtures.ts` comme pour la popup hebdo et les badges.

## Étapes

1. Requête + action serveur + tests unitaires (période, complet/incomplet, visiteur).
2. Logique de masquage côté client (fonction pure testée : session, « demain Paris », clés invité/connecté).
3. Composant + visuel + styles (thèmes clair/sombre).
4. Branchement dans la file des popups + layouts + accueil public.
5. Coupe-circuit e2e. Vérification dans le navigateur (local) : visiteur, connecté bracket vide, partiel, complet, « plus tard », croix.

## Risques

- **Fenêtre courte** (bracket ouvert ~28/11 → 04/12) : livrer vite ; si mergé après le 04/12, la popup ne s'affiche simplement jamais (aucun dégât).
- **Tests en prod** : ne pas « tester » en remplissant un vrai bracket ; vérifier en local (Docker/Supabase local seulement avec l'accord de l'utilisateur).
- Accueil public : ne pas masquer le contenu SEO au premier rendu (popup montée côté client après délai).

## Critère de fin

PR ouverte, tests unitaires verts, vérifiée en local sur les 6 cas de l'étape 5,
mergée par l'utilisateur avant le 04/12.

## Exécution (28/11/2026, session Sonnet)

- Route réelle du bracket : `/play/bracket` (pas `/bracket`).
- `proxy.ts` redirige toujours `/` (invité → `/play`, connecté → `/home`) : la popup
  montée sur l'accueil public n'y est donc jamais vue aujourd'hui ; le visiteur la voit
  dans l'appli invité.
- Montant des cartes cadeaux déplacé dans `lib/competitions/nbaCupPrize.ts`
  (`NBA_CUP_GIFT_CARD_EUR`), lu par le règlement seulement (la popup n'affiche pas de montant).
- Vérifié en local avec état simulé (base de prod en lecture, aucun compte connecté) :
  visiteur, bracket vide, partiel, complet, « plus tard », croix/Échap, ordre guide → NBA Cup.
  Non vérifié dans le navigateur : la coquille connectée réelle (pas de compte de test
  sans Supabase local).
- `bracket_deadline` est NULL tant qu'aucun match n'est rattaché (synchro à J-4) : la popup
  prend alors comme date limite de repli le début, heure de New York, du 1er jour de la
  fenêtre des quarts (`CUP_ROUND_NY_WINDOWS`, `lib/competitions/cupWindows.ts`).
