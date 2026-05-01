from flask import Flask, request, jsonify
from flask_cors import CORS
from database import engine, Base
from models import Item
from methods.cbr import CBRRecommender
from methods.jitir import JITIRRecommender
from methods.cia import CIARecommender

METHODS = {
    "cbr": CBRRecommender(),
    "jitir": JITIRRecommender(),
    "cia": CIARecommender(),
}
from database import SessionLocal
import datetime

Base.metadata.create_all(bind=engine)

app = Flask(__name__)
CORS(app)


@app.route("/")
def home():
    return jsonify({"message": "WayBack API is running"})


@app.route("/items", methods=["GET"])
def get_items():
    db = SessionLocal()
    items = db.query(Item).all()
    db.close()
    return jsonify([{
        "id": i.id,
        "title": i.title,
        "description": i.description,
        "item_type": i.item_type,
        "category": i.category,
        "latitude": i.latitude,
        "longitude": i.longitude,
        "address": i.address,
        "tags": i.tags,
        "event_datetime": i.event_datetime.isoformat() if i.event_datetime else None,
    } for i in items])


@app.route("/items", methods=["POST"])
def create_item():
    data = request.json
    db = SessionLocal()
    item = Item(
        title=data["title"],
        description=data.get("description"),
        item_type=data["item_type"],
        category=data.get("category"),
        latitude=data.get("latitude"),
        longitude=data.get("longitude"),
        address=data.get("address"),
        tags=data.get("tags"),
        event_datetime=datetime.datetime.fromisoformat(data["event_datetime"]) if data.get("event_datetime") else None,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    result = {"id": item.id, "title": item.title}
    db.close()
    return jsonify(result), 201


@app.route("/items/<int:item_id>", methods=["DELETE"])
def delete_item(item_id):
    db = SessionLocal()
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        db.close()
        return jsonify({"error": "Not found"}), 404
    db.delete(item)
    db.commit()
    db.close()
    return jsonify({"message": "Deleted"}), 200


@app.route("/recommendations", methods=["GET"])
def recommendations():
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    top_k = request.args.get("top_k", default=5, type=int)
    method_name = request.args.get("method", default="cia").lower()
    category = request.args.get("category", default=None)
    text = request.args.get("text", default="")

    if lat is None or lon is None:
        return jsonify({"error": "lat and lon are required"}), 400

    method = METHODS.get(method_name)
    if method is None:
        return jsonify({"error": f"unknown method '{method_name}'. Use one of: {list(METHODS.keys())}"}), 400

    db = SessionLocal()
    items = db.query(Item).all()
    db.close()

    context = {
        "lat": lat,
        "lon": lon,
        "now": datetime.datetime.utcnow(),
        "current_category": category,
        "current_text": text,
    }

    recs = method.recommend(items, context, top_k=top_k)

    return jsonify([{
        "id": r["item"].id,
        "title": r["item"].title,
        "description": r["item"].description,
        "item_type": r["item"].item_type,
        "category": r["item"].category,
        "latitude": r["item"].latitude,
        "longitude": r["item"].longitude,
        "address": r["item"].address,
        "tags": r["item"].tags,
        "score": r["score"],
        "explanation": r["explanation"],
    } for r in recs])


if __name__ == "__main__":
    app.run(debug=True, port=8000)