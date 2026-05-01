"""
Run all recommendation methods over simulated sessions and compute metrics.
This is the core experimental pipeline.
"""
import datetime
from evaluation.simulator import generate_multiple_sessions
from evaluation.metrics import precision_at_k, success_at_k, rbo, unique_ratio, rouge_n
from methods.cbr import tokenize, item_text


def evaluate_method(method, items, sessions, top_k=10):
    """
    Run a recommender over all sessions/events, returning aggregated metrics.
    """
    precision_scores = []
    success_at_1_scores = []
    success_at_10_scores = []
    rouge_scores = []
    rbo_scores = []
    all_recommendation_id_lists = []

    for session in sessions:
        prev_rec_ids = None

        for i, event in enumerate(session):
            recs = method.recommend(items, event, top_k=top_k)
            rec_ids = [r["item"].id for r in recs]
            all_recommendation_id_lists.append(rec_ids)

            # 1. Context Relevance
            precision_scores.append(
                precision_at_k(recs, event["current_category"], k=top_k)
            )

            # 2. Document Relevance — measure overlap between recommended item text
            #    and the user's current "task text" (current_text in our case)
            target_tokens = tokenize(event.get("current_text", ""))
            for r in recs:
                src_tokens = tokenize(item_text(r["item"]))
                rouge_scores.append(rouge_n(src_tokens, target_tokens, n=2))

            # 3. Action Prediction — does the next event's category match a top recommendation?
            if i + 1 < len(session):
                next_event = session[i + 1]
                next_target_items = [
                    it for it in items if it.category == next_event["current_category"]
                ]
                if next_target_items:
                    next_target_id = next_target_items[0].id
                    success_at_1_scores.append(success_at_k(recs, next_target_id, k=1))
                    success_at_10_scores.append(success_at_k(recs, next_target_id, k=top_k))

            # 4. Diversity — RBO between consecutive lists
            if prev_rec_ids is not None:
                rbo_scores.append(rbo(prev_rec_ids, rec_ids, p=0.9))
            prev_rec_ids = rec_ids

    def avg(lst):
        return sum(lst) / len(lst) if lst else 0.0

    return {
        "method": method.name,
        "precision@10": round(avg(precision_scores), 4),
        "rouge_n":      round(avg(rouge_scores), 4),
        "success@1":    round(avg(success_at_1_scores), 4),
        "success@10":   round(avg(success_at_10_scores), 4),
        "rbo":          round(avg(rbo_scores), 4),
        "unique_ratio": round(unique_ratio(all_recommendation_id_lists), 4),
    }


def run_evaluation(items, methods, num_sessions=20, num_events=8):
    """Run the full evaluation across all methods."""
    sessions = generate_multiple_sessions(
        num_sessions=num_sessions,
        num_events=num_events,
    )

    print(f"\nEvaluating {len(methods)} methods on {num_sessions} sessions × {num_events} events...\n")

    results = []
    for method in methods:
        print(f"  Running {method.name}...")
        result = evaluate_method(method, items, sessions, top_k=10)
        results.append(result)

    return results


def print_results_table(results):
    """Pretty-print the comparison table."""
    headers = ["Method", "Precision@10", "ROUGE-N", "Success@1", "Success@10", "RBO (lower=better)", "Unique%"]
    col_widths = [max(len(h), 12) for h in headers]

    print("\n" + "=" * 95)
    print("EVALUATION RESULTS  (averaged across all sessions)")
    print("=" * 95)
    print("  ".join(h.ljust(w) for h, w in zip(headers, col_widths)))
    print("-" * 95)
    for r in results:
        row = [
            r["method"],
            f"{r['precision@10']:.4f}",
            f"{r['rouge_n']:.4f}",
            f"{r['success@1']:.4f}",
            f"{r['success@10']:.4f}",
            f"{r['rbo']:.4f}",
            f"{r['unique_ratio']:.4f}",
        ]
        print("  ".join(c.ljust(w) for c, w in zip(row, col_widths)))
    print("=" * 95)