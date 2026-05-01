from methods.cia import CIARecommender


def test_cia_returns_results(db_items, base_context):
    rec = CIARecommender()
    results = rec.recommend(db_items, base_context, top_k=5)
    assert len(results) > 0


def test_cia_result_has_required_fields(db_items, base_context):
    rec = CIARecommender()
    results = rec.recommend(db_items, base_context, top_k=5)
    for r in results:
        assert "item" in r
        assert "score" in r
        assert "explanation" in r


def test_cia_respects_top_k(db_items, base_context):
    rec = CIARecommender()
    results = rec.recommend(db_items, base_context, top_k=3)
    assert len(results) <= 3


def test_cia_empty_items_returns_empty(base_context):
    rec = CIARecommender()
    results = rec.recommend([], base_context, top_k=5)
    assert results == []


def test_cia_results_sorted_by_score(db_items, base_context):
    rec = CIARecommender()
    results = rec.recommend(db_items, base_context, top_k=5)
    scores = [r["score"] for r in results]
    assert scores == sorted(scores, reverse=True)
