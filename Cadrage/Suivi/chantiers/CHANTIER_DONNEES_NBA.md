# Chantier — données NBA (crons, résultats, box scores, VM)

> **Nature** : vivant. Détail complet du chantier, sorti de
> `GAPS_OUVERTS.md` le 12/10/2026 (section « Plan de communication › crons, résultats, box scores », reprise telle quelle).
> **À ne lire que quand la session porte sur les crons, la VM `nba-refresh`, l'import des box scores ou les sources de données.** Le résumé des points ouverts et la
> prochaine étape restent dans `GAPS_OUVERTS.md` ; quand un point est
> traité, le retirer ici ET là-bas.

- **État constaté en prod le 28/10/2026** (les points datés plus bas sont
  l'historique) : poller VM passé en réel (les `FINISHED` viennent de lui,
  `sync-results` Highlightly les lui laisse), `watchdog-results-poll.yml` actif
  et vert, import des box scores réussi à chaque passage depuis le 18/10, tous
  les paris des matchs finis résolus, `teams.abbreviation` = `stats_equipes.tricode`
  pour les 30 équipes. Reste : facturation IPv4 de la VM, `pf` vides.

- **Crons GitHub Actions systématiquement en retard (09/10/2026)** : aucun
  récap reçu le 09/10 à 10h. Constat : `recaps.yml` (prévu 8h/9h UTC) a tourné
  vers 15h UTC les 06, 07 et 08/10 (la route répond « trop tard dans la
  journée » après 13h Paris), aucun run le 09/10 ; `daily-match-draw.yml`
  (5h/7h UTC) vers 11h30 UTC ; `heartbeat.yml` (6h UTC) vers 12h UTC.
  **Récap traité (PR #151)** : cron Vercel dans `vercel.json` (8h et 9h UTC) +
  variable Vercel `CRON_SECRET` (créée le 09/10) ; `recaps.yml` reste en
  secours. **Reste** : migrer `daily-match-draw.yml` de la même façon (la vraie
  compétition DAILY_MATCH démarre le 16/10 à 5h UTC, un tirage tardif décale la
  publication des matchs) ; les autres workflows planifiés (`heartbeat`,
  reminders, snapshot du classement) subissent le même retard. À vérifier le
  10/10 : ligne `recap_log` du 09 ou du 10/10 et logs du cron Vercel.

- **Match du jour : résultats et récap trop dépendants du planificateur GitHub
  (06/10/2026)** — test PR 5 fait le 06/10 (tirage + push au propriétaire OK).
  Constat : `sync-results.yml` est réglé à 30 min mais GitHub l'espace de
  plusieurs heures (runs à 07:10Z puis 14:21Z le 06/10), donc un résultat de
  match de nuit peut arriver tard côté joueur. **Traité par le poller de la VM** (PR #147/#148, déployé le 08/10 en dryRun ; PR C du 08/10 : repli Highlightly, watchdog, code de sortie 75). Reste à faire par l'utilisateur : merger la PR C, mettre à jour la VM (`git pull` + `install.sh`), observer 2 soirs en dryRun (checklist de `Cadrage/Stats/vm/DEPLOIEMENT_VM.md`), passer en réel (`RESULTS_POLL_DRYRUN=0`), puis seulement activer le watchdog `watchdog-results-poll.yml` (R2 sonnerait à tort en dryRun). Avant : une automatisation
  plus fiable des résultats pour le Match du jour (déclenchement serré autour
  du coup d'envoi/de la fin du match, ou planificateur plus ponctuel que le
  cron GitHub). À vérifier en même temps : les quotas de
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

- **Idée (non décidée, 07/10/2026) : remplacer Highlightly par la VM + l'API
  NBA pour le calendrier et les résultats.** Rien n'est engagé, c'est une
  piste notée. Aujourd'hui Highlightly fournit le calendrier (`sync-schedule`,
  1×/jour sur 4 jours), les scores (`sync-results`, cron 30 min) et le tirage
  du Match du jour (~9 appels/jour), avec un quota de 100 requêtes/jour ; la VM
  `nba-refresh` ne fournit que les box scores. *Principe* : la VM récupérerait
  aussi calendrier et résultats (`nba_api` ou les JSON publics `cdn.nba.com`,
  à tester : non vérifié) et écrirait dans les mêmes tables ; un timer
  systemd remplacerait le cron GitHub (espacé de plusieurs heures) ;
  `entity_mappings` accepte déjà plusieurs sources (nouveau `source_type`).
  *Gains* : une seule source (fin de la correspondance Highlightly ↔
  `nba_api`, tricodes compris), plus de quota ni de calendrier Highlightly
  incomplet (vide du 10/11 au 27/11 au sondage du 06/10, comblé au sondage du
  28/10 : 5 à 12 matchs NBA sur les 5 dates testées), résultats plus
  rapides. *Risques* : `nba_api` non officielle, sans garantie, endpoints
  modifiables ou bloquables sans préavis ; blocage par IP déjà constaté
  (GitHub, Cloud Run) et une seule VM = point de défaillance unique pour
  calendrier, résultats et résolution des paris ; usage commercial de `nba_api`
  à revoir (p8-3) ; mapping A7 de la Cup à faire quelle que soit la source ;
  VM sans recul (premier vrai import à la reprise de la saison) ; cas limites
  (reports, statuts, fuseaux NY/Paris) à retester. *Approche recommandée si on
  y va* : (1) tester si `cdn.nba.com` répond depuis GitHub Actions/Vercel (si
  oui, la VM n'est nécessaire que pour les box scores) ; (2) écrire une source
  NBA derrière la même interface que Highlightly et la faire tourner en mode
  ombre pendant la présaison/le Match du jour en comparant calendrier, scores
  et statuts ; (3) ne basculer qu'à écart nul, Highlightly gardé en repli.
  Décision actuelle inchangée : Highlightly reste en service (gratuit) pour
  calendrier/scores.
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
