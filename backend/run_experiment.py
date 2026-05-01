"""
Main experiment: run all methods, compare, and print results.
"""
from database import SessionLocal
from models import Item

from methods.cbr import CBRRecommender
from methods.jitir import JITIRRecommender
from methods.cia import CIARecommender

from evaluation.runner import run_evaluation, print_results_table


# Load items
db = SessionLocal()
items = db.query(Item).all()
db.close()

print(f"Loaded {len(items)} items from the database.")

# Initialize methods
methods = [
    CBRRecommender(),
    JITIRRecommender(),
    CIARecommender(),
]

# Run evaluation
results = run_evaluation(items, methods, num_sessions=20, num_events=8)

# Print comparison table
print_results_table(results)