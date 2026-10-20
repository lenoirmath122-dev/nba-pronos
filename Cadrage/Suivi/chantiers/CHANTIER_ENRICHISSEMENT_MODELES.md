# Chantier — enrichissement des modèles / types de paris

> **Nature** : vivant. Détail complet du chantier, sorti de
> `GAPS_OUVERTS.md` le 12/10/2026 (section « Retours de l'alpha › Couverture des types de paris », reprise telle quelle).
> **À ne lire que quand la session porte sur ce chantier (correctif Memphis, Lot 1 et suivants, instabilité des probas).** Le résumé des points ouverts et la
> prochaine étape restent dans `GAPS_OUVERTS.md` ; quand un point est
> traité, le retirer ici ET là-bas.

- **Couverture des types de paris** : le choix de la difficulté par le joueur
  est supprimé (09/10/2026, la difficulté est calculée ou fixée par l'admin).
  Reste : couvrir plus de types (modèles ML) et aider au choix.
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
       **Lot 0, avancement (09/10/2026)** : *C1* faite, peu de matière (43
       paris en base, 6 non calculables, un seul avec diagnostic : le pari
       Memphis ; mesure de couverture impossible tant que les joueurs ne
       soumettent pas de paris ; deux autres non calculables de l'alpha
       ressemblent à des trous de routage : « Trois joueurs en double double »,
       sans « au moins », même défaut que Memphis, et « Milwaukee ne gagne que le
       premier quart temps »). *Étape 2* faite : 6 paris joueur + seuil
       calculables résolus à la main (pas 7) : 5 sans `structured_player_id`
       (4 de la compétition « test » du 22/08, Brunson de l'alpha résolu le
       04/10), tous avant le correctif `resolveNotInMatchBets` du 05/10 (cause
       probable, non rejouée) ; Tatum avait un id et une proba de 1,7 %, résolu à
       la main à la clôture du 04/10, hypothèse : box score pas encore importé
       (stats.nba.com expirait alors), non vérifiée. *Cache* : option A
       (cache LRU borné en octets) retenue, **PR #154** (`feat/stats-model-cache`,
       à merger) ; mémoire Cloud Run montée à **2 Gi le 09/10/2026** (révision
       `nba-pronos-stats-00038-nxp`, `gcloud run services update`), avant le
       déploiement du code. Reste après le merge : lancer le workflow
       `deploy-stats-service.yml` (passe `--memory 2Gi` et
       `MODEL_CACHE_MAX_BYTES=1100000000`), lire `/cache-stats` (`hit_rate`,
       `rss_bytes`, ajuster `MODEL_CACHE_SIZE_FACTOR` et la borne), rejouer la
       reproduction de `CONSISTENCY_CHECK_NOTE` (50+ appels identiques, le cache
       fait partager le même objet aux essais de la vérification de cohérence).
       **Déployé le 09/10/2026** (run 37942807901, révision `00039-rsr`, 2 Gi,
       borne 1,1 Go). Premier test en production : 20 appels identiques à
       `/predict-total-points` (Memphis–Boston) -> 41 recherches de modèle, 1
       seul chargement (hit_rate 97,6 %), RSS 211 -> 252 Mo ; MAIS 3 valeurs
       différentes sur les 20 réponses (0,473 / 0,620 / 0,624) : l'instabilité de
       `CONSISTENCY_CHECK_NOTE` est toujours là avec un objet modèle unique en
       mémoire, ce qui indique qu'elle ne vient pas du rechargement des
       modèles. **Référence sans cache mesurée le même jour**
       (`MODEL_CACHE_MAX_BYTES=0`, révision `00040`, puis remise à 1,1 Go,
       révision `00041-9qn`) : les 3 MÊMES valeurs exactes (0,4727 / 0,6205 /
       0,6245) sur 20 appels, 41 chargements au lieu de 1, 4,7 s de chargement
       au lieu de 0,2 s. L'instabilité est donc antérieure au cache et
       indépendante de lui, à instruire à part (piste : données Supabase lues
       d'un appel à l'autre, pas les modèles). Latence : 10 s au 1er appel, 6,4 s médiane
       (surtout les requêtes Supabase, pas les modèles).
       Coupe-circuit : `MODEL_CACHE_MAX_BYTES=0`. Option B (alléger les modèles)
       reportée tant que la mémoire n'est pas un goulot.
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
     **Premier cas réel mesuré par le diagnostic (09/10/2026)** : « Un joueur
     de Memphis marque + de 25 points » (pari `f4f3ebd6…`, `UNKNOWN_TYPE`,
     route `GENERAL`, empreinte `439391119ea8`, squelette « un joueur de X
     marque + de N points », motif IA « aucun joueur précis nommé »). Cause
     vérifiée : `ROSTER_COUNT_KEYWORD_REGEX` exige « au moins/plus de/moins de/
     exactement » + UN mot + « joueurs » ; « un joueur de X » ne le matche pas,
     le texte tombe dans `GENERAL` et `structureBet` le refuse. Ce n'est PAS un
     trou de modèle : ROSTER_COUNT sait déjà compter sur une équipe
     (`scope=team1|team2`, `min_players=1`, `count_relation=AT_LEAST`). Correctif
     probable (Lot 1, très bon marché) : élargir la regex à « un/n'importe quel
     joueur de X », ajouter l'exemple au prompt de `structureRosterCountBet.ts`,
     test dans `structureAndScoreBet.test.ts`. Piège à traiter : « + de 25 »
     = strictement plus de 25 (décision « plus de X strict »), et les formes
     voisines (« un joueur de Memphis fait un double-double », « un joueur des
     Grizzlies marque 30 »). Ce pari reste à résoudre à la main par l'admin en
     attendant ; à rejouer une fois le correctif livré.
     [CODÉ le 20/10/2026 : points 1, 2 et 4 faits ; point 3 tranché : `OVER` est strict (`actual > threshold`, `computeOutcome`), « + de 25 » = `OVER 25`. Constat à part : « N ou plus » encodé `OVER N` est décalé de 1, non traité.] Plan d'origine (reprise, décidée le 09/10/2026) --
     correctif Memphis, une branche + une PR depuis `origin/main` (worktree,
     les docs du dépôt principal sont non commitées) :
     (1) `ROSTER_COUNT_KEYWORD_REGEX` (`lib/ai/structureAndScoreBet.ts`, ~l.160,
     branche de routage ~l.255) : ajouter « un joueur de/des/du <équipe> » et
     « n'importe quel joueur de <équipe> » (regex pure, gratuit, aucun appel IA) ;
     (2) `lib/ai/structureRosterCountBet.ts` : ajouter ton pari en exemple
     `calculable=true` du prompt (scope = équipe via team1/team2 du match,
     pool=ALL, stat=pts, seuil 25, OVER, min_players=1, AT_LEAST) ;
     (3) **à vérifier AVANT d'écrire** : comment « + de 25 » (strictement plus
     de 25, décision « plus de X strict ») se distingue de « 25 ou plus »
     dans le schéma ; les exemples actuels du prompt écrivent « 11 points ou
     plus » avec la même comparaison OVER, ne pas supposer ;
     (4) tests dans `lib/ai/structureAndScoreBet.test.ts` : cas qui routent
     (« Un joueur de Memphis marque + de 25 points », « n'importe quel joueur
     des Grizzlies… ») ET cas qui ne doivent pas changer (pari qui nomme un
     joueur, ex. « Ja Morant, un joueur de Memphis, marque… »).
     Limites : le pari doit être lié à un match où joue l'équipe (sinon refus
     propre) ; risque principal = capter trop de formulations. Optionnel dans la
     foulée : « Trois joueurs en double double » (même défaut, nombre sans
     « au moins »). Rejouer le pari `f4f3ebd6…` coûte un appel IA : demander
     d'abord. Ensuite : reste du Lot 1 (S4, S3, S8, S2...). **S1 livré le 20/10/2026 (PR #198)** : `pf` (modèle Poisson, colonne
     `stats_box_scores.pf`, joueur seulement) + `dreb`/`fgm`/`ftm`/`fta` composés (`_composed_distribution`).
     **S4 livré le 20/10/2026 (branche feat/lot1-s4-vainqueur-combo)** : pseudo-stat `win` (`COMBO_WIN_STAT`) dans la condition
     combo d'équipe (OVER = gagne, UNDER = perd, seule, sans seuil ; un vainqueur seul = combo à 1 condition). Proba via
     `home_win`, résolution par `matches.home_score/away_score`. Corrélation vainqueur × points d'équipe corrigée (normale
     bivariée recalée sur `p_home_win`, `_win_and_team_pts_joint`) ; autres stats (reb, ast, joueurs) restent en indépendance
     (limite connue, à reprendre avec S2). Reste de S4 : combo période + match entier. Cloud Run à redéployer après merge.
     **À part, autre conversation : instabilité des probas** (mesurée le
     09/10/2026, indépendante du cache) : mêmes 20 appels identiques à
     `/predict-total-points` Memphis–Boston -> 3 valeurs (0,4727 / 0,6205 /
     0,6245), avec ET sans cache. Piste non vérifiée : données Supabase lues
     d'un appel à l'autre, pas les modèles. Impact : la proba affichée au
     joueur fixe difficulté et points d'un pari. Script de mesure :
     `scripts/stats-service-smoke.py` (non commité, lit `STATS_SERVICE_SECRET` dans
     `.env.local` sans l'afficher). À faire avec l'`architect`, sans toucher la
     production.
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
