from methods.jitir import JITIRRecommender


def test_jitir_returns_results(db_items, base_context):
    rec = JITIRRecommender()
    results = rec.recommend(db_items, base_context, top_k=5)
    assert len(results) > 0


def test_jitir_result_has_required_fields(db_items, base_context):
    rec = JITIRRecommender()
    results = rec.recommend(db_items, base_context, top_k=5)
    for r in results:
        assert "item" in r
        assert "score" in r
        assert "explanation" in r


def test_jitir_respects_top_k(db_items, base_context):
    rec = JITIRRecommender()
    results = rec.recommend(db_items, base_context, top_k=3)
    assert len(results) <= 3


def test_jitir_empty_query_returns_empty(db_items):
    rec = JITIRRecommender()
    context = {"current_category": "", "current_text": ""}
    results = rec.recommend(db_items, context, top_k=5)
    assert results == []


def test_jitir_empty_items_returns_empty(base_context):
    rec = JITIRRecommender()
    results = rec.recommend([], base_context, top_k=5)
    assert results == []


def test_jitir_results_sorted_by_score(db_items, base_context):
    rec = JITIRRecommender()
    results = rec.recommend(db_items, base_context, top_k=5)
    scores = [r["score"] for r in results]
    assert scores == sorted(scores, reverse=True)
