"""Stats composees (Lot 1 S1) : dreb, fgm, ftm, fta -- vrais modeles locaux."""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from supabase_context import MODELS_DIR, _composed_distribution, _composed_proba, load_model  # noqa: E402

pytestmark = pytest.mark.skipif(not (MODELS_DIR / "ft_pct.joblib").exists(), reason="modeles absents")


def _context_and_recent():
    cols = set()
    for name in ("reb", "oreb"):
        cols |= set(load_model(MODELS_DIR / f"{name}.joblib")["feature_cols"])
    for name in ("ft_pct", "fg_pct"):
        cols |= set(load_model(MODELS_DIR / f"{name}.joblib")["attempts_feature_cols"])
    context = {c: 5.0 for c in cols}
    context.update(ftm_sum10=40.0, fta_sum10=50.0, fgm_sum10=90.0, fga_sum10=190.0)
    rng = np.random.default_rng(0)
    reb = rng.integers(3, 12, 10)
    recent = pd.DataFrame({"reb": reb, "oreb": rng.integers(0, 3, 10), "fta": rng.integers(2, 9, 10)})
    return context, recent


@pytest.mark.parametrize("stat", ["dreb", "fgm", "ftm", "fta"])
def test_proba_monotone_en_seuil(stat):
    context, recent = _context_and_recent()
    dist = _composed_distribution(stat, context, recent)
    assert dist["mean"] > 0 and dist["scale"] > 0
    probas = [_composed_proba(stat, context, recent, s)[0] for s in (1, 4, 8, 15)]
    assert all(0 <= p <= 1 for p in probas)
    assert probas == sorted(probas, reverse=True)
