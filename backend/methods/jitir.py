import math
from collections import Counter
from methods.base import BaseRecommender
from methods.cbr import tokenize, item_text


def bm25_score(query_tokens, doc_tokens, all_docs, k1=1.5, b=0.75):
    """
    BM25 ranking — the standard IR retrieval model.
    The paper uses Indri's default model; BM25 is the modern equivalent.
    """
    if not query_tokens or not doc_tokens:
        return 0.0

    n_docs = len(all_docs)
    avg_dl = sum(len(d) for d in all_docs) / n_docs if n_docs else 0
    doc_len = len(doc_tokens)
    doc_tf = Counter(doc_tokens)

    # IDF per term
    df = Counter()
    for d in all_docs:
        for term in set(d):
            df[term] += 1

    score = 0.0
    for term in query_tokens:
        if term not in doc_tf:
            continue
        tf = doc_tf[term]
        idf = math.log((n_docs - df[term] + 0.5) / (df[term] + 0.5) + 1)
        numerator = tf * (k1 + 1)
        denominator = tf + k1 * (1 - b + b * (doc_len / avg_dl)) if avg_dl else 1
        score += idf * (numerator / denominator)

    return score


class JITIRRecommender(BaseRecommender):
    """
    Just-In-Time Information Retrieval.
    Treats the current context as a search query.
    Ranks ALL items by BM25 retrieval score (no pre-filtering).
    """

    name = "JITIR"

    def recommend(self, items, context, top_k=10):
        query_text = context.get("current_text", "")
        current_category = context.get("current_category", "")

        # Build query from context (similar to paper: typed keys + window title + active text)
        query_parts = [query_text, current_category or ""]
        query = " ".join(p for p in query_parts if p)
        query_tokens = tokenize(query)

        if not query_tokens:
            return []

        all_docs = [tokenize(item_text(i)) for i in items]

        scored = []
        for item, doc_tokens in zip(items, all_docs):
            score = bm25_score(query_tokens, doc_tokens, all_docs)
            if score > 0:
                scored.append({
                    "item": item,
                    "score": round(score, 4),
                    "explanation": f"Matched your context query (BM25 score: {score:.2f}).",
                })

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]