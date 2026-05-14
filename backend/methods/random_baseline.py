"""
Random baseline recommender.

Standard practice in IR evaluation: shows the floor that any "real" method
must beat. If CBR/JITIR/CIA score close to random, they're not learning
anything useful. If they score well above random, the lift is meaningful.

Not a serious recommender — purely a yardstick for the paper.
"""
import random as _random
from methods.base import BaseRecommender


class RandomRecommender(BaseRecommender):
    name = "random"

    def __init__(self, seed=None):
        # Each instance gets its own RNG so multi-seed evaluation runs
        # don't bleed state into each other.
        self._rng = _random.Random(seed)

    def recommend(self, items, context, top_k=10):
        if not items:
            return []
        sample_size = min(top_k, len(items))
        picked = self._rng.sample(list(items), sample_size)
        return [
            {
                "item": it,
                "score": 0.0,
                "explanation": "random baseline",
            }
            for it in picked
        ]
