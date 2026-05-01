from abc import ABC, abstractmethod


class BaseRecommender(ABC):
    """All recommendation methods inherit from this."""

    name = "base"

    @abstractmethod
    def recommend(self, items, context, top_k=10):
        """
        Args:
            items: list of Item objects (the candidate pool)
            context: dict with keys: lat, lon, now, current_category, current_text
            top_k: how many to return
        Returns:
            list of dicts: [{item, score, explanation}, ...]
        """
        pass