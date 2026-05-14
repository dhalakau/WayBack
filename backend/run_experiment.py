"""
Main experiment runner — produces report-ready evaluation numbers.

What this does:
  - Runs all 4 methods (CBR, JITIR, CIA, + Random baseline) across N seeds.
  - Each seed = a different set of simulated tourist sessions.
  - Aggregates mean ± std for every metric across seeds.
  - Writes results.csv (per-seed rows) and results_summary.csv (mean ± std).
  - Also writes results_summary.json for the report write-up.

Usage:
    python run_experiment.py                  # default: 5 seeds, 20 sessions each
    python run_experiment.py --seeds 10       # more seeds → tighter confidence
    python run_experiment.py --sessions 50    # more sessions per seed
"""
import argparse
import csv
import json
import statistics
from pathlib import Path

from database import SessionLocal
from models import Item

from methods.cbr import CBRRecommender
from methods.jitir import JITIRRecommender
from methods.cia import CIARecommender
from methods.random_baseline import RandomRecommender

from evaluation.runner import run_evaluation, print_results_table


METRIC_KEYS = ["precision@10", "rouge_n", "success@1", "success@10", "rbo", "unique_ratio"]
OUT_DIR = Path(__file__).parent / "results"


def build_methods(seed):
    """Fresh method instances per seed — Random needs its own RNG state."""
    return [
        CBRRecommender(),
        JITIRRecommender(),
        CIARecommender(),
        RandomRecommender(seed=seed),
    ]


def run_multi_seed(num_seeds, num_sessions, num_events):
    """Run the evaluation `num_seeds` times and collect per-seed results."""
    db = SessionLocal()
    items = db.query(Item).all()
    db.close()
    print(f"Loaded {len(items)} items from the database.")

    all_runs = []  # list of (seed, [method_results])
    for seed in range(num_seeds):
        print(f"\n{'#' * 60}\n# Seed {seed + 1}/{num_seeds}\n{'#' * 60}")
        methods = build_methods(seed=seed * 1000)  # spread random-baseline seeds widely
        results = run_evaluation(
            items, methods,
            num_sessions=num_sessions,
            num_events=num_events,
            base_seed=seed * 100,
        )
        print_results_table(results)
        all_runs.append((seed, results))

    return all_runs


def aggregate(all_runs):
    """Collapse per-seed results into mean ± std per (method, metric)."""
    by_method = {}  # method_name -> {metric: [values...]}
    for seed, results in all_runs:
        for r in results:
            by_method.setdefault(r["method"], {k: [] for k in METRIC_KEYS})
            for k in METRIC_KEYS:
                by_method[r["method"]][k].append(r[k])

    summary = []
    for method, metric_lists in by_method.items():
        row = {"method": method, "n_seeds": len(next(iter(metric_lists.values())))}
        for k, values in metric_lists.items():
            row[f"{k}_mean"] = round(statistics.mean(values), 4)
            row[f"{k}_std"]  = round(statistics.stdev(values), 4) if len(values) > 1 else 0.0
        summary.append(row)
    return summary


def write_outputs(all_runs, summary):
    OUT_DIR.mkdir(exist_ok=True)

    # Per-seed raw results — one row per (seed, method)
    raw_path = OUT_DIR / "results.csv"
    with raw_path.open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["seed", "method"] + METRIC_KEYS)
        for seed, results in all_runs:
            for r in results:
                writer.writerow([seed, r["method"]] + [r[k] for k in METRIC_KEYS])
    print(f"\nWrote per-seed results → {raw_path}")

    # Summary — mean and std per metric per method
    summary_csv = OUT_DIR / "results_summary.csv"
    with summary_csv.open("w", newline="") as f:
        writer = csv.writer(f)
        header = ["method", "n_seeds"]
        for k in METRIC_KEYS:
            header.extend([f"{k}_mean", f"{k}_std"])
        writer.writerow(header)
        for row in summary:
            writer.writerow([row[c] for c in header])
    print(f"Wrote summary (mean ± std) → {summary_csv}")

    # JSON for paper write-up
    summary_json = OUT_DIR / "results_summary.json"
    summary_json.write_text(json.dumps(summary, indent=2))
    print(f"Wrote JSON summary → {summary_json}")


def print_summary_table(summary):
    print("\n" + "=" * 100)
    print("FINAL SUMMARY  (mean ± std across all seeds)")
    print("=" * 100)
    headers = ["Method"] + METRIC_KEYS
    print("  ".join(h.ljust(16) for h in headers))
    print("-" * 100)
    for row in summary:
        line = [row["method"].ljust(16)]
        for k in METRIC_KEYS:
            line.append(f"{row[f'{k}_mean']:.3f} ± {row[f'{k}_std']:.3f}".ljust(16))
        print("  ".join(line))
    print("=" * 100)
    print("\nInterpretation:")
    print("  - Higher is better for: precision@10, rouge_n, success@1, success@10, unique_ratio")
    print("  - Lower is better for:  rbo (lower = more diverse across consecutive lists)")
    print("  - 'random' is the baseline floor — real methods should beat it on most metrics.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seeds",    type=int, default=5,  help="Number of independent runs (default: 5)")
    parser.add_argument("--sessions", type=int, default=20, help="Sessions per run (default: 20)")
    parser.add_argument("--events",   type=int, default=8,  help="Events per session (default: 8)")
    args = parser.parse_args()

    all_runs = run_multi_seed(args.seeds, args.sessions, args.events)
    summary = aggregate(all_runs)
    write_outputs(all_runs, summary)
    print_summary_table(summary)


if __name__ == "__main__":
    main()
