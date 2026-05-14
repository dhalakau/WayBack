"""
Generate bar charts from the evaluation results CSV.

One PNG per metric, with error bars showing ± std across seeds.
These go straight into the report.

Run AFTER run_experiment.py:
    python plot_results.py
"""
import csv
from pathlib import Path

import matplotlib.pyplot as plt

RESULTS_DIR = Path(__file__).parent / "results"
SUMMARY_CSV = RESULTS_DIR / "results_summary.csv"

# Display order for the bars — random last so it visually reads as the floor
METHOD_ORDER = ["CBR", "JITIR", "CIA", "random"]
METHOD_COLORS = {
    "CBR":    "#4285f4",   # blue   — content-based
    "JITIR":  "#34a853",   # green  — search-based
    "CIA":    "#a78bfa",   # purple — spreading activation
    "random": "#9aa0a6",   # grey   — baseline
}
METHOD_LABELS = {
    "CBR":    "CBR",
    "JITIR":  "JITIR",
    "CIA":    "CIA",
    "random": "Random",
}

# Metric display config: (axis label, higher_is_better)
METRICS = {
    "precision@10": ("Precision@10",        True),
    "rouge_n":      ("ROUGE-N (bigram)",    True),
    "success@1":    ("Success@1",           True),
    "success@10":   ("Success@10",          True),
    "rbo":          ("RBO (lower = more diverse)", False),
    "unique_ratio": ("Unique ratio",        True),
}


def load_summary():
    rows = {}
    with SUMMARY_CSV.open() as f:
        for row in csv.DictReader(f):
            rows[row["method"]] = row
    return rows


def plot_metric(summary, metric_key, label, higher_is_better):
    methods = [m for m in METHOD_ORDER if m in summary]
    means = [float(summary[m][f"{metric_key}_mean"]) for m in methods]
    stds  = [float(summary[m][f"{metric_key}_std"])  for m in methods]
    colors = [METHOD_COLORS[m] for m in methods]
    labels = [METHOD_LABELS[m] for m in methods]

    fig, ax = plt.subplots(figsize=(6, 4))
    bars = ax.bar(labels, means, yerr=stds, capsize=6, color=colors, edgecolor="black", linewidth=0.6)

    # Annotate each bar with its mean value
    for bar, mean in zip(bars, means):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + (max(stds) * 0.3 if max(stds) > 0 else 0.01),
            f"{mean:.3f}",
            ha="center", va="bottom", fontsize=9,
        )

    direction = "higher is better" if higher_is_better else "lower is better"
    ax.set_ylabel(label)
    ax.set_title(f"{label}  ({direction})")
    ax.grid(axis="y", alpha=0.3)
    ax.set_axisbelow(True)
    plt.tight_layout()

    out_path = RESULTS_DIR / f"plot_{metric_key.replace('@', '_at_')}.png"
    plt.savefig(out_path, dpi=150)
    plt.close()
    print(f"  → {out_path.name}")


def plot_combined_overview(summary):
    """One figure with all metrics — gives the report a single hero chart."""
    metrics = list(METRICS.keys())
    fig, axes = plt.subplots(2, 3, figsize=(15, 8))
    axes = axes.flatten()

    methods = [m for m in METHOD_ORDER if m in summary]
    labels  = [METHOD_LABELS[m] for m in methods]
    colors  = [METHOD_COLORS[m] for m in methods]

    for ax, metric_key in zip(axes, metrics):
        label, higher_is_better = METRICS[metric_key]
        means = [float(summary[m][f"{metric_key}_mean"]) for m in methods]
        stds  = [float(summary[m][f"{metric_key}_std"])  for m in methods]
        ax.bar(labels, means, yerr=stds, capsize=4, color=colors, edgecolor="black", linewidth=0.5)
        direction = "↑" if higher_is_better else "↓"
        ax.set_title(f"{label} {direction}", fontsize=11)
        ax.grid(axis="y", alpha=0.3)
        ax.set_axisbelow(True)
        ax.tick_params(axis="x", labelsize=9)

    fig.suptitle("WayBack — Method Comparison Across Paper Metrics", fontsize=13, y=1.00)
    plt.tight_layout()
    out_path = RESULTS_DIR / "plot_overview.png"
    plt.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  → {out_path.name}")


def main():
    if not SUMMARY_CSV.exists():
        raise SystemExit(f"Run run_experiment.py first — {SUMMARY_CSV} not found.")

    summary = load_summary()
    print(f"Loaded summary for {len(summary)} methods. Generating plots...\n")

    for metric_key, (label, higher_is_better) in METRICS.items():
        plot_metric(summary, metric_key, label, higher_is_better)

    plot_combined_overview(summary)
    print(f"\nAll plots written to {RESULTS_DIR}/")


if __name__ == "__main__":
    main()
