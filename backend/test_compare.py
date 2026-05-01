import datetime
from database import SessionLocal
from models import Item
from methods.cbr import CBRRecommender
from methods.jitir import JITIRRecommender
from methods.cia import CIARecommender

db = SessionLocal()
items = db.query(Item).all()
db.close()

context = {
    "lat": 48.1374,
    "lon": 11.5755,
    "now": datetime.datetime.utcnow(),
    "current_category": "restaurant",
    "current_text": "traditional bavarian beer hall",
}

methods = [CBRRecommender(), JITIRRecommender(), CIARecommender()]

for method in methods:
    print(f"\n=== {method.name} ===")
    results = method.recommend(items, context, top_k=5)
    for r in results:
        print(f"  {r['score']:.3f} | {r['item'].title} [{r['item'].category}]")