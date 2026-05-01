import math
from collections import Counter
from methods.base import BaseRecommender


def tokenize(text):
    """Simple lowercase whitespace tokenizer."""
    if not text:
        return []
    return [w.lower().strip(",.!?;:") for w in text.split() if w.strip()]


def item_text(item):
    """Combine all text fields of an item into one string."""
    parts = [
        item.title or "",
        item.description or "",
        item.tags or "",
        item.category or "",
    ]
    return " ".join(parts)


def compute_tfidf(documents):
    """
    documents: list of token lists
    Returns: list of dicts {term: tfidf_weight}
    """
    n_docs = len(documents)
    df = Counter()
    for doc in documents:
        for term in set(doc):
            df[term] += 1

    tfidf_vectors = []
    for doc in documents:
        tf = Counter(doc)
        vec = {}
        for term, count in tf.items():
            idf = math.log((n_docs + 1) / (df[term] + 1)) + 1
            vec[term] = count * idf
        tfidf_vectors.append(vec)
    return tfidf_vectors


def cosine_similarity(vec_a, vec_b):
    """Cosine similarity between two sparse dict vectors."""
    if not vec_a or not vec_b:
        return 0.0
    common = set(vec_a) & set(vec_b)
    dot = sum(vec_a[t] * vec_b[t] for t in common)
    norm_a = math.sqrt(sum(v ** 2 for v in vec_a.values()))
    norm_b = math.sqrt(sum(v ** 2 for v in vec_b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class CBRRecommender(BaseRecommender):
    """
    Content-Based Recommender with contextual pre-filtering.
    Step 1: Filter items by current category (pre-filtering).
    Step 2: Rank remaining by TF-IDF cosine similarity to context text.
    """

    name = "CBR"

    def recommend(self, items, context, top_k=10):
        current_category = context.get("current_category")
        current_text = context.get("current_text", "")

        # Step 1: Pre-filter by category
        if current_category:
            filtered = [i for i in items if i.category == current_category]
        else:
            filtered = list(items)

        if not filtered:
            return []

        # Step 2: TF-IDF ranking
        item_docs = [tokenize(item_text(i)) for i in filtered]
        query_doc = tokenize(current_text) if current_text else []

        all_docs = item_docs + [query_doc]
        tfidf_vectors = compute_tfidf(all_docs)
        query_vec = tfidf_vectors[-1]
        item_vecs = tfidf_vectors[:-1]

        scored = []
        for item, vec in zip(filtered, item_vecs):
            sim = cosine_similarity(query_vec, vec) if query_doc else 0.5
            scored.append({
                "item": item,
                "score": round(sim, 4),
                "explanation": f"Showing because it matches your '{current_category}' context (similarity: {sim:.2f}).",
            })

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]