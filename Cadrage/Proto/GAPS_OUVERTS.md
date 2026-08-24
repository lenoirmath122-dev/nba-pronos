# Gaps ouverts — NBA Pronos

> Liste vivante. Un point retiré = un point traité (voir JOURNAL_SESSIONS.md
> pour la trace de quand/comment). Ne pas laisser de points "résolus mais
> gardés pour mémoire" ici — c'est le rôle du journal.

> **Pertes de balle (tov), pas encore une stat pariable** -- trouvé par
> l'utilisateur en testant le 24/08/2026 ("Les Warriors font au moins 5
> pertes de balle" ne se calcule pas). Même situation que `oreb` avant son
> chantier "extension facile" du 23/08/2026 : la donnée brute existe déjà
> localement (`box_scores.tov`, `Cadrage/Stats/scripts/load_to_sqlite.py`
> -- récupérée depuis l'API NBA, jamais exposée), mais `tov` est absente de
> `STAT_CODES` (joueur) et `TEAM_STAT_CODES`/`MATCH_STAT_CODES` (équipe).
> Décidé avec l'utilisateur : pas fait maintenant, à reprendre plus tard --
> même patron mécanique que oreb (pipeline + modèle(s) + schéma IA +
> résolution) si repris.

> **Bug réel trouvé par l'utilisateur en testant "prolongation" le
> 24/08/2026, CORRIGÉ le jour même** : un pari auto-calculable affichait
> TOUJOURS "Pari joueur" (`PLAYER_PROP`), quel que soit son vrai
> `bet_subject` -- ex. "Le match ira en prolongation" (MATCH_TOTAL, aucun
> joueur) affiché comme pari joueur. Cause : `validated_category`
> recopiait `proposed_category` sans jamais le corriger --
> `proposed_category` est le défaut du formulaire de soumission
> (`DEFAULT_BET_CATEGORY="PLAYER_PROP"`, `lib/labels/bets.ts`), jamais
> aligné sur le `bet_subject` réel déterminé par l'IA (celui qui sert
> pourtant déjà à calculer la proba). Concerne TOUS les bet_subject
> auto-calculables, pas seulement `went_to_ot` -- présent depuis la 1ère
> auto-validation (Phase 5, 21/08/2026), jamais remarqué avant faute
> d'avoir eu plusieurs bet_subject différents à comparer côte à côte.
>
> **Corrigé** : nouveau paramètre `p_category` sur `update_bet_structuration()`
> (migration `20260824120000_bets_auto_category.sql`, poussée) --
> `validated_category = coalesce(p_category, v_proposed_category)`,
> uniquement dans la branche `calculable=true` (le repli manuel,
> `calculable=false`, ne touche jamais à la catégorie, l'admin garde la
> main comme avant). `structureAndScoreBet.ts` dérive `p_category` à
> chacun des 6 points d'appel : `PLAYER` (2 branches, y compris
> `not_in_match`) -> `PLAYER_PROP`, `TEAM_STAT` -> `TEAM_PROP`,
> `MATCH_TOTAL` -> `GAME_EVENT` si `went_to_ot`, sinon `SCORE_TOTAL`,
> `COMPARISON` -> `HEAD_TO_HEAD`, `COMBO` -> `MULTI_PLAYER_COMBO`.
> `tsc`/`eslint`/`vitest` (37/37)/`next build` propres. **Pas rétroactif**
> (même principe P10 déjà appliqué ailleurs) : les paris déjà validés
> avant ce déploiement gardent leur catégorie existante, potentiellement
> fausse -- pas corrigé en masse, hors scope de ce fix ponctuel.
>
> **Pas encore testé de bout en bout via l'appli après ce correctif**
> (nécessite un vrai pari soumis avec une vraie session utilisateur, pas
> testable en `service_role` -- `update_bet_structuration` vérifie
> `auth.uid()`).

> **Prolongation (overtime), CODÉE le 24/08/2026** (4e chantier de la liste
> des 429 paris, après comparaison/duel et combo -- voir les 2 entrées
> suivantes). Nouveau `bet_subject=MATCH_TOTAL`, `match_stat="went_to_ot"` :
> probabilité directe que LE match aille en prolongation, sans seuil ni
> comparaison (même absence que dd/td côté joueur).
>
> **Reformulation trouvée en scopant, AVANT de coder** : le cadrage initial
> (§ ci-dessous, "gros chantier d'infrastructure") supposait qu'il fallait
> synchroniser tout `play_by_play` vers Supabase -- **faux**. Le payload live
> Highlightly (`lib/nba/client.ts`, `state.score.homeTeam/awayTeam`) a déjà
> 5 valeurs au lieu de 4 en prolongation, jusqu'ici sommé puis jeté par
> `sumQuarters()`. Nouvelle fonction `wentToOvertime()` (même fichier, lit le
> même tableau une 2e fois) -- aucune synchro `play_by_play` nécessaire.
> Chantier ramené au tier "nouveau mécanisme réutilisable" (comme
> comparaison/combo), pas à l'infrastructure lourde.
>
> **Cible d'entraînement LOCALE** (`build_targets.py::build_matchs_training()`)
> dérivée de `play_by_play.period` (MAX > 4 = prolongation jouée) -- jamais
> synchronisé vers Supabase et pas nécessaire de l'y synchroniser : ce signal
> ne sert QU'à l'entraînement local, le signal de PRODUCTION vient de
> `wentToOvertime()` ci-dessus. NaN préservée (pas forcée à 0) si un
> `game_id` n'a pas de `play_by_play` -- en pratique 0 NaN sur les 6602
> lignes, couverture 100%. Taux de base réel : **5.01%** (confirme
> l'estimation ~5-8%).
>
> **Modèle** (`train_overtime_model.py`, nouveau, calque de
> `train_home_win_model.py`) : mêmes `BASE_FEATURE_COLS`/`FEATURE_COLS`
> (importés depuis `train_home_win_model.py`), `RandomForestClassifier`,
> PAS de `class_weight="balanced"` (précédent dd/td du 20/08/2026 :
> "balanced" casse la calibration sur un événement rare). Calibration par
> bucket resserrée vers le bas (comme `train_doubledouble_model.py`) --
> écarts 0.7-3.9pp, dans la fourchette déjà acceptée pour d'autres modèles
> "difficiles" du projet (total_points, team_blk...). Log loss/Brier à peine
> meilleurs que la référence taux constant (0.176 vs 0.175, 0.040 vs 0.040)
> -- attendu : la prolongation dépend surtout du déroulé EN JEU, peu
> prévisible depuis des features d'AVANT-match. `models/overtime.joblib`.
>
> **Instabilité numérique reproduite ICI AUSSI, sur un CLASSIFIEUR PUR cette
> fois** -- l'hypothèse de départ du plan ("jamais observée sur home_win,
> seulement régression+norm.cdf") s'est avérée FAUSSE en testant : 1 appel
> sur 9 a renvoyé une proba différente (0.083 au lieu de 0.052) lors de la
> vérification manuelle. `compute_overtime_proba()` enveloppée dans
> `_compute_with_consistency_check()` comme tous les autres modèles
> (`compute_home_win_proba()`, lui, n'est toujours PAS enveloppé -- jamais
> exposé en HTTP direct, utilisé seulement en interne par la simulation de
> série -- pas retouché ici, hors scope).
>
> **Service Python** : `_compute_overtime_proba_once()`/
> `compute_overtime_proba()` (`supabase_context.py`), réutilise
> `_build_match_feature_row()` tel quel. Nouvel endpoint `/predict-overtime`
> (`app.py`), même contrat que `/predict-total-points` moins seuil/
> comparaison.
>
> **Migration** `20260824110000_matches_went_to_ot.sql` (poussée) :
> `matches.went_to_ot boolean`, colonne simple peuplée par la synchro
> (`lib/sync/results.ts::processOneMatch()`, `wentToOvertime()` ajoutée au
> diff `hasChanged` ET à l'`update()`) -- pas de RPC à étendre (contrairement
> aux colonnes `bets.structured_*`). **Pas de backfill de l'historique** :
> nouveau type de pari, aucun pari existant n'en dépend.
>
> **Schéma IA** : `matchStatCodes.ts` gagne `went_to_ot` + nouveau
> `NO_THRESHOLD_MATCH_STATS` (même principe que `NO_THRESHOLD_STATS` côté
> joueur) -- `match_total.threshold`/`comparison` passent de non-nullable à
> nullable dans `structureBet.ts` (même patron que `player.threshold`/
> `comparison` pour dd/td). `structureAndScoreBet.ts` : garde symétrique à
> celle du joueur + 3e branche du ternaire de prédiction
> (`predictOvertime()`, nouveau dans `statsService.ts`, PAS de seuil/
> comparaison à transmettre).
>
> **Résolution** (`resolveCalculableMatchTotalBets()`, étendue) : filtre
> élargi `total_points`/`went_to_ot` (`structured_stat`), branche dédiée
> `went_to_ot` (lit `matches.went_to_ot` directement, pas de seuil à
> comparer) à côté de la branche `total_points` existante inchangée. Les
> autres stats `total_X` (reb/ast/fg3m/stl/blk/oreb) continuent de passer
> par `resolveCalculableTeamStatBets()`, pas concernées ici.
>
> Testé en conditions réelles à chaque étape (Boston Celtics vs Los Angeles
> Lakers) : appels HTTP locaux réels (`uvicorn`, `/predict-overtime` +
> régression `/predict-total-points` bit-identique), 4 vrais appels Claude
> Sonnet 5 (went_to_ot correct, total_points régression, fun rejeté, dd
> régression) + chaîne complète structuration→`predictOvertime()`→service
> Python vérifiée de bout en bout (script jetable, `server-only` retiré
> temporairement le temps du test puis remis). `tsc`/`eslint`/`vitest`
> (37/37)/`next build` (38 routes) propres.
>
> **Pas encore redéployé sur Cloud Run (2e redéploiement nécessaire, après
> celui de duel/combo). Pas testé en conditions réelles depuis l'appli.**
> Reste, dans l'ordre du chantier 429 paris : % tir équipe, puis
> l'infrastructure quart-temps (le vrai gros morceau, 47 paris).

> **Combo multi-conditions, CODÉ le 24/08/2026** (3e chantier de la liste
> des 429 paris, après comparaison/duel -- voir 2 entrées plus bas pour les
> 4 paliers de faisabilité). Nouveau `bet_subject=COMBO` : ET de N
> conditions (TOUTES doivent être vraies), chaque condition étant un
> joueur/somme de joueurs/équipe + 1 ou plusieurs stats sommées + seuil +
> comparaison.
>
> **Même jour : refactor du schéma IA en objets IMBRIQUÉS** (`player`/
> `team_stat`/`match_total`/`comparison_bet`/`combo_bet`, un par
> `bet_subject`, au lieu de champs à plat à la racine) + **cache de
> prompt** -- décidés ensemble AVANT de coder combo (voir échange avec
> l'utilisateur), appliqués aux 4 `bet_subject` existants ET au nouveau :
> - Motif : le schéma plat était déjà à 13 champs nullable/union après le
>   chantier duel (compressé dans l'urgence depuis 19, rejeté une fois par
>   l'API -- "too many parameters with union types... limit: 16"). COMBO a
>   besoin d'un TABLEAU de conditions (inexprimable proprement à plat) --
>   le même mur allait revenir, et se reproduirait à chaque futur
>   `bet_subject`.
> - Vérifié empiriquement (vrais appels API) avant de choisir cette
>   direction : un objet NULLABLE à la racine ne compte que pour 1 dans la
>   limite, quel que soit le nombre de champs NON-nullable à l'intérieur.
>   Résultat : 6 champs racine au lieu de 13+, marge pour plusieurs
>   chantiers futurs (période, etc.). Bénéfice collatéral : les champs
>   surchargés faute de place (`threshold` servant à la fois de seuil, de
>   multiplicateur GT et de borne DIFF_LT ; `comparison` portant OVER/UNDER
>   ET GT/DIFF_LT) retrouvent chacun leur propre champ nommé.
> - **Cache de prompt** (`cache_control: {type: "ephemeral"}` sur le bloc
>   STATIQUE du system prompt -- instructions + listes de stats + LE SCHÉMA,
>   automatiquement inclus par l'API sans cache_control séparé sur
>   `output_config`, vérifié empiriquement) : TTL 5 minutes (défaut SDK),
>   choisi explicitement par l'utilisateur malgré des horaires de paris
>   étalés sur la journée ("on part sur le cache 5 min et on verra après"
>   -- 1h envisagé, discuté, reporté). Vérifié sur 12 vrais appels
>   consécutifs (cf. plus bas) : 1er appel écrit 4688 tokens en cache,
>   les 11 suivants les LISENT (0 nouvelle écriture), quel que soit le
>   match/pari -- confirme le calcul théorique de ~80% de réduction du
>   coût d'entrée effectif.
>
> **Service Python** (`supabase_context.py`) : `_condition_proba()` (1
> condition) dispatché en 2 chemins -- SIMPLE (1 entité, 1 stat) réutilise
> TEL QUEL `compute_proba()`/`_compute_team_stat_proba_once()` (couverture
> complète : régression, dd/td, pourcentages ft/fg/fg3, AUCUN nouveau code
> de calcul) ; SOMME (2+ entités et/ou 2+ stats, ex. PRA "25pts+12reb+8pas"
> ou cumul multi-joueurs) réutilise `_resolve_weighted_operand()`, généralisé
> depuis `_resolve_comparison_operand()` (chantier duel) pour sommer
> PLUSIEURS stats en plus de PLUSIEURS joueurs -- restreint aux stats
> comptées (REGRESSION_STATS), même raison que le duel. `_compute_combo_proba_once()` :
> produit des probas de chaque condition (INDÉPENDANCE entre conditions
> assumée -- documentée, pas cachée). Nouvel endpoint `/predict-combo`.
>
> **Résolution** (`resolveCalculableComboBets()`, nouveau, migration
> `20260824100000_bets_structured_combo.sql`) : même dispatch simple/somme
> que côté prédiction -- une condition simple réutilise TEL QUEL
> `computeOutcome()` (déjà éprouvée, gère dd/td/pourcentages/comptées),
> une condition somme additionne les colonnes brutes. Court-circuite dès
> la 1ère condition FAUSSE (combo perdu, pas besoin d'attendre les stats
> des conditions suivantes).
>
> **3 cas exclus explicitement** (comme le duel, pour qu'on les reprenne
> facilement) :
> 1. **Conditions ET/OU imbriquées** (ex. "triple-double AVEC 40pts ET
>    (20reb OU 20pas)") -- extension naturelle du MÊME mécanisme combo
>    (schéma/logique à étendre, pas un système différent) -- à reprendre
>    si ça s'avère fréquent en usage réel.
> 2. **"Au moins N joueurs remplissent une condition"** (comptage sur tout
>    le roster) -- regroupé avec "meilleur marqueur du match" (déjà
>    reporté au chantier duel) : même mécanique de simulation sur tout le
>    roster nécessaire pour les deux, à traiter ensemble.
> 3. **Titulaires / % tir équipe** -- toujours bloqués par des données
>    manquantes (colonne titulaire absente, agrégation tirs équipe non
>    construite), chantier d'infrastructure à part, indépendant de
>    combo/duel.
>
> **4e cas trouvé EN TESTANT (pas prévu au cadrage)** : un joueur nommé
> dans un pari COMPARISON ou COMBO mais absent des 2 équipes du match fait
> tomber calculable=false (repli manuel), alors qu'un pari PLAYER simple
> dans le même cas reste calculable avec proba forcée à 0% (mécanisme
> `not_in_match`, décidé le 21/08/2026). Le mécanisme `not_in_match`
> n'existe QUE sur `player` -- ni `comparison_bet`, ni `combo_bet` n'ont
> d'équivalent pour signaler QUEL joueur précis est hors match. Comportement
> actuel SÛR (repli manuel, jamais un résultat faux) mais sous-optimal
> (un cas auto-calculable à 0%/100% de façon triviale retombe sur la
> validation manuelle). Concerne aussi COMPARISON (chantier précédent,
> jamais remarqué faute d'avoir testé ce cas précis à l'époque). Pas
> corrigé maintenant (ajouterait des champs juste après avoir compressé le
> schéma) -- à soupeser lors d'un futur passage sur COMPARISON/COMBO :
> soit un champ `not_in_match_players: string[]` par objet, soit une
> vérification côté `structureAndScoreBet.ts` (lister tous les joueurs
> nommés, vérifier leur équipe via le même mécanisme que PLAYER, avant même
> d'appeler le service).
>
> Testé en conditions réelles à chaque étape (Lakers vs Celtics) : appels
> HTTP locaux réels sur `/predict-combo` (simple, PRA, cumul multi-joueurs,
> dd/td mêlé à une stat comptée, mix joueur+équipe, rejet stat non
> supportée), régression `/predict-comparison` bit-identique. 12 vrais
> appels Claude Sonnet 5 couvrant les 5 `bet_subject` + les 2 exclusions +
> la vérification du cache (résultats ci-dessus). `tsc`/`eslint`/
> `vitest`(37/37)/`next build` propres.
>
> **Pas encore redéployé sur Cloud Run. Pas testé en conditions réelles
> depuis l'appli.**

> **Comparaison/duel, CODÉ le 24/08/2026** (2e chantier de la liste des 429
> paris, après les extensions "faciles" -- voir entrée suivante pour le
> détail des 4 paliers de faisabilité). Nouveau `bet_subject=COMPARISON` :
> compare 2 côtés entre eux plutôt que contre un seuil fixe.
>
> **Cadrage posé avant de coder** (2 décisions confirmées avec
> l'utilisateur) :
> 1. Scope réduit au "duel simple" (joueur vs joueur, joueur vs somme de
>    joueurs, équipe vs équipe, avec multiplicateur) -- "meilleur marqueur
>    du match" (vs le MAX de tous les autres joueurs, nécessite une
>    simulation Monte Carlo) repoussé en 2e sous-pièce, pas fait.
> 2. **2 cas explicitement exclus** (non automatisables) : "contre SUR un
>    joueur précis" (donnée play-by-play absente du pipeline) et "égalité
>    EXACTE entre ≥2 joueurs" (mécanisme combinatoire différent). L'IA les
>    rejette nativement (calculable=false), vérifié en conditions réelles.
> 3. Stockage : nouvelle colonne `bets.structured_duel jsonb` (PAS
>    `structured_comparison`, déjà pris -- colonne texte OVER/UNDER
>    existante) -- migration `20260824090000_bets_structured_duel.sql`,
>    `update_bet_structuration()` étendue (`p_structured_duel`).
> 4. Approximation statistique : différence normale (moyG - k×moyD,
>    écart-type = √(scaleG²+(k×scaleD)²)) -- INDÉPENDANCE entre les 2 côtés
>    assumée (aucune corrélation modélisée), et approximation normale même
>    pour les stats Poisson (fg3m/stl/blk/oreb -- la vraie différence de 2
>    Poisson suit une loi de Skellam, pas utilisée en V1, confirmé avec
>    l'utilisateur).
>
> **Service Python** (`supabase_context.py`) : `_player_stat_mean_scale()`/
> `_team_stat_mean_scale()` -- cœur de `compute_proba()`/
> `_compute_team_stat_proba_once()` extrait SANS l'étape finale
> `norm.cdf(seuil,...)` (un duel compare 2 moyennes avant de connaître un
> seuil). `_player_current_team_id()` (nouveau -- résout l'équipe ACTUELLE
> d'un joueur nommé depuis sa ligne `stats_box_scores` la plus récente,
> nécessaire pour déduire `is_home`, une vraie feature des modèles joueur).
> `_resolve_comparison_operand()` (1 joueur, somme de joueurs, ou équipe --
> même formule pour 1 ou N joueurs) + `_compute_comparison_proba_once()`
> (combine les 2 côtés). Limité aux stats COMPTÉES (`REGRESSION_STATS`) --
> pas dd/td/ft/fg/fg3 (aucun exemple réel de duel sur ces stats).
>
> **Nouvel endpoint** `/predict-comparison` (`app.py`) : `left`/`right`
> (`kind` PLAYER/TEAM + `joueurs`/`equipe`+`stat`), `relation` (GT/DIFF_LT),
> `multiplier`, `threshold`, `equipe_domicile`/`equipe_exterieur` (contexte
> du VRAI match, même contrat que `/predict-team-stat`).
>
> **Schéma IA** : `bet_subject` gagne `COMPARISON`. **Piège réel trouvé en
> testant** (pas en cadrant) : le 1er jet du schéma (champs séparés
> `comparison_left_kind`/`comparison_left_team`/`comparison_relation`/
> `comparison_multiplier`) portait le total de champs nullable/union du
> schéma à 19 -- l'API Claude a rejeté l'appel ("too many parameters with
> union types... limit: 16"). Compressé à 13 en fusionnant `kind`+`team`
> (`comparison_*_kind` vaut directement `"team1"`/`"team2"` plutôt qu'un
> champ équipe séparé), en réutilisant le champ `comparison` existant pour
> porter GT/DIFF_LT (au lieu d'un `comparison_relation` à part), en
> réutilisant `threshold` pour le multiplicateur GT, et en rendant les
> tableaux de joueurs non-nullable (tableau vide plutôt que null).
> Nouveau fichier `comparisonCodes.ts` (listes de stats valides par côté,
> réutilisées par le prompt ET par la validation runtime).
>
> **Résolution** (`resolveCalculableComparisonBets()`, nouveau) : lit
> `structured_duel` (pas `structured_stat`/`structured_team_id` -- filtre
> `.not("structured_duel", "is", null)`), somme la vraie stat sur TOUS les
> `player_ids` d'un côté joueur (1 ou N, même geste), même résolution
> d'équipe NBA que `resolveCalculableTeamStatBets()` pour un côté équipe.
>
> Testé en conditions réelles à chaque étape (Lakers vs Celtics) : 7 appels
> HTTP locaux réels (joueur vs joueur, joueur vs somme, équipe vs équipe,
> écart borné, multiplicateur, duel cross-stat blk/stl, rejet équipe hors
> match), 8 vrais appels Claude Sonnet 5 (les 5 formes + 2 rejets attendus
> + 1 régression PLAYER). `tsc`/`eslint`/`vitest`(37/37)/`next build`
> propres.
>
> **Pas encore redéployé sur Cloud Run. Pas testé en conditions réelles
> depuis l'appli.** Reste à faire : "meilleur marqueur du match" (Monte
> Carlo), puis les 2 chantiers suivants de la liste (combos
> multi-conditions, infrastructure quart-temps).

> **Nouveau chantier cadré le 23/08/2026 : `types_de_paris_playoffs_2026.md`
> fourni par l'utilisateur** -- 429 paris personnalisés réels répartis en 12
> catégories, pour étendre l'auto-calcul au-delà de ce qui existait. Analyse
> de faisabilité faite AVANT de coder quoi que ce soit (vérification factuelle
> de ce que le pipeline de données supporte réellement, pas une supposition) :
> - **Déjà couvert** : paris joueur simples (12 stats), total_points, les 5
>   stats équipe reb/ast/fg3m/stl/blk (2 formes).
> - **Extension mécanique du patron existant ("faciles", faites ce jour --
>   voir entrée suivante)** : `team_pts`, `fga`/`fg3a` (tentatives joueur),
>   `oreb` (rebonds offensifs, 3 formes).
> - **Nouveau mécanisme réutilisable** : comparaison/duel (36 paris, P(A>B)
>   entre 2 entités -- **duel simple CODÉ le 24/08/2026** ; "meilleur
>   marqueur du match" = vs le reste des joueurs, PAS ENCORE FAIT), combos
>   multi-conditions (PRA, double-condition, cumuls multi-joueurs, ~30
>   paris -- **ET simple CODÉ le 24/08/2026, voir 2 entrées au-dessus** ;
>   OU imbriqué et comptage sur le roster PAS ENCORE FAIT),
>   % tir équipe (7 paris, agrégation attempts/makes équipe à construire),
>   prolongation (7 paris, classifieur binaire à construire depuis
>   `play_by_play.period`, jamais synchronisé vers Supabase actuellement).
> - **Gros chantier d'infrastructure, PAS ENCORE FAIT** : pari "période"
>   (47 paris, quarts-temps/mi-temps -- AUCUNE donnée par quart-temps
>   côté Supabase, seulement un `play_by_play` local jamais poussé),
>   titulaires/banc (~10 paris, colonne `position` présente dans les CSV
>   NBA bruts mais jetée dès l'ETL `load_to_sqlite.py`, rien en base),
>   filtres nominaux (nationalité, initiale du nom -- connaissance externe
>   non présente dans les données), événements rares (fautes techniques,
>   blessures, buzzer beater, temps morts -- données absentes du pipeline).
> - **Non automatisable par design** (le doc le confirme déjà) : "Aucun
>   pari" (15), "Fun/hors terrain" (14), "Invalide/impossible" (5),
>   "Ambigu" (2) = 36 paris à rejeter tels quels, rien à faire.
>
> Décidé avec l'utilisateur : on commence par les extensions faciles
> (ci-dessous), puis on enchaîne dans l'ordre croissant de complexité
> (comparaison/duel -> combos multi-conditions -> infrastructure
> quart-temps), sans rien écarter.

> **Extensions "faciles" -- team_pts / fga+fg3a / oreb, CODÉES le
> 23/08/2026** (types_de_paris_playoffs_2026.md, voir entrée au-dessus) :
>
> **1. `team_pts`** (catégorie "Points équipe") : il manquait la perspective
> own/opp d'UNE équipe précise (`total_points` ne couvrait que le combiné
> domicile/extérieur). `pts` ajoutée à `TEAM_TARGET_STATS` (`build_targets.py`)
> -> `pts_reel` dans `entrainement_equipe`. Nouveau modèle `team_pts.joblib`
> (`train_team_stats_model.py`, R²=0.124, calibration 0.6-5.1pp). Piège
> trouvé et corrigé : `pts_pour/contre_moy5/10` étaient DÉJÀ dans
> `BASE_FEATURE_COLS` (utilisées par home_win/total_points depuis le début)
> -- `_team_stat_base_cols()`/`feature_cols_for()` dédupliquent maintenant
> au lieu de dupliquer la colonne (aurait cassé `X[feature_cols]`). PAS de
> `total_pts` (forme combinée) : `total_points` fait déjà ce travail --
> 2 listes séparées côté `app.py` (`TEAM_STAT_CODES` vs
> `TOTAL_TEAM_STAT_CODES`) pour ne pas planter sur un stat valide d'un côté
> mais absent de l'autre.
>
> **2. `fga`/`fg3a`** (catégorie "Tentatives joueur", ex. "Tyrese Maxey tente
> plus de 7 tirs à 3 points") : les moyennes `fga_moy5/10`/`fg3a_moy5/10`
> existaient déjà (utilisées en interne par les modèles de %), juste pas
> exposées comme stat à seuil pariable. Ajout de `fga_ecarttype10`/
> `fg3a_ecarttype10` (`build_features.py`), entrées dans `REGRESSION_STATS`
> (`tester_modele.py`, réutilisé tel quel par `supabase_context.py` --
> AUCUN changement de logique de service nécessaire, juste la déclaration).
> `fga.joblib`/`fg3a.joblib` (`train_stat_model.py`, R²=0.611/0.528,
> calibration 0.1-2.8pp / 0.1-7.5pp).
>
> **3. `oreb`** (catégorie "Rebonds offensifs équipe", LES 3 FORMES : joueur
> précis, équipe précise, combiné match) -- le plus gros morceau des 3,
> seul à nécessiter une vraie extension de schéma Supabase :
>    - **Migration `20260823210000_stats_box_scores_oreb.sql`** (poussée) :
>      `stats_box_scores.oreb integer` -- donnée déjà présente EN LOCAL
>      (`box_scores.oreb`, jamais répliquée vers Supabase jusqu'ici, choix
>      de conception délibéré à l'origine : "table volontairement allégée
>      aux seules colonnes lues par build_context()"). PAS de `dreb` ajouté
>      (aucun pari "rebonds défensifs" dans la liste fournie).
>    - **`refresh_daily.py`** (futurs matchs) et **`backfill_supabase.py`**
>      (historique) mis à jour pour propager `oreb` -- backfill complet
>      relancé (140016 lignes stats_box_scores re-seedées, upsert donc
>      rejouable), vérifié en conditions réelles (0 valeur NULL après coup).
>    - Pipeline local généralisé partout où `pts`/`reb`/etc. l'étaient déjà :
>      `TEAM_COUNTING_STATS`/`TEAM_TARGET_STATS` (+oreb, généralisation
>      automatique côté équipe), `ecarttype_cols`/`PLAYER_SCHEMA` (+oreb côté
>      joueur), `MATCH_FEATURE_COLS` (oubliée au 1er passage -- piège trouvé
>      en conditions réelles : `entrainement_matchs`/`entrainement_equipe` ne
>      contenaient pas encore `oreb_pour_moy5` au moment du 1er entraînement,
>      `build_targets.py` corrigé et relancé avant de reprendre).
>    - **3 modèles entraînés** : `oreb.joblib` (joueur, Poisson -- comme
>      fg3m/stl/blk, même profil "événement rare", calibration 0.2-1.4pp,
>      vérifié empiriquement AVANT de généraliser Poisson, pas supposé) ;
>      `team_oreb.joblib` (équipe précise, own/opp, R²=0.060, calibration
>      1.1-7.1pp) ; `total_oreb.joblib` (combiné match, R²=0.031, calibration
>      0.3-4.4pp).
>    - `build_team_context()`/`build_context()` (`supabase_context.py`,
>      Supabase) ET leurs équivalents locaux (`tester_modele.py`, SQLite --
>      utilisé par la CLI de test) étendus en parallèle, mêmes colonnes.
>
> **Schéma IA** : `STAT_CODES` (+fga/fg3a/oreb), `TEAM_STAT_CODES`
> (+pts/oreb), `MATCH_STAT_CODES` (+total_oreb) -- aucun changement
> structurel requis côté `structureBet.ts` (déjà généralisé depuis les
> listes de codes). `resolveCalculableBets.ts` : `COUNTING_STAT_COLUMN`
> (+fga/fg3a/oreb, résolution paris JOUEUR) et `TEAM_STAT_RESOLUTION_LABELS_FR`
> (+pts/oreb) étendus.
>
> Testé en conditions réelles à chaque étape (Lakers vs Celtics) : appels
> directs `supabase_context`, HTTP local réel (uvicorn, tous les nouveaux
> endpoints + regression `reb`/`total_points` bit-identiques), 9 vrais
> appels Claude Sonnet 5 (fga/fg3a/oreb dans les 3 formes + régressions
> pts/total_points/triple-double/joueur-hors-match). Un cas a déclenché
> l'instabilité numérique rare déjà connue (`team_oreb`, 1 essai sur ~10-15,
> CONSISTENCY_CHECK_NOTE) -- refusé correctement par le garde-fou existant,
> 3 retries suivants cohérents entre eux (confirmé transitoire, pas un
> problème propre à oreb). `tsc`/`eslint`/`vitest` (37/37)/`next build`
> propres.
>
> **Pas encore redéployé sur Cloud Run. Pas testé en conditions réelles
> depuis l'appli.**

> **Pièce (a) suite -- AST/FG3M/STL/BLK D'ÉQUIPE, CODÉES le 23/08/2026**
> (généralisation de la pièce rebonds ci-dessous, comme annoncé dans sa
> propre note "généralisation prête" -- même patron mécanique, éprouvé une
> 3e fois) :
>
> **1. Pipeline de données** (`build_features.py`/`build_targets.py`) :
> `TEAM_COUNTING_STATS = [pts, reb, ast, fg3m, stl, blk]` généralise
> `build_team_games()`/`add_team_rolling_features()` (boucle au lieu de
> colonnes figées) -- 16 nouvelles colonnes `{stat}_pour/contre_moy5/10`
> dans `TEAM_SCHEMA`/`TEAM_TABLE_COLUMNS`. `TEAM_TARGET_STATS`/
> `TEAM_TARGET_STATS` généralisent les cibles réelles (`entrainement_matchs`
> home/away/total, `entrainement_equipe` `{stat}_reel`) en boucle. Vérifié :
> `features_equipe` 13204 lignes, `entrainement_matchs` 6602,
> `entrainement_equipe` 13204 -- valeurs plausibles spot-check (ast~25,
> fg3m~12, stl~7, blk~5).
>
> **2. 4×2 modèles entraînés** (nouveaux scripts `train_total_team_stats_model.py`/
> `train_team_stats_model.py`, boucle `STATS_TO_TRAIN` -- `train_total_rebounds_model.py`/
> `train_team_rebounds_model.py` restent les scripts dédiés reb, pas touchés,
> pas fusionnés) : `total_ast/fg3m/stl/blk.joblib` (R² 0.20/0.14/0.05/0.04),
> `team_ast/fg3m/stl/blk.joblib` (R² 0.16/0.12/0.05/0.05 -- `team_blk` calibration
> la plus faible, 10-13pp d'écart aux seuils bas, cohérent avec les limites
> déjà connues des stats "événement rare" côté joueur -- accepté comme
> limite v1).
>
> **3. `supabase_context.py` généralisé** : `build_team_context()` calcule
> désormais `{stat}_pour/contre` pour TOUTES les `TEAM_COUNTING_STATS` (plus
> seulement reb). Les 4 fonctions dédiées rebonds
> (`_compute_total_rebounds_proba_once`/`compute_total_rebounds_proba`/
> `_compute_team_rebounds_proba_once`/`compute_team_rebounds_proba`)
> **remplacées** (pas gardées en doublon) par des versions génériques
> paramétrées par `stat` (`_team_stat_base_cols`,
> `compute_total_team_stat_proba`, `compute_team_stat_proba`) -- reb passe
> maintenant par ces mêmes fonctions génériques (`stat="reb"`), vérifié
> bit-identique à avant (même proba 0.2173 sur un cas test répété).
>
> **4. 2 nouveaux endpoints génériques** (`app.py`) :
> `/predict-total-team-stat`/`/predict-team-stat` (champ `stat`, validé
> contre `TEAM_STAT_CODES` côté service, 400 clair sinon) -- remplacent
> l'usage TS des anciens `/predict-total-rebounds`/`/predict-team-rebounds`
> dédiés pour TOUTES les stats désormais (reb inclus), mais ces 2 derniers
> restent déployés tels quels (contrat HTTP déjà en prod, inoffensif de les
> garder, appellent en interne les mêmes fonctions génériques).
>
> **5. Schéma IA étendu** : `TEAM_STAT_CODES`/`MATCH_STAT_CODES` gagnent
> `ast`/`fg3m`/`stl`/`blk` (et `total_ast`/`total_fg3m`/`total_stl`/`total_blk`)
> -- aucun changement structurel requis côté `structureBet.ts` (déjà
> généralisé depuis les listes de codes, pas de valeurs figées).
>
> **6. `statsService.ts` généralisé** : `predictTotalRebounds` (dédiée)
> **supprimée**, remplacée par `predictTotalTeamStat(stat, ...)` (endpoint
> générique) pour les 5 stats ; `predictTeamStat` gagne un paramètre `stat`
> (même généralisation). `structureAndScoreBet.ts` mis à jour aux 2 points
> d'appel (`match_stat`/`team_stat` transmis comme `TeamStatCode`).
>
> **7. Résolution généralisée** : `resolveCalculableReboundsBets()`
> **renommée** `resolveCalculableTeamStatBets()` (comme annoncé dans la note
> "généralisation prête" ci-dessous) -- filtre désormais sur
> `TEAM_STAT_CODES.flatMap(stat => [stat, total_${stat}])`, logique
> `if`/`in` généralisée (`isTotal`/`stat` dérivés de `structured_stat`,
> `.select(stat)` dynamique au lieu de `.select("reb")` figé). `/api/resolve-bets`
> mis à jour (import renommé).
>
> Testé en conditions réelles à chaque étape (Boston vs Lakers) : les 10
> nouvelles prédictions Python (appel direct `supabase_context` + HTTP local
> uvicorn réel sur les 2 nouveaux endpoints + regression `/predict-team-rebounds`
> dédié, proba identique), 10 cas d'extraction IA (vrais appels Claude
> Sonnet 5 : ast/fg3m/stl/blk × {équipe précise, combiné}, + 4 régressions
> joueur/total_points/reb/rejet-série-cumulée). `tsc`/`eslint`/`vitest`
> (37/37)/`next build` propres. **Pas encore redéployé sur Cloud Run**
> (utilisateur en train de redéployer la pièce reb en parallèle -- ce
> generalisation nécessite un 2e redéploiement pour être active en prod).
> **Pas testé en conditions réelles depuis l'appli.**

> **Pièce (a) suite -- REBONDS D'ÉQUIPE, CODÉE le 23/08/2026, les 2 FORMES**
> (GAPS_OUVERTS.md, décidé avec l'utilisateur : "les deux ! ça dépendra de
> l'énoncé") -- 1ère extension du chantier paris équipe au-delà de
> `total_points`, généralise directement à ast/fg3m/stl/blk plus tard (même
> geste à chaque étape, détaillé ci-dessous) :
>
> **1. Pipeline de données étendu** (`build_features.py`/`build_targets.py`) :
> - `build_team_games()`/`add_team_rolling_features()` : `reb_pour_moy5/10`,
>   `reb_contre_moy5/10` ajoutées, même patron EXACT que `pts_pour`/`pts_contre`
>   (swap team_id<->opponent_team_id). Colonnes ajoutées à `TEAM_SCHEMA`/
>   `TEAM_TABLE_COLUMNS` (oubli facile -- `to_sql` silencieux si absent de
>   la liste).
> - `entrainement_matchs` (`build_matchs_training()`) : `home_reb`/`away_reb`/
>   `total_reb` ajoutés (cibles RÉELLES depuis `box_scores`, pas les moyennes
>   glissantes de `features_equipe`).
> - **Nouvelle table `entrainement_equipe`** (`build_team_perspective_dataset()`)
>   -- 1 ligne par (match, équipe), perspective **"own"/"opp"** (PAS domicile/
>   extérieur) : nécessaire pour "CETTE équipe aura 45+ rebonds", qui doit
>   rester valide que l'équipe reçoive ou se déplace -- `own_is_home` devient
>   une feature EXPLICITE, pas un axe figé comme pour `home_win`/`total_points`
>   (ceux-là ont besoin de savoir QUI reçoit, celui-ci non). Basée directement
>   sur `features_equipe` (déjà 1 ligne par (match, équipe)), pas sur
>   `entrainement_matchs`. 13204 lignes (= 6602 matchs × 2).
>
> **2. 2 modèles entraînés** :
> - `train_total_rebounds_model.py` (`total_reb.joblib`) -- symétrique,
>   MÊME patron que `train_total_points_model.py` (domicile/extérieur),
>   mais avec les 4 features rebonds en plus des 21 `BASE_FEATURE_COLS`
>   (contrairement à `total_points`, la tendance au rebond de chaque équipe
>   est directement prédictive ici). R² 0.050, MAE 7.17 (cible bruitée,
>   attendu).
> - `train_team_rebounds_model.py` (`team_reb.joblib`) -- perspective
>   own/opp, entraîné sur `entrainement_equipe`. Features : `own_is_home` +
>   `BASE_FEATURE_COLS`+4 dupliquées `own_*`/`opp_*` (51 au total). R² 0.103,
>   MAE 5.19. Feature la plus importante : `own_reb_pour_moy10` (tendance
>   propre au rebond), puis `opp_reb_contre_moy10` (rebonds concédés par
>   l'adversaire) -- cohérent.
>
> **3. Refactor `supabase_context.py` pour partager le contexte entre
> modèles** : `build_team_context()` calcule désormais AUSSI `reb_pour`/
> `reb_contre` (utilisé par home_win/total_points ou pas -- les clés en
> trop sont juste ignorées par ces 2-là). `_build_match_feature_row()`
> gagne un paramètre `base_cols` (défaut `BASE_FEATURE_COLS`) au lieu d'un
> `FEATURE_COLS` figé -- `home_win`/`total_points` passent `BASE_FEATURE_COLS`
> explicitement (comportement inchangé), `compute_total_rebounds_proba()`
> passe `TOTAL_REB_BASE_COLS` (liste élargie). `compute_team_rebounds_proba()`
> réutilise `build_team_context()` deux fois (own/opp, même mécanique que
> home/away) + `is_home` fourni explicitement par l'appelant (contexte RÉEL
> du match visé, pas un choix arbitraire).
>
> **4. 2 nouveaux endpoints** (`app.py`) : `/predict-total-rebounds` (même
> contrat que `/predict-total-points`), `/predict-team-rebounds` (nouveau
> contrat : `equipe`/`adversaire`/`equipe_domicile` au lieu de
> `equipe_domicile_serie`/`equipe_exterieur_serie`).
>
> **5. Schéma IA étendu, 2 nouveaux fichiers de codes** : `matchStatCodes.ts`
> gagne `total_reb` (déjà là pour `total_points`) ; nouveau `teamStatCodes.ts`
> (`TEAM_STAT_CODES`, juste `"reb"` pour l'instant) -- volontairement
> SÉPARÉ de `matchStatCodes.ts` (une stat combinée symétrique et une stat
> visant une équipe précise ne partagent aucun invariant). `bet_subject`
> gagne `"TEAM_STAT"` (en plus de `PLAYER`/`MATCH_TOTAL`), nouveaux champs
> `team_stat_team`/`team_stat` (même patron que `player_team`/`player_stat`,
> mais pour une équipe). Testé avec 5 vrais appels Claude Sonnet 5 : équipe
> précise OVER, équipe précise UNDER, combiné total_reb, combiné
> total_points (non-régression), pari joueur (non-régression). 5/5.
>
> **6. VRAI MANQUE DE CONCEPTION comblé avant de coder la résolution** :
> rien ne mémorisait QUELLE équipe un pari TEAM_STAT vise -- ni `structured_player_id`
> (paris joueur), ni les 2 équipes du match (symétrique pour MATCH_TOTAL) ne
> suffisaient. **Migration `20260823140000_bets_structured_team_id.sql`**
> (poussée) : nouvelle colonne `bets.structured_team_id uuid references
> teams(id)`, `update_bet_structuration()` étendue (`p_structured_team_id`,
> tous les points d'appel de `structureAndScoreBet.ts` mis à jour, y compris
> PLAYER/MATCH_TOTAL avec `null`).
>
> **7. Résolution (`resolveCalculableReboundsBets()`, nouvelle)** :
> contrairement à `total_points` (direct via `matches.home_score`/
> `away_score`), les rebonds n'existent PAS sur `matches` -- seulement dans
> `stats_box_scores` (pipeline Data NBA). Réutilise `resolveNbaGameId()`
> (déjà éprouvée côté joueur) + nouvelle `resolveNbaTeamId()` (même
> rapprochement par tricode, pour retrouver l'équipe NBA numérique depuis
> `structured_team_id`). Câblée en parallèle des 3 autres resolvers dans
> `/api/resolve-bets`.
>
> Testé en conditions réelles à chaque étape (Boston vs Lakers) : les 2
> modèles Python (HTTP local), les 5 cas d'extraction IA (vrais appels
> Claude). `tsc`/`eslint`/`vitest` (37/37)/`next build` propres. **Pas
> encore redéployé sur Cloud Run** (action de l'utilisateur) -- à faire
> avant de tester un vrai pari rebonds depuis l'appli. **Pas testé en
> conditions réelles depuis l'appli** (comme pour les pièces précédentes,
> à confirmer par l'utilisateur après déploiement).
>
> Généralisé à ast/fg3m/stl/blk le même jour (23/08/2026, même patron
> mécanique) -- voir l'entrée au-dessus.

> **Cadrage posé le 23/08/2026, PAS CODÉ -- prêt à construire la prochaine
> fois** : pièce (a) du chantier paris série (modèle ÉQUIPE, pour étendre
> l'auto-calcul aux paris équipe/total -- jusqu'ici réservé aux 12 stats
> JOUEUR, pièces a0-e toutes closes). Décidé avec l'utilisateur :
> 1. **Un seul modèle pour commencer : `total_points`** (score combiné du
>    match, `home_score + away_score`) -- pas les autres paris équipe
>    (rebonds équipe, marge de victoire...) pour l'instant. Données déjà
>    prêtes : `entrainement_matchs` (`build_targets.py`) a déjà la cible
>    (`total_points`) ET les mêmes features équipe `home_*`/`away_*` que
>    celles qui ont servi à entraîner `home_win` (pièce a0) -- même patron
>    d'entraînement déjà éprouvé (`train_home_win_model.py`), juste une
>    régression (`RandomForestRegressor`, même famille que les 8 modèles
>    joueur régression existants) au lieu d'une classification.
> 2. **Scope MATCH seul pour commencer, pas SÉRIE** -- même si l'exemple
>    d'origine de l'utilisateur qui a motivé tout ce chantier était en
>    SÉRIE ("un match de la série dépassera 200 points"). MATCH est la
>    brique de base nécessaire avant de pouvoir faire "au moins une fois
>    sur la série" (même schéma de reprise que a0 -> pièce (c) : modèle
>    MATCH d'abord, extension SÉRIE ensuite en réutilisant le mécanisme déjà
>    construit pour les paris joueur).
> 3. **Changement de schéma d'extraction IA plus lourd que pour les autres
>    pièces** : un pari `total_points` n'a PAS de joueur -- `structureBet.ts`
>    (`BetStructurationSchema`) est aujourd'hui entièrement construit autour
>    d'un joueur+stat. Décidé : nouveau champ `bet_subject: "PLAYER" |
>    "MATCH_TOTAL"` plutôt que d'ajouter `"total_points"` aux 12
>    `STAT_CODES` joueur existants -- ces 12 codes restent PUREMENT joueur
>    (l'invariant "1 stat code = 1 calcul par joueur" est utilisé partout
>    ailleurs, Python `compute_proba()`/`STATS_DISPONIBLES` inclus, le
>    casser pour un seul cas particulier aurait fragilisé tout le reste).
>    Quand `bet_subject="MATCH_TOTAL"` : `player_name`/`player_team` toujours
>    `null`, `stat` vient d'une liste séparée (juste `"total_points"` pour
>    l'instant, extensible proprement plus tard).
> 4. **Résolution (pièce e étendue)** : comme prévu dès la cadrage initial
>    du chantier série -- directe via `matches.home_score`/`away_score`
>    (déjà synchronisés par le sync existant), PAS besoin du pipeline Data
>    NBA pour vérifier après coup (seulement pour prédire avant match).
> 5. **Service Python** : nouvel endpoint dédié (`/predict-total-points` ou
>    équivalent), même patron que `/predict`/`/predict-series`.
>
> **CODÉE ET TESTÉE le 23/08/2026 (même session, suite immédiate), les 5
> étapes prévues** :
> - (i) `train_total_points_model.py` : même démarche que
>   `train_home_win_model.py`, réutilise `BASE_FEATURE_COLS`/`FEATURE_COLS`
>   TELS QUELS (pas `MATCH_FEATURE_COLS` brut de `build_targets.py`, qui
>   inclut les 2 colonnes toujours NULL déjà exclues pour `home_win` -- une
>   seule liste "quelles features comptent pour un match", pas de
>   divergence). Régression + résidu normal (même recette que
>   `train_stat_model.py`), sans dispersion par équipe (aucun équivalent de
>   `{stat}_ecarttype10` calculé pour les équipes à ce jour) -- repli sur
>   l'écart-type global. Entraîné : 5216 lignes, MAE 15.3, R² 0.115 (cible
>   difficile, bruit inhérent au score combiné -- calibration correcte,
>   écarts 1-5 points sur les seuils 190-250).
> - (ii) `compute_total_points_proba()` (`supabase_context.py`) : réutilise
>   `build_team_context()` tel quel via un nouveau helper partagé
>   `_build_match_feature_row()` (factorisé depuis `compute_home_win_proba()`,
>   même vecteur de features pour tout futur modèle MATCH). Contrairement à
>   `compute_series_stat_proba()`, l'inversion OVER/UNDER (1-proba) est SÛRE
>   ici (prédiction à l'échelle d'UN match, pas une agrégation sur une
>   série).
> - (iii) Endpoint `/predict-total-points` (`app.py`), même patron que
>   `/predict`/`/predict-series`.
> - (iv) `structureBet.ts` : nouveau champ `bet_subject`
>   ("PLAYER"/"MATCH_TOTAL") + `match_stat` (liste séparée, `"total_points"`
>   seul pour l'instant) -- `stat` renommé `player_stat` pour clarté.
>   `structureAndScoreBet.ts` reçoit désormais aussi `matchId` (jusqu'ici pas
>   transmis du tout), branche entièrement séparée pour MATCH_TOTAL (aucun
>   joueur à résoudre) -- nouvelle fonction `resolveMatchTeams()` (équipes
>   RÉELLES du match précis via `matches.home_team_id`/`away_team_id`, PAS
>   `series.team1_id`/`team2_id` qui ne garantit pas le même ordre) ;
>   `as_of_date` = date RÉELLE du match visé (plus fidèle que "aujourd'hui",
>   possible ici car un match précis a une date connue, contrairement à un
>   pari série). Testé avec 4 vrais appels Claude Sonnet 5 : score combiné
>   -> MATCH_TOTAL correct, pari joueur -> PLAYER inchangé (non-régression),
>   marge de victoire -> `calculable=false` correct (hors périmètre), total
>   cumulé sur une série -> `calculable=false` correct (garde explicite
>   ajoutée au prompt, cohérente avec la limite déjà actée pour les paris
>   joueur série). 4/4.
> - (v) `resolveCalculableMatchTotalBets()` (`resolveCalculableBets.ts`),
>   câblée en parallèle des 2 autres resolvers dans `/api/resolve-bets`.
>   Directe via `matches.home_score`/`away_score` (déjà synchronisés),
>   aucune dépendance au pipeline Data NBA pour résoudre -- même prudence
>   que les 2 autres resolvers (jamais de LOST sur un score pas encore
>   synchronisé).
>
> **Instabilité numérique (déjà trouvée pour la pièce (d)) reproduite ICI
> AUSSI, avec un SEUL modèle cette fois** -- l'hypothèse "seulement en
> combinant 2 modèles différents" (notée lors de la pièce (d)) était donc
> INCOMPLÈTE. Diagnostic affiné : le vecteur de features est bit-identique
> entre 2 appels, la prédiction brute du modèle ne varie qu'à la 13e
> décimale (bruit flottant négligeable) -- pourtant la proba finale peut
> différer de ~0.007 après passage dans `norm.cdf`. Cause exacte toujours
> pas identifiée. Mitigation déjà construite pour la pièce (d)
> **généralisée** : `_compute_with_consistency_check()`, réutilisée par
> `compute_series_stat_proba()` ET `compute_total_points_proba()` (et
> disponible pour tout futur modèle équipe) plutôt que dupliquée.
>
> Testé en conditions réelles contre la vraie base (Boston vs Lakers,
> `total_points > 220`) : ~38.6% (moyenne prédite 215.4 ± 15.9), stable
> après la mitigation, OVER+UNDER somment bien à 1.0 (prédiction à
> l'échelle d'un seul match). `tsc`/`eslint`/`vitest` (37/37)/`next build`
> propres. **Pas encore redéployé sur Cloud Run** (action de l'utilisateur,
> `gcloud` absent de cet environnement) -- à faire avant de tester un vrai
> pari MATCH_TOTAL depuis l'appli. Paris équipe/total en scope SÉRIE,
> et tout pari équipe autre que `total_points` (rebonds équipe, marge de
> victoire...), restent hors périmètre -- chantiers séparés si repris plus
> tard.

> **Cadrage posé le 23/08/2026, PAS CODÉ -- prêt à construire la prochaine
> fois** : paris SÉRIE (Playoffs uniquement -- en NBA Cup une "série" est
> un seul match, donc pas concernée), suite à la Phase 6 (résolution
> automatique, scope volontairement limité aux paris MATCH). Discussion
> complète avec l'utilisateur, résumée ici pour reprise directe :
>
> 1. **Constat de départ** : la structuration IA (`structureAndScoreBet.ts`)
>    ne distingue déjà PAS scope MATCH/SERIES aujourd'hui -- un pari série
>    calculable est déjà auto-validé avec une proba, mais cette proba est
>    celle du PROCHAIN match du joueur (le service n'a aucune notion de
>    série), pas une vraie proba "sur la série".
> 2. **Ce n'est pas qu'un problème d'agrégation joueur** -- l'utilisateur a
>    donné un exemple concret bien plus large : "un match de la série va
>    dépasser les 200 points au total" -- un pari ÉQUIPE/TOTAL COMBINÉ, une
>    catégorie qu'aucun des 12 modèles actuels (tous joueur) ne sait
>    calculer, indépendamment du scope MATCH/SERIES. Précisé ensuite par
>    l'utilisateur : les paris série peuvent porter sur N'IMPORTE QUEL type
>    de stat (y compris joueur, comme aujourd'hui) -- la seule différence
>    est "sur la série" plutôt que "sur le prochain match". L'agrégation
>    "sur la série" est donc un mécanisme GÉNÉRIQUE, à construire une seule
>    fois, qui enveloppera n'importe quel modèle (les 12 existants ET de
>    futurs modèles équipe).
> 3. **Trouvaille utile** : `build_targets.py` génère déjà une table
>    `entrainement_matchs` (via `build_matchs_training()`) avec une colonne
>    `total_points` (= `home_score + away_score`, déjà calculée) ET des
>    features équipe riches (`home_*`/`away_*` -- pts marqués/encaissés
>    moy5/10, pace, ratings off/def, `home_win`, `ecart`) -- **jamais
>    utilisée par aucun script `train_*.py` existant**. Prête à l'emploi
>    pour un futur modèle `total_points`, et `home_win` est prête pour un
>    futur modèle "probabilité de victoire par match" (bonus : débloquerait
>    aussi un pari "vainqueur de la série" calculable).
> 4. **Le vrai nœud technique, soulevé par l'utilisateur** : le nombre de
>    matchs N d'une série varie de 4 à 7 selon l'issue -- affecte SEULEMENT
>    la PROBA affichée avant/pendant la série (P(au moins un match dépasse
>    X) = 1-(1-p)^N nécessite de connaître N), PAS la résolution (une fois
>    la série terminée, on sait exactement combien de matchs ont été joués,
>    on vérifie juste les vrais matchs réels). Calculer N proprement
>    demanderait un modèle de probabilité de victoire PAR MATCH comme
>    prérequis (pour dériver la distribution de la longueur de série) --
>    chantier en soi.
> 5. **Décidé avec l'utilisateur** : simplifier d'abord plutôt que construire
>    le modèle de victoire en prérequis. Règle proposée : **N = nombre de
>    matchs déjà PROGRAMMÉS (connus) pour la série au moment du pari**
>    (les matchs "si nécessaire" 5-7 n'existent souvent pas encore comme
>    lignes `matches` tant que la série n'y est pas arrivée) -- **figé à la
>    validation du pari, jamais recalculé après** (même principe P10 déjà
>    appliqué en Phase 5). Sous-estimation possible si la série se
>    prolonge, mais un chiffre réel plutôt qu'une hypothèse inventée
>    (rejeté : N=7 fixe arbitraire).
>
> **REVU juste après (même session, 23/08/2026)** : discussion complémentaire
> avec l'utilisateur sur la longueur de série, qui **remplace** la
> simplification `p=0,5` du point 5 ci-dessus par une approche plus fidèle,
> décidée avec l'utilisateur :
> - La distribution de la longueur d'une série (4 à 7 matchs) suit un
>   modèle probabiliste connu (loi binomiale négative / combinatoire
>   classique des séries best-of-N), PAS un problème de machine learning en
>   soi -- donné `p` (proba de victoire à un match), la formule est exacte.
>   Cas connu p=0,5 (équipes égales) : 12,5%/25%/31,25%/31,25% pour
>   4/5/6/7 matchs (espérance ≈5,8 matchs) -- utile comme repère/vérification
>   contre les vraies longueurs de séries historiques déjà en base, mais
>   PAS comme valeur de départ retenue (voir ci-dessous).
> - Idée initiale de l'utilisateur (moyenne historique de la longueur des
>   séries) écartée : une moyenne unique écrase la différence entre un
>   affrontement déséquilibré (série courte probable) et un duel serré
>   (série longue probable).
> - **Décidé avec l'utilisateur : construire le modèle de proba de victoire
>   PAR MATCH d'abord, plutôt que démarrer avec p=0,5 fixe** -- l'utilisateur
>   veut un système fidèle à la forme réelle des équipes dès le départ,
>   pas une version approximative à corriger plus tard. Prérequis déjà
>   identifié comme prêt (`entrainement_matchs`, `home_win`, point 3
>   ci-dessus) : prédit qui gagne LE PROCHAIN MATCH (pas directement la
>   série) -- la formule/le calcul ci-dessus s'en sert ensuite pour remonter
>   au niveau série (longueur ET vainqueur de la série, en bonus).
> - **Domicile/extérieur, signalé comme important par l'utilisateur** :
>   `entrainement_matchs` structure déjà ses features en `home_*`/`away_*`
>   séparément (données prêtes, rien à construire de plus), donc l'avantage
>   du terrain est nativement une dimension du modèle de victoire par match.
>   Conséquence sur le CALCUL de longueur de série : le format best-of-7
>   connu à l'avance (2-2-1-1-1, qui reçoit à quel match) implique un `p`
>   DIFFÉRENT pour chaque match restant selon qui reçoit -- pas une formule
>   fermée à un seul `p` constant, mais un calcul récursif match par match
>   (simple à implémenter, juste pas une formule à une ligne). Plus fidèle
>   qu'un `p` moyen unique appliqué à tous les matchs restants.
>
> **Pièce a0 CODÉE ET VÉRIFIÉE le 23/08/2026** (même session) :
> `Cadrage/Stats/scripts/train_home_win_model.py` (modèle, `models/
> home_win.joblib`) + `series_probability.py` (calcul récursif) --
> vérifié exact contre le résultat classique connu (p=0,5) et testé sur
> un vrai affrontement. Détail complet : `projet-data-nba.md` §37. Retire
> la pièce a0 de la liste des pièces manquantes ci-dessous.
>
> **BLOQUANT du 23/08/2026 -- ENTIÈREMENT LEVÉ le 23/08/2026 (suite, même
> session reprise)** : pour utiliser le modèle `home_win` en PRODUCTION, la
> table Supabase `stats_box_scores` n'avait ni `team_id` ni les 4 stats
> avancées équipe (`off_rating`/`def_rating`/`net_rating`/`pace`). Les 4
> étapes prévues ont toutes été codées, poussées et vérifiées en conditions
> réelles :
> 1. **Migration Supabase** (`20260823090000_stats_box_scores_team_advanced.sql`)
>    : `team_id`, `off_rating`, `def_rating`, `net_rating`, `pace` + index
>    `(team_id, game_date desc)`. Poussée (`npx supabase db push`) -- au
>    passage, un vrai écart d'état trouvé et corrigé : la migration
>    `20260822130000` était déjà appliquée sur la base réelle mais absente de
>    l'historique de suivi (probable reliquat d'un push manuel après un
>    blocage classifieur antérieur) -- réparé via `supabase migration repair
>    --status applied` (aucun SQL rejoué), puis push normal.
> 2. **`backfill_supabase.py`** étendu (5 colonnes ajoutées au SELECT,
>    toutes déjà dispo localement dans `box_scores`/`box_scores_advanced`) et
>    relancé en entier -- 140 016/140 016 lignes vérifiées remplies après
>    coup (requête directe Supabase, pas juste le code de sortie du script).
> 3. **`refresh_daily.py`** mis à jour pour continuer à alimenter ces 5
>    colonnes à chaque rafraîchissement quotidien (`STATS_BOX_SCORE_TRAD_
>    COLUMNS` + `box_adv_rows`).
> 4. **Contexte équipe à la volée** : nouvelles fonctions `build_team_context()`
>    / `compute_home_win_proba()` dans `service/supabase_context.py`,
>    équivalent Supabase de `build_team_games()`/`add_team_rolling_features()`/
>    `compute_roster_continuity()` (`build_features.py`), réduites à UNE SEULE
>    équipe par appel (2 requêtes filtrées `team_id=X`/`opponent_team_id=X`,
>    aucune jointure). Simplification propre à l'inférence en direct (par
>    opposition à l'entraînement) : **`is_home` n'est PAS dans les 21
>    features du modèle** (déjà exclu à l'entraînement, trou de données) et
>    **aucun `shift(1)`** n'est nécessaire (tous les matchs récupérés sont
>    déjà joués, le match à prédire n'existe pas encore en base).
>
> **Testé en conditions réelles contre la vraie base** (Boston vs Lakers,
> saison 2025-26, matchs déjà connus) : `build_team_context()` →
> `compute_home_win_proba()` → `series_probability.simulate_series()` bout en
> bout, résultat cohérent (~78% Boston, longueur moyenne 5,6 matchs). Garde-
> fou vérifié aussi : `compute_home_win_proba()` refuse explicitement (erreur
> claire) si une équipe n'a pas encore joué la saison ciblée (`continuite_
> effectif_saison` NaN par construction dans ce cas, testé avec la saison
> 2026-27 pas encore commencée). `tsc --noEmit` propre sur l'app Next.js
> (fichiers Python, aucun impact dessus). **Pas encore fait** : câblage dans
> `service/app.py` (endpoint dédié) -- pas demandé cette session, la pièce
> a0 + le contexte équipe suffisaient à lever CE bloquant précis. Reste
> ouvert pour la pièce (c) (mécanisme générique d'agrégation "sur la série")
> et les pièces (a)/(d)/(e) listées plus haut.
>
> **Sémantique du pari série ambigu -- TRANCHÉE avec l'utilisateur le
> 23/08/2026** : "au moins une fois sur la série" (proba qu'un événement se
> produise sur AU MOINS UN des matchs réellement joués -- cohérent avec
> l'exemple total_points de l'utilisateur). Les 2 autres options ("en
> moyenne sur la série", "au prochain match précis" = pari MATCH déguisé)
> écartées.
>
> **Pièce (c) -- mécanisme générique d'agrégation "sur la série" -- CODÉE ET
> TESTÉE le 23/08/2026** : `simulate_series_with_stat()`
> (`scripts/series_probability.py`, extension de `simulate_series()` --
> DP sur l'état (victoires A, victoires B, stat déjà arrivée ?)) +
> `compute_series_stat_proba()` (`service/supabase_context.py`), qui
> wrappe N'IMPORTE LEQUEL des 12 modèles joueur existants via
> `compute_proba()` SANS AUCUNE logique spécifique à une stat -- seule la
> combinaison avec l'issue de la série est nouvelle. **2e décision tranchée
> la même session** : fidèle domicile/extérieur (comme le modèle
> d'équipe), pas une seule proba moyenne -- `p_stat_home`/`p_stat_away` du
> joueur combinées à `p_a_home`/`p_a_away` de l'équipe via une DP qui
> suppose résultat du match et stat du joueur INDÉPENDANTS (aucune
> corrélation modélisée, hypothèse assumée). Vérifié : cas limites
> (p_stat=0/1) + cross-check EXACT contre la formule fermée `1-(1-p)^N`
> marginalisée sur la distribution de longueur quand domicile=extérieur
> (doit coïncider dans ce cas précis, coïncide). Testé en conditions
> réelles contre la vraie base (Jayson Tatum "30+points" vs Lakers,
> saison 2025-26) : ~5%/match → ~24,7% sur la série, cohérent avec la
> longueur moyenne (~5,6 matchs).
>
> **6 pièces identifiées pour le pipeline complet** (a0 et (c) FAITES) :
> (a0, FAIT 23/08) modèle de proba de victoire PAR MATCH (`home_win`,
> domicile/extérieur inclus) + calcul récursif de la longueur/du vainqueur
> de série ; (a) modèle(s) équipe (ex. `total_points`, entraînable dès
> maintenant sur `entrainement_matchs`, indépendant de a0) ; (b) contexte
> équipe roulant en production (FAIT 23/08, `build_team_context()`) ; (c,
> FAIT 23/08) le mécanisme générique d'agrégation "sur la série" ; (d, FAIT
> 23/08) extraction IA étendue pour les paris série JOUEUR (équipe/total
> reste hors périmètre, pièce (a) pas construite) ; (e, FAIT 23/08, pas
> encore testé en conditions réelles -- voir plus bas) résolution étendue
> (`resolveCalculableBets.ts` : gère `scope=SERIES` en cherchant TOUS les
> vrais matchs déjà joués de la série, pas un seul ; gérer les paris
> non-joueur via `matches.home_score`/`away_score` reste à faire quand (a)
> existera). **Reste à construire : (a)** (modèle(s) équipe, pour étendre
> le chantier aux paris équipe/total).
>
> **Pièce (d) -- CODÉE, TESTÉE (vrais appels Claude), DÉPLOIEMENT PAS ENCORE
> FAIT le 23/08/2026** :
> - `service/app.py` : nouvel endpoint `/predict-series` (wrappe
>   `compute_series_stat_proba()`) -- même contrat de réponse que `/predict`
>   (`{proba, label, joueur_id, ...}`), reçoit `equipe_domicile_serie`/
>   `equipe_exterieur_serie`/`equipe_joueur` (noms, résolus côté service via
>   `find_team()`, même patron que `/predict` pour l'adversaire).
> - **Bug réel trouvé avant même de coder l'endpoint** : `Dockerfile` du
>   service Cloud Run ne copiait que `tester_modele.py` -- pas
>   `build_features.py`/`train_home_win_model.py`/`series_probability.py`,
>   dont dépendent `build_team_context()`/`compute_home_win_proba()` (déjà
>   mergées la session précédente). Si redéployé tel quel, ces fonctions
>   auraient planté au chargement. Corrigé.
> - **Détermination de l'équipe à l'avantage du terrain** : pas de "seed"
>   explicite dans le schéma -- dérivée du VRAI match 1 de la série
>   (`matches.game_number = 1`, `home_team_id` réel). Si ce match n'existe
>   pas encore en base (série pas programmée), le pari reste non-calculable
>   (repli déjà établi partout ailleurs dans ce fichier).
> - `lib/ai/structureBet.ts` : nouveau champ `player_team` ("team1"/"team2")
>   dans `BetStructurationSchema` -- l'IA indique désormais QUELLE équipe le
>   joueur représente (pas seulement s'il joue dans le match), nécessaire
>   pour router vers la bonne équipe côté service. Testé avec 3 vrais appels
>   Claude Sonnet 5 (Tatum -> team1, LeBron -> team2, pari équipe/total ->
>   `calculable=false` inchangé, piece (a) toujours hors périmètre) --
>   3/3 corrects.
> - `lib/ai/structureAndScoreBet.ts` : reçoit désormais `scope` (transmis
>   depuis `submitBet()`, `lib/actions/bets.ts`) -- branche vers
>   `predictSeriesStat()` (nouveau, `statsService.ts`) si `scope="SERIES"`,
>   sinon comportement MATCH inchangé (`predictOverUnder()`).
> - **Correctif important trouvé en concevant, PAS en testant** : contrairement
>   à `predictOverUnder()` (MATCH, `1-proba` après coup pour UNDER),
>   inverser le résultat final serait FAUX à l'échelle d'une série
>   (`P(au moins un match UNDER) != 1 - P(au moins un match OVER)`, 2
>   événements différents). `compute_series_stat_proba()` inverse la proba
>   PAR MATCH (1-p) puis refait tourner la simulation de série -- vérifié en
>   conditions réelles (Tatum "30+points" UNDER vs Lakers : ~95%/match ->
>   ~99.9998% sur la série, très différent du calcul naïf 1-24.7%=75.3%
>   qu'aurait donné le patron MATCH).
> - **Instabilité réelle et rare trouvée en testant** (~1 fois sur 10-15
>   appels, entrées identiques -> résultats différents, ex. `p_a_wins_series`
>   0.7940 au lieu de 0.7799) : isolée par élimination à la combinaison
>   complète de `compute_series_stat_proba()` (2 modèles `.joblib`
>   différents utilisés dans le même calcul -- `home_win` ET le modèle
>   joueur) ; ni les features équipe seules, ni `compute_home_win_proba()`
>   seul, ni `compute_proba()` joueur seul ne reproduisent le problème sur
>   8-10 essais chacun. Forcer `n_jobs=1` sur les modèles n'a PAS éliminé le
>   problème (hypothèse "race du pool joblib" écartée). Cause exacte non
>   trouvée avec un effort raisonnable (probablement une interaction bas
>   niveau scikit-learn/BLAS entre 2 modèles différents dans le même
>   process). **PAS un bug introduit par ce chantier** : la même
>   architecture sert déjà en production pour les paris MATCH -- `compute_
>   series_stat_proba()` est juste le 1er endroit à combiner 2 modèles dans
>   un seul calcul. **Mitigation ajoutée** (`supabase_context.py`) :
>   `compute_series_stat_proba()` recalcule jusqu'à 3 fois et ne renvoie un
>   résultat que si au moins 2 essais s'accordent (tolérance 1e-6) -- lève
>   une erreur explicite plutôt qu'une proba silencieusement fausse. Détail
>   complet en commentaire `CONSISTENCY_CHECK_NOTE` dans le fichier.
> - Testé bout en bout via HTTP réel (service lancé en local, `uvicorn`) :
>   `/predict-series` OVER et UNDER, cohérent, stable sur 10+ appels après
>   la mitigation.
> - **Redéploiement Cloud Run FAIT par l'utilisateur (23/08/2026)** --
>   `/predict-series` revérifié en HTTP réel sur le VRAI service déployé
>   (pas juste en local) : résultat identique au test local (~24,8%),
>   mitigation de cohérence active en production.
>
> **Pièce (e) -- résolution automatique des paris série, CODÉE le
> 23/08/2026, PAS ENCORE TESTÉE EN CONDITIONS RÉELLES** (aucun pari série
> calculable n'existe encore en base -- la pièce (d) vient d'être construite,
> aucun faux pari inséré exprès pour tester, l'utilisateur veut tout tester
> ensemble en soumettant un vrai pari) :
> - `resolveCalculableSeriesBets()` (`lib/ai/resolveCalculableBets.ts`),
>   appelée en parallèle de `resolveCalculableBets()` (MATCH) depuis
>   `/api/resolve-bets`. Réutilise TELLES QUELLES `resolveNbaGameId()`/
>   `computeOutcome()`/`recomputeBet()`, déjà éprouvées en prod pour MATCH --
>   seule la logique d'agrégation par série est neuve.
> - Sémantique "au moins une fois" : dès qu'UN match réellement joué de la
>   série satisfait le seuil, le pari est gagné IMMÉDIATEMENT (pas besoin
>   d'attendre la fin de la série). Si aucun hit, résolu LOST SEULEMENT si
>   `series.official_status = 'FINISHED'` (plus aucun match à venir) ET que
>   tous les matchs FINISHED de la série ont bien une ligne `stats_box_scores`
>   pour ce joueur -- même prudence que le resolver MATCH : jamais trancher
>   sur une absence de donnée, le pari reste en attente plutôt qu'un LOST à
>   tort.
> - `tsc`/`eslint`/`vitest` (37/37) propres. **Pas testé en conditions
>   réelles** (voir ci-dessus) -- à vérifier à la prochaine soumission d'un
>   vrai pari série calculable, une fois une série concernée terminée.
> - Paris équipe/total (non-joueur) toujours hors périmètre -- piece (a)
>   pas construite, la mention `matches.home_score`/`away_score` de la
>   description initiale de cette pièce reste à faire le jour où (a) existe.
> - **Chantier "paris série" (a0/(b)/(c)/(d)/(e)) considéré COMPLET pour
>   les paris JOUEUR** -- reste (a) modèle(s) équipe pour étendre aux paris
>   équipe/total (ex. `total_points`), hors périmètre demandé cette session.
>
> **Test réel effectué (23/08/2026) : 1er vrai pari série soumis depuis
> l'appli, révèle une LIMITE DE PÉRIMÈTRE réelle (PAS un bug)** -- "Doncic
> marquera + de 100 points sur la série" a été rejeté par l'IA
> (`calculable=false`, reasoning : *"Pari sur total série (plusieurs matchs),
> pas un seuil par match unique"*). Vérifié en reproduisant l'appel Claude en
> isolation, comportement confirmé volontaire, pas une panne technique
> (aucune erreur dans les logs Vercel de la même fenêtre). **2 formes de
> pari série existent en français, toutes deux naturelles, mais SEULE la
> 1ère est gérée** :
> 1. **"Au moins une fois"** (construit, pièces c/d/e) : UN match de la
>    série dépasse un seuil -- ex. "un match dépassera 200 points au total"
>    (l'exemple d'origine de l'utilisateur qui a motivé la sémantique).
> 2. **"Cumulé sur la série"** (PAS construit) : la SOMME sur tous les
>    matchs dépasse un seuil -- ex. "Doncic marquera 100+ points sur la
>    série", "il aura 30+ rebonds sur la série". Demanderait un calcul
>    statistique différent (distribution d'une somme de plusieurs matchs,
>    avec un nombre de matchs LUI-MÊME aléatoire, cf. `series_probability.py`)
>    -- pas juste un ajustement de prompt.
>
> **Décidé avec l'utilisateur (23/08/2026)** : rester sur "au moins une
> fois" pour l'instant -- les paris cumulés restent `calculable=false`,
> retombent sur la file de validation manuelle admin (comportement déjà
> existant, rien de cassé, juste moins de couverture auto que l'idéal). Le
> "cumulé sur la série" est noté ici comme un chantier séparé possible,
> à cadrer explicitement si repris plus tard -- ne pas le construire à la
> légère en réutilisant telle quelle la DP de `simulate_series_with_stat()`
> (conçue pour "au moins une fois", pas pour une somme).
>
> **Pour retester un pari série qui DEVRAIT marcher** : une formulation
> "au moins une fois" implicite (sans qualificatif "sur la série"/"cumulé"),
> ex. "LeBron James marquera 25 points ou plus" avec le scope Série
> sélectionné dans le formulaire -- même patron que le test réussi "Jayson
> Tatum 30+ points" (pièce (d), plus haut dans ce fichier).
>
> **2e essai réel (23/08/2026, même session) : nouvelle LIMITE DE PÉRIMÈTRE
> trouvée, PAS un bug** -- "Tatum marquera +30 pts sur un match" (scope
> SÉRIE, formulation cette fois sans ambiguïté "au moins une fois") soumis
> sur la série Boston-Knicks (CONF_SEMIS) : reste non-calculable. Cause
> identifiée en base, pas besoin de reproduire l'appel IA : **cette série
> n'a ENCORE AUCUN match dans `matches`** (0 ligne -- calendrier jamais
> synchronisé, contrairement à Lakers-Rockets qui avait déjà ses matchs 1/2).
> `resolveSeriesHomeCourtTeam()` (pièce (d)) a besoin du VRAI match 1
> (`game_number=1`, `home_team_id`) pour savoir qui a l'avantage du terrain
> -- sans lui, `homeCourt` est `null`, la prédiction est sautée, repli sur
> non-calculable (comportement voulu : ne jamais deviner qui reçoit plutôt
> que risquer une proba faussée).
>
> **Conséquence pratique, à garder en tête** : un pari SÉRIE peut être créé
> par l'app dès que les 2 équipes de la série sont connues (le bracket
> avance), mais il ne peut être auto-calculé qu'une fois le calendrier réel
> du match 1 synchronisé -- avant ça, il tombe systématiquement en
> validation manuelle, quelle que soit la qualité de la formulation. Pas de
> correctif prévu pour l'instant (pas demandé) -- consigné ici pour que la
> prochaine reprise ne redécouvre pas ce cas à froid.
>
> **Pour retester, cette fois avec de vraies chances de marcher** : rester
> sur la série Lakers-Rockets (matchs 1/2 déjà programmés) -- éditer
> ("Modifier") le pari série déjà existant dessus (1 seul pari série par
> série, quota déjà pris) plutôt que d'en créer un 2e.
>
> **3e essai réel (23/08/2026, même session) : vrai BUG DE CONCEPTION trouvé
> et CORRIGÉ** -- "Doncic marquera + de 50 points sur un match" (formulation
> "au moins une fois" cette fois sans ambiguïté, série Lakers-Rockets, qui A
> son calendrier synchronisé) : toujours non-calculable. Reproduit
> directement contre le VRAI service Cloud Run déployé (mêmes paramètres
> exacts que l'appli) : erreur claire, pas un rejet silencieux --
> `"Contexte incomplet ... features manquantes : ['home_continuite_effectif
> _saison', 'away_continuite_effectif_saison']"`.
>
> **Cause racine** : `predictSeriesStat()` envoie `as_of_date` = date du
> jour (23/08/2026) sans `season` explicite -- `build_team_context()`
> déduisait alors la saison par une règle CALENDAIRE (`_season_label_for_date`,
> "à partir d'août on est déjà sur la saison suivante") -- donnant
> **"2026-27"**, une saison réelle qui n'a pas encore commencé (0 match
> connu). Continuité d'effectif incalculable pour une saison à 0 match --
> le garde-fou de `compute_home_win_proba()` (posé lors de sa construction,
> pièce (b)) a refusé À RAISON de deviner. Le garde-fou marchait comme prévu
> -- c'est la déduction de la saison en amont qui était fausse.
>
> **Corrigé** : `_season_label_for_date()` remplacée par
> `_latest_known_season()` -- au lieu de déduire la saison de la date du
> jour, on prend la DERNIÈRE saison réellement connue en base pour cette
> équipe (calculée depuis l'historique déjà récupéré, pas une requête en
> plus). Correct aussi bien en cours de saison (la dernière connue EST la
> saison en cours) qu'en pleine intersaison réelle (retombe sur la dernière
> saison terminée, seule option avec de vraies données) -- l'intersaison
> réelle (juin-septembre) était justement le trou que la règle calendaire
> ne couvrait pas.
>
> **2e correctif au passage, trouvé en revérifiant après le 1er** : la
> tolérance de cohérence (`_CONSISTENCY_TOLERANCE`, pièce (d), mitigation de
> l'instabilité rare) était calibrée à `1e-6` sur la base d'un SEUL cas
> réel (Tatum/Boston/Lakers, où les essais répétés concordaient par chance à
> ~1e-9). Un 2e cas réel (Doncic/Lakers/Rockets) a montré un bruit "normal"
> bien plus large (~0.001-0.002, soit ~0.1-0.2 point de proba) -- 1000x le
> seuil, donc systématiquement rejeté à tort (3 essais, jamais d'accord).
> Recalibrée à `1e-2` (1 point de proba) -- reste nettement en dessous du
> vrai bug déjà observé (~1.4 point) tout en tolérant ce bruit normal.
>
> Revérifié après les 2 correctifs : Doncic 50+points/match sur Lakers-Rockets
> stable (~36.5%, 3 essais). Non-régression : le cas Tatum/Boston/Lakers déjà
> validé (pièce (d)) redonne le même résultat (~24.7-24.9%) sans `season`
> explicite cette fois (comme le fera l'appli en vrai). **Redéploiement
> Cloud Run FAIT par l'utilisateur, revérifié en HTTP réel sur le vrai
> service** -- même résultat (~36.5%) qu'en local.
>
> **4e essai réel (23/08/2026, même session) : pari AUTO-VALIDÉ avec succès
> (calculated_proba=0.3647, status=VALIDATED, difficulté 4) -- mais l'IA
> n'est plus le problème, un AUTRE bug réel (préexistant, pas lié au
> chantier série) trouvé** : l'utilisateur ne trouve son pari VALIDATED
> NULLE PART dans l'appli, ni où était le bouton "Parier" (normal, un
> pari actif existe déjà -- `getRemainingSeriesBets()`,
> `lib/queries/series-bets.ts`, l'exclut à raison), ni ailleurs.
>
> **Diagnostic (agent Explore dédié)** : la refonte du 18/08/2026
> (`JOURNAL_SESSIONS.md`, "SPEC_REFONTE_ONGLET_JOUER") a supprimé l'ancien
> écran "Mes paris" (lecture seule, tous statuts, tous scopes) et migré la
> consultation des paris MATCH vers les nouveaux onglets Jouer
> (`lib/queries/play.ts`) -- mais **jamais fait l'équivalent pour les paris
> SÉRIE**. `lib/queries/bracket.ts::BracketMyBetAction` ne gère QUE
> PROPOSE/EDIT ; dès qu'un pari série sort de DRAFT/SUBMITTED (VALIDATED/
> WON/LOST), `myBetAction` devient `null` et la carte série
> (`NodeCard.tsx`) n'affiche plus rien du tout -- ni bouton, ni contenu,
> ni indice qu'un pari existe. Le commentaire de code de
> `lib/queries/bracket.ts` (ligne ~64-70) dit pourtant explicitement
> l'intention inverse ("mon propre pari m'est toujours visible") -- jamais
> implémentée pour ce cas précis. Non lié au chantier paris série
> d'aujourd'hui : c'est la 1ère fois qu'un pari série atteint VALIDATED en
> conditions réelles, donc la 1ère fois que ce trou se révèle.
>
> **Corrigé (23/08/2026)** : `BracketNode` gagne un champ `myBet:
> PlayAssociatedBet | null` (réutilise TEL QUEL le type/composant déjà
> construits pour les paris MATCH, `lib/queries/play.ts` +
> `components/play/BetBlock.tsx` -- aucune duplication) -- peuplé
> exactement quand `myBetAction` est `null` À CAUSE d'un pari engagé (pas
> d'une série non-pariable). `NodeCard.tsx` affiche `<BetBlock>` en
> lecture seule dans ce cas (description, catégorie, difficulté, proba
> calculée, points, motif de résolution, formulaire "Signaler à un admin"
> si pari oublié -- même contenu que côté MATCH). Requête `bets` de
> `getBracket()` étendue aux champs nécessaires ; requête
> `correction_requests` ajoutée pour le statut "pari oublié". `tsc`/
> `eslint`/`vitest` (37/37)/`next build` (37 routes) propres. **Pas encore
> vérifié au clic** (pas d'accès navigateur dans cet environnement) --
> signalé explicitement, à confirmer par l'utilisateur après déploiement.
>
> **Ajustement demandé par l'utilisateur (23/08/2026, même session) une fois
> déployé** : le pari s'affichait EN PERMANENCE sur la carte plutôt qu'au
> clic. Déplacé pour suivre le patron déjà établi de l'écran (même règle que
> `SeriesGroups`, le détail des pronostics des autres joueurs) : contenu
> replié tant que la série n'est pas "ouverte" (drill-down), affiché
> seulement au clic. `<BetBlock>` retiré de `NodeCard.tsx` (toujours visible)
> et déplacé dans `SeriesDrillDown.tsx`, à côté de `<SeriesGroups>`, dans les
> 2 zones d'expansion existantes (vue A : détail inline sous la carte ; vue
> B : feuille/sheet par le bas) -- aucun nouveau mécanisme d'ouverture créé,
> réutilise `openSeriesId`/`isOpen` déjà en place. Revérifié propre
> (`tsc`/`eslint`/`vitest`/`next build`).

> **État au 21/08/2026 (suite 13, chantier Data NBA)** — **Joueur hors du
> match visé : proba 0% au lieu d'un rejet silencieux**
> (`projet-data-nba.md` §33) — un pari sur un joueur qui ne joue pour
> aucune des 2 équipes du match (ex. "LeBron James" sur Atlanta-Boston)
> est maintenant accepté avec une proba forcée à 0%, visible dans "Mes
> pronos", plutôt que de retomber silencieusement en repli manuel sans
> explication. Testé avec de vrais appels Claude Opus 5, 3/3 cas corrects.
> `tsc`/`eslint`/`vitest`/`next build` propres. Ne change rien aux points
> ouverts ci-dessous (toujours bloquants).
>
> **Nouvelle piste notée le 21/08/2026, PAS pour maintenant** : l'utilisateur
> demande de noter l'idée d'utiliser l'IA pour aider à la RÉSOLUTION des
> paris une fois le match terminé (suggérer gagné/perdu) — rejoint
> l'idée déjà écrite dans `decisions_0.2.4 §10` ("Une IA pourrait
> PRÉ-REMPLIR une suggestion gagné/perdu"), jamais construite. Distinct de
> la structuration à la soumission (Phase 5 en cours) — à reprendre
> explicitement plus tard, pas dans la continuité immédiate de ce chantier.
>
> **Coût Claude Opus 5, suivi** : 0,23$ consommés sur les 5$ de crédit du
> 2e compte Anthropic (au 21/08/2026) — l'utilisateur considère ces 5$
> comme un budget de test, et envisage un modèle gratuit (ex. Gemini) "au
> moins pour le début" s'il s'épuise trop vite. Décision explicitement
> reportée à ce moment-là, pas maintenant (voir échange du 21/08/2026 —
> switch déconseillé pour l'instant : le prompt actuel est testé/affiné
> spécifiquement pour Claude Opus 5, un changement de fournisseur
> demanderait de tout revalider).
>
> **Calibration des seuils proba->difficulté FAITE (21/08/2026)** — Phase 5
> §7 point 2 : `lib/ai/difficultyTiers.ts` utilise désormais des seuils
> calibrés (66.4/52.9/39.4/24.9%) plutôt que les seuils provisoires
> 80/60/40/20%, voir `SPEC_TECHNIQUE_PROBA_PARIS_PERSOS_V0_1.md` §7bis pour
> le détail de la méthode (échantillon simulé, `calibrate_difficulty_
> thresholds.py`). Retire ce point de la liste des bloquants Phase 5.
>
> **Point 5 (barème du fallback IA) — PARQUÉ PAR DÉCISION le 22/08/2026,
> Phase 5 considérée CLOSE sans lui** : 2 pistes discutées le 21/08 (1. un
> champ où le joueur tape un nombre de points libre borné 5-25, à la place
> du sélecteur de difficulté 1-5 actuel -- impacte
> `lib/scoring/engine.ts::scoreBet`, table `BET_DIFFICULTY_POINTS` fixe
> indexée 1-5 ; 2. un formulaire STRUCTURÉ joueur/stat/seuil pour la
> catégorie `PLAYER_PROP`, qui éliminerait par construction la classe de
> bugs d'extraction IA corrigée cette session -- mauvais joueur, faute
> d'orthographe, joueur hors match). L'utilisateur choisit explicitement
> de les laisser en l'état (parquées, pas rejetées) plutôt que de trancher
> maintenant -- le mécanisme manuel actuel (`proposed_difficulty`/
> `validated_difficulty`, sélecteur 1-5) reste inchangé pour les paris non
> calculables. À reprendre dans une session dédiée si besoin, en partant
> de ces 2 pistes plutôt que de repartir de zéro.

> **État au 21/08/2026 (suite 11, chantier Data NBA)** — **Contexte de
> match ajouté à la structuration IA, 2 bugs réels corrigés**
> (`projet-data-nba.md` §31, `JOURNAL_SESSIONS.md` entrée dédiée) :
> - **Retiré** : bug réel trouvé par l'utilisateur — l'IA validait des
>   paris sur un joueur qui ne joue même pas dans le match visé (ex.
>   "Jayson Tatum" sur un match Nets-Hornets). Corrigé : `structureBet()`
>   reçoit désormais les 2 équipes du match, Claude Opus 5 vérifie
>   l'appartenance ET corrige l'orthographe du nom (règle aussi le
>   problème "Junior" vs "Jr." à la source, plus largement que le correctif
>   ponctuel de §29). Testé avec de vrais appels, 3/3 cas corrects.
> - **Toujours bloquant** : redéployer le service Cloud Run (correctif
>   "Junior"/"Jr." côté `find_player()`, §29 — désormais une 2e ligne de
>   défense) — action de l'utilisateur, pas encore faite. Une fois fait,
>   resoumettre un pari de test et vérifier l'auto-validation de bout en
>   bout (statut VALIDATED direct, proba visible dans "Mes pronos", pari
>   listé dans la section admin si besoin de correction).
> - **Restent ouverts, assumés explicitement (pas oubliés)** : seuils
>   proba->palier toujours provisoires ("à vue de nez", point 2 de la spec,
>   jamais calibrés sur un vrai échantillon) ; barème du fallback pour les
>   paris non calculables jamais tranché (point 5, statu quo assumé —
>   mécanisme manuel existant inchangé).

> **État au 21/08/2026 (suite, chantier Data NBA)** — **Phase 3 (résiduel de
> calibration FT%/FG%/3P%, candidat overdispersion) testée et close, gain
> ciblé adopté sur FT% seulement** (`projet-data-nba.md` §20,
> `JOURNAL_SESSIONS.md` entrée dédiée) : Beta-Binomial prédictif réduit le
> résiduel 5.4%→4.1% sur FT%, jugé négligeable (3P%) ou contre-productif
> (FG%) sur les 2 autres — pas adopté là, même patron que `POISSON_STATS`
> (§15). `train_pct_model.py`/`tester_modele.py` mis à jour, 3 modèles
> réentraînés/resauvegardés, vérifié en conditions réelles. (Les 2 points
> ouverts notés ici — biais résiduel FT% et réentraînement 5 saisons — sont
> désormais traités, voir le bandeau du dessus.)

> **État au 21/08/2026** — **Nouvelle page `/regles` construite (§2.96
> ETAT_ACTUEL.md) et tutoriel "Comment jouer ?" entièrement retiré (§2.97)**
> à la demande de l'utilisateur, `/regles` couvrant désormais ce besoin.
> - **Point retiré, résolu le 21/08/2026** : migration #30 (`drop column
>   tutorial_seen_at`) écrite mais restée bloquée par le classifieur de
>   permissions (même blocage que la migration #29). `npx supabase db push`
>   est repassé sans blocage lors de la session Phase 4 (voir bandeau du
>   dessus) — #29 ET #30 sont désormais poussées sur la base réelle, en même
>   temps que la nouvelle migration #31 (tables `stats_*`).

> **État au 20/08/2026 (session DA)** — **Ajustements visuels validés,
> chantiers §1-§4/§9/§14/§15 de `Cadrage/DA/AJUSTEMENTS_VISUELS_20_08_2026.md`
> implémentés et poussés, un commit par chantier** (détail dans
> `JOURNAL_SESSIONS.md`, résumé condensé `ETAT_ACTUEL.md` §2.93).
> - **Nouveau point ouvert, décision volontairement pas prise maintenant** :
>   ticker "en direct" de Jouer/Mes pronos (§16 du document, `LiveTicker.tsx`)
>   posé À L'ESSAI, pas un chantier figé — à observer en usage réel puis
>   trancher (garder / retirer). Réversible sans effet de bord (aucune
>   dépendance créée ailleurs dans le code sur sa présence — marche à suivre
>   pour le retirer dans le message du commit `0214914`).
> - **Reste ouvert, pas codé** : §12 du document (photo de profil) — VALIDÉ
>   comme principe côté DA mais explicitement "non tranché, à reprendre
>   avant de coder" PAR LE DOCUMENT LUI-MÊME : bucket Supabase Storage à
>   créer (n'existe pas), format/taille acceptés, recadrage automatique vs.
>   manuel. Pas implémenté cette session — cadrage à faire avant tout code.
>   Noté aussi comme provisoire par le document : pourrait être reconsidéré
>   une fois une identité de marque plus forte définie (§13, logo/mascotte).
> - **§13 du document (nom définitif → logo/wordmark → mascotte)** :
>   feuille de route explicitement pas un chantier à coder pour l'instant,
>   seul l'ORDRE des 3 étapes est acté — rien sur leur contenu. À reprendre
>   en détail dans une session dédiée quand l'utilisateur voudra s'y
>   attaquer.
> - **Bracket global (`/bracket`)** : confirmé de nouveau à laisser tel quel
>   (déjà su, pas un nouveau point — cf. `.hero-banner-title`/
>   `.hero-banner-subtitle` et Bracket format horizontal plus bas dans cette
>   liste). Composant Button partagé toujours pas construit non plus (19+
>   déclarations quasi identiques) — chantier de refactor identifié, pas
>   pressant.

> **État au 20/08/2026 (soir, encore une suite)** — **Projet Data NBA :
> écart réel trouvé sur le double-double via `tester_modele.py` en usage
> réel — PAS un bug, une limite de conception identifiée.** Testé sur
> Victor Wembanyama : modèle 42.8% vs Gemini/Copilot ~60%. Vérifié dans la
> base : le modèle colle exactement à sa fenêtre d'entrée (taux réel 40%
> sur les 10 derniers matchs) mais cette fenêtre est trop courte pour
> distinguer une vraie tendance récente d'un creux passager (taux réel
> 60-62% sur des fenêtres plus longues/la saison). Cause : `reb_moy5`/
> `reb_moy10` pèsent >50% de la décision du modèle double-double, et
> `reb_moy10` de Wembanyama est tombé juste sous 10 (rebonds très
> irréguliers récemment). Contrairement aux modèles régressés (2 horizons)
> et aux % de tir (rétrécissement bayésien vers une moyenne longue, §18),
> le modèle double-double/triple-double n'a aucun signal à horizon long.
> **Décision explicite : ne rien changer au code maintenant** — creuser
> d'abord si ce cas est isolé à Wembanyama ou général (profils à forte
> variance de rebonds), avant de modifier la recette. Piste retenue pour
> la reprise : feature `reb_moy20`/moyenne de saison à tester
> empiriquement avant de généraliser. Détail complet
> `Cadrage/Stats/projet-data-nba.md` §19, bandeau REPRISE à jour.

> **État au 20/08/2026 (soir, suite)** — **Projet Data NBA : Phase 1
> (largeur) TERMINÉE — pourcentages de tir FT%/FG%/3P% validés et
> généralisés.** 🔴 **Reprise : voir le bandeau en tête de
> `Cadrage/Stats/projet-data-nba.md`** (à jour). Toujours EN PAUSE avant
> tout code appli, chantier séparé de l'app V1. Approche Binomiale
> (tentatives régressées + taux rétréci vers la moyenne ligue) validée
> d'abord sur FT% seul — **bug réel trouvé et corrigé en validant** : le
> modèle de tentatives entraîné sur tous les matchs sous-estimait `n_hat`
> de 28% une fois restreint aux matchs à tentative réelle (biais de
> sélection), gonflant la proba des seuils hauts (+17.7%) — corrigé
> (entraîné uniquement sur les matchs avec tentative réelle). Généralisé le
> jour même à FG%/3P%, correctif intégré dès le départ. **Calibration très
> inégale selon le volume de tentatives** : FG% quasi parfait (±0-2.8%, le
> plus tenté des 3, meilleur résultat de calibration du projet à ce jour) ;
> 3P% correct (±1.4-7.8%) ; FT% le moins bon (±4-9%, le moins tenté). Détail
> complet `Cadrage/Stats/projet-data-nba.md` §18. **12 modèles au total**
> (`Cadrage/Stats/models/*.joblib`), tous les trous de catégorie du
> classeur couverts. **Pas encore tranché, à décider à la reprise** : Phase
> 3 (affiner — résiduel de calibration, overdispersion probable pas
> vérifiée), Phase 4 (contexte en direct) ou Phase 5 (intégration appli).

> **État au 20/08/2026 (fin de session)** — **Projet Data NBA / paris persos
> pilotés par la proba — chantier séparé de l'app V1, EN PAUSE avant tout
> code appli.** 🔴 **Reprise : voir le bandeau en tête de
> `Cadrage/Stats/projet-data-nba.md`** (marche à suivre précise, commandes
> exactes). Spec app dédiée : `Cadrage/V1/SPEC_TECHNIQUE_PROBA_PARIS_
> PERSOS_V0_1.md` (statut PROPOSITION). Détail complet dans
> `JOURNAL_SESSIONS.md`, résumé ici :
> - **Décidé (19/08)** : le barème pronos match/bracket (T5) ne bouge pas.
>   Le chantier à valeur, c'est d'automatiser les paris persos — remplacer
>   la difficulté choisie à la main par une probabilité calculée, qui
>   détermine le palier de points, SANS toucher au moteur `scoreBet`
>   (T5 §8, reste intact) — seule la source de `validated_difficulty`
>   change.
> - **8 modèles jetables construits, testés et sauvegardés sur disque**
>   (`Cadrage/Stats/models/*.joblib`, via `joblib`) : points, double-double,
>   triple-double, rebonds, passes, 3-points, interceptions, contres,
>   minutes. Validés sur de vrais paris du classeur historique (Mitchell,
>   Tatum). 2 bugs réels trouvés et corrigés en cours de route : ~19% de
>   lignes DNP (joueur non entré en jeu) chargées comme de vraies
>   apparitions à 0 (faussait tout) ; distribution normale mal adaptée aux
>   stats rares/souvent nulles (3-points/contres/interceptions), remplacée
>   par une distribution de Poisson pour ces 3-là spécifiquement (vérifié
>   empiriquement, pas juste supposé).
> - **Fetch des 2 saisons TERMINÉ (2641/2641, 0 échec) ET réentraînement des
>   8 modèles sur données COMPLÈTES FAIT** — les deux se sont terminés
>   après le départ de l'utilisateur vers une autre conversation, enchaînés
>   automatiquement (séquence pré-actée avec lui). Amélioration nette
>   partout (ex : points MAE 5.09→4.75, R² 0.428→0.497), aucune régression.
>   Détail complet dans `projet-data-nba.md` §17.
> - **Toujours ouvert, pas tranché** : les seuils exacts entre paliers de
>   points côté appli (§5 de la spec dédiée) — besoin de probas sur
>   beaucoup de paris réels pour calibrer, prématuré tant que la Phase 1
>   (couverture des catégories) n'est pas plus avancée. Pourcentages de tir
>   (FG%/3P%/FT%, ~30 mentions du classeur) : seul trou de catégorie encore
>   non traité, nécessite une approche différente (stat de taux). Blessures/
>   absences : toujours pas de source de données trouvée (§7).
> - Plan complet en 5 phases (largeur → données → affinage → temps réel →
>   intégration appli) écrit dans `projet-data-nba.md` §16.

> **État au 19/08/2026** — **SMTP — RÉSOLU, testé en conditions réelles.**
> Point ouvert depuis le 16/08 (voir bloc ci-dessous). Décision retenue :
> SMTP Gmail perso (`smtp.gmail.com`, mot de passe d'application) plutôt
> qu'un domaine vérifié Resend — livrable à n'importe quelle vraie adresse,
> configuré directement dans le dashboard Supabase (jamais de secret collé
> dans le chat). Détail complet dans `ETAT_ACTUEL.md` §2.91.
> - **Bug réel trouvé en testant** : `signup()` (`lib/auth/actions.ts`)
>   traitait l'absence de session comme "compte déjà existant"
>   (anti-énumération), mais c'est aussi le cas normal d'un compte tout
>   juste créé en attente de confirmation — Confirm email s'est avéré actif
>   en prod (contrairement au réglage sauvegardé le 27/07). Corrigé : les 2
>   cas sont maintenant distingués, avec 2 nouvelles pages de redirection
>   (`/verify-email` après inscription, `/email-confirmed` après clic sur
>   le lien reçu).
> - **2e bug trouvé en testant le lien de confirmation** : Site URL du
>   dashboard Supabase pointait sur `http://localhost:3000` (jamais mis à
>   jour vers le domaine de prod) et aucune Redirect URL n'était enregistrée
>   — tout lien de redirection (confirmation, reset) retombait sur
>   localhost. Corrigé côté dashboard (Site URL + wildcard
>   `https://nba-pronos.vercel.app/**`).
> - **Nouveau point ouvert, à faire plus tard, pas urgent** : personnaliser
>   le contenu du mail de confirmation (Authentication → Emails →
>   Templates dans le dashboard Supabase) — actuellement le template par
>   défaut Supabase, générique et en anglais, alors que toute l'appli est
>   en français.
> - **Mes pronos, carte match (`UpcomingRow.tsx`) — FAIT pour la partie
>   demandée en priorité** : logos d'équipe visibles + doublon avec
>   TeamPicker éliminé (sélection fusionnée dans l'en-tête, `TeamPicker.tsx`
>   supprimé) — détail dans `ETAT_ACTUEL.md` §2.92. **Reste ouvert** : parmi
>   les options cochées par l'utilisateur (AskUserQuestion multi-select),
>   « repenser la mise en page globale » (agencement, hiérarchie visuelle,
>   pas juste les logos/le doublon) n'a pas été traitée — seule la version
>   a minima a été livrée pour ce 1er aller-retour. À reprendre si demandé.
>
> **État au 18/08/2026** — **Rattrapage de suivi : `ETAT_ACTUEL.md` et ce
> fichier n'avaient pas suivi depuis le 15/08/2026** (`JOURNAL_SESSIONS.md`,
> lui, était à jour jusqu'au 17/08/2026) — repéré en répondant à la question
> de l'utilisateur « tout est documenté ? », rattrapage complet choisi avec
> lui plutôt que de ne documenter que le jour même. Détail complet dans
> `ETAT_ACTUEL.md` §2.64→§2.70.
> - **Bracket en arbre visuel connecté (avis expert du 16/08, point 1) —
>   ENTIÈREMENT FAIT ET CLOS**, retiré des points ouverts ci-dessous : devenu
>   le mode principal PARTOUT (consultation ET remplissage, tous devices,
>   plus de bascule desktop/mobile) — voir `ETAT_ACTUEL.md` §2.65.
> - **Admin : suppression manuelle d'un match — FAITE** (§2.66) ; **remise à
>   zéro du bracket personnel — FAITE** (§2.67) ; **paris en pop-up + score
>   du poster en menu déroulant — FAIT** (§2.68).
> - **Accueil : polish visuel (icônes, liseré d'urgence, rang en avant,
>   pastilles d'équipe, feed illustré) — FAIT** (§2.69). Logos de franchise
>   sur l'Accueil : **partiellement résolu** — l'item "matchs à
>   pronostiquer" de « À traiter » a maintenant de vraies pastilles
>   d'équipe (`TeamLogo`), mais le feed « Ça vient de tomber » (icônes de
>   résultat choisies à la place) et le Classement restent en texte seul —
>   voir l'entrée plus bas « Logos de franchise sur Accueil et Classement ».
> - **Nouveau point ouvert, non tranché** : les icônes de
>   `components/icons/home-icons.tsx` (À traiter/feed, ajoutées le
>   18/08/2026) sont un stopgap fait main — l'utilisateur a explicitement
>   noté vouloir les reprendre plus tard, **même statut que les icônes de
>   badges avant leur passe visuelle dédiée** (`lucide-react` → visuels IA,
>   voir plus bas). Reprise à date non fixée.
> - **Mes paris : suppression d'un pari personnalisé encore modifiable —
>   FAITE** (§2.70, `delete_bet`, migration #29) — sous le capot un passage
>   à `CANCELLED` (rétention D2), pas un vrai `DELETE`. **Boutons
>   Modifier/Reproposer/Signaler/Envoyer/Supprimer harmonisés** (même
>   gabarit contour) dans la foulée.
> - **Point retiré, résolu le 21/08/2026** : la migration #29 (`delete_bet`)
>   est restée bloquée (classifieur de permissions) jusqu'à la session
>   Phase 4 Data NBA, où `npx supabase db push` est repassé sans blocage —
>   poussée sur la base réelle, le bouton "Supprimer" fonctionne désormais.
> - **Reste ouvert, inchangé depuis le 16/08** (voir bloc ci-dessous pour le
>   détail complet) : décision SMTP (bac-à-sable Resend vs service intégré
>   Supabase) ; notifications/popup à la connexion (résumé depuis la
>   dernière visite, badges débloqués, actus) — pas cadré ni codé ; chat/
>   couche sociale in-app — jugé utile, pas cadré ni codé ; lien "Parier"
>   atteignable dans une carte `aria-disabled` ; classes CSS mortes
>   `.hero-banner-title`/`.hero-banner-subtitle` ; `LeaderboardRow` non
>   mémoïsé ; regroupements de requêtes possibles (`getBracket()`,
>   `getHomeData()`).
> - **Vérification au clic bloquée 2 fois ce 18/08/2026** (Accueil §2.69,
>   recherche d'email de compte de test pour §2.70) par le même classifieur
>   de permissions que la migration ci-dessus — les 2 fonctionnalités sont
>   donc vérifiées au niveau type/build (`tsc`/`eslint`/`vitest`/
>   `next build`) mais pas encore au clic en conditions réelles.
> - **Refonte de l'onglet Jouer — CODÉE ET VÉRIFIÉE (type/build), même
>   session du 18/08/2026** (§2.72 `ETAT_ACTUEL.md`) : hub 2×2 remplacé par
>   2 onglets « Mes pronos »/« Résultats » + Bracket en point d'entrée
>   permanent, paris MATCH intégrés aux deux onglets (tous statuts, pas
>   seulement éditables). `tsc`/`eslint`/`vitest` (37/37)/`next build` (34
>   routes) propres.
> - **Vérification au clic EN COURS par l'utilisateur, même session** — la
>   compétition active a été peuplée avec les comptes TestJoueur1-4
>   (`scripts/advance-current-competition.mjs`, §2.73) précisément pour
>   permettre ce test réel. 4 bugs déjà trouvés et corrigés en regardant
>   l'appli tourner (§2.73 addendum, §2.74-76 `ETAT_ACTUEL.md`) :
>   `bracket_deadline` jamais recalculée par le script de seed (bracket
>   resté « modifiable », avancement des séries invisible) ; score de série
>   masqué une fois FINISHED ; points du pronostic de bracket jamais
>   affichés ; thème Photo perdu sur l'onglet Mes pronos dès qu'il a du
>   contenu. **Restent à vérifier au clic**, toujours non confirmés : saisie/
>   validation d'un prono et d'un pari sur un match à venir, bascule vers
>   Résultats une fois un match verrouillé > 3 jours, correction de prono ET
>   de pari depuis les deux onglets (mécanisme `returnTo`), suppression d'un
>   pari (bouton déplacé dans `InlineBetForm`), bandeau de quota, bandeau
>   « Tout valider ».
> - **Simplification assumée, pas un bug** : le filtre « des autres joueurs »
>   par ligue (`LeagueScopeChips`) n'existe plus que sur Résultats — l'ex-
>   segment « Récent » de Mes pronos en bénéficiait, l'onglet Mes pronos
>   fusionné n'en hérite pas (documenté dans
>   `SPEC_REFONTE_ONGLET_JOUER_V0_1.md` avant même de coder). À rouvrir si
>   l'utilisateur le demande.
>
> **État au 16/08/2026** — **Audit UX + code, détail complet dans
> `AUDIT_UX_16_08_2026.md`.** Tous les points actionnables techniques
> traités et poussés SAUF SMTP (mis en pause explicitement, décision à
> reprendre plus tard, pas urgent) : bug d'inscription silencieuse
> (`1f4847a`), désync `isLive`/`isDecided` du Bracket, bouton "Parier"
> trompeur sur série terminée, erreur d'hydratation `NotificationSettings`,
> libellé "Hier" du Classement, nœud sans conférence silencieusement
> supprimé du Bracket, redirection `/play/bracket` → `/bracket` qui perdait
> `?round=`, et les 3 duplications de code repérées (formatage de date,
> statuts de pari "libérés", motif ligne cliquable) — voir
> `JOURNAL_SESSIONS.md` pour le détail de chaque correctif.
> - **Décision produit à prendre** : SMTP Resend configuré en mode
>   bac-à-sable pendant l'audit (ne peut livrer qu'à l'adresse du compte
>   Resend) — pas viable en l'état pour de vrais joueurs. Choisir entre
>   domaine vérifié chez Resend (~1-3€/an) ou retour au service intégré
>   Supabase (2 emails/heure, fixe). Clé API Resend exposée 2x dans le chat
>   pendant le dépannage — à régénérer côté Resend.
> - Reste, non traité (hors du périmètre demandé cette fois — a11y/nettoyage
>   mineur, cf. `AUDIT_UX_16_08_2026.md` §3 Correctness points 6/7 et
>   Efficacité) : lien "Parier" atteignable dans une carte `aria-disabled`,
>   classes CSS mortes `.hero-banner-title`/`.hero-banner-subtitle`,
>   `LeaderboardRow` non mémoïsé, quelques regroupements de requêtes
>   possibles (`getBracket()`, `getHomeData()`).
> - **Avis produit qualitatif — 4 questions tranchées** (`AVIS_EXPERT_16_08_2026.md`,
>   voir `JOURNAL_SESSIONS.md` pour le détail) : (1) bracket en arbre visuel
>   connecté — **fait et poussé** cette session (`components/bracket/
>   TreeConnectors.tsx`, `posterColumns.ts`), étendu au remplissage
>   (`components/bracket-fill/FillPosterView.tsx`, poster interactif avec
>   guidage automatique vers la prochaine série à compléter) et devenu le
>   mode par défaut sur desktop/paysage pour les 2 écrans
>   (`lib/hooks/useImmersiveDefault.ts`) — mobile portrait garde le flux
>   normal (accordéon / onglets par tour) sur les 2 écrans ; (2) mécanique
>   récurrente — ni duel hebdo ni boosters, l'utilisateur préfère un
>   **système de notifications/popups à la connexion** (résumé depuis la
>   dernière visite, badges débloqués, actus) — **pas encore cadré ni
>   codé** ; (3) **chat/couche sociale in-app** — jugé utile, à construire —
>   **pas encore cadré ni codé** ; (4) priorité — pistes produit d'abord,
>   SMTP reste en pause (cf. ci-dessus).

> **État au 09/08/2026** — **Badges permanents : catalogue de BASE
> ENTIÈREMENT CODÉ et VÉRIFIÉ en conditions réelles** (`BACKLOG_V1.md` §
> "Fun / esprit ligue entre potes", chantier ouvert le 30/07/2026, 3e des
> chantiers prioritaires du reclassement, après Bracket personnel et
> Tutoriel joueur — voir `Cadrage/V1/Spec visuelle/SPEC_BADGES_PERMANENTS
> _V0_1.md` et `ETAT_ACTUEL.md` §2.59 pour le détail complet). Cadrage
> fonctionnel + technique CLOS le 08/08/2026 ; les 3 phases codées et
> poussées le 09/08/2026 :
> - **Phase 1** (25 badges hors streaks) : migration #25, vue
>   `user_badges_lifetime` (lecture pure, agrégats à vie toutes
>   compétitions confondues, même patron que `user_scores`). **Correctif
>   structurel trouvé en lisant le code avant de coder** : le placeholder
>   Badges était niché dans la branche "compétition active", ce qui
>   l'aurait fait disparaître hors saison — corrigé. Committé (`08aa817`,
>   `fa48beb`, `12b5444`, `2a76d8c`).
> - **Rendu visuel par palier** : 5 tokens `--color-tier-*` (dark + clair,
>   `app/tokens.css`), attribut `data-tier` sur `BadgeCard` (bande +
>   fond teinté + libellé coloré). Committé (`59570e6`).
> - **Phase 2** (Métronome, Pilier) : migration #26, vue
>   `user_competition_streaks` (grain user+compétition) — 1er usage de
>   gaps-and-islands SQL dans ce dépôt. Matchs "éligibles" pour Pilier =
>   coup d'envoi passé, ni CANCELLED ni POSTPONED (confirmé avec
>   l'utilisateur). Committé (`ec97ef3`).
> - **Phase 3** (Fidèle) : migration #27, `fidele_streak` ajouté à la même
>   vue. Définition tranchée AVEC l'utilisateur — règle d'UNION : un match
>   compte "présent" si un pronostic figé OU un pari perso RATTACHÉ À CE
>   MATCH PRÉCIS (scope MATCH) existe ; un pari SÉRIE ne compte JAMAIS
>   (jugé "trop facile" de créditer toute une série via un seul pari).
>   Committé (`ae6569c`).
>
> Toutes les phases vérifiées en conditions réelles (décomptes manuels
> concordants, invariant `fidele_streak >= pilier_streak` confirmé, rendu
> vérifié au clic via Playwright temporaire à chaque étape).
> `tsc`/`eslint`/`vitest` (37/37)/`next build` (36 routes) propres tout du
> long. Mot de passe de `TestJoueur1` expiré, réinitialisé via l'API Admin
> sans redemander à l'utilisateur (compte de test jetable).
>
> **Reportés/écartés explicitement** (détail et raisons dans la spec) :
> badge Grimpeur (progression de rang — mécanisme déjà pensé en % du
> classement si repris) ; axe "fan de tel joueur" (référentiel joueurs
> inexistant, chantier séparé) ; notification de déblocage ; icônes/
> visuels dédiés par badge (aucun asset graphique n'existe à ce jour).
>
> **Interaction "carte retournée" au clic — FAITE le 10/08/2026** : au
> clic/tap, la carte de badge se retourne (`rotateY` CSS) pour afficher sa
> description au dos — `BadgeCard` passe en `"use client"` (état local
> `isFlipped`, `<button>` accessible clavier avec `aria-pressed`/
> `aria-hidden`), nouveau token `--motion-flip-duration` (zéro sous
> `prefers-reduced-motion`, même patron que les autres tokens de motion).
> Vérifié au clic (Playwright temporaire) : bascule d'état confirmée,
> description correcte au dos, aucune erreur console. `tsc`/`eslint`/
> `vitest`/`next build` propres. Committé et poussé (`ee820d7`).
>
> **Astuce ajoutée le 10/08/2026** : « Astuce : clique sur une carte pour
> voir sa description. » sous le titre Badges, avant les catégories — pour
> signaler l'interaction carte retournée ci-dessus, pas évidente sans
> indice visuel. Committé et poussé (`a209f22`).
>
> **Icônes de badges — FAITES le 10/08/2026 : chantier badges CLOS dans son
> intégralité.** Décision prise avec l'utilisateur (3 options proposées :
> dessin SVG sur-mesure par Claude, assets fournis par l'utilisateur —
> même patron que les photos de fond Unsplash, ou bibliothèque sous
> licence) : **bibliothèque `lucide-react`** (ISC), installée comme
> dépendance de prod. `lib/badges/icons.tsx` — mapping 1:1 des 36 badges,
> aucune icône répétée ; l'échelle Prudent→Fou furieux reprend les faces de
> dé `Dice1`→`Dice5` (correspondance littérale avec le niveau). Icône
> affichée sous le libellé sur les 2 faces de `BadgeCard`, colorée selon
> le palier (mêmes tokens `--color-tier-*`). Vérifié au clic (Playwright
> temporaire) : 72 `<svg>` rendus (36 badges × 2 faces), aucune erreur
> console ; `tsc` confirme au passage que les 36 noms d'icônes existent
> bien dans la lib. `eslint`/`vitest` (37/37)/`next build` (36 routes)
> propres. Committé et poussé (`8834596`).
>
> **Icône agrandie + réordonnée, le 10/08/2026 (suite immédiate)** :
> l'utilisateur signale que ces icônes serviront un jour dans le bandeau du
> profil joueur (voir piste future ci-dessous) — l'icône doit donc dominer
> visuellement la carte plutôt que rester une petite décoration à côté du
> texte. Taille doublée (1rem → 1.75rem), empilée verticalement avec le
> libellé au lieu d'une ligne icône+texte côte à côte, puis ordre inversé
> sur demande explicite (titre AU-DESSUS, icône EN DESSOUS). Vérifié au
> clic à chaque étape (Playwright temporaire), aucune erreur console.
> `tsc`/`eslint`/`vitest`/`next build` propres. Committé et poussé
> (`e65808d` taille, `d5e18fe` ordre).
>
> **Piste future notée, PAS cadrée** : afficher (une sélection de ?) ces
> badges dans le bandeau du profil de chaque joueur — mentionné par
> l'utilisateur comme motivation pour agrandir l'icône, mais rien de plus
> précisé. Reste à trancher le moment venu : combien de badges affichés,
> quel critère de sélection parmi les 36 (les plus hauts paliers ? les plus
> récents débloqués ? un choix manuel du joueur ?), emplacement exact dans
> le bandeau (`app/(app)/profile/page.tsx`, déjà personnalisé par équipe
> favorite depuis le 04/08/2026, §2.54).
>
> **Chantier badges permanents entièrement clos** (spec, 3 phases, couleurs
> par palier, carte retournée, astuce, icônes). Seul le badge Grimpeur
> (progression de rang) reste hors périmètre, écarté par choix explicite.
>
> **Remplacement des icônes stopgap (`lucide-react`) par des visuels IA —
> EN COURS, MIS EN PAUSE le 10/08/2026** (`JOURNAL_SESSIONS.md`, entrée
> dédiée ; `Cadrage/V1/Spec visuelle/PROMPTS_BADGES_ICONES.md` +
> `PROMPTS_BADGES_GEMINI_PRETS.md`) : les icônes `lucide-react` actuelles
> restent en place dans le code (rien changé côté appli), c'est un chantier
> visuel externe au dépôt (génération IA, PNG à intégrer plus tard). 3/35
> badges pilotés : Métronome (Blason) et Victorieux (Blason, exception —
> gardé même si sa mécanique le classerait en Flat) générés et validés via
> Gemini/Nano Banana ; Bracket Master (Glossy) généré mais à refaire
> (silhouette pleine au lieu d'un contour, correctif déjà ajouté aux
> prompts, pas encore régénéré). Scout (Flat, sans cadre) jamais généré —
> le pilote sur les 3 familles de composition n'est pas complet. Outil
> retenu : Gemini/Nano Banana (Recraft essayé en premier, jugé pas assez
> net). 2 points non tranchés, flagués dans `PROMPTS_BADGES_ICONES.md` :
> l'exception Victorieux (Blason vs Flat) et le concept dé de Casse-cou/
> Kamikaze/Fou furieux (peut-être obsolète selon un commentaire dans
> `lib/badges/icons.tsx`). Reprise à date non fixée.

> **État au 06/08/2026 (suite)** — **Thème à 3 choix Sombre/Clair/Photo**
> (`ETAT_ACTUEL.md` §2.58, `JOURNAL_SESSIONS.md` entrée dédiée) : les 2
> premiers points ouverts du rattrapage de suivi ci-dessous sont
> **RÉSOLUS** — voir le détail complet dans l'entrée dédiée :
> - Contraste du thème Clair : **corrigé**. Sombre/Clair/Photo fusionnés en
>   un seul réglage à 3 choix mutuellement exclusifs (2 migrations) ; Photo
>   n'est plus jamais combiné avec Clair, `.glass-card` retrouve un rendu
>   solide (mêmes tokens dark/light que le reste du site) hors thème Photo.
> - Vérification en conditions réelles : **faite** (compte `TestJoueur1`,
>   captures d'écran des 3 thèmes sur Profil + Accueil). A révélé un **vrai
>   bug** au passage (pas une régression de ce lot, présent depuis `fc6fc43`
>   le matin même) : les pseudo-éléments décoratifs de `.photo-page`
>   interceptaient les clics sur les 9 écrans migrés, tous thèmes confondus —
>   corrigé (`pointer-events: none`), reconfirmé par un 2e test au clic.
> Le 3e point (aucune trace de cadrage écrit pour `fc6fc43`) reste ouvert
> tel quel — ce chantier-ci a son propre cadrage (2 `AskUserQuestion` + mode
> Plan), mais ne documente pas rétroactivement `fc6fc43` lui-même.
> Migrations (`20260806100000_theme_photo_enum.sql`,
> `20260806110000_migrate_photo_theme.sql`) poussées sur la base réelle
> (`npx supabase db push`) après confirmation explicite.
> **Incident sans lien avec le code** : un `VERCEL_OIDC_TOKEN` (courte durée,
> 12h) affiché en clair dans le terminal par un filtre `grep` incomplet,
> signalé immédiatement à l'utilisateur — voir `JOURNAL_SESSIONS.md`.
> `tsc`/`eslint`/`vitest`/`next build` propres. **Committé et poussé**
> (`e35f7b0`/`1e8d296`, retrouvé déjà fait en tout début de la session du
> 08/08/2026 — voir `ETAT_ACTUEL.md`).
>
> **État au 06/08/2026** — **Rattrapage de suivi : 2 commits non documentés
> trouvés** (`ETAT_ACTUEL.md` §2.56/§2.57, `JOURNAL_SESSIONS.md` entrées
> dédiées) : en réponse à « où en est-on dans le projet ? » en tout début de
> session, `git log` a révélé que `de24964` (Stats : total de points en
> grand, 05/08/2026) et surtout `fc6fc43` (DA : fond photo plein écran +
> cartes en verre sur 9 écrans + fond personnalisable, 06/08/2026) avaient
> été codés/committés APRÈS la dernière mise à jour de ces 3 fichiers de
> suivi (arrêtée au 04/08/2026, onglet Stats) — sans qu'aucun des 3 ne soit
> mis à jour à l'époque. Signalé explicitement à l'utilisateur avant de
> documenter quoi que ce soit ; confirmation reçue de reconstruire l'entrée
> a posteriori à partir du code (le déroulé réel de cadrage n'est pas connu
> pour `fc6fc43`, voir l'entrée du journal). `tsc`/`eslint`/`vitest`/
> `next build` revérifiés propres sur l'état actuel du dépôt à cette
> occasion. **1 point reste ouvert de ce rattrapage** (les 2 autres résolus
> le jour même, voir l'entrée ci-dessus) :
> - **Aucune trace de cadrage écrit pour `fc6fc43`** (pas de fichier
>   `SPEC_ECRAN_*`, pas d'entrée de journal contemporaine, pas de maquette
>   artifact retrouvée) — seuls des assets photo (`Cadrage/DA/*.zip`, non
>   suivis par git) et les commentaires du code lui-même en gardent la trace.
>   Rien à corriger, juste à savoir si une reprise future de ce chantier a
>   besoin d'un vrai cadrage écrit (même remarque que pour les couleurs
>   d'équipe avant leur reprise du 04/08/2026).
>
> **État au 04/08/2026 (suite 2)** — **Nouvel onglet Stats, Profil**
> (`BACKLOG_V1.md` § Historique & stats / Fun esprit ligue,
> `lib/queries/stats.ts`, `components/profile/RankEvolutionChart.tsx`,
> `JOURNAL_SESSIONS.md` section dédiée) : courbe d'évolution du rang
> (`leaderboard_snapshots`, SVG fait main, aucune librairie de graphes),
> précision des pronos, bilan des paris, comparaison à la moyenne des
> autres joueurs filtrable Général/Ligue (même mécanisme que Classement/
> Bracket), catégorie Badges en placeholder. Cadré par `AskUserQuestion` +
> mode Plan (1er usage cette session) + maquette artifact AVANT le code.
> Aucune migration. Vérifié en conditions réelles (compte `TestJoueur1`,
> dark/clair, graphe validé avec des données temporaires puis nettoyées).
>
> **État au 04/08/2026 (suite)** — **Couleurs d'équipe sur Profil, reprise
> ET codée** (`BACKLOG_V1.md` § Personnalisation du profil,
> `lib/labels/teamColors.ts`, `app/(app)/profile/page.tsx`,
> `JOURNAL_SESSIONS.md` section dédiée) : essai du 30/07/2026 abandonné le
> jour même, redemandé explicitement cette fois avec la consigne de cadrer
> AVANT de coder — cadré par plusieurs itérations de maquettes (artifact)
> validées avec l'utilisateur (portée réduite au SEUL bandeau, traitement
> duotone plutôt qu'une voile teintée classique, blason à gauche avec liseré
> fin, pseudo agrandi à droite) avant d'écrire la moindre ligne de code
> applicatif. Aucune migration (couleurs en constante de code, déclenchement
> automatique dès `favorite_team_id` renseigné, pas de toggle). Vérifié en
> conditions réelles (compte `TestJoueur1`, dark ET clair), compte de test
> restauré après coup. **1 trouvaille distincte notée, hors périmètre** :
> un rechargement manuel semble nécessaire après `updateProfile`/
> `updateThemePreference` pour voir le changement reflété (`revalidatePath`
> + `redirect`, déjà en place) — reproduit sur les 2 actions à l'identique,
> probablement un comportement Next.js préexistant, pas une régression de ce
> lot. Pas encore creusé.
>
> **État au 04/08/2026** — **Bug corrigé (2 lots) : « Paris séries » proposait
> les affiches du bracket personnel, pas les vraies affiches qualifiées**
> (`JOURNAL_SESSIONS.md`, section dédiée). **Lot 1** : `getSeriesBetsTodo`
> (`home.ts`) et `getBracketCard` (`play-hub.ts`) réutilisaient à tort la
> cascade de picks de `bracket-fill.ts` (correcte pour l'écran de remplissage
> `/play/bracket`, pas pour un pari série qui reste ouvert après le tour
> précédent réellement terminé) — nouveau module dédié
> `lib/queries/series-bets.ts`, lisant les VRAIES équipes
> (`series.team1_id/team2_id`). **Lot 2** (demandé dans la foulée par
> l'utilisateur) : même correctif sur `/play/bracket` lui-même —
> `BracketFillSeries` gagne `realTeamA`/`realTeamB` (vraies équipes, distinct
> de `teamA`/`teamB` qui restent la cascade de picks, INCHANGÉE) ;
> `BracketFillBoard.tsx` ne propose plus l'`InlineBetForm` d'un pari série de
> tour 2+ tant que les 2 vraies équipes ne sont pas connues (sauf pari déjà
> posé avant ce correctif, toujours affiché), avec un label dédié « Pari sur
> la vraie série : X vs Y » distinct des boutons de pronostic. Bug purement
> d'affichage (aucun risque d'intégrité, `bets` n'a pas de colonne équipe).
> **Aucun point ouvert restant** de ce chantier.
>
> **État au 02/08/2026** — **Stepper d'écart repensé sous l'équipe vainqueur,
> écran Matchs** (`ETAT_ACTUEL.md` §2.53, `SPEC_ECRAN_MATCHS_V0_1.md` §22,
> correctif post-validation) : demandé par l'utilisateur, `−`/valeur/`+`
> désormais rendus sous la colonne de l'équipe déjà choisie comme vainqueur
> (2 colonnes alignées sur le `TeamPicker`) au lieu d'un stepper flottant
> séparé — règles de §6 inchangées (case vide, bornes 1-50, pavé numérique).
> Aller-retour dans la session (le `−` retiré puis réintroduit à la demande
> de l'utilisateur), testé au clic en conditions réelles aux 2 étapes
> (`TestJoueur1`). **Aucun gap ouvert par ce chantier** — demande entièrement
> traitée, confirmée fonctionnelle par l'utilisateur. Committé/déployé en 2
> temps (`939f3f9`, `139de16`).
>
> **État au 31/07/2026 (suite)** — **Création de compétition NBA Cup
> construite et vérifiée en conditions réelles** (`ETAT_ACTUEL.md` §2.52,
> `SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1.md` §10) : mini-bracket 4 quarts/2
> demies/finale, dry-run réel en 2 passes successives (déc. 2025) prouvant
> la capture au fur et à mesure ET l'avancement automatique d'une série Cup
> à 1 seul match (jamais vérifié avant ce jour). **2 points restent ouverts
> de ce chantier**, détaillés plus bas dans ce fichier : rendu « à
> pronostiquer » d'un match Cup encore `SCHEDULED` jamais vérifié (calendrier
> 2026-27 pas encore publié côté API) ; régénération du `SYNC_SECRET` (exposé
> en clair dans le chat plusieurs fois) pas encore confirmée faite. Committé
> et poussé depuis (`6f591b0`, 02/08/2026) — déploiement Vercel automatique
> attendu, pas revérifié en production à ce stade.
>
> **État au 31/07/2026** — **Tutoriel joueur codé, capturé et déployé**
> (`SPEC_TUTORIEL_JOUEUR_V0_1.md`, `ETAT_ACTUEL.md` §2.51) : 2e des 3
> chantiers prioritaires du reclassement du 30/07/2026 (après la refonte du
> Bracket), avant les badges permanents (toujours non cadrés). Bannière de
> proposition à la 1re connexion (flag `tutorial_seen_at`) + wizard modal 7
> étapes, dont les 5 dernières illustrées par de VRAIES captures d'écran —
> capturées via Playwright (compte `TestJoueur1`, mot de passe de test
> désormais connu : `TutoTest2026!`) après avoir dû ajuster PUIS restaurer
> exactement la vraie compétition ACTIVE de l'utilisateur (« Test ») pour
> obtenir un match/bracket déverrouillés à photographier — vérifié après
> coup, aucune trace résiduelle. Committé et déployé (`34e179a`, Vercel
> production vérifiée `200`).
>
> **Reste du reclassement du 30/07/2026** : badges permanents (3e chantier,
> non cadrés — emplacement/liste à spécifier le moment venu).
>
> **État au 30/07/2026** — Audit structurel T1→T8/D1-D6 CLOS (28/07/2026, 7
> écarts corrigés) ; Realtime `series` comblé (T6c, §2.44) ; 4 points UI
> mineurs + bandeau parquet sur les 10 écrans joueur (§2.45) ; **1er point du
> backlog codé ET validé en conditions RÉELLES : Rappels ciblés, canal Push**
> (§2.46/§2.47) — testé par l'utilisateur sur son vrai compte, PC + iPhone, 3
> bugs réels trouvés et corrigés (multi-appareils sur un même compte, VAPID
> rejeté par Apple) ; **2e point du backlog codé ET validé en conditions
> RÉELLES : Système de ligue** (§2.48) — créer/rejoindre confirmé par
> l'utilisateur avec 2 comptes réels, 1 bug réel trouvé et corrigé
> (récursion RLS sur `league_memberships`) + 1 ajustement UX demandé
> (sélecteur visible même sans compétition active) ; **3e point : vue admin
> "Qui manque à l'appel"** (§2.49, `/admin/missing`, lecture seule) — vérifié
> par script jetable (compétition ACTIVE temporaire + matchs à J+2 pour
> écarter tout risque de déclencher un vrai rappel push pendant le test) ;
> **petit correctif remonté en testant** : lien de sortie ajouté au panneau
> admin (§2.49bis) ; **4e point : superlatifs de fin de compétition + écran
> Historique** (§2.50) — a nécessité de construire d'abord un snapshot
> quotidien du classement (`leaderboard_snapshots`), vérifié par script
> jetable couvrant ex-aequo/absence de titre/inversion de classement, 12/12
> assertions. Tests au clic (missing + historique) reportés à la prochaine
> compétition réellement active — voir `ETAT_ACTUEL.md` pour le détail
> complet. **Tout est committé/déployé jusqu'à `7bdffc7`.**
>
> **Résidu mineur, non bloquant** : le compte `Demo_Amis` a 3 abonnements
> push Apple dupliqués (Safari en recrée un à chaque tentative) — à
> dédupliquer si gênant en usage, pas urgent (§2.47 `ETAT_ACTUEL.md`).
>
> **Prochaine étape, à confirmer avec l'utilisateur** : la suite du backlog
> (`BACKLOG_V1.md`).
>
> **Test au clic FAIT le 30/07/2026 (fin de session)** : l'utilisateur a créé
> lui-même une VRAIE compétition ACTIVE de test (« Test 30 juillet 2026 »,
> gardée archivée, même choix que les 3 autres compétitions TEST) —
> `/admin/missing` confirmé exact avec de vrais pronostics variés (dont un
> déposé par l'utilisateur lui-même sur son compte réel, en dehors de tout
> script) ; clôture réelle via le bouton admin → les 3 superlatifs attendus
> générés correctement (Nostradamus/Sniper/Meilleur 1er tour, tous à
> TestJoueur1) et les 2 cas limites confirmés en conditions réelles
> (Meilleur bracket absent, Plus grosse remontée absente faute de snapshot —
> compétition close le jour même). 4 comptes de test jetables
> (TestJoueur1-4) gardés à la demande de l'utilisateur pour un futur test
> similaire.
>
> **2 bugs réels trouvés et corrigés le 30/07/2026 (même session, en
> discutant nav)** : `bracket_deadline` jamais posée nulle part dans le code
> réel (corrigé, recalculée à chaque création de match) ; décalage horaire
> Paris/UTC à la création d'un match via `<input type="datetime-local">`
> (corrigé, conversion explicite sans librairie). Les 2 matchs déjà saisis
> dans la VRAIE compétition "Test" de l'utilisateur corrigés rétroactivement.
> Voir `ETAT_ACTUEL.md`/`JOURNAL_SESSIONS.md` pour le détail.
>
> **Page "profil joueur" construite et validée le 30/07/2026 (fin de
> session)** : `/players/[userId]`, nav à 4 onglets inchangée, câblée sur
> TOUTES les pages du site (Classement, Bracket, Mes pronos, Matchs, 6
> écrans admin, Historique/superlatifs) via un composant partagé
> `PlayerLink`. Confirmé fonctionnel par l'utilisateur (bracket 15/15 réel
> de `Rillettes-31` consultable).
>
> **Écran Profil réorganisé en 4 sous-onglets** (Compte/Ligues/Historique/
> Admin, ce dernier visible seulement pour un admin) — demandé par
> l'utilisateur juste après, l'écran ayant grossi toute la session. Même
> patron `?tab=` que le reste du projet, Déconnexion toujours visible hors
> des onglets. Confirmé fonctionnel par l'utilisateur.
>
> **« Couleurs d'équipe sur Profil » essayée puis ABANDONNÉE** le jour même
> par l'utilisateur — revert complet (code + migration), aucune trace
> restante. Voir `JOURNAL_SESSIONS.md`.
>
> **Sélecteur d'équipe favorite transformé en menu déroulant** (`TeamPicker.
> tsx`) — la liste fixe des 30 radios prenait trop de place. 1 bug réel
> trouvé et corrigé en testant : fermer le menu retirait la sélection du
> formulaire avant l'enregistrement (radios sortis du DOM) — corrigé,
> confirmé fonctionnel par l'utilisateur.
>
> **Reclassement du backlog** (décidé avec l'utilisateur) : 3 chantiers
> retenus dans l'ordre — refonte Bracket (FAITE, voir ci-dessous) → Tutoriel
> joueur (FAIT — 31/07/2026, voir tout en haut) → "Fun/esprit ligue" redéfini
> en badges PERMANENTS (visibles en continu pendant la compétition, pas
> seulement à la clôture — reste à cadrer). Le reste du backlog (export .ics,
> courbe d'évolution, classement all-time, Hall of shame) reporté après ces 3.
>
> **Refonte lisibilité du Bracket — FAITE** : distinction Est/Ouest (Vue A
> scindée en sous-groupes, Vue B réordonnée en poster miroir Ouest-gauche/
> Finale-centre/Est-droite, Playoffs uniquement, sans trait de connexion)
> + colonnes centrées en hauteur + carte surlignée quand une série est
> terminée. Les 3 confirmés fonctionnels par l'utilisateur.
>
> **Filtre par ligue sur Mes pronos + Bracket — FAIT** (même patron que
> Classement, `resolveLeagueScope()` désormais partagé) : others/
> absenteeCount/otherBets (Mes pronos) et groups/players + %/dénominateur
> (Bracket) filtrés sur la ligue choisie. **+ replis "Plus d'options" sur
> Mes pronos — FAIT** (3 lignes toujours visibles par match regroupées
> sous un seul déclencheur fermé par défaut). Les 2 confirmés fonctionnels
> par l'utilisateur. **Tout est committé/déployé jusqu'à `ec698e9`.**

## Audit structurel T1→T8 / D1-D6 : CLOS (28/07/2026)

> Audit croisé spec ↔ code réel, lecture seule pendant l'audit lui-même —
> détail complet, méthode et preuves fichier:ligne dans `JOURNAL_SESSIONS.md`
> et `ETAT_ACTUEL.md` §2.38→§2.42. Verdict : **aucune des 6 décisions
> structurantes D1-D6 n'a été violée silencieusement.** T1, T2, T3, T5, T6b,
> T6c, T7 CONFIRMÉS COHÉRENTS ; T4, T6a, T8 avaient chacun un écart réel.
> Confirmation explicite obtenue : Realtime sur `series` jamais activée
> reste bien le SEUL écart sur T6c (grep exhaustif des 12 migrations).
>
> **Les 7 écarts trouvés sont CORRIGÉS ET DÉPLOYÉS** (committé `9caee5f`,
> poussé, vérifié en ligne sur Vercel sans régression) : `recognized`
> propagé jusqu'à `sync_logs` (T4) ; avertissement quota API bas ajouté (T4) ;
> couverture vitest de l'idempotence écrite (`lib/scoring/recompute.test.ts`,
> 37/37) ; fonctions SECURITY DEFINER rétro-actées (`SPEC_TECHNIQUE_RLS_V0.1.md`
> §12, T3) ; garde CANCELLED/POSTPONED rétro-actée (`SPEC_TECHNIQUE_SCORING_V0_1.md`
> §13, T5) ; T6a — route `/reset-password` codée et testée avec un vrai envoi
> d'email ; **T8 — spec rédigée/validée, planificateur GitHub Actions ET
> nettoyage des données de test ENTIÈREMENT OPÉRATIONNELS** (les 3 actions
> externes faites par l'utilisateur : `HIGHLIGHTLY_API_KEY` sur Vercel,
> `SYNC_SECRET` sur GitHub — un premier essai raté par un secret mal collé,
> corrigé — et `cleanup-test-data.mjs --confirm` exécuté pour de vrai,
> vérifié en base). `tsc`/`eslint`/`vitest`/`next build` tous propres.

## Gaps techniques du prototype (à corriger ou trancher dans son périmètre)

- **Performance de `lib/botScripting.ts`** : requêtes Supabase séquentielles
  non groupées par bot (pas de batch/`Promise.all`). Avec 16 bots, un
  "Avancer de N jours" avec N élevé (testé à 60) a saturé la mémoire du
  process Node et bloqué l'admin ~84 secondes. Contourné côté UI
  (`AdvanceManyDaysControl` avance jour par jour), code non optimisé.
  Jugé hors scope pour un prototype jetable — pas de correction prévue sauf
  gêne concrète en usage.

## Ouvert pour les phases suivantes de la V1 (implémentation + T8)

> La RLS (précédemment listée ici comme « reportée en V1 ») est FAITE et
> TESTÉE de bout en bout depuis la session du 18/07/2026 (migrations #3/#4,
> plan de test T3 §7) — retirée des points ouverts. Voir `JOURNAL_SESSIONS.md`
> et `ETAT_ACTUEL.md`.

> Le choix du fournisseur d'API NBA (Highlightly, tranché dès la session du
> 17/07/2026) et le mécanisme de synchro (architecture complète, T4, session
> du 18/07/2026 suite) sont désormais FAITS et VALIDÉS. L'attache match → série
> (branche A vs B), seule réserve empirique restante à la validation de T4, est
> également tranchée par le repérage API du même jour : BRANCHE B retenue.
> Aucun de ces points n'apparaît donc plus ci-dessous. Voir
> `SPEC_TECHNIQUE_SYNCHRO_V0.1.md` et `JOURNAL_SESSIONS.md`.

> Le moteur de scoring (T5, session du 19/07/2026) est désormais FAIT et
> VALIDÉ : dérivation de l'agrégat de série, barèmes Playoffs + NBA Cup,
> neutralisation A2, et déclencheurs de recalcul (`recomputeMatch` /
> `recomputeSeries` / `recomputeBet` / `recomputeCompetition`, T5 §10.1)
> actés avec la couture T4. Les 3 points renvoyés à T5 n'apparaissent donc
> plus ci-dessous. Voir `SPEC_TECHNIQUE_SCORING_V0_1.md` et
> `JOURNAL_SESSIONS.md`.

> Les specs **T6** (T6a/T6b/T6c — arbre `app/` + route groups, server
> actions joueur/admin + garde-fou C2, Realtime + rendu des états actés) et
> **T7** (design system) sont désormais FAITES et VALIDÉES (session du
> 19/07/2026) : la série de specs techniques **T1 → T7 est entièrement
> bouclée**. Le rendu des états UX déjà actés fonctionnellement (paris
> annulés barrés/grisés, joueurs absents en compteur, marquage public de
> correction, joueur inactif conservé) est désormais entièrement SPÉCIFIÉ
> par T6c/T7 — le point ouvert n'est plus « spécifier » mais « coder » (voir
> le point d'implémentation ci-dessous). Voir
> `SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_a.md` /
> `SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_b.md` /
> `SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_c.md` / `SPEC_DESIGN_SYSTEM_V0_1.md`
> et `JOURNAL_SESSIONS.md`.

- **Implémentation code de la V1** (post-T7, EN COURS depuis le 19/07/2026) :
  le HUB JOUEUR (8 écrans), le LOT ADMIN (6 écrans), le CHANTIER T5
  (moteur de scoring, 4 lots) ET le chantier « Gestion des compétitions »
  (3/3 lots, voir entrée dédiée ci-dessous) sont désormais TOUS CODÉS,
  VÉRIFIÉS ET testés en conditions réelles. Reste à coder (ordre de reprise
  ci-dessus) : **T4** (routes `/api/sync/*`, client Highlightly, cron —
  déjà entièrement spécifiée, jamais codée, bloquant = clé API) ; PUIS le
  vrai hub Jouer (remplace le hub temporaire §2.10, aucune spec d'écran
  encore écrite) ; PUIS le Realtime + rendu des états au-delà de ce qui
  existe déjà (T6c). Détail dans `ETAT_ACTUEL.md` §2.
- **Gestion des compétitions — chantier ENTIÈREMENT CLOS (3/3 lots)**
  (ouvert le 27/07/2026, `ETAT_ACTUEL.md` §2.30, suite à une question
  directe de l'utilisateur sur le switch Playoffs/Cup — a révélé que le
  plan d'origine du 16/07/2026 visait la NBA Cup EN PREMIER pour la V1,
  lancement réel visé le 30/10/2026, mais que le jeu de données de test a
  silencieusement dérivé vers Playoffs le 23/07 sans que ça ne soit
  recroisé ; le moteur de scoring T5, lui, n'a jamais dérivé, les deux
  barèmes sont pleinement codés) : lot 1/3 (création), lot 2/3 (saisie des
  résultats + avancement automatique du bracket, `/admin/competitions/
  results`) et lot 3/3 (clôture/archivage, débloqué en cours de route par
  un vrai besoin utilisateur — sans lui, impossible de créer une 2e
  compétition) tous FAITS, VÉRIFIÉS et testés EN CONDITIONS RÉELLES par
  l'utilisateur lui-même (§2.33 `ETAT_ACTUEL.md` pour le détail complet).
  - **Mini-bracket NBA Cup — CONSTRUIT et VÉRIFIÉ le 31/07/2026** (retiré
    d'ici, voir `ETAT_ACTUEL.md` §2.52 et `SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1.md`
    §10, correctif post-validation) : l'admin saisit les 8 équipes qualifiées
    en 4 affiches de quarts à la création (aucune contrainte de conférence,
    le schéma ne la modélise pas pour la Cup), topologie bottom-up identique
    aux Playoffs. Dry-run réel (2 passes successives sur des vraies dates de
    déc. 2025) : synchro, scores, ET avancement automatique (agrégat de
    série à 1 seul match, jamais exercé avant ce jour) tous vérifiés en
    conditions réelles.
  - Toujours hors périmètre, non tranché : mapping automatique A7
    (pré-remplissage depuis T4, quand elle existera) ; onglet Historique
    côté Profil joueur (`decisions_multi_competitions_historique.md` §4).
    **Reformulé le 28/07/2026** suite à une question directe de
    l'utilisateur (« l'API peut détecter les matchs Cup automatiquement,
    non ? ») : la spec T4 (BRANCHE B, §5.2, empiriquement confirmée) dit
    que l'API est match-centrique, JAMAIS série-centrique — un match
    synchronisé se rattache à une série interne déjà posée, par
    heuristique (paire d'équipes + fenêtre de dates), l'API ne peut pas
    inventer la STRUCTURE d'une série. Détecter les 4 matchs de quarts
    (dates, équipes) est donc plausible via `/api/sync/schedule` ; mais
    construire à partir de ça les 7 séries internes (quarts/demies/finale,
    la bonne équipe au bon slot, distinguer ces matchs de la saison
    régulière qui tombe la même semaine) est une règle JAMAIS écrite ni
    sondée empiriquement — contrairement à la branche A/B des Playoffs
    (sondée sur une vraie requête, §5.1 de T4). Décidé AVEC l'utilisateur :
    reporté à une fois la clé API Highlightly en main, à sonder sur la
    fenêtre Cup réelle de décembre 2025 (déjà citée en test A6) avant de
    concevoir quoi que ce soit.
- **12 vulnérabilités npm — RÉSOLU le 27/07/2026 (suite)**, voir
  `ETAT_ACTUEL.md` §2.32 pour le détail complet : `next` 16.2.10→16.2.12
  (corrige les 9 CVE directes) + `overrides` npm (`minimatch@^10.2.6`,
  `brace-expansion@^5.0.8`, `postcss@^8.5.18`, `sharp@^0.35.0`) pour le
  reste. `npm audit` → 0, `tsc`/`eslint`/`next build`/`npm test` tous
  propres. Committé et poussé sur `main`.
- **`eslint` bloqué en v9, bump v10 reporté en amont** (trouvé le 27/07/2026
  en traitant le point ci-dessus, `ETAT_ACTUEL.md` §2.32) : la montée à
  `eslint@10.8.0` a été tentée, mais `eslint-plugin-react@7.37.5` (embarqué
  par `eslint-config-next@16.2.12`) plante (`TypeError:
  contextOrFilename.getFilename is not a function` — API supprimée par
  ESLint 10). Vérifié sur le registre npm : aucune version stable
  d'`eslint-plugin-react` ne déclare de compatibilité eslint 10 dans son
  `peerDependencies` à ce jour (max `^9.7`). Flagué explicitement avec
  l'utilisateur avant de choisir : reste sur eslint 9 pour l'instant,
  6 vulnérabilités « eslint-plugin-* » neutralisées autrement (overrides
  minimatch/brace-expansion ci-dessus) plutôt que par le bump v9→v10. À
  reprendre : revérifier quand `eslint-config-next` (ou
  `eslint-plugin-react` seul) publie une version compatible eslint 10.
- **Petits points d'intégration des tokens** (ouverts par la consolidation du
  21/07/2026, `app/tokens.css`, non bloquants) : contraste AA de
  `--color-trend` sur fond **clair** (une seule valeur donnée, §15.4, à
  vérifier à l'usage réel). Police : RÉSOLU le 20/08/2026, autrement que
  prévu ici — pas d'`@font-face` Inter auto-hébergée manuelle, mais Sora +
  Oswald via `next/font/google` (ETAT_ACTUEL.md §2.93) — retiré d'ici.
  Asset réel du bandeau parquet : DÉPOSÉ le 29/07/2026
  (`public/brand/hero-parquet.jpg`, §2.45 `ETAT_ACTUEL.md`) — retiré d'ici.
- **T8 — Déploiement : CHANTIER ENTIÈREMENT CLOS** (28/07/2026,
  `SPEC_TECHNIQUE_DEPLOIEMENT_V0.1.md`, `ETAT_ACTUEL.md` §2.41/§2.42). Les 3
  actions externes sont FAITES et VÉRIFIÉES par l'utilisateur : (1)
  `HIGHLIGHTLY_API_KEY` poussée sur Vercel (production/preview/development) ;
  (2) `SYNC_SECRET` ajouté comme secret GitHub Actions — un premier essai a
  échoué (`curl: (43)`, valeur collée avec un retour à la ligne parasite,
  tout le fichier `.env.local` copié par erreur au lieu de la seule valeur),
  corrigé et reconfirmé vert ; (3) `scripts/cleanup-test-data.mjs --confirm`
  exécuté pour de vrai par l'utilisateur — « Playoffs NBA (test) », « Test
  UI Matchs » et les 7 comptes `seed-*@nba-pronos.test` supprimés, vérifié
  directement en base après coup (`Demo_Amis`/`Rillettes-31` intacts, comme
  prévu).
- **3 compétitions de test ARCHIVÉES, jamais documentées avant le nettoyage,
  gardées comme historique** (trouvées le 28/07/2026 en vérifiant l'état
  post-nettoyage) : « TEST NBA CUP », « TEST playoff 28/07/2026 », « TEST T4
  sync — Playoffs 2026 (réel) » — hors du périmètre connu du script de
  nettoyage (qui ne ciblait que « Playoffs NBA (test) »/« Test UI Matchs »),
  laissent 30 matchs/30 séries/15 picks de bracket/2 pronos/1 pari en base.
  Statut ARCHIVED (jamais ACTIVE, aucun impact sur le jeu réel). Décision
  explicite de l'utilisateur : **gardées comme trace historique des tests**,
  pas supprimées — ne pas les re-signaler comme un oubli.
- **Comportement de « Confirm email » pas élucidé** (27/07/2026,
  `ETAT_ACTUEL.md` §2.17/§7) : le réglage a été décoché et sauvegardé dans
  le dashboard Supabase (confirmé par capture d'écran), mais un test
  contrôlé ET une vraie tentative d'inscription ont quand même buté sur
  `over_email_send_rate_limit`/le message générique catch-all juste après.
  Deux hypothèses non tranchées : quota du mailer par défaut (partagé entre
  tous les types d'email) encore épuisé par un envoi précédent, ou envoi de
  courtoisie indépendant du réglage. Pas revérifié après un délai suffisant
  pour trancher. Solution de contournement immédiate (création de compte
  via API Admin, `email_confirm:true`) utilisée pour la démo, mais ne
  résout pas la question pour une vraie inscription publique en masse — à
  reprendre : soit revérifier après un délai, soit configurer un SMTP
  personnalisé (Resend évoqué, nécessite un nom de domaine vérifié que
  l'utilisateur ne possède pas à ce jour).
- **Les emails `@nba-pronos.test` des comptes de seed sont rejetés par
  Supabase Auth** (trouvé le 28/07/2026 en testant `resetPasswordForEmail`
  en conditions réelles, lot reset-password T6a) : Supabase renvoie
  `400 — Email address "..." is invalid` pour toute adresse `@nba-pronos.test`
  (TLD `.test`, réservé RFC 2606 pour les tests — le validateur email de
  Supabase Auth le rejette explicitement, contrairement à un domaine réel
  type `example.com`, testé et accepté sans erreur). N'affecte PAS les 7
  comptes de seed existants (créés via l'API Admin, `auth.admin.createUser`,
  qui ne repasse pas par cette validation) ni la connexion normale — mais
  bloque toute action qui redéclenche un envoi d'email Supabase pour un
  compte de seed (reset password réel, ou un futur renvoi de confirmation).
  Pas bloquant pour l'instant (aucun écran ne l'utilise sur un compte de
  seed), mais à garder en tête si un test de reset-password en conditions
  réelles est un jour tenté sur un compte de seed plutôt qu'un email
  personnel.
- **Compte de démo partagé, temporaire** (27/07/2026, `ETAT_ACTUEL.md`
  §2.17) : `Demo_Amis` / `demo-amis@nba-pronos.test` (rôle PLAYER), créé pour
  que les amis de l'utilisateur testent l'appli SANS vraie compétition entre
  eux (un seul bracket/jeu de pronos partagé par tout le monde — compromis
  signalé et accepté explicitement). **À retirer ou reconvertir** dès que
  l'utilisateur passe à un compte par ami, prévu explicitement après la fin
  de la V1 — même famille que l'autre élément temporaire encore suivi
  (hub Jouer temporaire ; la déconnexion temporaire, elle, est retirée pour
  de bon depuis l'écran Profil, 27/07/2026).
- **Dates du jeu de données de test à re-décaler périodiquement** (trouvé le
  27/07/2026, demande utilisateur — ses amis testeurs, via `Demo_Amis`
  ci-dessus, ne voyaient plus aucun match à pronostiquer ni de bracket
  ouvert) : `bracket_deadline` et les dates des matchs sont des timestamps
  ABSOLUS posés relativement au moment du seed (23/07/2026) — 4 jours plus
  tard, tout était mécaniquement passé. Corrigé une première fois (5 séries
  « sans rôle particulier » + `bracket_deadline` décalées vers l'avenir,
  mêmes offsets relatifs qu'à l'origine ; les 3 matchs à rôle spécial de
  §2.11 — CLE-ORL FINISHED, DEN-SAC IN_PROGRESS, MIN-GSW latence —
  intentionnellement NON touchés). Se reproduira : à recorriger (même
  méthode, script jetable service_role) chaque fois que la démo doit
  redevenir active après quelques jours d'inactivité, tant que le seed
  n'est pas remplacé par un mécanisme relatif à `now()`.
- **Pré-remplissage IA gagné/perdu des paris** (reporté, non bloquant V1) :
  évolution envisagée pour suggérer gagné/perdu à partir des données du
  match (réaliste pour les paris déductibles de scores/box scores, inopérant
  pour les paris flous/subjectifs), l'IA ne restant qu'une aide, jamais
  l'autorité finale (`nba_pronos_SPEC_FONCTIONNELLE_V0_2.md` §6.7/§10.7).
  Faisabilité et périmètre exact toujours renvoyés à la spec technique — non
  traité par T1/T2/T3, ni par T6/T7 (hors périmètre, aucune mention).
- **Barème stable pour un futur classement all-time** (backlog) : un
  classement all-time toutes compétitions confondues nécessite que le
  barème de scoring reste identique d'une compétition à l'autre, sinon il
  doit être construit d'une manière qui neutralise les changements de
  barème (ex. rang/points relatifs plutôt que total brut). Pas tranché,
  juste à ne pas oublier en conception si le barème change (`BACKLOG_V1.md`).
- **Règle « pari REJECTED avant/après sa deadline »** (0.2.4 §6, rencontrée en
  codant l'écran Matchs, `lib/queries/matches.ts`) : aucune colonne
  `rejected_at` n'existe (`bets`) — la distinction avant/après n'est donc pas
  calculable. Tranché AVEC l'utilisateur : un pari `REJECTED` est TOUJOURS
  considéré libéré (cas normal, `sealDeadlines` auto-valide tout `SUBMITTED`
  restant à la deadline — un rejet après coup est un cas limite hors
  fonctionnement normal). Le lot « Nouveau pari » (§2.15 `ETAT_ACTUEL.md`,
  fonction `save_bet`, migration #10) applique la MÊME règle pour le quota
  serveur — cohérence maintenue entre lecture (Matchs) et écriture (Nouveau
  pari). Toujours pas de gestion admin du refus (`rejectBet`) à ce jour —
  hors périmètre des deux lots. À rouvrir si une vraie colonne `rejected_at`
  est ajoutée un jour.
- **Tailles inégales entre les 30 logos de franchise — ÉVALUÉ, PAS DE
  CORRECTIF (29/07/2026)** : disparité réelle (SAS ≈2:1 vs LAL quasi carré)
  mais `object-fit: cover` (seul correctif CSS pur) a été testé visuellement
  (harnais Playwright, capture comparative) et **coupe le texte du wordmark**
  sur tous les logos larges (SAS, LAL, ORL, NOP, HOU) — remède pire que le
  problème. Décision explicite de l'utilisateur : laisser tel quel plutôt que
  recadrer les 30 SVG à l'aveugle. Voir `ETAT_ACTUEL.md` §2.45.
- **Grossir encore le logo de la carte-sélecteur ?** (évoqué par
  l'utilisateur le 25/07/2026, NON tranché) : au-delà des 48px actuels
  (`--logo-size-lg`), une taille plus grande a été mentionnée comme piste
  possible sans être décidée. À reprendre si le besoin se confirme à
  l'usage.
- **Logos de franchise sur Accueil et Classement — PARTIELLEMENT RÉSOLU le
  18/08/2026** (trouvé le 24/07/2026 : les 30 SVG existent bien dans
  `public/logos/teams/` et sont déjà committés, câblés le 24/07 sur Bracket
  et Matchs, `components/ui/TeamLogo.tsx`). L'item "matchs à pronostiquer"
  de l'Accueil (« À traiter ») a maintenant de vraies pastilles d'équipe —
  `TodoItem.matchup` restructuré en objets équipe au lieu du texte
  pré-formaté envisagé ici (le "changement plus large" ci-dessous, fait
  pour de vrai plutôt que l'extraction regex, jugée moins propre à
  l'époque). **Reste en texte seul** : le feed « Ça vient de tomber » de
  l'Accueil (icônes de résultat choisies à la place, pas de pastille —
  voir `ETAT_ACTUEL.md` §2.69) et le Classement (toujours aucune équipe
  affichée, classement de joueurs). À reprendre séparément si voulu.
- **Garde `bet_scope=SERIES` interdit en NBA Cup non testée en conditions
  réelles** (26/07/2026, `save_bet`, migration #10) : le jeu de données de
  test ne porte qu'une compétition PLAYOFFS active — le refus d'un pari
  SÉRIE quand la compétition est NBA_CUP a été vérifié par relecture du code
  SQL uniquement, jamais exercé en live faute d'une compétition NBA Cup de
  test. À vérifier en conditions réelles si/quand un jeu de données NBA Cup
  existe.
- **Rendu « à pronostiquer » d'un match Cup encore `SCHEDULED` — jamais
  vérifié** (31/07/2026, dry-run `ETAT_ACTUEL.md` §2.52) : tous les vrais
  matchs Cup disponibles pour le test (déc. 2025) sont dans le passé par
  rapport à aujourd'hui — les écrans joueur (Hub Jouer, Accueil) filtrent
  sur `scheduled_at > maintenant réel`, jamais affichable sans décalage
  artificiel. Tentative de trouver un vrai match encore `SCHEDULED` sur la
  saison 2026-27 : 0 match trouvé sur 5 dates d'octobre 2026 sondées via
  l'API — calendrier pas encore publié à ce jour. Reporté, décidé AVEC
  l'utilisateur : à reprendre une fois le calendrier réel 2026-27 publié
  côté Highlightly (une commande `simulate-upcoming` existe dans
  `scripts/dryrun-cup-sync-test.mjs` si un test avec un match manuel
  redevient acceptable, mais l'utilisateur l'a explicitement écartée cette
  fois — préfère un vrai match si possible).
- **`SYNC_SECRET` exposé en clair dans le chat, régénération pas confirmée**
  (31/07/2026, `ETAT_ACTUEL.md` §2.52) : apparu plusieurs fois lors du
  dry-run de synchro Cup (l'utilisateur a collé la vraie valeur dans des
  commandes `curl`/`Invoke-WebRequest`, une fois via une sélection IDE) —
  même famille que 2 incidents précédents sur des mots de passe de test.
  Recommandé : nouvelle valeur dans `.env.local` ET dans le secret GitHub
  Actions `SYNC_SECRET` (les 2 doivent rester synchronisés, sinon les crons
  de synchro renvoient 401). Pas encore fait à ce jour.
- **3 abonnements Apple dupliqués sur `Demo_Amis`** (trouvé le 29/07/2026 en
  testant les rappels ciblés en conditions réelles, `ETAT_ACTUEL.md` §2.47) :
  Safari (iOS) crée un NOUVEL abonnement à chaque tentative plutôt que de
  réutiliser le même, contrairement à Chrome/FCM. Sans conséquence
  fonctionnelle (`sendPushToSubscriptions` boucle sur tous), juste 3 envois
  identiques au lieu d'un pour ce compte précis. À dédupliquer (ex. garder le
  plus récent par `user_id`) si gênant en usage réel, pas urgent.

## Interprétations d'implémentation actées (pas des gaps — à connaître, et à
## reporter dans `decisions_0.2.x` si l'utilisateur le souhaite un jour)

- Seuil "10 brackets remplis" (0.2.6) compté SÉRIE PAR SÉRIE, pas sur le
  bracket entier à 15/15.
- Classement : rang affiché TOUJOURS calculé sur Total, peu importe la
  colonne triée à l'affichage.
- "dont Écarts" rendu triable au classement — pas une des 5 colonnes
  officielles listées par 0.2.6/0.2.9.
- Tri alphabétique du classement par pseudo : différé en V1.
- Révélation d'un prono dès `VALIDATED`, peu importe volontaire ou
  auto-validé — simplification assumée par rapport à 0.2.3 §5 (distinction
  jamais observable en pratique).
- **Écran Accueil (session du 21/07/2026, `lib/queries/home.ts`)** :
  - Item « À traiter » du bracket : si `competitions.bracket_deadline` est
    NULL (deadline pas encore connue), l'item **n'apparaît pas** (rien à
    compter à rebours). Pas tranché par la spec produit, à confirmer si ce
    cas se présente réellement en usage (aucune compétition en base pour
    l'instant, §3 `ETAT_ACTUEL.md`).
  - Feed « Ça vient de tomber », item « Pari statué par l'admin » : la spec
    citait la colonne `resolved_at` mais illustrait le rendu par le texte
    « validé / ajusté » (qui décrit en réalité `validated_at`, un workflow
    différent). Tranché AVEC l'utilisateur (AskUserQuestion, 21/07/2026) :
    lecture littérale de la colonne citée → l'item correspond aux paris
    ANNULÉS (`CANCELLED`), libellé rendu « Neutralisé ». Voir
    `ETAT_ACTUEL.md` §7 et `JOURNAL_SESSIONS.md`.
  - Bloc « À traiter (paris) » : la spec ne détaille pas la mécanique de
    « slot à reproposer » côté requête. Interprété comme les paris
    `REJECTED` dont la deadline (`bet_deadline_open`, calcul reproduit en
    TypeScript, pas d'appel RPC) n'est pas encore passée — lecture directe
    de 0.2.4 §6 (« refusé avant deadline → slot libéré »), pas une
    invention. Paris `DRAFT` (brouillons) inclus de la même façon.
- **Écrans Classement/Bracket (session du 22/07/2026,
  `lib/queries/{leaderboard,bracket}.ts`)** :
  - Nav des routes physiques uniques `/leaderboard` et `/bracket` (hors
    route groups, T6a §3.2/§8.1) : la spec produit ne détaillait pas
    l'implémentation, seule l'archi T6a la prescrivait (« la page choisit
    elle-même sa nav selon la session »). Ajouté `components/nav/
    ScreenShell.tsx` (choix TabBar/nav réduite) + `components/nav/
    PublicNav.tsx` (extrait de `(public)/layout.tsx`, désormais partagé,
    stylé aux tokens — il ne l'était pas). Décision structurelle appliquée
    directement (déjà actée par T6a, pas une nouvelle règle produit).
  - `filledCount`/`totalCount` de `BracketData` (« progression X/15 ou
    X/7 ») : le contrat de type n'a pas de `userId`, donc pas de notion de
    « mon bracket rempli à X/15 ». Interprété comme la progression du
    TOURNOI (nombre de séries dont le résultat officiel est déjà connu),
    cohérent avec « vue A résumé... état réel de chaque série ». À
    confirmer si une autre lecture était voulue.
  - Le contrat `BracketNode` (spec §15.2, recopié à l'identique) n'expose
    pas le score de série RÉEL (`series.official_score_format`) — seulement
    `actualWinnerAbbreviation`. La carte de série (vue A/B) affiche donc le
    vainqueur seul, jamais le score exact de la série, y compris en
    Playoffs. Pas un oubli de code : le type imposé par la spec ne porte
    pas ce champ. À rouvrir si le score de série réel doit être affiché.
  - « Or = champion » (§17) appliqué STRICTEMENT à la finale (NBA_FINALS /
    CUP_FINAL) : le vainqueur d'une série normale (tour 1, demies, etc.)
    est rendu en vert (résultat gagné), jamais en or — lecture littérale de
    « champion déduit du bracket », pas une extension à chaque série.
  - Libellés de tour (« 1er tour », « Demi-finales de conférence », etc.) et
    nom de compétition générique (« Playoffs » / « NBA Cup », faute de
    `competitionName` dans `BracketData`) : texte de rendu choisi par
    l'implémentation, pas fourni par la spec ni par le schéma.
- **Écran Matchs (session du 23/07/2026, `SPEC_ECRAN_MATCHS_V0_1.md`)** :
  - la fenêtre 3 jours filtre sur **`scheduled_at > now()`**, jamais sur
    `matches.status` — le planificateur tournant toutes les 30-60 min (T4/A8),
    un match commencé peut rester `SCHEDULED` en base près d'une heure ; le
    verrouillage est piloté par l'heure connue, jamais par le live (T6c §10.3) ;
  - `N` du compteur « X/N ont pronostiqué » = joueurs **`ACTIVE` uniquement**
    (un `DISABLED` n'écrit plus, l'y compter rendrait `N/N` inatteignable) —
    sans contradiction avec sa conservation au classement, qui porte sur
    autre chose ;
  - « accéder à un match oublié » = **consulter** + déposer une **requête de
    correction** (0.2.3 §7), **jamais** une réouverture de la saisie (le
    verrouillage au coup d'envoi reste irréversible, 0.2.3 §4).
- **Écran Matchs — implémentation (session du 23/07/2026,
  `lib/queries/matches.ts`, `components/matches/*`)** :
  - regroupement par jour (« Ce soir »/« Demain »/« Samedi 25 ») en fuseau
    **Europe/Paris**, explicite — aucune convention de fuseau n'existait
    ailleurs dans le code, le fuseau machine du serveur pouvant être UTC en
    hébergement ;
  - « pavé numérique » de saisie de l'écart (§6) = `<input type="number"
    inputMode="numeric">`, qui déclenche le clavier numérique natif du
    système sur mobile — pas de grille de touches custom construite ;
  - badge « corrigé par un admin » : le contrat de types figé (§13,
    `OtherPrediction.isAdminCorrected: boolean`) ne porte ni le nom de
    l'admin ni celui du requérant (que la prose §8 mentionne littéralement,
    « saisi/corrigé par X sur requête de Y ») — le type fait autorité,
    rendu générique sans nom ;
  - statuts de prono (§4) et rappel « ✓ LAL −8 » : rendus en CSS pur (tokens
    de bordure/fond) + caractères (✓, →), aucune icône SVG créée — la spec
    elle-même écrit le rappel en toutes lettres avec un caractère ✓.
- **Écran Mes pronos (session du 24/07/2026, `SPEC_ECRAN_MES_PRONOS_V0_1.md`,
  `lib/queries/my-predictions.ts`, `components/my-predictions/*`)** :
  - **Dérivation d'état par COMPLÉTUDE, jamais par statut brut** (tranché AVEC
    l'utilisateur, ambiguïté non couverte par le tableau fermé §8) :
    `sealDeadlines` (auto-validation DRAFT complet → VALIDATED, T6b §2) n'est
    invoquée nulle part dans le code (aucun cron, aucune fonction de ce nom) —
    une ligne DRAFT aux deux champs remplis est donc un 4e cas réel. Rendu
    FROZEN par complétude, symétriquement pour mon prono et ceux des autres
    joueurs (RevealPanel) ;
  - le requérant d'une correction étant toujours le propriétaire du prono
    (§7.1), le rendu nominatif distingue « à ta demande » (mon propre prono,
    `PredictionSummary`) de « à la demande de <pseudo> » (prono d'un autre,
    `RevealPanel`) — aucune donnée supplémentaire à lire, juste un choix de
    formulation selon qui affiche le bloc ;
  - filtre date (§4.2) : `<input type="date">` natif (pas un `<select>`
    contraint aux `availableDates`), conformément à la lettre de la spec —
    une date hors du jeu de données mène simplement à l'état vide « Aucun
    match pour ce filtre » (§15.4), pas une erreur ;
  - libellé de série des filtres/en-tête de pari (§4.2/§11.2), non fixé par
    la spec : `<libellé de tour> — <équipe1> vs <équipe2>` (ex. « 1er tour —
    BOS vs MIA »), construit via `lib/labels/rounds.ts` + `series.team1_id/
    team2_id` (pas les home/away du match, qui peuvent être inversés d'un
    match à l'autre de la même série) ;
  - pari MATCH/SERIES affiché (`AssociatedBetCard`) : `catégorie` suit la
    même règle que `difficulté` (`validated_category ?? proposed_category`,
    la validée fait foi, 0.2.4 §7) — la spec ne le précise que pour la
    difficulté, extension jugée cohérente plutôt qu'une nouvelle règle.
- **Écran Nouveau pari (sessions du 26-27/07/2026,
  `SPEC_ECRAN_NOUVEAU_PARI_V0_1.md`, `lib/queries/bets.ts`,
  `lib/actions/bets.ts`, `components/bets/BetForm.tsx`,
  `components/matches/InlineBetForm.tsx`)** :
  - **choix structurant confirmé AVEC l'utilisateur** : écriture via 2
    fonctions SQL `SECURITY DEFINER` (`save_bet`/`withdraw_bet`, migration
    #10, patron `request_prediction_correction`) plutôt qu'une logique
    TypeScript pure — seule façon de fermer, par un `pg_advisory_xact_lock`,
    la fenêtre de course sur le cap « 3 MATCH/série » (aucun backstop
    d'index unique pour ce quota précis, contrairement aux deux quotas
    « 1 actif ») ;
  - défaut de scope à l'entrée libre (`mode: "FREE"`, `BetForm.tsx`) : `MATCH`
    par défaut (pas `SERIES`), simple choix d'ergonomie non fixé par la
    spec — ajustable sans changement de contrat de données ;
  - tier de logo des sélecteurs série/match (§13, non fixé par la spec) :
    20px, cohérent avec les lignes de liste existantes (`MatchRowStatic`,
    Mes pronos) plutôt qu'un nouveau tier ;
  - sélecteurs série/match = listes de boutons (`role="radio"`), pas des
    `<select>` natifs — un `<option>` HTML ne peut pas afficher de logo,
    exigé par §13 sur ces deux sélecteurs précisément (catégorie/difficulté,
    sans logo, restent des `<select>` natifs) ;
  - pari non éditable ici (statut non DRAFT/SUBMITTED, propriétaire différent,
    ou `betId` invalide) sur `/play/bets/[id]/edit` : état inerte affiché
    plutôt qu'une redirection vers « Mes paris », qui n'existait pas encore
    à l'époque — pas un choix produit, une conséquence du séquencement des
    lots. SUPERSEDÉ le 27/07/2026 : « Mes paris » existe désormais
    (`ETAT_ACTUEL.md` §2.19) — faire pointer cet état inerte vers
    `/play/bets` reste une amélioration possible, non faite (pas demandée) ;
  - saisie inline MATCH dans Matchs (27/07/2026, demandée explicitement
    par l'utilisateur en cours de session, PAS dans la spec close) : élargit
    le périmètre acté par la spec §1 (deux points d'entrée vers un écran
    dédié) — confirmé avec l'utilisateur avant de coder, pas une extension
    silencieuse. Les paris SÉRIE restent exclusivement sur l'écran dédié.
- **Écran Bracket personnel (session du 27/07/2026,
  `SPEC_ECRAN_BRACKET_PERSONNEL_V0_1.md`, `lib/queries/bracket-fill.ts`,
  `lib/actions/bracket-fill.ts`, `components/bracket-fill/*`)** :
  - **AUCUNE spec n'existait pour cet écran** (contrairement aux lots
    précédents, qui avaient au moins un brouillon) — rédigée EN SÉANCE avec
    l'utilisateur, appuyée sur des décisions déjà actées (0.2.2, 0.2.9 §5)
    plutôt que devinée ;
  - **choix structurant confirmé AVEC l'utilisateur** : écriture en
    TypeScript pur (RLS existante suffit, PAS de fonction SECURITY DEFINER)
    — à l'inverse du choix fait pour « Nouveau pari » ; chaque lot a été
    évalué sur ses propres besoins de concurrence, pas un patron copié
    automatiquement du lot précédent ;
  - garde-fou explicite hérité du prototype (pas une invention) : la cascade
    des candidats de tour 2+ dérive TOUJOURS du pick du joueur, jamais du
    résultat officiel — `computeCandidateTeamIds` ne lit même pas les
    colonnes de résultat, structurellement incapable de reproduire le bug
    historique (voir `ETAT_ACTUEL.md` §7) ;
  - Realtime `series` (T4 §9) : réévaluée pour ce lot précisément, TOUJOURS
    reportée (aucun besoin live sur un écran de saisie personnelle) — voir
    gap dédié ci-dessus ;
  - tap vainqueur + boutons de score sauvegardent IMMÉDIATEMENT (pas de
    bouton "enregistrer" séparé) — lecture littérale de 0.2.9 §5 ("vainqueur
    en 1 tap"), cohérent avec l'absence de champ texte sur cet écran
    (contrairement à Nouveau pari, qui a un énoncé libre à saisir) ;
  - validation du bracket sans garde de complétude (0/15 à 15/15 accepté) :
    lecture littérale de 0.2.2 §3, confirmée par le comportement du
    prototype avant réécriture.
- **Système de ligue (session du 30/07/2026, `BACKLOG_V1.md`,
  `supabase/migrations/20260730090000_leagues.sql` et
  `..._fix_league_memberships_recursion.sql`, `lib/queries/leagues.ts`,
  `lib/actions/leagues.ts`)** :
  - **AUCUNE spec n'existait pour cette fonctionnalité** — 3 choix
    structurants cadrés AVEC l'utilisateur avant de coder (même patron que
    le Bracket personnel) : ligue PERMANENTE (indépendante des
    compétitions) ; appartenance à PLUSIEURS ligues ; création ouverte à
    tout joueur ACTIVE depuis Profil, adhésion par CODE généré
    aléatoirement (pas un mot de passe choisi) ; rang de la vue filtrée
    RECALCULÉ dans le groupe (pas le rang général conservé) ;
  - **choix structurant confirmé AVEC l'utilisateur** : écriture via 2
    fonctions SQL SECURITY DEFINER (`create_league`/`join_league`, même
    patron que `request_prediction_correction`) — seule façon d'écrire le
    code de ligue sans jamais l'exposer par un INSERT ouvert ; quitter une
    ligue reste un DELETE direct (RLS suffit, pas de logique particulière) ;
  - bug réel trouvé en testant EN CONDITIONS RÉELLES (pas en relisant le
    code) : récursion infinie sur la policy `league_memberships_select`
    (sous-requête sur sa propre table) — cassait aussi `leagues`/
    `league_secrets`, qui l'interrogent via `EXISTS`. Corrigé par
    `my_league_ids()` (SECURITY DEFINER, même patron que
    `is_admin()`/`is_active()`), migration #17 ;
  - un id de ligue invalide ou dont l'appelant n'est pas membre retombe
    silencieusement sur le classement Général (`getLeaderboard`) plutôt que
    de lever une erreur ou d'afficher une page vide surprenante — la RLS
    garantit déjà qu'aucune ligne ne fuite, ce repli est une question
    d'ergonomie, pas de sécurité ;
  - remontée utilisateur en testant (pas un bug) : le sélecteur de ligue
    doit rester visible même sans compétition active (contrairement à
    l'invariant préexistant « aucune active = état vide global » du
    Classement) — tranché AVEC l'utilisateur, `SortChips` seul reste absent
    (rien à trier sans classement).
- **Superlatifs de fin de compétition + écran Historique (session du
  30/07/2026, `BACKLOG_V1.md`, migration #18,
  `lib/scoring/superlatives.ts`, `lib/snapshots/leaderboardSnapshot.ts`,
  `lib/queries/history.ts`)** :
  - **AUCUNE spec n'existait** — "plus grosse remontée au classement"
    s'est révélé incalculable sans historique de classement dans le temps
    (seul l'état figé final existait, `competition_archives`). Décidé AVEC
    l'utilisateur (2 questions posées avant de coder) : construire d'abord
    un snapshot quotidien (`leaderboard_snapshots`) plutôt que d'abandonner
    ce titre ; section "Historique" dans Profil pour l'instant, réorganisation
    future en sous-onglets explicitement non bloquante (couches requêtes/
    actions indépendantes de l'emplacement d'affichage, même remarque que
    pour les ligues) ;
  - tous les ex-aequo sont crédités pour un titre (aucun tie-break
    arbitraire) ; un titre à valeur maximale NULLE n'est jamais décerné
    (ex. personne n'a de points bracket -> pas de "Meilleur bracket") ;
  - `BIGGEST_CLIMB` ignoré si aucun snapshot n'existe encore pour la
    compétition (close le jour même de sa création, avant le premier
    passage du cron quotidien) — jamais une erreur, juste un titre non
    décerné cette fois-là ;
  - correctif trouvé EN CONSTRUISANT (pas un bug préexistant signalé) :
    `competitions.archived_at`, posée dès le schéma initial (T1) mais
    jamais écrite, corrigée directement dans `closeCompetition()` ;
  - les 3 compétitions de TEST déjà archivées (`GAPS_OUVERTS.md` ci-dessus)
    n'ont délibérément AUCUN superlatif : closes avant que ce mécanisme
    existe, non recalculé rétroactivement (pas demandé, et reconstituer des
    scores/snapshots a posteriori pour de la donnée de test n'aurait aucun
    sens).
