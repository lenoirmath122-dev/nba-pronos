"""
Recherche d'hyperparametres partagee par tous les scripts train_*.py
(chantier "perfectionnement des modeles de probabilite", GAPS_OUVERTS.md,
repris le 01/09/2026) -- decision utilisateur : MEME recette pour tous les
modeles (RandomForestRegressor et RandomForestClassifier), validation
croisee TEMPORELLE (TimeSeriesSplit, jamais aleatoire -- meme principe
anti-fuite que temporal_split() dans chaque script) + recherche
systematique (RandomizedSearchCV) plutot que quelques configs choisies a la
main. Avant ce chantier, les 12 modeles utilisaient TOUS exactement les
memes hyperparametres fixes (n_estimators=300, max_depth=8,
min_samples_leaf=10), choisis une fois et jamais recherches.

`max_depth=None` volontairement ABSENT de l'espace de recherche : mesure
reelle sur le dataset points (117k lignes) avant de generaliser -- un arbre
sans limite de profondeur multiplie le temps d'entrainement de facon non
lineaire et incontrolee sur les plus gros datasets (joueur+periode,
730k lignes, deja ~11 min par entrainement UNIQUE) ; risque de sur-
apprentissage en prime, sans benefice mesure qui le justifie.

Usage dans un script train_*.py :
    from tuning import tune_random_forest
    model, best_params, best_score = tune_random_forest(X_train, y_train, task="regressor")
X_train/y_train DOIVENT deja etre tries par date croissante (meme
convention que temporal_split() -- TimeSeriesSplit suppose l'ordre, ne
re-trie jamais lui-meme). `model` est DEJA reentraine sur tout
X_train/y_train (refit=True, comportement par defaut de RandomizedSearchCV).
"""

import time

from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import RandomizedSearchCV, TimeSeriesSplit

# Meme espace de recherche pour TOUS les modeles (decision utilisateur :
# "meme recette pour tous"). n_estimators/max_depth/min_samples_leaf centres
# sur les valeurs fixes historiques (300/8/10) ; max_features jamais
# explore du tout avant ce chantier (par defaut sklearn = 1.0 pour un
# RandomForestRegressor, autant de features que d'exemples a chaque split --
# jamais remis en question jusqu'ici).
PARAM_DISTRIBUTIONS = {
    "n_estimators": [200, 300, 400, 500],
    "max_depth": [4, 6, 8, 10, 12, 15, 20],
    "min_samples_leaf": [5, 10, 20, 30],
    "max_features": ["sqrt", "log2", 0.5, None],
}

# Budget par defaut -- ajuste au cas par cas selon la taille du dataset
# (voir l'appel dans chaque script train_*.py) : mesure reelle sur le
# dataset points (117k lignes, 13 features) AVANT de generaliser, cf.
# JOURNAL_SESSIONS.md pour le detail des chiffres.
DEFAULT_N_ITER = 20
DEFAULT_N_SPLITS = 5

# verbose=2 (sklearn) -- imprime une ligne "[CV] END ..." par entrainement
# (pas juste par config) : demande utilisateur (01/09/2026) pour suivre
# l'avancement en direct sur les scripts a plusieurs stats (ex:
# train_stat_model.py, ~35 min PAR stat) plutot que d'attendre en silence.
SEARCH_VERBOSE = 2


def tune_random_forest(
    X_train,
    y_train,
    task: str,
    n_iter: int = DEFAULT_N_ITER,
    n_splits: int = DEFAULT_N_SPLITS,
    random_state: int = 0,
):
    """task="regressor" -> scoring=neg_mean_absolute_error (coherent avec le
    MAE deja affiche par chaque script). task="classifier" -> scoring=
    neg_log_loss (ce sont des probas consommees via predict_proba, pas des
    classes dures -- l'accuracy ne sanctionnerait pas une mauvaise
    calibration). n_jobs=1 sur l'estimateur DE BASE (jamais -1) pour laisser
    RandomizedSearchCV paralleliser les FITS entre eux (n_jobs=-1) sans
    parallelisme imbrique (qui ralentirait plutot qu'il n'accelererait)."""
    if task == "regressor":
        base_model = RandomForestRegressor(random_state=random_state, n_jobs=1)
        scoring = "neg_mean_absolute_error"
    elif task == "classifier":
        base_model = RandomForestClassifier(random_state=random_state, n_jobs=1)
        scoring = "neg_log_loss"
    else:
        raise ValueError(f"task inconnu : {task!r} (attendu 'regressor' ou 'classifier')")

    search = RandomizedSearchCV(
        base_model,
        PARAM_DISTRIBUTIONS,
        n_iter=n_iter,
        scoring=scoring,
        cv=TimeSeriesSplit(n_splits=n_splits),
        random_state=random_state,
        n_jobs=-1,
        refit=True,
        verbose=SEARCH_VERBOSE,
    )
    t0 = time.time()
    search.fit(X_train, y_train)
    elapsed = time.time() - t0

    print(
        f"\nRecherche d'hyperparametres [{task}] : {n_iter} configs x {n_splits} plis "
        f"({n_iter * n_splits} entrainements) + 1 reentrainement final -- {elapsed:.0f}s"
    )
    print(f"  Meilleurs hyperparametres : {search.best_params_}")
    print(f"  Meilleur score CV ({scoring}) : {search.best_score_:.4f}")

    return search.best_estimator_, search.best_params_, search.best_score_


def tune_on_sample_then_refit(
    X_sample,
    y_sample,
    X_full,
    y_full,
    task: str,
    n_iter: int = DEFAULT_N_ITER,
    n_splits: int = DEFAULT_N_SPLITS,
    random_state: int = 0,
):
    """Reserve aux datasets trop gros pour une recherche complete (modele
    joueur+periode, 730k lignes -- une recherche complete y prendrait des
    dizaines d'heures PAR STAT, decision utilisateur du 01/09/2026 :
    chercher sur un SOUS-ECHANTILLON temporel [les lignes les PLUS RECENTES,
    memes X_sample/y_sample DEJA tries par date, meme convention que
    temporal_split()], puis un SEUL reentrainement sur (X_full, y_full) avec
    les hyperparametres gagnants -- le modele final voit donc 100% des
    donnees, seule la PHASE DE RECHERCHE est raccourcie. Cout final identique
    a un entrainement a config fixe (pas de CV sur les donnees completes).

    Retourne le modele final (entraine sur TOUTE la donnee) + les
    hyperparametres retenus + le score de la recherche (mesure sur
    l'echantillon, pas comparable directement au score d'un
    tune_random_forest lance sur la donnee complete)."""
    _, best_params, best_score = tune_random_forest(
        X_sample, y_sample, task=task, n_iter=n_iter, n_splits=n_splits, random_state=random_state
    )

    if task == "regressor":
        model = RandomForestRegressor(random_state=random_state, n_jobs=-1, **best_params)
    elif task == "classifier":
        model = RandomForestClassifier(random_state=random_state, n_jobs=-1, **best_params)
    else:
        raise ValueError(f"task inconnu : {task!r} (attendu 'regressor' ou 'classifier')")

    t0 = time.time()
    model.fit(X_full, y_full)
    elapsed = time.time() - t0
    print(f"Reentrainement final sur {len(X_full)} lignes (hyperparametres trouves sur l'echantillon) : {elapsed:.0f}s")

    return model, best_params, best_score
