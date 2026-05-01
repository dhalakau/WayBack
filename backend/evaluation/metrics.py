"""
Evaluation metrics from Sappelli et al. (2016).
Each metric corresponds to one of the four evaluation criteria.
"""

from collections import Counter


# ============================================================
# CRITERION 1: Context Relevance
# ============================================================
# "Does the suggestion fit the user's current context category?"
# Metric: Precision@k
# A suggestion is correct if its category matches the active context category.
# ============================================================

def precision_at_k(recommendations, target_category, k=10):
    """
    Args:
        recommendations: list of {item, score, explanation} dicts
        target_category: the current context's category (string)
        k: top-k cutoff
    Returns:
        float in [0, 1]
    """
    if not recommendations or not target_category:
        return 0.0

    top_k = recommendations[:k]
    correct = sum(1 for r in top_k if r["item"].category == target_category)
    return correct / len(top_k)


# ============================================================
# CRITERION 2: Document Relevance (ROUGE-N)
# ============================================================
# "How much textual overlap between the recommended item and a target?"
# Paper uses ROUGE-N with 2-grams.
# ROUGE-N = 2 * |source ∩ target| / (|source| + |target|)
# ============================================================

def get_ngrams(tokens, n=2):
    """Return set of n-grams from a token list."""
    if len(tokens) < n:
        return set()
    return set(tuple(tokens[i:i + n]) for i in range(len(tokens) - n + 1))


def rouge_n(source_tokens, target_tokens, n=2):
    """
    Args:
        source_tokens: tokens from recommended item
        target_tokens: tokens from the target/produced document
    Returns:
        float in [0, 1]
    """
    src_ngrams = get_ngrams(source_tokens, n)
    tgt_ngrams = get_ngrams(target_tokens, n)
    if not src_ngrams or not tgt_ngrams:
        return 0.0
    overlap = src_ngrams & tgt_ngrams
    return (2 * len(overlap)) / (len(src_ngrams) + len(tgt_ngrams))


# ============================================================
# CRITERION 3: Action Prediction
# ============================================================
# "Did the system predict which item the user opens next?"
# Metric: Success@1, Success@10
# ============================================================

def success_at_k(recommendations, next_item_id, k=10):
    """
    Args:
        recommendations: list of {item, score, explanation} dicts
        next_item_id: id of the item the user actually accessed next
        k: cutoff
    Returns:
        1 if next_item_id is in top-k, else 0
    """
    if not recommendations or next_item_id is None:
        return 0
    top_k_ids = [r["item"].id for r in recommendations[:k]]
    return 1 if next_item_id in top_k_ids else 0


# ============================================================
# CRITERION 4: Diversity
# ============================================================
# Two sub-metrics from the paper:
#   a) Rank Biased Overlap (RBO) — similarity between consecutive lists.
#      Lower RBO = more diverse.
#   b) Unique percentage — what fraction of all suggested items are unique.
# ============================================================

def rbo(list_a, list_b, p=0.9):
    """
    Rank-Biased Overlap (Webber et al. 2010).
    p=0.9 weights top results more, as in the paper.
    Returns 0 (no overlap) to 1 (identical ordering).
    """
    if not list_a or not list_b:
        return 0.0

    max_depth = max(len(list_a), len(list_b))
    score = 0.0
    for d in range(1, max_depth + 1):
        set_a = set(list_a[:d])
        set_b = set(list_b[:d])
        overlap = len(set_a & set_b)
        agreement = overlap / d
        score += (p ** (d - 1)) * agreement

    return (1 - p) * score


def unique_ratio(all_recommendation_lists):
    """
    Across many recommendation events, how unique is the catalog of suggestions?
    Args:
        all_recommendation_lists: list of [item_ids] from many events
    Returns:
        unique_count / total_count
    """
    if not all_recommendation_lists:
        return 0.0

    flat = [item_id for lst in all_recommendation_lists for item_id in lst]
    if not flat:
        return 0.0
    return len(set(flat)) / len(flat)