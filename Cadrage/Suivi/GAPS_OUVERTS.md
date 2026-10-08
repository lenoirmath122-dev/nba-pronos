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

## Retours de l'alpha (03/10/2026)

> Détail et correspondance avec le code/la feuille de route :
> `RETOURS_ALPHA_NBA_CUP.md`. Priorisés le 03/10/2026 dans la Phase 3 de
> la feuille de route (p3-3 à p3-12, dans l'ordre de traitement).

- **Récaps, suite de p3-10/p3-11 (05/10/2026)** : journalier et hebdo
  livrés (push à 10h + bloc en tête de « Ça vient de tomber »), mais jamais
  vus avec de vraies données : aucune compétition active depuis la clôture
  de l'alpha, et pas de session de test en local. À vérifier à la prochaine
  compétition (y compris un lundi pour le hebdo). Restent : la version « par
  ligue » du hebdo (payante plus tard, Phase 7, à brancher dans
  `canReceiveRecap()`) ; le rapprochement des articles TrashTalk se fait
  par surnom d'équipe dans le titre, heuristique jamais éprouvée en saison
  régulière (en présaison, le flux ne contenait aucun article de résultats).
- **Déjà dans la feuille de route mais reportés, redemandés par les
  testeurs** : photo de profil/avatars (p6-22), landing page (p5-2).
- **Badges, suite de p3-9 (05/10/2026)** : popup et écusson livrés, mais les
  icônes restent celles de la bibliothèque lucide ; les visuels dessinés du
  PDF (vieille dame, chien en laisse, coupe + formulaire, joker...) restent
  à faire (p6-20). La popup est vérifiée aussi juste après un geste du
  joueur depuis le 05/10/2026 ; les badges liés aux résultats (points, bons
  vainqueurs...) restent découverts à l'ouverture ou au retour au premier
  plan, puisqu'ils changent avec la synchro et non avec un geste.
- **Couverture des types de paris** : choisir sa difficulté n'est pas
  intuitif. Couvrir plus de types (modèles ML) et aider au choix.
  **Cadré le 07/10/2026** : `Cadrage/Fonctionnel/nba_pronos_cadrage_enrichissement_modeles_paris.md`
  (12 décisions, catalogue, lots). Étapes à traiter, une par conversation :
  1. re-mesurer la couverture réelle (l'audit du 24/08 est périmé) ET
     découvrir les types inconnus, avec un coût IA minimal (décision du
     07/10/2026 : limiter les appels IA ; seule la structuration par Claude
     coûte, le routage regex est gratuit). Sous-étapes : **A** stocker à chaque
     `is_calculable=false` un motif (codes fermés), le texte brut et une
     empreinte de type, dans une colonne dédiée (recommandé, `refusal_reason`
     sert déjà au refus admin ; migration + RPC `update_bet_structuration`) ;
     **B-lite** passer le corpus (`Cadrage/Stats/types_de_paris_playoffs_2026.md`,
     429 paris) dans `routeBetDescription()` et classer par lecture des ~30
     branches `markNotCalculable` (`lib/ai/structureAndScoreBet.ts`), sans IA ;
     **C1** analyser en lecture seule les paris réels de l'alpha/présaison
     déjà en base ; **C2** catalogues externes (props des bookmakers, fantasy)
     + 1 seul appel de génération de 150-200 textes variés, triés par regex
     (ceux qui retombent dans `GENERAL` = candidats nouveaux types),
     structuration IA seulement sur un petit échantillon et sur accord.
     **C3** (vue admin de regroupement des non calculables, motif
     `UNKNOWN_TYPE`) = étape à part. Pas de rejeu complet sans accord.
     **Avancement (07/10/2026, à compléter)** : périmètre retenu pour cette
     étape = **A + B-lite**. **B-lite faite : PR #143** (à merger) --
     empreinte de type `lib/ai/betFingerprint.ts`, parseur du catalogue
     `lib/ai/corpusCatalog.ts`, rapport `scripts/corpus-routing-report.test.ts`
     (`$env:CORPUS_REPORT=1; npx vitest run scripts/corpus-routing-report.test.ts`).
     Constats : le « corpus de 429 paris » est en fait un **catalogue** (12
     catégories, 105 sous-types avec effectif, 167 exemples), pas 429 textes ;
     le routage regex ne dit pas si un pari est calculable (cela dépend de la
     sortie de l'IA) : 76 % des exemples pondérés vont dans `GENERAL`, 14 % dans
     `PERIOD`, le reste est marginal ; `markNotCalculable*` est appelée **67
     fois** (pas ~30), dont environ les deux tiers dépendent de la sortie de
     l'IA. Piste à vérifier : « prolongation » est routée vers `GENERAL`.
     **A faite (PR 2, 07/10/2026)** : chaque `is_calculable=false` écrit
     `bets.calculability_diagnosis` (13 codes fermés dans
     `lib/ai/notCalculableReason.ts`, route regex, texte brut, squelette,
     empreinte, `ai_reasoning` <= 500 caractères). Migration
     `20261009090000` appliquée en production le 07/10/2026 (MCP Supabase) ;
     version de l historique réalignée sur `20261009090000` le 07/10/2026.
     Les paris antérieurs n'ont pas de diagnostic. **Mesure** (lecture seule,
     une fois des paris soumis) :
     `select calculability_diagnosis->>'reason', calculability_diagnosis->>'route', count(*) from bets where is_calculable = false group by 1,2 order by 3 desc;`
     puis les empreintes les plus fréquentes pour `UNKNOWN_TYPE` :
     `select calculability_diagnosis->>'fingerprint', min(calculability_diagnosis->>'skeleton'), count(*) from bets where calculability_diagnosis->>'reason' = 'UNKNOWN_TYPE' group by 1 order by 3 desc;`.
     Exclure le groupe `OPERATIONAL` de la mesure de couverture. Reste : C1
     (paris réels en base, lecture seule) ;
  2. comprendre pourquoi 7 paris joueur + seuil de l'alpha
     (`is_calculable=true`) ont été résolus à la main ;
  3. **Plan retenu le 07/10/2026 : scénario A (meilleur rapport
     effort/résultat), validé par l'utilisateur** après arbitrage de
     l'`architect` (S1 à L8). Règle : composition de modèles existants
     d'abord, nouveau modèle seulement si la composition est fausse au
     backtest (jamais fait, à faire). Ordre des lots :
     - **Lot 0** : analyse C1 des paris réels, étape 2 ci-dessus, lecture de
       la mémoire Cloud Run (`gcloud run services describe`, absente du
       dépôt), cache LRU borné en octets des modèles (aucun cache aujourd'hui,
       61 joblib, ~920 Mo, chargés 2 à 3 fois par requête via
       `_compute_with_consistency_check`) ou allègement des modèles
       (compression, HistGradientBoosting) -- choix à trancher ;
     - **Lot 1** (avant la bêta Cup du 04/12) : S2 (corrélation entre stats
       dans la somme + coefficients pour le fantasy, aujourd'hui `var = Σσ²`
       dans `supabase_context.py::_resolve_weighted_operand`), S1 (`pf` à
       backfiller depuis le SQLite local, `dreb` = reb - oreb, fgm/ftm/fta par
       composition ; un seul vrai modèle, `pf`), S4 en condition générique du
       combo (règle aussi le combo période + match entier), S3 (écart final,
       recalé sur `home_win`), S8 (titulaire/remplaçant), « exactement N » hors
       période, égalité exacte (L2), score exact du match ;
     - **Lot 2** : S6 (« joue seulement N quarts » ; vérifier d'abord si un
       quart non joué donne une ligne à 0 ou aucune ligne dans
       `stats_box_scores_by_period`) + L8 (alias de noms) ;
     - **Lot 3** (déc.-janv., après une semaine d'observation de la VM) :
       agrégats play-by-play + backfill local, puis P1 (premier marqueur),
       P2 (course à X), P3 (avance max / avance perdue) ; archive brute dans une
       PR séparée ;
     - **Lot 4** (fév.-mars, avant les playoffs d'avril 2027) : R3 (score exact
       de série, balayage, remontée 3-1 via `simulate_series`), puis R1 côté
       équipe/total.
     Estimation : ~30 à 35 jours, 6 à 10 nouveaux modèles, ~+3 à 4 points de
     couverture sur le corpus des playoffs (estimation, à confirmer par la
     re-mesure). Nouveaux modèles : entraînés sur les saisons déjà en local.
     **Volontairement NON codés dans le scénario A** (ils restent non
     calculables : refus propre avec message clair, ou estimation IA
     « approximative » + résolution admin via `markNotCalculableWithEstimate`) :
     S7 (+/- par période, ~10 000 appels API), S9 et S10 (raquette, hustle,
     tracking), A1 (saison/awards, demande un nouveau `bet_scope`, chantier
     produit), A2, L6 (statut « pari annulé » inexistant) ; faisables plus
     tard à bas coût mais non planifiés : S5 (pair/impair, quart le plus
     prolifique), P4 (changements de leader), P5 (dunks, premier 3 pts -- le
     plus candidat si l'analyse C1 le montre), P6, P7, R2 (cumul sur la
     série), R1 hors équipe/total, L1 en arbre complet (seule la condition
     générique est prévue), L3, L4, L5, L7. Messages de refus à rédiger pour
     S7, S9, S10, A2, L6. À valider avant le Lot 1 : accepter des probas
     approximatives par composition sous réserve de backtest ; décaler le Lot 3
     et S6 après l'observation de la VM `nba-refresh` ; périmètre refusé et
     forme du cache.
  4. **Après le plan A : faciliter la vie des admins qui vérifient les paris
     non calculables / non vérifiables** (demande de l'utilisateur,
     07/10/2026). Pas cadré. Pistes : vue admin de regroupement par motif
     (`bets.calculability_diagnosis`, étape C3 ci-dessus), estimation IA
     « approximative » pré-remplie, résolution assistée. À instruire dans une
     conversation dédiée.
- **Paris sans joueur identifié, cas restants (suite de p3-14, 05/10/2026)** :
  `resolveNotInMatchBets.ts` couvre désormais les paris JOUEUR simples
  (MATCH et SÉRIE), période joueur et superlatif. Restent à l'admin : un nom
  ambigu sur la feuille (nom de famille seul), et les formes à plusieurs
  joueurs (duel, combo) dont l'id manquerait. L'alerte « Joueur non
  identifié » compte dès l'échéance passée, donc un pari « envoyé quand
  même » y apparaît le temps que le box score soit importé (en général le
  lendemain) -- et, pour un pari SÉRIE, jusqu'à la fin de la série.

## Plan de communication — suite du projet (05/10/2026)

> Plan source : `Cadrage/Business/panier_ballon_cadrage_business_communication.md`
> et `panier_ballon_elargissement_octobre.md`, écrits avant l'alpha. Quatre
> étapes décidées le 05/10/2026, à traiter dans cet ordre, une par
> conversation (voir `README.md`, méthode de travail).

- [x] **A. Recaler le plan sur la réalité** — fait le 05/10/2026, voir
  `Cadrage/Business/panier_ballon_plan_recale_octobre_decembre.md`. Décisions :
  bêta sur la phase finale de la Cup (4→11/12), pas la phase de groupes
  (l'app est centrée sur les séries, 4-6 jours de travail) ; canaux en
  parallèle dans 2-5 h/semaine ; contenu de la pause = retours de l'alpha,
  nouveautés produit, compte à rebours. Reste ouvert : que jouent les inscrits
  avant le 4/12 (§5 du plan recalé).
- [x] **C. Socle SEO et vocabulaire** — clos le 06/10/2026 (PR #119 et #121,
  voir `JOURNAL_SESSIONS.md`). Le mot « paris » est conservé volontairement
  dans les métadonnées et sur `/` (toujours avec « sans argent réel »).
  Reste hors de ce point : la landing page soignée (p5-2, version actuelle
  minimale), et `lastModified` du sitemap à mettre à jour à la main quand
  une page change. Toujours écrire `https://panierballon.fr` (avec schéma)
  dans les messages et légendes, sinon pas d'aperçu de lien.
- [ ] **B. Contenu Instagram pendant la pause** — post 5 « Bilan de l'alpha »
  fait et publié le 05/10/2026 (6 slides + légende dans `Cadrage/DA/instagram/Posts/Post 5/`).
  **Plan Instagram oct.-nov. écrit le 06/10/2026** dans `Cadrage/Business/panier_ballon_instagram_octobre_novembre.md`
  (audit, rôle d'Instagram dans le recrutement, calendrier 6/10 → 15/11, textes, cadrage des visuels).
  **Reel R1 v3 prêt le 06/10/2026** (`Réels/panier-ballon-nba-cup-reel-v3.mp4`, fin « Préparation dès le 20/10 ») :
  à publier en S1 une fois le profil remis à neuf ; légende R1 à aligner (sans « Match du jour ») ; refaire la fin si le 20/10 glisse.
  Restent : la suite du calendrier (reel démo, post
  « nouveautés », sondage Story), et le motion design de présentation
  générale de l'app + motions par fonctionnalité (décidé le 05/10, plus
  tard ; à ne produire qu'après un cadrage très précis : script, durée,
  fonctionnalités couvertes, format). Récaps du matin : ne pas les mettre en avant avant de les avoir vus
  avec de vraies données.
- [ ] **D. Recrutement** — plan écrit le 06/10/2026 dans
  `Cadrage/Business/panier_ballon_plan_recrutement_octobre_decembre.md`
  (structure, calendrier, entonnoir, messages-types recalés). Décisions :
  quelques vrais matchs avant le 4/12 ; le commissaire crée sa ligue ; statut
  « fondateur » symbolique pour les ambassadeurs (n'existe pas dans l'app,
  faisabilité à confirmer, ne pas le promettre avant). Reste à faire : cadrer le
  dispositif « vrais matchs » (faisabilité produit non sondée), écrire le mode
  d'emploi d'inscription avec captures, créer le tableau de suivi (hors
  dépôt), envoyer le message aux ambassadeurs le 11/10, puis exécuter le
  calendrier. Les anciens messages « bêta ouverte en octobre » sont périmés.
  **Dispositif « vrais matchs » cadré le 06/10/2026** : compétition `DAILY_MATCH`
  (un match tiré par jour, 20/10 ou repli 01/11 → ~27/11, barème dédié avec
  paris pondérés, un pari perso par match), voir
  `Cadrage/Fonctionnel/nba_pronos_cadrage_competition_match_du_jour.md`.
  Les 6 points ouverts du cadrage sont tranchés (voir §8 du
  cadrage, 06/10/2026) : paris ×0,6, publication 10h Paris avec push, tirage
  aléatoire, tirage par lots. Correctif « veille NY » livré (PR #126), PR 1/4
  (base, moteur, types) mergée (#127) et migrations poussées, PR 2/4 (synchro,
  admin, script de tirage, masquage JS) mergée (#128),
  PR 3/4 (UI joueur : carte jour NY + heure Paris, règles, bracket masqué)
  livrée le 07/10/2026, PR 4/4 (annonce du match du jour dans le push de 10h, groupée avec le récap) livrée le 07/10/2026 (joueur en push avec « Récap du matin » désactivé : pas d'annonce, à confirmer). PR 5 (tirage automatique par cron, 07/10/2026) codée : workflow `daily-match-draw.yml` (5h et 7h UTC) + route `/api/daily-match/draw`, le cron tire dès le 18/10 les jours >= 20/10 (fenêtre de 3 jours) ; sert aussi de test de la récupération automatique du calendrier avant la Cup et les Playoffs, sans couvrir le mapping A7 de la Cup. **3 points à faire par l'utilisateur le soir du 07/10/2026, dans l'ordre** : (1) créer la variable Vercel `OWNER_USER_ID` (id de son compte) puis redéployer après le merge de la PR 5 ; (2) lancer le test (compétition de test seule ACTIVE, workflow manuel `from=to=2026-10-07` + `override`, `dry_run` puis réel avec `push_only_me`) ; (3) **archiver la compétition de test avant 08:00Z le 08/10**. Détail : créer la variable Vercel `OWNER_USER_ID` ; **test du 07/10 au soir** sur une compétition DAILY_MATCH de test (seule ACTIVE, matchs de présaison) via le workflow en manuel (`from=to=2026-10-07`, `override`, d'abord `dry_run`, puis `push_only_me`), puis **archiver cette compétition avant 08:00Z le 08/10** (sinon `recaps.yml` pousse à tous les comptes) ; créer ensuite la vraie compétition DAILY_MATCH en admin avant le 18/10. Tests `onlyUserId` (runRecaps) et tests de route non écrits. Calendrier Highlightly
  2026-27 incomplet (vide du 10/11 au 27/11 au sondage du 06/10) : la route renvoie 500 (issue d'alerte) si le match d'aujourd'hui ou de demain manque.
  **Mise à jour du 07/10/2026 (fenêtre glissante de 7 jours)** : le cron commence le 16/10 (pas le 18/10) et tire 9 jours à l'avance ; la vraie compétition DAILY_MATCH doit donc exister **avant le 16/10 à 5h UTC** (prévu le 14/10 : clôturer la compétition de test après la présaison, puis recréer). À surveiller : (1) la synchro des horaires ne regarde que 4 jours (`SYNC_HORIZON_DAYS`, `lib/sync/schedule.ts`) alors que les matchs sont visibles 7 jours avant, donc un report peut rester affiché 2 à 4 jours ; (2) quota Highlightly, jusqu'à 18 appels/jour si le calendrier est vide (arrêt sous 50 restants) ; (3) Thanksgiving (26/11) sans match probable : alerte 500 pendant 2 jours.

- **Match du jour : résultats et récap trop dépendants du planificateur GitHub
  (06/10/2026)** — test PR 5 fait le 06/10 (tirage + push au propriétaire OK).
  Constat : `sync-results.yml` est réglé à 30 min mais GitHub l'espace de
  plusieurs heures (runs à 07:10Z puis 14:21Z le 06/10), donc un résultat de
  match de nuit peut arriver tard côté joueur. À faire : une automatisation
  plus fiable des résultats pour le Match du jour (déclenchement serré autour
  du coup d'envoi/de la fin du match, ou planificateur plus ponctuel que le
  cron GitHub), pas tranché. À vérifier en même temps : les quotas de
  l'API Highlightly (100 req/jour, doc maître §2 A6) avec le Match du jour
  + `sync-results` + `daily-match-draw` actifs ensemble.
  **Mise à jour du 08/10/2026** : PR A (#147) mergée (route `/api/sync/results-nba`),
  PR B en cours (`feat/results-nba-poller`) : poller sur la VM (ScoreboardV3, 2 min le
  soir) + secours dans `refresh_job.py`, en dryRun d'abord. Reste après son merge :
  déployer sur la VM, 2 soirs d'observation en dryRun (`DEPLOIEMENT_VM.md`), passage en
  réel, puis PR C (repli Highlightly + watchdog). cdn.nba.com est inutilisable depuis GCP.

- **Import des box scores NBA : stats.nba.com expire depuis GitHub Actions, et
  Highlightly à vérifier comme source de secours (07/10/2026)** — test de
  résolution automatique fait le 07/10 : la chaîne import → `/api/resolve-bets`
  fonctionne (pari « Shai marque plus de 15 points » résolu `LOST`, Shai
  n'ayant pas joué le match de présaison OKC–NOP), MAIS `leaguegamefinder`
  (stats.nba.com) a expiré 5 fois de suite depuis les runners GitHub (dont
  3 × 60 s en mode strict) alors que le même import marche depuis la machine
  de l'utilisateur. Le cron quotidien a donc probablement pu échouer
  silencieusement avant la PR #134 (aucune trace n'existait). À faire :
  1. **Highlightly testé le 07/10/2026 (5 requêtes) : insuffisant seul, et
     aucune API concurrente abordable.** `/box-score/{id}` : par joueur, match
     entier uniquement (pas de quart-temps), ids Highlightly (pas ceux de
     stats.nba.com). `/matches/{id}` : champ `events` (période, horloge,
     description, isScoringPlay) mais SANS id joueur (noms en texte libre) ni
     valeur de panier ; fautes techniques et retours en zone non vérifiés.
     Alternatives (doc seulement, rien d'appelé) : BALLDONTLIE a des ids
     joueur et `score_value` dans son play-by-play mais seulement au plan
     39,99 $/mois (refusé : trop cher), SportsDataIO 99-149 $/mois, Big Balls
     Data n'a pas de play-by-play. **Décision de l'utilisateur** : Highlightly
     continue de tourner chaque jour (gratuit) pour calendrier/scores ;
     l'import nba_api (box scores, par période, play-by-play) est conservé,
     mais doit tourner depuis une IP qui n'est pas celle de GitHub.
  1bis. **Cloud Run testé le 07/10/2026 : BLOQUÉ.** Test Cloud Shell (VM
     Compute Engine, projet `nba-pronos-stats-2026`) : `leaguegamefinder`
     répond en 0,2 s (24 lignes de présaison = 12 matchs). Même appel depuis
     un Cloud Run Job (europe-west1) : `ReadTimeout` à 30 s, confirmé sur 2
     jobs distincts. Cloud Run est donc écarté, comme GitHub Actions ; le plan
     d'un Cloud Run Job + Scheduler (image dédiée, `refresh_job.py`, alerte
     watchdog, ~0 €/mois) n'a pas été codé. `refresh_daily.py` est
     incrémental (compare la saison complète aux `game_id` connus) : un
     lancement à J+1/J+2 rattrape les jours manqués, et les resolvers prennent
     tous les paris `VALIDATED` dont le match est terminé, sans fenêtre de
     date. **VM Compute Engine testée le 07/10/2026 : ÇA PASSE** (e2-micro,
     us-central1-a, debian-12, projet `nba-pronos-stats-2026`) : `RESULT OK 24
     5.1` (5,1 s, mêmes 24 lignes qu'en local). Un seul test, stabilité non
     prouvée. VM de test `nba-ping-vm` supprimée le 07/10/2026. Décision de l'utilisateur : construire l'import
     quotidien sur cette VM (timer + rattrapage + `/api/resolve-bets`, secrets
     via Secret Manager, swap, watchdog). **PR 1 codée le 07/10/2026**
     (branche `feat/stats-import-vm`) : `refresh_job.py` (import strict puis
     `/api/resolve-bets`, même si l'import est incomplet), dossier
     `Cadrage/Stats/vm/` (timer à 12h et 16h Paris, `run.sh`, `install.sh`,
     `DEPLOIEMENT_VM.md`, `refresh-local.ps1`), `requirements-refresh.txt`,
     tests pytest + job CI `python-import`, et correctif du bug ci-dessous.
     **VM `nba-refresh` créée et testée le 07/10/2026** (étapes 1 à 5 faites,
     budget 1 € fait). **PR 2 codée** (branche `feat/stats-vm-trigger-watchdog`) :
     bouton « Run workflow », watchdog, cron retiré, versions épinglées.
     **PR 2 mergée (#138), étape 7 faite le 07/10/2026** : bouton « Run workflow »
     (mode `manuel`) vert, watchdog vert. `nba-ping-vm` et le job Cloud Run de test `nba-api-ping3` supprimés le
     07/10/2026. Reste : observer la VM
     une semaine (premier vrai import de box scores à la reprise de la saison)
     et vérifier à ~48 h la facturation de l'IPv4 externe. Un match sans play-by-play
     n'est plus enregistré (réessayé aux passages de 12h/16h, ses paris restent
     en attente, l'admin résout à la main si le play-by-play n'arrive jamais).
     Plan B si la VM se fait bloquer : un script local qui enchaîne import +
     `/api/resolve-bets` (secrets dans un fichier hors dépôt) lancé à la main
     depuis le PC. nba_api reste de toute façon un garde-fou manuel en cas de
     gros bug. **Bug corrigé dans la PR 1** (trouvé par l'architect) : dans
     `refresh_daily._run`, un quart-temps ou un play-by-play en échec
     n'empêchait pas d'enregistrer le match, qui n'était alors jamais réessayé
     (pari joueur+période résolu avec le quart compté à 0, paris
     temps morts/buzzer/dernier panier bloqués). Désormais `collect_game()`
     ne renvoie le match que s'il est complet, et `stats_matchs` est écrit en
     dernier (contres en delete puis insert, rejouables sans doublon). Reste
     non corrigé, assumé : un match sauté décale `games_played_season_avant`
     des matchs suivants ; un match reporté (`scheduled_at` change de jour)
     reste « match NBA correspondant introuvable » jusqu'à résolution admin ;
     la correspondance `teams.abbreviation` (Highlightly) ↔ `stats_equipes.tricode`
     n'est vérifiée que pour OKC/NOP (comparer en SQL : GS/GSW, NY/NYK, SA/SAS,
     UTA...).
  2. ~~Déployer la migration `20261008090000_sync_type_stats_import.sql`~~ --
     faite le 07/10/2026 via l'outil MCP Supabase (CLI absente de la machine),
     version de l'historique réalignée à la main sur celle du fichier
     (`20261008090000`) ; `STATS_IMPORT` présent dans l'enum `sync_type`.
     Aucune ligne `STATS_IMPORT` encore écrite (pas de rafraîchissement depuis).
  3. Bruit attendu : le cron hors-saison écrira des lignes `success=false` dans
     `sync_logs` tant que `leaguegamefinder` expire (timeout 15 s, voulu).
     Le mode strict (lancements manuels) reste rouge tant qu'un match est
     « équipes ambiguës ».
  4. Point non investigué : `/api/resolve-bets` a listé le pari de test à la
     fois résolu et « équipe manquante » dans la même réponse (résultat final
     en base correct).

## Capacité — test de charge

- **Test de charge réel jamais fait** (11/09/2026) — cible théorique connue
  (pooler Supabase local : `default_pool_size=20`, `max_client_conn=100`,
  largement au-dessus des dizaines d'utilisateurs visées par ligue de 10-30
  personnes), mais aucune mesure empirique. Tentative de test local via
  Docker/Supabase CLI abandonnée le jour même : la machine principale (8 Go
  RAM) fait chuter la RAM libre à moins d'1 Go dès le démarrage de Docker
  Desktop (même profil que le BSOD du 07/09/2026) ; la machine de secours
  envisagée a un disque C: saturé (0 Go libre, DISM cassé, nettoyages sans
  effet). Nouveau plan : projet Supabase cloud dédié (`load-test/setup.mjs`
  et `load-test/k6-scenario.js` déjà écrits dans le repo, non commités,
  pointent encore sur `127.0.0.1:54321` — à adapter au projet cloud une fois
  créé). Bloqué sur le quota de 2 projets gratuits Supabase : le projet perso
  "saoulking" doit être mis en pause pour libérer un slot. Reporté après
  l'alpha (voir item P3-1 de la feuille de route).

## e2e / cross-browser

- **WebKit (Safari) mis de côté pour la suite e2e** (p1-2, 07/09/2026) —
  `playwright.config.ts` n'a que `chromium`/`mobile-chrome` (Pixel 7).
  Essayé sur un projet `mobile-safari` (`devices["iPhone 14"]`) : 2 des 3
  specs échouent de façon reproductible (pas des flakes) :
  - **T-UI-01** (focus-trap) : le focus n'est jamais restauré sur le bouton
    déclencheur après `Échap`, contrairement à Chromium — quirk WebKit
    documenté sur la restauration de focus programmatique des `<button>`.
  - **T-UI-02** (connexion → prono → déconnexion) : le flux de validation
    du prono n'aboutit pas (le texte récap "✓ E2H +3" n'apparaît jamais) —
    piste la plus probable : `hasTouch: true` de l'émulation iPhone change
    la sémantique tap/click sur les contrôles `UpcomingRow.tsx`/dialogue de
    validation, jamais testée jusqu'ici.
  - Pas creusé plus loin (décision utilisateur, priorité au viewport mobile
    -- livré et fiable via `mobile-chrome` -- plutôt qu'au moteur Safari).
    À reprendre si Safari/iOS devient un profil de trafic significatif :
    commencer par `components/ui/FocusTrap.tsx` (focus restoration) et le
    dialogue de validation de `UpcomingRow.tsx`/`UpcomingRowForm.tsx`.

## Modèles de probabilité — maintenance

- **Calibration Poisson/normale jamais revérifiée à l'échelle PÉRIODE** —
  `train_player_period_model.py` réutilise `POISSON_STATS` tel quel depuis
  l'échelle match entier ; biais mesuré (sur-estimation) jusqu'à +22% sur
  passes >1 et tirs à 3pts tentés >1 à l'échelle période, alors que les
  stats déjà en Poisson (fg3m/stl/blk/oreb) restent bien calibrées à ce
  grain. Piste : refaire le test empirique Poisson-vs-normale (même
  méthode que `test_overdispersion_ft.py`) spécifiquement à l'échelle
  période pour les 6 stats concernées (pts/reb/ast/fga/fg3a/min).
- **`team_blk.joblib` mal calibré** — écarts jusqu'à +12.3% (le pire point,
  seuil >4), pire que toutes les autres stats équipe du même script (sous
  8% d'écart). Pas un problème d'hyperparamètres (déjà retunés, sans
  effet) : suggère un manque de features utiles (profil défensif adverse,
  taille/mobilité des joueurs sur le terrain), jamais capturées
  actuellement.

## Chantier "paris personnalisés IA" — types encore non calculables

- **Paris « le joueur joue seulement N quarts-temps »** (ex. « Shai joue
  seulement 3 quart temps », constaté le 06/10/2026, pari `7db72374…`
  resté `is_calculable=false`, en validation manuelle). Cause vérifiée :
  `PERIOD_KEYWORD_REGEX` (`lib/ai/structureAndScoreBet.ts`) matche « quart
  temps » et route vers `handlePeriodBet`, qui attend une stat joueur
  limitée à une période (ou un résultat de période), pas un temps de jeu :
  `markNotCalculable()`, sans repli. Besoin décidé par l'utilisateur : en
  faire un type de pari avec son propre modèle à entraîner, pris en compte
  dans le calcul. Pas commencé. Pistes à instruire : définir « a joué un
  quart » (minutes > 0 par période ?), vérifier que
  `stats_box_scores_by_period` permet de le dériver, nouveau routage avant
  le filtre période, nouveau modèle dans `stats-service`, résolution
  automatique WON/LOST. En attendant, une formulation en minutes
  (« joue moins de N minutes ») est déjà calculable.
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
- **Nom de marque "Panier Ballon"** — direction de travail réévaluable,
  pas un choix figé (voir le cadrage business). Le logo, lui, est final
  depuis le 05/10/2026 (wordmark `public/brand/logo-*.svg`).

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

- **Aucun visuel de chargement à la soumission d'un pari personnalisé**
  (demandé par l'utilisateur, 06/09/2026) — `components/bets/BetForm.tsx`
  et `InlineBetForm.tsx` désactivent déjà le bouton pendant `isPending`
  (`useTransition`) mais le libellé reste statique ("Soumettre à
  validation"), aucun spinner ni changement de texte : la requête (appel
  Claude pour structurer le pari, pas instantané) peut donner l'impression
  que rien ne se passe. `components/ui/Spinner.tsx` existe déjà et est
  réutilisable tel quel.
- **Listes déroulantes qui ne passent pas au-dessus du reste de la page**
  (demandé par l'utilisateur, 06/09/2026 -- reproduit sur le Profil) --
  `components/profile/TeamPicker.tsx`/`.module.css` a pourtant déjà
  `position: absolute` + `z-index: 10` sur son `.list` (pensé dès le
  30/07/2026 pour flotter au-dessus, cf. commentaire dans le fichier) :
  le bug est donc un contexte d'empilement d'un ANCÊTRE qui piège ce
  z-index, pas un z-index manquant -- suspect principal, `.photo-page`
  (`app/globals.css`) pose `isolation: isolate` sur toute la page Profil.
  Vérifier aussi `components/chat/ChatNotificationToggle.module.css`
  (`.error`, même patron trigger + `position: absolute`) et refaire un
  grep large (`position: absolute` dans les `.module.css`, pas seulement
  ceux qui ont déjà un `z-index`) pour trouver d'éventuels autres menus
  du même genre encore non recensés.
- **Notifications/popup à la connexion** (résumé depuis la dernière visite,
  badges débloqués, actus) — retenue comme piste produit face à une
  mécanique récurrente, jamais cadrée ni codée.
- **Photo de profil** — validée comme principe côté DA mais explicitement
  "non tranché, à reprendre avant de coder" par le document source : bucket
  Supabase Storage à créer, format/taille, recadrage auto vs. manuel.
- **Ticker "en direct"** (`LiveTicker.tsx`, Jouer/Mes pronos, ne montre plus
  que les matchs IN_PROGRESS depuis le 06/10/2026) posé à
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
