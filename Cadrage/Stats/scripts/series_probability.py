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
