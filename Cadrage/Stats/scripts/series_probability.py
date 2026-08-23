"""
Calcul récursif de la probabilité de victoire de série ET de la
distribution de sa longueur (4 à 7 matchs) — brique 2 du chantier "paris
SÉRIE" (cadré le 23/08/2026, GAPS_OUVERTS.md/JOURNAL_SESSIONS.md). Combine
le P(victoire) PAR MATCH du modèle `home_win.joblib` (train_home_win_model.py)
avec le format domicile/extérieur connu à l'avance d'une série best-of-7
(2-2-1-1-1) — PAS une formule fermée à un seul p constant (rejetée avec
l'utilisateur, écraserait la différence domicile/extérieur), un calcul
match par match à la place (programmation dynamique sur les scores
possibles de série).

Convention : "équipe A" = celle qui a l'avantage du terrain sur la série
(mieux classée) -- reçoit aux matchs 1, 2, 5, 7 (4 matchs à domicile si la
série va au bout) ; "équipe B" reçoit aux matchs 3, 4, 6 (3 matchs).
p_a_home = P(A gagne UN match où A reçoit) ; p_a_away = P(A gagne UN match
où A se déplace) -- ces 2 nombres viennent du modèle home_win.joblib,
appliqué 2 fois (une fois avec A à domicile, une fois avec B à domicile),
PAS symétriques en général (p_a_away != 1 - p_a_home serait faux -- en
réalité p_a_away = 1 - P(B gagne à domicile contre A), un 2e appel modèle
à part entière, le même p_a_home ne suffit pas).

Usage (test) :
    python series_probability.py
"""

from collections import defaultdict

# Format 2-2-1-1-1 standard (mieux classée = équipe A) : True = A reçoit.
VENUE_A_HOME = [True, True, False, False, True, False, True]


def simulate_series(p_a_home: float, p_a_away: float, best_of: int = 7) -> dict:
    """Retourne {p_a_wins_series, p_b_wins_series, length_distribution}
    (length_distribution : {4: proba, 5: proba, 6: proba, 7: proba} pour
    best_of=7, sommant à 1.0). Programmation dynamique sur l'état (victoires
    A, victoires B) avant chaque match -- pas de formule fermée, un p
    DIFFÉRENT par match selon qui reçoit (voir docstring du module)."""
    wins_needed = best_of // 2 + 1  # 4 pour best_of=7
    state: dict[tuple[int, int], float] = {(0, 0): 1.0}
    length_distribution: dict[int, float] = {n: 0.0 for n in range(wins_needed, best_of + 1)}
    p_a_wins_series = 0.0
    p_b_wins_series = 0.0

    for game_idx in range(best_of):
        p_a = p_a_home if VENUE_A_HOME[game_idx] else p_a_away
        new_state: dict[tuple[int, int], float] = defaultdict(float)
        for (wins_a, wins_b), prob in state.items():
            # A gagne ce match.
            next_a = (wins_a + 1, wins_b)
            p_next_a = prob * p_a
            if next_a[0] == wins_needed:
                p_a_wins_series += p_next_a
                length_distribution[game_idx + 1] += p_next_a
            else:
                new_state[next_a] += p_next_a
            # B gagne ce match.
            next_b = (wins_a, wins_b + 1)
            p_next_b = prob * (1 - p_a)
            if next_b[1] == wins_needed:
                p_b_wins_series += p_next_b
                length_distribution[game_idx + 1] += p_next_b
            else:
                new_state[next_b] += p_next_b
        state = new_state

    return {
        "p_a_wins_series": p_a_wins_series,
        "p_b_wins_series": p_b_wins_series,
        "length_distribution": length_distribution,
    }


def expected_length(length_distribution: dict[int, float]) -> float:
    return sum(n * p for n, p in length_distribution.items())


def simulate_series_with_stat(
    p_a_home: float, p_a_away: float,
    p_stat_home: float, p_stat_away: float, stat_team: str,
    best_of: int = 7,
) -> dict:
    """Etend simulate_series() : probabilite qu'un evenement BINAIRE (ex.
    "le joueur marque 30+ points") se produise AU MOINS UNE FOIS sur les
    matchs REELEMENT joues de la serie -- semantique retenue avec
    l'utilisateur le 23/08/2026 pour un pari serie ambigu, cf.
    GAPS_OUVERTS.md. Generique : ne sait rien du modele qui a produit
    p_stat_home/away (n'importe lequel des modeles joueur existants
    convient), seule la logique de combinaison avec l'issue de la serie vit
    ici -- brique (c) du chantier.

    Fidele domicile/exterieur comme le modele d'equipe (pas juste 1 p
    moyen) : p_stat_home/away sont les probas du joueur SPECIFIQUEMENT
    quand SON equipe recoit/se deplace -- stat_team ("A" ou "B") determine
    son calendrier domicile/exterieur via VENUE_A_HOME (meme convention que
    simulate_series : "A" = l'equipe avec l'avantage du terrain sur la
    serie).

    Hypothese simplificatrice assumee : l'issue du match et le fait que la
    stat se produise sont INDEPENDANTES (aucune correlation modelisee entre
    "l'equipe gagne" et "le joueur performe" ce soir-la) -- raisonnable par
    defaut, a revisiter si besoin.

    DP sur l'etat (victoires A, victoires B, stat deja arrivee ?) -- une
    fois le flag "deja arrivee" a True, la stat de la suite ne compte plus
    (pas la peine de la re-brancher), seul le vainqueur du match reste a
    determiner pour la suite de la DP.
    """
    if stat_team not in ("A", "B"):
        raise ValueError('stat_team doit valoir "A" ou "B"')

    wins_needed = best_of // 2 + 1
    state: dict[tuple[int, int, bool], float] = {(0, 0, False): 1.0}
    length_distribution: dict[int, float] = {n: 0.0 for n in range(wins_needed, best_of + 1)}
    p_a_wins_series = 0.0
    p_b_wins_series = 0.0
    p_stat_at_least_once = 0.0

    for game_idx in range(best_of):
        a_home = VENUE_A_HOME[game_idx]
        p_a = p_a_home if a_home else p_a_away
        stat_team_home = a_home if stat_team == "A" else not a_home
        p_stat = p_stat_home if stat_team_home else p_stat_away

        new_state: dict[tuple[int, int, bool], float] = defaultdict(float)
        for (wins_a, wins_b, hit), prob in state.items():
            if hit:
                branches = [(True, p_a, True), (False, 1 - p_a, True)]
            else:
                branches = [
                    (True, p_a * p_stat, True), (True, p_a * (1 - p_stat), False),
                    (False, (1 - p_a) * p_stat, True), (False, (1 - p_a) * (1 - p_stat), False),
                ]
            for a_wins, branch_prob, new_hit in branches:
                p_branch = prob * branch_prob
                if p_branch == 0:
                    continue
                next_wins_a = wins_a + 1 if a_wins else wins_a
                next_wins_b = wins_b if a_wins else wins_b + 1
                series_over = next_wins_a == wins_needed or next_wins_b == wins_needed
                if series_over:
                    if next_wins_a == wins_needed:
                        p_a_wins_series += p_branch
                    else:
                        p_b_wins_series += p_branch
                    length_distribution[game_idx + 1] += p_branch
                    if new_hit:
                        p_stat_at_least_once += p_branch
                else:
                    new_state[(next_wins_a, next_wins_b, new_hit)] += p_branch
        state = new_state

    return {
        "p_stat_at_least_once": p_stat_at_least_once,
        "p_a_wins_series": p_a_wins_series,
        "p_b_wins_series": p_b_wins_series,
        "length_distribution": length_distribution,
    }


if __name__ == "__main__":
    print("=== Vérification p=0.5 (équipes égales) vs le résultat classique connu ===")
    result = simulate_series(0.5, 0.5)
    expected = {4: 0.125, 5: 0.25, 6: 0.3125, 7: 0.3125}
    for n, p in result["length_distribution"].items():
        ref = expected[n]
        ok = "OK" if abs(p - ref) < 1e-9 else "FAIL"
        print(f"  {ok} -- {n} matchs : calculé={p:.4%}  référence={ref:.4%}")
    print(f"  P(A gagne la série) = {result['p_a_wins_series']:.4%} (attendu 50%)")
    print(f"  Longueur moyenne = {expected_length(result['length_distribution']):.4f} (référence connue ~5.8125)")

    print("\n=== Équipe A nettement plus forte (p_a_home=75%, p_a_away=60%) ===")
    result2 = simulate_series(0.75, 0.60)
    print(f"  P(A gagne la série) = {result2['p_a_wins_series']:.2%}")
    for n, p in sorted(result2["length_distribution"].items()):
        print(f"  {n} matchs : {p:.2%}")
    print(f"  Longueur moyenne = {expected_length(result2['length_distribution']):.2f} (attendu : plus courte que 5.81, série déséquilibrée)")

    print("\n=== simulate_series_with_stat -- cas limites ===")
    r_zero = simulate_series_with_stat(0.6, 0.55, 0.0, 0.0, "A")
    ok = "OK" if abs(r_zero["p_stat_at_least_once"]) < 1e-9 else "FAIL"
    print(f"  {ok} -- p_stat=0 partout -> p_stat_at_least_once={r_zero['p_stat_at_least_once']:.4%} (attendu 0%)")
    r_one = simulate_series_with_stat(0.6, 0.55, 1.0, 1.0, "A")
    ok = "OK" if abs(r_one["p_stat_at_least_once"] - 1.0) < 1e-9 else "FAIL"
    print(f"  {ok} -- p_stat=1 partout -> p_stat_at_least_once={r_one['p_stat_at_least_once']:.4%} (attendu 100%, garanti dès le match 1)")

    print("\n=== simulate_series_with_stat -- cross-check vs formule fermée 1-(1-p)^N ===")
    print("(valide seulement quand p_stat ne dépend pas du domicile/extérieur : la stat")
    print(" n'affecte alors ni qui gagne ni la distribution de longueur, la formule")
    print(" marginalisée sur cette même distribution doit alors coïncider EXACTEMENT)")
    p_a_home, p_a_away, p_stat = 0.62, 0.58, 0.35
    r_a = simulate_series_with_stat(p_a_home, p_a_away, p_stat, p_stat, "A")
    r_b = simulate_series_with_stat(p_a_home, p_a_away, p_stat, p_stat, "B")
    closed_form = sum(p * (1 - (1 - p_stat) ** n) for n, p in r_a["length_distribution"].items())
    for label, r in (("stat_team=A", r_a), ("stat_team=B", r_b)):
        ok = "OK" if abs(r["p_stat_at_least_once"] - closed_form) < 1e-9 else "FAIL"
        print(f"  {ok} -- {label} : DP={r['p_stat_at_least_once']:.6%}  formule fermée={closed_form:.6%}")
