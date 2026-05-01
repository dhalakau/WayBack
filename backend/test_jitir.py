from methods.jitir import JITIRRecommender
from database import SessionLocal
from models import Item

db = SessionLocal()
items = db.query(Item).all()
db.close()

rec = JITIRRecommender()
context = {
    "current_category": "restaurant",
    "current_text": "traditional bavarian beer hall",
}
results = rec.recommend(items, context, top_k=5)

print(f"\nJITIR results for query='traditional bavarian beer hall':\n")
for r in results:
    print(f"  {r['score']:.3f} | {r['item'].title} [{r['item'].category}]")