# NBA Pronos — Préparation spec technique V1 (réponses aux points ouverts)

> **Nature** : ce document consigne les RÉPONSES tranchées avec l'utilisateur
> lors de la session d'état des lieux pré-spec-technique du 17/07/2026, aux
> points déjà identifiés comme :
> - **Bloc A** — « renvoyés à la spec technique » (`nba_pronos_SPEC_FONCTIONNELLE_V0_2.md` §14.1) ;
> - **Bloc B** — « non bloquants / itération future » (`nba_pronos_SPEC_FONCTIONNELLE_V0_2.md` §14.2, points communs au proto et à la V1 uniquement) ;
> - **Bloc C** — « reporté explicitement en V1 », qui vivaient jusqu'ici dans
>   `GAPS_OUVERTS.md` (retirés de ce fichier une fois consignés ici — voir
>   `JOURNAL_SESSIONS.md` pour la trace de la session).
>
> **Ne modifie ni ne rouvre le cadrage fonctionnel** : `SPEC_FONCTIONNELLE_V0_2.md`
> et `SYNTHESE_CLAUDE_PROJECT_1_3.md` restent **clos**, inchangés. Ce sont des
> réponses à des QUESTIONS TECHNIQUES déjà posées, pas de nouvelles règles
> produit.
>
> **Statut** : validé avec l'utilisateur, sauf mention contraire explicite
> (voir C5 — RLS, seul point laissé entièrement ouvert).
>
> À consommer en tout début de la spec technique V1, avant d'écrire du code.

---

## Bloc A — Renvoyés à la spec technique (§14.1)

### A1 — Arrondi/affichage des sous-totaux par source

Constat : tout le barème (Playoffs + NBA Cup) est en valeurs entières, aucun
arrondi n'est jamais nécessaire. Convention d'affichage retenue, généralisée
aux 3 sources (Matchs, Bracket, Paris) :

```text
- Aucune participation à cette source → afficher "-"
- A participé mais 0 point gagné       → afficher "0"
```

### A2 — Scoring d'une série annulée/neutralisée

```text
Sur la série elle-même : neutralisée, 0 point pour tous les joueurs
(vainqueur/score exact/affiche) — cohérent avec la règle déjà validée
"annulé = neutralisé, 0 pour tous, jamais de pénalité".

Sur la suite du bracket (tours dépendants) : neutralisation en cascade sur
les composantes concernées, jusqu'à décision admin MANUELLE et JOURNALISÉE
sur la façon dont la compétition continue (ex. désigner une équipe qui
"avance").
```

Confirmé par l'utilisateur.

### A3 — Bonus affiche : paire d'équipes vs position de slot

```text
Confirmé : il faut la paire ET le bon slot. Mais comme le bracket est
advancement-based sans reseeding, une paire donnée ne peut structurellement
apparaître qu'à un seul slot de l'arbre à un tour donné → les deux
conditions sont automatiquement équivalentes, pas de cas ambigu possible.
```

Implémentation : comparaison de paire en NON-ORDONNÉ (équipe A - équipe B =
équipe B - équipe A), au sein du même slot/série.

### A4 — Bootstrap du 1er admin

```text
Solution retenue : seed manuel UNIQUE via migration SQL, après inscription
normale du tout premier compte via l'appli — pas d'automatisme caché dans
le code applicatif (pas de "premier inscrit = admin", pas de variable
d'environnement avec un email).
```

### A5 — Pré-remplissage IA gagné/perdu des paris personnalisés

```text
Reporté APRÈS le lancement réel de la V1, pas construit dans le scope V1
initial. À reconsidérer uniquement si la validation manuelle admin s'avère
vraiment pénible en usage réel (à observer après quelques semaines d'usage).
```

### A6 — Fournisseur d'API NBA réelle : CONFIRMÉ

```text
Highlightly CONFIRMÉ comme fournisseur unique pour la V1 — pas de test
nécessaire sur balldontlie ni The Odds API, tous les critères bloquants
sont validés.

Test mené en conditions réelles (PowerShell, Invoke-RestMethod/
Invoke-WebRequest) sur :
- la finale NBA Cup 2025 réelle (16/12/2025, New York Knicks vs San
  Antonio Spurs, résultat réel connu et vérifiable) ;
- l'endpoint /teams (30 équipes).

Résultats :
- Statuts fiables : "Finished" confirmé sur des matchs réels terminés.
- Couverture NBA Cup confirmée : la finale Knicks-Spurs a bien été
  retrouvée via l'API (avec le piège de fuseau horaire décrit ci-dessous).
- Logos disponibles nativement par équipe (voir B4).
- Rate limit confirmé : exactement 100 requêtes/jour comme annoncé,
  header x-ratelimit-requests-remaining qui décrémente normalement.

Accès retenu : DIRECT via highlightly.net (pas RapidAPI) — un seul
header nécessaire (x-rapidapi-key), pas besoin de x-rapidapi-host
contrairement à l'accès via RapidAPI.
Base URL : https://nba.highlightly.net
```

**Découvertes techniques du test** (impact direct sur A8/A9 et sur le
futur `lib/scoringEngine.ts` côté V1) :

```text
DÉCOUVERTE 1 — Fuseau horaire obligatoire sur les appels datés :
Le paramètre `date` de GET /matches est interprété par défaut en UTC.
Un match joué en soirée US peut basculer sur le jour calendaire UTC
suivant (vérifié : la finale NBA Cup jouée le 16/12 au soir heure US
n'apparaissait PAS sous date=2025-12-16, mais sous date=2025-12-17, sans
le paramètre timezone).
SOLUTION RETENUE : toujours passer `timezone=America/New_York` dans les
appels à /matches (et vraisemblablement aux autres endpoints datés) pour
aligner le filtrage sur le "jour NBA" plutôt que le jour UTC.
Note : le champ `date` renvoyé dans la réponse reste toujours en UTC
(ISO8601) même avec ce paramètre — seul le FILTRE de recherche par jour
est corrigé, pas l'affichage. Une conversion sera nécessaire côté app
pour afficher l'heure locale au joueur.

DÉCOUVERTE 2 — Structure du score renvoyé :
Le champ state.score.homeTeam / state.score.awayTeam n'est PAS un total
unique mais un TABLEAU de valeurs (score par quart-temps — 4 valeurs
observées sur un match en temps réglementaire, période 5 observée sur un
autre match, laissant supposer un 5e élément en cas de prolongation, à
confirmer si l'occasion se présente).
CONSÉQUENCE : le code de synchro/scoring (lib/scoringEngine.ts côté V1)
devra faire la SOMME du tableau pour obtenir le score final d'un match,
pas lire une valeur simple comme au proto (données de simulation).
```

### A7 — Mapping en bloc des équipes à l'ouverture du 1er tour

```text
Réutiliser l'écran admin/competitions/new déjà existant (sélecteurs manuels
d'équipes, déjà vérifié en conditions réelles au proto), mais le
PRÉ-REMPLIR avec les suggestions issues du mapping automatique API <->
équipe interne. L'admin voit les affiches déjà proposées, corrige si un
rapprochement est douteux, confirme en une seule action. Pas de nouvel
écran de résolution de mapping séparé.
```

### A8 — Fréquence de synchro et rafraîchissement des horaires

Constat technique bloquant découvert : le plan Vercel Hobby (gratuit)
limite les Cron Jobs à **une exécution par jour** — incompatible avec le
besoin fonctionnel déjà validé (0.2.8) de synchro « plusieurs fois par
jour » pendant la phase de matchs.

```text
Solution retenue (reste 100% gratuite, pas d'upgrade Vercel Pro) : un
PLANIFICATEUR EXTERNE GRATUIT (cron-job.org ou GitHub Actions programmée)
qui appelle la route API de synchro existante via HTTP — aucun changement
de code applicatif nécessaire.

Fréquences retenues :
- Horaires (calendrier)   : 1x/jour (changent rarement en cours de route).
- Résultats/statuts       : toutes les 30-60 minutes, MAIS seulement
  pendant les fenêtres où un match de la compétition est en cours ou
  imminent (pas en continu 24h/24).
```

Décision de principe confirmée par l'utilisateur : priorité au gratuit /
meilleur rapport performance-coût pour tous les choix techniques du projet,
avec passage à une option payante plus tard SI un besoin réel l'impose.

**Point de vigilance additionnel découvert en creusant A8** (pas un point
numéroté du cadrage, mais important pour la spec technique) : Supabase
(palier gratuit) met en **pause** les projets inactifs après 7 jours sans
activité (données non perdues, ~30s de redémarrage à froid au prochain
accès). Vu l'usage SAISONNIER de l'app (silence total ~4 mois entre juin
et octobre, ~4 mois entre décembre et avril), ceci DOIT être mitigé —
sinon le projet Supabase serait en pause au démarrage de chaque nouvelle
saison.

```text
Solution retenue : ajouter un 2e job "heartbeat" léger (simple ping/requête
DB) sur le même planificateur externe déjà prévu pour A8, actif TOUTE
L'ANNÉE (même hors saison de matchs). Coût : zéro (même service), effort :
une route API supplémentaire.
```

**Validation de stack** (question ouverte de l'utilisateur, pas un point
numéroté du cadrage mais à consigner) : Next.js + Vercel confirmé comme le
meilleur choix gratuit pour ce projet, rien à changer. Supabase (Postgres +
Auth + RLS gratuits) confirmé comme le bon choix également, sous réserve de
la mitigation de pause ci-dessus.

### A9 — Fréquence de rafraîchissement de l'affichage joueur en direct

```text
Solution retenue : Supabase Realtime (souscription aux tables
matchs/scores côté client) plutôt qu'un polling à intervalle fixe. Élimine
la question du "bon intervalle" — la mise à jour arrive exactement au
moment où la synchro (A8) écrit une nouvelle donnée, ni plus tôt ni plus
tard. Le palier gratuit Supabase (200 connexions simultanées) est
largement suffisant pour 17 joueurs. Respecte nativement la RLS de la V1.
```

---

## Bloc B — Non bloquants / itération future (§14.2, points communs V1)

### B1 — Réactivation du statut PENDING

Confirmé qu'on n'y touche pas. Reste écarté (réactivable un jour sans dette
technique si un besoin réel apparaît). Le code compétition fait déjà le
travail de filtrage.

### B2 — Format de stockage/purge des logs admin long terme

```text
Une seule table admin_logs (horodatage, admin, type d'action, cible,
avant/après en JSON, motif), SANS purge automatique au lancement (volume
négligeable à cette échelle). Une politique de rétention (ex. suppression
après X années) pourra être ajoutée plus tard sans refonte si l'usage
grossit (confirmé par l'utilisateur que ce n'est pas figé définitivement).
```

### B3 — Format de stockage/rétention des logs de synchro

Même logique que B2, table `sync_logs` séparée (horodatage, endpoint
appelé, succès/erreur, résumé de la réponse), sans purge automatique.

### B4 — Sourcing des 30 logos officiels NBA

```text
DÉCISION initiale : garder les VRAIS logos NBA (pas de badges
couleur+abréviation générés), hébergement en interne une fois récupérés
(pas de hotlink direct vers un CDN externe).

MISE À JOUR (test technique A6) : CONFIRMÉ, Highlightly fournit
nativement une URL de logo par équipe (GET /teams, champ `logo`, format
https://highlightly.net/nba/images/teams/{id}.png), les 30 équipes
couvertes, vérifié en conditions réelles.

Ça allège la décision précédente ("sourcing manuel à faire plus tard") :
le sourcing manuel séparé n'est probablement plus nécessaire, les logos
peuvent venir directement de l'API déjà retenue pour la synchro (A6).
Reste à confirmer la qualité visuelle exacte (fond transparent,
résolution) au moment de les intégrer réellement dans l'UI, mais la
DISPONIBILITÉ est confirmée — ce n'est plus une tâche de sourcing
indépendante.
```

Point de vigilance signalé (logos = marques déposées) mais jugé faible
risque pour une app privée/non commerciale — pas un blocage.

### B5 — Filtres et tri de l'historique des logs admin

Tri par défaut = plus récent en premier. Filtres retenus : type d'action,
admin (utile dès 2 admins actifs), ET filtre par date (ajouté sur demande
explicite de l'utilisateur).

### B6 — Bascule vue résumé/arbre du bracket en plein écran/paysage

```text
Vue par défaut = résumé (portrait comme desktop). Bouton "voir l'arbre
complet" : sur desktop affiche directement l'arbre ; sur mobile affiche un
message invitant à tourner le téléphone plutôt que de forcer une rotation
via API (Fullscreen API / Screen Orientation Lock jugées peu fiables
cross-navigateurs).
```

### B7 — Micro-animations et seuils du rafraîchissement live

La partie « seuils » est devenue sans objet grâce à A9 (Supabase
Realtime). Reste la micro-animation UX pure : légère transition
(flash/surbrillance ~1-2s) sur une donnée qui vient de changer sous les
yeux du joueur, à affiner au moment de coder l'écran concerné.

### B8 — Rendu précis de la barre « toi » collante

```text
Réutilise le format de ligne mobile déjà validé pour le classement
(Rang/Pseudo, Total, valeur de la puce de tri active). Comportement :
apparaît seulement quand la propre ligne du joueur sort du viewport en
scrollant (pas affichée en permanence si déjà visible), fixée en bas du
viewport au-dessus de la nav, tap = scroll direct vers sa ligne dans la
liste complète.
```

### B9 — États vides de chaque écran / libellés définitifs

Pas de libellés figés maintenant — laissé au moment de coder chaque écran
(cohérent avec la méthodo du projet, cf.
`nba_pronos_methodo_optimisation_sessions.md` §6 : figer le transversal,
laisser le local au code). Principe transversal retenu :

```text
- Ton convivial (esprit "entre potes"), pas de message froid générique.
- Toujours un appel à l'action quand une action est possible.
- Neutre (juste confirmer l'absence, sans fausse incitation) quand aucune
  action n'est possible.
```

---

## Bloc C — Anciennement « reporté explicitement en V1 » (retirés de `GAPS_OUVERTS.md`)

### C1 — Fenêtre de remplissage du bracket très courte (play-in → 1er tour)

```text
Décision : PAS de mécanique de bracket provisoire (équipes candidates
multiples). Jugé trop coûteux techniquement pour un problème qui ne dure
qu'une soirée par saison.
```

Compensé par des fonctionnalités déjà dans le backlog V1 (voir
`BACKLOG_V1.md`) : notification programmée annonçant l'ouverture du
bracket, export .ics de l'événement.

Piste alternative explorée (intégrer les équipes dès qu'elles sont
mathématiquement sûres de leur seed) explicitement écartée après
explication : le SEED exact (pas juste « qualifié ou non ») reste
généralement incertain jusqu'aux tout derniers jours pour la plupart des
équipes (seeds 3 à 8 surtout), gain réel estimé trop faible (1-2 jours,
2-3 seeds dans le meilleur cas) pour le coût de construire un calculateur
de scénarios de qualification mathématique (brique non triviale, pas
fournie nativement par les API NBA candidates). Reste une idée pour
itération future, à réévaluer seulement si l'usage réel montre que le
remplissage en une soirée est vraiment pénible.

### C2 — Avertissement de perte de saisie (paris incomplets)

```text
Décision : À CONSTRUIRE en V1 (contrairement au proto où c'était jugé
disproportionné). Scope : les 3 écrans avec saisie perdable — pronos
match, paris personnalisés, bracket. Mécanisme : état "modifications non
sauvegardées" sur le formulaire concerné, confirmation avant de quitter la
page, que ce soit par fermeture d'onglet (déjà géré par beforeunload) OU
par navigation interne à l'app (à ajouter, nouveau).
```

### C3 — Catégorisation des paris personnalisés (tags/tri par catégorie)

```text
Décision : catégories FIXES (pas de tags libres), choisies dans une liste
déroulante au moment de créer le pari. Le joueur propose une catégorie à
la création, l'admin peut la corriger au moment de la validation (réutilise
exactement le même écran/geste que l'ajustement de la difficulté
aujourd'hui — pas de nouvel écran). Pas de pré-remplissage IA de la
catégorie (écarté, cohérent avec A5) — choix manuel simple.
```

Taxonomie retenue, dérivée d'un fichier réel de paris de la saison passée
fourni par l'utilisateur (colonne « Type pari perso » du fichier, déjà
classée par usage réel plutôt qu'inventée à froid) — **9 catégories** :

```text
1. Pari joueur              (le plus fréquent de loin — ex. "Cade Cunningham +20pts")
2. Score / total match      (ex. "121-108", "+214 pts dans le match")
3. Pari équipe              (ex. "Detroit +40 rebonds")
4. Pari période             (ex. "égalité à la mi-temps -> OT", quart-temps gagnés)
5. Comparaison / duel       (ex. "SGA marque plus que Booker")
6. Rotation / temps de jeu  (ex. "SGA joue moins de 23 min")
7. Combo multi-joueurs      (ex. "les 10 titulaires marquent chacun +8pts")
8. Événement de match       (ex. "2 fautes techniques côté Orlando")
9. Fun / hors terrain       (ex. "la mascotte se blesse")
```

Explicitement EXCLU de cette taxonomie thématique : les catégories « Aucun
pari » / « Invalide-impossible » / « Ambigu-non vérifiable » présentes
dans le fichier source — ce sont des statuts du workflow de validation
existant (REFUSÉ + motif, déjà couvert par 0.2.4), pas des catégories
thématiques à dupliquer.

### C4 — Création de compte / vraie authentification

Le fonctionnel reste inchangé et déjà figé (0.2.1 /
`nba_pronos_SPEC_FONCTIONNELLE_V0_2.md` §3.1) : inscription = pseudo + mot
de passe + CODE COMPÉTITION → compte ACTIVE immédiat. **Le code
compétition est CONFIRMÉ MAINTENU** (voir note ci-dessous).

Câblage technique retenu pour Supabase Auth (construit autour d'une
identité email, pas pseudo) :

```text
- Email  = identifiant technique de connexion Supabase Auth (déjà prévu
  comme champ privé du profil, jamais affiché publiquement).
- Pseudo = identité publique partout ailleurs dans l'app.

Étapes à l'inscription :
1. Saisie pseudo + email + mot de passe + code compétition.
2. Vérification serveur du code contre la compétition ACTIVE (une action,
   pas une simple validation de formulaire).
3. Si valide -> création du compte Supabase Auth (email + mot de passe) +
   création du profil applicatif (pseudo, statut ACTIVE).
```

**Note à consigner** (pas un point numéroté, mais important pour la
mémoire du projet) : l'utilisateur a proposé de retirer le code compétition
pour permettre une inscription libre à tous, avec un système de « ligues »
(mot de passe de groupe d'amis) façon MPP pour se retrouver entre potes.
Explicitement écarté après discussion : le code compétition (qui a le
droit de JOUER) et le code de ligue (comment je me COMPARE à un
sous-groupe une fois déjà dans le jeu — une simple vue filtrée sur le
classement, cf. `BACKLOG_V1.md`) résolvent deux problèmes différents ;
retirer le premier ouvrirait l'inscription à n'importe qui tombant sur
l'URL, avec un vrai enjeu de modération (le fichier de paris personnalisés
fourni par l'utilisateur contient des exemples classés
« discriminatoire/offensant » et « hors contexte » — gérable dans un
groupe d'amis fermé, plus risqué en accès ouvert). Le code compétition
reste donc exactement tel que déjà validé, sans changement.

### C5 — RLS complètes + vraie API NBA + Vercel Cron

Pour mémoire uniquement — l'API NBA est couverte par A6, le mécanisme de
synchro/cron par A8.

```text
Les RLS elles-mêmes n'ONT PAS été creusées pendant cette session — reste
un point ouvert ENTIER à traiter en spec technique. Volontairement laissé
en dehors de ce document : voir GAPS_OUVERTS.md, où le point reste
présent tel quel (pas de fausse impression de "traité").
```
