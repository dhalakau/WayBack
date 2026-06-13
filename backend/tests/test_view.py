import datetime

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
    """Create a throwaway item with a known clean view state, then remove it.

    last_viewed_at is forced to NULL *after* insert: the model sets a now_utc()
    default at INSERT time, so we update it down to None to exercise the
    "never viewed" branch deterministically.
    """
    db = SessionLocal()
    item = Item(
        title="Test View Place",
        category="cafe",
        latitude=48.1374,
        longitude=11.5755,
        view_count=0,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    item_id = item.id

    # Clear the INSERT-time default so we start from a true "never viewed" state.
    item.last_viewed_at = None
    db.commit()
    db.close()

    yield item_id

    db = SessionLocal()
    obj = db.query(Item).filter(Item.id == item_id).first()
    if obj:
        db.delete(obj)
        db.commit()
    db.close()


def _get_count(item_id):
    db = SessionLocal()
    item = db.query(Item).filter(Item.id == item_id).first()
    count = item.view_count
    db.close()
    return count


def _set_last_viewed(item_id, dt):
    db = SessionLocal()
    item = db.query(Item).filter(Item.id == item_id).first()
    item.last_viewed_at = dt
    db.commit()
    db.close()


# ---------------------------------------------------------------------------
# GET is a pure read
# ---------------------------------------------------------------------------

def test_get_does_not_change_view_count(client, temp_item):
    before = _get_count(temp_item)

    for _ in range(3):
        resp = client.get(f"/saved-items/{temp_item}")
        assert resp.status_code == 200

    assert _get_count(temp_item) == before


def test_get_returns_the_item(client, temp_item):
    resp = client.get(f"/saved-items/{temp_item}")
    assert resp.status_code == 200
    assert resp.get_json()["id"] == temp_item


def test_get_missing_item_404(client):
    resp = client.get("/saved-items/99999999")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /view records a deliberate view, with debounce
# ---------------------------------------------------------------------------

def test_post_view_increments_once(client, temp_item):
    assert _get_count(temp_item) == 0

    resp = client.post(f"/items/{temp_item}/view")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["viewCount"] == 1
    assert body["lastViewedAt"] is not None
    assert _get_count(temp_item) == 1


def test_post_view_debounced_within_window(client, temp_item):
    # First deliberate view counts.
    resp = client.post(f"/items/{temp_item}/view")
    assert resp.get_json()["viewCount"] == 1

    # Reopening the same place immediately must NOT inflate the count.
    resp = client.post(f"/items/{temp_item}/view")
    assert resp.status_code == 200
    assert resp.get_json()["viewCount"] == 1
    assert _get_count(temp_item) == 1


def test_post_view_counts_again_after_window(client, temp_item):
    resp = client.post(f"/items/{temp_item}/view")
    assert resp.get_json()["viewCount"] == 1

    # Simulate the last view happening more than 10 minutes ago.
    stale = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=11)
    _set_last_viewed(temp_item, stale)

    resp = client.post(f"/items/{temp_item}/view")
    assert resp.status_code == 200
    assert resp.get_json()["viewCount"] == 2
    assert _get_count(temp_item) == 2


def test_post_view_missing_item_404(client):
    resp = client.post("/items/99999999/view")
    assert resp.status_code == 404
