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

import math
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

import joblib  # noqa: E402
from scipy.integrate import quad  # noqa: E402
from scipy.stats import betabinom, binom, norm  # noqa: E402

from tester_modele import (  # noqa: E402
    CLASSIFIER_STATS,
    MIN_SCALE,
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
from build_features import CORE_MINUTES_SHARE, TEAM_COUNTING_STATS  # noqa: E402
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
                 "ftm, fta, fgm, fga, fg3a, oreb, ts_pct, usg_pct, games_played_season_avant")
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
        "matchs_manques_depuis_dernier": 0,
    }
    # "plus_minus" ajoutee au groupe standard le 24/08/2026 (chantier
    # "petits gains groupes", GAPS_OUVERTS.md) -- avant, seul plus_minus_moy5
    # etait calcule a part (feature partagee par d'autres modeles) ;
    # plus_minus_moy10 manquait, necessaire pour le NOUVEAU modele
    # plus_minus.joblib (ses propres features, comme pts/reb/etc).
    for stat, col in (
        ("pts", "pts"), ("reb", "reb"), ("ast", "ast"), ("fg3m", "fg3m"),
        ("stl", "stl"), ("blk", "blk"), ("min", "minutes_f"),
        ("fta", "fta"), ("fga", "fga"), ("fg3a", "fg3a"), ("oreb", "oreb"),
        ("plus_minus", "plus_minus"),
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
        ("fga", "fga"), ("fg3a", "fg3a"), ("oreb", "oreb"),
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
    team_id + 4 features par stat d'equipe (reb/ast/fg3m/stl/blk, {stat}_pour/
    {stat}_contre moy5/10 -- reb ajoutee 23/08/2026 en pilote, ast/fg3m/stl/
    blk generalisees dans la foulee, meme geste -- non utilisees par
    home_win/total_points, presentes ici quand meme : cette fonction reste LA
    seule construction de contexte equipe, tout modele qui en a besoin
    (team_{stat}, total_{stat}) pioche dans le meme dict plutot que d'en
    recalculer un a part), calculees EN DIRECT
    depuis stats_box_scores -- equivalent
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
    # "reb" ajoute en 1er (23/08/2026, paris equipe piece (a) suite --
    # rebonds d'equipe), ast/fg3m/stl/blk generalises dans la foulee, MEME
    # patron que "pts" a chaque fois (memes colonnes deja dans stats_box_scores).
    own_rows = fetch_all_rows(
        lambda start, end: client.table("stats_box_scores")
        .select(
            "game_id, game_date, season, opponent_team_id, "
            f"{', '.join(TEAM_COUNTING_STATS)}, off_rating, def_rating, net_rating, pace"
        )
        .eq("team_id", team_id)
        .range(start, end)
    )
    if not own_rows:
        raise ValueError(f"Aucun match trouve en base pour cette equipe (team_id={team_id}).")
    own = pd.DataFrame(own_rows)
    if season is None:
        season = _latest_known_season(own["season"].unique())
    # Bug reel trouve le 24/08/2026 (chantier "% tir equipe") : ce .agg()
    # etait code en dur (pts/reb/ast/fg3m/stl/blk/oreb un par un) au lieu
    # d'etre genere depuis TEAM_COUNTING_STATS comme opp_totals juste en
    # dessous -- silencieusement plafonne a 7 stats, cassait meme les
    # endpoints DEJA en prod (/predict-team-stat) des que TEAM_COUNTING_STATS
    # gagnait une 8e entree (fga/fgm/fta/ftm/fg3a). Rendu dynamique pour de bon.
    agg_kwargs = {
        "game_date": ("game_date", "first"),
        "opponent_team_id": ("opponent_team_id", "first"),
        "off_rating": ("off_rating", "mean"),
        "def_rating": ("def_rating", "mean"),
        "net_rating": ("net_rating", "mean"),
        "pace": ("pace", "mean"),
    }
    agg_kwargs.update({f"team_{s}": (s, "sum") for s in TEAM_COUNTING_STATS})
    team_games = own.groupby(["game_id", "season"], as_index=False).agg(**agg_kwargs)
    team_games["game_date"] = pd.to_datetime(team_games["game_date"])

    opp_rows = fetch_all_rows(
        lambda start, end: client.table("stats_box_scores")
        .select(f"game_id, {', '.join(TEAM_COUNTING_STATS)}")
        .eq("opponent_team_id", team_id)
        .range(start, end)
    )
    opp_totals = pd.DataFrame(opp_rows).groupby("game_id", as_index=False)[TEAM_COUNTING_STATS].sum().rename(
        columns={s: f"opp_{s}" for s in TEAM_COUNTING_STATS}
    )
    team_games = team_games.merge(opp_totals, on="game_id", how="inner")
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
    stat_pairs = [("pts_pour", "team_pts"), ("pts_contre", "opp_pts"), ("victoires_pct", "win")]
    for s in TEAM_COUNTING_STATS:
        if s == "pts":
            continue
        stat_pairs += [(f"{s}_pour", f"team_{s}"), (f"{s}_contre", f"opp_{s}")]
    stat_pairs += [
        ("off_rating", "off_rating"), ("def_rating", "def_rating"),
        ("net_rating", "net_rating"), ("pace", "pace"),
    ]
    for stat, col in stat_pairs:
        context[f"{stat}_moy5"] = last5[col].mean()
        context[f"{stat}_moy10"] = last10[col].mean()

    h2h = team_games[team_games["opponent_team_id"] == opponent_id]
    context["confrontations_directes_nb"] = len(h2h)
    context["confrontations_directes_victoires_pct"] = h2h["win"].mean() if len(h2h) else np.nan
    context["confrontations_directes_ecart_moy"] = h2h["margin"].mean() if len(h2h) else np.nan

    seasons_known = sorted(team_games["season"].unique())
    context["continuite_effectif_saison"] = _team_roster_continuity(client, team_id, season, seasons_known)

    # Sommes BRUTES equipe sur les 10 derniers matchs (24/08/2026, chantier
    # "% tir equipe") -- equivalent Supabase des colonnes {col}_pour_sum10
    # (build_features.py), meme motif que build_context() joueur : necessaire
    # au retrecissement bayesien de compute_team_pct_proba(), un ratio deja
    # calcule perdrait le nombre de tentatives sous-jacent.
    for makes_col, attempts_col in (("ftm", "fta"), ("fgm", "fga"), ("fg3m", "fg3a")):
        context[f"{makes_col}_pour_sum10"] = last10[f"team_{makes_col}"].sum()
        context[f"{attempts_col}_pour_sum10"] = last10[f"team_{attempts_col}"].sum()

    return context


def _build_match_feature_row(
    client, home_team_id: int, away_team_id: int, as_of_date, season: str | None, base_cols: list[str] = BASE_FEATURE_COLS
) -> pd.DataFrame:
    """Vecteur home_*/away_* complet -- partage entre TOUS les modeles au
    niveau MATCH (home_win, total_points, total_reb, futurs modeles equipe) :
    une seule construction de contexte, jamais dupliquee par modele.
    base_cols : quelles features de build_team_context() garder (par defaut
    les 21 BASE_FEATURE_COLS, train_home_win_model.py -- total_reb.py passe
    une liste etendue avec les features rebonds en plus, cf. son propre
    fichier). season deduite de as_of_date si omise (independamment pour
    chaque equipe, cf. build_team_context())."""
    home_ctx = build_team_context(client, home_team_id, away_team_id, as_of_date, season=season)
    away_ctx = build_team_context(client, away_team_id, home_team_id, as_of_date, season=season)

    row = {f"home_{c}": home_ctx[c] for c in base_cols}
    row.update({f"away_{c}": away_ctx[c] for c in base_cols})
    feature_cols = [f"home_{c}" for c in base_cols] + [f"away_{c}" for c in base_cols]
    X = pd.DataFrame([row])[feature_cols]

    if X.isna().any(axis=None):
        missing = X.columns[X.isna().iloc[0]].tolist()
        raise ValueError(
            f"Contexte incomplet pour predire ce match (features manquantes : {missing}) -- "
            "probablement une equipe avec trop peu d'historique connu en base (1ere saison de "
            "donnees, ou aucune confrontation/continuite calculable)."
        )
    return X


def compute_home_win_proba(client, home_team_id: int, away_team_id: int, as_of_date, season: str | None = None) -> dict:
    """P(home_team_id gagne CE match, a domicile) -- charge home_win.joblib
    (train_home_win_model.py). season deduite de as_of_date si omise."""
    X = _build_match_feature_row(client, home_team_id, away_team_id, as_of_date, season, base_cols=BASE_FEATURE_COLS)
    bundle = joblib.load(MODELS_DIR / "home_win.joblib")
    proba = float(bundle["model"].predict_proba(X)[:, 1][0])
    return {"home_team_id": home_team_id, "away_team_id": away_team_id, "p_home_win": proba}


def _compute_overtime_proba_once(client, home_team_id: int, away_team_id: int, as_of_date, season: str | None = None) -> dict:
    """P(CE match va en prolongation) -- chantier "prolongation" (24/08/2026,
    GAPS_OUVERTS.md), calque de compute_home_win_proba() : meme
    _build_match_feature_row()/BASE_FEATURE_COLS, meme classifieur binaire."""
    X = _build_match_feature_row(client, home_team_id, away_team_id, as_of_date, season, base_cols=BASE_FEATURE_COLS)
    bundle = joblib.load(MODELS_DIR / "overtime.joblib")
    proba = float(bundle["model"].predict_proba(X)[:, 1][0])
    return {"home_team_id": home_team_id, "away_team_id": away_team_id, "proba": proba}


def _compute_total_timeouts_proba_once(
    client, home_team_id: int, away_team_id: int, seuil: float, comparison: str, as_of_date, season: str | None = None,
) -> dict:
    """P(temps morts combines du match [home_timeouts+away_timeouts] > seuil)
    -- etape 5 du plan de reprise post-audit (25/08/2026, GAPS_OUVERTS.md,
    chantier "evenements de match"). Calque EXACT de
    _compute_total_points_proba_once() (regression + residu normal, meme
    BASE_FEATURE_COLS, meme repli MIN_SCALE) -- "aucun temps mort pris par
    les 2 equipes" se traduit en seuil=1, comparison=UNDER cote appelant
    (P(total<1) approxime P(total=0), meme principe deja accepte pour le DNP
    roster-wide, etape 3)."""
    X = _build_match_feature_row(client, home_team_id, away_team_id, as_of_date, season)
    bundle = joblib.load(MODELS_DIR / "total_timeouts.joblib")
    pred_mean = float(bundle["model"].predict(X)[0])
    scale = max(bundle["resid_std"], 0.5)
    proba_over = 1 - norm.cdf(seuil, loc=pred_mean, scale=scale)
    proba = proba_over if comparison == "OVER" else 1 - proba_over

    return {
        "label": "Temps morts combinés du match",
        "proba": float(proba),
        "detail": f"prediction moyenne = {pred_mean:.1f} (+/- {scale:.1f}, normale)",
        "home_team_id": home_team_id,
        "away_team_id": away_team_id,
    }


def compute_total_timeouts_proba(*args, **kwargs) -> dict:
    """Enveloppe _compute_total_timeouts_proba_once() d'une verification de
    coherence -- voir CONSISTENCY_CHECK_NOTE."""
    return _compute_with_consistency_check(lambda: _compute_total_timeouts_proba_once(*args, **kwargs))


def _compute_backcourt_turnover_proba_once(client, home_team_id: int, away_team_id: int, as_of_date, season: str | None = None) -> dict:
    """P(au moins 1 retour en zone [violation de backcourt] durant CE match,
    les 2 equipes confondues) -- etape 5 du plan de reprise post-audit
    (25/08/2026, GAPS_OUVERTS.md). Calque EXACT de compute_overtime_proba()
    (classifieur binaire, meme BASE_FEATURE_COLS)."""
    X = _build_match_feature_row(client, home_team_id, away_team_id, as_of_date, season, base_cols=BASE_FEATURE_COLS)
    bundle = joblib.load(MODELS_DIR / "had_backcourt_turnover.joblib")
    proba = float(bundle["model"].predict_proba(X)[:, 1][0])
    return {"home_team_id": home_team_id, "away_team_id": away_team_id, "proba": proba}


def compute_backcourt_turnover_proba(*args, **kwargs) -> dict:
    """Enveloppe _compute_backcourt_turnover_proba_once() d'une verification
    de coherence -- voir CONSISTENCY_CHECK_NOTE."""
    return _compute_with_consistency_check(lambda: _compute_backcourt_turnover_proba_once(*args, **kwargs))


def _compute_buzzer_beater_proba_once(client, home_team_id: int, away_team_id: int, as_of_date, season: str | None = None) -> dict:
    """P(au moins 1 panier marque a <=0.3s du buzzer, n'importe quelle
    periode, les 2 equipes confondues) -- etape 6 du plan de reprise
    post-audit (25/08/2026, GAPS_OUVERTS.md, chantier "evenements
    granulaires"). Calque EXACT de _compute_backcourt_turnover_proba_once()
    (classifieur binaire, meme BASE_FEATURE_COLS) -- cible construite dans
    build_targets.py::_match_buzzer_beater_from_pbp() (seuil 0.3s calibre
    empiriquement sur les CSV locaux avant d'entrainer)."""
    X = _build_match_feature_row(client, home_team_id, away_team_id, as_of_date, season, base_cols=BASE_FEATURE_COLS)
    bundle = joblib.load(MODELS_DIR / "had_buzzer_beater.joblib")
    proba = float(bundle["model"].predict_proba(X)[:, 1][0])
    return {"home_team_id": home_team_id, "away_team_id": away_team_id, "proba": proba}


def compute_buzzer_beater_proba(*args, **kwargs) -> dict:
    """Enveloppe _compute_buzzer_beater_proba_once() d'une verification de
    coherence -- voir CONSISTENCY_CHECK_NOTE."""
    return _compute_with_consistency_check(lambda: _compute_buzzer_beater_proba_once(*args, **kwargs))


def _compute_technical_fouls_count_proba_once(
    client, scope: str, count_threshold: int, count_relation: str,
    home_team_id: int, away_team_id: int, as_of_date, season: str | None = None,
) -> dict:
    """Fautes techniques EQUIPE/MATCH, comptage EXACT (etape 5 du plan de
    reprise post-audit, 25/08/2026, GAPS_OUVERTS.md) -- "Orlando recoit
    exactement 2 fautes techniques"/"il y aura exactement 2 fautes
    techniques dans le match". Classifieur MULTI-CLASSE (0/1/2/3[+] equipe
    via team_technical_fouls.joblib -- own/opp, meme features EXACTES que
    QUARTERS_WON_COUNT ; 0/1/2/3/4[+] match via match_technical_fouls.joblib
    -- home/away symetrique, memes features que total_points), MEME patron
    EXACT que QUARTERS_WON_COUNT (_compute_period_proba_once) pour
    l'interrogation de la distribution multi-classe -- interrogee via 4
    relations (AT_LEAST/MORE_THAN/FEWER_THAN/EXACTLY) plutot que
    exact_count+OVER/UNDER (meme raison que ROSTER_COUNT, etape 3 :
    inclusif/exclusif compte vraiment sur une distribution discrete exacte,
    pas une approximation continue a epargner)."""
    if count_relation not in ("AT_LEAST", "MORE_THAN", "FEWER_THAN", "EXACTLY"):
        raise ValueError(f"count_relation inconnue : {count_relation}")

    if scope == "match":
        bundle = joblib.load(MODELS_DIR / "match_technical_fouls.joblib")
        X = _build_match_feature_row(client, home_team_id, away_team_id, as_of_date, season)[bundle["feature_cols"]]
    elif scope in ("domicile", "exterieur"):
        team_id = home_team_id if scope == "domicile" else away_team_id
        opponent_id = away_team_id if scope == "domicile" else home_team_id
        bundle = joblib.load(MODELS_DIR / "team_technical_fouls.joblib")
        row = _own_opp_row(client, team_id, opponent_id, as_of_date, season)
        X = pd.DataFrame([row])[bundle["feature_cols"]]
    else:
        raise ValueError(f"scope inconnu : {scope}")

    proba_by_class = dict(zip(bundle["model"].classes_, bundle["model"].predict_proba(X)[0]))

    if count_relation == "EXACTLY":
        proba = float(proba_by_class.get(float(count_threshold), 0.0))
    elif count_relation == "AT_LEAST":
        proba = float(sum(p for k, p in proba_by_class.items() if k >= count_threshold))
    elif count_relation == "MORE_THAN":
        proba = float(sum(p for k, p in proba_by_class.items() if k > count_threshold))
    else:
        proba = float(sum(p for k, p in proba_by_class.items() if k < count_threshold))

    return {
        "label": "Fautes techniques",
        "proba": proba,
        "detail": f"distribution multi-classe ({scope}) : {{{', '.join(f'{int(k)}: {v:.1%}' for k, v in sorted(proba_by_class.items()))}}}",
    }


def compute_technical_fouls_count_proba(*args, **kwargs) -> dict:
    """Enveloppe _compute_technical_fouls_count_proba_once() d'une
    verification de coherence -- voir CONSISTENCY_CHECK_NOTE."""
    return _compute_with_consistency_check(lambda: _compute_technical_fouls_count_proba_once(*args, **kwargs))


def compute_overtime_proba(*args, **kwargs) -> dict:
    """Enveloppe _compute_overtime_proba_once() d'une verification de
    coherence (CONSISTENCY_CHECK_NOTE) -- l'hypothese initiale "l'instabilite
    ne touche que les modeles regression+norm.cdf, pas les classifieurs purs
    comme home_win" s'est averee FAUSSE en testant : reproduite ici meme
    (1 appel sur 9 lors de la verification manuelle, proba 0.083 au lieu de
    0.052 sur le meme cas, meme ordre de grandeur que le taux "1/10-15"
    deja documente pour les autres modeles)."""
    return _compute_with_consistency_check(lambda: _compute_overtime_proba_once(*args, **kwargs))


def _compute_total_points_proba_once(
    client, home_team_id: int, away_team_id: int, seuil: float, comparison: str, as_of_date, season: str | None = None
) -> dict:
    """P(points combines du match [home_score+away_score] > seuil) -- pièce
    (a) du chantier paris equipe (GAPS_OUVERTS.md, cadre le 23/08/2026),
    1er modele EQUIPE (pas JOUEUR). Charge total_points.joblib
    (train_total_points_model.py) -- regression + residu normal, MEME
    principe que run_regression() (tester_modele.py) pour les stats joueur,
    mais sans dispersion par equipe (aucun equivalent de {stat}_ecarttype10
    calcule pour les equipes a ce jour) -- repli direct sur l'ecart-type
    global du residu (meme plancher MIN_SCALE que train_stat_model.py).

    comparison : "OVER" ou "UNDER" -- inversion simple (1-proba) SURE ici
    (contrairement a compute_series_stat_proba()) : ceci est une prediction
    a l'echelle d'UN SEUL match, pas une agregation sur une serie -- OVER et
    UNDER sont bien complementaires pour un match unique."""
    X = _build_match_feature_row(client, home_team_id, away_team_id, as_of_date, season)
    bundle = joblib.load(MODELS_DIR / "total_points.joblib")
    pred_mean = float(bundle["model"].predict(X)[0])
    scale = max(bundle["resid_std"], 0.5)
    proba_over = 1 - norm.cdf(seuil, loc=pred_mean, scale=scale)
    proba = proba_over if comparison == "OVER" else 1 - proba_over

    return {
        "label": "Points combinés du match",
        "proba": float(proba),
        "detail": f"prediction moyenne = {pred_mean:.1f} (+/- {scale:.1f}, normale)",
        "home_team_id": home_team_id,
        "away_team_id": away_team_id,
    }


def compute_total_points_proba(*args, **kwargs) -> dict:
    """Enveloppe _compute_total_points_proba_once() d'une verification de
    coherence -- voir CONSISTENCY_CHECK_NOTE (plus bas dans ce fichier) pour
    le POURQUOI (instabilite rare reproduite ici aussi, meme avec un seul
    modele -- l'hypothese initiale "seulement en combinant 2 modeles"
    s'est averee incomplete)."""
    return _compute_with_consistency_check(lambda: _compute_total_points_proba_once(*args, **kwargs))


TEAM_STAT_LABELS_FR = {
    "pts": "Points", "reb": "Rebonds", "ast": "Passes décisives", "fg3m": "3-points réussis",
    "stl": "Interceptions", "blk": "Contres", "oreb": "Rebonds offensifs",
}
# Accord genre/nombre different de TEAM_STAT_LABELS_FR (ast/stl feminins
# pluriels -> "combinées", pas "combinés") : dict a part plutot que deduire
# l'accord depuis le libelle brut.
TEAM_STAT_TOTAL_LABELS_FR = {
    "reb": "Rebonds combinés du match",
    "ast": "Passes décisives combinées du match",
    "fg3m": "3-points réussis combinés du match",
    "stl": "Interceptions combinées du match",
    "blk": "Contres combinés du match",
    "oreb": "Rebonds offensifs combinés du match",
}


def _team_stat_base_cols(stat: str) -> list[str]:
    """21 BASE_FEATURE_COLS + les 4 features {stat}_pour/{stat}_contre
    (build_team_context(), ajoutees moy5/moy10 depuis stats_box_scores) --
    MEME formule EXACTE que celle utilisee par train_total_team_stats_model.py/
    train_team_stats_model.py (pieces (a) suite, GAPS_OUVERTS.md,
    23/08/2026) : une seule definition de "quelles features comptent pour
    une stat d'equipe", jamais divergente entre entrainement et inference.
    Dedup (cas "pts", 23/08/2026) : pts_pour/contre_moy5/10 sont DEJA dans
    BASE_FEATURE_COLS (utilisees par home_win/total_points depuis le debut)
    -- les rajouter dupliquerait les colonnes."""
    extra = [f"{stat}_pour_moy5", f"{stat}_pour_moy10", f"{stat}_contre_moy5", f"{stat}_contre_moy10"]
    return BASE_FEATURE_COLS + [c for c in extra if c not in BASE_FEATURE_COLS]


def _compute_total_team_stat_proba_once(
    client, stat: str, home_team_id: int, away_team_id: int, seuil: float, comparison: str, as_of_date,
    season: str | None = None,
) -> dict:
    """P(stat combinee du match > seuil) -- forme "combinee" (symetrique,
    domicile/exterieur) d'un pari equipe (piece (a) suite, GAPS_OUVERTS.md,
    23/08/2026) -- GENERALISE a reb/ast/fg3m/stl/blk (stat = code, charge
    total_{stat}.joblib). MEME structure EXACTE que compute_total_points_proba()
    (inversion OVER/UNDER sure ici -- prediction a l'echelle d'UN match)."""
    X = _build_match_feature_row(client, home_team_id, away_team_id, as_of_date, season, base_cols=_team_stat_base_cols(stat))
    bundle = joblib.load(MODELS_DIR / f"total_{stat}.joblib")
    pred_mean = float(bundle["model"].predict(X)[0])
    scale = max(bundle["resid_std"], 0.5)
    proba_over = 1 - norm.cdf(seuil, loc=pred_mean, scale=scale)
    proba = proba_over if comparison == "OVER" else 1 - proba_over

    return {
        "label": TEAM_STAT_TOTAL_LABELS_FR.get(stat, f"{TEAM_STAT_LABELS_FR.get(stat, stat)} combinés du match"),
        "proba": float(proba),
        "detail": f"prediction moyenne = {pred_mean:.1f} (+/- {scale:.1f}, normale)",
        "home_team_id": home_team_id,
        "away_team_id": away_team_id,
    }


def compute_total_team_stat_proba(*args, **kwargs) -> dict:
    """Enveloppe _compute_total_team_stat_proba_once() d'une verification de
    coherence -- voir CONSISTENCY_CHECK_NOTE."""
    return _compute_with_consistency_check(lambda: _compute_total_team_stat_proba_once(*args, **kwargs))


def _team_stat_mean_scale(
    client, stat: str, team_id: int, opponent_id: int, is_home: bool, as_of_date, season: str | None = None,
) -> tuple[float, float]:
    """(pred_mean, scale) pour team_id sur CE match, perspective own/opp --
    coeur de _compute_team_stat_proba_once() extrait sans l'etape finale
    norm.cdf(seuil,...) (24/08/2026, chantier duel/comparaison,
    GAPS_OUVERTS.md) : reutilise par _compute_team_stat_proba_once()
    ci-dessous ET par _resolve_comparison_operand() (calcul de duel,
    n'a pas de seuil fixe -- besoin de la moyenne/dispersion brute pour
    combiner 2 predictions AVANT de comparer)."""
    own_base_cols = _team_stat_base_cols(stat)
    own_ctx = build_team_context(client, team_id, opponent_id, as_of_date, season=season)
    opp_ctx = build_team_context(client, opponent_id, team_id, as_of_date, season=season)

    row = {"own_is_home": int(is_home)}
    row.update({f"own_{c}": own_ctx[c] for c in own_base_cols})
    row.update({f"opp_{c}": opp_ctx[c] for c in own_base_cols})
    feature_cols = ["own_is_home"] + [f"own_{c}" for c in own_base_cols] + [f"opp_{c}" for c in own_base_cols]
    X = pd.DataFrame([row])[feature_cols]

    if X.isna().any(axis=None):
        missing = X.columns[X.isna().iloc[0]].tolist()
        raise ValueError(
            f"Contexte incomplet pour predire ce match (features manquantes : {missing}) -- "
            "probablement une equipe avec trop peu d'historique connu en base (1ere saison de "
            "donnees, ou aucune confrontation/continuite calculable)."
        )

    bundle = joblib.load(MODELS_DIR / f"team_{stat}.joblib")
    pred_mean = float(bundle["model"].predict(X)[0])
    scale = max(bundle["resid_std"], 0.5)
    return pred_mean, scale


def _compute_team_stat_proba_once(
    client, stat: str, team_id: int, opponent_id: int, is_home: bool, seuil: float, comparison: str, as_of_date,
    season: str | None = None,
) -> dict:
    """P(stat de team_id sur CE match > seuil) -- forme "equipe precise"
    d'un pari equipe (piece (a) suite, GAPS_OUVERTS.md, 23/08/2026) :
    perspective "own"/"opp" (PAS domicile/exterieur) -- GENERALISE a
    reb/ast/fg3m/stl/blk (stat = code, charge team_{stat}.joblib). Predit
    "combien de {stat} va prendre CETTE equipe", reutilisable qu'elle
    recoive ou se deplace, contrairement aux modeles symetriques match
    entier. is_home : contexte REEL du match vise (feature explicite
    own_is_home, pas un axe fige) -- a fournir par l'appelant, connu depuis
    matches.home_team_id/away_team_id (meme source que pour
    resolveSeriesHomeCourtTeam()/resolveMatchTeams(), cote TypeScript).
    comparison : inversion (1-proba) SURE ici -- prediction a l'echelle
    d'UN match pour UNE equipe, pas une agregation sur une serie."""
    pred_mean, scale = _team_stat_mean_scale(client, stat, team_id, opponent_id, is_home, as_of_date, season=season)
    proba_over = 1 - norm.cdf(seuil, loc=pred_mean, scale=scale)
    proba = proba_over if comparison == "OVER" else 1 - proba_over

    return {
        "label": f"{TEAM_STAT_LABELS_FR.get(stat, stat)} de l'équipe",
        "proba": float(proba),
        "detail": f"prediction moyenne = {pred_mean:.1f} (+/- {scale:.1f}, normale)",
        "team_id": team_id,
        "opponent_id": opponent_id,
    }


def compute_team_stat_proba(*args, **kwargs) -> dict:
    """Enveloppe _compute_team_stat_proba_once() d'une verification de
    coherence -- voir CONSISTENCY_CHECK_NOTE."""
    return _compute_with_consistency_check(lambda: _compute_team_stat_proba_once(*args, **kwargs))


TEAM_PCT_LABELS_FR = {"ft": "Lancers francs", "fg": "Tirs au panier", "fg3": "3-points"}
TEAM_PCT_MAKES_ATTEMPTS = {"ft": ("ftm", "fta"), "fg": ("fgm", "fga"), "fg3": ("fg3m", "fg3a")}


def _compute_team_pct_proba_once(
    client, stat: str, team_id: int, opponent_id: int, is_home: bool, seuil: float, comparison: str, as_of_date,
    season: str | None = None,
) -> dict:
    """P(pourcentage de tir [ft/fg/fg3] de team_id sur CE match > seuil) --
    chantier "% tir equipe" (24/08/2026, GAPS_OUVERTS.md). MEME formule
    EXACTE que run_pct() (tester_modele.py, cote joueur, importee ci-dessus
    mais PAS directement reutilisable ici) -- reecrite car le vecteur de
    features equipe combine own_ctx/opp_ctx prefixes (comme
    _team_stat_mean_scale() plus haut), une forme que run_pct() ne connait
    pas (contexte joueur = un seul dict plat)."""
    if stat not in TEAM_PCT_MAKES_ATTEMPTS:
        raise ValueError(f"stat de pourcentage equipe inconnue : {stat}")
    bundle = joblib.load(MODELS_DIR / f"team_{stat}_pct.joblib")
    feature_cols = bundle["attempts_feature_cols"]
    makes_col, attempts_col = TEAM_PCT_MAKES_ATTEMPTS[stat]

    own_ctx = build_team_context(client, team_id, opponent_id, as_of_date, season=season)
    opp_ctx = build_team_context(client, opponent_id, team_id, as_of_date, season=season)

    row = {"own_is_home": int(is_home)}
    row.update({f"own_{c}": own_ctx[c] for c in BASE_FEATURE_COLS})
    row.update({f"opp_{c}": opp_ctx[c] for c in BASE_FEATURE_COLS})
    row[f"{attempts_col}_pour_moy5"] = own_ctx[f"{attempts_col}_pour_moy5"]
    row[f"{attempts_col}_pour_moy10"] = own_ctx[f"{attempts_col}_pour_moy10"]
    X = pd.DataFrame([row])[feature_cols]
    if X.isna().any(axis=None):
        missing = X.columns[X.isna().iloc[0]].tolist()
        raise ValueError(f"Contexte incomplet pour team_id={team_id} (colonnes manquantes : {missing}).")

    n_hat = max(round(float(bundle["attempts_model"].predict(X)[0])), 1)
    k = bundle["shrinkage_k"]
    league_avg = bundle["league_avg"]
    makes_sum = own_ctx[f"{makes_col}_pour_sum10"]
    attempts_sum = own_ctx[f"{attempts_col}_pour_sum10"]
    min_makes = math.floor(seuil * n_hat) + 1

    if bundle.get("distribution") == "beta_binomial":
        alpha_post = k * league_avg + makes_sum
        beta_post = k * (1 - league_avg) + (attempts_sum - makes_sum)
        proba_over = 1 - betabinom.cdf(min_makes - 1, n_hat, alpha_post, beta_post)
        p_hat = alpha_post / (alpha_post + beta_post)
        detail = (f"tentatives predites = {n_hat} | taux estime = {p_hat:.1%} (ligue: {league_avg:.1%}) "
                  f"[Beta-Binomial, incertitude sur le taux gardee]")
    else:
        p_hat = (makes_sum + k * league_avg) / (attempts_sum + k)
        proba_over = 1 - binom.cdf(min_makes - 1, n_hat, p_hat)
        detail = f"tentatives predites = {n_hat} | taux estime = {p_hat:.1%} (ligue: {league_avg:.1%})"

    # comparison : inversion (1-proba) SURE ici -- meme raison que
    # _compute_team_stat_proba_once (prediction a l'echelle d'UN match pour
    # UNE equipe, pas une agregation sur une serie).
    proba = proba_over if comparison == "OVER" else 1 - proba_over

    return {
        "label": f"{TEAM_PCT_LABELS_FR.get(stat, stat)} de l'équipe",
        "proba": float(proba),
        "detail": detail,
        "team_id": team_id,
        "opponent_id": opponent_id,
    }


def compute_team_pct_proba(*args, **kwargs) -> dict:
    """Enveloppe _compute_team_pct_proba_once() d'une verification de
    coherence -- voir CONSISTENCY_CHECK_NOTE (instabilite deja reproduite sur
    un classifieur pur, overtime -- appliquee par defaut ici aussi, pas
    supposee absente)."""
    return _compute_with_consistency_check(lambda: _compute_team_pct_proba_once(*args, **kwargs))


PERIOD_CODES = ("Q1", "Q2", "Q3", "Q4", "H1", "H2")


def _add_period_one_hot(row: dict, period: str) -> dict:
    for p in PERIOD_CODES:
        row[f"period_{p}"] = 1 if p == period else 0
    return row


def _own_opp_row(client, team_id: int, opponent_id: int, as_of_date, season: str | None) -> dict:
    own_ctx = build_team_context(client, team_id, opponent_id, as_of_date, season=season)
    opp_ctx = build_team_context(client, opponent_id, team_id, as_of_date, season=season)
    row = {f"own_{c}": own_ctx[c] for c in BASE_FEATURE_COLS}
    row.update({f"opp_{c}": opp_ctx[c] for c in BASE_FEATURE_COLS})
    return row


def _compute_period_proba_once(
    client, outcome_kind: str, period: str | None, team_id: int | None, opponent_id: int | None,
    home_team_id: int, away_team_id: int, exact_count: bool | None, seuil: float | None, comparison: str | None,
    as_of_date, season: str | None = None,
) -> dict:
    """Chantier "pari periode" equipe (24/08/2026, GAPS_OUVERTS.md) -- 6
    outcome_kind, un modele .joblib dedie par famille (train_period_model.py) :
    QUARTERS_WON_COUNT/LEADS_HALF_RESULT = classifieurs multi-classes (pas de
    notion de periode unique, LEADS_HALF_RESULT = cible JOINTE entrainee
    DIRECTEMENT, pas composee via independance). QUARTER_WINNER/HALF_WINNER =
    classifieur binaire pooled par periode (one-hot). POINT_SHARE_PCT =
    regression + norm.cdf, pooled par periode. MARGIN/TOTAL_POINTS =
    regression + norm.cdf, perspective DOMICILE/EXTERIEUR symetrique (pas
    own/opp -- aucune equipe visee), pooled par periode."""
    if outcome_kind == "QUARTERS_WON_COUNT":
        if team_id is None or opponent_id is None or seuil is None:
            raise ValueError("team_id/opponent_id/seuil obligatoires pour QUARTERS_WON_COUNT.")
        bundle = joblib.load(MODELS_DIR / "period_quarters_won_count.joblib")
        row = _own_opp_row(client, team_id, opponent_id, as_of_date, season)
        X = pd.DataFrame([row])[bundle["feature_cols"]]
        proba_by_class = dict(zip(bundle["model"].classes_, bundle["model"].predict_proba(X)[0]))
        if exact_count:
            proba = float(proba_by_class.get(float(seuil), 0.0))
        elif comparison == "UNDER":
            proba = float(sum(p for k, p in proba_by_class.items() if k < seuil))
        else:
            proba = float(sum(p for k, p in proba_by_class.items() if k > seuil))
        return {
            "label": "Nombre de quarts-temps remportés",
            "proba": proba,
            "detail": f"distribution multi-classe : {{{', '.join(f'{int(k)}: {v:.1%}' for k, v in sorted(proba_by_class.items()))}}}",
        }

    if outcome_kind == "LEADS_HALF_RESULT":
        if team_id is None or opponent_id is None or comparison is None:
            raise ValueError("team_id/opponent_id/comparison obligatoires pour LEADS_HALF_RESULT.")
        bundle = joblib.load(MODELS_DIR / "period_leads_half_result.joblib")
        row = _own_opp_row(client, team_id, opponent_id, as_of_date, season)
        X = pd.DataFrame([row])[bundle["feature_cols"]]
        proba_by_class = dict(zip(bundle["model"].classes_, bundle["model"].predict_proba(X)[0]))
        target_class = "LOSES" if comparison == "UNDER" else "WINS"
        proba = float(proba_by_class.get(target_class, 0.0))
        return {
            "label": "Mène à la mi-temps puis " + ("perd" if comparison == "UNDER" else "gagne"),
            "proba": proba,
            "detail": f"distribution 3 classes : {{{', '.join(f'{k}: {v:.1%}' for k, v in proba_by_class.items())}}}",
        }

    if outcome_kind in ("QUARTER_WINNER", "HALF_WINNER"):
        if team_id is None or opponent_id is None or period is None:
            raise ValueError("team_id/opponent_id/period obligatoires pour QUARTER_WINNER/HALF_WINNER.")
        bundle = joblib.load(MODELS_DIR / "period_quarter_winner.joblib")
        row = _add_period_one_hot(_own_opp_row(client, team_id, opponent_id, as_of_date, season), period)
        X = pd.DataFrame([row])[bundle["feature_cols"]]
        proba = float(bundle["model"].predict_proba(X)[0][1])
        return {"label": f"Remporte {period}", "proba": proba, "detail": "classifieur binaire"}

    if outcome_kind == "POINT_SHARE_PCT":
        if team_id is None or opponent_id is None or period is None or seuil is None or comparison is None:
            raise ValueError("team_id/opponent_id/period/seuil/comparison obligatoires pour POINT_SHARE_PCT.")
        bundle = joblib.load(MODELS_DIR / "period_point_share.joblib")
        row = _add_period_one_hot(_own_opp_row(client, team_id, opponent_id, as_of_date, season), period)
        X = pd.DataFrame([row])[bundle["feature_cols"]]
        pred_mean = float(bundle["model"].predict(X)[0])
        scale = max(bundle["resid_std"], 0.01)
        proba_over = 1 - norm.cdf(seuil, loc=pred_mean, scale=scale)
        proba = proba_over if comparison == "OVER" else 1 - proba_over
        return {
            "label": "Part des points totaux marqués sur cette période",
            "proba": float(proba),
            "detail": f"prédiction moyenne = {pred_mean:.1%} (+/- {scale:.1%}, normale)",
        }

    if outcome_kind in ("MARGIN", "TOTAL_POINTS"):
        if period is None or seuil is None or comparison is None:
            raise ValueError("period/seuil/comparison obligatoires pour MARGIN/TOTAL_POINTS.")
        model_name = "period_margin" if outcome_kind == "MARGIN" else "period_total_points"
        bundle = joblib.load(MODELS_DIR / f"{model_name}.joblib")
        base_row = _build_match_feature_row(client, home_team_id, away_team_id, as_of_date, season).iloc[0].to_dict()
        row = _add_period_one_hot(base_row, period)
        X = pd.DataFrame([row])[bundle["feature_cols"]]
        pred_mean = float(bundle["model"].predict(X)[0])
        scale = max(bundle["resid_std"], 0.5)
        proba_over = 1 - norm.cdf(seuil, loc=pred_mean, scale=scale)
        proba = proba_over if comparison == "OVER" else 1 - proba_over
        return {
            "label": "Écart cumulé" if outcome_kind == "MARGIN" else "Total combiné sur la période",
            "proba": float(proba),
            "detail": f"prédiction moyenne = {pred_mean:.1f} (+/- {scale:.1f}, normale)",
        }

    raise ValueError(f"outcome_kind inconnu : {outcome_kind}")


def compute_period_proba(*args, **kwargs) -> dict:
    """Enveloppe _compute_period_proba_once() d'une verification de
    coherence -- voir CONSISTENCY_CHECK_NOTE (instabilite deja reproduite sur
    des classifieurs ET des regressions .joblib) -- appliquee par defaut ici
    aussi, pas supposee absente."""
    return _compute_with_consistency_check(lambda: _compute_period_proba_once(*args, **kwargs))


# Part de la stat pleine partie attribuee a chaque periode -- convention v1
# UNIFORME (aucune donnee empirique de repartition par joueur/periode encore
# disponible : le backfill stats_box_scores_by_period tourne en tache de fond
# au moment ou ceci est ecrit, 24/08/2026, GAPS_OUVERTS.md). A remplacer par
# un vrai modele entraine (train_player_period_model.py) une fois le backfill
# termine -- cette fonction restera l'implementation tant que ce modele
# n'existe pas.
_PLAYER_PERIOD_SHARE = {"Q1": 0.25, "Q2": 0.25, "Q3": 0.25, "Q4": 0.25, "H1": 0.5, "H2": 0.5}


def _compute_player_period_proba_once(
    client, player_id: int, stat: str, period: str, home_team_id: int, away_team_id: int,
    seuil, comparison: str | None, rest_days: int = 2,
) -> dict:
    """Pari joueur+periode (24/08/2026, GAPS_OUVERTS.md) -- ex. "3 contres
    en 1ere mi-temps pour Wembanyama". v1 APPROXIMATION (pas encore de
    modele entraine sur des donnees par periode -- le backfill tourne en
    tache de fond) : reutilise _player_stat_mean_scale() (moyenne/dispersion
    pleine partie, meme fonction que le chantier duel) puis applique une
    part fixe de periode (_PLAYER_PERIOD_SHARE) a la moyenne ET a la
    dispersion (loi de Poisson -- variance = moyenne, donc pour une fraction
    p du volume total, scale_periode = scale_pleine_partie * sqrt(p), meme
    principe que le decoupage temps/volume deja accepte ailleurs dans ce
    projet). Restreint a REGRESSION_STATS (meme limite que
    _player_stat_mean_scale, dd/td/ft/fg/fg3 hors perimetre -- rejette avec
    ValueError, capte cote TS par markNotCalculable(), jamais une reponse
    fausse).

    home_team_id/away_team_id : les 2 VRAIES equipes du match vise -- l'appelant
    TS ne resout pas is_home/adversaire lui-meme pour ce type de pari
    (contrairement a bet_subject=PLAYER classique), donc c'est fait ici,
    meme geste que _resolve_weighted_operand() (chantier duel/combo)."""
    if period not in _PLAYER_PERIOD_SHARE:
        raise ValueError(f"period inconnue pour un pari joueur+periode : {period}")
    if stat not in REGRESSION_STATS:
        raise ValueError(
            f"stat non supportee pour un pari joueur+periode : {stat} (seules les stats comptees le sont : "
            f"{sorted(REGRESSION_STATS)})"
        )
    if seuil is None or comparison is None:
        raise ValueError("seuil/comparison obligatoires pour un pari joueur+periode.")

    player_team_id = _player_current_team_id(client, player_id)
    if player_team_id not in (home_team_id, away_team_id):
        raise ValueError(f"le joueur (player_id={player_id}) ne joue pour aucune des 2 equipes de ce match.")
    is_home = 1 if player_team_id == home_team_id else 0
    opponent_id = away_team_id if is_home else home_team_id

    _, _, label = REGRESSION_STATS[stat]
    pred_mean, scale = _player_stat_mean_scale(
        client, player_id, stat, opponent_id=opponent_id, is_home=is_home, rest_days=rest_days,
    )
    share = _PLAYER_PERIOD_SHARE[period]
    period_mean = pred_mean * share
    period_scale = max(scale * math.sqrt(share), MIN_SCALE)

    proba_over = 1 - norm.cdf(seuil, loc=period_mean, scale=period_scale)
    proba = proba_over if comparison == "OVER" else 1 - proba_over
    return {
        "label": label,
        "proba": float(proba),
        "detail": (
            f"prediction moyenne (periode) = {period_mean:.1f} (+/- {period_scale:.1f}, normale) -- "
            f"approximation v1 : part fixe de {share:.0%} de la moyenne pleine partie {pred_mean:.1f}, "
            "pas encore de modele entraine sur donnees par periode"
        ),
    }


def compute_player_period_proba(*args, **kwargs) -> dict:
    """Enveloppe _compute_player_period_proba_once() d'une verification de
    coherence, meme patron que compute_period_proba()."""
    return _compute_with_consistency_check(lambda: _compute_player_period_proba_once(*args, **kwargs))


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


def _player_stat_mean_scale(
    client, player_id: int, stat: str, opponent_id=None, is_home: int = 1, rest_days: int = 2,
) -> tuple[float, float]:
    """(pred_mean, scale) pour un joueur, SANS seuil -- coeur de
    compute_proba() (regression uniquement) extrait pour le chantier
    duel/comparaison (24/08/2026, GAPS_OUVERTS.md) : un duel compare 2
    predictions AVANT de connaitre un seuil (P(A>B), pas P(A>seuil)),
    besoin de la moyenne/dispersion brute plutot que d'une proba deja
    calculee contre un seuil fixe.

    Limite volontaire : REGRESSION_STATS uniquement (pts/reb/ast/fg3m/stl/
    blk/min/fga/fg3a/oreb) -- dd/td (CLASSIFIER_STATS, pas de moyenne
    numerique, proba directe) et ft/fg/fg3 (PCT_STATS, mecanisme
    Beta-Binomial different, difference de 2 taux pas modelisee ici) ne
    font pas partie des exemples reels de duel fournis (types_de_paris_
    playoffs_2026.md) -- pas construit avant d'en avoir besoin.

    Poisson (fg3m/stl/blk/oreb) : variance = moyenne, donc scale =
    sqrt(moyenne) -- approximation normale de la difference en aval
    (_compute_comparison_proba_once), pas la vraie loi de Skellam (choix
    assume avec l'utilisateur le 24/08/2026, coherent avec les autres
    simplifications deja acceptees dans ce projet -- UNDER = 1-OVER,
    independance des 2 cotes d'un duel, etc)."""
    if stat not in REGRESSION_STATS:
        raise ValueError(
            f"stat non supportee pour un duel : {stat} (seules les stats comptees le sont : "
            f"{sorted(REGRESSION_STATS)})"
        )
    model_file, raw_col_key, _ = REGRESSION_STATS[stat]
    context, ecarttypes, _ = build_context(client, player_id, opponent_id, is_home=is_home, rest_days=rest_days)
    bundle = joblib.load(MODELS_DIR / f"{model_file}.joblib")
    X = pd.DataFrame([context])[bundle["feature_cols"]]
    pred_mean = float(bundle["model"].predict(X)[0])

    if bundle["distribution"] == "poisson":
        scale = max(math.sqrt(max(pred_mean, 0.0)), MIN_SCALE)
    else:
        ect = ecarttypes.get(raw_col_key)
        scale = max(ect if pd.notna(ect) else bundle["resid_std"], MIN_SCALE)
    return pred_mean, scale


def _player_current_team_id(client, player_id: int) -> int:
    """Equipe NBA reelle actuelle d'un joueur -- team_id de sa ligne
    stats_box_scores la plus recente. Necessaire pour un duel : deduire
    is_home (feature reelle des modeles joueur, cf. SHARED_COLS dans
    train_stat_model.py) exige de savoir de quel cote du match (domicile/
    exterieur) ce joueur precis se trouve, information que l'appelant ne
    connait pas forcement a l'avance (contrairement a un pari PLAYER
    simple, ou player_team est deja resolu par l'IA)."""
    rows = (
        client.table("stats_box_scores")
        .select("team_id, game_date")
        .eq("player_id", player_id)
        .order("game_date", desc=True)
        .limit(1)
        .execute()
        .data
    )
    if not rows or rows[0].get("team_id") is None:
        raise ValueError(f"Impossible de determiner l'equipe actuelle du joueur (player_id={player_id}).")
    return int(rows[0]["team_id"])


def _team_starters(client, team_id: int, as_of_date, n_recent_games: int = 10) -> list[int]:
    """5 titulaires "typiques" d'une equipe (chantier "5 majeur/banc",
    24/08/2026, GAPS_OUVERTS.md) -- aucune confirmation officielle de
    composition n'est disponible avant le match dans ce projet (pas de
    source temps reel), approxime par la frequence d'apparition en
    position non vide (colonne stats_box_scores.position, "F"/"C"/"G" =
    titulaire, "" = remplaçant -- deja capturee par BoxScoreTraditionalV3,
    juste jamais retenue jusqu'ici) sur les n_recent_games derniers matchs
    de cette equipe avant as_of_date. Les 5 PLUS FREQUENTS, pas les 5 plus
    recents seuls -- resiste a une sortie/blessure ponctuelle d'un match."""
    rows = (
        client.table("stats_box_scores")
        .select("player_id, position, game_date")
        .eq("team_id", team_id)
        .lt("game_date", str(as_of_date))
        .neq("position", "")
        .order("game_date", desc=True)
        .limit(n_recent_games * 5)
        .execute()
        .data
    )
    counts = Counter(r["player_id"] for r in rows if r.get("position"))
    starters = [pid for pid, _ in counts.most_common(5)]
    if len(starters) < 5:
        raise ValueError(f"Moins de 5 titulaires distincts trouves recemment pour l'equipe (team_id={team_id}).")
    return starters


def _team_rotation(client, team_id: int, as_of_date, n_recent_games: int = 15, top_n: int = 15) -> list[int]:
    """Bassin ELARGI d'une equipe (chantier "comptage roster-wide", etape 3
    du plan de reprise post-audit, 25/08/2026, GAPS_OUVERTS.md) -- generalise
    _team_starters() ci-dessus (5 titulaires seulement) a "tous les joueurs
    qui jouent regulierement", necessaire pour des paris comme "au moins 8
    joueurs marquent 11+ points" ou le nombre de joueurs utilises. AUCUN
    filtre position (contrairement aux titulaires) : classe simplement par
    frequence d'apparition en boxscore sur les n_recent_games derniers
    matchs -- stats_box_scores ne contient QUE des lignes "a joue" (les DNP
    sont filtres a l'ingestion, cf. refresh_daily.py/load_to_sqlite.py), donc
    la frequence d'apparition EST deja un proxy direct du temps de jeu
    habituel. Plafonne a top_n (15, taille type d'un roster actif NBA) --
    au-dela, un joueur apparait trop rarement pour qu'une proba individuelle
    fiable en soit tiree de toute facon.

    Limite volontaire assumee, meme esprit que _team_starters() : aucune
    confirmation officielle de qui sera sur la feuille de match ce soir-la
    (pas de source temps reel dans ce projet) -- un joueur blesse/en
    load-management la veille du calcul mais absent depuis longtemps de ce
    classement (donc PAS dans le bassin) est simplement exclu comme s'il
    n'existait pas, plutot que force a une proba de DNP artificiellement
    haute."""
    rows = (
        client.table("stats_box_scores")
        .select("player_id, game_date")
        .eq("team_id", team_id)
        .lt("game_date", str(as_of_date))
        .order("game_date", desc=True)
        .limit(n_recent_games * 15)
        .execute()
        .data
    )
    counts = Counter(r["player_id"] for r in rows)
    roster = [pid for pid, _ in counts.most_common(top_n)]
    if not roster:
        raise ValueError(f"Aucun joueur recent trouve pour l'equipe (team_id={team_id}).")
    return roster


def _resolve_weighted_operand(
    client, kind: str, players: list[str], team_side: str | None, stats: list[str],
    home_team_id: int, away_team_id: int, as_of_date, season: str | None = None,
) -> tuple[float, float, dict]:
    """Somme de moyennes + combinaison des variances (INDEPENDANCE assumee)
    sur UN OU PLUSIEURS joueurs ET/OU UNE OU PLUSIEURS stats -- generalise
    _resolve_comparison_operand() (chantier duel, 24/08/2026) au cas
    MULTI-STATS (24/08/2026, chantier combo, GAPS_OUVERTS.md -- ex. PRA :
    "Wembanyama 25+ points, 12+ rebonds ET 8+ passes cumules" = 1 joueur, 3
    stats sommees) en plus du multi-joueurs deja gere (ex. "Castle+Harper
    > 40 points cumules" = 2 joueurs, 1 stat). Meme geste dans les 2 cas :
    additionner les moyennes de chaque (joueur, stat), combiner les
    variances -- pas de distinction de code entre "1 vs plusieurs".

    kind="TEAM" : team_side ("domicile"/"exterieur"), players ignore.
    kind="PLAYER" : players (1+ noms), team_side ignore.

    home_team_id/away_team_id : les 2 VRAIES equipes du match vise (deja
    resolues cote appelant) -- necessaires pour deduire le contexte
    domicile/exterieur de chaque operande (equipe ou joueur)."""
    if kind == "TEAM":
        is_home = team_side == "domicile"
        team_id = home_team_id if is_home else away_team_id
        opponent_id = away_team_id if is_home else home_team_id
        means, variances = [], []
        for stat in stats:
            mean, scale = _team_stat_mean_scale(client, stat, team_id, opponent_id, is_home, as_of_date, season=season)
            means.append(mean)
            variances.append(scale ** 2)
        return sum(means), math.sqrt(sum(variances)), {"team_id": team_id}

    means, variances, player_ids = [], [], []
    for name in players:
        player_id, _ = find_player(client, name)
        player_team_id = _player_current_team_id(client, player_id)
        if player_team_id not in (home_team_id, away_team_id):
            raise ValueError(f"\"{name}\" ne joue pour aucune des 2 equipes de ce match.")
        is_home = 1 if player_team_id == home_team_id else 0
        opponent_id = away_team_id if is_home else home_team_id
        for stat in stats:
            mean, scale = _player_stat_mean_scale(client, player_id, stat, opponent_id=opponent_id, is_home=is_home)
            means.append(mean)
            variances.append(scale ** 2)
        player_ids.append(player_id)
    return sum(means), math.sqrt(sum(variances)), {"player_ids": player_ids}


def _resolve_comparison_operand(
    client, operand: dict, home_team_id: int, away_team_id: int, as_of_date, season: str | None = None,
) -> tuple[float, float, dict]:
    """Un cote d'un duel ("gauche" ou "droite") -- soit une equipe
    (kind=TEAM, {"equipe": "domicile"|"exterieur", "stat": ...}), soit une
    liste d'UN OU PLUSIEURS joueurs de MEME stat sommes (kind=PLAYER,
    {"joueurs": [...], "stat": ...}). Fine enveloppe de
    _resolve_weighted_operand() (cas particulier : UNE seule stat) --
    generalise au multi-stats pour le chantier combo, cf. sa docstring."""
    if operand["kind"] == "TEAM":
        return _resolve_weighted_operand(
            client, "TEAM", [], operand["equipe"], [operand["stat"]], home_team_id, away_team_id, as_of_date, season,
        )
    return _resolve_weighted_operand(
        client, "PLAYER", operand["joueurs"], None, [operand["stat"]], home_team_id, away_team_id, as_of_date, season,
    )


def _compute_comparison_proba_once(
    client, left: dict, right: dict, relation: str, multiplier: float, threshold: float | None,
    home_team_id: int, away_team_id: int, as_of_date, season: str | None = None,
) -> dict:
    """Pari DUEL/COMPARAISON (24/08/2026, GAPS_OUVERTS.md) -- P(gauche >
    multiplier * droite) [relation="GT"], P(|gauche - droite| < threshold)
    [relation="DIFF_LT"], ou P(gauche > threshold OU droite > threshold)
    [relation="OR", ajoute le 24/08/2026, chantier "petits gains groupes" --
    cas "Hauser OU Pritchard reussit au moins 3 paniers a 3 points", CHAQUE
    cote compare a un MEME seuil fixe plutot qu'a l'autre cote]. Combine 2
    predictions (moyenne, dispersion) resolues independamment via
    _resolve_comparison_operand() par une approximation NORMALE de la
    difference (gauche - k*droite ~ Normale, moyenne = moyG - k*moyD,
    ecart-type = sqrt(scaleG^2 + (k*scaleD)^2)) -- hypothese d'INDEPENDANCE
    entre les 2 cotes (aucune correlation modelisee, ex. un match a rythme
    eleve qui booste les 2 cotes a la fois) et approximation normale meme
    pour les stats Poisson (assumees avec l'utilisateur le 24/08/2026, cf.
    _player_stat_mean_scale). OR reutilise la MEME hypothese d'independance
    pour combiner les 2 probas individuelles (P(A union B) = P(A)+P(B)-
    P(A)*P(B))."""
    mean_l, scale_l, meta_l = _resolve_comparison_operand(client, left, home_team_id, away_team_id, as_of_date, season)
    mean_r, scale_r, meta_r = _resolve_comparison_operand(client, right, home_team_id, away_team_id, as_of_date, season)

    if relation == "GT":
        diff_mean = mean_l - multiplier * mean_r
        diff_scale = max(math.sqrt(scale_l ** 2 + (multiplier * scale_r) ** 2), MIN_SCALE)
        proba = 1 - norm.cdf(0, loc=diff_mean, scale=diff_scale)
    elif relation == "DIFF_LT":
        if threshold is None:
            raise ValueError("threshold obligatoire pour la relation DIFF_LT.")
        diff_mean = mean_l - mean_r
        diff_scale = max(math.sqrt(scale_l ** 2 + scale_r ** 2), MIN_SCALE)
        proba = float(norm.cdf(threshold, loc=diff_mean, scale=diff_scale) - norm.cdf(-threshold, loc=diff_mean, scale=diff_scale))
    else:  # "OR"
        if threshold is None:
            raise ValueError("threshold obligatoire pour la relation OR.")
        proba_l = 1 - norm.cdf(threshold, loc=mean_l, scale=max(scale_l, MIN_SCALE))
        proba_r = 1 - norm.cdf(threshold, loc=mean_r, scale=max(scale_r, MIN_SCALE))
        proba = proba_l + proba_r - proba_l * proba_r

    return {
        "proba": float(proba),
        "detail": (
            f"gauche : moyenne={mean_l:.1f} (+/-{scale_l:.1f}) | droite : moyenne={mean_r:.1f} (+/-{scale_r:.1f})"
        ),
        "left_meta": meta_l,
        "right_meta": meta_r,
    }


def compute_comparison_proba(*args, **kwargs) -> dict:
    """Enveloppe _compute_comparison_proba_once() d'une verification de
    coherence -- voir CONSISTENCY_CHECK_NOTE."""
    return _compute_with_consistency_check(lambda: _compute_comparison_proba_once(*args, **kwargs))


def _condition_proba(
    client, condition: dict, home_team_id: int, away_team_id: int, as_of_date, season: str | None = None,
) -> tuple[float, dict]:
    """P(1 condition d'un pari COMBO) + metadonnees pour stockage
    (24/08/2026, GAPS_OUVERTS.md, chantier combo). condition :
    {"kind": "PLAYER"|"TEAM", "joueurs": [...], "equipe":
    "domicile"|"exterieur", "stats": [...], "seuil": float|None,
    "comparison": "OVER"|"UNDER"}.

    2 chemins selon le nombre d'entites/stats impliquees :
    - SIMPLE (1 entite, 1 stat) : reutilise TEL QUEL compute_proba()/
      _compute_team_stat_proba_once() -- couverture complete (regression,
      classifier dd/td, pourcentage ft/fg/fg3), aucune restriction, aucun
      nouveau code de calcul.
    - SOMME (plusieurs entites et/ou plusieurs stats, ex. PRA "25pts+
      12reb+8pas" ou cumul multi-joueurs "Castle+Harper>40pts") :
      _resolve_weighted_operand() (moyenne/variance combinees, meme
      mecanisme que le chantier duel) + norm.cdf -- restreint aux stats
      COMPTEES (REGRESSION_STATS cote joueur) : pas de moyenne pour un
      pourcentage/classifieur."""
    kind = condition["kind"]
    stats = condition["stats"]
    seuil = condition.get("seuil")
    comparison = condition["comparison"]
    players = condition.get("joueurs") or []

    is_simple = (kind == "TEAM" and len(stats) == 1) or (kind == "PLAYER" and len(players) == 1 and len(stats) == 1)

    if is_simple:
        stat = stats[0]
        if kind == "TEAM":
            is_home = condition["equipe"] == "domicile"
            team_id = home_team_id if is_home else away_team_id
            opponent_id = away_team_id if is_home else home_team_id
            result = _compute_team_stat_proba_once(
                client, stat, team_id, opponent_id, is_home, seuil, comparison, as_of_date, season=season,
            )
            return result["proba"], {"kind": "TEAM", "team_id": team_id, "stats": stats}

        name = players[0]
        player_id, _ = find_player(client, name)
        player_team_id = _player_current_team_id(client, player_id)
        if player_team_id not in (home_team_id, away_team_id):
            raise ValueError(f"\"{name}\" ne joue pour aucune des 2 equipes de ce match.")
        is_home = 1 if player_team_id == home_team_id else 0
        opponent_id = away_team_id if is_home else home_team_id
        result = compute_proba(client, player_id, stat, seuil, opponent_id=opponent_id, is_home=is_home)
        proba = result["proba"]
        if comparison == "UNDER" and stat not in CLASSIFIER_STATS:
            proba = 1 - proba
        return proba, {"kind": "PLAYER", "player_ids": [player_id], "stats": stats}

    # Cas SOMME -- plusieurs entites et/ou plusieurs stats.
    for s in stats:
        if s not in REGRESSION_STATS:
            raise ValueError(
                f"stat non supportee pour une condition combo a plusieurs entites/stats : {s} "
                f"(seules les stats comptees le sont : {sorted(REGRESSION_STATS)})"
            )
    if seuil is None:
        raise ValueError("seuil obligatoire pour une condition combo somme (pas de forme dd/td multi-entites).")
    team_side = condition.get("equipe") if kind == "TEAM" else None
    mean, scale, meta = _resolve_weighted_operand(
        client, kind, players, team_side, stats, home_team_id, away_team_id, as_of_date, season,
    )
    proba_over = 1 - norm.cdf(seuil, loc=mean, scale=max(scale, MIN_SCALE))
    proba = proba_over if comparison == "OVER" else 1 - proba_over
    # "kind" ajoute ici (pas dans _resolve_weighted_operand()) -- forme de
    # retour uniforme avec la branche SIMPLE ci-dessus, cote appelant
    # (statsService.ts) n'a pas besoin de deviner kind depuis les cles
    # presentes (player_ids vs team_id).
    meta["kind"] = kind
    meta["stats"] = stats
    return proba, meta


def _condition_group_proba(
    client, group: list[dict], home_team_id: int, away_team_id: int, as_of_date, season: str | None = None,
) -> tuple[float, list[dict]]:
    """P(AU MOINS UNE condition du groupe est vraie) -- etape 7 du plan de
    reprise post-audit (25/08/2026, GAPS_OUVERTS.md, "OU imbrique dans un
    ET"). 1 seule condition dans le groupe : comportement INCHANGE (P =
    P(condition), meme chemin que _condition_proba() seul avant cette
    etape). 2+ conditions : P(union) = 1 - produit(1 - P(condition_i))
    sous INDEPENDANCE -- MEME formule EXACTE que relation="OR" deja
    utilisee pour COMPARISON (P(A∪B) = P(A)+P(B)-P(A)*P(B), generalisee a
    N termes), pas une nouvelle approximation."""
    probas = []
    metas = []
    for condition in group:
        p, meta = _condition_proba(client, condition, home_team_id, away_team_id, as_of_date, season=season)
        probas.append(p)
        metas.append(meta)
    if len(group) == 1:
        return probas[0], metas
    proba_union = 1.0
    for p in probas:
        proba_union *= (1 - p)
    return 1 - proba_union, metas


# Chantier combo, correction de correlation dd/td (etape 7 bis, 25/08/2026,
# GAPS_OUVERTS.md) -- trouve par l'utilisateur en testant l'etape 7 : dd/td
# est DEFINI comme >=2/>=3 des 5 categories ci-dessous >=10 -- un pari qui
# combine dd/td ET un seuil explicite sur UNE de CES MEMES categories pour
# LE MEME joueur (ex. "triple-double AVEC 40+points ET 20+rebonds ou
# passes", ex. reel du corpus qui a motive l'etape 7 elle-meme ; "double-
# double ET marque au moins 12 points", 2e exemple reel trouve en
# recherchant d'autres cas similaires) n'est PAS independant -- le seuil
# supplementaire est souvent QUASI IMPLIQUE par le dd/td (surtout si son
# seuil est <= 10), les multiplier comme des evenements independants
# effondre artificiellement la proba (verifie : Jamal Murray "triple-double
# + 25pts + 8reb-ou-8pas" donnait 0.04% avant ce correctif).
#
# 1ere tentative ABANDONNEE (gardee en memoire pour ne pas la retenter) :
# modeliser les 5 categories comme des variables NORMALES INDEPENDANTES
# ENTRE ELLES et enumerer leurs combinaisons pour recalculer dd/td "depuis
# zero". Teste, PIRE que le bug d'origine : la vraie P(td) EST correlee
# entre categories dans la realite (un gros match eleve plusieurs
# categories a la fois -- minutes/rythme/forme du soir), donc l'independance
# ENTRE categories sous-estime massivement P(td) elle-meme (verifie :
# 0.0015% au lieu des 0.577% du classifieur reellement entraine sur des
# vrais matchs -- pire que le probleme a corriger).
#
# Approche retenue : NE JAMAIS retoucher P(dd/td) elle-meme (classifieur
# deja entraine sur des vrais matchs, deja bien calibre) -- corrige
# uniquement le FACTEUR des conditions supplementaires, via une probabilite
# CONDITIONNELLE a l'interieur de LEUR PROPRE categorie (P(categorie>=seuil)
# / P(categorie>=10), aucune hypothese d'independance ENTRE categories
# necessaire ici, juste une queue de distribution conditionnelle sur UNE
# seule variable) :
# - seuil <= 10 : quasi implique par dd/td des que cette categorie compte
#   parmi celles qui l'ont declenche -- facteur = 1.0 (pas de penalite).
# - seuil > 10  : facteur = P(categorie >= seuil) / P(categorie >= 10).
_DOUBLE_CATEGORIES = ("pts", "reb", "ast", "stl", "blk")


def _find_correlated_player_clusters(conditions: list[list[dict]]) -> dict[str, list[int]]:
    """{nom_joueur: [indices de groupe impliques]} pour chaque joueur ayant
    2+ conditions PLAYER simples (1 joueur, 1 stat -- exclut les conditions
    "somme" a plusieurs joueurs/stats, qui n'ont pas ce probleme de
    tautologie) portant sur dd/td ou une des 5 categories ci-dessus, ET AU
    MOINS UNE d'entre elles etant dd/td (sinon pas de correlation
    particuliere a corriger -- 2 seuils simples sur pts/reb pour le meme
    joueur restent traites independamment, meme simplification acceptee
    partout ailleurs dans ce chantier)."""
    by_player: dict[str, list[int]] = {}
    has_dd_td: dict[str, bool] = {}
    for i, group in enumerate(conditions):
        for c in group:
            if c["kind"] != "PLAYER":
                continue
            players = c.get("joueurs") or []
            stats = c["stats"]
            if len(players) != 1 or len(stats) != 1:
                continue
            stat = stats[0]
            if stat not in _DOUBLE_CATEGORIES and stat not in ("dd", "td"):
                continue
            name = players[0]
            indices = by_player.setdefault(name, [])
            if i not in indices:
                indices.append(i)
            if stat in ("dd", "td"):
                has_dd_td[name] = True
    return {name: idxs for name, idxs in by_player.items() if len(idxs) >= 2 and has_dd_td.get(name)}


def _dd_td_conditional_factor(mean: float, scale: float, threshold: float, comparison: str) -> float | None:
    """Facteur multiplicatif pour UNE condition sur une categorie dd/td
    (etape 7 bis) -- None si non applicable (retombe sur l'independance
    simple pour CETTE condition precise) : comparison="UNDER" n'a pas
    d'exemple reel et sa relation logique avec "categorie>=10" est bien
    moins nette (categorie<seuil<=10 n'est ni implique ni contredit par
    dd/td) -- pas de formule fiable, prudence plutot que deviner."""
    if comparison == "UNDER":
        return None
    if threshold <= 10:
        return 1.0
    p_threshold = 1 - norm.cdf(threshold, loc=mean, scale=scale)
    p_ten = 1 - norm.cdf(10, loc=mean, scale=scale)
    if p_ten <= 0:
        return 0.0
    return float(min(max(p_threshold / p_ten, 0.0), 1.0))


def _compute_combo_proba_once(
    client, conditions: list[list[dict]], home_team_id: int, away_team_id: int, as_of_date, season: str | None = None,
) -> dict:
    """Pari COMBO (24/08/2026, GAPS_OUVERTS.md ; etendu etape 7, 25/08/2026,
    "OU imbrique dans un ET") -- ET de N GROUPES (P(combo) = produit des
    P(groupe_i)), chaque groupe resolu via _condition_group_proba() (1
    condition = comportement inchange depuis le chantier combo d'origine,
    2+ = OU entre elles). INDEPENDANCE entre groupes ET entre conditions
    d'un meme groupe assumee (aucune correlation modelisee -- ex. une
    mauvaise soiree au tir correle naturellement plusieurs stats du meme
    joueur) -- meme simplification que le reste du chantier duel/combo,
    documentee explicitement plutot que cachee. EXCEPTION (etape 7 bis,
    GAPS_OUVERTS.md) : un groupe "dd/td" combine a un/des groupe(s) portant
    un seuil sur une des 5 categories sous-jacentes POUR LE MEME JOUEUR
    n'est PAS independant (dd/td EST DEFINI a partir de ces memes
    categories) -- ces groupes-la sont recalcules via
    _dd_td_conditional_factor() (probabilite CONDITIONNELLE a l'interieur
    de chaque categorie, P(dd/td) elle-meme jamais retouchee -- cf. sa
    docstring pour la 1ere tentative, moins bonne, abandonnee). Restreint
    aux clusters "propres" (le groupe dd/td ne contient QUE cette seule
    condition, aucune condition non reconnue dans les groupes "extra") --
    un cluster qui ne s'y prete pas retombe sur l'independance simple
    (jamais pire qu'avant cette etape). conditions_meta reste calcule
    normalement par groupe (sert au stockage/a la resolution, jamais a la
    proba elle-meme -- la resolution relit les vraies stats du match, elle
    n'a pas besoin de cette correction). Portee volontairement limitee (pas
    de comptage sur tout le roster, cf. ROSTER_COUNT etape 3 -- mecanisme
    different) -- cf. GAPS_OUVERTS.md pour l'exclusion restante et sa
    raison."""
    group_probas = []
    conditions_meta = []
    for group in conditions:
        p, group_meta = _condition_group_proba(client, group, home_team_id, away_team_id, as_of_date, season=season)
        group_probas.append(p)
        conditions_meta.append(group_meta)

    clusters = _find_correlated_player_clusters(conditions)
    consumed_groups: set[int] = set()
    corrected_probas = []
    for name, group_indices in clusters.items():
        dd_td_group_idx = next((i for i in group_indices if conditions[i][0]["stats"][0] in ("dd", "td") and len(conditions[i]) == 1), None)
        if dd_td_group_idx is None:
            continue  # cluster pas "propre" (dd/td mele a autre chose dans son groupe) -- pas corrige, independance simple conservee

        player_id, _ = find_player(client, name)
        player_team_id = _player_current_team_id(client, player_id)
        if player_team_id not in (home_team_id, away_team_id):
            raise ValueError(f"\"{name}\" ne joue pour aucune des 2 equipes de ce match.")
        is_home = 1 if player_team_id == home_team_id else 0
        opponent_id = away_team_id if is_home else home_team_id

        extra_indices = [i for i in group_indices if i != dd_td_group_idx]
        ok = True
        group_factors = []
        for i in extra_indices:
            factors = []
            for c in conditions[i]:
                if c["kind"] != "PLAYER" or len(c.get("joueurs") or []) != 1 or len(c["stats"]) != 1 or c["stats"][0] not in _DOUBLE_CATEGORIES:
                    ok = False  # condition inattendue dans ce groupe (ex. OR entre 2 joueurs differents) -- prudence
                    break
                mean, scale = _player_stat_mean_scale(client, player_id, c["stats"][0], opponent_id=opponent_id, is_home=is_home)
                factor = _dd_td_conditional_factor(mean, scale, c["seuil"], c["comparison"])
                if factor is None:
                    ok = False  # comparison="UNDER", pas de formule fiable (cf. docstring)
                    break
                factors.append(factor)
            if not ok:
                break
            group_or = 1.0
            for f in factors:
                group_or *= (1 - f)
            group_factors.append(1 - group_or)

        if not ok:
            continue  # cluster pas "propre" -- pas corrige, independance simple conservee (jamais pire qu'avant)

        corrected = group_probas[dd_td_group_idx]
        for f in group_factors:
            corrected *= f
        corrected_probas.append(corrected)
        consumed_groups.update(group_indices)

    proba = 1.0
    for i, p in enumerate(group_probas):
        if i not in consumed_groups:
            proba *= p
    for cp in corrected_probas:
        proba *= cp

    return {
        "proba": float(proba),
        "detail": f"{len(conditions)} groupes combines ({len(corrected_probas)} cluster(s) corrige(s) pour correlation dd/td)"
        if corrected_probas else f"{len(conditions)} groupes combines (independance assumee)",
        "conditions_meta": conditions_meta,
    }


def compute_combo_proba(*args, **kwargs) -> dict:
    """Enveloppe _compute_combo_proba_once() d'une verification de
    coherence -- voir CONSISTENCY_CHECK_NOTE."""
    return _compute_with_consistency_check(lambda: _compute_combo_proba_once(*args, **kwargs))


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
dans le meme process -- pas verifiable sans le vrai conteneur Linux Cloud Run).

MISE A JOUR 23/08/2026 (piece (a), compute_total_points_proba()) : l'hypothese "seulement quand on
combine 2 modeles differents" ci-dessus etait INCOMPLETE -- la meme instabilite (memes entrees, valeurs
differentes) reproduite avec UN SEUL modele (total_points.joblib), ~1 fois sur 3-15 appels egalement.
Diagnostic affine : le VECTEUR DE FEATURES est bit-identique entre 2 appels (verifie), la prediction brute
du modele ne varie qu'a la 13e decimale (bruit flottant normal, negligeable) -- pourtant la proba finale
(apres passage dans norm.cdf) peut differer de ~0.007 (0.7 point) entre 2 appels. Cause exacte TOUJOURS pas
identifiee. PAS un bug introduit par ce chantier : la meme architecture (modeles .joblib, RandomForest,
n_jobs=-1 fige a l'entrainement) sert deja en production pour les paris MATCH -- la mitigation ci-dessous
est desormais appliquee a TOUT calcul passant par un modele .joblib, pas seulement compute_series_stat_proba()."""


def _compute_with_consistency_check(compute_once, proba_key: str = "proba") -> dict:
    """Generalise le patron construit pour compute_series_stat_proba() (pieces
    d puis a, cf. CONSISTENCY_CHECK_NOTE ci-dessus) : appelle compute_once()
    (sans argument, un thunk -- typiquement une lambda fermee sur les vrais
    arguments) jusqu'a 3 fois et ne renvoie un resultat QUE si au moins 2 des
    essais s'accordent sur result[proba_key] (a _CONSISTENCY_TOLERANCE pres).
    Mieux vaut un appel plus lent (et parfois 3 aller-retours Supabase au lieu
    de 1) qu'une probabilite silencieusement fausse utilisee pour auto-valider
    un vrai pari."""
    results = [compute_once(), compute_once()]
    if abs(results[0][proba_key] - results[1][proba_key]) <= _CONSISTENCY_TOLERANCE:
        return results[0]

    results.append(compute_once())
    for i in range(3):
        for j in range(i + 1, 3):
            if abs(results[i][proba_key] - results[j][proba_key]) <= _CONSISTENCY_TOLERANCE:
                return results[i]

    raise ValueError(
        "Calcul instable : 3 essais avec les memes entrees ont donne 3 probabilites differentes "
        f"({[r[proba_key] for r in results]}) -- refuse de renvoyer un resultat non fiable. "
        "Voir supabase_context.CONSISTENCY_CHECK_NOTE."
    )


def compute_series_stat_proba(*args, **kwargs) -> dict:
    """Enveloppe _compute_series_stat_proba_once() d'une verification de
    coherence -- voir CONSISTENCY_CHECK_NOTE ci-dessus pour le POURQUOI."""
    return _compute_with_consistency_check(lambda: _compute_series_stat_proba_once(*args, **kwargs))


def _compute_roster_split_proba_once(
    client, kind: str, stat: str, team_id: int, opponent_id: int, is_home: int,
    threshold: float, comparison: str, as_of_date, season: str | None = None,
) -> dict:
    """Paris "5 majeur"/"banc" (24/08/2026, GAPS_OUVERTS.md, chantier "5
    majeur/banc") -- AUCUN modele dedie entraine : reutilise
    _player_stat_mean_scale() pour les 5 titulaires (approximes via
    _team_starters(), aucune confirmation officielle de composition avant
    le match disponible dans ce projet) et _team_stat_mean_scale() pour le
    total equipe, combines par somme/soustraction sous hypothese
    d'INDEPENDANCE -- meme simplification deja acceptee ailleurs (chantier
    duel/comparaison : "aucune correlation modelisee, ex. un match a
    rythme eleve qui booste les 2 cotes a la fois").

    kind="STARTERS_SUM" : somme des 5 titulaires vs seuil.
    kind="BENCH_SUM" : total equipe MOINS somme des titulaires -- le banc
    n'est jamais nomme joueur par joueur (effectif variable), approxime
    par soustraction plutot que par somme des remplaçants un par un.
    kind="STARTERS_SHARE" : part du total equipe marquee par les
    titulaires -- P(titulaires > seuil * total), meme mecanisme que le
    multiplicateur du chantier duel/comparaison (_compute_comparison_
    proba_once, relation GT)."""
    if stat not in REGRESSION_STATS:
        raise ValueError(
            f"stat non supportee pour un pari 5 majeur/banc : {stat} (seules les stats comptees le sont : "
            f"{sorted(REGRESSION_STATS)})"
        )
    starters = _team_starters(client, team_id, as_of_date)
    means, variances = [], []
    for pid in starters:
        mean, scale = _player_stat_mean_scale(client, pid, stat, opponent_id=opponent_id, is_home=is_home)
        means.append(mean)
        variances.append(scale ** 2)
    starters_mean = sum(means)
    starters_scale = max(math.sqrt(sum(variances)), MIN_SCALE)

    if kind == "STARTERS_SUM":
        proba_over = 1 - norm.cdf(threshold, loc=starters_mean, scale=starters_scale)
        proba = proba_over if comparison == "OVER" else 1 - proba_over
        return {
            "label": "Total cumulé des titulaires",
            "proba": float(proba),
            "detail": f"prediction moyenne = {starters_mean:.1f} (+/- {starters_scale:.1f}, normale, {len(starters)} titulaires)",
        }

    team_total_mean, team_total_scale = _team_stat_mean_scale(
        client, stat, team_id, opponent_id, bool(is_home), as_of_date, season=season,
    )

    if kind == "BENCH_SUM":
        bench_mean = team_total_mean - starters_mean
        bench_scale = max(math.sqrt(team_total_scale ** 2 + starters_scale ** 2), MIN_SCALE)
        proba_over = 1 - norm.cdf(threshold, loc=bench_mean, scale=bench_scale)
        proba = proba_over if comparison == "OVER" else 1 - proba_over
        return {
            "label": "Total cumulé du banc",
            "proba": float(proba),
            "detail": f"prediction moyenne = {bench_mean:.1f} (+/- {bench_scale:.1f}, normale, total equipe moins titulaires)",
        }

    if kind == "STARTERS_SHARE":
        diff_mean = starters_mean - threshold * team_total_mean
        diff_scale = max(math.sqrt(starters_scale ** 2 + (threshold * team_total_scale) ** 2), MIN_SCALE)
        proba_over = 1 - norm.cdf(0, loc=diff_mean, scale=diff_scale)
        proba = proba_over if comparison == "OVER" else 1 - proba_over
        share = starters_mean / team_total_mean if team_total_mean else float("nan")
        return {
            "label": "Part du total équipe marquée par les titulaires",
            "proba": float(proba),
            "detail": f"titulaires ~{starters_mean:.1f}, équipe ~{team_total_mean:.1f} ({share:.0%})",
        }

    raise ValueError(f"kind inconnu pour un pari 5 majeur/banc : {kind}")


def compute_roster_split_proba(*args, **kwargs) -> dict:
    """Enveloppe _compute_roster_split_proba_once() d'une verification de
    coherence, meme patron que les autres compute_*_proba()."""
    return _compute_with_consistency_check(lambda: _compute_roster_split_proba_once(*args, **kwargs))


# ============================================================================
# Chantier "comptage roster-wide" (etape 3 du plan de reprise post-audit,
# 25/08/2026, GAPS_OUVERTS.md) -- "au moins N joueurs remplissent une
# condition individuelle", debloque triple-double n'importe qui, DNP, nombre
# de joueurs utilises, "au moins N joueurs marquent X+".
# ============================================================================

def poisson_binomial_pmf(probs: list[float]) -> list[float]:
    """Distribution EXACTE (pas une approximation normale comme le reste du
    projet -- ici superflu, le calcul direct est trivial) du nombre de succes
    parmi des essais de Bernoulli INDEPENDANTS de probabilites DIFFERENTES
    (loi de Poisson-binomiale, pas Binomiale classique -- chaque joueur a sa
    propre proba). DP standard O(n^2) : un roster de 10-30 joueurs est donc
    instantane. Retourne pmf ou pmf[k] = P(exactement k succes).

    Meme hypothese d'INDEPENDANCE deja acceptee partout ailleurs dans ce
    projet (duel/comparaison/combo) : aucune correlation entre joueurs
    modelisee (ex. si un titulaire explose, l'usage des autres peut baisser -
    pas capture ici, cohérent avec le reste)."""
    pmf = [1.0]
    for p in probs:
        p = min(max(p, 0.0), 1.0)
        new_pmf = [0.0] * (len(pmf) + 1)
        for k, mass in enumerate(pmf):
            if mass == 0.0:
                continue
            new_pmf[k] += mass * (1 - p)
            new_pmf[k + 1] += mass * p
        pmf = new_pmf
    return pmf


def _player_condition_proba(client, player_id: int, stat: str, threshold, comparison, opponent_id: int, is_home: int) -> float:
    """P(1 joueur remplit la condition stat/threshold/comparison) --
    reutilise TEL QUEL compute_proba() (couverture complete : regression,
    classifier dd/td, pourcentage ft/fg/fg3, aucune restriction contrairement
    au chantier duel/roster-split qui se limitent a REGRESSION_STATS) puis
    inverse pour UNDER -- meme geste EXACT que _condition_proba() (chantier
    combo, cas SIMPLE PLAYER)."""
    result = compute_proba(client, player_id, stat, threshold, opponent_id=opponent_id, is_home=is_home)
    proba = result["proba"]
    if comparison == "UNDER" and stat not in CLASSIFIER_STATS:
        proba = 1 - proba
    return float(proba)


def _resolve_roster_count_pool(
    client, team_id: int, opponent_id: int, is_home: int, as_of_date, pool: str,
) -> list[tuple[int, int, int]]:
    """Bassin de joueurs (player_id, opponent_id, is_home) pour UNE equipe --
    pool="STARTERS" reutilise _team_starters() (chantier 5 majeur/banc),
    pool="ALL" reutilise _team_rotation() (bassin elargi, ci-dessus)."""
    player_ids = _team_starters(client, team_id, as_of_date) if pool == "STARTERS" else _team_rotation(client, team_id, as_of_date)
    return [(pid, opponent_id, is_home) for pid in player_ids]


def _compute_roster_count_proba_once(
    client, scope: str, pool: str, stat: str, stat_threshold, stat_comparison,
    min_players: int, count_relation: str, home_team_id: int, away_team_id: int,
    as_of_date, season: str | None = None,
) -> dict:
    """Pari "au moins N joueurs remplissent une condition" (etape 3 du plan
    de reprise post-audit, 25/08/2026, GAPS_OUVERTS.md) -- 2 etapes :
    (1) resoudre le BASSIN de joueurs consideres (scope="match" = les 2
    equipes combinees, "domicile"/"exterieur" = une seule ; pool="ALL" =
    bassin elargi via _team_rotation(), "STARTERS" = 5 titulaires via
    _team_starters()) ; (2) pour CHAQUE joueur du bassin, calculer sa proba
    individuelle de remplir stat/stat_threshold/stat_comparison
    (_player_condition_proba(), AUCUNE restriction de stat -- toute
    STAT_CODES valide, y compris dd/td/ft/fg/fg3) ; (3) combiner en
    Poisson-binomiale (poisson_binomial_pmf()) et sommer la queue voulue.

    count_relation a 3 valeurs (AT_LEAST/MORE_THAN/FEWER_THAN) plutot que le
    OVER/UNDER habituel du reste du projet : partout ailleurs OVER/UNDER
    s'appliquent a une approximation NORMALE (continue) d'une quantite
    discrete, ou "au moins N" vs "plus de N" ne change quasi rien (mesure
    nulle). Ici la distribution est EXACTE et discrete (Poisson-binomiale,
    aucune approximation) -- l'ambiguite inclusif/exclusif compte reellement
    pour un petit N (ex. "au moins 8 joueurs" != "plus de 8 joueurs"), d'ou
    un enum explicite plutot que de deviner un seuil -1/+1 cote IA."""
    if stat not in REGRESSION_STATS and stat not in CLASSIFIER_STATS and stat not in PCT_STATS:
        raise ValueError(f"stat inconnue pour un comptage roster-wide : {stat}")
    if stat not in CLASSIFIER_STATS and (stat_threshold is None or stat_comparison is None):
        raise ValueError("stat_threshold/stat_comparison obligatoires sauf pour dd/td.")
    if pool not in ("ALL", "STARTERS"):
        raise ValueError(f"pool inconnu : {pool}")
    if scope not in ("match", "domicile", "exterieur"):
        raise ValueError(f"scope inconnu : {scope}")
    if count_relation not in ("AT_LEAST", "MORE_THAN", "FEWER_THAN"):
        raise ValueError(f"count_relation inconnue : {count_relation}")

    entries: list[tuple[int, int, int]] = []
    if scope in ("match", "domicile"):
        entries += _resolve_roster_count_pool(client, home_team_id, away_team_id, 1, as_of_date, pool)
    if scope in ("match", "exterieur"):
        entries += _resolve_roster_count_pool(client, away_team_id, home_team_id, 0, as_of_date, pool)

    probs = [
        _player_condition_proba(client, pid, stat, stat_threshold, stat_comparison, opp_id, is_home)
        for pid, opp_id, is_home in entries
    ]
    pmf = poisson_binomial_pmf(probs)

    if count_relation == "AT_LEAST":
        proba = sum(pmf[min_players:])
    elif count_relation == "MORE_THAN":
        proba = sum(pmf[min_players + 1:])
    else:
        proba = sum(pmf[:min_players])

    return {
        "label": "Nombre de joueurs remplissant la condition",
        "proba": float(proba),
        "detail": (
            f"{len(entries)} joueurs consideres ({pool}, scope={scope}), proba individuelle moyenne "
            f"{(sum(probs) / len(probs)) if probs else 0.0:.1%}, distribution de Poisson-binomiale exacte"
        ),
        "player_ids": [pid for pid, _, _ in entries],
    }


def compute_roster_count_proba(*args, **kwargs) -> dict:
    """Enveloppe _compute_roster_count_proba_once() d'une verification de
    coherence -- voir CONSISTENCY_CHECK_NOTE. proba_key par defaut ("proba")
    convient tel quel."""
    return _compute_with_consistency_check(lambda: _compute_roster_count_proba_once(*args, **kwargs))


# ============================================================================
# Chantier "meilleur marqueur" / superlatif implicite (etape 4 du plan de
# reprise post-audit, 25/08/2026, GAPS_OUVERTS.md) -- "X marque plus de
# {stat} que TOUT AUTRE joueur du match" : ensemble de comparaison NON BORNE
# (tous les autres joueurs du match), distinct de COMPARISON (toujours
# contre 1 entite nommee ou une somme de N joueurs nommes) et de
# ROSTER_COUNT (compte contre un SEUIL FIXE partage par tous).
# ============================================================================

def _resolve_superlative_other_players(
    client, stat: str, excluded_player_id: int, home_team_id: int, away_team_id: int, as_of_date,
) -> list[tuple[float, float]]:
    """(mean, scale) de TOUS les autres joueurs du match -- bassin ELARGI
    des 2 equipes via _team_rotation() (meme bassin que le chantier
    comptage roster-wide, etape 3), le joueur vise exclu. _player_stat_mean_scale
    (chantier duel) fournit l'approximation normale par joueur."""
    others: list[tuple[float, float]] = []
    for team_id, opponent_id, is_home in ((home_team_id, away_team_id, 1), (away_team_id, home_team_id, 0)):
        for pid in _team_rotation(client, team_id, as_of_date):
            if pid == excluded_player_id:
                continue
            mean, scale = _player_stat_mean_scale(client, pid, stat, opponent_id=opponent_id, is_home=is_home)
            others.append((mean, scale))
    return others


def _compute_superlative_proba_once(
    client, player_id: int, stat: str, home_team_id: int, away_team_id: int, as_of_date, season: str | None = None,
) -> dict:
    """"X marque plus de {stat} que TOUT AUTRE joueur du match" (etape 4 du
    plan de reprise post-audit, GAPS_OUVERTS.md -- cause racine "superlatif
    implicite" de l'audit). Reutilise _player_stat_mean_scale() (chantier
    duel, approximation normale par joueur) et le bassin _team_rotation()
    des 2 equipes (chantier comptage roster-wide, etape 3) pour definir
    "tout autre joueur".

    Calcul EXACT sous l'hypothese d'INDEPENDANCE mutuelle entre TOUS les
    joueurs (meme simplification deja acceptee partout ailleurs -- duel/
    combo/roster-count) via integration numerique :
        P(X > max(Y_1..Y_n)) = integrale( f_X(x) * produit_i F_{Y_i}(x) dx )
    PAS une approximation supplementaire (ex. produit naif des P(X>Y_i)
    pris independamment les unes des autres, qui ignore que TOUTES les
    comparaisons partagent la MEME valeur realisee de X) -- cette formule
    est la vraie probabilite jointe sous l'hypothese d'independance
    ci-dessus, integree numeriquement (scipy.integrate.quad) plutot
    qu'approximee davantage. Restreint a REGRESSION_STATS (meme limite que
    le chantier duel -- _player_stat_mean_scale n'existe pas pour
    dd/td/ft/fg/fg3)."""
    if stat not in REGRESSION_STATS:
        raise ValueError(
            f"stat non supportee pour un superlatif : {stat} (seules les stats comptees le sont : "
            f"{sorted(REGRESSION_STATS)})"
        )
    player_team_id = _player_current_team_id(client, player_id)
    if player_team_id not in (home_team_id, away_team_id):
        raise ValueError(f"le joueur (player_id={player_id}) ne joue pour aucune des 2 equipes de ce match.")
    is_home = 1 if player_team_id == home_team_id else 0
    opponent_id = away_team_id if is_home else home_team_id
    mean_x, scale_x = _player_stat_mean_scale(client, player_id, stat, opponent_id=opponent_id, is_home=is_home)

    others = _resolve_superlative_other_players(client, stat, player_id, home_team_id, away_team_id, as_of_date)
    if not others:
        raise ValueError("Aucun autre joueur trouve pour ce match -- impossible de calculer un superlatif.")

    def integrand(x: float) -> float:
        density = norm.pdf(x, loc=mean_x, scale=scale_x)
        if density <= 0.0:
            return 0.0
        prod = 1.0
        for mean_y, scale_y in others:
            prod *= norm.cdf(x, loc=mean_y, scale=scale_y)
            if prod == 0.0:
                return 0.0
        return density * prod

    proba, _ = quad(integrand, -np.inf, np.inf, limit=200)
    proba = float(min(max(proba, 0.0), 1.0))

    _, _, label = REGRESSION_STATS[stat]
    return {
        "label": label,
        "proba": proba,
        "detail": (
            f"moyenne {mean_x:.1f} (+/-{scale_x:.1f}) vs {len(others)} autres joueurs du match -- integrale "
            "numerique exacte sous hypothese d'independance"
        ),
    }


def compute_superlative_proba(*args, **kwargs) -> dict:
    """Enveloppe _compute_superlative_proba_once() d'une verification de
    coherence -- voir CONSISTENCY_CHECK_NOTE (les appels a
    _player_stat_mean_scale passent par des modeles .joblib, meme
    instabilite deja documentee)."""
    return _compute_with_consistency_check(lambda: _compute_superlative_proba_once(*args, **kwargs))


# ============================================================================
# Chantier "evenements granulaires" (etape 6 du plan de reprise post-audit,
# 25/08/2026, GAPS_OUVERTS.md) -- "dernier panier du match" (LAST_BASKET) et
# "contre SUR un joueur precis" (BLOCK_ON_PLAYER). Contrairement a l'etape 5,
# AUCUN nouveau modele entraine pour ces 2 mecanismes -- reutilisent
# TELS QUELS les modeles deja en place (blk/fga -- REGRESSION_STATS, fg --
# PCT_STATS) via des combinaisons nouvelles (part attendue de paniers /
# amincissement de Poisson), meme esprit que SUPERLATIVE/ROSTER_COUNT
# (aucun nouveau .joblib, juste une nouvelle facon de combiner l'existant).
# ============================================================================

def _player_expected_fgm(client, player_id: int, opponent_id: int, is_home: int, rest_days: int = 2) -> float:
    """Nombre de paniers (tirs au panier reussis, 2 ou 3 points -- PAS les
    lancers francs) ATTENDU pour CE joueur sur CE match -- n_hat (tentatives
    attendues) * p_hat (taux estime), MEME formule EXACTE que run_pct()
    (tester_modele.py, cote joueur) mais sans l'etape finale de comparaison
    a un seuil : le chantier "dernier panier du match" a besoin de la VALEUR
    attendue de fgm, pas d'une proba contre un seuil fixe -- meme raison que
    _player_stat_mean_scale() (chantier duel) extrait compute_proba() pour
    les stats comptees. Duplique plutot que reutilise run_pct() (contexte
    joueur = un seul dict plat, differe du contexte equipe combine own_/opp_
    de _compute_team_pct_proba_once() -- meme situation deja documentee
    la-bas)."""
    bundle = joblib.load(MODELS_DIR / "fg_pct.joblib")
    context, _, _ = build_context(client, player_id, opponent_id, is_home=is_home, rest_days=rest_days)
    X = pd.DataFrame([context])[bundle["attempts_feature_cols"]]
    n_hat = max(round(float(bundle["attempts_model"].predict(X)[0])), 1)
    k = bundle["shrinkage_k"]
    league_avg = bundle["league_avg"]
    makes_sum, attempts_sum = context["fgm_sum10"], context["fga_sum10"]
    if bundle.get("distribution") == "beta_binomial":
        alpha_post = k * league_avg + makes_sum
        beta_post = k * (1 - league_avg) + (attempts_sum - makes_sum)
        p_hat = alpha_post / (alpha_post + beta_post)
    else:
        p_hat = (makes_sum + k * league_avg) / (attempts_sum + k)
    return n_hat * p_hat


def _compute_last_basket_proba_once(
    client, player_id: int, home_team_id: int, away_team_id: int, as_of_date, season: str | None = None,
) -> dict:
    """"X inscrit le dernier panier du match" (etape 6, GAPS_OUVERTS.md,
    "buzzer beater"). Approximation par PART attendue de paniers (fgm) parmi
    TOUS les joueurs du match, sous hypothese d'echangeabilite (le dernier
    panier est un tirage parmi tous les paniers du match, la part de chaque
    joueur reflete sa part ATTENDUE de fgm) -- le mecanisme le plus faible de
    cette etape, choisi avec l'utilisateur (25/08/2026) dans le meme esprit
    que plus_minus/total_timeouts deja acceptes : proba honnetement faible
    plutot que non calculable, ne capture PAS la vraie dynamique du
    money-time (qui prend les derniers tirs, pas juste "qui tire le plus en
    moyenne"). Bassin ELARGI des 2 equipes via _team_rotation() -- meme
    bassin que ROSTER_COUNT/SUPERLATIVE."""
    player_team_id = _player_current_team_id(client, player_id)
    if player_team_id not in (home_team_id, away_team_id):
        raise ValueError(f"le joueur (player_id={player_id}) ne joue pour aucune des 2 equipes de ce match.")

    expected_fgm: dict[int, float] = {}
    for team_id, opponent_id, is_home in ((home_team_id, away_team_id, 1), (away_team_id, home_team_id, 0)):
        for pid in _team_rotation(client, team_id, as_of_date):
            expected_fgm[pid] = _player_expected_fgm(client, pid, opponent_id, is_home)

    # Le joueur vise peut etre absent du bassin ELARGI (top 15 par equipe,
    # _team_rotation) sans etre absent du match -- calcule sa part a part
    # dans ce cas plutot que de le rejeter (meme geste que
    # _resolve_superlative_other_players, qui exclut seulement le joueur
    # vise du bassin des AUTRES, jamais lui-meme).
    if player_id not in expected_fgm:
        is_home = 1 if player_team_id == home_team_id else 0
        opponent_id = away_team_id if is_home else home_team_id
        expected_fgm[player_id] = _player_expected_fgm(client, player_id, opponent_id, is_home)

    total = sum(expected_fgm.values())
    if total <= 0:
        raise ValueError("Impossible d'estimer un total de paniers attendu pour ce match.")
    proba = float(min(max(expected_fgm[player_id] / total, 0.0), 1.0))

    return {
        "label": "Dernier panier du match",
        "proba": proba,
        "detail": (
            f"paniers attendus = {expected_fgm[player_id]:.1f} sur un total match estime a {total:.1f} "
            f"({len(expected_fgm)} joueurs du bassin) -- approximation par part attendue, pas le vrai money-time"
        ),
    }


def compute_last_basket_proba(*args, **kwargs) -> dict:
    """Enveloppe _compute_last_basket_proba_once() d'une verification de
    coherence -- voir CONSISTENCY_CHECK_NOTE."""
    return _compute_with_consistency_check(lambda: _compute_last_basket_proba_once(*args, **kwargs))


def _compute_block_on_player_proba_once(
    client, blocker_id: int, victim_id: int, home_team_id: int, away_team_id: int, as_of_date, season: str | None = None,
) -> dict:
    """"X realise au moins 1 contre SUR Y" (etape 6, GAPS_OUVERTS.md) --
    amincissement de Poisson (thinning) : lambda_bloqueur (moyenne de
    contres deja modelisee, _player_stat_mean_scale, distribution Poisson)
    * part attendue des tirs de l'equipe adverse pris par le joueur vise
    (fga du joueur / fga attendu de SON equipe, team_fga.joblib deja
    entraine -- chantier "petits gains groupes", 24/08/2026) -- un contre ne
    peut se produire QUE sur un tir de l'equipe adverse, jamais un
    coequipier, d'ou la garde explicite ci-dessous."""
    blocker_team_id = _player_current_team_id(client, blocker_id)
    victim_team_id = _player_current_team_id(client, victim_id)
    if blocker_team_id not in (home_team_id, away_team_id) or victim_team_id not in (home_team_id, away_team_id):
        raise ValueError("le bloqueur et/ou le joueur vise ne jouent pour aucune des 2 equipes de ce match.")
    if blocker_team_id == victim_team_id:
        raise ValueError("le bloqueur et le joueur vise jouent dans la MEME equipe -- un contre ne peut viser qu'un adversaire.")

    blocker_is_home = 1 if blocker_team_id == home_team_id else 0
    blocker_opponent_id = away_team_id if blocker_is_home else home_team_id
    lambda_blocker, _ = _player_stat_mean_scale(client, blocker_id, "blk", opponent_id=blocker_opponent_id, is_home=blocker_is_home)

    victim_is_home = 1 if victim_team_id == home_team_id else 0
    victim_opponent_id = away_team_id if victim_is_home else home_team_id
    victim_fga, _ = _player_stat_mean_scale(client, victim_id, "fga", opponent_id=victim_opponent_id, is_home=victim_is_home)
    team_fga, _ = _team_stat_mean_scale(client, "fga", victim_team_id, victim_opponent_id, victim_is_home, as_of_date, season=season)
    if team_fga <= 0:
        raise ValueError("Impossible d'estimer le volume de tirs de l'equipe visee.")
    share = min(max(victim_fga / team_fga, 0.0), 1.0)

    proba = float(1 - math.exp(-lambda_blocker * share))
    return {
        "label": "Contre sur un joueur précis",
        "proba": proba,
        "detail": (
            f"contres attendus (bloqueur) = {lambda_blocker:.2f} | part des tirs de l'equipe adverse prise par le "
            f"joueur vise = {share:.1%} ({victim_fga:.1f}/{team_fga:.1f} tirs) -- amincissement de Poisson"
        ),
    }


def compute_block_on_player_proba(*args, **kwargs) -> dict:
    """Enveloppe _compute_block_on_player_proba_once() d'une verification de
    coherence -- voir CONSISTENCY_CHECK_NOTE."""
    return _compute_with_consistency_check(lambda: _compute_block_on_player_proba_once(*args, **kwargs))
