from methods.cbr import CBRRecommender
from database import SessionLocal
from models import Item

db = SessionLocal()
items = db.query(Item).all()
db.close()

rec = CBRRecommender()
context = {
    "current_category": "restaurant",
    "current_text": "looking for traditional bavarian food",
}
results = rec.recommend(items, context, top_k=5)

print(f"\nCBR results for category='restaurant':\n")
for r in results:
    print(f"  {r['score']:.3f} | {r['item'].title}")
