import pytest
from methods.cbr import CBRRecommender
from methods.jitir import JITIRRecommender
from methods.cia import CIARecommender

METHODS = [CBRRecommender(), JITIRRecommender(), CIARecommender()]


@pytest.mark.parametrize("rec", METHODS, ids=lambda r: r.name)
def test_method_returns_results(rec, db_items, base_context):
    results = rec.recommend(db_items, base_context, top_k=5)
    assert len(results) > 0, f"{rec.name} returned no results"


@pytest.mark.parametrize("rec", METHODS, ids=lambda r: r.name)
def test_method_result_shape(rec, db_items, base_context):
    results = rec.recommend(db_items, base_context, top_k=5)
    for r in results:
        assert "item" in r
        assert "score" in r
        assert "explanation" in r


@pytest.mark.parametrize("rec", METHODS, ids=lambda r: r.name)
def test_method_sorted_descending(rec, db_items, base_context):
    results = rec.recommend(db_items, base_context, top_k=5)
    scores = [r["score"] for r in results]
    assert scores == sorted(scores, reverse=True)


@pytest.mark.parametrize("rec", METHODS, ids=lambda r: r.name)
def test_method_handles_empty_items(rec, base_context):
    results = rec.recommend([], base_context, top_k=5)
    assert results == []


def test_methods_return_different_rankings(db_items, base_context):
    """The three methods should not always agree — if they do, something is wrong."""
    results = {rec.name: [r["item"].id for r in rec.recommend(db_items, base_context, top_k=5)]
               for rec in METHODS}
    # At least one pair of methods should differ
    cbr_ids = results["CBR"]
    cia_ids = results["CIA"]
    jitir_ids = results["JITIR"]
    all_identical = (cbr_ids == cia_ids == jitir_ids)
    assert not all_identical, "All three methods returned identical rankings — likely a bug"
