from evaluation.metrics import precision_at_k, rouge_n, success_at_k, rbo, unique_ratio


# Mock recommendation results
class MockItem:
    def __init__(self, id, category):
        self.id = id
        self.category = category


fake_recs = [
    {"item": MockItem(1, "restaurant"), "score": 0.9},
    {"item": MockItem(2, "restaurant"), "score": 0.8},
    {"item": MockItem(3, "museum"),     "score": 0.7},
    {"item": MockItem(4, "restaurant"), "score": 0.6},
    {"item": MockItem(5, "bar"),        "score": 0.5},
]

# Precision@5: 3 out of 5 are restaurants
print("Precision@5:", precision_at_k(fake_recs, "restaurant", k=5))

# ROUGE-N
src = "traditional bavarian beer hall food".split()
tgt = "bavarian beer food traditional".split()
print("ROUGE-2:   ", round(rouge_n(src, tgt, n=2), 4))

# Success@k: did we predict item id=3?
print("Success@1: ", success_at_k(fake_recs, next_item_id=3, k=1))
print("Success@5: ", success_at_k(fake_recs, next_item_id=3, k=5))

# RBO
list_a = [1, 2, 3, 4, 5]
list_b = [1, 2, 3, 6, 7]
print("RBO (similar):", round(rbo(list_a, list_b), 4))
print("RBO (different):", round(rbo([1, 2, 3], [4, 5, 6]), 4))

# Unique ratio
lists = [[1, 2, 3], [2, 3, 4], [3, 4, 5]]  # 5 unique items, 9 total
print("Unique ratio:", round(unique_ratio(lists), 4))