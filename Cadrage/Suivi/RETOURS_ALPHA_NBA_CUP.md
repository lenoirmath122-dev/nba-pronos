# Retours de l'alpha NBA Cup — confrontés à l'avancement

> **Nature** : figé, 03/10/2026. Transcription des retours joueurs de
> l'alpha NBA Cup fictive (20/09 → ~24/09/2026), source :
> [`RETOURS_ALPHA_NBA_CUP.pdf`](RETOURS_ALPHA_NBA_CUP.pdf) (rédigé par
> l'utilisateur), mise en regard de l'état réel du code et de la feuille de
> route au 03/10/2026. Les points restant à traiter vivent dans
> `GAPS_OUVERTS.md` (section « Retours de l'alpha ») et, une fois priorisés,
> dans la Phase 3 de la feuille de route — pas ici.

## Retour principal

**« On n'a pas les notifications, donc on ne pense pas à parier. »**

Existant : Web Push (VAPID) livré — rappels de deadline bracket/matchs
(`reminder-bracket.yml`, `reminder-matches.yml`) et notifications de chat,
abonnement opt-in depuis le Profil
(`components/profile/NotificationSettings.tsx`).

**Précision de l'utilisateur (03/10/2026)** : les notifications
fonctionnent, mais seulement quand l'app a été ouverte récemment. App
fermée depuis un moment = plus rien. Ce n'est donc pas un problème
d'activation.

Lecture technique, **pas encore vérifiée** :
- Le service worker (`public/sw.js`) affiche bien la notification dans son
  gestionnaire `push`. C'est le schéma qui doit fonctionner app fermée,
  aucun défaut visible de ce côté.
- `lib/push/send.ts` appelle `webpush.sendNotification()` sans options,
  donc avec l'urgence par défaut `normal` (TTL 4 semaines). Le symptôme
  colle aux politiques d'économie d'énergie : Doze sur Android, gestion
  opportuniste des push non urgents par Apple. Ces push sont retardés ou
  regroupés tant que l'appareil n'est pas « réveillé ». Piste peu coûteuse
  à tester : `urgency: "high"` sur les rappels de deadline (pas sur le
  chat).
- L'empaquetage natif (p8-4) ne réglerait pas ça automatiquement : il est
  prévu pour avril 2027, donc après la vraie Cup, et une app native
  passerait par FCM/APNs avec les mêmes notions de priorité. Il vaut mieux
  traiter le problème sur la PWA avant la Cup.

Feuille de route : rien ne couvre l'activation elle-même. Voisins :
p5-4 (centre de notifications in-app), p6-12 (notifications journalières
programmées), p6-5 (notification « bien joué »).

## UI/UX — tableau de correspondance

Légende : **Nouveau** = absent du code et de la feuille de route ;
**Partiel** = existe en partie ; **Déjà prévu** = item existant de la
feuille de route (souvent reporté, donc à réactiver).

| # | Retour | État au 03/10/2026 | Statut |
|---|---|---|---|
| 1 | Feedback sur les actions, surtout la soumission d'un pari : voir que ça charge pendant l'analyse, puis une confirmation à l'enregistrement | Spinner de soumission de pari livré (p0-19). Popup de validation du prono corrigée (PR #95). Pas de confirmation explicite « pari enregistré » ni d'animation de succès. | Partiel |
| 2 | Récap journalier (payant plus tard) | p6-12 (notifications journalières), p6-3 (popup de connexion, reporté). | Déjà prévu (reporté) |
| 3 | Récap hebdo gratuit, général, payant plus tard en mode ligue | Rien. Voisin : p6-1 (mécanique hebdo, reporté). À articuler avec la Phase 7 (bascule payante). | Nouveau |
| 4 | Récap des matchs : lien vers un média/des articles pour débriefer les matchs de la veille | Rien. | Nouveau |
| 5 | Bandeau récap du prono « BOS +3 » : moins rond, plus « arena », plus dans l'univers de l'app | `components/play/PredictionSummary.tsx`. S'inscrit dans le fil « carte pronostic » laissé ouvert après les PR #89/#92/#93. | Nouveau |
| 6a | Pastilles sur les conversations avec des messages non lus | Aucune notion de « non lu » dans le chat (ni en base ni côté client). Les pastilles de nav Tier 1/2 (15/09) ne couvrent pas le chat. | Nouveau |
| 6b | Pastille sur le bracket dans l'onglet Jouer (actions à faire / avancées à voir) | Le compteur de l'onglet Jouer inclut déjà le bracket (Tier 1), mais aucune pastille sur l'entrée Bracket à l'intérieur de Jouer. | Partiel |
| 7 | Bracket : garder seulement l'arbre visuel, supprimer la vue en cartes | `BracketFillView.tsx` bascule entre flux normal (cartes par tour) et poster (`FillPosterView.tsx`). | Nouveau (petit) |
| 8 | Classement : indiquer de tourner le téléphone ou de toucher une ligne pour le détail | Rien. | Nouveau (petit) |
| 9 | Badges : popup à l'ouverture quand un badge a été gagné depuis la dernière visite ; retravailler le design des badges | p6-18 (notification de déblocage), p6-3, p6-20/p6-21 (visuels/rendu) — tous reportés. | Déjà prévu (reporté) |
| 10 | Profil : photo de profil + avatars au choix | p6-22, reporté (bucket Storage, format/recadrage non tranchés). Les avatars prédéfinis sont une option plus simple que l'upload. | Déjà prévu (reporté) |
| 11 | Landing page du site | p5-2 (`/` redirige toujours vers `/login`). | Déjà prévu |
| 12 | Résultats : le bloc « paris des autres joueurs, etc. » prend trop de place → un seul bouton qui ouvre une popup | `LockedRow.tsx` affiche `RevealPanelLocked` en ligne + `OtherBetsModal` en popup. À fusionner derrière un bouton unique. | Nouveau |
| 13 | Animations/validation des actions : bracket, pronos, paris, paris série sur le bracket | Rien de systématique. Recoupe le #1. | Nouveau |
| 14 | Fermer une popup en touchant à côté, pas seulement la croix | Confirmé absent : le fond de `components/ui/ModalDialog.tsx` n'a pas de gestionnaire de clic. Vérifier aussi les popups qui n'utilisent pas `ModalDialog` (ex. `OtherBetsModal.tsx`, portail maison). | Nouveau (petit) |
| 15 | Paris réussis dans Résultats : afficher le détail (% et points possibles) | Rien côté Résultats. | Nouveau |

## Autres

| # | Retour | État au 03/10/2026 | Statut |
|---|---|---|---|
| 16 | Entraîner de nouveaux modèles pour couvrir (presque) toutes les possibilités de pari, car choisir sa difficulté n'est pas intuitif | Plusieurs types encore non calculables : p1-26 (LF sur fautes), p6-32 à p6-36, PK-1/PK-2 (calibration). Le retour porte aussi sur l'UX : le joueur ne sait pas quoi tenter pour viser une difficulté. Deux chantiers distincts, couverture ML et aide au choix (suggestions ?). | Partiel |

## Lecture d'ensemble

- **Sur 16 retours, 9 sont neufs, 3 partiels, 4 déjà dans la feuille de
  route** (dont 3 reportés explicitement : les alpha-testeurs demandent
  justement des items mis en pause, ce qui est un argument pour les
  réactiver).
- **Petits gains rapides**, faisables en une session groupée : #7, #8,
  #14, et probablement #6b.
- **Plus gros chantiers** : notifications (activation, puis récaps), chat
  non lu (#6a, demande un état de lecture), feedback/animations des
  actions (#1 + #13), refonte de Résultats (#12 + #15), modèles ML (#16).
- **Calendrier** : la vraie NBA Cup (Phase 4) arrive vers fin octobre.
  Le retour principal (notifications) est le seul qui conditionne
  directement l'engagement pendant la Cup, donc le premier candidat, à
  traiter sur la PWA plutôt qu'en attendant le natif (voir plus haut).
