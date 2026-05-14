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


def time_of_day_query():
    """Fallback query for JITIR when no text context is provided."""
    hour = datetime.datetime.now().hour
    if 5 <= hour < 11:  return "breakfast cafe morning coffee"
    if 11 <= hour < 14: return "lunch food market restaurant"
    if 14 <= hour < 18: return "museum culture sightseeing attractions"
    if 18 <= hour < 23: return "dinner restaurant evening drinks"
    return "bar drinks night"


def pick_reason(item, distance_m, months_old, weather):
    """
    Pick the most appropriate reason code based on real item data.
    These codes match the frontend's explanationText.js mapping.
    """
    view_count = item.view_count or 0
    is_nearby  = distance_m is not None and distance_m < 500
    is_far     = distance_m is not None and distance_m > 2000
    is_old     = months_old is not None and months_old > 3
    is_recent  = months_old is not None and months_old <= 3
    is_indoor  = item.category in ("museum", "indoor", "shopping", "cafe")

    # Weather match takes priority on rainy days
    if weather == "rain" and is_indoor:
        return "matches_weather_indoor"

    # Far away + saved long ago → "time to revisit"
    if is_far and is_old:
        return "saved_long_ago"

    # Nearby items — pick reason based on view history
    if is_nearby:
        if view_count >= 2:
            return "nearby_frequent_view"
        if view_count == 0:
            return "nearby_unvisited"
        if is_recent:
            return "nearby_and_recent_save"

    # Fallback for items in the middle ground
    return "nearby_and_recent_save" if is_recent else "saved_long_ago"


def item_to_dict(item):
    """Serialise an Item to the camelCase contract shape."""
    return {
        "id":            item.id,
        "name":          item.title,
        "category":      item.category or "",
        "itemType":      item.item_type or "map_pin",
        "lat":           item.latitude,
        "lng":           item.longitude,
        "eventDatetime": to_ms(item.event_datetime),
        "tags":          [t.strip() for t in (item.tags or "").split(",") if t.strip()],
        "savedAt":       to_ms(item.created_at),
        "lastViewedAt":  to_ms(item.last_viewed_at),
        "viewCount":     item.view_count or 0,
        "notes":         item.description or "",
        "attachments":   [],   # not stored in DB yet — placeholder for v2
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
    weather     = request.args.get("weather", default=None)

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
        "current_text":     text or time_of_day_query(),
        "weather":          weather,
    }

    recs = method.recommend(items, context, top_k=top_k)

    results = []
    for r in recs:
        item = r["item"]
        dist   = haversine_meters(lat, lng, item.latitude, item.longitude)
        months = months_since(item.created_at)
        reason = pick_reason(item, dist, months, weather)

        results.append({
            "item":  item_to_dict(item),
            "score": r["score"],
            "explanation": {
                "method":           method_name.upper(),
                "reason":           reason,
                "distanceMeters":   dist,
                "monthsSinceSaved": months,
                "details":          {"description": r["explanation"]},
            },
        })

    return jsonify(results)


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
# GET /feedback/stats  — aggregate feedback per method
# ---------------------------------------------------------------------------

@app.route("/feedback/stats", methods=["GET"])
def feedback_stats():
    db = SessionLocal()
    feedbacks = db.query(Feedback).all()
    db.close()

    stats = {}
    for fb in feedbacks:
        method = (fb.method or "UNKNOWN").upper()
        if method not in stats:
            stats[method] = {"useful": 0, "notUseful": 0}
        if fb.useful:
            stats[method]["useful"] += 1
        else:
            stats[method]["notUseful"] += 1

    # Compute success rate per method
    for method, counts in stats.items():
        total = counts["useful"] + counts["notUseful"]
        counts["total"] = total
        counts["successRate"] = round(counts["useful"] / total, 3) if total else 0.0

    return jsonify({
        "perMethod": stats,
        "totalFeedback": sum(s["total"] for s in stats.values()),
    })

# ---------------------------------------------------------------------------
# (Removed) POST /ai/describe — descriptions are now baked into the seed,
# and user-added places get whatever the user types in the notes field.
# No live AI calls per request.
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    app.run(debug=True, port=8000)