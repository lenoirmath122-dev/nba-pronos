# Gaps ouverts — NBA Pronos

> Liste vivante. Un point retiré = un point traité (voir `JOURNAL_SESSIONS.md`
> pour la trace de quand/comment). Ne pas laisser de points "résolus mais
> gardés pour mémoire" ici — c'est le rôle du journal. Restructuré le
> 06/09/2026 : l'historique complet (journal daté 20/07→03/09/2026) a été
> déplacé, intact, dans `Cadrage/Suivi/archive/
> GAPS_OUVERTS_journal_archive_jusquau_2026-09-06.md`.

> **Autre tracker, périmètre distinct** : les gaps issus de l'audit
> sécurité/qualité de septembre 2026 (rate-limiting, tests RLS, focus-trap,
> contraste, responsive desktop, etc.) vivent dans `audit/ANOMALIES.md` et
> `audit/PLAN_ACTION.md` (Vagues 0-4) — pas dupliqués ici, vérifier les deux
> fichiers pour une vue complète des points ouverts.

## Chantier "paris personnalisés IA" — types encore non calculables

- **Pertes de balle (tov)** : donnée brute déjà disponible localement, mais
  absente de `STAT_CODES`/`TEAM_STAT_CODES`/`MATCH_STAT_CODES` — aucun pari
  "X pertes de balle" n'est structurable. Décidé avec l'utilisateur : à
  reprendre plus tard, même patron que l'extension `oreb`.
- **Paris composés** mélangeant un seuil de stat et un résultat de période
  dans la même condition (ex. "Knicks +32% à 3pts ET gagne les 4 quarts") —
  `structurePeriodBet.ts` les rejette explicitement, non structurable en un
  seul schéma.
- **Formulation période sans le mot "temps"** après "quart" (ex. "l'équipe
  qui mène au début du 4e quart perd") — `PERIOD_KEYWORD_REGEX` ne matche
  que `quart[s]?[\s-]?temps`, jamais routé vers le schéma dédié.
- **+/- joueur par période** mal résolu : `plus_minus` est exclue des 10
  modèles `train_player_period_model.py` et absente de
  `stats_box_scores_by_period` — un pari "+/- en 1ère mi-temps" reste
  structurable côté IA mais se résout toujours à 0. Nécessite un backfill,
  laissé de côté.
- **Paris "cumulé sur la série"** (ex. "Doncic marquera 100+ points sur la
  série") — distinct de "au moins une fois sur la série" (seul cas géré) :
  demanderait une distribution de somme sur un nombre de matchs aléatoire,
  pas construit. Retombe sur validation manuelle admin.
- **Paris SÉRIE sur stat équipe/total** (pas seulement joueur) —
  `resolveCalculableSeriesBets()` filtre encore sur
  `structured_player_id` non-null uniquement (vérifié dans
  `lib/ai/resolveCalculableBets.ts`) ; pièce (a) du chantier "paris série"
  (modèle équipe pour ce scope) jamais construite.
- **Comparer 2 comptages entre équipes** (ex. "Knicks utilisent 3 joueurs de
  plus que les 76ers") et **égalité exacte entre 2 comptages** — différé du
  chantier ROSTER_COUNT, mécanisme distinct à construire.
- **Performance propre d'un joueur sur une période** (ratio, ex. "40% de ses
  points au Q4") et **égalité exacte entre 2 joueurs / sur tout le roster**
  — explicitement laissés de côté du plan de reprise du 24/08/2026, jamais
  repris depuis.
- **"LF suite à des fautes personnelles"** — probablement quasi équivalent à
  la stat FT équipe déjà gérée, jamais vérifié.
- **Décision TTL cache (5 min) / classify-then-structure** reportée faute de
  données de trafic réel (pause actuelle entre alpha et vraie Cup) — à
  revisiter une fois du trafic réel disponible (~20/09/2026).
- **Backtesting du moteur de proba sur de vrais paris résolus** reporté
  après le lancement de l'alpha (trop peu de paris résolus avec
  `calculated_proba` en base pour l'instant).

## NBA Cup — bêta réelle (octobre-novembre 2026)

> Distinct de l'alpha fictive de septembre (automatisée, voir
> `JOURNAL_SESSIONS.md`) : la vraie NBA Cup n'a pas encore de tirage au sort
> officiel connu.

- **Mapping automatique A7** (détection via `/api/sync/schedule` des 4
  matchs de quarts, puis construction des 7 séries internes) jamais
  construit — l'API est match-centrique, jamais série-centrique, règle
  jamais sondée empiriquement. Reporté à la fenêtre Cup réelle (~fin
  octobre 2026) pour sonder avant de concevoir.
- **Garde `bet_scope=SERIES` interdit en NBA Cup** vérifiée seulement par
  relecture de code, jamais exercée en conditions réelles (aucune
  compétition NBA Cup réelle testée à ce jour).
- **Rendu "à pronostiquer" d'un match Cup encore `SCHEDULED`** jamais
  vérifié en conditions réelles — calendrier 2026-27 pas encore publié côté
  Highlightly au dernier sondage.
- **`SYNC_SECRET` exposé en clair plusieurs fois dans le chat** pendant des
  tests (dry-run Cup) — régénération (`.env.local` + secret GitHub Actions,
  synchronisés) recommandée, jamais confirmée faite.

## Chantier juridique — validations professionnelles restantes

> Le reste du cadrage (§2.1-2.11) est fait ; ces points nécessitent une
> validation qu'un agent IA ne peut pas apporter.

- **Base légale précise pour les 15-17 ans** (§8.5,
  `conseils_juridiques_deploiement_application.md`) — nécessite la
  validation d'un professionnel du droit.
- **Logos NBA sans licence** (`public/logos/teams/*.svg`) — risque accepté
  tel quel pour la bêta fermée gratuite actuelle, à revoir obligatoirement
  avant toute ouverture publique/commerciale (2027, 2 options déjà
  identifiées : licence ou remplacement des visuels).
- **Nom de marque "Panier Ballon" et logo** — directions de travail
  réévaluables, pas des choix figés (voir le cadrage business).

## Gaps techniques du prototype

- **Performance de `lib/botScripting.ts`** : requêtes Supabase séquentielles
  non batchées — a saturé la mémoire une fois (16 bots, "Avancer de N
  jours" élevé). Jugé hors scope pour un prototype jetable, pas de
  correction prévue sauf gêne concrète.
- **Compte de démo partagé `Demo_Amis`** (bracket/pronos communs à tout le
  groupe de test) — à retirer ou reconvertir en comptes individuels dès que
  l'utilisateur y passe, prévu après la V1. Les dates du jeu de données de
  test (`bracket_deadline`, matchs) sont des timestamps absolus posés au
  seed — à redécaler périodiquement tant qu'un mécanisme relatif à `now()`
  ne les remplace pas.
- **`eslint` bloqué en v9** — `eslint-plugin-react` (via
  `eslint-config-next`) n'a toujours aucune version compatible eslint 10
  déclarée. À revérifier périodiquement.

## Petite dette UI / backlog produit

> Issue de l'audit UX du 16/08/2026 et de sessions ultérieures, jamais
> reprise depuis.

- **Notifications/popup à la connexion** (résumé depuis la dernière visite,
  badges débloqués, actus) — retenue comme piste produit face à une
  mécanique récurrente, jamais cadrée ni codée.
- **Photo de profil** — validée comme principe côté DA mais explicitement
  "non tranché, à reprendre avant de coder" par le document source : bucket
  Supabase Storage à créer, format/taille, recadrage auto vs. manuel.
- **Ticker "en direct"** (`LiveTicker.tsx`, Jouer/Mes pronos) posé à
  l'essai, pas un chantier figé — décision garder/retirer jamais prise.
- **Composant `Button` partagé** jamais factorisé (19+ déclarations quasi
  identiques) — refactor identifié, pas pressant.
- **`LeaderboardRow` non mémoïsé** ; regroupements de requêtes possibles
  (`getBracket()`, `getHomeData()`).
- **Classes CSS mortes** `.hero-banner-title`/`.hero-banner-subtitle`
  (référencées dans le JSX, aucune règle CSS ne les stylise).
- **Logos de franchise encore en texte seul** sur le feed "Ça vient de
  tomber" (Accueil) et sur le Classement (icônes de résultat à la place,
  jamais de pastille d'équipe).
- **Badges** : badge Grimpeur (progression de rang) reporté par choix
  explicite ; remplacement des icônes stopgap `lucide-react` par des
  visuels IA en pause (3/35 badges pilotés), reprise à date non fixée.
- **Backlog produit jamais repris** : export `.ics`, Hall of shame,
  classement all-time (nécessite un barème de scoring stable dans le
  temps, ou une neutralisation des changements de barème — pas tranché).
- **Taille du logo de la carte-sélecteur d'équipe** — piste évoquée, jamais
  tranchée.
- **3 abonnements Apple dupliqués** sur `Demo_Amis` (Safari iOS recrée un
  abonnement à chaque tentative) — sans conséquence fonctionnelle, pas
  dédupliqué.
