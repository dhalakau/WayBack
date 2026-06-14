import pytest

from app import app
from database import SessionLocal
from models import Item


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


@pytest.fixture
def temp_item():
    """Create a throwaway item with a known note, then remove it."""
    db = SessionLocal()
    item = Item(
        title="Test Notes Place",
        category="cafe",
        latitude=48.1374,
        longitude=11.5755,
        description="original note",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    item_id = item.id
    db.close()

    yield item_id

    db = SessionLocal()
    obj = db.query(Item).filter(Item.id == item_id).first()
    if obj:
        db.delete(obj)
        db.commit()
    db.close()


def test_patch_updates_notes(client, temp_item):
    resp = client.patch(
        f"/saved-items/{temp_item}?userId=user_demo",
        json={"notes": "Glockenspiel plays at 11am"},
    )
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["id"] == temp_item
    assert body["notes"] == "Glockenspiel plays at 11am"

    # The change is persisted, not just echoed back.
    resp = client.get(f"/saved-items/{temp_item}")
    assert resp.get_json()["notes"] == "Glockenspiel plays at 11am"


def test_patch_empty_notes_clears(client, temp_item):
    resp = client.patch(
        f"/saved-items/{temp_item}?userId=user_demo",
        json={"notes": ""},
    )
    assert resp.status_code == 200
    assert resp.get_json()["notes"] == ""


def test_patch_returns_full_item_shape(client, temp_item):
    resp = client.patch(f"/saved-items/{temp_item}", json={"notes": "x"})
    body = resp.get_json()
    # Same shape as GET /saved-items/:id so the client can replace its copy.
    for key in ("id", "name", "category", "itemType", "lat", "lng",
                "savedAt", "viewCount", "notes", "attachments"):
        assert key in body


def test_patch_ignores_unknown_fields(client, temp_item):
    resp = client.patch(
        f"/saved-items/{temp_item}",
        json={"notes": "kept", "bogus": 123, "name": "should be ignored"},
    )
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["notes"] == "kept"
    # Unknown fields don't bleed into the item.
    assert body["name"] == "Test Notes Place"


def test_patch_missing_notes_is_noop(client, temp_item):
    resp = client.patch(f"/saved-items/{temp_item}", json={"unrelated": True})
    assert resp.status_code == 200
    assert resp.get_json()["notes"] == "original note"


def test_patch_missing_item_404(client):
    resp = client.patch("/saved-items/99999999", json={"notes": "x"})
    assert resp.status_code == 404
