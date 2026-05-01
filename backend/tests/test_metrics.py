from evaluation.metrics import precision_at_k, rouge_n, success_at_k, rbo, unique_ratio


class MockItem:
    def __init__(self, id, category):
        self.id = id
        self.category = category


# Shared fake recommendations: 3 restaurants, 1 museum, 1 bar
FAKE_RECS = [
    {"item": MockItem(1, "restaurant"), "score": 0.9},
    {"item": MockItem(2, "restaurant"), "score": 0.8},
    {"item": MockItem(3, "museum"),     "score": 0.7},
    {"item": MockItem(4, "restaurant"), "score": 0.6},
    {"item": MockItem(5, "bar"),        "score": 0.5},
]


# --- precision_at_k ---

def test_precision_at_k_correct():
    # 3 out of 5 are restaurants
    result = precision_at_k(FAKE_RECS, "restaurant", k=5)
    assert abs(result - 0.6) < 0.001


def test_precision_at_k_all_match():
    recs = [{"item": MockItem(i, "restaurant"), "score": 1.0} for i in range(5)]
    assert precision_at_k(recs, "restaurant", k=5) == 1.0


def test_precision_at_k_none_match():
    recs = [{"item": MockItem(i, "museum"), "score": 1.0} for i in range(5)]
    assert precision_at_k(recs, "restaurant", k=5) == 0.0


# --- rouge_n ---

def test_rouge_n_identical():
    tokens = "bavarian beer food".split()
    assert rouge_n(tokens, tokens, n=2) == 1.0


def test_rouge_n_no_overlap():
    src = "coffee cake".split()
    tgt = "beer pretzel".split()
    assert rouge_n(src, tgt, n=2) == 0.0


def test_rouge_n_partial_overlap():
    src = "traditional bavarian beer hall food".split()
    tgt = "bavarian beer food traditional".split()
    result = rouge_n(src, tgt, n=2)
    assert 0.0 < result < 1.0


# --- success_at_k ---

def test_success_at_k_hit_within_k():
    # Returns 1 (truthy) when item is found within k
    assert success_at_k(FAKE_RECS, next_item_id=3, k=5)


def test_success_at_k_miss_outside_k():
    # Returns 0 (falsy) when item is not within k
    assert not success_at_k(FAKE_RECS, next_item_id=3, k=1)


def test_success_at_k_item_not_in_list():
    # Returns 0 (falsy) when item is not in list at all
    assert not success_at_k(FAKE_RECS, next_item_id=99, k=5)


# --- rbo ---

def test_rbo_identical_lists_score_higher_than_different():
    # RBO with p=0.9 on finite lists does not reach 1.0 mathematically —
    # but identical lists must score strictly higher than completely different ones
    lst = [1, 2, 3, 4, 5]
    different = [6, 7, 8, 9, 10]
    assert rbo(lst, lst) > rbo(lst, different)


def test_rbo_completely_different_lists():
    result = rbo([1, 2, 3], [4, 5, 6])
    assert result < 0.1


def test_rbo_partially_similar():
    a = [1, 2, 3, 4, 5]
    b = [1, 2, 3, 6, 7]
    result = rbo(a, b)
    assert 0.1 < result < 1.0


# --- unique_ratio ---

def test_unique_ratio_all_unique():
    lists = [[1], [2], [3]]
    assert unique_ratio(lists) == 1.0


def test_unique_ratio_all_same():
    lists = [[1, 1, 1], [1, 1, 1]]
    assert unique_ratio(lists) == 0.0 or unique_ratio(lists) <= 0.5


def test_unique_ratio_partial():
    lists = [[1, 2, 3], [2, 3, 4], [3, 4, 5]]
    result = unique_ratio(lists)
    assert 0.0 < result <= 1.0