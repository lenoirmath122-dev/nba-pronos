# Projet Data NBA — Récupération, stockage et analyse

*Résumé de notre échange — à reprendre plus tard*

> ## 🔴 REPRISE ICI (état au 21/08/2026)
>
> **Phase 3 (overdispersion FT%/FG%/3P%) close — Beta-Binomial adopté sur
> FT% seulement, testé empiriquement d'abord** (§20) : résiduel de
> calibration réduit 5.4%→4.1% sur FT% (négligeable/contre-productif sur
> 3P%/FG%, pas adopté là). `train_pct_model.py`/`tester_modele.py` mis à
> jour, les 3 modèles `*_pct.joblib` réentraînés et resauvegardés, vérifié
> en conditions réelles (`tester_modele.py`). **Reste ouvert** : ~4% de
> biais résiduel sur FT% (signe qui s'inverse selon le seuil, piste
> distincte de l'overdispersion, pas encore regardée) ; pas bloquant.
>
> **Toujours en attente depuis le 20/08/2026 (pas retouché cette session)** :
> les 12 modèles socle (points/rebonds/passes/.../min/dd/td) restent
> entraînés sur le dataset à 2 saisons (56 938 lignes) alors que la base
> (`nba.db`) en contient ~2,4x plus depuis le fetch à 5 saisons. Pour en
> profiter : relancer `build_features.py` → `build_targets.py` → les 4
> `train_*.py` — décision volontairement reportée à la reprise précédente,
> toujours pas prise.
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
