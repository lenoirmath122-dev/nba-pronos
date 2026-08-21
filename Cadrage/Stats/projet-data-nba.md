# Projet Data NBA — Récupération, stockage et analyse

*Résumé de notre échange — à reprendre plus tard*

> ## 🔴 REPRISE ICI (état au 21/08/2026, suite 13 — calibration + README)
>
> **Seuils proba->difficulté CALIBRÉS (§34, Phase 5 §7 point 2 FAIT)** :
> remplace les seuils provisoires 80/60/40/20% par des seuils calibrés par
> quintile (66.4/52.9/39.4/24.9%) sur un échantillon simulé de 62 280
> probas (868 joueurs réels) -- 3 vrais paris seulement en base, bien trop
> peu pour calibrer sur du réel. `lib/ai/difficultyTiers.ts` mis à jour,
> `tsc`/`eslint`/`vitest`/`next build` propres, commité et poussé.
> `README.pdf` régénéré avec les nouvelles sections Cloud Run/refresh
> quotidien/paris IA + un récap des enchaînements courants (§34).
> - **Reste pour clore la Phase 5** : point 5 (barème du fallback IA) --
>   discussion ouverte, pas tranchée, voir `GAPS_OUVERTS.md` (piste "champ
>   points libre" vs piste plus large "formulaire structuré joueur/stat").
> - **Reste comme avant** : redéployer le service Cloud Run (§29) puis
>   retester de bout en bout via l'appli.
>
> Plus tôt (état au 21/08/2026, suite 12 — proba 0% pour joueur hors match)
> — **Nouveau champ `player_not_in_match` : un pari sur un joueur absent des
> 2 équipes du match est maintenant ACCEPTÉ avec proba=0%, plus jamais
> rejeté silencieusement en `calculable=false`** (§33) -- décidé avec
> l'utilisateur après le test "LeBron James" sur Atlanta-Boston (LeBron
> joue aux Lakers) : au lieu de retomber sur le flux manuel sans
> explication, le pari s'auto-valide avec 0% (visible dans "Mes pronos"),
> cohérent avec le principe "l'IA ne bloque jamais un pari"
> (`decisions_0.2.4` §4). Le micro-service n'est PLUS appelé dans ce cas
> (il calculerait une vraie proba à partir des stats du joueur, ignorant
> qu'il ne joue pas ce soir-là -- le bug d'origine). Testé avec de vrais
> appels Claude Opus 5, 3/3 cas corrects (LeBron rejeté du bon match,
> Tatum accepté normalement, pari fun toujours `calculable=false`).
> `tsc`/`eslint`/`vitest` (37/37)/`next build` propres.
> - **Reste** : redéployer le service Cloud Run (§29) puis retester de
>   bout en bout via l'appli.
>
> Plus tôt (état au 21/08/2026, suite 11 — fix observabilité) —
> **`is_calculable=false` désormais écrit explicitement (jamais laissé
> NULL)** (§32) -- bug trouvé en testant "MPJ" (Michael Porter Jr., pas
> dans le match Atlanta-Boston testé) : le rejet était probablement
> correct, juste jamais tracé en base, rendant le diagnostic impossible.
> `tsc`/`eslint`/`vitest`/`next build` propres. **Reste toujours** :
> redéployer le service Cloud Run (§29) puis retester de bout en bout.
>
> Plus tôt (état au 21/08/2026, suite 10 — contexte de match ajouté) —
> **2 bugs réels supplémentaires trouvés par l'utilisateur en testant
> "Jayson Tatum" sur un match Nets-Hornets — corrigés** (§31) : (1) l'IA
> validait des paris sur un joueur qui ne joue même pas dans le match visé
> (aucune vérification d'équipe) ; (2) les fautes de frappe/orthographe du
> joueur ("Junior" au lieu de "Jr.") n'étaient jamais corrigées. **Corrigé
> d'un coup** : `structureBet()` reçoit désormais les 2 équipes du
> match/de la série (résolues depuis `series.team1_id/team2_id`), Claude
> Opus 5 utilise sa connaissance des effectifs NBA réels pour vérifier
> l'appartenance du joueur ET corriger l'orthographe vers la convention
> standard. Testé avec de vrais appels : Tatum + Nets/Hornets -> rejeté
> correctement ; Tatum + Celtics/Heat -> accepté ; "Michael Porter
> Junior" + Nets/Hornets -> corrigé en "Michael Porter Jr." ET confirmé
> comme joueur des Nets. `tsc`/`eslint`/`vitest` (37/37)/`next build`
> propres. **Limite assumée** : repose sur la connaissance du modèle, pas
> une base d'effectifs vérifiée en direct -- un transfert très récent
> pourrait échapper à la vérification.
> - **Reste** : redéployer le service Cloud Run (correctif "Junior"/"Jr."
>   côté `find_player()`, §29 -- toujours utile en secours si l'IA ne
>   corrige pas l'orthographe pour une raison quelconque) puis retester de
>   bout en bout via l'appli.
>
> Plus tôt (état au 21/08/2026, suite 9 — auto-validation ajoutée) —
> **Design révisé + auto-validation codée** (§30) : la 1re version de la
> Phase 5 ("admin garde la main, suggestion en lecture seule") ne
> correspondait pas à ce que l'utilisateur avait en tête, découvert en le
> questionnant après le 1er test réel. Corrigé : un pari calculable saute
> désormais la file d'attente admin (`update_bet_structuration` passe
> direct SUBMITTED->VALIDATED, migration
> `20260821160000_bets_ai_auto_validation.sql`, poussée sur la base réelle).
> Proba montrée au JOUEUR une fois validée (`BetBlock.tsx`, "Mes pronos") ;
> nouvelle section admin "Auto-validés par l'IA" (`/admin/validation`) pour
> corriger la difficulté après coup — 2 emplacements initialement proposés
> (`/players/[userId]`) écartés après avoir trouvé qu'ils violaient un
> principe de conception documenté ("même vue pour tout le monde") et un
> mauvais timing (visible seulement à la deadline publique, pas à la
> validation). `tsc`/`eslint`/`vitest` (37/37)/`next build` (38 routes)
> propres, migration poussée.
> - **Reste, action de l'utilisateur** : redéployer le service Cloud Run
>   (correctif "Junior"/"Jr.", §29, toujours pas fait) PUIS retester le
>   même pari via l'appli pour confirmer l'auto-validation de bout en bout.
>
> Plus tôt (état au 21/08/2026, suite 8 — 1er test réel via l'appli) —
> **1er vrai pari perso testé via l'interface (`npm run dev`, compte
> Rillettes-31)** — a révélé un 2e bug réel, corrigé, **service PAS ENCORE
> redéployé** (§29). "Michael Porter Junior marque plus de 10 pts" soumis
> deux fois (avant et après redémarrage du serveur de dev pour charger les
> nouvelles variables d'env) : toujours aucun champ de structuration rempli.
> Diagnostic : `find_player()` (service Python) ne fait qu'une comparaison
> de sous-chaîne -- "Junior" (repris fidèlement du texte du joueur par
> Claude Opus 5) ne matche pas "Jr." (vrai nom en base). Corrigé
> (`normalize_suffix()`, `tester_modele.py`, réutilisé par
> `supabase_context.py`) -- testé directement contre Supabase, résout
> maintenant "Michael Porter Junior" -> `Michael Porter Jr.` (1629008), zéro
> régression sur Tatum/Jokić/Curry (ambigu)/joueur inconnu.
> - **Reste, action de l'utilisateur** : redéployer le service Cloud Run
>   (`gcloud run deploy`, guide déjà existant) pour que ce correctif soit
>   pris en compte en ligne -- sans ça, le service déployé garde l'ancien
>   comportement. Puis retester le même pari dans l'appli.
>
> Plus tôt (état au 21/08/2026, suite 7 — Phase 5 vérifiée hors-appli) —
> **Structuration IA testée en conditions réelles (hors interface, pas
> d'accès navigateur) — 1 bug réel trouvé et corrigé, chaîne complète
> confirmée fonctionnelle** (§28). Script de vérification autonome (Claude
> Opus 5 + micro-service réels, `.env.local` chargé, pas de mock) sur 4 cas
> : pari calculable simple (Tatum >25 pts, proba 27%, palier 4), pari fun
> non calculable (rejeté correctement), pari UNDER (Curry, proba 72% après
> inversion), et un pari dd/td. **Bug réel** : `structureAndScoreBet.ts`
> exigeait `comparison` non-null pour TOUT pari calculable -- or dd/td
> (double-double/triple-double) ont légitimement `comparison: null` (pas de
> notion OVER/UNDER), donc TOUS les paris dd/td tombaient à tort en "non
> calculable". Corrigé (`comparison` requis seulement hors `NO_THRESHOLD_
> STATS`) -- revérifié, Jokić triple-double calcule bien une proba (18,3%,
> palier 5).
> - **Incident billing en cours de route** : 1er compte Anthropic sans
>   crédit ("credit balance too low"), paiement refusé plusieurs fois
>   (probablement pré-autorisation bancaire) -- l'utilisateur a créé un 2e
>   compte Anthropic, chargé 5$, ça a débloqué. Nouvelle clé mise en place
>   directement par l'utilisateur (jamais collée dans le chat).
> - `tsc`/`eslint`/`vitest` (37/37) propres après le correctif.
> - **Reste avant vérification complète** : test au clic dans l'interface
>   réelle (poser un vrai pari perso, voir la suggestion apparaître côté
>   admin) -- pas fait, cet environnement n'a pas d'accès navigateur ; le
>   script de vérification a testé la logique/les appels externes réels
>   mais pas le passage par `submitBet`/l'écran admin lui-même.
> - **Seuils proba->palier volontairement provisoires** ("à vue de nez",
>   décidé le 21/08/2026) — point 2 de la spec toujours pas fait, à
>   recalibrer une fois assez de paris réels structurés.
> - **Point 5 (barème du fallback) volontairement pas tranché** — statu quo
>   assumé (mécanisme manuel existant inchangé pour les paris non
>   calculables), question "faut-il un barème séparé ?" reste ouverte.
>
> Plus tôt (état au 21/08/2026, suite 6 — Phase 5 démarrée, codée) —
> Structuration IA + raccordement réel codés (§27), migration poussée,
> `tsc`/`eslint`/`vitest`/`next build` propres avant le test en conditions
> réelles ci-dessus.
>
> Plus tôt (état au 21/08/2026, suite 5 — Phase 4 totalement close) —
> **Secrets GitHub Actions ajoutés par l'utilisateur, workflow lancé
> manuellement et RÉUSSI** (§26) — 1er run réel : `succeeded en 10m29s`,
> mais quasi tout ce temps passé sur des timeouts (60s × 3 tentatives × 3
> season_types) pour la saison 2026-27 qui n'a encore aucun match
> (hors-saison). **Corrigé** : timeout/tentatives réduits SPÉCIFIQUEMENT
> pour `leaguegamefinder` dans `refresh_daily.py` (15s, 1 tentative) --
> passe de ~10 min à ~8s en local pour ce même cas, sans rien perdre en
> fiabilité une fois la saison lancée (revérifié sur 2025-26 : 1321
> connus/1321 trouvés/0 nouveau, identique à avant). Phase 4 entièrement
> close : service déployé (§24), données à jour automatique (§25), coût du
> job optimisé (§26).
>
> Plus tôt (état au 21/08/2026, suite 4 — Phase 4 code complet) —
> **Rafraîchissement quotidien écrit, testé et validé** (§25) —
> `service/refresh_daily.py` (fetch incrémental `nba_api` -> upsert direct
> Supabase, remplace le stub `/refresh`) + workflow
> `.github/workflows/refresh-stats-supabase.yml` (cron quotidien 10h UTC).
> Nouvelle table légère `stats_matchs` (migration #32) pour savoir vite
> quels matchs sont déjà connus sans scanner `stats_box_scores`. **3 bugs
> réels trouvés et corrigés en testant** (suppression/réinsertion contrôlée
> de 2 vrais matchs, comparaison stricte avant/après) : pagination
> PostgREST tronquée à 1000 lignes, mauvaise liste de colonnes
> (`BOX_SCORE_TABLE_COLUMNS` du pipeline local, pas celle de Supabase),
> filtre DNP insuffisant (chaîne vide "" non capturée par `.notna()` en
> lisant l'API en direct, contrairement au pipeline local qui repasse par
> un CSV). Correspondance EXACTE confirmée sur toutes les colonnes avec les
> données originales après correctifs.
> - **Reste avant que le cron tourne réellement** : ajouter les 2 secrets
>   GitHub Actions (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) au dépôt —
>   pas encore fait, action de l'utilisateur (`gh secret set`, jamais collé
>   dans le chat).
> - **Phase 4 alors entièrement close** : service déployé (§24) + données
>   tenues à jour automatiquement (§25). Reste ensuite la Phase 5
>   (3 points indépendants de `SPEC_TECHNIQUE_PROBA_PARIS_PERSOS_V0_1.md` §7).
>
> Plus tôt (état au 21/08/2026, suite 3 — service EN LIGNE) —
> **Micro-service DÉPLOYÉ ET VÉRIFIÉ sur Google Cloud Run** (§24) — l'utilisateur
> a suivi `service/DEPLOIEMENT_CLOUD_RUN.md` de bout en bout (compte GCP,
> `gcloud` CLI, projet `nba-pronos-stats-2026`, Secret Manager, déploiement).
> URL du service : `https://nba-pronos-stats-991522521713.europe-west1.run.app`
> — `/predict` testé en conditions réelles (Tatum FT%, Jokić dd, Curry pts vs
> LAL), résultats identiques aux tests locaux.
>
> Plus tôt (état au 21/08/2026, suite 2 — architecture Phase 4 tranchée) —
> **Architecture "sans état" adoptée (§23), remplace le design auto-suffisant
> à disque local (§22).** Décidé avec l'utilisateur en pensant concrètement l'hébergement :
> `nba.db`/`models/` étant gitignorés (régénérables), un service auto-suffisant
> aurait exigé un hôte à disque persistant payant (~5-7€/mois). À la place :
> le contexte joueur vit dans 3 nouvelles tables Supabase (migration #31,
> `stats_equipes`/`stats_joueurs`/`stats_box_scores`, ~140k lignes migrées
> depuis `nba.db` MOINS le play-by-play, jamais utilisé par l'inférence —
> 110 Mo utiles au lieu de 575). Le service devient stateless (modèles
> embarqués dans l'image au build), déployable sur un hébergeur serverless
> gratuit. **Google Cloud Run retenu** (comparé à Render/une fonction Python
> Vercel) pour sa robustesse et son free tier large.
>
> `scripts/tester_modele.py` refactoré (`compute_proba()` extrait, zéro
> duplication CLI/service) ; nouveau `service/supabase_context.py`
> (équivalent Postgres de `build_context()`/`find_player()`/`find_team()`) ;
> `service/app.py` reconnecté dessus. Migration #31 poussée sur la vraie
> base (`npx supabase db push`, repassé sans blocage classifieur cette
> session — a aussi débloqué au passage les migrations #29/#30, en attente
> depuis plusieurs jours). Backfill fait et vérifié (30 équipes, 1052
> joueurs, 140 016 lignes box_scores). Service testé en conditions réelles
> contre la vraie base Supabase (curl, mêmes résultats qu'avant le
> changement d'architecture — Tatum FT% 26.8%, Jokić dd 75.1%, etc.).
> `Dockerfile` + guide de déploiement écrits
> (`service/DEPLOIEMENT_CLOUD_RUN.md`).
> - **Reste à faire** : (1) exécuter le déploiement Cloud Run (nécessite un
>   compte Google Cloud de l'utilisateur, pas faisable depuis cet
>   environnement) ; (2) fetch incrémental `nba_api` + upsert quotidien dans
>   Supabase (remplace le stub `/refresh`, qui n'est plus nécessaire dans
>   cette architecture -- le rafraîchissement peut écrire directement dans
>   Supabase sans jamais appeler le service) ; (3) workflow GitHub Actions
>   pour ce job quotidien.
>
> Plus tôt (état au 21/08/2026, suite — Phase 4 démarrée, design abandonné) —
> **Les 12 modèles socle réentraînés sur les 5 saisons** (`nba.db` à 6 602
> matchs, `features_joueur`/`labels_joueur` passés de 56 938 à 140 933
> lignes) — point resté ouvert depuis le 20/08/2026. Amélioration nette,
> cohérente avec le 1er passage à données complètes (§17) : Points MAE
> 4.75→**4.65**, R² 0.497→**0.518** ; 3P% (écart moyen absolu) 3.6%→**2.9%** ;
> FT%/FG% quasi stables (FT% Beta-Binomial toujours retenu, 5.3%→4.1% sur ce
> dataset). Aucune régression détectée.
>
> **Biais résiduel FT% (~4%, signe qui s'inverse selon le seuil) — DIAGNOSTIQUÉ,
> PAS UN BUG.** (`scripts/diagnose_ft_bias.py`, §21) Biais non conditionnel
> négligeable (p_hat 77.6% vs réel 76.8%, n_hat 3.85 vs réel 3.88) — le
> modèle n'est pas biaisé en moyenne. Le signe qui s'inverse est un artefact
> de granularité : avec 1 à 6 tentatives réelles/match, les fractions
> atteignables sont rares (ex. n=2 → seulement 0/50/100%), la proba prédite
> reste identique sur plusieurs seuils consécutifs alors que le taux réel
> varie en continu. Rien à corriger — même famille de constat que le cas
> Wembanyama (§19) : une limite mathématique inhérente aux petits n, pas une
> erreur de conception.
>
> Plus tôt (état au 20/08/2026, soir — encore une suite) —
> **Fetch étendu à 5 saisons (2021-22→2025-26) TERMINÉ, base reconstruite**
> — 6 602 matchs (contre 2 641 sur 2 saisons), 139 543 lignes box_scores,
> 3 054 074 lignes play_by_play. `load_to_sqlite.py` amélioré au passage
> (incident réel : 2 lancements simultanés = "database is locked" — base
> vérifiée intacte après coup, mais correctif ajouté : timeout de verrou
> 120s au lieu de 5s par défaut ; avancement affiché en direct saison par
> saison/table par table, plus de silence total pendant plusieurs minutes ;
> encodage UTF-8 forcé, accents capitaux mal affichés sinon).
>
> **🟡 LES 12 MODÈLES SONT MAINTENANT PÉRIMÉS** : toujours entraînés sur le
> dataset à 2 saisons (56 938 lignes), alors que la base en contient
> maintenant ~2,4x plus. Pour en profiter : relancer dans l'ordre
> `build_features.py` → `build_targets.py` → les 4 `train_*.py` (§8/§9
> README.pdf) — pas encore fait, à décider à la reprise (probablement
> amélioration nette partout, comme observé lors du 1er passage à données
> complètes, §17).
>
> **Nouveau testeur `tester_modele.py` (§11 README.pdf) utilisé pour la
> 1ère fois en usage réel** : a fait remonter un écart concret sur le
> double-double de Victor Wembanyama (modèle : 42.8%, Gemini/Copilot :
> ~60%). Vérifié dans la base avant conclusion — **pas un bug de
> calibration**, le modèle colle exactement à sa fenêtre d'entrée (taux réel
> 40% sur les 10 derniers matchs, contre 60-62% sur des fenêtres plus
> longues/la saison complète). **Vraie limite de conception identifiée** :
> contrairement aux modèles régressés (2 horizons moy5/moy10) et aux % de
> tir (rétrécissement bayésien vers une moyenne longue, §18), le modèle
> double-double/triple-double n'a AUCUN signal à horizon long pour
> distinguer une vraie tendance récente d'un creux passager sur 10 matchs.
> Détail complet, diagnostic via `feature_importances_` : §19.
>
> **Décision explicite de l'utilisateur : PAS encore de changement de
> code** — creuser d'abord (est-ce isolé à Wembanyama ou général à tout
> profil à forte variance de rebonds ?) avant de modifier la recette du
> modèle. Piste retenue pour la reprise : ajouter une fenêtre longue
> (`reb_moy20` ou moyenne de saison) comme feature supplémentaire du modèle
> double-double/triple-double, à tester empiriquement comme d'habitude
> avant de généraliser (même démarche que §15/§18).
>
> Plus tôt (état au 20/08/2026, session DA/stats du soir) —
> **Phase 1 (largeur) TERMINÉE — pourcentages de tir FT%/FG%/3P% VALIDÉS et
> généralisés**, même session. Approche Binomiale à 2 sous-modèles
> (tentatives régressées + taux rétréci vers la moyenne ligue par
> Beta-Binomial) — différente des 9 stats déjà faites (valeurs régressées
> directement, un % est un ratio). **Bug réel trouvé et corrigé en
> validant sur FT%** : le modèle de tentatives entraîné sur TOUS les
> matchs sous-estimait `n_hat` de 28% une fois restreint aux matchs à
> tentative réelle (biais de sélection) — gonflait la proba des seuils
> hauts (+17.7% d'écart). Corrigé (entraînement restreint aux matchs avec
> tentative réelle), puis généralisé à FG%/3P% avec le correctif intégré
> dès le départ. Détail complet §18.
>
> **Calibration finale, très inégale selon le volume de tentatives** :
> **FG% quasi parfait** (±0-2.8%, le plus tenté des 3, ~10 tentatives/match) ;
> 3P% correct (±1.4-7.8%) ; FT% le moins bon (±4-9%, le moins tenté,
> ~2-4/match). Le rétrécissement (`k`) confirmé peu déterminant sur les 3 —
> le volume de tentatives domine la calibration, pas le choix de `k`.
>
> **12 modèles à jour** (`Cadrage/Stats/models/*.joblib`) : points,
> double-double, triple-double, rebonds, passes, 3-points, interceptions,
> contres, minutes (données complètes, §17) + FT%/FG%/3P% (§18, ci-dessus).
> **Phase 1 (couverture des événements) considérée COMPLÈTE** — tous les
> trous de catégorie identifiés dans le classeur (§8/§15) sont couverts.
>
> **Pas encore tranché, à décider à la reprise** (§16 pour le plan 5
> phases) : Phase 3 (affiner — résiduel de calibration FT%/3P%, hypothèse
> overdispersion pas vérifiée), Phase 4 (pont contexte en direct), ou
> Phase 5 (intégration appli, `Cadrage/V1/SPEC_TECHNIQUE_PROBA_PARIS_
> PERSOS_V0_1.md`).
>
> Plus tôt (état au 20/08/2026, ~12h25) — **fetch des 2 saisons TERMINÉ +
> réentraînement complet, résumé.** 2 641/2 641 matchs, 0 échec. Pipeline
> reconstruit, 8 modèles réentraînés sur données complètes automatiquement
> (séquence pré-actée avant que l'utilisateur ne quitte la conversation).
> Points MAE 5.09→**4.75**, R² 0.428→**0.497** ; minutes R²
> 0.557→**0.604**. Détail complet en §17.

## 1. Objectif du projet

Récupérer les feuilles de match NBA (box scores + play-by-play) des 2 dernières
saisons (régulière + playoffs), les structurer en base de données, puis
éventuellement entraîner un modèle pour estimer des probabilités
d'événements (ex : issue d'un match).

## 2. Pourquoi pas Cowork / scraping direct

- Tentative initiale : demander à Claude Cowork de naviguer sur nba.com /
  stats.nba.com pour extraire les données.
- **Résultat : bloqué.** Les sites NBA détectent et bloquent la navigation
  automatisée à ce volume (~2 500-2 700 matchs sur 2 ans).
- Autre limite indépendante : lancé depuis mobile, Cowork tourne dans une
  session **cloud** (serveurs Anthropic), pas sur l'appareil. Les fichiers
  restent liés au compte Claude, accessibles depuis n'importe quel appareil
  connecté — mais pas dans un dossier local sur le téléphone. Pour un accès
  fichier local, il faut passer par Claude Desktop avec un dossier connecté.

**Conclusion : passer par une API structurée plutôt que du scraping/navigation.**

## 3. Options d'API NBA évaluées

| Option | Type | Coût | Notes |
|---|---|---|---|
| **`nba_api`** (package Python) | Non-officielle, wrapper de l'API interne de stats.nba.com | Gratuit | Solution retenue. Couvre box scores + play-by-play historique. |
| API-NBA (API-Sports) | Officielle | Gratuit (100 req/j) puis 15-35$/mois | Si besoin de fiabilité commerciale |
| SportsDataIO | Officielle, licenciée | ~19$/mois+ | Play-by-play avec données arbitrage |
| Sportradar | Officielle, fournisseur NBA | Sur devis (entreprise) | Overkill pour usage personnel |

**Décision : démarrer avec `nba_api`, gratuit, largement suffisant pour un usage personnel.**

## 4. Plan d'exécution (Python)

### Prérequis
- Python installé en local (PC/Mac — pas sur mobile)
- `pip install nba_api`

### Modules clés
- `leaguegamefinder` → liste des matchs (`game_id`) par saison, régulière + playoffs
- `playbyplayv3` → play-by-play complet d'un match via `game_id`
- `boxscoretraditionalv2` → stats par joueur (box score)

### Étapes
1. Récupérer tous les `game_id` des saisons 2023-24 et 2024-25 (régulière + playoffs)
2. Boucler sur chaque match : appeler play-by-play + box score
3. **Pause de 0.5 à 1s entre chaque requête** (sinon blocage IP par NBA.com)
4. Sauvegarder en CSV/JSON, organisés par saison/date
5. Prévoir plusieurs heures d'exécution en tâche de fond (volume important)

*(Script Python complet à générer à la prochaine étape)*

## 5. Étape suivante : base de données + analyse

### Stockage
- SQLite pour démarrer (simple, local) — PostgreSQL si besoin de montée en charge
- Tables suggérées : `matchs`, `joueurs`, `equipes`, `play_by_play`, `box_scores`

### Analyse
- Simple : Excel / Google Sheets (tableaux croisés dynamiques)
- Poussé : Python + pandas (agrégation multi-fichiers, stats avancées, graphiques)

### Modèle de probabilité (architecture retenue)

```
Données NBA → Base de données → Modèle ML (régression logistique / XGBoost…)
                                        ↓
                        API/Claude interroge le modèle + la base
                                        ↓
                        Réponse en langage naturel avec contexte
```

**Point clé :** un LLM seul n'est pas fiable pour calculer une probabilité
statistique précise à partir de données brutes. Il sert de couche
d'interface (interprétation, orchestration, explication) au-dessus d'un
vrai modèle ML entraîné sur les données historiques.

## 6. Prochaines actions

- [x] Générer et lancer le script Python de récupération (`nba_api`)
- [x] Valider le format des données sur un petit échantillon (pilote)
- [x] Concevoir le schéma de base de données
- [ ] Feature engineering (variables prédictives : forme récente, home/away,
      repos entre matchs, historique face-à-face…)
- [ ] Entraîner un premier modèle simple comme base de comparaison

## 7. Décisions de cadrage (19/08/2026)

- **Saisons retenues** : 2024-25 + 2025-26 (les 2 dernières terminées à date),
  Regular Season + Playoffs + Play-In. Box score Traditionnel + Avancé
  (`BoxScoreTraditionalV3` / `BoxScoreAdvancedV3`, `PlayByPlayV3`) — v. aussi
  `scripts/fetch_nba_data.py` et `README.pdf`.
- **Base de données** : SQLite (`data/nba.db`), rechargée entièrement à
  chaque exécution de `scripts/load_to_sqlite.py` à partir des CSV bruts.
- **Blessures / absences de joueurs** : hors scope pour l'instant. Aucune
  source actuelle (`nba_api`) ne les fournit nativement. À récupérer via une
  autre source plus tard — à ne pas oublier, c'est un vrai trou pour la
  fiabilité des probas (absence d'un joueur clé change beaucoup le niveau
  d'une équipe).
- **Moyennes glissantes à cheval sur 2 saisons** : gardées telles quelles
  (pas de reset au 1er match de chaque saison) — la forme d'une équipe ne
  repart pas de zéro le 1er soir. Complété par une nouvelle feature dédiée
  au mouvement d'effectif plutôt que par un reset : `continuite_effectif_saison`
  (`features_equipe`, `build_features.py`) — part des minutes jouées cette
  saison, avant le match courant, par des joueurs qui faisaient partie du
  "coeur d'effectif" (`CORE_MINUTES_SHARE` = 70 % des minutes cumulées,
  triées décroissant) de la MÊME équipe la saison précédente. NaN sur la
  1ère saison connue (pas de saison antérieure dans les données récupérées)
  et sur le 1er match d'une équipe chaque saison. Logique validée par un
  test synthétique (`compute_roster_continuity`), pas encore vérifiée sur
  de vraies données 2025-26 (fetch encore en cours au moment d'écrire ceci).
- **Portée du feature engineering** : doit couvrir à la fois le niveau
  **collectif** (équipe — pour prédire l'issue d'un match) et le niveau
  **individuel** (joueur — pour prédire une performance précise, ex :
  probabilité qu'un joueur dépasse X points). Les deux s'appuient sur les
  mêmes tables (`box_scores`, `box_scores_advanced`), pas d'extraction
  supplémentaire nécessaire.
- **Cible du modèle : pas seulement l'issue du match** — l'objectif réel est
  d'estimer la probabilité d'événements variés (précisé par l'utilisateur le
  19/08/2026), l'issue du match n'étant qu'un exemple parmi d'autres.
  `features_equipe`/`features_joueur` sont conçues neutres exprès (1 ligne
  par match/équipe ou match/joueur, aucun label collé dedans) : chaque type
  d'événement à prédire n'a besoin que d'une petite table "cible" séparée
  qui vient joindre un label par-dessus, pas de nouvelle extraction.

## 8. Taxonomie réelle des événements pariés (19/08/2026)

Plutôt que deviner quels événements prédire, la feuille `PARIS_PERSOS_CATEGORIES`
du classeur `Cadrage/DA/🏀 NBA Pronos - 22_04_2026 (réponses) (1).xlsx` (l'ancien
suivi manuel des playoffs 2026, avant l'appli) contient 429 paris persos réels
déjà catégorisés (type/sous-type/stat/structure/cible). Distribution des
`Type pari perso` : Pari joueur (163), Pari période (47), Score/total match
(39), Comparaison/duel (36), Pari équipe (34), Rotation/temps de jeu (33),
Combo multi-joueurs (21), Événement de match (20).

Catégories directement modélisables avec les features déjà construites :
- **Seuil de points joueur** (`Stat pari perso` = Points, 138 mentions ;
  `Structure` = Seuil supérieur/inférieur, 157 à elles deux) — `features_joueur`.
- **Double-double / triple-double** (13+8+8 = 29 mentions) — `features_joueur`.
- **Total points match / écart** (24+ mentions) — `features_equipe`.
- **Issue du match, comparaison/duel équipe** — `features_equipe`.

Catégories moins structurées (Fun/hors terrain, Rotation/temps de jeu,
scénarios mi-temps, combos multi-joueurs) laissées de côté pour l'instant —
trop hétérogènes pour une 1ère table cible générique.

## 9. Lien avec le scoring de l'appli (19/08/2026)

Décidé avec l'utilisateur : les probas doivent être pensées en fonction du
barème réel de l'appli (`Cadrage/V1/SPEC_TECHNIQUE_SCORING_V0_1.md`, T5),
pas dans l'absolu. 3 mécanismes de prédiction, scorés différemment :

1. **Pronos match** (T5 §5) — vainqueur (10 pts, fixe) + bonus d'écart PAR
   PALIERS : écart exact +5, 1-2 +3, 3-5 +2, 6-9 +1, ≥10 +0. **Conséquence
   pour le modèle** : à cause des paliers, une prédiction ponctuelle de
   l'écart n'est pas ce qui maximise le score espéré — il faut une
   **distribution de probabilité de l'écart** (pas juste une moyenne), pour
   ensuite choisir la valeur qui maximise l'espérance de points sous ce
   barème précis. `entrainement_matchs` (§7/build_targets.py) porte déjà
   `ecart`/`total_points` comme cibles continues, prêt pour ça.
2. **Bracket** (T5 §6/§7) — advancement-based, comparé au vainqueur officiel
   de chaque série (pas à l'adversaire réellement rencontré). Nécessite de
   composer plusieurs probas de victoire match par match dans une simulation
   de série (best-of-7) — plus complexe, s'appuiera sur le modèle de proba
   de victoire une fois qu'il existe, pas construit en premier.
3. **Paris persos** (T5 §8) — résolution ADMIN MANUELLE, le barème dépend de
   la difficulté validée, pas directement d'une proba du modèle. Une proba
   (ex : "18% de chances que Jokić fasse un triple-double") sert plutôt
   d'AIDE À LA DÉCISION pour le joueur qui parie ou l'admin qui valide une
   difficulté, pas d'entrée directe du barème.

**Priorité de départ proposée** : victoire + distribution d'écart niveau
match (le plus simple, données déjà prêtes, alimente directement le
mécanisme n°1, le plus utilisé). Seuils joueur (double-double, points) et
bracket viennent après.

**Corrigé le 19/08/2026 (suite immédiate, retour de l'utilisateur)** : priorité
inversée. Le barème pronos match (vainqueur + écart) et bracket restent **tels
quels**, pas de chantier dessus. Ce qui a de la valeur, c'est le mécanisme
n°3 (paris persos) — voir §10.

## 10. Chantier prioritaire : paris persos pilotés par la proba (19/08/2026)

**Idée de l'utilisateur** : remplacer le mécanisme actuel des paris persos
(le joueur propose une difficulté 1-5, un admin la valide, `T5 §8` en déduit
les points — `5/10/15/20/25`) par un calcul automatique : le joueur saisit
son pari perso en texte libre, le valide, et l'**appli calcule la
probabilité** de l'événement puis en déduit le palier de points — plus
besoin d'estimer soi-même une difficulté.

Décisions actées avec l'utilisateur (19/08/2026), détail complet dans la
nouvelle spec dédiée `Cadrage/V1/SPEC_TECHNIQUE_PROBA_PARIS_PERSOS_V0_1.md` :

1. **Le moteur de scoring T5 §8 (`scoreBet`) reste intact** — pur, testé,
   figé. Seule change la **source** de `validated_difficulty` pour les paris
   calculables : un humain aujourd'hui, une probabilité calculée demain.
   Aucune réouverture de T5.
2. **Structuration du pari** : texte libre + une IA le structure en
   événement calculable (joueur/stat/seuil/structure) au moment de la
   validation — même principe que la classification manuelle déjà tentée
   dans l'ancien classeur Excel (`PARIS_PERSOS_CATEGORIES`, colonnes
   `Dernière classification IA`/`Source classification`/`Erreur IA`).
3. **Fallback pour les paris non calculables** (~1/3 de l'historique d'après
   §8 : Fun/hors terrain, Scénario, Combo multi-conditions...) : on retombe
   sur la difficulté manuelle actuelle. **Barème de ce fallback pas encore
   tranché** — l'utilisateur a explicitement noté que c'est "à voir",
   possiblement pas les mêmes 5 valeurs qu'aujourd'hui.
4. **Formule proba → points** : garde les **5 valeurs actuelles**
   (5/10/15/20/25) — la probabilité calculée choisit automatiquement le
   palier, au lieu d'un choix humain. Les **seuils exacts entre paliers**
   (à partir de quelle proba on est "niveau 5" vs "niveau 4"...) restent à
   définir — ça nécessite un modèle qui tourne pour de vrai et une
   distribution réelle de probas à regarder, pas encore possible.
5. **Timing** : la probabilité doit être **figée au moment de la validation
   du pari**, jamais recalculée après coup — même logique que l'invariant
   P10 de T5 (prédiction figée intouchable).

**Décision du 19-20/08/2026 : chantier mis EN PAUSE avant tout code.** La
spec dédiée est écrite (voir ci-dessus) mais rien n'est implémenté côté
appli. Prochaine étape à la reprise : construire un premier modèle jetable
(régression sur les points d'un joueur — voir §11) pour avoir de vraies
probas à regarder, condition nécessaire avant de pouvoir calibrer les
seuils du point 4 ci-dessus.

## 11. Comment fonctionnera l'entraînement du modèle (explication, 19/08/2026)

Explication donnée à l'utilisateur avant tout code, pour valider la
compréhension du principe avant de se lancer :

- **Apprentissage supervisé** : `features_joueur`/`features_equipe`
  (contexte AVANT le match) = les entrées (X) ; `labels_joueur`/
  `entrainement_matchs` (résultat réel) = ce qu'on veut prédire (y). Le
  modèle apprend statistiquement le lien entre les deux sur l'historique,
  puis s'applique à un contexte futur jamais vu.
- **Le seuil d'un pari n'est pas fixe** (ex : "plus de 25.5 points" un jour,
  "plus de 18.5" un autre) — pas question d'entraîner un modèle par seuil
  possible. Solution : le modèle prédit une **distribution de probabilité**
  de la stat (pas juste une moyenne) ; P(stat > seuil) se calcule ensuite
  pour n'importe quel seuil à partir de cette distribution, sans
  ré-entraînement. Pour double-double/triple-double (déjà 0/1 dans
  `labels_joueur`), un modèle de classification classique suffit, pas
  besoin de distribution.
- **Découpage temporel obligatoire** (pas aléatoire) : entraîner sur les
  matchs les plus anciens, tester sur les plus récents — jamais l'inverse,
  sinon fuite de données (le modèle "verrait" indirectement le futur).
- **Un modèle simple d'abord** (régression logistique/linéaire) comme
  référence, avant d'envisager plus complexe (XGBoost...).
- **Critère de qualité : la CALIBRATION**, pas la précision brute — si le
  modèle dit "70%", ça doit arriver ~70% du temps sur l'historique. C'est
  ce qui compte pour calibrer les seuils de paliers (§10 point 4) : une
  proba mal calibrée fausserait l'attribution des points.
- **Ce qui manque encore pour la prod** : le modèle sait répondre à partir
  d'un contexte donné, mais il faut pouvoir lui fournir les features **à
  jour** au moment où un joueur valide un pari (pas seulement l'historique
  figé de `nba.db`) — pont technique pas encore construit, étape
  ultérieure.

**Prochaine étape concrète, à la reprise** : entraîner un modèle jetable de
régression sur les points d'un joueur (cas le plus fréquent du classeur,
§8), le tester sur un joueur connu (Jokić) pour vérifier que les probas
sorties ont l'air sensées, avant d'aller plus loin.

## 12. 1er modèle entraîné : points joueur (19-20/08/2026)

**Résultat** (`scripts/train_points_model.py`, RandomForestRegressor, split
temporel) : MAE ≈ 5 points, R² ≈ 0.43, calibration correcte (écarts de 0 à
5 points de %). Démo bout-en-bout validée sur de VRAIS textes de pari du
classeur (`scripts/demo_pari_reel.py`, structuration faite à la main en
attendant la brique IA) : "Donovan Mitchell +30 pts" → P ≈ 9% ; "Tatum
plante +40 points" → P ≈ 0.2% (Tatum revenait d'une blessure à l'Achille en
2025-26, peu de matchs joués — la faible proba est cohérente).

**Bug de données réel trouvé et corrigé** : ~19 % des lignes de
`box_scores` étaient des **DNP** ("Did Not Play" / "DND" — joueur sur la
feuille de match mais n'ayant pas joué, l'API renvoie quand même une ligne
avec `minutes=NULL` et toutes les stats à 0, champ `comment` explicite dans
le CSV brut) chargées comme de VRAIES apparitions à 0 point — faussait les
moyennes glissantes ET les labels d'entraînement eux-mêmes pour la quasi-
totalité des joueurs. Corrigé dans `load_to_sqlite.py` (filtre sur
`minutes IS NOT NULL` avant chargement, `box_scores`/`box_scores_advanced`).
Toute la chaîne (base → features → cibles → modèle) reconstruite après
correctif. Repéré en creusant une prédiction Tatum incohérente (contexte
"à jour" avec des stats anormalement basses) plutôt que par un audit
systématique — **à garder en tête pour d'éventuels bugs similaires ailleurs
dans le pipeline**.

**Feature `matchs_manques_depuis_dernier` ajoutée** (répond à "le joueur n'a
pas joué depuis N matchs, peu importe la raison") mais **son effet sur le
modèle testé et jugé négligeable pour l'instant** (importance quasi nulle,
prédiction quasi inchangée avec/sans sur un vrai cas de longue absence —
Taylor Hendricks, 56 matchs manqués) : les absences longues sont trop rares
et trop dispersées en valeurs différentes dans les données actuelles pour
qu'un arbre les exploite avec `min_samples_leaf=10`. **Décision de
l'utilisateur (20/08/2026) : laissé de côté tel quel** — sera couvert plus
tard par l'ajout d'une vraie source de données blessures (déjà noté comme
hors scope en §7), pas la peine de retravailler cette feature spécifiquement
avant ça.

**Dispersion personnalisée par joueur — ajoutée le 20/08/2026** : la
distribution utilisait un écart-type GLOBAL unique (même dispersion pour
tout le monde), repéré comme simpliste en discutant avec l'utilisateur.
Remplacé par `pts_ecarttype10` (déjà calculé dans `features_joueur` depuis
le début, jamais branché avant) — l'écart-type propre à chaque joueur sur
ses 10 derniers matchs, avec repli sur l'écart-type global si inconnu
(trop peu de matchs) et plancher à 1.0 (évite une dispersion nulle). Gain
de calibration net : écarts qui étaient de +0.2 à +4.8 points de %
retombent à −0.0/+1.4 sur tous les seuils testés (10 à 30 pts). Démo Tatum
mise à jour : P(> 40 pts) passe de 0.2 % à 0.1 % (dispersion propre à Tatum
un peu plus resserrée que la moyenne).

**Décision de l'utilisateur (20/08/2026) : ne pas continuer à affiner CE
modèle au-delà de ça pour l'instant.** Le point le plus rentable de cette itération était
le bug DNP (correctif réel, impact large) ; au-delà, les métriques ne
bougeraient plus beaucoup sans plus de données (2025-26 encore en cours de
récupération) ou un modèle plus complexe. Prochaine étape : réutiliser le
même pipeline pour une autre catégorie fréquente du classeur (§8) —
double-double/triple-double (déjà 0/1 dans `labels_joueur`, classification
plutôt que régression).

## 13. Persistance des modèles (20/08/2026)

Question posée par l'utilisateur : où sont stockés les modèles entraînés ?
Réponse à l'époque : **nulle part** — chaque script réentraînait à zéro et
jetait le modèle en mémoire à la fin. Corrigé : tous les scripts
d'entraînement sauvegardent maintenant sur disque via `joblib`, dans
`Cadrage/Stats/models/` (`points.joblib`, `double_double.joblib`,
`triple_double.joblib` — chaque fichier contient le modèle + la liste des
features attendues, pour ne pas avoir à deviner l'ordre à la relecture).
Prépare le terrain pour la Phase 4 du plan (contexte en direct) : à terme
l'appli chargera ces fichiers plutôt que de réentraîner à chaque requête.

Entraînement en parallèle : possible techniquement (processus indépendants)
mais pas utile pour l'instant — chaque entraînement prend quelques secondes,
le vrai goulot reste la disponibilité des données (le fetch), pas le calcul.

## 14. 2e catégorie : double-double / triple-double (20/08/2026)

`scripts/train_doubledouble_model.py` — RandomForestClassifier (pas de
distribution à construire ici contrairement aux points : le label est déjà
0/1, `predict_proba` sort directement une probabilité).

**Bug de calibration réel trouvé et corrigé** : 1er essai avec
`class_weight="balanced_subsample"` (réflexe habituel pour une classe rare)
→ probabilités prédites massivement SURESTIMÉES (écarts de +30 à +60 points
de % sur les tranches hautes). Cause : `class_weight` rééquilibre
artificiellement les classes PENDANT l'entraînement (comme si double-double
était 50/50 au lieu de ~8/92 réel), ce qui casse justement la calibration —
la propriété qu'on veut le plus ici, puisqu'elle doit déterminer des
paliers de points. **Retiré**, pas remplacé par autre chose : sur ce
volume de données, le déséquilibre de classe n'empêche pas un
RandomForest standard de bien apprendre.

**Résultats (sans class_weight)** :
- **Double-double** (taux de base 8.1%) : calibration excellente
  (−0.1 à +3.4 points de % sur toutes les tranches), bat nettement une
  référence naïve (log loss 0.194 vs 0.256). Features dominantes :
  `reb_moy10`/`reb_moy5` (logique, la composante la plus souvent
  manquante d'un double-double aux côtés des points).
- **Triple-double** (taux de base 0.56%, très rare) : bien calibré sur sa
  tranche basse (l'essentiel des données, n=7881) ; tranches hautes
  (proba prédite >20%) trop peu peuplées (12 à 29 exemples) pour juger la
  calibration — pas un signal de modèle défaillant, juste pas assez de
  vrais triple-doubles observés à ce niveau de proba pour trancher.

**Leçon méthodologique à retenir pour les prochains modèles de
classification** (rebonds/passes/3-points en seuil, si formulés en 0/1) :
ne PAS rééquilibrer les classes par défaut sur ce genre de tâche — vérifier
la calibration AVANT de juger un modèle, l'accuracy ou le rappel sur classe
rare ne suffisent pas.

## 15. Audit des stats oubliées + 6 nouveaux modèles (20/08/2026)

Question posée par l'utilisateur : est-ce qu'on a oublié des statistiques ?
Réponse après audit complet du classeur (`Stat pari perso`, ~120 valeurs
distinctes, pas juste le top 20 vu en §8) : **oui, 2 vrais trous** —
**minutes jouées** (28 mentions, PLUS que les rebonds) et **contres/
interceptions** (~11 mentions combinées) — jamais identifiés comme cibles
à modéliser (minutes servait seulement de feature d'entrée). Confirmé aussi
un gros bloc **pourcentages de tir** (FG%/3P%/FT%, ~30 mentions combinées)
qui reste un vrai trou mais nécessite un traitement différent (stat de
taux, pas juste une valeur — pas ajouté maintenant). Le reste de la longue
traîne (~120 libellés) est du fun/composite déjà écarté en §8, ou du
niveau match (hors périmètre, décision actée précédemment).

**Ajouté** : `stl`/`blk`/`minutes` dans `labels_joueur` ; `stl_moy5/10`,
`blk_moy5/10`, et `{stat}_ecarttype10` pour pts/reb/ast/fg3m/stl/blk/min
dans `features_joueur` (`build_features.py`). Nouveau script généralisé
`scripts/train_stat_model.py` (même recette que les points, réutilisable
plutôt que dupliquée) entraîne et sauvegarde 6 modèles d'un coup :
rebonds, passes, 3-points réussis, interceptions, contres, minutes.

**Résultats, très inégaux selon la stat** :
- **Minutes jouées** : LE meilleur modèle du lot (R²=0.557, calibration
  quasi parfaite, −1.2 à +0 point de %) — logique, les minutes dépendent
  surtout du rôle/de la rotation, plus prévisible qu'une performance.
- **Rebonds, passes** : bons (R²≈0.40-0.45, calibration à quelques points
  de % près, un peu plus large sur le seuil bas des passes).
- **3-points réussis, interceptions, contres : calibration RÉELLEMENT
  dégradée sur le seuil "au moins 1"** (+16 à +17 points de % d'écart !).
  **Cause identifiée** : ce sont des stats à faible valeur, très souvent
  exactement à 0 (beaucoup de joueurs ne tentent/ne réussissent aucun 3-
  points, aucun contre, aucune interception un soir donné) — la
  distribution NORMALE (en cloche, symétrique) utilisée pour construire la
  proba ne colle pas à une distribution aussi concentrée sur 0 avec une
  longue traîne. Contrairement aux points/rebonds/minutes, qui se
  comportent assez normalement. R² également bas pour interceptions/
  contres (0.09/0.17) — ces stats dépendent beaucoup du hasard (une
  interception, ça se produit ou pas), moins prévisibles par nature.
  **Rejoint directement la Phase 3 déjà notée dans le plan** ("distribution
  non-normale à explorer") — ce résultat en est une preuve concrète, pas
  juste une hypothèse.

**Corrigé le 20/08/2026 (suite immédiate)** : distribution de **Poisson**
(adaptée aux compteurs d'évènements rares, souvent à 0) utilisée pour
`fg3m`/`stl`/`blk` à la place de la normale — vérifié empiriquement AVANT
de généraliser (mêmes prédictions du RandomForest, seule la lecture change) :
- Contres (>1) : écart +13.9% (normale) → **-0.9%** (Poisson).
- Interceptions (>1) : +20.6% → **-1.4%**.
- 3-points (>1) : +22.3% → **+0.3%**.

Vérifié aussi que Poisson n'aide PAS points/rebonds/passes (légèrement
moins bon que la normale personnalisée par joueur déjà en place) — pas de
changement pour ces 3, changement ciblé uniquement sur les 3 stats
concernées (`POISSON_STATS` dans `train_stat_model.py`).

**Point de compréhension clarifié avec l'utilisateur** : ce n'est PAS une
question de personnalisation par joueur (les deux approches utilisent une
moyenne prédite propre à chaque joueur) — c'est une question de FORME de
distribution. La normale a 2 paramètres réglables indépendamment (moyenne +
écart-type, d'où `{stat}_ecarttype10` pour la personnaliser) ; Poisson n'a
qu'1 paramètre (la moyenne), sa dispersion est mathématiquement TOUJOURS
égale à la moyenne — pas un réglage séparé, une propriété de la loi. Mieux
adaptée à des stats souvent exactement nulles avec une petite traîne, à la
différence d'une cloche symétrique.

Chaque fichier `.joblib` embarque maintenant sa `distribution` (`"normal"`
ou `"poisson"`) pour que la lecture en aval sache quelle formule appliquer
sans deviner.

## 16. Plan en 5 phases, du prototype à l'usage réel (20/08/2026)

Expliqué à l'utilisateur en réponse à "comment avoir un modèle très
complet au final ?" — jamais écrit avant maintenant, seulement dit à
l'oral. Sert de référence pour situer chaque avancée (§12-§15 = Phase 1
essentiellement).

```text
Phase 1 — Couverture des événements (largeur) — TERMINÉE (20/08/2026, §18)
  Réutiliser le même pipeline (features -> modèle -> distribution -> proba)
  pour chaque catégorie fréquente du classeur (§8/§15). État final :
  points, double-double, triple-double, rebonds, passes, 3-points,
  interceptions, contres, minutes (8 modèles, §12/§15) + FT%/FG%/3P%
  (3 modèles, approche Binomiale dédiée, §18) = 12 modèles, tous les trous
  de catégorie identifiés dans le classeur couverts.
  Volontairement HORS périmètre : issue du match / écart (barème actuel de
  l'appli gardé tel quel, décision explicite de l'utilisateur, §9-§10).

Phase 2 — Compléter et fiabiliser les données (profondeur data)
  Finir le fetch des 2 saisons (en cours). Blessures/absences (§7, toujours
  un trou). Vigilance sur d'autres bugs type DNP (§12) — pas d'audit
  systématique fait sur le reste du pipeline.

Phase 3 — Affiner chaque modèle (profondeur modèle)
  Distribution adaptée à la forme réelle des données plutôt qu'une
  supposition par défaut — la correction Poisson de ce jour (voir plus haut
  dans ce fichier) EST un exemple concret de Phase 3, fait plus tôt que
  prévu suite à l'audit du 20/08. Reste : régression quantile (lire la
  vraie distribution plutôt que d'en supposer une), plus de données =
  modèles mécaniquement plus fins.

Phase 4 — Contexte "en direct"
  Tout tourne aujourd'hui sur `nba.db`, une base figée à un instant donné.
  Pour un usage réel (un joueur valide un pari un vrai soir), il faut
  calculer le contexte À JOUR automatiquement (comme fait à la main pour
  les démos Mitchell/Tatum, `demo_pari_reel.py`) — pas construit. La
  persistance des modèles (§13) est un prérequis déjà posé pour cette
  phase (charger un modèle sauvegardé, pas le réentraîner à la volée).

Phase 5 — Intégration dans l'appli
  `Cadrage/V1/SPEC_TECHNIQUE_PROBA_PARIS_PERSOS_V0_1.md` (statut
  PROPOSITION, en pause) : brique IA de structuration du texte libre (pas
  construite), calibrage des seuils entre les 5 paliers de points (besoin
  de vraies probas sur beaucoup de paris, donc Phases 1-4 avancées
  d'abord), branchement final sur `scoreBet` (T5 §8, déjà inchangé,
  prêt à recevoir).
```

**Ordre recommandé** : 1 → 2 (en partie déjà en cours) → 3, puis 4 et 5
ensemble une fois le reste mûr — inutile de construire le pont temps réel
ou l'intégration appli avant d'avoir plusieurs modèles fiables à brancher
dessus.

## 17. Phase 2 clôturée : réentraînement complet sur les 2 saisons (20/08/2026)

Fait en fin de session, après le départ de l'utilisateur vers une autre
conversation (séquence exacte pré-actée avec lui juste avant, voir le
bandeau REPRISE en tête de ce fichier) : fetch terminé (2641/2641, 0 échec)
→ pipeline reconstruit (`load_to_sqlite.py`/`build_features.py`/
`build_targets.py`) → 8 modèles réentraînés (`train_points_model.py`/
`train_doubledouble_model.py`/`train_stat_model.py`). Dataset final :
56 938 lignes (joueur, match), `entrainement_matchs` couvre les 2641
matchs en entier (tous avec home/away/score résolus).

**Comparaison avant/après (données partielles → complètes)** :

| Modèle | Avant (partiel) | Après (complet) |
|---|---|---|
| Points | MAE 5.09, R² 0.428 | MAE 4.75, R² 0.497 |
| Minutes | R² 0.557 | R² 0.604 (toujours le meilleur) |
| Rebonds | R² 0.401 | R² 0.417 |
| Passes | R² 0.449 | R² 0.463 |
| 3-points | R² 0.282 | R² 0.285 |
| Interceptions | R² 0.092 | R² 0.106 |
| Contres | R² 0.165 | R² 0.182 |
| Double-double | log loss 0.194 | log loss 0.190 |
| Triple-double | log loss 0.024 | log loss 0.021 |

Amélioration nette partout, la plus marquée sur points/minutes (les 2
modèles avec le plus de features/le plus de signal à exploiter). Aucune
régression. Calibration Poisson (3-points/interceptions/contres) toujours
excellente sur données complètes (±0.4 à ±1.4%).

**Seul point à noter, pas un problème** : triple-double, tranche de proba
35-50%, `n=10` seulement → écart de calibration de -39.8%, bruit pur
d'échantillon (déjà signalé comme peu fiable à ce niveau de proba dans
§14, confirmé ici avec plus de données mais toujours aussi peu d'exemples
à ce niveau précis — le triple-double reste un évènement rare, 0.53% de
taux de base).

**Décision qui reste à prendre au prochain échange** (§16 pour le détail
des options) : pourcentages de tir (largeur) vs affinage/temps réel
(profondeur). Rien tranché d'avance, volontairement — c'est une vraie
décision produit, pas une suite mécanique.

## 18. Pourcentages de tir — approche validée sur FT% (20/08/2026)

Reprise choisie par l'utilisateur au point ouvert de §16/§17 : compléter la
largeur (Phase 1) plutôt qu'affiner en profondeur. Seul trou de catégorie
encore non traité (§15) — mais nécessite une approche DIFFÉRENTE des 8
modèles déjà faits, pas juste une 9ᵉ répétition de `train_stat_model.py`.
Validé d'abord sur UN SEUL cas (FT%, lancers francs) avant de généraliser à
FG%/3P% — même méthode que points (§12) puis 6 autres stats (§15).

**Pourquoi une approche différente.** Un pourcentage n'est pas une valeur à
régresser directement : c'est un ratio réussites/tentatives, et les deux
varient indépendamment (2 tentatives à 100% et 12 à 75% ne se comparent
pas). Principe retenu, 2 sous-modèles combinés par une loi **Binomiale** :
1. **Tentatives** (`fta`) : régressé comme les autres stats comptées
   (RandomForestRegressor) → `n_hat`.
2. **Taux de réussite** (`p_hat`) : PAS régressé — estimé par
   **rétrécissement bayésien** (Beta-Binomial) du ratio réussites/tentatives
   observé sur les 10 derniers matchs vers la moyenne ligue (78.1%). Un
   joueur à 1/1 sur ses derniers lancers n'est pas "à 100%", c'est un petit
   échantillon à ramener vers la moyenne ; un joueur à 80/100 est fiable,
   peu rétréci.
3. `M (réussites du soir) ~ Binomial(n_hat, p_hat)` → `P(pct > seuil)` se
   calcule via la CDF binomiale, pour n'importe quel seuil.

**Nouvelles colonnes** : `labels_joueur.ftm/fta` (build_targets.py) ;
`features_joueur.fta_moy5/10` (prédicteur des tentatives) et
`ftm_sum10`/`fta_sum10` (sommes BRUTES, pas un ratio déjà calculé — le
rétrécissement bayésien a besoin du volume de tentatives sous-jacent pour
savoir de combien rétrécir) (build_features.py). Un match sans tentative
réelle n'a pas de % défini — exclu de la calibration, même convention que
les livres de paris réels (pari annulé, pas gradé à 0%).

**Bug réel trouvé en validant, pas juste une hypothèse** : 1er entraînement
du modèle de tentatives sur TOUS les matchs (y compris les soirs à 0
tentative, comme les autres stats comptées) → `n_hat` moyen 2.79 contre
tentatives réelles moyennes 3.89 sur les matchs notables (sous-estimation
de 28%). Cause : la calibration se mesure forcément sur les matchs à
tentative réelle > 0 (un % n'existe pas sinon) — c'est une espérance
CONDITIONNELLE (`E[fta | fta>0]`), différente de l'espérance
INCONDITIONNELLE qu'apprend un modèle entraîné sur l'ensemble complet. Plus
`n_hat` est sous-estimé, plus un seul panier suffit à "dépasser 90%" —
gonflait artificiellement la proba des seuils hauts (écart de calibration
jusqu'à +17.7% sur les matchs à volume élevé). **Corrigé** : le modèle de
tentatives (`train_pct_model.py`) s'entraîne UNIQUEMENT sur les matchs où
le joueur a réellement tenté ≥ 1 lancer franc. `n_hat` moyen passe à 3.82
contre 3.87 réel — quasi corrigé, écart de calibration ramené à ±4 à 9%
selon le seuil (contre jusqu'à +17.7% avant correctif).

**Rétrécissement (`k`, en tentatives fictives à la moyenne ligue) testé
empiriquement** (5/10/15/20/30, même démarche que Poisson vs normale en
§15) : différences minimes entre les valeurs (5.4% à 6.1% d'écart moyen
absolu), le ratio brut NON rétréci fait quasiment aussi bien — signe que le
biais de sélection (ci-dessus) dominait largement l'erreur, pas le manque
de rétrécissement. `k=5` retenu (le plus proche du ratio brut), mais peu
distinctif dans ce test.

**Écart résiduel non expliqué, candidat Phase 3** : ±4 à 9% restant après
le correctif, pas nul. Hypothèse la plus probable, pas encore vérifiée : la
variance RÉELLE du % par match (fatigue, rythme, défense adverse) dépasse
probablement celle d'une Binomiale pure (tirs i.i.d.) — le même type
d'écart forme-de-distribution que la correction Poisson de §15, mais pas
encore creusé ici. Pas bloquant pour juger l'approche globale VALIDÉE :
amélioration nette (±17.7% → ±4-9%) sur un vrai bug trouvé et compris, pas
juste une hypothèse.

**Modèle sauvegardé** : `Cadrage/Stats/models/ft_pct.joblib`
(`attempts_model`, `attempts_feature_cols`, `league_avg`, `shrinkage_k`,
`distribution: "binomial"`).

**Généralisé le jour même à FG%/3P%** (décision : compléter la largeur
maintenant plutôt que creuser le résiduel FT% d'abord — le résiduel n'est
pas bloquant pour juger l'approche). `train_pct_model.py` reparamétré en
`run(stat, label_fr, makes_col, attempts_col, thresholds)` (même patron que
`train_stat_model.py`), `build_targets.py`/`build_features.py` étendus :
`labels_joueur.fgm/fga/fg3a` (fg3m déjà présent depuis §15), et pour
`features_joueur` : `fga_moy5/10`/`fg3a_moy5/10` (tentatives) +
`fgm_sum10`/`fga_sum10`/`fg3m_sum10`/`fg3a_sum10` (sommes brutes, même
principe que `ftm_sum10`/`fta_sum10`).

**Résultats, très différents selon le volume de tentatives** — confirme
que le biais de sélection identifié sur FT% pesait proportionnellement à
la RARETÉ des tentatives (FT : ~2-4/match, le moins fréquent des 3) :

| Stat | Moyenne ligue | Matchs notables (tentative réelle) | Meilleur k | Écart moyen absolu |
|---|---|---|---|---|
| FT% | 78.1% | 6 259 / 11 258 (55.6%) | 5 | 5.4% |
| FG% | 46.8% | 10 646 / 11 258 (94.5%) | 30 | **0.9%** |
| 3P% | 36.0% | 8 933 / 11 258 (79.3%) | 5 | 3.6% |

**FG% quasi parfaitement calibré** (±0.0 à ±2.8% selon le seuil, k=30) —
le tir au panier est tenté par presque tout joueur qui joue (bien plus de
volume que les lancers francs), le biais de sélection conditionnel devient
négligeable, et le volume élevé de tentatives (moyenne ~10/match) rend la
Binomiale une bien meilleure approximation. **3P% intermédiaire** (±1.4 à
±7.8%, pire au seuil bas 20% — probablement le même effet petit-échantillon
que FT% mais atténué). **FT% reste le moins bien calibré des 3**, cohérent
avec son plus faible volume de tentatives.

**Rétrécissement (`k`) reconfirmé peu déterminant** sur les 3 stats
(écarts entre valeurs de k toujours < 1 point de %) — le facteur dominant
de calibration est le VOLUME de tentatives (FT < 3P < FG), pas le choix de
`k`. Généralisation validée : approche Binomiale à 2 sous-modèles
retenue comme la bonne méthode pour toute stat de taux, avec ce
correctif de biais de sélection intégré dès le départ.

**3 modèles sauvegardés** : `Cadrage/Stats/models/{ft,fg,fg3}_pct.joblib`.

**Reste ouvert, pas creusé cette session** : le résiduel de calibration
(hypothèse overdispersion, cf. plus haut) — plus visible sur FT%/3P% (peu
de tentatives) que FG%. Candidat Phase 3 si besoin d'affiner davantage,
pas bloquant pour l'usage en l'état.

## 19. Cas Wembanyama — écart double-double vs Gemini/Copilot, piste Phase 3 (20/08/2026)

```text
Testé avec tester_modele.py (§11 README.pdf) : P(double-double) = 42.8%,
P(triple-double) = 3.1% pour Victor Wembanyama. Comparé par l'utilisateur à
Gemini/Copilot (~60% DD, ~7% TD, chiffres non vérifiés/non recalculés,
juste des estimations d'un autre LLM) — écart notable sur le DD (43 vs 60).
Vérifié dans la base avant de conclure quoi que ce soit (pas de suppositions
sans preuve).

**Diagnostic** (`player_id=1641705`, 132 matchs en base, saisons 2024-25 +
2025-26) :
- Taux de double-double RÉEL selon la fenêtre : 5 derniers matchs 60% ;
  **10 derniers matchs (= fenêtre utilisée par le modèle) 40%** ; 20
  derniers matchs 60% ; 40 derniers matchs 62.5% ; saison complète 62.1%.
- **Le modèle (42.8%) colle exactement à sa fenêtre d'entrée (40% réel sur
  10 matchs) — pas un chiffre aléatoire, le modèle fait ce qu'on lui
  demande.** L'écart avec Gemini/Copilot (~60%) vient probablement du fait
  qu'un LLM sans calcul réel derrière tend à ressortir une moyenne de
  saison/une réputation générale plutôt qu'un calcul sur la forme récente
  — ni plus rigoureux ni forcément faux, juste une réponse différente à une
  question légèrement différente.
- Cause identifiée via `feature_importances_` du modèle `double_double` :
  `reb_moy10` (33%) + `reb_moy5` (22%) pèsent plus de la moitié de la
  décision — logique, les points de Wembanyama (~26 pts/match, quasi
  garantis) ne sont jamais le facteur limitant d'un double-double, ce sont
  toujours les rebonds. Son `reb_moy10` est tombé à 9.1, tout juste sous le
  seuil de 10 (rebonds très irréguliers sur cette fenêtre : 4, 6, 7, 8, 9,
  10, 12, 13, 14, 15, 17, 24).

**Ce n'est PAS un bug de calibration au sens propre** (la calibration
globale du modèle double-double, mesurée par log loss sur tout le dataset
de test, §14/§17, reste bonne) — c'est une LIMITE DE CONCEPTION : contrairement
aux modèles de points/rebonds/etc. qui ont déjà 2 horizons (`moy5` ET
`moy10`), et contrairement aux modèles de % de tir qui rétrécissent vers
une moyenne longue (Beta-Binomial, §18), le modèle double-double/triple-
double n'a AUCUN signal à plus long terme (20 matchs, saison) pour
distinguer une vraie tendance récente d'un creux passager sur une fenêtre
de 10 matchs. Même famille de problème que le rétrécissement bayésien de
§18, jamais appliqué ici.

**Piste concrète pour la Phase 3, PAS ENCORE FAITE** (décision explicite de
l'utilisateur : creuser d'abord avant de changer la recette) : ajouter une
fenêtre plus longue (ex. `reb_moy20` ou une moyenne de saison) comme
feature supplémentaire du modèle double-double/triple-double, pour que le
RandomForest puisse lui-même arbitrer entre forme récente et tendance de
fond plutôt que de ne voir que 10 matchs. **À vérifier avant de généraliser
ce changement** : est-ce que ce cas (Wembanyama) est isolé, ou est-ce que
d'autres joueurs à forte variance de rebonds montrent le même écart entre
fenêtre courte et taux réel long terme ? Pas encore regardé.
```

## 20. Phase 3 — overdispersion FT%/FG%/3P% : Beta-Binomial adopté, FT% seulement (21/08/2026)

```text
Reprise du résiduel de calibration ±4-9% laissé ouvert en §18 (candidat
Phase 3, hypothèse overdispersion jamais vérifiée). Même démarche que le
choix Poisson vs normale (§15) : tester empiriquement avant de généraliser,
rien décidé a priori.

**Hypothèse testée** : `train_pct_model.py` calcule P(pct > seuil) via une
Binomiale PLUG-IN — le rétrécissement bayésien (§18) donne un postérieur
Beta(alpha, beta) sur le taux, mais celui-ci est écrasé à sa seule moyenne
(`p_hat`) avant d'être injecté dans une Binomiale simple. Ça jette
l'incertitude sur le taux lui-même, qui doit mécaniquement sous-estimer la
variance réelle match par match (fatigue, défense adverse...).

Testé (`scripts/test_overdispersion_ft.py`, script gardé pour trace/repro) :
même split que `train_pct_model.py`, comparaison Binomial plug-in actuel vs.
Beta-Binomial prédictif (garde alpha/beta séparés au lieu de la moyenne),
sur les 3 stats de taux avec leur `k` déjà retenu en §18.

| Stat | Volume tentatives | Écart Binomial | Écart Beta-Binomial |
|---|---|---|---|
| FT% | faible (~2-4/match) | 5.4% | **4.1%** |
| 3P% | moyen (~5-8/match) | 3.6% | 3.4% (négligeable) |
| FG% | élevé (~10/match) | 0.9% | 1.1% (légèrement pire) |

**Confirmé, mais pas partout** : l'effet d'overdispersion est réel et
proportionnel à la RARETÉ des tentatives — inverse du volume qui dominait
déjà la calibration en §18. Sur FG% (déjà quasi parfait), élargir la
distribution n'apporte rien et dégrade légèrement. Sur FT% (le pire des 3),
gain net (~24% de réduction du résiduel). 3P% : gain marginal, pas retenu.
Le gain sur FT% ne comble pas tout le résiduel (reste ~4%) — le signe de
l'écart s'inverse entre 60% (+7%) et 70-90% (−4 à −6%), signe d'un biais
résiduel sur l'estimation du taux/des tentatives eux-mêmes, pas juste un
manque de variance. Pas creusé davantage (jugé pas assez d'intérêt pour
l'effort à ce stade).

**Adopté en prod, FT% seulement** — même patron que `POISSON_STATS` (§15) :
correctif ciblé par stat, pas généralisé partout par défaut.
`train_pct_model.py` : nouvelle constante `BETABINOM_STATS = {"ft"}`,
`proba_pct_over_betabinom()`/`posterior_alpha_beta()` ajoutées, `run()`
sauvegarde `distribution: "beta_binomial"` pour FT% (`"binomial"` inchangé
pour FG%/3P%). `tester_modele.py` (`run_pct()`) lit ce champ et bascule sur
la CDF Beta-Binomiale avec le postérieur complet pour FT%, comportement
inchangé pour FG%/3P%. Les 3 modèles réentraînés/resauvegardés
(`models/{ft,fg,fg3}_pct.joblib`) — mêmes `k` retenus qu'en §18 (FT%=5,
FG%=30, 3P%=5), aucune régression sur FG%/3P% (calibration identique aux
chiffres de §18, code non affecté pour ces 2 stats). Vérifié en conditions
réelles via `tester_modele.py` (Tatum/FT%, Curry/3P%, Jokić/FG%) : le tag
`[Beta-Binomial, incertitude sur le taux gardee]` apparaît bien seulement
pour FT%, les 2 autres stats affichent le détail inchangé.

**Reste ouvert, pas creusé** : le biais résiduel ~4% sur FT% (signe qui
s'inverse selon le seuil) — piste distincte de l'overdispersion, jamais
regardée. Pas bloquant, gain déjà net par rapport à avant.
```

## 21. Réentraînement complet sur 5 saisons + biais résiduel FT% diagnostiqué (21/08/2026)

```text
Reprise du point resté ouvert depuis le 20/08/2026 (§16/§17) : les 12
modèles restaient entraînés sur le dataset à 2 saisons alors que `nba.db`
avait déjà été reconstruit à 5 saisons. Séquence documentée en §17 rejouée
à l'identique : `build_features.py` → `build_targets.py` →
`train_points_model.py` → `train_doubledouble_model.py` →
`train_stat_model.py` → `train_pct_model.py`.

`features_joueur`/`labels_joueur` : 56 938 → **140 933 lignes**,
`entrainement_matchs` couvre les 6 602 matchs des 5 saisons. Amélioration
nette, cohérente avec le 1er passage à données complètes (§17, où le même
type de gain avait déjà été observé) :

| Modèle | Avant (2 saisons) | Après (5 saisons) |
|---|---|---|
| Points (MAE / R²) | 4.75 / 0.497 | **4.65 / 0.518** |
| FT% (écart moyen absolu, Beta-Binomial) | 4.1% | 4.1% (stable) |
| FG% (écart moyen absolu) | 0.9% (k=30) | 0.9% (k=30, stable) |
| 3P% (écart moyen absolu) | 3.6% (k=5) | **2.9%** (k=5) |

Aucune régression. Le correctif Beta-Binomial sur FT% (§20) reste valide
sur le nouveau dataset (5.3%→4.1% avant/après Beta-Binomial, cohérent avec
la version précédente).

**Biais résiduel FT% (~4%, signe qui s'inverse selon le seuil, laissé
ouvert en §20) — diagnostiqué, PAS UN BUG.** Nouveau script
`scripts/diagnose_ft_bias.py` (gardé pour trace), 3 hypothèses testées dans
l'ordre :
1. **Biais non conditionnel sur p_hat** : moyenne prédite 77.6% vs taux réel
   moyen 76.8% (+0.8%) — négligeable, écarté.
2. **Biais sur n_hat** (tentatives) : moyenne prédite 3.85 vs réelle 3.88
   (-0.02) — négligeable, écarté.
3. **Granularité (retenue)** : calibration recalculée par tranche de n_hat
   arrondi (1-2, 3, 4, 5-6, 7+). Avec un si petit nombre de tentatives
   réelles, les fractions atteignables sont rares (n=2 → seulement 0/50/
   100% ; n=3 → 0/33/67/100%...) — la proba prédite (fonction de n_hat
   arrondi et du seuil) reste EXACTEMENT IDENTIQUE sur plusieurs seuils
   consécutifs (ex. 60.3% répété de 70% à 90% pour n_hat∈[1,2]), alors que
   le taux réel empirique varie en continu d'un seuil à l'autre. C'est ce
   décalage mécanique entre une fonction en escalier (le modèle, contraint
   par un n petit) et une courbe lisse (le réel) qui produit le signe qui
   s'inverse observé en §20 — pas une erreur du modèle.

**Conclusion : rien à corriger.** Même famille de constat que le cas
Wembanyama (§19) — une limite mathématique inhérente aux stats à faible
volume de tentatives, pas un défaut de conception. Le résiduu ±4% de §20
est déjà le résultat du meilleur choix de distribution disponible
(Beta-Binomial) compte tenu de cette contrainte structurelle.
```

## 22. Phase 4 — micro-service FastAPI (raccordement appli), démarré (21/08/2026)

```text
Reprise du plan en 5 phases (§16) : Phase 4 ("pont contexte en direct"),
prérequis à la Phase 5 (intégration appli, SPEC_TECHNIQUE_PROBA_PARIS_
PERSOS_V0_1.md §7, point 3 -- "le pont technique features à jour... pas
construit, nécessaire pour calculer une proba au moment réel où un joueur
valide un pari").

**Décisions d'architecture actées avec l'utilisateur, jamais tranchées
avant** (rien dans la doc ne les couvrait) :
1. **Pont inter-langage appli (Next.js/TypeScript) ↔ modèles (Python)** :
   micro-service HTTP (FastAPI) plutôt que réimplémenter l'inférence en
   TypeScript (duplication, resynchronisation à chaque réentraînement) ou
   un job batch écrivant dans Supabase (latence = fréquence du job, l'appli
   ne calcule jamais rien à la demande).
2. **Fraîcheur de `nba.db`** : cron quotidien, même patron que la synchro
   matchs déjà en place côté appli (`sync-results.yml`, T4/T8) --
   implication déduite en concevant : comme `nba.db`/`models/` sont
   gitignorés (volumineux, régénérables, cf. `.gitignore`), un cron GitHub
   Actions classique (checkout éphémère) ne peut PAS accumuler un fetch
   incrémental d'un run à l'autre -- le service doit tourner sur un hôte à
   DISQUE PERSISTANT et faire son propre refresh, le cron se contentant
   d'un curl déclencheur (`POST /refresh`), exactement comme
   `sync-results.yml` déclenche `/api/sync/results` côté appli. Implique un
   hébergement avec disque persistant (Render/Railway/Fly.io/VPS) --
   **pas encore choisi**, à trancher avant tout déploiement réel.

**Refactor préalable (zéro duplication)** : `scripts/tester_modele.py`
gagne `compute_proba(conn, player_id, stat, seuil, opponent_id, is_home,
rest_days) -> dict` -- extrait la logique jusque-là seulement dans
`main()` (résolution de la famille de modèle, construction du contexte,
appel du bon `run_*`). Le CLI devient un fin appelant de cette fonction ;
vérifié après coup que les 3 sorties (Tatum/FT%, Jokić/dd, Curry/pts vs
LAL) sont RIGOUREUSEMENT IDENTIQUES à avant le refactor.

**Service construit** : `Cadrage/Stats/service/app.py` (nouveau dossier),
`requirements.txt` dédié (fastapi, uvicorn, + les dépendances d'inférence
existantes -- pas nba_api/fpdf2, pas nécessaires pour l'inférence seule).
- `GET /health` -- liste les modèles chargés + stats disponibles.
- `POST /predict` -- body `{joueur|joueur_id, stat, seuil?, adversaire?,
  exterieur?, repos?}`, réutilise `compute_proba()`/`find_player()`/
  `find_team()` tels quels. Erreurs (`SystemExit`/`ValueError` du code
  existant) attrapées et renvoyées en 400 avec le même message que le CLI
  (nom ambigu, joueur introuvable, seuil manquant).
- `POST /refresh` -- stub, 501 explicite. Le fetch incrémental nba_api
  n'existe pas encore, laissé pour la suite de la Phase 4.

**Vérifié en conditions réelles** (uvicorn local, port 8123, curl) : les 3
familles de modèles (régression/pts, classification/dd, pourcentage/ft +
fg3m Poisson), le cas adversaire+extérieur+repos, ET les 3 cas d'erreur
(joueur ambigu "Curry", joueur inconnu, seuil manquant pour `pts`) --
réponses identiques aux résultats CLI déjà validés. Serveur de test arrêté
après vérification, fichiers de sortie temporaires nettoyés.

**Reste à faire pour clore la Phase 4** :
1. Fetch incrémental `nba_api` (nouveaux matchs depuis le dernier connu,
   sans tout retélécharger) -- `/refresh` reste un stub sans lui.
2. Choisir l'hébergement (disque persistant requis) -- pas encore fait.
3. Écrire le workflow GitHub Actions (cron quotidien, curl vers
   `/refresh`) -- dépend du point 2 (URL de l'hôte).
4. Une fois 1-3 faits : reprendre la spec Phase 5
   (SPEC_TECHNIQUE_PROBA_PARIS_PERSOS_V0_1.md §7) -- il restera encore les
   points 2 (distribution réelle de probas pour calibrer les seuils entre
   paliers), 4 (structuration IA du texte libre) et 5 (barème du fallback),
   qui ne dépendent pas de cette brique-ci.
```

## 23. Phase 4 — architecture "sans état" (Supabase) retenue, Cloud Run choisi, service migré (21/08/2026)

```text
Suite immédiate de §22 : au moment de choisir concrètement l'hébergement du
micro-service (demandé explicitement par l'utilisateur -- "on se penche sur
le point 1"), reconsidération avant de s'engager sur un hébergeur payant.

**Constat qui a fait pivoter le design** : `nba.db` (575 Mo) ne pèse autant
que parce qu'il embarque le play-by-play (3 054 074 lignes) -- jamais lu par
`build_context()` (seulement box_scores/matchs/box_scores_advanced/
features_joueur). Vérifié concrètement : une copie de test sans
play_by_play tombe à 110 Mo. Le design auto-suffisant de §22 (le service
garde nba.db en local, se rafraîchit lui-même) aurait nécessité un hôte à
DISQUE PERSISTANT payant (~5-7€/mois, Render Starter/Fly.io/VPS) juste pour
faire persister ces 110 Mo + les 103 Mo de modèles entre les requêtes.

**Décision avec l'utilisateur** : architecture B (sans état) --
1. Les 110 Mo utiles vivent dans **Supabase** (déjà payé/utilisé par
   l'appli) au lieu du disque du service.
2. Les modèles (103 Mo) sont embarqués DANS L'IMAGE du service au build
   (git), pas sur un disque à faire persister.
3. Le service devient stateless -- hébergeable sur un serverless gratuit.
4. Le rafraîchissement quotidien devient un job qui écrit DIRECTEMENT dans
   Supabase (pas encore écrit), sans jamais appeler le service -- `/refresh`
   devient inutile dans ce design (gardé en stub pour l'instant, à retirer
   si confirmé inutile une fois le job quotidien écrit).

**Hébergeur, comparé à 3 options** (Render gratuit / Google Cloud Run /
fonction Python dans le projet Vercel existant) -- **Google Cloud Run
retenu** : vrai serverless (scale à zéro), free tier très large (2M
requêtes/mois, inatteignable ici), plus robuste/standard que le "réveil"
Render pour ce pattern exact (service conteneurisé stateless). Contrepartie
assumée : carte bancaire requise à l'inscription (aucun débit sous le seuil
gratuit) + Dockerfile à écrire (Render aurait déployé depuis un simple push
Git). La fonction Python Vercel a été écartée sans être testée -- risque
réel de dépasser les limites de taille de fonction (scikit-learn/scipy +
103 Mo de modèles, plan Hobby) jugé trop élevé pour s'y engager sans test.

**Schéma Supabase** (`supabase/migrations/20260821130000_stats_tables_for_
service.sql`, migration #31) : 3 tables préfixées `stats_` dans le schéma
`public` (pas un nouveau schéma Postgres, pour éviter le réglage manuel
"Exposed schemas" du dashboard) -- `stats_equipes`, `stats_joueurs`, et
`stats_box_scores` DÉNORMALISÉE (1 table de faits avec toutes les colonnes
nécessaires à `build_context()`, y compris `ts_pct`/`usg_pct` -- évite les
jointures via PostgREST, plus lourdes qu'en SQL direct). RLS activée sans
policy (deny-all anon/authenticated, le service utilise
`SUPABASE_SERVICE_ROLE_KEY` qui contourne RLS). Index sur (player_id,
game_date desc) et (player_id, opponent_team_id), les 2 accès réels de
`build_context()`.

**Poussée sur la base réelle** (`npx supabase db push`) -- repassé SANS le
blocage classifieur rencontré les jours précédents, ce qui a aussi débloqué
au passage les migrations #29 (`delete_bet`) et #30
(`drop_tutorial_seen_at`), en attente depuis plusieurs jours (voir
`GAPS_OUVERTS.md`).

**Backfill** (`service/backfill_supabase.py`, nouveau script, une seule
fois) : lit `nba.db` (le JOIN exact utilisé par `build_context()`), upsert
par lots de 1000 lignes. **Bug réel trouvé en migrant** : pandas 3.0 (très
récente, changement de comportement) renvoie des `float`/`int` Python
NATIFS via `to_dict()` (pas des scalaires `numpy.float64`/`numpy.int64`
comme avant) -- un test `isinstance(v, np.floating)` ne les détecte donc
plus, et une colonne entière avec des `NULL` (remontée en `3.0` à cause du
`NaN` pandas) atterrit littéralement comme `3.0` dans le JSON envoyé à
Postgres, rejeté par une colonne `integer` (`22P02`). Corrigé
(`to_json_safe()` teste aussi `int`/`float` natifs, pas seulement les types
numpy). **Résultat final vérifié** : 30 équipes, 1052 joueurs, 140 016
lignes `stats_box_scores`.

**Réécriture du service** : nouveau `service/supabase_context.py` --
équivalent Postgres de `build_context()`/`find_player()`/`find_team()`
(tester_modele.py, inchangé, reste utilisé par le CLI local) +
`compute_proba()` propre à cette source. `service/app.py` reconnecté
dessus (client Supabase créé paresseusement, pas au chargement du module).
**Vérifié en conditions réelles** (uvicorn local + vraie base Supabase,
curl) : les 3 familles de modèles ET les 3 cas d'erreur (nom ambigu, joueur
inconnu, seuil manquant) -- résultats RIGOUREUSEMENT IDENTIQUES à la
version SQLite d'avant (Tatum FT% 26.8%, Jokić dd 75.1%, Curry pts vs LAL
48.7%). Un détail de format corrigé au passage (`contexte_periode`
affichait un timestamp complet au lieu d'une date simple).

**`Dockerfile`** (`Cadrage/Stats/Dockerfile`, contexte de build =
`Cadrage/Stats/`) : copie ciblée de `service/requirements.txt`,
`scripts/tester_modele.py` (seul fichier de `scripts/` nécessaire à
l'inférence, pas tout le dossier), `models/` (103 Mo), `service/app.py` +
`service/supabase_context.py` -- JAMAIS `data/` (575 Mo, inutile dans cette
architecture). `.dockerignore` ajouté par sécurité. Guide de déploiement
complet écrit (`service/DEPLOIEMENT_CLOUD_RUN.md`) -- commandes `gcloud`
exactes, clé Supabase stockée via Secret Manager (jamais collée dans le
chat, copiée directement du `.env.local` vers la commande `gcloud` par
l'utilisateur).

**Pas encore fait** (nécessite l'action de l'utilisateur, compte Google
Cloud) : le déploiement réel. Ni le fetch incrémental quotidien, ni le
workflow GitHub Actions correspondant.
```

## 24. Déploiement réel sur Google Cloud Run — FAIT et vérifié (21/08/2026, suite)

```text
L'utilisateur a suivi `service/DEPLOIEMENT_CLOUD_RUN.md` de bout en bout,
guidé pas à pas (aucune commande gcloud lancée depuis cet environnement --
pas de compte GCP ici, tout exécuté par l'utilisateur lui-même dans son
propre terminal PowerShell).

**Étapes suivies** : installation `gcloud` CLI (via `winget install
Google.CloudSDK`, un résidu d'installation précédente a nécessité
`--include-unknown`) ; `gcloud init` (authentification + création du projet
`nba-pronos-stats-2026` -- premier ID `nba-pronos-stats` non tenté, direct
avec un suffixe pour l'unicité mondiale) ; liaison d'un compte de
facturation via la console web (nécessaire même pour rester dans le free
tier) ; activation des 3 APIs (`run`/`cloudbuild`/`secretmanager`) ; clé
Supabase stockée dans Secret Manager.

**Incident réel, secret exposé** : la valeur de `SUPABASE_SERVICE_ROLE_KEY`
est apparue en clair dans la conversation (sélection IDE + commande collée)
en la fournissant pour la commande `gcloud secrets create`. Signalé
immédiatement, rotation proposée -- **déclinée par l'utilisateur** ("pas
nécessaire cette fois"), même schéma que l'incident du 04/08/2026 (voir
mémoire `nba-pronos-collab-style`) : la clé était déjà stockée avec succès
dans Secret Manager au moment du signalement, pas de nouvelle tentative
demandée.

**2 bugs réels rencontrés en déployant, tous deux corrigés en conditions
réelles** :
1. **Commande multi-lignes PowerShell mal découpée** : le 1er
   `gcloud run deploy` (avec continuation par backtick `` ` ``, syntaxe
   copiée du guide) s'est terminé AVANT que `--set-secrets` soit pris en
   compte -- ce flag s'est retrouvé exécuté comme une commande séparée
   (erreur de syntaxe visible, sans lien avec le déploiement lui-même).
   Résultat : 1re révision déployée SANS `SUPABASE_URL`/
   `SUPABASE_SERVICE_ROLE_KEY`. Détecté en testant `/health` (répond, ne
   dépend pas de Supabase) vs `/predict` (500, `Internal Server Error`).
   Corrigé sans reconstruire l'image : `gcloud run services update` en UNE
   SEULE LIGNE (évite le piège des backticks) avec les 2 flags manquants.
2. **Permission Secret Manager manquante** : la mise à jour a d'abord
   échoué (`Permission denied on secret ... for Revision service account
   ...-compute@developer.gserviceaccount.com`) -- le compte de service par
   défaut de Cloud Run n'a PAS accès à un secret par défaut, il faut
   explicitement lui accorder `roles/secretmanager.secretAccessor` sur ce
   secret (`gcloud secrets add-iam-policy-binding`). Non documenté dans le
   guide initial -- **à ajouter à `DEPLOIEMENT_CLOUD_RUN.md`** pour la
   prochaine fois (créer un secret ET l'octroi IAM devraient être groupés).

**Vérifié en conditions réelles, service EN LIGNE** :
`https://nba-pronos-stats-991522521713.europe-west1.run.app` -- `/predict`
testé (Tatum FT% 26.8%, Jokić dd 75.1%, Curry [Stephen] pts vs LAL 48.7%),
résultats RIGOUREUSEMENT IDENTIQUES aux tests locaux d'avant déploiement
(§23). Le pont Next.js (Vercel) <-> Python (Cloud Run) fonctionne bout en
bout pour la 1ère fois.

**Reste à faire pour clore la Phase 4** : fetch incrémental `nba_api` +
upsert quotidien dans Supabase (le stub `/refresh` reste inutilisé dans
cette architecture, le job peut écrire directement dans Supabase) ; workflow
GitHub Actions pour ce job. Puis Phase 5 (3 points indépendants de
`SPEC_TECHNIQUE_PROBA_PARIS_PERSOS_V0_1.md` §7).
```

## 25. Rafraîchissement quotidien Supabase — écrit, testé, 3 bugs réels corrigés (21/08/2026, suite)

```text
Dernière brique de la Phase 4 : remplacer le stub `/refresh` par un vrai
job qui garde `stats_equipes`/`stats_joueurs`/`stats_box_scores` à jour
sans jamais toucher au service Cloud Run (§23 -- le job écrit directement
dans Supabase).

**Nouvelle table `stats_matchs`** (migration #32,
`20260821140000_stats_matchs_table.sql`) : légère (game_id/date/saison/
season_type/home_team_id/away_team_id, une ligne par match, ~6-7k lignes)
-- sans elle, savoir "quels matchs sont déjà connus" aurait demandé de
scanner `stats_box_scores` (140k lignes, une par joueur/match) à chaque
exécution. `backfill_supabase.py` étendu pour la peupler depuis la table
locale `matchs` (6602 lignes, migration triviale).

**`service/refresh_daily.py`** (nouveau) : détermine la saison "en cours"
depuis la date du jour (heuristique : à partir d'août, la saison en cours
est celle qui démarre en octobre suivant) ; interroge `stats_matchs` pour
savoir quels matchs de cette saison sont déjà connus ; appelle
`leaguegamefinder` (nba_api) pour la vraie liste des matchs de la saison ;
ne va chercher via l'API (`boxscoretraditionalv3`/`boxscoreadvancedv3`) que
les matchs manquants. **Simplification par rapport au pipeline local** :
domicile/extérieur et l'adversaire de chaque joueur sont déduits
directement du champ `MATCHUP` des 2 lignes `leaguegamefinder` d'un match
("@" = extérieur) -- pas besoin du play-by-play (jamais stocké dans
Supabase, §23) juste pour cette information, contrairement à
`build_matchs_row()` du pipeline local qui en a besoin pour le score final
(pas nécessaire ici).

**Testé en conditions réelles, PAS en local sur un dataset jetable** :
2 vrais matchs des Finales 2026 (`0042500404`/`0042500405`) supprimés
temporairement de `stats_matchs`/`stats_box_scores` (snapshot exact avant
suppression), puis redétectés et réinsérés par le script -- comparaison
stricte colonne par colonne avec les données originales.

**3 bugs réels trouvés et corrigés au fil des essais** :
1. **Pagination PostgREST tronquée** : `known_game_ids()`/
   `season_player_game_counts()` ne paginaient pas -- une réponse Supabase
   plafonne par défaut à 1000 lignes, donc sur une saison à 1321 matchs,
   83 matchs déjà connus ont été pris pour "nouveaux" au 1er essai.
   Corrigé (`fetch_all_rows()`, pagination par `.range()`).
2. **Mauvaise liste de colonnes** : réutilisation initiale de
   `BOX_SCORE_TABLE_COLUMNS` (pipeline local, inclut `oreb`/`dreb`/`tov`/
   `pf`/`fg_pct`.../`team_id`) au lieu d'une liste dédiée
   (`STATS_BOX_SCORE_TRAD_COLUMNS`) correspondant exactement au schéma
   Supabase allégé -- `insert` rejeté (`Could not find the 'dreb' column`).
3. **Filtre DNP incomplet en lisant l'API en direct** : `minutes.notna()`
   seul (même filtre que `load_to_sqlite.py`) ne suffit PAS ici -- le
   pipeline local relit un CSV (une case vide y redevient un vrai NaN à la
   lecture), alors que la réponse `nba_api` EN DIRECT garde `""` (chaîne
   vide) pour un joueur DNP. 18 lignes DNP (`pts=0`) passées au travers au
   2e essai, corrigé (`notna() & (!= "")`). `drop_duplicates(subset=
   ["personId"])` ajouté par la même occasion (même précaution que
   `load_to_sqlite.py`, jamais déclenchée dans ce test mais gardée par
   cohérence).

**Point de robustesse corrigé sans attendre un vrai incident** : l'ordre
d'écriture est `stats_box_scores` PUIS `stats_matchs` (pas l'inverse) --
`known_game_ids()` ne regarde que `stats_matchs`, donc si le script est
interrompu entre les deux (panne réseau, quota API), on veut qu'un match
reste détecté "pas encore connu" tant que ses stats ne sont pas confirmées
écrites. Trouvé en pratique lors du 1er essai raté (bug #2 a interrompu le
script après l'upsert `stats_matchs` mais avant celui des stats -- les 2
matchs sont restés "connus" sans leurs stats jusqu'à ce que ce soit corrigé).

**Après les 3 correctifs** : reproduction confirmée EXACTE (mêmes 42 lignes,
mêmes valeurs sur toutes les colonnes y compris `games_played_season_avant`
et `opponent_team_id`) ; test de non-régression sur la saison entière
(3 season_types) : 1321 connus, 1321 trouvés, 0 nouveau -- aucun doublon,
aucun fantôme.

**Workflow GitHub Actions** (`.github/workflows/refresh-stats-supabase.yml`) :
cron quotidien (10h UTC, safely après la fin de tous les matchs de la
nuit), + `workflow_dispatch` pour un lancement manuel. Installe
`Cadrage/Stats/scripts/requirements.txt` (déjà utilisé par le pipeline
local, `supabase` y a été ajouté) et lance `refresh_daily.py` directement
(PAS d'appel au service Cloud Run -- cohérent avec l'architecture sans
état, §23).

**Reste à faire, action de l'utilisateur** : ajouter 2 secrets GitHub
Actions (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) au dépôt -- jamais
collés dans le chat, à faire via `gh secret set` ou l'interface GitHub.
Sans ça, le cron s'exécutera mais échouera (variables d'environnement
absentes). Une fois fait, la Phase 4 est ENTIÈREMENT close.
```

## 26. 1er run réel du cron + optimisation timeout hors-saison (21/08/2026, suite)

```text
L'utilisateur ajoute les 2 secrets GitHub Actions via l'interface web
(jamais collés dans le chat) et déclenche le workflow manuellement
(`workflow_dispatch`) pour un 1er test réel, sans attendre le cron du
lendemain.

**Résultat : `succeeded` en 10m29s** -- mais logs partagés par l'utilisateur
montrant que quasi tout ce temps est passé sur des échecs : les 3 appels
`leaguegamefinder` (Regular Season/Playoffs/PlayIn) pour la saison 2026-27
expirent chacun après 3 tentatives de 60s (`HTTPSConnectionPool...Read
timed out`), avant que le script conclue correctement "Rien de nouveau --
terminé" (saison 2026-27 hors-saison, aucun match n'existe encore --
comportement final juste, juste très lent à y arriver).

**Problème identifié avant que l'utilisateur ne le signale explicitement**
(prévu en observant "In progress" depuis longtemps, confirmé par les logs
partagés) : ce timeout de 9-10 minutes va se répéter CHAQUE JOUR jusqu'à
mi-octobre (début de saison réelle) -- gaspille une part non négligeable
du quota gratuit GitHub Actions (dépôt privé) pour ne rien trouver.

**Corrigé** : `SEASON_INDEX_TIMEOUT` (15s) et `SEASON_INDEX_RETRIES` (1),
utilisés UNIQUEMENT pour l'appel `leaguegamefinder` dans
`fetch_season_games()` -- `fetch_box_scores()` (un vrai match existant)
garde `REQUEST_TIMEOUT`/`MAX_RETRIES` complets, aucune perte de fiabilité
là où ça compte. Revérifié en local : hors-saison (2026-27) passe de
~10 min à **8 secondes** ; saison pleine (2025-26, tous types) toujours
correcte à l'identique (1321 connus/1321 trouvés/0 nouveau) -- le timeout
réduit ne fait manquer aucun match réel, seulement échouer plus vite quand
il n'y a réellement rien à trouver.

**Phase 4 ENTIÈREMENT close** : service déployé et vérifié (§24), données
tenues à jour automatiquement (§25), coût du job quotidien optimisé (§26).
Reste la Phase 5, 3 points indépendants de `SPEC_TECHNIQUE_PROBA_PARIS_
PERSOS_V0_1.md` §7 (distribution de probas pour calibrer les seuils entre
paliers, structuration IA du texte libre, barème du fallback).
```

## 27. Phase 5 démarrée — structuration IA + raccordement réel dans l'appli (21/08/2026, suite)

```text
Utilisateur : "On y go" -- Phase 5 (relier réellement un pari perso au
calcul de proba). Détail complet du design/des décisions dans
SPEC_TECHNIQUE_PROBA_PARIS_PERSOS_V0_1.md §7bis (nouvelle section) -- ici,
résumé de la session.

**Recherche préalable, code réel de l'appli (agent Explore)** : le cycle de
vie complet d'un pari perso (table bets, save_bet/submitBet/validateBet/
resolveBet/scoreBet) confirmé -- AUCUNE colonne structurée n'existait avant
aujourd'hui (tout dans un champ description texte libre). decisions_0.2.4
§10 n'envisageait l'IA que pour suggérer gagné/perdu à la RÉSOLUTION, pas
pour structurer à la soumission -- ce qui est fait aujourd'hui est une
vraie extension de périmètre, pas un remplissage de case déjà prévue.

**Décisions actées avec l'utilisateur avant de coder** :
- Modèle : **Claude Opus 5** (coût réel négligeable pour ce volume, ~1-1,5
  centime/pari classifié -- l'utilisateur a d'abord demandé s'il existait
  une option gratuite/incluse dans son abonnement Claude Code : non, l'API
  Anthropic est facturée séparément, mais le coût réel est trivial ici).
- Moment de l'appel : **synchrone, à la SOUMISSION du pari** (pas à la
  validation admin, pas en tâche de fond).
- Seuils proba->palier (point 2 de la spec, jamais calibré) : **provisoires
  à vue de nez** pour livrer une version qui marche maintenant, à
  recalibrer plus tard sur un vrai échantillon.
- Plan d'ensemble validé avant codage : nouvelles colonnes sur `bets`,
  accroché à la soumission (même moment que `proposed_category`/
  `proposed_difficulty`), admin garde la main à la validation (même
  principe que l'existant).

**Implémenté** :
- Migration `20260821150000_bets_ai_structuration.sql` : 7 colonnes
  nullables sur `bets` (structured_player_name/stat/threshold/comparison,
  is_calculable, calculated_proba, suggested_difficulty) + fonction SQL
  `update_bet_structuration` (SECURITY DEFINER, même patron que
  save_bet/withdraw_bet/delete_bet -- vérifie propriétaire + statut
  SUBMITTED, jamais un UPDATE direct depuis le client).
- `lib/ai/statCodes.ts` : les 12 codes de stat du micro-service, à
  resynchroniser à la main avec `STATS_DISPONIBLES` côté Python (pas de
  génération partagée entre les 2 dépôts/langages).
- `lib/ai/structureBet.ts` : appel Claude Opus 5 via
  `client.messages.parse()` + `zodOutputFormat` (structured outputs,
  pattern recommandé de la skill claude-api) -- extrait {calculable,
  player_name, stat, threshold, comparison, reasoning}. `calculable=false`
  pour tout ce qui sort des 12 stats (paris équipe, combo, score total,
  fun/hors-terrain, scénario, formulation ambiguë) -- jamais forcé.
- `lib/ai/statsService.ts` : appel HTTP au micro-service Cloud Run
  (`POST /predict`, §24). Le service ne calcule que P(stat > seuil) --
  pour un pari UNDER, approximation `1 - P(stat > seuil)` (ignore
  P(stat==seuil) pile sur le seuil, écart mineur assumé pour ce 1er jet).
- `lib/ai/difficultyTiers.ts` : seuils provisoires (>=80%->palier 1,
  >=60%->2, >=40%->3, >=20%->4, sinon 5).
- `lib/ai/structureAndScoreBet.ts` : orchestrateur, appelé depuis
  `submitBet` (`lib/actions/bets.ts`) après le succès de `save_bet`.
  **Best-effort total** : try/catch à chaque étage, une panne (clé API
  absente, timeout Cloud Run, joueur non trouvé...) laisse le pari soumis
  normalement, flux manuel existant intact -- rien ne peut faire échouer
  une soumission de pari à cause de cette chaîne.
- Écran admin de validation (`lib/queries/admin-validation.ts`,
  `components/admin/ValidationBetCard.tsx`) : affiche la suggestion IA
  (joueur/stat/seuil/proba/palier) en lecture seule, pré-remplit le
  `<select>` de difficulté avec `suggestedDifficulty` -- l'admin garde la
  main (comme aujourd'hui pour catégorie/difficulté), rien d'auto-appliqué
  sans son geste de validation.
- Dépendances ajoutées : `@anthropic-ai/sdk`, `zod` (`npm install`, pas de
  version devinée -- laissé npm résoudre après un 1er essai avec une
  version inventée qui n'existait pas).

**Bug réel trouvé en vérifiant** : `tsc` a rejeté le cast de
`getPendingValidationBets()` (`GenericStringError[]` au lieu de `BetRow[]`)
-- la chaîne `.select(...)` construite par concaténation (`"a, b" + "c, d"`)
empêche supabase-js d'inférer les colonnes en type littéral. Corrigé en
un seul literal string non concaténé.

**Vérifié** : `tsc`/`eslint`/`vitest` (37/37)/`next build` (38 routes)
propres. Migration poussée sur la base réelle (colonnes confirmées lisibles
par une requête directe). **PAS ENCORE vérifié au clic** -- nécessite
`ANTHROPIC_API_KEY` et `STATS_SERVICE_URL` configurées (Vercel +
`.env.local`), pas encore fait par l'utilisateur.

**Reste ouvert, assumé explicitement, pas oublié** :
- Point 2 (seuils calibrés) : toujours provisoire, à reprendre avec un vrai
  échantillon de paris structurés.
- Point 5 (barème du fallback) : statu quo, question "faut-il un barème
  séparé ?" toujours ouverte, jamais tranchée par l'utilisateur.
- Vérification en conditions réelles (poser un vrai pari perso calculable,
  observer la suggestion admin) -- bloquée sur la configuration des 2
  variables d'environnement.
```

## 28. Structuration IA vérifiée hors-interface, 1 bug réel corrigé (21/08/2026, suite)

```text
Suite de §27 : les 2 variables d'environnement configurées par
l'utilisateur (.env.local + Vercel), reste à vérifier que la chaîne
fonctionne réellement. Aucun accès navigateur dans cet environnement --
au lieu d'attendre un test au clic, vérification directe des nouveaux
appels externes (Claude Opus 5 + micro-service Cloud Run) via un script
autonome jetable, reproduisant exactement la logique de structureBet.ts/
statsService.ts (obligé de dupliquer plutôt qu'importer : "server-only"
bloque l'exécution hors build Next.js, erreur explicite si on essaie).

**Incident billing en route, résolu par l'utilisateur** : 1er essai avec
la clé du compte Anthropic initial -- `BadRequestError 400 "Your credit
balance is too low"`. L'utilisateur tente d'acheter des crédits (6$),
refusé plusieurs fois par sa banque malgré un solde suffisant (20€) --
diagnostic partagé (probable pré-autorisation bancaire plus élevée que le
montant réel, carte à plafond bas, ou blocage paiement international),
pistes de contournement proposées (autre carte, contact banque, 3D
Secure). L'utilisateur choisit finalement de créer un 2e compte Anthropic
et d'y charger 5$ avec succès -- nouvelle clé mise en place directement
dans `.env.local` par l'utilisateur (jamais collée dans le chat, confirmé
au passage : la fédération d'identité proposée par la console Anthropic
n'est PAS adaptée ici, ne fonctionne qu'avec GCP/AWS/Azure/GitHub Actions
comme fournisseur, pas Vercel -- clé API statique confirmée comme le bon
choix pour ce projet).

**Script de test, 4 cas réels** :
1. "Jayson Tatum marque plus de 25 points ce soir" -> calculable, pts>25,
   OVER -- proba 27% (Tatum sous sa moyenne récente), palier 4.
2. "L'entraîneur des Celtics criera au moins 3 fois sur l'arbitre" ->
   calculable=false, raisonnement correct (hors-terrain, aucune des 12
   stats) -- comportement attendu, repli manuel.
3. "Nikola Jokic fait un triple-double" -> calculable=true, stat=td,
   threshold=null, comparison=null (extraction IA correcte) -- **mais
   rejeté à tort comme non calculable** par le code (voir bug ci-dessous).
4. "Stephen Curry réussit moins de 4 tirs à 3 points" -> calculable, UNDER
   -- proba 72% (1 - 28% côté service), palier 2. Confirme que
   l'approximation UNDER fonctionne mécaniquement.

**Bug réel trouvé et corrigé** : `structureAndScoreBet.ts` exigeait
`structuration.comparison` non-null pour TOUT pari `calculable=true` --
mais dd/td (`NO_THRESHOLD_STATS`) ont légitimement `comparison: null` par
design (probabilité directe, pas de notion OVER/UNDER, exactement ce que
`structureBet.ts` demande à l'IA d'extraire). Conséquence avant correctif :
**tous les paris double-double/triple-double, pourtant calculables,
tombaient systématiquement en repli manuel** -- pas un crash, juste une
fonctionnalité silencieusement inopérante pour 2 des 12 stats gérées.
Corrigé : `comparison` requis seulement pour les stats hors
`NO_THRESHOLD_STATS` (`structureAndScoreBet.ts`), type de
`predictOverUnder()` élargi à `"OVER" | "UNDER" | null`
(`statsService.ts`, la fonction gérait déjà correctement `null` en
pratique -- seul le type et le garde-fou appelant étaient faux).
Revérifié après correctif : cas 3 calcule bien une proba (18,3%, palier
5, cohérent avec un joueur qui ne fait pas souvent de triple-double).

`tsc`/`eslint`/`vitest` (37/37) propres après le correctif. Script de test
jetable supprimé après usage (jamais commité).

**Reste avant de considérer la Phase 5 pleinement vérifiée** : test au
clic dans l'interface réelle (poser un vrai pari perso, observer la
suggestion sur l'écran admin de validation) -- la logique/les appels
externes sont confirmés fonctionnels, mais pas le passage complet par
`submitBet` et le rendu de `ValidationBetCard.tsx`, jamais testés
ensemble faute d'accès navigateur dans cet environnement.
```

## 29. 1er test réel via l'interface -- bug "Junior" vs "Jr." trouvé et corrigé (21/08/2026, suite)

```text
Suite de §28 : les variables d'environnement configurées, l'utilisateur
teste pour de vrai via `npm run dev` (compte Rillettes-31, pas de compte
de test jetable -- plus simple). 1re confusion de navigation : plus
d'écran "Nouveau pari" séparé depuis la refonte du 18/08/2026 (§2.72
ETAT_ACTUEL.md) -- les paris sont accrochés aux cartes de match. Corrigé
dans l'échange, pas un vrai bug.

**1re tentative bloquée sur un serveur de dev périmé** : un `next dev`
tournait déjà depuis le 19/08/2026 (`Get-CimInstance` confirme la date de
création du process), avant l'ajout de `ANTHROPIC_API_KEY`/
`STATS_SERVICE_URL` dans `.env.local` -- Next.js charge les variables
d'environnement au démarrage, pas à chaud. Redémarré par l'utilisateur.

**2e tentative, bug réel** : "Michael Porter Junior marque plus de 10 pts"
soumis via le vrai formulaire (`InlineBetForm.tsx` -> `submitBet()`,
confirmé par grep que c'est bien la même fonction que celle modifiée en
§27) -- toujours aucun champ de structuration rempli en base après
soumission. Diagnostiqué en testant directement le micro-service déployé
(`curl .../predict` avec ce nom exact) : `"Aucun joueur trouvé pour
\"Michael Porter Junior\""`. Vérifié en base (`stats_joueurs`) : le vrai
nom est `"Michael Porter Jr."`. Cause : `find_player()` (service Python,
`tester_modele.py`/`supabase_context.py`) ne fait qu'une comparaison de
sous-chaîne après normalisation des accents -- "junior" et "jr." ne
matchent jamais entre eux, simples chaînes différentes. Claude Opus 5 a
fidèlement repris le texte du joueur ("Junior", orthographe humaine
courante) plutôt que la convention d'abréviation NBA utilisée en base --
comportement normal de l'IA, la faille est côté correspondance de nom.

**Corrigé** : nouvelle fonction `normalize_suffix()` dans
`tester_modele.py` (normalise "junior"/"jr"/"jr." -> "jr", idem senior/sr,
`\b` word-boundary pour ne pas mordre sur d'autres mots), appliquée aux
DEUX côtés de la comparaison (needle ET haystack) dans `find_player()`
-- corrigé à la fois dans `tester_modele.py` (CLI local, sqlite) ET
`supabase_context.py` (service déployé, réutilise la fonction via import,
zéro duplication). Testé directement contre la vraie base Supabase :
"Michael Porter Junior" résout maintenant `(1629008, "Michael Porter
Jr.")`. Zéro régression vérifiée (Tatum, Jokić -- accents --, Curry --
ambiguïté toujours détectée --, joueur inconnu -- toujours rejeté).

**Pas encore pris en compte en production** : le service Cloud Run
déployé (§24) tourne toujours sur l'image d'avant ce correctif -- il faut
un redéploiement (`gcloud run deploy`, action de l'utilisateur) pour que
ça s'applique en ligne. Le pari de test ("Michael Porter Junior...") reste
donc à resoumettre après le redéploiement pour confirmer de bout en bout.
```

## 30. Design révisé : auto-validation au lieu de "admin garde la main" (21/08/2026, suite)

```text
Après le 2e bug (§29), l'utilisateur pose une question qui révèle un vrai
malentendu de conception : "si ça fonctionne on va avoir des gros
changements à faire côté interface non ? car la en tant que joueur je
peux encore choisir la difficulté alors que c'est censé être prédit par
l'appli". Creusé : ce que l'utilisateur avait en tête depuis le début
("ça affiche au joueur la probabilité au moment de la validation, auto-
validation mais encore corrigable par l'admin si besoin") est DIFFÉRENT de
ce qui a été codé en §27 ("admin garde la main, suggestion en lecture
seule, comportement joueur inchangé"). Signalé explicitement plutôt que
silencieusement réinterprété -- 2 vraies questions produit tranchées avec
lui : (1) proba visible au joueur, mais seulement APRÈS validation (pas
avant, pour ne pas influencer son choix de pari) ; (2) auto-validation
pour les paris calculables (saute la file d'attente admin), admin corrige
après coup si besoin.

**2 conflits trouvés en implémentant, signalés avant de coder autour** :
1. `/players/[userId]` (proposé initialement par l'utilisateur pour la
   correction admin) filtre les paris par "deadline publique passée", pas
   par statut VALIDATED -- la proba n'y apparaîtrait que bien après la
   validation, mauvais timing par rapport à la demande.
2. Cette même page porte un principe de conception EXPLICITEMENT
   DOCUMENTÉ dans son propre code : "cette page reste la même vue
   publique pour tout le monde" (même l'admin ou le propriétaire du
   profil). Y ajouter un contrôle admin-only aurait cassé ce principe.
Les 2 emplacements réajustés avec l'utilisateur : proba au joueur ->
`BetBlock.tsx` ("Mes pronos", montre TOUS ses propres paris dès
validation, pas seulement les publics) ; correction admin ->
`/admin/validation` (déjà admin-only par nature, contrairement au profil
public).

**Recherche préalable (agent Explore)** sur le système de correction
existant : confirmé qu'AUCUN mécanisme actuel ne permet à un admin de
réviser `validated_difficulty` sur un pari qui RESTE `VALIDATED` -- le
système de `correction_requests` est strictement joueur-initié (RPC
`request_bet_correction` exige `user_id = auth.uid()`), et ses 2 branches
de traitement (origine VALIDATED-non-résolu -> juste rediriger vers la
résolution ; contesté REJECTED/WON/LOST -> changement de statut) ne
couvrent pas ce cas. Nouvelle action nécessaire, pas de réutilisation
possible.

**Implémenté** :
- Migration `20260821160000_bets_ai_auto_validation.sql` : remplace
  `update_bet_structuration` -- si `is_calculable=true`, transition directe
  SUBMITTED->VALIDATED (`validated_category` = catégorie proposée,
  `validated_difficulty` = palier suggéré, `validated_by_admin_id` = NULL,
  signal "validé par l'IA"). Si non calculable, comportement inchangé
  (file d'attente admin classique).
- `lib/queries/play.ts` + `components/play/BetBlock.tsx` : nouvelle ligne
  "Proba calculée : X% (palier Y)", affichée uniquement si
  `isCalculable && status !== DRAFT/SUBMITTED` (donc jamais avant
  validation).
- `lib/actions/bets.ts` (`submitBet`) : `revalidatePath` rappelé APRÈS
  `structureAndScoreBet` (pas seulement avant) -- l'auto-validation change
  le statut du pari après le 1er appel de revalidation dans
  `callSaveBet`.
- `lib/queries/admin-validation.ts` : nouvelle `getAutoValidatedBets()`
  (paris `is_calculable=true` + `validated_by_admin_id IS NULL`, statuts
  VALIDATED/WON/LOST) -- même patron de jointures que
  `getPendingValidationBets()`.
- `lib/actions/admin-validation.ts` : nouvelle
  `overrideAutoValidatedDifficulty()` -- modifie UNIQUEMENT
  `validated_difficulty` (la proba/le contexte structuré restent
  inchangés, ce sont des faits constatés par l'IA, pas un jugement à
  corriger), `recomputeBet()` systématique (le pari peut déjà être résolu,
  les points doivent refléter la nouvelle difficulté), garde
  `assertNotOwnBet` réutilisée (même règle que la validation classique).
- `components/admin/AutoValidatedBetCard.tsx` (nouveau) + section "Auto-
  validés par l'IA" sur `/admin/validation/page.tsx`.
- **Nettoyage** : `ValidationBetCard.tsx` -- la suggestion IA affichée en
  lecture seule (ajoutée en §27) devient du code mort par construction
  (un pari calculable n'apparaît plus jamais dans cette file, il saute
  direct en VALIDATED) -- retirée plutôt que laissée trompeuse.

`tsc`/`eslint`/`vitest` (37/37)/`next build` (38 routes) propres. Migration
poussée sur la base réelle.

**Reste** : redéployer le service Cloud Run (correctif "Junior"/"Jr.",
§29, toujours pas fait) puis retester "Michael Porter Junior marque plus
de 10 pts" via l'appli pour confirmer l'auto-validation de bout en bout
(statut VALIDATED direct, proba visible dans "Mes pronos").
```

## 31. Contexte de match ajouté à la structuration IA -- 2 bugs réels corrigés (21/08/2026, suite)

```text
L'utilisateur teste "Jayson Tatum marque +25 pts" sur un match Nets-
Hornets (Tatum joue à Boston, aucun rapport) -- le pari est quand même
auto-validé avec une vraie proba calculée. Signale aussi que des fautes
de frappe/orthographe (ex. "Junior" vs "Jr.", déjà rencontré en §29) sont
prévisibles côté joueurs, et demande si l'IA peut les détecter.

**Diagnostic** : les 2 problèmes partagent la même cause -- `structureBet()`
extrayait le nom du joueur SANS connaître le contexte du match (qui joue
réellement dans cette rencontre), et reprenait le texte du joueur tel
quel plutôt que de connaître la vraie orthographe.

**2 approches possibles envisagées** : (a) construire un vrai système
d'effectifs par équipe (nouvelle colonne `team_id` sur `stats_box_scores`,
retirée volontairement en §23 car pas nécessaire à `build_context()` ;
nouvel endpoint de lookup côté service Python) -- plus fiable en théorie
mais plus lourd, et pas forcément plus à jour que la connaissance du
modèle sur des infos NBA publiques et récentes ; (b) donner à Claude Opus
5 le nom des 2 équipes du match en contexte et s'appuyer sur sa
connaissance réelle des effectifs NBA pour vérifier ET corriger --
beaucoup plus léger, choisi.

**Implémenté** :
- `lib/ai/structureBet.ts` : nouveau paramètre `teamNames: [string,
  string] | null`. Prompt système enrichi -- si fourni, demande à Claude de
  (1) vérifier que le joueur nommé joue actuellement pour l'une des 2
  équipes (sinon `calculable=false`, même si le reste de l'extraction est
  clair) et (2) renvoyer l'orthographe STANDARD NBA du joueur, pas le
  texte exact du joueur (schema Zod du champ `player_name` mis à jour en
  conséquence).
- `lib/ai/structureAndScoreBet.ts` : nouvelle `resolveMatchTeamNames()`
  (résout `series.team1_id/team2_id` -> noms d'équipe via `teams` ; `null`
  si la série n'a pas encore ses 2 équipes déterminées -- dégrade
  proprement vers l'ancien comportement sans vérification). Nouveau
  paramètre `seriesId` sur `structureAndScoreBet()`.
- `lib/actions/bets.ts` (`submitBet`) : passe `input.seriesId` (déjà
  disponible dans `SaveBetInput`, aucune nouvelle donnée à faire remonter
  du formulaire).

**Testé avec de vrais appels Claude Opus 5** (script jetable, supprimé
après usage) :
1. "Jayson Tatum..." + contexte Nets/Hornets -> `calculable: false`,
   raisonnement correct ("Tatum évolue aux Boston Celtics").
2. Même pari + contexte Celtics/Heat -> `calculable: true`, accepté.
3. "Michael Porter Junior..." + contexte Nets/Hornets -> `player_name:
   "Michael Porter Jr."` (orthographe corrigée) ET `calculable: true`
   (Claude confirme qu'il joue bien pour les Nets -- connaissance réelle
   et à jour, pas une supposition).

`tsc`/`eslint`/`vitest` (37/37)/`next build` propres.

**Limite assumée, pas cachée** : cette vérification s'appuie sur la
connaissance du modèle (entraînement + raisonnement), pas une base
d'effectifs interrogée en direct -- un transfert très récent (après la
date de connaissance de Claude) pourrait échapper à la vérification. Reste
très supérieur à l'absence totale de vérification d'avant. Si ça se révèle
insuffisant en usage réel, l'option (a) (vraie table d'effectifs) reste
disponible pour une itération plus robuste.

**Reste** : redéployer le service Cloud Run (correctif "Junior"/"Jr." côté
`find_player()`, §29 -- désormais une 2e ligne de défense, l'essentiel du
correctif orthographe se fait maintenant côté IA) puis retester de bout en
bout via l'appli.
```

## 32. Fix observabilité : is_calculable=false écrit explicitement (21/08/2026, suite)

```text
L'utilisateur teste "MPJ marque plus de 25 pts" sur un match Atlanta-
Boston -- le pari reste SUBMITTED, `is_calculable` NULL. Ressemble d'abord
à une panne (rate limit Anthropic, compte tout juste crédité) -- log
serveur partagé par l'utilisateur montre pourtant un appel `submitBet`
complet (4879ms, cohérent avec un vrai aller-retour Claude).

**Vraie cause, dans le code, pas côté API** : `structureAndScoreBet.ts`
faisait un `return` dès que l'IA répondait `calculable=false` (ou
`comparison` manquant, ou prédiction échouée) SANS jamais appeler
`update_bet_structuration` -- `is_calculable` restait NULL au lieu de
`false`, indistinguable d'une vraie panne (clé absente, timeout).
Fonctionnellement inoffensif (`is_calculable ?? false` partout en
lecture, le pari retombe pareil sur le flux manuel) mais rendait tout
diagnostic impossible -- exactement le piège qui a fait perdre du temps
ici. MPJ (Michael Porter Jr.) joue à Brooklyn, ni Atlanta ni Boston --
le rejet était très probablement CORRECT, juste jamais tracé clairement.

**Corrigé** : nouvelle `markNotCalculable()` dans `structureAndScoreBet.ts`,
appelée à chaque sortie anticipée -- écrit explicitement `is_calculable:
false` (`structured_*`/`calculated_proba`/`suggested_difficulty` à NULL).
`is_calculable` NULL ne signifie plus désormais que "l'IA n'a jamais pu
répondre" (vraie panne), jamais "l'IA a répondu non".

**Vérifié séparément avec l'utilisateur** : le pari Tatum validé plus tôt
sur un match Nets/Hornets (qui aurait dû être rejeté par le correctif
§31) a été confirmé comme soumis AVANT ce correctif -- pas un vrai trou
dans la vérification d'équipe, juste un pari antérieur au fix.

`tsc`/`eslint`/`vitest` (37/37)/`next build` propres.

**Reste** : redéployer le service Cloud Run (§29, toujours pas fait) ;
resoumettre un pari pour confirmer que `is_calculable=false` s'écrit
maintenant clairement en base pour un cas non calculable.
```

## 33. Joueur hors du match visé : proba 0% au lieu d'un rejet silencieux (21/08/2026, suite)

```text
Suite de §31/§32 : l'utilisateur teste "LeBron James marque +25 pts" sur
un match Atlanta-Boston (LeBron joue aux Lakers) -- correctement rejeté
(`is_calculable=false` grâce au correctif §32), mais rien n'informe le
joueur de la raison, il reste juste sur le flux manuel habituel comme
n'importe quel autre pari non calculable. Retour de l'utilisateur : "il
faut mettre une alerte et refuser le pari... ou alors on l'accepte mais
la proba est à 0%, ce sera plus simple et plus lisible".

**Tension signalée avant de coder** : rejeter la soumission (forcer une
resaisie) romprait le principe déjà acté "l'IA ne bloque jamais un pari"
(`decisions_0.2.4` §4) -- nécessiterait aussi de réorganiser l'ordre
soumission/vérification (aujourd'hui l'IA tourne APRÈS que `save_bet` ait
déjà créé le pari). Accepter avec proba 0% reste cohérent avec ce
principe et ne change pas l'architecture. **Choisi avec l'utilisateur :
option B (accepter, proba 0%).**

**Implémenté** :
- `lib/ai/structureBet.ts` : nouveau champ `player_not_in_match: boolean`
  dans le schema Zod -- distinct de `calculable` (qui reste `true` dans ce
  cas, le pari EST structurellement clair, juste sur le mauvais match).
  Prompt système ajusté : au lieu de "marque calculable=false", demande
  "marque player_not_in_match=true (calculable reste true)".
- `lib/ai/structureAndScoreBet.ts` : si `player_not_in_match`, appelle
  `update_bet_structuration` DIRECTEMENT avec `p_calculated_proba: 0`,
  `p_suggested_difficulty: probaToDifficulty(0)` -- SANS jamais appeler
  `predictOverUnder()`/le micro-service Cloud Run, qui n'a aucune notion
  du contexte de match et calculerait une vraie proba à partir des
  vraies stats du joueur (LeBron a un vrai historique de points -- le
  service ignorerait complètement qu'il ne joue pas ce soir-là, exactement
  le bug d'origine de §31 si on le laissait tourner).

**Testé avec de vrais appels Claude Opus 5** (script jetable, supprimé
après usage), 3 cas :
1. "Lebron James..." + Atlanta/Boston -> `calculable: true,
   player_not_in_match: true` -- proba forcée à 0% côté appli.
2. "Jayson Tatum..." + Atlanta/Boston -> `calculable: true,
   player_not_in_match: false` -- flux normal inchangé, proba calculée
   par le service comme avant.
3. Pari fun ("l'entraîneur criera...") -> `calculable: false,
   player_not_in_match: false` -- toujours rejeté proprement, comme avant.

`tsc`/`eslint`/`vitest` (37/37)/`next build` propres.

**Conséquence acceptée, pas creusée davantage** : `probaToDifficulty(0)`
retourne le palier 5 (le plus dur, 25 points) pour un pari à 0% -- cohérent
avec la logique existante des paliers (proba basse = palier haut) même si
sémantiquement un peu étrange pour un pari "impossible" plutôt que "très
difficile mais possible". Sans conséquence pratique : un pari à 0% perdra
de toute façon (0 point à la résolution), quel que soit son palier.
```

## 34. README.pdf mis à jour + calibration réelle des seuils proba->difficulté (21/08/2026)

```text
Deux chantiers distincts cette session, après §33 :

**1. README.pdf régénéré** (`generate_readme.py`) avec 3 nouvelles sections
(§12 service Cloud Run, §13 rafraîchissement quotidien Supabase, §14 paris
IA Phase 5) + §17 récapitulant les enchaînements de commandes par objectif
("je veux X -> je lance quoi"), demandé par l'utilisateur pour consulter
l'état du projet sans repasser par la conversation à chaque fois.

**2. Calibration des seuils proba->difficulté (Phase 5 §7 point 2)** :
seulement 3 vrais paris calculables en base à cette date -- bien trop peu
pour observer une vraie distribution par quintile comme prévu à l'origine.
Décidé avec l'utilisateur de SIMULER une large distribution plutôt que
d'attendre du volume réel : nouveau script
`scripts/calibrate_difficulty_thresholds.py`, réutilise `build_context()`/
`run_regression()`/`run_classifier()`/`run_pct()` de `tester_modele.py` sur
868 joueurs réels (>=10 matchs connus), avec des seuils de test réalistes
(offsets autour de la moyenne récente du joueur pour les stats à seuil,
seuils calés sur la vraie moyenne ligue pour FT/FG/3P%).

**1er essai biaisé, corrigé** : le même jeu de seuils fixes (50%-90%) testé
pour FT/FG/3P% donnait 12.7% de proba moyenne pour FG et FG3 contre 59.5%
pour FT -- parce que la ligue tourne à ~78% aux lancers francs mais
~47%/36% au tir/3-points (`league_avg` des modèles), tester "FG > 90%"
revient à simuler un pari quasi impossible à chaque fois. Corrigé avec des
seuils réalistes PAR stat (calés sur `league_avg`) plutôt qu'un seul jeu
partagé. Vérifié avec l'utilisateur sur un cas concret : "Curry + de 20% à
3-points" (quasi certain, career ~42%) donne 94.7% de proba réelle,
cohérent avec le palier 1 attendu.

**Résultat final** (868 joueurs, 62 280 probas simulées) : quintiles
(20/40/60/80e percentile) = 24.9% / 39.4% / 52.9% / 66.4%. Nouveaux seuils
dans `lib/ai/difficultyTiers.ts` : palier 1 >=66.4%, palier 2 >=52.9%,
palier 3 >=39.4%, palier 4 >=24.9%, palier 5 <24.9% (remplace les seuils
provisoires 80/60/40/20% posés à vue de nez au lancement de la Phase 5).
`tsc`/`eslint`/`vitest` (37/37)/`next build` (37 routes) propres, commité
et poussé.

**Discussion ouverte, pas tranchée** : pour le point 5 restant (barème du
fallback IA), l'utilisateur propose de remplacer le sélecteur de
difficulté 1-5 par un champ où le joueur tape un nombre de points libre
(borné 5-25, accord obtenu sur le plafond) -- impacte
`lib/scoring/engine.ts::scoreBet` (table fixe indexée 1-5, une valeur
libre nécessiterait une vraie colonne "points"). Discussion élargie vers
une piste plus large : un formulaire STRUCTURÉ (joueur du match via
sélecteur peuplé du vrai roster + stat + seuil) pour la catégorie
`PLAYER_PROP` uniquement, qui éliminerait par construction toute la classe
de bugs corrigée aujourd'hui (mauvais joueur, faute d'orthographe, joueur
hors match) -- le texte libre + IA resterait pour le reste (fun, combo,
hors-terrain). Ni l'un ni l'autre tranché, notés dans `GAPS_OUVERTS.md`
pour reprise ultérieure -- dernier point avant de clore officiellement la
Phase 5.
```
