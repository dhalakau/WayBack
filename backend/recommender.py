import datetime
from database import SessionLocal
from models import Item
from scorer import compute_score
from explainer import explain

def get_recommendations(user_lat, user_lon, top_k=5):
    now = datetime.datetime.utcnow()
    db = SessionLocal()
    items = db.query(Item).all()
    db.close()

    scored = []
    for item in items:
        score = compute_score(item, user_lat, user_lon, now)
        if score > 0:
            scored.append({
                "id": item.id,
                "title": item.title,
                "description": item.description,
                "item_type": item.item_type,
                "category": item.category,
                "latitude": item.latitude,
                "longitude": item.longitude,
                "address": item.address,
                "tags": item.tags,
                "score": score,
                "explanation": explain(item, user_lat, user_lon, now),
            })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]