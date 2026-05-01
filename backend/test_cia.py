import datetime
from methods.cia import CIARecommender
from database import SessionLocal
from models import Item

db = SessionLocal()
items = db.query(Item).all()
db.close()

rec = CIARecommender()
context = {
    "lat": 48.1374,
    "lon": 11.5755,
    "now": datetime.datetime.utcnow(),
    "current_category": "restaurant",
    "current_text": "traditional bavarian beer hall",
}
results = rec.recommend(items, context, top_k=5)

print(f"\nCIA results:\n")
for r in results:
    print(f"  {r['score']:.3f} | {r['item'].title} [{r['item'].category}]")