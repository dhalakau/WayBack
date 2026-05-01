import math
import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from database import engine, Base, SessionLocal
from models import Item, Feedback
from methods.cbr import CBRRecommender
from methods.jitir import JITIRRecommender
from methods.cia import CIARecommender

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

Base.metadata.create_all(bind=engine)

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://localhost:3000"])

METHODS = {
    "cbr":   CBRRecommender(),
    "jitir": JITIRRecommender(),
    "cia":   CIARecommender(),
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def now_utc():
    return datetime.datetime.now(datetime.timezone.utc)


def to_ms(dt):
    """Convert a datetime to unix milliseconds. Returns None if dt is None."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    return int(dt.timestamp() * 1000)


def haversine_meters(lat1, lng1, lat2, lng2):
    """Straight-line distance between two coordinates in metres."""
    if None in (lat1, lng1, lat2, lng2):
        return None
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return int(2 * R * math.asin(math.sqrt(a)))


def months_since(dt):
    """Months elapsed since dt (rounded to 1 decimal place)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    return round((now_utc() - dt).days / 30.44, 1)


def item_to_dict(item):
    """Serialise an Item to the camelCase contract shape."""
    return {
        "id":           item.id,
        "name":         item.title,
        "category":     item.category or "",
        "lat":          item.latitude,
        "lng":          item.longitude,
        "savedAt":      to_ms(item.created_at),
        "lastViewedAt": to_ms(item.last_viewed_at),
        "viewCount":    item.view_count or 0,
        "notes":        item.description or "",
        "attachments":  [],   # not stored in DB yet — placeholder for v2
    }


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.route("/")
def home():
    return jsonify({"message": "WayBack API is running"})


# ---------------------------------------------------------------------------
# GET /saved-items  — all items for a user
# ---------------------------------------------------------------------------

@app.route("/saved-items", methods=["GET"])
def get_saved_items():
    db = SessionLocal()
    items = db.query(Item).all()
    db.close()
    return jsonify([item_to_dict(i) for i in items])


# ---------------------------------------------------------------------------
# GET /saved-items/:id  — single item; bumps lastViewedAt + viewCount
# ---------------------------------------------------------------------------

@app.route("/saved-items/<int:item_id>", methods=["GET"])
def get_saved_item(item_id):
    db = SessionLocal()
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        db.close()
        return jsonify({"error": "Item not found"}), 404

    # Side effect: record this view (feeds CIA ranking model)
    item.last_viewed_at = now_utc()
    item.view_count = (item.view_count or 0) + 1
    db.commit()
    db.refresh(item)
    result = item_to_dict(item)
    db.close()
    return jsonify(result)


# ---------------------------------------------------------------------------
# POST /saved-items  — create a new saved item
# ---------------------------------------------------------------------------

@app.route("/saved-items", methods=["POST"])
def create_saved_item():
    data = request.json
    if not data or not data.get("name"):
        return jsonify({"error": "name is required"}), 400

    db = SessionLocal()
    item = Item(
        title=data["name"],
        description=data.get("notes"),
        item_type=data.get("itemType", "map_pin"),
        category=data.get("category"),
        latitude=data.get("lat"),
        longitude=data.get("lng"),
        address=data.get("address"),
        tags=data.get("tags"),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    result = item_to_dict(item)
    db.close()
    return jsonify(result), 201


# ---------------------------------------------------------------------------
# DELETE /saved-items/:id
# ---------------------------------------------------------------------------

@app.route("/saved-items/<int:item_id>", methods=["DELETE"])
def delete_saved_item(item_id):
    db = SessionLocal()
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        db.close()
        return jsonify({"error": "Not found"}), 404
    db.delete(item)
    db.commit()
    db.close()
    return jsonify({"message": "Deleted"}), 200


# ---------------------------------------------------------------------------
# GET /recommendations  — context-ranked saved items
# ---------------------------------------------------------------------------

@app.route("/recommendations", methods=["GET"])
def recommendations():
    lat         = request.args.get("lat", type=float)
    lng         = request.args.get("lng", type=float)
    top_k       = request.args.get("top_k", default=5, type=int)
    method_name = request.args.get("method", default="cia").lower()
    category    = request.args.get("category", default=None)
    text        = request.args.get("text", default="")

    if lat is None or lng is None:
        return jsonify({"error": "lat and lng are required"}), 400

    method = METHODS.get(method_name)
    if method is None:
        return jsonify({"error": f"Unknown method '{method_name}'. Use: {list(METHODS.keys())}"}), 400

    db = SessionLocal()
    items = db.query(Item).all()
    db.close()

    context = {
        "lat":              lat,
        "lon":              lng,   # recommenders use 'lon' internally
        "now":              now_utc(),
        "current_category": category,
        "current_text":     text,
    }

    recs = method.recommend(items, context, top_k=top_k)

    return jsonify([
        {
            "item":  item_to_dict(r["item"]),
            "score": r["score"],
            "explanation": {
                "method":          method_name.upper(),
                "reason":          "context_match",
                "distanceMeters":  haversine_meters(lat, lng, r["item"].latitude, r["item"].longitude),
                "monthsSinceSaved": months_since(r["item"].created_at),
                "details":         {"description": r["explanation"]},
            },
        }
        for r in recs
    ])


# ---------------------------------------------------------------------------
# POST /feedback  — record useful / not useful on a recommendation
# ---------------------------------------------------------------------------

@app.route("/feedback", methods=["POST"])
def post_feedback():
    data = request.json
    if not data:
        return jsonify({"error": "Request body required"}), 400

    required = ["itemId", "useful"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    snapshot = data.get("contextSnapshot", {})

    db = SessionLocal()
    fb = Feedback(
        user_id=data.get("userId"),
        item_id=data["itemId"],
        useful=data["useful"],
        method=data.get("method"),
        lat=snapshot.get("lat"),
        lng=snapshot.get("lng"),
        time=snapshot.get("time"),
    )
    db.add(fb)
    db.commit()
    db.close()
    return "", 204


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(debug=True, port=8000)
