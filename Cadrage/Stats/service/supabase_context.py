"""
Equivalent Supabase (sans etat) de find_player()/find_team()/build_context()
dans scripts/tester_modele.py -- utilise par le service deploye (app.py),
qui ne touche plus nba.db du tout (architecture B, §22-23 projet-data-nba.md).
Reutilise minutes_to_float()/strip_accents() telles quelles (aucune
duplication de cette logique).

Les 3 tables (stats_equipes/stats_joueurs/stats_box_scores) sont peuplees
par backfill_supabase.py (une fois) puis tenues a jour par le rafraichissement
quotidien (pas encore ecrit, voir GAPS_OUVERTS.md).
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

import joblib  # noqa: E402

from tester_modele import (  # noqa: E402
    CLASSIFIER_STATS,
    MODELS_DIR,
    PCT_STATS,
    REGRESSION_STATS,
    minutes_to_float,
    normalize_suffix,
    resolve_stat,
    run_classifier,
    run_pct,
    run_regression,
    strip_accents,
)
from build_features import CORE_MINUTES_SHARE  # noqa: E402
from train_home_win_model import BASE_FEATURE_COLS, FEATURE_COLS  # noqa: E402
from series_probability import simulate_series_with_stat  # noqa: E402


PAGE_SIZE = 1000  # limite par defaut de PostgREST (meme constante que
# service/refresh_daily.py::fetch_all_rows -- dupliquee ici plutot
# qu'importee, refresh_daily.py n'est pas copie dans l'image Cloud Run,
# cf. Dockerfile) -- toute lecture "table entiere" sans .range() se
# tronque silencieusement a 1000 lignes.


def fetch_all_rows(query_builder) -> list:
    """Recupere TOUTES les lignes en paginant avec .range() -- query_builder
    est une fonction (start, end) -> reponse PostgREST, pour composer
    .select()/.eq() avant de paginer."""
    rows: list = []
    start = 0
    while True:
        page = query_builder(start, start + PAGE_SIZE - 1).execute().data
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            return rows
        start += PAGE_SIZE


def find_player(client, query: str) -> tuple:
    # Bug reel corrige le 22/08/2026 (signale par l'utilisateur -- "Zaccharie
    # Risacher" jamais trouve malgre l'orthographe correcte en base) : sans
    # pagination, stats_joueurs (1052 lignes au 22/08/2026, > 1000) se
    # tronquait silencieusement aux 1000 premieres -- meme bug deja corrige
    # dans refresh_daily.py::known_game_ids, jamais applique ici.
    rows = fetch_all_rows(
        lambda start, end: client.table("stats_joueurs").select("player_id, first_name, family_name").range(start, end)
    )
    df = pd.DataFrame(rows)
    df["full_name"] = df["first_name"] + " " + df["family_name"]
    needle = normalize_suffix(strip_accents(query))
    matches = df[df["full_name"].apply(lambda n: needle in normalize_suffix(strip_accents(n)))]
    if matches.empty:
        raise ValueError(f"Aucun joueur trouvé pour \"{query}\" -- verifie l'orthographe.")
    if len(matches) > 1:
        options = "\n".join(f"  {r.player_id}  {r.full_name}" for r in matches.itertuples())
        raise ValueError(f"Plusieurs joueurs correspondent a \"{query}\" -- relance avec joueur_id :\n{options}")
    r = matches.iloc[0]
    return int(r.player_id), r.full_name


def find_team(client, query: str) -> tuple:
    # stats_equipes ne fait que 30 lignes aujourd'hui (largement sous 1000),
    # mais meme pagination que find_player() par coherence/prudence plutot
    # que de laisser un 2e appel non pagine a cote du 1er corrige.
    rows = fetch_all_rows(
        lambda start, end: client.table("stats_equipes").select("team_id, tricode, city, name").range(start, end)
    )
    df = pd.DataFrame(rows)
    df["full_name"] = df["city"] + " " + df["name"]
    needle = strip_accents(query)
    matches = df[
        df["tricode"].apply(lambda t: needle in strip_accents(t))
        | df["full_name"].apply(lambda n: needle in strip_accents(n))
    ]
    if matches.empty:
        raise ValueError(f"Aucune equipe trouvee pour \"{query}\".")
    if len(matches) > 1:
        options = "\n".join(f"  {r.tricode}  {r.full_name}" for r in matches.itertuples())
        raise ValueError(f"Plusieurs equipes correspondent a \"{query}\" :\n{options}")
    r = matches.iloc[0]
    return int(r.team_id), r.full_name


def build_context(client, player_id: int, opponent_id, is_home: int, rest_days: int) -> tuple:
    """Meme contrat que build_context() dans tester_modele.py (memes cles de
    contexte, meme fenetre de 10 derniers matchs REELEMENT connus) -- source
    Supabase (stats_box_scores) au lieu de nba.db local."""
    rows = (
        client.table("stats_box_scores")
        .select("game_date, minutes, pts, reb, ast, fg3m, stl, blk, plus_minus, "
                 "ftm, fta, fgm, fga, fg3a, ts_pct, usg_pct, games_played_season_avant")
        .eq("player_id", player_id)
        .order("game_date", desc=True)
        .limit(10)
        .execute()
        .data
    )
    if not rows:
        raise ValueError(f"Aucun match trouve en base pour ce joueur (player_id={player_id}).")
    recent = pd.DataFrame(rows)
    recent["game_date"] = pd.to_datetime(recent["game_date"])
    recent["minutes_f"] = recent["minutes"].apply(minutes_to_float)
    last5 = recent.head(5)

    context = {
        "is_home": is_home,
        "rest_days": rest_days,
        "is_back_to_back": int(rest_days == 1),
        "games_played_season_avant": int(recent["games_played_season_avant"].iloc[0]) + 1,
        "ts_pct_moy5": last5["ts_pct"].mean(),
        "usg_pct_moy5": last5["usg_pct"].mean(),
        "plus_minus_moy5": last5["plus_minus"].mean(),
        "matchs_manques_depuis_dernier": 0,
    }
    for stat, col in (
        ("pts", "pts"), ("reb", "reb"), ("ast", "ast"), ("fg3m", "fg3m"),
        ("stl", "stl"), ("blk", "blk"), ("min", "minutes_f"),
        ("fta", "fta"), ("fga", "fga"), ("fg3a", "fg3a"),
    ):
        context[f"{stat}_moy5"] = last5[col].mean()
        context[f"{stat}_moy10"] = recent[col].mean()

    context["ftm_sum10"], context["fta_sum10"] = recent["ftm"].sum(), recent["fta"].sum()
    context["fgm_sum10"], context["fga_sum10"] = recent["fgm"].sum(), recent["fga"].sum()
    context["fg3m_sum10"], context["fg3a_sum10"] = recent["fg3m"].sum(), recent["fg3a"].sum()

    if opponent_id is not None:
        vs_adv = (
            client.table("stats_box_scores")
            .select("pts")
            .eq("player_id", player_id)
            .eq("opponent_team_id", opponent_id)
            .execute()
            .data
        )
        pts_list = [r["pts"] for r in vs_adv if r["pts"] is not None]
        context["vs_adversaire_pts_moy"] = float(np.mean(pts_list)) if pts_list else np.nan
        context["vs_adversaire_nb_matchs"] = len(pts_list)
    else:
        context["vs_adversaire_pts_moy"] = np.nan
        context["vs_adversaire_nb_matchs"] = 0

    ecarttypes = {}
    for stat, col in (
        ("pts", "pts"), ("reb", "reb"), ("ast", "ast"), ("fg3m", "fg3m"),
        ("stl", "stl"), ("blk", "blk"), ("min", "minutes_f"),
    ):
        ecarttypes[stat] = recent[col].std()

    return context, ecarttypes, recent


def _latest_known_season(seasons_known) -> str:
    """Derniere saison REELEMENT connue en base (celle avec le plus grand
    "annee de debut" parmi seasons_known) -- utilisee comme "saison en
    cours" par defaut au lieu d'une regle purement calendaire (ex.
    current_season_label() de service/refresh_daily.py, PAS importable ici
    -- pas copie dans l'image Cloud Run, cf. Dockerfile).

    Bug reel trouve le 23/08/2026 en testant un vrai pari serie pendant
    l'intersaison : une regle calendaire ("a partir d'aout, on est deja sur
    la saison suivante") deduisait "2026-27" pour un as_of_date au 23/08 --
    une saison qui n'a pas encore commence, 0 match connu, continuite
    d'effectif incalculable (garde-fou de compute_home_win_proba() refusant
    a raison de deviner). La derniere saison CONNUE (avec de vraies donnees)
    est le contexte le plus utile independamment de la date calendaire du
    jour -- correct aussi bien en cours de saison (la derniere connue EST la
    saison en cours, deja synchronisee au jour le jour par refresh_daily.py)
    qu'en pleine intersaison (retombe sur la derniere saison terminee,
    seule option avec de vraies donnees)."""
    def start_year(s):
        return int(s.split("-")[0])

    return max(seasons_known, key=start_year)


def _prior_season(seasons_known, target_season: str):
    """Saison immediatement anterieure a target_season parmi celles connues
    -- comparaison sur l'annee de debut ("2024-25" -> 2024), pas sur l'ordre
    alphabetique (qui coinciderait ici mais serait fragile). None si aucune
    saison anterieure n'est connue (1ere saison de donnees)."""
    def start_year(s):
        return int(s.split("-")[0])

    candidates = [s for s in seasons_known if start_year(s) < start_year(target_season)]
    return max(candidates, key=start_year) if candidates else None


def _team_roster_continuity(client, team_id: int, season: str, seasons_known) -> float:
    """Equivalent Supabase de compute_roster_continuity() (build_features.py),
    reduit a une SEULE equipe et aux 2 seules saisons utiles (prealable +
    cible) -- au lieu de toute la base. Meme regle : "coeur d'effectif" =
    joueurs couvrant CORE_MINUTES_SHARE des minutes de la SAISON PRECEDENTE
    par ordre decroissant ; continuite = part des minutes de la saison EN
    COURS deja jouees par des joueurs qui en faisaient partie. NaN si pas de
    saison anterieure connue ou si l'equipe n'a pas encore joue cette saison
    (memes cas que la version originale)."""
    prior = _prior_season(seasons_known, season)
    if prior is None:
        return np.nan

    rows = fetch_all_rows(
        lambda start, end: client.table("stats_box_scores")
        .select("player_id, minutes, season")
        .eq("team_id", team_id)
        .in_("season", [prior, season])
        .range(start, end)
    )
    if not rows:
        return np.nan
    df = pd.DataFrame(rows)
    df["minutes_f"] = df["minutes"].apply(minutes_to_float)

    prior_totals = df[df["season"] == prior].groupby("player_id")["minutes_f"].sum().sort_values(ascending=False)
    if prior_totals.empty:
        return np.nan
    total_prior = prior_totals.sum()
    if total_prior <= 0:
        core = set()
    else:
        cum_share = prior_totals.cumsum() / total_prior
        cutoff = int((cum_share < CORE_MINUTES_SHARE).sum()) + 1  # inclut le joueur qui franchit le seuil
        core = set(prior_totals.index[:cutoff])

    current = df[df["season"] == season]
    if current.empty:
        return np.nan
    total_minutes = current["minutes_f"].sum()
    if total_minutes <= 0:
        return np.nan
    core_minutes = current[current["player_id"].isin(core)]["minutes_f"].sum()
    return core_minutes / total_minutes


def build_team_context(client, team_id: int, opponent_id: int, as_of_date, season: str | None = None) -> dict:
    """Les 21 features BASE_FEATURE_COLS (train_home_win_model.py) pour
    team_id, calculees EN DIRECT depuis stats_box_scores -- equivalent
    Supabase de build_team_games()/add_team_rolling_features()
    (build_features.py), sans etat precalcule (meme philosophie que
    build_context() ci-dessus pour les joueurs), reduit a UNE SEULE equipe
    par appel.

    2 requetes suffisent pour l'historique propre a l'equipe : team_id=X
    (ses propres points/ratings/pace, ET l'adversaire de chaque match, deja
    stocke ligne par ligne -- sert aussi aux confrontations directes) et
    opponent_team_id=X (les points marques par l'adversaire a chacun de ces
    matchs -- donne les points ENCAISSES par X, sans avoir besoin de
    connaitre l'identite de l'adversaire a l'avance).

    Contrairement a l'entrainement (shift(1) pour ne jamais fuiter le
    resultat du match cible dans ses propres features, necessaire puisque ce
    match EST dans les donnees d'entrainement) : aucun shift ici, tous les
    matchs recuperes sont deja joues, le match a predire n'existe pas encore
    en base.

    as_of_date : date du match a predire (str ISO ou Timestamp) -- sert a
    calculer rest_days par rapport au dernier match REELEMENT connu. season :
    "2024-25" style, deduite de la DERNIERE saison connue en base pour cette
    equipe si omise (voir _latest_known_season -- PAS une regle calendaire
    sur as_of_date, casse pendant l'intersaison reelle).
    """
    own_rows = fetch_all_rows(
        lambda start, end: client.table("stats_box_scores")
        .select("game_id, game_date, season, opponent_team_id, pts, off_rating, def_rating, net_rating, pace")
        .eq("team_id", team_id)
        .range(start, end)
    )
    if not own_rows:
        raise ValueError(f"Aucun match trouve en base pour cette equipe (team_id={team_id}).")
    own = pd.DataFrame(own_rows)
    if season is None:
        season = _latest_known_season(own["season"].unique())
    team_games = own.groupby(["game_id", "season"], as_index=False).agg(
        game_date=("game_date", "first"),
        opponent_team_id=("opponent_team_id", "first"),
        team_pts=("pts", "sum"),
        off_rating=("off_rating", "mean"),
        def_rating=("def_rating", "mean"),
        net_rating=("net_rating", "mean"),
        pace=("pace", "mean"),
    )
    team_games["game_date"] = pd.to_datetime(team_games["game_date"])

    opp_rows = fetch_all_rows(
        lambda start, end: client.table("stats_box_scores")
        .select("game_id, pts")
        .eq("opponent_team_id", team_id)
        .range(start, end)
    )
    opp_pts = pd.DataFrame(opp_rows).groupby("game_id", as_index=False)["pts"].sum().rename(columns={"pts": "opp_pts"})
    team_games = team_games.merge(opp_pts, on="game_id", how="inner")
    team_games["win"] = (team_games["team_pts"] > team_games["opp_pts"]).astype(int)
    team_games["margin"] = team_games["team_pts"] - team_games["opp_pts"]
    team_games = team_games.sort_values("game_date", ascending=False).reset_index(drop=True)

    as_of_date = pd.Timestamp(as_of_date)
    rest_days = (as_of_date - team_games["game_date"].iloc[0]).days

    last5, last10 = team_games.head(5), team_games.head(10)
    context = {
        "rest_days": rest_days,
        "is_back_to_back": int(rest_days == 1),
        "games_played_season_avant": int((team_games["season"] == season).sum()),
    }
    for stat, col in (
        ("pts_pour", "team_pts"), ("pts_contre", "opp_pts"), ("victoires_pct", "win"),
        ("off_rating", "off_rating"), ("def_rating", "def_rating"),
        ("net_rating", "net_rating"), ("pace", "pace"),
    ):
        context[f"{stat}_moy5"] = last5[col].mean()
        context[f"{stat}_moy10"] = last10[col].mean()

    h2h = team_games[team_games["opponent_team_id"] == opponent_id]
    context["confrontations_directes_nb"] = len(h2h)
    context["confrontations_directes_victoires_pct"] = h2h["win"].mean() if len(h2h) else np.nan
    context["confrontations_directes_ecart_moy"] = h2h["margin"].mean() if len(h2h) else np.nan

    seasons_known = sorted(team_games["season"].unique())
    context["continuite_effectif_saison"] = _team_roster_continuity(client, team_id, season, seasons_known)

    return context


def compute_home_win_proba(client, home_team_id: int, away_team_id: int, as_of_date, season: str | None = None) -> dict:
    """P(home_team_id gagne CE match, a domicile) -- charge home_win.joblib
    (train_home_win_model.py), construit le vecteur home_*/away_* complet en
    appelant build_team_context() une fois par equipe (l'adversaire de l'une
    est l'autre). season deduite de as_of_date si omise."""
    home_ctx = build_team_context(client, home_team_id, away_team_id, as_of_date, season=season)
    away_ctx = build_team_context(client, away_team_id, home_team_id, as_of_date, season=season)

    row = {f"home_{c}": home_ctx[c] for c in BASE_FEATURE_COLS}
    row.update({f"away_{c}": away_ctx[c] for c in BASE_FEATURE_COLS})
    X = pd.DataFrame([row])[FEATURE_COLS]

    if X.isna().any(axis=None):
        missing = X.columns[X.isna().iloc[0]].tolist()
        raise ValueError(
            f"Contexte incomplet pour predire ce match (features manquantes : {missing}) -- "
            "probablement une equipe avec trop peu d'historique connu en base (1ere saison de "
            "donnees, ou aucune confrontation/continuite calculable)."
        )

    bundle = joblib.load(MODELS_DIR / "home_win.joblib")
    proba = float(bundle["model"].predict_proba(X)[:, 1][0])
    return {"home_team_id": home_team_id, "away_team_id": away_team_id, "p_home_win": proba}


def compute_proba(client, player_id: int, stat: str, seuil, opponent_id=None, is_home: int = 1, rest_days: int = 2) -> dict:
    """Equivalent Supabase de compute_proba() (tester_modele.py) -- meme
    contrat/sortie, seule la source du contexte change (build_context()
    ci-dessus au lieu de la version SQLite)."""
    if stat not in REGRESSION_STATS and stat not in CLASSIFIER_STATS and stat not in PCT_STATS:
        raise ValueError(f"stat inconnue : {stat}")
    famille, model_file, label, raw_col_key = resolve_stat(stat)
    if famille != "classifier" and seuil is None:
        raise ValueError(f"seuil obligatoire pour la stat {stat}")

    context, ecarttypes, recent = build_context(client, player_id, opponent_id, is_home=is_home, rest_days=rest_days)
    bundle = joblib.load(MODELS_DIR / f"{model_file}.joblib")

    if famille == "regression":
        proba, detail = run_regression(bundle, context, ecarttypes, raw_col_key, seuil)
    elif famille == "classifier":
        proba, detail = run_classifier(bundle, context)
    else:
        proba, detail = run_pct(bundle, context, seuil)

    return {
        "label": label,
        "proba": proba,
        "detail": detail,
        "contexte_matchs": len(recent),
        "contexte_periode": [recent["game_date"].min().date().isoformat(), recent["game_date"].max().date().isoformat()],
        "vs_adversaire_nb_matchs": context["vs_adversaire_nb_matchs"] if opponent_id is not None else None,
        "vs_adversaire_pts_moy": (
            None if opponent_id is None or pd.isna(context["vs_adversaire_pts_moy"])
            else float(context["vs_adversaire_pts_moy"])
        ),
    }


def _compute_series_stat_proba_once(
    client, player_id: int, stat: str, seuil,
    team_a_id: int, team_b_id: int, player_team_id: int, as_of_date,
    season: str | None = None, comparison: str | None = None, best_of: int = 7,
) -> dict:
    """Pari SERIE (brique (c) du chantier, GAPS_OUVERTS.md) -- semantique
    retenue avec l'utilisateur le 23/08/2026 pour un pari serie ambigu : "au
    moins une fois sur la serie" (proba qu'un evenement se produise sur AU
    MOINS UN des matchs REELEMENT joues). Generique : wrappe n'IMPORTE
    LEQUEL des 12 modeles joueur existants via compute_proba() ci-dessus,
    sans aucune logique specifique a une stat ici -- seule la combinaison
    avec l'issue de la serie (simulate_series_with_stat(), series_
    probability.py) est nouvelle.

    team_a_id = equipe avec l'avantage du terrain sur la serie (mieux
    classee, recoit aux matchs 1/2/5/7 -- meme convention que
    series_probability.py). player_team_id doit valoir team_a_id ou
    team_b_id (l'equipe du joueur vise par le pari).

    comparison : "OVER" (defaut, compute_proba() renvoie deja P(stat >
    seuil)) ou "UNDER". IMPORTANT -- contrairement au cas MATCH (statsService.
    ts::predictOverUnder, qui se contente de 1-proba APRES coup), inverser le
    resultat final ICI serait FAUX : P(au moins un match UNDER) != 1 -
    P(au moins un match OVER) (2 evenements differents, pas complementaires
    a l'echelle de la serie). Il faut inverser la proba PAR MATCH (1-p) puis
    refaire tourner la simulation de serie avec cette proba inversee --
    c'est ce que fait ce bloc, avant l'appel a simulate_series_with_stat().
    Ignore comme predictOverUnder() pour les stats sans seuil (dd/td,
    CLASSIFIER_STATS) : comparison n'a pas de sens pour elles.

    2 appels a compute_home_win_proba() (deja fidele domicile/exterieur, cf.
    build_team_context()) + 2 appels a compute_proba() pour le JOUEUR (une
    fois avec is_home=1, une fois is_home=0, meme adversaire fixe tout au
    long de la serie) -- combines par simulate_series_with_stat(), qui fait
    l'hypothese que resultat du match et stat du joueur sont independants
    (aucune correlation modelisee entre "l'equipe gagne" et "le joueur
    performe" ce soir-la)."""
    if player_team_id not in (team_a_id, team_b_id):
        raise ValueError("player_team_id doit etre team_a_id ou team_b_id.")
    stat_team = "A" if player_team_id == team_a_id else "B"
    opponent_id = team_b_id if stat_team == "A" else team_a_id

    p_a_home = compute_home_win_proba(client, team_a_id, team_b_id, as_of_date, season=season)["p_home_win"]
    p_a_away = 1 - compute_home_win_proba(client, team_b_id, team_a_id, as_of_date, season=season)["p_home_win"]

    stat_home = compute_proba(client, player_id, stat, seuil, opponent_id=opponent_id, is_home=1)
    stat_away = compute_proba(client, player_id, stat, seuil, opponent_id=opponent_id, is_home=0)

    p_stat_home, p_stat_away = stat_home["proba"], stat_away["proba"]
    if comparison == "UNDER" and stat not in CLASSIFIER_STATS:
        p_stat_home, p_stat_away = 1 - p_stat_home, 1 - p_stat_away

    series = simulate_series_with_stat(
        p_a_home, p_a_away, p_stat_home, p_stat_away, stat_team, best_of=best_of,
    )

    return {
        "label": stat_home["label"],
        "proba": series["p_stat_at_least_once"],
        "p_a_wins_series": series["p_a_wins_series"],
        "p_b_wins_series": series["p_b_wins_series"],
        "length_distribution": series["length_distribution"],
        "proba_match_domicile": p_stat_home,
        "proba_match_exterieur": p_stat_away,
    }


# Tolerance de comparaison entre 2 calculs, en points de proba absolus.
# Recalibree le 23/08/2026 (1e-6 -> 1e-2) : un vrai cas reel (Doncic/Lakers/
# Rockets) a montre un bruit "normal" de l'ordre de 0.001-0.002 (~0.1-0.2
# point) d'un essai a l'autre -- 1000x plus large que le 1e-9/1e-12 observe
# sur le SEUL cas teste au moment du 1er calibrage (Tatum/Boston/Lakers, cf.
# CONSISTENCY_CHECK_NOTE), qui n'etait donc pas representatif. 1e-2 (1 point
# de proba) reste nettement en dessous du vrai bug deja observe (~0.014,
# 1.4 point sur p_a_wins_series) tout en tolerant ce bruit normal.
_CONSISTENCY_TOLERANCE = 1e-2

CONSISTENCY_CHECK_NOTE = """Instabilite reelle et rare trouvee en testant le 23/08/2026 (~1 fois sur
10-15 appels) : sur des entrees IDENTIQUES, _compute_series_stat_proba_once() peut renvoyer 2 resultats
differents (ex. p_a_wins_series = 0.7940 au lieu de 0.7799, ecart bien au-dela du bruit flottant normal).
Isole par elimination (feature equipe seules stables sur 10/10 ; compute_home_win_proba() seul stable
sur 8/8 ; compute_proba() joueur seul stable sur 8/8 ; SEULE la combinaison complete des 2 -- home_win.joblib
ET le modele joueur charges/utilises dans le meme process -- montre l'instabilite). Forcer n_jobs=1 sur les
modeles n'a PAS elimine le probleme (hypothese "race du pool joblib" ecartee). Cause exacte non trouvee avec
un effort raisonnable (probablement une interaction bas niveau scikit-learn/BLAS entre 2 modeles differents
dans le meme process -- pas verifiable sans le vrai conteneur Linux Cloud Run). PAS un bug introduit par ce
chantier : la meme architecture (modeles .joblib, RandomForest, n_jobs=-1 fige a l'entrainement) sert deja
en production pour les paris MATCH -- compute_series_stat_proba() est juste le 1er endroit a combiner 2
modeles differents dans un seul calcul, ce qui semble declencher le probleme plus souvent."""


def compute_series_stat_proba(*args, **kwargs) -> dict:
    """Enveloppe compute_series_stat_proba() d'une verification de coherence
    -- voir CONSISTENCY_CHECK_NOTE ci-dessus pour le POURQUOI. Recalcule
    jusqu'a 3 fois et ne renvoie un resultat QUE si au moins 2 des essais
    s'accordent (a _CONSISTENCY_TOLERANCE pres) -- mieux vaut un appel plus
    lent (et parfois 3 aller-retours Supabase au lieu de 1) qu'une probabilite
    silencieusement fausse utilisee pour auto-valider un vrai pari."""
    results = [_compute_series_stat_proba_once(*args, **kwargs) for _ in range(2)]
    if abs(results[0]["proba"] - results[1]["proba"]) <= _CONSISTENCY_TOLERANCE:
        return results[0]

    results.append(_compute_series_stat_proba_once(*args, **kwargs))
    for i in range(3):
        for j in range(i + 1, 3):
            if abs(results[i]["proba"] - results[j]["proba"]) <= _CONSISTENCY_TOLERANCE:
                return results[i]

    raise ValueError(
        "Calcul instable : 3 essais avec les memes entrees ont donne 3 probabilites differentes "
        f"({[r['proba'] for r in results]}) -- refuse de renvoyer un resultat non fiable. "
        "Voir supabase_context.CONSISTENCY_CHECK_NOTE."
    )
